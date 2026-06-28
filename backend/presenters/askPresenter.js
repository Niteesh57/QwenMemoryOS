import { agentGraph } from "../models/agent.js";
import { openai, MODEL_NAME } from "../models/clients.js";

/**
 * Presenter for handling user questions via Express /api/ask endpoint.
 * Co-ordinates the Graph execution, updates the view (stream chunks), and handles errors.
 * 
 * @param {import("express").Request} req 
 * @param {import("express").Response} res 
 */
export const handleAskRequest = async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: "Prompt is required" });
  }

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Transfer-Encoding", "chunked");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    console.log(`\n[API Ask Presenter] ► "${prompt}"`);

    // 1. Run LangGraph pipeline to classify intent and resolve tools
    const state = await agentGraph.invoke({ prompt, messages: [] });
    console.log(`[API Ask Presenter] Graph complete. needsUI=${state.needsUI}, messages=${state.messages.length}`);

    // 2. Write the metadata header (view-specific format)
    res.write(`NEEDSUI:${state.needsUI}\n`);

    // 3. Stream response from LLM
    const stream = await openai.chat.completions.create({
      model: MODEL_NAME,
      messages: state.messages,
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        res.write(delta);
      }
    }

    res.end();
    console.log("[API Ask Presenter] Stream complete.");
  } catch (err) {
    console.error("[API Ask Presenter] Error:", err);
    res.write(`NEEDSUI:false\n[SPEECH]I encountered an error, please try again.[/SPEECH]\n\nError: ${err.message}`);
    res.end();
  }
};
