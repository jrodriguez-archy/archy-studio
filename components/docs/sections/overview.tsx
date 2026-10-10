import Link from 'next/link';
import { Callout, H2, Shot, Ui } from '../ui';

export function Overview() {
  return (
    <>
      <H2 id="what">What Studio does</H2>
      <p>
        Archy Studio turns a brief into finished marketing designs. You say what you need (“we have booth #1211 at the Chicago Midwinter
        Meeting, February 18 to 20”), and Studio builds it from <strong>approved templates</strong> made by the design team: the right
        layout, the brand’s colours and type, your copy fitted to the space, in every format you need (Post, Square, Stories, link preview
        and event page cover).
      </p>
      <p>
        Everything you make is saved to the <strong>Gallery</strong>, where the whole team can find it, download it as PNG, file it in a
        project or open it in <strong>Canvas</strong> to adjust it by hand.
      </p>
      <Shot src="/docs/gallery.webp" alt="The Studio gallery" caption="The gallery: one card per brief, with all its formats stacked." />

      <H2 id="ways">Three ways to work</H2>
      <ul>
        <li><strong>Ask Claude.</strong> The fastest way. Connect Archy Studio to Claude once, then ask for designs in your own words, in any conversation. Claude picks the template, asks for anything missing, writes the copy and delivers the PNGs. <Link href="/docs/make-designs">How to brief Claude</Link></li>
        <li><strong>Start from a template.</strong> Browse <Ui>Templates</Ui>, pick one and open it in Canvas with <Ui>Start in Canvas</Ui>, or copy its prompt for Claude. <Link href="/docs/templates">Templates</Link></li>
        <li><strong>Edit in Canvas.</strong> Open any design to change copy, swap photos, recolor, resize parts or add formats; Claude can work on it with you, live. <Link href="/docs/canvas">Canvas</Link></li>
      </ul>

      <p>
        When no template fits, Claude can <strong>explore</strong>: a new design in the Archy brand, checked by Studio and labelled
        Exploration in the gallery. <Link href="/docs/explorations">Explorations</Link>
      </p>

      <H2 id="brands">Archy and DOC</H2>
      <p>
        Studio works for two brands: <strong>Archy</strong> (the default) and <strong>DOC</strong>, the Dental Ownership Collective. Each
        has its own templates, images, gallery and projects, and they never mix. Switch brand at the bottom of the sidebar.{' '}
        <Link href="/docs/brands">Archy and DOC</Link>
      </p>

      <H2 id="start">Start here</H2>
      <ol className="list-decimal space-y-1.5 pl-5 marker:text-foreground/40">
        <li><Link href="/docs/connect-claude">Connect Claude</Link> (two minutes, once).</li>
        <li>Ask for your first design: <Link href="/docs/make-designs#examples">copy an example brief</Link>.</li>
        <li>Find it in the Gallery, download it, or open it in Canvas.</li>
      </ol>
      <Callout>
        In a hurry? Every page here has a search: press <strong>⌘K</strong> (Ctrl K on Windows) and type what you are looking for.
      </Callout>
    </>
  );
}
