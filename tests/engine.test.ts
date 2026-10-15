import fs from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright-core';
import { compose, withStableIds } from '@/lib/compose';
import { ORIGIN, MIME } from '@/lib/fill';
import { render } from '@/lib/renderer';
import { ROOT, listTemplates, loadManifest } from '@/lib/templates';

// The page engine (scripts/fit.js, edits.js, components.js) in Chromium, as the renderer and Canvas run it.
// Needs Chromium: `npx playwright install chromium`.

describe('every template renders with its sample copy', async () => {
  const templates = (await listTemplates()).map((t) => t.id);
  it.each(templates)('%s', async (template) => {
    const format = Object.keys((await loadManifest(template)).formats)[0];
    const r = await render({ template, format, slots: {}, fillDefaults: true });
    expect(r.report.errors).toEqual([]);
    expect(r.png.length).toBeGreaterThan(10_000);
  });
});

describe('exploration editing', () => {
  let browser: Browser;
  let page: Page;
  const html = `<div data-name="Ground" style="position:absolute; inset:0; background: linear-gradient(180deg, var(--color-royal-blue-500), var(--color-primary-blue-600))"></div>
<div data-name="Content" style="position:absolute; left:80px; top:80px; right:80px; display:flex; flex-direction:column; gap:24px">
  <div data-name="Kicker" style="display:inline-flex; align-self:flex-start; align-items:center; gap:12px; padding:10px 20px; border-radius:999px; background: var(--color-white)">
    <span style="display:inline-block; width:12px; height:12px; border-radius:6px; background: var(--color-royal-blue-500)"></span>
    <span data-name="Kicker text" style="font-size:24px; color: var(--color-royal-blue-500)">New</span>
  </div>
  <h1 data-name="Headline" style="margin:0; font-size:80px; color: var(--color-white)">Run your <span style="color: var(--color-sky-blue-400)">whole practice</span> here</h1>
  <img data-name="Team photo" src="placeholder:scene" style="width:300px; height:200px; object-fit:cover">
  <div data-name="Hero" data-image="placeholder:person" style="width:400px; height:300px; background-size:cover"></div>
  <div data-name="Stat card" style="padding:24px; border-radius:24px; background: var(--color-white)"><p style="margin:0">32%</p><p style="margin:0">more booked hours</p></div>
  <span data-icon="Calendar03Icon" data-name="Icon Calendar" style="width:48px; height:48px; color: white"></span>
  <div data-piece="mascot" data-name="Mascot" style="width:240px"></div>
</div>`;
  type W = Window & Record<string, (...a: unknown[]) => unknown>;
  const id = (name: string) => page.evaluate((n) => (document.querySelector(`[data-name="${n}"]`) as HTMLElement).dataset.node!, name);

  beforeAll(async () => {
    const c = await compose({ html: withStableIds(html), width: 1080, height: 1350, brand: 'archy' });
    browser = await chromium.launch();
    page = await browser.newPage({ viewport: { width: 1080, height: 1350 } });
    await page.route(`${ORIGIN}/**`, async (route) => {
      const rel = decodeURIComponent(new URL(route.request().url()).pathname).slice(1);
      if (rel === '__exploration.html') return route.fulfill({ body: c.page, contentType: 'text/html' });
      try { await route.fulfill({ body: await fs.readFile(path.join(ROOT, rel)), contentType: MIME[path.extname(rel)] ?? 'application/octet-stream', headers: { 'Access-Control-Allow-Origin': '*' } }); } catch { await route.fulfill({ status: 404 }); }
    });
    await page.goto(`${ORIGIN}/__exploration.html`);
    for (const f of ['fit.js', 'edits.js', 'components.js']) await page.addScriptTag({ content: await fs.readFile(path.join(ROOT, 'scripts', f), 'utf8') });
    await page.evaluate(async () => {
      const w = window as unknown as W;
      await w.__fill({ format: 'post', formats: ['post'], values: {}, rules: { slots: {} }, limits: {} });
      w.__applyEdits({}, {}, {});
    });
  });
  afterAll(async () => { await browser?.close(); });

  it('lists the ground as the background, pills and cards as one thing, rich copy as one text', async () => {
    const comps = await page.evaluate(() => ((window as unknown as W).__components() as { comps: { id: string; kind: string; name: string }[] }).comps);
    const by = (name: string) => comps.find((c) => c.name === name);
    expect(comps[0]).toMatchObject({ kind: 'background', id: await id('Ground') });
    expect(by('Kicker')?.kind).toBe('tag');
    expect(by('Stat card')?.kind).toBe('tag');
    expect(by('Headline')?.kind).toBe('text');
    expect(by('Team photo photo')?.kind).toBe('photo');
    expect(comps.find((c) => c.kind === 'icon')?.id).toMatch(/^x[0-9a-z]+i$/);
    expect(by('Mascot')?.kind).toBe('decoration');
  });

  it('applies fill, typed rich copy (cleaned) and a new <img>, and puts them back', async () => {
    const [ground, head, img] = [await id('Ground'), await id('Headline'), await id('Team photo')];
    const r = await page.evaluate(([ground, head, img, origin]) => {
      const w = window as unknown as W;
      const q = (i: string) => document.querySelector(`[data-node="${i}"]`) as HTMLElement;
      w.__applyEdits({
        [ground]: { style: { backgroundColor: 'rgb(0, 0, 78)' } },
        [head]: { html: 'Run <b>all</b> <span style="color:red" onclick="x()">here</span><script>bad()</script>' },
        [img]: { image: 'asset:new' },
      }, { 'asset:new': `${origin}/library/placeholders/person.png` }, {});
      const on = { ground: getComputedStyle(q(ground)).backgroundColor, head: q(head).innerHTML, img: q(img).getAttribute('src') };
      w.__applyEdits({}, {}, {});
      return { on, off: { head: q(head).textContent, img: q(img).getAttribute('src') } };
    }, [ground, head, img, ORIGIN] as const);
    expect(r.on.ground).toBe('rgb(0, 0, 78)');
    expect(r.on.head).toBe('Run <b>all</b> <span style="color:red">here</span>');
    expect(r.on.img).toMatch(/person\.png$/);
    expect(r.off.head).toBe('Run your whole practice here');
    expect(r.off.img).toMatch(/scene\.png$/);
  });

  it('recolours the ground with a preset and lets an exploration photo be reframed', async () => {
    const ground = await id('Ground');
    const r = await page.evaluate((ground) => {
      const w = window as unknown as W;
      w.__applyEdits({ ':theme': { preset: 'light' } }, {}, {});
      const out = { ground: getComputedStyle(document.querySelector(`[data-node="${ground}"]`)!).backgroundColor, crop: w.__canCrop(document.querySelector('[data-name="Hero"]')) };
      w.__applyEdits({}, {}, {});
      return out;
    }, ground);
    expect(r.ground).toBe('rgb(255, 255, 255)');
    expect(r.crop).toBe(true);
  });

  it('keys layers across formats by name only', async () => {
    const keys = await page.evaluate(() => Object.values((window as unknown as W).__keys() as Record<string, { key: string }>).map((k) => k.key));
    expect(keys).toContain('name:Headline#1');
    expect(keys).toContain(':ground');
    expect(keys.filter((k) => /^\/|#\d+$/.test(k) && !k.startsWith('name:'))).toEqual([]);
  });
});
