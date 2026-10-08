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
