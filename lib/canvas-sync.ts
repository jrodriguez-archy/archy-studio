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
export function follow(prev: Snap, next: Snap, target: Snap, src?: Keys, dst?: Keys): Snap {
  const slots = { ...target.slots };
  for (const [k, v] of Object.entries(next.slots)) if (k in slots && (prev.slots[k] ?? null) !== (v ?? null)) slots[k] = v ?? null;
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
export function match(source: Snap, target: Snap, src: Keys, dst: Keys): Snap {
  const slots = { ...target.slots };
  for (const k of Object.keys(slots)) if (k in source.slots) slots[k] = source.slots[k] ?? null;
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
