import { Skeleton } from '@/components/ui/skeleton';

// What a page shows while its data arrives: the header and a grid of cards in the page's shape, so a
// click changes the screen at once.
const HEIGHTS = [300, 220, 360, 260, 320, 240, 280, 340];

export function GridSkeleton({ pills = true }: { pills?: boolean }) {
  return (
    <div aria-busy aria-label="Loading">
      <div className="mb-6 space-y-5">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        {pills && <Skeleton className="h-8 w-80 max-w-full" />}
      </div>
      <div className="columns-2 gap-4 md:columns-3 xl:columns-4">
        {HEIGHTS.map((h, i) => <Skeleton key={i} className="mb-4 w-full break-inside-avoid rounded-lg" style={{ height: h }} />)}
      </div>
    </div>
  );
}

// Templates: sections of style cards (a grey frame with the design inside), in the catalog's shape.
export function TemplatesSkeleton() {
  return (
    <div aria-busy aria-label="Loading">
      <div className="mb-6 space-y-5">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <Skeleton className="h-8 w-72 max-w-full" />
      </div>
      {[0, 1].map((g) => (
        <div key={g} className="mb-16 space-y-6">
          <div className="space-y-1.5 border-b border-foreground/[0.07] pb-3">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-3.5 w-64 max-w-full" />
          </div>
          <Skeleton className="h-3.5 w-24" />
          <div className="columns-1 gap-3 sm:columns-2 lg:columns-3 2xl:columns-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="mb-3 break-inside-avoid">
                <div className="flex items-center justify-center rounded-lg bg-[#F4F4F4] p-8 ring-1 ring-foreground/[0.06] sm:p-10">
                  <Skeleton className="w-full rounded-[3px] bg-foreground/[0.07]" style={{ aspectRatio: '4 / 5' }} />
                </div>
                <Skeleton className="mt-2 h-4 w-40" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
