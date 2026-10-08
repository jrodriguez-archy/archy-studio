'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { HugeiconsIcon } from '@hugeicons/react';
import { Alert02Icon, CheckmarkCircle02Icon, Comment01Icon, Copy01Icon, Delete02Icon, Task01Icon } from '@hugeicons/core-free-icons';
import { toast } from 'sonner';
import { Inspector, useInspector } from '@/components/inspector';
import { addCommentAction, deleteCommentAction, moveCommentAction, pasteCommentsAction, setStatusAction } from '@/app/(app)/admin/review/actions';
import type { ReviewItem, ReviewRound, ReviewStatus } from '@/lib/review';

const CASES = [['realistic', 'Realistic'], ['short', 'Short copy'], ['long', 'Long copy'], ['theme', 'Themes']] as const;
type CaseKey = (typeof CASES)[number][0];
const STATUS: Record<ReviewStatus, { label: string; dot: string }> = {
  pending: { label: 'To review', dot: 'bg-foreground/25' },
  needs_work: { label: 'Needs work', dot: 'bg-[#D97706]' },
  approved: { label: 'Approved', dot: 'bg-[#05C168]' },
};
type Clip = { from: string; label: string; comments: { body: string; x: number | null; y: number | null }[] };
const CLIP_KEY = 'review.clip';
const ALSO_KEY = 'review.alsoFormats';
const caseOf = (c: string): CaseKey => (c.startsWith('theme:') ? 'theme' : (c as CaseKey));
const caseLabel = (c: string) => (c.startsWith('theme:') ? `${c.slice(6, 7).toUpperCase()}${c.slice(7)} theme` : CASES.find(([k]) => k === c)?.[1] ?? c);

// Template review: a row per template with its formats side by side, one case at a time. A click opens
// the design large: approve it, or click on it to leave a comment on that spot.
export function ReviewBoard({ rounds, round, items: given }: { rounds: ReviewRound[]; round: ReviewRound; items: ReviewItem[] }) {
  const [items, setItems] = useState(given);
  useEffect(() => setItems(given), [given]);
  const [tab, setTab] = useState<CaseKey>('realistic');
  const [filter, setFilter] = useState<ReviewStatus | 'all'>('all');
  const counts = useMemo(() => items.reduce((a, i) => ({ ...a, [i.status]: (a[i.status] ?? 0) + 1 }), {} as Record<string, number>), [items]);
  const order = useMemo(() => [...new Set(items.map((i) => i.template))].sort((a, b) => items.find((i) => i.template === a)!.title.localeCompare(items.find((i) => i.template === b)!.title)), [items]);
  const shown = items.filter((i) => caseOf(i.case) === tab && (filter === 'all' || i.status === filter));
  const ids = order.flatMap((t) => shown.filter((i) => i.template === t).map((i) => i.id));
  const { openId, open, close, step } = useInspector('item', ids);
  const current = items.find((i) => i.id === openId) ?? null;
  const patch = (id: string, p: Partial<ReviewItem> | ((i: ReviewItem) => Partial<ReviewItem>)) =>
    setItems((list) => list.map((i) => (i.id === id ? { ...i, ...(typeof p === 'function' ? p(i) : p) } : i)));
  // Comments copied from one design, to paste on another (kept across reloads in this browser).
  const [clip, setClipState] = useState<Clip | null>(null);
  useEffect(() => { try { const v = localStorage.getItem(CLIP_KEY); if (v) setClipState(JSON.parse(v)); } catch {} }, []);
  const setClip = (c: Clip | null) => { setClipState(c); try { if (c) localStorage.setItem(CLIP_KEY, JSON.stringify(c)); else localStorage.removeItem(CLIP_KEY); } catch {} };

  return (
    <div className="text-[13px]">
      <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="flex items-center gap-1.5">
          {rounds.slice(0, 8).map((r) => (
            <Link key={r.id} href={`/admin/review?round=${r.id}`} title={r.note ?? undefined}
              className={`flex h-7 items-center rounded-md px-2.5 ${r.id === round.id ? 'bg-foreground text-background' : 'bg-foreground/[0.05] text-foreground/70 hover:bg-foreground/[0.09]'}`}>Round {r.number}</Link>
          ))}
        </div>
        <div className="flex items-center gap-3 text-foreground/55">
          {(['pending', 'needs_work', 'approved'] as const).map((s) => (
            <button key={s} type="button" onClick={() => setFilter(filter === s ? 'all' : s)}
              className={`flex items-center gap-1.5 rounded-md px-1.5 py-0.5 ${filter === s ? 'bg-foreground/[0.07] text-foreground' : 'hover:text-foreground'}`}>
              <span className={`size-2 rounded-full ${STATUS[s].dot}`} /> {STATUS[s].label} <span className="tabular-nums">{counts[s] ?? 0}</span>
            </button>
          ))}
        </div>
      </div>
      {round.note && <p className="-mt-2 mb-5 max-w-3xl text-foreground/55">{round.note}</p>}

      <div className="mb-6 inline-grid h-8 grid-flow-col items-center gap-0.5 rounded-md bg-foreground/[0.05] p-0.5">
        {CASES.map(([k, label]) => (
          <button key={k} type="button" onClick={() => setTab(k)}
            className={`h-7 rounded-[5px] px-3 ${tab === k ? 'bg-background font-medium shadow-[0_0_0_1px_rgba(0,0,0,0.06)]' : 'text-foreground/55 hover:text-foreground'}`}>{label}</button>
        ))}
      </div>

      <div className="space-y-8">
        {order.map((t) => {
          const row = shown.filter((i) => i.template === t);
          if (!row.length) return null;
          const all = items.filter((i) => i.template === t);
          return (
            <section key={t}>
              <div className="mb-2.5 flex items-baseline gap-2">
                <h2 className="text-[15px] font-medium">{row[0].title}</h2>
                <span className="text-foreground/40">{all.filter((i) => i.status === 'approved').length}/{all.length} approved</span>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:thin]">
                {row.map((i) => (
                  <button key={i.id} type="button" onClick={() => open(i.id)} className="group shrink-0 text-left">
                    <div className="relative overflow-hidden rounded-md bg-foreground/[0.04] ring-1 ring-foreground/[0.06] transition-shadow group-hover:ring-primary/50" style={{ height: 220, width: (220 * i.width) / i.height }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={i.thumb} alt="" loading="lazy" className="size-full object-cover" />
                      {i.comments.filter((c) => !c.resolved_at).length > 0 && (
                        <span className="absolute top-1.5 right-1.5 flex h-5 items-center gap-1 rounded-full bg-[#D97706] px-1.5 text-[11px] font-medium text-white">
                          <HugeiconsIcon icon={Comment01Icon} className="size-3" />{i.comments.filter((c) => !c.resolved_at).length}
                        </span>
                      )}
                      {i.report.ok === false && <span title="The engine could not fit some copy" className="absolute top-1.5 left-1.5 flex size-5 items-center justify-center rounded-full bg-background/90"><HugeiconsIcon icon={Alert02Icon} className="size-3 text-[#D97706]" /></span>}
                    </div>
                    <p className="mt-1.5 flex items-center gap-1.5 text-foreground/60">
                      <span className={`size-1.5 rounded-full ${STATUS[i.status].dot}`} />
                      {tab === 'theme' ? caseLabel(i.case) : i.formatLabel}{i.prev?.url ? <span className="text-foreground/35">· updated</span> : null}
                    </p>
                  </button>
                ))}
              </div>
            </section>
          );
        })}
        {!shown.length && <p className="py-12 text-center text-foreground/45">Nothing here with this filter.</p>}
      </div>

      {current && (
        <Viewer key={current.id} item={current} onClose={close} onStep={step} onPatch={patch} clip={clip} setClip={setClip}
          siblings={items.filter((i) => i.template === current.template && i.case === current.case && i.id !== current.id)} />
      )}
    </div>
  );
}

type Patch = (id: string, p: Partial<ReviewItem> | ((i: ReviewItem) => Partial<ReviewItem>)) => void;
const comment = (id: string, body: string, x: number | null, y: number | null) => ({ id, body, x, y, author: 'You', created_at: new Date().toISOString(), resolved_at: null, resolution: null });

function Viewer({ item, siblings, clip, setClip, onClose, onStep, onPatch }: {
  item: ReviewItem; siblings: ReviewItem[]; clip: Clip | null; setClip: (c: Clip | null) => void;
  onClose: () => void; onStep: (d: 1 | -1) => void; onPatch: Patch;
}) {
  const [busy, start] = useTransition();
  // The same comment on the other formats of this template (remembered).
  const [also, setAlsoState] = useState(false);
  useEffect(() => { try { setAlsoState(localStorage.getItem(ALSO_KEY) === '1'); } catch {} }, []);
  const setAlso = (v: boolean) => { setAlsoState(v); try { localStorage.setItem(ALSO_KEY, v ? '1' : '0'); } catch {} };
  // Each design's new comments, and the needs-work status a comment brings.
  const append = (ids: Record<string, string[]>, rows: { body: string; x: number | null; y: number | null }[]) => {
    for (const [itemId, list] of Object.entries(ids)) {
      onPatch(itemId, (i) => ({ status: i.status === 'approved' ? 'approved' : 'needs_work', comments: [...i.comments, ...list.map((id, n) => comment(id, rows[n % rows.length].body, rows[n % rows.length].x, rows[n % rows.length].y))] }));
    }
  };
  const [pin, setPin] = useState<{ x: number; y: number } | null>(null);
  const [draft, setDraft] = useState('');
  const [before, setBefore] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);
  const open = item.comments.filter((c) => !c.resolved_at);

  const status = (s: ReviewStatus) => start(async () => {
    onPatch(item.id, { status: s });
    try { await setStatusAction(item.id, s); if (s === 'approved') onStep(1); } catch (e) { toast.error((e as Error).message); }
  });
  const send = () => start(async () => {
    if (!draft.trim()) return;
    try {
      const others = also ? siblings.map((s) => s.id) : [];
      const ids = await addCommentAction(item.id, draft, pin, others);
      append(ids, [{ body: draft.trim(), x: pin?.x ?? null, y: pin?.y ?? null }]);
      if (others.length) toast(`Also on ${siblings.map((s) => s.formatLabel).join(', ')}. Drag a pin there if it lands off.`);
      setDraft(''); setPin(null);
     
    } catch (e) { toast.error((e as Error).message); }
  });
  const copy = () => {
    const list = open.map((c) => ({ body: c.body, x: c.x, y: c.y }));
    if (!list.length) return;
    setClip({ from: item.id, label: `${item.title} · ${item.formatLabel}`, comments: list });
    toast(`${list.length} comment${list.length > 1 ? 's' : ''} copied. Open another design and paste.`);
  };
  const paste = (all: boolean) => start(async () => {
    if (!clip) return;
    const targets = [item.id, ...(all ? siblings.map((s) => s.id) : [])];
    try {
      const ids = await pasteCommentsAction(targets, clip.comments);
      append(ids, clip.comments);
      toast(`Pasted ${clip.comments.length} comment${clip.comments.length > 1 ? 's' : ''}${all ? ` on ${targets.length} formats` : ''}. Drag the pins to their spot if needed.`);
    } catch (e) { toast.error((e as Error).message); }
  });
  // A pin dragged to its spot.
  const move = (id: string, x: number, y: number) => {
    onPatch(item.id, (i) => ({ comments: i.comments.map((c) => (c.id === id ? { ...c, x, y } : c)) }));
    moveCommentAction(id, x, y).catch((e) => toast.error((e as Error).message));
  };
  const remove = (id: string) => start(async () => {
    onPatch(item.id, { comments: item.comments.filter((c) => c.id !== id) });
    try { await deleteCommentAction(id); } catch (e) { toast.error((e as Error).message); }
  });

  // A (approve), N (needs work); typing in the box is left alone.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input, textarea')) return;
      if (e.key.toLowerCase() === 'a') status('approved');
      else if (e.key.toLowerCase() === 'n') status('needs_work');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const pins = before ? (item.prev?.comments ?? []) : item.comments;
  return (
    <Inspector
      onClose={onClose}
      onStep={onStep}
      eyebrow={`${item.formatLabel} · ${caseLabel(item.case)}`}
      title={item.title}
      info={
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-1.5">
            <button type="button" disabled={busy} onClick={() => status('approved')}
              className={`flex h-8 items-center justify-center gap-1.5 rounded-md font-medium ${item.status === 'approved' ? 'bg-[#05C168] text-white' : 'bg-foreground/[0.05] hover:bg-[#E7F8EF] hover:text-[#047A43]'}`}>
              <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-3.5" /> Approve <kbd className="text-[10px] opacity-50">A</kbd>
            </button>
            <button type="button" disabled={busy} onClick={() => status('needs_work')}
              className={`flex h-8 items-center justify-center gap-1.5 rounded-md font-medium ${item.status === 'needs_work' ? 'bg-[#D97706] text-white' : 'bg-foreground/[0.05] hover:bg-[#FFF4E5] hover:text-[#B45309]'}`}>
              Needs work <kbd className="text-[10px] opacity-50">N</kbd>
            </button>
          </div>

          <div>
            <p className="mb-1.5 text-[11px] font-medium tracking-[0.02em] text-foreground/40">{pin ? 'Comment on the marked spot' : 'Click on the design to point at something, or just write'}</p>
            <textarea ref={box} value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} placeholder="What would you improve?"
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send(); if (e.key === 'Escape') { setPin(null); (e.target as HTMLElement).blur(); } }}
              className="w-full resize-none rounded-md bg-foreground/[0.04] px-2.5 py-2 outline-none ring-1 ring-foreground/[0.06] focus:ring-primary/50" />
            <div className="mt-1.5 flex items-center justify-between">
              {pin ? <button type="button" onClick={() => setPin(null)} className="text-foreground/45 hover:text-foreground">Remove the point</button> : <span />}
              <button type="button" disabled={busy || !draft.trim()} onClick={send} className="h-7 rounded-md bg-primary px-3 font-medium text-primary-foreground disabled:opacity-40">Comment <span className="opacity-60">⌘↵</span></button>
            </div>
            {siblings.length > 0 && (
              <label className="mt-2 flex cursor-default items-start gap-2 text-foreground/65">
                <input type="checkbox" checked={also} onChange={(e) => setAlso(e.target.checked)} className="mt-0.5 accent-primary" />
                <span>Same for {siblings.map((s) => s.formatLabel).join(', ')} <span className="text-foreground/40">(same spot; drag a pin there if it lands off)</span></span>
              </label>
            )}
          </div>

          {(open.length > 0 || (clip && clip.from !== item.id)) && (
            <div className="flex flex-wrap gap-1.5">
              {open.length > 0 && (
                <button type="button" onClick={copy} title="Copy this design's open comments, to paste them on another"
                  className="flex h-7 items-center gap-1.5 rounded-md bg-foreground/[0.05] px-2.5 text-foreground/75 hover:bg-foreground/[0.09]">
                  <HugeiconsIcon icon={Copy01Icon} className="size-3.5" /> Copy comments
                </button>
              )}
              {clip && clip.from !== item.id && (
                <>
                  <button type="button" disabled={busy} onClick={() => paste(false)} title={`From ${clip.label}`}
                    className="flex h-7 items-center gap-1.5 rounded-md bg-[#E6F4FF] px-2.5 text-primary hover:bg-[#CCEAFF]">
                    <HugeiconsIcon icon={Task01Icon} className="size-3.5" /> Paste {clip.comments.length}
                  </button>
                  {siblings.length > 0 && (
                    <button type="button" disabled={busy} onClick={() => paste(true)} title={`From ${clip.label}, on every format of this template`}
                      className="h-7 rounded-md px-2 text-primary hover:bg-[#E6F4FF]">…on all formats</button>
                  )}
                </>
              )}
            </div>
          )}

          {item.comments.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-medium tracking-[0.02em] text-foreground/40">Comments · {open.length} open</p>
              {item.comments.map((c) => (
                <div key={c.id} className={`group rounded-md p-2.5 ${c.resolved_at ? 'bg-[#E7F8EF]/60' : 'bg-foreground/[0.03]'}`}>
                  <div className="flex items-start gap-2">
                    {c.x != null && <span className="mt-px flex size-4 shrink-0 items-center justify-center rounded-full bg-[#3DF5B0] text-[10px] font-semibold text-[#00004E]">{item.comments.filter((x) => x.x != null).indexOf(c) + 1}</span>}
                    <p className="min-w-0 flex-1 whitespace-pre-wrap">{c.body}</p>
                    {!c.resolved_at && <button type="button" onClick={() => remove(c.id)} aria-label="Delete" className="text-foreground/30 opacity-0 group-hover:opacity-100 hover:text-foreground"><HugeiconsIcon icon={Delete02Icon} className="size-3.5" /></button>}
                  </div>
                  {c.resolved_at && <p className="mt-1.5 text-[12px] text-[#047A43]">Fixed: {c.resolution}</p>}
                  <p className="mt-1 text-[11px] text-foreground/35">{c.author}</p>
                </div>
              ))}
            </div>
          )}

          {item.prev && item.prev.comments.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-medium tracking-[0.02em] text-foreground/40">From the last round</p>
              {item.prev.comments.map((c) => (
                <div key={c.id} className="rounded-md bg-foreground/[0.03] p-2.5">
                  <p className="text-foreground/60">{c.body}</p>
                  <p className={`mt-1 text-[12px] ${c.resolved_at ? 'text-[#047A43]' : 'text-[#B45309]'}`}>{c.resolved_at ? `Fixed: ${c.resolution}` : 'Still open'}</p>
                </div>
              ))}
            </div>
          )}

          <details className="text-foreground/55">
            <summary className="cursor-default text-[11px] font-medium tracking-[0.02em] text-foreground/40">Engine report</summary>
            <div className="mt-2 space-y-1">
              <p>{item.report.ok === false ? 'Some copy does not fit:' : 'All copy fits.'}</p>
              {item.report.errors?.map((e, i) => <p key={i} className="text-[#B45309]">· {e.message ?? e.code}</p>)}
              {item.report.fill && <p>Fill: {JSON.stringify(item.report.fill)}</p>}
              {!!item.report.trimmed?.length && <p>Written shorter to fit (as Claude would): {item.report.trimmed.join(' · ')}</p>}
              {item.report.review?.map((r, i) => <p key={i}>· Inspector: {r.title}</p>)}
            </div>
          </details>
        </div>
      }
      stage={
        <ZoomStage width={item.width} height={item.height}
          top={item.prev?.url ? (
            <div className="inline-grid h-7 grid-flow-col items-center gap-0.5 rounded-md bg-background/80 p-0.5 text-[12px] shadow-[0_0_0_1px_rgba(0,0,0,0.06)]">
              {[[true, 'Before'], [false, 'After']].map(([b, label]) => (
                <button key={String(label)} type="button" onClick={() => setBefore(b as boolean)} className={`h-6 rounded-[4px] px-2.5 ${before === b ? 'bg-foreground text-background' : 'text-foreground/60'}`}>{label}</button>
              ))}
            </div>
          ) : null}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={before && item.prev?.url ? item.prev.url : item.url} alt="" draggable={false}
            onClick={(e) => { if (before) return; const r = e.currentTarget.getBoundingClientRect(); setPin({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }); box.current?.focus(); }}
            className={`size-full rounded-[3px] shadow-[0_1px_3px_rgba(0,0,0,0.08),0_24px_60px_-24px_rgba(0,0,0,0.35)] ${before ? '' : 'cursor-crosshair'}`} />
          {pins.filter((c) => c.x != null).map((c, n) => (
            <Pin key={c.id} n={n + 1} x={c.x!} y={c.y!} title={c.body} resolved={!!c.resolved_at} movable={!before && !c.resolved_at} onMove={(x, y) => move(c.id, x, y)} />
          ))}
          {pin && !before && (
            <span style={{ left: `${pin.x * 100}%`, top: `${pin.y * 100}%` }} className="pointer-events-none absolute size-6 -translate-x-1/2 -translate-y-1/2">
              <span className="absolute inset-0 animate-ping rounded-full bg-[#3DF5B0]/70" />
              <span className="absolute inset-0 rounded-full bg-[#3DF5B0] ring-2 ring-[#00004E] shadow-[0_2px_8px_rgba(0,0,0,0.35)]" />
            </span>
          )}
        </ZoomStage>
      }
    />
  );
}

// The design on the stage: always whole (fit to the room, both ways) by default; zoom in to look at a
// detail (−/+, 100%, ⌘/Ctrl + wheel or pinch) and scroll around; F (or Fit) puts it back whole.
function ZoomStage({ width, height, top, children }: { width: number; height: number; top?: React.ReactNode; children: React.ReactNode }) {
  const area = useRef<HTMLDivElement>(null);
  const [room, setRoom] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState<number | 'fit'>('fit');
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setRoom({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const PAD = 40;
  const fit = room.w ? Math.min((room.w - PAD * 2) / width, (room.h - PAD * 2) / height) : 0;
  const z = zoom === 'fit' ? fit : zoom;
  const set = (next: number) => setZoom(Math.min(4, Math.max(Math.min(fit, 0.1), next)));
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input, textarea')) return;
      if (e.key === 'f' || e.key === 'F') setZoom('fit');
      else if (e.key === '+' || e.key === '=') set(z * 1.25);
      else if (e.key === '-') set(z / 1.25);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      set(z * Math.exp(-e.deltaY * 0.01));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  });
  const w = width * z, h = height * z;
  // Zooming keeps the spot in the middle of the view where it was.
  const center = useRef({ x: 0.5, y: 0.5 });
  const onScroll = () => {
    const el = area.current;
    if (el) center.current = { x: (el.scrollLeft + el.clientWidth / 2) / el.scrollWidth, y: (el.scrollTop + el.clientHeight / 2) / el.scrollHeight };
  };
  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    el.scrollLeft = center.current.x * el.scrollWidth - el.clientWidth / 2;
    el.scrollTop = center.current.y * el.scrollHeight - el.clientHeight / 2;
  }, [z]);
  return (
    <div className="absolute inset-0 flex flex-col">
      {top && <div className="flex shrink-0 justify-center pt-4">{top}</div>}
      <div ref={area} onScroll={onScroll} className="relative min-h-0 flex-1 overflow-auto [scrollbar-width:thin]">
        {z > 0 && (
          <div className="flex items-center justify-center" style={{ width: Math.max(room.w, w + PAD * 2), height: Math.max(room.h, h + PAD * 2) }}>
            <div className="relative shrink-0" style={{ width: w, height: h }}>{children}</div>
          </div>
        )}
      </div>
      <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2">
        <div className="pointer-events-auto flex items-center gap-0.5 rounded-lg bg-background p-1 text-[12px] shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_8px_24px_-8px_rgba(0,0,0,0.2)]">
          <button type="button" onClick={() => set(z / 1.25)} title="Zoom out (−)" className="flex size-7 items-center justify-center rounded-md text-foreground/70 hover:bg-foreground/[0.06]">−</button>
          <span className="w-11 text-center tabular-nums text-foreground/70">{Math.round(z * 100)}%</span>
          <button type="button" onClick={() => set(z * 1.25)} title="Zoom in (+)" className="flex size-7 items-center justify-center rounded-md text-foreground/70 hover:bg-foreground/[0.06]">+</button>
          <span className="mx-1 h-4 w-px bg-foreground/10" />
          <button type="button" onClick={() => setZoom('fit')} title="See it whole (F)" className={`h-7 rounded-md px-2 ${zoom === 'fit' ? 'bg-[#E6F4FF] text-primary' : 'text-foreground/70 hover:bg-foreground/[0.06]'}`}>Fit</button>
          <button type="button" onClick={() => setZoom(1)} title="Actual size" className={`h-7 rounded-md px-2 ${zoom === 1 ? 'bg-[#E6F4FF] text-primary' : 'text-foreground/70 hover:bg-foreground/[0.06]'}`}>100%</button>
        </div>
      </div>
    </div>
  );
}

// A comment's pin on the design. Open ones can be dragged to the right spot (after a copy to another format).
function Pin({ n, x, y, title, resolved, movable, onMove }: { n: number; x: number; y: number; title: string; resolved: boolean; movable: boolean; onMove: (x: number, y: number) => void }) {
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef<{ box: DOMRect; moved: boolean } | null>(null);
  const pos = at ?? { x, y };
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  return (
    <span title={movable ? `${title}\n(drag to move)` : title} style={{ left: `${pos.x * 100}%`, top: `${pos.y * 100}%`, touchAction: 'none' }}
      onPointerDown={(e) => {
        if (!movable) return;
        e.preventDefault();
        e.stopPropagation();
        const box = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
        drag.current = { box, moved: false };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        d.moved = true;
        setAt({ x: clamp((e.clientX - d.box.left) / d.box.width), y: clamp((e.clientY - d.box.top) / d.box.height) });
      }}
      onPointerUp={() => {
        const d = drag.current;
        drag.current = null;
        if (d?.moved && at) onMove(at.x, at.y);
        setAt(null);
      }}
      onClick={(e) => e.stopPropagation()}
      className={`pointer-events-auto absolute flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[11px] font-semibold ring-2 shadow-[0_2px_8px_rgba(0,0,0,0.35)] ${movable ? 'cursor-grab active:cursor-grabbing' : ''} ${resolved ? 'bg-foreground/40 text-white ring-white/80' : 'bg-[#3DF5B0] text-[#00004E] ring-[#00004E]'}`}>{n}</span>
  );
}
