import { notFound } from 'next/navigation';
import { HugeiconsIcon } from '@hugeicons/react';
import { LockIcon, UserGroupIcon } from '@hugeicons/core-free-icons';
import { PageHeader, Pills } from '@/components/app-shell';
import { GalleryFeed } from '@/components/gallery-feed';
import { TYPES, loadPieces } from '@/lib/gallery';
import { followRecord } from '@/lib/brand';
import { getProject, listProjects } from '@/lib/projects';
import { currentUser } from '@/lib/team';
import { ProjectActions } from './project-actions';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const me = await currentUser();
  const p = me ? await getProject(me, (await params).id).catch(() => null) : null;
  return { title: `${p?.name ?? 'Project'}` };
}

export default async function ProjectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ type?: string }> }) {
  const [{ id }, { type }] = await Promise.all([params, searchParams]);
  const me = (await currentUser())!;
  await followRecord('projects', id, `/projects/${id}`);
  const [project, pieces, projects] = await Promise.all([getProject(me, id), loadPieces({ projectId: id }), listProjects(me)]);
  if (!project) notFound();
  const kind = TYPES.find((t) => t.key === type);
  const href = (t?: string) => (t ? `/projects/${id}?type=${t}` : `/projects/${id}`);
  const canEdit = project.owner_id === me.id || me.is_admin;

  return (
    <>
      <PageHeader
        title={project.name}
        description={`${project.count} ${project.count === 1 ? 'set' : 'sets'}${project.owner_id === me.id ? '' : ` · Created by ${project.owner}`}`}
        aside={
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 items-center gap-1.5 rounded-[4px] bg-foreground/[0.04] px-2 text-[12px] text-foreground/60">
              <HugeiconsIcon icon={project.shared ? UserGroupIcon : LockIcon} className="size-3.5" strokeWidth={1.7} />
              {project.shared ? 'Team' : 'Only you'}
            </span>
            {canEdit && <ProjectActions project={{ id: project.id, name: project.name, shared: project.shared }} />}
          </div>
        }
      >
        <Pills items={[{ href: href(), label: 'All types', active: !kind }, ...TYPES.map((t) => ({ href: href(t.key), label: t.label, active: kind?.key === t.key }))]} />
      </PageHeader>

      <GalleryFeed
        initial={pieces} filter={{ projectId: id }} leadFormats={kind?.formats} projects={projects} me={me} showProject={false}
        empty={
      <div className="rounded-xl bg-foreground/[0.03] px-6 py-24 text-center">
        <p className="font-medium">{kind ? `No ${kind.label.toLowerCase()} designs here` : 'This project is empty'}</p>
        <p className="mx-auto mt-1 max-w-sm text-muted-foreground">
          Move designs here from the gallery, or ask Claude to save new ones to “{project.name}”.
        </p>
      </div>
        }
      />
    </>
  );
}
