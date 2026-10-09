'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
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
    <div className="space-y-4 text-[13px]">
      <div className="space-y-1">
        <p className="font-medium">Connect {clientName}</p>
        <p className="text-muted-foreground">
          {clientName} will make designs from Archy templates as <span className="text-foreground">{email}</span>. Each design is saved to the gallery under your name.
        </p>
      </div>
      <p className="text-muted-foreground">It can make designs from the templates, read the team's images, file designs in projects, send you photo links and edit the design you have open in Canvas. It cannot change templates, delete anything or touch your account.</p>
      {scopes.length > 0 && <p className="text-foreground/40">Requested: {scopes.join(', ')}</p>}
      {error && <p className="text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button size="lg" className="flex-1" onClick={() => decide('approve')} disabled={!!busy}>{busy === 'approve' ? 'Connecting…' : 'Allow'}</Button>
        <Button size="lg" variant="outline" onClick={() => decide('deny')} disabled={!!busy}>Deny</Button>
      </div>
    </div>
  );
}
