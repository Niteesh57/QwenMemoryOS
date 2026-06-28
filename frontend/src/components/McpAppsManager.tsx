// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { AppRenderer } from '@mcp-ui/client';
import { mcpClientService } from '../services/mcpClient';

const HOST_INFO = { name: 'QwenOS', version: '1.0.0' };
const HOST_CONTEXT = {
  theme: 'dark' as const,
  styles: {
    '--background': '#09090b',
    '--foreground': '#f8fafc',
    '--primary': '#8b5cf6',
    '--border': 'rgba(255,255,255,0.08)',
  }
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface MCPRegistration {
  id: string;
  name: string;
  description: string;
  toolName: string;
  mode: 'html' | 'server';
  html?: string;
  serverUrl?: string;
  authHeader?: string;
}

export const McpAppsManager: React.FC = () => {
  const [registrations] = useState<MCPRegistration[]>([
    {
      id: 'local-qwen-server',
      name: 'QwenOS MCP Backend Server',
      description: 'SSE connection to the local Node.js server executing Qwen-Flash.',
      toolName: 'ask_qwen',
      mode: 'server',
      serverUrl: 'http://localhost:3000/sse',
    }
  ]);

  const [activeId, setActiveId] = useState<string>('local-qwen-server');
  const [connectionStatus, setConnectionStatus] = useState<any>('disconnected');
  const [mcpError, setMcpError] = useState<string | null>(null);

  const active = registrations.find(r => r.id === activeId) ?? registrations[0];
  const sandboxUrl = new URL(`${window.location.origin}/sandbox_proxy.html`);

  useEffect(() => {
    // Subscribe to the global connection state
    const unsubscribe = mcpClientService.subscribe((status, error) => {
      setConnectionStatus(status);
      setMcpError(error);
    });
    return unsubscribe;
  }, []);

  const connectToServer = async (url: string) => {
    try {
      await mcpClientService.connect(url);
    } catch (err: any) {
      console.warn('[MCP Client] Connection verification failed:', err);
    }
  };

  useEffect(() => {
    if (active.mode === 'server' && active.serverUrl) {
      connectToServer(active.serverUrl);
    }
  }, [activeId]);

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden', background: '#09090b', color: '#f8fafc', fontFamily: "'Outfit', sans-serif" }}>
      
      {/* ── Sidebar ── */}
      <div style={{ width: '250px', background: 'rgba(15,15,20,0.6)', borderRight: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
            <svg viewBox="0 0 64 64" width="18" height="18"><rect x="4" y="4" width="56" height="56" rx="10" fill="#0f172a"/><path d="M32 12 L50 22 L50 42 L32 52 L14 42 L14 22 Z" fill="#3b82f6"/><circle cx="32" cy="32" r="5" fill="#ffffff"/></svg>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#f8fafc' }}>QwenOS Integrations</span>
          </div>
          <span style={{ fontSize: '10px', color: '#64748b' }}>Active plugins</span>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
          {registrations.map(reg => {
            const isActive = reg.id === activeId;
            return (
              <div
                key={reg.id}
                onClick={() => setActiveId(reg.id)}
                style={{
                  padding: '10px 12px',
                  borderRadius: '8px',
                  background: isActive ? 'rgba(99,102,241,0.15)' : 'transparent',
                  border: isActive ? '1px solid rgba(99,102,241,0.3)' : '1px solid transparent',
                  cursor: 'pointer',
                  marginBottom: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  transition: 'all 0.15s ease'
                }}
              >
                <span style={{ fontSize: '16px' }}>{reg.mode === 'html' ? '📄' : '🔌'}</span>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: isActive ? '#818cf8' : '#e2e8f0' }}>{reg.name}</div>
                  <div style={{ fontSize: '9px', color: '#64748b', marginTop: '1px' }}>{reg.mode === 'html' ? 'HTML Mode' : 'Live SSE Server'}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Main Panel ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
        
        {active.mode === 'html' ? (
          <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
            <AppRenderer
              toolName={active.toolName}
              html={active.html}
              sandbox={{ url: sandboxUrl }}
              onOpenLink={async ({ url }) => { window.open(url, '_blank', 'noopener'); return {}; }}
              onMessage={async () => ({})}
              onError={() => {}}
              onSizeChanged={() => {}}
              hostInfo={HOST_INFO}
              hostContext={HOST_CONTEXT}
            />
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px', background: '#070709' }}>
            <div style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '20px',
              padding: '40px 30px',
              maxWidth: '460px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
              backdropFilter: 'blur(10px)'
            }}>
              {connectionStatus === 'connected' ? (
                <>
                  <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifycontent: 'center', color: '#10b981', fontSize: '32px', marginBottom: '20px', boxShadow: '0 0 20px rgba(16,185,129,0.2)' }}>
                    🟢
                  </div>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 10px 0', color: '#34d399' }}>MCP Tool: Connected</h3>
                  <p style={{ fontSize: '12.5px', color: '#94a3b8', lineHeight: 1.6, margin: 0 }}>
                    The backend connection to your QwenOS local server is active. Voice transcript queries will be dispatched to the LLM and dynamic components will render in your picture-in-picture companion.
                  </p>
                </>
              ) : connectionStatus === 'connecting' ? (
                <>
                  <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b', fontSize: '32px', marginBottom: '20px', animation: 'pulse 1.5s infinite' }}>
                    🌀
                  </div>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 10px 0', color: '#f59e0b' }}>Connecting...</h3>
                  <p style={{ fontSize: '12.5px', color: '#94a3b8', lineHeight: 1.6, margin: 0 }}>
                    Verifying transport stream at {active.serverUrl}...
                  </p>
                </>
              ) : (
                <>
                  <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', fontSize: '32px', marginBottom: '20px', boxShadow: '0 0 20px rgba(239,68,68,0.2)' }}>
                    ❌
                  </div>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 10px 0', color: '#ef4444' }}>Access Denied / Disconnected</h3>
                  <p style={{ fontSize: '12.5px', color: '#94a3b8', lineHeight: 1.6, marginBottom: '24px' }}>
                    The QwenOS backend is not running on port 3000. Start the server from your terminal:
                  </p>
                  <code style={{ display: 'block', width: '100%', background: '#000', color: '#34d399', padding: '10px', borderRadius: '8px', fontSize: '11px', fontFamily: 'monospace', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '24px' }}>
                    node server.js
                  </code>
                  <button
                    onClick={() => connectToServer(active.serverUrl)}
                    style={{ background: 'linear-gradient(90deg, #6366f1, #8b5cf6)', border: 'none', color: '#fff', padding: '10px 20px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 15px rgba(99,102,241,0.3)' }}
                  >
                    Retry Connection
                  </button>
                </>
              )}
            </div>
          </div>
        )}
        
      </div>
    </div>
  );
};
