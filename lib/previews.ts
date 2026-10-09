import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { headers } from 'next/headers';
import { after } from 'next/server';
import { PUBLIC, previewPath, publicUrl } from './images';
import { supabaseAdmin } from './supabase/admin';
import { ROOT, comboFormats, resolveCombo, type Manifest } from './templates';

// A catalog preview's storage key: the template format (and design × theme, on templates that offer
// several) plus a hash of its manifest and of the engine that draws it, so a changed template (or a better
// engine) gets a new image and link, while an unchanged one stays cached for good.
export async function previewKey(template: string, format: string, design?: string | null, theme?: string | null): Promise<string | null> {
  if (!/^[a-z0-9-]+$/.test(template) || !/^[a-z]+$/.test(format)) return null;
  let manifest: string;
  try {
    manifest = await fs.readFile(path.join(ROOT, 'templates', template, 'manifest.json'), 'utf8');
  } catch {
    return null;
  }
  const m = JSON.parse(manifest) as Manifest;
  let combo;
  try { combo = resolveCombo(m, design, theme); } catch { return null; }
  if (!(format in (comboFormats(m, combo) ?? {}))) return null;
  const hash = createHash('sha1').update(manifest).update(await engine());
  return `${template}/${combo?.key ? `${format}--${combo.key}` : format}-${hash.digest('hex').slice(0, 10)}`;
}

let engineText: Promise<string> | null = null;
const engine = () => (engineText ??= Promise.all(['fit.js', 'edits.js'].map((f) => fs.readFile(path.join(ROOT, 'scripts', f), 'utf8'))).then((t) => t.join('\n')));

// The link pages use for a preview: it carries the version, so the browser keeps it for good and asks
// again only when the template or the engine changed. Design and theme go along on templates with several.
export async function previewSrc(template: string, format: string, design?: string | null, theme?: string | null): Promise<string> {
  const key = await previewKey(template, format, design, theme);
  const q = new URLSearchParams({ ...(design ? { design } : {}), ...(theme ? { theme } : {}), ...(key ? { v: key.split('-').pop()! } : {}) });
  return `/api/preview/${template}/${format}${q.size ? `?${q}` : ''}`;
}

// The app's own address, for drawing previews in the background.
export async function selfOrigin() {
  const h = await headers();
  return `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('host')}`;
}

// Every preview link of the catalog at once ("template/format" → link; "template/format--design--theme"
// for the other designs and themes of templates that offer several). Straight to the stored image (no
// hop through the app) when it exists. When the template or the engine changed and the new one is not
// drawn yet, the newest earlier image of the same format shows meanwhile and the new one is drawn in
// the background; only a format never drawn goes through /api/preview (drawn on first view).
export async function previewSrcs(items: { manifest: Pick<Manifest, 'id' | 'formats' | 'combos'> }[], origin?: string): Promise<Record<string, string>> {
  const jobs = items.flatMap((i) => [
    ...Object.keys(i.manifest.formats).map((f) => [`${i.manifest.id}/${f}`, i.manifest.id, f, null, null] as const),
    ...Object.entries(i.manifest.combos ?? {}).flatMap(([k, c]) => Object.keys(c.formats).map((f) => [`${i.manifest.id}/${f}--${k}`, i.manifest.id, f, c.design, c.theme] as const)),
  ]);
  const stored = Object.fromEntries(await Promise.all([...new Set(items.map((i) => i.manifest.id))].map(async (t) => [t, await storedPreviews(t)] as const)));
  const missing: string[] = [];
  const out = await Promise.all(jobs.map(async ([id, t, f, d, th]) => {
    const key = await previewKey(t, f, d, th);
    if (!key) return [id, await previewSrc(t, f, d, th)] as const;
    const name = key.slice(t.length + 1); // "post--design--theme-<hash>"
    const files = stored[t] ?? [];
    if (files.some((x) => x.name === `${name}.webp`)) return [id, publicUrl(previewPath(key))] as const;
    const base = name.slice(0, name.lastIndexOf('-'));
    const earlier = files.find((x) => x.name.startsWith(`${base}-`) && x.name.slice(base.length + 1, -5).length === 10 && !x.name.slice(base.length + 1).includes('--'));
    const q = new URLSearchParams({ ...(d ? { design: d } : {}), ...(th ? { theme: th } : {}) });
    missing.push(`/api/preview-render/${t}/${f}${q.size ? `?${q}` : ''}`);
    return [id, earlier ? publicUrl(`previews/${t}/${earlier.name}`) : await previewSrc(t, f, d, th)] as const;
  }));
  // Draw what is missing after the page is sent (each in its own function), a few at a time.
  if (missing.length && origin) {
    after(async () => {
      for (let i = 0; i < missing.length; i += 4) await Promise.allSettled(missing.slice(i, i + 4).map((u) => fetch(new URL(u, origin), { cache: 'no-store' })));
    });
  }
  return Object.fromEntries(out);
}

// The previews stored for a template, newest first (one listing per template, kept a minute).
const listed = new Map<string, { at: number; files: Promise<{ name: string }[]> }>();
function storedPreviews(template: string) {
  const hit = listed.get(template);
  if (hit && Date.now() - hit.at < 60_000) return hit.files;
  const files = supabaseAdmin().storage.from(PUBLIC).list(`previews/${template}`, { limit: 1000, sortBy: { column: 'created_at', order: 'desc' } })
    .then((r) => (r.data ?? []).map((f) => ({ name: f.name }))).catch(() => []);
  listed.set(template, { at: Date.now(), files });
  return files;
}
