import fs from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright-core';
import { compose, withStableIds } from '@/lib/compose';
import { ORIGIN, MIME } from '@/lib/fill';
import { ROOT } from '@/lib/templates';
import { guarded } from '@/components/canvas/stage-pages';

// What Canvas does (components/canvas/stage.tsx): the composed page written into a same-origin iframe with
// srcdoc, guarded by a nonce, then the engine scripts added with that nonce.
describe('Canvas iframe', () => {
  let browser: Browser;
  let page: Page;
  beforeAll(async () => {
    browser = await chromium.launch();
    page = await browser.newPage();
    await page.route(`${ORIGIN}/**`, async (route) => {
      const rel = decodeURIComponent(new URL(route.request().url()).pathname).slice(1);
      if (rel === '__host.html') return route.fulfill({ body: '<!doctype html><html><body></body></html>', contentType: 'text/html' });
      try { await route.fulfill({ body: await fs.readFile(path.join(ROOT, rel)), contentType: MIME[path.extname(rel)] ?? 'application/octet-stream' }); } catch { await route.fulfill({ status: 404 }); }
    });
    await page.goto(`${ORIGIN}/__host.html`);
  });
  afterAll(async () => { await browser?.close(); });

  it('runs the engine and nothing that came with the HTML', async () => {
    const c = await compose({ html: withStableIds('<h1 data-name="Headline" style="color: white">Hello</h1>'), width: 1080, height: 1350, brand: 'archy' });
    // What slipped past the sanitizer (were there a hole) is written straight into the page.
    const attack = '<img src="data:x" onerror="parent.__hit = 1"><a id="j" href="javascript:parent.__hit=2">x</a><script>parent.__hit = 3</script>';
    const written = guarded(c.page.replace('</body>', `${attack}</body>`), 'n0nce');
    const scripts = await Promise.all(['fit.js', 'edits.js', 'components.js'].map((f) => fs.readFile(path.join(ROOT, 'scripts', f), 'utf8')));
    const result = await page.evaluate(async ({ written, scripts }) => {
      const f = document.createElement('iframe');
      f.style.width = '1080px'; f.style.height = '1350px';
      document.body.appendChild(f);
      await new Promise<void>((done) => { f.addEventListener('load', () => done(), { once: true }); f.srcdoc = written; });
      const d = f.contentDocument!;
      for (const text of scripts) { const s = d.createElement('script'); s.nonce = 'n0nce'; s.textContent = text; d.head.appendChild(s); }
      (d.getElementById('j') as HTMLAnchorElement).click();
      await new Promise((r) => setTimeout(r, 300));
      const w = f.contentWindow as unknown as Record<string, unknown>;
      return { hit: (window as unknown as Record<string, unknown>).__hit ?? null, engine: typeof w.__fill === 'function' && typeof w.__applyEdits === 'function' };
    }, { written, scripts });
    expect(result).toEqual({ hit: null, engine: true });
  });
});
