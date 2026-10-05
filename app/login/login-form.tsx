'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabaseBrowser } from '@/lib/supabase/browser';

export function LoginForm({ next, linkError }: { next: string; linkError: boolean }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState(linkError ? 'That link expired or was already used. Ask for a new one.' : '');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const address = email.trim().toLowerCase();
    if (!address.endsWith('@archy.com')) {
      setState('error');
      setMessage('Use your @archy.com email.');
      return;
    }
    setState('sending');
    const { error } = await supabaseBrowser().auth.signInWithOtp({
      email: address,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (error) {
      setState('error');
      setMessage(error.message.includes('Database error') ? 'Archy Studio is only for @archy.com accounts.' : error.message);
    } else setState('sent');
  }

  if (state === 'sent') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Check your email</CardTitle>
          <CardDescription>
            We sent a sign-in link to <span className="font-medium text-foreground">{email}</span>. Open it on this device.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="ghost" className="px-0" onClick={() => setState('idle')}>Use another email</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>We will email you a link. No password needed.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Work email</Label>
            <Input id="email" type="email" autoComplete="email" placeholder="you@archy.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          {message && <p className={`text-sm ${state === 'error' || linkError ? 'text-destructive' : 'text-muted-foreground'}`}>{message}</p>}
          <Button type="submit" className="w-full" disabled={state === 'sending'}>
            {state === 'sending' ? 'Sending…' : 'Email me a sign-in link'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
