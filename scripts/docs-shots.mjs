#!/usr/bin/env node
// Screenshots for the Docs (public/docs/*.webp), taken from the running app. Opens its own Chromium
// window with a separate profile (.docs-shots/): sign in there the first time; later runs reuse it.
// Without --examples it only looks: nothing is created or changed.
// Usage: node scripts/docs-shots.mjs [baseUrl] (default http://localhost:3001). PHOTO_LINK=<request id> adds
// the photo link page. --examples (run with node --env-file=.env.local): first makes a few example sets from
// templates in Canvas (their sample copy) so the gallery has something to show, archives two of them for the
// Archive picture, and deletes them all at the end, even if something fails (files and records): only what it made.
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import sharp from 'sharp';

const args = process.argv.slice(2);
const EXAMPLES = args.includes('--examples');
const BASE = args.find((a) => a.startsWith('http')) ?? 'http://localhost:3001';
const OUT = path.resolve('public/docs');
const TEMPLATES = ['booth-icon-list', 'countdown-mascot', 'speaker-invite', 'night-out-photo-fade', 'booth-photo-band', 'photo-headline'];
await fs.mkdir(OUT, { recursive: true });

const db = EXAMPLES ? (await import('@supabase/supabase-js')).createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY) : null;
const ctx = await chromium.launchPersistentContext(path.resolve('.docs-shots'), { headless: false, viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = ctx.pages()[0] ?? (await ctx.newPage());
const wait = (ms) => page.waitForTimeout(ms);
const made = []; // ids of the example designs saved

// Everything visible loaded (images, fonts), then the picture, as WebP. No dev-tools badge.
async function shot(name) {
  await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' }).catch(() => {});
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].filter((i) => i.getBoundingClientRect().top < innerHeight).map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; setTimeout(r, 8000); }))));
  });
  await wait(400);
  await sharp(await page.screenshot()).webp({ quality: 82 }).toFile(path.join(OUT, `${name}.webp`));
  console.log(`✓ ${name}`);
}

// The example sets go: their files, then their records (drafts follow their design).
async function cleanup() {
  if (!EXAMPLES || !made.length) return;
  const { data: sets } = await db.from('renders').select('set_id').in('id', made);
  const setIds = [...new Set((sets ?? []).map((r) => r.set_id))];
  const { data } = await db.from('renders').select('id, storage_path').in('set_id', setIds);
  const paths = (data ?? []).map((r) => r.storage_path);
  await db.storage.from('renders').remove(paths.flatMap((p) => [p, p.replace(/\.png$/, '.thumb.webp')]));
  await db.storage.from('thumbs').remove(paths.flatMap((p) => [p.replace(/\.png$/, '.thumb.webp'), p.replace(/\.png$/, '.large.webp')]));
  const { error } = await db.from('renders').delete().in('set_id', setIds);
  console.log(error ? `Could not delete the examples: ${error.message}` : `- ${setIds.length} example sets deleted`);
}

try {
  await page.goto(`${BASE}/`);
  if (new URL(page.url()).pathname.startsWith('/login')) {
    console.log('Sign in to Studio in the window that opened…');
    await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 5 * 60_000 });
  }
  await page.goto(`${BASE}/api/brand?to=archy&next=/`);

  // Example sets: each template opened in Canvas with its sample copy, every format added, saved.
  if (EXAMPLES) {
    for (const t of TEMPLATES) {
      await page.goto(`${BASE}/canvas/new?template=${t}&format=post`); await wait(7000);
      await page.getByRole('button', { name: 'Add all formats' }).click().catch(() => {}); await wait(5000);
      await page.getByRole('button', { name: 'Save to gallery' }).click();
      await page.waitForURL((u) => /^\/canvas\/[0-9a-f-]{36}/.test(u.pathname), { timeout: 120_000 });
      made.push(new URL(page.url()).pathname.split('/')[2]);
      console.log(`+ example ${t}`);
    }
    // Two of them archived, for the Archive picture.
    const { data } = await db.from('renders').select('set_id').in('id', made.slice(-2));
    await db.from('renders').update({ archived_at: new Date().toISOString() }).in('set_id', data.map((r) => r.set_id));
  }

  // Gallery (the team's), and the set with the most formats open.
  await page.goto(`${BASE}/?all=1`); await wait(3000); await shot('gallery');
  const cards = page.locator('figure button[aria-label^="Open "]');
  const counts = await cards.evaluateAll((els) => els.map((e) => Number(e.getAttribute('aria-label').match(/(\d+) formats?$/)?.[1] ?? 1)));
  await cards.nth(counts.indexOf(Math.max(...counts))).click(); await wait(2500); await shot('set-panel');
  const canvasHref = await page.locator('a[href^="/canvas/"]').first().getAttribute('href');

  // Templates: the catalog and one template's details.
  await page.goto(`${BASE}/templates`); await wait(5000); await shot('templates');
  await page.goto(`${BASE}/templates?t=booth-icon-list`); await wait(3500); await shot('template-panel');

  // Canvas, and its Inspector.
  if (canvasHref) {
    await page.goto(`${BASE}${canvasHref}`); await wait(9000); await shot('canvas');
    await page.getByRole('button', { name: 'Inspector', exact: true }).click({ timeout: 5000 }).catch(() => {}); await wait(2000); await shot('canvas-inspector');
  }


  // Archive with two sets selected (selecting changes nothing).
  await page.goto(`${BASE}/archive`); await wait(2500);
  await page.getByRole('button', { name: 'Select', exact: true }).click({ timeout: 5000 }).catch(() => {});
  for (const b of (await page.locator('button[aria-label^="Select "]').all()).slice(0, 2)) await b.click();
  await wait(800); await shot('archive-select');
  await page.keyboard.press('Escape');

  // The brand menu, open.
  await page.goto(`${BASE}/`); await wait(1500);
  await page.locator('button[aria-label^="Brand:"]').click(); await wait(600); await shot('brand-menu');
  await page.keyboard.press('Escape');

  // A photo link, when one is given.
  if (process.env.PHOTO_LINK) { await page.goto(`${BASE}/u/${process.env.PHOTO_LINK}`); await wait(1500); await shot('photo-link'); }
} finally {
  await ctx.close();
  await cleanup();
}
