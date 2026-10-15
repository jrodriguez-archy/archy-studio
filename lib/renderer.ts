import fs from 'node:fs/promises';
import path from 'node:path';
import type { Browser } from 'playwright-core';
import type { Edits, PhotoFit, RenderReport, Suggestion } from './canvas-shared';
import { MIME, ORIGIN, prepareFill, type RenderInput } from './fill';
import { ROOT } from './templates';

export { MissingRequired, prepareFill, type RenderInput } from './fill';

let browserPromise: Promise<Browser> | null = null;
let current: Browser | null = null; // what browserPromise gave, once it did

// One browser per instance, shared by every render on it. Renders that find it gone start one new browser
// together (the first to notice launches it, the others wait for that one).
async function getBrowser(): Promise<Browser> {
  const seen = browserPromise;
  if (seen) {
    // A launch that failed is forgotten (the next render tries again), never kept as this instance's browser.
    const b = await seen.catch(() => null);
    if (b?.isConnected()) return b;
    if (browserPromise !== seen) return getBrowser();
  }
  const launching = (async () => {
    const { chromium } = await import('playwright-core');
    if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
      const sparticuz = (await import('@sparticuz/chromium')).default;
      // --single-process leaves Chromium unusable once a context closes, which hangs the next
      // request on a reused (warm) function instance.
      const args = sparticuz.args.filter((a: string) => a !== '--single-process');
      return chromium.launch({ executablePath: await sparticuz.executablePath(), args, headless: true });
    }
    // Local: the Chromium downloaded by `npx playwright install chromium`.
    return chromium.launch({ headless: true });
  })();
  browserPromise = launching;
  current = null;
  launching.then((b) => { if (browserPromise === launching) current = b; }, () => { if (browserPromise === launching) browserPromise = null; });
  return launching;
}

// A browser that stopped answering: closed, and the next render starts a new one (unless one already has).
function retire(browser: Browser) {
  if (current === browser) { browserPromise = null; current = null; }
  browser.close().catch(() => {});
}

const fontFiles = new Map<string, Promise<{ body: Buffer; type: string }>>();
function fontshare(url: string) {
  let p = fontFiles.get(url);
  if (!p) {
    p = fetch(url, { signal: AbortSignal.timeout(10_000) }).then(async (r) => {
      if (!r.ok) throw new Error(`Fontshare ${r.status}`);
      return { body: Buffer.from(await r.arrayBuffer()), type: r.headers.get('content-type') ?? 'application/octet-stream' };
    });
    p.catch(() => fontFiles.delete(url));
    fontFiles.set(url, p);
  }
  return p;
}

// A fresh context. A warm instance can hold a dead browser: if it does not answer quickly, a new one starts.
// A browser busy with other renders (formats drawn side by side) is only slow: it gets more time instead,
// since closing it would end those renders too.
async function newContext(options: Parameters<Browser['newContext']>[0]) {
  const browser = await getBrowser();
  const pending = browser.newContext(options);
  const context = await withTimeout(pending, 5000).catch(() => null);
  if (context) return context;
  if (browser.isConnected() && browser.contexts().length > 0) {
    const late = await withTimeout(pending, 20_000).catch(() => null);
    if (late) return late;
  }
  pending.then((c) => c.close(), () => {});
  retire(browser);
  return (await getBrowser()).newContext(options);
}

// In the page: every image it shows, loaded (or given up on after 15 s, so one stuck image never holds
// the render until the function's limit). Plain code only, no named inner functions: it runs in the page
// as written (a bundler's name helpers are not there).
async function imagesReady(selector: string) {
  await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 10_000))]);
  const urls = new Set<string>();
  for (const el of document.querySelectorAll<HTMLElement>(selector)) {
    const m = getComputedStyle(el).backgroundImage.match(/url\("?(.*?)"?\)/);
    if (m) urls.add(m[1]);
  }
  const waits: Promise<unknown>[] = [];
  for (const u of urls) {
    waits.push(new Promise((res) => { const t = setTimeout(res, 15_000); const i = new Image(); i.onload = i.onerror = () => { clearTimeout(t); res(null); }; i.src = u; }));
  }
  for (const i of Array.from(document.images)) {
    if (!i.complete) waits.push(new Promise((res) => { const t = setTimeout(res, 15_000); i.onload = i.onerror = () => { clearTimeout(t); res(null); }; }));
  }
  await Promise.all(waits);
}

let fitJs: string | null = null;
let editsJs: string | null = null;

// A component as Claude sees it: what it is, what it says, where it sits and where it aligns.
export type InspectedComp = {
  id: string; kind: string; name: string; parent: string | null; slot?: string; textId?: string; textSlot?: string; iconId?: string;
  text?: string; layout?: string; hidden: boolean; box: { x: number; y: number; w: number; h: number }; alignBox: { x: number; y: number; w: number; h: number; name?: string } | null;
};
let componentsJs: string | null = null;

export type { RenderReport };

export async function render({ template, format, design, theme, slots: given, scale = 1, fillDefaults = false, edits: handEdits = {}, framing, inspect = false, autofix = false, smallerText = false, exploration }: RenderInput) {
  const plan = await prepareFill({ template, format, design, theme, slots: given, fillDefaults, edits: handEdits, smallerText, exploration });
  const { variant, slots, width, height } = plan;
  fitJs ??= await fs.readFile(path.join(ROOT, 'scripts', 'fit.js'), 'utf8');
  editsJs ??= await fs.readFile(path.join(ROOT, 'scripts', 'edits.js'), 'utf8');

  const t: Record<string, number> = {};
  let t0 = Date.now();
  const mark = (k: string) => { t[k] = Date.now() - t0; t0 = Date.now(); };
  const contextOptions = { viewport: { width, height }, deviceScaleFactor: Math.min(Math.max(scale, 1), 3) };
  const context = await newContext(contextOptions);
  mark('browser');
  try {
    const page = await context.newPage();
    await page.route(`${ORIGIN}/**`, async (route) => {
      const rel = decodeURIComponent(new URL(route.request().url()).pathname).replace(/^\/+/, '');
      // An exploration's page is composed, not a file.
      if (plan.page && rel === '__exploration.html') return route.fulfill({ body: plan.page, contentType: 'text/html' });
      const file = path.resolve(ROOT, rel);
      const allowed = ['templates', 'fonts', 'library', 'brand-kit'].some((d) => file.startsWith(path.join(ROOT, d) + path.sep));
      if (!allowed) return route.fulfill({ status: 404 });
      try {
        const body = await fs.readFile(file);
        await route.fulfill({ body, contentType: MIME[path.extname(file)] ?? 'application/octet-stream' });
      } catch {
        await route.fulfill({ status: 404 });
      }
    });
    // DOC's Satoshi comes from Fontshare: fetched once per server instance, not on every render (and a
    // failed fetch is tried again next time instead of the PNG quietly using a fallback font).
    await page.route(/^https:\/\/(api|cdn)\.fontshare\.com\//, async (route) => {
      try {
        const got = await fontshare(route.request().url());
        await route.fulfill({ body: got.body, contentType: got.type, headers: { 'Access-Control-Allow-Origin': '*' } });
      } catch { await route.abort(); }
    });
    await page.goto(`${ORIGIN}/${plan.page ? '__exploration.html' : plan.html}`, { waitUntil: 'load' });
    mark('load');
    await page.addScriptTag({ content: fitJs });
    await page.evaluate(() => document.fonts.ready);

    const report = (await page.evaluate(
      // @ts-expect-error __fill is defined by fit.js inside the page
      (a) => window.__fill(a),
      plan.fill,
    )) as RenderReport;
    // Framing asked for by slot: worked out on the photos as drawn, kept as crop edits (what Canvas shows
    // and reframes), and where each photo sits (for "Generate content around").
    let edits = handEdits;
    let framed: Edits = {};
    let fits: Record<string, { node: string; fit: PhotoFit }> = {};
    const scripted = !!(framing && Object.keys(framing).length);
    if (scripted) {
      await page.addScriptTag({ content: editsJs });
      ({ framed, fits } = (await page.evaluate(frameSlots, framing!)) as { framed: Edits; fits: typeof fits });
      edits = { ...framed, ...handEdits };
    }
    // Inspecting needs edits.js even without edits: it keeps the design's baseline for the Inspector.
    if (Object.keys(edits).length || inspect || autofix) {
      if (!scripted) await page.addScriptTag({ content: editsJs });
      // @ts-expect-error __applyEdits is defined by edits.js inside the page
      await page.evaluate(([e, u, i]) => window.__applyEdits(e, u, i), [edits, plan.imageUrls, plan.iconSvgs] as const);
      await page.evaluate(() => document.fonts.ready);
    }
    let inspected: { comps: InspectedComp[]; tokens: Record<string, string>; review: Suggestion[] } | null = null;
    let fixed: Edits | null = null;
    if (inspect || autofix) {
      componentsJs ??= await fs.readFile(path.join(ROOT, 'scripts', 'components.js'), 'utf8');
      await page.addScriptTag({ content: componentsJs });
    }
    if (autofix) {
      // @ts-expect-error __autofix is defined by components.js inside the page
      fixed = (await page.evaluate(([e, r, f, u, i]) => window.__autofix(e, r, f, u, i), [edits, plan.fill.rules, format, plan.imageUrls, plan.iconSvgs] as const)) as Edits;
      await page.evaluate(() => document.fonts.ready);
    }
    if (inspect) {
      // @ts-expect-error __inspect is defined by components.js inside the page
      const seen = (await page.evaluate(() => window.__inspect())) as { comps: InspectedComp[]; tokens: Record<string, string> };
      // @ts-expect-error __review is defined by components.js inside the page
      const review = (await page.evaluate(([e, r, f]) => window.__review(e, r, f), [fixed ?? edits, plan.fill.rules, format] as const)) as Suggestion[];
      inspected = { ...seen, review };
    }
    mark('fit');

    await page.evaluate(imagesReady, '[style*="background-image"]');
    mark('images');
    const png = await page.locator('body > [data-node]').screenshot({ animations: 'disabled', type: 'png' });
    mark('screenshot');
    return { png, report, design: plan.design, theme: plan.theme, variant, slots, width, height, timing: t, inspected, fixed, framed, fits };
  } finally {
    await context.close();
  }
}

// In the page (edits.js loaded): each framed slot's photos, placed so the focus point sits at the frame's
// centre as far as the photo allows (never leaving a gap at zoom 1 or more).
function frameSlots(framing: Record<string, { focusX?: number; focusY?: number; zoom?: number }>) {
  type W = { __canCrop: (n: Element) => boolean; __photoWindow: (n: Element) => { x: number; y: number; w: number; h: number } };
  const w = window as unknown as W;
  const framed: Record<string, { crop: { x: number; y: number; zoom: number; src?: string } }> = {};
  const fits: Record<string, { node: string; fit: unknown }> = {};
  for (const [slot, f] of Object.entries(framing)) {
    for (const n of document.querySelectorAll<HTMLElement>(`[data-slot="${CSS.escape(slot)}"][data-slot-type="image"]`)) {
      if (!w.__canCrop(n) || !n.dataset.node) continue;
      const { x, y, w: ww, h } = w.__photoWindow(n), iw = +n.dataset.imgW!, ih = +n.dataset.imgH!;
      const zoom = Math.max(0.2, Math.min(5, f.zoom ?? 1));
      const k = Math.max(ww / iw, h / ih) * zoom, bw = iw * k, bh = ih * k;
      // As background-position %: where the focus lands at the centre, kept inside what the photo allows.
      const pos = (w0: number, size: number, img: number, focus: number) => {
        const room = size - img;
        if (Math.abs(room) < 0.5) return 50;
        const want = w0 + size / 2 - (focus / 100) * img;
        return Math.max(0, Math.min(100, ((want - w0) / room) * 100));
      };
      const cx = pos(x, ww, bw, f.focusX ?? 50), cy = pos(y, h, bh, f.focusY ?? 50);
      // Plain code only: this function runs in the page as written (no bundler helpers in scope).
      const crop: { x: number; y: number; zoom: number; src?: string } = { x: +cx.toFixed(2), y: +cy.toFixed(2), zoom: +zoom.toFixed(3) };
      if (n.dataset.slotSrc) crop.src = n.dataset.slotSrc;
      framed[n.dataset.node] = { crop };
      if (!fits[slot]) fits[slot] = { node: n.dataset.node, fit: { W: { x, y, w: ww, h }, iw, ih, bw, bh, px: x + (ww - bw) * (cx / 100), py: y + (h - bh) * (cy / 100) } };
    }
  }
  return { framed, fits };
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);
}


// ---- Explorations (lib/compose.ts): a page Claude wrote in the brand kit, drawn and checked ----

let exploreJs: string | null = null;

export type ExploreIssue = { layer: string | null; code: string; message: string };
export type ExploreReport = { ok: boolean; errors: ExploreIssue[]; warnings: ExploreIssue[] };
export type ExploreChecks = { maskW: number; maskH: number; safe: { x: number; y: number; w: number; h: number }; palette: string[]; fonts: string[]; minText: number; minLogo: number; minHeadline: number; roomHeadline: number; smallText: number; maxGap: number; holeWarn: number; holeError: number; bigPhoto: number };

// The page is cut off from everything but the kit, the fonts and the images it was given.
export async function renderComposition({ page: html, images, width, height, scale = 1, checks }: { page: string; images: string[]; width: number; height: number; scale?: number; checks: ExploreChecks }) {
  exploreJs ??= await fs.readFile(path.join(ROOT, 'scripts', 'explore-check.js'), 'utf8');
  const context = await newContext({ viewport: { width, height }, deviceScaleFactor: Math.min(Math.max(scale, 1), 3) });
  try {
    const page = await context.newPage();
    const allowed = new Set(images);
    await page.route('**/*', async (route) => {
      const url = route.request().url();
      if (url === `${ORIGIN}/__exploration.html`) return route.fulfill({ body: html, contentType: 'text/html' });
      if (url.startsWith(`${ORIGIN}/`)) {
        const file = path.resolve(ROOT, decodeURIComponent(new URL(url).pathname).replace(/^\/+/, ''));
        if (!['fonts', 'library', 'brand-kit'].some((d) => file.startsWith(path.join(ROOT, d) + path.sep))) return route.fulfill({ status: 404 });
        try { return route.fulfill({ body: await fs.readFile(file), contentType: MIME[path.extname(file)] ?? 'application/octet-stream' }); } catch { return route.fulfill({ status: 404 }); }
      }
      if (allowed.has(url)) return route.continue();
      return route.abort();
    });
    await page.goto(`${ORIGIN}/__exploration.html`, { waitUntil: 'load' });
    await page.evaluate(imagesReady, '[data-image]');
    await page.addScriptTag({ content: exploreJs });
    const seen = (await page.evaluate((o) => (window as unknown as { __exploreCheck: (o: unknown) => unknown }).__exploreCheck(o), checks)) as {
      errors: ExploreIssue[]; warnings: ExploreIssue[]; texts: SeenText[];
    };
    const artboard = page.locator('body > [data-node="root"]');
    // Contrast on the pixels behind each text: the text drawn transparent, the ground read where it sits.
    await page.evaluate(() => (window as unknown as { __hideText: (on: boolean) => void }).__hideText(true));
    const ground = await artboard.screenshot({ animations: 'disabled', type: 'png' });
    await page.evaluate(() => (window as unknown as { __hideText: (on: boolean) => void }).__hideText(false));
    const { issues: contrast, calm } = await contrastIssues(ground, seen.texts, width, checks.smallText);
    const png = await artboard.screenshot({ animations: 'disabled', type: 'png' });
    // A calm, even part of the photo that already reads (a dark sky, the inside of a mouth) is its own scrim.
    const onCalm = (e: ExploreIssue) => e.code === 'scrim' && calm.some((t) => t.layer === e.layer && e.message.includes(`"${t.text.slice(0, 40)}"`));
    const errors = [...seen.errors.filter((e) => !onCalm(e)), ...contrast];
    // A headline set in a calm area of the photo is as big as that area allows, not its column.
    const calmLayers = new Set(seen.errors.filter(onCalm).map((e) => e.layer));
    const warnings = seen.warnings.filter((w) => !(w.code === 'headline-room' && calmLayers.has(w.layer)));
    return { png, report: { ok: errors.length === 0, errors, warnings } as ExploreReport };
  } finally {
    await context.close();
  }
}

// WCAG contrast of each text against the ground under it, at its worst tenth (a photo or a texture is
// not one colour). Under 3:1 is refused; small text needs 4.5:1. `calm`: the texts whose ground is even
// (all but its lightest and darkest 2% within 2:1: a soft gradient is calm, a tooth or an edge is not) and
// reads at its size's contrast at its worst.
type Box = { x: number; y: number; w: number; h: number };
type SeenText = { layer: string; text: string; box: Box; lines?: Box[]; color: number[] | null; size: number };
async function contrastIssues(png: Buffer, texts: SeenText[], width: number, smallText: number): Promise<{ issues: ExploreIssue[]; calm: SeenText[] }> {
  const sharp = (await import('sharp')).default;
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const k = info.width / width;
  const lum = (r: number, g: number, b: number) => {
    const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const out: ExploreIssue[] = [];
  const calm: SeenText[] = [];
  for (const t of texts) {
    if (!t.color) continue;
    const x0 = Math.max(0, Math.floor(t.box.x * k)), y0 = Math.max(0, Math.floor(t.box.y * k));
    const x1 = Math.min(info.width, Math.ceil((t.box.x + t.box.w) * k)), y1 = Math.min(info.height, Math.ceil((t.box.y + t.box.h) * k));
    if (x1 <= x0 || y1 <= y0) continue;
    const step = Math.max(1, Math.round(Math.sqrt(((x1 - x0) * (y1 - y0)) / 4000)));
    const ground: number[][] = [];
    for (let y = y0; y < y1; y += step) for (let x = x0; x < x1; x += step) { const i = (y * info.width + x) * 3; ground.push([data[i], data[i + 1], data[i + 2]]); }
    if (!ground.length) continue;
    // A see-through text colour lands on the ground: blend it over the ground's middle tone.
    const mid = ground.map((c) => lum(c[0], c[1], c[2])).sort((a, b) => a - b)[Math.floor(ground.length / 2)];
    const midPx = ground.find((c) => lum(c[0], c[1], c[2]) === mid) ?? ground[0];
    const a = t.color[3] ?? 1;
    const ink = [0, 1, 2].map((i) => a * t.color![i] + (1 - a) * midPx[i]);
    const li = lum(ink[0], ink[1], ink[2]);
    const ratios = ground.map((c) => { const lg = lum(c[0], c[1], c[2]); return (Math.max(li, lg) + 0.05) / (Math.min(li, lg) + 0.05); }).sort((x, y) => x - y);
    const worst = ratios[Math.floor(ratios.length * 0.1)];
    const need = t.size < smallText ? 4.5 : 3;
    // Calm is read under the lines' letters (not the corners of a ragged block), at a finer step.
    const lums: number[] = [];
    for (const b of t.lines?.length ? t.lines : [t.box]) {
      const lx0 = Math.max(0, Math.floor(b.x * k)), ly0 = Math.max(0, Math.floor(b.y * k));
      const lx1 = Math.min(info.width, Math.ceil((b.x + b.w) * k)), ly1 = Math.min(info.height, Math.ceil((b.y + b.h) * k));
      const st = Math.max(1, Math.round(Math.sqrt(((lx1 - lx0) * (ly1 - ly0)) / 3000)));
      for (let y = ly0; y < ly1; y += st) for (let x = lx0; x < lx1; x += st) { const i = (y * info.width + x) * 3; lums.push(lum(data[i], data[i + 1], data[i + 2])); }
    }
    lums.sort((x, y) => x - y);
    // Nearly all of it: a few teeth or an edge under a line of copy make it not calm.
    const lo = lums[Math.floor(lums.length * 0.02)], hi = lums[Math.min(lums.length - 1, Math.floor(lums.length * 0.98))];
    if ((hi + 0.05) / (lo + 0.05) < 2 && worst >= need) calm.push(t);
    if (worst < need && t.size === 999) out.push({ layer: t.layer, code: 'contrast', message: `The Archy logo is hard to see: contrast ${worst.toFixed(1)}:1 with what is behind it (needs 3:1). Use data-on="light" on a light ground, or move it onto a solid area or a shade.` });
    else if (worst < need) out.push({ layer: t.layer, code: 'contrast', message: `"${t.text.slice(0, 40)}" is hard to read: contrast ${worst.toFixed(1)}:1 with what is behind it (needs ${need}:1). Change its colour, or put it on a solid ground or a shade.` });
  }
  return { issues: out, calm };
}
