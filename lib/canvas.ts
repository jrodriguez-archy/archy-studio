import 'server-only';
import { cache } from 'react';
import { catalog, titleOf } from './catalog';
import { previewSrcs } from './previews';
import type { Edits } from './canvas-shared';
import { loadPieces } from './gallery';
import { formatLabel, groupSets } from './gallery-shared';
import { supabaseAdmin } from './supabase/admin';
import { comboFormats, loadConfig, loadLibrary, loadManifest, resolveCombo, type Manifest, type TemplateConfig } from './templates';

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
    const slots = Object.fromEntries(Object.entries(manifest.slots).map(([k, v]) => [k, v.default]));
    return { id: ref, template, format, slots, edits: {}, ...pick, set_id: null, set_title: null, project_id: null, user_id: null, storage_path: '', width: f.width, height: f.height };
  }
  const id = ref;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await supabaseAdmin().from('renders').select(COLUMNS).eq('id', id).maybeSingle();
  if (!data) return null;
  return { ...(data as PieceSource), slots: data.slots ?? {}, edits: data.edits ?? {} };
});

export const isNew = (piece: PieceSource) => piece.id.startsWith('new:');

// An event template and its page cover are one design family: the cover is one more format of the
// event (as in Paper), though it is its own template. The event first, then its cover.
export async function familyOf(template: string): Promise<string[]> {
  const config = await loadConfig(template).catch(() => null);
  if (config?.cover) return [template, config.cover];
  if (config?.coverOf) return [config.coverOf, template];
  return [template];
}

// The formats of a design, as artboards: the newest design of each format of its family in its set
// (the piece itself for its own format), and the formats the set does not have yet.
export async function loadSet(piece: PieceSource) {
  const family = await familyOf(piece.template);
  const manifests = Object.fromEntries(await Promise.all(family.map(async (t) => [t, await loadManifest(t)] as const)));
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
    defaults: Object.fromEntries(Object.entries(manifests[t].slots).map(([k, v]) => [k, v.default])) as Record<string, string | null>,
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
  const [library, title, ...members] = await Promise.all([loadLibrary(), titleOf(family[0]),
    ...family.map(async (t) => {
      const manifest = await loadManifest(t);
      return { manifest, config: await loadConfig(t), combo: resolveCombo(manifest, t === piece.template ? piece.design : null, t === piece.template ? piece.theme : null) };
    })]);
  type Member = { manifest: Manifest; config: TemplateConfig; combo: ReturnType<typeof resolveCombo> };
  const slotsOf = (m: Member, format: string): Record<string, SlotInfo> => {
    const optional = new Set(m.config.optional ?? []);
    // Only the slots this format draws (a slot with per-format styles exists in those formats only).
    const inFormat = (s: { perFormat?: Record<string, unknown> }) => !s.perFormat || format in s.perFormat;
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
    combo: combo ? { design: combo.design, theme: combo.theme, designLabel: manifest.designs![combo.design].label, themeLabel: manifest.themes![combo.theme].label } : null,
    library: library.map((a) => ({ id: a.id, title: a.title, kind: a.kind, url: `/api/template-files/library/${a.file}` })),
  };
}

// The Canvas panel: templates to start from, the pieces to open (mine and the team's), the approved
// images and the person's own uploads.
export async function canvasLibrary(me: Who) {
  const [items, mine, team, library, uploads, seen] = await Promise.all([
    catalog(), loadPieces({ userId: me.id }, 80), loadPieces({}, 80), loadLibrary(), listUploads(me.id),
    supabaseAdmin().from('profiles').select('mcp_seen_at').eq('id', me.id).maybeSingle(),
  ]);
  const srcs = await previewSrcs(items);
  const byId = Object.fromEntries(items.map((i) => [i.manifest.id, i]));
  const card = (p: Awaited<ReturnType<typeof loadPieces>>[number], title: string) => ({ id: p.id, title, format: formatLabel(p.format), thumb: p.thumb ?? null, width: p.width, height: p.height, author: p.author });
  const pieces = (list: Awaited<ReturnType<typeof loadPieces>>) => groupSets(list).flatMap((s) => s.pieces.map((p) => card(p, s.title)));
  return {
    // An event page cover is one more format of its event (as in Paper), not a template of its own.
    templates: items.filter((i) => !(i.config.coverOf && byId[i.config.coverOf])).map((i) => ({
      id: i.manifest.id, title: i.config.title, category: i.config.category ?? 'other', purpose: i.config.purpose ?? null,
      formats: [i, ...(i.config.cover && byId[i.config.cover] ? [byId[i.config.cover]] : [])].flatMap((m) => Object.entries(m.manifest.formats)
        .map(([key, f]) => ({ key, template: m.manifest.id, label: formatLabel(key), width: f.width, height: f.height, src: srcs[`${m.manifest.id}/${key}`] }))),
      // Designs and themes to start from (default first), on templates that offer several.
      designs: i.manifest.default ? Object.entries(i.manifest.designs ?? {}).map(([key, d]) => ({ key, label: d.label })).sort((a, b) => Number(b.key === i.manifest.default!.design) - Number(a.key === i.manifest.default!.design)) : null,
      themes: i.manifest.default ? Object.entries(i.manifest.themes ?? {}).map(([key, t]) => ({ key, label: t.label })).sort((a, b) => Number(b.key === i.manifest.default!.theme) - Number(a.key === i.manifest.default!.theme)) : null,
      // Preview links of the other designs and themes, keyed `<format>--<design>--<theme>`.
      comboSrcs: Object.fromEntries(Object.entries(srcs).filter(([k]) => k.startsWith(`${i.manifest.id}/`) && k.includes('--')).map(([k, v]) => [k.slice(i.manifest.id.length + 1), v])),
    })),
    mine: pieces(mine),
    team: pieces(team),
    images: library.map((a) => ({ value: `asset:${a.id}`, title: a.title, kind: a.kind, url: `/api/template-files/library/${a.file}` })),
    uploads,
    /** When this person last used the Archy Studio connector from Claude (null: never). */
    mcpSeenAt: (seen.data?.mcp_seen_at as string | null | undefined) ?? null,
  };
}
export type CanvasLibrary = Awaited<ReturnType<typeof canvasLibrary>>;

// Images this person brought (Canvas uploads, inline logos), newest first.
export async function listUploads(userId: string) {
  const db = supabaseAdmin().storage.from('uploads');
  const { data } = await db.list(userId, { limit: 60, sortBy: { column: 'created_at', order: 'desc' } });
  const paths = (data ?? []).filter((f) => f.name && !f.name.startsWith('.')).map((f) => `${userId}/${f.name}`);
  if (!paths.length) return [];
  const { data: signed } = await db.createSignedUrls(paths, 60 * 60);
  return (signed ?? []).filter((x) => x.signedUrl && x.path).map((x) => ({ value: `upload:${x.path}`, title: 'Upload', kind: 'upload', url: x.signedUrl as string }));
}
