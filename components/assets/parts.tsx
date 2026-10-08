'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon, Folder01Icon, Maximize01Icon, SparklesIcon } from '@hugeicons/core-free-icons';
import { ClickActions, ContextActions, MoreActions } from '@/components/action-menu';
import type { Asset, Folder } from '@/lib/assets';
import { KIND } from './session';
import type { AssetLibrary } from './use-asset-library';

const DRAG = 'application/x-studio-assets';
const dropped = (e: React.DragEvent): string[] => { try { return JSON.parse(e.dataTransfer.getData(DRAG) || '[]'); } catch { return []; } };

// One image: click (place it, or its menu), ⌘/Shift-click to mark it, drag it onto a folder.
// `onOpen`: a plain click opens it somewhere instead of its menu (the page's detail panel).
export function AssetTile({ lib, a, onOpen, selected }: { lib: AssetLibrary; a: Asset; onOpen?: (a: Asset) => void; selected?: boolean }) {
  const isPicked = lib.picked.includes(a.id);
  const face = (
    <>
      <span className={`flex aspect-square items-center justify-center overflow-hidden rounded-md bg-[repeating-conic-gradient(#f2f2f2_0_25%,#fff_0_50%)] bg-[length:10px_10px] p-1 ring-1 transition-shadow ${selected ? 'ring-2 ring-primary' : 'ring-foreground/[0.06] group-hover:ring-primary/50'}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={a.thumb} alt={a.name} loading="lazy" decoding="async" draggable={false} className="max-h-full max-w-full object-contain" />
      </span>
      <span className="mt-1 block truncate text-left">{a.name}</span>
      <span className="block truncate text-left text-foreground/40">{lib.whose === 'team' ? a.author : KIND[a.kind]}</span>
    </>
  );
  // ⌘/Shift-click picks several (to move together); a plain click does what it always did.
  const pickClick = (e: React.MouseEvent) => {
    if (!(e.metaKey || e.ctrlKey || e.shiftKey)) return;
    e.preventDefault(); e.stopPropagation();
    lib.setPicked((p) => (p.includes(a.id) ? p.filter((x) => x !== a.id) : [...p, a.id]));
  };
  return (
    <ContextActions actions={lib.actions(a)} className={`group relative block min-w-0 rounded-md ${isPicked ? 'ring-2 ring-primary ring-offset-2' : ''}`}>
      <div aria-pressed={isPicked} onDoubleClick={() => lib.setViewing(a.id)} onClickCapture={pickClick}
        // ⌘/Shift on press: marking, not opening anything.
        onMouseDownCapture={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey) { e.preventDefault(); e.stopPropagation(); } }}
        draggable onDragStart={(e) => {
          e.dataTransfer.setData(DRAG, JSON.stringify(isPicked ? lib.shownPicked : [a.id]));
          e.dataTransfer.effectAllowed = 'move';
        }}>
        {lib.target ? (
          <button type="button" title={`Place ${a.name}`} onClick={() => lib.onPick(a.value)} className="block w-full">{face}</button>
        ) : onOpen ? (
          <button type="button" onClick={() => onOpen(a)} className="block w-full outline-none">{face}</button>
        ) : (
          <ClickActions actions={lib.actions(a)} label={`${a.name}: options`} className="block w-full outline-none">{face}</ClickActions>
        )}
      </div>
      <span className="absolute top-1 right-1 flex gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
        <button type="button" aria-label={`View ${a.name} large`} title="View large" onClick={() => lib.setViewing(a.id)}
          className="flex size-6 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm outline-none">
          <HugeiconsIcon icon={Maximize01Icon} className="size-3" />
        </button>
        <MoreActions actions={lib.actions(a)} label={`${a.name}: options`} className="flex size-6 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm outline-none" />
      </span>
    </ContextActions>
  );
}

// A drop target for images (a folder, or "out of any folder"): images moved there, or files from the
// desktop uploaded there.
export function dropProps(lib: AssetLibrary, key: string, to: string | null) {
  const takes = (e: React.DragEvent) => e.dataTransfer.types.includes(DRAG) || e.dataTransfer.types.includes('Files');
  return {
    onDragOver: (e: React.DragEvent) => { if (takes(e)) { e.preventDefault(); lib.setDropOn(key); } },
    onDragLeave: (e: React.DragEvent) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) lib.setDropOn(null); },
    onDrop: (e: React.DragEvent) => {
      if (!takes(e)) return;
      e.preventDefault(); e.stopPropagation(); lib.setDropOn(null);
      if (e.dataTransfer.types.includes(DRAG)) lib.move(dropped(e), to);
      else lib.uploadMany([...e.dataTransfer.files], to);
    },
  };
}

export function FolderCard({ lib, f }: { lib: AssetLibrary; f: Folder }) {
  const on = lib.dropOn === f.id;
  return (
    <ContextActions actions={lib.folderActions(f)} className="block min-w-0">
      <button type="button" onClick={() => lib.setFolder(f.id)} {...dropProps(lib, f.id, f.id)}
        className={`flex h-10 w-full items-center gap-2 rounded-md px-2 text-left ring-1 transition-colors ${on ? 'bg-[#E6F4FF] ring-primary/60' : 'bg-foreground/[0.03] ring-foreground/[0.06] hover:bg-foreground/[0.06]'}`}>
        <HugeiconsIcon icon={Folder01Icon} className={`size-4 shrink-0 ${on ? 'text-primary' : 'text-foreground/45'}`} strokeWidth={1.6} />
        <span className="min-w-0 flex-1">
          <span className="block truncate">{f.name}</span>
          <span className="block text-[11px] text-foreground/40">{lib.count(f.id)} image{lib.count(f.id) === 1 ? '' : 's'}</span>
        </span>
      </button>
    </ContextActions>
  );
}

export function SelectionBar({ lib, className = '' }: { lib: AssetLibrary; className?: string }) {
  if (!lib.shownPicked.length) return null;
  const from = lib.folder === 'all' ? null : lib.folder;
  return (
    <div className={`flex items-center gap-1 rounded-md bg-[#E6F4FF] py-1 pr-1 pl-2.5 text-primary ${className}`}>
      <span className="flex-1 font-medium">{lib.shownPicked.length} selected</span>
      <ClickActions actions={lib.moveItems(lib.shownPicked, from)} label="Move to folder"
        className="flex h-7 items-center gap-1 rounded-md px-2 text-[12px] font-medium outline-none hover:bg-white/60">
        <HugeiconsIcon icon={Folder01Icon} className="size-3.5" /> Move to
      </ClickActions>
      <button type="button" title="Clear" aria-label="Clear the selection" onClick={() => lib.setPicked([])} className="flex size-7 items-center justify-center rounded-md hover:bg-white/60">
        <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
      </button>
    </div>
  );
}

// Placeholders of the jobs that land where the list is.
export function WorkingTiles({ lib }: { lib: AssetLibrary }) {
  if (lib.whose !== 'mine') return null;
  return (
    <>
      {lib.working.filter((w) => lib.folder === 'all' || w.folder === lib.folder).map((w) => (
        <div key={w.key} className="min-w-0">
          <span className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-md bg-foreground/[0.04] text-foreground/45 ring-1 ring-foreground/[0.06]">
            <HugeiconsIcon icon={SparklesIcon} className="size-4 animate-pulse text-primary" />
            Working…
          </span>
          <span className="mt-1 block truncate">{w.label}</span>
        </div>
      ))}
    </>
  );
}
export const hasWorking = (lib: AssetLibrary) => lib.whose === 'mine' && lib.working.some((w) => lib.folder === 'all' || w.folder === lib.folder);

export function WhoseTabs({ lib, className = '' }: { lib: AssetLibrary; className?: string }) {
  return (
    <div role="tablist" aria-label="Whose images" className={`grid h-8 grid-cols-2 gap-0.5 rounded-md bg-foreground/[0.05] p-0.5 ${className}`}>
      {(['mine', 'team'] as const).map((w) => (
        <button key={w} type="button" role="tab" aria-selected={lib.whose === w} onClick={() => lib.setWhose(w)}
          className={`rounded-[5px] px-3 text-[12px] transition-colors ${lib.whose === w ? 'bg-background font-medium text-foreground shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.06)]' : 'text-foreground/50 hover:text-foreground'}`}>
          {w === 'mine' ? 'Mine' : 'Team'}
        </button>
      ))}
    </div>
  );
}
