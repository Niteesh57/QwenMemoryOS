import express from "express";
import cors from "cors";
import "dotenv/config";
import { handleAskRequest } from "./presenters/askPresenter.js";
import { handleSseConnection, handlePostMessage } from "./presenters/mcpPresenter.js";

// ═══════════════════════════════════════════════════════════════════════
//  EXPRESS APP SETUP
// ═══════════════════════════════════════════════════════════════════════

const app = express();
app.use(cors());
app.use(express.json());

// ─── MCP Routes ────────────────────────────────────────────────────────
app.get("/sse", handleSseConnection);
app.post("/messages", handlePostMessage);

// ─── Main Ask API ──────────────────────────────────────────────────────
app.post("/api/ask", handleAskRequest);

// ═══════════════════════════════════════════════════════════════════════
//  BOOTSTRAP
// ═══════════════════════════════════════════════════════════════════════

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n${"═".repeat(54)}`);
  console.log(`  QwenOS LangGraph Server (MVP)  v2.0`);
  console.log(`  MCP  ▶  http://localhost:${PORT}/sse`);
  console.log(`  API  ▶  http://localhost:${PORT}/api/ask`);
  console.log(`${"═".repeat(54)}\n`);
});
