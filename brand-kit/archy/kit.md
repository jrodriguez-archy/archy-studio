# Archy brand kit for explorations

An exploration is a new Archy design for a brief no template covers. It is not an approved template: it goes to the gallery labelled Exploration and Design reviews it. It must still look unmistakably Archy, so the type, colours, logo and textures below are the only ones you use. The guides bend when the design needs it; the hard rules do not.

## How you build one

You write the artboard's content as HTML with inline styles (double-quoted attributes). Studio wraps it in the artboard (your width × height, `position: relative`, `overflow: clip`), loads the fonts and the tokens, puts in the real logo, icons, textures and images, renders it and checks it. Lay it out the way the templates do: one absolutely positioned `Content` frame inside the safe area holding the stacked blocks in a flex column with gaps; only grounds, photos, textures and bleed art are absolute layers. Name layers with `data-name` ("Headline", "Subline", "CTA", "Details") so the checks and the Inspector can talk about them.

## Hard rules (the check refuses the design otherwise)

1. **The Archy logo appears once**, as `<div data-piece="logo" style="width: 252px"></div>` (height follows, 18:7). Never draw or type it. It is white on dark and blue grounds and Royal Blue 500 on white and light grounds: add `data-on="light"` on a light ground. Partner logos are images (`data-image`).
2. **Type is Onest (headings, `var(--font-heading)`) and Inter (body, `var(--font-body)`)**, nothing else.
3. **No text is cut off or outside the artboard**, no text overlaps other text, and the logo keeps clear of the copy.
4. **Text reads**: contrast at least 3:1 with what it sits on (4.5:1 under 24 px), the logo too.
5. **Text over a photo sits on a scrim** (below): a gradient from the colour opposite the text to transparent, toward where the copy is. A solid block (a pill, a button) also carries text.
6. **A generated image is the subject**: it fills the whole artboard. A large photo never stops across the piece with a hard line: it runs to the edges, or that edge blends into the ground under a scrim.
7. **No holes**: without an image, the type is the design and holds the centre of the piece.
8. **Nothing smaller than 18 px** on a 1080-wide piece (scale it with the width).
9. **No invented facts**: dates, prices, names, numbers come from the brief. All copy is US English.

## Guides (warnings, not refusals)

- Keep text and logo inside the safe area of the format.
- Colours only from the tokens below.
- No drop shadows, glows, blurs, blend modes, blobs, meshes or decorative rotation; no outlined pill with a word in it; nothing floating without a relationship to something else.

## Two kinds of piece

Every exploration is one of these. Decide which before you write it.

- **Image-led**: a photo (real or generated) fills the artboard and is the subject. The copy goes on its calm part, on a scrim, toward one side or edge. No bands that start mid-piece, no empty ground beside the photo.
- **Typographic**: no photo, or only a quiet texture. The headline is the design: big enough to hold the centre (often 140–200 px on a 1080 post), on a colour ground, a pixel gradient, or a Pixel Tone place as atmosphere behind it.

A person with Pixel Dissolve or Pixels Behind (below) is image-led too: the person is the subject.

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
- **Pixel textures**: `data-texture="<name>"` on the ground layer or any block fills it with Archy's dithered pixel gradient: `navy`, `deep-blue`, `primary`, `royal-blue`, `sky` (white text on them), `ice`, `pure-white`, `white`, `mist` (Blue Tint 800 text on them). One texture per piece.

## Scale and spacing

- **Type runs bigger than feels safe.** A 1080 Post headline starts at 100 px (180+ when it is the hero); an OG or banner headline at 72–104. Leading 1.03–1.10 on headlines, solid on one-line labels, ≥ 1.2 on body copy.
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

**Pixel Dissolve** (a person bleeding off the bottom: square cells rise from the waist down, sparse at first and denser toward the bottom edge; never over the face). Over a cutout of the person, anchored to the bottom edge; `data-ground` is the ground under it (`royal`, `primary`, `navy`, `sky`, `ice`), `data-cell` the cell size (8 by default; the same grain as the pixel gradient behind).
```html
<div data-piece="pixel-dissolve" data-ground="royal" data-cell="8" style="position: absolute; left: 0; top: 1080px; width: 1080px; height: 270px"></div>
```

**Pixels Behind** (a headshot in a tight or square frame, where a dissolve would reach the face: a band of cells behind the cutout, from about a third of the way down to the bottom edge, three tokens with the darkest lowest; bigger cells, about 16 px on a 378 frame, 32 on a 1080 one). Place it before the person's photo, so it sits behind.
```html
<div data-piece="pixels-behind" data-ground="sky" data-cell="32" style="position: absolute; left: 0; top: 520px; width: 1080px; height: 560px"></div>
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

## Images

In this order:

1. **A real photo** the team has (`list_assets`) or the requester gives. A specific person (an AE, a speaker, a customer) is always their real photo.
2. **A generated image** (`generate_image`): a scene with or without generic people (a patient, a team at work, a front desk), a place, an object. Give it the whole artboard's width and height (it is the subject) and where the copy goes (`copy_space`): that part stays calm and free of text, so text in the scene never meets the copy. Never a specific real person, a real venue presented as itself, or a logo. Make one, look at it, and only then another (each person has a daily limit). Tell the requester which images are AI-generated.

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

The mascot (his placement rules need a designer) and DOC. For those, report the missing template.
