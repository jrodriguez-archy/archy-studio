'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Alert02Icon, ArrowLeft02Icon, Cursor01Icon, Download04Icon, HandGrabIcon, MinusSignIcon, PlusSignIcon, Redo02Icon, Undo02Icon,
} from '@hugeicons/core-free-icons';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { exportAction, prepareAction, saveAction } from '@/app/(app)/canvas/actions';
import type { CanvasLibrary } from '@/lib/canvas';
import { THEME, cleanEdits, type Edits, type FillPlan, type NodeEdit, type Preset, type RenderReport } from '@/lib/canvas-shared';
import { AssetsTab, CanvasPanel, LibraryTab, type PanelTab } from './canvas-panel';
import { ClaudeTab } from './claude-tab';
import { LayersPanel } from './layers-panel';
import { merge, within, type Box, type Comp, type Token } from './model';
import { ColorsPanel, MultiPanel, PropertiesPanel, type Align, type SlotMeta } from './properties-panel';
import { Stage, type SelectMode, type StageHandle } from './stage';
import { useViewport } from './viewport';

type Snap = { slots: Record<string, string | null>; edits: Edits };
export type PieceProps = {
  pieceId: string; title: string; formatLabel: string; backHref: string; canReplace: boolean; isNew: boolean;
  initial: Snap; plan: FillPlan; slotMeta: Record<string, SlotMeta>;
};

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const cleanSnap = (s: Snap) => ({ slots: s.slots, edits: cleanEdits(s.edits) });
const luminance = (hex: string) => { const n = parseInt(hex.slice(1), 16); return (0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255; };

// Canvas, Relume-like: Canvas's own panel on the left (layers, library, assets, Claude), the piece in a
// pannable, zoomable viewport, the selection's properties on the right. Copy and slot images change the
// brief (the fit rules still apply); everything else is a hand edit kept with the piece. Save renders it
// again with the same engine as Claude's pieces.
export function CanvasEditor({ piece, library }: { piece?: PieceProps; library: CanvasLibrary }) {
  const [tab, setTab] = useState<PanelTab>(piece ? 'layers' : 'library');
  if (!piece) {
    return (
      <div data-fullbleed className="flex h-dvh flex-col bg-[#F5F5F5] text-[13px]">
        <header className="flex h-12 shrink-0 items-center border-b border-foreground/[0.06] bg-background px-4"><p className="font-medium">Canvas</p></header>
        <div className="flex min-h-0 flex-1">
          <CanvasPanel tab={tab === 'layers' ? 'library' : tab} onTab={setTab}>
            {tab === 'assets' ? <AssetsTab library={library} target={null} onPick={() => {}} /> : tab === 'claude' ? <ClaudeTab /> : <LibraryTab library={library} confirmLeave={() => true} />}
          </CanvasPanel>
          <main className="flex flex-1 items-center justify-center p-8">
            <div className="max-w-sm text-center">
              <p className="text-[15px] font-medium">Pick something to work on</p>
              <p className="mt-1 text-foreground/50">Start from a template in the Library, or open one of your pieces. Everything Claude made is there too.</p>
            </div>
          </main>
        </div>
      </div>
    );
  }
  return <Editor key={piece.pieceId} {...piece} library={library} tab={tab} setTab={setTab} />;
}

function Editor({ pieceId, title, formatLabel, backHref, canReplace, isNew, initial, plan: firstPlan, slotMeta, library, tab, setTab }: PieceProps & { library: CanvasLibrary; tab: PanelTab; setTab: (t: PanelTab) => void }) {
  const router = useRouter();
  const [snap, setSnap] = useState<Snap>(initial);
  const [past, setPast] = useState<Snap[]>([]);
  const [future, setFuture] = useState<Snap[]>([]);
  const [saved, setSaved] = useState<Snap>(initial);
  const liveBase = useRef<Snap | null>(null);

  const [plan, setPlan] = useState(firstPlan);
  const [planError, setPlanError] = useState<string | null>(null);
  const [comps, setComps] = useState<Comp[]>([]);
  const [safe, setSafe] = useState<Box | null>(null);
  const [used, setUsed] = useState<string[]>([]);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [report, setReport] = useState<RenderReport | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [hover, setHover] = useState<string | null>(null);
  const [, setInfoTick] = useState(0);
  const stage = useRef<StageHandle>(null);
  const vp = useViewport(plan.width, plan.height);

  const [saving, setSaving] = useState(false);
  const [busy, start] = useTransition();
  const dirty = isNew || !same(cleanSnap(snap), cleanSnap(saved));
  const changed = !same(cleanSnap(snap), cleanSnap(saved));

  // ---- History ----
  const snapRef = useRef(snap);
  snapRef.current = snap;
  const pastRef = useRef(past);
  pastRef.current = past;
  const futureRef = useRef(future);
  futureRef.current = future;
  const commit = useCallback((next: Snap) => {
    const before = liveBase.current ?? snapRef.current;
    liveBase.current = null;
    setPast((p) => [...p.slice(-99), before]);
    setFuture([]);
    setSnap(next);
  }, []);
  const undo = useCallback(() => {
    const p = pastRef.current;
    if (!p.length) return;
    setFuture([snapRef.current, ...futureRef.current]);
    setPast(p.slice(0, -1));
    setSnap(p[p.length - 1]);
  }, []);
  const redo = useCallback(() => {
    const f = futureRef.current;
    if (!f.length) return;
    setPast([...pastRef.current, snapRef.current]);
    setFuture(f.slice(1));
    setSnap(f[0]);
  }, []);

  // Several layer edits at once (a drag of many, an align): one history step.
  const editMany = useCallback((changes: Record<string, NodeEdit>, final = true) => {
    const cur = snapRef.current;
    const edits = { ...cur.edits };
    for (const [id, e] of Object.entries(changes)) {
      const one = cleanEdits({ [id]: merge(cur.edits[id], e) });
      if (one[id]) edits[id] = one[id]; else delete edits[id];
    }
    const next = { ...cur, edits };
    if (final) commit(next);
    else { liveBase.current ??= cur; setSnap(next); }
  }, [commit]);
  const editLayer = useCallback((id: string, e: NodeEdit, final = true) => editMany({ [id]: e }, final), [editMany]);

  const setSlot = useCallback((name: string, value: string | null) => {
    const cur = snapRef.current;
    if ((cur.slots[name] ?? null) === value) return;
    commit({ ...cur, slots: { ...cur.slots, [name]: value } });
  }, [commit]);

  const select = useCallback((ids: string[], mode: SelectMode) => {
    setSelected((cur) => {
      if (mode === 'replace') return ids;
      const next = [...cur];
      for (const id of ids) { const i = next.indexOf(id); if (i >= 0) next.splice(i, 1); else next.push(id); }
      // Never a component together with something inside it, nor the background with others.
      const bg = comps.find((c) => c.kind === 'background')?.id;
      const clean = next.filter((id) => id !== bg || next.length === 1);
      return clean.filter((id) => !clean.some((o) => o !== id && within(comps, o).includes(id)));
    });
  }, [comps]);

  const one = selected.length === 1 ? comps.find((c) => c.id === selected[0]) ?? null : null;
  const resetIds = (ids: string[]) => {
    const edits = { ...snap.edits };
    const slots = { ...snap.slots };
    for (const c of comps.filter((x) => ids.includes(x.id))) {
      for (const id of [c.id, c.textId, c.iconId]) if (id) delete edits[id];
      for (const k of [c.slot, c.textSlot]) if (k) slots[k] = initial.slots[k] ?? null;
    }
    commit({ edits, slots });
  };

  // Typed on the piece: a slot changes the brief (fit rules apply); other text is a hand edit.
  const typed = (nodeId: string, text: string) => {
    const c = comps.find((x) => x.id === nodeId) ?? comps.find((x) => x.textId === nodeId);
    const slot = c?.id === nodeId ? c.slot : c?.textSlot;
    if (slot) {
      if (!text.trim() && !slotMeta[slot]?.optional) { toast.error('This copy is essential to the piece.'); return false; }
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

  const piece = snap.edits[THEME] ?? {};
  const theme = piece.theme ?? {};
  const swapColor = (from: string, to: string | null) => editLayer(THEME, { theme: { ...theme, [from]: to ?? '' } });
  const setPreset = (p: Preset) => {
    // A theme replaces any loose background colour and colour swaps, so the piece stays coherent.
    const bg = comps.find((c) => c.kind === 'background')?.id;
    const changes: Record<string, NodeEdit> = { [THEME]: { preset: p, theme: Object.fromEntries(Object.keys(theme).map((k) => [k, ''])) } };
    if (bg && snap.edits[bg]?.style?.backgroundColor) changes[bg] = { style: { backgroundColor: undefined } };
    editMany(changes);
  };
  // A background picked by hand moves the theme along when it crosses from dark to light (or back).
  const pickBackground = (id: string, value: string) => {
    const hex = tokens.find((t) => t.value === value)?.hex;
    const changes: Record<string, NodeEdit> = { [id]: { style: { backgroundColor: value } } };
    if (hex) {
      const l = luminance(hex);
      const want: Preset = l > 0.6 ? 'light' : hex === '#013DF5' || hex === '#0000C9' ? 'blue' : 'dark';
      if (want !== (piece.preset ?? null)) changes[THEME] = { preset: want };
    }
    editMany(changes);
  };

  // ---- The fill follows the copy, the images and the icons (debounced round trip) ----
  const planKey = JSON.stringify([snap.slots, Object.values(snap.edits).flatMap((e) => [e.image, e.icon]).filter(Boolean).sort()]);
  const firstKey = useRef(planKey);
  useEffect(() => {
    if (planKey === firstKey.current) { setPlanError(null); return; }
    const t = setTimeout(async () => {
      const r = await prepareAction(pieceId, snapRef.current.slots, snapRef.current.edits);
      if (r.ok) { firstKey.current = planKey; setPlan(r.plan); setPlanError(null); }
      else setPlanError(r.error);
    }, 250);
    return () => clearTimeout(t);
  }, [planKey, pieceId]);

  const refreshInfo = useCallback(() => setInfoTick((t) => t + 1), []);
  useEffect(() => { refreshInfo(); }, [refreshInfo, selected, comps]);

  // ---- Keys ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t?.closest('input, textarea, [contenteditable], [role=dialog], [role=menu]')) return;
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
        editMany(Object.fromEntries(ids.map((id) => { const b = snapRef.current.edits[id]?.box ?? {}; return [id, { box: { dx: (b.dx ?? 0) + d[0], dy: (b.dy ?? 0) + d[1] } }]; })));
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        editMany(Object.fromEntries(ids.filter((id) => comps.find((c) => c.id === id)?.kind !== 'archy').map((id) => [id, { hidden: true }])));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [comps, selected, undo, redo, editMany, vp]);

  useEffect(() => {
    if (!changed) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [changed]);
  const confirmLeave = () => !changed || window.confirm('Leave without saving your changes?');

  const blocked = planError ?? (report && !report.ok ? report.errors.map((e) => e.message ?? e.code).join(' ') : null);

  const download = () => start(async () => {
    const r = await exportAction(pieceId, snap.slots, snap.edits);
    if (!r.ok) { toast.error(r.error); return; }
    window.location.href = r.url;
  });

  const save = (mode: 'version' | 'replace') => start(async () => {
    const r = await saveAction(pieceId, snap.slots, snap.edits, mode);
    if (!r.ok) { toast.error(r.error); return; }
    setSaving(false);
    setSaved(snap);
    if (isNew) { toast.success('Saved to the gallery as a new piece.'); router.replace(`/canvas/${r.id}`); }
    else if (mode === 'version') { toast.success('Saved as a new version. The original is kept.'); router.replace(`/canvas/${r.id}`); }
    else toast.success('The original was replaced.');
  });

  const imageTarget = one && (one.kind === 'photo' || one.kind === 'partner') ? one : null;
  const placeImage = (value: string) => {
    if (!imageTarget) return;
    if (imageTarget.slot) setSlot(imageTarget.slot, value); else editLayer(imageTarget.id, { image: value });
  };
  const pickerImages = library.images.map((a) => ({ id: a.value.slice(6), title: a.title, kind: a.kind, url: a.url }));
  const pct = Math.round(vp.zoom * 100);

  return (
    <div data-fullbleed className="flex h-dvh flex-col bg-[#F5F5F5] text-[13px]">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-foreground/[0.06] bg-background px-3">
        <Link href={backHref} onClick={(e) => { if (!confirmLeave()) e.preventDefault(); }} aria-label="Back to the gallery" title="Back to the gallery" className="flex size-8 items-center justify-center rounded-md text-foreground/60 hover:bg-foreground/[0.05] hover:text-foreground">
          <HugeiconsIcon icon={ArrowLeft02Icon} className="size-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{title}</p>
          <p className="truncate text-[11px] text-foreground/40">{formatLabel} · {plan.width}×{plan.height}{isNew ? ' · New from template' : changed ? ' · Unsaved changes' : ''}</p>
        </div>
        <div className="flex items-center gap-0.5">
          <ToolButton label="Undo (⌘Z)" icon={Undo02Icon} disabled={!past.length} onClick={undo} />
          <ToolButton label="Redo (⇧⌘Z)" icon={Redo02Icon} disabled={!future.length} onClick={redo} />
        </div>
        <button type="button" onClick={download} disabled={busy || !!blocked}
          className="flex h-8 items-center gap-1.5 rounded-md bg-foreground/[0.05] px-3 text-foreground/80 hover:bg-foreground/[0.09] disabled:opacity-50">
          <HugeiconsIcon icon={Download04Icon} className="size-3.5" /> Download
        </button>
        <button type="button" onClick={() => (isNew ? save('version') : setSaving(true))} disabled={busy || !dirty || !!blocked}
          className="flex h-8 items-center rounded-md bg-primary px-3.5 font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
          {isNew ? (busy ? 'Saving…' : 'Save to gallery') : 'Save'}
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <CanvasPanel tab={tab} onTab={setTab}>
          {tab === 'layers' && (
            <LayersPanel comps={comps} edits={snap.edits} selected={selected} hover={hover} onHover={setHover}
              onSelect={(id, add) => select([id], add ? 'toggle' : 'replace')}
              onToggle={(id) => editLayer(id, { hidden: !snap.edits[id]?.hidden })} />
          )}
          {tab === 'library' && <LibraryTab library={library} current={isNew ? undefined : pieceId} confirmLeave={confirmLeave} />}
          {tab === 'assets' && <AssetsTab library={library} target={imageTarget?.id ?? null} onPick={placeImage} />}
          {tab === 'claude' && <ClaudeTab pieceId={isNew ? undefined : pieceId} title={title} />}
        </CanvasPanel>

        <main
          ref={vp.area}
          className={`relative min-w-0 flex-1 overflow-hidden ${vp.panning ? (vp.grabbing ? 'cursor-grabbing' : 'cursor-grab') : ''}`}
          {...vp.handlers}
          onPointerDownCapture={(e) => { if (!vp.panning && !(e.target as Element).closest('[data-stage], [data-toolbar]')) setSelected([]); }}
        >
          <div className="absolute top-0 left-0" style={{ transform: `translate(${vp.pan.x}px, ${vp.pan.y}px)` }}>
            <Stage
              ref={stage}
              plan={plan}
              edits={snap.edits}
              zoom={vp.zoom}
              selected={selected}
              hover={hover}
              comps={comps}
              safe={safe}
              panning={vp.panning}
              onSelect={select}
              onHover={setHover}
              onReady={(r) => { setComps(r.comps); setSafe(r.safe); setTokens(r.tokens); setUsed(r.used); setReport(r.report); }}
              onEdit={editMany}
              onText={typed}
              onInfo={refreshInfo}
            />
          </div>

          {blocked && (
            <div className="absolute top-4 left-1/2 flex max-w-[min(560px,90%)] -translate-x-1/2 items-start gap-2 rounded-lg bg-background px-3.5 py-2.5 shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_8px_24px_-8px_rgba(0,0,0,0.2)]">
              <HugeiconsIcon icon={Alert02Icon} className="mt-px size-4 shrink-0 text-[#D97706]" />
              <p><span className="font-medium">Doesn’t fit yet.</span> <span className="text-foreground/60">{blocked}</span></p>
            </div>
          )}

          {/* Floating toolbar, Relume-like: select / hand, zoom. */}
          <div data-toolbar className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-0.5 rounded-lg bg-background p-1 shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_8px_24px_-8px_rgba(0,0,0,0.2)]">
            <ToolButton label="Select (V)" icon={Cursor01Icon} active={!vp.hand} onClick={() => vp.setHand(false)} />
            <ToolButton label="Hand (H, or hold Space)" icon={HandGrabIcon} active={vp.hand} onClick={() => vp.setHand(true)} />
            <span className="mx-1 h-5 w-px bg-foreground/10" />
            <ToolButton label="Zoom out (⌘−)" icon={MinusSignIcon} onClick={() => vp.zoomTo(vp.zoom / 1.25)} />
            <button type="button" onClick={vp.fit} title="Fit (⌘0)" className="h-7 w-12 rounded-md text-[12px] tabular-nums hover:bg-foreground/[0.06]">{pct}%</button>
            <ToolButton label="Zoom in (⌘+)" icon={PlusSignIcon} onClick={() => vp.zoomTo(vp.zoom * 1.25)} />
          </div>
        </main>

        <aside className="w-[280px] shrink-0 overflow-y-auto border-l border-foreground/[0.06] bg-background [scrollbar-width:thin] max-lg:hidden">
          {selected.length > 1 ? (
            <MultiPanel count={selected.length} onAlign={(a, to) => align(a, to)} onReset={() => resetIds(selected)}
              onHide={() => editMany(Object.fromEntries(selected.filter((id) => comps.find((c) => c.id === id)?.kind !== 'archy').map((id) => [id, { hidden: true }])))} />
          ) : one ? (
            <PropertiesPanel
              key={one.id}
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
            />
          ) : (
            <ColorsPanel used={used} tokens={tokens} theme={theme} onSwap={swapColor} onClear={() => editLayer(THEME, { theme: Object.fromEntries(Object.keys(theme).map((k) => [k, ''])) })} />
          )}
        </aside>
      </div>

      <Dialog open={saving} onOpenChange={setSaving}>
        <DialogContent className="gap-5 rounded-md p-6 text-[13px] sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-[15px] font-medium">Save changes</DialogTitle>
            <DialogDescription className="text-[13px]">Keep the original, or put the edited piece in its place.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <SaveOption title="Save as a new version" text="The original stays in the history. The new one takes its place in the set." onClick={() => save('version')} disabled={busy} primary />
            <SaveOption title="Replace the original" text={canReplace ? 'Same piece and link, with the new image.' : 'Only the person who made it, the project owner or an admin can do this.'} onClick={() => save('replace')} disabled={busy || !canReplace} />
          </div>
          {busy && <p className="text-foreground/50">Rendering the piece…</p>}
        </DialogContent>
      </Dialog>
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
