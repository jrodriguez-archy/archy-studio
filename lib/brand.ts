import 'server-only';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { BRAND_COOKIE, DEFAULT_BRAND, brandOf, type Brand } from './brands';
import { supabaseAdmin } from './supabase/admin';
import { currentUser } from './team';

// Whether the signed-in person may work in this brand: DOC only for those an admin turned it on for.
export async function canUseBrand(brand: Brand): Promise<boolean> {
  return brand !== 'doc' || !!(await currentUser())?.doc;
}

// The brand the person is working in (cookie), Archy by default, and Archy for anyone without DOC.
export async function currentBrand(): Promise<Brand> {
  const brand = brandOf((await cookies()).get(BRAND_COOKIE)?.value);
  return (await canUseBrand(brand)) ? brand : DEFAULT_BRAND;
}

// When something belongs to the other brand: switch to it and come back to `path`. A DOC design or
// template, for someone without DOC, is not there.
export async function followBrand(brand: Brand, path: string) {
  if (!(await canUseBrand(brand))) notFound();
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
