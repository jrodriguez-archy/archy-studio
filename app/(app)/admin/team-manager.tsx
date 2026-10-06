'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import type { Member } from '@/lib/team';
import { addMemberAction, removeMemberAction, resetPasswordAction } from './actions';

export function TeamManager({ team, me }: { team: Member[]; me: string }) {
  const [email, setEmail] = useState('');
  const [admin, setAdmin] = useState(false);
  const [pending, start] = useTransition();

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, done: string) =>
    start(async () => {
      const res = await fn();
      if (res.ok) toast.success(done);
      else toast.error(res.error ?? 'Something went wrong');
    });

  return (
    <div className="mt-6 space-y-8 text-[13px]">
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          act(() => addMemberAction(email, admin), `${email} can now sign in`);
          setEmail('');
          setAdmin(false);
        }}
      >
        <Input type="email" placeholder="name@archy.com" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-8 max-w-xs flex-1 text-[13px]" aria-label="Email to add" />
        <label className="flex items-center gap-2 px-1 text-foreground/60">
          <Checkbox checked={admin} onCheckedChange={(v) => setAdmin(v === true)} /> Admin
        </label>
        <Button type="submit" size="lg" disabled={pending}>Add person</Button>
      </form>

      <div className="border-t border-foreground/[0.06]">
        {team.map((m) => (
          <div key={m.email} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-foreground/[0.06] py-2.5">
            <span className={`size-1.5 shrink-0 rounded-full ${m.status === 'active' ? 'bg-emerald-500' : 'bg-foreground/20'}`} aria-hidden />
            <span className="min-w-0 truncate">{m.email}</span>
            {m.is_admin && <span className="text-foreground/40">Admin</span>}
            <span className="text-foreground/40">
              {m.status === 'active' ? (m.last_sign_in ? `Last in ${new Date(m.last_sign_in).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : 'Active') : 'Waiting for first sign-in'}
            </span>
            {m.email !== me && (
              <span className="ml-auto flex gap-1">
                <Confirm
                  trigger={<Button variant="ghost" size="sm" disabled={pending || m.status === 'pending'} className="text-foreground/60">Reset password</Button>}
                  title={`Reset ${m.email}'s password?`}
                  description="Their current password stops working. The next time they sign in, they create a new one."
                  action="Reset"
                  onConfirm={() => act(() => resetPasswordAction(m.email), 'Password reset')}
                />
                <Confirm
                  trigger={<Button variant="ghost" size="sm" disabled={pending} className="text-destructive">Remove</Button>}
                  title={`Remove ${m.email}?`}
                  description="They lose access to Studio and Claude. The designs they made stay in the gallery."
                  action="Remove"
                  onConfirm={() => act(() => removeMemberAction(m.email), 'Removed')}
                />
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Confirm({ trigger, title, description, action, onConfirm }: { trigger: React.ReactElement; title: string; description: string; action: string; onConfirm: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger render={trigger} />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{action}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
