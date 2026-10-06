import { redirect } from 'next/navigation';
import { currentUser, listTeam } from '@/lib/team';
import { TeamManager } from './team-manager';

export const metadata = { title: 'Team · Archy Studio' };

export default async function AdminPage() {
  const me = await currentUser();
  if (!me?.is_admin) redirect('/');
  const team = await listTeam();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Team</h1>
        <p className="mt-1 text-muted-foreground">Who can use Archy Studio. People on the list create their own password the first time they sign in.</p>
      </div>
      <TeamManager team={team} me={me.email} />
    </div>
  );
}
