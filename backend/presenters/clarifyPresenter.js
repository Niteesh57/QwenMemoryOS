import { runClarificationAgent } from "../agents/clarificationAgent.js";

/**
 * Presenter for handling text selection explanation requests.
 * 
 * @param {import("express").Request} req 
 * @param {import("express").Response} res 
 */
export const handleClarifyRequest = async (req, res) => {
  const { mode = "explain", textContext } = req.body;

  if (!textContext) {
    return res.status(400).json({ error: "textContext is required" });
  }

  try {
    console.log(`[API Clarify Presenter] Mode: ${mode} | Clarifying context of length ${textContext.length}`);
    const answer = await runClarificationAgent({ mode, textContext, deviceId: req.deviceId || 'DEV-DEFAULT' });
    
    res.json({ answer });
  } catch (err) {
    console.error("[API Clarify Presenter] Error:", err);
    res.status(500).json({ error: err.message });
  }
};
