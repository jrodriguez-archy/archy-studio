import { PageHeader } from '@/components/app-shell';
import { PieceGrid } from '@/components/piece-grid';
import { canManageSet, groupSets, loadPieces } from '@/lib/gallery';
import { listProjects } from '@/lib/projects';
import { currentUser } from '@/lib/team';

export const metadata = { title: 'Archive · Archy Studio' };
export const dynamic = 'force-dynamic';

// Archived sets the person can manage (theirs, those in projects they own, all for admins):
// restore them to the gallery or delete them for good.
export default async function ArchivePage() {
  const me = (await currentUser())!;
  const [pieces, projects] = await Promise.all([loadPieces({ archived: true }, 400), listProjects(me).catch(() => [])]);
  const sets = groupSets(pieces).filter((s) => canManageSet(s, me, projects));

  return (
    <>
      <PageHeader title="Archive" description="Archived designs are hidden from the gallery. Restore them, or delete them for good." />
      {sets.length === 0 ? (
        <div className="rounded-xl bg-foreground/[0.03] px-6 py-24 text-center">
          <p className="font-medium">Nothing archived</p>
          <p className="mt-1 text-muted-foreground">Right-click a design in the gallery and choose Archive.</p>
        </div>
      ) : (
        <PieceGrid sets={sets} projects={projects} me={me} />
      )}
    </>
  );
}
