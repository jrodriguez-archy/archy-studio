import { PageHeader } from '@/components/app-shell';
import { currentUser } from '@/lib/team';
import { PasswordForm } from './password-form';

export const metadata = { title: 'Account · Archy Studio' };

export default async function AccountPage() {
  const me = await currentUser();
  return (
    <div className="max-w-sm">
      <PageHeader title="Account" description={me?.email} />
      <PasswordForm />
    </div>
  );
}
