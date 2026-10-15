#!/usr/bin/env node
// Template images as WebP: each assets/*.png gets a .webp beside it (photos at quality 92, images with
// transparency lossless) and the template's pages and manifest point to the WebP. The PNG stays, so a
// design saved with `assets/<id>.png` as a slot value still opens. Run by sync.mjs; on its own:
//   node scripts/webp-assets.mjs templates/<id> [templates/<id> …]   (no argument: every template)
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

export async function webpAssets(dir) {
  const assets = path.join(dir, 'assets');
  const pngs = (await fs.readdir(assets).catch(() => [])).filter((f) => f.endsWith('.png'));
  let made = 0, before = 0, after = 0;
  for (const f of pngs) {
    const src = path.join(assets, f), out = src.replace(/\.png$/, '.webp');
    const exists = await fs.stat(out).then(() => true, () => false);
    if (!exists) {
      const meta = await sharp(src).metadata();
      // Opaque photos lossy (invisible at this quality), anything with transparency lossless (edges stay clean).
      const transparent = meta.hasAlpha && !(await sharp(src).stats()).isOpaque;
      await sharp(src).webp(transparent ? { lossless: true, effort: 5 } : { quality: 92, effort: 5, smartSubsample: true }).toFile(out);
      made++;
    }
    before += (await fs.stat(src)).size; after += (await fs.stat(out)).size;
  }
  // Pages and manifest: assets/<id>.png → assets/<id>.webp wherever the WebP exists.
  const have = new Set(pngs.map((f) => f.replace(/\.png$/, '')));
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.html') || f === 'manifest.json');
  for (const f of files) {
    const p = path.join(dir, f);
    const text = await fs.readFile(p, 'utf8');
    const next = text.replace(/assets\/([A-Za-z0-9_-]+)\.png/g, (m, id) => (have.has(id) ? `assets/${id}.webp` : m));
    if (next !== text) await fs.writeFile(p, next);
  }
  return { made, before, after };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'templates');
  const dirs = process.argv.length > 2 ? process.argv.slice(2).map((d) => path.resolve(d)) : (await fs.readdir(root, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => path.join(root, d.name));
  let b = 0, a = 0;
  for (const d of dirs) {
    const r = await webpAssets(d);
    b += r.before; a += r.after;
    if (r.made) console.log(`${path.basename(d)}: ${r.made} WebP made`);
  }
  console.log(`Template images: ${(b / 1e6).toFixed(1)} MB as PNG → ${(a / 1e6).toFixed(1)} MB served as WebP`);
}
