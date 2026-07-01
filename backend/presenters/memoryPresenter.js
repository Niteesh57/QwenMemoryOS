// ═══════════════════════════════════════════════════════════════════════
//  memoryPresenter.js — HTTP handler layer for the Memory API
// ═══════════════════════════════════════════════════════════════════════

import { testConnection } from '../services/neo4jService.js';
import {
  ingestEvent,
  ingestState,
  retrieveCandidates,
  retrieveCurrentStates,
  retrievePastStates,
  lateFilter,
  runTierAging,
  getMemoryStats,
  getTimelineEvents,
} from '../services/eventMemoryService.js';
import { uploadVideoChunk, deleteVideoChunk } from '../services/supabaseService.js';
import { analyzeAndStore } from '../services/screenAnalysisService.js';
import { convertToMp4 } from '../services/videoConversionService.js';

// ─── Shared agent state ───────────────────────────────────────────────────────
let agentRunning = false;
let agentInterval = null;
const ingestionLog = [];
let latestAnalysis = null; // stores the most recent Qwen3-VL result

function addToLog(entry) {
  ingestionLog.unshift({ ...entry, ts: new Date().toISOString() });
  if (ingestionLog.length > 50) ingestionLog.pop();
}

// ─── POST /api/memory/start ───────────────────────────────────────────────────

export async function handleMemoryStart(req, res) {
  if (agentRunning) {
    return res.json({ ok: true, message: 'Storage agent already running.' });
  }
  agentRunning = true;
  console.log('[MemoryAgent] Agent state set to RUNNING (screen capture driven by frontend)');
  res.json({ ok: true, message: 'Storage agent started. Awaiting screen capture chunks.' });
}

// ─── POST /api/memory/stop ────────────────────────────────────────────────────

export async function handleMemoryStop(req, res) {
  if (!agentRunning) {
    return res.json({ ok: true, message: 'Agent was not running.' });
  }
  clearInterval(agentInterval);
  agentInterval = null;
  agentRunning = false;
  console.log('[MemoryAgent] Agent STOPPED');
  res.json({ ok: true, message: 'Storage agent stopped.' });
}

// ─── GET /api/memory/status ───────────────────────────────────────────────────

export async function handleMemoryStatus(req, res) {
  try {
    // Automatically execute tier aging in background when checking status
    runTierAging().catch(() => {});

    const [connection, stats, states] = await Promise.all([
      testConnection(),
      getMemoryStats(),
      retrieveCurrentStates(),
    ]);
    res.json({
      agentRunning,
      neo4j: connection,
      stats,
      currentStates: states,
      recentLog: ingestionLog.slice(0, 20),
      latestAnalysis,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ─── POST /api/memory/agent/chunk — Core screen recording handler ─────────────
// Receives a raw video blob from frontend, converts to MP4,
// uploads to Supabase, calls Qwen3-VL-Flash for analysis, stores in Neo4j.

export async function handleAgentChunk(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video file in request. Expected multipart field "chunk".' });
    }

    const rawBuffer = req.file.buffer;
    const originalName = req.file.originalname || `screen_${Date.now()}.webm`;
    const durationMinutes = parseFloat(req.body?.duration_minutes) || 10;
    const sessionId = req.body?.session_id || `session_${Date.now()}`;
    const chunkTimestamp = req.body?.chunk_timestamp || new Date().toISOString();

    console.log(`\n[MemoryAgent] Received chunk: ${originalName} (${(rawBuffer.length / 1024 / 1024).toFixed(1)} MB)`);
    addToLog({ type: 'chunk_received', filename: originalName, size_mb: (rawBuffer.length / 1024 / 1024).toFixed(1) });

    // ── 1. Convert to universal MP4 format ─────────────────────────────
    let mp4File;
    try {
      mp4File = await convertToMp4(rawBuffer, originalName);
    } catch (convErr) {
      console.warn('[VideoConvert] Fallback to raw buffer upload:', convErr.message);
      mp4File = { buffer: rawBuffer, filename: originalName.replace(/\.[^/.]+$/, '') + '.mp4', contentType: 'video/mp4' };
    }

    // ── 2. Upload to Supabase in MP4 format ────────────────────────────
    const videoUrl = await uploadVideoChunk(mp4File.buffer, mp4File.filename, mp4File.contentType);
    addToLog({ type: 'uploaded', url: videoUrl });

    // ── 3. Analyze with Qwen3-VL-Flash + Store in Neo4j ───────────────
    let analysis;
    try {
      analysis = await analyzeAndStore(videoUrl, {
        durationMinutes,
        sessionId,
        chunkTimestamp,
      });
    } finally {
      // Always delete video from Supabase after analysis (success or error)
      if (mp4File?.filename) {
        deleteVideoChunk(mp4File.filename)
          .then(() => console.log(`[Supabase] Deleted chunk after analysis → ${mp4File.filename}`))
          .catch(delErr => console.warn('[Supabase] Failed to delete chunk:', delErr.message));
      }
    }

    latestAnalysis = {
      ...analysis,
      analyzedAt: new Date().toISOString(),
      filename: mp4File.filename,
    };

    if (analysis.visual_description) {
      addToLog({ type: 'event', action: 'VISUAL_SNAPSHOT', object: 'Session visual context recorded', tier: 'hot' });
    }
    for (const ev of analysis.events) {
      addToLog({ type: 'event', action: ev.action, object: ev.object, tier: 'hot' });
    }
    for (const st of analysis.states) {
      addToLog({ type: 'state', attribute: st.attribute, value: st.value });
    }

    // Run tier aging automatically after chunk processing
    runTierAging().catch(() => {});

    res.json({
      ok: true,
      videoUrl,
      analysis: {
        summary: analysis.summary,
        visual_description: analysis.visual_description,
        eventCount: analysis.events.length,
        stateCount: analysis.states.length,
        storedCount: analysis.storedCount,
      },
    });
  } catch (err) {
    console.error('[MemoryAgent] Chunk processing error:', err.message);
    addToLog({ type: 'error', message: err.message });
    res.status(500).json({ error: err.message });
  }
}

// ─── GET /api/memory/analysis/latest ─────────────────────────────────────────

export async function handleLatestAnalysis(req, res) {
  res.json({ analysis: latestAnalysis });
}

// ─── POST /api/memory/ingest ──────────────────────────────────────────────────

export async function handleMemoryIngest(req, res) {
  try {
    const { type, ...data } = req.body;
    if (!type || !['event', 'state'].includes(type)) {
      return res.status(400).json({ error: 'body.type must be "event" or "state"' });
    }
    let stored;
    if (type === 'event') {
      stored = await ingestEvent(data);
      addToLog({ type: 'event', action: stored.action, object: stored.object, tier: stored.tier });
    } else {
      stored = await ingestState(data);
      addToLog({ type: 'state', attribute: stored.attribute, value: stored.value });
    }
    res.json({ ok: true, stored });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ─── POST /api/memory/query ───────────────────────────────────────────────────

export async function handleMemoryQuery(req, res) {
  try {
    const { query, topic_tags = [], top_k = 10 } = req.body;
    if (!query) return res.status(400).json({ error: 'body.query is required' });

    const candidates = await retrieveCandidates(query, topic_tags, 40);
    const filtered = lateFilter(candidates, query, top_k);
    const currentStates = await retrieveCurrentStates();

    res.json({ query, candidateCount: candidates.length, filteredCount: filtered.length, events: filtered, currentStates });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ─── GET /api/memory/timeline ─────────────────────────────────────────────────

export async function handleMemoryTimeline(req, res) {
  try {
    const days = parseInt(req.query.days) || 7;
    const events = await getTimelineEvents(days);
    res.json({ events, count: events.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ─── GET /api/memory/states ───────────────────────────────────────────────────

export async function handleMemoryStates(req, res) {
  try {
    const [current, past] = await Promise.all([retrieveCurrentStates(), retrievePastStates()]);
    res.json({ current, past });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ─── POST /api/memory/maintenance ────────────────────────────────────────────

export async function handleMemoryMaintenance(req, res) {
  try {
    const result = await runTierAging();
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
