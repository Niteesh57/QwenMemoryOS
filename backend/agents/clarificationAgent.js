import { openai, MODEL_NAME } from "../models/clients.js";
import { retrieveCandidates, lateFilter, retrieveCurrentStates, extractAndRecordUserStateFromVoice } from "../services/eventMemoryService.js";

/**
 * Clarification Agent
 * Specially designed to resolve text-context clarifications and query Neo4j memory (Steps 2-3).
 * 
 * @param {object} params
 * @param {"explain" | "deep"} params.mode
 * @param {string} params.textContext
 * @returns {Promise<string>}
 */
export const runClarificationAgent = async ({ mode, textContext, deviceId = 'DEV-DEFAULT' }) => {
  console.log(`[Clarification Agent] Mode: ${mode} | Context length: ${textContext?.length} | Device: ${deviceId}`);

  let memoryContext = "";
  try {
    const [, candidates] = await Promise.all([
      extractAndRecordUserStateFromVoice(textContext || "", deviceId),
      retrieveCandidates(textContext || "", [], 30, deviceId)
    ]);
    const filtered = lateFilter(candidates, textContext || "", 10);
    const currentStates = await retrieveCurrentStates(deviceId);
    if (filtered.length > 0 || currentStates.length > 0) {
      memoryContext = `\n\nRetrieved Neo4j Memory Context (Steps 2-3):\n` + JSON.stringify({
        events: filtered.map(e => ({ timestamp: e.timestamp, actor: e.actor, action: e.action, object: e.object, raw_content: e.raw_content })),
        states: currentStates
      }, null, 2);
    }
  } catch (err) {
    console.warn("[Clarification Agent] Memory retrieval warning:", err.message);
  }

  let systemPrompt = "";
  let userContent = "";

  if (mode === "deep") {
    systemPrompt = 
      "You are a deep clarification assistant modeled after NotebookLM.\n" +
      "Provide a thorough, comprehensive breakdown of the provided text context.\n" +
      "CRITICAL REQUIREMENTS:\n" +
      "- Explain each key component/concept in detail with concrete examples.\n" +
      "- Keep the language natural and engaging.\n" +
      "- Format in 1-2 medium paragraphs, easy to follow.\n" +
      "- Do NOT use markdown code fences, headers, or bullet points.\n" +
      "- Keep it suitable to be read out loud by TTS.";
    userContent = `Please provide a deep, structured explanation with examples for this context:\n"${textContext}"${memoryContext}`;
  } else {
    // Default/Simple explanation or Memory Answer
    systemPrompt = 
      "You are a concise clarification and memory retrieval assistant. " +
      "Provide a clear, simple explanation or direct answer for the provided context and question.\n" +
      "RULES:\n" +
      "1. If the user asks where/when they opened a website, npm package, or app, report the exact browser, exact tab detail/URL, and timestamp observed in memory (if multiple, report the latest).\n" +
      "2. If the user asks where they saved a file, instruct them with the exact computer directory/folder path observed in memory.\n" +
      "3. USER PREFERENCES & STATES RULE: If the user asks about their personal preferences or status (e.g. current company, liked frameworks) and it IS in memory/states, use it directly. If it IS NOT found, politely answer: 'I don't have that information saved yet. Could you tell me? I'll note it down and remember it for next time.'\n" +
      "4. Return ONLY a single short paragraph (maximum 2-3 sentences).\n" +
      "5. Do NOT use markdown code fences.\n" +
      "6. Make the answer direct and easy to speak via TTS.";
    userContent = `Please explain or answer for this context/query:\n"${textContext}"${memoryContext}`;
  }

  const response = await openai.chat.completions.create({
    model: MODEL_NAME,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent }
    ],
    temperature: 0.1,
  });

  return response.choices[0]?.message?.content?.trim() || "No explanation available.";
};
