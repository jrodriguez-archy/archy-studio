import 'server-only';
import { cleanEdits, THEME, type Edits, type Layout, type NodeEdit, type Preset } from './canvas-shared';
import { loadSet, loadSource, type PieceSource } from './canvas';
import { saveEdited } from './canvas-render';
import { iconMarkup, searchIcons } from './icons';
import { render, type InspectedComp } from './renderer';
import { storeExport } from './renders';
import { supabaseAdmin } from './supabase/admin';
import { clearDraft, getDraft, markClaude, saveDraft, type Draft } from './drafts';
import { loadConfig } from './templates';

export { clearDraft, getDraft, saveDraft };

// Canvas with Claude: the person talks to their own Claude; through the MCP tools Claude reads and edits
// the draft of the design open in Canvas, and Canvas receives each change live (Realtime on
// canvas_drafts), with Claude shown on the artboard while it works. Claude is the designer: it makes
// the changes and fixes what the Inspector flags itself. Brand colours only; the Archy logo's drawing
// and colour untouched.

type Who = { id: string; is_admin: boolean };
// The piece Claude means: the id it was given, or the one this person has open in Canvas most recently.
async function findPiece(me: Who, ref?: string): Promise<{ piece: PieceSource; draft: Draft | null }> {
  let id = ref?.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0];
  if (!id) {
    const { data } = await supabaseAdmin().from('canvas_drafts').select('piece_id').eq('user_id', me.id).order('updated_at', { ascending: false }).limit(1);
    id = data?.[0]?.piece_id;
  }
  if (!id) throw new Error('No design open in Canvas. Ask the person to open the design in Archy Studio → Canvas (or give its canvas id).');
  const piece = await loadSource(id);
  if (!piece) throw new Error(`No design ${id}.`);
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
  await markClaude({ pieceId: piece.id, userId: me.id, slots, edits, status: 'Looking at the design' }).catch(() => {});
  const d = await describe(piece, slots, edits);
  const byId = new Map(d.comps.map((c) => [c.id, c]));
  const depth = (c: InspectedComp): number => (c.parent ? 1 + depth(byId.get(c.parent)!) : 0);
  const lines = d.comps.map((c) => `${'  '.repeat(depth(c))}- ${c.name} [${KIND[c.kind] ?? c.kind} · id ${c.id}]${c.text ? `: "${c.text.replace(/\s+/g, ' ').trim()}"` : ''}${c.layout ? ` (${c.layout})` : ''}${c.slot || c.textSlot ? ' (from the brief)' : ''}${c.hidden ? ' (hidden)' : ''}`);
  const [config, set] = await Promise.all([loadConfig(piece.template), loadSet(piece)]);
  const others = set.pieces.filter((p) => p.id !== piece.id);
  return {
    piece, png: d.png,
    text: [
      `Canvas design ${piece.id}: ${config.title}, ${piece.format} ${piece.width}×${piece.height}. Theme: ${edits[THEME]?.preset ?? 'as designed'}.`,
      ...(others.length ? [`Other formats of this design (same set; each its own canvas id): ${others.map((p) => `${p.format} ${p.id}`).join(', ')}. In Canvas, copy, images, theme and styles follow between synced formats while it is open; otherwise edit each one.`] : []),
      'Components (refer to them by id, e.g. component: "G5O-1"; a name works when it is unique):',
      ...lines,
      `Brand colours: ${Object.entries(d.tokens).map(([k, v]) => `${k} ${v}`).join(', ')}.`,
      ...(d.review.length ? ['Inspector suggestions (fix them yourself: edit_canvas with fix: "all", or your own change):', ...d.review.map((t) => `- ${t.title}: ${t.detail} [id ${t.id}]`)] : []),
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
  font_weight?: number;
  opacity?: number;
  /** Back to the design: drop every hand edit on this component (and its copy back to the brief's). */
  reset?: boolean;
};

export async function editCanvas(me: Who, input: { piece?: string; changes: CanvasChange[]; theme?: Preset; fix?: 'all'; note?: string }) {
  const { piece, draft } = await findPiece(me, input.piece);
  const slots = { ...(draft?.slots ?? piece.slots) };
  const edits: Edits = structuredClone(draft?.edits ?? piece.edits);
  const working = (status: string | null) => markClaude({ pieceId: piece.id, userId: me.id, slots, edits, status }).catch(() => {});
  await working('Working on the design');
  try {
    return await applyChanges(me, piece, slots, edits, input, working);
  } catch (e) {
    await working(null);
    throw e;
  }
}

async function applyChanges(me: Who, piece: PieceSource, slots: Record<string, string | null>, edits: Edits, input: { changes: CanvasChange[]; theme?: Preset; fix?: 'all' }, working: (s: string | null) => Promise<void>) {
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
  // By id (best), "Name (kind)", or name. When a name is shared (a "Date" group and a "Date" text), the
  // component that is not a group wins.
  const find = (ref: string) => {
    const r = ref.trim();
    const m = r.match(/^(.*?)\s*[([](\w[\w ]*)[)\]]$/);
    const n = (m ? m[1] : r).toLowerCase(), kind = m?.[2].toLowerCase();
    const named = before.comps.filter((x) => x.name.toLowerCase() === n && (!kind || x.kind === kind || (KIND[x.kind] ?? '').startsWith(kind)));
    const c = before.comps.find((x) => x.id === r)
      ?? named.find((x) => x.kind !== 'group') ?? named[0]
      ?? before.comps.find((x) => x.name.toLowerCase().includes(n));
    if (!c) throw new Error(`No component "${ref}". Components: ${before.comps.map((x) => `${x.name} (${x.id})`).join(', ')}.`);
    return c;
  };
  const done: string[] = [];
  const touched = (input.changes ?? []).map((ch) => find(ch.component).name);
  if (touched.length) await working(`Editing ${[...new Set(touched)].slice(0, 3).join(', ')}`);
  if (input.theme) { edit(THEME, { preset: input.theme }); done.push(`the ${input.theme} theme`); }
  for (const ch of input.changes ?? []) {
    const c = find(ch.component);
    if (ch.reset) {
      for (const id of [c.id, c.textId, c.iconId]) if (id) delete edits[id];
      for (const k of [c.slot, c.textSlot]) if (k) slots[k] = piece.slots[k] ?? null;
    }
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
    if (ch.font_weight) edit(c.kind === 'button' && c.textId ? c.textId : c.id, { style: { fontWeight: ch.font_weight } });
    if (ch.opacity != null) edit(c.id, { style: { opacity: Math.max(0, Math.min(1, ch.opacity)) } });
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
  // fix: 'all' runs the Inspector's own fixes in the page (several rounds), like Fix all in Canvas.
  if (input.fix === 'all') await working('Fixing the Inspector’s suggestions');
  const after = await render({ template: piece.template, format: piece.format, slots, edits: cleanEdits(edits), inspect: true, autofix: input.fix === 'all' });
  const final = after.fixed ? after.fixed : edits;
  const fixedCount = after.fixed ? Object.keys(after.fixed).filter((id) => JSON.stringify(after.fixed![id]) !== JSON.stringify(edits[id])).length : 0;
  const tips = after.inspected?.review ?? [];
  // The note people see in Canvas is always in English, written here from the changes.
  const parts = [...new Set(done)];
  const note = [parts.length ? `changed ${list(parts)}` : '', fixedCount ? `fixed ${fixedCount} Inspector suggestion${fixedCount > 1 ? 's' : ''}` : ''].filter(Boolean).join(' and ') || 'looked over the design';
  await saveDraft({ pieceId: piece.id, userId: me.id, slots, edits: final, by: 'claude', note: note.charAt(0).toUpperCase() + note.slice(1) });
  return { piece, png: after.png, note, suggestions: tips.map((t) => `${t.title}: ${t.detail} [id ${t.id}]`) };
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

const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
