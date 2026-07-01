import React, { useEffect, useState } from 'react';

export type VisualizerState = 'idle' | 'listening' | 'processing';

interface VoiceVisualizerProps {
  state: VisualizerState;
  volume?: number;
}

export const ChatGptVoiceOrb: React.FC<{ volume: number; state: VisualizerState; size?: number }> = ({
  volume,
  state,
  size = 80,
}) => {
  const [rotation, setRotation] = useState(0);
  const volumeRef = React.useRef(volume);
  volumeRef.current = volume;

  useEffect(() => {
    let animId: number;
    const rotate = () => {
      setRotation((prev) => (prev + 1.2 + volumeRef.current * 0.05) % 360);
      animId = requestAnimationFrame(rotate);
    };
    rotate();
    return () => cancelAnimationFrame(animId);
  }, []); // ✅ Empty deps — runs once, reads volume via ref

  // Generate organic border radius based on volume and rotation
  const vFactor = volume / 100; // 0 to 1
  const r1 = 50 + Math.sin(rotation * 0.05) * (12 + vFactor * 25);
  const r2 = 50 + Math.cos(rotation * 0.04) * (10 + vFactor * 20);
  const r3 = 50 + Math.sin(rotation * 0.03) * (15 + vFactor * 22);
  const r4 = 50 + Math.cos(rotation * 0.06) * (12 + vFactor * 28);

  const r5 = 50 - Math.sin(rotation * 0.05) * (10 + vFactor * 20);
  const r6 = 50 - Math.cos(rotation * 0.04) * (12 + vFactor * 25);
  const r7 = 50 - Math.sin(rotation * 0.03) * (12 + vFactor * 22);
  const r8 = 50 - Math.cos(rotation * 0.06) * (15 + vFactor * 28);

  const borderRadius = `${r1}% ${100 - r1}% ${r2}% ${100 - r2}% / ${r3}% ${r4}% ${100 - r4}% ${100 - r3}%`;
  const borderRadius2 = `${r5}% ${100 - r5}% ${r6}% ${100 - r6}% / ${r7}% ${r8}% ${100 - r8}% ${100 - r7}%`;

  // Scale based on volume and state
  const scale = 1.0 + (state === 'listening' ? vFactor * 0.35 : 0.05 * Math.sin(rotation * 0.08));

  // Determine colors based on state (Obsidian Violet/Pink theme)
  const gradient1 =
    state === 'processing'
      ? 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)'
      : state === 'listening'
      ? 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)'
      : 'linear-gradient(135deg, rgba(99, 102, 241, 0.45) 0%, rgba(139, 92, 246, 0.45) 100%)';

  const gradient2 =
    state === 'processing'
      ? 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)'
      : state === 'listening'
      ? 'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)'
      : 'linear-gradient(135deg, rgba(139, 92, 246, 0.25) 0%, rgba(236, 72, 153, 0.25) 100%)';

  const glowColor = state === 'listening' ? 'rgba(236, 72, 153, 0.55)' : 'rgba(99, 102, 241, 0.45)';
  const glow =
    state !== 'idle'
      ? `0 0 ${25 + vFactor * 45}px ${glowColor}, 0 0 {12 + vFactor * 25}px ${glowColor}`
      : '0 4px 15px rgba(139, 92, 246, 0.15)';

  return (
    <div
      style={{
        width: `${size}px`,
        height: `${size}px`,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transform: `scale(${scale})`,
        transition: 'transform 0.1s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
      }}
    >
      {/* Layer 1: Backing Glowing Blob */}
      <div
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          borderRadius: borderRadius2,
          background: gradient2,
          opacity: 0.65,
          transform: `rotate(${-rotation * 0.8}deg)`,
          filter: 'blur(3px)',
          transition: 'border-radius 0.15s linear',
        }}
      />

      {/* Layer 2: Main Blob */}
      <div
        style={{
          position: 'absolute',
          width: '93%',
          height: '93%',
          borderRadius: borderRadius,
          background: gradient1,
          boxShadow: glow,
          transform: `rotate(${rotation}deg)`,
          transition: 'border-radius 0.15s linear, box-shadow 0.15s ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      />

      {/* Layer 3: Central Glassy Core */}
      <div
        style={{
          position: 'absolute',
          width: '54%',
          height: '54%',
          borderRadius: '50%',
          background: 'rgba(12, 10, 24, 0.85)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255, 255, 255, 0.16)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 3,
          boxShadow: 'inset 0 1.5px 3px rgba(255,255,255,0.12)',
        }}
      >
        <span
          style={{
            fontSize: `${size * 0.22}px`,
            color: '#ffffff',
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
          }}
        >
          {state === 'processing' ? '🧠' : '🎙️'}
        </span>
      </div>
    </div>
  );
};

export const VoiceVisualizer: React.FC<VoiceVisualizerProps> = ({ state, volume = 0 }) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '140px',
        width: '100%',
        position: 'relative',
        gap: '12px',
      }}
    >
      <ChatGptVoiceOrb volume={volume} state={state} size={84} />

      {state === 'listening' && (
        <span
          style={{
            fontSize: '12px',
            color: '#ec4899',
            fontWeight: 600,
            letterSpacing: '0.08em',
            marginTop: '4px',
            fontFamily: 'Outfit, sans-serif',
          }}
        >
          LISTENING...
        </span>
      )}

      {state === 'processing' && (
        <span
          style={{
            fontSize: '12px',
            color: '#6366f1',
            fontWeight: 600,
            letterSpacing: '0.08em',
            marginTop: '4px',
            fontFamily: 'Outfit, sans-serif',
          }}
        >
          THINKING...
        </span>
      )}

      {state === 'idle' && (
        <span
          style={{
            fontSize: '11px',
            color: '#64748b',
            fontWeight: 500,
            letterSpacing: '0.05em',
            marginTop: '4px',
            fontFamily: 'Outfit, sans-serif',
          }}
        >
          MIC IDLE
        </span>
      )}
    </div>
  );
};
