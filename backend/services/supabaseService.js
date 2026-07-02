// ═══════════════════════════════════════════════════════════════════════
//  supabaseService.js — Supabase Storage for video chunk uploads
//  Uploads screen recording blobs to the "qwen" public bucket
//  and returns a public URL for Qwen3-VL-Flash to access.
// ═══════════════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STATIC_DIR = path.join(__dirname, '../public/static/videos');

let supabaseClient = null;

function getSupabase() {
  if (!supabaseClient) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY;

    if (!url || !key) {
      throw new Error('[Supabase] Missing SUPABASE_URL or SUPABASE_SECRET_KEY in .env');
    }

    supabaseClient = createClient(url, key);
    console.log('[Supabase] Client initialised →', url);
  }
  return supabaseClient;
}

const BUCKET = () => process.env.SUPABASE_BUCKET || 'qwen';

// ─── Upload a video buffer and return the public URL ─────────────────────────

/**
 * Upload a video chunk Buffer to Supabase storage.
 * The file will be public so Qwen3-VL-Flash can access it via URL.
 *
 * @param {Buffer} buffer - Raw video data (WebM from MediaRecorder)
 * @param {string} filename - e.g. "screen_1719123456789.webm"
 * @param {string} contentType - e.g. "video/webm"
 * @returns {string} publicUrl
 */
export async function uploadVideoChunk(buffer, filename, contentType = 'video/webm', deviceId = 'DEV-DEFAULT') {
  const mode = (process.env.STORAGE_MODE || 'cloud').toLowerCase();

  if (mode === 'local') {
    if (!fs.existsSync(STATIC_DIR)) {
      fs.mkdirSync(STATIC_DIR, { recursive: true });
    }
    const uniqueName = `${deviceId}_${filename}`;
    const localPath = path.join(STATIC_DIR, uniqueName);
    await fs.promises.writeFile(localPath, buffer);

    const baseUrl = process.env.LOCAL_PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`;
    const publicUrl = `${baseUrl}/static/videos/${uniqueName}`;
    console.log(`[Storage:Local] Saved chunk to disk → ${localPath}`);
    console.log(`[Storage:Local] Served at public URL → ${publicUrl}`);
    return publicUrl;
  }

  const supabase = getSupabase();
  const bucket = BUCKET();

  console.log(`[Supabase] Uploading ${filename} (${(buffer.length / 1024 / 1024).toFixed(1)} MB) to bucket "${bucket}"…`);

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(`chunks/${filename}`, buffer, {
      contentType,
      upsert: true,
      cacheControl: '3600',
    });

  if (error) {
    console.error('[Supabase] Upload error:', error.message);
    throw new Error(`Supabase upload failed: ${error.message}`);
  }

  const { data: urlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(`chunks/${filename}`);

  const publicUrl = urlData.publicUrl;
  console.log('[Supabase] Uploaded ✓ →', publicUrl);
  return publicUrl;
}

/**
 * Delete an old chunk from storage (called after successful Neo4j ingestion).
 * Optional — keeps bucket from filling up.
 */
export async function deleteVideoChunk(filename, deviceId = 'DEV-DEFAULT') {
  const mode = (process.env.STORAGE_MODE || 'cloud').toLowerCase();

  if (mode === 'local') {
    const uniqueName = filename.startsWith(deviceId) ? filename : `${deviceId}_${filename}`;
    const localPath = path.join(STATIC_DIR, uniqueName);
    if (fs.existsSync(localPath)) {
      await fs.promises.unlink(localPath);
      console.log(`[Storage:Local] Deleted chunk from disk after LLM analysis → ${localPath}`);
    } else {
      const exactPath = path.join(STATIC_DIR, filename);
      if (fs.existsSync(exactPath)) {
        await fs.promises.unlink(exactPath);
        console.log(`[Storage:Local] Deleted chunk from disk after LLM analysis → ${exactPath}`);
      }
    }
    return;
  }

  const supabase = getSupabase();
  const bucket = BUCKET();
  await supabase.storage.from(bucket).remove([`chunks/${filename}`]);
}

/**
 * List recent chunks in storage.
 */
export async function listChunks() {
  const supabase = getSupabase();
  const bucket = BUCKET();

  const { data, error } = await supabase.storage.from(bucket).list('chunks', {
    limit: 20,
    sortBy: { column: 'created_at', order: 'desc' },
  });

  if (error) return [];
  return data || [];
}
