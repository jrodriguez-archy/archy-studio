import Link from 'next/link';
import { EXAMPLE_BRIEFS } from '@/lib/example-briefs';
import { Briefs, Callout, H2, H3, Rows, Shot, Ui } from '../ui';

export function Explorations() {
  return (
    <>
      <H2 id="what">What an exploration is</H2>
      <p>
        When no template covers what you need (a LinkedIn banner, an email header, a flyer, a new kind of ad), Claude can design it
        from scratch in the Archy brand: the real logo, Onest and Inter, the brand colours and textures, real photos or generated ones,
        the product and the mascot. Studio checks every exploration against the brand before saving it.
      </p>
      <p>
        It goes to the gallery labelled <Ui>Exploration</Ui>. It is not an approved template: Design reviews it, and the good ones can
        become templates.
      </p>
      <Shot src="/docs/explore-banner.webp" alt="An exploration: a LinkedIn banner" width={1584} height={396} caption="A LinkedIn banner: a generated photo, a white scrim behind the copy, the real logo." />

      <H2 id="when">When Claude explores</H2>
      <Rows rows={[
        ['Nothing fits', 'Claude first offers the closest template, adapted. If it does not work, it tells Design what was missing (Missing templates) and offers an exploration.'],
        ['You ask for it', '“Explore…”, “something new”, “not a template”: Claude goes straight to it.'],
      ]} />

      <H2 id="ask">How to ask</H2>
      <p>Say what the piece is, where it goes and its message, with the facts, as in any brief:</p>
      <Rows rows={[
        ['Format', 'The size or channel: a LinkedIn banner, an email header (1200 × 400), a Post, a letter flyer…'],
        ['Message', 'What it says and for whom. Claude writes the copy; it never invents facts.'],
        ['Images', 'A photo in Assets, a link, or “use a generated photo”. A specific person is always their real photo.'],
        ['Extras', 'The product (“show the schedule”), the mascot, a texture, a colour ground.'],
      ]} />
      <Briefs items={EXAMPLE_BRIEFS.exploration} />

      <H2 id="references">References and Notion briefs</H2>
      <p>
        <strong>Paste a reference</strong>: a mock-up you made, or an image from another generator, with other fonts and colours.
        Claude takes the idea (the message, the composition, the kind of image) and rebuilds it in the brand. It never copies the
        reference’s fonts, colours, logos or made-up text.
      </p>
      <p>
        <strong>A brief in Notion</strong>: paste its text, or share the page if Claude has the Notion connector. Its images work as
        references. Photos that have to appear on the design go through Assets, a link or a photo link, as in{' '}
        <Link href="/docs/photos-logos">Photos and logos</Link>.
      </p>

      <H2 id="kinds">Two kinds of piece</H2>
      <Rows rows={[
        ['With an image', 'The photo fills the whole piece and is the subject. The copy sits on its calm part, on a scrim (white behind dark text, navy behind white text).'],
        ['Typographic', 'No photo: the headline is the design and holds the centre, on a colour ground or a pixel texture.'],
      ]} />
      <Shot src="/docs/explore-kinds.webp" alt="An image-led post and a typographic post" width={1464} height={900} caption="Image-led (left) and typographic (right)." />

      <H2 id="images">Images</H2>
      <Rows rows={[
        ['Real photo', 'First choice: from Assets, a link, or the requester. A specific person (an AE, a speaker) is always their real photo.'],
        ['Generated', 'Editorial, magazine-quality: a subject and something happening. Generic people are fine; never a real person, a real venue as itself, or a logo. Claude says which images are AI.'],
        ['Pixel Tone', 'A city, office or practice turned into Archy’s pixel grain, as a quiet texture behind type. Never on people.'],
      ]} />
      <p>A person can be framed large, off the bottom edge, with the logo in the free corner:</p>
      <Shot src="/docs/explore-people.webp" alt="Two person-led explorations" width={1600} height={876} />
      <Callout kind="note">Each person can generate 100 images a day for explorations (apart from Assets › Generate).</Callout>

      <H2 id="product">The product</H2>
      <p>
        Archy’s real screens (schedule, charting, perio, messaging) can go in: as a window bleeding off the edges, or as a card cropped
        from a screen. Never redrawn. New screens are added as Design adds them to Master - Product.
      </p>
      <Shot src="/docs/explore-product.webp" alt="Product as a window and as a card" width={1464} height={900} />

      <H2 id="mascot">The mascot</H2>
      <Rows rows={[
        ['Expressions', 'Neutral, happy, joyful, love.'],
        ['Peeking in', 'Off the top on posts and stories, off a side on banners and OG. Studio rotates and places him: antenna into the piece, eyes always whole.'],
        ['Full body', 'Standing, with a pose: listen, look, tilt, laugh, jump, crush.'],
        ['Agents', 'Insight, Scribe, Connect, Verify, Revenue: the mascot with the objects of each feature.'],
      ]} />
      <Shot src="/docs/explore-mascot.webp" alt="The mascot in explorations" width={1600} height={603} />

      <H2 id="checks">What Studio checks</H2>
      <p>An exploration that breaks a rule is not saved: Claude fixes it and tries again.</p>
      <H3>Refused</H3>
      <Rows rows={[
        ['Logo', 'Missing, smaller than 200 px on a post, or too close to anything (it needs half its height clear).'],
        ['Type', 'Other fonts than Onest and Inter; a headline under 110 px on a post; text cut off, overlapping or tiny; lines whose letters touch.'],
        ['Contrast', 'Text or logo hard to read, measured on what is really behind it.'],
        ['Photos', 'Text on a photo without a scrim; a generated photo that does not fill the piece; a photo cut across the piece.'],
        ['Layout', 'A hole in a typographic piece; copy on a person, the product or the mascot.'],
        ['Colour', 'Sky as a ground.'],
      ]} />
      <H3>Flagged</H3>
      <p>Outside the safe area, colours outside the brand, shadows or blurs, a headline with room to grow, a small person or product.</p>

      <H2 id="change">Change it</H2>
      <p>
        Open it in <Link href="/docs/canvas">Canvas</Link> for copy, colours, moving or scaling things, by hand or with Claude. A
        recolour does not repaint a pixel texture. A new layout, ground or format is a new request to Claude in the same set.
      </p>

      <H2 id="propose">Propose it as a template</H2>
      <p>
        Made one the team should have as a template? In its menu, <Ui>Propose as template…</Ui>, with a note on why. Design sees it in{' '}
        <strong>Template proposals</strong> and turns the good ones into templates.
      </p>

      <H2 id="not-yet">Not yet</H2>
      <p>DOC has no explorations yet: for DOC, Claude tells Design what is missing.</p>
    </>
  );
}
