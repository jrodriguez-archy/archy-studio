import 'server-only';
import { supabaseAdmin } from './supabase/admin';

// An asset's ID as people copy it from Assets and give it to Claude: the first characters of its id
// (shortId), or the whole id. Longer when a short one is shared by two images.
export const SHORT = 8;
export const shortId = (id: string) => id.slice(0, SHORT);

export async function findAsset(ref: string): Promise<{ id: string; path: string } | null> {
  const id = ref.trim().toLowerCase();
  const db = supabaseAdmin().from('assets').select('id, path').is('deleted_at', null);
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) return (await db.eq('id', id).maybeSingle()).data;
  if (!/^[0-9a-f]{6,32}$/.test(id.replace(/-/g, ''))) return null;
  // Every id that starts this way (an id range: uuids compare as text).
  const hex = id.replace(/-/g, '');
  const pad = (c: string) => (hex + c.repeat(32)).slice(0, 32).replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
  const { data } = await db.gte('id', pad('0')).lte('id', pad('f')).limit(2);
  return data?.length === 1 ? data[0] : null;
}
