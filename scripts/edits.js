// Runs inside the template page after window.__fill: the hand edits made in Canvas, layer by layer
// (keyed by data-node), plus the piece-level ':theme' entry (a Dark / Blue / Sky / Ice / Light theme and colour
// swaps). The editor and the renderer both run it, so what is on the canvas is the PNG. Re-applying is
// safe: every touched layer is first put back the way __fill left it.
window.__applyEdits = function applyEdits(edits, urls, icons) {
  const root = document.querySelector('body > [data-node]');
  const ARCHY = /^(Logo Archy|Archy Wordmark)/;
  const BUTTON = /^(CTA|Button)$/i;
  const DECORATION = /^(Mascot|Stars|Swoosh|Drinks Pattern|Pixel Dissolve|Rulers|BK Fade|Scrim|RIBBON|Border|Photo Panel|Cocktail|Illustration)/i;
  const nameOf = (el) => el.getAttribute?.('data-name') ?? '';
  const inside = (el, test) => { for (let n = el; n && n !== root; n = n.parentElement) if (test(n)) return n; return null; };
  const inArchyLogo = (el) => !!inside(el, (n) => ARCHY.test(nameOf(n)));
  const isSvg = (el) => el.namespaceURI === 'http://www.w3.org/2000/svg';
  // Keep what __fill left, once, so the next pass can put it back.
  const keep = (el) => {
    if ('editStyle' in el.dataset) return;
    el.dataset.editStyle = el.getAttribute('style') ?? '';
    const cs = getComputedStyle(el);
    el.dataset.editFont = cs.fontSize;
    el.dataset.editLine = cs.lineHeight;
    if (isSvg(el)) el.dataset.editHtml = el.innerHTML;
    else if (!el.children.length) el.dataset.editText = el.textContent;
  };
  const setAttr = (el, attr, value) => {
    const k = attr === 'fill' ? 'themeFill' : 'themeStroke';
    if (!(k in el.dataset)) el.dataset[k] = el.getAttribute(attr) ?? '';
    el.setAttribute(attr, value);
  };

  // ---- Put everything back ----
  for (const el of document.querySelectorAll('[data-edit-style]')) {
    el.setAttribute('style', el.dataset.editStyle);
    if ('editText' in el.dataset) el.textContent = el.dataset.editText;
    if ('editHtml' in el.dataset) el.innerHTML = el.dataset.editHtml;
  }
  for (const v of (root.dataset.themeVars ?? '').split(' ').filter(Boolean)) root.style.removeProperty(v);
  for (const el of root.querySelectorAll('[data-theme-fill], [data-theme-stroke]')) {
    if ('themeFill' in el.dataset) { el.setAttribute('fill', el.dataset.themeFill); delete el.dataset.themeFill; }
    if ('themeStroke' in el.dataset) { el.setAttribute('stroke', el.dataset.themeStroke); delete el.dataset.themeStroke; }
  }

  const piece = edits?.[':theme'] ?? {};

  // ---- Theme: the piece redrawn on a Dark, Blue, Sky, Ice or Light ground, by role (text, accent, button,
  // surface, line, icon, the Archy logo's approved colour). Photos and illustrations keep theirs. ----
  const PRESETS = {
    dark: { bg: 'linear-gradient(in oklab 180deg, var(--color-dark-foreground) 0%, var(--color-dark-background) 55%)', text: '#FFFFFF', accent: '#66BFFF', surface: '#000484', border: '#0000C9', button: '#013DF5', onButton: '#FFFFFF', logo: '#FFFFFF' },
    blue: { bg: '#013DF5', text: '#FFFFFF', accent: '#CCEAFF', surface: '#0000C9', border: '#66BFFF', button: '#FFFFFF', onButton: '#013DF5', logo: '#FFFFFF' },
    sky: { bg: '#0095FF', text: '#FFFFFF', accent: '#00004E', surface: '#66BFFF', border: '#CCEAFF', button: '#00004E', onButton: '#FFFFFF', logo: '#FFFFFF' },
    ice: { bg: '#E6F4FF', text: '#00004E', accent: '#013DF5', surface: '#FFFFFF', border: '#CCEAFF', button: '#013DF5', onButton: '#FFFFFF', logo: '#013DF5' },
    light: { bg: '#FFFFFF', text: '#00004E', accent: '#013DF5', surface: '#F3F9FF', border: '#EEEEEE', button: '#013DF5', onButton: '#FFFFFF', logo: '#013DF5' },
  };
  const t = PRESETS[piece.preset];
  if (t) {
    keep(root);
    root.style.background = t.bg;
    const rgb = (c) => (c.match(/\d+(\.\d+)?/g) ?? []).map(Number);
    const lum = (c) => { const [r, g, b] = rgb(c); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; };
    const saturated = (c) => { const [r, g, b, a] = rgb(c); return a !== 0 && Math.max(r, g, b) - Math.min(r, g, b) > 90; };
    const filled = (el) => { const bg = getComputedStyle(el).backgroundColor; return bg && !/rgba\(0, 0, 0, 0\)|transparent/.test(bg); };
    const skip = (el) => inArchyLogo(el) || !!inside(el, (n) => DECORATION.test(nameOf(n)) || n.dataset?.optional === 'illustration' || n.dataset?.slotType === 'image');
    // Buttons and royal boxes (booth badges) carry their own pair of colours. Roles are read from the
    // design first, then applied, so one change never misleads the next.
    const all = [...root.querySelectorAll('*')].filter((el) => !isSvg(el) && !skip(el));
    const buttons = new Set(all.filter((n) => BUTTON.test(nameOf(n)) || (filled(n) && saturated(getComputedStyle(n).backgroundColor))));
    const buttonOf = (el) => inside(el, (n) => buttons.has(n));
    const plan = all.map((el) => {
      const cs = getComputedStyle(el);
      const btn = buttonOf(el);
      const name = nameOf(el);
      return {
        el, btn,
        mark: el.dataset.logoMark !== undefined,
        fill: filled(el) ? (btn === el ? t.button : /^(Ruler|Divider)/.test(name) ? t.border : /^Dot/.test(name) ? (btn ? t.onButton : t.accent) : btn ? null : t.surface) : null,
        border: parseFloat(cs.borderTopWidth) > 0 && !btn,
        color: [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) ? (btn ? t.onButton : saturated(cs.color) && lum(cs.color) < 0.8 ? t.accent : t.text) : null,
      };
    });
    for (const p of plan) {
      const st = p.el.style;
      if (p.mark) { keep(p.el); st.backgroundColor = t.text; continue; }
      if (p.fill || p.border || p.color) keep(p.el);
      if (p.fill) { if (/gradient|url\(/.test(getComputedStyle(p.el).backgroundImage) && p.fill === t.surface) st.backgroundImage = 'none'; st.backgroundColor = p.fill; }
      if (p.border) st.borderColor = t.border;
      if (p.color) st.color = p.color;
    }
    for (const el of root.querySelectorAll('svg [stroke], svg[stroke]')) {
      const s = el.getAttribute('stroke');
      if (!s || s === 'none' || skip(el)) continue;
      setAttr(el, 'stroke', buttonOf(el) ? t.onButton : t.accent);
    }
    for (const el of root.querySelectorAll('svg [fill]')) {
      if (el.getAttribute('fill') === 'none') continue;
      if (inArchyLogo(el)) setAttr(el, 'fill', t.logo);
      // A partner's sample mark (one colour, like the marks Studio places) follows the text.
      else if (inside(el, (n) => n.dataset?.slotType === 'logo')) setAttr(el, 'fill', t.text);
    }
  }

  // ---- Colour swaps for the whole piece: every token with that colour, and the same colour drawn in SVGs ----
  const theme = piece.theme ?? {};
  if (Object.keys(theme).length) {
    const probe = document.createElement('div');
    root.appendChild(probe);
    const hexOf = (css) => { probe.style.color = ''; probe.style.color = css; return toHex(getComputedStyle(probe).color); };
    const vars = [];
    for (const sheet of document.styleSheets) {
      let rules; try { rules = sheet.cssRules; } catch { continue; }
      for (const r of rules) if (r.selectorText === ':root') for (const p of r.style) if (p.startsWith('--color-')) vars.push(p);
    }
    const docStyle = getComputedStyle(document.documentElement);
    const targets = Object.fromEntries(Object.entries(theme).map(([from, to]) => [from.toUpperCase(), { to, hex: hexOf(to) }]));
    const set = [];
    for (const v of vars) {
      const tg = targets[toHex(docStyle.getPropertyValue(v).trim())];
      if (tg && tg.to !== `var(${v})`) { root.style.setProperty(v, tg.hex); set.push(v); }
    }
    root.dataset.themeVars = set.join(' ');
    for (const el of root.querySelectorAll('[fill], [stroke]')) {
      if (inArchyLogo(el)) continue;
      for (const attr of ['fill', 'stroke']) {
        const tg = targets[toHex(el.getAttribute(attr) ?? '')];
        if (tg) setAttr(el, attr, tg.hex);
      }
    }
    probe.remove();
  }

  // How many lines each text takes as designed (before any hand edit), for __checkEdits.
  for (const el of root.querySelectorAll('[data-node]')) {
    if (!('baseLines' in el.dataset) && !isSvg(el) && !el.children.length && el.textContent.trim()) {
      el.dataset.baseLines = String(lineCount(el));
      // What the design itself already spills (glyph overhangs, tight boxes) is not an error later.
      el.dataset.baseOver = `${Math.max(0, el.scrollWidth - el.clientWidth)},${Math.max(0, el.scrollHeight - el.clientHeight)}`;
    }
  }

  // ---- Layer edits ----
  for (const [id, e] of Object.entries(edits ?? {})) {
    if (id === ':theme') continue;
    const el = root.matches(`[data-node="${CSS.escape(id)}"]`) ? root : root.querySelector(`[data-node="${CSS.escape(id)}"]`);
    if (!el || !e) continue;
    const logo = inArchyLogo(el); // the Archy logo only moves and scales
    if (logo && !ARCHY.test(nameOf(el))) continue;
    const svg = isSvg(el);
    keep(el);
    const s = el.style;
    const b = e.box ?? {};
    if (b.dx || b.dy) s.translate = `${b.dx ?? 0}px ${b.dy ?? 0}px`;
    if (b.scale && b.scale !== 1) s.scale = String(b.scale);
    if (logo) continue;
    if (e.text != null && !svg && !el.children.length) el.textContent = e.text;
    if (e.image && urls?.[e.image]) s.backgroundImage = `url("${urls[e.image]}")`;
    if (svg && e.icon && icons?.[e.icon]) {
      // Another Hugeicons drawing in the same box, in the colour the icon had.
      const was = [...el.querySelectorAll('[stroke]')].map((n) => n.getAttribute('stroke')).find((c) => c && c !== 'none') ?? getComputedStyle(el).color;
      el.innerHTML = icons[e.icon];
      el.setAttribute('viewBox', '0 0 24 24');
      s.fill = 'none'; // Hugeicons strokes; parts meant to be filled say so themselves
      s.color = was;
    }
    if (svg && e.style?.color) {
      s.color = e.style.color;
      for (const n of el.querySelectorAll('[stroke]')) if (n.getAttribute('stroke') !== 'none') n.setAttribute('stroke', 'currentColor');
    }
    if (b.width != null) { s.width = `${b.width}px`; s.flexShrink = '0'; }
    if (b.height != null) { s.height = `${b.height}px`; s.flexShrink = '0'; }
    const st = e.style ?? {};
    if (st.color && !svg) s.color = st.color;
    if (st.backgroundColor) s.background = st.backgroundColor;
    if (st.fontWeight) s.fontWeight = String(st.fontWeight);
    if (st.opacity != null) s.opacity = String(st.opacity);
    if (st.fontSize) {
      // Leading follows the size so a smaller line keeps the design's rhythm.
      const f0 = parseFloat(el.dataset.editFont), l0 = parseFloat(el.dataset.editLine);
      s.fontSize = `${st.fontSize}px`;
      if (f0 && l0) s.lineHeight = `${Math.round((l0 * st.fontSize) / f0)}px`;
    }
    const l = e.layout;
    if (l) {
      const flex = { start: 'flex-start', center: 'center', end: 'flex-end' };
      if (l.distribute === 'space-between') s.justifyContent = 'space-between';
      else if (l.distribute === 'packed' || l.position) s.justifyContent = flex[l.position ?? 'start'];
      if (l.gap != null) s.gap = `${l.gap}px`;
      if (l.align) s.alignItems = flex[l.align];
    }
    if (e.hidden) s.display = 'none';
  }

  function lineCount(el) {
    const r = document.createRange();
    r.selectNodeContents(el);
    const tops = [...r.getClientRects()].filter((x) => x.width > 0).map((x) => Math.round(x.top));
    return new Set(tops.map((t) => Math.round(t / 4))).size || 1;
  }

  function toHex(c) {
    if (!c) return null;
    if (/^#[0-9a-f]{6}$/i.test(c)) return c.toUpperCase();
    if (/^#[0-9a-f]{3}$/i.test(c)) return ('#' + [...c.slice(1)].map((x) => x + x).join('')).toUpperCase();
    const m = c.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
    return m ? ('#' + [m[1], m[2], m[3]].map((x) => Number(x).toString(16).padStart(2, '0')).join('')).toUpperCase() : null;
  }
};

// After the hand edits: a text a resize, a smaller box, a bigger size or a layout change has affected
// must still fit, as fit.js makes sure for the copy. Same check in the editor and on the server, so a
// piece that does not fit is never saved.
window.__checkEdits = function checkEdits(edits, rules, format) {
  const root = document.querySelector('body > [data-node]');
  const R = root.getBoundingClientRect();
  const touched = Object.entries(edits ?? {}).filter(([id, e]) => id !== ':theme' && e && (e.box || e.style?.fontSize || e.style?.fontWeight || e.layout || e.text != null));
  if (!touched.length) return [];
  const nodes = touched.map(([id]) => root.querySelector(`[data-node="${CSS.escape(id)}"]`)).filter(Boolean);
  const errors = [];
  const pick = (v) => (v && typeof v === 'object' ? v[format] : v);
  const lines = (el) => {
    const r = document.createRange();
    r.selectNodeContents(el);
    return new Set([...r.getClientRects()].filter((x) => x.width > 0).map((x) => Math.round(x.top / 4))).size || 1;
  };
  const name = (el) => {
    const slot = el.dataset.slot;
    const t = slot ? slot.replace(/-/g, ' ') : el.textContent.trim().replace(/\s+/g, ' ').slice(0, 24);
    return t.charAt(0).toUpperCase() + t.slice(1);
  };
  for (const el of root.querySelectorAll('[data-node]')) {
    if (el.namespaceURI === 'http://www.w3.org/2000/svg' || el.children.length || !el.textContent.trim()) continue;
    if (getComputedStyle(el).display === 'none' || !nodes.some((n) => n === el || n.contains(el) || el.contains(n))) continue;
    const slot = el.dataset.slot;
    const allowed = Math.max(Number(el.dataset.baseLines) || 1, (slot && pick(rules?.slots?.[slot]?.maxLines)) || 0);
    const now = lines(el);
    const b = el.getBoundingClientRect();
    if (now > allowed) errors.push({ node: el.dataset.node, slot, code: 'edit-lines', message: `${name(el)} now takes ${now} lines; the design allows ${allowed}. Widen its box or make the text smaller.` });
    else if ((() => { const [w0, h0] = (el.dataset.baseOver ?? '0,0').split(',').map(Number); return el.scrollWidth - el.clientWidth > w0 + 2 || el.scrollHeight - el.clientHeight > h0 + 2; })()) errors.push({ node: el.dataset.node, slot, code: 'edit-overflow', message: `${name(el)} no longer fits its box. Make the box bigger or the text smaller.` });
    else if (b.left < R.left - 1 || b.top < R.top - 1 || b.right > R.right + 1 || b.bottom > R.bottom + 1) errors.push({ node: el.dataset.node, slot, code: 'edit-outside', message: `${name(el)} goes off the piece.` });
  }
  return errors;
};
