import { EdgeTTS } from 'edge-tts-universal';

const TRUSTED_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const VOICES_URL = `https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/voices/list?trustedclienttoken=${TRUSTED_TOKEN}`;

const TARGET_VOICES = [
  {
    name: 'Microsoft WilliamMultilingual Online (Natural) - English (Australia)',
    shortName: 'en-AU-WilliamMultilingualNeural',
    lang: 'en-AU',
    gender: 'Male',
    localService: false,
    voiceURI: 'en-AU-WilliamMultilingualNeural'
  },
  {
    name: 'Microsoft Natasha Online (Natural) - English (Australia)',
    shortName: 'en-AU-NatashaNeural',
    lang: 'en-AU',
    gender: 'Female',
    localService: false,
    voiceURI: 'en-AU-NatashaNeural'
  },
  {
    name: 'Microsoft David Desktop - English (United States)',
    shortName: 'en-US-GuyNeural',
    lang: 'en-US',
    gender: 'Male',
    localService: true,
    voiceURI: 'Microsoft David Desktop - English (United States)'
  },
  {
    name: 'Microsoft Zira Desktop - English (United States)',
    shortName: 'en-US-JennyNeural',
    lang: 'en-US',
    gender: 'Female',
    localService: true,
    voiceURI: 'Microsoft Zira Desktop - English (United States)'
  }
];

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
    const mapped = data.map(v => ({
      name: v.FriendlyName || v.Name,
      shortName: v.ShortName,
      lang: v.Locale,
      gender: v.Gender,
      localService: false,
      voiceURI: v.ShortName
    })).filter(v => {
      const nameLower = (v.name || '').toLowerCase();
      const shortLower = (v.shortName || '').toLowerCase();
      return nameLower.includes('williammultilingual') || shortLower.includes('williammultilingual') ||
             nameLower.includes('natasha') || shortLower.includes('natasha') ||
             nameLower.includes('david') || shortLower.includes('david') ||
             nameLower.includes('zira') || shortLower.includes('zira');
    });

    const result = mapped.length > 0 ? [...mapped] : [...TARGET_VOICES];
    for (const fb of TARGET_VOICES) {
      if (!result.some(v => v.name === fb.name)) {
        result.push(fb);
      }
    }
    voicesCache = result;
    lastCacheTime = now;
    console.log(`[Edge TTS] Loaded ${voicesCache.length} voices successfully.`);
    return voicesCache;
  } catch (err) {
    console.error('[Edge TTS] Failed to fetch voices list:', err.message);
    return voicesCache || TARGET_VOICES; // Fallback to targeted voices if request fails
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

