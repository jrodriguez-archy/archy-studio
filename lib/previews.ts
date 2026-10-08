import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { ROOT } from './templates';

// A catalog preview's storage key: the template format plus a hash of its manifest and of the engine
// that draws it, so a changed template (or a better engine) gets a new image and link, while an
// unchanged one stays cached for good.
export async function previewKey(template: string, format: string): Promise<string | null> {
  if (!/^[a-z0-9-]+$/.test(template) || !/^[a-z]+$/.test(format)) return null;
  let manifest: string;
  try {
    manifest = await fs.readFile(path.join(ROOT, 'templates', template, 'manifest.json'), 'utf8');
  } catch {
    return null;
  }
  if (!(format in (JSON.parse(manifest).formats ?? {}))) return null;
  const hash = createHash('sha1').update(manifest).update(await engine());
  return `${template}/${format}-${hash.digest('hex').slice(0, 10)}`;
}

let engineText: Promise<string> | null = null;
const engine = () => (engineText ??= Promise.all(['fit.js', 'edits.js'].map((f) => fs.readFile(path.join(ROOT, 'scripts', f), 'utf8'))).then((t) => t.join('\n')));

// The link pages use for a preview: it carries the version, so the browser keeps it for good and asks
// again only when the template or the engine changed.
export async function previewSrc(template: string, format: string): Promise<string> {
  const key = await previewKey(template, format);
  return `/api/preview/${template}/${format}${key ? `?v=${key.split('-').pop()}` : ''}`;
}

// Every preview link of the catalog at once ("template/format" → link).
export async function previewSrcs(items: { manifest: { id: string; formats: Record<string, unknown> } }[]): Promise<Record<string, string>> {
  const pairs = items.flatMap((i) => Object.keys(i.manifest.formats).map((f) => [i.manifest.id, f] as const));
  return Object.fromEntries(await Promise.all(pairs.map(async ([t, f]) => [`${t}/${f}`, await previewSrc(t, f)])));
}
