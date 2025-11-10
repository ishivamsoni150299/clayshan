﻿import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';
import 'dotenv/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import Razorpay from 'razorpay';
import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { RequestInit } from 'node-fetch';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
// Avoid 304/ETag issues for dynamic API responses
app.set('etag', false);
app.use(express.json());
// Ensure API responses are not cached by the browser
app.use('/api', (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
app.use(cookieParser());
// Basic CORS for API use if needed (same-origin in SSR is typical)
const CORS_ORIGIN = (process.env['CORS_ORIGIN'] || '').split(',').map(s => s.trim()).filter(Boolean);
app.use((req, res, next) => {
  const origin = String(req.headers.origin || '');
  if (CORS_ORIGIN.length > 0) {
    const allowed = CORS_ORIGIN.includes(origin) ? origin : CORS_ORIGIN[0];
    res.header('Access-Control-Allow-Origin', allowed);
  } else {
    res.header('Access-Control-Allow-Origin', origin || '*');
  }
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.sendStatus(200); return; }
  next();
});
const angularApp = new AngularNodeAppEngine();

/**
 * Supabase client (server-side)
 */
const SUPABASE_URL = process.env['SUPABASE_URL'] || '';
const SUPABASE_SERVICE_ROLE = process.env['SUPABASE_SERVICE_ROLE'] || '';
const SUPABASE_ANON_KEY = process.env['SUPABASE_ANON_KEY'] || '';
let supabase: SupabaseClient | null = null;
let supabaseAuth: SupabaseClient | null = null;
if (SUPABASE_URL && SUPABASE_SERVICE_ROLE) {
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  console.log('Supabase client initialized');
} else {
  console.warn('Supabase env not set. Using fallback in-memory data.');
}
if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const STORAGE_BUCKET = process.env['SUPABASE_STORAGE_BUCKET'] || 'product-images';
async function ensureBucket() {
  if (!supabase) return;
  const { data: buckets } = await supabase.storage.listBuckets();
  if (!buckets?.find((b) => b.name === STORAGE_BUCKET)) {
    const { error } = await supabase.storage.createBucket(STORAGE_BUCKET, { public: true });
    if (error) console.warn('Create bucket error:', error.message);
    else console.log('Created storage bucket:', STORAGE_BUCKET);
  }
}
ensureBucket().catch(() => {});

type ProductRow = {
  id?: string;
  name: string;
  slug: string;
  price: number;
  currency: string;
  images: string[];
  description: string;
  category: string;
  tags?: string[];
  inventory?: number | null;
  featured?: boolean;
  variants?: any[];
  supplier?: string | null;
  supplier_sku?: string | null;
  supplier_data?: any;
  created_at?: string;
  updated_at?: string;
};

type OrderRow = {
  id?: string;
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  amount: number;
  currency: string;
  email?: string;
  items: any;
  status?: string;
  supplier_order_id?: string | null;
  tracking_number?: string | null;
  shipping_carrier?: string | null;
};

async function seedIfEmpty() {
  if (!supabase) return;
  const { data, error } = await supabase.from('products').select('id', { count: 'exact', head: true });
  if (error) {
    console.warn('Supabase count error (seed):', error.message);
    return;
  }
  // When using head: true, count is available on error? SDK v2 sets count on data? Workaround: simple select limit 1
  const check = await supabase.from('products').select('id').limit(1);
  if (check.error) {
    console.warn('Supabase select error (seed):', check.error.message);
    return;
  }
  if (check.data && check.data.length > 0) return;
  const toInsert = getFallbackProducts();
  const ins = await supabase.from('products').insert(toInsert);
  if (ins.error) {
    console.warn('Seed insert error:', ins.error.message);
  } else {
    console.log('Seeded sample products to Supabase');
  }
}

seedIfEmpty().catch((e) => console.error('Seeding error', e));

/** Fallback data when DB is unavailable */
function getFallbackProducts() {
  const base = [
    { name: '925 Silver Kundan Necklace', slug: 'kundan-statement-necklace', price: 12999, img: '/assets/products/kundan-necklace-1.svg', category: 'Necklaces', tags: ['925','silver','kundan','statement'] },
    { name: '925 Silver Pearl Drop Earrings', slug: 'pearl-drop-earrings', price: 4999, img: '/assets/products/pearl-earrings-1.svg', category: 'Earrings', tags: ['925','silver','pearls','minimal'] },
    { name: '925 Silver Coin Bracelet', slug: 'temple-coin-bracelet', price: 6999, img: '/assets/products/coin-bracelet-1.svg', category: 'Bracelets', tags: ['925','silver','coin'] },
    { name: '925 Silver Gemstone Stack Ring', slug: 'gemstone-stack-ring', price: 3499, img: '/assets/products/stack-ring-1.svg', category: 'Rings', tags: ['925','silver','gemstone','stackable'] },
  ];
  const more = [
    { name: '925 Silver Minimal Pendant', slug: 'minimal-kundan-pendant', price: 5999, img: '/assets/products/kundan-necklace-1.svg', category: 'Necklaces', tags: ['925','silver','minimal'] },
    { name: '925 Silver Pearl Studs', slug: 'pearl-stud-earrings', price: 2999, img: '/assets/products/pearl-earrings-1.svg', category: 'Earrings', tags: ['925','silver','pearls','stud'] },
    { name: '925 Silver Charm Bracelet', slug: 'coin-charm-bracelet', price: 7499, img: '/assets/products/coin-bracelet-1.svg', category: 'Bracelets', tags: ['925','silver','charm'] },
    { name: '925 Silver Duo Gemstone Ring', slug: 'duo-gemstone-ring', price: 3799, img: '/assets/products/stack-ring-1.svg', category: 'Rings', tags: ['925','silver','gemstone','duo'] },
    { name: '925 Silver Layered Necklace', slug: 'layered-kundan-necklace', price: 14999, img: '/assets/products/kundan-necklace-1.svg', category: 'Necklaces', tags: ['925','silver','layered'] },
    { name: '925 Silver Pearl Hoops', slug: 'pearl-hoop-earrings', price: 5499, img: '/assets/products/pearl-earrings-1.svg', category: 'Earrings', tags: ['925','silver','pearls','hoop'] },
    { name: '925 Silver Kada Bracelet', slug: 'temple-kada-bracelet', price: 7999, img: '/assets/products/coin-bracelet-1.svg', category: 'Bracelets', tags: ['925','silver','kada'] },
    { name: '925 Silver Stackable Ring', slug: 'stackable-color-ring', price: 3899, img: '/assets/products/stack-ring-1.svg', category: 'Rings', tags: ['925','silver','stackable'] },
  ];
  const all = [...base, ...more];
  return all.map((p) => ({
    name: p.name,
    slug: p.slug,
    price: p.price,
    currency: 'INR',
    images: [p.img, '/assets/placeholder.svg'],
    description: 'Handcrafted 925 sterling silver with a clean, modern silhouette. Hypoallergenic and rhodium-plated for lasting shine.',
    category: p.category,
    tags: p.tags,
  }));
}

/** API routes **/
// Admin auth helpers
const ADMIN_EMAILS = (process.env['ADMIN_EMAILS'] || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
const SB_TOKEN = 'sb_token';
const SB_EMAIL = 'sb_email';
function isAdmin(req: express.Request): boolean {
  const e = (req.cookies?.[SB_EMAIL] || '').toLowerCase();
  if (ADMIN_EMAILS.length && e && ADMIN_EMAILS.includes(e)) return true;
  return false;
}
function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!ADMIN_EMAILS.length) { res.status(503).json({ error: 'Admin not configured' }); return; }
  if (!isAdmin(req)) { res.status(401).json({ error: 'Unauthorized' }); return; }
  return next();
}

// Removed password-based admin login/logout; Supabase email-based admin only

app.get('/api/admin/me', (req, res) => {
  res.json({ admin: isAdmin(req) });
});

// Supabase Auth (email/password)
app.post('/api/auth/login', async (req, res) => {
  try {
    if (!supabaseAuth) { res.status(503).json({ error: 'Supabase anon not configured' }); return; }
    const { email, password } = req.body || {};
    if (!email || !password) { res.status(400).json({ error: 'Missing email/password' }); return; }
    const { data, error } = await supabaseAuth.auth.signInWithPassword({ email, password });
    if (error) { res.status(401).json({ error: error.message }); return; }
    const token = data.session?.access_token;
    if (!token) { res.status(500).json({ error: 'No session token' }); return; }
    const secure = (process.env['COOKIE_SECURE'] || process.env['NODE_ENV'] === 'production') ? true : false;
    res.cookie(SB_TOKEN, token, { httpOnly: true, sameSite: 'lax', secure, maxAge: 7 * 24 * 3600 * 1000 });
    res.cookie(SB_EMAIL, String(email).toLowerCase(), { httpOnly: true, sameSite: 'lax', secure, maxAge: 7 * 24 * 3600 * 1000 });
    res.json({ ok: true, admin: isAdmin(req) });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Auth error' });
  }
});

app.post('/api/auth/logout', async (_req, res) => {
  res.clearCookie(SB_TOKEN);
  res.clearCookie(SB_EMAIL);
  res.json({ ok: true });
});

app.get('/api/auth/me', async (req, res) => {
  res.json({ email: req.cookies?.[SB_EMAIL] || null, admin: isAdmin(req) });
});

// CRUD endpoints (server-side via service role)
app.post('/api/admin/products', requireAdmin, async (req, res, next) => {
  try {
    const body = req.body as Partial<ProductRow>;
    if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });
    const { error, data } = await supabase.from('products').insert([body]).select('*').maybeSingle();
    if (error) throw error;
    res.json(data);
    return;
  } catch (e) {
    next(e);
    return;
  }
});

app.put('/api/admin/products/:id', requireAdmin, async (req, res, next) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });
    const { id } = req.params;
    const body = req.body as Partial<ProductRow>;
    const { error, data } = await supabase.from('products').update(body).eq('id', id).select('*').maybeSingle();
    if (error) throw error;
    res.json(data);
    return;
  } catch (e) {
    next(e);
    return;
  }
});

app.delete('/api/admin/products/:id', requireAdmin, async (req, res, next) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });
    const { id } = req.params;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) throw error;
    res.json({ ok: true });
    return;
  } catch (e) {
    next(e);
    return;
  }
});

// Upload endpoint
const upload = multer({ storage: multer.memoryStorage() });
app.post('/api/admin/upload', requireAdmin, upload.single('file'), async (req, res, next) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });
    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file) { res.status(400).json({ error: 'Missing file' }); return; }
    const ext = (file.originalname.split('.').pop() || 'bin').toLowerCase();
    const key = `products/${new Date().getFullYear()}/${String(new Date().getMonth()+1).padStart(2,'0')}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(key, file.buffer, { contentType: file.mimetype, upsert: false });
    if (error) throw error;
    const { data: pub } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(key);
    res.json({ url: pub.publicUrl, path: key });
    return;
  } catch (e) {
    next(e);
    return;
  }
});

// Seed endpoint (admin only): inserts fallback products if table empty
app.post('/api/admin/seed', requireAdmin, async (_req, res, next) => {
  try {
    if (!supabase) { res.status(503).json({ error: 'Supabase not configured' }); return; }
    const check = await supabase.from('products').select('id').limit(1);
    if (check.error) { res.status(500).json({ error: check.error.message }); return; }
    if (check.data && check.data.length > 0) { res.json({ ok: true, inserted: 0 }); return; }
    const ins = await supabase.from('products').insert(getFallbackProducts());
    if (ins.error) { res.status(500).json({ error: ins.error.message }); return; }
    res.json({ ok: true, inserted: getFallbackProducts().length });
  } catch (e) {
    next(e);
  }
});

// Seed more items (idempotent by slug)
app.post('/api/admin/seed/more', requireAdmin, async (_req, res, next) => {
  try {
    if (!supabase) { res.status(503).json({ error: 'Supabase not configured' }); return; }
    const items = getFallbackProducts();
    const up = await supabase.from('products').upsert(items, { onConflict: 'slug' as any });
    if (up.error) { res.status(500).json({ error: up.error.message }); return; }
    res.json({ ok: true, upserted: items.length });
  } catch (e) {
    next(e);
  }
});

/** Razorpay minimal checkout: create order */
const RAZORPAY_KEY_ID = process.env['RAZORPAY_KEY_ID'] || '';
const RAZORPAY_KEY_SECRET = process.env['RAZORPAY_KEY_SECRET'] || '';
let razor: Razorpay | null = null;
if (RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET) {
  razor = new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET });
}

app.get('/api/checkout/config', (_req, res) => {
  if (!RAZORPAY_KEY_ID) { res.status(503).json({ error: 'Razorpay not configured' }); return; }
  res.json({ keyId: RAZORPAY_KEY_ID });
});

app.post('/api/checkout/create-order', async (req, res) => {
  try {
    if (!razor) { res.status(503).json({ error: 'Razorpay not configured' }); return; }
    const { amount, currency } = req.body || {};
    if (!amount || !currency) { res.status(400).json({ error: 'Missing amount/currency' }); return; }
    const order = await razor.orders.create({ amount: Math.round(Number(amount) * 100), currency, receipt: `rcpt_${Date.now()}` });
    res.json({ order });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Checkout error' });
  }
});

app.post('/api/checkout/verify', async (req, res) => {
  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature, amount, currency, items } = req.body || {};
    if (!RAZORPAY_KEY_SECRET) { res.status(503).json({ error: 'Razorpay not configured' }); return; }
    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) { res.status(400).json({ error: 'Missing fields' }); return; }
    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expected = crypto.createHmac('sha256', RAZORPAY_KEY_SECRET).update(body).digest('hex');
    if (expected !== razorpay_signature) { res.status(400).json({ error: 'Invalid signature' }); return; }
    if (supabase) {
      const email = (req.cookies?.['sb_email'] || null) as string | null;
      const order: OrderRow = { razorpay_order_id, razorpay_payment_id, amount, currency, email: email || undefined, items: items || [], status: 'paid' };
      const { data, error } = await supabase.from('orders').insert([order]).select('id').maybeSingle();
      if (error) { res.status(500).json({ error: error.message }); return; }
      // Best-effort inventory decrement for each cart item
      try {
        if (Array.isArray(items)) {
          for (const it of items) {
            const pid = String(it?.id || '').trim();
            const qty = Math.max(1, Number(it?.qty || 0));
            if (!pid || !qty) continue;
            // Lookup by id, then by slug
            let sel = await supabase.from('products').select('id,inventory,slug').eq('id', pid).maybeSingle();
            if (sel.error || !sel.data) {
              sel = await supabase.from('products').select('id,inventory,slug').eq('slug', pid).maybeSingle();
            }
            const row: any = sel.data;
            if (row && typeof row.inventory === 'number' && row.inventory != null) {
              const newInv = Math.max(0, (row.inventory as number) - qty);
              await supabase.from('products').update({ inventory: newInv }).eq('id', row.id);
            }
          }
        }
      } catch {}
      res.json({ ok: true, id: data?.id || razorpay_order_id });
      return;
    }
    res.json({ ok: true, id: razorpay_order_id });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Verification error' });
  }
});

/** Dropshipping: Silverbene API integration **/
const DS_BASE = process.env['SILVERBENE_API_BASE'] || 'https://silverbene.com/api';
const DS_KEY = process.env['SILVERBENE_API_KEY'] || '';
const DS_SECRET = process.env['SILVERBENE_API_SECRET'] || '';
const DS_BEARER = process.env['SILVERBENE_ACCESS_TOKEN'] || process.env['SILVERBENE_BEARER'] || '';
const DS_WEBHOOK_SECRET = process.env['SILVERBENE_WEBHOOK_SECRET'] || '';
const USD_INR = Number(process.env['EXCHANGE_RATE_USD_INR'] || '83');
const PRICE_MARKUP = Number(process.env['PRICE_MARKUP'] || '0'); // percentage, e.g. 15 => +15%

async function dsFetch(path: string, init?: RequestInit): Promise<any> {
  const url = DS_BASE.replace(/\/$/, '') + path;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (DS_BEARER) {
    headers['Authorization'] = `Bearer ${DS_BEARER}`;
  } else {
    if (DS_KEY) headers['X-API-KEY'] = DS_KEY;
    if (DS_SECRET) headers['X-API-SECRET'] = DS_SECRET;
  }
  const res = await fetch(url, { ...(init || {}), headers: { ...headers, ...(init?.headers as any || {}) } } as any);
  if (!res.ok) throw new Error(`Dropship API ${res.status}`);
  const data = await res.json().catch(() => ({}));
  return data;
}

function mapDsProduct(p: any): ProductRow {
  const name = String(p?.name || p?.title || 'Silverbene Product');
  const sku = String(p?.sku || p?.id || '').trim();
  const priceUsd = Number(p?.price || p?.price_usd || 0);
  const priceInr = Math.round((priceUsd || 0) * USD_INR);
  const imgs: string[] = Array.isArray(p?.images) ? p.images : (p?.image ? [p.image] : []);
  const slug = (sku ? `silverbene-${sku}` : name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
  return {
    name,
    slug,
    price: priceInr > 0 ? priceInr : 0,
    currency: 'INR',
    images: imgs.filter(Boolean),
    description: String(p?.description || p?.desc || name),
    category: String(p?.category || 'Dropship'),
    tags: Array.isArray(p?.tags) ? p.tags : [],
    inventory: typeof p?.stock === 'number' ? p.stock : null,
    featured: false,
    variants: Array.isArray(p?.variants) ? p.variants : [],
    supplier: 'silverbene',
    supplier_sku: sku || null,
    supplier_data: p,
  };
}

/** Silverbene documented endpoints (s.silverbene.com) using token query **/
const SB_DS_BASE = process.env['SILVERBENE_SB_BASE'] || 'https://s.silverbene.com/api/dropshipping';
let __sbTokenCache: string | null = null;
function getSupplierToken(): string {
  if (__sbTokenCache) return __sbTokenCache;
  const envTok = process.env['SILVERBENE_ACCESS_TOKEN'] || process.env['SILVERBENE_TOKEN'] || process.env['SILVERBENE_BEARER'] || '';
  if (envTok) { __sbTokenCache = envTok; return __sbTokenCache; }
  try {
    const fs = require('node:fs');
    const p = 'silverbene.token';
    if (fs.existsSync(p)) {
      const t = String(fs.readFileSync(p, 'utf8')).trim();
      if (t) { __sbTokenCache = t; return __sbTokenCache; }
    }
  } catch {}
  return '';
}

// Simple in-memory cache for supplier responses
const __memCache = new Map<string, { exp: number; data: any }>();
function cacheGet(key: string): any | undefined {
  const e = __memCache.get(key);
  if (e && e.exp > Date.now()) return e.data;
  if (e) __memCache.delete(key);
  return undefined;
}
function cacheSet(key: string, data: any, ttlMs: number) {
  __memCache.set(key, { exp: Date.now() + Math.max(0, ttlMs) , data });
}

async function sbFetch(path: string, query: Record<string, string | number | undefined>, cacheMs?: number): Promise<any> {
  const q = new URLSearchParams();
  const token = getSupplierToken() || DS_BEARER;
  if (!token) throw new Error('Silverbene token not configured');
  q.set('token', token);
  for (const [k, v] of Object.entries(query || {})) {
    if (v === undefined || v === null || v === '') continue;
    q.set(k, String(v));
  }
  const url = `${SB_DS_BASE.replace(/\/$/, '')}${path}?${q.toString()}`;
  const defaultTtl = Number(process.env['SUPPLIER_CACHE_TTL_MS'] || '300000'); // 5 minutes default
  const ttl = typeof cacheMs === 'number' ? cacheMs : defaultTtl;
  if (ttl > 0) {
    const hit = cacheGet(url);
    if (hit !== undefined) return hit;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Silverbene API ${res.status}`);
  const data = await res.json().catch(() => ({}));
  if (typeof data?.code !== 'undefined' && Number(data.code) !== 0) {
    throw new Error(`Silverbene error: ${data?.message || data?.code}`);
  }
  if (ttl > 0) cacheSet(url, data, ttl);
  return data;
}

function stripHtml(html: string | undefined): string {
  if (!html) return '';
  try { return String(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); } catch { return String(html); }
}

function mapSbProduct(p: any): ProductRow {
  const name = String(p?.title || 'Silverbene Product');
  const sku = String(p?.sku || '').trim();
  const slug = (sku ? `sb-${sku}` : name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
  const imgs: string[] = Array.isArray(p?.gallery) ? p.gallery : [];
  const opts: any[] = Array.isArray(p?.option) ? p.option : [];
  const pricesUsd = opts.map(o => Number(o?.price || 0)).filter(n => n>0);
  const minUsd = pricesUsd.length ? Math.min(...pricesUsd) : 0;
  const baseInr = minUsd * USD_INR;
  const priceInr = Math.round(baseInr * (1 + (isFinite(PRICE_MARKUP) ? PRICE_MARKUP : 0) / 100));
  const inventory = opts.reduce((s, o) => s + (Number(o?.qty || 0) || 0), 0);
  const variants = opts.map((o) => ({
    option_id: o?.option_id,
    attributes: Array.isArray(o?.attribute) ? o.attribute : [],
    price_usd: Number(o?.price || 0) || 0,
    price_inr: Math.round(((Number(o?.price || 0) || 0) * USD_INR) * (1 + (isFinite(PRICE_MARKUP) ? PRICE_MARKUP : 0) / 100)),
    qty: Number(o?.qty || 0) || 0,
  }));
  // Category detection by keyword (basic taxonomy)
  const blob = `${name} ${stripHtml(p?.desc)}`.toLowerCase();
  let category = 'Jewellery';
  if (/earring|earrings|stud|hoop/.test(blob)) category = 'Earrings';
  else if (/necklace|pendant|choker|chain/.test(blob)) category = 'Necklaces';
  else if (/ring\b|rings\b/.test(blob)) category = 'Rings';
  else if (/bracelet|bangle|kada|cuff/.test(blob)) category = 'Bracelets';
  else if (/anklet|payal/.test(blob)) category = 'Anklets';
  return {
    name,
    slug,
    price: priceInr,
    currency: 'INR',
    images: imgs.filter(Boolean),
    description: stripHtml(p?.desc) || name,
    category,
    tags: [],
    inventory,
    featured: false,
    variants,
    supplier: 'silverbene',
    supplier_sku: sku || null,
    supplier_data: p,
  };
}

// Admin: Import via documented product_list endpoint (supports sku list)
app.post('/api/admin/dropship/sb/import', requireAdmin, async (req, res) => {
  try {
    if (!supabase) { res.status(503).json({ error: 'Supabase not configured' }); return; }
    const { sku } = req.body || {};
    const q: any = {};
    if (sku) q.sku = String(sku);
    const data = await sbFetch('/product_list', q);
    const list: any[] = data?.data?.data || [];
    let upserted = 0;
    for (const raw of list) {
      const mapped = mapSbProduct(raw);
      const existing = await supabase.from('products').select('id').eq('supplier', 'silverbene').eq('supplier_sku', mapped.supplier_sku).maybeSingle();
      if (existing.data && existing.data.id) await supabase.from('products').update(mapped).eq('id', existing.data.id);
      else await supabase.from('products').insert([mapped]);
      upserted++;
    }
    res.json({ ok: true, upserted });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'SB import error' });
  }
});

// Admin: Import by date range
app.post('/api/admin/dropship/sb/import-by-date', requireAdmin, async (req, res) => {
  try {
    if (!supabase) { res.status(503).json({ error: 'Supabase not configured' }); return; }
    const { start_date, end_date, is_really_stock = 1, keywords } = req.body || {};
    if (!start_date || !end_date) { res.status(400).json({ error: 'Missing start_date/end_date' }); return; }
    const data = await sbFetch('/product_list_by_date', { start_date, end_date, is_really_stock, keywords });
    const list: any[] = data?.data?.data || [];
    let upserted = 0;
    for (const raw of list) {
      const mapped = mapSbProduct(raw);
      const existing = await supabase.from('products').select('id').eq('supplier', 'silverbene').eq('supplier_sku', mapped.supplier_sku).maybeSingle();
      if (existing.data && existing.data.id) await supabase.from('products').update(mapped).eq('id', existing.data.id);
      else await supabase.from('products').insert([mapped]);
      upserted++;
    }
    res.json({ ok: true, upserted });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'SB import-by-date error' });
  }
});

// Admin: refresh stock by option_id list
app.post('/api/admin/dropship/sb/stock', requireAdmin, async (req, res) => {
  try {
    if (!supabase) { res.status(503).json({ error: 'Supabase not configured' }); return; }
    const { option_ids } = req.body || {};
    if (!option_ids || (Array.isArray(option_ids) && option_ids.length === 0)) { res.status(400).json({ error: 'Missing option_ids' }); return; }
    const idsCsv = Array.isArray(option_ids) ? option_ids.join(',') : String(option_ids);
    const data = await sbFetch('/option_qty', { option_id: idsCsv }, 60000);
    const arr: any[] = Array.isArray(data?.data) ? data.data : [];
    // For simplicity, we'll fetch all supplier products and update in memory
    const { data: products } = await supabase.from('products').select('id, variants, supplier').eq('supplier', 'silverbene');
    const byId: Record<string, any> = {};
    for (const row of products || []) byId[row.id] = row;
    const updates: { id: string; variants: any[]; inventory: number }[] = [];
    for (const q of arr) {
      const oid = String(q?.option_id || q?.optionId || '');
      const qty = Number(q?.qyt || q?.qty || 0) || 0;
      for (const row of products || []) {
        const variants: any[] = Array.isArray(row.variants) ? row.variants : [];
        let changed = false;
        for (const v of variants) {
          if (String(v.option_id || '') === oid) { v.qty = qty; changed = true; }
        }
        if (changed) {
          const inv = variants.reduce((s, v) => s + (Number(v.qty || 0) || 0), 0);
          updates.push({ id: row.id, variants, inventory: inv });
        }
      }
    }
    for (const u of updates) {
      await supabase.from('products').update({ variants: u.variants, inventory: u.inventory }).eq('id', u.id);
    }
    res.json({ ok: true, updated: updates.length });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'SB stock refresh error' });
  }
});

// Admin: clear supplier cache
app.post('/api/admin/dropship/cache/clear', requireAdmin, async (_req, res) => {
  try {
    __memCache.clear();
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Cache clear error' });
  }
});

// Admin: delete product by slug (one-off utility)
app.delete('/api/admin/products/slug/:slug', requireAdmin, async (req, res) => {
  try {
    if (!supabase) { res.status(503).json({ error: 'Supabase not configured' }); return; }
    const slug = String((req.params as any)['slug'] || '').trim();
    if (!slug) { res.status(400).json({ error: 'Missing slug' }); return; }
    const { error, count } = await supabase.from('products').delete({ count: 'exact' as any }).eq('slug', slug);
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json({ ok: true, deleted: count || 0 });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Delete error' });
  }
});

// Public: get a thumbnail URL for a supplier product (first match by keywords)
app.get('/api/supplier/thumbnail', async (req, res) => {
  try {
    const keywords = String((req.query as any)['keywords'] || '').trim();
    if (!keywords) { res.status(400).json({ error: 'Missing keywords' }); return; }
    // Use recent two months window as elsewhere
    const now = new Date();
    const end = `${now.getFullYear()}-${now.getMonth()+1}`;
    const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth()-1, 1);
    const start = `${twoMonthsAgo.getFullYear()}-${twoMonthsAgo.getMonth()+1}`;
    const data = await sbFetch('/product_list_by_date', { start_date: start, end_date: end, is_really_stock: 1, keywords }, 300000);
    const list: any[] = data?.data?.data || [];
    for (const item of list) {
      const gal: string[] = Array.isArray(item?.gallery) ? item.gallery : [];
      const first = gal.find(Boolean);
      if (first) { res.json({ url: first }); return; }
    }
    res.json({ url: null });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Thumbnail error' });
  }
});

// Admin: import/sync catalog from Silverbene into our products table
app.post('/api/admin/dropship/import', requireAdmin, async (req, res) => {
  try {
    if (!supabase) { res.status(503).json({ error: 'Supabase not configured' }); return; }
    // Fetch first page; extend for pagination if needed
    const page = Number((req.body || {}).page || 1);
    const pageSize = Number((req.body || {}).limit || 100);
    const data = await dsFetch(`/products?page=${page}&limit=${pageSize}`);
    const list: any[] = Array.isArray(data?.products) ? data.products : (Array.isArray(data) ? data : []);
    let upserted = 0;
    for (const raw of list) {
      const mapped = mapDsProduct(raw);
      // Find existing by supplier sku
      const existing = await supabase.from('products').select('id').eq('supplier', 'silverbene').eq('supplier_sku', mapped.supplier_sku).maybeSingle();
      if (existing.data && existing.data.id) {
        await supabase.from('products').update(mapped).eq('id', existing.data.id);
      } else {
        await supabase.from('products').insert([mapped]);
      }
      upserted++;
    }
    res.json({ ok: true, upserted });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Import error' });
  }
});

// Admin: proxy view of supplier products (for quick checks)
app.get('/api/admin/dropship/products', requireAdmin, async (_req, res) => {
  try {
    const data = await dsFetch(`/products?limit=50`);
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Supplier fetch error' });
  }
});

// Admin: place dropship order at supplier
app.post('/api/admin/dropship/order', requireAdmin, async (req, res) => {
  try {
    const { items, shipping } = req.body || {};
    if (!Array.isArray(items) || !items.length) { res.status(400).json({ error: 'Missing items' }); return; }
    // Build supplier order payload (approximate; adjust to Silverbene spec as needed)
    const payload = {
      items: items.map((it: any) => ({ sku: it.sku || it.id || it.slug, quantity: Number(it.qty || 1) })),
      shipping,
    };
    const resp = await dsFetch('/orders', { method: 'POST', body: JSON.stringify(payload) } as any);
    const supplierOrderId = String(resp?.order_id || resp?.id || resp?.number || '');
    // Save minimal local order record to track
    if (supabase) {
      const amt = Number((req.body || {}).amount || 0);
      const cur = String((req.body || {}).currency || 'INR');
      const { data, error } = await supabase.from('orders').insert([{
        amount: amt, currency: cur, email: String((req.cookies?.['sb_email'] || '')).toLowerCase() || undefined,
        items, status: 'placed', supplier_order_id: supplierOrderId || null,
      }]).select('id').maybeSingle();
      if (error) { res.status(500).json({ error: error.message }); return; }
      res.json({ ok: true, supplierOrderId, id: data?.id });
      return;
    }
    res.json({ ok: true, supplierOrderId });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Dropship order error' });
  }
});

// Supplier webhook: tracking/status updates
app.post('/api/dropship/webhook', express.json(), async (req, res) => {
  try {
    // Simple shared-secret validation (replace with signature scheme if provided by supplier)
    const sig = String(req.headers['x-silverbene-signature'] || '');
    if (DS_WEBHOOK_SECRET && sig !== DS_WEBHOOK_SECRET) { res.status(401).json({ error: 'Invalid signature' }); return; }
    const ev = req.body || {};
    const supplierOrderId = String(ev?.order_id || ev?.id || ev?.number || '');
    const tracking = String(ev?.tracking_number || '');
    const carrier = String(ev?.carrier || '');
    if (!supplierOrderId) { res.status(400).json({ error: 'Missing supplier order id' }); return; }
    if (supabase) {
      await supabase.from('orders').update({ tracking_number: tracking || null, shipping_carrier: carrier || null, status: String(ev?.status || 'shipped') }).eq('supplier_order_id', supplierOrderId);
    }
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Webhook error' });
  }
});
app.get('/api/products', async (req, res, next) => {
  try {
    const q = String((req.query as any)['q'] || '').trim();
    const category = String((req.query as any)['category'] || '').trim();
    const min = Number((req.query as any)['min'] || '') || undefined;
    const max = Number((req.query as any)['max'] || '') || undefined;
    const featuredOnly = String((req.query as any)['featured'] || '').trim().toLowerCase() === 'true';

    // Supplier-only catalog mode (no DB) when NO_DB_CATALOG=1|true
    const NO_DB = /^(1|true)$/i.test(String(process.env['NO_DB_CATALOG'] || ''));
    if (NO_DB) {
      try {
        // Strategy: hunt windows up to ~12 months back to ensure we show products.
        const want = 36; // aim to show at least 36 items
        const acc: any[] = [];
        const now = new Date();
        // Try 6 two-month windows (last year) with real-time stock first
        for (let back = 0; back < 6 && acc.length < want; back++) {
          const endDate = new Date(now.getFullYear(), now.getMonth() - (back*2), 1);
          const startDate = new Date(now.getFullYear(), now.getMonth() - (back*2 + 1), 1);
          const end = `${endDate.getFullYear()}-${endDate.getMonth()+1}`;
          const start = `${startDate.getFullYear()}-${startDate.getMonth()+1}`;
          const data = await sbFetch('/product_list_by_date', { start_date: start, end_date: end, is_really_stock: 1, keywords: q || undefined });
          const raw: any[] = data?.data?.data || [];
          for (const r of raw) acc.push(r);
        }
        // If still empty, repeat without real-time stock limitation
        if (acc.length === 0) {
          for (let back = 0; back < 6 && acc.length < want; back++) {
            const endDate = new Date(now.getFullYear(), now.getMonth() - (back*2), 1);
            const startDate = new Date(now.getFullYear(), now.getMonth() - (back*2 + 1), 1);
            const end = `${endDate.getFullYear()}-${endDate.getMonth()+1}`;
            const start = `${startDate.getFullYear()}-${startDate.getMonth()+1}`;
            const data = await sbFetch('/product_list_by_date', { start_date: start, end_date: end, is_really_stock: 0, keywords: q || undefined });
            const raw: any[] = data?.data?.data || [];
            for (const r of raw) acc.push(r);
          }
        }
        let list = acc.map(mapSbProduct);
        // Deduplicate by supplier_sku
        const seen = new Set<string>();
        list = list.filter(p => { const k = (p as any).supplier_sku || p.slug; if (seen.has(k)) return false; seen.add(k); return true; });
        // Apply filters locally
        if (category) list = list.filter(p => p.category === category);
        if (typeof min === 'number') list = list.filter(p => p.price >= (min as number));
        if (typeof max === 'number') list = list.filter(p => p.price <= (max as number));
        if (q) list = list.filter(p => (p.name + ' ' + p.description).toLowerCase().includes(q.toLowerCase()));
        if (featuredOnly) list = list.filter((x: any) => x.featured === true);
        if (list.length === 0) res.setHeader('X-Supplier-Empty', '1');
        res.json(list);
        return;
      } catch (e) {
        console.warn('Supplier list error:', (e as any)?.message);
        res.setHeader('X-Supplier-Empty', '1');
        res.json([]);
        return;
      }
    }

    if (!supabase) {
      let list = getFallbackProducts();
      if (category) list = list.filter(p => p.category === category);
      if (typeof min === 'number') list = list.filter(p => p.price >= min!);
      if (typeof max === 'number') list = list.filter(p => p.price <= max!);
      if (q) list = list.filter(p => (p.name + ' ' + p.description + ' ' + (p.tags||[]).join(' ')).toLowerCase().includes(q.toLowerCase()));
      if (featuredOnly) list = list.filter((x: any) => x.featured === true);
      res.json(list);
      return;
    }
    let sel = supabase.from('products').select('*');
    if (category) sel = sel.eq('category', category);
    if (typeof min === 'number') sel = sel.gte('price', min as any);
    if (typeof max === 'number') sel = sel.lte('price', max as any);
    if (featuredOnly) sel = sel.eq('featured', true);
    if (q) sel = sel.or(`name.ilike.%${q}%,description.ilike.%${q}%,tags.cs.{${q}}` as any);
    const { data, error } = await sel.order('created_at', { ascending: false });
    if (error) {
      console.warn('Supabase products error:', error.message);
      res.json(getFallbackProducts());
      return;
    }
    res.json((data || []) as ProductRow[]);
    return;
  } catch (e) {
    console.warn('Products handler error:', e);
    res.json(getFallbackProducts());
    return;
  }
});

// Admin: Orders listing and detail
app.get('/api/admin/orders', requireAdmin, async (req, res) => {
  if (!supabase) { res.json([]); return; }
  const limit = Math.min(parseInt(String((req.query as any)['limit'] || '50'), 10) || 50, 200);
  const offset = parseInt(String((req.query as any)['offset'] || '0'), 10) || 0;
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data || []);
});

app.get('/api/admin/orders/:id', requireAdmin, async (req, res) => {
  if (!supabase) { res.status(404).json({ error: 'Not found' }); return; }
  const { id } = req.params;
  const { data, error } = await supabase.from('orders').select('*').eq('id', id).maybeSingle();
  if (error) { res.status(500).json({ error: error.message }); return; }
  if (!data) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(data);
});

// Admin: Rehost local images to Supabase Storage and update products
app.post('/api/admin/rehost-images', requireAdmin, async (_req, res) => {
  try {
    if (!supabase) { res.status(503).json({ error: 'Supabase not configured' }); return; }
    const { data: products, error } = await supabase.from('products').select('*');
    if (error) { res.status(500).json({ error: error.message }); return; }
    let updated = 0;
    for (const p of products || []) {
      const imgs: string[] = Array.isArray(p.images) ? p.images : [];
      const newImgs: string[] = [];
      let changed = false;
      for (const img of imgs) {
        if (typeof img === 'string' && img.startsWith('/assets/')) {
          // Try to read from built browser assets
          try {
            const filePath = join(browserDistFolder, img.replace(/^\//, ''));
            let buf: Buffer | null = null;
            let ext = (img.split('.').pop() || 'bin').toLowerCase();
            try {
              buf = await readFile(filePath);
            } catch {
              // Fallback: if original is .jpg/.jpeg, try corresponding .svg
              const svgPath = filePath.replace(/\.[^.]+$/, '.svg');
              try {
                buf = await readFile(svgPath);
                ext = 'svg';
              } catch {}
            }
            if (!buf) throw new Error('missing-asset');
            const key = `products/${new Date().getFullYear()}/${String(new Date().getMonth()+1).padStart(2,'0')}/${crypto.randomUUID()}.${ext}`;
            const contentType = ext === 'svg' ? 'image/svg+xml' : `image/${ext}`;
            const up = await supabase.storage.from(STORAGE_BUCKET).upload(key, buf, { contentType });
            if (!up.error) {
              const { data: pub } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(key);
              newImgs.push(pub.publicUrl);
              changed = true;
              continue;
            }
          } catch {}
        }
        newImgs.push(img);
      }
      if (changed) {
        const upd = await supabase.from('products').update({ images: newImgs }).eq('id', p.id);
        if (!upd.error) updated++;
      }
    }
    res.json({ ok: true, updated });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Rehost error' });
  }
});

app.get('/api/products/:slug', async (req, res, next) => {
  try {
    const NO_DB = /^(1|true)$/i.test(String(process.env['NO_DB_CATALOG'] || ''));
    if (NO_DB) {
      try {
        const slug = String(req.params.slug || '');
        const sku = slug.startsWith('sb-') ? slug.slice(3) : slug;
        const data = await sbFetch('/product_list', { sku });
        const item = ((data?.data?.data || []) as any[])[0];
        if (!item) { res.status(404).json({ error: 'Not found' }); return; }
        const mapped = mapSbProduct(item);
        res.json(mapped);
        return;
      } catch (e) {
        console.warn('Supplier item error:', (e as any)?.message);
        res.status(404).json({ error: 'Not found' });
        return;
      }
    }
    if (!supabase) {
      const item = getFallbackProducts().find((p) => p.slug === req.params.slug);
      if (!item) {
        res.status(404).json({ error: 'Not found' });
        return;
      }
      res.json(item);
      return;
    }
    const { data, error } = await supabase.from('products').select('*').eq('slug', req.params.slug).maybeSingle();
    if (error) {
      console.warn('Supabase product error:', error.message);
      const item = getFallbackProducts().find((p) => p.slug === req.params.slug);
      if (!item) {
        res.status(404).json({ error: 'Not found' });
        return;
      }
      res.json(item);
      return;
    }
    if (!data) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json(data as ProductRow);
    return;
  } catch (e) {
    console.warn('Product handler error:', e);
    const item = getFallbackProducts().find((p) => p.slug === req.params.slug);
    if (!item) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json(item);
    return;
  }
});

app.get('/api/categories', async (_req, res, next) => {
  try {
    const NO_DB = /^(1|true)$/i.test(String(process.env['NO_DB_CATALOG'] || ''));
    if (NO_DB) {
      try {
        // Build categories from the same rolling windows used in /api/products
        const want = 60;
        const acc: any[] = [];
        const now = new Date();
        for (let back = 0; back < 6 && acc.length < want; back++) {
          const endDate = new Date(now.getFullYear(), now.getMonth() - (back*2), 1);
          const startDate = new Date(now.getFullYear(), now.getMonth() - (back*2 + 1), 1);
          const end = `${endDate.getFullYear()}-${endDate.getMonth()+1}`;
          const start = `${startDate.getFullYear()}-${startDate.getMonth()+1}`;
          const data = await sbFetch('/product_list_by_date', { start_date: start, end_date: end, is_really_stock: 1 });
          const raw: any[] = data?.data?.data || [];
          for (const r of raw) acc.push(r);
        }
        const mapped = acc.map(mapSbProduct);
        const byCat = mapped.reduce<Record<string, number>>((acc, p) => { acc[p.category] = (acc[p.category] || 0) + 1; return acc; }, {});
        const cats = Object.entries(byCat).map(([name, count]) => ({ name, count })).sort((a,b) => b.count - a.count);
        res.json(cats);
        return;
      } catch {
        res.json([]);
        return;
      }
    }
    if (!supabase) {
      const cats = getFallbackProducts().reduce<Record<string, number>>((acc, p) => {
        acc[p.category] = (acc[p.category] || 0) + 1;
        return acc;
      }, {});
      res.json(Object.entries(cats).map(([name, count]) => ({ name, count })));
      return;
    }
    const { data, error } = await supabase.from('products').select('category');
    if (error) {
      console.warn('Supabase categories error:', error.message);
      const cats = getFallbackProducts().reduce<Record<string, number>>((acc, p) => {
        acc[p.category] = (acc[p.category] || 0) + 1;
        return acc;
      }, {});
      res.json(Object.entries(cats).map(([name, count]) => ({ name, count })));
      return;
    }
    const cats = (data || []).reduce<Record<string, number>>((acc, r: any) => {
      const key = r.category || 'Uncategorized';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    res.json(Object.entries(cats).map(([name, count]) => ({ name, count })));
    return;
  } catch (e) {
    console.warn('Categories handler error:', e);
    const cats = getFallbackProducts().reduce<Record<string, number>>((acc, p) => {
      acc[p.category] = (acc[p.category] || 0) + 1;
      return acc;
    }, {});
    res.json(Object.entries(cats).map(([name, count]) => ({ name, count })));
    return;
  }
});

app.post('/api/contact', async (req, res, next) => {
  try {
    const { name, email, message } = req.body || {};
    if (!name || !email || !message) {
      res.status(400).json({ error: 'Missing fields' });
      return;
    }
    if (!supabase) {
      console.warn('Supabase not configured, accepting contact without persistence');
      res.json({ ok: true, stored: false });
      return;
    }
    const { error } = await supabase.from('inquiries').insert([{ name, email, message }]);
    if (error) throw error;
    res.json({ ok: true, stored: true });
    return;
  } catch (e) {
    next(e);
    return;
  }
});

// Public order lookup by id + email (limited fields)
app.get('/api/orders/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const email = String((req.query as any).email || '').toLowerCase();
    if (!id || !email) { res.status(400).json({ error: 'Missing id/email' }); return; }
    if (!supabase) { res.status(404).json({ error: 'Not found' }); return; }
    const { data, error } = await supabase
      .from('orders')
      .select('id, amount, currency, status, created_at, razorpay_order_id, razorpay_payment_id, email')
      .eq('id', id)
      .maybeSingle();
    if (error) { res.status(500).json({ error: error.message }); return; }
    if (!data || String(data.email || '').toLowerCase() !== email) { res.status(404).json({ error: 'Not found' }); return; }
    const { email: _e, ...rest } = data as any;
    res.json(rest);
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Lookup error' });
  }
});


// SEO: robots.txt and sitemap.xml
app.get('/robots.txt', (req, res) => {
  const proto = (req.headers['x-forwarded-proto'] as string) || 'http';
  const host = (req.headers['x-forwarded-host'] as string) || req.headers.host || 'localhost:4000';
  const base = `${proto}://${host}`;
  res.type('text/plain').send(`User-agent: *
Allow: /

Sitemap: ${base}/sitemap.xml
`);
});

app.get('/sitemap.xml', async (req, res) => {
  const proto = (req.headers['x-forwarded-proto'] as string) || 'http';
  const host = (req.headers['x-forwarded-host'] as string) || req.headers.host || 'localhost:4000';
  const base = `${proto}://${host}`;
  const urls: string[] = [
    '/', '/collections', '/about', '/contact'
  ];
  try {
    let slugs: string[] = [];
    if (supabase) {
      const { data, error } = await supabase.from('products').select('slug');
      if (!error && Array.isArray(data)) slugs = data.map((r: any) => r.slug).filter(Boolean);
    } else {
      slugs = getFallbackProducts().map((p) => p.slug);
    }
    for (const s of slugs) urls.push(`/product/${s}`);
  } catch {}
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` +
    urls.map(u => `<url><loc>${base}${u}</loc></url>`).join('') +
    `</urlset>`;
  res.type('application/xml').send(xml);
});

// Liveness/Readiness
app.get('/healthz', async (_req, res) => {
  const status: any = { ok: true, supabase: false };
  try {
    if (supabase) {
      // lightweight check
      const ping = await supabase.from('products').select('id').limit(1);
      status.supabase = !ping.error;
    }
  } catch {}
  res.json(status);
});


/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

// If a static asset with an extension wasn't found above, do NOT SSR it.
// Returning HTML for a missing JS/CSS causes "MIME type text/html" errors in browsers.
app.use((req, res, next) => {
  const extReq = /\.(?:js|mjs|css|map|json|png|jpg|jpeg|svg|webp|ico|woff2?|ttf)$/.test(req.path);
  if (extReq) {
    res.status(404).end();
    return;
  }
  next();
});

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

// Basic error handler for API
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Note: Let Angular SSR handle all unmatched routes via angularApp above.

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
console.log('SSR boot check: isMainModule=', isMainModule(import.meta.url), 'pm_id=', process.env['pm_id']);
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
