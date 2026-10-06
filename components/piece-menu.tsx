'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { HugeiconsIcon } from '@hugeicons/react';
import { Add01Icon, Folder01Icon, FolderExportIcon, LockIcon, Tick02Icon } from '@hugeicons/core-free-icons';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ProjectDialog } from '@/components/project-dialog';
import type { ProjectLink } from '@/components/projects-nav';
import { createProjectAction, movePieceAction } from '@/app/(app)/projects/actions';

// "Move to project" on a gallery piece: pick a folder, take it out, or create one and file it there.
export function PieceMenu({ pieceId, projectId, projects, variant = 'icon' }: { pieceId: string; projectId: string | null; projects: ProjectLink[]; variant?: 'icon' | 'button' }) {
  const [creating, setCreating] = useState(false);
  const [, start] = useTransition();
  const move = (id: string | null, name?: string) =>
    start(async () => {
      const res = await movePieceAction(pieceId, id);
      if (res.ok) toast.success(id ? `Moved to ${name}` : 'Removed from the project');
      else toast.error(res.error);
    });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger aria-label="Move to project" title="Move to project"
          className={variant === 'icon'
            ? 'flex size-7 items-center justify-center rounded-full bg-background/80 text-foreground shadow-sm backdrop-blur outline-none'
            : 'flex h-8 items-center gap-1.5 rounded-md bg-foreground/[0.05] px-3 text-[13px] text-foreground/80 transition-colors outline-none hover:bg-foreground/[0.09]'}>
          <HugeiconsIcon icon={FolderExportIcon} className="size-3.5" />
          {variant === 'button' && 'Move'}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 text-[13px]">
          <DropdownMenuGroup>
          <DropdownMenuLabel className="text-[11px] text-foreground/40">Move to project</DropdownMenuLabel>
          {projects.map((p) => (
            <DropdownMenuItem key={p.id} onClick={() => p.id !== projectId && move(p.id, p.name)} className="text-[13px]">
              <HugeiconsIcon icon={Folder01Icon} className="size-4 text-foreground/40" strokeWidth={1.6} />
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
              {!p.shared && <HugeiconsIcon icon={LockIcon} className="size-3 text-foreground/35" />}
              {p.id === projectId && <HugeiconsIcon icon={Tick02Icon} className="size-3.5 text-primary" />}
            </DropdownMenuItem>
          ))}
          </DropdownMenuGroup>
          {projects.length > 0 && <DropdownMenuSeparator />}
          <DropdownMenuItem onClick={() => setCreating(true)} className="text-[13px]">
            <HugeiconsIcon icon={Add01Icon} className="size-4 text-foreground/40" strokeWidth={1.6} />
            New project…
          </DropdownMenuItem>
          {projectId && (
            <DropdownMenuItem onClick={() => move(null)} className="text-[13px] text-foreground/60">
              Remove from project
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <ProjectDialog
        open={creating}
        onOpenChange={setCreating}
        title="New project"
        action="Create and move"
        onSubmit={async (name, shared) => {
          const res = await createProjectAction(name, shared);
          if (!res.ok || !res.data) { toast.error(res.ok ? 'Could not create the project.' : res.error); return false; }
          move(res.data, name.trim());
          return true;
        }}
      />
    </>
  );
}
