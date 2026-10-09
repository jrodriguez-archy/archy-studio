import { Callout, H2, Rows, Shot, Ui } from '../ui';

export function Gallery() {
  return (
    <>
      <H2 id="gallery">The gallery</H2>
      <p>
        Every design made with Studio, by Claude or in Canvas, is saved to the <strong>Gallery</strong>. <Ui>Mine</Ui> shows yours;{' '}
        <Ui>Team</Ui> shows everyone’s. Filter by format with <Ui>Post</Ui>, <Ui>Story</Ui>, <Ui>OG</Ui> or <Ui>Cover</Ui>. New designs
        appear by themselves while Claude makes them.
      </p>
      <p>
        One card is one <strong>set</strong>: everything made from one brief, its formats stacked behind the first one (“3 formats”).
        Under each card: its title, template, formats, who made it and when, and its project.
      </p>

      <H2 id="open-set">Open a set</H2>
      <p>Click a card to open the set. Switch formats in the strip under the image; move between sets with the arrow keys; close with <strong>Esc</strong>. The panel shows its formats and sizes, the template, the project, who made it, and the copy.</p>
      <Shot src="/docs/set-panel.webp" alt="A set open in the gallery" caption="An open set: formats, downloads and details." />
      <Callout kind="note">The address changes when a set is open, so you can share that link with the team.</Callout>

      <H2 id="download">Download</H2>
      <Rows rows={[
        [<Ui key="a">Download all (N)</Ui>, 'Every format of the set in one ZIP.'],
        [<Ui key="b">Download</Ui>, 'The format you are looking at, as a PNG.'],
        ['Format rows', 'A download icon next to each format.'],
      ]} />
      <p>Every PNG is <strong>2x</strong> (a Post is 2160 × 2700 px), sharp on any screen. Hover a card in the gallery to download straight from it.</p>

      <H2 id="set-menu">The set menu</H2>
      <p>Right-click a card, or use its <Ui>···</Ui> button:</p>
      <Rows rows={[
        [<Ui key="1">Edit in Canvas</Ui>, 'Opens the design, with its other formats beside it.'],
        [<Ui key="2">Download format</Ui>, 'One format, from a list with their sizes.'],
        [<Ui key="3">Move to project</Ui>, 'File it in a project, create a new one, or take it out.'],
        [<Ui key="4">Rename…</Ui>, 'Change the set’s title.'],
        [<Ui key="5">New version with Claude</Ui>, 'Copies a prompt with the same template and brief, to paste in Claude.'],
        [<Ui key="6">Copy link</Ui>, 'A link that opens this set.'],
        [<Ui key="7">Copy set ID</Ui>, 'For Claude: “keep it in set …”.'],
        [<Ui key="8">Archive</Ui>, 'Hides it from the gallery (you can undo, or restore it later).'],
      ]} />

      <H2 id="projects">Projects</H2>
      <p>
        Projects are folders for sets: a campaign, an event, a client. Create one with <Ui>+</Ui> next to Projects in the sidebar. A
        project is <strong>Team</strong> (everyone sees it) or <strong>Only me</strong> (your personal folder). Move sets in with{' '}
        <Ui>Move to project</Ui>, or ask Claude to save new designs there. Deleting a project keeps its designs in the gallery.
      </p>

      <H2 id="archive">Archive</H2>
      <p>
        Archived sets leave the gallery and wait in <Ui>Archive</Ui>, where you can <Ui>Restore</Ui> them or{' '}
        <Ui>Delete permanently</Ui> (that cannot be undone). To act on several at once, click <Ui>Select</Ui> (or ⌘-click a card,
        Shift-click for a range) and use the bar at the bottom: <Ui>Restore</Ui> or <Ui>Delete…</Ui>.
      </p>
      <Shot src="/docs/archive-select.webp" alt="Selecting several archived sets" caption="Select several archived sets to restore or delete them together." />

      <H2 id="who">Who can change what</H2>
      <p>Anyone on the team can see, download and open any design. Moving, renaming, archiving, deleting and replacing a design is for the person who made it, the owner of its project, or an admin. Download links work for anyone signed in to Studio until the design is archived or deleted.</p>
    </>
  );
}
