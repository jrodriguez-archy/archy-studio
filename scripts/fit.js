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
  const sampleText = new Map([...root.querySelectorAll('[data-slot][data-slot-type="text"]')].map((n) => [n.dataset.slot, n.textContent]));
  const containerTol = new Map();
  for (const c of containersOk()) containerTol.set(`${c.node}|${c.reason ?? ''}`, c.overflowPx);

  // ---- Fill values ----
  const touchedParents = [];
  // An empty text slot is removed and the layout closes up; an optional block left with no slot
  // content (a pill with only its dot, a plate with no name or title) is removed whole.
  for (const [role, value] of Object.entries(values)) {
    const nodes = root.querySelectorAll(`[data-slot="${role}"]`);
    if (!nodes.length) continue; // slot not present in this variant
    const empty = value == null || value === '';
    const touched = new Set();
    for (const n of nodes) {
      const type = n.dataset.slotType;
      // An image left empty is removed (photo band, portrait) and the ground closes the gap.
      if (type === 'image') { if (empty) { touched.add(n.parentElement); n.remove(); } else n.style.backgroundImage = `url("${value}")`; continue; }
      if (empty) { touched.add(n.parentElement); n.remove(); continue; }
      if (type === 'logo') {
        // A partner mark is one colour on the piece: the colour of the template's own sample mark
        // (white on blue, navy on a white card). It keeps its proportions at the design's height.
        const box = logoBox.get(n);
        const shape = n.querySelector('path, rect, circle, polygon, ellipse');
        const color = (shape && getComputedStyle(shape).fill.startsWith('rgb') && getComputedStyle(shape).fill) || getComputedStyle(n).color;
        const img = new Image();
        img.src = value;
        await img.decode().catch(() => {});
        const ratio = img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 3;
        let h = box.height, w = h * ratio;
        if (w > box.width * 1.25) { w = box.width * 1.25; h = w / ratio; }
        n.style.width = 'auto';
        const mark = document.createElement('div');
        mark.dataset.logoMark = '';
        Object.assign(mark.style, { width: `${Math.round(w)}px`, height: `${Math.round(h)}px`, backgroundColor: color });
        for (const prop of ['mask', '-webkit-mask']) mark.style.setProperty(prop, `url("${value}") center / contain no-repeat`);
        n.replaceChildren(mark);
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
    if (base.clear?.length) {
      const rg = document.createRange(); rg.selectNodeContents(el);
      const tr = [...rg.getClientRects()].filter((x) => x.width > 0);
      for (const x of base.clear) {
        if (!x.isConnected) continue;
        const xr = rectOf(x);
        for (const t of tr) if (intersects(t, xr, 24)) bump(Math.min(t.right - xr.left, xr.right - t.left) + 24, `collides with ${x.dataset.name}`);
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
      if (el && el.scrollHeight > el.clientHeight + 0.5) push({ node: name, overflowPx: el.scrollHeight - el.clientHeight });
      if (el && el.scrollWidth > el.clientWidth + 0.5) push({ node: name, overflowPx: el.scrollWidth - el.clientWidth });
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
    if (rules.slots[role]) continue;
    // The box that really holds it: the nearest ancestor with a fixed width (a badge, a pill, a column),
    // else the Content frame, else the artboard.
    let box = el.parentElement;
    while (box && box !== root && !/^\d+(\.\d+)?px$/.test(box.style.width)) box = box.parentElement;
    const content = el.parentElement.closest('[data-name="Content"]');
    rules.slots[role] = { within: box && box !== root ? box : content ?? '@artboard', maxLines: Math.max(1, lines(el)), minScale: 0.85, auto: true };
  }
  if (!rules.containers) {
    const outer = [...root.children].find((c) => c.dataset.name === 'Content');
    rules.containers = outer ? [{ node: outer, mirror: true }] : [];
  }
  return rules;
}
