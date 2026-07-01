async function main() {
  const url = 'https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/voices/list?trustedclienttoken=6A5AA1D4EAFF4E9FB37E23D68491D6F4';
  try {
    const res = await fetch(url);
    const data = await res.json();
    console.log('Voices count:', data.length);
    console.log('Sample voice:', data[0]);
  } catch (err) {
    console.error('Error fetching voices:', err.message);
  }
}
main();
