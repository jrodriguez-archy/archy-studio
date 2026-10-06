'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { LockIcon } from '@hugeicons/core-free-icons';
import type { Edits, FillPlan, NodeEdit, RenderReport } from '@/lib/canvas-shared';
import { movingEdges, snap, type Box, type Guide } from './guides';
import { componentAt, innermostAt, readComponents, readInfo, readTokens, readUsedColors, type Comp, type LayerInfo, type Token } from './model';

type Win = Window & {
  __fill: (a: unknown) => Promise<RenderReport>;
  __applyEdits: (e: Edits, u: Record<string, string>, i: Record<string, string>) => void;
};

const scripts: Record<string, Promise<string>> = {};
const script = (name: string) => (scripts[name] ??= fetch(`/api/template-files/scripts/${name}`).then((r) => r.text()));

export type StageHandle = {
  info: (id: string) => LayerInfo | null;
  /** Where a node sits on the artboard (artboard px). */
  rect: (id: string) => Box | null;
};

type Props = {
  plan: FillPlan;
  edits: Edits;
  zoom: number;
  selected: string | null;
  comps: Comp[];
  onSelect: (id: string | null) => void;
  onReady: (r: { comps: Comp[]; tokens: Token[]; used: string[]; report: RenderReport }) => void;
  /** Live change while dragging (commit=false) and the final one (commit=true, goes in history). */
  onEdit: (id: string, e: NodeEdit, commit: boolean) => void;
  /** Typed in place. False when refused: the page is drawn again as it was. */
  onText: (nodeId: string, text: string) => boolean;
  onInfo: () => void;
};

type Rect = { x: number; y: number; w: number; h: number };
const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const;
type Handle = (typeof HANDLES)[number];
const SNAP_PX = 6; // on screen

// The piece itself: the real template page in a same-origin iframe, filled by fit.js and edited by
// edits.js exactly as the renderer does, under an overlay that selects, moves and resizes components.
export const Stage = forwardRef<StageHandle, Props>(function Stage({ plan, edits, zoom, selected, comps, onSelect, onReady, onEdit, onText, onInfo }, ref) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [badge, setBadge] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const [nonce, setNonce] = useState(0);
  const redraw = useCallback(() => setTick((t) => t + 1), []);
  const live = useRef({ edits, plan, onReady, onInfo });
  live.current = { edits, plan, onReady, onInfo };
  const drag = useRef<{ id: string; handle: Handle | 'move'; x: number; y: number; base: NodeEdit; w: number; h: number; box: Box; targets: Box[]; moved: boolean } | null>(null);

  const doc = () => frame.current?.contentDocument ?? null;
  const win = () => frame.current?.contentWindow as Win | null;
  const root = () => doc()?.querySelector('body > [data-node]') ?? null;
  const el = useCallback((id: string | null) => (id ? doc()?.querySelector<HTMLElement>(`[data-node="${CSS.escape(id)}"]`) ?? null : null), []);
  const boxOf = useCallback((id: string | null): Box | null => {
    const n = el(id), r0 = root()?.getBoundingClientRect();
    if (!n || !r0 || !n.isConnected) return null;
    const r = n.getBoundingClientRect();
    if (!r.width && !r.height) return null;
    return { x: r.left - r0.left, y: r.top - r0.top, w: r.width, h: r.height };
  }, [el]);

  useImperativeHandle(ref, () => ({
    info: (id) => { const n = el(id); return n ? readInfo(n, live.current.edits[id]?.box?.scale ?? 1) : null; },
    rect: boxOf,
  }), [el, boxOf]);

  // A new fill (copy, slot image, variant) reloads the page; edits alone are re-applied in place.
  const fillKey = JSON.stringify([plan.html, plan.fill]);
  useEffect(() => {
    setReady(false);
    setEditing(null);
    const f = frame.current;
    if (!f) return;
    let stale = false;
    const load = async () => {
      const d = f.contentDocument!, w = f.contentWindow as Win;
      for (const name of ['fit.js', 'edits.js']) {
        const s = d.createElement('script');
        s.textContent = await script(name);
        d.head.appendChild(s);
      }
      await d.fonts.ready;
      const report = await w.__fill(live.current.plan.fill);
      if (stale) return;
      // Colours and components are read before the hand edits, so they describe the piece as designed.
      const tokens = readTokens(d);
      const used = readUsedColors(d, tokens);
      const comps = readComponents(d);
      w.__applyEdits(live.current.edits, live.current.plan.imageUrls, live.current.plan.iconSvgs);
      await d.fonts.ready;
      setReady(true);
      live.current.onReady({ comps, tokens, used, report });
      redraw();
    };
    const onLoad = () => { load().catch((e) => console.error('Canvas could not draw the piece', e)); };
    f.addEventListener('load', onLoad);
    f.src = `/api/template-files/${plan.html}?t=${Date.now()}`;
    return () => { stale = true; f.removeEventListener('load', onLoad); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fillKey, nonce, redraw]);

  useEffect(() => {
    if (!ready) return;
    win()?.__applyEdits(edits, plan.imageUrls, plan.iconSvgs);
    redraw();
    live.current.onInfo();
  }, [edits, plan.imageUrls, plan.iconSvgs, ready, redraw]);

  const screen = (b: Box | null): Rect | null => b && { x: b.x * zoom, y: b.y * zoom, w: b.w * zoom, h: b.h * zoom };

  const pointAt = (e: React.PointerEvent | React.MouseEvent) => {
    const d = doc(), box = frame.current?.getBoundingClientRect();
    if (!d || !box) return null;
    const x = (e.clientX - box.left) / zoom, y = (e.clientY - box.top) / zoom;
    return d.elementsFromPoint(x, y).find((n) => n.closest('[data-node]') && n !== d.body && n !== d.documentElement) ?? null;
  };
  const hit = (e: React.PointerEvent | React.MouseEvent) => componentAt(pointAt(e), comps);

  const startDrag = (e: React.PointerEvent, id: string, handle: Handle | 'move') => {
    const n = el(id), box = boxOf(id);
    if (!n || !box) return;
    const base = edits[id] ?? {};
    const scale = base.box?.scale ?? 1;
    // Snap targets: the artboard and every other visible component that is not inside this one.
    const art = { x: 0, y: 0, w: plan.width, h: plan.height };
    const others = comps.filter((c) => {
      const o = el(c.id);
      return c.id !== id && c.kind !== 'background' && o && !n.contains(o) && !o.contains(n);
    });
    const targets = [art, ...others.map((c) => boxOf(c.id)).filter((b): b is Box => !!b)];
    drag.current = { id, handle, x: e.clientX, y: e.clientY, base, w: box.w / scale, h: box.h / scale, box, targets, moved: false };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };

  const dragTo = (e: React.PointerEvent, final: boolean) => {
    const g = drag.current!;
    let dx = (e.clientX - g.x) / zoom, dy = (e.clientY - g.y) / zoom;
    let lines: Guide[] = [];
    if (!e.metaKey) {
      const h = g.handle;
      const moved = h === 'move'
        ? { ...g.box, x: g.box.x + dx, y: g.box.y + dy }
        : {
            x: g.box.x + (h.includes('w') ? dx : 0), y: g.box.y + (h.includes('n') ? dy : 0),
            w: g.box.w + (h.includes('e') ? dx : h.includes('w') ? -dx : 0), h: g.box.h + (h.includes('s') ? dy : h.includes('n') ? -dy : 0),
          };
      const s = snap(moved, movingEdges(h), g.targets, SNAP_PX / zoom);
      dx += s.dx; dy += s.dy; lines = s.guides;
    }
    const edit = boxFor(g, dx, dy, e.shiftKey);
    onEdit(g.id, edit, final);
    setGuides(final ? [] : lines);
    const b = edit.box ?? {};
    setBadge(final ? null : g.handle === 'move' ? `X ${b.dx ?? 0}   Y ${b.dy ?? 0}` : `${b.width ?? Math.round(g.w)} × ${b.height ?? Math.round(g.h)}`);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || editing) return;
    const c = hit(e);
    // Inside the current selection, a drag moves the selection (a button keeps its label).
    const current = comps.find((k) => k.id === selected);
    const sel = current && current.kind !== 'background' ? screen(boxOf(current.id)) : null;
    const box = frame.current!.getBoundingClientRect();
    const x = e.clientX - box.left, y = e.clientY - box.top;
    const inSel = sel && x >= sel.x && x <= sel.x + sel.w && y >= sel.y && y <= sel.y + sel.h;
    const target = inSel ? current! : c;
    onSelect(target?.id ?? null);
    if (target && target.kind !== 'background' && target.kind !== 'archy') startDrag(e, target.id, 'move');
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const g = drag.current;
    if (!g) { setHover(hit(e)?.id ?? null); return; }
    if (!g.moved && Math.abs(e.clientX - g.x) + Math.abs(e.clientY - g.y) < 3) return;
    g.moved = true;
    dragTo(e, false);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const g = drag.current;
    if (g?.moved) dragTo(e, true);
    drag.current = null;
    setGuides([]);
    setBadge(null);
  };

  // Double-click a text (or a button's label) to type in place.
  const onDoubleClick = (e: React.MouseEvent) => {
    const c = innermostAt(pointAt(e), comps);
    const nodeId = c?.kind === 'text' ? c.id : c?.kind === 'button' ? c.textId : undefined;
    if (!c || !nodeId) return;
    const n = el(nodeId)!;
    onSelect(c.id);
    setEditing(nodeId);
    n.contentEditable = 'plaintext-only';
    n.focus();
    const range = doc()!.createRange();
    range.selectNodeContents(n);
    const sel = win()!.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(range);
    const done = (save: boolean) => {
      n.removeEventListener('blur', onBlur);
      n.removeEventListener('keydown', onKey);
      n.removeAttribute('contenteditable');
      setEditing(null);
      if (!save || !onText(nodeId, n.textContent ?? '')) setNonce((x) => x + 1);
    };
    const onBlur = () => done(true);
    const onKey = (k: KeyboardEvent) => {
      if (k.key === 'Escape') { k.preventDefault(); done(false); }
      else if (k.key === 'Enter' && !k.shiftKey) { k.preventDefault(); done(true); }
      redraw();
    };
    n.addEventListener('blur', onBlur);
    n.addEventListener('keydown', onKey);
  };

  const selComp = comps.find((c) => c.id === selected);
  const sel = ready && selComp && selComp.kind !== 'background' ? screen(boxOf(selected)) : null;
  const hovComp = comps.find((c) => c.id === hover);
  const hov = ready && hovComp && hovComp.kind !== 'background' && hover !== selected && !drag.current ? screen(boxOf(hover)) : null;
  const locked = selComp?.kind === 'archy';

  return (
    <div data-stage className="relative shrink-0 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_24px_60px_-24px_rgba(0,0,0,0.35)]" style={{ width: plan.width * zoom, height: plan.height * zoom }}>
      <iframe
        ref={frame}
        title="Piece"
        className={`absolute top-0 left-0 origin-top-left border-0 bg-white transition-opacity duration-150 ${ready ? 'opacity-100' : 'opacity-0'}`}
        style={{ width: plan.width, height: plan.height, transform: `scale(${zoom})` }}
      />
      {!ready && <div className="absolute inset-0 animate-pulse bg-foreground/[0.04]" />}
      <div
        className={`absolute inset-0 ${editing ? 'pointer-events-none' : 'cursor-default'}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => setHover(null)}
        onDoubleClick={onDoubleClick}
      >
        {hov && (
          <div className="pointer-events-none absolute ring-1 ring-primary/60" style={{ left: hov.x, top: hov.y, width: hov.w, height: hov.h }}>
            {hovComp?.kind === 'archy' && <LockBadge />}
          </div>
        )}
        {sel && (
          <div className={`pointer-events-none absolute ring-[1.5px] ${locked ? 'ring-foreground/40' : 'ring-primary'}`} style={{ left: sel.x, top: sel.y, width: sel.w, height: sel.h }}>
            {locked ? <LockBadge /> : !editing && HANDLES.map((h) => (
              <span
                key={h}
                onPointerDown={(e) => { e.stopPropagation(); if (selected) startDrag(e, selected, h); }}
                className="pointer-events-auto absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-[2px] border border-primary bg-white"
                style={{ left: h.includes('w') ? 0 : h.includes('e') ? '100%' : '50%', top: h.includes('n') ? 0 : h.includes('s') ? '100%' : '50%', cursor: `${h}-resize` }}
              />
            ))}
            {badge && <span className="absolute top-full left-1/2 mt-1.5 -translate-x-1/2 rounded-[4px] bg-primary px-1.5 py-0.5 text-[10px] font-medium whitespace-pre text-white tabular-nums">{badge}</span>}
          </div>
        )}
        {guides.map((g, i) => (
          <div key={i} className="pointer-events-none absolute bg-[#F2385A]"
            style={g.axis === 'x' ? { left: g.at * zoom, top: g.from * zoom, width: 1, height: (g.to - g.from) * zoom } : { top: g.at * zoom, left: g.from * zoom, height: 1, width: (g.to - g.from) * zoom }} />
        ))}
      </div>
    </div>
  );
});

function LockBadge() {
  return (
    <span className="absolute -top-6 left-0 flex items-center gap-1 rounded-[4px] bg-foreground px-1.5 py-0.5 text-[10px] whitespace-nowrap text-background">
      <HugeiconsIcon icon={LockIcon} className="size-3" strokeWidth={2} /> Archy logo is locked
    </span>
  );
}

// The box edit for a drag: move adds to the offset; a handle changes the size and, from the left or top,
// moves the layer so the opposite edge stays put. Shift on a corner keeps the proportions.
function boxFor(g: { handle: Handle | 'move'; base: NodeEdit; w: number; h: number }, dx: number, dy: number, keep: boolean): NodeEdit {
  const b = g.base.box ?? {};
  const x0 = b.dx ?? 0, y0 = b.dy ?? 0;
  if (g.handle === 'move') return { box: { dx: Math.round(x0 + dx), dy: Math.round(y0 + dy) } };
  const s = b.scale ?? 1;
  const h = g.handle;
  let w = g.w, ht = g.h;
  if (h.includes('e')) w = g.w + dx / s;
  if (h.includes('w')) w = g.w - dx / s;
  if (h.includes('s')) ht = g.h + dy / s;
  if (h.includes('n')) ht = g.h - dy / s;
  if (keep && h.length === 2) {
    const k = Math.max(w / g.w, ht / g.h);
    w = g.w * k; ht = g.h * k;
  }
  w = Math.max(4, Math.round(w)); ht = Math.max(4, Math.round(ht));
  const box: NonNullable<NodeEdit['box']> = {};
  if (h !== 'n' && h !== 's') box.width = w;
  if (h !== 'e' && h !== 'w') box.height = ht;
  if (h.includes('w')) box.dx = Math.round(x0 + (g.w - w) * s);
  if (h.includes('n')) box.dy = Math.round(y0 + (g.h - ht) * s);
  return { box };
}
