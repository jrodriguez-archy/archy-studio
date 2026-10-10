// Brand checks for explorations (lib/compose.ts), run in the rendered page. Absolute checks: an
// exploration has no designed baseline to compare with, so it is held to the brand itself.
//
// window.__exploreCheck({ safe, palette, minText }) → { errors, warnings, texts }
//   errors / warnings: [{ layer, code, message }]
//   texts: every text run with its box and colour (the renderer measures contrast on the pixels behind it)
// window.__hideText(on): text drawn transparent (to read the ground behind it), or back.
(() => {
  const root = () => document.querySelector('[data-node="root"]');
  const nameOf = (el) => el.closest('[data-name]')?.getAttribute('data-name') || el.tagName.toLowerCase();
  const rgb = (s) => { const m = s && s.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/); return m ? [+m[1], +m[2], +m[3], m[4] == null ? 1 : +m[4]] : null; };
  const hex = (c) => '#' + c.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
  const inside = (b, r, tol = 1) => b.left >= r.left - tol && b.top >= r.top - tol && b.right <= r.right + tol && b.bottom <= r.bottom + tol;
  const area = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  const rel = (b, R) => ({ x: Math.round(b.left - R.left), y: Math.round(b.top - R.top), w: Math.round(b.width), h: Math.round(b.height) });

  // Elements that hold text of their own (a text node child), with the box of that text as drawn.
  function textRuns() {
    const out = [];
    const walker = document.createTreeWalker(root(), NodeFilter.SHOW_TEXT);
    const seen = new Map();
    for (let t = walker.nextNode(); t; t = walker.nextNode()) {
      if (!t.textContent.trim()) continue;
      const el = t.parentElement;
      if (!el || el.closest('svg')) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) continue;
      const range = document.createRange();
      range.selectNodeContents(t);
      const rects = [...range.getClientRects()].filter((r) => r.width > 0 && r.height > 0);
      if (!rects.length) continue;
      const box = { left: Math.min(...rects.map((r) => r.left)), top: Math.min(...rects.map((r) => r.top)), right: Math.max(...rects.map((r) => r.right)), bottom: Math.max(...rects.map((r) => r.bottom)) };
      const prev = seen.get(el);
      if (prev) { prev.box = { left: Math.min(prev.box.left, box.left), top: Math.min(prev.box.top, box.top), right: Math.max(prev.box.right, box.right), bottom: Math.max(prev.box.bottom, box.bottom) }; prev.text += ' ' + t.textContent.trim(); prev.lines.push(...rects); continue; }
      const run = { el, box, lines: [...rects], text: t.textContent.trim(), cs };
      seen.set(el, run);
      out.push(run);
    }
    for (const r of out) { r.box.width = r.box.right - r.box.left; r.box.height = r.box.bottom - r.box.top; }
    return out;
  }

  window.__hideText = function hideText(on) {
    let s = document.getElementById('__hide-text');
    if (on && !s) { s = document.createElement('style'); s.id = '__hide-text'; s.textContent = '[data-node="root"] * { color: transparent !important; -webkit-text-fill-color: transparent !important; text-shadow: none !important; text-decoration-color: transparent !important; }'; document.head.appendChild(s); }
    if (!on && s) s.remove();
  };

  window.__exploreCheck = function exploreCheck(opts) {
    const r = root(), R = r.getBoundingClientRect();
    const errors = [], warnings = [];
    const err = (el, code, message) => errors.push({ layer: el ? nameOf(el) : null, code, message });
    const warn = (el, code, message) => warnings.push({ layer: el ? nameOf(el) : null, code, message });
    const safe = { left: R.left + opts.safe.x, top: R.top + opts.safe.y, right: R.left + opts.safe.x + opts.safe.w, bottom: R.top + opts.safe.y + opts.safe.h };
    const runs = textRuns();
    if (!runs.length) warn(null, 'no-text', 'The design has no text.');

    for (const t of runs) {
      const { el, box, cs } = t;
      const size = parseFloat(cs.fontSize);
      // The family as drawn: the first one in the stack the browser has loaded.
      const family = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim();
      if (!opts.fonts.includes(family)) err(el, 'font', `"${t.text.slice(0, 40)}" is set in ${family}; use ${opts.fonts.join(' or ')}.`);
      else if (!document.fonts.check(`${cs.fontWeight} ${size}px "${family}"`)) err(el, 'font', `${family} ${cs.fontWeight} did not load for "${t.text.slice(0, 40)}".`);
      if (!inside(box, R)) err(el, 'cut', `"${t.text.slice(0, 40)}" runs off the artboard.`);
      else {
        // Cut by a frame that clips (overflow hidden) on its way up to the artboard.
        for (let a = el.parentElement; a && a !== r; a = a.parentElement) {
          const o = getComputedStyle(a);
          if ((o.overflow !== 'visible' || o.overflowX !== 'visible' || o.overflowY !== 'visible') && !inside(box, a.getBoundingClientRect())) { err(el, 'cut', `"${t.text.slice(0, 40)}" is cut off by ${nameOf(a)}.`); break; }
        }
        if (!inside(box, safe, 2)) warn(el, 'safe-area', `"${t.text.slice(0, 40)}" is outside the safe area.`);
      }
      if (size < opts.minText) err(el, 'small', `"${t.text.slice(0, 40)}" is ${Math.round(size)} px; at least ${Math.ceil(opts.minText)} px on this format.`);
      if (cs.textShadow !== 'none') warn(el, 'effect', `${nameOf(el)} has a text shadow (off-brand).`);
    }
    // Text on text.
    for (let i = 0; i < runs.length; i++) for (let j = i + 1; j < runs.length; j++) {
      const a = runs[i], b = runs[j];
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
      // On the letters' body, not their font boxes: tight headline leading makes those boxes overlap.
      const body = (r, cs) => { const h = parseFloat(cs.fontSize) * 0.7, cy = (r.top + r.bottom) / 2; return { left: r.left, right: r.right, top: cy - h / 2, bottom: cy + h / 2 }; };
      const hit = a.lines.some((la) => b.lines.some((lb) => area(body(la, a.cs), body(lb, b.cs)) > 6));
      if (hit) err(b.el, 'overlap', `"${b.text.slice(0, 30)}" overlaps "${a.text.slice(0, 30)}".`);
    }

    // The logo: the real one, once, whole, not tiny.
    const logos = [...r.querySelectorAll('[data-piece="logo"]')];
    if (!logos.length) err(null, 'logo', 'The Archy logo is missing: add <div data-piece="logo" style="width: 234px"></div>.');
    if (logos.length > 1) warn(logos[1], 'logo', `The Archy logo appears ${logos.length} times; once is the rule.`);
    for (const l of logos) {
      const b = l.getBoundingClientRect();
      if (!b.width || !b.height) { err(l, 'logo', 'The Archy logo has no size: give it a width.'); continue; }
      // The logo keeps clear of the copy: no text within a tenth of its height.
      const pad = b.height * 0.1, clear = { left: b.left - pad, top: b.top - pad, right: b.right + pad, bottom: b.bottom + pad };
      const near = runs.find((t) => !l.contains(t.el) && t.lines.some((ln) => area(ln, clear) > 6));
      if (near) err(l, 'overlap', `The Archy logo touches "${near.text.slice(0, 30)}": give it room (at least a tenth of its height all around).`);
      if (!inside(b, R)) err(l, 'logo', 'The Archy logo runs off the artboard.');
      else if (!inside(b, safe, 2)) warn(l, 'safe-area', 'The Archy logo is outside the safe area.');
      if (b.width < opts.minLogo) warn(l, 'logo', `The Archy logo is ${Math.round(b.width)} px wide; at least ${Math.round(opts.minLogo)} on this format.`);
    }

    // Colours outside the brand, and the effects the brand leaves out.
    const palette = new Set(opts.palette.map((h) => h.toUpperCase()));
    const off = new Map();
    const note = (c, el) => { if (!c || c[3] === 0) return; const h = hex(c); if (!palette.has(h) && !off.has(h)) off.set(h, nameOf(el)); };
    for (const el of [r, ...r.querySelectorAll('*')]) {
      if (el.closest('svg') && el.tagName.toLowerCase() !== 'svg') continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none') continue;
      if ([...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) note(rgb(cs.color), el);
      note(rgb(cs.backgroundColor), el);
      if (parseFloat(cs.borderTopWidth) || parseFloat(cs.borderLeftWidth)) note(rgb(cs.borderTopColor), el);
      if (el.hasAttribute('data-icon')) note(rgb(cs.color), el);
      for (const m of cs.backgroundImage.matchAll(/rgba?\([^)]*\)/g)) note(rgb(m[0]), el);
      if (cs.boxShadow !== 'none' && !/inset/.test(cs.boxShadow)) warn(el, 'effect', `${nameOf(el)} has a drop shadow (off-brand).`);
      if (cs.filter !== 'none' || cs.backdropFilter !== 'none') warn(el, 'effect', `${nameOf(el)} has a filter or blur (off-brand).`);
      if (cs.mixBlendMode !== 'normal') warn(el, 'effect', `${nameOf(el)} uses a blend mode (off-brand).`);
      const m = cs.transform.match(/^matrix\(([^)]+)\)/);
      if (m && Math.abs(+m[1].split(',')[1]) > 0.01) warn(el, 'effect', `${nameOf(el)} is rotated; rotation is for the mascot and badges only.`);
      // An outlined pill with a word in it reads as generic AI output.
      const b = el.getBoundingClientRect();
      if (b.height && parseFloat(cs.borderTopWidth) > 0 && parseFloat(cs.borderTopLeftRadius) >= b.height / 2 - 1 && (rgb(cs.backgroundColor)?.[3] ?? 0) === 0 && el.textContent.trim() && el.textContent.trim().split(/\s+/).length <= 3) warn(el, 'pill', `${nameOf(el)} is an outlined pill with a word in it; use the status pill (filled) or plain text.`);
    }
    for (const [h, layer] of [...off].slice(0, 6)) warnings.push({ layer, code: 'colour', message: `${h} on ${layer} is not a brand colour; use a token.` });

    // A hole in the layout: the largest empty band between the blocks, top to bottom (portrait and square
    // pieces; a wide banner leaves room on purpose). Big type fills a piece better than air.
    // A piece whose photo fills it is image-led: its open space is the photo, not a hole.
    const imageLed = [...r.querySelectorAll('[data-image], img')].some((p) => {
      const k = p.getAttribute('data-kind'), b = p.getBoundingClientRect();
      return k !== 'tone' && k !== 'cutout' && !p.closest('[data-piece]') && b.left <= R.left + 2 && b.top <= R.top + 2 && b.right >= R.right - 2 && b.bottom >= R.bottom - 2;
    });
    if (R.height >= R.width * 0.8 && !imageLed) {
      const blocks = [...runs.map((t) => t.box), ...logos.map((l) => l.getBoundingClientRect()), ...[...r.querySelectorAll('[data-icon], [data-image], img')].map((e) => e.getBoundingClientRect())]
        .filter((b) => b.width && b.height && b.width * b.height < R.width * R.height * 0.85 && b.bottom > safe.top && b.top < safe.bottom)
        .sort((a, b) => a.top - b.top);
      let end = safe.top, gap = 0, at = null;
      for (const b of blocks) { if (b.top - end > gap) { gap = b.top - end; at = end; } end = Math.max(end, b.bottom); }
      if (safe.bottom - end > gap) { gap = safe.bottom - end; at = end; }
      const room = safe.bottom - safe.top;
      const hole = `About ${Math.round(gap)} px of empty space from y ${Math.round(at - R.top)}: the layout reads as a hole. Without an image the type is the design: make the headline bigger so it holds the centre, or spread the blocks over the format (two anchors, the gaps absorb the rest).`;
      if (gap > Math.max(opts.maxGap, room * opts.holeError)) err(null, 'empty', hole);
      else if (gap > Math.max(opts.maxGap, room * opts.holeWarn)) warn(null, 'empty', hole);
    }

    // Photos: a generated image is the subject and fills the artboard; a large photo does not stop across
    // the piece without blending into it; a Pixel Tone photo is a texture behind type, not a band.
    const photos = [...r.querySelectorAll('[data-image], img')].filter((p) => !p.closest('[data-piece]'));
    const fills = (b) => b.left <= R.left + 2 && b.top <= R.top + 2 && b.right >= R.right - 2 && b.bottom >= R.bottom - 2;
    const gradientOver = (photo, x, y) => {
      const stack = document.elementsFromPoint(x, y);
      const i = stack.indexOf(photo);
      return stack.slice(0, i < 0 ? stack.length : i).some((e) => /gradient\(/.test(getComputedStyle(e).backgroundImage) && !e.hasAttribute('data-image'));
    };
    for (const p of photos) {
      const b = p.getBoundingClientRect();
      if (!b.width || !b.height) continue;
      const kind = p.getAttribute('data-kind');
      const big = (b.width * b.height) / (R.width * R.height) >= opts.bigPhoto;
      if (kind === 'generated' && !fills(b)) { err(p, 'image-subject', `${nameOf(p)} is a generated image that does not fill the artboard: in a piece with an image, the image is the subject. Run it full-bleed (left 0, top 0, the artboard's width and height) and set the copy on its calm part with a scrim.`); continue; }
      if (kind === 'tone' && !fills(b) && big) warn(p, 'tone', `${nameOf(p)} is a Pixel Tone photo used as a band: Pixel Tone is a quiet texture behind type (the whole artboard or a block's ground), not a picture to look at.`);
      if (!big || fills(b) || kind === 'cutout') continue;
      // Each side that stops inside the artboard needs a gradient over it (a fade into the ground).
      const sides = [['top', b.top > R.top + 2, (k) => [b.left + (b.width * k) / 4, b.top + 3]], ['bottom', b.bottom < R.bottom - 2, (k) => [b.left + (b.width * k) / 4, b.bottom - 3]],
        ['left', b.left > R.left + 2, (k) => [b.left + 3, b.top + (b.height * k) / 4]], ['right', b.right < R.right - 2, (k) => [b.right - 3, b.top + (b.height * k) / 4]]];
      const cut = sides.filter(([, inside, at]) => inside && ![1, 2, 3].every((k) => gradientOver(p, ...at(k)))).map(([side]) => side);
      if (cut.length) err(p, 'photo-edge', `${nameOf(p)} stops across the piece (${cut.join(', ')} edge) with a hard line: run it to the edge, or blend that edge into the ground with a scrim (a gradient from the ground colour to transparent).`);
    }

    // Text over a photo sits on a scrim (a gradient from the colour opposite the text to transparent) or
    // on a solid block (a pill, a button); a Pixel Tone texture is quiet enough on its own.
    for (const t of runs) {
      const { el, box } = t;
      const pts = [[0.5, 0.5], [0.15, 0.3], [0.85, 0.3], [0.15, 0.7], [0.85, 0.7]].map(([fx, fy]) => [box.left + box.width * fx, box.top + box.height * fy]);
      const bare = pts.some(([x, y]) => {
        if (x < R.left || y < R.top || x > R.right || y > R.bottom) return false;
        const stack = document.elementsFromPoint(x, y);
        let i = stack.findIndex((e) => e === el || el.contains(e));
        if (i < 0) i = 0;
        for (const e of stack.slice(i + 1)) {
          if (e === r) return false;
          if (e.hasAttribute('data-image') || e.tagName === 'IMG') return e.getAttribute('data-kind') !== 'tone' && !e.closest('[data-piece]');
          const cs = getComputedStyle(e);
          if (/gradient\(/.test(cs.backgroundImage)) return false;
          const bg = rgb(cs.backgroundColor);
          if (bg && bg[3] > 0.85 && !e.contains(el)) return false;
          if (bg && bg[3] > 0.85 && e.contains(el) && e !== r) return false;
        }
        return false;
      });
      if (bare) err(el, 'scrim', `"${t.text.slice(0, 40)}" sits on a photo without a scrim. Put a gradient behind the copy, from the colour opposite the text to transparent, toward where the copy is (white behind dark text, var(--color-blue-tint-800) behind white text), covering the copy and running to that edge of the artboard.`);
    }

    const texts = runs.map((t) => ({ layer: nameOf(t.el), text: t.text.slice(0, 60), box: rel(t.box, R), color: rgb(t.cs.color), size: parseFloat(t.cs.fontSize) }));
    // The logo reads like large text against what is behind it.
    for (const l of logos) { const b = l.getBoundingClientRect(); if (b.width) texts.push({ layer: nameOf(l), text: 'the Archy logo', box: rel(b, R), color: rgb(getComputedStyle(l).color), size: 999 }); }
    return { errors, warnings, texts };
  };
})();
