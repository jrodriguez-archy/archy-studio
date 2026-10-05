'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { supabaseBrowser } from '@/lib/supabase/browser';

export function ConsentForm({ authorizationId, clientName, email, scopes }: { authorizationId: string; clientName: string; email: string; scopes: string[] }) {
  const [busy, setBusy] = useState<'approve' | 'deny' | null>(null);
  const [error, setError] = useState('');

  async function decide(kind: 'approve' | 'deny') {
    setBusy(kind);
    const oauth = supabaseBrowser().auth.oauth;
    const { error } = kind === 'approve' ? await oauth.approveAuthorization(authorizationId) : await oauth.denyAuthorization(authorizationId);
    if (error) {
      setError(error.message);
      setBusy(null);
    } // on success the browser is sent back to Claude
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connect {clientName} to Archy Studio</CardTitle>
        <CardDescription>
          {clientName} will make pieces from Archy templates as <span className="font-medium text-foreground">{email}</span>. Every piece is saved to the team gallery under your name.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        <p>It can list templates, render pieces and read approved assets. It cannot change templates or your account.</p>
        {scopes.length > 0 && <p className="text-xs">Requested: {scopes.join(', ')}</p>}
        {error && <p className="text-destructive">{error}</p>}
      </CardContent>
      <CardFooter className="gap-2">
        <Button className="flex-1" onClick={() => decide('approve')} disabled={!!busy}>{busy === 'approve' ? 'Connecting…' : 'Allow'}</Button>
        <Button variant="outline" onClick={() => decide('deny')} disabled={!!busy}>Deny</Button>
      </CardFooter>
    </Card>
  );
}
