import Link from 'next/link';
import { EXAMPLE_BRIEFS } from '@/lib/example-briefs';
import { Briefs, Callout, H2, H3, Rows, Shot, Step, Steps, Ui } from '../ui';

export function MakeDesigns() {
  return (
    <>
      <p>
        Once <Link href="/docs/connect-claude">Claude is connected</Link>, you ask for designs the way you would ask a designer. Claude
        reads the brief, chooses the template that fits, asks once for anything missing, writes the copy and delivers finished PNGs,
        saved to your gallery.
      </p>

      <H2 id="brief">Write a brief</H2>
      <p>A good brief gives Claude the <strong>facts</strong>. Claude writes the <strong>copy</strong> (headlines, short lines, calls to action) from them, so you do not need to.</p>
      <Rows rows={[
        ['Facts to include', 'The event name, city, venue, dates and times, booth number, the people featured (name and title), partner names. For DOC: the track, real figures, real dates.'],
        ['Photos and logos', 'Say which you have: a photo in Assets, a link, or a file you can upload. See Photos and logos.'],
        ['What it is for', 'A booth invite, a reminder, an evening you host, a speaker, an ad… Claude finds the template; you can also name one.'],
        ['Formats', 'Leave it out to get every social format, or ask for one (“just the Story”).'],
      ]} />
      <Callout>
        Write in any language. The copy on the design is always in <strong>US English</strong>, and Claude never invents a fact: if
        something essential is missing, it asks.
      </Callout>

      <H2 id="examples">Example briefs</H2>
      <p>Click one to copy it, then paste it in Claude and change the details.</p>
      <H3>Archy</H3>
      <Briefs items={EXAMPLE_BRIEFS.archy} />
      <H3>DOC</H3>
      <Briefs items={EXAMPLE_BRIEFS.doc} />

      <H2 id="what-happens">What Claude does</H2>
      <Steps>
        <Step><strong>Reads the brief</strong> and lists the facts it brings.</Step>
        <Step><strong>Matches templates</strong> that can be made with those facts, best first, and notes what a better one would need.</Step>
        <Step><strong>Asks once</strong>, in one short message, for anything missing or anything that would unlock a better template (a city photo, the partner’s logo, the time). It never asks one question at a time.</Step>
        <Step><strong>Writes the copy</strong> to fit each format’s space, and renders every format.</Step>
        <Step><strong>Delivers</strong> the images with a download link and an <Ui>Edit in Canvas</Ui> link, says which template it chose and why, what was left out, and which photos are placeholders.</Step>
      </Steps>
      <Shot src="/docs/set-panel.webp" alt="A set open in the gallery" caption="What you get: a set in the gallery, with every format, the copy and the template used." />

      <H2 id="formats">Formats and covers</H2>
      <p>“All formats” means the social ones the template has:</p>
      <Rows rows={[
        ['Post', '1080 × 1350 (feed, 4:5)'],
        ['Square', '1080 × 1080'],
        ['Stories', '1080 × 1920 (Instagram and Facebook Stories)'],
        ['OG', '1200 × 630 (the preview when a link is shared)'],
        ['Cover', '1200 × 900, the event page cover on the website'],
      ]} />
      <p>
        The <strong>Cover</strong> is never part of “all formats”: after the social formats, Claude offers it in one line. It has its own
        background photo (a city or venue photo) and splits the headline in two. Not every template has every format: the Templates page
        shows which.
      </p>

      <H2 id="options">Options, designs and themes</H2>
      <p>
        Ask for options (“give me two options”) and each one is a <strong>different template, design or theme</strong>, not the same
        design with other words. Some templates come in several <strong>designs</strong> (layouts) and <strong>themes</strong> (colour
        grounds, like Navy or Royal Blue for Archy, or the three tracks, Dark and Light for DOC). Ask for one by name: “the Navy theme”,
        “the Grid Card design”.
      </p>

      <H2 id="fit">When copy does not fit</H2>
      <p>Studio never delivers a design with copy that does not fit. When it is too long for a format, that format is held back and Claude offers two choices:</p>
      <Rows rows={[
        ['Shorter copy', 'Claude says the exact maximum and offers a shorter version with the same facts.'],
        ['Smaller text', 'The copy stays as written and the type gets a little smaller (down to 70%). You see a preview first; it is only made if you choose it.'],
      ]} />
      <p>Short copy is fine: the design fills its space by itself (headlines grow), so there is no need to add words.</p>

      <H2 id="left-out">Details left out</H2>
      <p>
        Each template has <strong>essential</strong> content (always there) and minor <strong>optional</strong> details. An optional
        detail you do not have is left out with its label and the layout closes up: no time, and the date stands alone. If something
        essential is missing, Claude asks for it, or suggests a template that works with what you have.
      </p>

      <H2 id="sets">Sets and new versions</H2>
      <p>
        Everything made from one brief is a <strong>set</strong>: its formats, retries and options stack as one card in the gallery. Ask for
        changes in the same conversation (“make the headline shorter”, “now the Navy theme”) and they join the same set.
      </p>
      <p>
        To continue later, in another conversation, open the set in the gallery, choose <Ui>New version with Claude</Ui> in its menu, and
        paste the prompt in Claude: it carries the template, the brief and the set.
      </p>

      <H2 id="projects">Projects</H2>
      <p>Name a project and Claude files the designs there: “save it in Chicago Midwinter 2027”. If it does not exist yet, Claude creates it (shared with the team, unless you say it is just for you). When you do not mention a project, designs stay in the gallery.</p>

      <H2 id="from-studio">Start from Studio</H2>
      <ul>
        <li><strong>From a template:</strong> in Templates, use <Ui>Copy prompt for Claude</Ui> (or <Ui>Copy template ID</Ui>) and paste it. Claude uses that template directly and asks only for its missing facts.</li>
        <li><strong>From a design:</strong> <Ui>New version with Claude</Ui> in the set menu.</li>
        <li><strong>To edit what you see:</strong> open the design in Canvas and ask Claude to change it there. <Link href="/docs/canvas#claude">Edit with Claude</Link></li>
      </ul>
    </>
  );
}
