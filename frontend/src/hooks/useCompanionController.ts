import { useState, useEffect, useRef } from 'react';
import type { VisualizerState } from '../components/VoiceVisualizer';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import { mcpClientService } from '../services/mcpClient';
import { getDeviceHeaders } from '../utils/deviceIdentity';

export interface CompanionController {
  isPipOpen: boolean;
  setIsPipOpen: (open: boolean) => void;
  assistantState: VisualizerState;
  setAssistantState: (state: VisualizerState) => void;
  isSpeaking: boolean;
  setIsSpeaking: (speaking: boolean) => void;
  transcript: string;
  listening: boolean;
  toggleListening: () => void;
  openPip: () => void;
  closePip: () => void;
  volume: number;
  
  // Dynamic LLM Response States
  responseText: string;
  setResponseText: (text: string) => void;
  responseHtml: string | null;
  setResponseHtml: (html: string | null) => void;
  isProcessing: boolean;
  clearResponse: () => void;
  speakUtterance: (text: string) => void;

  // PiP Size States
  pipWidth: number;
  pipHeight: number;
  setPipSize: (w: number, h: number) => void;
  transitionMessage: string;
  shouldDisplayPanel: boolean;
}

export interface UseCompanionControllerOptions {
  onInteractionComplete?: (prompt: string, text: string, html: string | null) => void;
}

export function useCompanionController(options?: UseCompanionControllerOptions): CompanionController {
  const [isPipOpen, setIsPipOpen] = useState(false);
  const [assistantState, setAssistantState] = useState<VisualizerState>('idle');
  const [volume, setVolume] = useState(0);

  // PiP Sizing
  const [pipWidth, setPipWidth] = useState(180);
  const [pipHeight, setPipHeight] = useState(80);

  const setPipSize = (w: number, h: number) => {
    setPipWidth(w);
    setPipHeight(h);
  };

  // LLM Response States
  const [responseText, setResponseText] = useState<string>('');
  const [responseHtml, setResponseHtml] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [transitionMessage, setTransitionMessage] = useState<string>('');
  const [shouldDisplayPanel, setShouldDisplayPanel] = useState<boolean>(false);
  const [isTtsSpeaking, setIsTtsSpeaking] = useState<boolean>(false);

  // Cache voices in a ref — loaded once on mount, refreshed on voiceschanged
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);

  const spokenTextIndexRef = useRef<number>(0);
  const speechVolumeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Stable refs for values read inside effects that must NOT be deps
  const responseTextRef = useRef(responseText);
  const responseHtmlRef = useRef(responseHtml);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    transcript,
    listening,
    resetTranscript,
  } = useSpeechRecognition();

  const [_isSpeaking, setIsSpeaking] = useState(false);
  const isRequestingRef = useRef(false);
  const lastStartRef = useRef<number>(0);

  // Keep stable refs in sync each render (no re-render cost)
  responseTextRef.current = responseText;
  responseHtmlRef.current = responseHtml;

  // Load voices into ref on mount — same pattern as MemeRenderer.tsx
  useEffect(() => {
    const fallbackVoices = [
      { name: 'Microsoft WilliamMultilingual Online (Natural) - English (Australia)', lang: 'en-AU', shortName: 'en-AU-WilliamMultilingualNeural', voiceURI: 'en-AU-WilliamMultilingualNeural' } as any,
      { name: 'Microsoft Natasha Online (Natural) - English (Australia)', lang: 'en-AU', shortName: 'en-AU-NatashaNeural', voiceURI: 'en-AU-NatashaNeural' } as any,
      { name: 'Microsoft David Desktop - English (United States)', lang: 'en-US', shortName: 'en-US-GuyNeural', voiceURI: 'Microsoft David Desktop - English (United States)' } as any,
      { name: 'Microsoft Zira Desktop - English (United States)', lang: 'en-US', shortName: 'en-US-JennyNeural', voiceURI: 'Microsoft Zira Desktop - English (United States)' } as any
    ];

    const filterTargets = (list: any[]) => list.filter(v => {
      const nameLower = (v.name || '').toLowerCase();
      const shortLower = (v.shortName || v.voiceURI || '').toLowerCase();
      return nameLower.includes('williammultilingual') || shortLower.includes('williammultilingual') ||
             nameLower.includes('natasha') || shortLower.includes('natasha') ||
             nameLower.includes('david') || shortLower.includes('david') ||
             nameLower.includes('zira') || shortLower.includes('zira');
    });

    const loadVoices = async () => {
      try {
        const res = await fetch('http://localhost:3000/api/tts/voices');
        if (!res.ok) throw new Error('API failure');
        const cloudVoices = await res.json();
        if (cloudVoices && cloudVoices.length > 0) {
          const filtered = filterTargets(cloudVoices);
          const result = filtered.length > 0 ? [...filtered] : [...fallbackVoices];
          for (const fb of fallbackVoices) {
            if (!result.some(v => v.name === fb.name)) result.push(fb);
          }
          voicesRef.current = result;
          console.log('[TTS Hook] Loaded cloud voices:', voicesRef.current.length);
          return;
        }
      } catch (err) {
        console.warn('[TTS Hook] Failed to load cloud voices, falling back to browser voices:', err);
      }

      const all = window.speechSynthesis.getVoices();
      const filtered = filterTargets(all);
      const result = filtered.length > 0 ? [...filtered] : [...fallbackVoices];
      for (const fb of fallbackVoices) {
        if (!result.some(v => v.name === fb.name)) result.push(fb);
      }
      voicesRef.current = result;
      console.log('[TTS Hook] Loaded local browser voices:', voicesRef.current.length);
    };
    loadVoices();
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
  }, []);

  const clearResponse = () => {
    stopSpeech();
    setResponseText('');
    setResponseHtml(null);
    setTransitionMessage('');
    setShouldDisplayPanel(false);
    spokenTextIndexRef.current = 0;
    setPipWidth(180);
    setPipHeight(80);
  };

  const stopSpeech = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current = null;
    }
    setIsTtsSpeaking(false);
    if (speechVolumeIntervalRef.current) {
      clearInterval(speechVolumeIntervalRef.current);
      speechVolumeIntervalRef.current = null;
    }
    setVolume(0);
  };

  // Throttled TTS volume — update state at most every 200ms to avoid render storms
  const ttsVolUpdateRef = useRef(0);
  const simulateSpeechVolume = () => {
    if (speechVolumeIntervalRef.current) clearInterval(speechVolumeIntervalRef.current);
    let keepAliveCounter = 0;
    ttsVolUpdateRef.current = 0;
    speechVolumeIntervalRef.current = setInterval(() => {
      if ('speechSynthesis' in window && window.speechSynthesis.speaking) {
        const now = Date.now();
        if (now - ttsVolUpdateRef.current >= 200) { // throttle to 5fps
          ttsVolUpdateRef.current = now;
          const vol = Math.random() * 50 + 20;
          setVolume(vol);
        }
        // Chrome bug: speechSynthesis stops after ~15s — resume() every 10s keeps it alive
        keepAliveCounter++;
        if (keepAliveCounter % 100 === 0) { // every 100 * 100ms = 10s
          window.speechSynthesis.pause();
          window.speechSynthesis.resume();
        }
      } else {
        setVolume(0);
        if (speechVolumeIntervalRef.current) {
          clearInterval(speechVolumeIntervalRef.current);
          speechVolumeIntervalRef.current = null;
        }
      }
    }, 100);
  };

  // Helper: returns cached voices (already loaded on mount via voiceschanged)
  const getVoicesReady = (): SpeechSynthesisVoice[] => {
    // If cache is empty somehow, try one more time synchronously
    if (voicesRef.current.length === 0) {
      const all = window.speechSynthesis.getVoices();
      const filtered = all.filter(v => {
        const nameLower = (v.name || '').toLowerCase();
        return nameLower.includes('williammultilingual') || nameLower.includes('natasha') ||
               nameLower.includes('david') || nameLower.includes('zira');
      });
      voicesRef.current = filtered.length > 0 ? filtered : [
        { name: 'Microsoft WilliamMultilingual Online (Natural) - English (Australia)', lang: 'en-AU', shortName: 'en-AU-WilliamMultilingualNeural', voiceURI: 'en-AU-WilliamMultilingualNeural' } as any,
        { name: 'Microsoft Natasha Online (Natural) - English (Australia)', lang: 'en-AU', shortName: 'en-AU-NatashaNeural', voiceURI: 'en-AU-NatashaNeural' } as any,
        { name: 'Microsoft David Desktop - English (United States)', lang: 'en-US', shortName: 'en-US-GuyNeural', voiceURI: 'Microsoft David Desktop - English (United States)' } as any,
        { name: 'Microsoft Zira Desktop - English (United States)', lang: 'en-US', shortName: 'en-US-JennyNeural', voiceURI: 'Microsoft Zira Desktop - English (United States)' } as any
      ];
    }
    return voicesRef.current;
  };

  const speakUtterance = (text: string) => {
    const cleanSpeech = text
      .replace(/https?:\/\/[^\s]+/g, 'link')
      .replace(/[*_`#]/g, '')
      .trim();

    if (!cleanSpeech) return;

    console.log(`[TTS] Speaking: "${cleanSpeech.substring(0, 60)}..."`);
    // Use exact voice name stored in localStorage (user picked it from the full list)
    const voiceName = localStorage.getItem('qwenos_tts_voice') || '';
    const voices = getVoicesReady();

    console.log('[TTS] Requested voice name:', voiceName, '| Cached voices:', voices.length);

    // Exact match first, then fallback to first English voice
    const selectedVoice = voices.find(v => v.name === voiceName)
                       ?? voices.find(v => v.lang.startsWith('en'))
                       ?? voices[0];

    const savedRate = parseFloat(localStorage.getItem('qwenos_tts_rate') || '1.0');
    const savedPitch = parseFloat(localStorage.getItem('qwenos_tts_pitch') || '1.0');
    const savedVolume = parseFloat(localStorage.getItem('qwenos_tts_volume') || '1.0');

    // Determine if the selected voice is a backend cloud voice
    const isCloudVoice = !!(selectedVoice as any).shortName || 
                         !window.speechSynthesis.getVoices().some(v => v.name === selectedVoice.name);

    if (isCloudVoice) {
      console.log('[TTS] Playing via Backend Edge Cloud TTS Engine:', selectedVoice.name);
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
      }

      const voiceId = (selectedVoice as any).shortName || selectedVoice.voiceURI;
      const audioUrl = `http://localhost:3000/api/tts/speak?text=${encodeURIComponent(cleanSpeech)}&voice=${encodeURIComponent(voiceId)}&rate=${savedRate}&pitch=${savedPitch}&volume=${savedVolume}`;
      
      const audio = new Audio(audioUrl);
      activeAudioRef.current = audio;

      audio.onplay = () => {
        setIsTtsSpeaking(true);
        setAssistantState('processing');
        simulateSpeechVolume();
      };

      audio.onended = () => {
        setIsTtsSpeaking(false);
        setVolume(0);
        setAssistantState('idle');
        activeAudioRef.current = null;
      };

      const playOfflineFallback = () => {
        console.warn('[Cloud TTS] Cloud audio failed/offline. Automatically falling back to offline inbuilt voice.');
        const allLocal = window.speechSynthesis.getVoices();
        const isMale = selectedVoice.name.toLowerCase().includes('william') || selectedVoice.name.toLowerCase().includes('david') || selectedVoice.name.toLowerCase().includes('male');
        const localVoice = allLocal.find(v => {
          const n = v.name.toLowerCase();
          return isMale ? (n.includes('david') || n.includes('mark') || n.includes('male'))
                        : (n.includes('zira') || n.includes('hazel') || n.includes('female'));
        }) ?? allLocal.find(v => v.lang.startsWith('en')) ?? allLocal[0];

        if (!localVoice && !('speechSynthesis' in window)) {
          setIsTtsSpeaking(false);
          setVolume(0);
          setAssistantState('idle');
          activeAudioRef.current = null;
          return;
        }

        const utterance = new SpeechSynthesisUtterance(cleanSpeech);
        if (localVoice) {
          utterance.voice = localVoice;
          utterance.lang = localVoice.lang;
        } else {
          utterance.lang = 'en-US';
        }
        utterance.rate = savedRate;
        utterance.pitch = savedPitch;
        utterance.volume = savedVolume;

        utterance.onstart = () => {
          setIsTtsSpeaking(true);
          setAssistantState('processing');
          simulateSpeechVolume();
        };
        utterance.onend = () => {
          setIsTtsSpeaking(false);
          setVolume(0);
          setAssistantState('idle');
        };
        utterance.onerror = () => {
          setIsTtsSpeaking(false);
          setVolume(0);
          setAssistantState('idle');
        };

        window.speechSynthesis.speak(utterance);
      };

      audio.onerror = (e) => {
        console.warn('[Cloud TTS] Audio element error:', e);
        playOfflineFallback();
      };

      audio.play().catch(err => {
        console.warn('[Cloud TTS] Playback start failed:', err);
        playOfflineFallback();
      });
      return;
    }

    // Fallback: Local Browser Speech Synthesis
    const utterance = new SpeechSynthesisUtterance(cleanSpeech);
    if (selectedVoice) {
      console.log('[TTS] ✅ Using native voice:', selectedVoice.name);
      utterance.voice = selectedVoice;
      utterance.lang  = selectedVoice.lang;
    } else {
      console.warn('[TTS] ⚠️ No local voice available, using default en-US.');
      utterance.lang = 'en-US';
    }
    utterance.rate  = savedRate;
    utterance.pitch = savedPitch;
    utterance.volume = savedVolume;

    utterance.onstart = () => {
      setIsTtsSpeaking(true);
      setAssistantState('processing');
      simulateSpeechVolume();
    };

    utterance.onend = () => {
      if ('speechSynthesis' in window && !window.speechSynthesis.speaking) {
        setIsTtsSpeaking(false);
        setVolume(0);
        setAssistantState('idle');
      }
    };

    utterance.onerror = (e) => {
      console.warn('[TTS] Speech error:', e);
      if ('speechSynthesis' in window && !window.speechSynthesis.speaking) {
        setIsTtsSpeaking(false);
        setVolume(0);
        setAssistantState('idle');
      }
    };

    window.speechSynthesis.resume(); // Unblock Chrome's auto-pause when PiP window is focused
    window.speechSynthesis.speak(utterance);
  };

  const speakStreamedText = (fullText: string, isFinal = false) => {
    if (!('speechSynthesis' in window)) return;

    let speechText = '';
    if (fullText.includes('[SPEECH]') || fullText.includes('[/SPEECH]')) {
      const speechMatch = fullText.match(/\[SPEECH\]([\s\S]*?)(?:\[\/SPEECH\]|$)/i);
      if (speechMatch && speechMatch[1]) {
        speechText = speechMatch[1].trim();
      }
    } else {
      speechText = fullText.replace(/```[\s\S]*?```/g, "").trim();
    }

    if (!speechText) return;

    const textToProcess = speechText.substring(spokenTextIndexRef.current);
    const sentenceBoundaryRegex = /[^.!?\n]+[.!?\n]+/g;
    let match;
    let lastMatchIndex = 0;

    while ((match = sentenceBoundaryRegex.exec(textToProcess)) !== null) {
      const sentence = match[0].trim();
      if (sentence.length > 0) {
        speakUtterance(sentence);
      }
      lastMatchIndex = sentenceBoundaryRegex.lastIndex;
    }

    spokenTextIndexRef.current += lastMatchIndex;

    if (isFinal) {
      const remaining = textToProcess.substring(lastMatchIndex).trim();
      if (remaining.length > 0) {
        speakUtterance(remaining);
      }
    }
  };

  // Attempt auto-connect to Qwen Memory OS MCP server on mount
  useEffect(() => {
    mcpClientService.connect('http://localhost:3000/sse').catch(() => {});
  }, []);

  // Audio analyser effect
  useEffect(() => {
    if (!listening) {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
      setVolume(0);
      return;
    }

    async function initAudio() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;

        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const audioCtx = new AudioContextClass();
        audioContextRef.current = audioCtx;

        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyserRef.current = analyser;

        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        // Throttle setVolume to max 10fps (100ms) to prevent 60fps render storms
        let lastVolUpdate = 0;
        const checkVolume = () => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const average = sum / dataArray.length;
          const volValue = Math.min(100, Math.max(0, (average / 128) * 100));
          const now = performance.now();
          if (now - lastVolUpdate >= 100) { // 10fps throttle
            lastVolUpdate = now;
            setVolume(volValue);
          }
          animationFrameRef.current = requestAnimationFrame(checkVolume);
        };
        checkVolume();
      } catch (err) {
        console.warn('Microphone audio analyser failed, falling back to simulation:', err);
        let time = 0;
        const simulate = () => {
          time += 0.08;
          const base = 10 + Math.sin(time * 1.5) * 5;
          const peak = Math.random() > 0.45 ? Math.random() * 35 : 0;
          setVolume(base + peak);
          animationFrameRef.current = requestAnimationFrame(simulate);
        };
        simulate();
      }
    }

    initAudio();

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, [listening]);

  // Automatically start speech recognition when the PiP is opened, and stop when closed.
  useEffect(() => {
    if (isPipOpen) {
      SpeechRecognition.startListening({ continuous: true, language: 'en-US' });
      setAssistantState('listening');
      setIsSpeaking(true);
      clearResponse();
      setPipWidth(180);
      setPipHeight(80);

      silenceTimerRef.current = setTimeout(() => {
        setIsSpeaking(false);
        setAssistantState('idle');
        setPipWidth(180);
        setPipHeight(80);
      }, 4000);
    } else {
      SpeechRecognition.stopListening();
      resetTranscript();
      setIsSpeaking(false);
      setAssistantState('idle');
      clearResponse();
      setPipWidth(180);
      setPipHeight(80);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    }

    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };
  }, [isPipOpen]);

  // Keep SpeechRecognition listening active as long as the PiP window is open (unless thinking/processing or TTS speaking)
  useEffect(() => {
    const isSupported = SpeechRecognition.browserSupportsSpeechRecognition ? SpeechRecognition.browserSupportsSpeechRecognition() : false;
    if (!isSupported) return;

    if (isPipOpen && !listening && !isProcessing && !isTtsSpeaking) {
      const now = Date.now();
      // Rate-limit restart attempts to at most once every 10 seconds to avoid stack overflow
      if (now - lastStartRef.current > 10000) {
        lastStartRef.current = now;
        console.log('[Voice Client] Auto-restarting SpeechRecognition...');
        SpeechRecognition.startListening({ continuous: true, language: 'en-US' });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listening, isPipOpen, isProcessing, isTtsSpeaking]);

  // Store askLLM in a stable ref to avoid re-creating the effect closure on every render
  const askLLMRef = useRef<(query: string) => Promise<void>>(async () => {});

  // Handle LLM voice submission when silence is detected
  // We define it as a regular function and update the ref each render
  const isPipOpenRef = useRef(isPipOpen);
  isPipOpenRef.current = isPipOpen;

  const askLLM = async (query: string) => {
    if (isRequestingRef.current) return;
    isRequestingRef.current = true;

    // Switch state to thinking/processing
    setAssistantState('processing');
    setIsSpeaking(true);
    setIsProcessing(true);
    setResponseText('');
    setResponseHtml(null);
    setTransitionMessage('');
    setShouldDisplayPanel(false);
    spokenTextIndexRef.current = 0;
    stopSpeech();

    setPipWidth(180);
    setPipHeight(80);

    // Temporarily stop microphone from capturing feedback
    SpeechRecognition.stopListening();

    try {
      console.log(`[Voice API Stream Ask] Sending prompt: "${query}"`);
      const res = await fetch('http://localhost:3000/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getDeviceHeaders() },
        body: JSON.stringify({ prompt: query }),
      });

      if (!res.ok) {
        throw new Error(`Server returned error status: ${res.status}`);
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder("utf-8");
      let accumulated = '';
      let needsUI = false;
      let headerParsed = false;

      // Done thinking, now streaming
      setIsProcessing(false);
      setPipWidth(180);
      setPipHeight(80);

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          accumulated += chunk;

          // Parse the NEEDSUI header from the very first line
          if (!headerParsed && accumulated.includes('\n')) {
            const firstNewline = accumulated.indexOf('\n');
            const firstLine = accumulated.substring(0, firstNewline).trim();
            if (firstLine.startsWith('NEEDSUI:')) {
              needsUI = firstLine.split(':')[1]?.trim().toLowerCase() === 'true';
              accumulated = accumulated.substring(firstNewline + 1); // strip header line
              headerParsed = true;
              console.log(`[Stream] NEEDSUI=${needsUI}`);
            }
          }

          // Strip [SPEECH] tag from display content
          let displayContent = accumulated;
          if (accumulated.includes('[/SPEECH]')) {
            displayContent = accumulated.split('[/SPEECH]')[1].trim();
          } else if (accumulated.includes('[SPEECH]')) {
            displayContent = ''; // still in speech block, show nothing
          }

          // Feed to streaming TTS (reads [SPEECH] tag)
          speakStreamedText(accumulated, false);

          // Show panel only if server says needsUI OR has code blocks
          const hasCodeBlock = displayContent.includes('```');
          if (displayContent && (needsUI || hasCodeBlock)) {
            setResponseText(displayContent);
            setShouldDisplayPanel(true);
            if (needsUI) {
              setPipWidth(650);
              setPipHeight(460);
            } else {
              setPipWidth(480);
              setPipHeight(380);
            }
          } else {
            // Speech-only: no panel, stay small
            setResponseText('');
            setShouldDisplayPanel(false);
            setPipWidth(180);
            setPipHeight(80);
          }
        }
      }

      console.log('[Voice Ask Stream] Complete. needsUI:', needsUI);

      // Finalize speech
      speakStreamedText(accumulated, true);

      // Strip header from final accumulated if not yet done
      let finalAccumulated = accumulated;
      if (!headerParsed) {
        const firstNewline = finalAccumulated.indexOf('\n');
        if (firstNewline !== -1 && finalAccumulated.substring(0, firstNewline).startsWith('NEEDSUI:')) {
          needsUI = finalAccumulated.substring(0, firstNewline).split(':')[1]?.trim().toLowerCase() === 'true';
          finalAccumulated = finalAccumulated.substring(firstNewline + 1);
        }
      }

      // Final display text (strip speech tag)
      let displayContent = finalAccumulated;
      if (finalAccumulated.includes('[/SPEECH]')) {
        displayContent = finalAccumulated.split('[/SPEECH]')[1].trim();
      } else if (finalAccumulated.includes('[SPEECH]')) {
        displayContent = '';
      }

      // Parse HTML block if present
      const htmlMatch = displayContent.match(/```html([\s\S]*?)```/i);
      let cleanText = displayContent;
      let cleanHtml: string | null = null;

      if (htmlMatch && htmlMatch[1]) {
        cleanHtml = htmlMatch[1].trim();
        cleanText = displayContent.replace(/```html[\s\S]*?```/gi, '').trim();
        if (!cleanText) cleanText = "I've created a widget for you.";
        setResponseText(cleanText);
        setResponseHtml(cleanHtml);
        setShouldDisplayPanel(true);
        setPipWidth(650);
        setPipHeight(450);
      } else {
        setResponseHtml(null);
        const hasCodeBlock = cleanText.includes('```');
        const isLongText = cleanText.length > 250 || cleanText.split('\n').length > 5;

        if (cleanText && (needsUI || hasCodeBlock || isLongText)) {
          setResponseText(cleanText);
          setShouldDisplayPanel(true);
          setPipWidth(hasCodeBlock ? 480 : 380);
          setPipHeight(380);
        } else {
          // Speech-only: don't show the panel at all
          setResponseText('');
          setShouldDisplayPanel(false);
          setPipWidth(180);
          setPipHeight(80);
        }
      }

      options?.onInteractionComplete?.(query, cleanText, cleanHtml);

    } catch (err) {
      console.error('[Voice Ask] Error streaming response:', err);
      const errorText = 'Failed to receive response from Qwen Memory OS server. Make sure node server.js is running.';
      setResponseText(errorText);
      setResponseHtml(null);
      setAssistantState('idle');
      setPipWidth(480);
      options?.onInteractionComplete?.(query, errorText, null);
    } finally {
      setIsProcessing(false);
      isRequestingRef.current = false;
      if (isPipOpenRef.current) {
        SpeechRecognition.startListening({ continuous: true, language: 'en-US' });
        setAssistantState('listening');
      }
    }
  };

  // Keep askLLMRef always pointing to the latest version
  askLLMRef.current = askLLM;

  // Monitor transcript activity to trigger expansion (speaking state)
  const lastTranscriptRef = useRef('');
  useEffect(() => {
    if (!isPipOpen || isProcessing) return;
    if (!transcript) return;

    if (transcript !== lastTranscriptRef.current) {
      setIsSpeaking(true);
      setAssistantState('listening');
      lastTranscriptRef.current = transcript;

      // Stop speech synthesis immediately on interruption
      stopSpeech();

      // Clear any pending transitional states
      setTransitionMessage('');
      if (transitionTimerRef.current) {
        clearTimeout(transitionTimerRef.current);
        transitionTimerRef.current = null;
      }

      // Close previous response instantly — read via refs to avoid being a dep!
      if (responseTextRef.current || responseHtmlRef.current) {
        setResponseText('');
        setResponseHtml(null);
      }

      // Size for live transcript viewing
      setPipWidth(320);
      setPipHeight(120);

      // Clear previous silence timer and reset
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

      silenceTimerRef.current = setTimeout(() => {
        // User stopped speaking — check final prompt
        const finalPrompt = lastTranscriptRef.current.trim();
        if (finalPrompt.length > 2) {
          // Display transitional thinking message
          setTransitionMessage("Okay, I feel this is the question you have asked. Let me process it...");
          setAssistantState('processing');
          
          setPipWidth(320);
          setPipHeight(120);

          if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);

          // Wait 2 seconds before sending it to the LLM
          transitionTimerRef.current = setTimeout(() => {
            askLLMRef.current(finalPrompt);
            resetTranscript();
            lastTranscriptRef.current = '';
            setTransitionMessage('');
          }, 2000);
        } else {
          setIsSpeaking(false);
          setAssistantState('idle');
          setPipWidth(180);
          setPipHeight(80);
        }
      }, 2000); // 2 seconds of silence triggers gap
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcript, isPipOpen, isProcessing]); // ✅ responseText/responseHtml removed — read via refs

  const toggleListening = () => {
    stopSpeech();
    if (listening) {
      SpeechRecognition.stopListening();
      setAssistantState('idle');
      setIsSpeaking(false);
      setPipWidth(180);
      setPipHeight(80);
    } else {
      resetTranscript();
      clearResponse();
      SpeechRecognition.startListening({ continuous: true, language: 'en-US' });
      setAssistantState('listening');
      setIsSpeaking(true);
      setPipWidth(180);
      setPipHeight(80);
    }
  };

  const openPip = () => {
    setIsPipOpen(true);
  };

  const closePip = () => {
    setIsPipOpen(false);
  };

  return {
    isPipOpen,
    setIsPipOpen,
    assistantState,
    setAssistantState,
    isSpeaking: shouldDisplayPanel || isProcessing || !!transitionMessage || (listening && !!transcript),
    setIsSpeaking,
    transcript,
    listening,
    toggleListening,
    openPip,
    closePip,
    volume,
    
    // Dynamic LLM Response
    responseText,
    setResponseText,
    responseHtml,
    setResponseHtml,
    isProcessing,
    clearResponse,
    speakUtterance,

    // PiP Size States
    pipWidth,
    pipHeight,
    setPipSize,
    transitionMessage,
    shouldDisplayPanel,
  };
}
