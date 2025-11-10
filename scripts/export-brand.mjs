#!/usr/bin/env node
// Export brand SVGs to PNG/ICO/WebP using sharp (optional dependency).
// Usage: node scripts/export-brand.mjs

import { promises as fs } from 'node:fs';
import path from 'node:path';

let sharp = null;
try { sharp = (await import('sharp')).default; } catch {
  console.error('sharp not installed. Run: npm i -D sharp');
  process.exit(1);
}

const root = process.cwd();
const SRC = path.join(root, 'public', 'assets', 'brand');
const OUT = SRC; // export next to svgs

const tasks = [
  { src: 'clayshan-mark.svg', outs: [
      { name: 'clayshan-mark-512.png', w: 512, h: 512 },
      { name: 'clayshan-mark-192.png', w: 192, h: 192 },
      { name: 'clayshan-mark-32.png',  w: 32,  h: 32  },
      { name: 'favicon-32.png',        w: 32,  h: 32  }
    ]
  },
  { src: 'clayshan-logo.svg', outs: [
      { name: 'clayshan-logo-1600.png', w: 1600, h: 400 }
    ]
  },
  { src: 'clayshan-og-1200x630.svg', outs: [
      { name: 'clayshan-og-1200x630.png', w: 1200, h: 630 },
      { name: 'clayshan-og-1200x630.webp', w: 1200, h: 630 }
    ]
  }
];

for (const t of tasks) {
  const svgPath = path.join(SRC, t.src);
  const svg = await fs.readFile(svgPath);
  for (const o of t.outs) {
    const outPath = path.join(OUT, o.name);
    let img = sharp(svg, { density: 300 }).resize(o.w, o.h, { fit: 'cover' });
    if (o.name.endsWith('.webp')) {
      img = img.webp({ quality: 88 });
    } else if (o.name.endsWith('.png')) {
      img = img.png({ compressionLevel: 9 });
    }
    await img.toFile(outPath);
    console.log('Wrote', outPath);
  }
}
console.log('Brand exports complete.');

