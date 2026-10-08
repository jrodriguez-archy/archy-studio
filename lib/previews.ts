import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
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

// Every preview link of the catalog at once ("template/format" → link; "template/format--design--theme"
// for the other designs and themes of templates that offer several).
export async function previewSrcs(items: { manifest: Pick<Manifest, 'id' | 'formats' | 'combos'> }[]): Promise<Record<string, string>> {
  const jobs = items.flatMap((i) => [
    ...Object.keys(i.manifest.formats).map((f) => [`${i.manifest.id}/${f}`, i.manifest.id, f, null, null] as const),
    ...Object.entries(i.manifest.combos ?? {}).flatMap(([k, c]) => Object.keys(c.formats).map((f) => [`${i.manifest.id}/${f}--${k}`, i.manifest.id, f, c.design, c.theme] as const)),
  ]);
  return Object.fromEntries(await Promise.all(jobs.map(async ([key, t, f, d, th]) => [key, await previewSrc(t, f, d, th)])));
}
