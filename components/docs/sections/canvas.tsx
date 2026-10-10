import { Callout, H2, H3, Kbd, Rows, Shot, Ui } from '../ui';

export function Canvas() {
  return (
    <>
      <p>
        Canvas is where you adjust a design by hand: change copy, swap a photo, recolor, move or resize a part, add a format. It keeps
        you inside the brand: brand colours only, the template’s type, sizes within what the layout allows.
      </p>

      <H2 id="open">Open a design</H2>
      <ul>
        <li>From the gallery: <Ui>Edit in Canvas</Ui> in a set’s panel or menu, or the link Claude gives with every design.</li>
        <li>From Templates: <Ui>Start in Canvas</Ui> opens a new design with the template’s sample copy.</li>
        <li>In Canvas itself: the <Ui>Library</Ui> tab lists your designs and the team’s.</li>
      </ul>
      <p>The design opens with its other formats beside it, as artboards.</p>
      <Shot src="/docs/canvas.webp" alt="Canvas" caption="Canvas: the panels on the left, the formats in the middle, the selected part’s properties on the right." />

      <H2 id="panels">The panels</H2>
      <Rows rows={[
        [<Ui key="c">Content</Ui>, 'The copy and images from the brief, in order. Click one to select it on the design. Optional details can be hidden with the eye; essential ones cannot.'],
        [<Ui key="l">Library</Ui>, 'Your designs and the team’s, to open another one.'],
        [<Ui key="a">Assets</Ui>, 'The team’s images: with a photo or logo selected, click an image to put it in.'],
        [<Ui key="i">Inspector</Ui>, 'Checks the design and suggests fixes (see below).'],
        ['Right panel', 'What the selected part lets you change. With nothing selected: whether Claude is connected, and tips.'],
      ]} />
      <p>For every layer of the design, use <Ui>Advanced: all layers</Ui> at the bottom of Content (and <Ui>Simple view</Ui> to go back).</p>

      <H2 id="text">Edit text</H2>
      <p>Double-click text on the design to type in place, or edit it in the right panel. You can also change:</p>
      <Rows rows={[
        ['Size', 'From 85% to 125% of the design’s size, or back to As designed.'],
        ['Weight', 'Regular or Bold (all weights in Advanced).'],
        ['Colour', 'Any brand colour.'],
      ]} />
      <p>Essential copy cannot be emptied: edit it instead.</p>

      <H2 id="images">Photos and logos</H2>
      <ul>
        <li><strong>Replace:</strong> select the photo and choose <Ui>Upload</Ui> or <Ui>Assets</Ui> (or, with it selected, click an image in the Assets tab).</li>
        <li><strong>Reframe:</strong> double-click the photo (or <Ui>Reframe</Ui>) and drag it; <Ui>Scale</Ui> to make it bigger or smaller inside its frame; <Ui>Reset framing</Ui> to go back.</li>
        <li><strong>Scale:</strong> pull a corner or edge of the photo to scale it inside its frame (the frame stays); hold <Kbd>⌥</Kbd> to resize the frame instead.</li>
        <li><strong>Generate content around:</strong> when the photo is smaller than its frame, AI paints the rest of the scene to fill it. The new photo is also saved in Assets; Undo brings the original back.</li>
        <li><strong>Remove:</strong> optional photos and logos can be removed, and the layout closes up.</li>
        <li><strong>Partner logos:</strong> <Ui>Mono</Ui> sets them in the design’s colour, <Ui>Color</Ui> keeps their own.</li>
        <li><strong>The brand logo</strong> can only be moved and scaled: its drawing and colours belong to the brand.</li>
      </ul>

      <H2 id="parts">Move, align and resize</H2>
      <p>
        Drag a part to move it (it stays inside the safe area), or use the arrows and <Ui>Center</Ui> in the right panel. Select several
        with <Kbd>⇧</Kbd>-click to align them to each other or in their container. <Ui>Hide</Ui> takes out parts that are not essential.{' '}
        <Ui>Back to the design</Ui> resets the selected part. <Ui>Advanced (X, Y, W, H, layout)</Ui> gives exact positions, sizes,
        opacity and spacing.
      </p>

      <H2 id="recolor">Recolor</H2>
      <p>
        Archy designs can be recolored in one click from <Ui>Look</Ui> in Content (or the background’s <Ui>Recolor</Ui>):{' '}
        <Ui>Dark</Ui>, <Ui>Blue</Ui>, <Ui>Ice</Ui> or <Ui>Light</Ui>. Text, buttons, lines, icons and the logo follow. DOC designs do not
        recolor this way: ask Claude for the design in another of its themes. Explorations open in Canvas like any design; a recolour
        does not repaint a pixel texture.
      </p>

      <H2 id="formats">Formats side by side</H2>
      <p>
        Each format is an artboard. Click its name tag to work on it; double-click to frame it. Formats are <strong>synced</strong>:
        changes to copy, images and colour go to the others too. Click the link icon on a tag to unsync that format and change it alone.
        Formats the design does not have yet appear dashed: click one, or <Ui>Add all formats</Ui>, to add them.
      </p>

      <H2 id="inspector">The Inspector</H2>
      <p>
        The Inspector checks alignment, the safe area, overlaps, cut-off text and readability. Each suggestion has a <Ui>Fix</Ui>, and{' '}
        <Ui>Fix all</Ui> fixes them all. The count shows in the header (“2 suggestions”). <Ui>Ask Claude to fix</Ui> hands them to Claude.
      </p>
      <Shot src="/docs/canvas-inspector.webp" alt="The Inspector in Canvas" caption="The Inspector tab. Here nothing needs fixing; otherwise each suggestion comes with its fix." />

      <H2 id="save">Save and download</H2>
      <p>Your work is kept as you go, as a draft (the header says <em>Saved</em>). The gallery’s images change only when you save:</p>
      <Rows rows={[
        [<Ui key="s">Save to gallery</Ui>, 'For a new design (from a template).'],
        [<Ui key="u">Update images</Ui>, 'For a design that is in the gallery. Choose Save as a new version (the original stays in the history) or Replace the original (same design and link).'],
        [<Ui key="d">Download</Ui>, 'The format you are on, as a 2x PNG, without saving.'],
      ]} />
      <p>Formats you added join the set either way. Replacing the original is for the person who made it, the project owner or an admin.</p>

      <H2 id="claude">Edit with Claude</H2>
      <p>
        With a design open in Canvas, ask Claude to change it: “make the headline shorter”, “recolor it light”, “use a ticket icon”,
        “fix the alignment”. Claude works on the design you have open, <strong>live</strong>: a frame shows Claude working, the parts it
        changes light up, and each change comes with <Ui>Undo</Ui>. Claude changes only what you asked and saves only when you ask it to.
      </p>
      <Callout>The right panel shows <strong>Connected</strong> when Claude can see Canvas. <Ui>Open Claude</Ui> starts a conversation about the design.</Callout>

      <H2 id="shortcuts">Keyboard shortcuts</H2>
      <H3>Edit</H3>
      <Rows rows={[
        [<span key="1"><Kbd>⌘</Kbd> <Kbd>Z</Kbd></span>, 'Undo'],
        [<span key="2"><Kbd>⇧</Kbd> <Kbd>⌘</Kbd> <Kbd>Z</Kbd></span>, 'Redo'],
        [<span key="3"><Kbd>⌘</Kbd> <Kbd>A</Kbd></span>, 'Select all'],
        [<Kbd key="4">Esc</Kbd>, 'Deselect'],
        [<span key="5"><Kbd>←</Kbd> <Kbd>→</Kbd> <Kbd>↑</Kbd> <Kbd>↓</Kbd></span>, 'Nudge 1 px (with ⇧: 10 px)'],
        [<Kbd key="6">Delete</Kbd>, 'Hide the selected part'],
      ]} />
      <H3>Select and view</H3>
      <Rows rows={[
        ['Click / ⇧ Click', 'Select / add to the selection'],
        ['⌘ Click', 'Select inside a group'],
        ['Double-click', 'Edit text, reframe a photo'],
        [<span key="v"><Kbd>V</Kbd> / <Kbd>H</Kbd></span>, 'Select tool / Hand tool (or hold Space)'],
        [<span key="z"><Kbd>⌘</Kbd> <Kbd>+</Kbd> / <Kbd>⌘</Kbd> <Kbd>−</Kbd></span>, 'Zoom in / out (or ⌘ + scroll)'],
        [<span key="0"><Kbd>⌘</Kbd> <Kbd>0</Kbd></span>, 'Fit all formats'],
        [<span key="1b"><Kbd>⌘</Kbd> <Kbd>1</Kbd></span>, '100%'],
      ]} />
    </>
  );
}
