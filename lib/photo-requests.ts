import 'server-only';
import { MAX_PIXELS, createAsset, getAsset, sourceFor, useAi } from './assets';
import { brandOf, type Brand } from './brands';
import { removeBackground } from './cutout';
import { supabaseAdmin } from './supabase/admin';
import { loadConfig, templateBrand } from './templates';

// Photos Claude asks for with a link (the person attached them in the chat, where Studio cannot reach
// them): one small page with a drop zone per photo. Each photo joins Assets in the design's brand, named
// as Claude asked ("Jordan Ellis"), cut out when the template's slot wants a cutout, and Claude picks
// them up with get_photos.

export type PhotoItem = { key: string; label: string; slot: string | null; cutout: boolean; asset_id: string | null };
export type PhotoRequest = { id: string; user_id: string | null; brand: Brand; template: string | null; items: PhotoItem[]; expires_at: string; expired: boolean };

const ID = /^[0-9a-f-]{36}$/i;
const keyOf = (label: string, i: number) => `${i + 1}-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'photo'}`;

export async function createPhotoRequest(userId: string, input: { template?: string | null; brand?: Brand; photos: { label: string; slot?: string | null }[] }): Promise<PhotoRequest> {
  const photos = input.photos.slice(0, 6).filter((p) => p.label?.trim());
  if (!photos.length) throw new Error('Say which photos are needed (a label for each).');
  let brand = input.brand ?? 'archy';
  let cutouts: string[] = [];
  if (input.template) {
    brand = await templateBrand(input.template);
    cutouts = (await loadConfig(input.template)).cutout ?? [];
  }
  const items: PhotoItem[] = photos.map((p, i) => ({
    key: keyOf(p.label, i), label: p.label.trim().slice(0, 80), slot: p.slot ?? null, cutout: !!p.slot && cutouts.includes(p.slot), asset_id: null,
  }));
  const { data, error } = await supabaseAdmin().from('photo_requests').insert({ user_id: userId, brand, template: input.template ?? null, items }).select('*').single();
  if (error || !data) throw new Error(error?.message ?? 'Could not create the link.');
  return shape(data);
}

export async function getPhotoRequest(id: string): Promise<PhotoRequest | null> {
  if (!ID.test(id)) return null;
  const { data } = await supabaseAdmin().from('photo_requests').select('*').eq('id', id).maybeSingle();
  return data ? shape(data) : null;
}

function shape(r: Record<string, unknown>): PhotoRequest {
  const expires = String(r.expires_at);
  return { id: String(r.id), user_id: (r.user_id as string | null) ?? null, brand: brandOf(r.brand), template: (r.template as string | null) ?? null, items: (r.items as PhotoItem[]) ?? [], expires_at: expires, expired: new Date(expires).getTime() < Date.now() };
}

// One photo dropped on the page: into Assets (the request's brand), cut out when its slot wants it, and
// recorded on the request. A photo dropped again replaces the one before.
export async function addPhoto(id: string, key: string, me: { id: string }, file: { body: Buffer; type: string }) {
  const req = await getPhotoRequest(id);
  if (!req) throw new Error('This link does not exist.');
  if (req.expired) throw new Error('This link has expired. Ask Claude for a new one.');
  const item = req.items.find((i) => i.key === key);
  if (!item) throw new Error('This photo is not part of the request.');
  let asset = await createAsset({ ownerId: me.id, body: file.body, type: file.type, name: item.label, kind: 'upload', brand: req.brand });
  if (item.cutout && process.env.FAL_KEY && (await useAi(me.id, 'cutout'))) {
    try {
      const png = await removeBackground((await sourceFor({ path: (await getAsset(asset.id))!.path })).url);
      const sharp = (await import('sharp')).default;
      const trimmed = await sharp(png, { limitInputPixels: MAX_PIXELS }).trim({ threshold: 1 }).png().toBuffer().catch(() => png);
      asset = await createAsset({ ownerId: me.id, body: trimmed, type: 'image/png', name: `${item.label} · cutout`, kind: 'cutout', parentId: asset.id, brand: req.brand });
    } catch {
      // The photo as it came is kept; Claude says the cutout did not happen.
    }
  }
  const items = req.items.map((i) => (i.key === key ? { ...i, asset_id: asset.id } : i));
  const { error } = await supabaseAdmin().from('photo_requests').update({ items }).eq('id', id);
  if (error) throw new Error(error.message);
  return { asset, cutout: asset.kind === 'cutout' };
}
