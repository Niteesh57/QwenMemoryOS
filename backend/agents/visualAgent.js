import { openai, MODEL_NAME } from "../models/clients.js";
import { workspaceTools, executeWorkspaceTool } from "../models/tools.js";

/**
 * Visual Agent Node
 * Has MCP tool access and generates self-contained interactive HTML components.
 */
export const visualAgentNode = async (state) => {
  console.log("[Visual Agent] Activated. Preparing tool resolution...");

  const systemPrompt =
    "MANDATORY: Start every response with a [SPEECH] block:\n" +
    "[SPEECH]One or two natural spoken sentences. No markdown, no symbols, no code.[/SPEECH]\n" +
    "The text inside [SPEECH] is ONLY for voice — it will never be displayed.\n\n" +
    "After [/SPEECH], generate a complete self-contained interactive HTML widget.\n" +
    "Requirements:\n" +
    "- Wrap in ```html ... ``` code fence\n" +
    "- Dark theme: background #0d0915, text #f8fafc, accent #8b5cf6\n" +
    "- 100% self-contained (inline CSS/JS + CDN libraries)\n" +
    "- Chart.js from CDN for all charts: <script src=\"https://cdn.jsdelivr.net/npm/chart.js\"></script>\n" +
    "- Include realistic sample data matching what the user asked.\n" +
    "- You have access to workspace file tools. Call them if you need context from the files.";

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: state.prompt },
  ];

  try {
    // Perform non-streaming tool resolution pass
    const response = await openai.chat.completions.create({
      model: MODEL_NAME,
      messages,
      tools: workspaceTools,
      tool_choice: "auto",
    });

    const assistantMsg = response.choices[0].message;

    if (assistantMsg.tool_calls?.length > 0) {
      console.log("[Visual Agent] Executing tools:", assistantMsg.tool_calls.map(t => t.function.name));
      messages.push(assistantMsg);

      for (const call of assistantMsg.tool_calls) {
        let args = {};
        try { args = JSON.parse(call.function.arguments); } catch {}
        const result = await executeWorkspaceTool(call.function.name, args);
        messages.push({ role: "tool", tool_call_id: call.id, content: result });
      }
    }
  } catch (err) {
    console.error("[Visual Agent] Tool resolution error:", err.message);
  }

  return {
    needsUI: true,
    messages: messages,
  };
};
