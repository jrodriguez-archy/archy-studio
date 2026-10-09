import fs from 'node:fs/promises';
import path from 'node:path';
import { brandOf, type Brand } from './brands';

// Repo root holds templates/, fonts/ and scripts/fit.js (bundled via outputFileTracingIncludes).
export const ROOT = process.cwd();

export type SlotLimits = {
  maxCharsPerLine: number;
  maxLines: number;
  fontSize: { max: number; min: number };
  roomPx: number;
};

export type Manifest = {
  id: string;
  title: string;
  description: string;
  formats: Record<string, { label: string; width: number; height: number; html: string }>;
  variants?: Record<string, { label: string; when?: { empty?: string[] }; formats: Record<string, { label: string; width: number; height: number; html: string }> }>;
  /** Designs (layouts) and themes (colour treatments) the requester can choose. `formats` is the default combo. */
  designs?: Record<string, { label: string }>;
  themes?: Record<string, { label: string }>;
  default?: { design: string; theme: string };
  /** Every other design × theme, keyed `<design>--<theme>`. */
  combos?: Record<string, { design: string; theme: string; formats: Record<string, { label: string; width: number; height: number; html: string }> }>;
  slots: Record<string, { type: 'text' | 'image' | 'logo'; default: string; perFormat?: Record<string, unknown>; limits?: Record<string, SlotLimits> }>;
  optionals: Record<string, { contains: string[] }>;
};

export type Rules = Record<string, unknown> & {
  slots: Record<string, unknown>;
  optionals?: Manifest['optionals'];
  variants?: Record<string, { slots?: Record<string, object> }>;
  /** A design replaces the slot rules it names (and the containers and fill when given): its layers differ. */
  designs?: Record<string, { slots?: Record<string, object>; containers?: unknown[]; fill?: unknown }>;
};

export type Combo = { design: string; theme: string; key: string | null };

// The design × theme a piece uses: the requested one (each part defaults to the template's default),
// validated. `key` is null for the default combo, whose files are the base formats.
export function resolveCombo(manifest: Manifest, design?: string | null, theme?: string | null): Combo | null {
  if (!manifest.default) {
    if (design || theme) throw new Error(`Template ${manifest.id} has a single design and theme.`);
    return null;
  }
  const d = design || manifest.default.design;
  const t = theme || manifest.default.theme;
  if (!manifest.designs?.[d]) throw new Error(`Template ${manifest.id} has no design "${d}". Designs: ${Object.keys(manifest.designs ?? {}).join(', ')}`);
  if (!manifest.themes?.[t]) throw new Error(`Template ${manifest.id} has no theme "${t}". Themes: ${Object.keys(manifest.themes ?? {}).join(', ')}`);
  if (d === manifest.default.design && t === manifest.default.theme) return { design: d, theme: t, key: null };
  const key = `${d}--${t}`;
  if (!manifest.combos?.[key]) throw new Error(`Template ${manifest.id} has no ${manifest.designs[d].label} design in the ${manifest.themes[t].label} theme.`);
  return { design: d, theme: t, key };
}

// The page files of a combo (the base formats for the default one).
export function comboFormats(manifest: Manifest, combo: Combo | null) {
  return combo?.key ? manifest.combos![combo.key].formats : manifest.formats;
}

const SAFE_ID = /^[a-z0-9-]+$/;

// Every template, or only one brand's (a template without a brand is Archy's).
export async function listTemplates(brand?: Brand): Promise<Manifest[]> {
  const dir = path.join(ROOT, 'templates');
  let ids = (await fs.readdir(dir, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name);
  if (brand) ids = (await Promise.all(ids.map(async (id) => ((await templateBrand(id)) === brand ? id : null)))).filter((id): id is string => !!id);
  return Promise.all(ids.map((id) => loadManifest(id)));
}

export async function templateBrand(id: string): Promise<Brand> {
  return brandOf((await loadConfig(id)).brand);
}

// Template files never change inside a deploy: read once per server instance (in development they are
// read every time, as they are being edited).
const texts = new Map<string, Promise<string>>();
const readText = (file: string) => {
  if (process.env.NODE_ENV !== 'production') return fs.readFile(file, 'utf8');
  let t = texts.get(file);
  if (!t) { t = fs.readFile(file, 'utf8'); t.catch(() => texts.delete(file)); texts.set(file, t); }
  return t;
};

export async function loadManifest(id: string): Promise<Manifest> {
  if (!SAFE_ID.test(id)) throw new Error(`Unknown template: ${id}`);
  const file = path.join(ROOT, 'templates', id, 'manifest.json');
  try {
    return JSON.parse(await readText(file));
  } catch {
    throw new Error(`Unknown template: ${id}`);
  }
}

export async function loadRules(id: string, manifest: Manifest): Promise<Rules> {
  const rules = JSON.parse(await readText(path.join(ROOT, 'templates', id, 'rules.json')));
  rules.optionals = manifest.optionals;
  return rules;
}

export type TemplateConfig = {
  id: string;
  /** The brand it belongs to (missing: Archy). Studio shows it only in that brand. */
  brand?: Brand;
  title: string;
  description: string;
  useWhen?: string;
  notWhen?: string;
  guidance?: string[];
  /** Top-level group in the catalog (the Paper master it comes from): events, ads... */
  category?: string;
  purpose?: string;
  /** Slots the template cannot go without; anything not listed in optional counts as essential. */
  essential?: string[];
  /** Slots only the event page cover format (`cover`, 1200×900) needs; asked for only when the cover is made. */
  coverEssential?: string[];
  /** Minor slots that may be left out (value and label go, the layout closes up). */
  optional?: string[];
  /** The brief fact each slot needs; null = copy written from the brief. */
  facts?: Record<string, string | null>;
  /** A slot filled from another when empty: its first word plus a suffix, or one line of a headline split in two (`line` 0 or 1, as the cover's headline-1 / headline-2). */
  derive?: Record<string, { from: string; firstWord?: boolean; suffix?: string; line?: 0 | 1 }>;
  variants?: Record<string, { label: string; when?: { empty?: string[] } }>;
};

export async function loadConfig(id: string): Promise<TemplateConfig> {
  if (!SAFE_ID.test(id)) throw new Error(`Unknown template: ${id}`);
  return JSON.parse(await readText(path.join(ROOT, 'templates', id, 'template.config.json')));
}

export type LibraryAsset = {
  id: string;
  /** The brand it belongs to (missing: Archy). */
  brand?: Brand;
  kind: string;
  title: string;
  description: string;
  file: string;
  fits?: string[];
};

export async function loadLibrary(): Promise<LibraryAsset[]> {
  return JSON.parse(await readText(path.join(ROOT, 'library', 'library.json')));
}
