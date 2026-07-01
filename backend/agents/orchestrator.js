import { z } from "zod";
import { langModel } from "../models/clients.js";

const RouteSchema = z.object({
  targetAgent: z.enum(["visual", "cli", "general"]).describe(
    "visual: User wants a visual chart, graph, dashboard, game, calculator, or interactive UI widget.\n" +
    "cli: User wants to run a shell/terminal command, execute an operation on the workspace, or needs a command-line script.\n" +
    "general: User is asking general questions, coding advice, explanations, or simple conversation."
  ),
  reason: z.string().describe("Justification for selecting this agent."),
});

/**
 * Orchestrator Node
 * Classifies user intent and sets the targetAgent.
 */
export const orchestrateNode = async (state) => {
  try {
    const classifierModel = langModel.withStructuredOutput(RouteSchema);
    const result = await classifierModel.invoke([
      {
        role: "system",
        content:
          "You are the central routing orchestrator for Qwen Memory OS. " +
          "Your job is to classify the user's prompt and route it to the correct agent.\n\n" +
          "Guidelines:\n" +
          "- Set targetAgent = 'visual' ONLY when the user explicitly requests a chart, " +
          "graph, visual dashboard, game, calculator, or interactive HTML widget.\n" +
          "- Set targetAgent = 'cli' when the user wants to execute/run a command in the workspace, " +
          "perform terminal operations (like npm install, git status), or asks for a specific shell command.\n" +
          "- Set targetAgent = 'general' for all other queries, including conversational dialogue, coding help, explanations, etc.",
      },
      { role: "user", content: state.prompt },
    ]);

    console.log(`[Orchestrator] Routed to: ${result.targetAgent.toUpperCase()} | Reason: ${result.reason}`);
    return { targetAgent: result.targetAgent };
  } catch (err) {
    console.error("[Orchestrator] Error during classification:", err.message);
    return { targetAgent: "general" };
  }
};
