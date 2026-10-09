import { ArchyWordmark } from '@/components/archy-wordmark';
import { DocLockup } from '@/components/doc-lockup';
import type { Brand } from '@/lib/brands';

const DOC_RED = 'text-[#ED0606]';

// A brand's small mark (the collapsed rail, the brand menu): Archy's "A", DOC's symbol. Both are crops
// of a wider drawing, so the width is set exactly: with an auto width the next letter shows at the edge.
const MARK_RATIO: Record<Brand, number> = { archy: 63 / 98, doc: 44.854 / 48 };
export function BrandMark({ brand, height = 14 }: { brand: Brand; height?: number }) {
  const style = { height, width: Math.round(height * MARK_RATIO[brand] * 10) / 10 };
  return brand === 'doc' ? <DocLockup mark className={`shrink-0 ${DOC_RED}`} style={style} /> : <ArchyWordmark mark className="shrink-0 text-primary" style={style} />;
}

// The Studio lockup used on the access screens and the sidebar: Marketing label, Archy wordmark in
// Archy blue, a thin divider and "Studio". DOC shows its own lockup (red on the light ground), never
// below 48px tall, its minimum size.
export function BrandLockup({ size = 'lg', label = true, brand = 'archy' }: { size?: 'lg' | 'sm'; label?: boolean; brand?: Brand }) {
  const lg = size === 'lg';
  if (brand === 'doc') return <DocLockup className={`${lg ? 'h-14' : 'h-12'} w-auto ${DOC_RED}`} />;
  return (
    <div className={lg ? 'space-y-4' : 'space-y-2.5'}>
      {label && <span className="inline-flex rounded-[3px] bg-[#E6F4FF] px-1.5 py-[3px] text-[9px] font-semibold tracking-[0.12em] text-[#0095FF] uppercase">Marketing</span>}
      <div className={`flex items-center ${lg ? 'gap-3' : 'gap-2.5'}`}>
        <ArchyWordmark className={`${lg ? 'h-10' : 'h-8'} w-auto text-primary`} />
        {/* Nudged up: the wordmark's box includes the "y" descender, so its optical centre sits higher. */}
        <span className={`${lg ? 'h-9 -translate-y-[3px]' : 'h-7 -translate-y-[3px]'} w-px bg-foreground/15`} aria-hidden />
        <span className={`${lg ? 'text-[18px] -translate-y-[3px]' : 'text-[16px] -translate-y-[3px]'} text-muted-foreground`}>Studio</span>
      </div>
    </div>
  );
}
