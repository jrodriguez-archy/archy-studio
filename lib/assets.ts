import 'server-only';
import { after } from 'next/server';
import { currentBrand } from './brand';
import type { Brand } from './brands';
import { PUBLIC, publicUrl } from './images';
import { displayName } from './names';
import { storeUpload } from './renders';
import { supabaseAdmin } from './supabase/admin';

// Assets: the images the team brings to Studio and what Studio makes from them (a cutout, a pixel effect,
// a generated image). Shared with the whole team; a design keeps the file as `upload:<path>`, so a
// design never breaks when an asset is renamed or removed from the list. Each asset and folder belongs to
// one brand and only shows there; without a brand, the one the person works in.

export type AssetKind = 'upload' | 'cutout' | 'pixel' | 'generated';
export type Asset = {
  id: string; name: string; kind: AssetKind; value: string; thumb: string;
  width: number | null; height: number | null; ownerId: string | null; author: string; prompt: string | null; createdAt: string;
  /** The team folder it is in (null: no folder). */
  folderId: string | null;
};
type Row = { id: string; owner_id: string | null; path: string; name: string; kind: AssetKind; prompt: string | null; width: number | null; height: number | null; created_at: string; folder_id: string | null; profiles: { full_name: string | null; email: string } | null };

const COLUMNS = 'id, owner_id, path, name, kind, prompt, width, height, created_at, folder_id, profiles!assets_owner_id_fkey(full_name, email)';
const YEAR = '31536000';
// The light thumbnail for the grid (public, unguessable path, never changes).
const thumbOf = (path: string) => `assets/${path.replace(/\.\w+$/, '')}.webp`;

const toAsset = (r: Row): Asset => ({
  id: r.id, name: r.name, kind: r.kind, value: `upload:${r.path}`, thumb: publicUrl(thumbOf(r.path)),
  width: r.width, height: r.height, ownerId: r.owner_id, author: r.profiles ? displayName(r.profiles.full_name, r.profiles.email) : 'Studio', prompt: r.prompt, createdAt: r.created_at,
  folderId: r.folder_id,
});

// Store an image as a new asset: the file (private), its thumbnail (public) and its record.
export async function createAsset(input: { ownerId: string; body: Buffer; type: string; name: string; kind: AssetKind; parentId?: string | null; prompt?: string | null; folderId?: string | null; brand?: Brand }): Promise<Asset> {
  const brand = input.brand ?? (await currentBrand());
  // Into a folder that is no longer there (or of the other brand): kept, out of any folder.
  const folder = input.folderId && /^[0-9a-f-]{36}$/i.test(input.folderId) ? (await supabaseAdmin().from('asset_folders').select('id').eq('id', input.folderId).eq('brand', brand).maybeSingle()).data?.id ?? null : null;
  // Made from an image that is no longer there: kept, without the link to it.
  const parent = input.parentId ? (await supabaseAdmin().from('assets').select('id').eq('id', input.parentId).maybeSingle()).data?.id ?? null : null;
  const value = await storeUpload(input.ownerId, input.body, input.type);
  const path = value.slice('upload:'.length);
  const drop = async () => {
    await supabaseAdmin().storage.from('uploads').remove([path]).catch(() => {});
    await supabaseAdmin().storage.from(PUBLIC).remove([thumbOf(path)]).catch(() => {});
  };
  // An image Studio cannot read (damaged, or far too large) is refused, and its file goes.
  const size = await thumbnail(path, input.body).catch(async (e: Error) => { await drop(); throw new Error(`This image could not be read. ${e.message}`); });
  const { width, height } = size;
  const row = { brand, owner_id: input.ownerId, path, name: input.name.slice(0, 120) || 'Image', kind: input.kind, parent_id: parent, folder_id: folder, prompt: input.prompt ?? null, width, height };
  let { data, error } = await supabaseAdmin().from('assets').insert(row).select(COLUMNS).single();
  // Its folder (or source) was removed while it was being made: kept, out of it.
  if (error?.code === '23503') ({ data, error } = await supabaseAdmin().from('assets').insert({ ...row, folder_id: null, parent_id: null }).select(COLUMNS).single());
  if (error || !data) {
    // No half-saved images: the file goes too.
    await drop();
    throw new Error(`Could not save the image: ${error?.message}`);
  }
  return toAsset(data as unknown as Row);
}

// Images are decoded at most this large (a small file can still hold a huge picture).
export const MAX_PIXELS = 50_000_000;

async function thumbnail(path: string, body: Buffer) {
  const sharp = (await import('sharp')).default;
  const img = sharp(body, { density: 144, limitInputPixels: MAX_PIXELS }).rotate(); // upright, as browsers show it
  const meta = await sharp(body, { density: 144, limitInputPixels: MAX_PIXELS }).metadata();
  // A phone photo stored sideways (EXIF orientation 5–8): its upright size has width and height swapped.
  const turned = (meta.orientation ?? 1) >= 5;
  const webp = await img.resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
  await supabaseAdmin().storage.from(PUBLIC).upload(thumbOf(path), webp, { contentType: 'image/webp', upsert: true, cacheControl: YEAR });
  return { width: (turned ? meta.height : meta.width) ?? null, height: (turned ? meta.width : meta.height) ?? null };
}

// The newest assets: everyone's (Team) or one person's (Mine). One person's older uploads (from before
// assets were kept) join the list the first time they look (once per server instance).
const adopted = new Set<string>();
export async function listAssets(opts: { ownerId?: string; folderId?: string; search?: string; limit?: number; brand?: Brand } = {}): Promise<Asset[]> {
  // In the background, after the response: never on the way of the list itself.
  if (opts.ownerId && !adopted.has(opts.ownerId)) {
    adopted.add(opts.ownerId);
    const owner = opts.ownerId;
    const adopt = () => adoptOldUploads(owner).catch(() => {});
    try { after(adopt); } catch { void adopt(); }
  }
  let q = supabaseAdmin().from('assets').select(COLUMNS).eq('brand', opts.brand ?? (await currentBrand())).is('deleted_at', null).order('created_at', { ascending: false }).limit(opts.limit ?? 300);
  if (opts.ownerId) q = q.eq('owner_id', opts.ownerId);
  // By name: the LIKE wildcards are taken literally (PostgREST reads * as a wildcard and cannot escape it).
  const term = opts.search?.trim().slice(0, 80).replace(/[\\%_]/g, '\\$&').replace(/\*/g, '');
  if (term) q = q.ilike('name', `%${term}%`);
  if (opts.folderId) q = /^[0-9a-f-]{36}$/i.test(opts.folderId) ? q.eq('folder_id', opts.folderId) : q.eq('id', '00000000-0000-0000-0000-000000000000');
  const { data } = await q;
  return ((data ?? []) as unknown as Row[]).map(toAsset);
}

export async function getAsset(id: string): Promise<(Asset & { path: string }) | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await supabaseAdmin().from('assets').select(COLUMNS).eq('id', id).is('deleted_at', null).maybeSingle();
  return data ? { ...toAsset(data as unknown as Row), path: (data as unknown as Row).path } : null;
}

// The original file, for processing it (a cutout, an edit with AI).
export async function readAsset(path: string): Promise<{ body: Buffer; type: string }> {
  const { data, error } = await supabaseAdmin().storage.from('uploads').download(path);
  if (error || !data) throw new Error('Could not read the image.');
  return { body: Buffer.from(await data.arrayBuffer()), type: data.type || 'image/png' };
}

type Who = { id: string; is_admin: boolean };
async function owned(me: Who, id: string) {
  const a = await getAsset(id);
  if (!a) throw new Error('Image not found.');
  if (a.ownerId !== me.id && !me.is_admin) throw new Error('Only the person who added it (or an admin) can change it.');
  return a;
}
export async function renameAsset(me: Who, id: string, name: string) {
  await owned(me, id);
  const n = name.trim().replace(/\s+/g, ' ').slice(0, 120);
  if (!n) throw new Error('Give it a name.');
  const { error } = await supabaseAdmin().from('assets').update({ name: n }).eq('id', id);
  if (error) throw new Error(error.message);
}
// Out of the list; the file stays, so designs that use it keep showing it.
export async function removeAsset(me: Who, id: string) {
  await owned(me, id);
  const { error } = await supabaseAdmin().from('assets').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
}


async function adoptOldUploads(ownerId: string) {
  const db = supabaseAdmin();
  const { data: files } = await db.storage.from('uploads').list(ownerId, { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });
  const paths = (files ?? []).filter((f) => f.name && !f.name.startsWith('.')).map((f) => `${ownerId}/${f.name}`);
  if (!paths.length) return;
  const { data: known } = await db.from('assets').select('path').in('path', paths);
  const have = new Set((known ?? []).map((k) => k.path as string));
  const queue = paths.filter((p) => !have.has(p)).slice(0, 24);
  // A few at a time; an unreadable file is recorded as removed, so it is never tried again.
  await Promise.all(Array.from({ length: 4 }, async () => {
    for (let path = queue.shift(); path; path = queue.shift()) {
      try {
        const { body } = await readAsset(path);
        const { width, height } = await thumbnail(path, body);
        await db.from('assets').insert({ owner_id: ownerId, path, name: 'Upload', kind: 'upload', width, height });
      } catch {
        await db.from('assets').insert({ owner_id: ownerId, path, name: 'Upload', kind: 'upload', deleted_at: new Date().toISOString() });
      }
    }
  }));
}

// ---- Paid AI calls: counted when they start, so daily limits hold for failures and parallel calls ----
export const DAILY = { generate: 30, cutout: 60 } as const;
export async function useAi(userId: string, kind: keyof typeof DAILY): Promise<boolean> {
  const db = supabaseAdmin();
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await db.from('ai_usage').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('kind', kind).gte('created_at', since);
  if ((count ?? 0) >= DAILY[kind]) return false;
  await db.from('ai_usage').insert({ user_id: userId, kind });
  // Parallel calls past the limit: whoever ends up over it gives way.
  const { count: now } = await db.from('ai_usage').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('kind', kind).gte('created_at', since);
  return (now ?? 0) <= DAILY[kind];
}

// An image as fal.ai or Gemini can read it: a short-lived link, or a PNG drawn from an SVG.
export async function sourceFor(asset: { path: string }): Promise<{ url: string; body?: Buffer; type: string }> {
  if (/\.svg$/i.test(asset.path)) {
    const sharp = (await import('sharp')).default;
    const { body } = await readAsset(asset.path);
    const png = await sharp(body, { density: 300, limitInputPixels: MAX_PIXELS }).resize({ width: 2048, height: 2048, fit: 'inside' }).png().toBuffer();
    return { url: `data:image/png;base64,${png.toString('base64')}`, body: png, type: 'image/png' };
  }
  // A phone photo stored sideways goes upright, so the cutout lines up with the photo as people see it.
  if (/\.jpe?g$/i.test(asset.path)) {
    const sharp = (await import('sharp')).default;
    const { body } = await readAsset(asset.path);
    if (((await sharp(body).metadata()).orientation ?? 1) > 1) {
      const up = await sharp(body, { limitInputPixels: MAX_PIXELS }).rotate().jpeg({ quality: 92 }).toBuffer();
      return { url: `data:image/jpeg;base64,${up.toString('base64')}`, body: up, type: 'image/jpeg' };
    }
  }
  const { data } = await supabaseAdmin().storage.from('uploads').createSignedUrl(asset.path, 600);
  if (!data?.signedUrl) throw new Error('Could not read the image.');
  return { url: data.signedUrl, type: 'image/png' };
}

// ---- Folders: one level, shared by the whole team (like a team drive) ----
export type Folder = { id: string; name: string; createdBy: string | null; count: number };

export async function listFolders(brand?: Brand): Promise<Folder[]> {
  const db = supabaseAdmin();
  const b = brand ?? (await currentBrand());
  const [{ data: folders }, { data: counts }] = await Promise.all([
    db.from('asset_folders').select('id, name, created_by').eq('brand', b).order('name'),
    db.rpc('asset_folder_counts'),
  ]);
  const count = new Map(((counts ?? []) as { folder_id: string; images: number }[]).map((c) => [c.folder_id, Number(c.images)]));
  return (folders ?? []).map((f) => ({ id: f.id, name: f.name, createdBy: f.created_by, count: count.get(f.id) ?? 0 }));
}

const folderName = (name: string) => {
  const n = Array.from(name.trim().replace(/\s+/g, ' ')).slice(0, 60).join('');
  if (!n) throw new Error('Give the folder a name.');
  return n;
};

export async function createFolder(me: Who, name: string, brand?: Brand): Promise<Folder> {
  const n = folderName(name);
  const db = supabaseAdmin();
  const b = brand ?? (await currentBrand());
  const { data, error } = await db.from('asset_folders').insert({ name: n, created_by: me.id, brand: b }).select('id, name, created_by').single();
  if (data) return { id: data.id, name: data.name, createdBy: data.created_by, count: 0 };
  // One name, one folder: that name exists (any capitals), so that folder is used.
  if (error?.code === '23505') {
    const same = (await listFolders(b)).find((f) => f.name.toLowerCase() === n.toLowerCase());
    if (same) return same;
  }
  throw new Error('Could not create the folder.');
}

async function ownFolder(me: Who, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Folder not found.');
  const { data } = await supabaseAdmin().from('asset_folders').select('id, created_by').eq('id', id).maybeSingle();
  if (!data) throw new Error('Folder not found.');
  if (data.created_by !== me.id && !me.is_admin) throw new Error('Only the person who made the folder (or an admin) can change it.');
}

export async function renameFolder(me: Who, id: string, name: string): Promise<string> {
  await ownFolder(me, id);
  const n = folderName(name);
  const { error } = await supabaseAdmin().from('asset_folders').update({ name: n }).eq('id', id);
  if (error) throw new Error(error.code === '23505' ? 'There is already a folder with that name.' : 'Could not rename the folder.');
  return n;
}

// The folder goes; its images stay in Assets, out of any folder.
export async function deleteFolder(me: Who, id: string) {
  await ownFolder(me, id);
  const { error } = await supabaseAdmin().from('asset_folders').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// Anyone on the team can file images (a shared drive).
export async function moveAssets(ids: string[], folderId: string | null) {
  const list = ids.filter((id) => /^[0-9a-f-]{36}$/i.test(id)).slice(0, 200);
  if (!list.length) return;
  const brand = await currentBrand();
  if (folderId) {
    const { data } = await supabaseAdmin().from('asset_folders').select('id').eq('id', folderId).eq('brand', brand).maybeSingle();
    if (!data) throw new Error('Folder not found.');
  }
  const { error } = await supabaseAdmin().from('assets').update({ folder_id: folderId }).in('id', list).eq('brand', brand).is('deleted_at', null);
  if (error) throw new Error(error.code === '23503' ? 'Folder not found.' : 'Could not move the images.');
}
