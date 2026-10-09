import { HugeiconsIcon } from '@hugeicons/react';
import { Idea01Icon, InformationCircleIcon } from '@hugeicons/core-free-icons';
import { CopyBrief } from './copy-brief';

// The pieces every Docs section is written with. Body text is 15px for reading (the app's panels are
// 13px); headings follow PageHeader. Everything stacks on a phone: no fixed-width columns below sm.

export function Article({ children }: { children: React.ReactNode }) {
  return (
    <article className="space-y-5 text-[15px] leading-[1.65] text-foreground/80 [&_a]:text-foreground [&_a]:underline [&_a]:decoration-foreground/25 [&_a]:underline-offset-4 hover:[&_a]:decoration-foreground [&_strong]:font-medium [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5 [&_ul]:marker:text-foreground/30">
      {children}
    </article>
  );
}

export function Lead({ children }: { children: React.ReactNode }) {
  return <p className="text-[17px] leading-[1.6] text-foreground/70">{children}</p>;
}

export function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="group scroll-mt-28 pt-6 text-[20px] font-medium tracking-[-0.01em] text-foreground lg:scroll-mt-8">
      <a href={`#${id}`} className="no-underline! decoration-transparent!">{children}<span className="ml-2 text-foreground/0 transition-colors group-hover:text-foreground/25" aria-hidden>#</span></a>
    </h2>
  );
}

export function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="pt-2 text-[16px] font-medium text-foreground">{children}</h3>;
}

// A label as it appears in Studio (a button, a menu item, a tab).
export function Ui({ children }: { children: React.ReactNode }) {
  return <span className="rounded-[4px] bg-foreground/[0.05] px-1.5 py-[1px] text-[0.92em] font-medium whitespace-nowrap text-foreground">{children}</span>;
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="inline-flex min-w-[1.6em] items-center justify-center rounded-[4px] border border-foreground/15 bg-background px-1.5 py-[1px] font-sans text-[12px] font-medium text-foreground/80 shadow-[0_1px_0_rgba(0,0,0,0.06)]">{children}</kbd>;
}

export function Steps({ children }: { children: React.ReactNode }) {
  return <ol className="space-y-3 [counter-reset:step]">{children}</ol>;
}

export function Step({ children }: { children: React.ReactNode }) {
  return (
    <li className="relative pl-9 [counter-increment:step] before:absolute before:top-[1px] before:left-0 before:flex before:size-6 before:items-center before:justify-center before:rounded-full before:bg-foreground/[0.06] before:text-[12px] before:font-medium before:text-foreground/60 before:content-[counter(step)]">
      {children}
    </li>
  );
}

export function Callout({ kind = 'tip', children }: { kind?: 'tip' | 'note'; children: React.ReactNode }) {
  return (
    <div className={`flex gap-3 rounded-lg px-4 py-3 text-[14px] leading-[1.6] ${kind === 'tip' ? 'bg-[#E6F4FF]/70 text-foreground/80' : 'bg-foreground/[0.04] text-foreground/75'}`}>
      <HugeiconsIcon icon={kind === 'tip' ? Idea01Icon : InformationCircleIcon} className={`mt-[3px] size-4 shrink-0 ${kind === 'tip' ? 'text-primary' : 'text-foreground/45'}`} strokeWidth={1.7} />
      <div className="min-w-0 space-y-2">{children}</div>
    </div>
  );
}

// Label → what it does. Two columns from sm up, stacked on a phone.
export function Rows({ rows }: { rows: [React.ReactNode, React.ReactNode][] }) {
  return (
    <dl className="divide-y divide-foreground/[0.06] border-y border-foreground/[0.06] text-[14px]">
      {rows.map(([k, v], i) => (
        <div key={i} className="flex flex-col gap-0.5 py-2.5 sm:flex-row sm:gap-4">
          <dt className="shrink-0 font-medium text-foreground sm:w-[180px]">{k}</dt>
          <dd className="min-w-0 text-foreground/70">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

// A screenshot of Studio, framed, opening full size on click.
export function Shot({ src, alt, caption, width = 1440, height = 900 }: { src: string; alt: string; caption?: React.ReactNode; width?: number; height?: number }) {
  return (
    <figure className="space-y-2 py-1">
      <a href={src} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg no-underline! ring-1 ring-foreground/[0.08] shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} width={width} height={height} loading="lazy" decoding="async" className="block h-auto w-full" />
      </a>
      {caption && <figcaption className="text-[13px] text-foreground/50">{caption}</figcaption>}
    </figure>
  );
}

// Example briefs to copy into Claude.
export function Briefs({ items }: { items: string[] }) {
  return <div className="space-y-2">{items.map((b) => <CopyBrief key={b} text={b} />)}</div>;
}
