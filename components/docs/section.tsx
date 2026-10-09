import { Article } from './ui';
import type { DocSection } from '@/lib/docs';

// A section's title and summary, then its content.
export function Section({ doc, children }: { doc: DocSection; children: React.ReactNode }) {
  return (
    <>
      <header className="mb-8 space-y-2">
        <p className="text-[13px] text-foreground/40">{doc.group}</p>
        <h1 className="text-[30px] leading-tight font-medium tracking-[-0.02em] break-words">{doc.title}</h1>
        <p className="text-[17px] leading-[1.55] text-foreground/60">{doc.summary}</p>
      </header>
      <Article>{children}</Article>
    </>
  );
}
