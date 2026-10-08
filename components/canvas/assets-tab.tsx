'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  AiMagicIcon, ArrowLeft01Icon, ArrowRight01Icon, Delete02Icon, Download04Icon, Maximize01Icon, UserIcon, ZoomInAreaIcon, DashboardSquare01Icon, GridIcon, ImageUploadIcon, MagicWand01Icon, PencilEdit02Icon, Scissor01Icon, SparklesIcon,
} from '@hugeicons/core-free-icons';
import { toast } from 'sonner';
import { ClickActions, ContextActions, MoreActions, type Action } from '@/components/action-menu';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import type { Asset } from '@/lib/assets';
import { PALETTES, PIXEL_SIZES, drawPixelBackground, loadImage, pixelBackground, pixelDissolve, pixelTone, swatch, type PaletteKey, type PixelSize, type Tone } from '@/lib/pixel-effects';

type Lists = { mine: Asset[]; team: Asset[] };
const RATIOS = [['4:5', 'Post'], ['1:1', 'Square'], ['9:16', 'Story'], ['16:9', 'Wide']] as const;
const KIND: Record<Asset['kind'], string> = { upload: 'Upload', cutout: 'Cutout', pixel: 'Pixel effect', generated: 'Generated' };

// What this browser session changed (new images, renames, removals), kept across tab switches and the
// library's live reloads, which bring the server's list again.
const session = { added: [] as Asset[], gone: new Set<string>(), names: new Map<string, string>() };
export function withSession(base: Lists): Lists {
  const fix = (l: Asset[]) => {
    const seen = new Set<string>();
    return l.filter((a) => !session.gone.has(a.id) && !seen.has(a.id) && !!seen.add(a.id))
      .map((a) => (session.names.has(a.id) ? { ...a, name: session.names.get(a.id)! } : a));
  };
  return { mine: fix([...session.added, ...base.mine]), team: fix([...session.added, ...base.team]) };
}
const MAX_UPLOAD = 4_000_000;

// Assets: the images the team brings to Studio, and what Studio makes from them. Click one to place it
// in the selected photo or logo (or, with nothing selected, to see what can be done with it);
// right-click for the same options: remove the background, Archy's pixel effects, edit with AI.
export function AssetsTab({ assets, target, onPick }: { assets: Lists; target: string | null; onPick: (value: string) => void }) {
  const [tick, setTick] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const lists = useMemo(() => withSession(assets), [assets, tick]);
  const [whose, setWhose] = useState<'mine' | 'team'>('mine');
  const [working, setWorking] = useState<{ key: string; label: string }[]>([]);
  const [ai, setAi] = useState<{ from: Asset | null } | null>(null);
  const [renaming, setRenaming] = useState<Asset | null>(null);
  const [pixelBg, setPixelBg] = useState<Asset | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const mineIds = new Set(lists.mine.map((a) => a.id));
  const list = whose === 'mine' ? lists.mine : lists.team;

  const add = (a: Asset) => { session.added.unshift(a); setTick((t) => t + 1); };
  const drop = (id: string) => { session.gone.add(id); setTick((t) => t + 1); };
  const rename = (id: string, name: string) => { session.names.set(id, name); setTick((t) => t + 1); };

  // A job started from the large view: the view follows that one job and shows its result.
  const fromViewer = useRef(false);
  const [viewerJob, setViewerJob] = useState<string | null>(null);
  const viewerJobRef = useRef<string | null>(null);
  const followJob = (key: string | null) => { viewerJobRef.current = key; setViewerJob(key); };

  // Every job shows a placeholder until its image arrives, then joins Mine (and Team).
  const job = async (label: string, run: () => Promise<Asset>) => {
    const key = Math.random().toString(36).slice(2);
    setWorking((w) => [{ key, label }, ...w]);
    if (fromViewer.current) { fromViewer.current = false; followJob(key); } else setWhose('mine');
    try {
      const a = await run();
      add(a);
      if (viewerJobRef.current === key) { followJob(null); setViewing(a.id); }
    } catch (e) {
      if (viewerJobRef.current === key) followJob(null);
      toast.error((e as Error).message);
    } finally { setWorking((w) => w.filter((x) => x.key !== key)); }
  };
  const send = async (body: FormData) => {
    const res = await fetch('/api/uploads', { method: 'POST', body });
    const data = await res.json().catch(() => ({}));
    if (res.status === 413) throw new Error('The image is larger than 4 MB. Export it smaller and try again.');
    if (!res.ok) throw new Error(data.error ?? 'Could not save the image.');
    return data.asset as Asset;
  };
  const post = async (url: string, json?: unknown) => {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(json ?? {}) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? 'Something went wrong. Try again.');
    return data.asset as Asset;
  };

  const upload = (file: File) => (file.size > MAX_UPLOAD
    ? Promise.resolve(toast.error('The image is larger than 4 MB. Export it smaller and try again.'))
    : job(file.name.replace(/\.\w+$/, ''), async () => {
    const body = new FormData();
    body.set('file', file);
    const a = await send(body);
    if (target) onPick(a.value);
    return a;
  })).finally(() => { if (input.current) input.current.value = ''; });

  const effect = (a: Asset, label: string, make: (src: string) => Promise<Blob>) => job(`${a.name} · ${label}`, async () => {
    const blob = await make(`/api/assets/${a.id}/file`);
    const body = new FormData();
    body.set('file', new File([blob], 'effect', { type: blob.type }));
    body.set('kind', 'pixel');
    body.set('parent', a.id);
    body.set('name', `${a.name} · ${label}`);
    return send(body);
  });
  const tones: Tone[] = ['royal', 'navy'];
  const label = (t: Tone) => (t === 'royal' ? 'Royal' : 'Navy');

  const actions = (a: Asset, inViewer = false): Action[] => [
    ...(inViewer ? [] : [{ label: 'View large', icon: ZoomInAreaIcon, onSelect: () => setViewing(a.id) }]),
    ...(target ? [{ label: 'Use in the design', icon: ImageUploadIcon, onSelect: () => onPick(a.value) }, { separator: true } as const] : []),
    { label: 'Remove background', icon: Scissor01Icon, onSelect: () => job(`${a.name} · cutout`, () => post(`/api/assets/${a.id}/cutout`)) },
    { label: 'Pixel tone', icon: GridIcon, items: tones.map((t) => ({ label: label(t), onSelect: () => effect(a, `pixel tone ${label(t).toLowerCase()}`, (s) => pixelTone(s, t)) })) },
    { label: 'Pixel dissolve', icon: DashboardSquare01Icon, items: tones.map((t) => ({ label: label(t), onSelect: () => effect(a, `pixel dissolve ${label(t).toLowerCase()}`, (s) => pixelDissolve(s, t)) })) },
    { label: 'Pixel background…', icon: UserIcon, onSelect: () => setPixelBg(a) },
    { label: 'Edit with AI…', icon: MagicWand01Icon, onSelect: () => setAi({ from: a }) },
    ...(mineIds.has(a.id) ? [
      { separator: true } as const,
      { label: 'Rename…', icon: PencilEdit02Icon, onSelect: () => setRenaming(a) },
      { label: 'Remove from Assets', icon: Delete02Icon, destructive: true, onSelect: async () => {
        const res = await fetch(`/api/assets/${a.id}`, { method: 'DELETE' });
        if (res.ok) drop(a.id); else toast.error((await res.json().catch(() => ({}))).error ?? 'Could not remove it.');
      } },
    ] : []),
  ];

  const tile = (a: Asset) => {
    const face = (
      <>
        <span className="flex aspect-square items-center justify-center overflow-hidden rounded-md bg-[repeating-conic-gradient(#f2f2f2_0_25%,#fff_0_50%)] bg-[length:10px_10px] p-1 ring-1 ring-foreground/[0.06] transition-shadow group-hover:ring-primary/50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={a.thumb} alt={a.name} loading="lazy" decoding="async" className="max-h-full max-w-full object-contain" />
        </span>
        <span className="mt-1 block truncate text-left">{a.name}</span>
        <span className="block truncate text-left text-foreground/40">{whose === 'team' ? a.author : KIND[a.kind]}</span>
      </>
    );
    return (
      <ContextActions key={a.id} actions={actions(a)} className="group relative block min-w-0">
        <span className="contents" onDoubleClick={() => setViewing(a.id)}>
        {target ? (
          <button type="button" title={`Place ${a.name}`} onClick={() => onPick(a.value)} className="block w-full">{face}</button>
        ) : (
          <ClickActions actions={actions(a)} label={`${a.name}: options`} className="block w-full outline-none">{face}</ClickActions>
        )}
        </span>
        <span className="absolute top-1 right-1 flex gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
          <button type="button" aria-label={`View ${a.name} large`} title="View large" onClick={() => setViewing(a.id)}
            className="flex size-6 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm outline-none">
            <HugeiconsIcon icon={Maximize01Icon} className="size-3" />
          </button>
          <MoreActions actions={actions(a)} label={`${a.name}: options`} className="flex size-6 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm outline-none" />
        </span>
      </ContextActions>
    );
  };

  return (
    <div className="space-y-3 pb-4 text-[12px]">
      <div className="grid grid-cols-2 gap-1.5 px-3 pt-1">
        <button type="button" onClick={() => input.current?.click()}
          className="flex h-8 items-center justify-center gap-1.5 rounded-md bg-foreground/[0.05] text-foreground/80 hover:bg-foreground/[0.09]">
          <HugeiconsIcon icon={ImageUploadIcon} className="size-3.5" /> Upload
        </button>
        <button type="button" onClick={() => setAi({ from: null })}
          className="flex h-8 items-center justify-center gap-1.5 rounded-md bg-[#E6F4FF] font-medium text-primary hover:bg-[#d6ecff]">
          <HugeiconsIcon icon={AiMagicIcon} className="size-3.5" /> Generate
        </button>
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      </div>

      <div role="tablist" aria-label="Whose images" className="mx-3 grid h-8 grid-cols-2 gap-0.5 rounded-md bg-foreground/[0.05] p-0.5">
        {(['mine', 'team'] as const).map((w) => (
          <button key={w} type="button" role="tab" aria-selected={whose === w} onClick={() => setWhose(w)}
            className={`rounded-[5px] text-[12px] transition-colors ${whose === w ? 'bg-background font-medium text-foreground shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.06)]' : 'text-foreground/50 hover:text-foreground'}`}>
            {w === 'mine' ? 'Mine' : 'Team'}
          </button>
        ))}
      </div>

      <p className="px-3 text-foreground/40">{target ? 'Click an image to place it in the selected photo or logo.' : 'Click an image (or right-click) to remove its background, add a pixel effect or edit it with AI.'}</p>

      {!list.length && !working.length ? (
        <p className="px-3 py-6 text-center text-foreground/45">{whose === 'mine' ? 'Upload a photo or a logo, or generate an image.' : 'Nothing here yet.'}</p>
      ) : (
        <div className="grid grid-cols-2 gap-x-2 gap-y-3 px-3">
          {whose === 'mine' && working.map((w) => (
            <div key={w.key} className="min-w-0">
              <span className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-md bg-foreground/[0.04] text-foreground/45 ring-1 ring-foreground/[0.06]">
                <HugeiconsIcon icon={SparklesIcon} className="size-4 animate-pulse text-primary" />
                Working…
              </span>
              <span className="mt-1 block truncate">{w.label}</span>
            </div>
          ))}
          {list.map(tile)}
        </div>
      )}

      <AssetViewer list={list} id={viewing} onId={(id) => { if (!id) followJob(null); setViewing(id); }} actions={(a) => actions(a, true)}
        working={working.find((w) => w.key === viewerJob)?.label ?? null} onJob={() => { fromViewer.current = true; }} />
      <AiDialog state={ai} onClose={() => setAi(null)} onRun={(prompt, ratio) => {
        const from = ai?.from ?? null;
        setAi(null);
        job(from ? `${from.name} · edited` : prompt, () => post('/api/assets/generate', { prompt, ratio, from: from?.id }));
      }} />
      <PixelBackgroundDialog asset={pixelBg} onClose={() => setPixelBg(null)} onSave={(palette, size) => {
        const a = pixelBg!;
        const name = PALETTES.find((p) => p.key === palette)!.label.toLowerCase();
        setPixelBg(null);
        effect(a, `pixel background ${name}`, (src) => pixelBackground(src, `/api/assets/${a.id}/mask`, palette, size));
      }} />
      <RenameDialog key={renaming?.id ?? 'none'} asset={renaming} onClose={() => setRenaming(null)} onDone={(name) => {
        const a = renaming!;
        setRenaming(null);
        fetch(`/api/assets/${a.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) })
          .then(async (r) => (r.ok ? rename(a.id, name) : toast.error((await r.json().catch(() => ({}))).error ?? 'Could not rename it.')));
      }} />
    </div>
  );
}

// Generate an image, or edit one with instructions (Nano Banana through the Vercel AI Gateway).
function AiDialog({ state, onClose, onRun }: { state: { from: Asset | null } | null; onClose: () => void; onRun: (prompt: string, ratio: string) => void }) {
  const [prompt, setPrompt] = useState('');
  const [ratio, setRatio] = useState('4:5');
  const editing = !!state?.from;
  const ideas = editing
    ? ['Put the background in a bright, modern dental office', 'Make the light warmer and softer', 'Remove the people in the background']
    : ['A bright, modern dental office reception, soft daylight, no people', 'Close-up of a dental chair and lamp, clean blue tones', 'A city skyline at dusk, wide, calm sky for text'];
  const run = () => { if (prompt.trim().length >= 3) { onRun(prompt.trim(), ratio); setPrompt(''); } };
  return (
    <Dialog open={!!state} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-4 rounded-md p-6 text-[13px] sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="text-[15px] font-medium">{editing ? `Edit “${state!.from!.name}” with AI` : 'Generate an image'}</DialogTitle>
          <DialogDescription className="text-[13px]">
            {editing ? 'Say what to change. The original stays as it is; the edit is a new image.' : 'Describe the place, object or scene. Photos of people from the team are uploaded, not generated.'}
          </DialogDescription>
        </DialogHeader>
        {editing && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={state!.from!.thumb} alt="" className="h-28 w-full rounded-md bg-foreground/[0.04] object-contain" />
        )}
        <Textarea autoFocus value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} placeholder={ideas[0]}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); run(); } }} className="resize-none text-[13px]" />
        <div className="flex flex-wrap gap-1">
          {ideas.map((i) => (
            <button key={i} type="button" onClick={() => setPrompt(i)} className="rounded-full bg-foreground/[0.05] px-2.5 py-1 text-[12px] text-foreground/65 hover:bg-foreground/[0.09] hover:text-foreground">{i}</button>
          ))}
        </div>
        {!editing && (
          <div className="grid grid-cols-4 gap-0.5 rounded-md bg-foreground/[0.05] p-0.5">
            {RATIOS.map(([r, name]) => (
              <button key={r} type="button" onClick={() => setRatio(r)}
                className={`h-8 rounded-[5px] text-[12px] ${ratio === r ? 'bg-background font-medium shadow-[0_0_0_1px_rgba(0,0,0,0.06)]' : 'text-foreground/55 hover:text-foreground'}`}>
                {name} <span className="text-foreground/40">{r}</span>
              </button>
            ))}
          </div>
        )}
        <button type="button" disabled={prompt.trim().length < 3} onClick={run}
          className="flex h-9 items-center justify-center gap-1.5 rounded-md bg-primary font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
          <HugeiconsIcon icon={AiMagicIcon} className="size-4" /> {editing ? 'Edit image' : 'Generate'}
        </button>
      </DialogContent>
    </Dialog>
  );
}

function RenameDialog({ asset, onClose, onDone }: { asset: Asset | null; onClose: () => void; onDone: (name: string) => void }) {
  const [name, setName] = useState(asset?.name ?? '');
  const save = () => { const n = name.trim(); if (!n || n === asset?.name) onClose(); else onDone(n); };
  return (
    <Dialog open={!!asset} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="gap-4 rounded-md p-6 text-[13px] sm:max-w-[380px]">
        <DialogHeader><DialogTitle className="text-[15px] font-medium">Rename image</DialogTitle></DialogHeader>
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
          className="h-9 rounded-md bg-foreground/[0.04] px-3 outline-none focus:ring-1 focus:ring-primary/40" />
        <button type="button" onClick={save} className="h-9 rounded-md bg-primary font-medium text-primary-foreground hover:opacity-90">Save</button>
      </DialogContent>
    </Dialog>
  );
}

// Pixel background: the person stays as photographed; the place behind them turns into Archy's pixel
// tone in the blue chosen, so the person stands out. The person is separated once (remove background)
// and kept, so changing colours and sizes is instant.
function PixelBackgroundDialog({ asset, onClose, onSave }: { asset: Asset | null; onClose: () => void; onSave: (p: PaletteKey, s: PixelSize) => void }) {
  const [palette, setPalette] = useState<PaletteKey>('navy');
  const [size, setSize] = useState<PixelSize>('medium');
  const [images, setImages] = useState<{ photo: HTMLImageElement; mask: HTMLImageElement } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const preview = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    setImages(null); setError(null);
    if (!asset) return;
    let gone = false;
    (async () => {
      try {
        const res = await fetch(`/api/assets/${asset.id}/mask`);
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Could not separate the person.');
        // The mask is ready (and cached): the images load from their own links.
        const [photo, mask] = await Promise.all([loadImage(`/api/assets/${asset.id}/file`), loadImage(`/api/assets/${asset.id}/mask`)]);
        if (!gone) setImages({ photo, mask });
      } catch (e) { if (!gone) setError((e as Error).message); }
    })();
    return () => { gone = true; };
  }, [asset]);

  // The preview, at a size that redraws at once.
  useEffect(() => {
    const out = preview.current;
    if (!images || !out) return;
    const cv = drawPixelBackground(images.photo, images.mask, palette, size, 720);
    out.width = cv.width; out.height = cv.height;
    out.getContext('2d')!.drawImage(cv, 0, 0);
  }, [images, palette, size]);

  return (
    <Dialog open={!!asset} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-4 rounded-md p-6 text-[13px] sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="text-[15px] font-medium">Pixel background</DialogTitle>
          <DialogDescription className="text-[13px]">The person stays as photographed; the place behind them turns into Archy’s pixel tone, in the blue you choose.</DialogDescription>
        </DialogHeader>
        <div className="flex h-[340px] items-center justify-center overflow-hidden rounded-md bg-foreground/[0.04]">
          {error ? <p className="px-6 text-center text-foreground/55">{error}</p>
            : !images ? (
              <p className="flex flex-col items-center gap-2 text-foreground/50">
                <HugeiconsIcon icon={SparklesIcon} className="size-5 animate-pulse text-primary" />
                Separating the person from the background…
              </p>
            ) : <canvas ref={preview} className="max-h-full max-w-full" />}
        </div>
        <div className="space-y-2">
          <p className="text-[12px] text-foreground/50">Background</p>
          <div className="flex flex-wrap gap-1.5">
            {PALETTES.map((p) => (
              <button key={p.key} type="button" onClick={() => setPalette(p.key)}
                className={`flex h-8 items-center gap-1.5 rounded-full py-1 pr-3 pl-1 text-[12px] ring-1 transition-colors ${palette === p.key ? 'bg-[#E6F4FF] font-medium text-primary ring-primary/50' : 'ring-foreground/10 hover:bg-foreground/[0.03]'}`}>
                <span className="size-6 rounded-full ring-1 ring-black/10" style={{ background: swatch(p.key) }} /> {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-[12px] text-foreground/50">Pixel size</p>
          <div className="grid grid-cols-3 gap-0.5 rounded-md bg-foreground/[0.05] p-0.5">
            {PIXEL_SIZES.map((x) => (
              <button key={x.key} type="button" onClick={() => setSize(x.key)}
                className={`h-8 rounded-[5px] text-[12px] ${size === x.key ? 'bg-background font-medium shadow-[0_0_0_1px_rgba(0,0,0,0.06)]' : 'text-foreground/55 hover:text-foreground'}`}>{x.label}</button>
            ))}
          </div>
        </div>
        <button type="button" disabled={!images} onClick={() => onSave(palette, size)}
          className="flex h-9 items-center justify-center rounded-md bg-primary font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">Save as a new image</button>
      </DialogContent>
    </Dialog>
  );
}

// One image, large: the full file on a checkerboard (transparency shows), click to see it at 100%, its
// details beside it and everything that can be done with it. ← → move through the list, Esc closes.
function AssetViewer({ list, id, onId, actions, working, onJob }: {
  list: Asset[]; id: string | null; onId: (id: string | null) => void; actions: (a: Asset) => Action[];
  /** A job running (its label): shown over the image, whose result replaces it here. */
  working: string | null; onJob: () => void;
}) {
  const i = list.findIndex((a) => a.id === id);
  const a = i >= 0 ? list[i] : null;
  const [actual, setActual] = useState(false);
  // Per image, so a cached image that loads at once is never hidden by a later reset.
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [failedId, setFailedId] = useState<string | null>(null);
  const loaded = !!a && loadedId === a.id, failed = !!a && failedId === a.id;
  useEffect(() => { setActual(false); }, [id]);
  const go = (d: number) => { if (list.length) onId(list[(i + d + list.length) % list.length].id); };
  useEffect(() => {
    if (!a) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.('input, textarea') || actual) return; // at actual size, arrows scroll
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  // Effects run here (the view waits for the result and then shows it); actions with their own dialog
  // (pixel background, edit with AI, rename) or that place the image close the view.
  const OWN_DIALOG = /…$|^Use in the design$|^Remove from Assets$/;
  const run = (f?: () => void, label = '') => () => {
    if (OWN_DIALOG.test(label)) onId(null); else onJob();
    f?.();
  };
  const when = a ? new Date(a.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
  return (
    <Dialog open={!!a} onOpenChange={(o) => !o && onId(null)}>
      <DialogContent className="flex h-[88vh] w-[92vw] max-w-[1400px] gap-0 overflow-hidden rounded-md p-0 text-[13px] sm:max-w-[1400px]">
        {a && (
          <>
            <div className={`relative min-w-0 flex-1 bg-[repeating-conic-gradient(#efefef_0_25%,#fff_0_50%)] bg-[length:16px_16px] ${actual ? 'overflow-auto' : 'flex items-center justify-center overflow-hidden p-6'}`}>
              {/* While the full file arrives (or if it cannot): the thumbnail, sharp, at the size the image will have. */}
              {!loaded && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.thumb} alt="" aria-hidden className="absolute inset-6 h-[calc(100%-48px)] w-[calc(100%-48px)] object-contain" />
              )}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img key={a.id} src={`/api/assets/${a.id}/file`} alt={a.name} onLoad={() => setLoadedId(a.id)} onError={() => setFailedId(a.id)} onClick={() => setActual((v) => !v)}
                className={`relative transition-opacity ${loaded ? 'opacity-100' : 'opacity-0'} ${actual ? 'max-w-none cursor-zoom-out' : 'max-h-full max-w-full cursor-zoom-in object-contain'}`} />
              {!loaded && (
                <span className="absolute top-3 left-1/2 z-[1] -translate-x-1/2 rounded-full bg-background/90 px-3 py-1 text-[12px] text-foreground/65 shadow-sm">
                  {failed ? 'This image is no longer available.' : 'Loading full size…'}
                </span>
              )}
              {list.length > 1 && (
                <>
                  <button type="button" aria-label="Previous image" onClick={() => go(-1)} className="absolute top-1/2 left-3 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 shadow-md hover:bg-background">
                    <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
                  </button>
                  <button type="button" aria-label="Next image" onClick={() => go(1)} className="absolute top-1/2 right-3 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 shadow-md hover:bg-background">
                    <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
                  </button>
                </>
              )}
              {working && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-background/70 backdrop-blur-[2px]">
                  <HugeiconsIcon icon={SparklesIcon} className="size-6 animate-pulse text-primary" />
                  <p className="font-medium">Working…</p>
                  <p className="max-w-[60%] truncate text-foreground/55">{working}</p>
                </div>
              )}
              <span className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-foreground/70 px-2.5 py-1 text-[11px] text-background">
                {!loaded ? 'Preview' : actual ? 'Actual size · click to fit' : 'Click to see it at actual size'}
              </span>
            </div>
            <aside className="flex w-[280px] shrink-0 flex-col gap-5 overflow-y-auto border-l border-foreground/[0.06] p-5">
              <div className="space-y-1 pr-6">
                <DialogTitle className="text-[15px] leading-snug font-medium break-words">{a.name}</DialogTitle>
                <DialogDescription className="text-[12px] text-foreground/50">{KIND[a.kind]}{a.width && a.height ? ` · ${a.width}×${a.height}` : ''}</DialogDescription>
                <p className="text-[12px] text-foreground/50">Added by {a.author} · {when}</p>
              </div>
              {a.prompt && <p className="rounded-md bg-foreground/[0.04] p-3 text-[12px] text-foreground/70">“{a.prompt}”</p>}
              <div className="space-y-1">
                {actions(a).map((x, k) => {
                  if ('separator' in x) return <div key={k} className="my-2 h-px bg-foreground/[0.06]" />;
                  if (x.items) return (
                    <div key={x.label} className="flex items-center gap-2 py-1">
                      {x.icon && <HugeiconsIcon icon={x.icon} className="size-4 shrink-0 text-foreground/45" strokeWidth={1.6} />}
                      <span className="flex-1">{x.label}</span>
                      {x.items.map((y) => 'separator' in y ? null : (
                        <button key={y.label} type="button" disabled={!!working} onClick={run(y.onSelect, y.label)} className="h-7 rounded-md bg-foreground/[0.05] px-2.5 text-[12px] hover:bg-[#E6F4FF] hover:text-primary disabled:opacity-40">{y.label}</button>
                      ))}
                    </div>
                  );
                  return (
                    <button key={x.label} type="button" disabled={!!working && !OWN_DIALOG.test(x.label)} onClick={run(x.onSelect, x.label)}
                      className={`flex h-8 w-full items-center gap-2 rounded-md px-2 text-left hover:bg-foreground/[0.04] disabled:opacity-40 ${x.destructive ? 'text-destructive' : ''}`}>
                      {x.icon && <HugeiconsIcon icon={x.icon} className="size-4 shrink-0 text-foreground/45" strokeWidth={1.6} />}
                      {x.label}
                    </button>
                  );
                })}
                <a href={`/api/assets/${a.id}/file?download=1`} className="flex h-8 w-full items-center gap-2 rounded-md px-2 hover:bg-foreground/[0.04]">
                  <HugeiconsIcon icon={Download04Icon} className="size-4 shrink-0 text-foreground/45" strokeWidth={1.6} /> Download
                </a>
              </div>
              {list.length > 1 && <p className="mt-auto text-[11px] text-foreground/35">{i + 1} of {list.length} · ← → to move</p>}
            </aside>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
