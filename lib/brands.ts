// The brands Studio makes work for. Archy is the default; DOC (Dental Ownership Collective) is its own
// brand with its own templates, assets, gallery and projects, never mixed with Archy's.
export const BRAND_IDS = ['archy', 'doc'] as const;
export type Brand = (typeof BRAND_IDS)[number];
export const DEFAULT_BRAND: Brand = 'archy';

export const BRANDS: Record<Brand, { name: string; full: string; studio: string }> = {
  archy: { name: 'Archy', full: 'Archy', studio: 'Archy Studio' },
  doc: { name: 'DOC', full: 'Dental Ownership Collective', studio: 'DOC Studio' },
};

export const isBrand = (v: unknown): v is Brand => typeof v === 'string' && (BRAND_IDS as readonly string[]).includes(v);
export const brandOf = (v: unknown): Brand => (isBrand(v) ? v : DEFAULT_BRAND);

// The choice lives in a cookie (like the sidebar's), so the server draws the right brand on first paint.
export const BRAND_COOKIE = 'brand';
export const brandCookie = (b: Brand) => `${BRAND_COOKIE}=${b}; path=/; max-age=31536000; samesite=lax`;
