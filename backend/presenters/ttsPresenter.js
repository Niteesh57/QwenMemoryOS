import { getEdgeVoices, synthesizeEdgeTTS } from "../services/edgeTtsService.js";

/**
 * Handle listing of Edge TTS voices
 */
export const handleGetVoices = async (req, res) => {
  try {
    const voices = await getEdgeVoices();
    res.json(voices);
  } catch (err) {
    console.error('[API TTS Voices] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Handle streaming of Edge TTS MP3 audio
 */
export const handleSpeakStream = async (req, res) => {
  const { text, voice, rate = 1.0, pitch = 1.0, volume = 1.0 } = req.query;

  if (!text || !voice) {
    return res.status(400).json({ error: 'text and voice query parameters are required' });
  }

  try {
    const buffer = await synthesizeEdgeTTS({
      text,
      voice,
      rate: parseFloat(rate),
      pitch: parseFloat(pitch),
      volume: parseFloat(volume)
    });

    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': buffer.length,
      'Cache-Control': 'no-cache'
    });

    res.send(buffer);
  } catch (err) {
    console.error('[API TTS Speak] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
};
