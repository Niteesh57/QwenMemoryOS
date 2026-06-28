import { useState, useEffect, useRef } from 'react';
import { PipPortal, isPipSupported } from './components/PipPortal';
import { VoiceCompanionBar, CodeBlock, parseResponseText, formatMarkdown } from './components/VoiceCompanionBar';
import { VoiceVisualizer } from './components/VoiceVisualizer';
import { useCompanionController } from './hooks/useCompanionController';
import { motion, useMotionValue, useSpring, useTransform, AnimatePresence } from 'motion/react';
import { MeshGradientBackground } from './components/MeshGradientBackground';
import { McpAppsManager } from './components/McpAppsManager';

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

const VSCodeIcon = () => (
  <svg viewBox="0 0 64 64" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 18 L44 6 L52 14 L12 46 Z" fill="#007acc" opacity="0.85" />
    <path d="M12 46 L44 58 L52 50 L12 18 Z" fill="#007acc" />
    <path d="M52 14 L32 32 L52 50 Z" fill="#1f9cf0" />
    <path d="M12 18 L24 32 L12 46 Z" fill="#0065a3" />
    <path d="M12 18 L4 24 L12 32 Z" fill="#00568a" />
    <path d="M12 46 L4 40 L12 32 Z" fill="#00568a" />
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

  const width = appId === 'vscode' ? 760 : appId === 'history' ? 780 : appId === 'mcp' ? 820 : 540;
  const height = appId === 'vscode' ? 490 : appId === 'history' ? 480 : appId === 'mcp' ? 520 : 430;

  return (
    <motion.div
      drag
      dragMomentum={false}
      dragElastic={0.02}
      dragHandleClassName="win-header-drag"
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

  const addInteractionToHistory = (prompt: string, text: string, html: string | null) => {
    const newInteraction: ChatInteraction = {
      id: Date.now().toString(),
      prompt,
      responseText: text,
      responseHtml: html,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setSessions((prev) => {
      // Helper to generate dynamic title
      const words = prompt.split(/\s+/).filter(Boolean);
      let title = 'Speech Interaction';
      if (words.length > 0) {
        const cleanWords = words.map(w => w.replace(/[^\w\s]/g, ''));
        const truncated = cleanWords.slice(0, 4).join(' ');
        title = truncated.charAt(0).toUpperCase() + truncated.slice(1);
      }

      const newSession: ChatSession = {
        id: Date.now().toString(),
        title,
        timestamp: new Date().toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        interactions: [newInteraction],
      };

      setActiveSessionId(newSession.id);
      return [newSession, ...prev];
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
  
  // Window states
  const [openWindows, setOpenWindows] = useState<Record<string, boolean>>({
    aichat: true, // open AI Chat by default
    history: false,
    vscode: false,
    mcp: false,
    settings: false,
  });
  
  const [windowZIndex, setWindowZIndex] = useState<Record<string, number>>({
    aichat: 10,
    history: 10,
    vscode: 10,
    mcp: 10,
    settings: 10,
  });

  const [activeWindow, _setActiveWindow] = useState('aichat');
  
  // Custom HTML Sandbox state
  const [customHtml, setCustomHtml] = useState(
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

  // VS Code active file state
  const [selectedFile, setSelectedFile] = useState<'useCompanionController.ts' | 'VoiceCompanionBar.tsx' | 'PipPortal.tsx'>('useCompanionController.ts');

  // Small notifications state
  const [toast, setToast] = useState<string | null>(null);

  const [ttsVoice, setTtsVoice] = useState<string>(() => {
    return localStorage.getItem('qwenos_tts_voice') || '';
  });
  const [ttsVoiceSearch, setTtsVoiceSearch] = useState<string>('');

  // Store all available browser voices in state — same pattern as MemeRenderer.tsx
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    const loadVoices = () => {
      const all = window.speechSynthesis.getVoices();
      if (all.length > 0) {
        setAvailableVoices(all);
        console.log('[TTS Init] Voices loaded:', all.length);
        // Auto-select first English voice if nothing selected yet
        if (!localStorage.getItem('qwenos_tts_voice')) {
          const defaultVoice = all.find(v => v.lang.startsWith('en')) ?? all[0];
          if (defaultVoice) {
            localStorage.setItem('qwenos_tts_voice', defaultVoice.name);
            setTtsVoice(defaultVoice.name);
          }
        }
      }
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

  // Time state for top bar
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

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
    { id: 'vscode', label: 'VS Code', icon: VSCodeIcon, hasWindow: true },
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
          <span className="wipe-reveal" style={{ fontWeight: 600, cursor: 'pointer' }}>QwenOS</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <span style={{ opacity: 0.8 }}>🔋 98%</span>
          <span style={{ opacity: 0.8 }}>📶</span>
          <span style={{ fontWeight: 600 }}>{currentTime}</span>
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
                        {controller.listening ? '🔴 Mute Mic' : '🎤 Unmute Mic'}
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
                        {controller.isPipOpen ? '📺 Overlay Open' : '📺 Launch PiP'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* State Simulator Deck */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Simulation Console</span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                    <button
                      onClick={() => {
                        controller.setAssistantState('listening');
                        showToast('Simulating microphone capture...');
                      }}
                      style={{ padding: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', color: '#cbd5e1', fontSize: '11.5px', cursor: 'pointer' }}
                    >
                      Listening
                    </button>
                    <button
                      onClick={() => {
                        controller.setAssistantState('processing');
                        showToast('Simulating LLM request query...');
                      }}
                      style={{ padding: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', color: '#cbd5e1', fontSize: '11.5px', cursor: 'pointer' }}
                    >
                      Thinking
                    </button>
                    <button
                      onClick={() => {
                        controller.setAssistantState('idle');
                        showToast('Simulating idle standby mode...');
                      }}
                      style={{ padding: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', color: '#cbd5e1', fontSize: '11.5px', cursor: 'pointer' }}
                    >
                      Idle
                    </button>
                  </div>
                </div>

                {/* Live Transcript Display Box */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Speech Feed Output</span>
                  <div style={{
                    flex: 1,
                    background: 'rgba(0, 0, 0, 0.2)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    borderRadius: '12px',
                    padding: '14px',
                    fontSize: '12.5px',
                    color: controller.transcript ? '#f1f5f9' : '#4b5563',
                    fontStyle: controller.transcript ? 'normal' : 'italic',
                    overflowY: 'auto'
                  }}>
                    {controller.transcript ? `"${controller.transcript}"` : 'Awaiting microphone stream. Try speaking to transcribe.'}
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
                                <span style={{ fontSize: '9px', fontWeight: 700, color: '#f43f5e', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                                  🎤 User Query
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
                                <span style={{ fontSize: '9px', fontWeight: 700, color: '#a78bfa', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                                  🤖 Qwen Response
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
                                          return <CodeBlock key={pIdx} content={part.content} language={part.language} />;
                                        }
                                        return (
                                          <div key={pIdx} style={{ marginBottom: '8px' }}>
                                            {formatMarkdown(part.content)}
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

        {/* WINDOW 3: VS Code Workspace Mockup */}
        <AnimatePresence>
          {openWindows.vscode && (
            <MacWindow
              appId="vscode"
              label="Visual Studio Code"
              isOpen={openWindows.vscode}
              onClose={() => closeWindow('vscode')}
              zIndex={windowZIndex.vscode}
              defaultPos={{ x: 60, y: 150 }}
              onFocus={() => bringToFront('vscode')}
            >
              <div style={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden' }}>
                
                {/* File Tree Explorer Side-Bar */}
                <div style={{
                  width: '180px',
                  background: '#18181b',
                  borderRight: '1px solid rgba(0,0,0,0.3)',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  flexShrink: 0
                }}>
                  <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    workspace-core
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {['useCompanionController.ts', 'VoiceCompanionBar.tsx', 'PipPortal.tsx'].map((file) => (
                      <div
                        key={file}
                        onClick={() => setSelectedFile(file as any)}
                        style={{
                          fontSize: '11.5px',
                          color: selectedFile === file ? '#60a5fa' : 'rgba(255,255,255,0.5)',
                          cursor: 'pointer',
                          padding: '4px 6px',
                          borderRadius: '4px',
                          background: selectedFile === file ? 'rgba(96,165,250,0.1)' : 'transparent',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                      >
                        📄 {file}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Editor Content Area */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#09090b', overflow: 'hidden' }}>
                  
                  {/* File Tab */}
                  <div style={{ height: '30px', background: '#111', display: 'flex', alignItems: 'center', px: '14px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <span style={{ fontSize: '11px', color: '#60a5fa', padding: '0 12px' }}>
                      {selectedFile}
                    </span>
                  </div>

                  {/* Code Block Renderer */}
                  <div style={{
                    flex: 1,
                    padding: '16px',
                    fontFamily: 'Consolas, Monaco, monospace',
                    fontSize: '11px',
                    lineHeight: 1.6,
                    overflowY: 'auto',
                    color: '#e2e8f0'
                  }}>
                    {selectedFile === 'useCompanionController.ts' && (
                      <pre style={{ margin: 0 }}>
                        <span style={{ color: '#ff7b72' }}>import</span> {'{ useState, useEffect, useRef }'} <span style={{ color: '#ff7b72' }}>from</span> <span style={{ color: '#a5d6ff' }}>'react'</span>;<br />
                        <span style={{ color: '#ff7b72' }}>import</span> SpeechRecognition, {'{ useSpeechRecognition }'} <span style={{ color: '#ff7b72' }}>from</span> <span style={{ color: '#a5d6ff' }}>'speech'</span>;<br /><br />
                        <span style={{ color: '#ff7b72' }}>export function</span> <span style={{ color: '#d2a8ff' }}>useCompanionController</span>() {'{'}<br />
                        &nbsp;&nbsp;<span style={{ color: '#ff7b72' }}>const</span> [isPipOpen, setIsPipOpen] = <span style={{ color: '#d2a8ff' }}>useState</span>(<span style={{ color: '#79c0ff' }}>false</span>);<br />
                        &nbsp;&nbsp;<span style={{ color: '#ff7b72' }}>const</span> {'{ transcript, listening }'} = <span style={{ color: '#d2a8ff' }}>useSpeechRecognition</span>();<br />
                        &nbsp;&nbsp;<span style={{ color: '#ff7b72' }}>const</span> [isSpeaking, setIsSpeaking] = <span style={{ color: '#d2a8ff' }}>useState</span>(<span style={{ color: '#79c0ff' }}>false</span>);<br /><br />
                        &nbsp;&nbsp;<span style={{ color: '#8b949e' }}>// Auto-trigger speaking expansion on voice stream detection</span><br />
                        &nbsp;&nbsp;<span style={{ color: '#d2a8ff' }}>useEffect</span>(() <span style={{ color: '#ff7b72' }}>=&gt;</span> {'{'} <span style={{ color: '#8b949e' }}>/* resize PiP code */</span> {'}'}, [transcript]);<br /><br />
                        &nbsp;&nbsp;<span style={{ color: '#ff7b72' }}>return</span> {'{ isPipOpen, isSpeaking, transcript, listening }'};<br />
                        {'}'}
                      </pre>
                    )}
                    {selectedFile === 'VoiceCompanionBar.tsx' && (
                      <pre style={{ margin: 0 }}>
                        <span style={{ color: '#ff7b72' }}>export const</span> <span style={{ color: '#d2a8ff' }}>VoiceCompanionBar</span> = ({'{ state, transcript, isSpeaking }'}: Props) <span style={{ color: '#ff7b72' }}>=&gt;</span> {'{'}<br />
                        &nbsp;&nbsp;<span style={{ color: '#ff7b72' }}>if</span> (!isSpeaking) {'{'}<br />
                        &nbsp;&nbsp;&nbsp;&nbsp;<span style={{ color: '#ff7b72' }}>return</span> &lt;<span style={{ color: '#7ee787' }}>div</span> className=<span style={{ color: '#a5d6ff' }}>"mini-glowing-mic-orb"</span> /&gt;;<br />
                        &nbsp;&nbsp;{'}'}<br /><br />
                        &nbsp;&nbsp;<span style={{ color: '#ff7b72' }}>return</span> (<br />
                        &nbsp;&nbsp;&nbsp;&nbsp;&lt;<span style={{ color: '#7ee787' }}>div</span> style={'{'}containerStyle{'}'}&gt;<br />
                        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&lt;<span style={{ color: '#7ee787' }}>span</span>&gt;{'{'}transcript{'}'}&lt;/<span style={{ color: '#7ee787' }}>span</span>&gt;<br />
                        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&lt;<span style={{ color: '#7ee787' }}>canvas</span> ref={'{'}canvasRef{'}'} /&gt;<br />
                        &nbsp;&nbsp;&nbsp;&nbsp;&lt;/<span style={{ color: '#7ee787' }}>div</span>&gt;<br />
                        &nbsp;&nbsp;);<br />
                        {'}'};
                      </pre>
                    )}
                    {selectedFile === 'PipPortal.tsx' && (
                      <pre style={{ margin: 0 }}>
                        <span style={{ color: '#ff7b72' }}>export const</span> <span style={{ color: '#d2a8ff' }}>PipPortal</span> = ({'{ isOpen, width, height, isSpeaking }'}: Props) <span style={{ color: '#ff7b72' }}>=&gt;</span> {'{'}<br />
                        &nbsp;&nbsp;<span style={{ color: '#8b949e' }}>// Hooks React portal rendering inside chromium PiP overlay</span><br />
                        &nbsp;&nbsp;<span style={{ color: '#ff7b72' }}>const</span> openPipWindow = <span style={{ color: '#ff7b72' }}>async</span> () <span style={{ color: '#ff7b72' }}>=&gt;</span> {'{'}<br />
                        &nbsp;&nbsp;&nbsp;&nbsp;const pip = await window.documentPictureInPicture.requestWindow({'{'} width, height {'}'});<br />
                        &nbsp;&nbsp;&nbsp;&nbsp;<span style={{ color: '#8b949e' }}>// Apply dynamic translucent backgrounds</span><br />
                        &nbsp;&nbsp;&nbsp;&nbsp;pip.document.body.style.background = isSpeaking ? <span style={{ color: '#a5d6ff' }}>'rgba(8, 8, 16, 0.75)'</span> : <span style={{ color: '#a5d6ff' }}>'transparent'</span>;<br />
                        &nbsp;&nbsp;{'}'};<br />
                        {'}'};
                      </pre>
                    )}
                  </div>

                  {/* Terminal panel */}
                  <div style={{ height: '110px', background: '#000', borderTop: '1px solid rgba(255,255,255,0.06)', padding: '10px 14px', fontFamily: 'monospace', fontSize: '10.5px', color: '#34d399', boxSizing: 'border-box' }}>
                    <div style={{ color: 'rgba(255,255,255,0.45)' }}>bash - npm run dev</div>
                    <div>&gt; vite --host</div>
                    <div>&nbsp;&nbsp;➜  Local:&nbsp;&nbsp;&nbsp;http://localhost:5173/</div>
                    <div>&nbsp;&nbsp;➜  Network:&nbsp;use --host to expose</div>
                    <div>&nbsp;&nbsp;➜  press h + enter to show help</div>
                  </div>

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
                width: '540px',
                height: '320px',
                background: '#0d0d12',
                color: '#f8fafc',
                fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                overflow: 'hidden'
              }}>
                {/* Left Settings Navigation Sidebar */}
                <div style={{
                  width: '150px',
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
                  <div style={{
                    fontSize: '12px',
                    fontWeight: 500,
                    color: '#a78bfa',
                    background: 'rgba(139, 92, 246, 0.1)',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    🔊 Voice Assist
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

                    {/* Search filter */}
                    <input
                      type="text"
                      placeholder="Search voices..."
                      value={ttsVoiceSearch}
                      onChange={e => setTtsVoiceSearch(e.target.value)}
                      style={{
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        color: '#e2e8f0',
                        fontSize: '12px',
                        outline: 'none',
                        width: '100%',
                        boxSizing: 'border-box',
                      }}
                    />

                    {/* Scrollable voice list */}
                    <div style={{
                      maxHeight: '220px',
                      overflowY: 'auto',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      paddingRight: '4px',
                    }}>
                      {availableVoices
                        .filter(v => v.name.toLowerCase().includes(ttsVoiceSearch.toLowerCase()) || v.lang.toLowerCase().includes(ttsVoiceSearch.toLowerCase()))
                        .map(voice => (
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

                  <div style={{ display: 'flex', justifyContent: 'flex-start', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px' }}>
                    <button
                      onClick={() => {
                        if (!('speechSynthesis' in window)) return;
                        window.speechSynthesis.cancel();
                        const selectedVoiceName = ttsVoice;
                        const voiceObj = availableVoices.find(v => v.name === selectedVoiceName)
                                      ?? availableVoices.find(v => v.lang.startsWith('en'));
                        if (!voiceObj) return;
                        const utterance = new SpeechSynthesisUtterance(`Hello! I am ${voiceObj.name.split(' ').slice(1, 2).join(' ') || 'your'}, your desktop companion voice.`);
                        utterance.voice = voiceObj;
                        utterance.lang  = voiceObj.lang;
                        console.log('[Settings Test] ✅ Testing voice:', voiceObj.name);
                        window.speechSynthesis.speak(utterance);
                      }}
                      style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '6px',
                        color: '#e2e8f0',
                        padding: '6px 14px',
                        fontSize: '11px',
                        fontWeight: 500,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.2s'
                      }}
                    >
                      <span>▶</span> Test Selected Voice
                    </button>
                  </div>

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
                    showToast(app.info || 'Service working silently in background.');
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
        />
      </PipPortal>
    </div>
  );
}
