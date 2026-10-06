'use client';

import { useEffect, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Search01Icon } from '@hugeicons/core-free-icons';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

type Icon = { name: string; label: string; svg: string };

// Hugeicons (Stroke Rounded, the templates' set): the ones the templates use first, then search.
export function IconPicker({ current, onPick }: { current?: string; onPick: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [icons, setIcons] = useState<Icon[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const t = setTimeout(async () => {
      const res = await fetch(`/api/icons?q=${encodeURIComponent(q)}`).then((r) => r.json()).catch(() => ({ icons: [] }));
      setIcons(res.icons ?? []);
      setLoading(false);
    }, q ? 200 : 0);
    return () => clearTimeout(t);
  }, [q, open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="flex h-7 w-full items-center justify-center rounded-md bg-foreground/[0.05] text-foreground/80 hover:bg-foreground/[0.09]">
        Change icon
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-2">
        <label className="flex h-7 items-center gap-1.5 rounded-md bg-foreground/[0.04] px-2 focus-within:ring-1 focus-within:ring-primary/40">
          <HugeiconsIcon icon={Search01Icon} className="size-3.5 text-foreground/40" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search icons (calendar, pin, gift…)" className="w-full bg-transparent text-[12px] outline-none" />
        </label>
        <p className="px-1 pt-2 pb-1.5 text-[11px] text-foreground/40">{q ? (loading ? 'Searching…' : `${icons.length} icons`) : 'Used in the templates'}</p>
        <div className="grid max-h-60 grid-cols-6 gap-1 overflow-y-auto [scrollbar-width:thin]">
          {icons.map((i) => (
            <button key={i.name} type="button" title={i.label} onClick={() => { onPick(i.name); setOpen(false); }}
              className={`flex aspect-square items-center justify-center rounded-md text-foreground/80 hover:bg-[#E6F4FF] hover:text-primary ${current === i.name ? 'bg-[#E6F4FF] text-primary' : ''}`}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" dangerouslySetInnerHTML={{ __html: i.svg }} />
            </button>
          ))}
          {!loading && q && !icons.length && <p className="col-span-6 px-1 py-4 text-center text-[12px] text-foreground/40">No icons for “{q}”.</p>}
        </div>
      </PopoverContent>
    </Popover>
  );
}
