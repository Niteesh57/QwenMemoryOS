import { retrieveCandidates, lateFilter, retrieveCurrentStates, extractAndRecordUserStateFromVoice } from '../services/eventMemoryService.js';

/**
 * General Agent Node
 * Resolves general questions, explanations, coding help, and queries Neo4j memory (Steps 2-3).
 */
export const generalAgentNode = async (state) => {
  console.log("[General Agent] Activated. Resolving general query with Neo4j memory retrieval & parallel state extraction...");

  let memoryContext = "No relevant memory found.";
  try {
    // Execute parallel user preference extraction and memory retrieval
    const [, candidates] = await Promise.all([
      extractAndRecordUserStateFromVoice(state.prompt, state.deviceId),
      retrieveCandidates(state.prompt, [], 30, state.deviceId)
    ]);

    const filtered = lateFilter(candidates, state.prompt, 10);
    const currentStates = await retrieveCurrentStates(state.deviceId);
    if (filtered.length > 0 || currentStates.length > 0) {
      memoryContext = JSON.stringify({
        retrieved_events: filtered.map(e => ({ timestamp: e.timestamp, actor: e.actor, action: e.action, object: e.object, raw_content: e.raw_content })),
        current_user_states: currentStates
      }, null, 2);
    }
  } catch (err) {
    console.warn("[General Agent] Memory retrieval warning:", err.message);
  }

  const systemPrompt =
    "You are the intelligent voice & memory companion for Qwen Memory OS.\n" +
    "MANDATORY: Start every response with a [SPEECH] block:\n" +
    "[SPEECH]One or two natural spoken sentences answering the user directly and concisely.[/SPEECH]\n" +
    "The text inside [SPEECH] is ONLY for voice — it will never be displayed.\n\n" +
    "After [/SPEECH], write a clear markdown answer.\n\n" +
    "MEMORY QUERY & RETRIEVAL RULES (Steps 2-3):\n" +
    "Based on the retrieved Neo4j memory context provided below:\n" +
    "1. If the user asks where or when they opened a website, package (like npm), or app, specify the exact browser (e.g. Chrome, Edge), exact tab detail/URL, and timestamp. If multiple occurrences exist, report ONLY the latest/most recent one with full detail.\n" +
    "2. If the user asks where they saved a file, instruct them clearly: go to your computer, go into the exact user space/directory observed in memory, and search for the specific folder/file name.\n" +
    "3. USER PREFERENCES & STATES RULE: You have access to the user's present states (current_user_states) such as favorite technologies, liked genres, current company, etc. If the user asks about their preferences or status (e.g. 'what is my current company?' or 'build an app in my favorite framework') and the information IS in current_user_states, use it directly. If the information IS NOT found in memory, politely respond inside [SPEECH]: 'I don't have that information saved yet. Could you tell me? I'll note it down and remember it for next time.'\n\n" +
    `Retrieved Neo4j Memory Context:\n${memoryContext}`;

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: state.prompt },
  ];

  return {
    needsUI: false,
    messages: messages,
  };
};
