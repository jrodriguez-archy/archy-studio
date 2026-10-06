'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { HugeiconsIcon } from '@hugeicons/react';
import { Add01Icon, LockIcon } from '@hugeicons/core-free-icons';
import { NavLink } from '@/components/nav-link';
import { ProjectDialog } from '@/components/project-dialog';
import { createProjectAction } from '@/app/(app)/projects/actions';

export type ProjectLink = { id: string; name: string; shared: boolean; count: number };

// Sidebar section: the projects this person can see (team ones and their own), and a + to make one.
export function ProjectsNav({ projects, onNavigate }: { projects: ProjectLink[]; onNavigate?: () => void }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between pr-1 pb-1 pl-2">
        <p className="text-[11px] font-medium tracking-[0.02em] text-foreground/35">Projects</p>
        <button type="button" onClick={() => setOpen(true)} aria-label="New project" title="New project"
          className="flex size-5 items-center justify-center rounded-[4px] text-foreground/40 transition-colors hover:bg-foreground/[0.06] hover:text-foreground">
          <HugeiconsIcon icon={Add01Icon} className="size-3.5" strokeWidth={1.8} />
        </button>
      </div>
      {projects.length === 0 && (
        <button type="button" onClick={() => setOpen(true)} className="flex h-8 w-full items-center px-2 text-[13px] text-foreground/40 hover:text-foreground">
          New project
        </button>
      )}
      {projects.map((p) => (
        <NavLink key={p.id} href={`/projects/${p.id}`} icon="project" onNavigate={onNavigate}
          trailing={
            <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-foreground/35">
              {!p.shared && <HugeiconsIcon icon={LockIcon} className="size-3" strokeWidth={1.8} aria-label="Only you" />}
              {p.count > 0 && p.count}
            </span>
          }>
          {p.name}
        </NavLink>
      ))}
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
