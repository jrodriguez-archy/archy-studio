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
    </>
  );
}
