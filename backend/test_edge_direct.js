import { synthesizeEdgeTTS } from './services/edgeTtsService.js';
import fs from 'fs';

async function test() {
  console.log('Starting Edge TTS direct test...');
  try {
    const buffer = await synthesizeEdgeTTS({
      text: 'Hello from Qwen OS backend direct test!',
      voice: 'en-US-EmmaMultilingualNeural',
      rate: 1.0,
      pitch: 1.0,
      volume: 1.0
    });
    console.log('Success! Synthesized buffer length:', buffer.length);
    fs.writeFileSync('direct_test.mp3', buffer);
  } catch (err) {
    console.error('Direct Edge TTS error:', err);
  }
}
test();
