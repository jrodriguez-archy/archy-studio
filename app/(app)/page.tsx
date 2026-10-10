import Link from 'next/link';
import { PageHeader, Pills, Segmented } from '@/components/app-shell';
import { GalleryEmpty } from '@/components/gallery-empty';
import { GalleryFeed } from '@/components/gallery-feed';
import { GetStarted } from '@/components/get-started';
import { EXAMPLE_BRIEFS } from '@/lib/example-briefs';
import { onboardingState } from '@/lib/onboarding';
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

export default async function GalleryPage({ searchParams }: { searchParams: Promise<{ all?: string; type?: string; made?: string; set?: string; preview?: string }> }) {
  const { all, type, made: rawMade, set, preview } = await searchParams;
  // Made from a template, or an exploration (designed in the brand kit when no template fits).
  const made = rawMade === 'template' || rawMade === 'exploration' ? rawMade : undefined;
  // ?preview=welcome: the Gallery as someone new sees it (nothing done, no designs), changing nothing.
  const welcome = preview === 'welcome';
  // A shared set link (?set=) of the other brand switches to it first.
  if (set) await followRecord('renders', set, `/?${new URLSearchParams({ ...(all ? { all } : {}), ...(type ? { type } : {}), ...(made ? { made } : {}), set })}`, true);
  const me = (await currentUser())!;
  const mine = !all; // default: the signed-in person's own pieces
  const kind = TYPES.find((t) => t.key === type);
  const brand = await currentBrand();
  const [loaded, projects, real] = await Promise.all([
    welcome ? [] : loadPieces({ userId: mine ? me.id : undefined, made }),
    listProjects(me).catch(() => []),
    welcome ? null : onboardingState(me),
  ]);
  const pieces = loaded;
  const onboarding = real ?? { show: true, complete: false, steps: { claude: false, design: false, canvas: false }, latestPieceId: null };

  const href = (p: { all?: boolean; type?: string; made?: string }) => {
    const s = new URLSearchParams();
    if (p.all) s.set('all', '1');
    if (p.type) s.set('type', p.type);
    if (p.made) s.set('made', p.made);
    return s.size ? `/?${s}` : '/';
  };

  return (
    <>
      <PageHeader title="Gallery" description={mine ? 'The designs you made with Studio.' : 'Every design the team made with Studio.'}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <Segmented
            items={[
              { href: href({ type, made }), label: 'Mine', active: mine },
              { href: href({ all: true, type, made }), label: 'Team', active: !mine },
            ]}
          />
          <Segmented
            items={[
              { href: href({ all: !mine, type }), label: 'All', active: !made },
              { href: href({ all: !mine, type, made: 'template' }), label: 'Templates', active: made === 'template' },
              { href: href({ all: !mine, type, made: 'exploration' }), label: 'Explorations', active: made === 'exploration' },
            ]}
          />
          <span className="hidden h-5 w-px bg-foreground/10 sm:block" aria-hidden />
          <Pills
            items={[
              { href: href({ all: !mine, made }), label: 'All types', active: !kind },
              ...TYPES.map((t) => ({ href: href({ all: !mine, type: t.key, made }), label: t.label, active: kind?.key === t.key })),
            ]}
          />
        </div>
      </PageHeader>

      {onboarding.show && <GetStarted state={onboarding} brief={EXAMPLE_BRIEFS[brand][0]} preview={welcome} />}

      <GalleryFeed
        initial={pieces} filter={{ userId: mine ? me.id : undefined, made }} leadFormats={kind?.formats} projects={projects} me={me}
        empty={made === 'exploration' ? (
          <div className="rounded-xl bg-foreground/[0.03] px-6 py-24 text-center">
            <p className="font-medium">No explorations yet</p>
            <p className="mt-1 text-muted-foreground">New designs when no template fits. <Link href="/docs/explorations" className="text-foreground underline underline-offset-4">How to ask for one</Link></p>
          </div>
        ) : mine ? <GalleryEmpty brand={brand} claudeConnected={onboarding.steps.claude} /> : (
          <div className="rounded-xl bg-foreground/[0.03] px-6 py-24 text-center">
            <p className="font-medium">Nothing here yet</p>
            <p className="mt-1 text-muted-foreground">Designs the team makes show up here. <Link href="/docs/make-designs" className="text-foreground underline underline-offset-4">How to make one</Link></p>
          </div>
        )}
      />
    </>
  );
}
