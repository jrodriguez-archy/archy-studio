import fs from 'node:fs/promises';
import path from 'node:path';

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
  slots: Record<string, { type: 'text' | 'image'; default: string; limits?: Record<string, SlotLimits> }>;
  optionals: Record<string, { contains: string[] }>;
};

export type Rules = Record<string, unknown> & {
  slots: Record<string, unknown>;
  optionals?: Manifest['optionals'];
  variants?: Record<string, { slots?: Record<string, object> }>;
};

const SAFE_ID = /^[a-z0-9-]+$/;

export async function listTemplates(): Promise<Manifest[]> {
  const dir = path.join(ROOT, 'templates');
  const ids = (await fs.readdir(dir, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name);
  return Promise.all(ids.map((id) => loadManifest(id)));
}

export async function loadManifest(id: string): Promise<Manifest> {
  if (!SAFE_ID.test(id)) throw new Error(`Unknown template: ${id}`);
  const file = path.join(ROOT, 'templates', id, 'manifest.json');
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    throw new Error(`Unknown template: ${id}`);
  }
}

export async function loadRules(id: string, manifest: Manifest): Promise<Rules> {
  const rules = JSON.parse(await fs.readFile(path.join(ROOT, 'templates', id, 'rules.json'), 'utf8'));
  rules.optionals = manifest.optionals;
  return rules;
}

export type TemplateConfig = {
  id: string;
  title: string;
  description: string;
  useWhen?: string;
  notWhen?: string;
  guidance?: string[];
  required?: string[];
  derive?: Record<string, { from: string; firstWord?: boolean; suffix?: string }>;
  variants?: Record<string, { label: string; when?: { empty?: string[] } }>;
};

export async function loadConfig(id: string): Promise<TemplateConfig> {
  if (!SAFE_ID.test(id)) throw new Error(`Unknown template: ${id}`);
  return JSON.parse(await fs.readFile(path.join(ROOT, 'templates', id, 'template.config.json'), 'utf8'));
}

export type LibraryAsset = {
  id: string;
  kind: string;
  title: string;
  description: string;
  file: string;
  fits?: string[];
};

export async function loadLibrary(): Promise<LibraryAsset[]> {
  return JSON.parse(await fs.readFile(path.join(ROOT, 'library', 'library.json'), 'utf8'));
}
