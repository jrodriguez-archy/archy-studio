import { PageHeader } from '@/components/app-shell';
import { GalleryFeed } from '@/components/gallery-feed';
import { loadPieces } from '@/lib/gallery';
import { listProjects } from '@/lib/projects';
import { currentUser } from '@/lib/team';

export const metadata = { title: 'Archive' };
export const dynamic = 'force-dynamic';

// Archived sets the person can manage (theirs, those in projects they own, all for admins):
// restore them to the gallery or delete them for good.
export default async function ArchivePage() {
  const me = (await currentUser())!;
  const [pieces, projects] = await Promise.all([loadPieces({ archived: true }), listProjects(me).catch(() => [])]);

  return (
    <>
      <PageHeader title="Archive" description="Archived designs are hidden from the gallery. Restore them, or delete them for good." />
      <GalleryFeed
        initial={pieces} filter={{ archived: true }} manageOnly selectable projects={projects} me={me}
        empty={
      <div className="rounded-xl bg-foreground/[0.03] px-6 py-24 text-center">
        <p className="font-medium">Nothing archived</p>
        <p className="mt-1 text-muted-foreground">Right-click a design in the gallery and choose Archive.</p>
      </div>
        }
      />
    </>
  );
}
