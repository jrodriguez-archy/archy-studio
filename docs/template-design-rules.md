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

## Content (for examples, tests and Claude)

- **Example and test copy is realistic.**
  - Real event names, cities, venues and dates, with the event's own partner logo and city photo.
  - Never the template's own sample: a template always looks right with the copy it was designed with.
  - Short copy is written as marketing would, never a cut sentence. *`scripts/review-cases.ts`.*
- **Copy that does not fit is written shorter with the same facts**, as Claude does: "November" → "Nov", "Find Archy at the" → "Meet Archy at", the year dropped from a kicker. *`shorter()` in `scripts/review-cases.ts`, mirroring the MCP's refusal.*

## For the designer in Paper

- **Optional details need a layout without them.** If a logo overlaps a pill (offer logo on "WIN PRIZES"), make a variant for when it is left out: the engine cannot know where the pill should start. *Open: Booth Invite Offer.*
- **A column that spreads its content (space-between) leaves a gap when details are missing.** Consider a compact variant. *Open: Night Out.*
- **Covers bake a blue tint into their city photo.** A real photo arrives untinted. Decide whether the cover should tint any photo itself. *Open: from Round 1.*
