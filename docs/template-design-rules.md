# Template design rules

What makes an Archy Studio design right, whatever the copy. The people who use Studio are not designers, so the template and the engine have to get it right on their own. But design judgment is not binary: a rule applied blindly can make a design worse.

So there are two levels:

- **Hard rules**: a few things that must never happen. Nobody would want them. The engine refuses the copy or fixes it; nothing ships that breaks one.
- **Guides**: preferences with room and judgment. They apply when they clearly improve the result, they have tolerances and conditions, and they back off when in doubt.

Three principles sit above both levels:

1. **The design's intent wins.** A template drawn with its own sample copy is never "corrected": filling and fitting leave it exactly as designed (checked by the QA). Guides only act on what changed from that design.
2. **Each template can make an exception.** `templates/<id>/rules.json` can turn a guide off or tune it for that template (for example `"fill": false` or `{ "fill": { "maxScale": 1.1 } }`).
3. **Suggest, don't block.** In Canvas the Inspector suggests; the person decides and can always save.

Where each item is enforced:
- **Engine**: `scripts/fit.js`, `edits.js` or `components.js`, for every template.
- **Check**: the QA (`scripts/qa-templates.ts`) or the Inspector flags it.
- **Paper**: the template itself has to be designed that way.

New items come from Template review (Admin → Template review). When an admin's comment becomes general, it is added here as a hard rule or a guide, with the example that taught it.

## Hard rules

1. **Copy is never cut, never off the design, never over the margins.** Copy that does not fit is refused with its exact limit, so Claude writes it shorter with the same facts. *Engine: fit, overflow and container checks.*
2. **No word is split in half.** *Engine (refused as not fitting). Learned: "EVEN/T" in Event Cover Booth Offer.*
3. **Nothing covers what it hides.** Text never lands on a mascot, sticker, badge or photo it was clear of in the design. *Engine: collisions refused. Check: Inspector "overlaps".*
4. **Text stays readable.** Never below 85% of its design size, and never with worse contrast than the design. *Engine: fit stops at 85%. Check: Inspector "smaller than the design", "hard to read".*
5. **A button never stays without its label.** No arrow on its own: the button goes whole. *Engine. Learned: Night Out.*
6. **No redundant copy.** A headline does not repeat what the design prints elsewhere (the booth number under Booth; "Booth" inside a sticker that already says BOOTH). Where the design prints a label, `rules.json` `drop` removes it from the value. *Engine + rules.json. Learned: Photo Band OG, the "Booth #1039 in Atlanta" test headline.*
7. **Nothing takes the color of what is behind it.** Not only text: pills, badges, containers, lines, buttons and the parts of the mascot (ears, antenna) must contrast with their ground in every theme. A royal-blue badge always has white text. *Engine: themes (`edits.js`). Check: Inspector. Learned: Round 1 themes, "it is literally the same color, you can't see it".*
8. **The template's own words stay.** Copy that is part of the design and not a slot (a cover's kicker, a "BOOTH" label) is never rewritten or removed. When a slot is left out, what decorates it goes with it: no divider line floating alone. *Engine + review content. Learned: event covers.*
9. **No punctuation or word stranded.** No "!" or ":" starting or ending a line on its own ("Tomorrow / !", ": Boston"). *Engine.*
10. **A person's name is never cut.** If it does not fit, it goes on two lines or smaller. *Engine + content.*
11. **Illustrations never touch text** (the cocktail glass, the mascot, a photo's head). *Engine: collisions. Learned: Night Out, AE Spotlight Stories.*
12. **Data designed at the same size stays the same size.** City and date read as one set; the secondary lines under them (venue and time) as another, smaller one. Grouped by their designed size, so a secondary line never matches a primary one. *Engine: `sameSizeData()`. Learned: booth templates; Round 3, Night Out time vs venue.*

## Guides

Each guide says how it bends: its tolerance, when it backs off, and how to turn it off.

1. **The design fills its room.** When copy is shorter than the sample, the column should not leave a hole at the bottom.
   - The headline may grow, up to 125%.
   - The rhythm may open, gap up to 1.5×.
   - The footer (logo lockup, CTA) may sit at the bottom of the content area.
   - *Backs off*: never with the sample copy or copy as long; never if the headline would add a line, get closer to a decoration, or push another text or frame out of place; frames that already spread their content are left alone.
   - *Off*: `"fill": false`.
   - *Engine: `balance()`. Check: Inspector "Too much empty space", only when a hand edit emptied it. Learned: Hinman test set.*
2. **Tall formats keep clear of the app bar.** In 9:16 the content stops about 13% from the bottom. Other formats mirror the top margin. *Backs off*: where the design's own margin is larger. *Engine.*
3. **A detail left out does not pull copy into a decoration.** If the kicker is missing, the column may start lower. If a sticker sits beside the copy, the texts above may keep their designed height, with the air above the headline. *Backs off*: only when the room allows; otherwise the copy is refused (hard rule 3). *Engine: `clearTop()`, `settleCollisions()`, `holdHeights()`. Learned: Booth Icon List, Countdown Offer, Booth Invite Offer.*
4. **Text wraps around a mascot before it shrinks.** A block headline next to a decoration may take the width short of it (24 px clear). *Backs off*: never narrower than 40% of its width, and never if that adds lines beyond the design's. *Engine. Learned: Photo Band Square.*
5. **No word alone on a line.** A headline grows only on the lines it already has. *Backs off*: copy written with its own line breaks keeps them where they fit. *Engine.*
6. **Line breaks in copy are a wish.** Where a format has fewer lines, they may become spaces. *Engine. Learned: Countdown Masthead OG.*
7. **A size changed in one format follows in proportion.** In Canvas sync, a size kept to the other format's own range (85%–125% of its design size). *Backs off*: an unsynced format keeps its own. *Canvas sync.*
8. **Space is used, especially when copy is short.** The headline may grow well past its design size when there is little information (Speaker Invite, Night Out with a short line: up to filling the piece), the content is centered vertically when it floats, and Stories scales its whole content up (it must never look like a shrunken Post). *Backs off*: never over a decoration, never past the margins. *Engine: `balance()`, to extend. Learned: Short copy in every template.*
9. **The partner logo weighs as much as Archy's.** As large as its frame allows, optically centered with the Archy wordmark (the x-height, not the box with the "y" descender), aligned to the content's right edge. *Engine: logo placement in `fit.js`. Learned: every lockup.*
10. **Badges breathe.** A booth badge is never glued to the headline, the kicker or a logo: it moves into the free space or shrinks first. With few digits and room in the badge, the number grows. *Backs off*: never stricter than Paper. A badge drawn over the kicker's rule or close to the headline stays where it was drawn, and a move adds to its designed position (never replaces it). *Engine. Learned: Booth Invite Photo, Countdown Masthead (the badge jumped onto the headline).*
11. **Photos are framed on their subject.** The skyline (or venue) is centered and whole: buildings not cut at the top, little sky, water or ground; the photo may scale a little to frame it. Dark or unrecognizable photos are not used. *Engine: focal point per image + content curation. Learned: every photo template.*
12. **Event cover photos carry Pixel Tone,** in a blue that contrasts with the card above it. *Engine: Pixel Tone (archy-design pixel skill). Learned: all covers.*
13. **Dates in house style, short.** "Jan 28 – 30, 2027": abbreviated month, no weekday, the month once when it repeats; the full form only when the brief asks and there is room. *Content + MCP guidance. Learned: Long copy.*
14. **Line breaks follow meaning, with judgment.** "Howdy, / San Antonio" (a city stays together), "Tomorrow / is the day". But a short word like "at" may end a line when the next line is long enough to balance it. *Engine: wishes, not rules.*
15. **Big type, tight leading.** A headline grown well past its size (very short copy: up to 240%) closes its leading to about the type size. *Engine. Learned: Round 2, Night Out and Speaker short.*
16. **Content and logo stay one group when there is a lot of air.** The footer goes to the bottom only when the gap is small; otherwise the whole group sits a little above the middle. *Engine. Learned: Round 2, Stories and countdowns.*
17. **A lone Archy logo centres** in a centred column (no partner logo). *Engine. Learned: Round 2, Countdown Mascot.*
18. **Mascots grow with room** (up to 130%, still bleeding off the top), and the copy steps down to stay clear. *Engine. Learned: Round 2.*
19. **Secondary lines don't end on a short word** ("…apps at / Topgolf" becomes "…apps / at Topgolf"). Headlines keep the designer's breaks: "Meet Archy at / Yankee…" reads well. *Engine: `keepLinesTidy()`. Learned: Round 2 and the event cover "at" comment.*
20. **No stars under copy; illustrations never touch it.** Copy wraps short of an illustration first. *Backs off*: never closer to it than the design keeps; copy that Paper already sets near the drawing keeps its width and lines. *Engine: `clearIllustrations()`. Learned: Night Out Illustration (the headline went from 2 to 4 lines).*

### Themes

- **Sky:** text, icons, labels, lines and buttons in white or an extremely light blue. No dark colors.
- **Dark and Blue:** pills, badges and containers in a lighter or brighter blue than the ground (never the same); the mascot's antenna light blue.
- **Ice and Light:** rulers and dividers in a subtle blue, never grey. On Light, labels and icons in Sky blue, lines a lighter blue (Round 2).
- **Labels on Sky:** very light blue, almost white (Round 2).
- **Mascot on light or sky grounds:** it gets the outline defined in the Archy brand guidelines in Paper, so its ears and head do not melt into the ground.
- **Themes are a convenience.** For important pieces the designer makes each theme in Paper; the engine's themes must still never break the hard rules.

## Content (for examples, tests and Claude)

- **Example and test copy is realistic.**
  - Real event names, cities, venues and dates, with the event's own partner logo and city photo.
  - Never the template's own sample: a template always looks right with the copy it was designed with.
  - Short copy is written as marketing would, never a cut sentence. *`scripts/review-cases.ts`.*
- **Copy that does not fit is written shorter with the same facts**, as Claude does: "November" → "Nov", "Find Archy at the" → "Meet Archy at", the year dropped from a kicker. *`shorter()` in `scripts/review-cases.ts`, mirroring the MCP's refusal.*

## For the designer in Paper

- **Optional details need a layout without them.** If a logo overlaps a pill, make a variant for when it is left out: the engine cannot know where the pill should start. Resolved for the offer strip: it was removed (see below).
- **A column that spreads its content (space-between) leaves a gap when details are missing.** Consider a compact variant. *Open: Night Out.*
- **Covers bake a blue tint into their city photo.** Resolved: covers apply Pixel Tone to any photo (guide 12).
- **Offer labels go.** Resolved: `optional-offer` was removed in Paper. Booth Invite Offer became the Royal Blue theme of `booth-invite-photo` (its photo band took the room), Countdown Offer the Royal Blue theme of `countdown-mascot`, and the Booth Offer cover the Royal Blue theme of `event-cover-booth-photo`.
