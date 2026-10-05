# Archy templates · PoC (Paper → HTML → PNG)

Converts a Paper template (slot convention of the `archy` plugin) into HTML, fills it with content, fits the text, and renders a PNG at the artboard's exact size.

## Commands
```bash
npm i && npx playwright install chromium
node scripts/sync.mjs templates/ae-spotlight            # read Paper (desktop app open) → post.html, stories.html, manifest.json
node scripts/render.mjs templates/ae-spotlight --calibrate   # measured limits → manifest.json
node scripts/render.mjs templates/ae-spotlight --case cases/long.json   # → out/long-post.png + .json report
python3 scripts/to-srgb.py templates/ae-spotlight/reference/post.png templates/ae-spotlight/reference/post.srgb.png
node scripts/compare.mjs out/original-post.png templates/ae-spotlight/reference/post.srgb.png
```

## Files per template
- `template.config.json`: Paper file and artboard per format (written by hand).
- `rules.json`: fit behaviour designed by hand (bounds, maxLines, minScale, collisions).
- `source/*.json`: raw Paper reads (sync rebuilds offline with `--offline`).
- `manifest.json`: generated slots, defaults, styles and measured limits.

## What we learned about Paper
- The desktop MCP server also listens on `127.0.0.1:29979/mcp`, so a script can read it without going through Claude.
- Paper renders Inter 4 **without optical sizing** (opsz 14 at every size), which needs `font-optical-sizing: none`.
- Exports are **Display P3** with an ICC profile. Convert them to sRGB before diffing.
- Fonts are the same Google Fonts files Paper loads (self-hosted in `fonts/`).
