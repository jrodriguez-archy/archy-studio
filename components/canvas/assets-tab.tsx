'use client';

import { useEffect, useRef } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { AiMagicIcon, ArrowLeft01Icon, FolderAddIcon, ImageUploadIcon, InformationCircleIcon } from '@hugeicons/core-free-icons';
import { MoreActions } from '@/components/action-menu';
import { AssetTile, FolderCard, SelectionBar, WhoseTabs, WorkingTiles, dropProps, hasWorking } from '@/components/assets/parts';
import { useAssetLibrary } from '@/components/assets/use-asset-library';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { Folder } from '@/lib/assets';
import type { Lists } from '@/components/assets/session';

export { withSession } from '@/components/assets/session';

// Assets in Canvas: the team's library (the same as the Assets page), narrow. Click an image to place it
// in the selected photo or logo (or, with nothing selected, to see what can be done with it).
// `highlight`: an image to point at (opened from the Assets page with "Use in a design").
export function AssetsTab({ assets, folders, target, onPick, highlight }: { assets: Lists; folders: Folder[]; target: string | null; onPick: (value: string) => void; highlight?: string | null }) {
  const lib = useAssetLibrary({ assets, folders, target, onPick });
  const input = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLDivElement>(null);
  // The image to use: its folder opens, and it is scrolled to and outlined for a moment.
  const pointed = highlight ? lib.find(highlight) : null;
  useEffect(() => { if (pointed?.folderId) lib.setFolder(pointed.folderId); else if (pointed) lib.setWhose('team'); }, [pointed?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!highlight) return;
    const t = setTimeout(() => root.current?.querySelector(`[data-asset="${highlight}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300);
    return () => clearTimeout(t);
  }, [highlight, lib.folder]);

  return (
    <div ref={root} className="space-y-3 pb-4 text-[12px]" onKeyDown={(e) => { if (e.key === 'Escape' && lib.picked.length) { e.stopPropagation(); lib.setPicked([]); } }}>
      <div className="grid grid-cols-2 gap-1.5 px-3 pt-1">
        <button type="button" onClick={() => input.current?.click()}
          className="flex h-8 items-center justify-center gap-1.5 rounded-md bg-foreground/[0.05] text-foreground/80 hover:bg-foreground/[0.09]">
          <HugeiconsIcon icon={ImageUploadIcon} className="size-3.5" /> Upload
        </button>
        <button type="button" onClick={lib.generate}
          className="flex h-8 items-center justify-center gap-1.5 rounded-md bg-[#E6F4FF] font-medium text-primary hover:bg-[#d6ecff]">
          <HugeiconsIcon icon={AiMagicIcon} className="size-3.5" /> Generate
        </button>
        <input ref={input} type="file" multiple accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden
          onChange={(e) => { lib.uploadMany([...(e.target.files ?? [])]); e.target.value = ''; }} />
      </div>

      <div className="mx-3 flex items-center gap-1.5">
        <WhoseTabs lib={lib} className="flex-1" />
        {/* How it works, on demand: the panel stays clean. */}
        <Tooltip>
          <TooltipTrigger render={<button type="button" aria-label="How Assets work" />}
            className={`flex size-8 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-foreground/[0.05] ${target ? 'text-primary' : 'text-foreground/40 hover:text-foreground'}`}>
            <HugeiconsIcon icon={InformationCircleIcon} className="size-4" strokeWidth={1.6} />
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[240px]">
            {target ? 'Click an image to place it in the selected photo or logo.' : 'Click an image (or right-click) to remove its background, add a pixel effect or edit it with AI. Double-click to see it large.'}
          </TooltipContent>
        </Tooltip>
      </div>

      <SelectionBar lib={lib} className="mx-3" />

      {/* Where you are: the top of Assets, or one folder (drop images on "Assets" to take them out). */}
      {lib.here ? (
        <div className="mx-3 flex items-center gap-1 text-[12px]">
          <button type="button" onClick={() => lib.setFolder(null)} {...dropProps(lib, 'top', null)}
            className={`flex h-7 items-center gap-1 rounded-md px-1.5 text-foreground/55 hover:bg-foreground/[0.05] hover:text-foreground ${lib.dropOn === 'top' ? 'bg-[#E6F4FF] text-primary ring-1 ring-primary/50' : ''}`}>
            <HugeiconsIcon icon={ArrowLeft01Icon} className="size-3.5" /> Assets
          </button>
          <span className="text-foreground/30">/</span>
          <span className="min-w-0 flex-1 truncate font-medium">{lib.here.name}</span>
          <MoreActions actions={lib.folderActions(lib.here).slice(1)} label="Folder options" className="flex size-7 items-center justify-center rounded-md text-foreground/50 outline-none hover:bg-foreground/[0.05] hover:text-foreground" />
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="flex items-center px-3">
            <span className="flex-1 text-[11px] font-medium tracking-[0.02em] text-foreground/45">Folders</span>
            <button type="button" onClick={() => lib.newFolder()} className="flex h-6 items-center gap-1 rounded-md px-1.5 text-foreground/55 hover:bg-foreground/[0.05] hover:text-foreground">
              <HugeiconsIcon icon={FolderAddIcon} className="size-3.5" /> New folder
            </button>
          </div>
          {lib.folders.length > 0 && (
            <div className="grid grid-cols-2 gap-1.5 px-3">
              {lib.folders.map((f) => <FolderCard key={f.id} lib={lib} f={f} />)}
            </div>
          )}
          {lib.list.length > 0 && <p className="px-3 pt-1 text-[11px] font-medium tracking-[0.02em] text-foreground/45">Images</p>}
        </div>
      )}

      {!lib.list.length && !hasWorking(lib) ? (
        <p className="px-3 py-6 text-center text-foreground/45">{lib.here ? 'Empty folder.' : lib.whose === 'mine' ? 'Nothing here yet.' : 'Nothing from the team yet.'}</p>
      ) : (
        <div className="grid grid-cols-2 gap-x-2 gap-y-3 px-3">
          <WorkingTiles lib={lib} />
          {lib.list.map((a) => (
            <div key={a.id} data-asset={a.id} className={`min-w-0 rounded-md ${highlight === a.id ? 'animate-pulse ring-2 ring-[#FF2BD6] ring-offset-2' : ''}`}>
              <AssetTile lib={lib} a={a} />
            </div>
          ))}
        </div>
      )}

      {lib.dialogs}
    </div>
  );
}
