// ═══════════════════════════════════════════════════════════════════════
//  supabaseService.js — Supabase Storage for video chunk uploads
//  Uploads screen recording blobs to the "qwen" public bucket
//  and returns a public URL for Qwen3-VL-Flash to access.
// ═══════════════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';

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
export async function uploadVideoChunk(buffer, filename, contentType = 'video/webm') {
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
export async function deleteVideoChunk(filename) {
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
