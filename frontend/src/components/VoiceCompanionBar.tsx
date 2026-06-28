import React, { useRef, useEffect, useState } from 'react';
import type { VisualizerState } from './VoiceVisualizer';
import { ChatGptVoiceOrb } from './VoiceVisualizer';

interface VoiceCompanionBarProps {
  state: VisualizerState;
  onClose: () => void;
  onTap: () => void;
  transcript: string;
  isSpeaking: boolean;
  listening: boolean;
  volume: number;
  
  // Dynamic LLM Response properties
  responseText?: string;
  responseHtml?: string | null;
  isProcessing?: boolean;
  clearResponse?: () => void;
  onSizeChange?: (w: number, h: number) => void;
  transitionMessage?: string;
  shouldDisplayPanel?: boolean;
}

// Helper to parse text into alternating text and code segments
export const parseResponseText = (text: string) => {
  const parts: { type: 'text' | 'code'; content: string; language?: string }[] = [];
  const regex = /```(\w*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: text.slice(lastIndex, match.index),
      });
    }
    parts.push({
      type: 'code',
      language: match[1] || 'bash',
      content: match[2].trim(),
    });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push({
      type: 'text',
      content: text.slice(lastIndex),
    });
  }
  return parts;
};

// Helper to parse markdown blocks into beautiful styled nodes
export const formatMarkdown = (text: string) => {
  const lines = text.split('\n');
  return lines.map((line, idx) => {
    let cleanLine = line.trim();
    
    // Handle headers
    if (cleanLine.startsWith('### ')) {
      return (
        <h4 key={idx} style={{ color: '#a78bfa', margin: '12px 0 6px 0', fontSize: '13px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}>
          {cleanLine.substring(4)}
        </h4>
      );
    }
    if (cleanLine.startsWith('## ')) {
      return (
        <h3 key={idx} style={{ color: '#818cf8', margin: '14px 0 8px 0', fontSize: '14px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}>
          {cleanLine.substring(3)}
        </h3>
      );
    }
    if (cleanLine.startsWith('# ')) {
      return (
        <h2 key={idx} style={{ color: '#fff', margin: '16px 0 10px 0', fontSize: '15px', fontWeight: 700, fontFamily: 'Outfit, sans-serif' }}>
          {cleanLine.substring(2)}
        </h2>
      );
    }

    // Handle bullet lists
    const isBullet = cleanLine.startsWith('- ') || cleanLine.startsWith('* ');
    if (isBullet) {
      cleanLine = cleanLine.substring(2);
    }

    // Handle bold (**text**) and inline code (`code`)
    const formattedElements: React.ReactNode[] = [];
    const regex = /(\*\*.*?\*\*|`.*?`)/g;
    const parts = cleanLine.split(regex);

    parts.forEach((part, pIdx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        formattedElements.push(
          <strong key={pIdx} style={{ color: '#ffffff', fontWeight: 600 }}>
            {part.slice(2, -2)}
          </strong>
        );
      } else if (part.startsWith('`') && part.endsWith('`')) {
        formattedElements.push(
          <code key={pIdx} style={{
            background: 'rgba(255,255,255,0.08)',
            padding: '2px 5px',
            borderRadius: '4px',
            fontFamily: 'Consolas, Monaco, monospace',
            fontSize: '11px',
            color: '#f43f5e'
          }}>
            {part.slice(1, -1)}
          </code>
        );
      } else {
        formattedElements.push(part);
      }
    });

    if (isBullet) {
      return (
        <li key={idx} style={{ marginLeft: '12px', marginBottom: '4px', listStyleType: 'disc', color: '#cbd5e1', fontSize: '12.5px', lineHeight: 1.5 }}>
          {formattedElements}
        </li>
      );
    }

    return (
      <p key={idx} style={{ marginBottom: '8px', minHeight: '1.2em', color: '#cbd5e1', fontSize: '12.5px', lineHeight: 1.5 }}>
        {formattedElements}
      </p>
    );
  });
};

// Beautiful Terminal style copyable code block component
export const CodeBlock: React.FC<{ content: string; language?: string }> = ({ content, language }) => {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      navigator.clipboard.writeText(content)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        })
        .catch((err) => {
          console.warn('Clipboard writeText failed, running fallback:', err);
          runFallbackCopy();
        });
    } catch (err) {
      runFallbackCopy();
    }
  };

  const runFallbackCopy = () => {
    try {
      const textArea = document.createElement("textarea");
      textArea.value = content;
      textArea.style.position = "fixed";
      textArea.style.top = "0";
      textArea.style.left = "0";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      
      if (successful) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else {
        console.error('Fallback copy command was unsuccessful');
      }
    } catch (err) {
      console.error('Fallback copy helper crashed:', err);
    }
  };

  return (
    <div style={{
      background: '#09090b',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: '8px',
      margin: '8px 0',
      overflow: 'hidden',
      fontFamily: 'Consolas, Monaco, monospace',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'rgba(255, 255, 255, 0.03)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        padding: '6px 12px',
        fontSize: '11px',
        color: '#818cf8',
      }}>
        <span style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{language || 'code'}</span>
        <button
          onClick={handleCopy}
          style={{
            background: copied ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.05)',
            border: copied ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '4px',
            color: copied ? '#34d399' : '#cbd5e1',
            padding: '2px 8px',
            fontSize: '10.5px',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          {copied ? '✓ Copied!' : 'Copy'}
        </button>
      </div>
      <pre style={{
        margin: 0,
        padding: '12px',
        fontSize: '12px',
        overflowX: 'auto',
        color: '#cbd5e1',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
        textAlign: 'left',
        scrollbarWidth: 'thin',
      }}>
        <code>{content}</code>
      </pre>
    </div>
  );
};

export const VoiceCompanionBar: React.FC<VoiceCompanionBarProps> = ({
  state,
  onClose,
  onTap,
  transcript,
  isSpeaking,
  listening,
  volume,
  responseText = '',
  responseHtml = null,
  isProcessing = false,
  clearResponse = () => {},
  onSizeChange,
  transitionMessage = '',
  shouldDisplayPanel = false,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const hasResponse = shouldDisplayPanel || !!responseHtml || isProcessing || !!transitionMessage || (listening && !!transcript);

  const stateColor =
    state === 'listening' ? '#ec4899' : state === 'processing' ? '#6366f1' : '#94a3b8';

  const borderStyle =
    !hasResponse
      ? 'none'
      : state === 'listening'
      ? '1px solid rgba(236, 72, 153, 0.25)'
      : state === 'processing'
      ? '1px solid rgba(99, 102, 241, 0.25)'
      : '1px solid rgba(255, 255, 255, 0.06)';

  const glowStyle =
    !hasResponse
      ? 'none'
      : state === 'listening'
      ? 'inset 0 0 20px rgba(236, 72, 153, 0.15)'
      : state === 'processing'
      ? 'inset 0 0 20px rgba(99, 102, 241, 0.15)'
      : 'inset 0 0 10px rgba(255, 255, 255, 0.01)';

  if (!hasResponse) {
    // Mini mode: static mic when quiet, animated orb when user is actually speaking
    const isUserSpeaking = volume > 8;
    return (
      <div
        onClick={onTap}
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
          cursor: 'pointer',
        }}
      >
        {isUserSpeaking ? (
          <ChatGptVoiceOrb volume={volume} state="listening" size={40} />
        ) : (
          // Static mic icon — small and calm
          <div style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: listening
              ? 'rgba(139, 92, 246, 0.12)'
              : 'rgba(255, 255, 255, 0.04)',
            border: listening
              ? '1px solid rgba(139, 92, 246, 0.4)'
              : '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.3s ease',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <rect x="8" y="2" width="8" height="13" rx="4"
                fill={listening ? '#a78bfa' : '#64748b'} />
              <path d="M5 10a7 7 0 0 0 14 0" stroke={listening ? '#a78bfa' : '#64748b'}
                strokeWidth="2" strokeLinecap="round" />
              <line x1="12" y1="19" x2="12" y2="22" stroke={listening ? '#a78bfa' : '#64748b'}
                strokeWidth="2" strokeLinecap="round" />
              <line x1="9" y1="22" x2="15" y2="22" stroke={listening ? '#a78bfa' : '#64748b'}
                strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        position: 'relative',
        padding: '12px 16px',
        boxSizing: 'border-box',
        border: borderStyle,
        boxShadow: glowStyle,
        transition: 'border 0.4s ease, box-shadow 0.4s ease',
      }}
    >
      {/* 1. THINKING / PROCESSING STATE */}
      {isProcessing || transitionMessage ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', margin: 'auto', textAlign: 'center', width: '100%' }}>
          <ChatGptVoiceOrb volume={volume} state="processing" size={40} />
          <span style={{ 
            fontSize: '12px', 
            color: '#a78bfa', 
            fontWeight: 500, 
            fontStyle: 'italic',
            lineHeight: 1.4,
            padding: '0 12px',
            animation: 'pulse 2s infinite' 
          }}>
            {transitionMessage || "Thinking..."}
          </span>
        </div>
      ) : responseHtml ? (
        /* 2. DYNAMIC WIDGET (HTML RESPONSES) */
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Header toolbar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '6px' }}>
            <span style={{ fontSize: '11.5px', color: '#a78bfa', fontWeight: 600 }}>Interactive Tool Card</span>
          </div>

          {/* Interactive HTML rendered inside a plain sandboxed iframe (no MCP handshake needed) */}
          <div style={{ flex: 1, overflow: 'hidden', background: '#09090b', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <iframe
              srcDoc={responseHtml!}
              sandbox="allow-scripts allow-same-origin"
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                borderRadius: '8px',
                background: 'transparent',
              }}
              title="Qwen AI Response"
            />
          </div>
        </div>
      ) : responseText ? (
        /* 3. CONVERSATIONAL TEXT RESPONSE */
        <div 
          ref={containerRef}
          style={{ 
            width: '100%', 
            display: 'flex', 
            flexDirection: 'column', 
            justifyContent: 'flex-start',
            boxSizing: 'border-box',
            fontFamily: 'Outfit, sans-serif'
          }}
        >
          {/* Header toolbar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '6px' }}>
            <span style={{ fontSize: '11.5px', color: '#a78bfa', fontWeight: 600 }}>Assistant Response</span>
          </div>

          {/* Conversational content container */}
          <div style={{
            background: 'rgba(0, 0, 0, 0.25)',
            border: '1px solid rgba(255,255,255,0.05)',
            borderRadius: '12px',
            padding: '12px 14px',
            fontSize: '12.5px',
            lineHeight: 1.5,
            color: '#cbd5e1',
            maxHeight: '420px',
            overflowY: 'auto',
            scrollbarWidth: 'thin',
            textAlign: 'left'
          }}>
            {parseResponseText(responseText).map((part, index) => {
              if (part.type === 'code') {
                return <CodeBlock key={index} content={part.content} language={part.language} />;
              }
              return (
                <div key={index} style={{ marginBottom: '8px' }}>
                  {formatMarkdown(part.content)}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* 4. ACTIVE SPEECH FEED INPUT (LISTENING STATE) */
        <>
          <div
            style={{
              width: '100%',
              textAlign: 'center',
              fontSize: '13px',
              fontWeight: 500,
              color: '#f1f5f9',
              minHeight: '20px',
              maxHeight: '40px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              fontFamily: 'Outfit, sans-serif',
              marginBottom: '8px',
              textShadow: '0 2px 10px rgba(0,0,0,0.5)',
            }}
          >
            {transcript ? (
              <span style={{ color: '#f1f5f9' }}>"{transcript}"</span>
            ) : (
              <span
                style={{
                  color: stateColor,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  fontSize: '10.5px',
                  fontWeight: 600,
                }}
              >
                {listening ? 'Listening... Speak now' : 'Mic Off - Tap to Speak'}
              </span>
            )}
          </div>

          <div
            onClick={onTap}
            style={{
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              margin: '6px 0 12px 0',
              width: '100%',
              height: '60px',
            }}
          >
            <ChatGptVoiceOrb volume={volume} state={state} size={54} />
          </div>

        </>
      )}
    </div>
  );
};
