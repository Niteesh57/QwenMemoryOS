// ═══════════════════════════════════════════════════════════════════════
//  MemoryBookManager.tsx — Memory Book OS Window
//  Full screen capture → Supabase → Qwen3-VL-Flash → Neo4j pipeline
// ═══════════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback } from 'react';
import { Flame, Sun, Snowflake, Zap, Video, Calendar, Activity, BookOpen, Upload, CheckCircle2, AlertCircle, Eye, Package, Clock } from 'lucide-react';
import { getDeviceHeaders } from '../utils/deviceIdentity';

const API = 'http://localhost:3000';
const DEFAULT_CHUNK_MINUTES = 10;

// ─── Types ────────────────────────────────────────────────────────────────────

interface MemoryEvent {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  object: string;
  raw_content: string;
  topic_tags: string[];
  tier: 'hot' | 'warm' | 'cold';
  access_count: number;
}

interface MemoryState {
  id: string;
  attribute: string;
  value: string;
  present: boolean;
  valid_from: string;
  valid_to?: string | null;
}

interface MemoryStats {
  hot: number;
  warm: number;
  cold: number;
  activeStates: number;
  pastStates: number;
}

interface LogEntry {
  ts: string;
  type: string;
  action?: string;
  object?: string;
  tier?: string;
  attribute?: string;
  value?: string;
  message?: string;
  filename?: string;
  size_mb?: string;
}

// ─── Tier badge ───────────────────────────────────────────────────────────────

const TierBadge = ({ tier }: { tier: string }) => {
  const map: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
    hot:  { label: 'HOT',  color: '#fb923c', bg: 'rgba(251,146,60,0.12)', icon: <Flame size={10} style={{ marginRight: 3 }} /> },
    warm: { label: 'WARM', color: '#facc15', bg: 'rgba(250,204,21,0.12)', icon: <Sun size={10} style={{ marginRight: 3 }} /> },
    cold: { label: 'COLD', color: '#60a5fa', bg: 'rgba(96,165,250,0.12)', icon: <Snowflake size={10} style={{ marginRight: 3 }} /> },
  };
  const t = map[tier] ?? map.cold;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      fontSize: '9px', fontWeight: 700, color: t.color,
      background: t.bg, border: `1px solid ${t.color}40`,
      borderRadius: '4px', padding: '1px 5px', letterSpacing: '0.04em'
    }}>{t.icon}{t.label}</span>
  );
};

// ─── Pulsing live dot ─────────────────────────────────────────────────────────

const LiveDot = () => (
  <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
    <span style={{
      width: '7px', height: '7px', borderRadius: '50%', background: '#ef4444',
      display: 'inline-block',
      animation: 'pulse-dot 1.2s ease-in-out infinite',
    }} />
    <style>{`@keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(1.4)} }`}</style>
    <span style={{ fontSize: '10px', fontWeight: 800, color: '#ef4444', letterSpacing: '0.05em' }}>LIVE</span>
  </span>
);

// ─── Helper ───────────────────────────────────────────────────────────────────

const fmtTime = (ts: string) => { try { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); } catch { return ts; } };
const fmtDate = (ts: string) => { try { return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' }); } catch { return ts; } };
const fmtDuration = (secs: number) => `${Math.floor(secs / 60).toString().padStart(2, '0')}:${(secs % 60).toString().padStart(2, '0')}`;

// ═══════════════════════════════════════════════════════════════════════════════
//  Main Component
// ═══════════════════════════════════════════════════════════════════════════════

export function MemoryBookManager() {
  const [activeTab, setActiveTab] = useState<'capture' | 'book' | 'states'>('capture');

  // ── Neo4j / backend state ──────────────────────────────────────────────────
  const [neo4jOk, setNeo4jOk] = useState(false);
  const [stats, setStats] = useState<MemoryStats>({ hot: 0, warm: 0, cold: 0, activeStates: 0, pastStates: 0 });
  const [timeline, setTimeline] = useState<MemoryEvent[]>([]);
  const [currentStates, setCurrentStates] = useState<MemoryState[]>([]);
  const [pastStates, setPastStates] = useState<MemoryState[]>([]);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [latestAnalysis, setLatestAnalysis] = useState<{ summary: string; visual_description?: string; eventCount: number; stateCount: number; analyzedAt: string } | null>(null);

  // ── Screen capture state ───────────────────────────────────────────────────
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [chunkSecs, setChunkSecs] = useState(DEFAULT_CHUNK_MINUTES * 60); // countdown
  const [totalElapsed, setTotalElapsed] = useState(0);
  const [chunkCount, setChunkCount] = useState(0);
  const [chunkMinutes, setChunkMinutes] = useState(DEFAULT_CHUNK_MINUTES);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'analyzing' | 'done' | 'error'>('idle');
  const [uploadMsg, setUploadMsg] = useState('');

  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionId = useRef(`session_${Date.now()}`);

  // ── Ingest state ───────────────────────────────────────────────────────────
  const [ingestType, setIngestType] = useState<'event' | 'state'>('event');
  const [ingestForm, setIngestForm] = useState({ actor: 'User', action: 'SAID', object: '', raw_content: '', attribute: 'WORKS_AT', value: '' });
  const [ingestResult, setIngestResult] = useState<string | null>(null);

  // ─── Polling ─────────────────────────────────────────────────────────────────

  const fetchStatus = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/memory/status`, { headers: getDeviceHeaders() });
      const d = await r.json();
      setNeo4jOk(d.neo4j?.connected ?? false);
      setStats(d.stats ?? stats);
      setLog(d.recentLog ?? []);
      if (d.currentStates) setCurrentStates(d.currentStates);
      if (d.latestAnalysis) setLatestAnalysis(d.latestAnalysis);
    } catch (_) {}
  }, []);

  const fetchTimeline = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/memory/timeline?days=7`, { headers: getDeviceHeaders() });
      const d = await r.json();
      setTimeline(d.events ?? []);
    } catch (_) {}
  }, []);

  const fetchStates = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/memory/states`, { headers: getDeviceHeaders() });
      const d = await r.json();
      setCurrentStates(d.current ?? []);
      setPastStates(d.past ?? []);
    } catch (_) {}
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchTimeline();
    const poll = setInterval(fetchStatus, 8000);
    return () => clearInterval(poll);
  }, [fetchStatus, fetchTimeline]);

  useEffect(() => {
    if (activeTab === 'states') fetchStates();
    if (activeTab === 'book') fetchTimeline();
  }, [activeTab]);

  // ─── Screen Capture ───────────────────────────────────────────────────────────

  const sendChunk = useCallback(async () => {
    if (chunksRef.current.length === 0) return;

    // Send valid browser stream buffer; backend converts to pristine H.264 MP4 before saving
    const blob = new Blob(chunksRef.current, { type: 'video/webm' });
    chunksRef.current = [];
    const filename = `screen_${Date.now()}.webm`;

    setUploadStatus('uploading');
    setUploadMsg(`Uploading ${(blob.size / 1024 / 1024).toFixed(1)} MB stream to backend for MP4 packaging…`);

    try {
      const formData = new FormData();
      formData.append('chunk', blob, filename);
      formData.append('duration_minutes', String(chunkMinutes));
      formData.append('session_id', sessionId.current);
      formData.append('chunk_timestamp', new Date().toISOString());

      setUploadStatus('analyzing');
      setUploadMsg('Packaging into MP4 & uploading to Supabase. Qwen3-VL is analyzing visual context & events…');

      const r = await fetch(`${API}/api/memory/agent/chunk`, { method: 'POST', headers: getDeviceHeaders(), body: formData });
      const d = await r.json();

      if (d.ok) {
        setChunkCount(c => c + 1);
        setLatestAnalysis({ ...d.analysis, analyzedAt: new Date().toISOString() });
        setUploadStatus('done');
        setUploadMsg(`✓ Saved MP4 & stored ${d.analysis.storedCount} records — "${(d.analysis.summary || '').slice(0, 80)}"`);
        await fetchStatus();
        await fetchTimeline();
      } else {
        throw new Error(d.error || 'Unknown error');
      }
    } catch (err: unknown) {
      setUploadStatus('error');
      setUploadMsg(`✗ ${err instanceof Error ? err.message : 'Upload failed'}`);
    }

    // Reset status after 5s
    setTimeout(() => { setUploadStatus('idle'); setUploadMsg(''); }, 5000);
  }, [chunkMinutes, fetchStatus, fetchTimeline]);

  const startCapture = async () => {
    setCaptureError(null);
    try {
      const stream = await (navigator.mediaDevices as MediaDevices & {
        getDisplayMedia(opts: object): Promise<MediaStream>;
      }).getDisplayMedia({
        video: { frameRate: { ideal: 5, max: 10 }, width: { ideal: 1280 } },
        audio: true,
      });

      streamRef.current = stream;
      setIsCapturing(true);

      // Show live preview
      if (previewVideoRef.current) {
        previewVideoRef.current.srcObject = stream;
        previewVideoRef.current.play().catch(() => {});
      }

      // Setup MediaRecorder using reliable streaming format
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
        ? 'video/webm;codecs=vp8,opus'
        : MediaRecorder.isTypeSupported('video/webm')
        ? 'video/webm'
        : '';

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.start(1000); // collect 1-second data chunks

      // Notify backend
      await fetch(`${API}/api/memory/start`, { method: 'POST' });

      // Countdown timer
      let secsLeft = chunkMinutes * 60;
      setChunkSecs(secsLeft);
      setTotalElapsed(0);

      countdownRef.current = setInterval(async () => {
        secsLeft -= 1;
        setChunkSecs(secsLeft);
        setTotalElapsed(t => t + 1);

        if (secsLeft <= 0) {
          // Time to send the chunk
          secsLeft = chunkMinutes * 60;
          setChunkSecs(secsLeft);
          await sendChunk();
        }
      }, 1000);

      // Handle user stopping screen share from browser UI
      stream.getVideoTracks()[0].addEventListener('ended', stopCapture);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Permission denied';
      setCaptureError(msg);
      console.error('[Capture] Error:', msg);
    }
  };

  const stopCapture = useCallback(async () => {
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
    if (recorderRef.current) { recorderRef.current.stop(); recorderRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (previewVideoRef.current) { previewVideoRef.current.srcObject = null; }

    setIsCapturing(false);
    setChunkSecs(chunkMinutes * 60);

    await fetch(`${API}/api/memory/stop`, { method: 'POST' });
  }, [chunkMinutes]);

  // Send final chunk when stopping
  const handleStopClick = async () => {
    if (chunksRef.current.length > 0) await sendChunk();
    await stopCapture();
  };

  const runIngest = async () => {
    setIngestResult(null);
    const body = ingestType === 'event'
      ? { type: 'event', actor: ingestForm.actor, action: ingestForm.action, object: ingestForm.object, raw_content: ingestForm.raw_content || `${ingestForm.actor} ${ingestForm.action} ${ingestForm.object}`, source: 'manual', topic_tags: [] }
      : { type: 'state', entity_name: 'User', attribute: ingestForm.attribute, value: ingestForm.value };
    try {
      const r = await fetch(`${API}/api/memory/ingest`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...getDeviceHeaders() }, body: JSON.stringify(body) });
      const d = await r.json();
      setIngestResult(d.ok ? '✓ Stored' : '✗ ' + d.error);
      await fetchStatus();
    } catch { setIngestResult('✗ Network error'); }
  };

  // ─── Styles ──────────────────────────────────────────────────────────────────

  const S = {
    root: { display: 'flex', flexDirection: 'column' as const, height: '100%', background: '#0f0e1a', color: '#e2e8f0', fontFamily: 'inherit', fontSize: '12px', overflow: 'hidden' },
    header: { padding: '10px 16px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 },
    topRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' },
    tabs: { display: 'flex', gap: '2px', marginBottom: '-1px' },
    tab: (a: boolean) => ({ padding: '6px 12px', fontSize: '11px', fontWeight: 600, border: 'none', borderRadius: '6px 6px 0 0', cursor: 'pointer', background: a ? '#1e1d2e' : 'transparent', color: a ? '#c084fc' : '#64748b', borderBottom: a ? '2px solid #c084fc' : '2px solid transparent', transition: 'all 0.15s' }),
    body: { flex: 1, overflowY: 'auto' as const, padding: '14px 16px', display: 'flex', flexDirection: 'column' as const, gap: '10px' },
    card: (color = 'rgba(255,255,255,0.04)') => ({ background: color, border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: '12px 14px' }),
    input: { flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#e2e8f0', padding: '7px 11px', fontSize: '12px', outline: 'none' },
    btn: (r: string, g: string, b: string) => ({ padding: '8px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: 700, background: `rgba(${r},${g},${b},0.18)`, color: `rgb(${r},${g},${b})`, boxShadow: `0 0 0 1px rgba(${r},${g},${b},0.3)` }),
    label: { fontSize: '9px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: '0.06em' },
    eventRow: { padding: '8px 10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)', display: 'flex', flexDirection: 'column' as const, gap: '4px' },
    select: { background: '#1e1d2e', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', color: '#f8fafc', padding: '5px 8px', fontSize: '11px', colorScheme: 'dark' as const },
  };

  // Progress bar color for countdown
  const pct = (chunkMinutes * 60 - chunkSecs) / (chunkMinutes * 60);
  const progressColor = pct > 0.8 ? '#fb923c' : pct > 0.5 ? '#facc15' : '#34d399';

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={S.root}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={S.header}>
        <div style={S.topRow}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700, color: '#c084fc' }}>
              <BookOpen size={16} /> Memory Book
            </span>
            {isCapturing && <LiveDot />}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: '10px', color: '#94a3b8' }}>
              <span style={{ display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%', background: neo4jOk ? '#34d399' : '#f87171', marginRight: '5px' }} />
              {neo4jOk ? 'Neo4j' : 'Offline'}
            </span>
          </div>
        </div>
        <div style={S.tabs}>
          {([
            ['capture', 'Capture', <Video size={13} key="v" />],
            ['book', 'Timeline', <Calendar size={13} key="c" />],
            ['states', 'States', <Activity size={13} key="a" />]
          ] as const).map(([id, label, icon]) => (
            <button key={id} style={{ ...S.tab(activeTab === id), display: 'inline-flex', alignItems: 'center', gap: '6px' }} onClick={() => setActiveTab(id as any)}>
              {icon}
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div style={S.body}>

        {/* ═══ TAB: Capture ═══════════════════════════════════════════════ */}
        {activeTab === 'capture' && (
          <>
            {/* Main capture card */}
            <div style={{ ...S.card(), border: isCapturing ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(255,255,255,0.07)' }}>

              {/* Live preview */}
              <div style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', background: '#000', marginBottom: '12px', minHeight: isCapturing ? '140px' : '0px', transition: 'min-height 0.3s' }}>
                <video
                  ref={previewVideoRef}
                  autoPlay
                  muted
                  playsInline
                  style={{ width: '100%', display: isCapturing ? 'block' : 'none', borderRadius: '8px' }}
                />
                {isCapturing && (
                  <div style={{ position: 'absolute', top: '8px', left: '8px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <LiveDot />
                    <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.7)', background: 'rgba(0,0,0,0.5)', padding: '2px 6px', borderRadius: '4px' }}>
                      {fmtDuration(totalElapsed)} total
                    </span>
                  </div>
                )}
              </div>

              {/* Countdown timer */}
              {isCapturing && (
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#64748b', marginBottom: '5px' }}>
                    <span style={{ fontWeight: 700, color: '#94a3b8' }}>Next Qwen3-VL analysis in</span>
                    <span style={{ fontWeight: 800, color: progressColor }}>{fmtDuration(chunkSecs)}</span>
                  </div>
                  <div style={{ height: '5px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: '4px', background: progressColor, width: `${pct * 100}%`, transition: 'width 1s linear, background 0.5s' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#475569', marginTop: '3px' }}>
                    <span>{chunkCount} chunk{chunkCount !== 1 ? 's' : ''} analyzed</span>
                    <span>{chunkMinutes}min interval</span>
                  </div>
                </div>
              )}

              {/* Controls */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {!isCapturing ? (
                  <>
                    <button style={S.btn('52', '211', '153')} onClick={startCapture}>
                      ● Start Screen Capture
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
                      <span style={{ fontSize: '10px', color: '#64748b' }}>Interval:</span>
                      <select style={S.select} value={chunkMinutes} onChange={e => setChunkMinutes(Number(e.target.value))}>
                        <option value={1} style={{ background: '#1e1d2e', color: '#f8fafc' }}>1 min (demo)</option>
                        <option value={5} style={{ background: '#1e1d2e', color: '#f8fafc' }}>5 min</option>
                        <option value={10} style={{ background: '#1e1d2e', color: '#f8fafc' }}>10 min</option>
                        <option value={15} style={{ background: '#1e1d2e', color: '#f8fafc' }}>15 min</option>
                        <option value={30} style={{ background: '#1e1d2e', color: '#f8fafc' }}>30 min</option>
                      </select>
                    </div>
                  </>
                ) : (
                  <>
                    <button style={{ ...S.btn('239', '68', '68'), display: 'inline-flex', alignItems: 'center', gap: '5px' }} onClick={handleStopClick}>
                      Stop & Save
                    </button>
                    <button
                      style={{ ...S.btn('167', '139', '250'), display: 'inline-flex', alignItems: 'center', gap: '5px', opacity: uploadStatus === 'uploading' || uploadStatus === 'analyzing' ? 0.5 : 1 }}
                      onClick={sendChunk}
                      disabled={uploadStatus === 'uploading' || uploadStatus === 'analyzing'}
                    >
                      <Upload size={11} /> Send Now
                    </button>
                  </>
                )}
              </div>

              {captureError && (
                <div style={{ marginTop: '10px', fontSize: '10px', color: '#f87171', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', padding: '8px 10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertCircle size={13} /> {captureError}
                </div>
              )}
            </div>

            {/* Upload / Analysis status */}
            {uploadMsg && (
              <div style={{
                ...S.card(),
                border: `1px solid ${uploadStatus === 'done' ? 'rgba(52,211,153,0.3)' : uploadStatus === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(167,139,250,0.3)'}`,
                fontSize: '11px',
                color: uploadStatus === 'done' ? '#34d399' : uploadStatus === 'error' ? '#f87171' : '#c084fc',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>
                    {uploadStatus === 'uploading' ? <Upload size={16} /> : uploadStatus === 'analyzing' ? <Activity size={16} /> : uploadStatus === 'done' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  </span>
                  <div>
                    <div style={{ fontWeight: 700 }}>
                      {uploadStatus === 'uploading' ? 'Uploading to Supabase…' : uploadStatus === 'analyzing' ? 'Qwen3-VL-Flash Analyzing…' : uploadMsg}
                    </div>
                    {(uploadStatus === 'uploading' || uploadStatus === 'analyzing') && (
                      <div style={{ fontSize: '9px', color: '#64748b', marginTop: '2px' }}>
                        {uploadStatus === 'uploading' ? 'Sending to Supabase Storage bucket "qwen"' : 'Model: qwen3-vl-flash → extracting events and states'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Latest Qwen analysis */}
            {latestAnalysis && (
              <div style={{ ...S.card('rgba(167,139,250,0.04)'), border: '1px solid rgba(167,139,250,0.2)' }}>
                <div style={{ ...S.label, marginBottom: '8px', color: '#a78bfa', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Activity size={13} /> Latest Qwen3-VL-Flash Analysis (MP4 Stream)
                </div>
                {latestAnalysis.visual_description && (
                  <div style={{ marginBottom: '10px', background: 'rgba(0,0,0,0.25)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(167,139,250,0.15)' }}>
                    <div style={{ fontSize: '9.5px', fontWeight: 800, color: '#c084fc', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Eye size={12} /> What LLM Sees on Screen (Visual Context)
                    </div>
                    <div style={{ fontSize: '11px', color: '#e2e8f0', lineHeight: '1.5' }}>{latestAnalysis.visual_description}</div>
                  </div>
                )}
                <div style={{ display: 'flex', gap: '12px', fontSize: '10px', color: '#64748b' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Package size={11} /> {latestAnalysis.eventCount ?? 0} events stored</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Zap size={11} /> {latestAnalysis.stateCount ?? 0} states updated</span>
                  {latestAnalysis.analyzedAt && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Clock size={11} /> {fmtTime(latestAnalysis.analyzedAt)}</span>}
                </div>
              </div>
            )}

            {/* Ingestion log */}
            {log.length > 0 && (
              <div>
                <div style={{ ...S.label, marginBottom: '6px' }}>Live Ingestion Log</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', maxHeight: '120px', overflowY: 'auto' }}>
                  {log.slice(0, 15).map((l, i) => (
                    <div key={i} style={{ fontSize: '10px', color: '#64748b', display: 'flex', gap: '6px', fontFamily: 'monospace' }}>
                      <span style={{ color: '#334155' }}>{fmtTime(l.ts)}</span>
                      <span style={{ color: l.type === 'error' ? '#f87171' : l.type === 'chunk_received' ? '#fb923c' : l.type === 'uploaded' ? '#34d399' : '#94a3b8' }}>
                        {l.type === 'event' ? `EVENT ${l.action} ${l.object}` :
                          l.type === 'state' ? `STATE ${l.attribute} = ${l.value}` :
                          l.type === 'chunk_received' ? `CHUNK received ${l.size_mb}MB` :
                          l.type === 'uploaded' ? `UPLOADED to Supabase` :
                          l.type === 'error' ? `ERROR ${l.message}` : l.type}
                      </span>
                      {l.tier && <TierBadge tier={l.tier} />}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Manual ingest section */}
            <div>
              <div style={{ ...S.label, marginBottom: '8px' }}>Manual Ingest</div>
              <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                <select style={S.select} value={ingestType} onChange={e => setIngestType(e.target.value as 'event' | 'state')}>
                  <option value="event" style={{ background: '#1e1d2e', color: '#f8fafc' }}>Event</option>
                  <option value="state" style={{ background: '#1e1d2e', color: '#f8fafc' }}>State</option>
                </select>
              </div>
              {ingestType === 'event' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {[['actor', 'Actor', 'User'], ['action', 'Action', 'OPENED'], ['object', 'Object', 'Docker']].map(([k, lbl, ph]) => (
                    <div key={k} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <span style={{ width: '55px', fontSize: '10px', color: '#64748b', flexShrink: 0 }}>{lbl}</span>
                      <input style={S.input} placeholder={ph} value={(ingestForm as Record<string, string>)[k]} onChange={e => setIngestForm(p => ({ ...p, [k]: e.target.value }))} />
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {[['attribute', 'Attribute', 'WORKS_AT'], ['value', 'Value', 'Company B']].map(([k, lbl, ph]) => (
                    <div key={k} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <span style={{ width: '55px', fontSize: '10px', color: '#64748b', flexShrink: 0 }}>{lbl}</span>
                      <input style={S.input} placeholder={ph} value={(ingestForm as Record<string, string>)[k]} onChange={e => setIngestForm(p => ({ ...p, [k]: e.target.value }))} />
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center' }}>
                <button style={{ ...S.btn('167', '139', '250'), display: 'inline-flex', alignItems: 'center', gap: '5px' }} onClick={runIngest}>
                  <Upload size={11} /> Ingest
                </button>
                {ingestResult && <span style={{ fontSize: '10px', color: ingestResult.startsWith('✓') ? '#34d399' : '#f87171' }}>{ingestResult}</span>}
              </div>
            </div>
          </>
        )}

        {/* ═══ TAB: Timeline ══════════════════════════════════════════════ */}
        {activeTab === 'book' && (
          <>
            <div style={S.label}>Event Timeline (Last 7 Days)</div>
            {timeline.length === 0 ? (
              <div style={{ color: '#475569', textAlign: 'center', padding: '24px', fontSize: '11px' }}>No events yet. Start the capture agent.</div>
            ) : (
              timeline.map((ev) => (
                <div key={ev.id} style={S.eventRow}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 700, color: '#cbd5e1' }}>{ev.actor} · {ev.action}</span>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <TierBadge tier={ev.tier} />
                      <span style={{ fontSize: '9px', color: '#475569' }}>{fmtDate(ev.timestamp)} {fmtTime(ev.timestamp)}</span>
                    </div>
                  </div>
                  <div style={{ color: '#94a3b8' }}>{ev.object}</div>
                  {ev.raw_content && <div style={{ color: '#64748b', fontSize: '10px', fontStyle: 'italic' }}>{ev.raw_content.slice(0, 130)}{ev.raw_content.length > 130 ? '…' : ''}</div>}
                  {ev.topic_tags?.length > 0 && (
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {ev.topic_tags.map((t, i) => <span key={i} style={{ fontSize: '9px', color: '#818cf8', background: 'rgba(129,140,248,0.1)', borderRadius: '3px', padding: '1px 5px' }}>{t}</span>)}
                    </div>
                  )}
                </div>
              ))
            )}
          </>
        )}

        {/* ═══ TAB: States ════════════════════════════════════════════════ */}
        {activeTab === 'states' && (
          <>
            <div style={S.label}>Current States (present = true)</div>
            {currentStates.length === 0
              ? <div style={{ color: '#475569', textAlign: 'center', padding: '16px', fontSize: '11px' }}>No active states.</div>
              : currentStates.map(s => (
                <div key={s.id} style={{ ...S.eventRow, border: '1px solid rgba(167,139,250,0.2)', background: 'rgba(167,139,250,0.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 700, color: '#c084fc' }}>{s.attribute}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: '9px', background: 'rgba(52,211,153,0.12)', color: '#34d399', borderRadius: '4px', padding: '1px 6px', fontWeight: 700 }}>
                      <Zap size={10} style={{ marginRight: 3 }} /> PRESENT
                    </span>
                  </div>
                  <div style={{ color: '#e2e8f0', fontWeight: 600 }}>{s.value}</div>
                  <div style={{ color: '#475569', fontSize: '10px' }}>Since {fmtDate(s.valid_from)} {fmtTime(s.valid_from)}</div>
                </div>
              ))
            }

            <div style={{ ...S.label, marginTop: '8px' }}>Past States (present = false)</div>
            {pastStates.length === 0
              ? <div style={{ color: '#475569', textAlign: 'center', padding: '16px', fontSize: '11px' }}>No historical states.</div>
              : pastStates.map(s => (
                <div key={s.id} style={S.eventRow}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 600, color: '#64748b' }}>{s.attribute}</span>
                    <span style={{ fontSize: '9px', color: '#475569' }}>PAST</span>
                  </div>
                  <div style={{ color: '#94a3b8' }}>{s.value}</div>
                  <div style={{ color: '#475569', fontSize: '10px' }}>{fmtDate(s.valid_from)} → {s.valid_to ? fmtDate(s.valid_to) : '?'}</div>
                </div>
              ))
            }
          </>
        )}

      </div>
    </div>
  );
}
