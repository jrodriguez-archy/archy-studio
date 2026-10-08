import { RECOLOR, cleanEdits, type Edits, type NodeEdit } from './canvas-shared';

// The formats of a design kept in step (Canvas artboards). Each format is its own page with its own
// layer ids; layers are matched by key (components.js __keys: the slot, or the path of layer names).
// What follows from one format to the others: the copy and images (slots), the theme, and per layer the
// copy, image, icon, visibility, colours, weight, opacity and text size (in proportion). Position, size
// and layout stay each format's own: every format has its own composition.

export type Snap = { slots: Record<string, string | null>; edits: Edits };
/** data-node id → its key across formats, and its text size as filled. */
export type Keys = Record<string, { key: string; fontSize?: number }>;

// The part of a layer edit that follows to the other formats.
// A size follows in proportion, kept inside the target format's own range (85%–125% of its design
// size), so one format never drags another out of its design.
function shared(e: NodeEdit | undefined, scale = 1, base?: number): NodeEdit {
  if (!e) return {};
  const out: NodeEdit = {};
  if (e.text != null) out.text = e.text;
  if (e.image) out.image = e.image;
  if (e.icon) out.icon = e.icon;
  if (e.hidden) out.hidden = true;
  const s = e.style ?? {};
  const style: NonNullable<NodeEdit['style']> = {};
  if (s.color) style.color = s.color;
  if (s.backgroundColor) style.backgroundColor = s.backgroundColor;
  if (s.fontWeight) style.fontWeight = s.fontWeight;
  if (s.opacity != null) style.opacity = s.opacity;
  if (s.fontSize) {
    const fs = s.fontSize * scale;
    style.fontSize = Math.round(base ? Math.min(base * 1.25, Math.max(base * 0.85, fs)) : fs);
  }
  if (Object.keys(style).length) out.style = style;
  return out;
}

// A layer's edit in the target: its own position, size and layout, with the shared part from the source.
function withShared(own: NodeEdit | undefined, from: NodeEdit): NodeEdit {
  const out: NodeEdit = {};
  if (own?.box) out.box = own.box;
  if (own?.layout) out.layout = own.layout;
  if (own?.preset) out.preset = own.preset;
  return { ...out, ...from };
}

const byKey = (keys: Keys) => Object.fromEntries(Object.entries(keys).map(([id, k]) => [k.key, id]));
const sameJson = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** The target with what changed in the source (from `prev` to `next`). Without keys only the slots and the theme follow. */
export function follow(prev: Snap, next: Snap, target: Snap, src?: Keys, dst?: Keys, drawn?: Set<string>): Snap {
  const slots = { ...target.slots };
  for (const k of Object.keys(slots)) {
    const was = carried(prev.slots, k, slots[k], drawn), now = carried(next.slots, k, slots[k], drawn);
    if (now !== undefined && (was ?? null) !== (now ?? null)) slots[k] = now ?? null;
  }
  const edits = { ...target.edits };
  if (!sameJson(prev.edits[RECOLOR], next.edits[RECOLOR])) {
    if (next.edits[RECOLOR]) edits[RECOLOR] = next.edits[RECOLOR]; else delete edits[RECOLOR];
  }
  if (src && dst) {
    const there = byKey(dst);
    for (const id of new Set([...Object.keys(prev.edits), ...Object.keys(next.edits)])) {
      if (id === RECOLOR || sameJson(shared(prev.edits[id]), shared(next.edits[id]))) continue;
      const key: string | undefined = src[id]?.key;
      const to: string | undefined = key ? there[key] : undefined;
      if (!to) continue;
      const a = src[id]?.fontSize, b = dst[to]?.fontSize;
      edits[to] = withShared(edits[to], shared(next.edits[id], a && b ? b / a : 1, b));
    }
  }
  return { slots, edits: cleanEdits(edits) };
}

/** The target made to match the source in everything shared (a format just added, or synced again). */
export function match(source: Snap, target: Snap, src: Keys, dst: Keys, drawn?: Set<string>): Snap {
  const slots = { ...target.slots };
  for (const k of Object.keys(slots)) { const v = carried(source.slots, k, slots[k], drawn); if (v !== undefined) slots[k] = v ?? null; }
  const edits: Edits = {};
  for (const [id, e] of Object.entries(target.edits)) if (id !== RECOLOR) edits[id] = withShared(e, {});
  if (source.edits[RECOLOR]) edits[RECOLOR] = source.edits[RECOLOR];
  const there = byKey(dst);
  for (const [id, e] of Object.entries(source.edits)) {
    if (id === RECOLOR) continue;
    const key: string | undefined = src[id]?.key;
      const to: string | undefined = key ? there[key] : undefined;
    if (!to) continue;
    const a = src[id]?.fontSize, b = dst[to]?.fontSize;
    edits[to] = withShared(edits[to], shared(e, a && b ? b / a : 1, b));
  }
  return { slots, edits: cleanEdits(edits) };
}

// An event and its page cover are one set: the cover splits the event's headline over two lines
// (headline-1, headline-2) and may print "Booth" with the number. What one says, the other says in
// its own shape. Returns the value for `key` from `from` (undefined: nothing to carry).
// `drawn`: the slots the source format draws. A slot it does not draw (the cover's ground photo seen
// from the post, the post's headline seen from the cover) is not its to give: it is never carried, so a
// format's own content is not emptied by another one.
export function carried(from: Record<string, string | null>, key: string, own?: string | null, drawn?: Set<string>): string | null | undefined {
  if (key in from && (!drawn || drawn.has(key))) return key === 'booth' ? boothLike(from[key], own) : from[key];
  if (drawn && !drawn.has(key) && key in from && !['headline', 'headline-1', 'headline-2'].includes(key)) return undefined;
  if (key === 'headline' && ('headline-1' in from || 'headline-2' in from) && (!drawn || drawn.has('headline-1'))) return [from['headline-1'], from['headline-2']].filter(Boolean).join('\n') || null;
  if ((key === 'headline-1' || key === 'headline-2') && 'headline' in from && (!drawn || drawn.has('headline'))) return splitHeadline(from.headline)[key === 'headline-1' ? 0 : 1];
  return undefined;
}

// "#1039" where the design prints "Booth #1039", and the other way round.
export function boothLike(v: string | null, own?: string | null) {
  if (!v || own == null) return v;
  const bare = v.replace(/^booth\s*/i, '');
  if (/^booth\b/i.test(own.trim())) return `Booth ${bare}`;
  return /^#/.test(own.trim()) ? bare : v;
}

// Two lines from one headline: its own break, else after a phrase ("Lead with Purpose,", "30 Dallas
// dentists."), else after a lead-in ("Meet Archy at"), else at the space nearest the middle.
export function splitHeadline(v: string | null): [string | null, string | null] {
  if (!v) return [null, null];
  const lines = v.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length > 1) return [lines[0], lines.slice(1).join(' ')];
  const one = v.trim();
  const inMiddle = (i: number) => i > one.length * 0.2 && i < one.length * 0.8;
  const phrase = [...one.matchAll(/[,.:;!?](?=\s)/g)].find((m) => inMiddle(m.index!));
  if (phrase) return [one.slice(0, phrase.index! + 1), one.slice(phrase.index! + 2).trim()];
  const lead = [...one.matchAll(/\b(?:at|to|for|with|in)(?=\s)/gi)].find((m) => inMiddle(m.index!));
  if (lead) return [one.slice(0, lead.index! + lead[0].length), one.slice(lead.index! + lead[0].length + 1).trim()];
  const spaces = [...one.matchAll(/\s/g)].map((m) => m.index!);
  if (!spaces.length) return [one, null];
  const at = spaces.reduce((a, b) => (Math.abs(b - one.length / 2) < Math.abs(a - one.length / 2) ? b : a));
  return [one.slice(0, at), one.slice(at + 1)];
}
