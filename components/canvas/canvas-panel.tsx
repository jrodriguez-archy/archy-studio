'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { HugeiconsIcon } from '@hugeicons/react';
import { AiChat02Icon, Image01Icon, ImageUploadIcon, Layers01Icon, LibraryIcon } from '@hugeicons/core-free-icons';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { CanvasLibrary } from '@/lib/canvas';

export type PanelTab = 'layers' | 'library' | 'assets' | 'claude';
const TABS: { key: PanelTab; label: string; icon: typeof Layers01Icon }[] = [
  { key: 'layers', label: 'Layers', icon: Layers01Icon },
  { key: 'library', label: 'Library', icon: LibraryIcon },
  { key: 'assets', label: 'Assets', icon: Image01Icon },
  { key: 'claude', label: 'Claude', icon: AiChat02Icon },
];
const CATEGORY: Record<string, string> = { events: 'Events', ads: 'Ads', other: 'More' };

// Canvas's own sidebar (Relume-like): a rail of tabs and the open tab.
export function CanvasPanel({ tab, onTab, children }: { tab: PanelTab; onTab: (t: PanelTab) => void; children: React.ReactNode }) {
  return (
    <aside className="flex w-[300px] shrink-0 border-r border-foreground/[0.06] bg-background max-md:hidden">
      <div className="flex w-11 shrink-0 flex-col items-center gap-1 border-r border-foreground/[0.06] py-2">
        {TABS.map((t) => (
          <Tooltip key={t.key}>
            <TooltipTrigger render={<button type="button" onClick={() => onTab(t.key)} aria-label={t.label} aria-pressed={tab === t.key} />}
              className={`flex size-8 items-center justify-center rounded-md transition-colors ${tab === t.key ? 'bg-[#E6F4FF] text-primary' : 'text-foreground/45 hover:bg-foreground/[0.05] hover:text-foreground'}`}>
              <HugeiconsIcon icon={t.icon} className="size-4" strokeWidth={1.6} />
            </TooltipTrigger>
            <TooltipContent side="right">{t.label}</TooltipContent>
          </Tooltip>
        ))}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="shrink-0 px-3 pt-3 pb-1 text-[13px] font-medium">{TABS.find((t) => t.key === tab)?.label}</p>
        <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:thin]">{children}</div>
      </div>
    </aside>
  );
}

function Segmented<T extends string>({ value, items, onChange }: { value: T; items: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="mx-3 my-2 grid h-7 grid-flow-col items-center gap-0.5 rounded-[5px] bg-foreground/[0.05] p-0.5 text-[12px]">
      {items.map(([k, label]) => (
        <button key={k} type="button" onClick={() => onChange(k)}
          className={`h-6 rounded-[4px] ${value === k ? 'bg-background font-medium shadow-[0_0_0_1px_rgba(0,0,0,0.06)]' : 'text-foreground/55 hover:text-foreground'}`}>{label}</button>
      ))}
    </div>
  );
}

// Library: start from a template (it opens with its sample copy) or open a piece already made.
export function LibraryTab({ library, current, confirmLeave }: { library: CanvasLibrary; current?: string; confirmLeave: () => boolean }) {
  const router = useRouter();
  const [view, setView] = useState<'pieces' | 'templates'>(current ? 'pieces' : 'templates');
  const [whose, setWhose] = useState<'mine' | 'team'>('mine');
  const go = (href: string) => { if (confirmLeave()) router.push(href); };
  const pieces = whose === 'mine' ? library.mine : library.team;
  const cats = [...new Set(library.templates.map((t) => t.category))];
  return (
    <div className="pb-4 text-[12px]">
      <Segmented value={view} items={[['templates', 'Templates'], ['pieces', 'Pieces']]} onChange={setView} />
      {view === 'pieces' ? (
        <>
          <div className="flex gap-3 px-3 pb-2">
            {(['mine', 'team'] as const).map((w) => (
              <button key={w} type="button" onClick={() => setWhose(w)} className={whose === w ? 'font-medium text-foreground' : 'text-foreground/45 hover:text-foreground'}>{w === 'mine' ? 'Mine' : 'Team'}</button>
            ))}
          </div>
          {!pieces.length && <p className="px-3 py-6 text-center text-foreground/45">No pieces yet. Start from a template, or ask Claude for one.</p>}
          <div className="grid grid-cols-2 gap-x-2 gap-y-3 px-3">
            {pieces.map((p) => (
              <button key={p.id} type="button" onClick={() => go(`/canvas/${p.id}`)} className="group text-left">
                <div className={`flex aspect-square items-center justify-center overflow-hidden rounded-md bg-foreground/[0.04] p-1.5 ring-1 transition-colors ${p.id === current ? 'ring-2 ring-primary' : 'ring-foreground/[0.06] group-hover:ring-primary/40'}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {p.thumb && <img src={p.thumb} alt="" loading="lazy" className="max-h-full max-w-full rounded-[2px]" style={{ aspectRatio: `${p.width} / ${p.height}` }} />}
                </div>
                <p className="mt-1 truncate">{p.title}</p>
                <p className="truncate text-foreground/40">{p.format}{whose === 'team' ? ` · ${p.author}` : ''}</p>
              </button>
            ))}
          </div>
        </>
      ) : (
        cats.map((cat) => (
          <div key={cat} className="pb-3">
            <p className="px-3 pt-2 pb-1.5 text-[11px] font-medium tracking-[0.02em] text-foreground/40">{CATEGORY[cat] ?? cat}</p>
            <div className="space-y-2 px-3">
              {library.templates.filter((t) => t.category === cat).map((t) => (
                <div key={t.id} className="flex gap-2.5 rounded-md p-1.5 hover:bg-foreground/[0.03]">
                  <button type="button" onClick={() => go(`/canvas/new?template=${t.id}&format=${t.formats[0].key}`)} className="size-14 shrink-0 overflow-hidden rounded-[4px] bg-foreground/[0.04] ring-1 ring-foreground/[0.06] hover:ring-primary/40">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/preview/${t.id}/${t.formats[0].key}`} alt="" loading="lazy" className="size-full object-cover object-top" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{t.title}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {t.formats.map((f) => (
                        <button key={f.key} type="button" onClick={() => go(`/canvas/new?template=${t.id}&format=${f.key}`)} title={`${f.width}×${f.height}`}
                          className="h-5 rounded-[3px] bg-foreground/[0.05] px-1.5 text-[11px] text-foreground/70 hover:bg-[#E6F4FF] hover:text-primary">{f.label}</button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// Assets: the approved images and the person's uploads. A click places it in the selected photo or logo.
export function AssetsTab({ library, target, onPick }: { library: CanvasLibrary; target: string | null; onPick: (value: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [uploads, setUploads] = useState(library.uploads);
  const [busy, setBusy] = useState(false);
  const pick = (value: string) => (target ? onPick(value) : toast('Select a photo or a logo on the piece first.'));
  const upload = async (file: File) => {
    setBusy(true);
    try {
      const body = new FormData();
      body.set('file', file);
      const res = await fetch('/api/uploads', { method: 'POST', body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not upload the image.');
      setUploads((u) => [{ value: data.value, title: file.name, kind: 'upload', url: data.url }, ...u]);
      if (target) onPick(data.value);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };
  const grid = (items: CanvasLibrary['images']) => (
    <div className="grid grid-cols-3 gap-1.5 px-3">
      {items.map((a) => (
        <button key={a.value} type="button" title={a.title} onClick={() => pick(a.value)}
          className="aspect-square overflow-hidden rounded-md bg-[repeating-conic-gradient(#f2f2f2_0_25%,#fff_0_50%)] bg-[length:10px_10px] ring-1 ring-foreground/[0.06] hover:ring-primary">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={a.url} alt={a.title} loading="lazy" className="size-full object-contain" />
        </button>
      ))}
    </div>
  );
  return (
    <div className="space-y-4 pb-4 text-[12px]">
      <div className="px-3 pt-1">
        <button type="button" disabled={busy} onClick={() => input.current?.click()}
          className="flex h-8 w-full items-center justify-center gap-1.5 rounded-md bg-foreground/[0.05] text-foreground/80 hover:bg-foreground/[0.09] disabled:opacity-50">
          <HugeiconsIcon icon={ImageUploadIcon} className="size-3.5" /> {busy ? 'Uploading…' : 'Upload an image'}
        </button>
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        <p className="mt-1.5 text-foreground/40">{target ? 'Click an image to place it in the selected photo or logo.' : 'Select a photo or a logo on the piece, then click an image.'}</p>
      </div>
      <div>
        <p className="px-3 pb-1.5 text-[11px] font-medium tracking-[0.02em] text-foreground/40">Approved images</p>
        {grid(library.images)}
      </div>
      <div>
        <p className="px-3 pb-1.5 text-[11px] font-medium tracking-[0.02em] text-foreground/40">My uploads</p>
        {uploads.length ? grid(uploads) : <p className="px-3 text-foreground/40">Nothing uploaded yet.</p>}
      </div>
    </div>
  );
}
