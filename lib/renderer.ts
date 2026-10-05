import fs from 'node:fs/promises';
import path from 'node:path';
import type { Browser } from 'playwright-core';
import { ROOT, loadManifest, loadRules } from './templates';

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
      return chromium.launch({ executablePath: await sparticuz.executablePath(), args: sparticuz.args, headless: true });
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
};

export type RenderReport = {
  format: string;
  ok: boolean;
  slots: Record<string, { status: string; scale?: number; wrapped?: boolean; groupWrapped?: boolean; lines?: number; fontSize?: number }>;
  errors: { slot?: string; node?: string; code: string; message?: string; maxLength?: number; reason?: string }[];
};

export async function render({ template, format, slots, scale = 1 }: RenderInput) {
  const manifest = await loadManifest(template);
  const f = manifest.formats[format];
  if (!f) throw new Error(`Template ${template} has no format "${format}". Formats: ${Object.keys(manifest.formats).join(', ')}`);
  const unknown = Object.keys(slots).filter((k) => !manifest.slots[k]);
  if (unknown.length) throw new Error(`Unknown slots: ${unknown.join(', ')}. Slots: ${Object.keys(manifest.slots).join(', ')}`);
  const rules = await loadRules(template, manifest);
  fitJs ??= await fs.readFile(path.join(ROOT, 'scripts', 'fit.js'), 'utf8');

  const t: Record<string, number> = {};
  let t0 = Date.now();
  const mark = (k: string) => { t[k] = Date.now() - t0; t0 = Date.now(); };
  const browser = await getBrowser();
  mark('browser');
  const context = await browser.newContext({
    viewport: { width: f.width, height: f.height },
    deviceScaleFactor: Math.min(Math.max(scale, 1), 3),
  });
  try {
    const page = await context.newPage();
    await page.route(`${ORIGIN}/**`, async (route) => {
      const rel = decodeURIComponent(new URL(route.request().url()).pathname).replace(/^\/+/, '');
      const file = path.resolve(ROOT, rel);
      const allowed = ['templates', 'fonts'].some((d) => file.startsWith(path.join(ROOT, d) + path.sep));
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
      // Image values: an https URL, or a path inside the template (assets/...).
      values[k] = manifest.slots[k].type === 'image' && v && !/^https:\/\//.test(v) ? `${ORIGIN}/templates/${template}/${v}` : v;
    }
    const limits = Object.fromEntries(Object.entries(manifest.slots).map(([k, s]) => [k, s.limits]));
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
    return { png, report, width: f.width, height: f.height, timing: t };
  } finally {
    await context.close();
  }
}
