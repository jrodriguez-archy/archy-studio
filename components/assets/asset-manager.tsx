'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  AiMagicIcon, Cancel01Icon, Download04Icon, Folder01Icon, FolderAddIcon, ImageUploadIcon, Image02Icon, Search01Icon, SparklesIcon,
} from '@hugeicons/core-free-icons';
import { ContextActions, type Action } from '@/components/action-menu';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { Asset, Folder } from '@/lib/assets';
import { StackBadge, StackLayers, stackPad } from '@/components/stack';
import { AssetTile, SelectionBar, WhoseTabs, WorkingTiles, dropProps, hasWorking } from './parts';
import { KIND, type Lists } from './session';
import { useAssetLibrary, type AssetLibrary } from './use-asset-library';

type Design = { id: string; title: string; format: string; thumb: string | null; ids: string[] };

// Assets (Create → Assets): the team's images, wide. Folders on the left, the images in the middle,
// the one picked on the right with everything that can be done with it. The same library as Canvas.
export function AssetManager({ assets, folders, designs }: { assets: Lists; folders: Folder[]; designs: { mine: Design[]; team: Design[] } }) {
  const router = useRouter();
  const [using, setUsing] = useState<Asset | null>(null);
  const lib = useAssetLibrary({ assets, folders, start: 'all', onUseInDesign: setUsing });
  const [focus, setFocus] = useState<string | null>(null);
  const focused = focus ? lib.find(focus) : null;
  // A result made from the image open on the right takes its place there.
  useEffect(() => { if (lib.lastMade && focus) setFocus(lib.lastMade.id); }, [lib.lastMade]); // eslint-disable-line react-hooks/exhaustive-deps
  const input = useRef<HTMLInputElement>(null);
  // Files dragged in from the desktop: the whole page takes them (or a folder, for that folder).
  const [filesOver, setFilesOver] = useState(false);
  const hasFiles = (e: React.DragEvent) => e.dataTransfer.types.includes('Files');

  return (
    <div className="-mt-1 flex min-h-[calc(100dvh-7rem)] flex-col text-[13px]"
      onDragOver={(e) => { if (hasFiles(e)) { e.preventDefault(); setFilesOver(true); } }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setFilesOver(false); }}
      onDrop={(e) => { if (!hasFiles(e)) return; e.preventDefault(); setFilesOver(false); lib.uploadMany([...e.dataTransfer.files]); }}
      onKeyDown={(e) => { if (e.key === 'Escape' && lib.picked.length) lib.setPicked([]); }}>
      <div className="mb-5 flex items-center gap-3">
        <h1 className="flex-1 text-[26px] leading-tight font-medium tracking-[-0.02em]">Assets</h1>
        <button type="button" onClick={() => input.current?.click()}
          className="flex h-9 items-center gap-1.5 rounded-md bg-foreground/[0.05] px-3.5 text-foreground/80 hover:bg-foreground/[0.09]">
          <HugeiconsIcon icon={ImageUploadIcon} className="size-4" /> Upload
        </button>
        <button type="button" onClick={lib.generate}
          className="flex h-9 items-center gap-1.5 rounded-md bg-primary px-3.5 font-medium text-primary-foreground hover:opacity-90">
          <HugeiconsIcon icon={AiMagicIcon} className="size-4" /> Generate
        </button>
        <input ref={input} type="file" multiple accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden
          onChange={(e) => { lib.uploadMany([...(e.target.files ?? [])]); e.target.value = ''; }} />
      </div>

      <div className="flex min-h-0 flex-1 gap-6">
        <FolderColumn lib={lib} />

        <section className="relative min-w-0 flex-1">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <label className="flex h-8 min-w-[200px] flex-1 items-center gap-2 rounded-md bg-foreground/[0.04] px-2.5 focus-within:ring-1 focus-within:ring-primary/40 sm:max-w-[320px]">
              <HugeiconsIcon icon={Search01Icon} className="size-3.5 text-foreground/40" />
              <input value={lib.query} onChange={(e) => lib.setQuery(e.target.value)} placeholder="Search by name" className="w-full bg-transparent outline-none" />
              {lib.query && <button type="button" aria-label="Clear the search" onClick={() => lib.setQuery('')} className="text-foreground/40 hover:text-foreground"><HugeiconsIcon icon={Cancel01Icon} className="size-3.5" /></button>}
            </label>
            <WhoseTabs lib={lib} />
            <div className="flex flex-wrap gap-1">
              {([null, 'upload', 'cutout', 'pixel', 'generated'] as const).map((k) => (
                <button key={k ?? 'all'} type="button" onClick={() => lib.setKind(k)}
                  className={`h-7 rounded-full px-2.5 text-[12px] transition-colors ${lib.kind === k ? 'bg-[#E6F4FF] font-medium text-primary' : 'text-foreground/55 hover:bg-foreground/[0.05] hover:text-foreground'}`}>
                  {k ? KIND[k] : 'All types'}
                </button>
              ))}
            </div>
          </div>
          <SelectionBar lib={lib} className="mb-3" />

          {!lib.list.length && !hasWorking(lib) ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-foreground/15 py-24 text-center text-foreground/50">
              <HugeiconsIcon icon={Image02Icon} className="size-6 text-foreground/30" strokeWidth={1.5} />
              <p>{lib.query ? 'No images with that name.' : lib.here ? 'Empty folder.' : 'Nothing here yet.'}</p>
              {!lib.query && <p className="text-[12px] text-foreground/40">Drop images here, or upload them.</p>}
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-x-3 gap-y-4 text-[12px]">
              <WorkingTiles lib={lib} />
              {lib.list.map((a) => <AssetTile key={a.id} lib={lib} a={a} onOpen={(x) => setFocus(x.id)} selected={focus === a.id} />)}
            </div>
          )}

          {filesOver && (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl border-2 border-dashed border-primary bg-[#E6F4FF]/80 text-[15px] font-medium text-primary">
              Drop to upload{lib.here ? ` to ${lib.here.name}` : ''}
            </div>
          )}
        </section>

        {focused && <Detail lib={lib} a={focused} onClose={() => setFocus(null)} />}
      </div>

      {lib.dialogs}
      <UseInDesign asset={using} designs={designs} onClose={() => setUsing(null)} onPick={(d) => { const a = using!; setUsing(null); router.push(`/canvas/${d.id}?asset=${a.id}`); }} />
    </div>
  );
}

function FolderColumn({ lib }: { lib: AssetLibrary }) {
  const row = (key: string, label: React.ReactNode, active: boolean, onClick: () => void, drop?: ReturnType<typeof dropProps>, count?: number) => (
    <button type="button" onClick={onClick} {...drop}
      className={`flex h-8 w-full items-center gap-2 rounded-md px-2 text-left transition-colors ${lib.dropOn === key ? 'bg-[#E6F4FF] text-primary ring-1 ring-primary/50' : active ? 'bg-background font-medium shadow-[0_0_0_1px_rgba(0,0,0,0.06)]' : 'text-foreground/65 hover:bg-foreground/[0.04] hover:text-foreground'}`}>
      <HugeiconsIcon icon={key === 'all' ? Image02Icon : Folder01Icon} className={`size-4 shrink-0 ${active ? 'text-primary' : 'text-foreground/40'}`} strokeWidth={1.6} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count !== undefined && <span className="text-[11px] text-foreground/35 tabular-nums">{count}</span>}
    </button>
  );
  return (
    <aside className="hidden w-[220px] shrink-0 space-y-0.5 md:block">
      {row('all', 'All images', lib.folder === 'all' && !lib.searching, () => { lib.setQuery(''); lib.setFolder('all'); })}
      {row('none', 'No folder', lib.folder === null && !lib.searching, () => { lib.setQuery(''); lib.setFolder(null); }, dropProps(lib, 'none', null))}
      <div className="flex items-center px-2 pt-4 pb-1">
        <span className="flex-1 text-[11px] font-medium tracking-[0.02em] text-foreground/40">Folders</span>
        <button type="button" onClick={() => lib.newFolder()} aria-label="New folder" title="New folder" className="flex size-6 items-center justify-center rounded-md text-foreground/45 hover:bg-foreground/[0.05] hover:text-foreground">
          <HugeiconsIcon icon={FolderAddIcon} className="size-3.5" />
        </button>
      </div>
      {lib.folders.map((f) => (
        <ContextActions key={f.id} actions={lib.folderActions(f)} className="block">
          {row(f.id, f.name, lib.folder === f.id && !lib.searching, () => { lib.setQuery(''); lib.setFolder(f.id); }, dropProps(lib, f.id, f.id), lib.count(f.id))}
        </ContextActions>
      ))}
    </aside>
  );
}

// The image picked: large, its details (name editable when it is yours) and everything it can do.
function Detail({ lib, a, onClose }: { lib: AssetLibrary; a: Asset; onClose: () => void }) {
  const [name, setName] = useState(a.name);
  useEffect(() => setName(a.name), [a.id, a.name]);
  const mine = lib.mineIds.has(a.id);
  const when = new Date(a.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const folderName = a.folderId ? lib.folders.find((f) => f.id === a.folderId)?.name : null;
  const working = lib.working.some((w) => w.folder === (a.folderId ?? null));
  return (
    <aside className="sticky top-6 hidden max-h-[calc(100dvh-3rem)] w-[320px] shrink-0 flex-col overflow-y-auto rounded-xl bg-background p-4 shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_8px_24px_-12px_rgba(0,0,0,0.15)] lg:flex">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[12px] text-foreground/45">{KIND[a.kind]}{a.width && a.height ? ` · ${a.width}×${a.height}` : ''}</span>
        <button type="button" aria-label="Close" onClick={onClose} className="flex size-7 items-center justify-center rounded-md text-foreground/45 hover:bg-foreground/[0.05] hover:text-foreground">
          <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
        </button>
      </div>
      <button type="button" onClick={() => lib.setViewing(a.id)} title="View large"
        className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg bg-[repeating-conic-gradient(#f2f2f2_0_25%,#fff_0_50%)] bg-[length:12px_12px] p-2 ring-1 ring-foreground/[0.06] cursor-zoom-in">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img key={a.id} src={`/api/assets/${a.id}/file`} alt={a.name} className="max-h-full max-w-full object-contain" />
        {working && (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-background/70 text-foreground/60 backdrop-blur-[2px]">
            <HugeiconsIcon icon={SparklesIcon} className="size-5 animate-pulse text-primary" /> Working…
          </span>
        )}
      </button>
      {mine ? (
        <input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => lib.renameTo(a, name)} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          aria-label="Name" className="mt-3 h-9 w-full rounded-md px-2 text-[15px] font-medium outline-none hover:bg-foreground/[0.04] focus:bg-foreground/[0.04] focus:ring-1 focus:ring-primary/40" />
      ) : <p className="mt-3 px-2 text-[15px] font-medium break-words">{a.name}</p>}
      <p className="px-2 text-[12px] text-foreground/45">{a.author} · {when}{folderName ? ` · ${folderName}` : ''}</p>
      {a.prompt && <p className="mx-2 mt-3 rounded-md bg-foreground/[0.04] p-2.5 text-[12px] text-foreground/65">“{a.prompt}”</p>}
      <div className="mt-4 space-y-0.5 border-t border-foreground/[0.06] pt-3">
        <ActionRows actions={lib.actions(a, true)} />
        <a href={`/api/assets/${a.id}/file?download=1`} className="flex h-8 items-center gap-2 rounded-md px-2 hover:bg-foreground/[0.04]">
          <HugeiconsIcon icon={Download04Icon} className="size-4 text-foreground/45" strokeWidth={1.6} /> Download
        </a>
      </div>
    </aside>
  );
}

// A menu's actions as rows (sub-menus as small buttons on their row).
function ActionRows({ actions }: { actions: Action[] }) {
  return (
    <>
      {actions.map((x, k) => {
        if ('separator' in x) return <div key={k} className="my-1.5 h-px bg-foreground/[0.06]" />;
        if (x.items) return (
          <div key={x.label} className="flex flex-wrap items-center gap-1.5 px-2 py-1">
            {x.icon && <HugeiconsIcon icon={x.icon} className="size-4 shrink-0 text-foreground/45" strokeWidth={1.6} />}
            <span className="mr-auto">{x.label}</span>
            {x.items.map((y) => ('separator' in y ? null : (
              <button key={y.label} type="button" onClick={y.onSelect} className="h-7 max-w-full truncate rounded-md bg-foreground/[0.05] px-2 text-[12px] hover:bg-[#E6F4FF] hover:text-primary">{y.label}</button>
            )))}
          </div>
        );
        return (
          <button key={x.label} type="button" onClick={x.onSelect}
            className={`flex h-8 w-full items-center gap-2 rounded-md px-2 text-left hover:bg-foreground/[0.04] ${x.destructive ? 'text-destructive' : ''}`}>
            {x.icon && <HugeiconsIcon icon={x.icon} className="size-4 shrink-0 text-foreground/45" strokeWidth={1.6} />}
            {x.label}
          </button>
        );
      })}
    </>
  );
}

// "Use in a design": pick a recent design; Canvas opens it with this image ready to place.
function UseInDesign({ asset, designs, onClose, onPick }: { asset: Asset | null; designs: { mine: Design[]; team: Design[] }; onClose: () => void; onPick: (d: Design) => void }) {
  const [whose, setWhose] = useState<'mine' | 'team'>('mine');
  const list = (whose === 'mine' ? designs.mine : designs.team).slice(0, 48);
  return (
    <Dialog open={!!asset} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-4 rounded-md p-6 text-[13px] sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle className="text-[15px] font-medium">Use “{asset?.name}” in a design</DialogTitle>
          <DialogDescription className="text-[13px]">Pick a design. It opens in Canvas with this image ready.</DialogDescription>
        </DialogHeader>
        <div className="grid h-8 w-48 grid-cols-2 gap-0.5 rounded-md bg-foreground/[0.05] p-0.5">
          {(['mine', 'team'] as const).map((w) => (
            <button key={w} type="button" onClick={() => setWhose(w)} className={`rounded-[5px] text-[12px] ${whose === w ? 'bg-background font-medium shadow-[0_0_0_1px_rgba(0,0,0,0.06)]' : 'text-foreground/50'}`}>{w === 'mine' ? 'Mine' : 'Team'}</button>
          ))}
        </div>
        {list.length ? (
          <div className="grid max-h-[50vh] grid-cols-4 gap-3 overflow-y-auto pr-1">
            {list.map((d) => (
              <button key={d.id} type="button" onClick={() => onPick(d)} className={`group min-w-0 text-left ${stackPad(d.ids.length)}`}>
                <span className="relative block">
                  <StackLayers n={d.ids.length} />
                  <span className="relative flex aspect-square items-center justify-center overflow-hidden rounded-md bg-[#F4F4F5] p-1.5 ring-1 ring-foreground/[0.06] group-hover:ring-primary/50">
                    <StackBadge n={d.ids.length} />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {d.thumb && <img src={d.thumb} alt="" loading="lazy" className="max-h-full max-w-full rounded-[2px]" />}
                  </span>
                </span>
                <span className="mt-1 block truncate">{d.title}</span>
                <span className="block truncate text-[12px] text-foreground/40">{d.format}</span>
              </button>
            ))}
          </div>
        ) : <p className="py-8 text-center text-foreground/45">No designs yet.</p>}
      </DialogContent>
    </Dialog>
  );
}
