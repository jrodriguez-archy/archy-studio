#!/usr/bin/env node
// Pixel diff between a render and Paper's export.
// Usage: node scripts/compare.mjs out/original-post.png templates/<id>/reference/post.png
import fs from 'node:fs';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const [a, b] = process.argv.slice(2);
const A = PNG.sync.read(fs.readFileSync(a));
const B = PNG.sync.read(fs.readFileSync(b));
if (A.width !== B.width || A.height !== B.height) {
  console.error(`Size mismatch: ${A.width}×${A.height} vs ${B.width}×${B.height}`);
  process.exit(1);
}
const { width, height } = A;
const diff = new PNG({ width, height });
const n = pixelmatch(A.data, B.data, diff.data, width, height, { threshold: 0.1, includeAA: false });
const out = a.replace(/\.png$/, '.diff.png');
fs.writeFileSync(out, PNG.sync.write(diff));

// Bounding box of differing pixels, to point at the region that moved.
let minX = width, minY = height, maxX = -1, maxY = -1;
for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
  const i = (y * width + x) * 4;
  if (diff.data[i] === 255 && diff.data[i + 1] === 0 && diff.data[i + 2] === 0) {
    if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y;
  }
}
const pct = (100 * n) / (width * height);
console.log(`${pct.toFixed(3)}% differing pixels (${n})${maxX >= 0 ? `, region x${minX}-${maxX} y${minY}-${maxY}` : ''} → ${out}`);
process.exitCode = pct <= 0.5 ? 0 : 3;
