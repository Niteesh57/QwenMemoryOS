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
  const [activeTab, setActiveTab] = useState<'book' | 'states' | 'ingest'>('book');

  // ── Neo4j / backend state ──────────────────────────────────────────────────
  const [neo4jOk, setNeo4jOk] = useState(false);
  const [agentRunning, setAgentRunning] = useState(false);
  const [stats, setStats] = useState<MemoryStats>({ hot: 0, warm: 0, cold: 0, activeStates: 0, pastStates: 0 });
  const [timeline, setTimeline] = useState<MemoryEvent[]>([]);
  const [timelinePage, setTimelinePage] = useState(1);
  const [currentStates, setCurrentStates] = useState<MemoryState[]>([]);
  const [pastStates, setPastStates] = useState<MemoryState[]>([]);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [latestAnalysis, setLatestAnalysis] = useState<{ summary: string; visual_description?: string; eventCount: number; stateCount: number; analyzedAt: string } | null>(null);

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
      setAgentRunning(d.agentRunning ?? false);
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
            {agentRunning && <LiveDot />}
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
            ['book', 'Timeline', <Calendar size={13} key="c" />],
            ['states', 'States', <Activity size={13} key="a" />],
            ['ingest', 'Ingest Tool', <Upload size={13} key="u" />]
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

        {/* ═══ TAB: Ingest Tool ═══════════════════════════════════════════ */}
        {activeTab === 'ingest' && (
          <>




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
        {activeTab === 'book' && (() => {
          const videoEvents = timeline.filter(ev => ev.action !== 'ANALYSIS_FAILED' && ev.action !== 'VISUAL_SNAPSHOT' && ev.action !== 'SCREEN_ANALYZED' && ev.actor !== 'System' && ev.actor !== 'Qwen-VL');
          const totalPages = Math.max(1, Math.ceil(videoEvents.length / 10));
          const paginated = videoEvents.slice((timelinePage - 1) * 10, timelinePage * 10);

          return (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={S.label}>Event Timeline (Last 7 Days)</div>
                <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                  Total Video Events: {videoEvents.length}
                </span>
              </div>
              {videoEvents.length === 0 ? (
                <div style={{ color: '#475569', textAlign: 'center', padding: '24px', fontSize: '11px' }}>No video events yet. Start the capture agent.</div>
              ) : (
                <>
                  {paginated.map((ev) => (
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
                  ))}
                  {totalPages > 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 4px', marginTop: '4px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                        Showing {(timelinePage - 1) * 10 + 1} - {Math.min(timelinePage * 10, videoEvents.length)} of {videoEvents.length}
                      </span>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <button
                          disabled={timelinePage <= 1}
                          onClick={() => setTimelinePage(p => Math.max(1, p - 1))}
                          style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: timelinePage <= 1 ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.08)', color: timelinePage <= 1 ? '#475569' : '#f8fafc', cursor: timelinePage <= 1 ? 'not-allowed' : 'pointer', fontSize: '10px' }}
                        >
                          Prev
                        </button>
                        <span style={{ fontSize: '10px', color: '#c084fc', fontWeight: 700 }}>
                          Page {timelinePage} / {totalPages}
                        </span>
                        <button
                          disabled={timelinePage >= totalPages}
                          onClick={() => setTimelinePage(p => Math.min(totalPages, p + 1))}
                          style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: timelinePage >= totalPages ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.08)', color: timelinePage >= totalPages ? '#475569' : '#f8fafc', cursor: timelinePage >= totalPages ? 'not-allowed' : 'pointer', fontSize: '10px' }}
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          );
        })()}

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
