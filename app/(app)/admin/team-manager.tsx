'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
    <div className="space-y-6">
      <Card>
        <CardContent>
          <form
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              act(() => addMemberAction(email, admin), `${email} can now sign in`);
              setEmail('');
              setAdmin(false);
            }}
          >
            <div className="flex-1 space-y-2">
              <Label htmlFor="new-email">Add someone</Label>
              <Input id="new-email" type="email" placeholder="name@archy.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <label className="flex h-9 items-center gap-2 text-sm">
              <Checkbox checked={admin} onCheckedChange={(v) => setAdmin(v === true)} /> Admin
            </label>
            <Button type="submit" disabled={pending}>Add</Button>
          </form>
        </CardContent>
      </Card>

      <Card className="overflow-x-auto py-0">
        <Table className="min-w-[560px]">
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Last sign-in</TableHead>
              <TableHead className="pr-4 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {team.map((m) => (
              <TableRow key={m.email}>
                <TableCell className="pl-4">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{m.email}</span>
                    {m.is_admin && <Badge variant="secondary">Admin</Badge>}
                  </div>
                </TableCell>
                <TableCell>
                  {m.status === 'active' ? <Badge>Active</Badge> : <Badge variant="outline">Waiting for first sign-in</Badge>}
                </TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">
                  {m.last_sign_in ? new Date(m.last_sign_in).toLocaleString() : '—'}
                </TableCell>
                <TableCell className="pr-4 text-right">
                  {m.email !== me && (
                    <div className="flex justify-end gap-2">
                      <Confirm
                        trigger={<Button variant="outline" size="sm" disabled={pending || m.status === 'pending'}>Reset password</Button>}
                        title={`Reset ${m.email}'s password?`}
                        description="Their current password stops working. The next time they sign in, they create a new one."
                        action="Reset"
                        onConfirm={() => act(() => resetPasswordAction(m.email), 'Password reset')}
                      />
                      <Confirm
                        trigger={<Button variant="ghost" size="sm" className="text-destructive" disabled={pending}>Remove</Button>}
                        title={`Remove ${m.email}?`}
                        description="They lose access to Studio and Claude. The pieces they made stay in the gallery."
                        action="Remove"
                        onConfirm={() => act(() => removeMemberAction(m.email), 'Removed')}
                      />
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
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
