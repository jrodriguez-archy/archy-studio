import fs from 'node:fs/promises';
import path from 'node:path';
import type { Browser } from 'playwright-core';
import { ROOT, loadConfig, loadLibrary, loadManifest, loadRules } from './templates';

// Template files are served to the page from disk under a fake origin, so relative URLs
// (../../fonts/fonts.css, assets/*.png) resolve the same way they do locally.
const ORIGIN = 'https://templates.local';
const MIME: Record<string, string> = {
  '.html': 'text/html', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.svg': 'image/svg+xml',
};

let browserPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (browserPromise) {
    const b = await browserPromise;
    if (b.isConnected()) return b;
  }
  browserPromise = (async () => {
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
  return browserPromise;
}

let fitJs: string | null = null;

export type RenderInput = {
  template: string;
  format: string;
  slots: Record<string, string | null>;
  scale?: number;
  /** Previews only: slots not given keep the template's sample copy. */
  fillDefaults?: boolean;
};

export class MissingRequired extends Error {
  constructor(public slots: string[]) {
    super(`Missing required: ${slots.join(', ')}`);
  }
}

export type RenderReport = {
  format: string;
  ok: boolean;
  slots: Record<string, { status: string; scale?: number; wrapped?: boolean; groupWrapped?: boolean; lines?: number; fontSize?: number }>;
  errors: { slot?: string; node?: string; code: string; message?: string; maxLength?: number; reason?: string }[];
};

export async function render({ template, format, slots: given, scale = 1, fillDefaults = false }: RenderInput) {
  const manifest = await loadManifest(template);
  const config = await loadConfig(template);
  if (!manifest.formats[format]) throw new Error(`Template ${template} has no format "${format}". Formats: ${Object.keys(manifest.formats).join(', ')}`);
  const unknown = Object.keys(given).filter((k) => !manifest.slots[k]);
  if (unknown.length) throw new Error(`Unknown slots: ${unknown.join(', ')}. Slots: ${Object.keys(manifest.slots).join(', ')}`);

  // Every slot gets a decision: the given value, the template's sample (previews only), or empty.
  const slots: Record<string, string | null> = {};
  for (const [k, s] of Object.entries(manifest.slots)) {
    const v = given[k];
    slots[k] = v != null && v !== '' ? v : k in given || !fillDefaults ? null : s.default;
  }
  for (const [k, d] of Object.entries(config.derive ?? {})) {
    const src = slots[d.from];
    if (!slots[k] && src) slots[k] = (d.firstWord ? src.trim().split(/\s+/)[0] : src) + (d.suffix ?? '');
  }
  const missingRequired = (config.required ?? []).filter((k) => !slots[k]);
  if (missingRequired.length) throw new MissingRequired(missingRequired);

  // Variant: the first one whose condition matches (e.g. no photo → "no-photo").
  const variant = Object.entries(manifest.variants ?? {}).find(([, v]) => (v.when?.empty ?? []).every((k) => !slots[k]))?.[0] ?? null;
  const emptyImage = Object.entries(manifest.slots).find(([k, s]) => s.type === 'image' && !slots[k])?.[0];
  if (!variant && emptyImage) throw new MissingRequired([emptyImage]);
  const f = variant ? manifest.variants![variant].formats[format] : manifest.formats[format];
  if (!f) throw new Error(`Template ${template} variant ${variant} has no format "${format}"`);

  const rules = await loadRules(template, manifest);
  if (variant && rules.variants?.[variant]?.slots) {
    for (const [k, o] of Object.entries(rules.variants[variant].slots)) rules.slots[k] = { ...(rules.slots[k] as object), ...o };
  }
  fitJs ??= await fs.readFile(path.join(ROOT, 'scripts', 'fit.js'), 'utf8');

  const t: Record<string, number> = {};
  let t0 = Date.now();
  const mark = (k: string) => { t[k] = Date.now() - t0; t0 = Date.now(); };
  const contextOptions = { viewport: { width: f.width, height: f.height }, deviceScaleFactor: Math.min(Math.max(scale, 1), 3) };
  let browser = await getBrowser();
  // A warm instance can hold a dead browser: if it does not answer quickly, start a fresh one.
  let context = await withTimeout(browser.newContext(contextOptions), 5000).catch(() => null);
  if (!context) {
    await browser.close().catch(() => {});
    browserPromise = null;
    browser = await getBrowser();
    context = await browser.newContext(contextOptions);
  }
  mark('browser');
  try {
    const page = await context.newPage();
    await page.route(`${ORIGIN}/**`, async (route) => {
      const rel = decodeURIComponent(new URL(route.request().url()).pathname).replace(/^\/+/, '');
      const file = path.resolve(ROOT, rel);
      const allowed = ['templates', 'fonts', 'library'].some((d) => file.startsWith(path.join(ROOT, d) + path.sep));
      if (!allowed) return route.fulfill({ status: 404 });
      try {
        const body = await fs.readFile(file);
        await route.fulfill({ body, contentType: MIME[path.extname(file)] ?? 'application/octet-stream' });
      } catch {
        await route.fulfill({ status: 404 });
      }
    });
    await page.goto(`${ORIGIN}/templates/${template}/${f.html}`, { waitUntil: 'load' });
    mark('load');
    await page.addScriptTag({ content: fitJs });
    await page.evaluate(() => document.fonts.ready);

    const values: Record<string, string | null> = {};
    for (const [k, v] of Object.entries(slots)) {
      const type = manifest.slots[k].type;
      values[k] = !v ? v : type === 'logo' ? await resolveLogo(template, v) : type === 'image' ? await resolveImage(template, v) : v;
    }
    const limitKey = variant ? `${format}--${variant}` : format;
    const limits = Object.fromEntries(Object.entries(manifest.slots).map(([k, s]) => [k, s.limits && { [format]: s.limits[limitKey] }]));
    const report = (await page.evaluate(
      // @ts-expect-error __fill is defined by fit.js inside the page
      (a) => window.__fill(a),
      { format, formats: Object.keys(manifest.formats), values, rules, limits },
    )) as RenderReport;
    mark('fit');

    await page.evaluate(async () => {
      await document.fonts.ready;
      const urls = new Set<string>();
      for (const el of document.querySelectorAll<HTMLElement>('[style*="background-image"]')) {
        const m = getComputedStyle(el).backgroundImage.match(/url\("?(.*?)"?\)/);
        if (m) urls.add(m[1]);
      }
      await Promise.all([...urls].map((u) => new Promise((res) => { const i = new Image(); i.onload = i.onerror = res; i.src = u; })));
    });
    mark('images');
    const png = await page.locator('body > [data-node]').screenshot({ animations: 'disabled', type: 'png' });
    mark('screenshot');
    return { png, report, variant, slots, width: f.width, height: f.height, timing: t };
  } finally {
    await context.close();
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);
}

// Image slot values: `asset:<id>` from the approved library, an https URL, or a path inside the template.
// Logos are inlined as data URLs so the page can use them as a CSS mask (no cross-origin limits).
async function resolveLogo(template: string, v: string): Promise<string> {
  const src = await resolveImage(template, v);
  if (src.startsWith(ORIGIN)) {
    const rel = decodeURIComponent(new URL(src).pathname).replace(/^\/+/, '');
    const file = path.resolve(ROOT, rel);
    const body = await fs.readFile(file);
    return `data:${MIME[path.extname(file)] ?? 'image/png'};base64,${body.toString('base64')}`;
  }
  const res = await fetch(src, { headers: { 'User-Agent': 'Mozilla/5.0 ArchyStudio' } });
  if (!res.ok) throw new Error(`Could not load the logo at ${v} (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > 5_000_000) throw new Error(`The logo at ${v} is larger than 5 MB`);
  const type = res.headers.get('content-type')?.split(';')[0] || 'image/png';
  return `data:${type};base64,${buf.toString('base64')}`;
}

async function resolveImage(template: string, v: string): Promise<string> {
  if (v.startsWith('asset:')) {
    const asset = (await loadLibrary()).find((a) => a.id === v.slice(6));
    if (!asset) throw new Error(`Unknown asset: ${v.slice(6)}. Use list_assets to see the approved ones.`);
    return `${ORIGIN}/library/${asset.file}`;
  }
  if (/^https:\/\//.test(v)) return v;
  return `${ORIGIN}/templates/${template}/${v}`;
}
