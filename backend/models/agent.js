import { StateGraph, Annotation, START, END } from "@langchain/langgraph";
import { z } from "zod";
import { openai, langModel, MODEL_NAME } from "./clients.js";
import { workspaceTools, executeWorkspaceTool } from "./tools.js";
import { buildSystemPrompt } from "../views/promptView.js";

/** Schema for the intent classification node */
const IntentSchema = z.object({
  needsUI: z.boolean().describe(
    "True only if the user explicitly asked for a chart, graph, visual dashboard, game, calculator, or interactive widget. False for all text/code/CLI answers."
  ),
  reason: z.string().describe("One-line justification for the decision."),
});

export const AgentState = Annotation.Root({
  prompt:   Annotation({ default: () => "" }),
  needsUI:  Annotation({ default: () => false }),
  messages: Annotation({
    reducer: (existing, incoming) => existing.concat(incoming),
    default: () => [],
  }),
});

/**
 * Node 1 — CLASSIFY
 * Uses withStructuredOutput + IntentSchema to decide if UI is needed.
 */
const classifyNode = async (state) => {
  try {
    const classifierModel = langModel.withStructuredOutput(IntentSchema);
    const result = await classifierModel.invoke([
      {
        role: "system",
        content:
          "You classify user intent. Set needsUI=true ONLY when the user explicitly requests a chart, " +
          "graph, visual dashboard, game, calculator, or interactive HTML widget. " +
          "Everything else (text answers, code snippets, CLI commands, explanations) → needsUI=false.",
      },
      { role: "user", content: state.prompt },
    ]);

    console.log(`[LangGraph Classify] needsUI=${result.needsUI} | reason: ${result.reason}`);
    return { needsUI: result.needsUI };
  } catch (err) {
    console.error("[LangGraph Classify] Error:", err.message);
    return { needsUI: false };
  }
};

/**
 * Node 2 — RESOLVE TOOLS
 * Runs a non-streaming pass to handle any tool calls the LLM wants to make.
 * Returns the finalized message list ready for streaming.
 */
const resolveToolsNode = async (state) => {
  const systemPrompt = buildSystemPrompt(state.needsUI);
  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: state.prompt },
  ];

  // First non-streaming round — detect tool calls
  const response = await openai.chat.completions.create({
    model: MODEL_NAME,
    messages,
    tools: workspaceTools,
    tool_choice: "auto",
  });

  const assistantMsg = response.choices[0].message;

  if (assistantMsg.tool_calls?.length > 0) {
    console.log("[LangGraph Tools] Tool calls:", assistantMsg.tool_calls.map(t => t.function.name));
    messages.push(assistantMsg);

    for (const call of assistantMsg.tool_calls) {
      let args = {};
      try { args = JSON.parse(call.function.arguments); } catch {}
      const result = await executeWorkspaceTool(call.function.name, args);
      messages.push({ role: "tool", tool_call_id: call.id, content: result });
    }
  }

  return { messages };
};

export const agentGraph = new StateGraph(AgentState)
  .addNode("classify", classifyNode)
  .addNode("resolveTools", resolveToolsNode)
  .addEdge(START, "classify")
  .addEdge("classify", "resolveTools")
  .addEdge("resolveTools", END)
  .compile();
