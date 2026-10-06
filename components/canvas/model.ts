// What the editor reads from the template page: its components, its colours and its tokens.
//
// A template is a tree of Paper layers (frames inside frames, "Group", "Vector"…). People edit
// components instead: a text, a button, an icon, a photo, the background. Layout frames stay out of
// sight. The Archy logo is a component too, locked: it is never edited, moved or hidden.

import type { NodeEdit } from '@/lib/canvas-shared';

export type Kind = 'background' | 'text' | 'button' | 'icon' | 'photo' | 'partner' | 'archy' | 'tag' | 'line' | 'decoration';
export type Comp = {
  id: string; kind: Kind; name: string; slot?: string;
  /** Inner parts edited from this component: the label text and the icon of a button. */
  textId?: string; textSlot?: string; iconId?: string;
};
export type Token = { name: string; value: string; hex: string; group: 'Blues' | 'Neutrals' | 'Accents' };

export const SECTIONS: { title: string; kinds: Kind[] }[] = [
  { title: 'Text', kinds: ['text'] },
  { title: 'Buttons & icons', kinds: ['button', 'icon'] },
  { title: 'Images & logos', kinds: ['photo', 'partner', 'archy'] },
  { title: 'Shapes', kinds: ['tag', 'line', 'decoration'] },
  { title: 'Background', kinds: ['background'] },
];

// Facts about a node as it is drawn now, for the properties panel.
export type LayerInfo = {
  width: number; height: number; fontSize: number; fontWeight: number;
  color: string; backgroundColor: string; text: string; opacity: number;
};

const ARCHY = /^(Logo Archy|Archy Wordmark)/;
const BUTTON = /^(CTA|Button)$/i;
const DECORATION = /^(Mascot|Stars|Swoosh|Drinks Pattern|Pixel Dissolve|Rulers|BK Fade|Scrim|RIBBON|Border|Photo Panel|Cocktail|Illustration)/i;
const LINE = /^(Ruler|Divider|Dot)\b/;
const GENERIC = /^(Label|Text|Title|Copy|Group|Vector|SVG|Frame|Info|Body)$/i;

const nameOf = (el: Element) => el.getAttribute('data-name') ?? '';
// Not instanceof: the nodes live in the iframe's realm.
const isSvg = (el: Element) => el.namespaceURI === 'http://www.w3.org/2000/svg';
// "slot-text-ae-first-name" → "AE first name", "Photo Panel · Gradient Royal Blue" → "Photo panel", "RIBBON" → "Ribbon".
const human = (s: string) => {
  let t = s.replace(/^(slot-(text|image|logo)-|optional-)/, '').replace(/\s*·.*$/, '').replace(/-/g, ' ').trim();
  if (t === t.toUpperCase()) t = t.toLowerCase();
  t = t.replace(/\b(ae|cta|og)\b/gi, (w) => w.toUpperCase());
  return t.charAt(0).toUpperCase() + t.slice(1).replace(/\b([A-Z])([a-z]+)\b/g, (w, a, b, i) => (i === 0 || /^(AE|CTA|OG)$/.test(w) ? w : a.toLowerCase() + b));
};
const titleCase = (s: string) => {
  const t = s.replace(/\s+/g, ' ').trim();
  const short = t.length > 28 ? `${t.slice(0, 27)}…` : t;
  return short === short.toUpperCase() ? short.charAt(0) + short.slice(1).toLowerCase() : short;
};
const optionalOf = (el: Element) => el.closest('[data-optional]')?.getAttribute('data-optional') ?? null;
const hasFill = (el: Element) => { const bg = getComputedStyle(el).backgroundColor; return !!bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent'; };
const isIcon = (el: Element) => el.tagName.toLowerCase() === 'svg' && (/^Icon/.test(nameOf(el)) || /^Icon$/.test(nameOf(el.parentElement!)) || el.getAttribute('viewBox') === '0 0 24 24');
const firstText = (el: Element) => [...el.querySelectorAll('[data-node]')].find((n) => n.tagName.toLowerCase() !== 'svg' && !n.querySelector('[data-node]') && n.textContent?.trim()) ?? null;

export function readComponents(doc: Document): Comp[] {
  const root = doc.querySelector('body > [data-node]');
  if (!root) return [];
  const out: Comp[] = [];
  const id = (el: Element) => el.getAttribute('data-node')!;
  const walk = (el: Element) => {
    const name = nameOf(el);
    const type = (el as HTMLElement).dataset?.slotType;
    const slot = (el as HTMLElement).dataset?.slot;
    const svg = el.tagName.toLowerCase() === 'svg';
    if (ARCHY.test(name)) { out.push({ id: id(el), kind: 'archy', name: 'Archy logo' }); return; }
    if (type === 'logo') { out.push({ id: id(el), kind: 'partner', name: `${human((slot ?? 'partner').replace(/^logo-/, ''))} logo`, slot }); return; }
    if (type === 'image') {
      const what = human((slot ?? 'photo').replace(/^image-/, ''));
      out.push({ id: id(el), kind: 'photo', name: /^photo$/i.test(what) ? 'Photo' : `${what} photo`, slot });
      return;
    }
    if (type === 'text') { out.push({ id: id(el), kind: 'text', name: human(slot!), slot }); return; }
    if (BUTTON.test(name)) {
      const t = firstText(el);
      const icon = [...el.querySelectorAll('svg[data-node]')][0];
      out.push({ id: id(el), kind: 'button', name: 'Button', textId: t ? id(t) : undefined, textSlot: (t as HTMLElement | null)?.dataset.slot, iconId: icon ? id(icon) : undefined });
      return;
    }
    if (svg && isIcon(el)) {
      const own = name.replace(/^Icon\s*·?\s*/, '').trim();
      const label = own && !GENERIC.test(own) ? own : optionalOf(el) ?? nameOf(el.closest('[data-name^="Benefit"]') ?? el).replace(/^Benefit\s*·\s*/, '');
      out.push({ id: id(el), kind: 'icon', name: `${human(label && !GENERIC.test(label) ? label : 'Icon')} icon`.replace(/^Icon icon$/, 'Icon') });
      return;
    }
    if (LINE.test(name)) { out.push({ id: id(el), kind: 'line', name: name.startsWith('Dot') ? 'Dot' : 'Line' }); return; }
    if (DECORATION.test(name) || (el as HTMLElement).dataset?.optional === 'illustration') { out.push({ id: id(el), kind: 'decoration', name: human(name.replace(/^optional-/, '')) }); return; }
    if (svg) { out.push({ id: id(el), kind: 'decoration', name: GENERIC.test(name) ? 'Graphic' : human(name) }); return; }
    const kids = [...el.children].filter((c) => c.hasAttribute('data-node'));
    if (!kids.length && el.textContent?.trim()) {
      out.push({ id: id(el), kind: 'text', name: GENERIC.test(name) || !name ? titleCase(el.textContent) : human(name) });
      return;
    }
    if (!kids.length && /url\(/.test(getComputedStyle(el).backgroundImage)) { out.push({ id: id(el), kind: 'decoration', name: GENERIC.test(name) ? 'Image' : human(name) }); return; }
    // A pill, plate or badge: an optional block with its own fill. Its texts stay separate components.
    const opt = (el as HTMLElement).dataset?.optional;
    if (opt && hasFill(el)) out.push({ id: id(el), kind: 'tag', name: `${human(opt)} tag` });
    for (const k of kids) walk(k);
  };
  out.push({ id: id(root), kind: 'background', name: 'Background' });
  for (const k of root.children) if (k.hasAttribute('data-node')) walk(k);
  // Repeated names get a number ("Line 2"), so the list reads well.
  const count: Record<string, number> = {};
  for (const c of out) count[c.name] = (count[c.name] ?? 0) + 1;
  const seen: Record<string, number> = {};
  for (const c of out) if (count[c.name] > 1) { seen[c.name] = (seen[c.name] ?? 0) + 1; c.name = `${c.name} ${seen[c.name]}`; }
  return out;
}

// The component a click lands on: the outermost one containing the element (the button, not its label).
export function componentAt(el: Element | null, comps: Comp[]): Comp | null {
  if (!el) return null;
  const byId = new Map(comps.map((c) => [c.id, c]));
  let found: Comp | null = null;
  for (let n: Element | null = el; n; n = n.parentElement) {
    const c = byId.get(n.getAttribute('data-node') ?? '');
    if (c && c.kind !== 'background') found = c;
  }
  return found ?? comps.find((c) => c.kind === 'background') ?? null;
}

// The innermost component (double-click: the label inside a button, a text inside a tag).
export function innermostAt(el: Element | null, comps: Comp[]): Comp | null {
  const byId = new Map(comps.map((c) => [c.id, c]));
  for (let n: Element | null = el; n; n = n.parentElement) {
    const c = byId.get(n.getAttribute('data-node') ?? '');
    if (c) return c;
    // A button's label is not a component on its own; double-clicking it edits the button's text.
    const parent = comps.find((p) => p.textId && p.textId === n?.getAttribute('data-node'));
    if (parent) return parent;
  }
  return null;
}

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

// The brand colours the piece is drawn with (fills, text, lines, icons), most used first. The Archy
// logo does not count: it never changes colour.
export function readUsedColors(doc: Document, tokens: Token[]): string[] {
  const root = doc.querySelector('body > [data-node]');
  if (!root) return [];
  const known = new Set(tokens.map((t) => t.hex));
  const n: Record<string, number> = {};
  const add = (c: string | null, w = 1) => { const h = c && toHex(c); if (h && known.has(h)) n[h] = (n[h] ?? 0) + w; };
  const rootStyle = getComputedStyle(root);
  add(rootStyle.backgroundColor, 50);
  for (const m of rootStyle.backgroundImage.matchAll(/(rgba?\([^)]*\)|#[0-9a-f]{3,6})/gi)) add(m[1], 50);
  for (const el of root.querySelectorAll('*')) {
    if (el.closest('[data-name^="Logo Archy"], [data-name^="Archy Wordmark"]')) continue;
    if (isSvg(el)) { add(el.getAttribute('fill')); add(el.getAttribute('stroke')); continue; }
    const cs = getComputedStyle(el);
    if (el.childNodes.length && [...el.childNodes].some((c) => c.nodeType === 3 && c.textContent?.trim())) add(cs.color, 3);
    add(cs.backgroundColor, 5);
  }
  return Object.entries(n).sort((a, b) => b[1] - a[1]).map(([h]) => h);
}

export function toHex(c: string): string | null {
  if (/^#[0-9a-f]{6}$/i.test(c)) return c.toUpperCase();
  if (/^#[0-9a-f]{3}$/i.test(c)) return ('#' + [...c.slice(1)].map((x) => x + x).join('')).toUpperCase();
  const m = c.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?/);
  if (!m || (m[4] !== undefined && Number(m[4]) === 0)) return null;
  return ('#' + [m[1], m[2], m[3]].map((x) => Number(x).toString(16).padStart(2, '0')).join('')).toUpperCase();
}

export function readInfo(el: HTMLElement | SVGElement, scale = 1): LayerInfo {
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  const stroke = isSvg(el) ? [...el.querySelectorAll('[stroke]')].map((n) => n.getAttribute('stroke')).find((c) => c && c !== 'none' && c !== 'currentColor') : null;
  return {
    width: Math.round(r.width / scale), height: Math.round(r.height / scale),
    fontSize: Math.round(parseFloat(cs.fontSize)), fontWeight: Number(cs.fontWeight) || 400,
    color: toHex(stroke ?? cs.color) ?? '', backgroundColor: toHex(cs.backgroundColor) ?? '',
    text: el.textContent ?? '', opacity: Number(cs.opacity),
  };
}

export const merge = (a: NodeEdit | undefined, b: NodeEdit): NodeEdit => ({
  ...a, ...b,
  box: b.box ? { ...a?.box, ...b.box } : a?.box,
  style: b.style ? { ...a?.style, ...b.style } : a?.style,
  theme: b.theme ? { ...a?.theme, ...b.theme } : a?.theme,
});
