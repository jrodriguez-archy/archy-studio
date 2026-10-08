import { PageHeader } from '@/components/app-shell';
import { currentUser } from '@/lib/team';
import { displayName, nameFromEmail } from '@/lib/names';
import { NameForm } from './name-form';
import { PasswordForm } from './password-form';

export const metadata = { title: 'Account · Archy Studio' };

export default async function AccountPage() {
  const me = await currentUser();
  return (
    <div className="max-w-sm">
      <PageHeader title="Account" description={me?.email} />
      <NameForm initial={me ? displayName(me.full_name, me.email) : ''} suggested={me ? nameFromEmail(me.email) : ''} />
      <div className="mt-8 border-t border-foreground/[0.06]" />
      <PasswordForm />
    </div>
  );
}
