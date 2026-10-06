'use client';

import { useCallback, useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowLeft01Icon, ArrowRight01Icon, Cancel01Icon } from '@hugeicons/core-free-icons';

// Open an item in place (recent.design-like): the URL carries ?<param>=<id> so it can be shared,
// the page underneath stays where it was. Opening pushes a history entry, so Back closes it.
export function useInspector(param: string, ids: string[]) {
  const search = useSearchParams();
  const pathname = usePathname();
  const pushed = useRef(false);
  const current = search.get(param);
  const openId = current && ids.includes(current) ? current : null;

  const urlWith = useCallback((id: string | null) => {
    const s = new URLSearchParams(search.toString());
    if (id) s.set(param, id); else s.delete(param);
    return s.size ? `${pathname}?${s}` : pathname;
  }, [search, pathname, param]);

  const open = useCallback((id: string) => {
    if (openId) window.history.replaceState(null, '', urlWith(id));
    else { window.history.pushState(null, '', urlWith(id)); pushed.current = true; }
  }, [openId, urlWith]);

  const close = useCallback(() => {
    if (pushed.current) { pushed.current = false; window.history.back(); }
    else window.history.replaceState(null, '', urlWith(null));
  }, [urlWith]);

  const step = useCallback((d: 1 | -1) => {
    if (!openId) return;
    const i = ids.indexOf(openId);
    const next = ids[(i + d + ids.length) % ids.length];
    window.history.replaceState(null, '', urlWith(next));
  }, [openId, ids, urlWith]);

  return { openId, open, close, step };
}

// The panel: an info column on the left, the item large on a frosted stage over the grid.
// It covers the content area only; the app sidebar stays.
export function Inspector({ eyebrow, title, info, stage, onClose, onStep }: {
  eyebrow: React.ReactNode;
  title: React.ReactNode;
  info: React.ReactNode;
  stage: React.ReactNode;
  onClose: () => void;
  onStep: (d: 1 | -1) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || (e.target as HTMLElement)?.closest('input, textarea, [role=menu], [data-slot=dialog-content], [data-slot=alert-dialog-content]')) return;
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') onStep(1);
      else if (e.key === 'ArrowLeft') onStep(-1);
    };
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; };
  }, [onClose, onStep]);

  return (
    <div className="fixed inset-0 z-[45] flex flex-col animate-in fade-in-0 duration-150 md:left-(--sidebar-w) md:flex-row" role="dialog" aria-modal="true">
      <aside className="order-2 flex min-h-0 flex-col border-foreground/[0.06] bg-background md:order-1 md:w-[320px] md:shrink-0 md:border-r max-md:max-h-[55dvh] max-md:border-t">
        <div className="flex items-center justify-between px-5 pt-4">
          <IconButton label="Close" icon={Cancel01Icon} onClick={onClose} />
          <div className="flex gap-1">
            <IconButton label="Previous" icon={ArrowLeft01Icon} onClick={() => onStep(-1)} />
            <IconButton label="Next" icon={ArrowRight01Icon} onClick={() => onStep(1)} />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-5 pb-8 [scrollbar-width:thin]">
          <p className="text-[13px] text-foreground/40">{eyebrow}</p>
          <h2 className="mt-0.5 text-[17px] leading-snug font-medium tracking-[-0.01em]">{title}</h2>
          <div className="mt-4 text-[13px]">{info}</div>
        </div>
      </aside>
      <div className="relative order-1 flex min-h-0 flex-1 items-center justify-center bg-background/70 p-6 backdrop-blur-2xl md:order-2 md:p-12" onClick={(e) => e.target === e.currentTarget && onClose()}>
        {stage}
      </div>
    </div>
  );
}

function IconButton({ label, icon, onClick }: { label: string; icon: typeof Cancel01Icon; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label}
      className="flex size-7 items-center justify-center rounded-full bg-foreground/[0.05] text-foreground/60 transition-colors hover:bg-foreground/[0.09] hover:text-foreground">
      <HugeiconsIcon icon={icon} className="size-3.5" strokeWidth={1.8} />
    </button>
  );
}

// Key–value rows like recent.design's info table.
export function InfoRows({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="border-t border-foreground/[0.06]">
      {rows.filter(([, v]) => v !== null && v !== undefined && v !== '').map(([k, v]) => (
        <div key={k} className="flex gap-4 border-b border-foreground/[0.06] py-2">
          <dt className="w-24 shrink-0 text-foreground/40">{k}</dt>
          <dd className="min-w-0 flex-1 text-right break-words">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

// The item on the stage: as large as the stage allows, never upscaled past the file.
export function StageImage({ src, placeholder, alt, width, height }: { src?: string; placeholder?: string; alt: string; width: number; height: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={src}
      src={src ?? placeholder}
      alt={alt}
      className="max-h-full max-w-full rounded-[4px] object-contain shadow-[0_1px_3px_rgba(0,0,0,0.08),0_24px_60px_-24px_rgba(0,0,0,0.35)] animate-in fade-in-0 zoom-in-[0.98] duration-200"
      style={{ aspectRatio: `${width} / ${height}`, width: width >= height ? 'min(100%, 1100px)' : 'auto', height: height > width ? 'min(100%, 900px)' : 'auto', backgroundImage: placeholder ? `url("${placeholder}")` : undefined, backgroundSize: 'cover' }}
    />
  );
}
