import Link from 'next/link';
import { H2, Rows, Ui } from '../ui';

export function Admin() {
  return (
    <>
      <H2 id="team">Team</H2>
      <p>Only people on the team list can sign in to Studio (and connect Claude to it). In <Ui>Admin</Ui> → <Ui>Team</Ui>:</p>
      <Rows rows={[
        [<Ui key="a">Add person</Ui>, 'Their Archy email; tick Admin to let them manage the team and review templates. They create their own password the first time they sign in.'],
        [<Ui key="r">Reset password</Ui>, 'Their password stops working and they create a new one at their next sign-in.'],
        [<Ui key="x">Remove</Ui>, 'They lose access to Studio and Claude. Their designs stay in the gallery.'],
      ]} />
      <p>Each person shows when they last signed in, or that they are waiting for their first sign-in.</p>

      <H2 id="review">Template review</H2>
      <p>
        New templates are checked here before they reach the team: each one with realistic, short and long copy, and every theme, in every
        format. <Ui>Approve</Ui> it, or click on a design to leave a comment on that spot; Claude works through the comments and the next
        round shows before and after. Admins also see admin-only pages like this one in the Docs.
      </p>

      <H2 id="missing">Missing templates</H2>
      <p>
        When a brief needs a kind of piece the catalog does not have, Claude notes it here: what was asked, the size, what it offered
        instead and why it did not do. The most asked for come first: the next templates to make.
      </p>

      <H2 id="proposals">Template proposals</H2>
      <p>
        <Link href="/docs/explorations">Explorations</Link> the team proposed as templates, with their note. Move each along with{' '}
        <Ui>Making it</Ui>, <Ui>Done</Ui> or <Ui>Dismiss</Ui>; the filters show each state.
      </p>
    </>
  );
}
