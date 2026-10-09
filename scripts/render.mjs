#!/usr/bin/env node
// Fill a template with a case and render PNGs at the artboard's exact size.
// Usage:
//   node scripts/render.mjs templates/<id> --case cases/long.json [--format post,stories] [--scale 1]
//   node scripts/render.mjs templates/<id> --case cases/long.json --design the-arch --theme navy
//   node scripts/render.mjs templates/<id> --case cases/long.json --combos all   (every design × theme)
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

// A design × theme combo: null for the default one (the base formats).
const comboOf = (design, theme) => {
  if (!manifest.combos || !design && !theme) return null;
  const d = design ?? manifest.default.design, t = theme ?? manifest.default.theme;
  if (d === manifest.default.design && t === manifest.default.theme) return null;
  if (!manifest.combos[`${d}--${t}`]) throw new Error(`No combo ${d}--${t}`);
  return `${d}--${t}`;
};
// Fit rules for a variant and a design: a variant adds options to slot rules; a design replaces the
// slot rules (and containers) it names, since its layers differ.
function rulesFor(variant, combo) {
  const r = structuredClone(rules);
  for (const [k, o] of Object.entries(r.variants?.[variant]?.slots ?? {})) r.slots[k] = { ...r.slots[k], ...o };
  const d = combo && r.designs?.[manifest.combos[combo].design];
  if (d) { Object.assign(r.slots, d.slots ?? {}); if (d.containers) r.containers = d.containers; if (d.fill !== undefined) r.fill = d.fill; }
  return r;
}

async function open(format, variant = null, combo = null) {
  const f = combo ? manifest.combos[combo].formats[format] : variant ? manifest.variants[variant].formats[format] : manifest.formats[format];
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
  const jobs = formats.map((format) => ({ format, variant: null, combo: null }));
  for (const [variant, v] of Object.entries(manifest.variants ?? {})) for (const format of Object.keys(v.formats)) jobs.push({ format, variant, combo: null });
  for (const [combo, c] of Object.entries(manifest.combos ?? {})) for (const format of Object.keys(c.formats)) jobs.push({ format, variant: null, combo });
  for (const { format, variant, combo } of jobs) {
    const page = await open(format, variant, combo);
    const r = rulesFor(variant, combo);
    const res = await page.evaluate((a) => window.__calibrate(a), { format, formats: Object.keys(manifest.formats), rules: r });
    const key = combo ? `${format}--${combo}` : variant ? `${format}--${variant}` : format;
    for (const [role, l] of Object.entries(res)) (limits[role] ??= {})[key] = l;
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
  const combos = opt('combos') === 'all' ? [null, ...Object.keys(manifest.combos ?? {})] : [comboOf(opt('design'), opt('theme'))];
  for (const combo of combos) for (const format of formats) {
    const page = await open(format, null, combo);
    const key = combo ? `${format}--${combo}` : format;
    const limits = Object.fromEntries(Object.entries(manifest.slots).map(([k, v]) => [k, v.limits && { [format]: v.limits[key] }]));
    const report = await page.evaluate((a) => window.__fill(a), { format, formats: Object.keys(manifest.formats), values, rules: rulesFor(null, combo), limits });
    await settle(page);
    const file = path.join(outDir, `${kase.name}-${key}${scale !== 1 ? `@${scale}x` : ''}.png`);
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
