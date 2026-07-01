import { EdgeTTS } from 'edge-tts-universal';
import fs from 'fs';

async function test() {
  console.log('Testing edge-tts-universal options...');
  try {
    const tts = new EdgeTTS(
      'Hello! This is a test of edge-tts-universal with valid options.', 
      'en-US-EmmaMultilingualNeural',
      {
        rate: '+20%',
        pitch: '+0Hz',
        volume: '+0%'
      }
    );
    const result = await tts.synthesize();
    const arrayBuffer = await result.audio.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log('Success! Buffer size with correct options:', buffer.length);
    fs.writeFileSync('universal_options_test.mp3', buffer);
  } catch (err) {
    console.error('Error with options:', err);
  }
}
test();
