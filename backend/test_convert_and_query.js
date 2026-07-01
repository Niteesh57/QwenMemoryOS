import OpenAI from "openai";
import dotenv from "dotenv";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { uploadVideoChunk } from "./services/supabaseService.js";

dotenv.config();
ffmpeg.setFfmpegPath(ffmpegStatic);

const openai = new OpenAI({
  apiKey: process.env.DASHSCOPE_API_KEY,
  baseURL: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'
});

async function convertCleanMp4(inputUrlOrPath, outputPath) {
  console.log("Converting to clean fixed-fps (-r 2) MP4 for Qwen...");
  return new Promise((resolve, reject) => {
    ffmpeg(inputUrlOrPath)
      .outputOptions([
        '-c:v libx264',
        '-r 2', // 2 frames per second fixes variable timestamp errors and keeps file size compact
        '-pix_fmt yuv420p',
        '-vf pad=ceil(iw/2)*2:ceil(ih/2)*2',
        '-preset fast',
        '-crf 28',
        '-movflags +faststart'
      ])
      .output(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', (err) => reject(err))
      .run();
  });
}

async function testVideo() {
  const inputUrl = "https://pzvffhdeoszzmnfdkpzy.supabase.co/storage/v1/object/public/qwen/chunks/screen_1782840734109.mp4";
  const tempOut = path.join(os.tmpdir(), `fixed_${Date.now()}.mp4`);
  
  try {
    await convertCleanMp4(inputUrl, tempOut);
    const buffer = await fs.readFile(tempOut);
    console.log(`Clean MP4 created: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);

    console.log("Uploading fixed video to Supabase...");
    const publicUrl = await uploadVideoChunk(buffer, `test_fixed_${Date.now()}.mp4`, "video/mp4");
    console.log("Uploaded fixed video URL:", publicUrl);

    console.log("\nSending fixed URL to Qwen3-VL via OpenAI SDK...");
    const stream = await openai.chat.completions.create({
      model: 'qwen3-vl-plus',
      messages: [
        {
          role: "user",
          content: [
            { type: "video_url", video_url: { url: publicUrl } },
            { type: "text", text: "What do you see on this screen recording? Extract visual details and actions." }
          ]
        }
      ],
      stream: true
    });

    console.log("\n=== Qwen Response ===");
    for await (const chunk of stream) {
      if (!chunk.choices?.length) continue;
      const delta = chunk.choices[0].delta;
      if (delta.reasoning_content) {
        process.stdout.write(delta.reasoning_content);
      } else if (delta.content) {
        process.stdout.write(delta.content);
      }
    }
    console.log("\nDone ✓");
    await fs.unlink(tempOut).catch(() => {});
  } catch (err) {
    console.error("Test failed:", err);
  }
}

testVideo();
