import 'server-only';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Brand } from './brands';
import type { Edits, FillPlan } from './canvas-shared';
import { ORIGIN, resolveImage } from './fill';
import { findAsset } from './asset-ids';
import { getAsset } from './assets';
import { iconMarkup } from './icons';
import { ROOT } from './templates';

// Explorations: a design for a brief no template covers, written by Claude as HTML in the brand kit
// (brand-kit/<brand>/) and drawn by the same renderer. Studio wraps it in the artboard, puts in the real
// logo, icons, textures and images, and scripts/explore-check.js checks it against the brand. A saved
// exploration keeps the HTML Claude wrote (renders.html) under the template id "exploration".

export const EXPLORATION = 'exploration';
export const EXPLORATION_BRANDS: Brand[] = ['archy'];
export const MAX_HTML = 60_000;
export const SIZE = { min: 200, max: 4000 };

// Sky is never a ground (Juan, 2026-10-09): its gradient is left out.
export const TEXTURES = ['navy', 'deep-blue', 'primary', 'royal-blue', 'ice', 'pure-white', 'white', 'mist'] as const;

const kitFile = (brand: Brand, file: string) => path.join(ROOT, 'brand-kit', brand, file);
const cache = new Map<string, Promise<string>>();
const read = (file: string) => {
  if (process.env.NODE_ENV !== 'production') return fs.readFile(file, 'utf8');
  let p = cache.get(file);
  if (!p) { p = fs.readFile(file, 'utf8'); cache.set(file, p); }
  return p;
};

/** The brand kit Claude reads before composing (get_brand_kit). */
export async function brandKit(brand: Brand): Promise<string> {
  if (!EXPLORATION_BRANDS.includes(brand)) throw new Error(`Explorations are for Archy only for now. For ${brand.toUpperCase()}, report the missing template.`);
  return read(kitFile(brand, 'kit.md'));
}

const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

// What never belongs in a design: scripts, frames, forms, outside stylesheets and handlers. The page is
// also cut off from the network (the renderer serves only the kit, the fonts and the resolved images).
export function sanitize(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|iframe|object|embed|form|template|noscript)\b[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<\/?(script|style|iframe|object|embed|link|meta|base|form|input|button|textarea|select|template|noscript|html|head|body)\b[^>]*>/gi, '')
    .replace(/\s(on[a-z]+|srcdoc|formaction)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    // What an image is (generated, Pixel Tone) is read from Assets, never taken from the HTML.
    .replace(/\sdata-kind\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/@import/gi, '')
    .replace(/expression\s*\(/gi, '(');
}

export type Composition = {
  /** The whole page: the artboard with Claude's HTML, the kit's tokens, fonts and pieces filled in. */
  page: string;
  /** The image URLs the page may load (the renderer lets only these and the kit through). */
  images: string[];
  /** Problems found before drawing (an unknown icon, an image that does not open). */
  problems: string[];
};

// The artboard page for one format. `origin` is where the page reads the repo files (the renderer's).
export async function compose(input: { html: string; width: number; height: number; brand: Brand; title?: string }, origin = ORIGIN): Promise<Composition> {
  const { width, height, brand } = input;
  if (!EXPLORATION_BRANDS.includes(brand)) throw new Error(`Explorations are for Archy only for now.`);
  if (input.html.length > MAX_HTML) throw new Error(`The HTML is ${input.html.length} characters; keep it under ${MAX_HTML}.`);
  for (const [k, v] of [['width', width], ['height', height]] as const) {
    if (!Number.isFinite(v) || v < SIZE.min || v > SIZE.max) throw new Error(`The ${k} must be ${SIZE.min}–${SIZE.max} px.`);
  }
  const problems: string[] = [];
  const images = new Set<string>();
  let html = sanitize(input.html);

  // The logo: the real wordmark, coloured for its ground (white unless data-on="light").
  const logo = (await read(kitFile(brand, 'logo.svg'))).replace('<svg ', '<svg width="100%" height="100%" preserveAspectRatio="xMinYMid meet" style="display:block" ');
  html = html.replace(/<(div|span)\b([^>]*\bdata-piece="logo"[^>]*)>\s*<\/\1>/gi, (_m, tag: string, attrs: string) => {
    const light = /\bdata-on="light"/i.test(attrs);
    const style = (attrs.match(/\bstyle="([^"]*)"/i)?.[1] ?? '').replace(/(^|;)\s*(height|aspect-ratio|color)\s*:[^;]*/gi, '');
    const rest = attrs.replace(/\bstyle="[^"]*"/i, '');
    const name = /\bdata-name=/.test(rest) ? '' : ' data-name="Logo Archy"';
    return `<${tag}${rest}${name} style="${style}; display: block; aspect-ratio: 18 / 7; flex-shrink: 0; color: ${light ? 'var(--color-royal-blue-500)' : 'var(--color-white)'}">${logo}</${tag}>`;
  });

  // Icons by their Hugeicons name, stroked in the layer's colour (stroke 1.5, round caps).
  const iconTags = [...html.matchAll(/<(span|div|i)\b([^>]*\bdata-icon="([A-Za-z0-9]+)"[^>]*)>\s*<\/\1>/g)];
  for (const [whole, tag, attrs, name] of iconTags) {
    const inner = await iconMarkup(name);
    if (!inner) { problems.push(`Unknown icon "${name}" (use a Hugeicons export name, e.g. Calendar03Icon).`); continue; }
    const svg = `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">${inner.replace(/stroke-width="[^"]*"/g, 'stroke-width="1.5"')}</svg>`;
    const named = /\bdata-name=/.test(attrs) ? '' : ` data-name="Icon ${name.replace(/Icon$/, '')}"`;
    html = html.replace(whole, `<${tag}${attrs}${named}>${svg}</${tag}>`);
  }

  // Pixel Dissolve and Pixels Behind (Archy - Brand › Textures › Pixel Effects): the grain as square cells
  // in brand tokens, drawn over a person's lower body (dissolve) or behind a tight headshot (behind).
  html = html.replace(/<(div|span)\b([^>]*\bdata-piece="(pixel-dissolve|pixels-behind)"[^>]*)>\s*<\/\1>/gi, (_m, tag: string, attrs: string, kind: string) => {
    const style = attrs.match(/\bstyle="([^"]*)"/i)?.[1] ?? '';
    const px = (k: string) => Number(style.match(new RegExp(`(?:^|;)\\s*${k}\\s*:\\s*([\\d.]+)px`, 'i'))?.[1]);
    const w = px('width'), h = px('height');
    if (!w || !h) { problems.push(`The ${kind} needs a width and a height in px.`); return ''; }
    const ground = (attrs.match(/\bdata-ground="([a-z-]+)"/i)?.[1] ?? 'royal') as keyof typeof CELL_COLOURS;
    // Cells read as pixels, not noise: 16 px for a dissolve and 20 behind a headshot on a 1080 piece.
    const cell = Number(attrs.match(/\bdata-cell="([\d.]+)"/i)?.[1]) || Math.round((kind === 'pixels-behind' ? 20 : 16) * Math.max(0.5, width / 1080));
    const name = /\bdata-name=/.test(attrs) ? '' : ` data-name="${kind === 'pixel-dissolve' ? 'Pixel Dissolve' : 'Pixels Behind'}"`;
    const colours = kind === 'pixels-behind' ? BEHIND_COLOURS[ground] ?? BEHIND_COLOURS.royal : CELL_COLOURS[ground] ?? CELL_COLOURS.royal;
    return `<${tag}${attrs}${name}>${cells(kind as 'pixel-dissolve' | 'pixels-behind', w, h, cell, colours)}</${tag}>`;
  });

  // Images: data-image on a block (its background), or <img src>. asset:, upload: and https values.
  const resolve = async (v: string) => {
    if (v.startsWith('placeholder:')) return `${origin}/library/placeholders/${v.slice(12) === 'person' ? 'person' : 'scene'}.png`;
    if (!/^(asset:|upload:|https:\/\/)/.test(v)) throw new Error(`"${v}" is not an image Studio can open (use asset:<id>, upload:<path> or an https link).`);
    return resolveImage(EXPLORATION, v, origin);
  };
  for (const [whole, before, value, after] of [...html.matchAll(/<([a-z]+\b[^>]*?)\bdata-image="([^"]+)"([^>]*)>/gi)]) {
    try {
      const url = await resolve(value.replace(/&amp;/g, '&'));
      images.add(url);
      // Generated images and Pixel Tone photos are marked: the checks hold them to their own rules.
      const info = await imageInfo(value.replace(/&amp;/g, '&'), url, origin);
      const marks = `${info.kind ? ` data-kind="${info.kind}"` : ''}${info.subject ? ` data-subject="${info.subject.join(',')}" data-mask="${info.mask}" data-iw="${info.w}" data-ih="${info.h}"` : ''}`;
      const attrs = `${before}data-image="${value}"${marks}${after}`;
      const style = attrs.match(/\bstyle="([^"]*)"/i)?.[1];
      const bg = `background-image: url(&quot;${esc(url)}&quot;)`;
      const next = style != null ? attrs.replace(/\bstyle="([^"]*)"/i, `style="$1; ${bg}"`) : `${attrs} style="${bg}"`;
      html = html.replace(whole, `<${next}>`);
    } catch (e) { problems.push((e as Error).message); }
  }
  for (const [whole, value] of [...html.matchAll(/<img\b[^>]*?\bsrc="([^"]+)"[^>]*>/gi)]) {
    try {
      const url = await resolve(value.replace(/&amp;/g, '&'));
      images.add(url);
      html = html.replace(whole, whole.replace(`src="${value}"`, `src="${esc(url)}" data-src="${value}"`));
    } catch (e) { problems.push((e as Error).message); }
  }
  // Any other url() would reach outside the page: only the kit's textures and the images above draw.
  html = html.replace(/url\(\s*(&quot;|"|'|)(.*?)\1\s*\)/gi, (m, _q: string, u: string) => (images.has(u.replace(/&amp;/g, '&')) ? m : 'none'));

  // Every layer gets an id (the checks, the Inspector and Canvas address layers by it).
  let n = 0;
  html = html.replace(/<([a-z][a-z0-9]*)\b(?![^>]*\bdata-node=)/gi, (m, tag: string) => (/^(path|g|circle|rect|line|polyline|polygon|ellipse|defs|clippath|lineargradient|stop|use|mask)$/i.test(tag) ? m : `<${tag} data-node="x${(n++).toString(36)}"`));

  const tokens = await read(kitFile(brand, 'tokens.css'));
  const textures = TEXTURES.map((t) => `[data-texture="${t}"] { background-image: url("${origin}/brand-kit/${brand}/textures/${t}.png"); background-size: 2000px 2000px; background-position: center; background-repeat: no-repeat; }`).join('\n');
  const root = `width: ${width}px; height: ${height}px; position: relative; overflow: clip; background: var(--color-white)`;
  const page = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${esc(input.title ?? 'Exploration')}</title>
<link rel="stylesheet" href="${origin}/fonts/fonts.css">
<style>
${tokens}
html, body { margin: 0; padding: 0; background: transparent; }
* { box-sizing: border-box; }
[data-node="root"], [data-node="root"] * {
  font-synthesis: none; overflow-wrap: break-word; font-optical-sizing: none;
  -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;
}
[data-node="root"] { font-family: var(--font-body), system-ui, sans-serif; color: var(--color-blue-tint-800); }
[data-image] { background-repeat: no-repeat; }
${textures}
</style>
</head>
<body>
<div data-node="root" data-name="Exploration · ${width}×${height}" style="${root}">
${html}
</div>
</body>
</html>`;
  return { page, images: [...images], problems };
}

// Safe areas of the formats the kit names (brand-kit/<brand>/kit.md); any other size keeps about 7% of
// its short side.
const SAFE: Record<string, { x: number; y: number; w: number; h: number }> = {
  '1080x1350': { x: 105, y: 105, w: 870, h: 1140 },
  '1080x1080': { x: 105, y: 105, w: 870, h: 870 },
  '1080x1920': { x: 105, y: 250, w: 870, h: 1420 },
  '1200x630': { x: 60, y: 54, w: 1080, h: 522 },
  '1584x396': { x: 72, y: 48, w: 1440, h: 300 },
  '1200x627': { x: 60, y: 54, w: 1080, h: 519 },
  '1200x400': { x: 56, y: 48, w: 1088, h: 304 },
};

/** What the brand check holds one format to (scripts/explore-check.js). */
export async function checksFor(width: number, height: number, brand: Brand) {
  const m = Math.max(40, Math.round(Math.min(width, height) * 0.07));
  const safe = SAFE[`${width}x${height}`] ?? { x: m, y: m, w: width - 2 * m, h: height - 2 * m };
  const tokens = await read(kitFile(brand, 'tokens.css'));
  // Every token hex, and the one sanctioned computed tint (the Ruler on royal blue).
  const palette = [...new Set([...tokens.matchAll(/#[0-9a-f]{6}\b/gi)].map((x) => x[0].toUpperCase()).concat(['#2A5DF6']))];
  // Type and logo scale with the piece: its width, but a wide, short banner is read like a post as tall as
  // it is (a 1584×396 banner holds about the type of a 500 px post).
  const s = Math.min(Math.max(Math.min(width, height * 1.25) / 1080, 0.55), 1.5);
  return { maskW: MASK_W, maskH: MASK_H, safe, palette, fonts: ['Onest', 'Inter'], minText: Math.max(14, 18 * s), minLogo: Math.max(110, 200 * s), minHeadline: 110 * s, roomHeadline: 160 * s, smallText: 24 * s, maxGap: 160 * s, holeWarn: 0.22, holeError: 0.3, bigPhoto: 0.25 };
}

// What an image is, for the checks: an AI image (generated), a Pixel Tone photo (tone) or a person
// without background (cutout: it has no edge to cut across the piece). For a cut-out, where the person
// actually is inside the image (`subject`: left, top, right, bottom as fractions), so the checks can keep
// the copy and the logo clear of the person rather than of a transparent rectangle.
type ImageInfo = { kind: 'generated' | 'tone' | 'cutout' | null; subject?: number[]; mask?: string; w?: number; h?: number };
const infos = new Map<string, Promise<ImageInfo>>();
function imageInfo(v: string, url: string, origin: string): Promise<ImageInfo> {
  let p = infos.get(v);
  if (!p) {
    p = readImageInfo(v, url, origin).catch(() => ({ kind: null }));
    if (infos.size > 200) infos.delete(infos.keys().next().value!);
    infos.set(v, p);
  }
  return p;
}
async function readImageInfo(v: string, url: string, origin: string): Promise<ImageInfo> {
  let kind: ImageInfo['kind'] = null;
  if (v.startsWith('asset:')) {
    const hit = await findAsset(v.slice(6)).catch(() => null);
    const a = hit ? await getAsset(hit.id).catch(() => null) : null;
    if (a?.kind === 'generated') return { kind: 'generated' };
    if (a?.kind === 'pixel') return { kind: /tone/i.test(a.name) ? 'tone' : null };
    if (a?.kind === 'cutout') kind = 'cutout';
  }
  // The pixels: a placeholder from the library, anything else from its (signed) link.
  const body = url.startsWith(`${origin}/library/`)
    ? await fs.readFile(path.join(ROOT, decodeURIComponent(url.slice(origin.length + 1))))
    : /^https:\/\//.test(url) ? Buffer.from(await (await fetch(url, { signal: AbortSignal.timeout(15_000) })).arrayBuffer()) : null;
  if (!body) return { kind };
  const box = await cutoutBox(body);
  return box ? { kind: 'cutout', ...box } : { kind };
}

// The mask's grid: where the person is, cell by cell (MASK_W across, MASK_H down), as hex.
export const MASK_W = 48, MASK_H = 64;

/** A cut-out's subject (where its opaque pixels are, as fractions), its mask and size; null for an opaque image. */
export async function cutoutBox(body: Buffer): Promise<{ subject: number[]; mask: string; w: number; h: number } | null> {
  const sharp = (await import('sharp')).default;
  const meta = await sharp(body).metadata();
  if (!meta.hasAlpha || !meta.width || !meta.height) return null;
  const { data, info } = await sharp(body).ensureAlpha().extractChannel(3).resize({ width: 256, height: 256, fit: 'inside' }).raw().toBuffer({ resolveWithObject: true });
  let l = info.width, t = info.height, r = -1, b = -1, clear = 0;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    if (data[y * info.width + x] > 32) { if (x < l) l = x; if (x > r) r = x; if (y < t) t = y; if (y > b) b = y; } else clear++;
  }
  // Mostly opaque: a photo with a few transparent pixels, not a cut-out.
  if (r < 0 || clear < info.width * info.height * 0.1) return null;
  const f = (n: number, d: number) => +(n / d).toFixed(3);
  const grid = await sharp(body).ensureAlpha().extractChannel(3).resize(MASK_W, MASK_H, { fit: 'fill' }).raw().toBuffer();
  let bits = '';
  for (let i = 0; i < MASK_W * MASK_H; i += 4) bits += ((grid[i] > 64 ? 8 : 0) | (grid[i + 1] > 64 ? 4 : 0) | (grid[i + 2] > 64 ? 2 : 0) | (grid[i + 3] > 64 ? 1 : 0)).toString(16);
  return { subject: [f(l, info.width), f(t, info.height), f(r + 1, info.width), f(b + 1, info.height)], mask: bits, w: meta.width, h: meta.height };
}

// The cell colours per ground, as in Paper. Pixel Dissolve: light blues on blue and dark grounds, darks on
// light ones. Pixels Behind (BEHIND_COLOURS): three tokens, the darkest lowest.
const CELL_COLOURS = {
  royal: ['--color-blue-tint-300', '--color-white', '--color-sky-blue-400', '--color-blue-tint-200'],
  primary: ['--color-blue-tint-300', '--color-white', '--color-sky-blue-400', '--color-blue-tint-200'],
  navy: ['--color-royal-blue-500', '--color-sky-blue-400', '--color-blue-tint-300', '--color-white'],
  ice: ['--color-blue-tint-800', '--color-royal-blue-500', '--color-sky-blue-400', '--color-blue-tint-300'],
};

// Whole square cells anchored to the bottom edge (the bleed): sparse at the top of the band, denser toward
// the bottom. A fixed pseudo-random pattern, so the same piece always draws the same cells.
const BEHIND_COLOURS = {
  royal: ['--color-blue-tint-800', '--color-primary-blue-600', '--color-sky-blue-400'],
  primary: ['--color-blue-tint-800', '--color-royal-blue-500', '--color-sky-blue-400'],
  navy: ['--color-primary-blue-600', '--color-royal-blue-500', '--color-sky-blue-400'],
  ice: ['--color-blue-tint-800', '--color-royal-blue-500', '--color-blue-tint-300'],
};

function cells(kind: 'pixel-dissolve' | 'pixels-behind', w: number, h: number, cell: number, colours: string[]): string {
  const cols = Math.ceil(w / cell), rows = Math.floor(h / cell);
  const rand = (x: number, y: number, k: number) => { const v = Math.sin(x * 127.1 + y * 311.7 + k * 74.7) * 43758.5453; return v - Math.floor(v); };
  const out: string[] = [];
  for (let r = 0; r < rows; r++) {
    const f = 1 - r / Math.max(1, rows); // r = 0 is the bottom row
    const density = kind === 'pixel-dissolve' ? Math.pow(f, 1.6) : Math.min(1, Math.pow(f, 1.1) * 1.15);
    for (let c = 0; c < cols; c++) {
      if (rand(c, r, 1) > density) continue;
      let colour: string;
      if (kind === 'pixels-behind') {
        // Three bands, darkest lowest, with a little mixing at their edges.
        const band = Math.min(2, Math.floor((1 - f) * 3 + (rand(c, r, 2) - 0.5) * 0.6));
        colour = colours[Math.max(0, band)];
      } else {
        colour = colours[Math.floor(rand(c, r, 3) * colours.length)];
      }
      out.push(`<rect x="${c * cell}" y="${h - (r + 1) * cell}" width="${cell}" height="${cell}" fill="var(${colour})"/>`);
    }
  }
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg" style="display:block">${out.join('')}</svg>`;
}

// An exploration as a fill plan (lib/fill.ts): the page itself instead of a template file, no slots
// (all of its copy and images are layers, changed in Canvas as hand edits), and the edited images and
// icons resolved like a template's.
export async function explorationPlan(input: { html: string; width: number; height: number; brand?: Brand; format: string; edits: Edits }, origin = ORIGIN): Promise<FillPlan> {
  const { width, height, format, edits } = input;
  const comp = await compose({ html: input.html, width, height, brand: input.brand ?? 'archy' }, origin);
  const imageUrls: Record<string, string> = {};
  const iconSvgs: Record<string, string> = {};
  const images = [...new Set(Object.values(edits).map((e) => e.image).filter(Boolean) as string[])];
  const icons = [...new Set(Object.values(edits).map((e) => e.icon).filter(Boolean) as string[])];
  await Promise.all([
    ...images.map(async (i) => { imageUrls[i] = await resolveImage(EXPLORATION, i, origin); }),
    ...icons.map(async (i) => { const svg = await iconMarkup(i); if (!svg) throw new Error(`Unknown icon: ${i}`); iconSvgs[i] = svg; }),
  ]);
  const key = createHash('sha1').update(input.html).digest('hex').slice(0, 12);
  return {
    template: EXPLORATION, format, design: null, theme: null, variant: null, slots: {}, placeholders: [],
    html: `exploration/${format}-${key}`, page: comp.page, width, height,
    fill: { format, formats: [format], values: {}, rules: { slots: {} }, limits: {} }, imageUrls, iconSvgs,
  };
}
