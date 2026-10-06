import fs from 'node:fs/promises';
import path from 'node:path';
import { ROOT } from '@/lib/templates';

// The repo files a template page reads (its HTML, assets, fonts, the asset library) plus the page
// scripts, served same-origin so the Canvas editor can open the real template in an iframe and run the
// same fill and edits as the renderer. Built once at deploy time and served from the CDN (no function,
// no cold start); they are brand assets, so they are not behind sign-in (see proxy.ts).
export const dynamic = 'force-static';
export const dynamicParams = false;

const DIRS = ['templates', 'fonts', 'library'];
const SCRIPTS = ['scripts/fit.js', 'scripts/edits.js', 'scripts/components.js'];
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.json': 'application/json',
};
const skip = (rel: string) => /\/(source|reference)\//.test(`/${rel}`);

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const d of await fs.readdir(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${d.name}`;
    if (d.isDirectory()) out.push(...(await walk(rel)));
    else if (!skip(rel) && !d.name.startsWith('.')) out.push(rel);
  }
  return out;
}

export async function generateStaticParams() {
  const files = [...(await Promise.all(DIRS.map(walk))).flat(), ...SCRIPTS];
  return files.map((rel) => ({ path: rel.split('/') }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const rel = (await params).path.map(decodeURIComponent).join('/');
  const file = path.resolve(ROOT, rel);
  const allowed = SCRIPTS.includes(rel) || DIRS.some((d) => file.startsWith(path.join(ROOT, d) + path.sep));
  if (!allowed || skip(rel)) return new Response('Not found', { status: 404 });
  try {
    const body = await fs.readFile(file);
    return new Response(new Uint8Array(body), { headers: { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream' } });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
