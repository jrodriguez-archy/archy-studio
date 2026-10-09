import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { BRAND_COOKIE, brandOf, type Brand } from './brands';
import { supabaseAdmin } from './supabase/admin';

// The brand the person is working in (cookie), Archy by default.
export async function currentBrand(): Promise<Brand> {
  return brandOf((await cookies()).get(BRAND_COOKIE)?.value);
}

// When something belongs to the other brand: switch to it and come back to `path`.
export async function followBrand(brand: Brand, path: string) {
  if (brand !== (await currentBrand())) redirect(`/api/brand?to=${brand}&next=${encodeURIComponent(path)}`);
}

// The brand of a design (by its id or its set's id) or of a project; null when there is none.
export async function brandOfRecord(table: 'renders' | 'projects', id: string, bySet = false): Promise<Brand | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  let q = supabaseAdmin().from(table).select('brand');
  q = bySet ? q.or(`set_id.eq.${id},id.eq.${id}`) : q.eq('id', id);
  const { data } = await q.limit(1).maybeSingle();
  return data ? brandOf(data.brand) : null;
}

// Opening something of the other brand by its link: switch to that brand and come back to `path`.
export async function followRecord(table: 'renders' | 'projects', id: string, path: string, bySet = false) {
  const b = await brandOfRecord(table, id, bySet);
  if (b) await followBrand(b, path);
}
