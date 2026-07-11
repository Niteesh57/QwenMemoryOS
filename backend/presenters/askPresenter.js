import { agentGraph } from "../models/agent.js";
import { openai, MODEL_NAME } from "../models/clients.js";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { convertToMp4 } from "../services/videoConversionService.js";
import { uploadVideoChunk, deleteVideoChunk } from "../services/supabaseService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_VIDEOS_DIR = path.join(__dirname, "../public/static/videos");

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
    const state = await agentGraph.invoke({ prompt, deviceId: req.deviceId || 'DEV-DEFAULT', messages: [] });
    console.log(`[API Ask Presenter] Graph complete. needsUI=${state.needsUI}, messages=${state.messages.length}`);

    // 2. Write the metadata header (view-specific format)
    res.write(`NEEDSUI:${state.needsUI}\n`);

    // 3. Stream response from LLM (sanitize oversized tool/text messages to avoid 6MB limit)
    const sanitizedMessages = state.messages.map(m => {
      if (typeof m.content === 'string' && m.content.length > 50000) {
        return { ...m, content: m.content.slice(0, 50000) + '\n...[truncated to prevent exceeding max request body size]' };
      }
      return m;
    });

    const stream = await openai.chat.completions.create({
      model: MODEL_NAME,
      messages: sanitizedMessages,
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

/**
 * Presenter for handling interactive voice+visual queries (/api/ask/visual).
 * Saves temporary screen recording snippet, sends to multimodal model, and deletes temp file immediately.
 */
export const handleAskVisualRequest = async (req, res) => {
  const prompt = req.body?.prompt;
  if (!prompt) {
    return res.status(400).json({ error: "Prompt is required" });
  }

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Transfer-Encoding", "chunked");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  let tempVideoFilename = null;
  const deviceId = req.deviceId || 'DEV-DEFAULT';

  try {
    console.log(`\n[API Ask Visual Presenter] ► "${prompt}" (with visual context)`);

    let visualMessageContent = [{ type: "text", text: prompt }];

    if (req.file && req.file.buffer) {
      const maxMb = parseFloat(process.env.QWEN_VL_MAX_MB) || 25;
      const sizeMb = req.file.buffer.length / 1024 / 1024;
      if (sizeMb > maxMb) {
        console.warn(`[API Ask Visual Presenter] Video size (${sizeMb.toFixed(1)} MB) exceeds env limit (${maxMb} MB).`);
        return res.status(400).json({ error: `Video size (${sizeMb.toFixed(1)} MB) exceeds limit (${maxMb} MB).` });
      }
      console.log(`[API Ask Visual Presenter] Processing temporary screen recording (${sizeMb.toFixed(2)} MB)...`);

      const tempId = `temp_query_${deviceId}_${Date.now()}`;
      const converted = await convertToMp4(req.file.buffer, `${tempId}.webm`);
      tempVideoFilename = converted.filename;

      const videoUrl = await uploadVideoChunk(converted.buffer, tempVideoFilename, 'video/mp4', deviceId);
      console.log(`[API Ask Visual Presenter] Saved temporary query video: ${videoUrl}`);

      visualMessageContent = [
        { type: "video_url", video_url: { url: videoUrl } },
        {
          type: "text",
          text: `User Prompt: "${prompt}"

Instructions:
1. Examine the screen recording to understand the user's active context.
2. If the user's prompt is a simple greeting (e.g., "hi", "hello", "hey") or is a general conversational query unrelated to what is on the screen, ignore the visual details and answer in a highly personalized, warm, and natural human conversational style (do NOT list the screen contents or recite database events).
3. If the user's query is specific to the screen (e.g., code issues, error messages, active files, or web pages), use the visual context to answer concisely and helpfully.
4. If the visual context is not sufficient to answer, fall back to utilizing the retrieved memory graph context (if available in messages) to answer.
5. Avoid stiff, robotic, or ChatGPT-style templates. Keep the reply personal, direct, and natural.`
        }
      ];
    }

    const state = await agentGraph.invoke({ prompt, deviceId, messages: [] });
    console.log(`[API Ask Visual Presenter] Graph complete. needsUI=${state.needsUI}`);

    res.write(`NEEDSUI:${state.needsUI}\n`);

    const finalMessages = [...state.messages];
    if (req.file && req.file.buffer) {
      const lastUserIdx = finalMessages.map(m => m.role).lastIndexOf('user');
      if (lastUserIdx !== -1) {
        finalMessages[lastUserIdx] = { role: 'user', content: visualMessageContent };
      } else {
        finalMessages.push({ role: 'user', content: visualMessageContent });
      }
    }

    const modelToUse = (req.file && req.file.buffer)
      ? (process.env.QWEN_VL_MODEL || 'qwen3-vl-flash')
      : MODEL_NAME;

    console.log(`[API Ask Visual Presenter] Requesting completion model: ${modelToUse}...`);
    // Truncate oversized text/tool messages to prevent DashScope 6MB body limit error
    const sanitizedMessages = finalMessages.map(m => {
      if (typeof m.content === 'string' && m.content.length > 50000) {
        return { ...m, content: m.content.slice(0, 50000) + '\n...[truncated to prevent exceeding max request body size]' };
      }
      return m;
    });

    const stream = await openai.chat.completions.create({
      model: modelToUse,
      messages: sanitizedMessages,
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        res.write(delta);
      }
    }

    res.end();
    console.log("[API Ask Visual Presenter] Stream complete.");
  } catch (err) {
    console.error("[API Ask Visual Presenter] Error:", err);
    res.write(`NEEDSUI:false\n[SPEECH]I encountered an error analyzing your screen, please try again.[/SPEECH]\n\nError: ${err.message}`);
    res.end();
  } finally {
    if (tempVideoFilename) {
      deleteVideoChunk(tempVideoFilename, deviceId).then(() => {
        console.log(`[API Ask Visual Presenter] Deleted temporary query file: ${tempVideoFilename} ✓`);
      }).catch((e) => {
        console.warn(`[API Ask Visual Presenter] Failed to delete temp file:`, e.message);
      });
    }
  }
};

