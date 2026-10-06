'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { Link01Icon, PlusSignIcon, Unlink01Icon } from '@hugeicons/core-free-icons';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// The formats of a design side by side, like artboards in Figma or Paper: a name tag over each one (a
// click edits that format, a double-click frames it), whether it follows the others (Synced), and the
// template's formats the design does not have yet, as dashed artboards to add.

export function BoardLabel({ label, size, compact, active, synced, isNew, count, warn, onPick, onFrame, onSync }: {
  label: string; size: string; compact?: boolean; active: boolean; synced: boolean; isNew: boolean; count: number; warn: boolean;
  onPick: () => void; onFrame: () => void; onSync: () => void;
}) {
  return (
    <div data-board-label className="absolute -top-8 left-0 flex items-center gap-0.5 text-[11px] whitespace-nowrap">
      <button type="button" onClick={onPick} onDoubleClick={onFrame} title={active ? 'Double-click to frame it' : 'Edit this format'}
        className={`flex h-5 items-center gap-1 rounded-[4px] px-1.5 ${active ? 'bg-primary font-medium text-primary-foreground' : 'text-foreground/55 hover:bg-foreground/[0.06] hover:text-foreground'}`}>
        <span>{label}</span>
        {!compact && <span className={active ? 'text-primary-foreground/70' : 'text-foreground/35'}>{size}</span>}
        {isNew && <span className={`rounded-[3px] px-1 text-[10px] ${active ? 'bg-white/20' : 'bg-[#E6F4FF] text-primary'}`}>New</span>}
      </button>
      {count > 0 && (
        <span title={`${count} Inspector suggestion${count > 1 ? 's' : ''}`}
          className={`flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white ${warn ? 'bg-[#D97706]' : 'bg-primary'}`}>{count}</span>
      )}
      <Tooltip>
        <TooltipTrigger render={<button type="button" onClick={onSync} aria-pressed={synced} aria-label={synced ? 'Synced' : 'Not synced'} />}
          className={`-ml-1 flex h-6 items-center gap-1 rounded-[5px] px-1 ${synced ? 'text-primary hover:bg-[#E6F4FF]' : 'text-foreground/45 hover:bg-foreground/[0.06] hover:text-foreground'}`}>
          <HugeiconsIcon icon={synced ? Link01Icon : Unlink01Icon} className="size-4" strokeWidth={1.8} />
          {!synced && !compact && <span>Not synced</span>}
        </TooltipTrigger>
        <TooltipContent side="top">{synced ? 'Synced: changes here go to the other formats' : 'Not synced: changes stay in this format'}</TooltipContent>
      </Tooltip>
    </div>
  );
}

export function GhostBoard({ label, size, width, height, zoom, onAdd }: { label: string; size: string; width: number; height: number; zoom: number; onAdd: () => void }) {
  return (
    <button type="button" data-board-label onClick={onAdd} title={`Add the ${label} format, made from the one you are editing`}
      className="group flex flex-col items-center justify-center gap-1.5 rounded-[2px] border-[1.5px] border-dashed border-foreground/15 text-foreground/40 transition-colors hover:border-primary/60 hover:bg-primary/[0.03] hover:text-primary"
      style={{ width: width * zoom, height: height * zoom }}>
      <span className="flex size-7 items-center justify-center rounded-full bg-foreground/[0.05] group-hover:bg-[#E6F4FF]">
        <HugeiconsIcon icon={PlusSignIcon} className="size-3.5" strokeWidth={2} />
      </span>
      {height * zoom > 70 && <span className="text-[11px] font-medium">{label}</span>}
      {height * zoom > 90 && <span className="text-[10px] opacity-70">{size}</span>}
    </button>
  );
}
