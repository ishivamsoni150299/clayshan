import {
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
    description: 'Handcrafted 925 sterling silver with a clean, modern silhouette. Hypoallergenic and rhodium‑plated for lasting shine.',
    category: p.category,
    tags: p.tags,
  }));
}

/** API routes **/
// Admin auth helpers
const ADMIN_PASSWORD = process.env['ADMIN_PASSWORD'] || '';
const ADMIN_EMAILS = (process.env['ADMIN_EMAILS'] || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
const COOKIE_NAME = 'admintoken';
const SB_TOKEN = 'sb_token';
const SB_EMAIL = 'sb_email';
function makeToken(): string {
  const h = crypto.createHash('sha256');
  h.update(ADMIN_PASSWORD || '');
  return h.digest('hex');
}
function isAdmin(req: express.Request): boolean {
  const t = req.cookies?.[COOKIE_NAME];
  if (ADMIN_PASSWORD && t === makeToken()) return true;
  const e = (req.cookies?.[SB_EMAIL] || '').toLowerCase();
  if (ADMIN_EMAILS.length && e && ADMIN_EMAILS.includes(e)) return true;
  return false;
}
function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!ADMIN_PASSWORD) { res.status(503).json({ error: 'Admin not configured' }); return; }
  if (!isAdmin(req)) { res.status(401).json({ error: 'Unauthorized' }); return; }
  return next();
}

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body || {};
  if (!ADMIN_PASSWORD) { res.status(503).json({ error: 'Admin not configured' }); return; }
  if (password !== ADMIN_PASSWORD) { res.status(401).json({ error: 'Invalid password' }); return; }
  res.cookie(COOKIE_NAME, makeToken(), { httpOnly: true, sameSite: 'lax', secure: false, maxAge: 7 * 24 * 3600 * 1000 });
  res.json({ ok: true });
  return;
});

app.post('/api/admin/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

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
    res.cookie(SB_TOKEN, token, { httpOnly: true, sameSite: 'lax', secure: false, maxAge: 7 * 24 * 3600 * 1000 });
    res.cookie(SB_EMAIL, String(email).toLowerCase(), { httpOnly: true, sameSite: 'lax', secure: false, maxAge: 7 * 24 * 3600 * 1000 });
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
      res.json({ ok: true, id: data?.id || razorpay_order_id });
      return;
    }
    res.json({ ok: true, id: razorpay_order_id });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Verification error' });
  }
});
app.get('/api/products', async (_req, res, next) => {
  try {
    if (!supabase) {
      res.json(getFallbackProducts());
      return;
    }
    const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
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
