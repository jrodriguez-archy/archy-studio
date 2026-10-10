# Archy brand kit for explorations

An exploration is a new Archy design for a brief no template covers. It is not an approved template: it goes to the gallery labelled Exploration and Design reviews it. It must still look unmistakably Archy, so the type, colours, logo and textures below are the only ones you use. The guides bend when the design needs it; the hard rules do not.

## How you build one

You write the artboard's content as HTML with inline styles (double-quoted attributes). Studio wraps it in the artboard (your width × height, `position: relative`, `overflow: clip`), loads the fonts and the tokens, puts in the real logo, icons, textures and images, renders it and checks it. Lay it out the way the templates do: one absolutely positioned `Content` frame inside the safe area holding the stacked blocks in a flex column with gaps; only grounds, photos, textures and bleed art are absolute layers. Name layers with `data-name` ("Headline", "Subline", "CTA", "Details") so the checks and the Inspector can talk about them.

**A reference in the brief** (a mock-up the requester made, or an image from another generator, with other fonts and colours) is the idea, not the design: take its message, its composition and the kind of image, and rebuild it with this kit (type, colours, logo, textures, pieces, the real product) and its rules. Never copy its fonts, colours, logos or made-up text. Where it shows a photo or the product, use the real thing: a team photo, `generate_image`, or a product screen below.

## Hard rules (the check refuses the design otherwise)

1. **The Archy logo appears once**, as `<div data-piece="logo" style="width: 234px"></div>` (height follows, 18:7), at least 200 px wide on a 1080 piece (scaled with the format). Never draw or type it. **It has its own air**: nothing (text, icon, button, pill, a small photo) within half its height all around; it usually anchors the other end of the piece from the headline. It is white on dark and blue grounds and Royal Blue 500 on white and light grounds: add `data-on="light"` on a light ground. Partner logos are images (`data-image`).
2. **Type is Onest (headings, `var(--font-heading)`) and Inter (body, `var(--font-body)`)**, nothing else.
3. **No text is cut off or outside the artboard**, and no text overlaps other text.
4. **The headline runs big**: at least 110 px on a 1080 piece (about 60 on a banner or an email header), and bigger when it has room.
5. **Text reads**: contrast at least 3:1 with what it sits on (4.5:1 under 24 px), the logo too.
6. **Text over a photo sits on a scrim** (below): a gradient from the colour opposite the text to transparent, toward where the copy is. A solid block (a pill, a button) also carries text.
7. **A generated image is the subject**: it fills the whole artboard. A large photo never stops across the piece with a hard line: it runs to the edges, or that edge blends into the ground under a scrim.
8. **No holes**: without an image, the type is the design and holds the centre of the piece.
9. **A person is the subject**: a cut-out person is big (from the chest or waist down) and bleeds off the bottom edge, never floating.
10. **Sky (`--color-sky-blue-400`) is never a ground**: not as a background, a block's fill or a pixel gradient. It stays an accent (an icon, a label on dark, a few cells).
11. **Nothing smaller than 18 px** on a 1080-wide piece (scale it with the width).
12. **No invented facts**: dates, prices, names, numbers come from the brief. All copy is US English.

## Guides (warnings, not refusals)

- Keep text and logo inside the safe area of the format.
- Colours only from the tokens below.
- No drop shadows, glows, blurs, blend modes, blobs, meshes or decorative rotation; no outlined pill with a word in it; nothing floating without a relationship to something else.

## Two kinds of piece

Every exploration is one of these. Decide which before you write it.

- **Image-led**: a photo (real or generated) fills the artboard and is the subject. The copy goes on its calm part, on a scrim, toward one side or edge. No bands that start mid-piece, no empty ground beside the photo.
- **Typographic**: no photo, or only a quiet texture. The headline is the design: big enough to hold the centre (often 140–200 px on a 1080 post), on a colour ground, a pixel gradient, or a Pixel Tone place as atmosphere behind it.

A person with Pixel Dissolve or Pixels Behind (below) is image-led too: the person is the subject.

### Composition guides (not rules: use them when they fit)

- **A person on a colour ground**: the headline big at the top; the person large, pushed to the right (they may bleed off the right edge) and off the bottom; the logo in the corner the person leaves free (bottom left). With the logo there, no pixels under it: Pixel Dissolve and Pixels Behind are optional, and a pixel gradient ground is often enough.
- **The copy and the person**: some air between the headline and the top of the head (about a third of the headline size or more); the copy never sits on the person.
- **Framing a photo** (generated or real): the subjects large and central to the frame, close under the headline but never behind it. Scale the image beyond cover and anchor it to the bottom to bring them up and closer (`background-size: auto 112%; background-position: 40% 100%`), then look at the result.
- **Leading**: in a big headline, a descender (y, g, p) must not meet a capital on the next line (the check flags it); 1.08–1.12 of the size keeps lines together without touching.
- **The person, large**: the head comes up close to the headline (keeping the air) and the person fills the side they are on. "Pushed right" is not "stuck to the edge": bring them toward the centre as far as the face needs to breathe and the composition to balance.

## Formats and safe areas

| Format | Size | Safe area |
|---|---|---|
| post | 1080 × 1350 | x 105–975, y 105–1245 |
| square | 1080 × 1080 | x 105–975, y 105–975 |
| stories | 1080 × 1920 | x 105–975, y 250–1670 (Instagram covers top and bottom 250) |
| og | 1200 × 630 | 60–72 margins |
| linkedin-banner | 1584 × 396 | x 72–1512, y 48–348; the profile photo covers the lower left (about x 0–480, y 200–396) on personal profiles |
| linkedin-post | 1200 × 627 | 60–72 margins |
| email-header | 1200 × 400 | 56–64 margins |
| Any other size | as asked | about 7% of the short side, at least 40 px |

Name each format plainly (`post`, `linkedin-banner`, `flyer-letter`). For print sizes say so to the requester: this is a screen PNG, not a print-ready file.

## Tokens

Colours (use the variable, never the hex):

| Token | Hex | Use |
|---|---|---|
| `--color-royal-blue-500` | #013DF5 | the accent; blue ground; buttons |
| `--color-primary-blue-600` | #0000C9 | blue ground top; divider on dark |
| `--color-sky-blue-400` | #0095FF | accent on dark |
| `--color-blue-tint-800` | #00004E | dark ground; text on light |
| `--color-blue-tint-700` | #000484 | dark ground top |
| `--color-blue-tint-300` | #66BFFF | labels on blue and dark |
| `--color-blue-tint-200` | #CCEAFF | rulers on light blue grounds |
| `--color-blue-tint-100` | #E6F4FF | light text on blue; pill ground |
| `--color-blue-tint-50` / `-25` | #F3F9FF / #F9FDFF | light grounds |
| `--color-white` | #FFFFFF | |
| `--color-neutral-super-light` / `-lightest` | #F7F7F7 / #EEEEEE | light grounds, rulers on white |
| `--color-neutral` / `-dark` / `-darker` | #666 / #444 / #222 | secondary text on light |

Type: `--font-heading` Onest 600 for headlines (`letter-spacing: var(--tracking-tight)`), Inter 400/500 for body and buttons. Radii: `--radius-button` 8, `--radius-card` 12; on posters viewed small, about 16–20 for buttons and 20–30 for cards.

## Grounds

- **Blue**: `background: linear-gradient(180deg, var(--color-primary-blue-600) 0%, var(--color-royal-blue-500) 55%)`
- **Dark**: `background: linear-gradient(180deg, var(--color-blue-tint-700) 0%, var(--color-blue-tint-800) 55%)`
- **Light**: white or `--color-neutral-super-light`, with the logo in Royal Blue (`data-on="light"`). The website is entirely light; a light piece is the most brand-faithful option, not the risky one.
- Put the ground on a first layer that covers the artboard: `<div data-name="Ground" style="position: absolute; inset: 0; background: …"></div>`.
- **Pixel textures**: `data-texture="<name>"` on the ground layer or any block fills it with Archy's dithered pixel gradient: `navy`, `deep-blue`, `primary`, `royal-blue` (white text on them), `ice`, `pure-white`, `white`, `mist` (Blue Tint 800 text on them). One texture per piece.

## Scale and spacing

- **Type runs bigger than feels safe.** A 1080 Post headline starts at 120 px, 160–200 when it is the hero; an OG or banner headline at 72–104. When there is room, the headline takes it, with the leading open enough (1.05–1.1) that descenders never meet the next line. Leading 1.03–1.10 on headlines, solid on one-line labels, ≥ 1.2 on body copy.
- **Gaps run tighter than feels safe**: 12 inside a text block, 20 label to non-text, 40 between detail blocks, 56 between the outer blocks. Outer gaps above about 120 read as a hole: if a piece looks empty, make the type bigger, not the air.
- Gap between blocks is always larger than the gap inside a block.
- Fill the format: the content spans the safe area; two anchors (top block, logo at the bottom or top) and the gaps absorb the rest.

## Pieces

Copy these and change the copy and sizes. Studio fills in `data-piece`, `data-icon`, `data-texture` and `data-image`.

**Logo**
```html
<div data-piece="logo" data-name="Logo Archy" style="width: 234px"></div>
```

**Primary button** (white fill and Royal Blue label on blue or dark grounds; Royal Blue fill and white label on light)
```html
<div data-name="CTA" style="display: flex; align-items: center; gap: 16px; padding: 22px 32px; border-radius: 16px; background: var(--color-white); width: fit-content">
  <span style="font: 500 30px/36px var(--font-body); color: var(--color-royal-blue-500)">Book a demo</span>
  <span data-icon="ArrowRight02Icon" style="width: 28px; height: 28px; color: var(--color-royal-blue-500)"></span>
</div>
```

**Status pill** (a kicker above the headline)
```html
<div data-name="Kicker" style="display: flex; align-items: center; gap: 10px; padding: 14px 28px 10px 24px; border-radius: 999px; background: var(--color-blue-tint-100); width: fit-content">
  <span style="width: 16px; height: 16px; border-radius: 999px; background: var(--color-royal-blue-500)"></span>
  <span style="font: 600 24px/30px var(--font-heading); letter-spacing: 0.05em; text-transform: uppercase; color: var(--color-royal-blue-500)">Live webinar</span>
</div>
```

**Label over value** (date, place, speaker; on blue or dark)
```html
<div data-name="Date" style="display: flex; flex-direction: column; gap: 4px">
  <span style="font: 700 32px/40px var(--font-heading); letter-spacing: 0.02em; text-transform: uppercase; color: var(--color-blue-tint-300)">Date</span>
  <span style="font: 600 48px/56px var(--font-heading); color: var(--color-white)">Mar 12, 2027</span>
</div>
```

**Detail with an icon** (Hugeicons Stroke Rounded by export name: Calendar03Icon, Location01Icon, Clock01Icon, Ticket01Icon, UserGroupIcon…)
```html
<div data-name="Location" style="display: flex; align-items: center; gap: 20px">
  <span data-icon="Location01Icon" style="width: 48px; height: 48px; color: var(--color-blue-tint-300)"></span>
  <span style="font: 500 40px/48px var(--font-body); color: var(--color-white)">Austin, TX</span>
</div>
```

**Rulers** (the hairline device from the website: a solid colour one step off the ground, 2 px at poster scale, never translucent; they separate rows, never bracket them)
```html
<div data-name="Ruler" style="height: 2px; background: var(--color-neutral-lightest)"></div>
```
Ruler colour: `--color-neutral-lightest` on white, `--color-blue-tint-200` on light blue, `--color-primary-blue-600` on dark, `#2A5DF6` on royal blue.

**Photo** (a team photo or a generated image as `asset:<id>`, an `upload:` value or an https link; see *Images* below)
```html
<div data-name="Photo" data-image="asset:01ABC…" style="position: absolute; left: 0; top: 0; width: 1080px; height: 1350px; background-size: cover; background-position: center"></div>
```
In an image-led piece the photo fills the artboard; move the subject with `background-position` rather than shrinking the frame.
**Scrim** (behind copy that sits on a photo, as in the templates: the colour opposite the text, solid where the copy is and fading to transparent toward the subject; it covers the copy and runs to that edge of the artboard). White behind dark text, `--color-blue-tint-800` behind white text.
Copy on the right of a banner, dark text:
```html
<div data-name="Scrim" style="position: absolute; left: 640px; top: 0; width: 944px; height: 396px; background: linear-gradient(to right, transparent 0%, var(--color-white) 45%)"></div>
```
Copy at the top of a post, white text:
```html
<div data-name="Scrim" style="position: absolute; left: 0; top: 0; width: 1080px; height: 760px; background: linear-gradient(to bottom, var(--color-blue-tint-800) 0%, var(--color-blue-tint-800) 35%, transparent 100%)"></div>
```
The same piece blends a photo edge that stops inside the artboard into the ground.

**Pixel Dissolve** (a person bleeding off the bottom: square cells rise from the waist down, sparse at first and denser toward the bottom edge; never over the face). Over a big cut-out of the person, anchored to the bottom edge; `data-ground` is the ground under it (`royal`, `primary`, `navy`, `ice`). Cells read as pixels, not noise: 16 px on a 1080 piece by default (scaled with the format; `data-cell` to change it).
```html
<div data-piece="pixel-dissolve" data-ground="royal" style="position: absolute; left: 0; top: 1062px; width: 1080px; height: 288px"></div>
```

**Pixels Behind** (a headshot in a tight or square frame, where a dissolve would reach the face: a band of cells behind the cut-out, from about a third of the way down to the bottom edge, three tokens with the darkest lowest; 20 px cells on a 1080 piece by default). Place it before the person's photo, so it sits behind; the person is big and bleeds off the bottom.
```html
<div data-piece="pixels-behind" data-ground="primary" style="position: absolute; left: 0; top: 600px; width: 1080px; height: 480px"></div>
```

**Two-tone headline** (from the website, on light grounds)
```html
<div data-name="Headline" style="font: 600 104px/110px var(--font-heading); letter-spacing: var(--tracking-tight)">
  <span style="color: var(--color-blue-tint-800)">Your practice, </span><span style="color: var(--color-neutral)">in one place.</span>
</div>
```

**Partner logo** (an https link to a PNG or SVG; balance it optically with the Archy logo: same cap height, not the same width; the two anchor the two ends of the column)
```html
<div data-name="Partner logo" data-image="https://…/logo.svg" style="width: 260px; height: 92px; background-size: contain; background-repeat: no-repeat; background-position: right center"></div>
```

## Product

The product is Archy's real screens (Master - Product in Paper), exported to the kit: use them in pieces about what the product does (scheduling, charting, messaging, payments), or propose them when they make the point better than a photo. Never redraw or invent product UI; it is the screens below, as they are (in Open Sans, the product's own type).

Two ways, as in the website's hero video:

**Window** (the whole screen, bleeding off the right and the bottom): headline big at the top, the window from the lower left running off the artboard.
```html
<div data-piece="product" data-screen="charting" style="position: absolute; left: 105px; top: 660px; width: 2900px"></div>
```

**Card** (a named crop of a screen, or `x,y,w,h` in screen px): one piece of the product, centred or anchored, as its own card on the ground.
```html
<div data-piece="product" data-screen="schedule" data-crop="appointments" style="position: absolute; left: 105px; top: 600px; width: 870px"></div>
```

Studio draws it white with rounded corners and the screen at the width you give (the height follows unless you set one). **The UI has to read**: draw the screen at about 1.3–1.6× its size on a 1080 piece (a window 2700–3300 px wide, most of it off the artboard), so less of it shows, bigger; the check warns when it reads small. To start the window at the part that matters (the teeth, not the side panel), give a crop whose left and top are where the window should begin, e.g. `data-crop="356,0,1700,1160"`. Copy never goes over the product; the logo keeps its air from it. The screens and crops available are listed at the end of this kit.

## The mascot

Archy, the robot (Paper › Archy - Brand › Mascot). Use him when the brief asks for him or the piece wants warmth: a launch, a welcome, a thank-you, a celebration, a moment of personality. Never redraw him: `data-piece="mascot"` is the master drawing, and Studio places him by the brand's rules.

- **Expressions** (`data-expression`): `neutral` (default: listening, waiting), `happy` (a calm smile: welcome, a job done), `joyful` (big wins, celebration, a laugh), `love` (culture, thanks, people; sparingly).
- **He peeks in from an edge** (`data-bleed`): the antenna always points into the canvas, about two thirds of him shows, his eyes rise a little and are never cut. Studio rotates and places him; you choose the edge, his size (`width`), where along the edge (`data-at`, his centre in px) and how much shows (`data-show`, 0.55–0.8).
  - Vertical pieces (post, stories): off the **top**, upside down, usually centred. Upside down, the arc eyes (`happy`, `joyful`) flip and read as closed or sad: off the top, `neutral` or `love` read best.
  - Landscape (OG, banners, slides): off a **side**, turned 90°, beside the headline; the empty column next to a left-aligned headline is where he goes.
  - Off the **bottom**, upright: small, thumbnail-scale pieces.
- **Full body** (`data-form="body"`): standing on the piece (`data-bleed="none"`, placed with your own left/top/width) or rising from the bottom edge. For culture and celebration pieces; large, never a small sticker floating in a corner.
- **Ground** (`data-ground`: `royal`, `primary`, `navy`, `white`, `ice`, `tint-300`): sets his antenna (light on blue and dark, dark on light) and the barely-there edge on the part that would sink into the ground. Always say the ground he sits on.
- **Poses** (`data-pose`, full body only): a little motion, the parts never change. `listen` (neutral, head tilts in: attentive), `look` (neutral, eyes slide toward the content; `data-look="left"` or `"right"`, toward the copy), `tilt` (happy: curious, warm), `laugh` (joyful, head thrown back), `jump` (joyful, head and body lift: a win), `crush` (love, head leans in, antenna flicks). Each brings its face.
- **Agents** (`data-agent`, full body with the objects of the job, in the brand greens, the one sanctioned use of mint): `insight` (reads the numbers: a report and a document), `scribe` (takes the notes: a pencil and a clipboard), `connect` (talks to patients: a phone and a chat bubble), `verify` (confirms coverage: a magnifier and a check seal), `revenue` (collects payment: a card terminal, a card and a coin). Use the agent of the feature the piece is about. They work on any brand ground, light, blue or dark. The job lines come from the brand sheet and are not yet confirmed by Product: keep claims about what an agent does to the brief.
- Copy never goes over him; the logo keeps its air from him (measured on his shapes, objects included). He may cross a Ruler.
```html
<div data-piece="mascot" data-bleed="top" data-expression="joyful" data-ground="royal" style="width: 691px"></div>
<div data-piece="mascot" data-bleed="right" data-expression="neutral" data-ground="navy" style="width: 560px"></div>
<div data-piece="mascot" data-form="body" data-expression="love" data-ground="ice" style="position: absolute; left: 520px; top: 500px; width: 460px"></div>
<div data-piece="mascot" data-agent="verify" data-ground="ice" style="position: absolute; left: 380px; top: 600px; width: 600px"></div>
<div data-piece="mascot" data-form="body" data-pose="jump" data-ground="primary" style="position: absolute; left: 440px; top: 420px; width: 560px"></div>
```

## Images

In this order:

1. **A real photo** the team has (`list_assets`) or the requester gives. A specific person (an AE, a speaker, a customer) is always their real photo.
2. **A generated image** (`generate_image`): editorial, magazine-quality, realistic. Write the prompt as an art director: a subject large and close in the frame, something happening (a hygienist showing a patient their plan on a tablet, hands checking in at the front desk), the framing and the light. Not an empty room or a lone object; Studio pushes a weak prompt that way too. Give it the whole artboard's width and height (it is the subject) and where the copy goes (`copy_space`): that part stays calm and free of text, so text in the scene never meets the copy. Never a specific real person, a real venue presented as itself, or a logo. Make one, look at it, and only then another (each person has a daily limit). Tell the requester which images are AI-generated.

## Textures

Archy's textures are one pixel grain, in two families (Archy - Brand › Textures):

| The piece needs | Use |
|---|---|
| A colour ground | **Pixel Gradient**: `data-texture` (Grounds above) |
| A person bleeding off the bottom of the frame | **Pixel Dissolve** (piece above) |
| A headshot in a small or square frame | **Pixels Behind** (piece above) |
| A city, office or practice behind text | **Pixel Tone**: `pixel_tone`, or `pixel_tone` in `generate_image` |

- Brand tokens only; one grain per piece (the gradient behind a photo and the effect share a cell size); whole cells, anchored to the bleed edge.
- The person always stays a real, untouched photo where it matters: faces are never pixelated; the grain treats the edge, the ground and places.
- **Pixel Tone** turns a place photo into a quiet texture in two tones (`royal` on blue grounds, `navy` on dark, `ice` on light) for a typographic piece: the whole artboard, or a block's ground. Never on people, and never when the photo is the subject: the subject gets lost in the grain. It is made for the frame it fills, so give the same width and height.

## Not in explorations yet

DOC. For DOC, report the missing template.
