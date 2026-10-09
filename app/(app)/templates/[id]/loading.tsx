import { GridSkeleton } from '@/components/page-skeleton';

// A template's own page keeps the general loader (the catalog's is for /templates).
export default function Loading() {
  return <GridSkeleton />;
}
