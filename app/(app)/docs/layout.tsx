import { Suspense } from 'react';
import { DocsBar, DocsIndex, OnThisPage, PrevNext } from '@/components/docs/docs-nav';
import { PageHighlight } from '@/components/docs/page-highlight';
import { docsFor } from '@/lib/docs';
import { currentUser } from '@/lib/team';

// Docs: the index on the left (a bar that opens it, below lg), the section, and "On this page" on wide
// screens.
export default async function DocsLayout({ children }: { children: React.ReactNode }) {
  const me = await currentUser();
  const sections = docsFor(!!me?.is_admin);
  return (
    <>
      <DocsBar sections={sections} />
      <div className="lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-12 xl:grid-cols-[200px_minmax(0,1fr)_180px]">
        <aside className="hidden lg:block">
          <div className="sticky top-8 max-h-[calc(100dvh-4rem)] overflow-y-auto pb-8 [scrollbar-width:none]"><DocsIndex sections={sections} /></div>
        </aside>
        <div className="mx-auto w-full max-w-[720px] min-w-0">
          {children}
          <PrevNext sections={sections} />
          <Suspense><PageHighlight /></Suspense>
        </div>
        <aside className="hidden xl:block">
          <div className="sticky top-8"><OnThisPage sections={sections} /></div>
        </aside>
      </div>
    </>
  );
}
