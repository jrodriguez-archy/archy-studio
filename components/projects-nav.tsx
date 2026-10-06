'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { HugeiconsIcon } from '@hugeicons/react';
import { Add01Icon, Delete02Icon, FolderAddIcon, Link01Icon, LockIcon, PencilEdit02Icon, ViewIcon } from '@hugeicons/core-free-icons';
import { ContextActions, copy, type Action } from '@/components/action-menu';
import { NavLink } from '@/components/nav-link';
import { useSidebar } from '@/components/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ProjectDialog } from '@/components/project-dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { createProjectAction, deleteProjectAction, renameProjectAction, shareProjectAction } from '@/app/(app)/projects/actions';

export type ProjectLink = { id: string; name: string; shared: boolean; count: number; owner_id?: string };

// Sidebar section: the projects this person can see (team ones and their own), and a + to make one.
export function ProjectsNav({ projects, me, onNavigate }: { projects: ProjectLink[]; me?: { id: string; is_admin: boolean }; onNavigate?: () => void }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectLink | null>(null);
  const [deleting, setDeleting] = useState<ProjectLink | null>(null);
  const router = useRouter();
  const canEdit = (p: ProjectLink) => !!me && (me.is_admin || p.owner_id === me.id);
  // Right-click on a project: open, edit (name and who sees it), copy link, delete. Editing is for its owner and admins.
  const actions = (p: ProjectLink): Action[] => [
    { label: 'Open', icon: ViewIcon, onSelect: () => { onNavigate?.(); router.push(`/projects/${p.id}`); } },
    { label: 'Edit project…', icon: PencilEdit02Icon, disabled: !canEdit(p), onSelect: () => setEditing(p) },
    { label: 'Copy link', icon: Link01Icon, onSelect: async () => { (await copy(`${location.origin}/projects/${p.id}`)) && toast.success('Link copied'); } },
    { separator: true },
    { label: 'Delete project…', icon: Delete02Icon, destructive: true, disabled: !canEdit(p), onSelect: () => setDeleting(p) },
  ];
  const { collapsed } = useSidebar();
  return (
    <div className="space-y-0.5">
      {collapsed ? (
        <>
          <div className="mx-2 mb-3 h-px bg-foreground/[0.07]" aria-hidden />
          <Tooltip>
            <TooltipTrigger render={<button type="button" onClick={() => setOpen(true)} aria-label="New project" />}
              className="flex h-8 w-full items-center justify-center rounded-md text-foreground/45 transition-colors hover:bg-foreground/[0.04] hover:text-foreground">
              <HugeiconsIcon icon={FolderAddIcon} className="size-4" strokeWidth={1.6} />
            </TooltipTrigger>
            <TooltipContent side="right">New project</TooltipContent>
          </Tooltip>
        </>
      ) : (
      <div className="flex items-center justify-between pr-1 pb-1 pl-2">
        <p className="text-[11px] font-medium tracking-[0.02em] text-foreground/35">Projects</p>
        <button type="button" onClick={() => setOpen(true)} aria-label="New project" title="New project"
          className="flex size-5 items-center justify-center rounded-[4px] text-foreground/40 transition-colors hover:bg-foreground/[0.06] hover:text-foreground">
          <HugeiconsIcon icon={Add01Icon} className="size-3.5" strokeWidth={1.8} />
        </button>
      </div>
      )}
      {projects.length === 0 && !collapsed && (
        <button type="button" onClick={() => setOpen(true)} className="flex h-8 w-full items-center px-2 text-[13px] text-foreground/40 hover:text-foreground">
          New project
        </button>
      )}
      {projects.map((p) => (
        <ContextActions key={p.id} actions={actions(p)} className="block">
        <NavLink href={`/projects/${p.id}`} icon="project" onNavigate={onNavigate}
          trailing={
            <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-foreground/35">
              {!p.shared && <HugeiconsIcon icon={LockIcon} className="size-3" strokeWidth={1.8} aria-label="Only you" />}
              {p.count > 0 && p.count}
            </span>
          }>
          {p.name}
        </NavLink>
        </ContextActions>
      ))}
      <ProjectDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        title="Edit project"
        action="Save"
        initial={editing ? { name: editing.name, shared: editing.shared } : undefined}
        onSubmit={async (name, shared) => {
          if (!editing) return false;
          if (name.trim() !== editing.name) { const r = await renameProjectAction(editing.id, name); if (!r.ok) { toast.error(r.error); return false; } }
          if (shared !== editing.shared) { const r = await shareProjectAction(editing.id, shared); if (!r.ok) { toast.error(r.error); return false; } }
          return true;
        }}
      />
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleting?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>The project goes away. Its pieces stay in the gallery, without a project.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={async () => {
              if (!deleting) return;
              const r = await deleteProjectAction(deleting.id);
              if (!r.ok) { toast.error(r.error); return; }
              toast.success('Project deleted');
              if (location.pathname === `/projects/${deleting.id}`) router.push('/');
            }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <ProjectDialog
        open={open}
        onOpenChange={setOpen}
        title="New project"
        action="Create project"
        onSubmit={async (name, shared) => {
          const res = await createProjectAction(name, shared);
          if (!res.ok) { toast.error(res.error); return false; }
          onNavigate?.();
          router.push(`/projects/${res.data}`);
          return true;
        }}
      />
    </div>
  );
}
