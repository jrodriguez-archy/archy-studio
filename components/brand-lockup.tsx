import { ArchyWordmark } from '@/components/archy-wordmark';

// The Studio lockup used on the access screens and the sidebar: Marketing label, Archy wordmark in
// Archy blue, a thin divider and "Studio".
export function BrandLockup({ size = 'lg', label = true }: { size?: 'lg' | 'sm'; label?: boolean }) {
  const lg = size === 'lg';
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
