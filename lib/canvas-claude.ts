import 'server-only';
import { cleanEdits, THEME, type Edits, type Layout, type NodeEdit, type Preset } from './canvas-shared';
import { loadSource, type PieceSource } from './canvas';
import { saveEdited } from './canvas-render';
import { iconMarkup, searchIcons } from './icons';
import { render, type InspectedComp } from './renderer';
import { storeExport } from './renders';
import { supabaseAdmin } from './supabase/admin';
import { clearDraft, getDraft, saveDraft, type Draft } from './drafts';

export { clearDraft, getDraft, saveDraft };
import { loadConfig } from './templates';

// Canvas with Claude: the person talks to their own Claude; through the MCP tools Claude reads and edits
// the draft of the piece open in Canvas, and Canvas receives each change live (Realtime on
// canvas_drafts). Same rules as by hand: brand colours only, copy that fits, the Archy logo's drawing
// and colour untouched.

type Who = { id: string; is_admin: boolean };
// The piece Claude means: the id it was given, or the one this person has open in Canvas most recently.
async function findPiece(me: Who, ref?: string): Promise<{ piece: PieceSource; draft: Draft | null }> {
  let id = ref?.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0];
  if (!id) {
    const { data } = await supabaseAdmin().from('canvas_drafts').select('piece_id').eq('user_id', me.id).order('updated_at', { ascending: false }).limit(1);
    id = data?.[0]?.piece_id;
  }
  if (!id) throw new Error('No piece open in Canvas. Ask the person to open the piece in Archy Studio → Canvas (or give its canvas id).');
  const piece = await loadSource(id);
  if (!piece) throw new Error(`No piece ${id}.`);
  return { piece, draft: await getDraft(id) };
}

async function describe(piece: PieceSource, slots: Record<string, string | null>, edits: Edits) {
  const out = await render({ template: piece.template, format: piece.format, slots, edits, inspect: true });
  return { png: out.png, report: out.report, comps: out.inspected!.comps, tokens: out.inspected!.tokens, review: out.inspected!.review };
}

const KIND: Record<string, string> = { text: 'text', button: 'button', icon: 'icon', photo: 'photo', partner: 'partner logo', archy: 'Archy logo (locked: move/scale only)', group: 'group', tag: 'tag', line: 'line', decoration: 'decoration', background: 'background' };

export async function getCanvas(me: Who, ref?: string) {
  const { piece, draft } = await findPiece(me, ref);
  const slots = draft?.slots ?? piece.slots, edits = draft?.edits ?? piece.edits;
  const d = await describe(piece, slots, edits);
  const byId = new Map(d.comps.map((c) => [c.id, c]));
  const depth = (c: InspectedComp): number => (c.parent ? 1 + depth(byId.get(c.parent)!) : 0);
  const lines = d.comps.map((c) => `${'  '.repeat(depth(c))}- ${c.name} [${KIND[c.kind] ?? c.kind}]${c.text ? `: "${c.text.replace(/\s+/g, ' ').trim()}"` : ''}${c.layout ? ` (${c.layout})` : ''}${c.slot || c.textSlot ? ' (from the brief)' : ''}${c.hidden ? ' (hidden)' : ''}`);
  const config = await loadConfig(piece.template);
  return {
    piece, png: d.png,
    text: [
      `Canvas piece ${piece.id}: ${config.title}, ${piece.format} ${piece.width}×${piece.height}. Theme: ${edits[THEME]?.preset ?? 'as designed'}.`,
      'Components (edit them by name):',
      ...lines,
      `Brand colours: ${Object.entries(d.tokens).map(([k, v]) => `${k} ${v}`).join(', ')}.`,
      ...(d.review.length ? ['Inspector suggestions:', ...d.review.map((t) => `- ${t.title}: ${t.detail}`)] : []),
      'Themes: dark, blue, sky, ice, light. Icons: any Hugeicons name or a word to search ("calendar").',
    ].join('\n'),
  };
}

export type CanvasChange = {
  component: string;
  text?: string;
  color?: string;
  fill?: string;
  icon?: string;
  hidden?: boolean;
  font_size?: number;
  move?: { x?: number; y?: number };
  align?: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';
  scale?: number;
  image?: string;
  /** For a group, tag or button: how its content is spread. */
  layout?: Layout;
  size?: { width?: number; height?: number };
};

export async function editCanvas(me: Who, input: { piece?: string; changes: CanvasChange[]; theme?: Preset; note?: string }) {
  const { piece, draft } = await findPiece(me, input.piece);
  const slots = { ...(draft?.slots ?? piece.slots) };
  const edits: Edits = structuredClone(draft?.edits ?? piece.edits);
  const before = await describe(piece, slots, edits);
  const tokens = before.tokens;
  const edit = (id: string, e: NodeEdit) => {
    const a = edits[id] ?? {};
    edits[id] = { ...a, ...e, box: e.box ? { ...a.box, ...e.box } : a.box, style: e.style ? { ...a.style, ...e.style } : a.style };
  };
  // "royal-blue-500", "Royal blue 500", "#013DF5" → var(--color-royal-blue-500); nothing outside the palette.
  const colour = (c: string) => {
    const k = c.trim().toLowerCase().replace(/\s+/g, '-').replace(/^--color-|^var\(--color-|\)$/g, '');
    const hit = Object.entries(tokens).find(([name, hex]) => name === k || hex === c.trim().toUpperCase());
    if (!hit) throw new Error(`"${c}" is not an Archy brand colour. Use one of: ${Object.keys(tokens).join(', ')}.`);
    return `var(--color-${hit[0]})`;
  };
  const find = (name: string) => {
    const n = name.trim().toLowerCase();
    const c = before.comps.find((x) => x.id === name) ?? before.comps.find((x) => x.name.toLowerCase() === n) ?? before.comps.find((x) => x.name.toLowerCase().includes(n));
    if (!c) throw new Error(`No component "${name}". Components: ${before.comps.map((x) => x.name).join(', ')}.`);
    return c;
  };
  const done: string[] = [];
  if (input.theme) { edit(THEME, { preset: input.theme }); done.push(`${input.theme} theme`); }
  for (const ch of input.changes ?? []) {
    const c = find(ch.component);
    if (c.kind === 'archy' && (ch.text != null || ch.color || ch.fill || ch.icon || ch.hidden != null)) throw new Error('The Archy logo is locked: it can only be moved, aligned or scaled.');
    if (ch.text != null) {
      const slot = c.kind === 'button' ? c.textSlot : c.slot;
      if (slot) slots[slot] = ch.text;
      else edit(c.kind === 'button' ? c.textId! : c.id, { text: ch.text });
    }
    if (ch.color) edit(c.kind === 'button' && c.textId ? c.textId : c.id, { style: { color: colour(ch.color) } });
    if (ch.fill) edit(c.id, { style: { backgroundColor: colour(ch.fill) } });
    if (ch.icon) {
      const target = c.kind === 'button' ? c.iconId : c.kind === 'icon' ? c.id : undefined;
      if (!target) throw new Error(`${c.name} has no icon.`);
      const name = (await iconMarkup(ch.icon)) ? ch.icon : (await searchIcons(ch.icon, 1))[0]?.name;
      if (!name) throw new Error(`No Hugeicons icon for "${ch.icon}".`);
      edit(target, { icon: name });
    }
    if (ch.hidden != null) edit(c.id, { hidden: ch.hidden });
    if (ch.layout) {
      if (!['group', 'tag', 'button'].includes(c.kind)) throw new Error(`${c.name} is not a group; layout applies to groups (e.g. Header, Details, Content).`);
      const a = edits[c.id]?.layout ?? {};
      edits[c.id] = { ...edits[c.id], layout: { ...a, ...ch.layout } };
    }
    if (ch.size) edit(c.id, { box: { ...(ch.size.width ? { width: ch.size.width } : {}), ...(ch.size.height ? { height: ch.size.height } : {}) } });
    if (ch.font_size) edit(c.id, { style: { fontSize: ch.font_size } });
    if (ch.scale) edit(c.id, { box: { scale: Math.max(0.3, Math.min(3, ch.scale)) } });
    if (ch.image) {
      if (!/^(asset:|upload:|https:\/\/)/.test(ch.image)) throw new Error('Images are asset:<id> (list_assets), an upload: value or an https URL.');
      if (c.slot) slots[c.slot] = ch.image; else edit(c.id, { image: ch.image });
    }
    const b = edits[c.id]?.box ?? {};
    if (ch.move) edit(c.id, { box: { dx: (b.dx ?? 0) + (ch.move.x ?? 0), dy: (b.dy ?? 0) + (ch.move.y ?? 0) } });
    if (ch.align && c.alignBox) {
      const r = c.box, a = c.alignBox, dx = edits[c.id]?.box?.dx ?? 0, dy = edits[c.id]?.box?.dy ?? 0;
      const m = { left: { dx: dx + a.x - r.x }, center: { dx: dx + a.x + (a.w - r.w) / 2 - r.x }, right: { dx: dx + a.x + a.w - r.w - r.x }, top: { dy: dy + a.y - r.y }, middle: { dy: dy + a.y + (a.h - r.h) / 2 - r.y }, bottom: { dy: dy + a.y + a.h - r.h - r.y } }[ch.align];
      edit(c.id, { box: Object.fromEntries(Object.entries(m).map(([k, v]) => [k, Math.round(v)])) });
    }
    done.push(c.name);
  }
  const after = await render({ template: piece.template, format: piece.format, slots, edits: cleanEdits(edits), inspect: true });
  const tips = after.inspected?.review ?? [];
  const note = input.note?.trim() || `Changed ${[...new Set(done)].join(', ')}`;
  await saveDraft({ pieceId: piece.id, userId: me.id, slots, edits, by: 'claude', note });
  return { piece, png: after.png, note, suggestions: tips.map((t) => `${t.title}: ${t.detail}`) };
}

export async function saveCanvas(me: Who, ref?: string) {
  const { piece, draft } = await findPiece(me, ref);
  const saved = await saveEdited(me, piece, draft?.slots ?? piece.slots, draft?.edits ?? piece.edits, 'version');
  await clearDraft(piece.id);
  return saved;
}

export async function downloadCanvas(me: Who, ref?: string) {
  const { piece, draft } = await findPiece(me, ref);
  const out = await render({ template: piece.template, format: piece.format, slots: draft?.slots ?? piece.slots, edits: draft?.edits ?? piece.edits, scale: 2 });
  return storeExport(out.png, `${piece.template}-${piece.format}.png`);
}
