import fs from 'node:fs/promises';
import path from 'node:path';
import type { Edits, FillPlan } from './canvas-shared';
import { boothLike, splitHeadline } from './canvas-sync';
import { iconMarkup } from './icons';
import { isPlaceholder, staticPlaceholder } from './placeholders';
import { supabaseAdmin } from './supabase/admin';
import { findAsset } from './asset-ids';
import { ROOT, comboFormats, loadConfig, loadLibrary, loadManifest, loadRules, resolveCombo, templateBrand } from './templates';

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
  /** The design and theme to draw (templates that offer them); each defaults to the template's default. */
  design?: string | null;
  theme?: string | null;
  slots: Record<string, string | null>;
  scale?: number;
  /** Previews only: slots not given keep the template's sample copy. */
  fillDefaults?: boolean;
  /** The requester chose "smaller text": copy that does not fit may shrink to 70% (never under 14px). */
  smallerText?: boolean;
  /** Hand edits from Canvas, applied after the fill. */
  edits?: Edits;
  /** Also describe the piece's components (scripts/components.js), for the Canvas tools of the MCP. */
  inspect?: boolean;
  /** Apply the Inspector's automatic fixes in the page (several rounds) and return the fixed edits. */
  autofix?: boolean;
};

// How far "smaller text" lets copy shrink (the design's own floor is usually 85%).
export const SMALLER_TEXT = 0.7;

export class MissingRequired extends Error {
  constructor(public slots: string[]) {
    super(`Missing required: ${slots.join(', ')}`);
  }
}

// Everything decided before the page opens: slot values (given, sample or derived), the variant, the
// fit rules and limits, and every image resolved to a URL under `origin`. The renderer and the Canvas
// editor share it, so both draw the same piece.
// `slotsOnly`: just the slot values (no images, rules or limits), for comparing with what was saved.
export async function prepareFill({ template, format, design, theme, slots: given, fillDefaults = false, edits = {}, smallerText = false }: Omit<RenderInput, 'scale'>, origin = ORIGIN, slotsOnly = false): Promise<FillPlan> {
  const [manifest, config] = await Promise.all([loadManifest(template), loadConfig(template)]);
  const combo = resolveCombo(manifest, design, theme);
  const files = comboFormats(manifest, combo);
  if (!files[format]) throw new Error(`Template ${template} has no format "${format}". Formats: ${Object.keys(files).join(', ')}`);
  // Files of this format and combo are keyed `<format>--<design>--<theme>` (just `<format>` for the default).
  const fileKey = combo?.key ? `${format}--${combo.key}` : format;
  const unknown = Object.keys(given).filter((k) => !manifest.slots[k]);
  if (unknown.length) throw new Error(`Unknown slots: ${unknown.join(', ')}. Slots: ${Object.keys(manifest.slots).join(', ')}`);

  // Every slot gets a decision: the given value, the template's sample (previews only), or empty.
  // A format can carry its own sample (the cover prints "Booth #1039" where the post prints "#1039").
  const sampleOf = (k: string) => (manifest.slots[k].perFormat?.[fileKey] as { sample?: string } | undefined)?.sample ?? manifest.slots[k].default;
  const slots: Record<string, string | null> = {};
  for (const k of Object.keys(manifest.slots)) {
    const v = given[k];
    slots[k] = v != null && v !== '' ? v : k in given || !fillDefaults ? null : sampleOf(k);
  }
  for (const [k, d] of Object.entries(config.derive ?? {})) {
    const src = slots[d.from];
    // A headline split follows the event's own headline even where the format has a sample of its own.
    const sampled = d.line != null && !given[k] && given[d.from];
    if ((slots[k] && !sampled) || !src) continue;
    slots[k] = d.line != null ? splitHeadline(src)[d.line] : (d.firstWord ? src.trim().split(/\s+/)[0] : src) + (d.suffix ?? '');
  }
  // The booth in the shape this format prints it ("#1039" or "Booth #1039").
  if (slots.booth && manifest.slots.booth) slots.booth = boothLike(slots.booth, sampleOf('booth'));
  // Everything not marked optional is essential: a template never goes out half empty.
  const optional = new Set(config.optional ?? []);
  const missingEssential = Object.keys(manifest.slots).filter((k) => !optional.has(k) && !slots[k] && slotInFormat(manifest, k, fileKey));
  // A missing photo never holds a design back: a neutral placeholder takes its place until the real one
  // comes (the MCP's render brings one closer to the brief first; see lib/placeholders.ts).
  if (!fillDefaults) for (const k of missingEssential) if (manifest.slots[k].type === 'image') slots[k] = staticPlaceholder(config.facts?.[k]);
  // An optional photo that belongs to something given (a second speaker's name): a placeholder too, so the
  // speaker never shows without a face; with nothing given, it goes with its block.
  if (!fillDefaults) for (const [k, by] of Object.entries(config.photoWith ?? {})) if (!slots[k] && slots[by] && manifest.slots[k]) slots[k] = staticPlaceholder(config.facts?.[k]);
  const stillMissing = missingEssential.filter((k) => !slots[k]);
  if (stillMissing.length && !fillDefaults) throw new MissingRequired(stillMissing);

  // Variant: the first one whose condition matches (e.g. no photo → "no-photo").
  // A chosen design × theme has no automatic variants.
  const variant = combo?.key ? null : Object.entries(manifest.variants ?? {}).find(([, v]) => (v.when?.empty ?? []).every((k) => !slots[k]))?.[0] ?? null;
  if (slotsOnly) return { slots } as FillPlan;

  const f = combo?.key ? files[format] : variant ? manifest.variants![variant].formats[format] : manifest.formats[format];
  if (!f) throw new Error(`Template ${template} variant ${variant} has no format "${format}"`);

  const rules = await loadRules(template, manifest);
  if (smallerText) rules.shrinkTo = SMALLER_TEXT;
  if (variant && rules.variants?.[variant]?.slots) {
    for (const [k, o] of Object.entries(rules.variants[variant].slots)) rules.slots[k] = { ...(rules.slots[k] as object), ...o };
  }
  // The cover's Pixel Tone follows the theme's ground when the template has several (rules.coverTones).
  const tones = (rules as { coverTones?: Record<string, string> }).coverTones;
  if (combo && tones?.[combo.theme]) (rules as { coverTone?: string }).coverTone = tones[combo.theme];
  const byDesign = combo && rules.designs?.[combo.design];
  if (byDesign) {
    Object.assign(rules.slots, byDesign.slots ?? {});
    if (byDesign.containers) rules.containers = byDesign.containers;
    if (byDesign.fill !== undefined) (rules as { fill?: unknown }).fill = byDesign.fill;
  }
  // Images and logos resolve together (signed links, remote logos), not one after another.
  const values: Record<string, string | null> = Object.fromEntries(await Promise.all(Object.entries(slots).map(async ([k, v]) => {
    const type = manifest.slots[k].type;
    return [k, !v ? v : type === 'logo' ? await resolveLogo(template, v, origin) : type === 'image' ? await resolveImage(template, v, origin) : v];
  })));
  const limitKey = combo?.key ? fileKey : variant ? `${format}--${variant}` : format;
  const limits = Object.fromEntries(Object.entries(manifest.slots).map(([k, s]) => [k, s.limits && { [format]: s.limits[limitKey] }]));
  const imageUrls: Record<string, string> = {};
  const iconSvgs: Record<string, string> = {};
  const images = [...new Set(Object.values(edits).map((e) => e.image).filter(Boolean) as string[])];
  const icons = [...new Set(Object.values(edits).map((e) => e.icon).filter(Boolean) as string[])];
  await Promise.all([
    ...images.map(async (i) => { imageUrls[i] = await resolveImage(template, i, origin); }),
    ...icons.map(async (i) => {
      const svg = await iconMarkup(i);
      if (!svg) throw new Error(`Unknown icon: ${i}`);
      iconSvgs[i] = svg;
    }),
  ]);
  return {
    template, format, design: combo?.design ?? null, theme: combo?.theme ?? null, variant, slots,
    placeholders: Object.keys(slots).filter((k) => manifest.slots[k].type === 'image' && slotInFormat(manifest, k, fileKey) && isPlaceholder(slots[k])), html: `templates/${template}/${f.html}`, width: f.width, height: f.height,
    fill: { format, formats: Object.keys(manifest.formats), values, rules, limits }, imageUrls, iconSvgs,
  };
}

// Image values: `asset:<id>` from a template's sample images, `upload:<path>` (brought in by someone, kept in
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
  // A partner logo from the web is fetched once per server instance (Canvas opens every format with it).
  // Uploaded logos are known by their path (their signed link changes).
  const id = v.startsWith('upload:') ? v : src;
  const known = remoteLogos.get(id);
  if (known) return known;
  const res = await fetch(src, { headers: { 'User-Agent': 'Mozilla/5.0 ArchyStudio' } });
  if (!res.ok) throw new Error(`Could not load the logo at ${v} (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > 5_000_000) throw new Error(`The logo at ${v} is larger than 5 MB`);
  const type = res.headers.get('content-type')?.split(';')[0] || 'image/png';
  const data = `data:${type};base64,${buf.toString('base64')}`;
  if (remoteLogos.size > 50) remoteLogos.delete(remoteLogos.keys().next().value!);
  remoteLogos.set(id, data);
  return data;
}
const remoteLogos = new Map<string, string>();
const signed = new Map<string, { url: string; until: number }>();

async function resolveImage(template: string, v: string, origin = ORIGIN): Promise<string> {
  // Neutral stand-ins in the template's brand (DOC's are grey, never Archy blue).
  if (v.startsWith('placeholder:')) return `${origin}/library/placeholders/${v.slice(12) === 'person' ? 'person' : 'scene'}${(await templateBrand(template)) === 'doc' ? '-doc' : ''}.png`;
  if (v.startsWith('asset:')) {
    const id = v.slice(6).trim();
    const asset = (await loadLibrary()).find((a) => a.id === id);
    if (asset) return `${origin}/library/${asset.file}`;
    // A team image by its ID in Assets (the short one shown there, or the whole one).
    const team = await findAsset(id);
    if (!team) throw new Error(`Unknown asset: ${id}. Use the ID shown in Studio → Assets, or an image from list_assets.`);
    v = `upload:${team.path}`;
  }
  if (v.startsWith('upload:')) {
    // One link per image for most of its hour: the same link each time, so the browser keeps the image
    // and Canvas does not redraw a format whose images did not change.
    const hit = signed.get(v);
    if (hit && hit.until > Date.now()) return hit.url;
    const { data, error } = await supabaseAdmin().storage.from('uploads').createSignedUrl(v.slice(7), 60 * 60);
    if (error || !data) throw new Error(`Could not open the image ${v}: ${error?.message}`);
    if (signed.size > 500) signed.delete(signed.keys().next().value!);
    signed.set(v, { url: data.signedUrl, until: Date.now() + 50 * 60 * 1000 });
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
