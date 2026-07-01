import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";
import { openai, MODEL_NAME } from "../models/clients.js";
import { renderHtmlResult, renderNotFound } from "../views/htmlView.js";

const resultStorage = new Map();
const transports = {};

/**
 * Creates the McpServer instance with registered tools and resources.
 * 
 * @returns {McpServer}
 */
export const createMcpServer = () => {
  const server = new McpServer({ name: "Qwen-Memory-OS-Server", version: "2.0.0" });

  server.resource(
    "qwen-result",
    new ResourceTemplate("ui://qwen-memory-os/ask_qwen_result/{id}", { list: undefined }),
    async (uri, { id }) => ({
      contents: [{
        uri: uri.href,
        mimeType: "text/html;profile=mcp-app",
        text: resultStorage.get(id) || renderNotFound(),
      }],
    })
  );

  server.tool("ask_qwen", { prompt: z.string() }, async ({ prompt }) => {
    try {
      const resp = await openai.chat.completions.create({
        model: MODEL_NAME,
        messages: [
          { role: "system", content: "You are Qwen Memory OS AI. Answer concisely." },
          { role: "user", content: prompt },
        ],
      });
      const answer = resp.choices[0].message.content || "";
      const id = Date.now().toString();
      resultStorage.set(id, renderHtmlResult(answer));
      return {
        content: [{ type: "text", text: answer }],
        _meta: { ui: { resourceUri: `ui://qwen-memory-os/ask_qwen_result/${id}` } },
      };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }] };
    }
  });

  return server;
};

/**
 * Handles the GET /sse connection setup.
 * 
 * @param {import("express").Request} req 
 * @param {import("express").Response} res 
 */
export const handleSseConnection = async (req, res) => {
  console.log("[MCP] Client connecting");
  const transport = new SSEServerTransport("/messages", res);
  transports[transport.sessionId] = transport;
  res.on("close", () => delete transports[transport.sessionId]);
  await createMcpServer().connect(transport);
};

/**
 * Handles the POST /messages message passing.
 * 
 * @param {import("express").Request} req 
 * @param {import("express").Response} res 
 */
export const handlePostMessage = async (req, res) => {
  const transport = transports[req.query.sessionId];
  if (transport) {
    await transport.handlePostMessage(req, res, req.body);
  } else {
    res.status(400).send("No transport found for sessionId");
  }
};
