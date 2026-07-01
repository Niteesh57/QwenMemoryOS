import { EdgeTTS } from 'edge-tts-universal';

const TRUSTED_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const VOICES_URL = `https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/voices/list?trustedclienttoken=${TRUSTED_TOKEN}`;

let voicesCache = null;
let lastCacheTime = 0;

/**
 * Fetch all available Edge TTS voices (cached for 1 hour)
 */
export async function getEdgeVoices() {
  const now = Date.now();
  if (voicesCache && now - lastCacheTime < 3600000) {
    return voicesCache;
  }

  try {
    console.log('[Edge TTS] Fetching voices list from Microsoft Bing...');
    const res = await fetch(VOICES_URL);
    if (!res.ok) throw new Error(`HTTP status ${res.status}`);
    const data = await res.json();
    
    // Map Microsoft voice properties to match SpeechSynthesisVoice format for the frontend!
    voicesCache = data.map(v => ({
      name: v.FriendlyName || v.Name,
      shortName: v.ShortName,
      lang: v.Locale,
      gender: v.Gender,
      localService: false,
      voiceURI: v.ShortName
    }));
    lastCacheTime = now;
    console.log(`[Edge TTS] Loaded ${voicesCache.length} voices successfully.`);
    return voicesCache;
  } catch (err) {
    console.error('[Edge TTS] Failed to fetch voices list:', err.message);
    return voicesCache || []; // Fallback to cache if request fails
  }
}

/**
 * Synthesize text context into MP3 buffer using Microsoft Edge Speech Synthesis (edge-tts-universal)
 */
export async function synthesizeEdgeTTS({ text, voice, rate = 1.0, pitch = 1.0, volume = 1.0 }) {
  const ratePct = Math.round((rate - 1.0) * 100);
  const rateStr = ratePct >= 0 ? `+${ratePct}%` : `${ratePct}%`;

  const pitchHz = Math.round((pitch - 1.0) * 50);
  const pitchStr = pitchHz >= 0 ? `+${pitchHz}Hz` : `${pitchHz}Hz`;

  const volPct = Math.round((volume - 1.0) * 100);
  const volStr = volPct >= 0 ? `+${volPct}%` : `${volPct}%`;

  console.log(`[Edge TTS] Synthesizing via edge-tts-universal: "${text.substring(0, 40)}..." using voice ${voice} (rate: ${rateStr}, pitch: ${pitchStr}, volume: ${volStr})`);

  const tts = new EdgeTTS(text, voice, {
    rate: rateStr,
    pitch: pitchStr,
    volume: volStr
  });

  const result = await tts.synthesize();
  const arrayBuffer = await result.audio.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

