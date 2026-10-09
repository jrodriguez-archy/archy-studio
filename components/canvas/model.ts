// What the editor reads from the template page: its components (from scripts/components.js, shared
// with the server), its colours and its tokens.

import type { Crop, NodeEdit } from '@/lib/canvas-shared';

export type Kind = 'background' | 'group' | 'text' | 'button' | 'icon' | 'photo' | 'partner' | 'archy' | 'tag' | 'line' | 'decoration';
export type Comp = {
  id: string; kind: Kind; name: string; parent: string | null; slot?: string;
  /** Inner parts edited from a button: its label text and its icon. */
  textId?: string; textSlot?: string; iconId?: string;
  /** A partner logo: how Studio draws it on its own (one colour, or its own colours). */
  logoAuto?: 'one' | 'original';
};
export type Box = { x: number; y: number; w: number; h: number; name?: string };
export type Token = { name: string; value: string; hex: string; group: 'Blues' | 'Neutrals' | 'Accents' };

// Facts about a node as it is drawn now, for the properties panel.
export type LayerInfo = {
  width: number; height: number; fontSize: number; fontWeight: number;
  color: string; backgroundColor: string; text: string; opacity: number;
  /** For flex frames (groups, tags, buttons): how the content is laid out now. */
  layout?: { direction: 'row' | 'column'; distribute: 'packed' | 'space-between'; gap: number; position: 'start' | 'center' | 'end'; align: 'start' | 'center' | 'end' };
  /** For a photo that can be reframed: how it is framed now (by hand or automatically). */
  crop?: Crop | null;
};

// Not instanceof: the nodes live in the iframe's realm.
const isSvg = (el: Element) => el.namespaceURI === 'http://www.w3.org/2000/svg';

// What a click lands on: the outermost component around the element that is not a group (the button,
// not its label; a tag, not its text). On a group's own ground (the space between its items) it is
// that group, the innermost one, so Header and Content can be picked on the piece too.
export function componentAt(el: Element | null, comps: Comp[]): Comp | null {
  if (!el) return null;
  const byId = new Map(comps.map((c) => [c.id, c]));
  let found: Comp | null = null;
  let group: Comp | null = null;
  for (let n: Element | null = el; n; n = n.parentElement) {
    const c = byId.get(n.getAttribute('data-node') ?? '');
    if (c && c.kind !== 'background' && c.kind !== 'group') found = c;
    if (c?.kind === 'group' && !group) group = c;
  }
  return found ?? group ?? comps.find((c) => c.kind === 'background') ?? null;
}

// The group a component sits in (for the faint outline of its context).
export const parentOf = (comps: Comp[], id: string | null) => {
  const pid = comps.find((c) => c.id === id)?.parent;
  return pid ? comps.find((c) => c.id === pid) ?? null : null;
};

// The innermost component (double-click: the label inside a button, a text inside a tag).
export function innermostAt(el: Element | null, comps: Comp[]): Comp | null {
  const byId = new Map(comps.map((c) => [c.id, c]));
  for (let n: Element | null = el; n; n = n.parentElement) {
    const id = n.getAttribute('data-node') ?? '';
    const c = byId.get(id);
    if (c) return c;
    const button = comps.find((p) => p.textId === id);
    if (button) return button;
  }
  return null;
}

// The component and everything inside it (a group, a tag).
export const within = (comps: Comp[], id: string): string[] => [id, ...comps.filter((c) => c.parent === id).flatMap((c) => within(comps, c.id))];

// Brand colours: the template's --color-* tokens, one swatch per distinct colour (aliases such as
// light-* / dark-* that repeat a colour are dropped).
export function readTokens(doc: Document): Token[] {
  const names: string[] = [];
  for (const sheet of doc.styleSheets) {
    let rules: CSSRuleList;
    try { rules = sheet.cssRules; } catch { continue; }
    for (const r of rules) if ((r as CSSStyleRule).selectorText === ':root') for (const p of (r as CSSStyleRule).style) if (p.startsWith('--color-')) names.push(p);
  }
  const cs = getComputedStyle(doc.documentElement);
  const alias = (n: string) => /^--color-(light|dark)-/.test(n);
  const seen = new Set<string>();
  const out: Token[] = [];
  for (const n of [...names.filter((n) => !alias(n)), ...names.filter(alias)]) {
    const hex = toHex(cs.getPropertyValue(n).trim());
    if (!hex || seen.has(hex)) continue;
    seen.add(hex);
    const name = n.slice(8).replace(/-/g, ' ');
    out.push({ name: name.charAt(0).toUpperCase() + name.slice(1), value: `var(${n})`, hex, group: /neutral|black|white|grey|gray/.test(name) ? 'Neutrals' : /blue|tint|sky|navy|royal|primary/.test(name) ? 'Blues' : 'Accents' });
  }
  return out;
}

export function toHex(c: string): string | null {
  if (/^#[0-9a-f]{6}$/i.test(c)) return c.toUpperCase();
  if (/^#[0-9a-f]{3}$/i.test(c)) return ('#' + [...c.slice(1)].map((x) => x + x).join('')).toUpperCase();
  const m = c.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?/);
  if (!m || (m[4] !== undefined && Number(m[4]) === 0)) return null;
  return ('#' + [m[1], m[2], m[3]].map((x) => Number(x).toString(16).padStart(2, '0')).join('')).toUpperCase();
}

const place = (v: string): 'start' | 'center' | 'end' => (/center/.test(v) ? 'center' : /end/.test(v) ? 'end' : 'start');

export function readInfo(el: HTMLElement | SVGElement, scale = 1): LayerInfo {
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  const stroke = isSvg(el) ? [...el.querySelectorAll('[stroke]')].map((n) => n.getAttribute('stroke')).find((c) => c && c !== 'none' && c !== 'currentColor') : null;
  return {
    width: Math.round(r.width / scale), height: Math.round(r.height / scale),
    fontSize: Math.round(parseFloat(cs.fontSize)), fontWeight: Number(cs.fontWeight) || 400,
    color: toHex(stroke ?? cs.color) ?? '', backgroundColor: toHex(cs.backgroundColor) ?? '',
    text: el.textContent ?? '', opacity: Number(cs.opacity),
    layout: cs.display.includes('flex') ? {
      direction: cs.flexDirection.startsWith('column') ? 'column' : 'row',
      distribute: /space-(between|around|evenly)/.test(cs.justifyContent) ? 'space-between' : 'packed',
      gap: Math.round(parseFloat(cs.flexDirection.startsWith('column') ? cs.rowGap : cs.columnGap) || 0),
      position: place(cs.justifyContent),
      align: place(cs.alignItems),
    } : undefined,
    crop: cropIn(el),
  };
}

type CropWin = Window & { __canCrop?: (el: Element) => boolean; __cropOf?: (el: Element) => Crop | null };
// The framing of a photo layer, read in its page (edits.js); null when it cannot be reframed.
export function cropIn(el: Element): Crop | null {
  const w = el.ownerDocument?.defaultView as CropWin | null;
  return w?.__canCrop?.(el) ? w.__cropOf?.(el) ?? null : null;
}

export const merge = (a: NodeEdit | undefined, b: NodeEdit): NodeEdit => ({
  ...a, ...b,
  box: b.box ? { ...a?.box, ...b.box } : a?.box,
  style: b.style ? { ...a?.style, ...b.style } : a?.style,
  layout: b.layout ? { ...a?.layout, ...b.layout } : a?.layout,
});
