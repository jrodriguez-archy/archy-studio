import { redirect } from 'next/navigation';
import { ArchyWordmark } from '@/components/archy-wordmark';
import { supabaseServer } from '@/lib/supabase/server';
import { ConsentForm } from './consent-form';

export const metadata = { title: 'Authorize · Archy Studio' };

// Supabase's OAuth server sends Claude's sign-in here. The person signs in (magic link) if needed,
// sees which app asks for access, and approves or denies.
export default async function ConsentPage({ searchParams }: { searchParams: Promise<{ authorization_id?: string }> }) {
  const { authorization_id: id } = await searchParams;
  if (!id) redirect('/');
  const supabase = await supabaseServer();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect(`/login?next=${encodeURIComponent(`/oauth/consent?authorization_id=${id}`)}`);

  const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(id);
  if (error || !data) {
    return <Shell><p className="text-sm text-destructive">This authorization request expired or is not valid. Start the connection again from Claude.</p></Shell>;
  }
  // Already approved before: Supabase hands back the redirect straight away.
  if (!('authorization_id' in data)) redirect(data.redirect_url);

  return (
    <Shell>
      <ConsentForm
        authorizationId={data.authorization_id}
        clientName={data.client?.name || 'Claude'}
        email={String(claims.claims.email ?? '')}
        scopes={(data.scope ?? '').split(' ').filter(Boolean)}
      />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh grid place-items-center bg-secondary px-4">
      <div className="w-full max-w-sm space-y-8">
        <ArchyWordmark className="mx-auto h-9 w-auto text-primary" />
        {children}
      </div>
    </main>
  );
}
