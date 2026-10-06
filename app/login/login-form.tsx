'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
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

  function changeEmail() {
    setStep('email');
    setPassword('');
    setConfirm('');
    setError('');
  }

  return (
    <div className="space-y-4 text-[13px]">
      {step !== 'email' && (
        <div className="space-y-1">
          <p className="font-medium">{title}</p>
          <div className="flex items-center gap-1.5">
            <span className="min-w-0 truncate text-muted-foreground">{email.trim().toLowerCase()}</span>
            <span className="text-muted-foreground/50">·</span>
            <button type="button" onClick={changeEmail} className="shrink-0 font-medium text-foreground underline-offset-4 hover:underline">
              Change
            </button>
          </div>
          {step === 'create-password' && (
            <p className="pt-1 text-muted-foreground">First time here: choose a password of at least 10 characters.</p>
          )}
        </div>
      )}
        <form onSubmit={submit} className="space-y-3">
          {step === 'email' ? (
            <div className="space-y-1">
              <Label htmlFor="email" className="text-[13px] font-normal">Email</Label>
              <Input className="h-8 text-[13px]" id="email" type="email" autoComplete="username" placeholder="you@archy.com" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          ) : (
            <>
              <input type="email" autoComplete="username" value={email} readOnly hidden />
              <div className="space-y-1">
                <Label htmlFor="password" className="text-[13px] font-normal">Password</Label>
                <Input className="h-8 text-[13px]" id="password" type="password" required autoFocus minLength={step === 'create-password' ? 10 : undefined}
                  autoComplete={step === 'create-password' ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              {step === 'create-password' && (
                <div className="space-y-1">
                  <Label htmlFor="confirm" className="text-[13px] font-normal">Repeat password</Label>
                  <Input className="h-8 text-[13px]" id="confirm" type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
                </div>
              )}
            </>
          )}
          {error && <p className="text-destructive">{error}</p>}
          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy ? 'One moment…' : step === 'email' ? 'Continue' : step === 'sign-in' ? 'Sign in' : 'Create password and sign in'}
          </Button>
          {step === 'sign-in' && (
            <p className="pt-1 text-center text-[12px] text-muted-foreground">Forgot your password? Ask an admin to reset it.</p>
          )}
        </form>
    </div>
  );
}
