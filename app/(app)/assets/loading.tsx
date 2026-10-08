import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div aria-busy aria-label="Loading">
      <Skeleton className="mb-5 h-8 w-40" />
      <div className="flex gap-6">
        <div className="hidden w-[220px] shrink-0 space-y-2 md:block">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
        <div className="grid flex-1 grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">{Array.from({ length: 12 }, (_, i) => <Skeleton key={i} className="aspect-square w-full" />)}</div>
      </div>
    </div>
  );
}
