import React, { useRef, useEffect, useState } from 'react';
import type { VisualizerState } from './VoiceVisualizer';
import { ChatGptVoiceOrb } from './VoiceVisualizer';
import { marked } from 'marked';

interface VoiceCompanionBarProps {
  state: VisualizerState;
  onClose: () => void;
  onTap: () => void;
  transcript: string;
  isSpeaking: boolean;
  listening: boolean;
  volume: number;
  responseText?: string;
  responseHtml?: string | null;
  isProcessing?: boolean;
  clearResponse?: () => void;
  onSizeChange?: (w: number, h: number) => void;
  transitionMessage?: string;
  shouldDisplayPanel?: boolean;
  speakUtterance?: (text: string) => void;
  pipDocument?: Document | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const parseResponseText = (text: string) => {
  const parts: { type: 'text' | 'code'; content: string; language?: string }[] = [];
  const regex = /```(\w*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }
    parts.push({ type: 'code', language: match[1] || 'bash', content: match[2].trim() });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push({ type: 'text', content: text.slice(lastIndex) });
  }
  return parts;
};

// MarkdownBlock component for Vite Fast Refresh compatibility
export const MarkdownBlock: React.FC<{ text: string }> = ({ text }) => {
  const html = marked.parse(text) as string;
  return <div className="markdown-body" dangerouslySetInnerHTML={{ __html: html }} />;
};

const formatMarkdown = (text: string) => <MarkdownBlock text={text} />;

export const CodeBlock: React.FC<{ content: string; language?: string }> = ({ content, language }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(content)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })
      .catch(() => {
        const el = document.createElement('textarea');
        el.value = content;
        el.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
        document.body.appendChild(el);
        el.focus(); el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        setCopied(true); setTimeout(() => setCopied(false), 2000);
      });
  };
  return (
    <div style={{ background: '#09090b', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', margin: '8px 0', overflow: 'hidden', fontFamily: 'Consolas, Monaco, monospace' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '6px 12px', fontSize: '11px', color: '#818cf8' }}>
        <span style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{language || 'code'}</span>
        <button onClick={handleCopy} style={{ background: copied ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.05)', border: copied ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: copied ? '#34d399' : '#cbd5e1', padding: '2px 8px', fontSize: '10.5px', cursor: 'pointer', transition: 'all 0.2s' }}>
          {copied ? '✓ Copied!' : 'Copy'}
        </button>
      </div>
      <pre style={{ margin: 0, padding: '12px', fontSize: '12px', overflowX: 'auto', color: '#cbd5e1', whiteSpace: 'pre-wrap', wordBreak: 'break-all', textAlign: 'left', scrollbarWidth: 'thin' }}>
        <code>{content}</code>
      </pre>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const VoiceCompanionBar: React.FC<VoiceCompanionBarProps> = ({
  state,
  onClose: _onClose,
  onTap,
  transcript,
  isSpeaking: _isSpeaking,
  listening,
  volume,
  responseText = '',
  responseHtml = null,
  isProcessing = false,
  clearResponse: _clearResponse,
  onSizeChange: _onSizeChange,
  transitionMessage = '',
  shouldDisplayPanel = false,
  speakUtterance,
  pipDocument: _pipDocument,
}) => {
  // References
  const rootRef = useRef<HTMLDivElement>(null);

  // Explanation states
  const [explanationText, setExplanationText] = useState<string | null>(null);
  const [explanationMode, setExplanationMode] = useState<'explain' | 'deep' | null>(null);
  const [isExplaining, setIsExplaining] = useState(false);

  const hasResponse = shouldDisplayPanel || !!responseHtml || isProcessing || !!transitionMessage || (listening && !!transcript);

  // Clear explanation whenever responseText changes (new response from main agent)
  useEffect(() => {
    setExplanationText(null);
    setExplanationMode(null);
    setIsExplaining(false);
  }, [responseText]);

  // ── Action: Clarify / Explain content ──
  const handleExplainClick = async (mode: 'explain' | 'deep') => {
    if (!responseText) return;
    
    // Stop any active TTS before playing new explanation
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    setIsExplaining(true);
    setExplanationMode(mode);
    setExplanationText(null);

    try {
      console.log(`[Clarify Request] Mode: ${mode}`);
      const res = await fetch('http://localhost:3000/api/clarify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, textContext: responseText }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      
      console.log('[Clarify Response] Received:', data.answer);
      setExplanationText(data.answer);
      
      if (data.answer && speakUtterance) {
        if ('speechSynthesis' in window) window.speechSynthesis.resume();
        speakUtterance(data.answer);
      }
    } catch (err) {
      console.error('[Clarify] Error:', err);
      setExplanationText("Sorry, I was unable to fetch the explanation at this moment.");
    } finally {
      setIsExplaining(false);
    }
  };

  const handleBackClick = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setExplanationText(null);
    setExplanationMode(null);
  };

  // ── Derived styles ──
  const stateColor = state === 'listening' ? '#ec4899' : state === 'processing' ? '#6366f1' : '#94a3b8';
  const borderStyle = !hasResponse ? 'none' : state === 'listening' ? '1px solid rgba(236,72,153,0.25)' : state === 'processing' ? '1px solid rgba(99,102,241,0.25)' : '1px solid rgba(255,255,255,0.06)';
  const glowStyle = !hasResponse ? 'none' : state === 'listening' ? 'inset 0 0 20px rgba(236,72,153,0.15)' : state === 'processing' ? 'inset 0 0 20px rgba(99,102,241,0.15)' : 'inset 0 0 10px rgba(255,255,255,0.01)';

  // ── Mini Mode ──
  if (!hasResponse) {
    const isUserSpeaking = volume > 8;
    return (
      <div onClick={onTap} style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', cursor: 'pointer' }}>
        {isUserSpeaking ? (
          <ChatGptVoiceOrb volume={volume} state="listening" size={40} />
        ) : (
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: listening ? 'rgba(139,92,246,0.12)' : 'rgba(255,255,255,0.04)', border: listening ? '1px solid rgba(139,92,246,0.4)' : '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s ease' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <rect x="8" y="2" width="8" height="13" rx="4" fill={listening ? '#a78bfa' : '#64748b'} />
              <path d="M5 10a7 7 0 0 0 14 0" stroke={listening ? '#a78bfa' : '#64748b'} strokeWidth="2" strokeLinecap="round" />
              <line x1="12" y1="19" x2="12" y2="22" stroke={listening ? '#a78bfa' : '#64748b'} strokeWidth="2" strokeLinecap="round" />
              <line x1="9" y1="22" x2="15" y2="22" stroke={listening ? '#a78bfa' : '#64748b'} strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'transparent', position: 'relative', padding: '12px 16px', boxSizing: 'border-box', border: borderStyle, boxShadow: glowStyle, transition: 'border 0.4s ease, box-shadow 0.4s ease' }}
    >
      {/* ── STATE 1: Processing / Transitional Thinking ── */}
      {isProcessing || transitionMessage ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', margin: 'auto', textAlign: 'center', width: '100%' }}>
          <ChatGptVoiceOrb volume={volume} state="processing" size={40} />
          <span style={{ fontSize: '12px', color: '#a78bfa', fontWeight: 500, fontStyle: 'italic', lineHeight: 1.4, padding: '0 12px', animation: 'pulse 2s infinite' }}>
            {transitionMessage || 'Thinking...'}
          </span>
        </div>
      ) : responseHtml ? (
        /* ── STATE 2: HTML Widget ── */
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '6px' }}>
            <span style={{ fontSize: '11.5px', color: '#a78bfa', fontWeight: 600 }}>Interactive Tool Card</span>
          </div>
          <div style={{ flex: 1, overflow: 'hidden', background: '#09090b', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <iframe srcDoc={responseHtml!} sandbox="allow-scripts allow-same-origin" style={{ width: '100%', height: '100%', border: 'none', borderRadius: '8px', background: 'transparent' }} title="Qwen AI Response" />
          </div>
        </div>
      ) : responseText || explanationText || isExplaining ? (
        /* ── STATE 3: Conversational Text Content (Main Response or Clarification) ── */
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', boxSizing: 'border-box', fontFamily: 'Outfit, sans-serif' }}>
          
          {/* Header Toolbar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '6px' }}>
            {explanationText || isExplaining ? (
              <>
                <span style={{ fontSize: '11.5px', color: '#818cf8', fontWeight: 600 }}>
                  ✦ {explanationMode === 'deep' ? 'Deep Explanation' : 'Explanation'}
                </span>
                <button
                  onClick={handleBackClick}
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#e2e8f0',
                    fontSize: '10.5px',
                    fontWeight: 600,
                    padding: '3px 9px',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontFamily: 'Outfit, sans-serif',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)')}
                >
                  ← Back
                </button>
              </>
            ) : (
              <>
                <span style={{ fontSize: '11.5px', color: '#a78bfa', fontWeight: 600 }}>Assistant Response</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    onClick={() => handleExplainClick('explain')}
                    style={{
                      background: 'rgba(167, 139, 250, 0.08)',
                      border: '1px solid rgba(167, 139, 250, 0.25)',
                      color: '#c084fc',
                      fontSize: '10px',
                      fontWeight: 600,
                      padding: '3px 8px',
                      borderRadius: '5px',
                      cursor: 'pointer',
                      fontFamily: 'Outfit, sans-serif',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(167, 139, 250, 0.15)';
                      e.currentTarget.style.borderColor = 'rgba(167, 139, 250, 0.4)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(167, 139, 250, 0.08)';
                      e.currentTarget.style.borderColor = 'rgba(167, 139, 250, 0.25)';
                    }}
                  >
                    💡 Explain
                  </button>
                  <button
                    onClick={() => handleExplainClick('deep')}
                    style={{
                      background: 'rgba(99, 102, 241, 0.08)',
                      border: '1px solid rgba(99, 102, 241, 0.25)',
                      color: '#818cf8',
                      fontSize: '10px',
                      fontWeight: 600,
                      padding: '3px 8px',
                      borderRadius: '5px',
                      cursor: 'pointer',
                      fontFamily: 'Outfit, sans-serif',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(99, 102, 241, 0.15)';
                      e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.4)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(99, 102, 241, 0.08)';
                      e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.25)';
                    }}
                  >
                    🧠 Deep Explain
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Body Content */}
          {isExplaining ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '180px', gap: '12px' }}>
              <ChatGptVoiceOrb volume={10} state="processing" size={36} />
              <span style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic', animation: 'pulse 1.5s infinite' }}>
                Generating explanation...
              </span>
            </div>
          ) : (
            <div
              style={{
                background: 'rgba(0,0,0,0.25)',
                border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: '12px',
                padding: '12px 14px',
                fontSize: '12.5px',
                lineHeight: 1.6,
                color: '#cbd5e1',
                maxHeight: '380px',
                overflowY: 'auto',
                scrollbarWidth: 'thin',
                textAlign: 'left',
                userSelect: 'text',
                WebkitUserSelect: 'text',
              }}
            >
              {parseResponseText(explanationText ?? responseText).map((part, index) => {
                if (part.type === 'code') {
                  if (part.language === 'markdown' || part.language === 'md') {
                    return <div key={index} style={{ marginBottom: '8px' }}>{formatMarkdown(part.content)}</div>;
                  }
                  return <CodeBlock key={index} content={part.content} language={part.language} />;
                }
                return <div key={index} style={{ marginBottom: '8px' }}>{formatMarkdown(part.content)}</div>;
              })}
            </div>
          )}
        </div>
      ) : (
        /* ── STATE 4: Listening / Idle Speech Input Feed ── */
        <>
          <div style={{ width: '100%', textAlign: 'center', fontSize: '13px', fontWeight: 500, color: '#f1f5f9', minHeight: '20px', maxHeight: '40px', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', fontFamily: 'Outfit, sans-serif', marginBottom: '8px', textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>
            {transcript ? (
              <span style={{ color: '#f1f5f9' }}>"{transcript}"</span>
            ) : (
              <span style={{ color: stateColor, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '10.5px', fontWeight: 600 }}>
                {listening ? 'Listening... Speak now' : 'Mic Off - Tap to Speak'}
              </span>
            )}
          </div>
          <div onClick={onTap} style={{ cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '6px 0 12px 0', width: '100%', height: '60px' }}>
            <ChatGptVoiceOrb volume={volume} state={state} size={54} />
          </div>
        </>
      )}
    </div>
  );
};
