'use client';

import { useEffect, useState, useTransition } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { LockIcon, UserGroupIcon } from '@hugeicons/core-free-icons';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

// Create or edit a project: a name and who sees it (the team, or only its owner).
export function ProjectDialog({ open, onOpenChange, title, action, initial, onSubmit }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  action: string;
  initial?: { name: string; shared: boolean };
  onSubmit: (name: string, shared: boolean) => Promise<boolean>;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [shared, setShared] = useState(initial?.shared ?? true);
  const [pending, start] = useTransition();
  useEffect(() => {
    if (open) { setName(initial?.name ?? ''); setShared(initial?.shared ?? true); }
  }, [open, initial?.name, initial?.shared]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-5 rounded-md p-6 text-[13px] sm:max-w-[380px]">
        <DialogHeader>
          <DialogTitle className="text-[15px] font-medium">{title}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            start(async () => { if (await onSubmit(name, shared)) onOpenChange(false); });
          }}
        >
          <div className="space-y-1">
            <label htmlFor="project-name" className="text-foreground/60">Name</label>
            <Input id="project-name" autoFocus maxLength={80} placeholder="Chicago Midwinter 2027" value={name} onChange={(e) => setName(e.target.value)} className="h-8 text-[13px]" />
          </div>
          <div className="space-y-1">
            <p className="text-foreground/60">Who sees it</p>
            <div className="grid grid-cols-2 gap-1.5" role="radiogroup">
              {[
                { value: true, label: 'Team', hint: 'Everyone in Studio', icon: UserGroupIcon },
                { value: false, label: 'Only me', hint: 'Personal folder', icon: LockIcon },
              ].map((o) => (
                <button
                  key={o.label}
                  type="button"
                  role="radio"
                  aria-checked={shared === o.value}
                  onClick={() => setShared(o.value)}
                  className={`flex flex-col items-start gap-1 rounded-md px-3 py-2.5 text-left transition-colors ${
                    shared === o.value ? 'bg-[#E6F4FF] text-primary ring-1 ring-primary/25' : 'bg-foreground/[0.04] text-foreground/60 hover:bg-foreground/[0.07]'
                  }`}
                >
                  <HugeiconsIcon icon={o.icon} className="size-4" strokeWidth={1.6} />
                  <span className="font-medium">{o.label}</span>
                  <span className={shared === o.value ? 'text-primary/70' : 'text-foreground/40'}>{o.hint}</span>
                </button>
              ))}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" size="lg" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" size="lg" disabled={pending || !name.trim()}>{pending ? 'Saving…' : action}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
