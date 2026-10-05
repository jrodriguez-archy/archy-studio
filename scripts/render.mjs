#!/usr/bin/env node
// Fill a template with a case and render PNGs at the artboard's exact size.
// Usage:
//   node scripts/render.mjs templates/<id> --case cases/long.json [--format post,stories] [--scale 1]
//   node scripts/render.mjs templates/<id> --calibrate
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : dflt; };
const dir = path.resolve(args[0]);
const manifest = JSON.parse(await fs.readFile(path.join(dir, 'manifest.json'), 'utf8'));
const rules = JSON.parse(await fs.readFile(path.join(dir, 'rules.json'), 'utf8'));
rules.optionals = manifest.optionals;
const formats = (opt('format') ?? Object.keys(manifest.formats).join(',')).split(',');
const scale = Number(opt('scale', '1'));
const outDir = path.resolve(opt('out', 'out'));
const fitJs = await fs.readFile(new URL('./fit.js', import.meta.url), 'utf8');
await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch();

async function open(format) {
  const f = manifest.formats[format];
  const page = await browser.newPage({ viewport: { width: f.width, height: f.height }, deviceScaleFactor: scale });
  await page.goto(pathToFileURL(path.join(dir, f.html)).href);
  // --css: what-if layout override for experiments (never used in production renders).
  if (opt('css')) await page.addStyleTag({ content: await fs.readFile(opt('css'), 'utf8') });
  await page.addScriptTag({ content: fitJs });
  await page.evaluate(() => document.fonts.ready);
  return page;
}

async function settle(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    const urls = new Set();
    for (const el of document.querySelectorAll('[style*="background-image"]')) {
      const m = getComputedStyle(el).backgroundImage.match(/url\("?(.*?)"?\)/);
      if (m) urls.add(m[1]);
    }
    await Promise.all([...urls].map((u) => new Promise((res) => { const i = new Image(); i.onload = i.onerror = res; i.src = u; })));
  });
}

if (args.includes('--calibrate')) {
  const limits = {};
  for (const format of formats) {
    const page = await open(format);
    const res = await page.evaluate((a) => window.__calibrate(a), { format, formats: Object.keys(manifest.formats), rules });
    for (const [role, l] of Object.entries(res)) (limits[role] ??= {})[format] = l;
    await page.close();
  }
  for (const [role, perFormat] of Object.entries(limits)) manifest.slots[role].limits = perFormat;
  await fs.writeFile(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify(limits, null, 2));
} else {
  const casePath = opt('case');
  const kase = casePath ? JSON.parse(await fs.readFile(casePath, 'utf8')) : { name: 'original', slots: {} };
  // Image values are paths relative to the project root → absolute file URLs.
  const values = Object.fromEntries(Object.entries(kase.slots).map(([k, v]) => [
    k, manifest.slots[k]?.type === 'image' && v ? pathToFileURL(path.resolve(v)).href : v,
  ]));
  let allOk = true;
  for (const format of formats) {
    const page = await open(format);
    const report = await page.evaluate((a) => window.__fill(a), { format, formats: Object.keys(manifest.formats), values, rules, limits: Object.fromEntries(Object.entries(manifest.slots).map(([k, v]) => [k, v.limits])) });
    await settle(page);
    const file = path.join(outDir, `${kase.name}-${format}${scale !== 1 ? `@${scale}x` : ''}.png`);
    await page.locator('body > [data-node]').screenshot({ path: file, animations: 'disabled' });
    await fs.writeFile(file.replace(/\.png$/, '.json'), JSON.stringify(report, null, 2));
    allOk &&= report.ok;
    const summary = Object.entries(report.slots).map(([k, s]) => `${k}:${s.status}${s.scale && s.scale !== 1 ? `@${Math.round(s.scale * 100)}%` : ''}${s.wrapped ? '/wrap' : ''}`).join(' ');
    console.log(`${report.ok ? 'OK  ' : 'FAIL'} ${path.relative(process.cwd(), file)}  ${summary}`);
    for (const e of report.errors) console.log(`     ${e.code} ${e.slot ?? e.node}: ${e.message ?? ''}`);
    await page.close();
  }
  process.exitCode = allOk ? 0 : 2;
}
await browser.close();
