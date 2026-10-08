import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { ROOT } from './templates';

// A catalog preview's storage key: the template format plus its manifest's hash, so a changed template
// gets a new image (and a new link) while an unchanged one stays cached for good.
export async function previewKey(template: string, format: string): Promise<string | null> {
  if (!/^[a-z0-9-]+$/.test(template) || !/^[a-z]+$/.test(format)) return null;
  let manifest: string;
  try {
    manifest = await fs.readFile(path.join(ROOT, 'templates', template, 'manifest.json'), 'utf8');
  } catch {
    return null;
  }
  if (!(format in (JSON.parse(manifest).formats ?? {}))) return null;
  return `${template}/${format}-${createHash('sha1').update(manifest).digest('hex').slice(0, 10)}`;
}
