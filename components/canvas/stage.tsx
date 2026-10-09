'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { LockIcon } from '@hugeicons/core-free-icons';
import { toast } from 'sonner';
import type { Crop, Edits, FillPlan, NodeEdit, RenderReport, Suggestion } from '@/lib/canvas-shared';
import type { Keys } from '@/lib/canvas-sync';
import { movingEdges, snap, type Guide } from './guides';
import { componentAt, innermostAt, parentOf, readInfo, readTokens, within, type Box, type Comp, type LayerInfo, type Token } from './model';

type Win = Window & {
  __fill: (a: unknown) => Promise<RenderReport>;
  __applyEdits: (e: Edits, u: Record<string, string>, i: Record<string, string>) => void;
  __review: (e: Edits, rules: unknown, format: string) => Suggestion[];
  __autofix: (e: Edits, rules: unknown, format: string, u: Record<string, string>, i: Record<string, string>) => Edits;
  __components: () => { comps: Comp[]; safe: Box };
  __alignBox: (id: string) => Box | null;
  __keys: () => Keys;
  __canCrop: (el: Element) => boolean;
  __cropOf: (el: Element) => Crop | null;
  __photoWindow: (el: Element) => { x: number; y: number; w: number; h: number };
};

/** Asks the Stage showing this photo to start reframing it (the Photo panel's button). */
export const REFRAME_EVENT = 'canvas:reframe';
export const startReframe = (id: string) => window.dispatchEvent(new CustomEvent(REFRAME_EVENT, { detail: id }));

const scripts: Record<string, Promise<string>> = {};
let loads = 0;
// This deploy's copy (a new deploy, a new address: never an old engine from the browser cache).
const BUILD = process.env.NEXT_PUBLIC_BUILD ?? 'dev';
const script = (name: string) => (scripts[name] ??= fetch(`/api/template-files/scripts/${name}?v=${BUILD}`).then((r) => r.text()));
// Formats not being edited draw their first time one after another (the one being edited never waits),
// so opening a set shows the active format first instead of every format at once on one thread.
let busy = 0;
const waiting: (() => void)[] = [];
const turn = () => new Promise<() => void>((done) => {
  const go = () => { busy++; let out = false; done(() => { if (out) return; out = true; busy--; waiting.shift()?.(); }); };
  if (busy < 1) go(); else waiting.push(go);
});

// A template page, fetched once per tab: each redraw writes it into the iframe (no network), and its
// fonts and images resolve against the template's folder and come from the browser cache.
const pages: Record<string, Promise<string>> = {};
const templatePage = (html: string) => (pages[html] ??= fetch(`/api/template-files/${html}?v=${BUILD}`)
  .then((r) => { if (!r.ok) throw new Error(`Template page ${r.status}`); return r.text(); })
  .then((t) => t.replace(/<head([^>]*)>/i, `<head$1><base href="${location.origin}/api/template-files/${html}">`))
  .catch((e) => { delete pages[html]; throw e; })); // a failed fetch is tried again next time

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
  onReady: (r: { comps: Comp[]; safe: Box; tokens: Token[]; report: RenderReport; keys: Keys }) => void;
  /** Live changes while dragging (commit=false) and the final ones (commit=true, one history step). */
  onEdit: (changes: Record<string, NodeEdit>, commit: boolean) => void;
  /** Typed in place. False when refused: the page is drawn again as it was. */
  onText: (nodeId: string, text: string) => boolean;
  onInfo: () => void;
  /** The Inspector's suggestions after each change (same review as the server). */
  onReview: (items: Suggestion[]) => void;
  /** Claude is working on this design (its status), shown on the artboard like a collaborator. */
  claude?: string | null;
  /** Components Claude just changed: they flash. */
  flash?: string[];
  /** Another format of the design, shown live: a click makes it the one being edited. */
  passive?: boolean;
  onActivate?: (id: string | null) => void;
};

type Rect = { x: number; y: number; w: number; h: number };
const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const;
type Handle = (typeof HANDLES)[number];
const SNAP_PX = 6; // on screen

type Drag = {
  ids: string[]; handle: Handle | 'move' | 'marquee'; x: number; y: number; moved: boolean; shift?: boolean;
  bases: Record<string, NodeEdit>; box: Box; w: number; h: number; targets: Box[];
  /** Resizing a photo's frame: the photo (kept covering its frame) and what sits against the edges being pulled. */
  photo?: { id: string; crop: Crop | null; push: { id: string; side: 'n' | 's' | 'e' | 'w'; base: NodeEdit }[]; room: Record<'n' | 's' | 'e' | 'w', number> };
};

// The design itself: the real template page in a same-origin iframe, filled by fit.js, edited by edits.js
// and read by components.js exactly as on the server, under an overlay that selects, moves and resizes.
export const Stage = forwardRef<StageHandle, Props>(function Stage({ plan, edits, zoom, selected, hover, comps, safe, panning, onSelect, onHover, onReady, onEdit, onText, onInfo, onReview, claude, flash = [], passive = false, onActivate }, ref) {
  // Two pages, double-buffered: a new fill is drawn in the hidden one while the current one stays on
  // screen, then fades in over it. `frame` is always the one on screen.
  const frameA = useRef<HTMLIFrameElement>(null);
  const frameB = useRef<HTMLIFrameElement>(null);
  const [front, setFront] = useState(0);
  const frontRef = useRef(0);
  const frame = useMemo(() => ({ get current() { return (frontRef.current ? frameB : frameA).current; } }), []);
  const [ready, setReady] = useState(false);
  const [refitting, setRefitting] = useState(false);
  const drawn = useRef<string | null>(null); // the page and size on screen (null: nothing drawn yet)
  const loading = useRef<number | null>(null); // the frame a fill is being drawn in
  // Typing in place, ended without saving (a new fill arrived, so the typed copy is no longer current).
  const cancelEdit = useRef<(() => void) | null>(null);
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
  // Reframing a photo inside its frame: drag moves it, the wheel zooms, Enter / Escape / a click outside end.
  const [reframe, setReframe] = useState<string | null>(null);
  const reframeRef = useRef<string | null>(null);
  reframeRef.current = reframe;
  const pan = useRef<{ x: number; y: number; crop: Crop; room: { w: number; h: number } } | null>(null);
  const overlay = useRef<HTMLDivElement>(null);

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

  // ---- Reframe ----
  const cropNow = useCallback((id: string): Crop | null => {
    const n = el(id), w = win();
    if (!n || !w?.__canCrop?.(n)) return null;
    const own = live.current.edits[id]?.crop;
    return own && (!own.src || own.src === n.dataset.slotSrc) ? own : w.__cropOf(n);
  }, [el]);
  // How far the photo can travel in the window (artboard px; negative when it is larger than the window).
  const roomOf = useCallback((id: string, crop: Crop) => {
    const n = el(id), w = win();
    if (!n || !w) return null;
    const W = w.__photoWindow(n), iw = +n.dataset.imgW!, ih = +n.dataset.imgH!;
    const k = Math.max(W.w / iw, W.h / ih) * crop.zoom;
    return { w: W.w - iw * k, h: W.h - ih * k };
  }, [el]);
  const setCrop = useCallback((id: string, crop: Crop, commit: boolean) => {
    const src = el(id)?.dataset.slotSrc;
    const c = { x: +Math.max(0, Math.min(100, crop.x)).toFixed(2), y: +Math.max(0, Math.min(100, crop.y)).toFixed(2), zoom: +Math.max(0.2, Math.min(5, crop.zoom)).toFixed(3), ...(src ? { src } : {}) };
    onEdit({ [id]: { crop: c } }, commit);
  }, [el, onEdit]);
  // A photo's frame: the box that shows it (its clipping frame, or the frame it fills alone), else the photo.
  const maskOf = useCallback((id: string): string => {
    const n = el(id), r = root();
    if (!n || !r) return id;
    let best: Element = n;
    const same = (a: DOMRect, b: DOMRect) => Math.abs(a.left - b.left) < 2 && Math.abs(a.top - b.top) < 2 && Math.abs(a.width - b.width) < 2 && Math.abs(a.height - b.height) < 2;
    for (let p = n.parentElement; p && p !== r; p = p.parentElement) {
      if (!p.hasAttribute('data-node')) continue;
      const cs = getComputedStyle(p);
      const clips = /(hidden|clip)/.test(cs.overflow + cs.overflowX + cs.overflowY);
      const alone = p.querySelectorAll(':scope > [data-node]').length === 1;
      if (clips || (alone && same(p.getBoundingClientRect(), best.getBoundingClientRect()))) best = p; else break;
    }
    return best.getAttribute('data-node') ?? id;
  }, [el]);
  const enterReframe = useCallback((id: string) => {
    const n = el(id), w = win();
    if (!n || !w?.__canCrop?.(n)) { toast.message('This photo cannot be reframed here.'); return; }
    onSelect([id], 'replace');
    onHover(null);
    setReframe(id);
  }, [el, onSelect, onHover]);
  useEffect(() => {
    const on = (e: Event) => { const id = (e as CustomEvent<string>).detail; if (!passive && el(id)) enterReframe(id); };
    window.addEventListener(REFRAME_EVENT, on);
    return () => window.removeEventListener(REFRAME_EVENT, on);
  }, [enterReframe, passive, el]);
  // Out of reframe when the photo is no longer the one selected.
  useEffect(() => { if (reframe && !selected.includes(reframe)) setReframe(null); }, [selected, reframe]);
  // Keys while reframing: Enter / Escape finish (the selection stays), arrows nudge the photo.
  useEffect(() => {
    if (!reframe) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.('input, textarea, [contenteditable]')) return;
      if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); setReframe(null); return; }
      const arrows: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      const a = arrows[e.key];
      if (!a) return;
      e.preventDefault(); e.stopImmediatePropagation();
      const c = cropNow(reframe), room = c && roomOf(reframe, c);
      if (!c || !room) return;
      const step = e.shiftKey ? 10 : 1;
      const dx = Math.abs(room.w) > 0.5 ? (a[0] * step / room.w) * 100 : 0, dy = Math.abs(room.h) > 0.5 ? (a[1] * step / room.h) * 100 : 0;
      setCrop(reframe, { ...c, x: c.x + dx, y: c.y + dy }, true);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [reframe, cropNow, roomOf, setCrop]);
  // The wheel zooms the photo (not the canvas) while reframing; one history step once it stops.
  useEffect(() => {
    const o = overlay.current;
    if (!o || !reframe) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let last: Crop | null = null;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault(); e.stopPropagation();
      const c = last ?? cropNow(reframe);
      if (!c) return;
      last = { ...c, zoom: Math.max(0.2, Math.min(5, c.zoom * Math.exp(-e.deltaY * 0.0015))) };
      setCrop(reframe, last, false);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { if (last) setCrop(reframe, last, true); last = null; }, 350);
    };
    o.addEventListener('wheel', onWheel, { passive: false });
    return () => { o.removeEventListener('wheel', onWheel); if (timer) clearTimeout(timer); };
  }, [reframe, cropNow, setCrop]);

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
  // Computed once per fill (not on every render: hover, selection and zoom redraw the stage often).
  const passiveRef = useRef(passive);
  passiveRef.current = passive;
  const fillKey = useMemo(() => JSON.stringify([plan.html, plan.fill]), [plan.html, plan.fill]);
  const page = `${plan.html}|${plan.width}x${plan.height}`;
  useEffect(() => {
    cancelEdit.current?.();
    setEditing(null);
    // The first time (or another page or size) it draws in place; after that, behind the design on screen.
    const behind = drawn.current === page;
    const target = behind ? 1 - frontRef.current : frontRef.current;
    if (behind) setRefitting(true); else { setRefitting(false); setReady(false); }
    const f = (target ? frameB : frameA).current;
    if (!f) return;
    // Hidden at once (it may still be fading out under the design from the last swap).
    if (behind) { f.style.transition = 'none'; f.style.opacity = '0'; }
    loading.current = target;
    let stale = false;
    let release: (() => void) | null = null; // this format's turn, given back once it is drawn
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
      const keys = w.__keys();
      w.__applyEdits(live.current.edits, live.current.plan.imageUrls, live.current.plan.iconSvgs);
      await d.fonts.ready;
      if (stale) return;
      const old = frontRef.current;
      f.style.removeProperty('transition'); f.style.removeProperty('opacity');
      frontRef.current = target;
      drawn.current = page;
      loading.current = null;
      setFront(target);
      // The page behind, once the new one has faded in, is emptied (memory, and no stale typing in it).
      if (old !== target) setTimeout(() => {
        const o = (old ? frameB : frameA).current;
        if (o && frontRef.current !== old && loading.current !== old) { o.removeAttribute('srcdoc'); o.src = 'about:blank'; }
      }, 400);
      setRefitting(false);
      setReady(true);
      release?.(); release = null;
      live.current.onReady({ comps, safe, tokens, report, keys });
      check();
      redraw();
    };
    const onLoad = () => {
      load().catch((e) => {
        console.error('Canvas could not draw the design', e);
        release?.(); release = null;
        if (stale) return;
        loading.current = null;
        setRefitting(false);
        if (behind) toast.error('Could not update the design. Undo the last change, or reload the page.');
      });
    };
    f.addEventListener('load', onLoad);
    // Written in, so a redraw does not go back to the network for the page (if that fails, loaded
    // from its address; srcdoc would win over src, so it goes first).
    const write = () => templatePage(plan.html).then((t) => { if (!stale) f.srcdoc = `${t}<!--${++loads}-->`; })
      .catch(() => { if (stale) return; f.removeAttribute('srcdoc'); f.src = `/api/template-files/${plan.html}?load=${++loads}`; });
    // A format waiting its turn never holds the others for long, even if its page never loads.
    let safety: ReturnType<typeof setTimeout> | undefined;
    if (passiveRef.current && !behind) {
      turn().then((r) => {
        if (stale) { r(); return; }
        release = r;
        safety = setTimeout(() => { release?.(); release = null; }, 20_000);
        write();
      });
    } else write();
    return () => { stale = true; clearTimeout(safety); f.removeEventListener('load', onLoad); release?.(); release = null; };
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
  }, [edits, plan.imageUrls, plan.iconSvgs, ready, front, redraw, check]);

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

  const startDrag = (e: React.PointerEvent, picked: string[], handle: Drag['handle']) => {
    // A photo moves and resizes with its frame (what shows it), not inside it.
    const photoId = picked.length === 1 && kindOf(picked[0]) === 'photo' ? picked[0] : null;
    const ids = photoId ? [maskOf(photoId)] : picked;
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
    let photo: Drag['photo'];
    if (photoId && handle !== 'move' && handle !== 'marquee') {
      // The photo keeps covering its frame as it grows or shrinks (framed as it is now).
      const crop = el(photoId) && win()?.__canCrop?.(el(photoId)!) ? cropNow(photoId) : null;
      // An absolute frame pushes what sits against the edges being pulled (a photo band and the content
      // under it); a frame in a column already moves its neighbours.
      const push: NonNullable<Drag['photo']>['push'] = [];
      const room = { n: Infinity, s: Infinity, e: Infinity, w: Infinity };
      const m = nodes[0];
      if (m && getComputedStyle(m).position === 'absolute') {
        const sides = (['n', 's', 'e', 'w'] as const).filter((sd) => handle.includes(sd));
        for (const c of comps) {
          if (c.parent !== null || c.kind === 'background' || moving.has(c.id) || c.id === photoId) continue;
          const o = el(c.id), b = boxOf(c.id);
          if (!o || !b || o.contains(m) || m.contains(o)) continue;
          const xs = b.x < box.x + box.w && b.x + b.w > box.x, ys = b.y < box.y + box.h && b.y + b.h > box.y;
          for (const sd of sides) {
            const hit = sd === 's' ? xs && b.y >= box.y + box.h - 24 : sd === 'n' ? xs && b.y + b.h <= box.y + 24
              : sd === 'e' ? ys && b.x >= box.x + box.w - 24 : ys && b.x + b.w <= box.x + 24;
            if (hit) {
              push.push({ id: c.id, side: sd, base: edits[c.id] ?? {} });
              // How far it can go before it leaves the artboard: the frame grows no further than that.
              room[sd] = Math.min(room[sd], Math.max(0, sd === 's' ? plan.height - (b.y + b.h) : sd === 'n' ? b.y : sd === 'e' ? plan.width - (b.x + b.w) : b.x));
              break;
            }
          }
        }
      }
      photo = { id: photoId, crop, push, room };
    }
    drag.current = { ids, handle, x: e.clientX, y: e.clientY, moved: false, bases, box, w: box.w / scale, h: box.h / scale, targets, photo };
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
    if (g.photo && g.handle !== 'move') {
      // A frame that pushes the content grows only as far as the content can go.
      const r = g.photo.room, h = g.handle;
      if (h.includes('s')) dy = Math.min(dy, r.s);
      if (h.includes('n')) dy = Math.max(dy, -r.n);
      if (h.includes('e')) dx = Math.min(dx, r.e);
      if (h.includes('w')) dx = Math.max(dx, -r.w);
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
    if (g.photo) {
      const b = changes[g.ids[0]]?.box ?? {};
      if (g.photo.crop) changes[g.photo.id] = { crop: { ...g.photo.crop, ...(el(g.photo.id)?.dataset.slotSrc ? { src: el(g.photo.id)!.dataset.slotSrc } : {}) } };
      const dw = (b.width ?? g.w) - g.w, dh = (b.height ?? g.h) - g.h;
      for (const p of g.photo.push) {
        const bb = p.base.box ?? {};
        const ddx = p.side === 'e' ? dw : p.side === 'w' ? -dw : 0, ddy = p.side === 's' ? dh : p.side === 'n' ? -dh : 0;
        changes[p.id] = { box: { dx: Math.round((bb.dx ?? 0) + ddx), dy: Math.round((bb.dy ?? 0) + ddy) } };
      }
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
    if (reframe) {
      const b = boxOf(maskOf(reframe)), p = local(e), c = cropNow(reframe), room = c && roomOf(reframe, c);
      if (b && c && room && p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) {
        pan.current = { x: e.clientX, y: e.clientY, crop: c, room };
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
        return;
      }
      setReframe(null); // a click outside the photo ends it, and does what a click does
    }
    if (passive) { onActivate?.(pick(e)?.id ?? null); return; }
    const add = e.shiftKey;
    const c = pick(e);
    // Inside the current selection, a drag moves the whole selection.
    const p = local(e);
    const inSel = !add && !(e.metaKey || e.ctrlKey) && selected.some((id) => { const b = boxOf(kindOf(id) === 'photo' ? maskOf(id) : id); return b && movable(id) && p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h; });
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

  const panTo = (e: React.PointerEvent, commit: boolean) => {
    const g = pan.current!;
    const dx = (e.clientX - g.x) / zoom, dy = (e.clientY - g.y) / zoom;
    const x = Math.abs(g.room.w) > 0.5 ? g.crop.x + (dx / g.room.w) * 100 : g.crop.x;
    const y = Math.abs(g.room.h) > 0.5 ? g.crop.y + (dy / g.room.h) * 100 : g.crop.y;
    setCrop(reframeRef.current!, { ...g.crop, x, y }, commit);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (pan.current) { panTo(e, false); return; }
    const g = drag.current;
    if (!g) { if (!panning && !passive && !reframe) onHover(pick(e)?.id ?? null); return; }
    if (!g.moved && Math.abs(e.clientX - g.x) + Math.abs(e.clientY - g.y) < 3) return;
    g.moved = true;
    dragTo(e, false);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (pan.current) { if (Math.abs(e.clientX - pan.current.x) + Math.abs(e.clientY - pan.current.y) > 1) panTo(e, true); pan.current = null; return; }
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
    if (passive || refitting) return; // a new version is on its way: type in it once it is here
    const c = innermostAt(pointAt(e), comps);
    // Double-click a photo to reframe it inside its frame.
    if (c?.kind === 'photo') { enterReframe(c.id); return; }
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
      st.textContent = '[data-canvas-editing]{outline:none!important}[data-canvas-editing]::selection{background:rgba(255,43,214,.55);color:#fff}';
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
    const off = () => {
      cancelEdit.current = null;
      n.removeEventListener('blur', onBlur);
      n.removeEventListener('keydown', onKey);
      n.removeEventListener('input', onInput);
      n.removeAttribute('contenteditable');
      delete n.dataset.canvasEditing;
      n.style.removeProperty('caret-color');
      n.blur();
    };
    const done = (save: boolean) => {
      off();
      setEditing(null);
      if (!save || !onText(nodeId, n.textContent ?? '')) setNonce((x) => x + 1);
    };
    cancelEdit.current = off;
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

  const sel = ready ? selected.filter((id) => kindOf(id) !== 'background').map((id) => ({ id, r: screen(boxOf(kindOf(id) === 'photo' ? maskOf(id) : id)) })).filter((s) => s.r) as { id: string; r: Rect }[] : [];
  const single = sel.length === 1 ? sel[0] : null;
  const logo = single && kindOf(single.id) === 'archy';
  const group = sel.length > 1 ? screen(union(sel.map((s) => ({ x: s.r.x / zoom, y: s.r.y / zoom, w: s.r.w / zoom, h: s.r.h / zoom })))) : null;
  const hovComp = comps.find((c) => c.id === hover);
  const hov = ready && hovComp && hovComp.kind !== 'background' && !selected.includes(hovComp.id) && !drag.current ? screen(boxOf(hovComp.kind === 'photo' ? maskOf(hovComp.id) : hover)) : null;
  // The group around what is hovered, faint, so its container is easy to see (and pick).
  const ctxComp = ready && !drag.current ? parentOf(comps, hover) : null;
  const ctx = ctxComp && !selected.includes(ctxComp.id) ? screen(boxOf(ctxComp.id)) : null;
  // Texts hug their copy: only their width is pulled; the logo only scales from its corners.
  const handles: readonly Handle[] = logo ? ['nw', 'ne', 'se', 'sw'] : single && kindOf(single.id) === 'text' ? ['e', 'w'] : HANDLES;
  // While typing, one thin frame around the text being edited, nothing else.
  const frameBox = editing || reframe ? null : (single ?? (group ? { r: group } : null))?.r;
  // Reframing: the photo's window, and the whole photo faint beyond it (what the frame cuts away).
  const refr = (() => {
    if (!reframe || !ready) return null;
    const n = el(reframe), w = win(), r0 = root()?.getBoundingClientRect();
    if (!n || !w || !r0) return null;
    const E = n.getBoundingClientRect(), W = w.__photoWindow(n), cs = w.getComputedStyle(n);
    const [bw, bh] = cs.backgroundSize.split(' ').map(parseFloat), [px, py] = cs.backgroundPosition.split(' ').map(parseFloat);
    const win0 = { x: E.left - r0.left + W.x, y: E.top - r0.top + W.y, w: W.w, h: W.h };
    const img = { x: E.left - r0.left + px, y: E.top - r0.top + py, w: bw, h: bh };
    return { win: screen(win0)!, img: screen(img)!, bg: cs.backgroundImage };
  })();
  const editBox = editing && ready ? screen(boxOf(editing)) : null;
  const safeR = screen(safe);

  return (
    <div data-stage className="relative isolate shrink-0 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_24px_60px_-24px_rgba(0,0,0,0.35)]" style={{ width: plan.width * zoom, height: plan.height * zoom }}>
      {[frameA, frameB].map((r, i) => (
        <iframe
          key={i}
          ref={r}
          title={i === front ? 'Design' : 'Design (next)'}
          aria-hidden={i !== front}
          // On screen: fades in over the previous one. Behind: hidden once the new one has come in.
          className={`absolute top-0 left-0 origin-top-left border-0 bg-white transition-opacity ${
            i === front && ready ? 'z-0 opacity-100 duration-200 ease-out' : 'pointer-events-none -z-10 opacity-0 delay-200 duration-0'}`}
          style={{ width: plan.width, height: plan.height, transform: `scale(${zoom})` }}
        />
      ))}
      {!ready && <div className="absolute inset-0 animate-pulse bg-foreground/[0.04]" />}
      {/* Fitting the new copy: a thin line along the top, only if it takes a moment. */}
      {refitting && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[2] h-[2px] overflow-hidden animate-in fade-in-0 fill-mode-both delay-300 duration-200">
          <div className="h-full w-1/3 animate-[canvas-refit_1.1s_ease-in-out_infinite] rounded-full bg-[#FF2BD6]" />
        </div>
      )}
      {claude && (
        <>
          {/* Claude at work: a live frame around the artboard and its name tag, like a collaborator. */}
          <div className="pointer-events-none absolute -inset-[3px] z-10 rounded-[3px] ring-2 ring-[#0095FF] animate-pulse" />
          <div className="pointer-events-none absolute -top-8 left-0 z-10 flex items-center gap-1.5 rounded-full bg-[#0095FF] py-1 pr-2.5 pl-1.5 text-[11px] font-medium whitespace-nowrap text-white shadow-[0_4px_12px_-4px_rgba(0,149,255,0.6)]">
            <span className="flex size-4 items-center justify-center rounded-full bg-white text-[9px] font-bold text-[#D97757]">✳</span>
            Claude · {claude}
            <span className="flex gap-0.5">{[0, 1, 2].map((i) => <span key={i} className="size-1 animate-bounce rounded-full bg-white/80" style={{ animationDelay: `${i * 120}ms` }} />)}</span>
          </div>
        </>
      )}
      <div
        ref={overlay}
        className={`absolute inset-0 ${editing || panning ? 'pointer-events-none' : reframe ? 'cursor-move' : 'cursor-default'}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => onHover(null)}
        onDoubleClick={onDoubleClick}
      >
        {/* The safe area shows while something moves; red when the piece leaves it. */}
        {safeR && badge && <div className={`pointer-events-none absolute border border-dashed ${outside ? 'border-[#F2385A]' : 'border-[#FF2BD6]/40'}`} style={{ left: safeR.x, top: safeR.y, width: safeR.w, height: safeR.h }} />}
        {ctx && <div className="pointer-events-none absolute outline-1 outline-offset-0 outline-dashed outline-[#FF2BD6]/35" style={{ left: ctx.x, top: ctx.y, width: ctx.w, height: ctx.h }}><Tag right>{ctxComp!.name}</Tag></div>}
        {hov && (
          <div className={`pointer-events-none absolute ${hovComp?.kind === 'group' ? 'bg-[#FF2BD6]/[0.04] outline-1 outline-dashed outline-[#FF2BD6]/70' : 'ring-[1.5px] ring-[#FF2BD6]/80'}`} style={{ left: hov.x, top: hov.y, width: hov.w, height: hov.h }}>
            {hovComp?.kind === 'archy' ? <Tag icon>{hovComp.name} · move and scale only</Tag> : hovComp?.kind === 'group' && <Tag>{hovComp.name}</Tag>}
          </div>
        )}
        {sel.length > 1 && sel.map((s) => <div key={s.id} className="pointer-events-none absolute ring-1 ring-[#FF2BD6]" style={{ left: s.r.x, top: s.r.y, width: s.r.w, height: s.r.h }} />)}
        {frameBox && (
          <div className={`pointer-events-none absolute ${sel.length > 1 ? 'ring-1 ring-[#FF2BD6]/50 ring-offset-0' : 'ring-2 ring-[#FF2BD6]'}`} style={{ left: frameBox.x, top: frameBox.y, width: frameBox.w, height: frameBox.h }}>
            {single && !editing && handles.map((h) => (
              <span
                key={h}
                onPointerDown={(e) => { e.stopPropagation(); startDrag(e, [single.id], h); }}
                className="pointer-events-auto absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-[2px] border border-[#FF2BD6] bg-white"
                style={{ left: h.includes('w') ? 0 : h.includes('e') ? '100%' : '50%', top: h.includes('n') ? 0 : h.includes('s') ? '100%' : '50%', cursor: `${h}-resize` }}
              />
            ))}
            {logo && !badge && <Tag icon>{comps.find((c) => c.id === single?.id)?.name ?? 'Logo'} · move and scale only</Tag>}
            {sel.length > 1 && !badge && <Tag>{sel.length} selected</Tag>}
            {badge && <span className={`absolute top-full left-1/2 mt-1.5 -translate-x-1/2 rounded-[4px] px-1.5 py-0.5 text-[10px] font-medium whitespace-pre text-white tabular-nums ${outside ? 'bg-[#F2385A]' : 'bg-[#FF2BD6]'}`}>{outside ? `${badge}   Outside the safe area` : badge}</span>}
          </div>
        )}
        {flash.map((id) => { const r = ready ? screen(boxOf(id)) : null; return r && <div key={`f-${id}`} className="pointer-events-none absolute rounded-[2px] bg-[#FF2BD6]/10 ring-2 ring-[#FF2BD6] animate-out fade-out-0 duration-[1600ms] fill-mode-forwards" style={{ left: r.x, top: r.y, width: r.w, height: r.h }} />; })}
        {refr && (
          <>
            {/* The rest of the photo, faint, outside its frame. */}
            <div className="pointer-events-none absolute opacity-35" style={{ left: refr.img.x, top: refr.img.y, width: refr.img.w, height: refr.img.h, backgroundImage: refr.bg, backgroundSize: '100% 100%',
              clipPath: `polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${refr.win.x - refr.img.x}px ${refr.win.y - refr.img.y}px, ${refr.win.x - refr.img.x}px ${refr.win.y - refr.img.y + refr.win.h}px, ${refr.win.x - refr.img.x + refr.win.w}px ${refr.win.y - refr.img.y + refr.win.h}px, ${refr.win.x - refr.img.x + refr.win.w}px ${refr.win.y - refr.img.y}px, ${refr.win.x - refr.img.x}px ${refr.win.y - refr.img.y}px)` }} />
            <div className="pointer-events-none absolute outline-1 outline-dashed outline-[#FF2BD6]/70" style={{ left: refr.img.x, top: refr.img.y, width: refr.img.w, height: refr.img.h }} />
            <div className="pointer-events-none absolute ring-2 ring-[#FF2BD6]" style={{ left: refr.win.x, top: refr.win.y, width: refr.win.w, height: refr.win.h }}>
              <Tag>Reframe · drag to move · scroll to zoom · Enter when done</Tag>
            </div>
          </>
        )}
        {editBox && <div className="pointer-events-none absolute ring-1 ring-[#FF2BD6]" style={{ left: editBox.x, top: editBox.y, width: editBox.w, height: editBox.h }} />}
        {marquee && <div className="pointer-events-none absolute border border-[#FF2BD6] bg-[#FF2BD6]/10" style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h }} />}
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
