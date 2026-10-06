'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabaseBrowser } from '@/lib/supabase/browser';

export function PasswordForm() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 10) return toast.error('Use at least 10 characters.');
    if (password !== confirm) return toast.error('The passwords do not match.');
    setBusy(true);
    const { error } = await supabaseBrowser().auth.updateUser({ password });
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success('Password changed');
      setPassword('');
      setConfirm('');
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4 text-[13px]">
      <p className="text-foreground/40">Change password · at least 10 characters</p>
      <div className="space-y-1.5">
        <Label htmlFor="new" className="text-[13px] font-normal">New password</Label>
        <Input id="new" type="password" autoComplete="new-password" className="h-8 text-[13px]" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="repeat" className="text-[13px] font-normal">Repeat password</Label>
        <Input id="repeat" type="password" autoComplete="new-password" className="h-8 text-[13px]" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </div>
      <Button type="submit" size="lg" disabled={busy}>{busy ? 'Saving…' : 'Save password'}</Button>
    </form>
  );
}
