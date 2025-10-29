import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE;
const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'product-images';

if (!url || !serviceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE in env');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

function getProducts(urls) {
  return [
    {
      name: 'Kundan Statement Necklace',
      slug: 'kundan-statement-necklace',
      price: 12999,
      currency: 'INR',
      images: [urls.kundan],
      description: 'A modern take on classic Kundan work with subtle gold tones.',
      category: 'Necklaces',
      tags: ['kundan', 'gold', 'statement'],
    },
    {
      name: 'Pearl Drop Earrings',
      slug: 'pearl-drop-earrings',
      price: 4999,
      currency: 'INR',
      images: [urls.pearl],
      description: 'Delicate freshwater pearls with gold-plated finish for everyday elegance.',
      category: 'Earrings',
      tags: ['pearls', 'minimal'],
    },
    {
      name: 'Temple Coin Bracelet',
      slug: 'temple-coin-bracelet',
      price: 6999,
      currency: 'INR',
      images: [urls.coin],
      description: 'Inspired by traditional motifs with a clean, modern profile.',
      category: 'Bracelets',
      tags: ['temple', 'coin'],
    },
    {
      name: 'Gemstone Stack Ring',
      slug: 'gemstone-stack-ring',
      price: 3499,
      currency: 'INR',
      images: [urls.ring],
      description: 'Stackable ring with a pop of color and polished finish.',
      category: 'Rings',
      tags: ['gemstone', 'stackable'],
    },
  ];
}

async function ensureBucket() {
  const { data: buckets } = await supabase.storage.listBuckets();
  if (!buckets?.find((b) => b.name === bucket)) {
    await supabase.storage.createBucket(bucket, { public: true });
  }
}

async function uploadFile(localPath, key, contentType) {
  try {
    if (!existsSync(localPath)) throw new Error('Missing file: ' + localPath);
    const file = readFileSync(localPath);
    const { error } = await supabase.storage.from(bucket).upload(key, file, { contentType, upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from(bucket).getPublicUrl(key);
    return data.publicUrl;
  } catch (e) {
    console.warn('Upload failed', key, e?.message);
    return null;
  }
}

async function main() {
  await ensureBucket();
  const base = 'products/seed';
  const urls = {
    kundan: (await uploadFile('public/assets/products/kundan-necklace-1.svg', `${base}/kundan-necklace-1.svg`, 'image/svg+xml')) || '/assets/products/kundan-necklace-1.svg',
    pearl: (await uploadFile('public/assets/products/pearl-earrings-1.svg', `${base}/pearl-earrings-1.svg`, 'image/svg+xml')) || '/assets/products/pearl-earrings-1.svg',
    coin: (await uploadFile('public/assets/products/coin-bracelet-1.svg', `${base}/coin-bracelet-1.svg`, 'image/svg+xml')) || '/assets/products/coin-bracelet-1.svg',
    ring: (await uploadFile('public/assets/products/stack-ring-1.svg', `${base}/stack-ring-1.svg`, 'image/svg+xml')) || '/assets/products/stack-ring-1.svg',
  };
  const check = await supabase.from('products').select('id').limit(1);
  if (check.error) {
    console.error('Products check failed:', check.error.message);
    process.exit(1);
  }
  if (check.data && check.data.length > 0) {
    console.log('Products table already has data; skipping seed.');
    return;
  }
  const toInsert = getProducts(urls);
  const ins = await supabase.from('products').insert(toInsert);
  if (ins.error) {
    console.error('Insert failed:', ins.error.message);
    process.exit(1);
  }
  console.log(`Inserted ${toInsert.length} products.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
