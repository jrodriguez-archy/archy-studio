'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { checkEmail, setFirstPassword } from './actions';

type Step = 'email' | 'sign-in' | 'create-password';

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function signIn(address: string, pwd: string) {
    const { error } = await supabaseBrowser().auth.signInWithPassword({ email: address, password: pwd });
    if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Wrong password.' : error.message);
    router.replace(next);
    router.refresh();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    const address = email.trim().toLowerCase();
    try {
      if (step === 'email') {
        const status = await checkEmail(address);
        if (status === 'not-allowed') throw new Error('This email is not on the Archy Studio team list. Ask an admin to add you.');
        setStep(status);
      } else if (step === 'sign-in') {
        await signIn(address, password);
      } else {
        if (password !== confirm) throw new Error('The passwords do not match.');
        const res = await setFirstPassword(address, password);
        if (!res.ok) throw new Error(res.error);
        await signIn(address, password);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const title = step === 'create-password' ? 'Create your password' : 'Sign in';
  const description =
    step === 'email' ? 'Use your @archy.com email.' :
    step === 'sign-in' ? email.trim().toLowerCase() :
    'First time here: choose a password of at least 10 characters.';

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          {step === 'email' ? (
            <div className="space-y-2">
              <Label htmlFor="email">Work email</Label>
              <Input id="email" type="email" autoComplete="username" placeholder="you@archy.com" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          ) : (
            <>
              <input type="email" autoComplete="username" value={email} readOnly hidden />
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" required autoFocus minLength={step === 'create-password' ? 10 : undefined}
                  autoComplete={step === 'create-password' ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              {step === 'create-password' && (
                <div className="space-y-2">
                  <Label htmlFor="confirm">Repeat password</Label>
                  <Input id="confirm" type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
                </div>
              )}
            </>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? 'One moment…' : step === 'email' ? 'Continue' : step === 'sign-in' ? 'Sign in' : 'Create password and sign in'}
          </Button>
          {step !== 'email' && (
            <Button type="button" variant="ghost" className="w-full" onClick={() => { setStep('email'); setPassword(''); setConfirm(''); setError(''); }}>
              Use another email
            </Button>
          )}
          {step === 'sign-in' && <p className="text-center text-xs text-muted-foreground">Forgot it? Ask an admin to reset your password.</p>}
        </form>
      </CardContent>
    </Card>
  );
}
