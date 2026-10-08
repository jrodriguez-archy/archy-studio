// Canvas opening: its grey stage at once, the editor when the design is ready.
export default function Loading() {
  return (
    <div data-fullbleed className="flex h-dvh flex-col bg-[#F5F5F5]" aria-busy aria-label="Loading">
      <div className="h-12 shrink-0 border-b border-black/[0.06] bg-white" />
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <div className="size-2 animate-pulse rounded-full bg-black/20" />
      </div>
    </div>
  );
}
