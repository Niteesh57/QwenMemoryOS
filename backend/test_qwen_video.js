import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const videoUrl = "https://pzvffhdeoszzmnfdkpzy.supabase.co/storage/v1/object/public/qwen/chunks/screen_1782840734109.mp4";

const openai = new OpenAI({
  apiKey: process.env.DASHSCOPE_API_KEY,
  baseURL: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'
});

async function main() {
  console.log("Testing Qwen3-VL with video:", videoUrl);
  try {
    const stream = await openai.chat.completions.create({
      model: 'qwen3-vl-plus',
      messages: [
        {
          role: "user",
          content: [
            { type: "video_url", video_url: { url: videoUrl } },
            { type: "text", text: "Describe what you see in this video." }
          ]
        }
      ],
      stream: true
    });

    console.log("\n=== Response ===");
    for await (const chunk of stream) {
      if (!chunk.choices?.length) continue;
      const delta = chunk.choices[0].delta;
      if (delta.reasoning_content) {
        process.stdout.write(delta.reasoning_content);
      } else if (delta.content) {
        process.stdout.write(delta.content);
      }
    }
    console.log("\nDone!");
  } catch (err) {
    console.error("\nError calling OpenAI SDK compatible mode:", err);
  }
}

main();
