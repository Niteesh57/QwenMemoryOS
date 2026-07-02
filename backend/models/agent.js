import { StateGraph, Annotation, START, END } from "@langchain/langgraph";
import { orchestrateNode } from "../agents/orchestrator.js";
import { visualAgentNode } from "../agents/visualAgent.js";
import { cliAgentNode } from "../agents/cliAgent.js";
import { generalAgentNode } from "../agents/generalAgent.js";

export const AgentState = Annotation.Root({
  prompt: Annotation({ default: () => "" }),
  deviceId: Annotation({ default: () => "DEV-DEFAULT" }),
  targetAgent: Annotation({ default: () => "general" }),
  needsUI: Annotation({ default: () => false }),
  messages: Annotation({
    reducer: (existing, incoming) => existing.concat(incoming),
    default: () => [],
  }),
});

/**
 * Conditional router edge
 * Determines which agent node to invoke based on targetAgent state.
 */
const routeDecision = (state) => {
  console.log(`[Router Edge] Routing prompt to agent: ${state.targetAgent}`);
  return state.targetAgent;
};

export const agentGraph = new StateGraph(AgentState)
  .addNode("orchestrate", orchestrateNode)
  .addNode("visual", visualAgentNode)
  .addNode("cli", cliAgentNode)
  .addNode("general", generalAgentNode)
  
  .addEdge(START, "orchestrate")
  .addConditionalEdges("orchestrate", routeDecision, {
    visual: "visual",
    cli: "cli",
    general: "general",
  })
  .addEdge("visual", END)
  .addEdge("cli", END)
  .addEdge("general", END)
  .compile();
