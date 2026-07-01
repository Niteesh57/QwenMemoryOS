// ═══════════════════════════════════════════════════════════════════════
//  videoConversionService.js — Guarantees MP4 format
//  Converts incoming WebM video chunks into clean, universally playable
//  H.264 / AAC MP4 format before saving to Supabase and passing to Qwen.
// ═══════════════════════════════════════════════════════════════════════

import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

ffmpeg.setFfmpegPath(ffmpegStatic);

/**
 * Converts a raw video buffer (e.g. WebM) to a standard MP4 Buffer (H.264 + yuv420p).
 * Ensures even width/height dimensions required by H.264 encoder.
 *
 * @param {Buffer} inputBuffer - The raw video buffer received from frontend
 * @param {string} originalFilename - Original file name (e.g., screen_123.webm)
 * @returns {Promise<{ buffer: Buffer, filename: string, contentType: string }>}
 */
export async function convertToMp4(inputBuffer, originalFilename = 'recording.webm') {
  const baseName = path.basename(originalFilename, path.extname(originalFilename));
  const tempDir = os.tmpdir();
  
  const inputExt = path.extname(originalFilename) || '.webm';
  const inputPath = path.join(tempDir, `in_${Date.now()}_${Math.random().toString(36).substring(7)}${inputExt}`);
  const outputPath = path.join(tempDir, `out_${baseName}_${Date.now()}.mp4`);

  console.log(`[VideoConvert] Writing temp input: ${inputPath} (${(inputBuffer.length / 1024 / 1024).toFixed(2)} MB)`);
  await fs.writeFile(inputPath, inputBuffer);

  console.log(`[VideoConvert] Converting to MP4 (H.264 / yuv420p / even dimensions)...`);

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .inputOptions([
        '-fflags +genpts' // Fix potential missing timestamps in WebM stream chunks
      ])
      .outputOptions([
        '-c:v libx264',
        '-r 2', // Force 2 fps so live stream chunks stay compact (~0.17 MB) & timestamps stay valid
        '-pix_fmt yuv420p',
        '-vf pad=ceil(iw/2)*2:ceil(ih/2)*2', // Ensure width & height are divisible by 2 for H.264
        '-preset fast',
        '-crf 28',
        '-movflags +faststart'
      ])
      .output(outputPath)
      .on('end', async () => {
        try {
          console.log(`[VideoConvert] Conversion complete ✓ Reading MP4...`);
          const mp4Buffer = await fs.readFile(outputPath);
          
          // Clean up temp files
          await fs.unlink(inputPath).catch(() => {});
          await fs.unlink(outputPath).catch(() => {});

          console.log(`[VideoConvert] MP4 ready: ${(mp4Buffer.length / 1024 / 1024).toFixed(2)} MB`);
          resolve({
            buffer: mp4Buffer,
            filename: `${baseName}.mp4`,
            contentType: 'video/mp4'
          });
        } catch (readErr) {
          reject(readErr);
        }
      })
      .on('error', async (err, stdout, stderr) => {
        console.error(`[VideoConvert] FFmpeg error:`, err.message);
        if (stderr) console.error(`[VideoConvert] FFmpeg stderr:\n`, stderr);
        await fs.unlink(inputPath).catch(() => {});
        await fs.unlink(outputPath).catch(() => {});
        reject(err);
      })
      .run();
  });
}
