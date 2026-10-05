import { ArchyWordmark } from '@/components/archy-wordmark';
import { LoginForm } from './login-form';

export const metadata = { title: 'Sign in · Archy Studio' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <main className="min-h-dvh grid place-items-center bg-secondary px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-2 text-center">
          <ArchyWordmark className="mx-auto h-9 w-auto text-primary" />
          <p className="text-sm text-muted-foreground">Studio · finished marketing pieces from approved templates</p>
        </div>
        <LoginForm next={next ?? '/'} linkError={error === 'link'} />
      </div>
    </main>
  );
}
