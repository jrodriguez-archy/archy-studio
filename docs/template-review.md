# Template review

Admin → Template review is where a new template (or one that changed a lot in Paper) is checked before the team uses it. The first three rounds (October 2026) taught the engine how templates must look. What they taught is in [template-design-rules.md](template-design-rules.md) and in the engine itself (`scripts/fit.js`, `edits.js`, `components.js`).

## When

- A template newly prepared in Paper (archy-design `prepare-template`).
- A template whose layout changed a lot.

Fine adjustments of a single design (a size, framing a photo) are done by hand in Canvas, not here.

## How

1. Ask Claude: "review the template `<id>`". Claude runs:

   ```
   set -a; source .env.local; set +a
   NODE_OPTIONS=--conditions=react-server npx tsx scripts/review-round.ts --template <id>
   ```

   This makes a short round with new, realistic content (never the template's own sample):
   - realistic and short copy in every format;
   - Dark, Sky and Light on the main format.

2. In Admin → Template review, approve each design (A) or click on it to comment on a spot (N marks it as needing work). "Same for…" puts the comment on every format, and comments can be copied and pasted between designs.

3. Claude reads the comments (`scripts/review-feedback.ts --pins <dir>`) and fixes each one where it belongs:
   - the **engine**, when it is general;
   - the template's **`rules.json`**, when it is specific to that template;
   - a note for **Paper**, when the template itself needs to change.

   Each comment is resolved with what changed, and the next round (`--template <id>` again) shows before and after.

4. General lessons are added to `template-design-rules.md`, as a hard rule or a flexible guide. When everything is approved, the round is deleted: what it taught stays in the code and the rules.

## Other scripts

- `scripts/qa-templates.ts`: every template × format × case, with fit, fill and Inspector findings. Run it before and after an engine change to check that nothing got worse.
- `scripts/review-round.ts --small`: a short round across several templates, to show an engine change.
