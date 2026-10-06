// Runs inside the template page. Fills slots and fits text following the plugin's order:
// rewrap first, then reduce the type a little, then (if it still does not fit) report so the copy is shortened.
// Never lets content overflow silently.
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
      return !textRects.some((t) => intersects(t, xr, 0));
    }) : [];
    baseline.set(role, {
      clear,
      // Absolutely placed blocks keep a mirrored margin; in-flow text just stays inside its container.
      inset: r.inset ?? (cs.position !== 'absolute' ? 0 : anchoredRight ? w.right - b.right : b.left - w.left),
      anchoredRight,
      fontSize: parseFloat(getComputedStyle(el).fontSize),
      top: rectOf(el).top,
      height: rectOf(el).height,
      lineHeight: parseFloat(getComputedStyle(el).lineHeight),
      position: cs.position,
    });
  }

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
      if (type === 'image') { if (empty) { touched.add(n.parentElement); n.remove(); } else n.style.backgroundImage = `url("${value}")`; continue; }
      if (empty) { touched.add(n.parentElement); n.remove(); continue; }
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
          h = Math.sqrt(sample.ink / (mark.density * aspect));
          h = Math.min(Math.max(h, sample.h * 0.6), sample.h * 1.3, box.height);
          w = h * aspect;
          // Width: the room the design gives the partner mark (its sample frame), with a little slack.
          const maxW = Math.max(box.width, sample.w) * 1.25;
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
        Object.assign(el.style, { width: `${Math.round(w)}px`, height: `${Math.round(h)}px`, backgroundColor: color, flexShrink: '0' });
        const pos = mark ? `${-mark.bx * k}px ${-mark.by * k}px` : 'center';
        const size = mark ? `${mark.nw * k}px ${mark.nh * k}px` : 'contain';
        for (const pre of ['', '-webkit-']) {
          el.style.setProperty(`${pre}mask-image`, `url("${value}")`);
          el.style.setProperty(`${pre}mask-repeat`, 'no-repeat');
          el.style.setProperty(`${pre}mask-position`, pos);
          el.style.setProperty(`${pre}mask-size`, size);
        }
        n.replaceChildren(el);
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
    const minScale = pick(r.minScale) ?? 0.85;
    // Containers: this slot may not make them worse than they are with its sample copy, so one long
    // slot is reported once instead of blocking every slot after it.
    const keyOf = (c) => `${c.node}|${c.reason ?? ''}`;
    const current = el.textContent;
    el.textContent = sampleText.get(role) ?? current;
    const allowed = new Map(containersOk().map((c) => [keyOf(c), c.overflowPx]));
    el.textContent = current;
    const containersFine = () => containersOk().every((c) => c.overflowPx <= (allowed.get(keyOf(c)) ?? 0) + 0.5);
    const fits = () => overflow(role, r, el) === 0 && lines(el) <= maxLines && containersFine();
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
      if (isBlockText) Object.assign(el.style, authored);
      else { el.style.width = 'max-content'; el.style.whiteSpace = 'pre'; el.style.textWrap = ''; }
    };
    const rewrap = () => {
      if (isBlockText) return false;
      // Narrow the text by exactly the overflow so the block lands on its bounds.
      unwrap();
      const over = overflow(role, r, el);
      if (!over) return false;
      el.style.whiteSpace = 'normal';
      el.style.textWrap = 'balance';
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
    if (!target || info.before >= frame.used * 0.95 || info.before >= target * 0.95 || (frame.fixed && /space-/.test(getComputedStyle(box).justifyContent))) return;
    box.dataset.footprint = String(Math.round(target));

    // 1. The lead text grows: the slot named in rules.fill, else the largest text in the column.
    const texts = Object.keys(rules.slots)
      .map((role) => ({ role, el: root.querySelector(`[data-slot="${role}"][data-slot-type="text"]`) }))
      .filter((x) => x.el?.isConnected && box.contains(x.el) && report.slots[x.role]?.status === 'fit' && !rules.slots[x.role].scaleGroup);
    const lead = texts.find((x) => x.role === pick(opts.slot)) ?? texts.sort((a, b) => parseFloat(getComputedStyle(b.el).fontSize) - parseFloat(getComputedStyle(a.el).fontSize))[0];
    if (lead) {
      const r = rules.slots[lead.role], st = report.slots[lead.role], base = baseline.get(lead.role);
      const maxScale = pick(opts.maxScale) ?? 1.25;
      // Nothing else may get worse: every other text keeps fitting, no frame overflows more.
      const others = Object.keys(rules.slots).filter((k) => k !== lead.role && report.slots[k]?.status === 'fit')
        .map((k) => [k, root.querySelector(`[data-slot="${k}"][data-slot-type="text"]`)]).filter(([, n]) => n?.isConnected);
      const spill = () => containersOk().reduce((a, c) => a + c.overflowPx, 0);
      const before = spill();
      const othersFit = () => others.every(([k, n]) => overflow(k, rules.slots[k], n) === 0);
      // It grows on the lines it already has: a word pushed alone onto a new line looks broken.
      const had = lines(lead.el);
      // …and never into a badge, mascot or sticker it was clear of (24px apart).
      const textBoxes = () => { const rg = document.createRange(); rg.selectNodeContents(lead.el); return [...rg.getClientRects()].filter((x) => x.width > 0); };
      const near = (xs) => xs.filter((x) => { const xr = rectOf(x); return textBoxes().some((t) => intersects(t, xr, 24)); });
      const loose = [...root.querySelectorAll('[data-node]')].filter((x) => {
        if (x === root || x.contains(lead.el) || lead.el.contains(x) || getComputedStyle(x).position !== 'absolute') return false;
        const xr = rectOf(x); return xr.width > 2 && xr.height > 2;
      });
      const apart = loose.filter((x) => !near([x]).length);
      // Those it was already close to: it may not get any closer (overlap with a 24px halo can't grow).
      const halo = (x) => { const xr = rectOf(x); return textBoxes().reduce((a, t) => a + Math.max(0, Math.min(t.right, xr.right + 24) - Math.max(t.left, xr.left - 24)) * Math.max(0, Math.min(t.bottom, xr.bottom + 24) - Math.max(t.top, xr.top - 24)), 0); };
      const close = loose.filter((x) => !apart.includes(x)).map((x) => [x, halo(x)]);
      const at = (k) => { lead.el.style.fontSize = `${(base.fontSize * k).toFixed(2)}px`; lead.el.style.lineHeight = `${Math.round(base.lineHeight * k)}px`; };
      const ok = () => overflow(lead.role, r, lead.el) === 0 && lines(lead.el) <= had && spill() <= before + 0.5 && othersFit() && used() <= target + 0.5 && !near(apart).length && close.every(([x, h0]) => halo(x) <= h0 + 1);
      let best = st.scale;
      for (let k = maxScale; k > st.scale + 0.005; k = +(k - 0.01).toFixed(2)) { at(k); if (ok()) { best = k; break; } }
      at(best);
      if (best > st.scale) {
        Object.assign(st, { scale: best, grown: true, lines: lines(lead.el), fontSize: parseFloat(getComputedStyle(lead.el).fontSize) });
        info.grew = { slot: lead.role, scale: best };
      }
    }
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
      if (!frame.fixed) box.style.minHeight = `${Math.round(target)}px`;
      foot.style.marginTop = 'auto';
      info.footer = foot.dataset.name;
    }
    info.after = Math.round(used());
    mark();
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
    const inset = r.inset ?? (getComputedStyle(block).position !== 'absolute' ? 0 : anchoredRight ? w.right - b.right : b.left - w.left);
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
    rules.slots[role] = { within: box && box !== root ? box : content ?? '@artboard', maxLines: Math.max(1, lines(el)), minScale: 0.85, auto: true, ...rules.slots[role] };
  }
  if (!rules.containers) {
    const outer = [...root.children].find((c) => c.dataset.name === 'Content');
    rules.containers = outer ? [{ node: outer, mirror: true }] : [];
  }
  return rules;
}

// Ink of an image: bounding box of its visible pixels (alpha > 10%) and how much of that box is ink.
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
  let x0 = cw, y0 = ch, x1 = -1, y1 = -1, ink = 0;
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const a = data[(y * cw + x) * 4 + 3];
    if (a > 25) { ink += a / 255; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 < 0) return null;
  const bw = (x1 - x0 + 1) / scale, bh = (y1 - y0 + 1) / scale;
  return { nw, nh, bx: x0 / scale, by: y0 / scale, bw, bh, density: ink / ((x1 - x0 + 1) * (y1 - y0 + 1)) };
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
  return { w, h, ink: st.density * w * h };
}
