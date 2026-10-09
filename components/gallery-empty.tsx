import Link from 'next/link';
import { HugeiconsIcon } from '@hugeicons/react';
import { BubbleChatIcon, Image02Icon, LayoutGridIcon } from '@hugeicons/core-free-icons';
import { CopyBrief } from '@/components/docs/copy-brief';
import { Button } from '@/components/ui/button';
import { BRANDS, type Brand } from '@/lib/brands';
import { EXAMPLE_BRIEFS } from '@/lib/example-briefs';

const STEPS = [
  { icon: BubbleChatIcon, title: 'Ask Claude', text: 'Describe what you need in your own words: the event, the place, the dates.' },
  { icon: LayoutGridIcon, title: 'Claude builds it', text: 'It picks the approved template, writes the copy and makes every format.' },
  { icon: Image02Icon, title: 'It lands here', text: 'Download it, file it in a project, or fine-tune it in Canvas.' },
];

// The gallery with no designs yet: how Studio works, in three steps, and briefs to start from.
export function GalleryEmpty({ brand, claudeConnected }: { brand: Brand; claudeConnected: boolean }) {
  return (
    <div className="rounded-xl bg-foreground/[0.03] px-5 py-10 text-[13px] sm:px-10 sm:py-14">
      <div className="mx-auto max-w-[640px] space-y-8">
        <div className="space-y-1 text-center">
          <p className="text-[17px] font-medium">No {BRANDS[brand].name} designs yet</p>
          <p className="text-foreground/55">Here is how Studio works.</p>
        </div>
        <ol className="grid gap-3 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="rounded-lg bg-background p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-foreground/[0.06]">
              <span className="mb-3 flex items-center gap-2 text-foreground/40">
                <HugeiconsIcon icon={s.icon} className="size-4 text-primary" strokeWidth={1.7} />
                <span className="tabular-nums">{i + 1}</span>
              </span>
              <span className="block font-medium">{s.title}</span>
              <span className="mt-1 block leading-[1.5] text-foreground/55">{s.text}</span>
            </li>
          ))}
        </ol>
        <div className="space-y-2">
          <p className="text-foreground/45">Try one of these in Claude:</p>
          {EXAMPLE_BRIEFS[brand].slice(0, 2).map((b) => <CopyBrief key={b} text={b} />)}
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {!claudeConnected && <Button size="lg" nativeButton={false} render={<Link href="/docs/connect-claude" />}>Connect Claude</Button>}
          <Button size="lg" variant="outline" nativeButton={false} render={<Link href="/templates" />}>Browse templates</Button>
          <Button size="lg" variant="ghost" nativeButton={false} render={<Link href="/docs" />}>Read the Docs</Button>
        </div>
      </div>
    </div>
  );
}
