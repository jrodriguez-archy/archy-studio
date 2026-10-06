// Runs inside the template page after window.__fill: the hand edits made in Canvas, layer by layer
// (keyed by data-node), plus the piece's colour swaps (the ':theme' entry). The editor and the renderer
// both run it, so what is on the canvas is the PNG. Re-applying is safe: every touched layer is first
// put back the way __fill left it.
window.__applyEdits = function applyEdits(edits, urls, icons) {
  const root = document.querySelector('body > [data-node]');
  const ARCHY = /^(Logo Archy|Archy Wordmark)/;
  const inArchyLogo = (el) => { for (let n = el; n && n !== root; n = n.parentElement) if (ARCHY.test(n.getAttribute?.('data-name') ?? '')) return true; return false; };

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

  // ---- Colour swaps for the whole piece: every token with that colour, and the same colour drawn in SVGs ----
  const theme = edits?.[':theme']?.theme ?? {};
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
      const t = targets[toHex(docStyle.getPropertyValue(v).trim())];
      if (t && t.to !== `var(${v})`) { root.style.setProperty(v, t.hex); set.push(v); }
    }
    root.dataset.themeVars = set.join(' ');
    for (const el of root.querySelectorAll('[fill], [stroke]')) {
      if (inArchyLogo(el)) continue;
      for (const attr of ['fill', 'stroke']) {
        const t = targets[toHex(el.getAttribute(attr) ?? '')];
        if (!t) continue;
        el.dataset[attr === 'fill' ? 'themeFill' : 'themeStroke'] = el.getAttribute(attr);
        el.setAttribute(attr, t.hex);
      }
    }
    probe.remove();
  }

  // ---- Layer edits ----
  for (const [id, e] of Object.entries(edits ?? {})) {
    if (id === ':theme') continue;
    const el = root.matches(`[data-node="${CSS.escape(id)}"]`) ? root : root.querySelector(`[data-node="${CSS.escape(id)}"]`);
    if (!el || !e || inArchyLogo(el)) continue; // the Archy logo is never edited
    const svg = el.tagName.toLowerCase() === 'svg';
    if (!('editStyle' in el.dataset)) {
      el.dataset.editStyle = el.getAttribute('style') ?? '';
      const cs = getComputedStyle(el);
      el.dataset.editFont = cs.fontSize;
      el.dataset.editLine = cs.lineHeight;
      if (svg) el.dataset.editHtml = el.innerHTML;
      else if (!el.children.length) el.dataset.editText = el.textContent;
    }
    const s = el.style;
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
    const b = e.box ?? {};
    if (b.dx || b.dy) s.translate = `${b.dx ?? 0}px ${b.dy ?? 0}px`;
    if (b.scale && b.scale !== 1) s.scale = String(b.scale);
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
    if (e.hidden) s.display = 'none';
  }

  function toHex(c) {
    if (!c) return null;
    if (/^#[0-9a-f]{6}$/i.test(c)) return c.toUpperCase();
    if (/^#[0-9a-f]{3}$/i.test(c)) return ('#' + [...c.slice(1)].map((x) => x + x).join('')).toUpperCase();
    const m = c.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
    return m ? ('#' + [m[1], m[2], m[3]].map((x) => Number(x).toString(16).padStart(2, '0')).join('')).toUpperCase() : null;
  }
};
