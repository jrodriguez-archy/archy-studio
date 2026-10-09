import { Callout, H2, Rows, Shot } from '../ui';

export function Brands() {
  return (
    <>
      <H2 id="switch">Switch brand</H2>
      <p>
        At the bottom of the sidebar, the brand row shows the brand you are working in. Click it and choose <strong>Archy</strong> or{' '}
        <strong>DOC</strong>. Studio opens that brand’s gallery, and remembers your choice. Opening a link to a design, project or template
        of the other brand switches for you.
      </p>
      <Shot src="/docs/brand-menu.webp" alt="The brand menu" caption="The brand menu at the bottom of the sidebar." width={1440} height={900} />

      <H2 id="separate">What each brand keeps</H2>
      <Rows rows={[
        ['Templates', 'Each brand has its own catalog.'],
        ['Gallery and Archive', 'Designs show only in their brand.'],
        ['Projects', 'A project belongs to one brand.'],
        ['Assets', 'Images and folders belong to one brand.'],
      ]} />
      <p>With Claude, say which brand the brief is for when it is DOC (“a DOC ad…”); Archy is the default.</p>

      <H2 id="doc-templates">DOC templates</H2>
      <p>
        DOC, the Dental Ownership Collective, has its own identity: Satoshi type, cream and red, and its three track colours. Every DOC
        template comes in five themes: <strong>Foundations</strong> (red), <strong>Startup</strong> (purple), <strong>Acquisition</strong>{' '}
        (green), <strong>Dark</strong> and <strong>Light</strong>. Use the track the piece is about; Dark and Light speak for the collective as a
        whole. The templates cover claims, numbers, lists, explainers (myth and fact, glossary), scroll stoppers, faculty and events.
      </p>

      <H2 id="doc-rules">DOC rules</H2>
      <ul>
        <li>Never invent a figure, price, date, module count, quote or name: only real ones from the brief.</li>
        <li>Archy appears on DOC only as its sponsor.</li>
        <li>Each theme has its call to action: Foundations “Join the waitlist”, Startup “Enroll now”, Acquisition “Register now”, Dark “Apply today”, Light “Get started”, unless the brief gives its own.</li>
      </ul>
      <Callout kind="note">Archy’s one-click recolors (Dark, Blue, Ice, Light) are only for Archy designs. A DOC design changes theme by asking Claude for it in another theme.</Callout>
    </>
  );
}
