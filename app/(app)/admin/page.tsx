import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/app-shell';
import { currentUser, listTeam } from '@/lib/team';
import { TeamManager } from './team-manager';

export const metadata = { title: 'Team' };

export default async function AdminPage() {
  const me = await currentUser();
  if (!me?.is_admin) redirect('/');
  // DOC access only exists for admins who have DOC themselves.
  const team = (await listTeam()).map(({ doc_access, ...m }) => (me.doc ? { ...m, doc_access } : m));
  return (
    <div className="max-w-3xl">
      <PageHeader title="Team" description="People on the list create their own password the first time they sign in." />
      <TeamManager team={team} me={me.email} canDoc={me.doc} />
    </div>
  );
}
