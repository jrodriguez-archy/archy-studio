// A stacked card: the other formats of a set or style peek out behind the front one, and a small
// label says how many there are. Shared by the gallery and the Templates page.

export const stackPad = (n: number) => (n > 2 ? 'pt-4' : n > 1 ? 'pt-2' : '');

export function StackLayers({ n }: { n: number }) {
  return (
    <>
      {n > 2 && <div aria-hidden className="absolute inset-x-5 -top-4 h-10 rounded-lg bg-foreground/[0.04] ring-1 ring-foreground/[0.06]" />}
      {n > 1 && <div aria-hidden className="absolute inset-x-2.5 -top-2 h-10 rounded-lg bg-foreground/[0.07] ring-1 ring-foreground/[0.07]" />}
    </>
  );
}

export function StackBadge({ n, label = 'formats' }: { n: number; label?: string }) {
  if (n < 2) return null;
  return (
    <span className="pointer-events-none absolute top-2 left-2 z-10 rounded-[4px] bg-background/85 px-1.5 py-0.5 text-[11px] font-medium text-foreground/70 shadow-sm backdrop-blur">
      {n} {label}
    </span>
  );
}
