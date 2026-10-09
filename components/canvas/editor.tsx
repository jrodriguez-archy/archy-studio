'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Alert02Icon, ArrowLeft02Icon, Cursor01Icon, SearchVisualIcon, Download04Icon, HandGrabIcon, MinusSignIcon, PlusSignIcon, Redo02Icon, Undo02Icon,
} from '@hugeicons/core-free-icons';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { libraryAction as LibraryCall, prepareAction as PrepareCall, saveDraftAction as DraftCall } from '@/app/(app)/canvas/actions';
import { useRendersLive } from '@/components/use-renders-live';

// Export and save render with Chromium in their own route (/api/canvas), not in this page's function.
async function canvasCall<T = { url: string }>(body: Record<string, unknown>): Promise<({ ok: true } & T) | { ok: false; error: string }> {
  const res = await fetch('/api/canvas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return res.json().catch(() => ({ ok: false, error: `The server did not answer (${res.status}).` }));
}
import { supabaseBrowser } from '@/lib/supabase/browser';
import type { CanvasLibrary } from '@/lib/canvas';
import { LEFT_OUT, RECOLOR, cleanEdits, type Edits, type FillPlan, type NodeEdit, type Preset, type RenderReport, type Suggestion } from '@/lib/canvas-shared';
import { carried, follow, match, type Keys, type Snap } from '@/lib/canvas-sync';
import { BoardLabel, GhostBoard } from './artboards';
import { AssetsTab, withSession } from './assets-tab';
import { CanvasPanel, LibraryTab, type PanelTab } from './canvas-panel';
import { InspectorTab } from './inspector-tab';
import { ContentPanel } from './content-panel';
import { ResizeHandle, useSideWidth } from './resizable';
import { LayersPanel } from './layers-panel';
import { merge, within, type Box, type Comp, type Token } from './model';
import { MultiPanel, PiecePanel, PropertiesPanel, type Align, type SlotMeta } from './properties-panel';
import { Stage, type SelectMode, type StageHandle } from './stage';
import { useViewport } from './viewport';

/** One format of the design on the canvas (a saved design, or a format being added). */
export type Board = {
  ref: string; format: string; label: string; width: number; height: number; isNew: boolean; canReplace: boolean;
  initial: Snap; plan?: FillPlan;
  /** As saved (the baseline for "unsaved changes" and Reset); initial may be a draft. */
  saved: Snap;
  draft?: { version: number; by: string; note: string | null } | null;
};
/** A format of the template the design does not have yet. */
export type Ghost = { ref: string; format: string; label: string; width: number; height: number; defaults: Record<string, string | null> };
export type EditorProps = {
  title: string; backHref: string; active: string; boards: Board[]; ghosts: Ghost[];
  slotMeta: Record<string, Record<string, SlotMeta>>;
};

type Doc = Record<string, Snap>;
type Meta = { comps: Comp[]; safe: Box | null; tokens: Token[]; report: RenderReport | null; keys: Keys | null; review: Suggestion[] };
const EMPTY: Meta = { comps: [], safe: null, tokens: [], report: null, keys: null, review: [] };
const GAP = 120; // between artboards, in design px

// Canvas's light server calls, side by side (server actions would run one at a time): /api/canvas/live.
async function live(kind: string, args: unknown[]) {
  const r = await fetch('/api/canvas/live', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, args }) });
  // The same answers the actions gave: signed out, or any failure, comes back as { ok: false, error }.
  if (r.status === 401) return { ok: false, error: 'Sign in again.' };
  return r.json().catch(() => ({ ok: false, error: 'Something went wrong. Try again.' }));
}
const prepareAction = (...a: Parameters<typeof PrepareCall>): ReturnType<typeof PrepareCall> => live('prepare', a);
const saveDraftAction = (...a: Parameters<typeof DraftCall>): ReturnType<typeof DraftCall> => live('draft', a);
const libraryAction = (): ReturnType<typeof LibraryCall> => live('library', []);

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const cleanSnap = (s: Snap) => ({ slots: s.slots, edits: cleanEdits(s.edits) });
// Key order ignored: a draft read back from the database (jsonb) compares equal to the one sent.
const canon = (v: unknown) => JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : 1))) : x));
const luminance = (hex: string) => { const n = parseInt(hex.slice(1), 16); return (0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255; };
const planKeyOf = (s: Snap) => JSON.stringify([s.slots, Object.values(s.edits).flatMap((e) => [e.image, e.icon]).filter(Boolean).sort()]);

// Canvas, Relume-like: Canvas's own panel on the left (layers, library, assets, inspector), the design's
// formats side by side as artboards in a pannable, zoomable viewport, the selection's properties on the
// right. One artboard is edited at a time; what is shared (copy, images, recolor, styles) follows to the
// formats kept in sync. Save renders every changed format again with the same engine as Claude's designs.
export function CanvasEditor({ piece, library: given = null, seenAt = null }: { piece?: EditorProps; library?: CanvasLibrary | null; seenAt?: string | null }) {
  // With a piece, the panel's library (templates, pieces, images) loads after the piece is on screen,
  // and follows new designs and replaced images live.
  const [library, setLibrary] = useState<CanvasLibrary | null>(given);
  const [updating, setUpdating] = useState<string[]>([]);
  const reload = useCallback(() => {
    libraryAction().then((l) => { if (l && 'assets' in l) { setLibrary(l); setUpdating([]); } }).catch(() => {});
  }, []);
  // ?asset=<id> (Assets page → "Use in a design"): Assets open, that image pointed at.
  const params = useSearchParams();
  const pointAsset = params.get('asset');
  const pointFolder = params.get('folder');
  const [tab, setTab] = useState<PanelTab>(pointAsset ? 'assets' : piece ? 'layers' : 'library');
  // The library is for the Library and Assets tabs: it loads at once when one is open, else once the
  // design is drawn (it never competes with the design's own first load). Live changes (anyone's new
  // designs or images) reload it while one of those tabs is open; otherwise when one opens next.
  const shown = tab === 'library' || tab === 'assets';
  const stale = useRef(false);
  useEffect(() => {
    if (given) return;
    if (shown) { reload(); return; }
    const t = setTimeout(reload, 3000);
    return () => clearTimeout(t);
  }, [given, reload]); // eslint-disable-line react-hooks/exhaustive-deps
  // Opened before it arrived, or changed while hidden: now.
  useEffect(() => { if (shown && (stale.current || !library)) { stale.current = false; reload(); } }, [shown, reload]); // eslint-disable-line react-hooks/exhaustive-deps
  const shownRef = useRef(shown);
  shownRef.current = shown;
  useRendersLive(useCallback(() => { if (shownRef.current) reload(); else stale.current = true; }, [reload]));
  if (!piece) {
    return (
      <div data-fullbleed className="flex h-dvh flex-col bg-[#F5F5F5] text-[13px]">
        <header className="flex h-12 shrink-0 items-center border-b border-foreground/[0.06] bg-background px-4"><p className="font-medium">Canvas</p></header>
        <div className="flex min-h-0 flex-1">
          <CanvasPanel tab={tab === 'layers' ? 'library' : tab} onTab={setTab}>
            {!library ? <PanelLoading /> : tab === 'assets' ? <AssetsTab assets={library.assets} folders={library.folders} target={null} onPick={() => {}} /> : tab === 'inspector' ? <p className="px-3 py-6 text-[12px] text-foreground/50">Open a design and the Inspector reviews it as you edit.</p> : <LibraryTab library={library} confirmLeave={() => true} />}
          </CanvasPanel>
          <main className="flex flex-1 items-center justify-center p-8">
            <div className="max-w-sm text-center">
              <p className="text-[15px] font-medium">Pick something to work on</p>
              <p className="mt-1 text-foreground/50">Open one of your designs from the Library (everything Claude made is there too), or start one from Templates.</p>
            </div>
          </main>
        </div>
      </div>
    );
  }
  return (
    <Editor key={piece.boards.map((b) => b.ref).join()} {...piece} library={library} updating={updating} onSaved={(ids) => setUpdating(ids)}
      seenAt={library?.mcpSeenAt ?? seenAt} tab={tab} setTab={setTab} pointAsset={pointAsset} pointFolder={pointFolder} />
  );
}

function Editor({ title, backHref, active: firstActive, boards: firstBoards, ghosts: firstGhosts, slotMeta: slotMetaOf, library, updating, onSaved, seenAt, tab, setTab, pointAsset, pointFolder }: EditorProps & {
  library: CanvasLibrary | null; updating: string[]; onSaved: (ids: string[]) => void; seenAt: string | null; tab: PanelTab; setTab: (t: PanelTab) => void;
  pointAsset?: string | null;
  pointFolder?: string | null;
}) {
  const router = useRouter();
  // ---- The artboards: one document of snaps (one per format), one history for all of them ----
  const [boards, setBoards] = useState<Board[]>(firstBoards);
  const [ghosts, setGhosts] = useState<Ghost[]>(firstGhosts);
  const [unsynced, setUnsynced] = useState<string[]>([]);
  const [active, setActiveRef] = useState(firstActive);
  const [doc, setDocState] = useState<Doc>(() => Object.fromEntries(firstBoards.map((b) => [b.ref, b.initial])));
  const [past, setPast] = useState<Doc[]>([]);
  const [future, setFuture] = useState<Doc[]>([]);
  const docRef = useRef(doc);
  const setDoc = useCallback((d: Doc) => { docRef.current = d; setDocState(d); }, []);
  const activeRef = useRef(active);
  activeRef.current = active;
  const boardsRef = useRef(boards);
  boardsRef.current = boards;
  const ghostsRef = useRef(ghosts);
  ghostsRef.current = ghosts;
  const unsyncedRef = useRef(unsynced);
  unsyncedRef.current = unsynced;
  const liveBase = useRef<Doc | null>(null);
  const board = boards.find((b) => b.ref === active) ?? boards[0];
  const snap = doc[board.ref];
  const isNew = board.isNew;
  const slotMeta = slotMetaOf[board.format] ?? {};

  const [plans, setPlans] = useState<Record<string, FillPlan>>(() => Object.fromEntries(firstBoards.filter((b) => b.plan).map((b) => [b.ref, b.plan!])));
  const [planErrors, setPlanErrors] = useState<Record<string, string | null>>({});
  const [meta, setMetaState] = useState<Record<string, Meta>>({});
  const metaRef = useRef(meta);
  const setMeta = useCallback((ref: string, m: Partial<Meta>) => {
    metaRef.current = { ...metaRef.current, [ref]: { ...(metaRef.current[ref] ?? EMPTY), ...m } };
    setMetaState(metaRef.current);
  }, []);
  const plan = plans[board.ref];
  const { comps, safe, tokens, report, review } = meta[board.ref] ?? EMPTY;
  const planError = planErrors[board.ref] ?? null;

  const [claude, setClaude] = useState<{ ref: string; status: string } | null>(null);
  const [flash, setFlash] = useState<{ ref: string; ids: string[]; at: number } | null>(null);
  useEffect(() => { if (!claude) return; const t = setTimeout(() => setClaude(null), 90_000); return () => clearTimeout(t); }, [claude]);
  useEffect(() => { if (!flash) return; const t = setTimeout(() => setFlash(null), 1800); return () => clearTimeout(t); }, [flash]);
  const [selected, setSelected] = useState<string[]>([]);
  const [hover, setHover] = useState<string | null>(null);
  const [, setInfoTick] = useState(0);
  const stages = useRef<Record<string, StageHandle | null>>({});
  const stage = { current: stages.current[board.ref] ?? null };

  // Artboards in a row, top-aligned; the formats to add follow.
  const place = (() => {
    let x = 0;
    const at: Record<string, number> = {};
    for (const b of [...boards, ...ghosts]) { at[b.ref] = x; x += b.width + GAP; }
    return at;
  })();
  const allW = boards.reduce((s, b) => s + b.width, 0) + GAP * (boards.length - 1);
  const allH = Math.max(...boards.map((b) => b.height));
  const vp = useViewport(allW, allH);
  const frameBoard = (ref: string) => {
    const b = [...boards, ...ghosts].find((x) => x.ref === ref);
    if (b) vp.frame({ x: place[ref], y: 0, w: b.width, h: b.height }, false);
  };

  const [saving, setSaving] = useState(false);
  const [busy, start] = useTransition();
  const edited = (b: Board) => !same(cleanSnap(doc[b.ref]), cleanSnap(b.saved));
  // To save: what changed, and every format not in the gallery yet.
  const pending = boards.filter((b) => b.isNew || edited(b));
  // Worth a warning before leaving: real edits, or formats added.
  const changed = boards.some(edited) || boards.length > firstBoards.length;
  const dirty = pending.length > 0;

  // ---- Keeping the formats in step ----
  // Formats that still need to match the one they were made from (their page was not read yet).
  const toMatch = useRef<Record<string, string>>({});
  const synced = (ref: string) => !unsyncedRef.current.includes(ref);
  // The document with one artboard changed, and what is shared followed to the synced ones.
  // The slots a board's format draws (its own content), so another format never empties them.
  const drawnBy = (ref: string) => {
    const f = [...boardsRef.current, ...ghostsRef.current].find((b) => b.ref === ref)?.format;
    return f && slotMetaOf[f] ? new Set(Object.keys(slotMetaOf[f])) : undefined;
  };
  const spread = useCallback((d: Doc, ref: string, next: Snap): Doc => {
    const prev = d[ref];
    const out = { ...d, [ref]: next };
    if (!prev || !synced(ref)) return out;
    for (const b of boardsRef.current) {
      if (b.ref === ref || !synced(b.ref) || !out[b.ref]) continue;
      const src = metaRef.current[ref]?.keys ?? undefined, dst = metaRef.current[b.ref]?.keys ?? undefined;
      out[b.ref] = follow(prev, next, out[b.ref], src, dst, drawnBy(ref));
      if (!src || !dst) toMatch.current[b.ref] = ref;
    }
    return out;
  }, []);
  // Once a page is read (its keys known), a format waiting to match does.
  const settle = useCallback(() => {
    let d = docRef.current, moved = false;
    for (const [ref, from] of Object.entries(toMatch.current)) {
      const a = metaRef.current[from]?.keys, b = metaRef.current[ref]?.keys;
      if (!a || !b || !d[from] || !d[ref]) continue;
      delete toMatch.current[ref];
      d = { ...d, [ref]: match(d[from], d[ref], a, b, drawnBy(from)) };
      moved = true;
    }
    if (moved) setDoc(d);
  }, [setDoc]);

  // ---- History ----
  const cur = useCallback(() => docRef.current[activeRef.current], []);
  const pastRef = useRef(past);
  pastRef.current = past;
  const futureRef = useRef(future);
  futureRef.current = future;
  const commitTo = useCallback((ref: string, next: Snap) => {
    const before = liveBase.current ?? docRef.current;
    liveBase.current = null;
    setPast((p) => [...p.slice(-99), before]);
    setFuture([]);
    setDoc(spread(docRef.current, ref, next));
  }, [setDoc, spread]);
  const commit = useCallback((next: Snap) => commitTo(activeRef.current, next), [commitTo]);
  // A history step brings every format back; formats added since stay.
  const undo = useCallback(() => {
    const p = pastRef.current;
    if (!p.length) return;
    setFuture([docRef.current, ...futureRef.current]);
    setPast(p.slice(0, -1));
    setDoc({ ...docRef.current, ...p[p.length - 1] });
  }, [setDoc]);
  const redo = useCallback(() => {
    const f = futureRef.current;
    if (!f.length) return;
    setPast([...pastRef.current, docRef.current]);
    setFuture(f.slice(1));
    setDoc({ ...docRef.current, ...f[0] });
  }, [setDoc]);

  // Several layer edits at once (a drag of many, an align): one history step.
  const editMany = useCallback((changes: Record<string, NodeEdit>, final = true) => {
    const s = cur();
    const edits = { ...s.edits };
    for (const [id, e] of Object.entries(changes)) {
      const one = cleanEdits({ [id]: merge(s.edits[id], e) });
      if (one[id]) edits[id] = one[id]; else delete edits[id];
    }
    const next = { ...s, edits };
    if (final) commit(next);
    else { liveBase.current ??= docRef.current; setDoc(spread(docRef.current, activeRef.current, next)); }
  }, [commit, cur, setDoc, spread]);
  const editLayer = useCallback((id: string, e: NodeEdit, final = true) => editMany({ [id]: e }, final), [editMany]);

  const setSlot = useCallback((name: string, value: string | null) => {
    const s = cur();
    if ((s.slots[name] ?? null) === value) return;
    commit({ ...s, slots: { ...s.slots, [name]: value } });
  }, [commit, cur]);

  // Simple by default (made for people who are not designers); every layer and designer control is one
  // click away, and the choice is remembered.
  const rightSize = useSideWidth('canvas.right', 280, 260, 420);
  const [allLayers, setAllLayers] = useStored('canvas.allLayers');
  const [advanced, setAdvanced] = useStored('canvas.advanced');
  // Copy or images from the brief that are not optional are essential: they can be edited, never hidden.
  // A group or tag holding one of them (the booth tag around the booth number) is essential too.
  const essential = useCallback((id: string) => {
    const own = (x: string) => {
      const c = comps.find((y) => y.id === x);
      const slot = c?.slot ?? c?.textSlot;
      return c?.kind === 'archy' || (!!slot && !!slotMeta[slot] && !slotMeta[slot].optional);
    };
    return own(id) || within(comps, id).some(own);
  }, [comps, slotMeta]);
  const hideMany = useCallback((ids: string[], hidden = true) => {
    const ok = hidden ? ids.filter((id) => !essential(id)) : ids;
    if (ok.length < ids.length) toast('This is essential to the design: edit it instead of hiding it.');
    if (ok.length) editMany(Object.fromEntries(ok.map((id) => [id, { hidden }])));
  }, [editMany, essential]);
  // An optional detail left out empties its slot (the design closes up); brought back, it gets its copy again.
  // The eye hides an optional detail and keeps what it held (with the work, so a reload keeps it too);
  // the bin removes it for good.
  const toggleSlot = useCallback((slot: string) => {
    const s = cur();
    const kept = { ...(s.edits[LEFT_OUT]?.slots ?? {}) };
    const v = s.slots[slot];
    if (v) { commit({ slots: { ...s.slots, [slot]: null }, edits: { ...s.edits, [LEFT_OUT]: { slots: { ...kept, [slot]: v } } } }); return; }
    const back = kept[slot] ?? board.saved.slots[slot] ?? board.initial.slots[slot];
    if (!back) { toast('Click it and write its copy on the right.'); return; }
    delete kept[slot];
    commit({ slots: { ...s.slots, [slot]: back }, edits: { ...s.edits, [LEFT_OUT]: { slots: kept } } });
  }, [cur, commit, board]);
  const removeSlot = useCallback((slot: string) => {
    const s = cur();
    const kept = { ...(s.edits[LEFT_OUT]?.slots ?? {}) };
    delete kept[slot];
    // A hidden partner logo removed: nothing stays hidden for the next one.
    const edits: Edits = { ...s.edits, [LEFT_OUT]: { slots: kept } };
    for (const c of comps) if (c.slot === slot && edits[c.id]?.hidden) edits[c.id] = { ...edits[c.id], hidden: false };
    commit({ slots: { ...s.slots, [slot]: null }, edits });
  }, [cur, commit, comps]);

  const select = useCallback((ids: string[], mode: SelectMode) => {
    setSelected((now) => {
      if (mode === 'replace') return ids;
      const next = [...now];
      for (const id of ids) { const i = next.indexOf(id); if (i >= 0) next.splice(i, 1); else next.push(id); }
      // Never a component together with something inside it, nor the background with others.
      const bg = comps.find((c) => c.kind === 'background')?.id;
      const clean = next.filter((id) => id !== bg || next.length === 1);
      return clean.filter((id) => !clean.some((o) => o !== id && within(comps, o).includes(id)));
    });
  }, [comps]);

  // Edit another format: its artboard becomes the active one (and the address follows, without a reload).
  const activate = (ref: string, pick: string | null = null) => {
    if (ref !== activeRef.current) {
      setActiveRef(ref);
      activeRef.current = ref;
      setHover(null);
      // The browser's own replaceState (not Next's): the address follows without re-rendering the app or
      // dropping calls in flight.
      if (!ref.startsWith('new:')) History.prototype.replaceState.call(window.history, window.history.state, '', `/canvas/${ref}`);
    }
    setSelected(pick ? [pick] : []);
  };

  // Add a format: made from the one being edited (copy, images, recolor and styles), kept in sync.
  const addFormats = (list: Ghost[]) => {
    if (!list.length) return;
    const from = activeRef.current;
    const src = docRef.current[from];
    let d = { ...docRef.current };
    const added: Board[] = [];
    for (const g of list) {
      // What the designs already say (an event's headline becomes its cover's two lines); else what the set
      // holds for it even where no format draws it (the brief's cover photos); else the format's default
      // (no photo or brief line ever comes from the template's sample: see loadSet).
      const slots = Object.fromEntries(Object.entries(g.defaults).map(([k, v]) => {
        for (const [r, s] of [[from, src] as const, ...Object.entries(d)]) { const c = carried(s.slots, k, v, drawnBy(r)); if (c !== undefined) return [k, c ?? null]; }
        for (const s of [src, ...Object.values(d)]) if (s.slots[k]) return [k, s.slots[k]];
        return [k, v];
      }));
      const initial: Snap = { slots, edits: src.edits[RECOLOR] ? { [RECOLOR]: src.edits[RECOLOR] } : {} };
      d = { ...d, [g.ref]: initial };
      toMatch.current[g.ref] = from;
      added.push({ ref: g.ref, format: g.format, label: g.label, width: g.width, height: g.height, isNew: true, canReplace: false, initial, saved: initial });
    }
    const order = [...boardsRef.current, ...ghosts].map((b) => b.format);
    setBoards((bs) => [...bs, ...added].sort((a, b) => order.indexOf(a.format) - order.indexOf(b.format)));
    setGhosts((gs) => gs.filter((g) => !list.some((x) => x.ref === g.ref)));
    setDoc(d);
  };
  const toggleSync = (ref: string) => {
    if (unsynced.includes(ref)) {
      // Back in sync: it takes what is shared from the one being edited (or the first synced one).
      const from = ref !== active ? active : boards.find((b) => b.ref !== ref && !unsynced.includes(b.ref))?.ref;
      setUnsynced((u) => u.filter((x) => x !== ref));
      if (from) {
        const a = meta[from]?.keys, b = meta[ref]?.keys;
        if (a && b) commitTo(ref, match(docRef.current[from], docRef.current[ref], a, b, drawnBy(from)));
      }
    } else setUnsynced((u) => [...u, ref]);
  };

  const one = selected.length === 1 ? comps.find((c) => c.id === selected[0]) ?? null : null;
  const resetIds = (ids: string[]) => {
    const edits = { ...snap.edits };
    const slots = { ...snap.slots };
    for (const c of comps.filter((x) => ids.includes(x.id))) {
      for (const id of [c.id, c.textId, c.iconId]) if (id) delete edits[id];
      for (const k of [c.slot, c.textSlot]) if (k) slots[k] = board.saved.slots[k] ?? null;
    }
    commit({ edits, slots });
  };

  // Typed on the piece: a slot changes the brief (fit rules apply); other text is a hand edit.
  const typed = (nodeId: string, text: string) => {
    const c = comps.find((x) => x.id === nodeId) ?? comps.find((x) => x.textId === nodeId);
    const slot = c?.id === nodeId ? c.slot : c?.textSlot;
    if (slot) {
      if (!text.trim() && !slotMeta[slot]?.optional) { toast.error('This copy is essential to the design.'); return false; }
      if (text !== (snap.slots[slot] ?? '')) setSlot(slot, text);
    } else editLayer(nodeId, { text });
    return true;
  };

  // Align in the container (its padding kept) or the safe area; several together, to their own box.
  const align = (a: Align, to: 'container' | 'selection' = 'container') => {
    const ids = selected.filter((id) => comps.find((c) => c.id === id)?.kind !== 'background');
    const rects = Object.fromEntries(ids.map((id) => [id, stage.current?.rect(id)]).filter(([, r]) => r)) as Record<string, Box>;
    const span = (rs: Box[]) => { const x = Math.min(...rs.map((r) => r.x)), y = Math.min(...rs.map((r) => r.y)); return { x, y, w: Math.max(...rs.map((r) => r.x + r.w)) - x, h: Math.max(...rs.map((r) => r.y + r.h)) - y }; };
    const changes: Record<string, NodeEdit> = {};
    for (const id of Object.keys(rects)) {
      const r = rects[id];
      const box = to === 'selection' ? span(Object.values(rects)) : stage.current?.alignBox(id);
      if (!box) continue;
      const b = snap.edits[id]?.box ?? {};
      const dx = b.dx ?? 0, dy = b.dy ?? 0;
      const m = {
        left: { dx: dx + box.x - r.x }, center: { dx: dx + box.x + (box.w - r.w) / 2 - r.x }, right: { dx: dx + box.x + box.w - r.w - r.x },
        top: { dy: dy + box.y - r.y }, middle: { dy: dy + box.y + (box.h - r.h) / 2 - r.y }, bottom: { dy: dy + box.y + box.h - r.h - r.y },
      }[a] as { dx?: number; dy?: number };
      changes[id] = { box: Object.fromEntries(Object.entries(m).map(([k, v]) => [k, Math.round(v as number)])) };
    }
    editMany(changes);
  };

  const piece = snap.edits[RECOLOR] ?? {};
  const setPreset = (p: Preset) => {
    // A recolor replaces any loose background colour, so the piece stays coherent.
    const bg = comps.find((c) => c.kind === 'background')?.id;
    const changes: Record<string, NodeEdit> = { [RECOLOR]: { preset: p } };
    if (bg && snap.edits[bg]?.style?.backgroundColor) changes[bg] = { style: { backgroundColor: undefined } };
    editMany(changes);
  };
  // A background picked by hand moves the recolor along when it crosses from dark to light (or back).
  const pickBackground = (id: string, value: string) => {
    const hex = tokens.find((t) => t.value === value)?.hex;
    const changes: Record<string, NodeEdit> = { [id]: { style: { backgroundColor: value } } };
    if (hex) {
      const l = luminance(hex);
      const want: Preset = hex === '#FFFFFF' || hex === '#F7F7F7' ? 'light' : l > 0.6 ? 'ice' : hex === '#0095FF' || hex === '#66BFFF' || hex === '#013DF5' || hex === '#0000C9' ? 'blue' : 'dark';
      if (want !== (piece.preset ?? null)) changes[RECOLOR] = { preset: want };
    }
    editMany(changes);
  };

  // ---- Each format's fill follows its copy, images and icons (debounced round trip) ----
  const planKeys = boards.map((b) => [b.ref, planKeyOf(doc[b.ref])] as const);
  const planned = useRef<Record<string, string>>(Object.fromEntries(firstBoards.filter((b) => b.plan).map((b) => [b.ref, planKeyOf(b.initial)])));
  const planSig = JSON.stringify(planKeys);
  useEffect(() => {
    const due = planKeys.filter(([ref, k]) => planned.current[ref] !== k);
    for (const [ref] of planKeys) if (!due.some(([r]) => r === ref) && planErrors[ref]) setPlanErrors((e) => ({ ...e, [ref]: null }));
    if (!due.length) return;
    const t = setTimeout(() => {
      for (const [ref, k] of due) {
        const s = docRef.current[ref];
        prepareAction(ref, s.slots, s.edits).then((r) => {
          if (r.ok) { planned.current[ref] = k; setPlans((p) => ({ ...p, [ref]: r.plan })); setPlanErrors((e) => ({ ...e, [ref]: null })); }
          else setPlanErrors((e) => ({ ...e, [ref]: r.error }));
        }).catch(() => {});
      }
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planSig]);

  const refreshInfo = useCallback(() => setInfoTick((t) => t + 1), []);
  useEffect(() => { refreshInfo(); }, [refreshInfo, selected, comps]);

  // ---- Keys ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t?.closest?.('input, textarea, [contenteditable], [role=dialog], [role=menu], [data-panel]')) return; // keys in a side panel are the panel's
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
      if (mod && e.key.toLowerCase() === 'a') { e.preventDefault(); setSelected(comps.filter((c) => c.parent === null && c.kind !== 'background').map((c) => c.id)); return; }
      if (e.key === 'Escape') setSelected([]);
      if (!mod && e.key.toLowerCase() === 'v') vp.setHand(false);
      if (!mod && e.key.toLowerCase() === 'h') vp.setHand(true);
      const ids = selected.filter((id) => !['background', undefined].includes(comps.find((c) => c.id === id)?.kind));
      if (!ids.length) return;
      const step = e.shiftKey ? 10 : 1;
      const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
      if (d) {
        e.preventDefault();
        editMany(Object.fromEntries(ids.map((id) => { const b = cur().edits[id]?.box ?? {}; return [id, { box: { dx: (b.dx ?? 0) + d[0], dy: (b.dy ?? 0) + d[1] } }]; })));
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        hideMany(ids);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [comps, selected, undo, redo, editMany, hideMany, vp, cur]);

  // ---- The work is kept as people edit (each saved format's draft, with the formats added and not saved
  // yet on the first one); Claude's edits and the same design's edits in another tab arrive over Realtime.
  // The gallery's images change only with "Update images". ----
  const saved = boards.filter((b) => !b.isNew);
  const savedIds = saved.map((b) => b.ref).join();
  // Where the added formats are kept: the set's first saved format (the same in every tab).
  const home = saved[0]?.ref ?? null;
  const addedOf = (d: Doc, bs: Board[]) => bs.filter((b) => b.isNew && d[b.ref]).map((b) => ({ ref: b.ref, slots: d[b.ref].slots, edits: cleanEdits(d[b.ref].edits) }));
  const keyOf = (ref: string, d: Doc, bs: Board[]) => canon(ref === home ? { ...cleanSnap(d[ref]), added: addedOf(d, bs) } : cleanSnap(d[ref]));
  const versions = useRef<Record<string, number>>(Object.fromEntries(firstBoards.map((b) => [b.ref, b.draft?.version ?? 0])));
  const drafted = useRef<Record<string, string>>({});
  if (!Object.keys(drafted.current).length) {
    const d0 = Object.fromEntries(firstBoards.map((b) => [b.ref, b.initial]));
    for (const b of firstBoards) if (!b.isNew) drafted.current[b.ref] = keyOf(b.ref, d0, firstBoards);
  }
  const sent = useRef<Record<string, string[]>>({}); // this tab's recent drafts: their echo is not news
  // Kept on the server ('saved'), on its way ('saving'), or not kept ('error').
  const [keeping, setKeeping] = useState<'saved' | 'saving' | 'error'>('saved');
  const inFlight = useRef(0);
  const ownSave = useRef(0); // when this tab last saved to the gallery (its drafts are cleared then)
  useEffect(() => {
    const d = firstBoards.find((b) => b.ref === firstActive)?.draft;
    if (d?.by === 'claude') toast(`Claude’s changes are here: ${d.note ?? 'edited by Claude'}`);
  }, [firstBoards, firstActive]);
  const due = saved.filter((b) => keyOf(b.ref, doc, boards) !== drafted.current[b.ref]);
  useEffect(() => {
    // Nothing left to keep (an edit undone before it went out): kept.
    if (!due.length) { if (!inFlight.current) setKeeping((k) => (k === 'saving' ? 'saved' : k)); return; }
    setKeeping('saving');
    const t = setTimeout(() => {
      for (const b of due) {
        const d = docRef.current, s = d[b.ref];
        const added = b.ref === home ? addedOf(d, boardsRef.current) : undefined;
        drafted.current[b.ref] = keyOf(b.ref, d, boardsRef.current);
        sent.current[b.ref] = [...(sent.current[b.ref] ?? []).slice(-19), drafted.current[b.ref]];
        inFlight.current++;
        saveDraftAction(b.ref, s.slots, s.edits, added)
          .then((r) => { if (r.ok) versions.current[b.ref] = Math.max(versions.current[b.ref] ?? 0, r.version); else throw new Error(r.error); })
          .then(() => { if (!--inFlight.current) setKeeping((k) => (k === 'error' ? k : 'saved')); })
          .catch(() => { inFlight.current--; drafted.current[b.ref] = ''; setKeeping('error'); });
      }
    }, 800);
    return () => clearTimeout(t);
  }, [doc, boards]); // eslint-disable-line react-hooks/exhaustive-deps
  // Failed: tried again a little later (the next edit tries too).
  useEffect(() => {
    if (keeping !== 'error') return;
    const t = setTimeout(() => { setKeeping('saving'); setDoc({ ...docRef.current }); }, 5000);
    return () => clearTimeout(t);
  }, [keeping, setDoc]);

  // Leaving is safe once the work is kept; a design new from a template has nowhere to keep it yet.
  const unkept = (!home && changed) || (!!home && (due.length > 0 || keeping !== 'saved'));
  useEffect(() => {
    if (!unkept) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [unkept]);
  const confirmLeave = () => !unkept || window.confirm('Leave without saving your changes?');

  useEffect(() => {
    if (!savedIds) return;
    const db = supabaseBrowser();
    let channel: ReturnType<typeof db.channel> | null = null;
    let gone = false;
    (async () => {
      // Drafts are readable by signed-in people only (RLS): Realtime needs the session's token.
      const { data } = await db.auth.getSession();
      if (gone) return;
      db.realtime.setAuth(data.session?.access_token ?? null);
      channel = db.channel(`canvas:${savedIds}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'canvas_drafts', filter: `piece_id=in.(${savedIds})` }, (payload) => {
          if (payload.eventType === 'DELETE') {
            const ref = (payload.old as { piece_id?: string })?.piece_id;
            if (!ref || !docRef.current[ref]) return;
            // Its next draft starts again at version 1.
            versions.current[ref] = 0;
            // Saved to the gallery elsewhere (another tab, or Claude): open what was saved, so added
            // formats are not saved twice.
            if (Date.now() - ownSave.current > 90_000) { toast('Saved elsewhere. Opening what was saved…', { id: 'saved-elsewhere' }); setTimeout(() => window.location.assign(`/canvas/${ref}?latest=1`), 1200); }
            return;
          }
          const row = payload.new as { piece_id?: string; slots?: Snap['slots']; edits?: Edits; version?: number; updated_by?: string; note?: string | null; claude_working_at?: string | null; claude_status?: string | null; added?: { ref: string; slots: Snap['slots']; edits: Edits }[] };
          const ref = row?.piece_id;
          if (!ref || !docRef.current[ref]) return;
          // Claude at work on this design: shown on its artboard until its edit lands (or 90 s pass).
          if (row.claude_working_at && Date.now() - new Date(row.claude_working_at).getTime() < 90_000) setClaude({ ref, status: row.claude_status ?? 'Working on the design' });
          else if (!row.claude_working_at) setClaude((c) => (c?.ref === ref ? null : c));
          // Equal versions are let through: two saves at once can share one, and the later echo is what was kept.
          if (!row.version || row.version < (versions.current[ref] ?? 0)) return;
          versions.current[ref] = row.version;
          const next = { slots: row.slots ?? {}, edits: row.edits ?? {} };
          // Formats added elsewhere (on the first saved format's draft): new artboards here too.
          const added = (ref === home ? row.added ?? [] : []).filter((a) => !docRef.current[a.ref] || boardsRef.current.some((b) => b.ref === a.ref && b.isNew));
          const there = { ...docRef.current, [ref]: next, ...Object.fromEntries(added.map((a) => [a.ref, { slots: a.slots ?? {}, edits: a.edits ?? {} }])) };
          const newBoards = added.flatMap((a) => {
            if (boardsRef.current.some((b) => b.ref === a.ref)) return [];
            const g = ghostsRef.current.find((x) => x.ref === a.ref);
            return g ? [{ ref: g.ref, format: g.format, label: g.label, width: g.width, height: g.height, isNew: true, canReplace: false, initial: there[g.ref], saved: there[g.ref] }] : [];
          });
          const bs = [...boardsRef.current, ...newBoards];
          const key = keyOf(ref, there, bs);
          // What the database holds (the row alone): formats added only here are sent again on the next pass.
          const rowKey = canon(ref === home ? { ...cleanSnap(next), added: (row.added ?? []).map((a) => ({ ref: a.ref, slots: a.slots ?? {}, edits: cleanEdits(a.edits ?? {}) })) } : cleanSnap(next));
          if (key === keyOf(ref, docRef.current, boardsRef.current)) return;
          if (row.updated_by !== 'claude') {
            // Edited in another tab (or by a teammate): this tab follows. Its own echo is skipped, unless
            // another draft came in since (then the echo is what the database kept). Not an undo step:
            // each format arrives on its own, and undoing one would split synced formats.
            if (sent.current[ref]?.includes(rowKey)) return;
            sent.current[ref] = [];
            drafted.current[ref] = rowKey;
            if (newBoards.length) {
              const order = [...boardsRef.current, ...ghostsRef.current].map((b) => b.format);
              setBoards(bs.sort((a, b) => order.indexOf(a.format) - order.indexOf(b.format)));
              setGhosts((gs) => gs.filter((g) => !newBoards.some((b) => b.ref === g.ref)));
            }
            setDoc(there);
            toast('Updated from another tab.', { id: 'draft-elsewhere' });
            return;
          }
          // What Claude changed flashes on the piece.
          const prev = docRef.current[ref];
          const comps = metaRef.current[ref]?.comps ?? [];
          const ids = new Set(Object.keys({ ...prev.edits, ...next.edits }).filter((id) => id !== RECOLOR && JSON.stringify(prev.edits[id]) !== JSON.stringify(next.edits[id])));
          for (const [k, v] of Object.entries(next.slots)) if ((prev.slots[k] ?? null) !== v) { const c = comps.find((x) => x.slot === k || x.textSlot === k); if (c) ids.add(c.id); }
          setFlash({ ref, ids: [...ids], at: Date.now() });
          drafted.current[ref] = rowKey;
          commitTo(ref, next); // one step: undo takes it back; synced formats follow
          toast(`Claude ${row.note ? row.note.charAt(0).toLowerCase() + row.note.slice(1) : 'edited the design'}`, { action: { label: 'Undo', onClick: () => undo() } });
        })
        .subscribe((status, err) => { if (status === 'CHANNEL_ERROR' && !gone) console.warn('Canvas live updates:', err?.message ?? status); });
    })();
    return () => { gone = true; if (channel) db.removeChannel(channel); };
  }, [savedIds, home, commitTo, undo, setDoc]); // eslint-disable-line react-hooks/exhaustive-deps

  // The Inspector: its review of the edits, plus copy from the brief the template could not fit.
  // Nothing here blocks Save or Download.
  const suggestionsOf = (ref: string): Suggestion[] => {
    const m = meta[ref] ?? EMPTY;
    return [
      ...(m.report && !m.report.ok ? m.report.errors.map((e) => {
        const c = m.comps.find((x) => x.slot === e.slot || x.textSlot === e.slot);
        return { id: c?.id ?? '', level: 'warn' as const, title: `${c?.name ?? 'Some copy'} doesn’t fit the design`, detail: e.message ?? 'Shorten it a little.' };
      }) : []),
      ...m.review,
    ];
  };
  const suggestions = suggestionsOf(board.ref);
  const warnings = suggestions.filter((x) => x.level === 'warn').length;
  const otherWarnings = boards.filter((b) => b.ref !== board.ref).reduce((n, b) => n + suggestionsOf(b.ref).filter((x) => x.level === 'warn').length, 0);
  const fixable = suggestions.filter((x) => x.fix || x.auto).length;
  const fix = (sg: Suggestion) => {
    if (!sg.fix) return;
    const b = snap.edits[sg.id]?.box ?? {};
    editLayer(sg.id, { box: { dx: (b.dx ?? 0) + sg.fix.dx, dy: (b.dy ?? 0) + sg.fix.dy } });
  };
  // Undo the hand edit that caused a suggestion: those fields go back to the design's values.
  const revert = (sg: Suggestion) => {
    if (!sg.revert) return;
    const s = cur();
    const e = structuredClone(s.edits[sg.revert.id] ?? {}) as Record<string, unknown>;
    for (const f of sg.revert.fields) {
      const [k, sub] = f.split('.');
      if (sub) { const o = e[k] as Record<string, unknown> | undefined; if (o) delete o[sub]; } else delete e[k];
    }
    const one = cleanEdits({ [sg.revert.id]: e as NodeEdit });
    const edits = { ...s.edits };
    if (one[sg.revert.id]) edits[sg.revert.id] = one[sg.revert.id]; else delete edits[sg.revert.id];
    commit({ ...s, edits });
  };
  // Fix all: every automatic fix, settled in the page over a few rounds, as one undo step.
  const fixAll = () => {
    const next = stage.current?.autofix(cur().edits);
    if (!next) return;
    commit({ ...cur(), edits: cleanEdits(next) });
  };

  const download = () => start(async () => {
    const r = await canvasCall({ action: 'export', id: board.ref, slots: snap.slots, edits: snap.edits });
    if (!r.ok) { toast.error(r.error); return; }
    window.location.href = r.url;
  });

  // Save every format that changed (and every format added) at once.
  const existing = pending.filter((b) => !b.isNew);
  const canReplace = existing.every((b) => b.canReplace);
  const save = (mode: 'version' | 'replace') => start(async () => {
    ownSave.current = Date.now();
    const items = pending.map((b) => ({ id: b.ref, slots: doc[b.ref].slots, edits: doc[b.ref].edits }));
    const from = boards.find((b) => !b.isNew)?.ref ?? null;
    const r = await canvasCall<{ saved: { ref: string; id: string }[] }>({ action: 'save-set', items, mode, from });
    if (!r.ok) { toast.error(r.error); return; }
    setSaving(false);
    const ids = Object.fromEntries(r.saved.map((s) => [s.ref, s.id]));
    const n = r.saved.length, added = pending.filter((b) => b.isNew).length;
    toast.success(
      added === n ? (n > 1 ? `Saved ${n} formats to the gallery.` : 'Saved to the gallery as a new design.')
        : mode === 'replace' ? (n > 1 ? `Saved ${n} formats. The originals were replaced.` : 'The original was replaced.')
          : n > 1 ? `Saved ${n} formats as new versions. The originals are kept.` : 'Saved as a new version. The original is kept.',
    );
    // Library shows these as updating until the new images arrive.
    onSaved(Object.values(ids));
    setBoards((bs) => bs.map((b) => (ids[b.ref] ? { ...b, saved: doc[b.ref] } : b)));
    // Open the saved formats from the gallery (new versions and added formats have new ids).
    const next = ids[board.ref] ?? board.ref;
    if (next.startsWith('new:')) return;
    // Always through the router: switching formats moves the address natively, so the router may still
    // be on the format first opened (a refresh would put that one back in the address).
    router.replace(`/canvas/${next}`);
  });

  const imageTarget = one && (one.kind === 'photo' || one.kind === 'partner') ? one : null;
  // Brought here to use an image: with one photo on the design it is selected (a click places the
  // image); with several, the person picks one.
  const pointed = useRef(false);
  useEffect(() => {
    if (!pointAsset || pointed.current || !comps.length) return;
    pointed.current = true;
    const photos = comps.filter((c) => c.kind === 'photo');
    if (photos.length === 1) { setSelected([photos[0].id]); toast('Click the image to place it.'); }
    else toast('Select a photo on the design, then click the image.');
  }, [pointAsset, comps]);
  const placeImage = (value: string) => {
    if (!imageTarget) return;
    if (imageTarget.slot) setSlot(imageTarget.slot, value); else editLayer(imageTarget.id, { image: value });
  };
  const pickerImages = (library ? withSession(library.assets).team : []).map((a) => ({ value: a.value, title: a.name, url: a.thumb }));
  const pct = Math.round(vp.zoom * 100);
  const allNew = boards.every((b) => b.isNew);
  // The work is kept as it goes; the gallery's images change with "Update images".
  const status = allNew ? ' · New from template' : keeping === 'error' ? ' · Not saved, trying again' : due.length || keeping === 'saving' ? ' · Saving…' : ' · Saved';

  return (
    <div data-fullbleed className="flex h-dvh flex-col bg-[#F5F5F5] text-[13px]">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-foreground/[0.06] bg-background px-3">
        <Link href={backHref} onClick={(e) => { if (!confirmLeave()) e.preventDefault(); }} aria-label="Back to the gallery" title="Back to the gallery" className="flex size-8 items-center justify-center rounded-md text-foreground/60 hover:bg-foreground/[0.05] hover:text-foreground">
          <HugeiconsIcon icon={ArrowLeft02Icon} className="size-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{title}</p>
          <p className="truncate text-[11px] text-foreground/40">{board.label} · {board.width}×{board.height}{status}</p>
        </div>
        <div className="flex items-center gap-0.5">
          <ToolButton label="Undo (⌘Z)" icon={Undo02Icon} disabled={!past.length} onClick={undo} />
          <ToolButton label="Redo (⇧⌘Z)" icon={Redo02Icon} disabled={!future.length} onClick={redo} />
        </div>
        {ghosts.length > 0 && (
          <button type="button" onClick={() => addFormats(ghosts)} title={`Add ${ghosts.map((g) => g.label).join(', ')}, made from ${board.label}`}
            className="flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[12px] text-foreground/70 hover:bg-foreground/[0.05] hover:text-foreground">
            <HugeiconsIcon icon={PlusSignIcon} className="size-3.5" /> Add {ghosts.length > 1 ? 'all formats' : ghosts[0].label}
          </button>
        )}
        {suggestions.length > 0 && (
          <button type="button" onClick={() => setTab('inspector')} title="Open the Inspector"
            className={`flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[12px] ${warnings ? 'bg-[#FFF4E5] text-[#B45309] hover:bg-[#FFEACC]' : 'bg-[#E6F4FF] text-primary hover:bg-[#CCEAFF]'}`}>
            <HugeiconsIcon icon={warnings ? Alert02Icon : SearchVisualIcon} className="size-3.5" />
            {suggestions.length} suggestion{suggestions.length > 1 ? 's' : ''}
          </button>
        )}
        {fixable > 0 && (
          <button type="button" onClick={fixAll} title="Apply every automatic fix (one undo step)"
            className="flex h-8 items-center rounded-md px-2.5 text-[12px] font-medium text-primary hover:bg-[#E6F4FF]">Fix all</button>
        )}
        <button type="button" onClick={download} disabled={busy} title={`Download ${board.label}`}
          className="flex h-8 items-center gap-1.5 rounded-md bg-foreground/[0.05] px-3 text-foreground/80 hover:bg-foreground/[0.09] disabled:opacity-50">
          <HugeiconsIcon icon={Download04Icon} className="size-3.5" /> Download
        </button>
        <button type="button" onClick={() => (existing.length ? setSaving(true) : save('version'))} disabled={busy || !dirty}
          className="flex h-8 items-center rounded-md bg-primary px-3.5 font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
          {!allNew ? (busy ? 'Updating…' : 'Update images') : busy ? 'Saving…' : 'Save to gallery'}
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <CanvasPanel tab={tab} onTab={setTab} badges={{ inspector: warnings + otherWarnings }}>
          {tab === 'layers' && !allLayers && (
            <ContentPanel comps={comps} edits={snap.edits} slots={snap.slots} slotMeta={slotMeta} previews={plan?.fill.values ?? {}} preset={piece.preset}
              selected={selected} hover={hover} onHover={setHover} onSelect={(id) => select([id], 'replace')}
              onSlotToggle={toggleSlot} onSlot={setSlot} onHide={(id) => hideMany([id], !snap.edits[id]?.hidden)} onPreset={setPreset} onAdvanced={() => setAllLayers(true)}
              onLogoColors={(id, colors) => editLayer(id, { colors })} onSlotRemove={removeSlot} />
          )}
          {tab === 'layers' && allLayers && (
            <>
              <button type="button" onClick={() => setAllLayers(false)} className="mx-3 mt-1 text-[12px] text-foreground/50 hover:text-foreground">← Simple view</button>
              <LayersPanel comps={comps} edits={snap.edits} selected={selected} hover={hover} onHover={setHover}
                onSelect={(id, add) => select([id], add ? 'toggle' : 'replace')}
                onToggle={(id) => hideMany([id], !snap.edits[id]?.hidden)} />
            </>
          )}
          {(tab === 'library' || tab === 'assets') && !library && <PanelLoading />}
          {tab === 'library' && library && <LibraryTab library={library} current={isNew ? undefined : board.ref} updating={updating} confirmLeave={confirmLeave} />}
          {tab === 'assets' && library && <AssetsTab assets={library.assets} folders={library.folders} target={imageTarget?.id ?? null} onPick={placeImage} highlight={pointAsset} highlightFolder={pointFolder} />}
          {tab === 'inspector' && <InspectorTab items={suggestions} onPick={(id) => id && setSelected([id])} onFix={fix} onRevert={revert} onFixAll={fixAll} pieceId={isNew ? undefined : board.ref} title={title} seenAt={seenAt} />}
        </CanvasPanel>

        <main
          ref={vp.area}
          className={`relative min-w-0 flex-1 overflow-hidden ${vp.panning ? (vp.grabbing ? 'cursor-grabbing' : 'cursor-grab') : ''}`}
          {...vp.handlers}
          onPointerDownCapture={(e) => { if (!vp.panning && !(e.target as Element).closest('[data-stage], [data-toolbar], [data-board-label]')) setSelected([]); }}
        >
          <div className="absolute top-0 left-0" style={{ transform: `translate(${vp.pan.x}px, ${vp.pan.y}px)` }}>
            {boards.map((b) => {
              const isActive = b.ref === board.ref;
              const p = plans[b.ref];
              const m = meta[b.ref] ?? EMPTY;
              const sg = suggestionsOf(b.ref);
              const busyClaude = claude?.ref === b.ref ? claude.status : null;
              return (
                <div key={b.ref} className="absolute top-0" style={{ left: place[b.ref] * vp.zoom }}>
                  {!busyClaude && (
                    <BoardLabel label={b.label} size={`${b.width}×${b.height}`} compact={b.width * vp.zoom < 230} active={isActive} synced={!unsynced.includes(b.ref)} isNew={b.isNew && !allNew}
                      count={sg.length} warn={sg.some((x) => x.level === 'warn')} onPick={() => activate(b.ref)} onFrame={() => frameBoard(b.ref)} onSync={() => toggleSync(b.ref)} />
                  )}
                  {p ? (
                    <div className={isActive || boards.length === 1 ? '' : 'opacity-[0.97] transition-opacity hover:opacity-100'}>
                      <Stage
                        ref={(h) => { stages.current[b.ref] = h; }}
                        passive={!isActive}
                        onActivate={(id) => activate(b.ref, id && m.comps.find((c) => c.id === id)?.kind !== 'background' ? id : null)}
                        claude={busyClaude}
                        flash={flash?.ref === b.ref ? flash.ids : []}
                        plan={p}
                        edits={doc[b.ref].edits}
                        zoom={vp.zoom}
                        selected={isActive ? selected : []}
                        hover={isActive ? hover : null}
                        comps={m.comps}
                        safe={m.safe}
                        panning={vp.panning}
                        onSelect={select}
                        onHover={setHover}
                        onReady={(r) => { setMeta(b.ref, { comps: r.comps, safe: r.safe, tokens: r.tokens, report: r.report, keys: r.keys }); settle(); }}
                        onEdit={editMany}
                        onText={typed}
                        onInfo={refreshInfo}
                        onReview={(items) => setMeta(b.ref, { review: items })}
                      />
                    </div>
                  ) : (
                    <div className="animate-pulse rounded-[2px] bg-foreground/[0.06]" style={{ width: b.width * vp.zoom, height: b.height * vp.zoom }} />
                  )}
                </div>
              );
            })}
            {ghosts.map((g) => (
              <div key={g.ref} className="absolute top-0" style={{ left: place[g.ref] * vp.zoom }}>
                <p className="absolute -top-6 left-0 text-[11px] whitespace-nowrap text-foreground/35">{g.label} · {g.width}×{g.height}</p>
                <GhostBoard label={g.label} size={`${g.width}×${g.height}`} width={g.width} height={g.height} zoom={vp.zoom} onAdd={() => addFormats([g])} />
              </div>
            ))}
          </div>

          {planError && (
            <div className="absolute top-4 left-1/2 flex max-w-[min(560px,90%)] -translate-x-1/2 items-start gap-2 rounded-lg bg-background px-3.5 py-2.5 shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_8px_24px_-8px_rgba(0,0,0,0.2)]">
              <HugeiconsIcon icon={Alert02Icon} className="mt-px size-4 shrink-0 text-[#D97706]" />
              <p className="text-foreground/70">{planError}</p>
            </div>
          )}

          {/* Floating toolbar, Relume-like: select / hand, zoom. */}
          <div data-toolbar className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-0.5 rounded-lg bg-background p-1 shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_8px_24px_-8px_rgba(0,0,0,0.2)]">
            <ToolButton label="Select (V)" icon={Cursor01Icon} active={!vp.hand} onClick={() => vp.setHand(false)} />
            <ToolButton label="Hand (H, or hold Space)" icon={HandGrabIcon} active={vp.hand} onClick={() => vp.setHand(true)} />
            <span className="mx-1 h-5 w-px bg-foreground/10" />
            <ToolButton label="Zoom out (⌘−)" icon={MinusSignIcon} onClick={() => vp.zoomTo(vp.zoom / 1.25)} />
            <button type="button" onClick={vp.fit} title="Fit all formats (⌘0)" className="h-7 w-12 rounded-md text-[12px] tabular-nums hover:bg-foreground/[0.06]">{pct}%</button>
            <ToolButton label="Zoom in (⌘+)" icon={PlusSignIcon} onClick={() => vp.zoomTo(vp.zoom * 1.25)} />
            {boards.length > 1 && (
              <button type="button" onClick={() => frameBoard(board.ref)} title={`Frame ${board.label}`} className="h-7 rounded-md px-2 text-[12px] text-foreground/70 hover:bg-foreground/[0.06]">{board.label}</button>
            )}
          </div>
        </main>

        <aside ref={rightSize.ref} data-panel className="relative shrink-0 border-l border-foreground/[0.06] bg-background max-lg:hidden" style={{ width: rightSize.width }}>
          <ResizeHandle side="right" width={rightSize.width} onWidth={rightSize.set} onReset={rightSize.reset} />
          <div className="h-full overflow-y-auto [scrollbar-width:thin]">
          {selected.length > 1 ? (
            <MultiPanel count={selected.length} onAlign={(a, to) => align(a, to)} onReset={() => resetIds(selected)}
              onHide={() => hideMany(selected)} />
          ) : one && plan ? (
            <PropertiesPanel
              key={`${board.ref}:${one.id}`}
              comp={one}
              alignIn={one.kind === 'background' ? undefined : stage.current?.alignBox(one.id)?.name}
              preset={piece.preset}
              onPreset={setPreset}
              info={(id) => (id ? stage.current?.info(id) ?? null : null)}
              edits={snap.edits}
              slots={snap.slots}
              slotMeta={slotMeta}
              previews={plan.fill.values}
              tokens={tokens}
              library={pickerImages}
              onEdit={(id, e, final = true) => (one.kind === 'background' && e.style?.backgroundColor ? pickBackground(id, e.style.backgroundColor) : editLayer(id, e, final))}
              onSlot={setSlot}
              onReset={() => resetIds([one.id])}
              onAlign={(a) => align(a)}
              essential={essential(one.id)}
              designFontSize={meta[board.ref]?.keys?.[one.id]?.fontSize}
              advanced={advanced}
              onAdvanced={setAdvanced}
            />
          ) : (
            <PiecePanel pieceId={isNew ? undefined : board.ref} title={title} seenAt={seenAt} />
          )}
          </div>
        </aside>
      </div>

      <Dialog open={saving} onOpenChange={setSaving}>
        <DialogContent className="gap-5 rounded-md p-6 text-[13px] sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-[15px] font-medium">Update images</DialogTitle>
            <DialogDescription className="text-[13px]">
              {pending.length > 1 ? `${pending.map((b) => b.label).join(', ')} changed. ` : ''}Keep the original{existing.length > 1 ? 's' : ''}, or put the edited design{existing.length > 1 ? 's' : ''} in {existing.length > 1 ? 'their' : 'its'} place.
              {pending.some((b) => b.isNew) ? ' Added formats join the set either way.' : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <SaveOption title="Save as a new version" text="The original stays in the history. The new one takes its place in the set." onClick={() => save('version')} disabled={busy} primary />
            <SaveOption title="Replace the original" text={canReplace ? 'Same design and link, with the new image.' : 'Only the person who made it, the project owner or an admin can do this.'} onClick={() => save('replace')} disabled={busy || !canReplace} />
          </div>
          {busy && <p className="text-foreground/50">Rendering {pending.length > 1 ? `${pending.length} formats` : 'the design'}…</p>}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PanelLoading() {
  return (
    <div className="grid grid-cols-2 gap-2 px-3 py-2">
      {Array.from({ length: 6 }, (_, i) => <div key={i} className="aspect-square animate-pulse rounded-md bg-foreground/[0.05]" />)}
    </div>
  );
}

function ToolButton({ label, icon, onClick, disabled, active }: { label: string; icon: typeof Undo02Icon; onClick: () => void; disabled?: boolean; active?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label} aria-pressed={active}
      className={`flex size-8 items-center justify-center rounded-md transition-colors disabled:opacity-30 disabled:hover:bg-transparent ${active ? 'bg-[#E6F4FF] text-primary' : 'text-foreground/60 hover:bg-foreground/[0.06] hover:text-foreground'}`}>
      <HugeiconsIcon icon={icon} className="size-3.5" strokeWidth={1.8} />
    </button>
  );
}

function SaveOption({ title, text, onClick, disabled, primary }: { title: string; text: string; onClick: () => void; disabled?: boolean; primary?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`rounded-md px-3.5 py-3 text-left ring-1 transition-colors disabled:opacity-50 ${primary ? 'ring-primary/40 hover:bg-[#E6F4FF]' : 'ring-foreground/10 hover:bg-foreground/[0.03]'}`}>
      <p className={`font-medium ${primary ? 'text-primary' : ''}`}>{title}</p>
      <p className="mt-0.5 text-foreground/50">{text}</p>
    </button>
  );
}

// A yes/no preference kept in this browser (the page works the same without storage).
function useStored(key: string): [boolean, (v: boolean) => void] {
  const [v, setV] = useState(false);
  useEffect(() => { try { setV(localStorage.getItem(key) === '1'); } catch {} }, [key]);
  return [v, (next: boolean) => { setV(next); try { localStorage.setItem(key, next ? '1' : '0'); } catch {} }];
}
