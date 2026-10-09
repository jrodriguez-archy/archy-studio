import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/app-shell';
import { currentUser, listTeam } from '@/lib/team';
import { TeamManager } from './team-manager';

export const metadata = { title: 'Team' };

export default async function AdminPage() {
  const me = await currentUser();
  if (!me?.is_admin) redirect('/');
  const team = await listTeam();
  return (
    <div className="max-w-3xl">
      <PageHeader title="Team" description="People on the list create their own password the first time they sign in." />
      <TeamManager team={team} me={me.email} />
    </div>
  );
}
