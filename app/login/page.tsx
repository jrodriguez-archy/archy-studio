import { AuthShell } from '@/components/auth-shell';
import { LoginForm } from './login-form';

export const metadata = { title: 'Sign in · Archy Studio' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <AuthShell>
      <LoginForm next={next && next.startsWith('/') && !next.startsWith('//') ? next : '/'} />
    </AuthShell>
  );
}
