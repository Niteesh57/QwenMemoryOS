import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

async function test() {
  const url = 'http://localhost:3000/sse';
  console.log(`Connecting to ${url}...`);
  const startTime = Date.now();
  
  try {
    const transport = new SSEClientTransport(new URL(url));
    const client = new Client(
      { name: 'Qwen-Memory-OS-Test-Client', version: '1.0.0' },
      { capabilities: {} }
    );

    console.log('Calling client.connect()...');
    await client.connect(transport);
    console.log(`Connected and initialized in ${Date.now() - startTime}ms`);

    console.log('Listing tools...');
    const tools = await client.listTools();
    console.log('Tools:', JSON.stringify(tools, null, 2));

    await client.close();
    console.log('Connection closed successfully!');
  } catch (error) {
    console.error('Connection failed:', error);
  }
}

test();
