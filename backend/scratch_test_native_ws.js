async function main() {
  if (typeof WebSocket === 'undefined') {
    console.log('Native WebSocket is NOT available in this Node version.');
    return;
  }
  console.log('Native WebSocket is available! Testing connection...');
  const url = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4`;
  const ws = new WebSocket(url);
  ws.onopen = () => {
    console.log('Connected successfully using native WebSocket!');
    ws.close();
  };
  ws.onerror = (err) => {
    console.error('Connection error:', err);
  };
}
main();
