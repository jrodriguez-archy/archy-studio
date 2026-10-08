'use client';

import { useEffect, useRef, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { AiMagicIcon, ArrowLeft01Icon, ArrowRight01Icon, Download04Icon, SparklesIcon } from '@hugeicons/core-free-icons';
import type { Action } from '@/components/action-menu';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import type { Asset } from '@/lib/assets';
import { PALETTES, PIXEL_SIZES, drawPixelBackground, loadImage, swatch, type PaletteKey, type PixelSize } from '@/lib/pixel-effects';
import { KIND, RATIOS } from './session';

// Generate an image, or edit one with instructions (Nano Banana through the Vercel AI Gateway).
export function AiDialog({ state, onClose, onRun }: { state: { from: Asset | null } | null; onClose: () => void; onRun: (prompt: string, ratio: string) => void }) {
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

export function RenameDialog({ asset, onClose, onDone }: { asset: Asset | null; onClose: () => void; onDone: (name: string) => void }) {
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
export function PixelBackgroundDialog({ asset, onClose, onSave }: { asset: Asset | null; onClose: () => void; onSave: (p: PaletteKey, s: PixelSize) => void }) {
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
export function AssetViewer({ list, id, onId, actions, working, onJob }: {
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

// A name for something (a new folder, a folder renamed).
export function NameDialog({ state, onClose }: { state: { title: string; action: string; initial: string; done: (name: string) => void } | null; onClose: () => void }) {
  const [name, setName] = useState(state?.initial ?? '');
  const save = () => { const n = name.trim(); if (!n || n === state?.initial) { onClose(); return; } state!.done(n); onClose(); };
  return (
    <Dialog open={!!state} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="gap-4 rounded-md p-6 text-[13px] sm:max-w-[380px]">
        <DialogHeader><DialogTitle className="text-[15px] font-medium">{state?.title}</DialogTitle></DialogHeader>
        <input autoFocus value={name} placeholder="Speakers, Partner logos…" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
          className="h-9 rounded-md bg-foreground/[0.04] px-3 outline-none focus:ring-1 focus:ring-primary/40" />
        <button type="button" disabled={!name.trim()} onClick={save} className="h-9 rounded-md bg-primary font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">{state?.action}</button>
      </DialogContent>
    </Dialog>
  );
}

export function ConfirmDialog({ state, onClose }: { state: { title: string; text: string; action: string; done: () => void } | null; onClose: () => void }) {
  return (
    <Dialog open={!!state} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="gap-4 rounded-md p-6 text-[13px] sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="text-[15px] font-medium">{state?.title}</DialogTitle>
          <DialogDescription className="text-[13px]">{state?.text}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={onClose} className="h-9 rounded-md bg-foreground/[0.05] hover:bg-foreground/[0.09]">Cancel</button>
          <button type="button" onClick={() => { state?.done(); onClose(); }} className="h-9 rounded-md bg-destructive font-medium text-white hover:opacity-90">{state?.action}</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}