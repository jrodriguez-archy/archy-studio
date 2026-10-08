'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateNameAction } from './actions';

export function NameForm({ initial, suggested }: { initial: string; suggested: string }) {
  const router = useRouter();
  const [name, setName] = useState(initial);
  useEffect(() => setName(initial), [initial]); // as saved (trimmed, or the email's name when cleared)
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await updateNameAction(name);
    setBusy(false);
    if (!r.ok) { toast.error(r.error); return; }
    toast.success('Name saved');
    if (!name.trim()) setName(suggested);
    router.refresh();
  }
  return (
    <form onSubmit={submit} className="mt-6 space-y-4 text-[13px]">
      <div className="space-y-1.5">
        <Label htmlFor="name" className="text-[13px] font-normal">Name</Label>
        <Input id="name" autoComplete="name" placeholder={suggested} maxLength={80} className="h-8 text-[13px]" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <Button type="submit" size="lg" disabled={busy || name.trim() === initial.trim()}>{busy ? 'Saving…' : 'Save name'}</Button>
    </form>
  );
}
