// Runs inside the template page. Fills slots and fits text following the plugin's order:
// rewrap first, then reduce the type a little, then (if it still does not fit) report so the copy is shortened.
// Never lets content overflow silently.
window.__fill = function fill({ format, formats, values, rules, limits }) {
  const root = document.querySelector('body > [data-node]');
  const byName = (name) =>
    name === '@artboard' ? root : root.querySelector(`[data-name^="${CSS.escape(name)}"]`);
  const pick = (v) => (v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).every((k) => formats.includes(k)) ? v[format] : v);
  const report = { format, ok: true, slots: {}, errors: [] };

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
    baseline.set(role, {
      // Absolutely placed blocks keep a mirrored margin; in-flow text just stays inside its container.
      inset: r.inset ?? (cs.position !== 'absolute' ? 0 : anchoredRight ? w.right - b.right : b.left - w.left),
      anchoredRight,
      fontSize: parseFloat(getComputedStyle(el).fontSize),
      lineHeight: parseFloat(getComputedStyle(el).lineHeight),
      position: cs.position,
    });
  }

  // ---- Fill values ----
  // An empty text slot is removed and the layout closes up; an optional block left with no slot
  // content (a pill with only its dot, a plate with no name or title) is removed whole.
  for (const [role, value] of Object.entries(values)) {
    const nodes = root.querySelectorAll(`[data-slot="${role}"]`);
    if (!nodes.length) continue; // slot not present in this variant
    const empty = value == null || value === '';
    for (const n of nodes) {
      if (n.dataset.slotType === 'image') { if (!empty) n.style.backgroundImage = `url("${value}")`; }
      else if (empty) n.remove();
      else n.textContent = value;
    }
    if (empty && nodes[0].dataset.slotType === 'text') report.slots[role] = { status: 'removed' };
  }
  for (const opt of [...root.querySelectorAll('[data-optional]')].reverse()) {
    if (!opt.querySelector('[data-slot]')) {
      opt.remove();
      report.removedBlocks = [...(report.removedBlocks ?? []), opt.dataset.optional];
    }
  }

  // ---- Measurement helpers ----
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
    const bump = (px, why) => { if (px > over) { over = px; overflow.reason = why; } };
    overflow.reason = null;
    if (base.anchoredRight) bump(w.left + base.inset - b.left, 'width');
    else bump(b.right - (w.right - base.inset), 'width');
    if (r.checkBottom !== false && base.position === 'absolute') bump(b.bottom - (w.bottom - base.inset), 'bottom');
    for (const a of pick(r.avoid) ?? []) {
      const av = byName(a.node);
      if (!av) continue;
      const x = rectOf(av), gap = a.gap ?? 0;
      if (intersects(b, x, gap)) bump(x.right + gap - b.left, `collides with ${a.node}`);
    }
    return Math.max(0, Math.ceil(over));
  }
  function intersects(b, x, gap = 0) {
    return b.left < x.right + gap && b.right > x.left - gap && b.top < x.bottom + gap && b.bottom > x.top - gap;
  }
  function containersOk() {
    const bad = [];
    for (const c of rules.containers ?? []) {
      const el = byName(pick(c.node));
      if (el && el.scrollHeight > el.clientHeight + 0.5) bad.push({ node: c.node, overflowPx: el.scrollHeight - el.clientHeight });
      if (el && el.scrollWidth > el.clientWidth + 0.5) bad.push({ node: c.node, overflowPx: el.scrollWidth - el.clientWidth });
      for (const a of pick(c.avoid) ?? []) {
        const av = byName(a.node);
        if (!el || !av) continue;
        const b = rectOf(el), x = rectOf(av);
        if (intersects(b, x, a.gap ?? 0)) bad.push({ node: c.node, overflowPx: Math.ceil(b.bottom + (a.gap ?? 0) - x.top), reason: `collides with ${a.node}` });
      }
    }
    return bad;
  }

  // ---- Fit each text slot ----
  for (const [role, r] of Object.entries(rules.slots)) {
    const el = root.querySelector(`[data-slot="${role}"][data-slot-type="text"]`);
    if (!el || !el.isConnected || report.slots[role]?.status === 'removed') continue;
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
    const fits = () => overflow(role, r, el) === 0 && lines(el) <= maxLines && containersOk().length === 0;
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
    const unwrap = () => { el.style.width = 'max-content'; el.style.whiteSpace = 'pre'; el.style.textWrap = ''; };
    const rewrap = () => {
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
          if (maxLines > 1 && rewrap() && fits()) return { scale: s, wrapped: true, groupWrapped: !!wrapGroup };
        }
      }
      return null;
    };

    const text = el.textContent;
    const ok = tryFit(text);
    if (ok) Object.assign(state, ok);
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
        message: lo > 0
          ? `"${text}" (${text.length} chars) does not fit even at ${Math.round(minScale * 100)}% size (${reason}). Keep it to ${lo} characters or fewer.`
          : `No room left for "${text}" in ${pick(r.block) ?? 'its box'} after the slots before it (${reason}). Shorten ${order.slice(0, order.indexOf(role)).filter((k) => pick(rules.slots[k].block) === pick(r.block)).join(', ') || 'the other copy'} so it fits on one line.`,
      });
    }
    later.forEach((n) => { n.style.display = n.dataset.prevDisplay; delete n.dataset.prevDisplay; });
    state.lines = lines(el);
    state.fontSize = parseFloat(getComputedStyle(el).fontSize);
    report.slots[role] = state;
  }

  for (const c of containersOk()) {
    report.ok = false;
    report.errors.push({ code: 'container_overflow', ...c, message: `${c.node} ${c.reason ?? 'overflows'} by ${c.overflowPx}px. Shorten the longest slot inside it.` });
  }
  if (report.errors.length) report.ok = false;
  return report;
};

// Calibration: characters per line that fit at the design size, using the slot's own default copy
// as the glyph-width sample (it reflects real casing and weight).
window.__calibrate = function calibrate({ format, formats, rules }) {
  const root = document.querySelector('body > [data-node]');
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
    const room = absolute ? t.width + free : (w.width - 2 * inset) - (b.width - t.width);
    const avg = t.width / el.textContent.length;
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
