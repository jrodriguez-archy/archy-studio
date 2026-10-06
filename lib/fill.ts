import fs from 'node:fs/promises';
import path from 'node:path';
import type { Edits, FillPlan } from './canvas-shared';
import { iconMarkup } from './icons';
import { supabaseAdmin } from './supabase/admin';
import { ROOT, loadConfig, loadLibrary, loadManifest, loadRules } from './templates';

// Deciding a piece before any page is opened: slot values, variant, fit rules, resolved images and
// icons. No browser here, so pages and actions that only need the fill stay light (the renderer, with
// Chromium, lives in lib/renderer.ts).

// Template files are served to the page from disk under a fake origin, so relative URLs
// (../../fonts/fonts.css, assets/*.png) resolve the same way they do locally.
export const ORIGIN = 'https://templates.local';
export const MIME: Record<string, string> = {
  '.html': 'text/html', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.svg': 'image/svg+xml',
};

export type RenderInput = {
  template: string;
  format: string;
  slots: Record<string, string | null>;
  scale?: number;
  /** Previews only: slots not given keep the template's sample copy. */
  fillDefaults?: boolean;
  /** Hand edits from Canvas, applied after the fill. */
  edits?: Edits;
  /** Also describe the piece's components (scripts/components.js), for the Canvas tools of the MCP. */
  inspect?: boolean;
};

export class MissingRequired extends Error {
  constructor(public slots: string[]) {
    super(`Missing required: ${slots.join(', ')}`);
  }
}

// Everything decided before the page opens: slot values (given, sample or derived), the variant, the
// fit rules and limits, and every image resolved to a URL under `origin`. The renderer and the Canvas
// editor share it, so both draw the same piece.
export async function prepareFill({ template, format, slots: given, fillDefaults = false, edits = {} }: Omit<RenderInput, 'scale'>, origin = ORIGIN): Promise<FillPlan> {
  const manifest = await loadManifest(template);
  const config = await loadConfig(template);
  if (!manifest.formats[format]) throw new Error(`Template ${template} has no format "${format}". Formats: ${Object.keys(manifest.formats).join(', ')}`);
  const unknown = Object.keys(given).filter((k) => !manifest.slots[k]);
  if (unknown.length) throw new Error(`Unknown slots: ${unknown.join(', ')}. Slots: ${Object.keys(manifest.slots).join(', ')}`);

  // Every slot gets a decision: the given value, the template's sample (previews only), or empty.
  const slots: Record<string, string | null> = {};
  for (const [k, s] of Object.entries(manifest.slots)) {
    const v = given[k];
    slots[k] = v != null && v !== '' ? v : k in given || !fillDefaults ? null : s.default;
  }
  for (const [k, d] of Object.entries(config.derive ?? {})) {
    const src = slots[d.from];
    if (!slots[k] && src) slots[k] = (d.firstWord ? src.trim().split(/\s+/)[0] : src) + (d.suffix ?? '');
  }
  // Everything not marked optional is essential: a template never goes out half empty.
  const optional = new Set(config.optional ?? []);
  const missingEssential = Object.keys(manifest.slots).filter((k) => !optional.has(k) && !slots[k] && slotInFormat(manifest, k, format));
  if (missingEssential.length && !fillDefaults) throw new MissingRequired(missingEssential);

  // Variant: the first one whose condition matches (e.g. no photo → "no-photo").
  const variant = Object.entries(manifest.variants ?? {}).find(([, v]) => (v.when?.empty ?? []).every((k) => !slots[k]))?.[0] ?? null;

  const f = variant ? manifest.variants![variant].formats[format] : manifest.formats[format];
  if (!f) throw new Error(`Template ${template} variant ${variant} has no format "${format}"`);

  const rules = await loadRules(template, manifest);
  if (variant && rules.variants?.[variant]?.slots) {
    for (const [k, o] of Object.entries(rules.variants[variant].slots)) rules.slots[k] = { ...(rules.slots[k] as object), ...o };
  }
  const values: Record<string, string | null> = {};
  for (const [k, v] of Object.entries(slots)) {
    const type = manifest.slots[k].type;
    values[k] = !v ? v : type === 'logo' ? await resolveLogo(template, v, origin) : type === 'image' ? await resolveImage(template, v, origin) : v;
  }
  const limitKey = variant ? `${format}--${variant}` : format;
  const limits = Object.fromEntries(Object.entries(manifest.slots).map(([k, s]) => [k, s.limits && { [format]: s.limits[limitKey] }]));
  const imageUrls: Record<string, string> = {};
  const iconSvgs: Record<string, string> = {};
  for (const e of Object.values(edits)) {
    if (e.image && !imageUrls[e.image]) imageUrls[e.image] = await resolveImage(template, e.image, origin);
    if (e.icon && !iconSvgs[e.icon]) {
      const svg = await iconMarkup(e.icon);
      if (!svg) throw new Error(`Unknown icon: ${e.icon}`);
      iconSvgs[e.icon] = svg;
    }
  }
  return {
    template, format, variant, slots, html: `templates/${template}/${f.html}`, width: f.width, height: f.height,
    fill: { format, formats: Object.keys(manifest.formats), values, rules, limits }, imageUrls, iconSvgs,
  };
}

// Image values: `asset:<id>` from the approved library, `upload:<path>` (brought in by someone, kept in
// the uploads bucket), an https URL, or a path inside the template. `origin` is where the page reads the
// repo files: the renderer's fake origin, or /api/template-files for the Canvas editor.
// Logos are inlined as data URLs so the page can use them as a CSS mask (no cross-origin limits).
async function resolveLogo(template: string, v: string, origin = ORIGIN): Promise<string> {
  if (v.startsWith('data:image/')) return v;
  const src = await resolveImage(template, v, origin);
  if (src.startsWith(`${origin}/`)) {
    const rel = decodeURIComponent(src.slice(origin.length + 1));
    const file = path.resolve(ROOT, rel);
    if (!file.startsWith(ROOT + path.sep)) throw new Error(`Unknown logo: ${v}`);
    const body = await fs.readFile(file);
    return `data:${MIME[path.extname(file)] ?? 'image/png'};base64,${body.toString('base64')}`;
  }
  const res = await fetch(src, { headers: { 'User-Agent': 'Mozilla/5.0 ArchyStudio' } });
  if (!res.ok) throw new Error(`Could not load the logo at ${v} (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > 5_000_000) throw new Error(`The logo at ${v} is larger than 5 MB`);
  const type = res.headers.get('content-type')?.split(';')[0] || 'image/png';
  return `data:${type};base64,${buf.toString('base64')}`;
}

async function resolveImage(template: string, v: string, origin = ORIGIN): Promise<string> {
  if (v.startsWith('asset:')) {
    const asset = (await loadLibrary()).find((a) => a.id === v.slice(6));
    if (!asset) throw new Error(`Unknown asset: ${v.slice(6)}. Use list_assets to see the approved ones.`);
    return `${origin}/library/${asset.file}`;
  }
  if (v.startsWith('upload:')) {
    const { data, error } = await supabaseAdmin().storage.from('uploads').createSignedUrl(v.slice(7), 60 * 60);
    if (error || !data) throw new Error(`Could not open the image ${v}: ${error?.message}`);
    return data.signedUrl;
  }
  if (/^https:\/\//.test(v)) return v;
  return `${origin}/templates/${template}/${v}`;
}

// Slots can be absent from some formats (an OG without the venue line).
function slotInFormat(manifest: Awaited<ReturnType<typeof loadManifest>>, slot: string, format: string) {
  const per = (manifest.slots[slot] as { perFormat?: Record<string, unknown> }).perFormat;
  return !per || format in per;
}
