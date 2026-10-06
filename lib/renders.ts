import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { supabaseAdmin, supabaseConfigured } from './supabase/admin';

const BUCKET = 'renders';
const SIGNED_URL_SECONDS = 60 * 60 * 24 * 7; // download links last a week

export type SavedRender = { id: string; path: string; url: string };

// Store a finished piece (2x PNG) in the shared gallery and return a signed download URL.
export async function saveRender(input: {
  userId: string | null;
  template: string;
  format: string;
  slots: Record<string, string | null>;
  png: Buffer;
  width: number;
  height: number;
  scale: number;
  source?: 'mcp' | 'app';
}): Promise<SavedRender | null> {
  if (!supabaseConfigured()) return null;
  const db = supabaseAdmin();
  const id = randomUUID();
  const day = new Date().toISOString().slice(0, 10);
  const path = `${day}/${input.template}/${input.format}-${id}.png`;
  const up = await db.storage.from(BUCKET).upload(path, input.png, { contentType: 'image/png', upsert: false });
  if (up.error) throw new Error(`Could not store the render: ${up.error.message}`);
  // Light WebP for the gallery grid; the PNG stays the download.
  const thumb = await sharp(input.png).resize({ width: 640, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
  await db.storage.from(BUCKET).upload(thumbPath(path), thumb, { contentType: 'image/webp', upsert: true });
  // Only real images go in the record; data URLs (inline logos) are dropped to keep rows small.
  const slots = Object.fromEntries(Object.entries(input.slots).map(([k, v]) => [k, v?.startsWith('data:') ? '[inline image]' : v]));
  const ins = await db.from('renders').insert({
    id, user_id: input.userId, template: input.template, format: input.format, slots,
    storage_path: path, width: input.width, height: input.height, scale: input.scale, source: input.source ?? 'mcp',
  });
  if (ins.error) throw new Error(`Could not record the render: ${ins.error.message}`);
  return { id, path, url: await signedUrl(path) };
}

export async function signedUrl(path: string, seconds = SIGNED_URL_SECONDS): Promise<string> {
  const { data, error } = await supabaseAdmin().storage.from(BUCKET).createSignedUrl(path, seconds, { download: true });
  if (error || !data) throw new Error(`Could not sign the download link: ${error?.message}`);
  return data.signedUrl;
}

// Many signed links in one call (gallery). Not a download: shown inline.
export async function signedUrls(paths: string[], seconds = 60 * 60, download = false): Promise<Record<string, string>> {
  if (!paths.length || !supabaseConfigured()) return {};
  const { data } = await supabaseAdmin().storage.from(BUCKET).createSignedUrls(paths, seconds, download ? { download: true } : undefined);
  return Object.fromEntries((data ?? []).filter((d) => d.path && d.signedUrl).map((d) => [d.path as string, d.signedUrl as string]));
}

export const thumbPath = (path: string) => path.replace(/\.png$/, '.thumb.webp');

// Catalog previews: each template format rendered once with its sample copy, kept in Storage.
export async function previewUrl(key: string, make: () => Promise<Buffer>): Promise<string | null> {
  if (!supabaseConfigured()) return null;
  const db = supabaseAdmin();
  const path = `previews/${key}.webp`;
  const signed = await db.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24);
  if (signed.data?.signedUrl) return signed.data.signedUrl;
  const webp = await sharp(await make()).resize({ width: 900, withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
  await db.storage.from(BUCKET).upload(path, webp, { contentType: 'image/webp', upsert: true });
  const again = await db.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24);
  return again.data?.signedUrl ?? null;
}
