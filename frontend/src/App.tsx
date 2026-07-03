import React, { useState, useEffect, useRef } from 'react';
import { PipPortal, isPipSupported } from './components/PipPortal';
import { VoiceCompanionBar, CodeBlock, parseResponseText, MarkdownBlock } from './components/VoiceCompanionBar';
import { VoiceVisualizer } from './components/VoiceVisualizer';
import { useCompanionController } from './hooks/useCompanionController';
import { motion, useMotionValue, useSpring, useTransform, AnimatePresence } from 'motion/react';
import { MeshGradientBackground } from './components/MeshGradientBackground';
import { McpAppsManager } from './components/McpAppsManager';
import { MemoryBookManager } from './components/MemoryBookManager';
import { DevicePairingSettings } from './components/DevicePairingSettings';
import { Battery, Wifi, Mic, MicOff, Tv, Bot, User, Monitor } from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────
const MAG_RANGE = 130;

// ─── Brand SVG Icons ──────────────────────────────────────────────────────────

const MCPIcon = () => (
  <svg viewBox="0 0 64 64" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="4" width="56" height="56" rx="14" fill="#0f172a" />
    <path d="M32 12 L50 22 L50 42 L32 52 L14 42 L14 22 Z" fill="#3b82f6" />
    <path d="M32 12 L50 22 L32 32 L14 22 Z" fill="#60a5fa" />
    <path d="M14 22 L32 32 L32 52 L14 42 Z" fill="#2563eb" />
    <path d="M50 22 L32 32 L32 52 L50 42 Z" fill="#1d4ed8" />
    <circle cx="32" cy="32" r="6" fill="#ffffff" />
    <circle cx="32" cy="12" r="4" fill="#ffffff" />
    <circle cx="50" cy="22" r="4" fill="#ffffff" />
    <circle cx="50" cy="42" r="4" fill="#ffffff" />
    <circle cx="32" cy="52" r="4" fill="#ffffff" />
    <circle cx="14" cy="42" r="4" fill="#ffffff" />
    <circle cx="14" cy="22" r="4" fill="#ffffff" />
    <line x1="32" y1="32" x2="32" y2="12" stroke="#ffffff" strokeWidth="2" />
    <line x1="32" y1="32" x2="50" y2="22" stroke="#ffffff" strokeWidth="2" />
    <line x1="32" y1="32" x2="50" y2="42" stroke="#ffffff" strokeWidth="2" />
    <line x1="32" y1="32" x2="32" y2="52" stroke="#ffffff" strokeWidth="2" />
    <line x1="32" y1="32" x2="14" y2="42" stroke="#ffffff" strokeWidth="2" />
    <line x1="32" y1="32" x2="14" y2="22" stroke="#ffffff" strokeWidth="2" />
  </svg>
);

const HistoryIcon = () => (
  <svg viewBox="0 0 64 64" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="4" width="56" height="56" rx="14" fill="#171526" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
    <circle cx="32" cy="32" r="18" fill="none" stroke="url(#history-grad)" strokeWidth="3.5" strokeLinecap="round" strokeDasharray="80 25" />
    <path d="M32 16 L32 32 L42 32" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" fill="none" />
    <polygon points="32,6 38,14 26,14" fill="#a78bfa" transform="rotate(45 32 32)" />
    <defs>
      <linearGradient id="history-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#c084fc" />
        <stop offset="100%" stopColor="#6366f1" />
      </linearGradient>
    </defs>
  </svg>
);

const AIChatIcon = () => (
  <svg viewBox="0 0 64 64" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="4" width="56" height="56" rx="15" fill="url(#ai-grad)" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
    <circle cx="22" cy="28" r="4.5" fill="#ffffff" />
    <circle cx="42" cy="28" r="4.5" fill="#ffffff" />
    <path d="M18 39 Q32 45 46 39" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" fill="none" />
    <path d="M16 16 L22 10 L28 16" stroke="rgba(255,255,255,0.6)" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    <path d="M48 16 L42 10 L36 16" stroke="rgba(255,255,255,0.6)" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    <defs>
      <linearGradient id="ai-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#8b5cf6" />
        <stop offset="100%" stopColor="#ec4899" />
      </linearGradient>
    </defs>
  </svg>
);

const MemoryBookIcon = () => (
  <svg viewBox="0 0 64 64" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="mem-bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#4f46e5" />
        <stop offset="100%" stopColor="#7c3aed" />
      </linearGradient>
      <linearGradient id="mem-glow" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#c084fc" />
        <stop offset="100%" stopColor="#818cf8" />
      </linearGradient>
    </defs>
    <rect x="4" y="4" width="56" height="56" rx="14" fill="url(#mem-bg)" />
    {/* Book pages */}
    <rect x="16" y="14" width="32" height="36" rx="4" fill="rgba(255,255,255,0.12)" />
    <rect x="18" y="16" width="28" height="32" rx="3" fill="rgba(255,255,255,0.08)" />
    {/* Lines representing events */}
    <line x1="22" y1="24" x2="42" y2="24" stroke="url(#mem-glow)" strokeWidth="2" strokeLinecap="round" />
    <line x1="22" y1="30" x2="38" y2="30" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="22" y1="36" x2="40" y2="36" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round" />
    {/* Hot dot */}
    <circle cx="44" cy="18" r="7" fill="#fb923c" />
    <text x="44" y="22" textAnchor="middle" fontSize="8" fill="white" fontWeight="bold">🔥</text>
    {/* Spine */}
    <rect x="14" y="14" width="4" height="36" rx="2" fill="rgba(192,132,252,0.5)" />
  </svg>
);

const SettingsIcon = () => (
  <svg viewBox="0 0 64 64" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="4" width="56" height="56" rx="14" fill="#4b5563" />
    <circle cx="32" cy="32" r="13" fill="#374151" stroke="#ffffff" strokeWidth="2" />
    <circle cx="32" cy="32" r="6" fill="#4b5563" />
    {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
      <line
        key={i}
        x1="32"
        y1="12"
        x2="32"
        y2="18"
        stroke="#ffffff"
        strokeWidth="3.5"
        strokeLinecap="round"
        transform={`rotate(${angle} 32 32)`}
      />
    ))}
  </svg>
);

// ─── Isolated Clock Component (prevents full App re-render every second) ───────
const Clock: React.FC = () => {
  const [time, setTime] = useState(
    () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  );
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }, 10000); // update every 10s — clock shows HH:MM, minute-resolution is enough
    return () => clearInterval(timer);
  }, []);
  return <span style={{ fontWeight: 600 }}>{time}</span>;
};

// ─── Mac Window Wrapper ───────────────────────────────────────────────────────
interface WindowWrapperProps {
  appId: string;
  label: string;
  isOpen: boolean;
  onClose: () => void;
  zIndex: number;
  defaultPos: { x: number; y: number };
  children: React.ReactNode;
  onFocus: () => void;
}

const MacWindow: React.FC<WindowWrapperProps> = ({
  appId,
  label,
  isOpen,
  onClose,
  zIndex,
  defaultPos,
  children,
  onFocus,
}) => {
  if (!isOpen) return null;

  const width = appId === 'vscode' ? 760 : appId === 'history' ? 780 : appId === 'mcp' ? 820 : appId === 'memory' ? 860 : appId === 'settings' ? 740 : 540;
  const height = appId === 'vscode' ? 490 : appId === 'history' ? 480 : appId === 'mcp' ? 520 : appId === 'aichat' ? 310 : appId === 'memory' ? 580 : appId === 'settings' ? 560 : 430;

  return (
    <motion.div
      drag
      dragMomentum={false}
      dragElastic={0.02}
      onPointerDown={onFocus}
      initial={{ scale: 0.9, opacity: 0, x: defaultPos.x, y: defaultPos.y }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 220 }}
      style={{
        position: 'absolute',
        width: width,
        height: height,
        borderRadius: '13px',
        background: '#18181b',
        zIndex: zIndex,
        boxShadow: '0 30px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.08)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Title Bar / Header */}
      <div
        className="win-header-drag"
        style={{
          height: '42px',
          background: 'linear-gradient(180deg, #27272a, #18181b)',
          borderBottom: '1px solid rgba(0,0,0,0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          cursor: 'grab',
          userSelect: 'none',
          flexShrink: 0
        }}
      >
        {/* Traffic Light Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={onClose}
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: '#ff5f56',
              border: 'none',
              cursor: 'pointer',
              boxShadow: 'inset 0 0 2px rgba(0,0,0,0.3)'
            }}
          />
          <button
            onClick={onClose}
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: '#ffbd2e',
              border: 'none',
              cursor: 'pointer',
              boxShadow: 'inset 0 0 2px rgba(0,0,0,0.3)'
            }}
          />
          <button
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: '#27c93f',
              border: 'none',
              cursor: 'default',
              boxShadow: 'inset 0 0 2px rgba(0,0,0,0.3)'
            }}
          />
        </div>

        {/* Window Title */}
        <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'rgba(255,255,255,0.6)' }}>
          {label}
        </span>

        {/* Space Balance */}
        <div style={{ width: '52px' }} />
      </div>

      {/* Content Area */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: '#09090b' }}>
        {children}
      </div>
    </motion.div>
  );
};

// ─── Magnified Dock Icon ──────────────────────────────────────────────────────
function DockIcon({
  app,
  isActive,
  onClick,
  onHover,
  onLeave,
  mouseX,
}: {
  app: any;
  isActive: boolean;
  onClick: () => void;
  onHover: () => void;
  onLeave: () => void;
  mouseX: any;
}) {
  const ref = useRef<HTMLButtonElement>(null);

  const distance = useTransform(mouseX, (val: number) => {
    const bounds = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 };
    return val - bounds.x - bounds.width / 2;
  });

  const sizeSync = useTransform(
    distance,
    [-MAG_RANGE, 0, MAG_RANGE],
    [50, 70, 50]
  );

  const size = useSpring(sizeSync, {
    mass: 0.1,
    stiffness: 160,
    damping: 13,
  });

  const Icon = app.icon;

  return (
    <motion.button
      ref={ref}
      onClick={onClick}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      style={{
        width: size,
        height: size,
        background: 'transparent',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        flexShrink: 0
      }}
      className="dock-icon"
    >
      <div style={{ width: '85%', height: '85%', display: 'block' }}>
        <Icon />
      </div>
      {isActive && (
        <div
          style={{
            position: 'absolute',
            bottom: '-4px',
            width: '4px',
            height: '4px',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.8)',
            boxShadow: '0 0 3px rgba(255,255,255,0.8)'
          }}
        />
      )}
    </motion.button>
  );
}

// ─── App Component ────────────────────────────────────────────────────────────
interface ChatInteraction {
  id: string;
  prompt: string;
  responseText: string;
  responseHtml: string | null;
  timestamp: string;
}

interface ChatSession {
  id: string;
  title: string;
  timestamp: string;
  interactions: ChatInteraction[];
}

export default function App() {
  // Session History State
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    try {
      const saved = localStorage.getItem('qwenos_sessions');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem('qwenos_active_session_id');
      return saved || null;
    } catch (e) {
      return null;
    }
  });

  useEffect(() => {
    localStorage.setItem('qwenos_sessions', JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    if (activeSessionId) {
      localStorage.setItem('qwenos_active_session_id', activeSessionId);
    } else {
      localStorage.removeItem('qwenos_active_session_id');
    }
  }, [activeSessionId]);

  const currentTabSessionIdRef = useRef<string>(Date.now().toString());

  const addInteractionToHistory = (prompt: string, text: string, html: string | null) => {
    const newInteraction: ChatInteraction = {
      id: Date.now().toString(),
      prompt,
      responseText: text,
      responseHtml: html,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setSessions((prev) => {
      const existingSession = prev.find(s => s.id === currentTabSessionIdRef.current);

      if (!existingSession) {
        // Helper to generate dynamic title
        const words = prompt.split(/\s+/).filter(Boolean);
        let title = 'Speech Session';
        if (words.length > 0) {
          const cleanWords = words.map(w => w.replace(/[^\w\s]/g, ''));
          const truncated = cleanWords.slice(0, 4).join(' ');
          title = truncated.charAt(0).toUpperCase() + truncated.slice(1);
        }

        const newSession: ChatSession = {
          id: currentTabSessionIdRef.current,
          title,
          timestamp: new Date().toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          interactions: [newInteraction],
        };

        setActiveSessionId(newSession.id);
        return [newSession, ...prev];
      } else {
        setActiveSessionId(currentTabSessionIdRef.current);
        return prev.map(s => {
          if (s.id === currentTabSessionIdRef.current) {
            const updatedInteractions = [...s.interactions, newInteraction];
            
            // If it reaches 50 messages, rotate session ID
            if (updatedInteractions.length >= 50) {
              currentTabSessionIdRef.current = Date.now().toString();
            }
            
            return {
              ...s,
              interactions: updatedInteractions
            };
          }
          return s;
        });
      }
    });
  };

  const deleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSessions(prev => prev.filter(s => s.id !== id));
    if (activeSessionId === id) {
      setActiveSessionId(null);
    }
  };

  const controller = useCompanionController({
    onInteractionComplete: (prompt, text, html) => {
      addInteractionToHistory(prompt, text, html);
    }
  });

  // PiP document reference — set when the PiP window is opened
  const [pipDocument, setPipDocument] = useState<Document | null>(null);
  
  // Window states
  const [openWindows, setOpenWindows] = useState<Record<string, boolean>>({
    aichat: false, // not auto-opened — reduces startup render pressure
    history: false,
    vscode: false,
    mcp: false,
    settings: false,
    memory: false,
  });
  
  const [windowZIndex, setWindowZIndex] = useState<Record<string, number>>({
    aichat: 10,
    history: 10,
    vscode: 10,
    mcp: 10,
    settings: 10,
    memory: 10,
  });

  const [_activeWindow, _setActiveWindow] = useState('aichat');
  
  // Custom HTML Sandbox state
  const [_customHtml, _setCustomHtml] = useState(
    `<div style="display:flex; flex-direction:column; gap:8px; padding:4px;">
  <span style="font-weight:600; color:#ec4899; font-size:13px; text-shadow:0 0 8px rgba(236,72,153,0.3)">
    ✨ system_widget.dll
  </span>
  <p style="margin:0; font-size:12px; color:#cbd5e1;">Running dynamic markup injection from desktop core.</p>
  <div style="background:rgba(99,102,241,0.1); border-left:3px solid #6366f1; padding:6px; border-radius:4px; font-size:11px; font-family:monospace; color:#818cf8;">
    &lt;div class="glass"&gt;active&lt;/div&gt;
  </div>
</div>`
  );

  // Small notifications state
  const [toast, setToast] = useState<string | null>(null);
  const [settingsTab, setSettingsTab] = useState<'voice' | 'device'>('voice');

  const [ttsVoice, setTtsVoice] = useState<string>(() => {
    return localStorage.getItem('qwenos_tts_voice') || '';
  });

  const [ttsRate, setTtsRate] = useState<number>(() => {
    return parseFloat(localStorage.getItem('qwenos_tts_rate') || '1.0');
  });
  const [ttsPitch, setTtsPitch] = useState<number>(() => {
    return parseFloat(localStorage.getItem('qwenos_tts_pitch') || '1.0');
  });
  const [ttsVolume, setTtsVolume] = useState<number>(() => {
    return parseFloat(localStorage.getItem('qwenos_tts_volume') || '1.0');
  });

  // Store all available browser voices in state — same pattern as MemeRenderer.tsx
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    const loadVoices = async () => {
      const fallbackVoices = [
        { name: 'Microsoft WilliamMultilingual Online (Natural) - English (Australia)', lang: 'en-AU', shortName: 'en-AU-WilliamMultilingualNeural', voiceURI: 'en-AU-WilliamMultilingualNeural' } as any,
        { name: 'Microsoft Natasha Online (Natural) - English (Australia)', lang: 'en-AU', shortName: 'en-AU-NatashaNeural', voiceURI: 'en-AU-NatashaNeural' } as any,
        { name: 'Microsoft David Desktop - English (United States)', lang: 'en-US', shortName: 'en-US-GuyNeural', voiceURI: 'Microsoft David Desktop - English (United States)' } as any,
        { name: 'Microsoft Zira Desktop - English (United States)', lang: 'en-US', shortName: 'en-US-JennyNeural', voiceURI: 'Microsoft Zira Desktop - English (United States)' } as any
      ];

      const filterTargets = (list: any[]) => list.filter(v => {
        const nameLower = (v.name || '').toLowerCase();
        const shortLower = (v.shortName || v.voiceURI || '').toLowerCase();
        return nameLower.includes('williammultilingual') || shortLower.includes('williammultilingual') ||
               nameLower.includes('natasha') || shortLower.includes('natasha') ||
               nameLower.includes('david') || shortLower.includes('david') ||
               nameLower.includes('zira') || shortLower.includes('zira');
      });

      const applyVoices = (voices: any[]) => {
        const result = voices.length > 0 ? [...voices] : [...fallbackVoices];
        for (const fb of fallbackVoices) {
          if (!result.some(v => v.name === fb.name)) {
            result.push(fb);
          }
        }
        setAvailableVoices(result);
        const currentSaved = localStorage.getItem('qwenos_tts_voice');
        if (!currentSaved || !result.some(v => v.name === currentSaved)) {
          const defaultVoice = result[0];
          if (defaultVoice) {
            localStorage.setItem('qwenos_tts_voice', defaultVoice.name);
            setTtsVoice(defaultVoice.name);
          }
        }
      };

      try {
        console.log('[TTS Init] Fetching cloud voices from backend...');
        const res = await fetch('http://localhost:3000/api/tts/voices');
        if (!res.ok) throw new Error('API failure');
        const cloudVoices = await res.json();
        if (cloudVoices && cloudVoices.length > 0) {
          const filtered = filterTargets(cloudVoices);
          applyVoices(filtered);
          console.log('[TTS Init] Loaded cloud voices:', filtered.length);
          return;
        }
      } catch (err) {
        console.warn('[TTS Init] Failed to load cloud voices, falling back to browser voices:', err);
      }

      const all = window.speechSynthesis.getVoices();
      const filtered = filterTargets(all);
      applyVoices(filtered);
      console.log('[TTS Init] Loaded local/fallback voices:', filtered.length);
    };
    loadVoices();
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);

    const handleVoiceChange = () => {
      setTtsVoice(localStorage.getItem('qwenos_tts_voice') || '');
    };
    window.addEventListener('qwenos_voice_changed', handleVoiceChange);
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
      window.removeEventListener('qwenos_voice_changed', handleVoiceChange);
    };
  }, []);

  // Hover state for Tooltips
  const [hoveredApp, setHoveredApp] = useState<string | null>(null);

  // ─── showToast ───────────────────────────────────────────────────────────────
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast(null);
    }, 2800);
  };

  const bringToFront = (appId: string) => {
    _setActiveWindow(appId);
    setWindowZIndex((prev) => {
      const maxZ = Math.max(...Object.values(prev), 10);
      return { ...prev, [appId]: maxZ + 1 };
    });
  };

  const toggleWindow = (appId: string) => {
    setOpenWindows((prev) => {
      const isOpen = !prev[appId];
      if (isOpen) {
        setTimeout(() => bringToFront(appId), 50);
      }
      return { ...prev, [appId]: isOpen };
    });
  };

  const closeWindow = (appId: string) => {
    setOpenWindows((prev) => ({ ...prev, [appId]: false }));
  };

  // Mouse tracker for Dock magnification
  const mouseX = useMotionValue(Infinity);

  const APPS_LIST = [
    { id: 'mcp', label: 'MCP Tools', icon: MCPIcon, hasWindow: true },
    { id: 'history', label: 'View History', icon: HistoryIcon, hasWindow: true },
    { id: 'memory', label: 'Memory Book', icon: MemoryBookIcon, hasWindow: true },
    { id: 'aichat', label: 'AI Companion', icon: AIChatIcon, hasWindow: true },
    { id: 'settings', label: 'Settings', icon: SettingsIcon, hasWindow: true }
  ];

  const supported = isPipSupported();

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        userSelect: 'none',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
      }}
    >
      {/* ─── Premium 3D Mesh Gradient Canvas Wallpaper ─── */}
      <MeshGradientBackground />

      {/* ─── Top Menu Bar ─── */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '24px',
          background: 'rgba(23, 21, 38, 0.3)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          fontSize: '11.5px',
          fontWeight: 500,
          color: '#ffffff'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span className="wipe-reveal" style={{ fontWeight: 600, cursor: 'pointer' }}>Qwen Memory OS</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', opacity: 0.8 }}>
            <Battery size={13} /> 98%
          </span>
          <span style={{ display: 'flex', alignItems: 'center', opacity: 0.8 }}>
            <Wifi size={13} />
          </span>
          <Clock />
        </div>
      </div>

      {/* ─── Dynamic Windows Layer ─── */}
      <div style={{ position: 'absolute', inset: 0, paddingTop: '24px', zIndex: 10 }}>
        
        {/* WINDOW 0: MCP Tools */}
        <AnimatePresence>
          {openWindows.mcp && (
            <MacWindow
              appId="mcp"
              label="MCP Tools Configurator"
              isOpen={openWindows.mcp}
              onClose={() => closeWindow('mcp')}
              zIndex={windowZIndex.mcp}
              defaultPos={{ x: 40, y: 60 }}
              onFocus={() => bringToFront('mcp')}
            >
              <McpAppsManager />
            </MacWindow>
          )}
        </AnimatePresence>

        {/* WINDOW: Memory Book */}
        <AnimatePresence>
          {openWindows.memory && (
            <MacWindow
              appId="memory"
              label="Memory Book — Event-Native Memory System"
              isOpen={openWindows.memory}
              onClose={() => closeWindow('memory')}
              zIndex={windowZIndex.memory}
              defaultPos={{ x: 80, y: 50 }}
              onFocus={() => bringToFront('memory')}
            >
              <MemoryBookManager />
            </MacWindow>
          )}
        </AnimatePresence>
        {/* WINDOW 1: AI Chat (Voice Companion Control) */}
        <AnimatePresence>
          {openWindows.aichat && (
            <MacWindow
              appId="aichat"
              label="AI Voice Companion"
              isOpen={openWindows.aichat}
              onClose={() => closeWindow('aichat')}
              zIndex={windowZIndex.aichat}
              defaultPos={{ x: 120, y: 80 }}
              onFocus={() => bringToFront('aichat')}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '24px', boxSizing: 'border-box', height: '100%' }}>
                
                {/* Visualizer & Mic Controller */}
                <div style={{ display: 'flex', gap: '20px', alignItems: 'center', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '16px' }}>
                  <div style={{ width: '120px', height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <VoiceVisualizer state={controller.assistantState} volume={controller.volume} />
                  </div>
                  
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <span style={{ fontSize: '11px', color: '#818cf8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Voice Feed Control
                    </span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={controller.toggleListening}
                        style={{
                          flex: 1,
                          background: controller.listening ? 'rgba(239, 68, 68, 0.18)' : 'rgba(16, 185, 129, 0.18)',
                          border: controller.listening ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid rgba(16, 185, 129, 0.35)',
                          color: controller.listening ? '#f87171' : '#34d399',
                          padding: '10px 14px',
                          borderRadius: '10px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        {controller.listening ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'center', width: '100%' }}>
                            <MicOff size={14} /> Mute Mic
                          </span>
                        ) : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'center', width: '100%' }}>
                            <Mic size={14} /> Unmute Mic
                          </span>
                        )}
                      </button>

                      <button
                        onClick={() => {
                          if (!supported) {
                            showToast('PiP unsupported on this browser.');
                            return;
                          }
                          controller.openPip();
                        }}
                        style={{
                          background: 'rgba(99, 102, 241, 0.15)',
                          border: '1px solid rgba(99, 102, 241, 0.3)',
                          color: '#818cf8',
                          padding: '10px 14px',
                          borderRadius: '10px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <Tv size={14} /> {controller.isPipOpen ? 'Overlay Open' : 'Launch PiP'}
                        </span>
                      </button>
                    </div>

                    <button
                      onClick={controller.toggleVisualMode}
                      style={{
                        width: '100%',
                        background: controller.visualMode ? 'rgba(168, 85, 247, 0.22)' : 'rgba(255, 255, 255, 0.04)',
                        border: controller.visualMode ? '1px solid rgba(168, 85, 247, 0.45)' : '1px solid rgba(255, 255, 255, 0.1)',
                        color: controller.visualMode ? '#d8b4fe' : '#94a3b8',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'center', width: '100%' }}>
                        <Monitor size={14} /> {controller.visualMode ? '🎙️+🖥️ Visual Query Active (Dual-Stream)' : '🎙️+🖥️ Enable Mic & Visuals'}
                      </span>
                    </button>

                    {/* Memory Agent Status — shown when visual mode is on */}
                    {controller.visualMode && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: controller.memoryAgentRunning
                          ? 'rgba(239, 68, 68, 0.08)'
                          : 'rgba(255,255,255,0.03)',
                        border: controller.memoryAgentRunning
                          ? '1px solid rgba(239, 68, 68, 0.25)'
                          : '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '9px',
                        padding: '8px 12px',
                        gap: '8px',
                      }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', fontSize: '11px', fontWeight: 600, color: controller.memoryAgentRunning ? '#f87171' : '#64748b' }}>
                          {/* Pulsing recording dot */}
                          <span style={{
                            width: '7px', height: '7px', borderRadius: '50%',
                            background: controller.memoryAgentRunning ? '#ef4444' : '#475569',
                            display: 'inline-block',
                            animation: controller.memoryAgentRunning ? 'pulse-dot 1.2s ease-in-out infinite' : 'none',
                          }} />
                          <style>{`@keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(1.4)} }`}</style>
                          {controller.memoryAgentRunning ? '🧠 Memory Agent Recording' : 'Memory Agent Idle'}
                        </span>
                        {/* Chunk interval selector */}
                        <select
                          value={controller.chunkMinutes}
                          onChange={e => controller.setChunkMinutes(Number(e.target.value))}
                          style={{
                            background: '#1e1d2e',
                            border: '1px solid rgba(255,255,255,0.12)',
                            borderRadius: '6px',
                            color: '#f8fafc',
                            padding: '3px 6px',
                            fontSize: '10px',
                            colorScheme: 'dark',
                            cursor: 'pointer',
                          }}
                          title="Memory chunk interval"
                        >
                          {[1, 2, 5, 10, 15, 30].map(m => (
                            <option key={m} value={m} style={{ background: '#1e1d2e' }}>{m} min</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </MacWindow>
          )}
        </AnimatePresence>

        {/* WINDOW 2: View History Window */}
        <AnimatePresence>
          {openWindows.history && (
            <MacWindow
              appId="history"
              label="Session History Viewer"
              isOpen={openWindows.history}
              onClose={() => closeWindow('history')}
              zIndex={windowZIndex.history}
              defaultPos={{ x: 260, y: 120 }}
              onFocus={() => bringToFront('history')}
            >
              <div style={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden' }}>
                
                {/* Left Sidebar: Session List */}
                <div style={{
                  width: '240px',
                  background: '#151324',
                  borderRight: '1px solid rgba(255,255,255,0.06)',
                  display: 'flex',
                  flexDirection: 'column',
                  flexShrink: 0
                }}>
                  {/* Sidebar Header */}
                  <div style={{
                    padding: '16px 14px',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span style={{ fontSize: '11px', color: '#a78bfa', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Voice Sessions
                    </span>
                    {sessions.length > 0 && (
                      <button
                        onClick={() => {
                          setSessions([]);
                          setActiveSessionId(null);
                          showToast('Cleared all history sessions.');
                        }}
                        style={{
                          background: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.25)',
                          color: '#ef4444',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '10px',
                          fontWeight: 500,
                          cursor: 'pointer'
                        }}
                      >
                        Clear All
                      </button>
                    )}
                  </div>

                  {/* Sidebar Scrollable List */}
                  <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '12px 8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    scrollbarWidth: 'thin'
                  }}>
                    {sessions.length === 0 ? (
                      <div style={{ textAlign: 'center', color: '#64748b', fontSize: '11.5px', marginTop: '30px', fontStyle: 'italic' }}>
                        No session recorded.
                      </div>
                    ) : (
                      sessions.map((session) => {
                        const isActive = activeSessionId === session.id;
                        return (
                          <div
                            key={session.id}
                            onClick={() => setActiveSessionId(session.id)}
                            style={{
                              padding: '10px 12px',
                              borderRadius: '8px',
                              background: isActive ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
                              border: isActive ? '1px solid rgba(139, 92, 246, 0.3)' : '1px solid transparent',
                              cursor: 'pointer',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '4px',
                              position: 'relative',
                              transition: 'all 0.2s ease',
                              textAlign: 'left'
                            }}
                            className="session-list-item"
                          >
                            <div style={{
                              fontSize: '12px',
                              fontWeight: 600,
                              color: isActive ? '#c084fc' : '#cbd5e1',
                              paddingRight: '20px',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}>
                              {session.title}
                            </div>
                            <div style={{ fontSize: '9.5px', color: '#64748b' }}>
                              {session.timestamp}
                            </div>

                            {/* Delete single session button */}
                            <button
                              onClick={(e) => deleteSession(e, session.id)}
                              style={{
                                position: 'absolute',
                                right: '10px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                background: 'transparent',
                                border: 'none',
                                color: '#4b5563',
                                fontSize: '12px',
                                cursor: 'pointer',
                                padding: '4px'
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                              onMouseLeave={(e) => (e.currentTarget.style.color = '#4b5563')}
                            >
                              ✕
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Right Column: Chat History detail panel */}
                <div style={{
                  flex: 1,
                  background: '#09090b',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden'
                }}>
                  {(() => {
                    const currentSession = sessions.find(s => s.id === activeSessionId);
                    if (!currentSession) {
                      return (
                        <div style={{
                          flex: 1,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '12px',
                          color: '#4b5563',
                          padding: '32px',
                          textAlign: 'center'
                        }}>
                          <div style={{ fontSize: '32px' }}>📁</div>
                          <div style={{ fontSize: '14px', fontWeight: 600, color: '#94a3b8' }}>
                            No Session Selected
                          </div>
                          <div style={{ fontSize: '12px', color: '#64748b', maxWidth: '320px', lineHeight: 1.5 }}>
                            Speak to the Voice Companion to create a new session, or select an existing session from the sidebar to view history.
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden'
                      }}>
                        {/* Detail Header */}
                        <div style={{
                          padding: '12px 18px',
                          borderBottom: '1px solid rgba(255,255,255,0.06)',
                          background: '#121215',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexShrink: 0
                        }}>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9' }}>
                            {currentSession.title}
                          </span>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>
                            {currentSession.timestamp}
                          </span>
                        </div>

                        {/* Detail Messages Log */}
                        <div style={{
                          flex: 1,
                          overflowY: 'auto',
                          padding: '20px 24px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '24px',
                          scrollbarWidth: 'thin'
                        }}>
                          {currentSession.interactions.map((interaction) => (
                            <div key={interaction.id} style={{ display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left' }}>
                              
                              {/* Question Section */}
                              <div style={{
                                alignSelf: 'flex-start',
                                maxWidth: '85%',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '4px'
                              }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '9px', fontWeight: 700, color: '#f43f5e', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                                  <User size={10} /> User Query
                                </span>
                                <div style={{
                                  background: 'rgba(244, 63, 94, 0.06)',
                                  border: '1px solid rgba(244, 63, 94, 0.15)',
                                  borderRadius: '10px 10px 10px 2px',
                                  padding: '10px 14px',
                                  color: '#e2e8f0',
                                  fontSize: '12.5px',
                                  lineHeight: 1.5,
                                  fontStyle: 'italic'
                                }}>
                                  "{interaction.prompt}"
                                </div>
                              </div>

                              {/* Answer Section */}
                              <div style={{
                                alignSelf: 'stretch',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '4px'
                              }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '9px', fontWeight: 700, color: '#a78bfa', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                                  <Bot size={10} /> Qwen Memory OS Response
                                </span>
                                <div style={{
                                  background: 'rgba(255,255,255,0.02)',
                                  border: '1px solid rgba(255,255,255,0.05)',
                                  borderRadius: '10px',
                                  padding: '14px 18px',
                                }}>
                                  {/* Render HTML UI if present */}
                                  {interaction.responseHtml ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '6px' }}>
                                        <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 600 }}>Generated Interactive UI Widget</span>
                                      </div>
                                      <div style={{ height: '320px', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', background: '#000' }}>
                                        <iframe
                                          srcDoc={interaction.responseHtml}
                                          sandbox="allow-scripts allow-same-origin"
                                          style={{ width: '100%', height: '100%', border: 'none', background: 'transparent' }}
                                          title={`History UI - ${interaction.id}`}
                                        />
                                      </div>
                                    </div>
                                  ) : (
                                    /* Render parsed Text and Code blocks */
                                    <div style={{ color: '#cbd5e1', fontSize: '13px', lineHeight: 1.6 }}>
                                      {parseResponseText(interaction.responseText).map((part, pIdx) => {
                                        if (part.type === 'code') {
                                          if (part.language === 'markdown' || part.language === 'md') {
                                            return (
                                              <div key={pIdx} style={{ marginBottom: '8px' }}>
                                                <MarkdownBlock text={part.content} />
                                              </div>
                                            );
                                          }
                                          return <CodeBlock key={pIdx} content={part.content} language={part.language} />;
                                        }
                                        return (
                                          <div key={pIdx} style={{ marginBottom: '8px' }}>
                                            <MarkdownBlock text={part.content} />
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              </div>

                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>

              </div>
            </MacWindow>
          )}
        </AnimatePresence>

        {/* ─── Settings Window ─── */}
        <AnimatePresence>
          {openWindows.settings && (
            <MacWindow
              appId="settings"
              label="System Settings"
              isOpen={openWindows.settings}
              onClose={() => closeWindow('settings')}
              zIndex={windowZIndex.settings}
              defaultPos={{ x: 220, y: 180 }}
              onFocus={() => bringToFront('settings')}
            >
              <div style={{
                display: 'flex',
                width: '100%',
                height: '100%',
                background: '#0d0d12',
                color: '#f8fafc',
                fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                overflow: 'hidden'
              }}>
                {/* Left Settings Navigation Sidebar */}
                <div style={{
                  width: '160px',
                  background: '#121218',
                  borderRight: '1px solid rgba(255, 255, 255, 0.05)',
                  padding: '16px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  <div style={{
                    fontSize: '9px',
                    fontWeight: 700,
                    color: '#64748b',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    paddingLeft: '6px',
                    marginBottom: '6px'
                  }}>
                    System
                  </div>
                  <div
                    onClick={() => setSettingsTab('voice')}
                    style={{
                      fontSize: '12px',
                      fontWeight: 500,
                      color: settingsTab === 'voice' ? '#a78bfa' : '#94a3b8',
                      background: settingsTab === 'voice' ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    🔊 Voice Assist
                  </div>
                  <div
                    onClick={() => setSettingsTab('device')}
                    style={{
                      fontSize: '12px',
                      fontWeight: 500,
                      color: settingsTab === 'device' ? '#a78bfa' : '#94a3b8',
                      background: settingsTab === 'device' ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    💻 Device & Graph
                  </div>
                </div>

                {/* Right Settings Detail Panel */}
                <div style={{
                  flex: 1,
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '20px',
                  overflowY: 'auto'
                }}>
                  {settingsTab === 'device' ? (
                    <DevicePairingSettings onPairChange={() => showToast('Device pairing identity updated')} />
                  ) : (
                  <>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#f8fafc' }}>
                      Companion Voice Setting
                    </h3>
                    <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#94a3b8', lineHeight: 1.4 }}>
                      Choose your preferred desktop companion voice model. This choice applies to all spoken responses.
                    </p>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                        Select Voice
                      </label>
                      <span style={{ fontSize: '10px', color: '#64748b' }}>
                        {availableVoices.length} voices available
                      </span>
                    </div>

                    {/* Scrollable voice list */}
                    <div style={{
                      maxHeight: '150px',
                      overflowY: 'auto',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      paddingRight: '4px',
                    }}>
                      {availableVoices.map(voice => (
                          <button
                            key={voice.name}
                            onClick={() => {
                              localStorage.setItem('qwenos_tts_voice', voice.name);
                              window.dispatchEvent(new Event('qwenos_voice_changed'));
                              showToast(`Voice: ${voice.name}`);
                            }}
                            style={{
                              background: ttsVoice === voice.name ? 'rgba(139, 92, 246, 0.15)' : 'rgba(255,255,255,0.02)',
                              border: ttsVoice === voice.name ? '1px solid #8b5cf6' : '1px solid rgba(255,255,255,0.06)',
                              borderRadius: '8px',
                              padding: '8px 12px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '8px',
                              transition: 'all 0.15s',
                              outline: 'none',
                              textAlign: 'left',
                              width: '100%',
                            }}
                          >
                            <span style={{ fontSize: '12px', color: ttsVoice === voice.name ? '#c4b5fd' : '#e2e8f0', fontWeight: ttsVoice === voice.name ? 600 : 400, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {voice.name}
                            </span>
                            <span style={{ fontSize: '10px', color: '#64748b', flexShrink: 0 }}>
                              {voice.lang}
                            </span>
                            {ttsVoice === voice.name && (
                              <span style={{ fontSize: '14px', flexShrink: 0 }}>✓</span>
                            )}
                          </button>
                        ))
                      }
                      {availableVoices.length === 0 && (
                        <p style={{ fontSize: '11px', color: '#64748b', textAlign: 'center', padding: '12px' }}>
                          No voices loaded yet...
                        </p>
                      )}
                    </div>
                  </div>

                    {/* Voice Sliders */}
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                      marginTop: '8px',
                      borderTop: '1px solid rgba(255,255,255,0.05)',
                      paddingTop: '12px'
                    }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: '#94a3b8' }}>
                          <span>Speed / Rate ({ttsRate}x)</span>
                        </div>
                        <input 
                          type="range" 
                          min="0.5" 
                          max="2.0" 
                          step="0.1" 
                          value={ttsRate}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setTtsRate(val);
                            localStorage.setItem('qwenos_tts_rate', val.toString());
                          }}
                          style={{ accentColor: '#8b5cf6', background: 'rgba(255,255,255,0.1)', height: '4px', borderRadius: '2px', outline: 'none', cursor: 'pointer' }}
                        />
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: '#94a3b8' }}>
                          <span>Pitch ({ttsPitch})</span>
                        </div>
                        <input 
                          type="range" 
                          min="0.5" 
                          max="2.0" 
                          step="0.1" 
                          value={ttsPitch}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setTtsPitch(val);
                            localStorage.setItem('qwenos_tts_pitch', val.toString());
                          }}
                          style={{ accentColor: '#8b5cf6', background: 'rgba(255,255,255,0.1)', height: '4px', borderRadius: '2px', outline: 'none', cursor: 'pointer' }}
                        />
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: '#94a3b8' }}>
                          <span>Volume ({Math.round(ttsVolume * 100)}%)</span>
                        </div>
                        <input 
                          type="range" 
                          min="0.1" 
                          max="1.0" 
                          step="0.1" 
                          value={ttsVolume}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setTtsVolume(val);
                            localStorage.setItem('qwenos_tts_volume', val.toString());
                          }}
                          style={{ accentColor: '#8b5cf6', background: 'rgba(255,255,255,0.1)', height: '4px', borderRadius: '2px', outline: 'none', cursor: 'pointer' }}
                        />
                      </div>
                    </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-start', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px' }}>
                    <button
                      onClick={() => {
                        if (!('speechSynthesis' in window)) return;
                        window.speechSynthesis.cancel();
                        const selectedVoiceName = ttsVoice;
                        const voiceObj = availableVoices.find(v => v.name === selectedVoiceName)
                                      ?? availableVoices.find(v => v.lang.startsWith('en'));
                        if (!voiceObj) return;

                        // Check if it's a cloud voice
                        const isCloudVoice = !window.speechSynthesis.getVoices().some(v => v.name === voiceObj.name);
                        const testText = `Hello! I am your desktop companion voice. Testing selection.`;

                        if (isCloudVoice) {
                          const voiceId = (voiceObj as any).shortName || voiceObj.voiceURI;
                          const audioUrl = `http://localhost:3000/api/tts/speak?text=${encodeURIComponent(testText)}&voice=${encodeURIComponent(voiceId)}&rate=${ttsRate}&pitch=${ttsPitch}&volume=${ttsVolume}`;
                          
                          if ((window as any)._settingsTestAudio) {
                            (window as any)._settingsTestAudio.pause();
                          }
                          
                          const audio = new Audio(audioUrl);
                          (window as any)._settingsTestAudio = audio;
                          const playOfflineFallback = () => {
                            console.warn('[Settings Test] Cloud playback failed/offline, falling back to offline inbuilt voice.');
                            const allLocal = window.speechSynthesis.getVoices();
                            const isMale = voiceObj.name.toLowerCase().includes('william') || voiceObj.name.toLowerCase().includes('david') || voiceObj.name.toLowerCase().includes('male');
                            const localVoice = allLocal.find(v => {
                              const n = v.name.toLowerCase();
                              return isMale ? (n.includes('david') || n.includes('mark') || n.includes('male'))
                                            : (n.includes('zira') || n.includes('hazel') || n.includes('female'));
                            }) ?? allLocal.find(v => v.lang.startsWith('en')) ?? allLocal[0];
                            const utterance = new SpeechSynthesisUtterance(testText);
                            if (localVoice) utterance.voice = localVoice;
                            window.speechSynthesis.speak(utterance);
                          };
                          audio.onerror = playOfflineFallback;
                          audio.play().catch(playOfflineFallback);
                          console.log('[Settings Test] ✅ Playing via Cloud Edge TTS:', voiceObj.name);
                        } else {
                          const nativeVoiceObj = window.speechSynthesis.getVoices().find(v => v.name === voiceObj.name);
                          const utterance = new SpeechSynthesisUtterance(testText);
                          if (nativeVoiceObj) {
                            utterance.voice = nativeVoiceObj;
                            utterance.lang  = nativeVoiceObj.lang;
                          } else {
                            utterance.lang = voiceObj.lang;
                          }
                          utterance.rate = ttsRate;
                          utterance.pitch = ttsPitch;
                          utterance.volume = ttsVolume;
                          console.log('[Settings Test] ✅ Playing via Local TTS:', voiceObj.name);
                          window.speechSynthesis.speak(utterance);
                        }
                      }}

                      style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '6px',
                        color: '#e2e8f0',
                        padding: '6px 14px',
                        fontSize: '11px',
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.2s'
                      }}
                    >
                      <span>▶</span> Test Selected Voice
                    </button>
                  </div>
                </>
              )}

                </div>
              </div>
            </MacWindow>
          )}
        </AnimatePresence>

      </div>

      {/* ─── Center-Bottom Notification / Toast System ─── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            style={{
              position: 'absolute',
              bottom: '100px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(15, 15, 20, 0.72)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              padding: '8px 18px',
              borderRadius: '10px',
              color: '#ffffff',
              fontSize: '11px',
              fontWeight: 500,
              boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
              zIndex: 99999,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              whiteSpace: 'nowrap'
            }}
          >
            <span>🔔</span>
            <span>{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Bottom Glassmorphic macOS Dock ─── */}
      <div
        onMouseMove={(e) => mouseX.set(e.pageX)}
        onMouseLeave={() => mouseX.set(Infinity)}
        style={{
          position: 'absolute',
          bottom: '16px',
          left: '50%',
          transform: 'translateX(-50%)',
          height: '60px',
          background: 'rgba(255, 255, 255, 0.08)',
          backdropFilter: 'blur(30px)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '18px',
          padding: '0 12px',
          display: 'flex',
          alignItems: 'flex-end',
          gap: '8px',
          zIndex: 9999,
          boxShadow: '0 20px 50px rgba(0,0,0,0.4), inset 0 1px 1px rgba(255,255,255,0.2)',
          boxSizing: 'content-box'
        }}
      >
        {APPS_LIST.map((app) => {
          const isWindowOpen = app.hasWindow ? openWindows[app.id] : false;
          return (
            <div key={app.id} style={{ position: 'relative' }}>
              <DockIcon
                app={app}
                isActive={isWindowOpen}
                onClick={() => {
                  if (app.hasWindow) {
                    toggleWindow(app.id);
                  } else {
                    showToast((app as any).info || 'Service working silently in background.');
                  }
                }}
                onHover={() => setHoveredApp(app.id)}
                onLeave={() => setHoveredApp(null)}
                mouseX={mouseX}
              />
              
              {/* Custom Tooltip */}
              {hoveredApp === app.id && (
                <div style={{
                  position: 'absolute',
                  bottom: '72px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'rgba(15, 15, 20, 0.85)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '10.5px',
                  color: '#ffffff',
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.35)',
                  zIndex: 999999
                }}>
                  {app.label}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ─── Floating Voice Companion Bar (Picture-in-Picture Overlay) ─── */}
      <PipPortal 
        isOpen={controller.isPipOpen} 
        onClose={controller.closePip} 
        width={controller.pipWidth} 
        height={controller.pipHeight}
        isSpeaking={controller.isSpeaking}
        onPipDocumentReady={(doc) => setPipDocument(doc)}
      >
        <VoiceCompanionBar
          state={controller.assistantState}
          onClose={controller.closePip}
          onTap={controller.toggleListening}
          transcript={controller.transcript}
          isSpeaking={controller.isSpeaking}
          listening={controller.listening}
          volume={controller.volume}
          responseText={controller.responseText}
          responseHtml={controller.responseHtml}
          isProcessing={controller.isProcessing}
          clearResponse={controller.clearResponse}
          onSizeChange={controller.setPipSize}
          transitionMessage={controller.transitionMessage}
          shouldDisplayPanel={controller.shouldDisplayPanel}
          speakUtterance={controller.speakUtterance}
          pipDocument={pipDocument}
        />
      </PipPortal>
    </div>
  );
}
