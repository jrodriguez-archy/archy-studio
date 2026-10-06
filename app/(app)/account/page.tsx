import { currentUser } from '@/lib/team';
import { PasswordForm } from './password-form';

export const metadata = { title: 'Account · Archy Studio' };

export default async function AccountPage() {
  const me = await currentUser();
  return (
    <div className="max-w-md space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Account</h1>
        <p className="mt-1 text-muted-foreground">{me?.email}</p>
      </div>
      <PasswordForm />
    </div>
  );
}
