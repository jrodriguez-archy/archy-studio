import fs from 'node:fs/promises';
import path from 'node:path';
import type { Browser } from 'playwright-core';
import type { Edits, RenderReport, Suggestion } from './canvas-shared';
import { MIME, ORIGIN, prepareFill, type RenderInput } from './fill';
import { ROOT } from './templates';

export { MissingRequired, prepareFill, type RenderInput } from './fill';

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
let editsJs: string | null = null;

// A component as Claude sees it: what it is, what it says, where it sits and where it aligns.
export type InspectedComp = {
  id: string; kind: string; name: string; parent: string | null; slot?: string; textId?: string; textSlot?: string; iconId?: string;
  text?: string; layout?: string; hidden: boolean; box: { x: number; y: number; w: number; h: number }; alignBox: { x: number; y: number; w: number; h: number; name?: string } | null;
};
let componentsJs: string | null = null;

export type { RenderReport };

export async function render({ template, format, slots: given, scale = 1, fillDefaults = false, edits = {}, inspect = false, autofix = false }: RenderInput) {
  const plan = await prepareFill({ template, format, slots: given, fillDefaults, edits });
  const { variant, slots, width, height } = plan;
  fitJs ??= await fs.readFile(path.join(ROOT, 'scripts', 'fit.js'), 'utf8');
  editsJs ??= await fs.readFile(path.join(ROOT, 'scripts', 'edits.js'), 'utf8');

  const t: Record<string, number> = {};
  let t0 = Date.now();
  const mark = (k: string) => { t[k] = Date.now() - t0; t0 = Date.now(); };
  const contextOptions = { viewport: { width, height }, deviceScaleFactor: Math.min(Math.max(scale, 1), 3) };
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
    await page.goto(`${ORIGIN}/${plan.html}`, { waitUntil: 'load' });
    mark('load');
    await page.addScriptTag({ content: fitJs });
    await page.evaluate(() => document.fonts.ready);

    const report = (await page.evaluate(
      // @ts-expect-error __fill is defined by fit.js inside the page
      (a) => window.__fill(a),
      plan.fill,
    )) as RenderReport;
    // Inspecting needs edits.js even without edits: it keeps the design's baseline for the Inspector.
    if (Object.keys(edits).length || inspect || autofix) {
      await page.addScriptTag({ content: editsJs });
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
    return { png, report, variant, slots, width, height, timing: t, inspected, fixed };
  } finally {
    await context.close();
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);
}

