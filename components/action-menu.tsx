'use client';

import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react';
import { MoreHorizontalIcon } from '@hugeicons/core-free-icons';
import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuSub, ContextMenuSubContent,
  ContextMenuSubTrigger, ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent,
  DropdownMenuSubTrigger, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// One list of actions per item, shown two ways: right-click (long press on touch) and a "···" button.
export type Action =
  | { separator: true }
  | {
      label: string;
      icon?: IconSvgElement;
      onSelect?: () => void;
      disabled?: boolean;
      destructive?: boolean;
      /** Muted check or hint on the right, e.g. the current project. */
      hint?: React.ReactNode;
      items?: Action[];
    };

const ITEM = 'gap-2 text-[13px]';
const icon = (a: { icon?: IconSvgElement }) =>
  a.icon ? <HugeiconsIcon icon={a.icon} className="size-4 text-foreground/45" strokeWidth={1.6} /> : <span className="size-4" />;

type Parts = {
  Item: typeof ContextMenuItem | typeof DropdownMenuItem;
  Separator: typeof ContextMenuSeparator | typeof DropdownMenuSeparator;
  Sub: typeof ContextMenuSub | typeof DropdownMenuSub;
  SubTrigger: typeof ContextMenuSubTrigger | typeof DropdownMenuSubTrigger;
  SubContent: typeof ContextMenuSubContent | typeof DropdownMenuSubContent;
};

function render(actions: Action[], P: Parts) {
  return actions.map((a, i) => {
    if ('separator' in a) return <P.Separator key={`s${i}`} />;
    if (a.items) {
      return (
        <P.Sub key={a.label}>
          <P.SubTrigger className={ITEM} disabled={a.disabled}>{icon(a)}{a.label}</P.SubTrigger>
          <P.SubContent className="min-w-48 max-w-72">{render(a.items, P)}</P.SubContent>
        </P.Sub>
      );
    }
    return (
      <P.Item key={a.label} className={ITEM} disabled={a.disabled} variant={a.destructive ? 'destructive' : 'default'} onClick={a.onSelect}>
        {icon(a)}
        <span className="min-w-0 flex-1 truncate">{a.label}</span>
        {a.hint && <span className="shrink-0 text-foreground/40">{a.hint}</span>}
      </P.Item>
    );
  });
}

const CONTEXT: Parts = { Item: ContextMenuItem, Separator: ContextMenuSeparator, Sub: ContextMenuSub, SubTrigger: ContextMenuSubTrigger, SubContent: ContextMenuSubContent };
const DROPDOWN: Parts = { Item: DropdownMenuItem, Separator: DropdownMenuSeparator, Sub: DropdownMenuSub, SubTrigger: DropdownMenuSubTrigger, SubContent: DropdownMenuSubContent };

export function ContextActions({ actions, children, className }: { actions: Action[]; children: React.ReactNode; className?: string }) {
  return (
    <ContextMenu>
      <ContextMenuTrigger className={className}>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-56">{render(actions, CONTEXT)}</ContextMenuContent>
    </ContextMenu>
  );
}

export function MoreActions({ actions, label = 'More actions', className }: { actions: Action[]; label?: string; className?: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label={label} title={label}
        className={className ?? 'flex size-7 items-center justify-center rounded-full bg-background/80 text-foreground shadow-sm backdrop-blur outline-none'}>
        <HugeiconsIcon icon={MoreHorizontalIcon} className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">{render(actions, DROPDOWN)}</DropdownMenuContent>
    </DropdownMenu>
  );
}

// The same actions opened with a plain click on the item itself (the item is the trigger).
export function ClickActions({ actions, children, className, label }: { actions: Action[]; children: React.ReactNode; className?: string; label?: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label={label} className={className}>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">{render(actions, DROPDOWN)}</DropdownMenuContent>
    </DropdownMenu>
  );
}

// Clipboard with a toast-friendly result.
export async function copy(text: string) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}
