import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
type StatusListener = (status: ConnectionStatus, error?: string | null) => void;

class McpClientService {
  private client: Client | null = null;
  private transport: SSEClientTransport | null = null;
  private status: ConnectionStatus = 'disconnected';
  private error: string | null = null;
  private listeners: Set<StatusListener> = new Set();

  getStatus() {
    return this.status;
  }

  getError() {
    return this.error;
  }

  subscribe(listener: StatusListener) {
    this.listeners.add(listener);
    // Initial callback
    listener(this.status, this.error);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private setStatus(status: ConnectionStatus, error: string | null = null) {
    this.status = status;
    this.error = error;
    this.listeners.forEach((listener) => listener(status, error));
  }

  async connect(url: string = 'http://localhost:3000/sse') {
    // If already connected, do nothing
    if (this.status === 'connected') {
      return;
    }

    this.setStatus('connecting');

    try {
      this.transport = new SSEClientTransport(new URL(url));
      this.client = new Client(
        { name: 'Qwen-Memory-OS-Desktop-Client', version: '1.0.0' },
        { capabilities: {} }
      );

      // We can use a 5-second timeout for the connection
      const connectionPromise = this.client.connect(this.transport);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Connection timeout')), 5000)
      );

      await Promise.race([connectionPromise, timeoutPromise]);

      this.setStatus('connected');
      console.log('[MCP Service] Connected and initialized successfully.');
    } catch (err: any) {
      console.error('[MCP Service] Connection failed:', err);
      await this.disconnect();
      this.setStatus('error', err.message || 'Failed to connect to MCP server');
      throw err;
    }
  }

  async disconnect() {
    this.setStatus('disconnected');
    if (this.client) {
      try {
        await this.client.close();
      } catch (e) {
        console.warn('[MCP Service] Error closing client:', e);
      }
      this.client = null;
    }
    this.transport = null;
  }

  async askQwen(prompt: string): Promise<{ text: string; html: string | null }> {
    if (!this.client || this.status !== 'connected') {
      throw new Error('MCP Client is not connected');
    }

    console.log(`[MCP Service] Calling ask_qwen with prompt: "${prompt}"`);
    
    // Call the MCP tool
    const result = await this.client.callTool({
      name: 'ask_qwen',
      arguments: { prompt },
    });

    console.log('[MCP Service] callTool result:', result);

    // Extract text response
    let text = '';
    if (result.content && Array.isArray(result.content)) {
      const textObj = result.content.find((c: any) => c.type === 'text');
      if (textObj) {
        text = textObj.text;
      }
    }

    // Extract UI resourceUri from metadata
    let html: string | null = null;
    const resourceUri = (result as any)._meta?.ui?.resourceUri;
    
    if (resourceUri) {
      console.log(`[MCP Service] Fetching UI resource from: ${resourceUri}`);
      const resourceResult = await this.client.readResource({
        uri: resourceUri,
      });
      if (resourceResult.contents && resourceResult.contents[0]) {
        html = resourceResult.contents[0].text;
      }
    }

    return { text, html };
  }
}

export const mcpClientService = new McpClientService();
