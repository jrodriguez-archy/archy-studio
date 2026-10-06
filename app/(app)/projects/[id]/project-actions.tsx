'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { HugeiconsIcon } from '@hugeicons/react';
import { Delete02Icon, MoreHorizontalIcon, PencilEdit02Icon } from '@hugeicons/core-free-icons';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ProjectDialog } from '@/components/project-dialog';
import { deleteProjectAction, renameProjectAction, shareProjectAction } from '../actions';

export function ProjectActions({ project }: { project: { id: string; name: string; shared: boolean } }) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Project options" />}>
          <HugeiconsIcon icon={MoreHorizontalIcon} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44 text-[13px]">
          <DropdownMenuItem onClick={() => setEditing(true)} className="text-[13px]">
            <HugeiconsIcon icon={PencilEdit02Icon} className="size-4 text-foreground/40" strokeWidth={1.6} /> Edit project
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onClick={() => setDeleting(true)} className="text-[13px]">
            <HugeiconsIcon icon={Delete02Icon} className="size-4" strokeWidth={1.6} /> Delete project
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ProjectDialog
        open={editing}
        onOpenChange={setEditing}
        title="Edit project"
        action="Save"
        initial={{ name: project.name, shared: project.shared }}
        onSubmit={async (name, shared) => {
          if (name.trim() !== project.name) {
            const r = await renameProjectAction(project.id, name);
            if (!r.ok) { toast.error(r.error); return false; }
          }
          if (shared !== project.shared) {
            const r = await shareProjectAction(project.id, shared);
            if (!r.ok) { toast.error(r.error); return false; }
          }
          return true;
        }}
      />

      <AlertDialog open={deleting} onOpenChange={setDeleting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{project.name}”?</AlertDialogTitle>
            <AlertDialogDescription>The project goes away. Its pieces stay in the gallery, without a project.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={() => start(async () => {
                const r = await deleteProjectAction(project.id);
                if (!r.ok) { toast.error(r.error); return; }
                toast.success('Project deleted');
                router.push('/');
              })}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
