// ═══════════════════════════════════════════════════════════════════════
//  screenAnalysisService.js — Qwen3-VL OpenAI Compatible Mode Analyzer
//
//  Uses the official OpenAI SDK with DashScope compatible endpoint:
//  https://dashscope-intl.aliyuncs.com/compatible-mode/v1
// ═══════════════════════════════════════════════════════════════════════

import OpenAI from "openai";
import { ingestEvent, ingestState } from './eventMemoryService.js';

const MODEL = () => process.env.QWEN_VL_MODEL || 'qwen3-vl-plus';

function getOpenAI() {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) throw new Error('[Qwen-VL] DASHSCOPE_API_KEY not set');
  return new OpenAI({
    apiKey,
    baseURL: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'
  });
}

// ─── Analysis Prompt ─────────────────────────────────────────────────────────

function buildPrompt(durationMinutes) {
  return `You are an AI memory agent watching a ${durationMinutes}-minute screen recording session in MP4 format.

Your job is to extract EVERY meaningful visual detail, action, and state from this recording.

RULES:
1. Visual Description = Provide a detailed, vivid description of everything visible on the screen: open applications, UI layout, active code files/syntax, text visible on screen, themes, windows, and mouse movement patterns.
2. Events = one-time timestamped actions or observations (opening apps, clicking buttons, typing, scrolling through sections, viewing specific headings/articles, terminal execution). Even if the user is just scrolling or reading a webpage, create distinct event objects for every section viewed or scrolled!
3. DO NOT SUMMARIZE. Do not include any summary field. Store raw factual details directly.
4. Use exact UI element names, headings, filenames, and text visible on screen. CRITICAL: Always identify the exact browser application (e.g. Chrome, Edge, Firefox), exact browser tab title and URL, and exact file directory/folder path when saving or opening files!

Return ONLY valid JSON (no markdown, no code fences):
{
  "visual_description": "Comprehensive visual narrative: User is viewing a webpage titled AI Newsletter...",
  "events": [
    {
      "offset_seconds": 5,
      "actor": "User",
      "action": "VIEWED_SECTION",
      "object": "Section 8: Accelerating Scientific Research with Gemini",
      "raw_content": "User viewed section summarizing Gemini research case studies and verification loops",
      "source": "screen",
      "topic_tags": ["research", "gemini"]
    }
  ],
  "states": []
}

Extract comprehensive visual details and granular events. Be specific about everything you see. Return JSON only.`;
}

// ─── Call Qwen via OpenAI Compatible Mode Streaming ──────────────────────────

async function callQwenVL(videoUrl, durationMinutes) {
  const openai = getOpenAI();
  const model = MODEL();

  console.log(`[Qwen-VL] Analyzing MP4 stream via OpenAI SDK compatible mode: ${videoUrl}`);
  console.log(`[Qwen-VL] Model: ${model}, Duration: ${durationMinutes}min`);

  const messages = [
    {
      role: "user",
      content: [
        { type: "video_url", video_url: { url: videoUrl } },
        { type: "text", text: buildPrompt(durationMinutes) }
      ]
    }
  ];

  let reasoningContent = '';
  let answerContent = '';
  let isAnswering = false;
  const enable_thinking = false; // Set true if reasoning budget needed

  const stream = await openai.chat.completions.create({
    model,
    messages,
    stream: true,
    enable_thinking
  });

  if (enable_thinking) {
    console.log('\n' + '='.repeat(20) + ' Reasoning Process ' + '='.repeat(20) + '\n');
  }

  for await (const chunk of stream) {
    if (!chunk.choices?.length) continue;
    const delta = chunk.choices[0].delta;

    if (delta.reasoning_content) {
      process.stdout.write(delta.reasoning_content);
      reasoningContent += delta.reasoning_content;
    } else if (delta.content) {
      if (!isAnswering && enable_thinking) {
        console.log('\n' + '='.repeat(20) + ' Complete Response ' + '='.repeat(20) + '\n');
        isAnswering = true;
      }
      process.stdout.write(delta.content);
      answerContent += delta.content;
    }
  }

  console.log('\n[Qwen-VL] Stream completed ✓');
  return answerContent;
}

// ─── Parse and Store ──────────────────────────────────────────────────────────

export async function analyzeAndStore(videoUrl, options = {}) {
  const { durationMinutes = 10, sessionId = 'session', chunkTimestamp = new Date().toISOString(), deviceId = 'DEV-DEFAULT' } = options;

  let rawText;
  try {
    rawText = await callQwenVL(videoUrl, durationMinutes);
  } catch (err) {
    console.error('[Qwen-VL] API call failed:', err.message);
    return { events: [], states: [], summary: `Analysis failed: ${err.message}`, visual_description: '', storedCount: 0, error: err.message };
  }

  let parsed = { visual_description: '', events: [], states: [], summary: '' };
  try {
    const clean = rawText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    parsed = JSON.parse(clean);
  } catch (_) {
    console.warn('[Qwen-VL] JSON parse failed, skip saving event');
    parsed = {
      visual_description: rawText,
      events: [],
      states: [],
      summary: rawText.slice(0, 200),
    };
  }

  const chunkBase = new Date(chunkTimestamp).getTime();
  let storedCount = 0;

  for (const ev of parsed.events || []) {
    // Only save video events, do not save internal interval/system error events
    if (!ev || ev.action === 'ANALYSIS_FAILED' || ev.action === 'VISUAL_SNAPSHOT' || ev.action === 'SCREEN_ANALYZED') continue;
    try {
      const eventTime = new Date(chunkBase + (ev.offset_seconds || 0) * 1000).toISOString();
      await ingestEvent({
        actor: ev.actor || 'User',
        action: ev.action || 'ACTION',
        object: ev.object || '',
        raw_content: ev.raw_content || '',
        source: ev.source || 'screen',
        topic_tags: Array.isArray(ev.topic_tags) ? ev.topic_tags : [],
        video_ref: { session_id: sessionId, video_url: videoUrl, offset_seconds: ev.offset_seconds || 0 },
        timestamp: eventTime,
      }, deviceId);
      storedCount++;
    } catch (err) {
      console.warn('[Qwen-VL] Event store failed:', err.message);
    }
  }

  // Note: States are exclusively created from user voice/speech commands as requested by user.
  console.log(`[Qwen-VL] Stored ${storedCount} video events`);

  return {
    visual_description: parsed.visual_description || '',
    events: parsed.events || [],
    states: parsed.states || [],
    summary: parsed.summary || '',
    storedCount,
    videoUrl,
  };
}

/**
 * Synthesize a direct, specific natural language answer to a user's query
 * using retrieved events and active states.
 */
export async function synthesizeQueryAnswer(query, events, states) {
  try {
    const openai = getOpenAI();
    const contextStr = JSON.stringify({
      retrieved_events: events.map(e => ({ timestamp: e.timestamp, actor: e.actor, action: e.action, object: e.object, raw_content: e.raw_content })),
      current_user_states: states
    }, null, 2);

    console.log(`[AnswerSynthesis] Synthesizing answer for query: "${query}" using ${events.length} events...`);

    const res = await openai.chat.completions.create({
      model: 'qwen-plus',
      messages: [
        {
          role: "system",
          content: `You are the intelligent memory retrieval assistant for Qwen Memory OS.
Based ONLY on the retrieved events and current states provided, answer the user's question directly, clearly, and precisely.
RULES:
1. Be extremely specific. If the user asks where or when they opened a website, npm package, or app, specify the exact browser (e.g. Chrome, Edge, Firefox), exact tab detail/URL, and timestamp. If multiple occurrences exist, report ONLY the latest/most recent one with full detail.
2. If the user asks where they saved a file, instruct them clearly: go to your computer, go into the exact user space/directory observed in memory, and search for the specific folder/file name.
3. Keep the answer factual, direct, and concise.`
        },
        {
          role: "user",
          content: `Question: ${query}\n\nContext:\n${contextStr}`
        }
      ]
    });
    const answer = res.choices?.[0]?.message?.content || null;
    console.log(`[AnswerSynthesis] Answer generated ✓`);
    return answer;
  } catch (err) {
    console.warn('[AnswerSynthesis] LLM call failed:', err.message);
    return null;
  }
}
