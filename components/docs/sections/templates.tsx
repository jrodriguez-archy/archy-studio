import Link from 'next/link';
import { Callout, H2, Rows, Shot, Ui } from '../ui';

export function Templates() {
  return (
    <>
      <H2 id="catalog">The catalog</H2>
      <p>
        Templates are the approved designs Studio builds from, prepared by the design team in Paper. Each one exists for a kind of message
        (a booth invite, a reminder, a person spotlight…) and comes in several formats. The catalog groups them by category and purpose:
        for Archy, <strong>Events</strong> (booth invites, day-before reminders, hosted evenings, speaker invites) and <strong>Ads</strong>{' '}
        (spotlights, photo ads); for DOC, its ads by purpose (claims, numbers, lists, explainers, scroll stoppers, faculty, events).
      </p>
      <Shot src="/docs/templates.webp" alt="The templates catalog" caption="The catalog: each card stacks a template’s formats." />

      <H2 id="formats">Formats</H2>
      <Rows rows={[
        ['Post', '1080 × 1350. AE Spotlight’s Post is square, 1080 × 1080.'],
        ['Square', '1080 × 1080'],
        ['Stories', '1080 × 1920'],
        ['OG', '1200 × 630, the link preview (Archy event templates)'],
        ['Cover', '1200 × 900, the website’s event page cover (most Archy event templates)'],
      ]} />
      <p>DOC templates come in Post, Square and Stories.</p>

      <H2 id="designs-themes">Designs and themes</H2>
      <p>
        Some templates offer several <strong>designs</strong> (layouts) and <strong>themes</strong> (colour grounds) with the same content.
        AE Spotlight, for example, has five designs (Meet Name, The Arch, Grid Card, Mosaic, Forum) in White, Royal Blue and Navy. Every DOC
        template comes in Foundations, Startup, Acquisition, Dark and Light.
      </p>

      <H2 id="template-page">A template’s page</H2>
      <p>Click a card to see its details, or open its full page:</p>
      <Rows rows={[
        ['Use when / Not when', 'When this template is the right one, and which to use instead.'],
        ['Needs', 'The facts it cannot go without (the event name, the date…).'],
        ['Also shows', 'Optional details it shows when you have them.'],
        ['Slots', 'Each place for text or an image, Essential or Optional.'],
        ['Room', 'How much copy fits: characters per line × lines, at full size. Text can shrink a little to fit more.'],
      ]} />
      <Shot src="/docs/template-panel.webp" alt="A template’s details" caption="A template’s details, with its designs, themes and slots." />

      <H2 id="use">Use a template</H2>
      <ul>
        <li><Ui>Copy prompt for Claude</Ui>: a prompt listing what the template needs, to paste in Claude and fill in.</li>
        <li><Ui>Copy template ID</Ui>: give it to Claude to use this template directly.</li>
        <li><Ui>Start in Canvas</Ui>: open it in Canvas with its sample copy and make it yours. <Link href="/docs/canvas">Canvas</Link></li>
        <li><Ui>Copy link</Ui>: share the template with someone.</li>
      </ul>
      <Callout kind="note">Templates change only through the design team. If something is missing from the catalog, ask them: a new template has to hold a kind of content the others cannot.</Callout>
    </>
  );
}
