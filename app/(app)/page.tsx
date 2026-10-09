import Link from 'next/link';
import { PageHeader, Pills, Segmented } from '@/components/app-shell';
import { GalleryFeed } from '@/components/gallery-feed';
import { TYPES, loadPieces } from '@/lib/gallery';
import { currentBrand, followRecord } from '@/lib/brand';
import { BRANDS } from '@/lib/brands';
import { listProjects } from '@/lib/projects';
import { currentUser } from '@/lib/team';

// Same segment as the (app) layout, so its title template does not reach this page.
export async function generateMetadata() {
  return { title: { absolute: `Gallery · ${BRANDS[await currentBrand()].studio}` } };
}
export const dynamic = 'force-dynamic';

export default async function GalleryPage({ searchParams }: { searchParams: Promise<{ all?: string; type?: string; set?: string }> }) {
  const { all, type, set } = await searchParams;
  // A shared set link (?set=) of the other brand switches to it first.
  if (set) await followRecord('renders', set, `/?${new URLSearchParams({ ...(all ? { all } : {}), ...(type ? { type } : {}), set })}`, true);
  const me = (await currentUser())!;
  const mine = !all; // default: the signed-in person's own pieces
  const kind = TYPES.find((t) => t.key === type);
  const [pieces, projects] = await Promise.all([
    loadPieces({ userId: mine ? me.id : undefined }),
    listProjects(me).catch(() => []),
  ]);

  const href = (p: { all?: boolean; type?: string }) => {
    const s = new URLSearchParams();
    if (p.all) s.set('all', '1');
    if (p.type) s.set('type', p.type);
    return s.size ? `/?${s}` : '/';
  };

  return (
    <>
      <PageHeader title="Gallery" description={mine ? 'The designs you made with Studio.' : 'Every design the team made with Studio.'}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <Segmented
            items={[
              { href: href({ type }), label: 'Mine', active: mine },
              { href: href({ all: true, type }), label: 'Team', active: !mine },
            ]}
          />
          <span className="hidden h-5 w-px bg-foreground/10 sm:block" aria-hidden />
          <Pills
            items={[
              { href: href({ all: !mine }), label: 'All types', active: !kind },
              ...TYPES.map((t) => ({ href: href({ all: !mine, type: t.key }), label: t.label, active: kind?.key === t.key })),
            ]}
          />
        </div>
      </PageHeader>

      <GalleryFeed
        initial={pieces} filter={{ userId: mine ? me.id : undefined }} leadFormats={kind?.formats} projects={projects} me={me}
        empty={
      <div className="rounded-xl bg-foreground/[0.03] px-6 py-24 text-center">
        <p className="font-medium">{mine ? 'You have no designs yet' : 'Nothing here yet'}</p>
        <p className="mt-1 text-muted-foreground">Ask Claude for a design with the Archy Studio plugin. <Link href="/install" className="text-foreground underline underline-offset-4">Install it</Link></p>
      </div>
        }
      />
    </>
  );
}
