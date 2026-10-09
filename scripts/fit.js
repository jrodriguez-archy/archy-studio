// Runs inside the template page. Fills slots and fits text following the plugin's order:
// rewrap first, then reduce the type a little, then (if it still does not fit) report so the copy is shortened.
// Never lets content overflow silently.
// Moves an element by (dx, dy) on top of the translate it has in the design (Paper places some stickers
// with one, e.g. `calc(-50% + 361px) -132px`): never instead of it, so it stays where it was drawn.
function shiftBy(el, dx, dy) {
  if (!('baseTranslate' in el.dataset)) el.dataset.baseTranslate = el.style.translate || '';
  const base = el.dataset.baseTranslate;
  if (!dx && !dy) { el.style.translate = base; return; }
  if (!base || base === 'none') { el.style.translate = `${dx}px ${dy}px`; return; }
  const parts = []; let depth = 0, cur = '';
  for (const ch of base.trim()) {
    if (ch === '(') depth++; else if (ch === ')') depth--;
    if (/\s/.test(ch) && !depth) { if (cur) parts.push(cur); cur = ''; } else cur += ch;
  }
  if (cur) parts.push(cur);
  el.style.translate = `calc(${parts[0] ?? '0px'} + ${dx}px) calc(${parts[1] ?? '0px'} + ${dy}px)`;
}

window.__fill = async function fill({ format, formats, values, rules, limits }) {
  const root = document.querySelector('body > [data-node]');
  const byName = (name) =>
    name instanceof Element ? name : name === '@artboard' ? root : root.querySelector(`[data-name^="${CSS.escape(name)}"]`);
  const pick = (v) => (v && typeof v === 'object' && !(v instanceof Element) && !Array.isArray(v) && Object.keys(v).every((k) => formats.includes(k)) ? v[format] : v);
  const report = { format, ok: true, slots: {}, errors: [] };

  rules = withDefaults(root, rules);
  const containerTop = new Map((rules.containers ?? []).filter((c) => c.mirror).map((c) => {
    const el = byName(pick(c.node));
    return [el, el ? el.getBoundingClientRect().top - root.getBoundingClientRect().top : 0];
  }));
  // Optional blocks that hold slots now (decorative optional-* blocks are never pruned).
  const optionalWithSlots = new Set([...root.querySelectorAll('[data-optional]')].filter((o) => o.querySelector('[data-slot]')));
  // Logo frames: remember their size so a new mark is set at the same height.
  const logoBox = new Map([...root.querySelectorAll('[data-slot-type="logo"]')].map((n) => [n, n.getBoundingClientRect()]));

  // ---- Baseline geometry (before any change) so "mirror" insets reflect the design. ----
  const baseline = new Map();
  const rectOf = (el) => el.getBoundingClientRect();
  for (const [role, r] of Object.entries(rules.slots)) {
    const el = root.querySelector(`[data-slot="${role}"][data-slot-type="text"]`);
    if (!el) continue;
    const block = r.block ? byName(pick(r.block)) : el;
    const bounds = byName(pick(r.within) ?? '@artboard');
    const b = rectOf(block), w = rectOf(bounds);
    const cs = getComputedStyle(block);
    const anchoredRight = block.style.right !== '' && block.style.left === '';
    // Floating elements (badges, mascots) that do not touch this text in the design must not touch it later.
    const textRects = (() => { const rg = document.createRange(); rg.selectNodeContents(el); return [...rg.getClientRects()].filter((x) => x.width > 0); })();
    const clear = r.auto ? [...root.querySelectorAll('[data-node]')].filter((x) => {
      if (x === root || x.contains(el) || el.contains(x) || getComputedStyle(x).position !== 'absolute') return false;
      const xr = x.getBoundingClientRect();
      if (xr.width < 2 || xr.height < 2) return false;
      // Sparkles never push copy: one under a text is hidden (clearIllustrations).
      if (x.matches('svg[data-name="Star"], svg[data-name^="Stars"], svg[data-name^="Stars"] *')) return false;
      return !textRects.some((t) => intersects(t, xr, 0));
    }) : [];
    baseline.set(role, {
      clear,
      // Absolutely placed blocks keep a mirrored margin; in-flow text just stays inside its container.
      inset: pick(r.inset) ?? (cs.position !== 'absolute' ? 0 : anchoredRight ? w.right - b.right : b.left - w.left),
      anchoredRight,
      fontSize: parseFloat(getComputedStyle(el).fontSize),
      top: rectOf(el).top,
      height: rectOf(el).height,
      lineHeight: parseFloat(getComputedStyle(el).lineHeight),
      position: cs.position,
    });
  }

  // Booth stickers as designed: how close each text sits to them in Paper. Their breathing room never
  // asks for more than the design (a sticker drawn over the kicker's rule, or near the headline, stays).
  const gapBetween = (a, b) => Math.max(a.left - b.right, b.left - a.right, a.top - b.bottom, b.top - a.bottom);
  const designGaps = new Map([...root.querySelectorAll('svg[data-name^="RIBBON"]')].map((svg) => {
    const v = rectOf(svg);
    return [svg, new Map([...root.querySelectorAll('[data-slot-type="text"]')].map((t) => {
      const rg = document.createRange(); rg.selectNodeContents(t);
      const rs = [...rg.getClientRects()].filter((x) => x.width > 0);
      return [t, rs.length ? Math.min(...rs.map((x) => gapBetween(x, v))) : Infinity];
    }))];
  }));

  // Illustrations (a cocktail, a drawing) as designed: how close each text sits to each of their parts.
  const RA0 = rectOf(root).width * rectOf(root).height;
  const isStar = (s0) => s0.dataset.name === 'Star';
  const artLeaves = [...root.querySelectorAll('[data-name^="Cocktail"], [data-name^="Illustration"], [data-optional="illustration"]')]
    // Drawn (SVG) or placed as an image (a bowling ball): both are art copy keeps clear of.
    .flatMap((a) => [...a.querySelectorAll('svg, [data-slot-type="image"]')].filter((s0) => { const b = s0.getBoundingClientRect(); return !isStar(s0) && b.width > 4 && b.width * b.height < RA0 * 0.2; }));
  const artGaps = new Map([...root.querySelectorAll('[data-slot-type="text"]')].map((t) => {
    const rg = document.createRange(); rg.selectNodeContents(t);
    const rs = [...rg.getClientRects()].filter((x) => x.width > 0);
    return [t, new Map(artLeaves.map((l) => [l, rs.length ? Math.min(...rs.map((x) => gapBetween(x, l.getBoundingClientRect()))) : Infinity]))];
  }));

  // Never stricter than the design itself: whatever already "overflows" in the original is tolerated.
  for (const [role, r] of Object.entries(rules.slots)) {
    const el = root.querySelector(`[data-slot="${role}"][data-slot-type="text"]`);
    if (!el || !baseline.has(role)) continue;
    baseline.get(role).tol = 0;
    baseline.get(role).tol = overflow(role, r, el);
  }
  // The design's footprint: how tall the main Content column is with the sample copy, the space the
  // designer filled. Short copy must not leave it half empty (see balance()).
  const frame = (() => {
    const el = (rules.containers ?? []).map((c) => byName(pick(c.node))).find(Boolean) ?? [...root.children].find((c) => c.dataset.name === 'Content');
    if (!el) return null;
    const cs = getComputedStyle(el);
    if (cs.display !== 'flex' || !cs.flexDirection.startsWith('column')) return null;
    // The area it may fill: down to a bottom margin like its side margin (tall formats keep clear of
    // the app's bottom bar, ~13% of the height); a fixed-height frame keeps its own height.
    const R = rectOf(root), b = rectOf(el), fixed = !!el.style.height;
    const tall = R.height / R.width > 1.6;
    const margin = Math.max(b.left - R.left, tall ? R.height * 0.13 : 0);
    // A mirrored frame never passes its own top margin at the bottom (the "mirror" container rule). In a
    // tall format the top margin is usually room for a mascot or a photo, not a margin: there the bottom
    // limit is the app's safe zone instead.
    if (tall && containerTop.has(el)) containerTop.set(el, Math.min(containerTop.get(el), margin));
    const mirrored = containerTop.has(el) ? R.bottom - containerTop.get(el) : Infinity;
    const area = fixed ? b.height : Math.max(b.height, Math.min(R.bottom - margin, mirrored) - b.top);
    return { el, h: b.height, area, used: usedOf(el), fixed };
  })();
  const sampleText = new Map([...root.querySelectorAll('[data-slot][data-slot-type="text"]')].map((n) => [n.dataset.slot, n.textContent]));
  const containerTol = new Map();
  for (const c of containersOk()) containerTol.set(`${c.node}|${c.reason ?? ''}`, c.overflowPx);

  // ---- Fill values ----
  const touchedParents = [];
  // An empty text slot is removed and the layout closes up; an optional block left with no slot
  // content (a pill with only its dot, a plate with no name or title) is removed whole.
  for (let [role, value] of Object.entries(values)) {
    const nodes = root.querySelectorAll(`[data-slot="${role}"]`);
    // drop: words the design already prints here (a sticker that says BOOTH takes only "#1039").
    const drop = pick(rules.slots[role]?.drop);
    if (drop && typeof value === 'string') value = value.replace(new RegExp(drop, 'i'), '').trim();
    if (!nodes.length) continue; // slot not present in this variant
    const empty = value == null || value === '';
    const touched = new Set();
    for (const n of nodes) {
      const type = n.dataset.slotType;
      // An image left empty is removed (photo band, portrait) and the ground closes the gap.
      if (type === 'image') {
        if (empty) { touched.add(n.parentElement); n.remove(); continue; }
        n.style.backgroundImage = `url("${value}")`;
        try { await framePhoto(n, value, role, format, rules.coverTone); } catch {}
        // Its own size, for a reframe by hand in Canvas (edits.js crop).
        if (!n.dataset.toneOwn) {
          try { const im = new Image(); im.crossOrigin = 'anonymous'; im.src = value; await im.decode(); n.dataset.imgW = String(im.naturalWidth); n.dataset.imgH = String(im.naturalHeight); n.dataset.slotSrc = `${im.naturalWidth}x${im.naturalHeight}`; } catch {}
        }
        continue;
      }
      if (empty) {
        // A divider that only separated this text from its neighbour goes with it (no line left alone).
        for (const sib of [n.previousElementSibling, n.nextElementSibling]) if (sib && /^(Divider|Separator)/.test(sib.dataset.name ?? '')) { sib.remove(); break; }
        touched.add(n.parentElement); n.remove(); continue;
      }
      if (type === 'logo') {
        // A partner mark is one colour on the piece (the colour of the template's sample mark) and is
        // sized optically: same visible ink as the sample the designer balanced against the Archy
        // wordmark, measured without the file's transparent margins, then centred in the slot.
        const box = logoBox.get(n);
        const shape = n.querySelector('path, rect, circle, polygon, ellipse');
        const color = (shape && getComputedStyle(shape).fill.startsWith('rgb') && getComputedStyle(shape).fill) || getComputedStyle(n).color;
        // Reference: the Archy wordmark in the same lockup (the partner mark should weigh the same);
        // without one, the template's own sample mark.
        const lockup = n.closest('[data-name="Logo Lockup"]') ?? n.parentElement;
        const archy = [...lockup.querySelectorAll('svg')].find((x) => /^Logo Archy|Archy Wordmark/.test(x.dataset.name ?? ''));
        const sample = (archy && await sampleInk(archy)) || await sampleInk(n);
        const mark = await inkStats(value);
        let h = sample ? sample.h : box.height, w = h * (mark ? mark.bw / mark.bh : 3);
        if (sample && mark) {
          const aspect = mark.bw / mark.bh;
          // Same visual weight as the Archy wordmark, and never smaller than most of its height
          // (Template review: partner logos read small next to Archy).
          h = Math.sqrt((sample.ink * 1.4) / (mark.density * aspect));
          h = Math.min(Math.max(h, sample.h * 0.8), sample.h * 1.35, box.height * 1.15);
          w = h * aspect;
          // Width: the room the design gives the partner mark (its sample frame), with a little slack.
          const maxW = Math.max(box.width, sample.w * 1.6, rectOf(lockup).width * 0.38);
          if (w > maxW) { w = maxW; h = w / aspect; }
          (report.logos ??= {})[role] = { ref: archy ? 'archy' : 'sample', refH: Math.round(sample.h), refInk: Math.round(sample.ink), density: +mark.density.toFixed(3), aspect: +aspect.toFixed(2), boxH: Math.round(box.height), w: Math.round(w), h: Math.round(h) };
        }
        const k = mark ? h / mark.bh : 1;
        n.style.width = 'auto';
        n.style.display = 'flex';
        n.style.alignItems = 'center';
        n.style.justifyContent = 'flex-end';
        n.style.height = `${Math.round(box.height)}px`;
        const el = document.createElement('div');
        el.dataset.logoMark = '';
        Object.assign(el.style, { width: `${Math.round(w)}px`, height: `${Math.round(h)}px`, flexShrink: '0' });
        const pos = mark ? `${-mark.bx * k}px ${-mark.by * k}px` : 'center';
        const size = mark ? `${mark.nw * k}px ${mark.nh * k}px` : 'contain';
        // A logo in several colours, or on its own solid ground (a badge, a photo), keeps its colours:
        // as one colour it would read as a blot. Canvas can choose either by hand (edits.js).
        Object.assign(el.dataset, { logoSrc: value, logoPos: pos, logoSize: size, logoColor: color, logoAuto: mark?.colourful || mark?.opaque ? 'original' : 'one' });
        logoMode(el, el.dataset.logoAuto);
        n.replaceChildren(el);
        // Optical centre: the partner mark centres on the body of the Archy letters (cap height), not
        // on the wordmark's box, which the descender of the "y" pulls down.
        if (archy && sample?.top != null && mark) {
          const a = rectOf(archy), m0 = el.getBoundingClientRect();
          const body = a.top + sample.top + sample.h * 0.39;
          const dy = Math.round(body - (m0.top + m0.height / 2));
          if (Math.abs(dy) > 1 && Math.abs(dy) < box.height * 0.3) { shiftBy(el, 0, dy); (report.logos[role] ??= {}).dy = dy; }
        }
      } else n.textContent = value;
    }
    if (empty) report.slots[role] = { status: 'removed' };
    touchedParents.push(...touched);
  }
  for (const opt of [...optionalWithSlots].reverse()) {
    if (opt.isConnected && !opt.querySelector('[data-slot]')) {
      touchedParents.push(opt.parentElement);
      opt.remove();
      report.removedBlocks = [...(report.removedBlocks ?? []), opt.dataset.optional];
    }
  }
  // A button whose label was left out goes whole (no arrow on its own).
  for (const parent of new Set(touchedParents)) {
    for (let n = parent; n && n !== root; n = n.parentElement) {
      if (/^(CTA|Button)\b/i.test(n.dataset?.name ?? '') && n.isConnected && !n.textContent.trim()) {
        touchedParents.push(n.parentElement);
        n.remove();
        report.removedBlocks = [...(report.removedBlocks ?? []), n.dataset.name];
        break;
      }
    }
  }
  // Separators (Ruler / Divider) left at the start, the end or doubled in a stack that lost items go too.
  for (const parent of new Set(touchedParents)) {
    if (!parent?.isConnected) continue;
    const flow = () => [...parent.children].filter((c) => getComputedStyle(c).position !== 'absolute');
    let changed = true;
    while (changed) {
      changed = false;
      const kids = flow();
      kids.forEach((k, i) => {
        if (!/^(Ruler|Divider)/.test(k.dataset.name ?? '')) return;
        const isSep = (x) => x && /^(Ruler|Divider)/.test(x.dataset.name ?? '');
        if (i === 0 || i === kids.length - 1 || isSep(kids[i + 1])) { k.remove(); changed = true; }
      });
    }
  }

  // ---- Measurement helpers ----
  // Hard rules: no word split across lines ("Tomorrow / !", ": Boston", "EVEN / T") and no short word
  // stranded on a line of its own ("at"), when the text runs to several lines.
  function wordsWhole(el) {
    const tn = [...el.childNodes].filter((n) => n.nodeType === 3);
    for (const node of tn) {
      const re = /\S+/g;
      for (let m = re.exec(node.textContent); m; m = re.exec(node.textContent)) {
        const rg = document.createRange();
        rg.setStart(node, m.index); rg.setEnd(node, m.index + m[0].length);
        const tops = new Set([...rg.getClientRects()].filter((x) => x.width > 0).map((x) => Math.round(x.top / 4)));
        if (tops.size > 1) return false;
      }
    }
    return true;
  }
  function noOrphan(el) {
    const tn = [...el.childNodes].filter((n) => n.nodeType === 3);
    const byLine = new Map();
    for (const node of tn) {
      const re = /\S+/g;
      for (let m = re.exec(node.textContent); m; m = re.exec(node.textContent)) {
        const rg = document.createRange();
        rg.setStart(node, m.index); rg.setEnd(node, m.index + m[0].length);
        const r0 = [...rg.getClientRects()].find((x) => x.width > 0);
        if (!r0) continue;
        const k = Math.round(r0.top / 4);
        byLine.set(k, [...(byLine.get(k) ?? []), m[0]]);
      }
    }
    if (byLine.size < 2) return true;
    return [...byLine.values()].every((words) => words.length > 1 || words[0].replace(/[^\p{L}\p{N}]/gu, '').length > 3);
  }
  // The height a column's content takes (children, gaps, padding), whatever the frame's own height.
  function flowOf(box) { return [...box.children].filter((c) => getComputedStyle(c).position !== 'absolute' && getComputedStyle(c).display !== 'none'); }
  function usedOf(box) {
    const kids = flowOf(box);
    if (!kids.length) return 0;
    const cs = getComputedStyle(box);
    const gap = /space-/.test(cs.justifyContent) ? 0 : parseFloat(cs.rowGap) || 0;
    return kids.reduce((a, k) => a + k.getBoundingClientRect().height + (k.style.marginTop === 'auto' ? 0 : parseFloat(getComputedStyle(k).marginTop) || 0), 0)
      + gap * (kids.length - 1) + parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
  }
  function lines(el) {
    const range = document.createRange();
    range.selectNodeContents(el);
    const tops = new Set([...range.getClientRects()].filter((r) => r.width > 0).map((r) => Math.round(r.top)));
    return tops.size;
  }
  function overflow(role, r, el) {
    const base = baseline.get(role);
    const block = r.block ? byName(pick(r.block)) : el;
    if (!block?.isConnected) return 0;
    const b = rectOf(block), w = rectOf(byName(pick(r.within) ?? '@artboard'));
    let over = 0;
    const bump = (px, why, box = null) => { if (px > over) { over = px; overflow.reason = why; overflow.box = box; } };
    overflow.reason = null;
    overflow.box = null;
    if (base.anchoredRight) bump(w.left + base.inset - b.left, 'width');
    else bump(b.right - (w.right - base.inset), 'width');
    if (r.checkBottom !== false && base.position === 'absolute') bump(b.bottom - (w.bottom - base.inset), 'bottom');
    if (base.clear?.length) {
      const rg = document.createRange(); rg.selectNodeContents(el);
      const tr = [...rg.getClientRects()].filter((x) => x.width > 0);
      for (const x of base.clear) {
        if (!x.isConnected) continue;
        const xr = rectOf(x);
        for (const t of tr) if (intersects(t, xr, 24)) bump(Math.min(t.right - xr.left, xr.right - t.left) + 24, `collides with ${x.dataset.name}`, xr);
      }
    }
    for (const a of pick(r.avoid) ?? []) {
      const av = byName(a.node);
      if (!av) continue;
      const x = rectOf(av), gap = a.gap ?? 0;
      if (intersects(b, x, gap)) bump(x.right + gap - b.left, `collides with ${a.node}`);
    }
    return Math.max(0, Math.ceil(over) - (base.tol ?? 0));
  }
  function intersects(b, x, gap = 0) {
    return b.left < x.right + gap && b.right > x.left - gap && b.top < x.bottom + gap && b.bottom > x.top - gap;
  }
  function containersOk() {
    const bad = [];
    const push = (x) => { const t = containerTol?.get(`${x.node}|${x.reason ?? ''}`) ?? 0; if (x.overflowPx > t + 0.5) bad.push({ ...x, overflowPx: x.overflowPx - t }); };
    for (const c of rules.containers ?? []) {
      const el = byName(pick(c.node));
      const name = typeof c.node === 'string' ? c.node : c.node?.dataset?.name;
      // A few px are rounding (line boxes, glyph overhangs), not copy that does not fit.
      if (el && el.scrollHeight > el.clientHeight + 3) push({ node: name, overflowPx: el.scrollHeight - el.clientHeight });
      if (el && el.scrollWidth > el.clientWidth + 3) push({ node: name, overflowPx: el.scrollWidth - el.clientWidth });
      // mirror: the block may grow, but keeps at least its top margin at the bottom of the artboard.
      if (el && c.mirror) {
        const r = rectOf(el), a = rectOf(root), margin = containerTop.get(el) ?? 0;
        if (r.bottom > a.bottom - margin + 0.5) push({ node: name, overflowPx: Math.ceil(r.bottom - (a.bottom - margin)), reason: 'runs past the bottom margin' });
      }
      for (const a of pick(c.avoid) ?? []) {
        const av = byName(a.node);
        if (!el || !av) continue;
        const b = rectOf(el), x = rectOf(av);
        if (intersects(b, x, a.gap ?? 0)) push({ node: c.node, overflowPx: Math.ceil(b.bottom + (a.gap ?? 0) - x.top), reason: `collides with ${a.node}` });
      }
    }
    return bad;
  }

  clearTop();

  // ---- Fit each text slot ----
  for (const [role, r] of Object.entries(rules.slots)) fitSlot(role, r);
  settleCollisions();
  sameSizeData();

  function fitSlot(role, r) {
    const el = root.querySelector(`[data-slot="${role}"][data-slot-type="text"]`);
    if (!el || !el.isConnected || report.slots[role]?.status === 'removed') return;
    // Slots sharing this block that are fitted later must not constrain this one (e.g. name + title
    // in the Name Plate): hide them while fitting, they adapt to what is left afterwards.
    const order = Object.keys(rules.slots);
    const later = order.slice(order.indexOf(role) + 1)
      .filter((k) => rules.slots[k].block && pick(rules.slots[k].block) === pick(r.block))
      .map((k) => root.querySelector(`[data-slot="${k}"][data-slot-type="text"]`)).filter(Boolean);
    later.forEach((n) => { n.dataset.prevDisplay = n.style.display; n.style.display = 'none'; });
    const base = baseline.get(role);
    const maxLines = pick(r.maxLines) ?? 1;
    // "Smaller text" (rules.shrinkTo, chosen by the requester when copy does not fit): the type may go
    // further down, to that scale, but never under 14px.
    const designMin = pick(r.minScale) ?? 0.85;
    const minScale = rules.shrinkTo ? Math.min(designMin, Math.max(rules.shrinkTo, 14 / (base?.fontSize || 14))) : designMin;
    // Containers: this slot may not make them worse than they are with its sample copy, so one long
    // slot is reported once instead of blocking every slot after it.
    const keyOf = (c) => `${c.node}|${c.reason ?? ''}`;
    const current = el.textContent;
    el.textContent = sampleText.get(role) ?? current;
    const allowed = new Map(containersOk().map((c) => [keyOf(c), c.overflowPx]));
    el.textContent = current;
    const containersFine = () => containersOk().every((c) => c.overflowPx <= (allowed.get(keyOf(c)) ?? 0) + 0.5);
    // A headline on more lines than its sample: one more at most, and only while the column still fits its
    // room (the copy under it keeps its place and its breathing room).
    const below = () => Object.entries(rules.slots).filter(([k]) => k !== role).map(([k, r2]) => [k, r2, root.querySelector(`[data-slot="${k}"][data-slot-type="text"]`)]).filter(([, , e]) => e?.isConnected && !(e.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING));
    const roomy = () => lines(el) <= (r.sampleLines ?? maxLines)
      || (lines(el) <= (r.sampleLines ?? maxLines) + 1 && !(frame?.el.isConnected && frame.el.contains(el) && usedOf(frame.el) > frame.area + 0.5)
        && below().every(([k, r2, e]) => overflow(k, r2, e) <= (baseline.get(k)?.tol ?? 0) + 0.5));
    const fits = () => overflow(role, r, el) === 0 && lines(el) <= maxLines && containersFine() && wordsWhole(el) && noOrphan(el) && roomy();
    const state = { status: 'fit', scale: 1, wrapped: false };

    // scaleGroup: every text node in that layer scales with the slot, so a headline stays one unit
    // ("Meet" shrinks together with a long first name).
    const group = r.scaleGroup
      ? [...(byName(pick(r.scaleGroup))?.querySelectorAll('div') ?? [])].filter((n) => !n.children.length && n.textContent.trim())
      : [el];
    const bases = group.map((n) => [n, parseFloat(getComputedStyle(n).fontSize), parseFloat(getComputedStyle(n).lineHeight)]);
    const setScale = (s) => {
      for (const [n, fs, lh] of bases) {
        n.style.fontSize = `${(fs * s).toFixed(2)}px`;
        n.style.lineHeight = `${Math.round(lh * s)}px`;
      }
    };
    // A text designed as a fixed-width block wraps on its own: keep the design's line breaking
    // and only scale it. Only one-line (max-content) texts are rewrapped here.
    const authored = { width: el.style.width, whiteSpace: el.style.whiteSpace, textWrap: el.style.textWrap };
    const isBlockText = !!authored.width && !/content/.test(authored.width);
    const unwrap = () => {
      // text-wrap first: white-space is a shorthand that includes it, set after so the copy's line breaks stay.
      if (isBlockText) { el.style.textWrap = authored.textWrap; el.style.whiteSpace = authored.whiteSpace; el.style.width = authored.width; }
      else { el.style.width = 'max-content'; el.style.whiteSpace = 'pre'; el.style.textWrap = ''; }
    };
    const rewrap = () => {
      if (isBlockText) return false;
      // Narrow the text by exactly the overflow so the block lands on its bounds.
      unwrap();
      const over = overflow(role, r, el);
      if (!over) return false;
      el.style.whiteSpace = 'pre-line'; // keeps the copy's own line breaks
      el.style.textWrapStyle = 'balance';
      el.style.width = `${Math.floor(el.getBoundingClientRect().width - over)}px`;
      return true;
    };
    // Plugin order: rewrap first, then reduce the type a little. Returns the state that fits, or null.
    // A group designed to wrap (Stories "Meet / Name") first tries to stay on one line, then wraps.
    const groupEl = r.scaleGroup ? byName(pick(r.scaleGroup)) : null;
    const groupWraps = groupEl && getComputedStyle(groupEl).flexWrap === 'wrap';
    const tryFit = (text) => {
      el.textContent = text;
      for (const [n] of bases) n.style.fontSize = n.style.lineHeight = '';
      for (const wrapGroup of groupWraps ? [false, true] : [null]) {
        if (groupEl && wrapGroup !== null) groupEl.style.flexWrap = wrapGroup ? 'wrap' : 'nowrap';
        for (let s = 1; s >= minScale - 1e-9; s = +(s - 0.01).toFixed(2)) {
          setScale(s);
          unwrap();
          if (fits()) return { scale: s, wrapped: false, groupWrapped: !!wrapGroup };
          // A block text that runs into a decoration (a mascot beside it) wraps short of it first.
          if (isBlockText && overflow(role, r, el) && overflow.box && /^collides/.test(overflow.reason ?? '')) {
            const left = el.getBoundingClientRect().left, w = Math.floor(overflow.box.left - 24 - left);
            if (overflow.box.left > left && w > parseFloat(authored.width) * 0.4) {
              el.style.width = `${w}px`;
              if (fits()) return { scale: s, wrapped: true, groupWrapped: !!wrapGroup };
              el.style.width = authored.width;
            }
          }
          if (maxLines > 1 && rewrap() && fits()) return { scale: s, wrapped: true, groupWrapped: !!wrapGroup };
        }
      }
      return null;
    };

    let text = el.textContent;
    let ok = tryFit(text);
    // Line breaks in the copy are a wish: where this format has fewer lines, they become spaces.
    if (!ok && /\n/.test(text)) {
      const soft = text.replace(/\s*\n\s*/g, ' ');
      const again = tryFit(soft);
      if (again) { ok = again; text = soft; } else el.textContent = text;
    } else if (ok && /\n/.test(text) && lines(el) > text.split('\n').length) {
      // A copy line that does not fit whole breaks on its own ("A Free Night / Out"): the copy's break gives
      // way when the text joined fits as big, on no more lines.
      const hard = lines(el), soft = text.replace(/\s*\n\s*/g, ' ');
      const again = tryFit(soft);
      if (again && again.scale >= ok.scale - 1e-9 && lines(el) <= hard) { ok = again; text = soft; } else ok = tryFit(text);
    }
    if (ok) { Object.assign(state, ok); if (el.textContent !== text) el.textContent = text; }
    else {
      // Longest prefix that would fit: an exact, measured length limit for this slot here.
      let lo = 0, hi = text.length - 1;
      while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); if (tryFit(text.slice(0, mid))) lo = mid; else hi = mid - 1; }
      tryFit(text); // leave the full copy at the smallest size for the preview
      const over = overflow(role, r, el);
      const reason = lines(el) > maxLines ? 'lines' : overflow.reason;
      Object.assign(state, { status: 'overflow', scale: minScale });
      report.ok = false;
      report.errors.push({
        slot: role, code: 'overflow', reason, overflowPx: over, length: text.length, maxLength: lo,
        message: lo > 0 || !r.block
          ? `"${text}" (${text.length} chars) does not fit even at ${Math.round(minScale * 100)}% size (${reason}). Keep it to ${lo} characters or fewer.`
          : `No room left for "${text}" in ${pick(r.block) ?? 'its box'} after the slots before it (${reason}). Shorten ${order.slice(0, order.indexOf(role)).filter((k) => pick(rules.slots[k].block) === pick(r.block)).join(', ') || 'the other copy'} so it fits on one line.`,
      });
    }
    later.forEach((n) => { n.style.display = n.dataset.prevDisplay; delete n.dataset.prevDisplay; });
    state.lines = lines(el);
    state.fontSize = parseFloat(getComputedStyle(el).fontSize);
    report.slots[role] = state;
  }

  // Hard rule: the event's data (location, date, time, booth) reads as one set: values designed at the
  // same size stay at the same size; one that had to shrink takes the others with it. Only the
  // secondary line under them (the venue) is smaller.
  function sameSizeData() {
    // Values the design set at the same size read as one set (city and date; venue and time): they stay
    // equal. Grouped by their designed size, so a secondary line never matches a primary one.
    const DATA = ['city', 'date', 'time', 'datetime', 'location', 'venue'];
    const groups = new Map();
    for (const role of DATA) {
      const el = root.querySelector(`[data-slot="${role}"][data-slot-type="text"]`);
      const b = baseline.get(role);
      if (!el?.isConnected || !b || report.slots[role]?.status !== 'fit') continue;
      const k = Math.round(b.fontSize);
      groups.set(k, [...(groups.get(k) ?? []), [role, el, b]]);
    }
    // Without a city line, the venue is the value of LOCATION: it joins the primary size.
    if (!root.querySelector('[data-slot="city"][data-slot-type="text"]')?.isConnected) {
      const v = [...groups.values()].flat().find(([r]) => r === 'venue'), d = [...groups.values()].flat().find(([r]) => r === 'date');
      if (v && d && Math.round(v[2].fontSize) !== Math.round(d[2].fontSize)) {
        groups.set(Math.round(v[2].fontSize), (groups.get(Math.round(v[2].fontSize)) ?? []).filter(([r]) => r !== 'venue'));
        groups.get(Math.round(d[2].fontSize)).push(v);
      }
    }
    for (const list of groups.values()) equalize(list);
  }
  function equalize(list) {
    if (list.length < 2) return;
    const sizes = list.map(([, el]) => parseFloat(getComputedStyle(el).fontSize));
    if (Math.max(...sizes) - Math.min(...sizes) < 0.5) return;
    const was = list.map(([, el]) => [el.style.fontSize, el.style.lineHeight]);
    const setAll = (fs) => { for (const [, el, b] of list) { el.style.fontSize = `${fs.toFixed(2)}px`; el.style.lineHeight = `${Math.round((b.lineHeight / b.fontSize) * fs)}px`; } };
    const spill = () => containersOk().reduce((a, c) => a + c.overflowPx, 0), before = spill();
    const linesBefore = list.map(([, el]) => lines(el));
    const okAll = () => list.every(([role, el], i) => overflow(role, rules.slots[role], el) === 0 && lines(el) <= linesBefore[i] && wordsWhole(el)) && spill() <= before + 0.5;
    let size = Math.max(...sizes);
    setAll(size);
    if (!okAll()) { size = Math.min(...sizes); setAll(size); }
    if (!okAll()) { list.forEach(([, el], i) => { el.style.fontSize = was[i][0]; el.style.lineHeight = was[i][1]; }); return; }
    for (const [role, , b] of list) Object.assign(report.slots[role], { fontSize: size, scale: +(size / b.fontSize).toFixed(2), matched: true });
  }

  // A text that ran into a decoration beside the column (copy left out above it moved it up next to a
  // mascot) gets the column moved down by just enough, when the room allows, and is fitted again.
  function settleCollisions() {
    if (!frame || !frame.el.isConnected || frame.el.style.top === '') return;
    const failed = Object.keys(rules.slots).filter((k) => report.slots[k]?.status === 'overflow' && /^collides/.test(report.errors.find((e) => e.slot === k)?.reason ?? ''));
    if (!failed.length) return;
    // First: texts above that got shorter keep their designed height, so everything below stays where
    // the designer put it (next to a sticker or a mascot). The growing headline takes that room back.
    if (holdHeights(failed)) return;
    let need = 0, inside = false;
    for (const role of failed) {
      const el = root.querySelector(`[data-slot="${role}"][data-slot-type="text"]`), base = baseline.get(role);
      if (!el || !frame.el.contains(el)) return;
      const rg = document.createRange(); rg.selectNodeContents(el);
      const tr = [...rg.getClientRects()].filter((x) => x.width > 0);
      for (const x of base.clear ?? []) {
        if (!x.isConnected) continue;
        const xr = rectOf(x);
        for (const t of tr) if (intersects(t, xr, 24)) { if (frame.el.contains(x)) inside = true; else need = Math.max(need, xr.bottom + 24 - t.top); }
      }
    }
    if (inside || !need) return;
    if (getComputedStyle(frame.el).justifyContent === 'center') need *= 2;
    // Room: an auto-height column may grow down to its area (the bottom margin); a fixed one has its height.
    if (usedOf(frame.el) + need > (frame.fixed ? frame.h : frame.area) + 0.5) return;
    const before = frame.el.style.paddingTop;
    frame.el.style.paddingTop = `${(parseFloat(getComputedStyle(frame.el).paddingTop) || 0) + Math.ceil(need)}px`;
    const errors = report.errors;
    report.errors = errors.filter((e) => !failed.includes(e.slot));
    for (const role of failed) fitSlot(role, rules.slots[role]);
    // Still not fitting: put things back as they were.
    if (failed.some((k) => report.slots[k]?.status === 'overflow') || containersOk().length) {
      frame.el.style.paddingTop = before;
      report.errors = errors;
      for (const role of failed) fitSlot(role, rules.slots[role]);
      report.errors = errors;
      report.ok = false;
      return;
    }
    report.clearedTop = (report.clearedTop ?? 0) + Math.ceil(need);
    report.ok = report.errors.length === 0;
  }

  function holdHeights(failed) {
    const firstTop = Math.min(...failed.map((k) => rectOf(root.querySelector(`[data-slot="${k}"][data-slot-type="text"]`)).top));
    const held = [];
    for (const [k, b] of baseline) {
      const el = root.querySelector(`[data-slot="${k}"][data-slot-type="text"]`);
      if (!el?.isConnected || !frame.el.contains(el) || failed.includes(k) || rectOf(el).top >= firstTop) continue;
      // The copy sits at the bottom of its designed room: the air goes above it, not in the middle.
      if (rectOf(el).height < b.height - 1) { held.push([el, el.style.minHeight, el.style.alignContent]); el.style.minHeight = `${Math.round(b.height)}px`; el.style.alignContent = 'end'; }
    }
    if (!held.length) return false;
    const errors = report.errors;
    report.errors = errors.filter((e) => !failed.includes(e.slot));
    for (const role of failed) fitSlot(role, rules.slots[role]);
    if (failed.some((k) => report.slots[k]?.status === 'overflow')) {
      for (const [el, v, a] of held) { el.style.minHeight = v; el.style.alignContent = a; }
      report.errors = errors;
      for (const role of failed) fitSlot(role, rules.slots[role]);
      report.errors = errors;
      report.ok = false;
      return false;
    }
    report.held = held.map(([el]) => el.dataset.slot);
    report.ok = report.errors.length === 0;
    return true;
  }

  balance();
  keepLinesTidy();
  clearIllustrations();
  centerLoneLogo();
  breathe();

  for (const c of containersOk()) {
    report.ok = false;
    report.errors.push({ code: 'container_overflow', ...c, message: `${c.node} ${c.reason ?? 'overflows'} by ${c.overflowPx}px. Shorten the longest slot inside it.` });
  }
  if (report.errors.length) report.ok = false;
  return report;

  // A detail left out at the top of the column (a kicker pill) pulls the copy up into a decoration it
  // stayed clear of in the design (a mascot in the corner). The column starts lower instead, by just
  // enough, when its footprint has the room.
  function clearTop() {
    if (!frame || !frame.el.isConnected || frame.el.style.top === '') return;
    let need = 0;
    // The column's first text as designed: only what sat above it (a corner mascot) counts.
    const tops = [...baseline].filter(([k]) => frame.el.contains(root.querySelector(`[data-slot="${k}"][data-slot-type="text"]`) ?? root)).map(([, b]) => b.top);
    const columnTop = tops.length ? Math.min(...tops) : -Infinity;
    for (const [role] of Object.entries(rules.slots)) {
      const el = root.querySelector(`[data-slot="${role}"][data-slot-type="text"]`);
      const base = baseline.get(role);
      if (!el?.isConnected || !frame.el.contains(el) || !base?.clear?.length) continue;
      const rg = document.createRange(); rg.selectNodeContents(el);
      const tr = [...rg.getClientRects()].filter((x) => x.width > 0);
      for (const x of base.clear) {
        if (!x.isConnected || frame.el.contains(x)) continue;
        const xr = rectOf(x);
        // Only a decoration that sat above the whole column in the design (not one beside it).
        if (xr.bottom > columnTop + 1) continue;
        for (const t of tr) if (intersects(t, xr, 24)) need = Math.max(need, xr.bottom + 24 - t.top);
      }
    }
    if (!need || usedOf(frame.el) + need > frame.h + 0.5) return;
    // A centred column moves half of what is added on top.
    if (getComputedStyle(frame.el).justifyContent === 'center') need *= 2;
    if (usedOf(frame.el) + need > frame.h + 0.5) return;
    frame.el.style.paddingTop = `${(parseFloat(getComputedStyle(frame.el).paddingTop) || 0) + Math.ceil(need)}px`;
    report.clearedTop = Math.ceil(need);
  }

  // ---- Fill the footprint ----
  // Copy shorter than the sample (or a detail left out) leaves the Content column short and a hole at
  // the bottom. The design should still look full: the lead text grows (up to 125% of its design size,
  // within its lines, width and margins) until the column reaches its footprint; whatever is left goes
  // above the footer (the logo lockup, the CTA), which sits at the bottom where the designer put it.
  // Frames with a fixed height already spread their content (space-between), so they only grow.
  function balance() {
    if (!frame || rules.fill === false || !frame.el.isConnected) return;
    const opts = rules.fill && typeof rules.fill === 'object' ? rules.fill : {};
    const box = frame.el;
    const flow = () => flowOf(box);
    const used = () => usedOf(box);
    const target = frame.area;
    const info = { footprint: Math.round(target), before: Math.round(used()) };
    report.fill = info;
    // What the content fills once drawn, for the Inspector (a hand edit that empties it is flagged).
    const mark = () => { box.dataset.filled = String(Math.round(used())); };
    mark();
    // A fixed-height frame that spreads its content (space-between) is already full.
    // Only when the copy left the column shorter than the designer's own composition: the sample (or
    // copy as long) stays exactly as designed.
    // A frame that spreads its content (space-between) keeps its own spacing: there only the lead grows.
    const spreads = frame.fixed && /space-/.test(getComputedStyle(box).justifyContent);
    const room = spreads ? frame.h : target;
    // Copy much shorter than the sample (a short headline) is room to use even when the column is full.
    const anyShort = Object.keys(rules.slots).some((role) => {
      const el = root.querySelector(`[data-slot="${role}"][data-slot-type="text"]`);
      return el?.isConnected && box.contains(el) && el.textContent.length < (sampleText.get(role)?.length ?? 0) * 0.6 && parseFloat(getComputedStyle(el).fontSize) >= 48;
    });
    if (!target || (!anyShort && (info.before >= frame.used * 0.95 || (!spreads && info.before >= target * 0.95)))) return;
    box.dataset.footprint = String(Math.round(target));

    // 0. Lots of room: a mascot bleeding off the top may grow (from its top centre) and the column
    // steps down to stay clear of it (Template review: "agranda la cara de la mascota").
    if (info.before < room * 0.8 && !spreads) {
      const mascot = [...root.querySelectorAll('svg[data-name^="Mascot"]')].find((m) => getComputedStyle(m).position === 'absolute' && rectOf(m).top < rectOf(root).top + 20 && !box.contains(m));
      if (mascot) {
        const first = flow()[0];
        const clearOf = () => rectOf(first).top - rectOf(mascot).bottom;
        mascot.style.transformOrigin = '50% 0%';
        let k = 1.3;
        for (; k > 1.02; k = +(k - 0.04).toFixed(2)) {
          mascot.style.scale = String(k);
          const need = Math.max(0, 40 - clearOf());
          if (used() + need <= target + 0.5) { if (need) box.style.paddingTop = `${(parseFloat(getComputedStyle(box).paddingTop) || 0) + Math.ceil(need)}px`; break; }
        }
        if (k <= 1.02) mascot.style.scale = '';
        else info.mascot = k;
      }
    }

    // 1. The lead text grows: the slot named in rules.fill, else the largest text in the column.
    const texts = Object.keys(rules.slots)
      .map((role) => ({ role, el: root.querySelector(`[data-slot="${role}"][data-slot-type="text"]`) }))
      .filter((x) => x.el?.isConnected && box.contains(x.el) && report.slots[x.role]?.status === 'fit' && !rules.slots[x.role].scaleGroup);
    const lead = texts.find((x) => x.role === pick(opts.slot)) ?? texts.sort((a, b) => parseFloat(getComputedStyle(b.el).fontSize) - parseFloat(getComputedStyle(a.el).fontSize))[0];
    if (lead) {
      const r = rules.slots[lead.role], st = report.slots[lead.role], base = baseline.get(lead.role);
      // Copy much shorter than the design's sample: the column's gaps were made for more text. They may
      // close a little (to 70%) so the lead can grow instead of floating in air.
      const shortCopy = (lead.el.textContent.length) < (sampleText.get(lead.role)?.length ?? 0) * 0.6;
      const gap0 = parseFloat(getComputedStyle(box).rowGap) || 0;
      if (shortCopy && gap0 > 24 && !spreads) { box.style.rowGap = `${Math.round(gap0 * 0.7)}px`; info.tightened = Math.round(gap0 * 0.7); }
      // Little information, lots of room (a short line on a Stories, a speaker with no details): the lead
      // may grow well past its design size and take more lines; otherwise a little, on its own lines.
      const sparse = info.before < room * 0.72 || shortCopy;
      const verySparse = info.before < room * 0.55 || (shortCopy && lead.el.textContent.replace(/\s/g, '').length <= 14);
      const maxScale = pick(opts.maxScale) ?? (verySparse ? 2.4 : sparse ? 1.8 : 1.25);
      // Growing may take one more line than it has now (a headline's own limit is its room), never more.
      const maxLines = sparse ? Math.max(lines(lead.el), Math.min(pick(r.maxLines) ?? 1, lines(lead.el) + 1), 2) : lines(lead.el);
      // Nothing else may get worse: every other text keeps fitting, no frame overflows more.
      const others = Object.keys(rules.slots).filter((k) => k !== lead.role && report.slots[k]?.status === 'fit')
        .map((k) => [k, root.querySelector(`[data-slot="${k}"][data-slot-type="text"]`)]).filter(([, n]) => n?.isConnected);
      const spill = () => containersOk().reduce((a, c) => a + c.overflowPx, 0);
      const before = spill();
      const othersFit = () => others.every(([k, n]) => overflow(k, rules.slots[k], n) === 0);
      const had = maxLines;
      // …and never into a badge, mascot or sticker it was clear of (24px apart).
      const textBoxes = () => { const rg = document.createRange(); rg.selectNodeContents(lead.el); return [...rg.getClientRects()].filter((x) => x.width > 0); };
      const near = (xs) => xs.filter((x) => { const xr = rectOf(x); return textBoxes().some((t) => intersects(t, xr, 24)); });
      // Background-sized decorations (a star field, a swoosh across the piece) are ground, not neighbours.
      const RA = rectOf(root).width * rectOf(root).height;
      const loose = [...root.querySelectorAll('[data-node]')].filter((x) => {
        if (x === root || x.contains(lead.el) || lead.el.contains(x) || getComputedStyle(x).position !== 'absolute') return false;
        const xr = rectOf(x); return xr.width > 2 && xr.height > 2 && xr.width * xr.height < RA * 0.25;
      });
      const apart = loose.filter((x) => !near([x]).length);
      // Those it was already close to: it may not get any closer (overlap with a 24px halo can't grow).
      // Distance from the copy's glyphs to it (0 when they touch).
      const halo = (x) => { const xr = rectOf(x); return Math.min(...textBoxes().map((t) => Math.hypot(Math.max(0, xr.left - t.right, t.left - xr.right), Math.max(0, xr.top - t.bottom, t.top - xr.bottom)))); };
      const close = loose.filter((x) => !apart.includes(x)).map((x) => [x, halo(x)]);
      const sh0 = box.scrollHeight - box.clientHeight;
      // A headline in parts (headline-1, headline-2) grows as one: every part by the same ratio.
      const parts = /^headline-\d$/.test(lead.role)
        ? texts.filter((x) => /^headline-\d$/.test(x.role)).map((x) => [x.el, baseline.get(x.role), x.role, parseFloat(getComputedStyle(x.el).fontSize) / baseline.get(x.role).fontSize])
        : [[lead.el, base, lead.role, st.scale]];
      // A headline grown big reads as one block: its leading closes in (to about the type size).
      const lhAt = (b, kk) => { const lh = b.lineHeight * kk, fs = b.fontSize * kk; return kk > 1.2 ? Math.min(lh, fs * (kk > 1.6 ? 0.98 : 1.02)) : lh; };
      const at = (k) => { for (const [el, b, , s0] of parts) { const kk = (k / st.scale) * s0; el.style.fontSize = `${(b.fontSize * kk).toFixed(2)}px`; el.style.lineHeight = `${Math.round(lhAt(b, kk))}px`; } };
      const partsOk = () => parts.every(([el, , role]) => el === lead.el || (overflow(role, rules.slots[role], el) === 0 && wordsWhole(el) && noOrphan(el)));
      const ok = () => partsOk() && overflow(lead.role, r, lead.el) === 0 && wordsWhole(lead.el) && noOrphan(lead.el) && lines(lead.el) <= had && spill() <= before + 0.5 && othersFit() && (spreads ? box.scrollHeight - box.clientHeight <= Math.max(1, sh0) + 1 : used() <= target + 0.5) && !near(apart).length && close.every(([x, h0]) => halo(x) >= Math.min(h0, 24) - 1);
      // A one-line text (max-content) can only grow wider; with lots of room it may wrap instead.
      const authored = { width: lead.el.style.width, whiteSpace: lead.el.style.whiteSpace, textWrap: lead.el.style.textWrap };
      const oneLine = !authored.width || /content/.test(authored.width);
      // It wraps short of a decoration beside it (the cocktail glass), never into it.
      const wrapIn = () => {
        const L = rectOf(lead.el).left, T = rectOf(lead.el).top;
        let w = rectOf(box).right - L;
        for (const x of apart) {
          const xr = rectOf(x);
          if (xr.left > L + w * 0.4 && xr.left < L + w && xr.bottom > T - 24 && xr.top < T + rectOf(box).height * 0.5) w = Math.min(w, xr.left - 24 - L);
        }
        lead.el.style.width = `${Math.floor(w)}px`; lead.el.style.whiteSpace = 'pre-line'; lead.el.style.textWrapStyle = 'balance';
      };
      const unwrap = () => { lead.el.style.textWrap = authored.textWrap; lead.el.style.whiteSpace = authored.whiteSpace; lead.el.style.width = authored.width; };
      let best = st.scale;
      for (let k = maxScale; k > st.scale + 0.005; k = +(k - 0.01).toFixed(2)) { at(k); if (ok()) { best = k; break; } }
      // Growing wide stopped early (a decoration beside it): wrapping may let it grow much more.
      if (best < maxScale * 0.85 && sparse && maxLines > 1 && (oneLine || apart.length)) {
        wrapIn();
        let wrapped = st.scale;
        for (let k = maxScale; k > best + 0.005; k = +(k - 0.01).toFixed(2)) { at(k); if (ok()) { wrapped = k; break; } }
        if (wrapped > best + 0.05) best = wrapped; else unwrap();
      }
      at(best);
      if (best > st.scale) {
        Object.assign(st, { scale: best, grown: true, lines: lines(lead.el), fontSize: parseFloat(getComputedStyle(lead.el).fontSize) });
        info.grew = { slot: lead.role, scale: best };
      }
    }
    // 1b. Still a lot of room: the event's data (location, date, time) and the subhead grow, together.
    if (spreads || used() < target * 0.82) {
      const data = ['city', 'date', 'time', 'datetime', 'venue', 'location', 'subhead']
        .map((role) => [role, root.querySelector(`[data-slot="${role}"][data-slot-type="text"]`), baseline.get(role)])
        .filter(([role, el, b]) => el?.isConnected && box.contains(el) && b && report.slots[role]?.status === 'fit');
      if (data.length) {
        const sizes = data.map(([, el]) => [parseFloat(getComputedStyle(el).fontSize), parseFloat(getComputedStyle(el).lineHeight)]);
        const linesBefore = data.map(([, el]) => lines(el));
        const spill = () => containersOk().reduce((a, c) => a + c.overflowPx, 0), was = spill();
        const set = (k) => data.forEach(([, el], i) => { el.style.fontSize = `${(sizes[i][0] * k).toFixed(2)}px`; el.style.lineHeight = `${Math.round(sizes[i][1] * k)}px`; });
        const sh1 = box.scrollHeight - box.clientHeight;
        const ok = () => data.every(([role, el], i) => overflow(role, rules.slots[role], el) === 0 && lines(el) <= linesBefore[i] && wordsWhole(el)) && spill() <= was + 0.5 && (spreads ? box.scrollHeight - box.clientHeight <= Math.max(1, sh1) + 1 : used() <= target + 0.5);
        let best = 1;
        for (let k = 1.3; k > 1.005; k = +(k - 0.02).toFixed(2)) { set(k); if (ok()) { best = k; break; } }
        set(best);
        if (best > 1) info.data = best;
        sameSizeData();
      }
    }
    if (spreads) { info.after = Math.round(used()); mark(); return; }

    // 2. Some of what is still free opens the column's rhythm (its gap, up to 1.5×), the rest goes above
    // the footer, which sits at the bottom of the area.
    const kids = flow();
    const gap = parseFloat(getComputedStyle(box).rowGap) || 0;
    if (gap && kids.length > 2) {
      const extra = Math.min(gap * 0.5, ((target - used()) * 0.35) / (kids.length - 1));
      const spill = () => containersOk().reduce((a, c) => a + c.overflowPx, 0), was = spill();
      const fitting = Object.keys(rules.slots).filter((k) => report.slots[k]?.status === 'fit')
        .map((k) => [k, root.querySelector(`[data-slot="${k}"][data-slot-type="text"]`)]).filter(([, n]) => n?.isConnected);
      if (extra > 1) {
        const authored = box.style.rowGap;
        box.style.rowGap = `${Math.round(gap + extra)}px`;
        if (spill() > was + 0.5 || fitting.some(([k, n]) => overflow(k, rules.slots[k], n) > 0)) box.style.rowGap = authored || `${gap}px`;
        else info.gap = Math.round(gap + extra);
      }
    }
    const foot = kids.length > 1 ? kids[kids.length - 1] : null;
    const isFooter = foot && (/Logo|Lockup|Footer|CTA|Button/i.test(foot.dataset.name ?? '') || foot.querySelector('[data-name^="Logo Archy"], [data-name^="Archy Wordmark"]'));
    // (A fixed-height frame that spreads its content already has its footer at the bottom.)
    const spread = /space-/.test(getComputedStyle(box).justifyContent);
    if (!spread && isFooter && used() < target - 1) {
      const free = target - used();
      if (!frame.fixed) box.style.minHeight = `${Math.round(target)}px`;
      if (free > target * 0.14) {
        // A lot of air left: content and footer stay one group, set a little above the middle of the
        // room (no hole between the copy and the logo; Template review).
        const g = parseFloat(getComputedStyle(box).rowGap) || 0;
        const extraGap = Math.min(free * 0.25, g * 0.8);
        foot.style.marginTop = `${Math.round(extraGap)}px`;
        box.style.paddingTop = `${(parseFloat(getComputedStyle(box).paddingTop) || 0) + Math.round((free - extraGap) * 0.5)}px`;
        info.grouped = true;
      } else {
        foot.style.marginTop = 'auto';
      }
      info.footer = foot.dataset.name;
    }

    info.after = Math.round(used());
    mark();
    return;
  }

  // Hard rule: an illustration (a cocktail glass, a mascot) never touches copy, and stars never sit under
  // it. A text that runs into one wraps short of it (24px clear), then shrinks a little if it must.
  function clearIllustrations() {
    const textsAll = [...root.querySelectorAll('[data-slot-type="text"]')].filter((t) => t.isConnected);
    const glyphs = (el) => { const rg = document.createRange(); rg.selectNodeContents(el); return [...rg.getClientRects()].filter((x) => x.width > 0); };
    // Sparkles: the old `Stars` sheet (one SVG of paths) or loose `Star` layers, one SVG each.
    for (const star of root.querySelectorAll('svg[data-name^="Stars"] path, svg[data-name^="Stars"] > *, svg[data-name="Star"]')) {
      const b = star.getBoundingClientRect();
      if (b.width > 60) continue;
      if (textsAll.some((t) => glyphs(t).some((g) => intersects(g, b, 10)))) star.style.display = 'none';
    }
    const R = rectOf(root), RA = R.width * R.height;
    const art = [...root.querySelectorAll('[data-name^="Cocktail"], [data-name^="Illustration"], [data-optional="illustration"]')];
    const leaves = art.flatMap((a) => [...a.querySelectorAll('svg, [data-slot-type="image"]')].filter((s0) => { const b = s0.getBoundingClientRect(); return !isStar(s0) && b.width > 4 && b.width * b.height < RA * 0.2; }));
    if (!leaves.length) return;
    for (const t of textsAll) {
      const role = t.dataset.slot, rr = rules.slots[role];
      if (!rr) continue;
      // 16px clear, or as close as the design itself puts this text to that part (never stricter).
      const need = (l) => Math.min(16, artGaps.get(t)?.get(l) ?? Infinity);
      const hitting = () => leaves.filter((l) => glyphs(t).some((g) => gapBetween(g, l.getBoundingClientRect()) < need(l)));
      let hits = hitting();
      if (!hits.length) continue;
      const L = rectOf(t).left, had = lines(t);
      const edge = Math.min(...hits.map((l) => l.getBoundingClientRect().left));
      const w = Math.floor(edge - 24 - L);
      if (w > rectOf(t).width * 0.45) {
        t.style.width = `${w}px`;
        if (/^(normal|nowrap|pre)$/.test(getComputedStyle(t).whiteSpace)) t.style.whiteSpace = 'pre-line';
      }
      const fs0 = parseFloat(getComputedStyle(t).fontSize), lh0 = parseFloat(getComputedStyle(t).lineHeight);
      for (let k = 1; hitting().length && k > 0.8; k = +(k - 0.04).toFixed(2)) { t.style.fontSize = `${(fs0 * k).toFixed(2)}px`; t.style.lineHeight = `${Math.round(lh0 * k)}px`; }
      // Wrapping short of the art does not add lines: the copy's own line break gives way first (it would
      // leave a word alone, "A Free Night / Out"), then a little less size (down to 85%).
      const text = t.textContent, soft = text.replace(/\s*\n\s*/g, ' ');
      if (lines(t) > had && soft !== text) { t.textContent = soft; if (lines(t) > had) t.textContent = text; }
      for (let k = parseFloat(getComputedStyle(t).fontSize) / fs0; lines(t) > had && k > 0.85; k = +(k - 0.01).toFixed(2)) { t.style.fontSize = `${(fs0 * (k - 0.01)).toFixed(2)}px`; t.style.lineHeight = `${Math.round(lh0 * (k - 0.01))}px`; }
      if (report.slots[role]) Object.assign(report.slots[role], { lines: lines(t), fontSize: parseFloat(getComputedStyle(t).fontSize) });
      hits = hitting();
      report.illustrationCleared = [...(report.illustrationCleared ?? []), role + (hits.length ? ':still' : '')];
    }
  }

  // Guide: a line does not end on a short word that belongs to the next one ("…apps at / Topgolf",
  // "…Night Out For / Las Vegas"): the word moves down when the text keeps its line count.
  function keepLinesTidy() {
    const SHORT = /^(at|for|in|on|of|to|a|an|the|and|&|with|by|from)$/i;
    for (const role of Object.keys(rules.slots)) {
      const el = root.querySelector(`[data-slot="${role}"][data-slot-type="text"]`);
      if (!el?.isConnected || report.slots[role]?.status !== 'fit' || el.children.length) continue;
      // Headlines keep the designer's breaks ("Meet Archy at / Yankee…" reads well): only secondary copy.
      if (/headline/.test(role)) continue;
      const n0 = lines(el);
      if (n0 < 2) continue;
      if (/^(normal|nowrap)$/.test(getComputedStyle(el).whiteSpace)) continue;
      for (let pass = 0; pass < 3; pass++) {
        const node = el.firstChild;
        if (!node || node.nodeType !== 3) break;
        const words = [...node.textContent.matchAll(/\S+/g)];
        const tops = words.map((m) => { const rg = document.createRange(); rg.setStart(node, m.index); rg.setEnd(node, m.index + m[0].length); return Math.round((rg.getClientRects()[0]?.top ?? 0) / 4); });
        // The words that end a line: moving a word down may only change the line it leaves.
        const endings = () => { const n1 = el.firstChild; const ws = [...n1.textContent.matchAll(/\S+/g)]; const tp = ws.map((m) => { const rg = document.createRange(); rg.setStart(n1, m.index); rg.setEnd(n1, m.index + m[0].length); return Math.round((rg.getClientRects()[0]?.top ?? 0) / 4); }); return ws.filter((_, k) => k < ws.length - 1 && tp[k] !== tp[k + 1]).map((m) => m[0]); };
        const ends0 = endings();
        let moved = false;
        for (let i = 0; i < words.length - 1; i++) {
          if (tops[i] !== tops[i + 1] && SHORT.test(words[i][0]) && i > 0 && tops[i - 1] === tops[i]) {
            const before = node.textContent;
            const at = words[i].index;
            const sp = before.slice(0, at).replace(/[ \t]+$/, '');
            node.textContent = `${sp}\n${before.slice(at)}`;
            const allowed = new Set([...ends0.filter((w) => w !== words[i][0]), words[i - 1][0]]);
            if (lines(el) > n0 || overflow(role, rules.slots[role], el) > 0 || endings().some((w) => !allowed.has(w))) { node.textContent = before; continue; }
            moved = true;
            report.tidied = [...(report.tidied ?? []), `${role}:${words[i][0]}`];
            break;
          }
        }
        if (!moved) break;
      }
    }
  }

  // A lockup left with only the Archy logo (no partner, no offer) in a centred column: the logo centres.
  function centerLoneLogo() {
    for (const lockup of root.querySelectorAll('[data-name^="Logo Lockup"]')) {
      const visible = [...lockup.children].filter((c) => getComputedStyle(c).display !== 'none' && c.getBoundingClientRect().width > 4 && (c.querySelector('svg, [data-logo-mark]') || c.matches('svg')));
      const column = lockup.parentElement;
      if (visible.length === 1 && getComputedStyle(column).alignItems === 'center') { lockup.style.justifyContent = 'center'; report.loneLogo = true; }
    }
  }

  // Booth stickers: the number grows when it is short and the sticker has room, and the sticker keeps
  // 24px from the copy (it moves into free space, or shrinks a little).
  function breathe() {
    for (const svg of root.querySelectorAll('svg[data-name^="RIBBON"]')) {
      const sticker = svg.closest('[data-optional="booth"]') ?? svg.parentElement;
      const num = sticker.querySelector('[data-slot="booth"][data-slot-type="text"]');
      // A short number (two or three digits) fills the sticker: up to 60% larger, as wide as it allows.
      if (num && num.textContent.replace(/\W/g, '').length <= 4) {
        const info0 = num.parentElement, fs = parseFloat(getComputedStyle(num).fontSize);
        const roomW = rectOf(svg).width * 0.62;
        const inkW = () => { const rg = document.createRange(); rg.selectNodeContents(num); return [...rg.getClientRects()].reduce((a, x) => a + x.width, 0); };
        for (let k = 1.6; k > 1.005; k = +(k - 0.04).toFixed(2)) {
          num.style.fontSize = `${(fs * k).toFixed(2)}px`;
          if (inkW() <= roomW) { report.boothGrew = k; break; }
          num.style.fontSize = `${fs}px`;
        }
        void info0;
      }
      // It never sits on the copy: 40px clear of every text; it moves down into free space, else shrinks.
      const texts = [...root.querySelectorAll('[data-slot-type="text"]')].filter((t) => t.isConnected && !sticker.contains(t));
      // 40px, or what the design itself leaves (a text it overlaps in Paper only must not get closer).
      const gaps = designGaps.get(svg) ?? new Map();
      const need = (t) => { const g = gaps.get(t) ?? Infinity; return g >= 40 ? 40 : g; };
      const hit = () => texts.some((t) => { const rg = document.createRange(); rg.selectNodeContents(t); return [...rg.getClientRects()].some((x) => x.width > 0 && gapBetween(x, rectOf(svg)) < need(t)); });
      const R = rectOf(root);
      const fits = () => rectOf(svg).bottom < R.bottom - 24 && !hit();
      if (hit()) {
        let placed = false;
        for (const dy of [24, 48, 72, 96, 120]) {
          shiftBy(sticker, 0, dy);
          if (fits()) { report.badgeMoved = dy; placed = true; break; }
        }
        if (!placed) shiftBy(sticker, 0, 0);
        if (!placed) {
          // Smaller, and moved if that helps; else the least overlap it can get.
          const overlap = () => texts.reduce((a, t) => { const rg = document.createRange(); rg.selectNodeContents(t); return a + [...rg.getClientRects()].reduce((b, x) => { const v = rectOf(svg); const g = Math.max(0, need(t)); return b + (gapBetween(x, v) < need(t) ? Math.max(0, Math.min(x.right, v.right + g) - Math.max(x.left, v.left - g)) * Math.max(0, Math.min(x.bottom, v.bottom + g) - Math.max(x.top, v.top - g)) : 0); }, 0); }, 0);
          shiftBy(sticker, 0, 0);
          const w0 = rectOf(svg).width, h0 = rectOf(svg).height;
          let best = { o: overlap(), k: 1, dx: 0, dy: 0 };
          // Shrinking keeps its bottom-right corner (it gives way to the copy above and to the left).
          outer: for (const k of [1, 0.92, 0.85, 0.78, 0.72]) for (const dy of [0, 24, 48, 72, 96, 120, 160, 200]) for (const dx of [0, 24, 48]) {
            const tx = dx + (1 - k) * w0, ty = dy + (1 - k) * h0;
            sticker.style.scale = k === 1 ? '' : String(k); shiftBy(sticker, Math.round(tx), Math.round(ty));
            const v = rectOf(svg);
            if (v.bottom > R.bottom - 24 || v.right > R.right - 8) continue;
            const o = overlap();
            if (o < best.o - 1) best = { o, k, dx: tx, dy: ty };
            if (!o) break outer;
          }
          sticker.style.scale = best.k === 1 ? '' : String(best.k);
          shiftBy(sticker, Math.round(best.dx), Math.round(best.dy));
          report.badgeShrunk = best;
        }
        continue;
      }
      // Free room under it (a countdown with short copy): it comes down toward the copy, 48px above it.
      const below = texts.map((t) => rectOf(t)).filter((b) => b.top > rectOf(svg).bottom && b.left < rectOf(svg).right && b.right > rectOf(svg).left).map((b) => b.top);
      const firstBelow = below.length ? Math.min(...below) : null;
      if (firstBelow != null) {
        const room = firstBelow - 48 - rectOf(svg).bottom;
        const dy = Math.min(room, rectOf(svg).height * 0.7);
        if (dy > 12) { shiftBy(sticker, 0, Math.round(dy)); if (!fits()) shiftBy(sticker, 0, 0); else report.badgeMoved = Math.round(dy); }
      }
    }
  }
};

// Calibration: characters per line that fit at the design size, using the slot's own default copy
// as the glyph-width sample (it reflects real casing and weight).
window.__calibrate = function calibrate({ format, formats, rules }) {
  const root = document.querySelector('body > [data-node]');
  rules = withDefaults(root, rules);
  const byName = (name) => (name === '@artboard' ? root : root.querySelector(`[data-name^="${CSS.escape(name)}"]`));
  const pick = (v) => (v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).every((k) => formats.includes(k)) ? v[format] : v);
  const out = {};
  for (const [role, r] of Object.entries(rules.slots)) {
    const el = root.querySelector(`[data-slot="${role}"][data-slot-type="text"]`);
    if (!el) continue;
    const block = r.block ? byName(pick(r.block)) : el;
    const w = byName(pick(r.within) ?? '@artboard').getBoundingClientRect();
    const b = block.getBoundingClientRect();
    const t = el.getBoundingClientRect();
    const anchoredRight = block.style.right !== '' && block.style.left === '';
    const inset = pick(r.inset) ?? (getComputedStyle(block).position !== 'absolute' ? 0 : anchoredRight ? w.right - b.right : b.left - w.left);
    // Room the text itself can take = its width + free space up to the bounds.
    // Absolutely placed blocks grow away from their anchor; in-flow blocks (centred or not) can take
    // the whole bounds minus the margins.
    const absolute = getComputedStyle(block).position === 'absolute';
    const free = anchoredRight ? b.left - (w.left + inset) : (w.right - inset) - b.right;
    // Measure the glyphs, not the box: a fixed-width block is wider than its text.
    const range = document.createRange();
    range.selectNodeContents(el);
    const rects = [...range.getClientRects()].filter((r) => r.width > 0);
    const textW = rects.reduce((a, r) => a + r.width, 0);
    const lineW = Math.max(...rects.map((r) => r.width));
    const isBlock = !!el.style.width && !/content/.test(el.style.width);
    const room = Math.max(lineW, isBlock ? t.width : absolute ? t.width + free : (w.width - 2 * inset) - (b.width - t.width));
    const avg = textW / el.textContent.replace(/\n/g, '').length;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    out[role] = {
      maxCharsPerLine: Math.floor(room / avg),
      maxLines: pick(r.maxLines) ?? 1,
      fontSize: { max: fs, min: Math.round(fs * (pick(r.minScale) ?? 0.85)) },
      roomPx: Math.floor(room),
    };
  }
  return out;
};

// Default rules for slots the template's rules.json does not cover: stay inside the nearest
// "Content" frame (else the artboard), keep the sample's line count, shrink at most to 85%;
// the outer Content frame must not overflow nor run past its mirrored bottom margin.
const HEADLINE_LINES = 6;
function withDefaults(root, rules) {
  const lines = (el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    return new Set([...range.getClientRects()].filter((r) => r.width > 0).map((r) => Math.round(r.top))).size;
  };
  rules = { ...rules, slots: { ...rules.slots } };
  for (const el of root.querySelectorAll('[data-slot][data-slot-type="text"]')) {
    const role = el.dataset.slot;
    // A rules.json entry that only adds an option (drop, maxScale…) keeps the defaults under it.
    if (rules.slots[role] && (rules.slots[role].within || rules.slots[role].block)) continue;
    // The box that really holds it: the nearest ancestor with a fixed width (a badge, a pill, a column),
    // else the Content frame, else the artboard.
    let box = el.parentElement;
    while (box && box !== root && !/^\d+(\.\d+)?px$/.test(box.style.width)) box = box.parentElement;
    const content = el.parentElement.closest('[data-name="Content"]');
    // The headline is not held to the sample's line count: it stays as big as it can and takes the lines
    // its room allows (three big lines read better than two small ones). Its room still limits it.
    const maxLines = role === 'headline' ? HEADLINE_LINES : Math.max(1, lines(el));
    rules.slots[role] = { within: box && box !== root ? box : content ?? '@artboard', maxLines, sampleLines: Math.max(1, lines(el)), minScale: 0.85, auto: true, ...rules.slots[role] };
  }
  if (!rules.containers) {
    const outer = [...root.children].find((c) => c.dataset.name === 'Content');
    rules.containers = outer ? [{ node: outer, mirror: true }] : [];
  }
  return rules;
}

// Ink of an image: bounding box of its visible pixels (alpha > 10%) and how much of that box is ink.
// A partner mark drawn in one colour (its shape as a mask) or in its own colours.
function logoMode(el, mode) {
  const d = el.dataset, s = el.style;
  const original = mode === 'original';
  s.backgroundColor = original ? 'transparent' : d.logoColor;
  s.backgroundImage = original ? `url("${d.logoSrc}")` : '';
  s.backgroundRepeat = original ? 'no-repeat' : '';
  s.backgroundPosition = original ? d.logoPos : '';
  s.backgroundSize = original ? d.logoSize : '';
  for (const pre of ['', '-webkit-']) {
    s.setProperty(`${pre}mask-image`, original ? '' : `url("${d.logoSrc}")`);
    s.setProperty(`${pre}mask-repeat`, original ? '' : 'no-repeat');
    s.setProperty(`${pre}mask-position`, original ? '' : d.logoPos);
    s.setProperty(`${pre}mask-size`, original ? '' : d.logoSize);
  }
}
window.__logoMode = logoMode;

async function inkStats(src) {
  const img = new Image();
  img.src = src;
  try { await img.decode(); } catch { return null; }
  let nw = img.naturalWidth, nh = img.naturalHeight;
  if (!nw || !nh) { nw = 600; nh = 200; } // SVG without intrinsic size
  const scale = Math.min(1, 1600 / Math.max(nw, nh));
  const cw = Math.max(1, Math.round(nw * scale)), ch = Math.max(1, Math.round(nh * scale));
  const cv = document.createElement('canvas');
  cv.width = cw; cv.height = ch;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, cw, ch);
  const { data } = ctx.getImageData(0, 0, cw, ch);
  let x0 = cw, y0 = ch, x1 = -1, y1 = -1, ink = 0, solid = 0;
  const hues = new Map(); // solid pixels by colour (8 levels a channel)
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const i = (y * cw + x) * 4, a = data[i + 3];
    if (a > 25) { ink += a / 255; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (a > 200) { solid++; const c = ((data[i] >> 5) << 6) | ((data[i + 1] >> 5) << 3) | (data[i + 2] >> 5); hues.set(c, (hues.get(c) ?? 0) + 1); }
  }
  if (x1 < 0) return null;
  const bw = (x1 - x0 + 1) / scale, bh = (y1 - y0 + 1) / scale;
  // Several colours that each take a real share (not the soft edges of one): a mark in colour.
  const colourful = [...hues.values()].filter((n) => n > solid * 0.06).length > 1;
  // Hardly any transparency: the logo sits on its own ground (a badge, a JPG, a photo).
  const opaque = solid > cw * ch * 0.97;
  return { nw, nh, bx: x0 / scale, by: y0 / scale, bw, bh, density: ink / ((x1 - x0 + 1) * (y1 - y0 + 1)), colourful, opaque };
}

// Ink of the template's own sample mark, at the size it is drawn on the piece.
async function sampleInk(frame) {
  const svg = frame.tagName.toLowerCase() === 'svg' ? frame : frame.querySelector('svg');
  if (!svg) return null;
  const r = svg.getBoundingClientRect();
  if (!r.width || !r.height) return null;
  const clone = svg.cloneNode(true);
  clone.setAttribute('width', r.width * 2);
  clone.setAttribute('height', r.height * 2);
  clone.removeAttribute('style');
  for (const el of clone.querySelectorAll('*')) {
    if (el.getAttribute('fill') !== 'none') el.setAttribute('fill', '#000');
    if (el.getAttribute('stroke') && el.getAttribute('stroke') !== 'none') el.setAttribute('stroke', '#000');
  }
  if (!clone.getAttribute('xmlns')) clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const st = await inkStats('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(clone.outerHTML));
  if (!st) return null;
  const k = r.width / st.nw; // canvas px -> rendered px
  const w = st.bw * k, h = st.bh * k;
  return { w, h, ink: st.density * w * h, top: st.by * k };
}

// ---- Photos (Template review): framed on their subject, Pixel Tone on event cover places ----
// A place photo (a skyline, a venue) is framed on what matters: the skyline whole with a little sky
// above it, centred across, a little closer than "cover" so water and ground take less room. Photos of
// people are left as the designer framed them. On event covers the place photo carries Pixel Tone (the
// brand's tool, archy-design pixel: the photo dithered on the Royal Blue gradient's two tones).
async function framePhoto(n, src, role, format, coverTone = 'royal') {
  const root = document.querySelector('body > [data-node]');
  if (/speaker|person|portrait|ae\b|^image-ae/i.test(role)) return;
  const E = n.getBoundingClientRect(), R = root.getBoundingClientRect();
  // The window the photo is seen through: the element clipped by its clipping ancestors.
  let V = { left: E.left, top: E.top, right: E.right, bottom: E.bottom };
  for (let p = n.parentElement; p && p !== document.body; p = p.parentElement) {
    const cs = getComputedStyle(p);
    if (/(hidden|clip)/.test(cs.overflow + cs.overflowX + cs.overflowY)) {
      const b = p.getBoundingClientRect();
      V = { left: Math.max(V.left, b.left), top: Math.max(V.top, b.top), right: Math.min(V.right, b.right), bottom: Math.min(V.bottom, b.bottom) };
    }
  }
  const vw = V.right - V.left, vh = V.bottom - V.top;
  if (vw * vh < R.width * R.height * 0.12 || getComputedStyle(n).borderRadius.startsWith('50%')) return; // small or round: a portrait
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = src;
  await img.decode();
  const iw = img.naturalWidth, ih = img.naturalHeight;
  if (!iw || !ih) return;
  // Where the subject starts and where it sits across: detail (luminance edges) per row and column.
  const sw = 160, sh = Math.max(1, Math.round((ih / iw) * sw));
  const cv = document.createElement('canvas'); cv.width = sw; cv.height = sh;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  cx.drawImage(img, 0, 0, sw, sh);
  let data;
  try { data = cx.getImageData(0, 0, sw, sh).data; } catch { return; }
  const L = (x, y) => { const i = (y * sw + x) * 4; return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]; };
  const rows = new Array(sh).fill(0), cols = new Array(sw).fill(0);
  for (let y = 1; y < sh - 1; y++) for (let x = 1; x < sw - 1; x++) {
    const e = Math.abs(L(x + 1, y) - L(x - 1, y)) + Math.abs(L(x, y + 1) - L(x, y - 1));
    rows[y] += e;
  }
  const sm = rows.map((_, y) => [-2, -1, 0, 1, 2].reduce((a, d) => a + (rows[y + d] ?? 0), 0));
  const max = Math.max(...sm);
  // The skyline: from the first rows with real detail (the tops of the buildings) down to where the
  // detail falls away (water, a lawn, the sky's reflection), the first quiet stretch after the peak.
  const top = Math.max(0, sm.findIndex((v) => v >= max * 0.25));
  let peak = top;
  for (let y = top; y < sh; y++) if (sm[y] > sm[peak]) peak = y; else if (y > peak + sh * 0.25) break;
  let bottom = peak;
  for (let y = peak; y < sh; y++) {
    const quiet = sm.slice(y, y + Math.max(2, Math.round(sh * 0.04))).every((v) => v < sm[peak] * 0.3);
    if (quiet) { bottom = y; break; }
    bottom = y;
  }
  for (let y = top; y <= bottom; y++) for (let x = 1; x < sw - 1; x++) cols[x] += Math.abs(L(x + 1, y) - L(x - 1, y));
  const colSum = cols.reduce((a, v) => a + v, 0) || 1;
  const cxs = cols.reduce((a, v, x) => a + v * x, 0) / colSum;
  // Scale: the skyline band takes about 80% of the window's height (never less than covering it), so
  // there is little sky above and little water or ground below. Position: a slim margin of sky above,
  // the skyline centred across.
  const bandH = ((bottom - top) / sh) * ih;
  const s = Math.max(vw / iw, vh / ih, Math.min((vh * 0.8) / Math.max(1, bandH), (Math.max(vw / iw, vh / ih)) * 2.2));
  const ox = Math.min(0, Math.max(vw - iw * s, vw / 2 - (cxs / sw) * iw * s));
  const oy = Math.min(0, Math.max(vh - ih * s, vh * 0.1 - (top / sh) * ih * s));
  const tone = format === 'cover' && role === 'image-venue';
  if (!tone) {
    n.style.backgroundSize = `${Math.round(iw * s)}px ${Math.round(ih * s)}px`;
    n.style.backgroundPosition = `${Math.round(V.left - E.left + ox)}px ${Math.round(V.top - E.top + oy)}px`;
    n.style.backgroundRepeat = 'no-repeat';
    return;
  }
  // Pixel Tone, as tools/pixel/pixel.py: autocontrast (1%), 4 steps between the two tones, Bayer 8×8, 1px cells at 2×.
  // The tone follows the ground of the template (rules.coverTone, per theme in rules.coverTones): royal-blue,
  // navy, or ice inverted on the light ones (dark subjects take the darker tint), as the covers in Paper.
  const TONES = { royal: [[1, 61, 245], [1, 105, 250]], navy: [[0, 0, 78], [0, 4, 132]], ice: [[204, 234, 255], [230, 244, 255]] };
  const [base, front] = TONES[coverTone] ?? TONES.royal;
  const url = window.__pixelTone(img, { vw, vh, s, ox, oy, base, front, steps: 4, scale: 2 });
  n.style.backgroundImage = `url("${url}")`;
  n.style.backgroundSize = `${Math.round(vw)}px ${Math.round(vh)}px`;
  n.style.backgroundPosition = `${Math.round(V.left - E.left)}px ${Math.round(V.top - E.top)}px`;
  n.style.backgroundRepeat = 'no-repeat';
  // The navy version too: on a royal or sky card the photo takes it, so the card stands out (edits.js).
  n.dataset.toneOwn = url;
  n.dataset.toneRoyal = coverTone === 'royal' ? url : window.__pixelTone(img, { vw, vh, s, ox, oy, base: TONES.royal[0], front: TONES.royal[1], steps: 4, scale: 2 });
  n.dataset.toneNavy = coverTone === 'navy' ? url : window.__pixelTone(img, { vw, vh, s, ox, oy, base: TONES.navy[0], front: TONES.navy[1], steps: 4, scale: 2 });
}

window.__pixelTone = function pixelTone(img, { vw, vh, s, ox, oy, base, front, steps = 4, scale = 2 }) {
  const W = Math.round(vw * scale), H = Math.round(vh * scale);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  cx.drawImage(img, ox * scale, oy * scale, img.naturalWidth * s * scale, img.naturalHeight * s * scale);
  const im = cx.getImageData(0, 0, W, H), d = im.data;
  const lum = new Float32Array(W * H);
  const hist = new Array(256).fill(0);
  for (let i = 0; i < W * H; i++) { const v = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]; lum[i] = v; hist[Math.round(v)]++; }
  const cut = W * H * 0.01;
  let lo = 0, hi = 255, acc = 0;
  for (; lo < 255 && (acc += hist[lo]) < cut; lo++);
  acc = 0;
  for (; hi > 0 && (acc += hist[hi]) < cut; hi--);
  const m = [[0, 2], [3, 1]];
  let B = m;
  while (B.length < 8) { const k = B.length; B = Array.from({ length: 2 * k }, (_, y) => Array.from({ length: 2 * k }, (_, x) => 4 * B[y % k][x % k] + [0, 2, 3, 1][Math.floor(y / k) * 2 + Math.floor(x / k)])); }
  const pal = Array.from({ length: steps + 1 }, (_, i) => base.map((b, c) => Math.round(b + ((front[c] - b) * i) / steps)));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    const v = Math.min(255, Math.max(0, ((lum[i] - lo) / Math.max(1, hi - lo)) * 255));
    const t = (B[y % 8][x % 8] + 0.5) / 64;
    const c = pal[Math.min(steps, Math.max(0, Math.floor((v / 255) * steps + t)))];
    d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = 255;
  }
  cx.putImageData(im, 0, 0);
  return cv.toDataURL('image/png');
};
