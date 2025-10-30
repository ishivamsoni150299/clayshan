#!/usr/bin/env node
// Optional local helper: generate WebP from JPG/PNG and upload originals + webp to Supabase Storage.
// Usage:
//   node scripts/generate-webp-upload.mjs --dir ./public/assets/products --prefix products/ --bucket product-images
// Requires env: SUPABASE_URL, SUPABASE_SERVICE_ROLE

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
function arg(name, def = '') { const i = args.indexOf(`--${name}`); return i >= 0 ? (args[i+1]||'') : def; }
const ROOT = arg('dir', 'public/assets/products');
const BUCKET = arg('bucket', process.env.SUPABASE_STORAGE_BUCKET || 'product-images');
const PREFIX = arg('prefix', `products/${new Date().getFullYear()}/${String(new Date().getMonth()+1).padStart(2,'0')}/`);

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE || '';
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE in env');
  process.exit(1);
}
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

let sharp = null;
try { sharp = (await import('sharp')).default; } catch {
  console.warn('sharp not installed; will upload originals only. Run: npm i -D sharp');
}

async function* walk(dir) {
  const list = await fs.readdir(dir, { withFileTypes: true });
  for (const d of list) {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) yield* walk(p); else yield p;
  }
}

function isRaster(filePath) {
  return /\.(jpe?g|png)$/i.test(filePath);
}

function contentType(fp) {
  const ext = (fp.split('.').pop()||'').toLowerCase();
  if (ext === 'webp') return 'image/webp';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'svg') return 'image/svg+xml';
  return 'application/octet-stream';
}

async function uploadBuffer(key, buf, type) {
  const { error } = await sb.storage.from(BUCKET).upload(key, buf, { contentType: type });
  if (error) throw error;
  const { data } = sb.storage.from(BUCKET).getPublicUrl(key);
  return data.publicUrl;
}

async function run() {
  let count = 0, webps = 0;
  for await (const fp of walk(ROOT)) {
    if (!isRaster(fp)) continue;
    const baseName = path.basename(fp);
    const raw = await fs.readFile(fp);
    const keyOrig = PREFIX + baseName;
    const urlOrig = await uploadBuffer(keyOrig, raw, contentType(fp));
    count++;
    let urlWebp = null;
    if (sharp) {
      try {
        const webpBuf = await sharp(raw).webp({ quality: 78 }).toBuffer();
        const keyWebp = PREFIX + baseName.replace(/\.(jpe?g|png)$/i, '.webp');
        urlWebp = await uploadBuffer(keyWebp, webpBuf, 'image/webp');
        webps++;
      } catch (e) {
        console.warn('webp error for', baseName, e?.message || e);
      }
    }
    console.log(JSON.stringify({ file: baseName, original: urlOrig, webp: urlWebp }));
  }
  console.log(`Uploaded ${count} originals${sharp ? ` and ${webps} webp` : ''} to bucket ${BUCKET} with prefix ${PREFIX}`);
}

run().catch((e) => { console.error(e); process.exit(1); });

