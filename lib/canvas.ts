import 'server-only';
import { cache } from 'react';
import { titleOf } from './catalog';
import type { Edits } from './canvas-shared';
import { loadPieces } from './gallery';
import { formatLabel, groupSets } from './gallery-shared';
import { listAssets, listFolders } from './assets';
import { supabaseAdmin } from './supabase/admin';
import { brandOf } from './brands';
import { comboFormats, loadConfig, loadLibrary, loadManifest, resolveCombo, templateBrand, type Manifest, type TemplateConfig } from './templates';

// Canvas: open a finished piece from its source (template + format + slots + edits), change it by hand
// and render it again with the same engine. Anyone on the team can open a piece and save a new version
// of it; replacing the original is for whoever can manage its set (maker, project owner, admin).

type Who = { id: string; is_admin: boolean };

export type PieceSource = {
  id: string; template: string; format: string; slots: Record<string, string | null>; edits: Edits;
  /** Design and theme of templates that offer several (null: the template's default). */
  design: string | null; theme: string | null;
  /** Copy kept as written in smaller text (down to 70%) instead of shortened. */
  smaller_text?: boolean;
  set_id: string | null; set_title: string | null; project_id: string | null; user_id: string | null; storage_path: string;
  width: number; height: number;
};

// What Canvas opens: a saved piece (its id) or a new piece from a template ("new:<template>:<format>",
// plus ":<design>:<theme>" on templates that offer several; drawn with the template's sample copy;
// saving it makes a new piece and set).
export const newRef = (template: string, format: string, design?: string | null, theme?: string | null) =>
  `new:${template}:${format}${design || theme ? `:${design ?? ''}:${theme ?? ''}` : ''}`;

// The files of a piece's design × theme (the base formats on single-design templates).
const filesOf = (manifest: Manifest, piece: { design: string | null; theme: string | null }) =>
  comboFormats(manifest, resolveCombo(manifest, piece.design, piece.theme));
// The design × theme a piece draws, with the defaults filled in ('' on single-design templates).
const comboKey = (manifest: Manifest, p: { design: string | null; theme: string | null }) =>
  manifest.default ? `${p.design || manifest.default.design}--${p.theme || manifest.default.theme}` : '';

const COLUMNS = 'id, template, format, slots, edits, design, theme, smaller_text, set_id, set_title, project_id, user_id, storage_path, width, height';

// Once per request (the page title and the page both ask).
export const loadSource = cache(async (ref: string): Promise<PieceSource | null> => {
  const fresh = ref.match(/^new:([a-z0-9-]+):([a-z]+)(?::([a-z0-9-]*):([a-z0-9-]*))?$/);
  if (fresh) {
    const [, template, format, design = null, theme = null] = fresh;
    const manifest = await loadManifest(template).catch(() => null);
    if (!manifest) return null;
    const pick = { design: design || null, theme: theme || null };
    let f;
    try { f = filesOf(manifest, pick)[format]; } catch { return null; }
    if (!f) return null;
    // The sample copy of this format and theme (DOC's themes each have their own: "Enroll now" on Startup).
    const key = (() => { try { const c = resolveCombo(manifest, pick.design ?? undefined, pick.theme ?? undefined); return c?.key ? `${format}--${c.key}` : format; } catch { return format; } })();
    const sampleOf = (v: Manifest['slots'][string]) => (v.perFormat?.[key] as { sample?: string } | undefined)?.sample ?? v.default;
    const slots = Object.fromEntries(Object.entries(manifest.slots).map(([k, v]) => [k, sampleOf(v)]));
    return { id: ref, template, format, slots, edits: {}, ...pick, set_id: null, set_title: null, project_id: null, user_id: null, storage_path: '', width: f.width, height: f.height };
  }
  const id = ref;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await supabaseAdmin().from('renders').select(COLUMNS).eq('id', id).maybeSingle();
  if (!data) return null;
  return { ...(data as PieceSource), slots: data.slots ?? {}, edits: data.edits ?? {} };
});

export const isNew = (piece: PieceSource) => piece.id.startsWith('new:');

// The templates whose formats make one design. The event page cover is a format of its event
// template (as in Paper), so a design is a single template.
export async function familyOf(template: string): Promise<string[]> {
  return [template];
}

// The formats of a design, as artboards: the newest design of each format of its family in its set
// (the piece itself for its own format), and the formats the set does not have yet.
export async function loadSet(piece: PieceSource) {
  const family = await familyOf(piece.template);
  const manifests = Object.fromEntries(await Promise.all(family.map(async (t) => [t, await loadManifest(t)] as const)));
  const configs = Object.fromEntries(await Promise.all(family.map(async (t) => [t, await loadConfig(t)] as const)));
  // The piece's own template in its design × theme; the rest of the family (event or cover) as designed.
  const files = Object.fromEntries(family.map((t) => [t, filesOf(manifests[t], t === piece.template ? piece : { design: null, theme: null })]));
  const order = family.flatMap((t) => Object.keys(files[t]).map((f) => `${t}:${f}`));
  const slotOf = (p: { template: string; format: string }) => `${p.template}:${p.format}`;
  let siblings: PieceSource[] = [];
  if (!isNew(piece) && piece.set_id) {
    const { data } = await supabaseAdmin().from('renders')
      .select(`${COLUMNS}, created_at`)
      .eq('set_id', piece.set_id).in('template', family).is('archived_at', null)
      .order('created_at', { ascending: false });
    const seen = new Set([piece.format]);
    const mine = comboKey(manifests[piece.template], piece);
    for (const r of data ?? []) {
      // Only the formats of the same design and theme (a set can hold options in several); one design
      // per format (an event format and the cover never share a key).
      if (seen.has(r.format) || !files[r.template]?.[r.format] || (r.template === piece.template && comboKey(manifests[r.template], r) !== mine)) continue;
      seen.add(r.format);
      siblings.push({ ...(r as PieceSource), slots: r.slots ?? {}, edits: r.edits ?? {} });
    }
  }
  siblings = [piece, ...siblings].sort((a, b) => order.indexOf(slotOf(a)) - order.indexOf(slotOf(b)));
  const have = new Set(siblings.map((p) => p.format));
  const missing = family.flatMap((t) => Object.entries(files[t]).filter(([f]) => !have.has(f)).map(([f, fm]) => ({
    ref: t === piece.template ? newRef(t, f, piece.design, piece.theme) : newRef(t, f), format: f, width: fm.width, height: fm.height,
    // The format's own sample where it has one (the cover's "Booth #1039"), only as the shape of what the
    // set says: a photo or a line made from the brief (the cover's subhead) never starts as the template's
    // sample (another event's venue photo and golf), it starts empty and takes the set's or a placeholder.
    defaults: Object.fromEntries(Object.entries(manifests[t].slots).map(([k, v]) => [k, v.type === 'image' || configs[t].derive?.[k] ? null : (v.perFormat?.[f] as { sample?: string } | undefined)?.sample ?? v.default])) as Record<string, string | null>,
  })));
  return { pieces: siblings, missing };
}

export async function canReplace(me: Who, piece: PieceSource) {
  if (isNew(piece)) return false;
  if (me.is_admin || piece.user_id === me.id) return true;
  if (!piece.project_id) return false;
  const { data } = await supabaseAdmin().from('projects').select('owner_id').eq('id', piece.project_id).maybeSingle();
  return data?.owner_id === me.id;
}

// What the editor needs to know about each slot of this format: its kind, whether it can be empty and
// its size limits.
export type SlotInfo = { type: 'text' | 'image' | 'logo'; optional: boolean; fontSize?: { min: number; max: number } };

export async function editorContext(piece: PieceSource) {
  const family = await familyOf(piece.template);
  const brand = await templateBrand(piece.template);
  const [all, title, ...members] = await Promise.all([loadLibrary(), titleOf(family[0]),
    ...family.map(async (t) => {
      const manifest = await loadManifest(t);
      return { manifest, config: await loadConfig(t), combo: resolveCombo(manifest, t === piece.template ? piece.design : null, t === piece.template ? piece.theme : null) };
    })]);
  type Member = { manifest: Manifest; config: TemplateConfig; combo: ReturnType<typeof resolveCombo> };
  const slotsOf = (m: Member, format: string): Record<string, SlotInfo> => {
    const optional = new Set(m.config.optional ?? []);
    // Only the slots this format draws (a slot with per-format styles exists in those formats only).
    const key = m.combo?.key ? `${format}--${m.combo.key}` : format;
    const inFormat = (s: { perFormat?: Record<string, unknown> }) => !s.perFormat || key in s.perFormat;
    return Object.fromEntries(Object.entries(m.manifest.slots).filter(([, s]) => inFormat(s as { perFormat?: Record<string, unknown> }))
      .map(([k, s]) => [k, { type: s.type, optional: optional.has(k), fontSize: s.limits?.[m.combo?.key ? `${format}--${m.combo.key}` : format]?.fontSize }]));
  };
  const own = members[family.indexOf(piece.template)] as Member;
  const combo = own.combo;
  const manifest = own.manifest;
  return {
    title, formatLabel: formatLabel(piece.format), slots: slotsOf(own, piece.format),
    /** The same, for every format of the design family (each artboard, the event cover included). */
    slotsByFormat: Object.fromEntries((members as Member[]).flatMap((m) => Object.keys(comboFormats(m.manifest, m.combo)).map((f) => [f, slotsOf(m, f)]))),
    /** The design and theme drawn, with the labels to show (null on single-design templates). */
    /** The brand of the template: Archy's recolor looks (Dark, Blue…) are offered only on Archy designs. */
    brand,
    combo: combo ? { design: combo.design, theme: combo.theme, designLabel: manifest.designs![combo.design].label, themeLabel: manifest.themes![combo.theme].label } : null,
    library: all.filter((a) => brandOf(a.brand) === brand).map((a) => ({ id: a.id, title: a.title, kind: a.kind, url: `/api/template-files/library/${a.file}` })),
  };
}

// The Canvas panel: the pieces to open and the team's assets (mine and everyone's).
export async function canvasLibrary(me: Who) {
  const [mine, team, myAssets, teamAssets, folders, seen] = await Promise.all([
    loadPieces({ userId: me.id }, 80), loadPieces({}, 80), listAssets({ ownerId: me.id }), listAssets(), listFolders(),
    supabaseAdmin().from('profiles').select('mcp_seen_at').eq('id', me.id).maybeSingle(),
  ]);
  // One card per set, as in the gallery: its lead format in front, the others stacked behind. Opening
  // it opens the lead; the set's other formats come along as artboards.
  const pieces = (list: Awaited<ReturnType<typeof loadPieces>>) => groupSets(list).map((s) => ({
    id: s.lead.id, title: s.title, format: [...new Set(s.pieces.map((p) => formatLabel(p.format)))].join(', '),
    thumb: s.lead.thumb ?? null, width: s.lead.width, height: s.lead.height, author: s.author,
    /** Every design in the set (to light the card when any of them is open, or being saved). */
    ids: s.pieces.map((p) => p.id),
  }));
  return {
    mine: pieces(mine),
    team: pieces(team),
    /** Images the team brought to Studio (and what Studio made from them): mine, and everyone's. */
    assets: { mine: myAssets, team: teamAssets },
    /** The team's folders for Assets (one level). */
    folders,
    /** When this person last used the Archy Studio connector from Claude (null: never). */
    mcpSeenAt: (seen.data?.mcp_seen_at as string | null | undefined) ?? null,
  };
}
export type CanvasLibrary = Awaited<ReturnType<typeof canvasLibrary>>;

