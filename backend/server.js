import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import "./env.js";
import { handleAskRequest, handleAskVisualRequest } from "./presenters/askPresenter.js";
import { handleSseConnection, handlePostMessage } from "./presenters/mcpPresenter.js";
import { handleClarifyRequest } from "./presenters/clarifyPresenter.js";
import { handleGetVoices, handleSpeakStream } from "./presenters/ttsPresenter.js";
import {
  handleMemoryStart,
  handleMemoryStop,
  handleMemoryStatus,
  handleMemoryIngest,
  handleMemoryQuery,
  handleMemoryTimeline,
  handleMemoryStates,
  handleMemoryMaintenance,
  handleAgentChunk,
  handleLatestAnalysis,
} from "./presenters/memoryPresenter.js";
import { bootstrapSchema } from "./services/neo4jService.js";
import { generateOtp, verifyOtp } from "./services/deviceAuthService.js";

// ═══════════════════════════════════════════════════════════════════════
//  MULTER — Video chunk uploads (in-memory, up to 500 MB)
// ═══════════════════════════════════════════════════════════════════════

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB
});

// ═══════════════════════════════════════════════════════════════════════
//  EXPRESS APP SETUP
// ═══════════════════════════════════════════════════════════════════════

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use('/static', express.static(path.join(__dirname, 'public/static')));

// Device ID extraction middleware
app.use((req, res, next) => {
  req.deviceId = req.headers['x-device-id'] || req.query.deviceId || req.body?.deviceId || 'DEV-DEFAULT';
  next();
});

// ─── MCP Routes ────────────────────────────────────────────────────────
app.get("/sse", handleSseConnection);
app.post("/messages", handlePostMessage);

// ─── Main Ask API ──────────────────────────────────────────────────────
app.post("/api/ask", handleAskRequest);
app.post("/api/ask/visual", upload.single("visual_chunk"), handleAskVisualRequest);
app.post("/api/clarify", handleClarifyRequest);

// ─── Device ID & 2-Minute OTP Pairing APIs ─────────────────────────────
app.post("/api/device/otp/generate", (req, res) => {
  try {
    const deviceId = req.headers['x-device-id'] || req.body.deviceId;
    const deviceName = req.headers['x-device-name'] || req.body.deviceName;
    const result = generateOtp(deviceId, deviceName);
    res.json(result);
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

app.post("/api/device/otp/verify", (req, res) => {
  try {
    const { otp, targetDevice } = req.body;
    const result = verifyOtp(otp, targetDevice);
    res.json(result);
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// ─── Edge TTS Cloud Voice APIs ─────────────────────────────────────────
app.get("/api/tts/voices", handleGetVoices);
app.get("/api/tts/speak", handleSpeakStream);

// ─── Event-Native Memory System (Neo4j Aura) ───────────────────────────
app.post("/api/memory/start",          handleMemoryStart);
app.post("/api/memory/stop",           handleMemoryStop);
app.get( "/api/memory/status",         handleMemoryStatus);
app.post("/api/memory/ingest",         handleMemoryIngest);
app.post("/api/memory/query",          handleMemoryQuery);
app.get( "/api/memory/timeline",       handleMemoryTimeline);
app.get( "/api/memory/states",         handleMemoryStates);
app.post("/api/memory/maintenance",    handleMemoryMaintenance);
app.get( "/api/memory/analysis/latest", handleLatestAnalysis);

// Screen recording chunk endpoint — multipart/form-data with "chunk" file field
app.post("/api/memory/agent/chunk", upload.single("chunk"), handleAgentChunk);

// ═══════════════════════════════════════════════════════════════════════
//  BOOTSTRAP
// ═══════════════════════════════════════════════════════════════════════

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`\n${"═".repeat(62)}`);
  console.log(`  Qwen Memory OS LangGraph Server  v4.0`);
  console.log(`  MCP     ▶  http://localhost:${PORT}/sse`);
  console.log(`  API     ▶  http://localhost:${PORT}/api/ask`);
  console.log(`  Memory  ▶  http://localhost:${PORT}/api/memory/status`);
  console.log(`  Chunk   ▶  POST /api/memory/agent/chunk`);
  console.log(`${"═".repeat(62)}\n`);

  bootstrapSchema().catch((err) => {
    console.warn("[Neo4j] Schema bootstrap failed:", err.message);
  });
});
