import Link from 'next/link';
import { H2, H3, Rows, Ui } from '../ui';

const FAQ: [string, React.ReactNode][] = [
  ['Can Claude use a photo I attach in the chat?', <>Not directly: Studio cannot read chat attachments. Claude gives you a <Link key="l" href="/docs/photos-logos#photo-links">photo link</Link> to upload it in a click.</>],
  ['Why did a format not come out?', <>Its copy did not fit. Claude offers shorter copy or smaller text. <Link key="l" href="/docs/make-designs#fit">More</Link></>],
  ['Can I get just one format?', 'Yes: ask for it (“just the Story”). The event page cover is offered separately.'],
  ['Can I change the template’s fixed text or layout?', 'The fixed text and the layout are the template’s. You change the content (and, in Canvas, colours, sizes and positions within the brand). For something new, ask the design team.'],
  ['How do I continue a design another day?', <><Ui key="u">New version with Claude</Ui> in the set’s menu, then paste it in Claude.</>],
  ['Where are my files?', 'In the Gallery (Mine). Download a set as a ZIP or each format as a PNG.'],
  ['Who sees my designs?', 'Everyone on the team, in Team. Personal projects (Only me) are visible to you only.'],
];

export function Rules() {
  return (
    <>
      <H2 id="rules">The rules</H2>
      <ul>
        <li><strong>US English</strong> on every design, whatever language you write in.</li>
        <li><strong>Facts come from you.</strong> Claude never invents a name, title, date, number or quote; it asks.</li>
        <li><strong>Real photos of people</strong>, never generated, never someone else’s.</li>
        <li><strong>Inside the brand:</strong> brand colours, the template’s type and layout. The brand logo is never redrawn or recoloured.</li>
        <li><strong>Never half done:</strong> a design does not go out with essential content missing or copy that does not fit.</li>
        <li><strong>Brands never mix:</strong> no Archy template, image or project on a DOC piece, or the other way round.</li>
      </ul>

      <H2 id="faq">Questions</H2>
      <div className="space-y-4">
        {FAQ.map(([q, a]) => (
          <div key={q}>
            <H3>{q}</H3>
            <p>{a}</p>
          </div>
        ))}
      </div>

      <H2 id="trouble">Troubleshooting</H2>
      <Rows rows={[
        ['Claude says Studio is not signed in', <span key="a">Type /mcp in Claude and sign in again. <Link href="/docs/connect-claude#signed-out">Steps</Link></span>],
        ['Claude does not see the tools', 'Start a new conversation; check the plugin is installed and enabled.'],
        ['The first design is slow', 'The first render after a quiet while takes a little longer. The next ones are quick.'],
        ['I cannot find a design', 'Check the brand (Archy or DOC) at the bottom of the sidebar, Mine vs Team, and Archive.'],
        ['I cannot move or archive a design', 'Only the person who made it, the project owner or an admin can.'],
        ['An image will not upload', 'Use PNG, JPG, WebP or SVG. Large photos are made smaller as they upload; an SVG must be under 4 MB.'],
      ]} />

      <H2 id="account">Your account</H2>
      <p>
        Sign in with your Archy email; the first time, you create your password (at least 10 characters). In <Ui>Account</Ui> (the menu
        with your name, at the bottom of the sidebar) you can change your name and password. Forgot it? Ask an admin to reset it.
      </p>
    </>
  );
}
