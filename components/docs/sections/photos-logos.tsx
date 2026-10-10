import Link from 'next/link';
import { Callout, H2, Rows, Shot, Step, Steps, Ui } from '../ui';

export function PhotosLogos() {
  return (
    <>
      <H2 id="people">Photos of people</H2>
      <p>
        A person on a design is always <strong>their real photo</strong>. Studio never generates a person and never uses someone else’s
        photo. For templates where the person stands on the background (like AE Spotlight), a <strong>cutout</strong> (a PNG without
        background) works best; Studio can remove the background for you.
      </p>

      <p>In <Link href="/docs/explorations#images">explorations</Link>, Claude can also generate a scene with generic people; a specific person is still always their real photo.</p>

      <H2 id="placeholders">Placeholder photos</H2>
      <p>A missing photo never holds a design back. Claude makes the design with a stand-in and tells you which photos to send:</p>
      <Rows rows={[
        ['A person', 'A neutral silhouette, until the real photo comes.'],
        ['A city or venue', 'A photo close to the brief, found for you (or a neutral image).'],
        ['A DOC staged photo', 'A neutral grey ground: that photo is the idea of the ad, so it is shot or sourced for it, never a stock stand-in.'],
      ]} />

      <H2 id="photo-links">Send photos with a photo link</H2>
      <p>
        Claude cannot read photos you attach in the chat. When it needs photos, it gives you a <strong>photo link</strong> instead: a
        small Studio page with one place for each photo, named (“Jordan Ellis”, “Sam Rivera”).
      </p>
      <Steps>
        <Step>Open the link (it works for an hour) and drop each photo, or choose it from your computer or phone. Large phone photos are made smaller for you.</Step>
        <Step>Each photo is saved to Assets with its name, in the design’s brand, and cut out when the template needs it.</Step>
        <Step>Go back to Claude and say it is done. Claude picks up the photos and makes the design again, in the same set.</Step>
      </Steps>
      <Shot src="/docs/photo-link.webp" alt="A photo link page" caption="A photo link: one place per photo." width={1440} height={900} />

      <H2 id="from-assets">Use a photo from Assets</H2>
      <p>
        Photos the team already uploaded are in <Link href="/docs/assets">Assets</Link>. Tell Claude the name (“Sarah’s photo is in
        Assets”) and it finds it, or copy the image’s ID with <Ui>Copy ID</Ui> and paste it in your brief.
      </p>

      <H2 id="links">Photos as links</H2>
      <p>You can also give Claude a public <strong>https link</strong> to a photo. For a person, a link to a cutout PNG.</p>

      <H2 id="logos">Partner and sponsor logos</H2>
      <p>
        Give partner and sponsor logos as a link (PNG or SVG). Studio sets them in the design’s colour at a size balanced with the brand
        logo. In Canvas, a logo has a <Ui>Mono</Ui> / <Ui>Color</Ui> switch to show its own colours instead.
      </p>
      <Callout kind="note">You can always swap a photo or logo later in Canvas: select it and choose <Ui>Upload</Ui> or <Ui>Assets</Ui>.</Callout>
    </>
  );
}
