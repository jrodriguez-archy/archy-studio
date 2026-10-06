'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { LockIcon } from '@hugeicons/core-free-icons';
import type { Edits, FillPlan, NodeEdit, RenderReport, Suggestion } from '@/lib/canvas-shared';
import { movingEdges, snap, type Guide } from './guides';
import { componentAt, innermostAt, parentOf, readInfo, readTokens, within, type Box, type Comp, type LayerInfo, type Token } from './model';

type Win = Window & {
  __fill: (a: unknown) => Promise<RenderReport>;
  __applyEdits: (e: Edits, u: Record<string, string>, i: Record<string, string>) => void;
  __review: (e: Edits, rules: unknown, format: string) => Suggestion[];
  __autofix: (e: Edits, rules: unknown, format: string, u: Record<string, string>, i: Record<string, string>) => Edits;
  __components: () => { comps: Comp[]; safe: Box };
  __alignBox: (id: string) => Box | null;
};

const scripts: Record<string, Promise<string>> = {};
let loads = 0;
const script = (name: string) => (scripts[name] ??= fetch(`/api/template-files/scripts/${name}`).then((r) => r.text()));

export type StageHandle = {
  info: (id: string) => LayerInfo | null;
  /** Where a node sits on the artboard (artboard px). */
  rect: (id: string) => Box | null;
  /** The box a component aligns in: its container without padding, or the safe area. */
  alignBox: (id: string) => Box | null;
  /** The edits with every automatic Inspector fix applied (worked out in the page, several rounds). */
  autofix: (edits: Edits) => Edits | null;
};

export type SelectMode = 'replace' | 'toggle';

type Props = {
  plan: FillPlan;
  edits: Edits;
  zoom: number;
  selected: string[];
  hover: string | null;
  comps: Comp[];
  safe: Box | null;
  /** The hand tool (space held, or chosen): the stage lets the viewport pan. */
  panning: boolean;
  onSelect: (ids: string[], mode: SelectMode) => void;
  onHover: (id: string | null) => void;
  onReady: (r: { comps: Comp[]; safe: Box; tokens: Token[]; report: RenderReport }) => void;
  /** Live changes while dragging (commit=false) and the final ones (commit=true, one history step). */
  onEdit: (changes: Record<string, NodeEdit>, commit: boolean) => void;
  /** Typed in place. False when refused: the page is drawn again as it was. */
  onText: (nodeId: string, text: string) => boolean;
  onInfo: () => void;
  /** The Inspector's suggestions after each change (same review as the server). */
  onReview: (items: Suggestion[]) => void;
};

type Rect = { x: number; y: number; w: number; h: number };
const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const;
type Handle = (typeof HANDLES)[number];
const SNAP_PX = 6; // on screen

type Drag = {
  ids: string[]; handle: Handle | 'move' | 'marquee'; x: number; y: number; moved: boolean; shift?: boolean;
  bases: Record<string, NodeEdit>; box: Box; w: number; h: number; targets: Box[];
};

// The piece itself: the real template page in a same-origin iframe, filled by fit.js, edited by edits.js
// and read by components.js exactly as on the server, under an overlay that selects, moves and resizes.
export const Stage = forwardRef<StageHandle, Props>(function Stage({ plan, edits, zoom, selected, hover, comps, safe, panning, onSelect, onHover, onReady, onEdit, onText, onInfo, onReview }, ref) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [badge, setBadge] = useState<string | null>(null);
  const [marquee, setMarquee] = useState<Rect | null>(null);
  const [outside, setOutside] = useState(false);
  const [, setTick] = useState(0);
  const [nonce, setNonce] = useState(0);
  const redraw = useCallback(() => setTick((t) => t + 1), []);
  const live = useRef({ edits, plan, onReady, onInfo, onReview });
  live.current = { edits, plan, onReady, onInfo, onReview };
  const check = useCallback(() => {
    const w = frame.current?.contentWindow as Win | null;
    if (w?.__review) live.current.onReview(w.__review(live.current.edits, live.current.plan.fill.rules, live.current.plan.format));
  }, []);
  const drag = useRef<Drag | null>(null);

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
    alignBox: (id) => win()?.__alignBox(id) ?? null,
    autofix: (e) => {
      const w = win(), p = live.current.plan;
      return w?.__autofix ? w.__autofix(e, p.fill.rules, p.format, p.imageUrls, p.iconSvgs) : null;
    },
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
      for (const name of ['fit.js', 'edits.js', 'components.js']) {
        const s = d.createElement('script');
        s.textContent = await script(name);
        d.head.appendChild(s);
      }
      await d.fonts.ready;
      const report = await w.__fill(live.current.plan.fill);
      if (stale) return;
      // Tokens and components are read before the hand edits, so they describe the piece as designed.
      const tokens = readTokens(d);
      const { comps, safe } = w.__components();
      w.__applyEdits(live.current.edits, live.current.plan.imageUrls, live.current.plan.iconSvgs);
      await d.fonts.ready;
      setReady(true);
      live.current.onReady({ comps, safe, tokens, report });
      check();
      redraw();
    };
    const onLoad = () => { load().catch((e) => console.error('Canvas could not draw the piece', e)); };
    f.addEventListener('load', onLoad);
    // A new query each load makes the iframe reload; the file itself comes from the CDN and the browser cache.
    f.src = `/api/template-files/${plan.html}?load=${++loads}`;
    return () => { stale = true; f.removeEventListener('load', onLoad); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fillKey, nonce, redraw]);

  useEffect(() => {
    if (!ready) return;
    win()?.__applyEdits(edits, plan.imageUrls, plan.iconSvgs);
    // While dragging, check once the layout settles (the next frame).
    const raf = requestAnimationFrame(check);
    redraw();
    live.current.onInfo();
    return () => cancelAnimationFrame(raf);
  }, [edits, plan.imageUrls, plan.iconSvgs, ready, redraw, check]);

  const screen = (b: Box | null): Rect | null => b && { x: b.x * zoom, y: b.y * zoom, w: b.w * zoom, h: b.h * zoom };
  const union = (bs: Box[]): Box => {
    const x = Math.min(...bs.map((b) => b.x)), y = Math.min(...bs.map((b) => b.y));
    return { x, y, w: Math.max(...bs.map((b) => b.x + b.w)) - x, h: Math.max(...bs.map((b) => b.y + b.h)) - y };
  };
  const local = (e: { clientX: number; clientY: number }) => {
    const box = frame.current!.getBoundingClientRect();
    return { x: (e.clientX - box.left) / zoom, y: (e.clientY - box.top) / zoom };
  };
  const pointAt = (e: { clientX: number; clientY: number }) => {
    const d = doc();
    if (!d || !frame.current) return null;
    const { x, y } = local(e);
    return d.elementsFromPoint(x, y).find((n) => n.closest('[data-node]') && n !== d.body && n !== d.documentElement) ?? null;
  };
  // A click picks the component (or the group whose ground it lands on); ⌘/Ctrl picks straight inside:
  // the text in a tag, an item in a group, like design tools.
  const pick = (e: { clientX: number; clientY: number; metaKey: boolean; ctrlKey: boolean }) => {
    const el = pointAt(e);
    return ((e.metaKey || e.ctrlKey) && innermostAt(el, comps)) || componentAt(el, comps);
  };
  const kindOf = (id: string) => comps.find((c) => c.id === id)?.kind;
  const movable = (id: string) => !!id && !['background'].includes(kindOf(id) ?? 'background');

  const startDrag = (e: React.PointerEvent, ids: string[], handle: Drag['handle']) => {
    const boxes = ids.map(boxOf).filter((b): b is Box => !!b);
    if (handle !== 'marquee' && !boxes.length) return;
    const box = handle === 'marquee' ? { ...local(e), w: 0, h: 0 } : union(boxes);
    const bases = Object.fromEntries(ids.map((id) => [id, edits[id] ?? {}]));
    const scale = ids.length === 1 ? bases[ids[0]].box?.scale ?? 1 : 1;
    // Snap targets: the artboard, the safe area, every other component outside the moving ones, and
    // where the moving one sits in the design (so it is easy to put back in line).
    const moving = new Set(ids.flatMap((id) => within(comps, id)));
    const nodes = ids.map(el).filter(Boolean) as HTMLElement[];
    const others = comps.filter((c) => {
      const o = el(c.id);
      return !moving.has(c.id) && c.kind !== 'background' && c.kind !== 'group' && o && !nodes.some((n) => n.contains(o) || o.contains(n));
    });
    const original = ids.length === 1 && handle === 'move'
      ? [{ ...box, x: box.x - (bases[ids[0]].box?.dx ?? 0), y: box.y - (bases[ids[0]].box?.dy ?? 0) }] : [];
    const targets = [{ x: 0, y: 0, w: plan.width, h: plan.height }, ...(safe ? [safe] : []), ...original, ...others.map((c) => boxOf(c.id)).filter((b): b is Box => !!b)];
    drag.current = { ids, handle, x: e.clientX, y: e.clientY, moved: false, bases, box, w: box.w / scale, h: box.h / scale, targets };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };

  const dragTo = (e: React.PointerEvent, final: boolean) => {
    const g = drag.current!;
    let dx = (e.clientX - g.x) / zoom, dy = (e.clientY - g.y) / zoom;

    if (g.handle === 'marquee') {
      const m = { x: Math.min(g.box.x, g.box.x + dx), y: Math.min(g.box.y, g.box.y + dy), w: Math.abs(dx), h: Math.abs(dy) };
      setMarquee(final ? null : { x: m.x * zoom, y: m.y * zoom, w: m.w * zoom, h: m.h * zoom });
      if (final) {
        // Everything the rectangle touches, at the level a click would pick (no groups, no background).
        const hit = comps.filter((c) => {
          if (c.kind === 'background' || c.kind === 'group' || (c.parent && comps.find((p) => p.id === c.parent)?.kind === 'tag')) return false;
          const b = boxOf(c.id);
          return b && b.x < m.x + m.w && b.x + b.w > m.x && b.y < m.y + m.h && b.y + b.h > m.y;
        });
        onSelect(hit.map((c) => c.id), e.shiftKey ? 'toggle' : 'replace');
      }
      return;
    }

    let lines: Guide[] = [];
    const logo = g.ids.length === 1 && kindOf(g.ids[0]) === 'archy';
    if (g.handle === 'move' && e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; } // one axis
    if (!e.metaKey && !logo) {
      const h = g.handle;
      const moved = h === 'move'
        ? { ...g.box, x: g.box.x + dx, y: g.box.y + dy }
        : {
            x: g.box.x + (h.includes('w') ? dx : 0), y: g.box.y + (h.includes('n') ? dy : 0),
            w: g.box.w + (h.includes('e') ? dx : h.includes('w') ? -dx : 0), h: g.box.h + (h.includes('s') ? dy : h.includes('n') ? -dy : 0),
          };
      const s = snap(moved, movingEdges(h), g.targets, SNAP_PX / zoom);
      if (!(g.handle === 'move' && e.shiftKey && !dx)) dx += s.dx;
      if (!(g.handle === 'move' && e.shiftKey && !dy)) dy += s.dy;
      lines = s.guides;
    }
    if (g.handle === 'move') {
      // Never off the artboard.
      dx = Math.min(Math.max(dx, -g.box.x), plan.width - g.box.w - g.box.x);
      dy = Math.min(Math.max(dy, -g.box.y), plan.height - g.box.h - g.box.y);
    }
    const changes: Record<string, NodeEdit> = {};
    if (logo && g.handle !== 'move') {
      // The Archy logo scales from its centre, keeping its proportions.
      const b0 = g.bases[g.ids[0]].box ?? {};
      const grow = ((g.handle.includes('e') ? dx : g.handle.includes('w') ? -dx : 0) + (g.handle.includes('s') ? dy : g.handle.includes('n') ? -dy : 0)) * 2;
      const k = Math.max(0.3, Math.min(3, (b0.scale ?? 1) * (1 + grow / (g.w + g.h))));
      changes[g.ids[0]] = { box: { scale: Math.round(k * 100) / 100 } };
    } else {
      for (const id of g.ids) changes[id] = boxFor({ handle: g.handle, base: g.bases[id], w: g.w, h: g.h }, dx, dy, e.shiftKey);
    }
    onEdit(changes, final);
    setGuides(final ? [] : lines);
    const moved = { ...g.box, x: g.box.x + (g.handle === 'move' ? dx : 0), y: g.box.y + (g.handle === 'move' ? dy : 0) };
    setOutside(!final && !!safe && g.handle === 'move' && (moved.x < safe.x - 1 || moved.y < safe.y - 1 || moved.x + moved.w > safe.x + safe.w + 1 || moved.y + moved.h > safe.y + safe.h + 1));
    const b = changes[g.ids[0]]?.box ?? {};
    setBadge(final ? null : logo && g.handle !== 'move' ? `${Math.round((b.scale ?? 1) * 100)}%` : g.handle === 'move' ? `X ${Math.round(dx)}   Y ${Math.round(dy)}` : `${b.width ?? Math.round(g.w)} × ${b.height ?? Math.round(g.h)}`);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || editing || panning) return;
    const add = e.shiftKey;
    const c = pick(e);
    // Inside the current selection, a drag moves the whole selection.
    const p = local(e);
    const inSel = !add && !(e.metaKey || e.ctrlKey) && selected.some((id) => { const b = boxOf(id); return b && movable(id) && p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h; });
    if (inSel) { startDrag(e, selected.filter(movable), 'move'); return; }
    if (!c || c.kind === 'background') {
      // Empty ground: a click selects the background, a drag draws a selection rectangle.
      if (!add) onSelect(c ? [c.id] : [], 'replace');
      startDrag(e, [], 'marquee');
      return;
    }
    onSelect([c.id], add ? 'toggle' : 'replace');
    if (!add) startDrag(e, [c.id], 'move');
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const g = drag.current;
    if (!g) { if (!panning) onHover(pick(e)?.id ?? null); return; }
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
    setMarquee(null);
    setOutside(false);
  };

  // Double-click a text (or a button's label) to type in place.
  const onDoubleClick = (e: React.MouseEvent) => {
    const c = innermostAt(pointAt(e), comps);
    const nodeId = c?.kind === 'text' ? c.id : c?.kind === 'button' ? c.textId : undefined;
    if (!c || !nodeId) return;
    const n = el(nodeId)!;
    const d = doc()!;
    onSelect([c.id], 'replace');
    onHover(null);
    setEditing(nodeId);
    // Typing in place should feel like a design tool: no browser focus ring, a soft text highlight,
    // and the caret where the double-click landed (not everything selected).
    if (!d.getElementById('canvas-editing')) {
      const st = d.createElement('style');
      st.id = 'canvas-editing';
      st.textContent = '[data-canvas-editing]{outline:none!important}[data-canvas-editing]::selection{background:rgba(0,149,255,.7);color:#fff}';
      d.head.appendChild(st);
    }
    n.dataset.canvasEditing = '';
    n.style.caretColor = getComputedStyle(n).color;
    n.contentEditable = 'plaintext-only';
    n.focus({ preventScroll: true });
    const { x, y } = local(e);
    const range = d.caretRangeFromPoint?.(x, y) ?? null;
    const sel = win()!.getSelection()!;
    sel.removeAllRanges();
    if (range && n.contains(range.startContainer)) sel.addRange(range);
    else { const end = d.createRange(); end.selectNodeContents(n); end.collapse(false); sel.addRange(end); }
    const onInput = () => redraw();
    const done = (save: boolean) => {
      n.removeEventListener('blur', onBlur);
      n.removeEventListener('keydown', onKey);
      n.removeEventListener('input', onInput);
      n.removeAttribute('contenteditable');
      delete n.dataset.canvasEditing;
      n.style.removeProperty('caret-color');
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
    n.addEventListener('input', onInput);
  };

  const sel = ready ? selected.filter((id) => kindOf(id) !== 'background').map((id) => ({ id, r: screen(boxOf(id)) })).filter((s) => s.r) as { id: string; r: Rect }[] : [];
  const single = sel.length === 1 ? sel[0] : null;
  const logo = single && kindOf(single.id) === 'archy';
  const group = sel.length > 1 ? screen(union(sel.map((s) => ({ x: s.r.x / zoom, y: s.r.y / zoom, w: s.r.w / zoom, h: s.r.h / zoom })))) : null;
  const hovComp = comps.find((c) => c.id === hover);
  const hov = ready && hovComp && hovComp.kind !== 'background' && !selected.includes(hovComp.id) && !drag.current ? screen(boxOf(hover)) : null;
  // The group around what is hovered, faint, so its container is easy to see (and pick).
  const ctxComp = ready && !drag.current ? parentOf(comps, hover) : null;
  const ctx = ctxComp && !selected.includes(ctxComp.id) ? screen(boxOf(ctxComp.id)) : null;
  // Texts hug their copy: only their width is pulled; the logo only scales from its corners.
  const handles: readonly Handle[] = logo ? ['nw', 'ne', 'se', 'sw'] : single && kindOf(single.id) === 'text' ? ['e', 'w'] : HANDLES;
  // While typing, one thin frame around the text being edited, nothing else.
  const frameBox = editing ? null : (single ?? (group ? { r: group } : null))?.r;
  const editBox = editing && ready ? screen(boxOf(editing)) : null;
  const safeR = screen(safe);

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
        className={`absolute inset-0 ${editing || panning ? 'pointer-events-none' : 'cursor-default'}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => onHover(null)}
        onDoubleClick={onDoubleClick}
      >
        {/* The safe area shows while something moves; red when the piece leaves it. */}
        {safeR && badge && <div className={`pointer-events-none absolute border border-dashed ${outside ? 'border-[#F2385A]' : 'border-primary/40'}`} style={{ left: safeR.x, top: safeR.y, width: safeR.w, height: safeR.h }} />}
        {ctx && <div className="pointer-events-none absolute outline-1 outline-offset-0 outline-dashed outline-primary/35" style={{ left: ctx.x, top: ctx.y, width: ctx.w, height: ctx.h }}><Tag right>{ctxComp!.name}</Tag></div>}
        {hov && (
          <div className={`pointer-events-none absolute ${hovComp?.kind === 'group' ? 'bg-primary/[0.04] outline-1 outline-dashed outline-primary/70' : 'ring-1 ring-primary/60'}`} style={{ left: hov.x, top: hov.y, width: hov.w, height: hov.h }}>
            {hovComp?.kind === 'archy' ? <Tag icon>Archy logo · move and scale only</Tag> : hovComp?.kind === 'group' && <Tag>{hovComp.name}</Tag>}
          </div>
        )}
        {sel.length > 1 && sel.map((s) => <div key={s.id} className="pointer-events-none absolute ring-1 ring-primary" style={{ left: s.r.x, top: s.r.y, width: s.r.w, height: s.r.h }} />)}
        {frameBox && (
          <div className={`pointer-events-none absolute ${sel.length > 1 ? 'ring-1 ring-primary/50 ring-offset-0' : 'ring-[1.5px] ring-primary'}`} style={{ left: frameBox.x, top: frameBox.y, width: frameBox.w, height: frameBox.h }}>
            {single && !editing && handles.map((h) => (
              <span
                key={h}
                onPointerDown={(e) => { e.stopPropagation(); startDrag(e, [single.id], h); }}
                className="pointer-events-auto absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-[2px] border border-primary bg-white"
                style={{ left: h.includes('w') ? 0 : h.includes('e') ? '100%' : '50%', top: h.includes('n') ? 0 : h.includes('s') ? '100%' : '50%', cursor: `${h}-resize` }}
              />
            ))}
            {logo && !badge && <Tag icon>Archy logo · move and scale only</Tag>}
            {sel.length > 1 && !badge && <Tag>{sel.length} selected</Tag>}
            {badge && <span className={`absolute top-full left-1/2 mt-1.5 -translate-x-1/2 rounded-[4px] px-1.5 py-0.5 text-[10px] font-medium whitespace-pre text-white tabular-nums ${outside ? 'bg-[#F2385A]' : 'bg-primary'}`}>{outside ? `${badge}   Outside the safe area` : badge}</span>}
          </div>
        )}
        {editBox && <div className="pointer-events-none absolute ring-1 ring-primary" style={{ left: editBox.x, top: editBox.y, width: editBox.w, height: editBox.h }} />}
        {marquee && <div className="pointer-events-none absolute border border-primary bg-primary/10" style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h }} />}
        {guides.map((g, i) => (
          <div key={i} className="pointer-events-none absolute bg-[#F2385A]"
            style={g.axis === 'x' ? { left: g.at * zoom, top: g.from * zoom, width: 1, height: (g.to - g.from) * zoom } : { top: g.at * zoom, left: g.from * zoom, height: 1, width: (g.to - g.from) * zoom }} />
        ))}
      </div>
    </div>
  );
});

function Tag({ icon, right, children }: { icon?: boolean; right?: boolean; children: React.ReactNode }) {
  return (
    <span className={`absolute -top-6 ${right ? 'right-0 opacity-70' : 'left-0'} flex items-center gap-1 rounded-[4px] bg-foreground px-1.5 py-0.5 text-[10px] whitespace-nowrap text-background`}>
      {icon && <HugeiconsIcon icon={LockIcon} className="size-3" strokeWidth={2} />} {children}
    </span>
  );
}

// The box edit for a drag: move adds to the offset; a handle changes the size and, from the left or top,
// moves the layer so the opposite edge stays put. Shift on a corner keeps the proportions.
function boxFor(g: { handle: Handle | 'move' | 'marquee'; base: NodeEdit; w: number; h: number }, dx: number, dy: number, keep: boolean): NodeEdit {
  const b = g.base.box ?? {};
  const x0 = b.dx ?? 0, y0 = b.dy ?? 0;
  if (g.handle === 'move' || g.handle === 'marquee') return { box: { dx: Math.round(x0 + dx), dy: Math.round(y0 + dy) } };
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
