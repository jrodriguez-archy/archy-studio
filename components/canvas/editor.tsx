'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { HugeiconsIcon } from '@hugeicons/react';
import { Alert02Icon, ArrowLeft02Icon, Download04Icon, MinusSignIcon, PlusSignIcon, Redo02Icon, Undo02Icon } from '@hugeicons/core-free-icons';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { exportAction, prepareAction, saveAction } from '@/app/(app)/canvas/actions';
import { THEME, cleanEdits, type Edits, type FillPlan, type NodeEdit, type RenderReport } from '@/lib/canvas-shared';
import { ComponentsPanel } from './components-panel';
import { merge, type Comp, type Token } from './model';
import { ColorsPanel, PropertiesPanel, type Align, type LibraryItem, type SlotMeta } from './properties-panel';
import { Stage, type StageHandle } from './stage';

type Snap = { slots: Record<string, string | null>; edits: Edits };
type Props = {
  pieceId: string; title: string; formatLabel: string; backHref: string; canReplace: boolean;
  initial: Snap; plan: FillPlan; slotMeta: Record<string, SlotMeta>; library: LibraryItem[];
};

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// Canvas: the piece in the middle, its components on the left, the selected one's properties on the
// right. Copy and slot images change the brief (the fit rules still apply); everything else is a hand
// edit kept with the piece. Save renders it again with the same engine as Claude's pieces.
export function CanvasEditor({ pieceId, title, formatLabel, backHref, canReplace, initial, plan: firstPlan, slotMeta, library }: Props) {
  const router = useRouter();
  const [snap, setSnap] = useState<Snap>(initial);
  const [past, setPast] = useState<Snap[]>([]);
  const [future, setFuture] = useState<Snap[]>([]);
  const [saved, setSaved] = useState<Snap>(initial);
  const liveBase = useRef<Snap | null>(null);

  const [plan, setPlan] = useState(firstPlan);
  const [planError, setPlanError] = useState<string | null>(null);
  const [comps, setComps] = useState<Comp[]>([]);
  const [used, setUsed] = useState<string[]>([]);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [report, setReport] = useState<RenderReport | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [, setInfoTick] = useState(0);
  const stage = useRef<StageHandle>(null);

  const [zoomMode, setZoomMode] = useState<'fit' | number>('fit');
  const [fit, setFit] = useState(0.5);
  const area = useRef<HTMLDivElement>(null);
  const zoom = zoomMode === 'fit' ? fit : zoomMode;

  const [saving, setSaving] = useState(false);
  const [busy, start] = useTransition();
  const dirty = !same(cleanSnap(snap), cleanSnap(saved));

  // ---- History ----
  const commit = useCallback((next: Snap) => {
    const before = liveBase.current ?? snapRef.current;
    liveBase.current = null;
    setPast((p) => [...p.slice(-99), before]);
    setFuture([]);
    setSnap(next);
  }, []);
  const snapRef = useRef(snap);
  snapRef.current = snap;
  const pastRef = useRef(past);
  pastRef.current = past;
  const futureRef = useRef(future);
  futureRef.current = future;
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

  const editLayer = useCallback((id: string, e: NodeEdit, final = true) => {
    const cur = snapRef.current;
    const one = cleanEdits({ [id]: merge(cur.edits[id], e) });
    const edits = { ...cur.edits };
    if (one[id]) edits[id] = one[id]; else delete edits[id];
    const next = { ...cur, edits };
    if (final) commit(next);
    else { liveBase.current ??= cur; setSnap(next); }
  }, [commit]);

  const setSlot = useCallback((name: string, value: string | null) => {
    const cur = snapRef.current;
    if ((cur.slots[name] ?? null) === value) return;
    commit({ ...cur, slots: { ...cur.slots, [name]: value } });
  }, [commit]);

  const comp = comps.find((c) => c.id === selected) ?? null;
  const resetComp = () => {
    if (!comp) return;
    const edits = { ...snap.edits };
    for (const id of [comp.id, comp.textId, comp.iconId]) if (id) delete edits[id];
    const slots = { ...snap.slots };
    for (const k of [comp.slot, comp.textSlot]) if (k) slots[k] = initial.slots[k] ?? null;
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

  // Align on the artboard: the offset that puts the component's box at the edge or in the middle.
  const align = (a: Align) => {
    if (!comp) return;
    const r = stage.current?.rect(comp.id);
    if (!r) return;
    const b = snap.edits[comp.id]?.box ?? {};
    const dx = b.dx ?? 0, dy = b.dy ?? 0;
    const move = {
      left: { dx: dx - r.x }, center: { dx: dx + (plan.width - r.w) / 2 - r.x }, right: { dx: dx + plan.width - r.w - r.x },
      top: { dy: dy - r.y }, middle: { dy: dy + (plan.height - r.h) / 2 - r.y }, bottom: { dy: dy + plan.height - r.h - r.y },
    }[a];
    editLayer(comp.id, { box: Object.fromEntries(Object.entries(move).map(([k, v]) => [k, Math.round(v)])) });
  };

  const theme = snap.edits[THEME]?.theme ?? {};
  const swapColor = (from: string, to: string | null) => editLayer(THEME, { theme: { ...theme, [from]: to ?? '' } });

  // ---- The fill follows the copy and the images (debounced round trip for variant, limits, URLs) ----
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

  // ---- Zoom to fit the area ----
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const { width, height } = el.getBoundingClientRect();
      setFit(Math.max(0.05, Math.min((width - 96) / plan.width, (height - 96) / plan.height, 1)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [plan.width, plan.height]);

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
      if (e.key === 'Escape') setSelected(null);
      const l = comps.find((x) => x.id === selected);
      if (!l || l.kind === 'background' || l.kind === 'archy') return;
      const step = e.shiftKey ? 10 : 1;
      const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
      if (d) {
        e.preventDefault();
        const b = snapRef.current.edits[l.id]?.box ?? {};
        editLayer(l.id, { box: { dx: (b.dx ?? 0) + d[0], dy: (b.dy ?? 0) + d[1] } });
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        editLayer(l.id, { hidden: true });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [comps, selected, undo, redo, editLayer]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

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
    if (mode === 'version') {
      toast.success('Saved as a new version. The original is kept.');
      router.replace(`/canvas/${r.id}`);
    } else toast.success('The original was replaced.');
  });

  const pct = Math.round(zoom * 100);
  const zoomTo = (z: number) => setZoomMode(Math.min(4, Math.max(0.1, z)));

  return (
    <div data-fullbleed className="flex h-dvh flex-col bg-[#F5F5F5] text-[13px]">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-foreground/[0.06] bg-background px-3">
        <Link href={backHref} aria-label="Back to the gallery" title="Back to the gallery" className="flex size-8 items-center justify-center rounded-md text-foreground/60 hover:bg-foreground/[0.05] hover:text-foreground">
          <HugeiconsIcon icon={ArrowLeft02Icon} className="size-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{title}</p>
          <p className="truncate text-[11px] text-foreground/40">{formatLabel} · {plan.width}×{plan.height}{dirty ? ' · Unsaved changes' : ''}</p>
        </div>
        <div className="flex items-center gap-0.5">
          <ToolButton label="Undo (⌘Z)" icon={Undo02Icon} disabled={!past.length} onClick={undo} />
          <ToolButton label="Redo (⇧⌘Z)" icon={Redo02Icon} disabled={!future.length} onClick={redo} />
        </div>
        <div className="flex h-7 items-center rounded-[5px] bg-foreground/[0.05] p-0.5">
          <ToolButton small label="Zoom out" icon={MinusSignIcon} onClick={() => zoomTo(zoom / 1.25)} />
          <button type="button" onClick={() => setZoomMode('fit')} title="Fit" className={`h-6 w-12 rounded-[4px] text-[12px] tabular-nums ${zoomMode === 'fit' ? 'bg-background font-medium shadow-[0_0_0_1px_rgba(0,0,0,0.06)]' : 'text-foreground/60'}`}>{pct}%</button>
          <ToolButton small label="Zoom in" icon={PlusSignIcon} onClick={() => zoomTo(zoom * 1.25)} />
        </div>
        <button type="button" onClick={download} disabled={busy || !!blocked}
          className="flex h-8 items-center gap-1.5 rounded-md bg-foreground/[0.05] px-3 text-foreground/80 hover:bg-foreground/[0.09] disabled:opacity-50">
          <HugeiconsIcon icon={Download04Icon} className="size-3.5" /> Download
        </button>
        <button type="button" onClick={() => setSaving(true)} disabled={busy || !dirty || !!blocked}
          className="flex h-8 items-center rounded-md bg-primary px-3.5 font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
          Save
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="w-[240px] shrink-0 overflow-y-auto border-r border-foreground/[0.06] bg-background [scrollbar-width:thin] max-md:hidden">
          <ComponentsPanel comps={comps} edits={snap.edits} selected={selected} onSelect={setSelected}
            onToggle={(id) => editLayer(id, { hidden: !snap.edits[id]?.hidden })} />
        </aside>

        <main ref={area} className="relative flex min-w-0 flex-1 items-center justify-center overflow-auto" onPointerDown={(e) => !(e.target as Element).closest('[data-stage]') && setSelected(null)}>
          <div className="m-auto p-12">
            <Stage
              ref={stage}
              plan={plan}
              edits={snap.edits}
              zoom={zoom}
              selected={selected}
              comps={comps}
              onSelect={setSelected}
              onReady={(r) => { setComps(r.comps); setTokens(r.tokens); setUsed(r.used); setReport(r.report); }}
              onEdit={editLayer}
              onText={typed}
              onInfo={refreshInfo}
            />
          </div>
          {blocked && (
            <div className="absolute bottom-4 left-1/2 flex max-w-[min(560px,90%)] -translate-x-1/2 items-start gap-2 rounded-lg bg-background px-3.5 py-2.5 shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_8px_24px_-8px_rgba(0,0,0,0.2)]">
              <HugeiconsIcon icon={Alert02Icon} className="mt-px size-4 shrink-0 text-[#D97706]" />
              <p><span className="font-medium">Doesn’t fit yet.</span> <span className="text-foreground/60">{blocked}</span></p>
            </div>
          )}
        </main>

        <aside className="w-[280px] shrink-0 overflow-y-auto border-l border-foreground/[0.06] bg-background [scrollbar-width:thin] max-lg:hidden">
          {comp ? (
            <PropertiesPanel
              key={comp.id}
              comp={comp}
              info={(id) => (id ? stage.current?.info(id) ?? null : null)}
              edits={snap.edits}
              slots={snap.slots}
              slotMeta={slotMeta}
              previews={plan.fill.values}
              tokens={tokens}
              library={library}
              onEdit={(id, e, final = true) => editLayer(id, e, final)}
              onSlot={setSlot}
              onReset={resetComp}
              onAlign={align}
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

const cleanSnap = (s: Snap) => ({ slots: s.slots, edits: cleanEdits(s.edits) });

function ToolButton({ label, icon, onClick, disabled, small }: { label: string; icon: typeof Undo02Icon; onClick: () => void; disabled?: boolean; small?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label}
      className={`flex items-center justify-center rounded-md text-foreground/60 transition-colors hover:bg-foreground/[0.06] hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent ${small ? 'size-6' : 'size-8'}`}>
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

