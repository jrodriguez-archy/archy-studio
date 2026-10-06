import fs from 'node:fs/promises';
import path from 'node:path';
import { ROOT } from '@/lib/templates';

export const runtime = 'nodejs';

// The repo files a template page reads (its HTML, assets, fonts, the asset library) plus the page
// scripts, served same-origin so the Canvas editor can open the real template in an iframe and run the
// same fill and edits as the renderer. Signed-in only (proxy.ts).
const DIRS = ['templates', 'fonts', 'library'];
const SCRIPTS = ['scripts/fit.js', 'scripts/edits.js', 'scripts/components.js'];
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.json': 'application/json',
};

export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const rel = (await params).path.map(decodeURIComponent).join('/');
  const file = path.resolve(ROOT, rel);
  const allowed = SCRIPTS.includes(rel) || DIRS.some((d) => file.startsWith(path.join(ROOT, d) + path.sep));
  if (!allowed || /\/(source|reference)\//.test(rel)) return new Response('Not found', { status: 404 });
  try {
    const body = await fs.readFile(file);
    const dev = process.env.NODE_ENV !== 'production';
    return new Response(new Uint8Array(body), {
      headers: { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream', 'Cache-Control': dev || rel.endsWith('.html') || rel.endsWith('.js') ? 'no-store' : 'private, max-age=3600' },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
