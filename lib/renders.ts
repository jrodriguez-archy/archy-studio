import { randomUUID } from 'node:crypto';
import type { Edits } from './canvas-shared';
import { PUBLIC, largePath, previewPath, publicUrl, removeImages, thumbPath } from './images';
import { supabaseAdmin, supabaseConfigured } from './supabase/admin';

export { fileLink, largePath, largeUrl, previewPath, publicUrl, removeImages, thumbPath, thumbUrl } from './images';

const BUCKET = 'renders';
const YEAR = '31536000';
const sharpLib = async () => (await import('sharp')).default;
const SIGNED_URL_SECONDS = 60 * 60 * 24 * 7; // download links last a week

export type SavedRender = { id: string; path: string; url: string };

// Store a finished piece (2x PNG) in the shared gallery and return a signed download URL.
// The record keeps the full source (template, format, slots, Canvas edits), so the piece can be
// opened in Canvas and rendered again.
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
  projectId?: string | null;
  setId?: string | null;
  setTitle?: string | null;
  variant?: string | null;
  edits?: Edits;
  parentId?: string | null;
}): Promise<SavedRender | null> {
  if (!supabaseConfigured()) return null;
  const db = supabaseAdmin();
  const id = randomUUID();
  const day = new Date().toISOString().slice(0, 10);
  const path = `${day}/${input.template}/${input.format}-${id}.png`;
  await storeFiles(path, input.png, false);
  const ins = await db.from('renders').insert({
    id, user_id: input.userId, template: input.template, format: input.format, slots: await keepInlineImages(input.userId, input.slots),
    storage_path: path, width: input.width, height: input.height, scale: input.scale, source: input.source ?? 'mcp', project_id: input.projectId ?? null, set_id: input.setId ?? null,
    set_title: input.setTitle ?? null, variant: input.variant ?? null, edits: input.edits ?? {}, parent_id: input.parentId ?? null, edited_at: input.parentId ? new Date().toISOString() : null,
  });
  if (ins.error) throw new Error(`Could not record the render: ${ins.error.message}`);
  return { id, path, url: await signedUrl(path) };
}

// Canvas "replace the original": same record (same design and link) with the new source and image.
// The image goes to a new file, so no cached thumbnail shows the old one; the old files are removed.
export async function replaceRender(input: { id: string; storagePath: string; slots: Record<string, string | null>; edits: Edits; variant: string | null; png: Buffer; userId: string }): Promise<SavedRender> {
  const path = input.storagePath.replace(/(-v[0-9a-z]+)?\.png$/, `-v${Date.now().toString(36)}.png`);
  await storeFiles(path, input.png, false);
  const { error } = await supabaseAdmin().from('renders').update({
    slots: await keepInlineImages(input.userId, input.slots), edits: input.edits, variant: input.variant, edited_at: new Date().toISOString(), storage_path: path,
  }).eq('id', input.id);
  if (error) throw new Error(`Could not update the design: ${error.message}`);
  await supabaseAdmin().storage.from(BUCKET).remove([input.storagePath, thumbPath(input.storagePath)]).catch(() => {});
  await removeImages([input.storagePath]);
  return { id: input.id, path, url: await signedUrl(path) };
}

// The PNG and its light WebP thumbnail (also used by Template review).
export async function storeFiles(path: string, png: Buffer, upsert: boolean) {
  const db = supabaseAdmin();
  const up = await db.storage.from(BUCKET).upload(path, png, { contentType: 'image/png', upsert });
  if (up.error) throw new Error(`Could not store the render: ${up.error.message}`);
  await storeImages(path, png);
}

// The light WebPs people see: 640px for the grid, 1600px for the large view. The PNG stays the download.
export async function storeImages(path: string, png: Buffer) {
  const sharp = await sharpLib();
  const db = supabaseAdmin().storage.from(PUBLIC);
  const [thumb, large] = await Promise.all([
    sharp(png).resize({ width: 640, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer(),
    sharp(png).resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 86 }).toBuffer(),
  ]);
  await Promise.all([
    db.upload(thumbPath(path), thumb, { contentType: 'image/webp', upsert: true, cacheControl: YEAR }),
    db.upload(largePath(path), large, { contentType: 'image/webp', upsert: true, cacheControl: YEAR }),
  ]);
}


// Inline images (a partner logo sent as a data URL) move to the uploads bucket, so the record stays
// small and the piece can still be opened in Canvas.
async function keepInlineImages(userId: string | null, slots: Record<string, string | null>) {
  const out: Record<string, string | null> = {};
  for (const [k, v] of Object.entries(slots)) {
    const m = v?.match(/^data:(image\/[\w.+-]+);base64,(.*)$/);
    out[k] = m ? await storeUpload(userId, Buffer.from(m[2], 'base64'), m[1]) : v;
  }
  return out;
}

const UPLOAD_TYPES: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/svg+xml': 'svg' };
export const MAX_UPLOAD = 8_000_000;

// An image someone brings (Canvas upload, inline logo). Returns its slot value: upload:<path>.
export async function storeUpload(userId: string | null, body: Buffer, type: string): Promise<string> {
  const ext = UPLOAD_TYPES[type];
  if (!ext) throw new Error('Use a PNG, JPG, WebP or SVG image.');
  if (body.length > MAX_UPLOAD) throw new Error('The image is larger than 8 MB.');
  const path = `${userId ?? 'studio'}/${randomUUID()}.${ext}`;
  const { error } = await supabaseAdmin().storage.from('uploads').upload(path, body, { contentType: type, upsert: false });
  if (error) throw new Error(`Could not store the image: ${error.message}`);
  return `upload:${path}`;
}

// A one-off export from Canvas (downloaded, not saved to the gallery).
export async function storeExport(png: Buffer, name: string): Promise<string> {
  const path = `exports/${randomUUID()}.png`;
  const { error } = await supabaseAdmin().storage.from(BUCKET).upload(path, png, { contentType: 'image/png' });
  if (error) throw new Error(`Could not prepare the download: ${error.message}`);
  const { data, error: se } = await supabaseAdmin().storage.from(BUCKET).createSignedUrl(path, 60 * 60, { download: name });
  if (se || !data) throw new Error(`Could not sign the download link: ${se?.message}`);
  return data.signedUrl;
}

// Which set a new piece belongs to. Pieces from one brief share a set (the gallery stacks them).
// An explicit set from the caller wins (only if it is one of this person's sets); otherwise the latest
// piece by the same person, same template and same headline fact in the last 30 minutes (a retry or a
// format added later); otherwise a new set.
const SET_WINDOW_MS = 30 * 60 * 1000;
const KEY_SLOTS = ['event-name', 'kicker', 'headline', 'headline-1', 'speaker-name', 'name', 'city'];

export async function resolveSet(input: { userId: string | null; template: string; slots: Record<string, string | null>; requested?: string | null }): Promise<string> {
  if (!supabaseConfigured()) return randomUUID();
  const db = supabaseAdmin();
  if (input.requested && /^[0-9a-f-]{36}$/i.test(input.requested)) {
    let q = db.from('renders').select('id').eq('set_id', input.requested).limit(1);
    q = input.userId ? q.eq('user_id', input.userId) : q.is('user_id', null);
    if ((await q).data?.length) return input.requested;
  }
  const since = new Date(Date.now() - SET_WINDOW_MS).toISOString();
  let q = db.from('renders').select('set_id, slots').eq('template', input.template).is('archived_at', null).gte('created_at', since).order('created_at', { ascending: false }).limit(20);
  q = input.userId ? q.eq('user_id', input.userId) : q.is('user_id', null);
  const key = KEY_SLOTS.find((k) => input.slots[k]);
  const recent = ((await q).data ?? []) as { set_id: string | null; slots: Record<string, string | null> }[];
  const match = recent.find((r) => r.set_id && (!key || r.slots?.[key] === input.slots[key]));
  return match?.set_id ?? randomUUID();
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


// Catalog previews: each template format rendered once with its sample copy, kept in the public bucket
// (the key carries the manifest's hash, so a changed template gets a new file and a new link).
export async function previewExists(key: string) {
  const [dir, name] = [previewPath(key).replace(/\/[^/]+$/, ''), previewPath(key).split('/').pop()!];
  const { data } = await supabaseAdmin().storage.from(PUBLIC).list(dir, { search: name, limit: 1 });
  return !!data?.some((f) => f.name === name);
}
export async function previewUrl(key: string, make: () => Promise<Buffer>): Promise<string | null> {
  if (!supabaseConfigured()) return null;
  if (await previewExists(key)) return publicUrl(previewPath(key));
  const sharp = await sharpLib();
  const webp = await sharp(await make()).resize({ width: 900, withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
  await supabaseAdmin().storage.from(PUBLIC).upload(previewPath(key), webp, { contentType: 'image/webp', upsert: true, cacheControl: YEAR });
  return publicUrl(previewPath(key));
}
