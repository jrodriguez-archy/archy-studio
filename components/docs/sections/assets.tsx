import Link from 'next/link';
import { Callout, H2, Rows, Ui } from '../ui';

export function Assets() {
  return (
    <>
      <p>Assets holds the team’s images: photos and logos people upload, and what Studio makes from them (cutouts, pixel effects, generated images). Everyone on the team sees and uses them.</p>

      <H2 id="upload">Upload</H2>
      <p><Ui>Upload</Ui>, or drag files onto the page (into the folder you are in). PNG, JPG, WebP or SVG. A photo larger than 4 MB (straight from a phone) is made smaller as it uploads, up to 2800 px on its long side. Images go to the brand you are working in.</p>

      <H2 id="folders">Folders</H2>
      <p><Ui>New folder</Ui> makes a team folder (“Speakers”, “Partner logos”). Drag images onto a folder, or use <Ui>Move to</Ui> with several selected. Deleting a folder keeps its images.</p>

      <H2 id="find">Find images</H2>
      <p>Search by name, switch between <Ui>Mine</Ui> and <Ui>Team</Ui>, or filter by kind: <Ui>Upload</Ui>, <Ui>Cutout</Ui>, <Ui>Pixel effect</Ui>, <Ui>Generated</Ui>.</p>

      <H2 id="effects">Effects</H2>
      <p>Right-click an image (or use its menu). Each effect makes a <strong>new image</strong>; the original stays.</p>
      <Rows rows={[
        [<Ui key="r">Remove background</Ui>, 'The person or object alone, on a transparent background (a cutout).'],
        [<Ui key="t">Pixel tone</Ui>, 'The photo in Archy’s pixel texture, Royal or Navy.'],
        [<Ui key="d">Pixel dissolve</Ui>, 'The photo dissolving into pixels, Royal or Navy.'],
        [<Ui key="b">Pixel background…</Ui>, 'The person stays as photographed; the background becomes a pixel gradient (Navy, Royal, Sky, Ice or Navy → Royal), fine, medium or large.'],
        [<Ui key="e">Edit with AI…</Ui>, 'Describe a change to a scene or object.'],
      ]} />

      <H2 id="generate">Generate an image</H2>
      <p>
        <Ui>Generate</Ui> makes an image from a description, in Post (4:5), Square, Story or Wide. Use it for places, objects, scenes and
        textures. People are never generated: photos of the team are uploaded.
      </p>

      <H2 id="limits">Daily limits</H2>
      <Rows rows={[
        ['30 a day', 'Generated images and Edit with AI, per person.'],
        ['60 a day', 'Remove background (and Pixel background), per person.'],
        ['100 a day', 'Images Claude generates for explorations, per person (apart from the 30 above).'],
        ['No limit', 'Pixel tone and Pixel dissolve (they are made in your browser).'],
      ]} />

      <H2 id="use">Use an image</H2>
      <ul>
        <li><strong>In a design:</strong> <Ui>Use in a design…</Ui> opens the design you pick in Canvas, ready to place the image. In Canvas, the Assets tab does the same.</li>
        <li><strong>With Claude:</strong> say its name, or <Ui>Copy ID</Ui> and paste the ID in your brief. <Link href="/docs/photos-logos#from-assets">More</Link></li>
        <li><strong>Download</strong> it from its details.</li>
      </ul>
      <Callout kind="note">Removing an image from Assets does not change designs that already use it.</Callout>
    </>
  );
}
