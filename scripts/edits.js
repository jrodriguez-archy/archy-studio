// Runs inside the template page after window.__fill: the hand edits made in Canvas, layer by layer
// (keyed by data-node), plus the piece-level ':theme' entry (a Dark / Blue / Sky / Ice / Light theme).
// The editor and the renderer both run it, so what is on the canvas is the PNG. Re-applying is safe:
// every touched layer is first put back the way __fill left it.
window.__applyEdits = function applyEdits(edits, urls, icons) {
  const root = document.querySelector('body > [data-node]');
  // The brand's logo (Archy's, or DOC's lockup): locked, it only moves and scales.
  const ARCHY = /^(Logo Archy|Archy Wordmark|Logo DOC|DOC Lockup)/;
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
  // Any other attribute a theme sets (an outline's width…), put back on the next pass.
  const setOther = (el, attr, value) => {
    const kept = JSON.parse(el.dataset.themeAttrs ?? '{}');
    if (!(attr in kept)) kept[attr] = el.getAttribute(attr);
    el.dataset.themeAttrs = JSON.stringify(kept);
    el.setAttribute(attr, value);
  };

  // ---- Put everything back ----
  for (const el of document.querySelectorAll('[data-edit-style]')) {
    el.setAttribute('style', el.dataset.editStyle);
    if ('editText' in el.dataset) el.textContent = el.dataset.editText;
    if ('editHtml' in el.dataset) el.innerHTML = el.dataset.editHtml;
  }
  for (const el of root.querySelectorAll('[data-on-badge]')) delete el.dataset.onBadge;
  for (const el of root.querySelectorAll('[data-theme-attrs]')) {
    for (const [a, v] of Object.entries(JSON.parse(el.dataset.themeAttrs))) { if (v == null) el.removeAttribute(a); else el.setAttribute(a, v); }
    delete el.dataset.themeAttrs;
  }
  for (const el of root.querySelectorAll('[data-theme-fill], [data-theme-stroke]')) {
    if ('themeFill' in el.dataset) { el.setAttribute('fill', el.dataset.themeFill); delete el.dataset.themeFill; }
    if ('themeStroke' in el.dataset) { el.setAttribute('stroke', el.dataset.themeStroke); delete el.dataset.themeStroke; }
  }

  // The piece as designed, kept once (before any theme or edit), for the Inspector.
  // How many lines each text takes as designed (before any hand edit), for the Inspector.
  for (const el of root.querySelectorAll('[data-node]')) {
    if (!('baseLines' in el.dataset) && !isSvg(el) && !el.children.length && el.textContent.trim()) {
      el.dataset.baseLines = String(lineCount(el));
      // What the design itself already spills (glyph overhangs, tight boxes) is not an error later.
      el.dataset.baseOver = `${Math.max(0, el.scrollWidth - el.clientWidth)},${Math.max(0, el.scrollHeight - el.clientHeight)}`;
    }
  }
  // Where everything sits as designed (for the Inspector: it only flags what the edits changed).
  const R0 = root.getBoundingClientRect();
  for (const el of root.querySelectorAll('[data-node]')) {
    if ('baseBox' in el.dataset) continue;
    const b = el.getBoundingClientRect();
    el.dataset.baseBox = [b.left - R0.left, b.top - R0.top, b.width, b.height].map((n) => Math.round(n)).join(',');
    if (!isSvg(el)) el.dataset.baseFont = String(parseFloat(getComputedStyle(el).fontSize));
    if (!isSvg(el) && !el.children.length && el.textContent.trim()) el.dataset.baseContrast = String(contrastOf(el) ?? '');
  }

  const piece = edits?.[':theme'] ?? {};

  // ---- A partner logo in one colour or its own colours, chosen by hand (before the theme, which colours
  // one-colour marks only) ----
  for (const [id, e] of Object.entries(edits ?? {})) {
    if (!e?.colors || id === ':theme') continue;
    const el = root.querySelector(`[data-node="${CSS.escape(id)}"]`);
    const mark = el && (el.matches('[data-logo-mark]') ? el : el.querySelector('[data-logo-mark]'));
    if (mark) { keep(mark); window.__logoMode?.(mark, e.colors); }
  }

  // ---- Theme: the piece redrawn on a Dark, Blue, Sky, Ice or Light ground, by role (text, accent, button,
  // surface, line, icon, the Archy logo's approved colour). Photos and illustrations keep theirs. ----
  // solid: the ground as one colour (for contrast checks). fills: what a pill, badge or container may
  // take, in order, when its colour sinks into what is behind it. Lines stay subtle but visible.
  // Learned in Template review: Sky is white or extremely light blue, never dark; nothing takes the
  // colour of its ground; rulers are a subtle blue, never grey.
  const PRESETS = {
    dark: { bg: 'linear-gradient(in oklab 180deg, var(--color-dark-foreground) 0%, var(--color-dark-background) 55%)', solid: '#00025F', text: '#FFFFFF', accent: '#66BFFF', surface: '#0000C9', border: '#141F9C', button: '#013DF5', onButton: '#FFFFFF', logo: '#FFFFFF', badge: '#013DF5', fills: ['#013DF5', '#0095FF', '#FFFFFF'] },
    blue: { bg: '#013DF5', solid: '#013DF5', text: '#FFFFFF', accent: '#CCEAFF', surface: '#00004E', border: '#4D7BFF', button: '#FFFFFF', onButton: '#013DF5', logo: '#FFFFFF', badge: '#00004E', fills: ['#00004E', '#FFFFFF'] },
    sky: { bg: '#0095FF', solid: '#0095FF', text: '#FFFFFF', accent: '#E6F4FF', surface: '#FFFFFF', border: '#CCEAFF', button: '#FFFFFF', onButton: '#013DF5', logo: '#FFFFFF', badge: '#013DF5', fills: ['#FFFFFF', '#013DF5'] },
    ice: { bg: '#E6F4FF', solid: '#E6F4FF', text: '#00004E', accent: '#013DF5', surface: '#FFFFFF', border: '#A9D3F5', button: '#013DF5', onButton: '#FFFFFF', logo: '#013DF5', badge: '#013DF5', fills: ['#013DF5', '#FFFFFF'] },
    light: { bg: '#FFFFFF', solid: '#FFFFFF', text: '#00004E', accent: '#0095FF', surface: '#F3F9FF', border: '#99D1FF', button: '#013DF5', onButton: '#FFFFFF', logo: '#013DF5', badge: '#013DF5', fills: ['#E6F4FF', '#013DF5'] },
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
        // Inside a pill or plate (its own fill), text takes the theme's text colour, never the accent.
        color: [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
          ? (btn ? t.onButton : saturated(cs.color) && lum(cs.color) < 0.8 && !inside(el.parentElement, (n) => filled(n) && !buttons.has(n)) ? t.accent : t.text) : null,
      };
    });
    for (const p of plan) {
      const st = p.el.style;
      if (p.mark) { if (!st.backgroundImage) { keep(p.el); st.backgroundColor = t.text; } continue; }
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
    for (const line of root.querySelectorAll('[data-name^="Rulers"] [data-name^="Ruler"]')) { keep(line); line.style.backgroundColor = t.border; }
    const step = (name, f) => { try { f(); } catch (e) { (window.__themeErrors ??= []).push(`${name}: ${e.message}`); } };
    step('fades', () => themeFades(t));
    // Pixel Tone photos contrast with the card above them: navy behind a royal or sky card, else the template's own tone.
    step('tone', () => {
      for (const ph of root.querySelectorAll('[data-tone-navy]')) {
        const card = [...root.querySelectorAll('[data-name]')].find((c) => /^(Content|Card)/.test(nameOf(c)) && getComputedStyle(c).position === 'absolute');
        const c = card ? hexRgb(getComputedStyle(card).backgroundColor) : null;
        const blueCard = c && c[2] > 180 && c[0] < 60 && c[1] < 200;
        keep(ph);
        ph.style.backgroundImage = `url("${blueCard ? ph.dataset.toneNavy : ph.dataset.toneOwn ?? ph.dataset.toneRoyal}")`;
      }
    });
    step('badges', () => themeBadges(t));
    step('mascots', () => themeMascots(piece.preset));
    step('contrast', () => keepContrast(t));
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
    if (b.dx || b.dy) moveBy(el, b.dx ?? 0, b.dy ?? 0);
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
    // A text's box hugs its copy: its height follows the lines, a narrower width wraps them.
    const text = !svg && !el.children.length && !!el.textContent.trim();
    if (b.width != null) {
      s.width = `${b.width}px`; s.flexShrink = '0';
      if (text && /^(pre|nowrap)$/.test(getComputedStyle(el).whiteSpace)) s.whiteSpace = 'pre-wrap';
    }
    if (b.height != null && !text) { s.height = `${b.height}px`; s.flexShrink = '0'; }
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
    if (e.hidden) {
      s.display = 'none';
      // A partner logo hidden goes like an empty one: the divider beside it too, and a lockup left with
      // the Archy logo alone in a centred column centres it.
      if (el.dataset.slotType === 'logo') {
        for (const sib of [el.previousElementSibling, el.nextElementSibling]) if (sib && /^(Divider|Separator)/.test(nameOf(sib))) { keep(sib); sib.style.display = 'none'; }
        const lockup = el.closest('[data-name^="Logo Lockup"]');
        if (lockup && lockup.parentElement && getComputedStyle(lockup.parentElement).alignItems === 'center') {
          const shown = [...lockup.children].filter((c) => getComputedStyle(c).display !== 'none' && (c.querySelector('svg, [data-logo-mark]') || c.matches('svg')));
          if (shown.length === 1) { keep(lockup); lockup.style.justifyContent = 'center'; }
        }
      }
    }
  }

  // ---- Photos reframed by hand (after every box and layout, so the frame has its final size) ----
  for (const [id, e] of Object.entries(edits ?? {})) {
    if (!e?.crop || id === ':theme') continue;
    const el = root.querySelector(`[data-node="${CSS.escape(id)}"]`);
    if (!el || el.style.display === 'none') continue;
    keep(el);
    window.__setCrop(el, e.crop);
  }

  // ---- Themes: what the role plan cannot see ----
  function hexRgb(c) {
    if (!c) return null;
    const h = toHex(c);
    if (h) return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    return null;
  }
  function ratio(a, b) {
    const lum = ([r0, g0, b0]) => [r0, g0, b0].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
    const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (l1 + 0.05) / (l2 + 0.05);
  }
  // The colour right behind an element after the theme: the nearest ancestor with a fill (a gradient
  // counts as the average of its stops), else the theme's ground. Null when a photo is behind.
  function groundOf(el, t) {
    for (let n = el.parentElement; n && root.contains(n); n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (n !== root && /url\(/.test(cs.backgroundImage)) return null;
      if (n === root) return hexRgb(t.solid);
      const stops = cs.backgroundImage.match(/(rgba?|oklab|color)\([^)]*\)/g);
      if (stops?.length && /gradient/.test(cs.backgroundImage)) {
        const all = stops.map((x) => (x.match(/[\d.]+/g) ?? []).map(Number)).filter((v) => v.length >= 3 && v[0] > 1);
        if (all.length) return [0, 1, 2].map((i) => all.reduce((a, c) => a + c[i], 0) / all.length);
      }
      const c = (cs.backgroundColor.match(/[\d.]+/g) ?? []).map(Number);
      if (c.length >= 3 && (c[3] ?? 1) > 0.5) return c.slice(0, 3);
    }
    return hexRgb(t.solid);
  }
  // Fades and scrims are drawn in the template's ground colour: they take the theme's.
  function themeFades(t) {
    for (const el of root.querySelectorAll('[data-name]')) {
      if (!/^(BK Fade|Scrim|Fade)/i.test(nameOf(el))) continue;
      const bi = getComputedStyle(el).backgroundImage;
      if (!/gradient/.test(bi)) continue;
      keep(el);
      el.style.backgroundImage = el.style.backgroundImage.replace(/var\(--color-(dark|light)-(background|foreground)\)/g, t.solid);
    }
  }
  // Booth stickers (RIBBON) are drawn shapes: they take a fill that stands out from the ground, and
  // what is printed on them takes the colour that reads on that fill (white on royal).
  function themeBadges(t) {
    for (const svg of root.querySelectorAll('svg[data-name^="RIBBON"]')) {
      const paths = [...svg.querySelectorAll('[fill]')].filter((p) => p.getAttribute('fill') !== 'none');
      const ground = groundOf(svg, t);
      const own = hexRgb(paths[0]?.getAttribute('fill'));
      const pick = [own && toHex(paths[0].getAttribute('fill')), t.badge, ...t.fills].filter(Boolean)
        .find((c) => !ground || ratio(hexRgb(c), ground) >= 1.6) ?? t.badge;
      for (const p of paths) setAttr(p, 'fill', pick);
      const box = svg.parentElement;
      const fill = hexRgb(pick);
      const on = ratio(fill, [255, 255, 255]) >= 3 ? '#FFFFFF' : '#00004E';
      for (const n of box.querySelectorAll('*')) {
        if (isSvg(n) || n.children.length || !n.textContent.trim()) continue;
        keep(n); n.style.color = on; n.dataset.onBadge = '';
      }
    }
  }
  // The mascot on each ground, as the Archy brand guidelines (Paper: Mascot · Grounds) say:
  // a light antenna on blue and navy grounds, a dark one on white and light-blue grounds; on Ice the
  // shell gets a barely-there edge (#C3DDF3), on Sky the ears do (they would melt into it), on Blue the
  // body does (#0A30D6). 5 units on the 670 viewBox.
  function themeMascots(preset) {
    const antenna = { dark: '#66BFFF', blue: '#66BFFF', sky: '#00004E', ice: '#00004E', light: '#00004E' }[preset];
    for (const svg of root.querySelectorAll('svg[data-name^="Mascot"]')) {
      const stopOf = (p) => {
        const m = (p.getAttribute('fill') ?? '').match(/url\(#([^)]+)\)/);
        return m ? svg.querySelector(`#${CSS.escape(m[1])} stop`)?.getAttribute('stop-color')?.toLowerCase() ?? '' : '';
      };
      const paths = [...svg.querySelectorAll('path, rect, circle, ellipse')];
      const flat = paths.find((p) => /^#(66bfff|00004e|0000c9)$/i.test(p.getAttribute('fill') ?? ''));
      if (flat && antenna) setAttr(flat, 'fill', antenna);
      const edge = (parts, color) => { for (const p of parts) { setAttr(p, 'stroke', color); setOther(p, 'stroke-width', '5'); setOther(p, 'paint-order', 'stroke'); } };
      const ears = paths.filter((p) => /^#(66bdfd|66bfff)/.test(stopOf(p)));
      const shell = paths.filter((p) => /^#e4f2fd/.test(stopOf(p)));
      const body = paths.filter((p) => /^#(1f6bff|013df5|0a30d6|3d7bff)/.test(stopOf(p)));
      if (preset === 'ice' || preset === 'light') edge(shell, '#C3DDF3');
      if (preset === 'sky') edge(ears, '#0A6FD6');
      if (preset === 'blue') edge(body, '#0A30D6');
    }
  }
  // Hard rule: nothing takes the colour of what is behind it. Pills, badges, containers and buttons
  // whose fill sinks into their ground take the first theme fill that stands out; then every text
  // reads on what is right behind it.
  function keepContrast(t) {
    const els = [...root.querySelectorAll('*')].filter((el) => !isSvg(el) && !inArchyLogo(el) && !inside(el, (n) => DECORATION.test(nameOf(n)) || n.dataset?.slotType === 'image'));
    for (const el of els) {
      const cs = getComputedStyle(el);
      const fill = (cs.backgroundColor.match(/[\d.]+/g) ?? []).map(Number);
      if (fill.length < 3 || (fill[3] ?? 1) < 0.5 || /url\(/.test(cs.backgroundImage)) continue;
      const r0 = el.getBoundingClientRect();
      const R = root.getBoundingClientRect();
      if (r0.height <= 4 || r0.width <= 4) continue; // a line or ruler: subtle on purpose (theme border)
      if (r0.width > R.width * 0.6 && r0.height > R.height * 0.4) continue; // a card or panel, not a pill
      const ground = groundOf(el, t);
      if (!ground || ratio(fill.slice(0, 3), ground) >= 1.25) continue;
      const pick = t.fills.find((c) => ratio(hexRgb(c), ground) >= 1.6);
      if (pick) { keep(el); el.style.backgroundColor = pick; el.style.backgroundImage = 'none'; }
    }
    for (const el of els) {
      if (el.children.length || !el.textContent.trim() || el.dataset.logoMark !== undefined || 'onBadge' in el.dataset) continue;
      const fg = (getComputedStyle(el).color.match(/[\d.]+/g) ?? []).map(Number);
      const own = (getComputedStyle(el).backgroundColor.match(/[\d.]+/g) ?? []).map(Number);
      const ground = own.length >= 3 && (own[3] ?? 1) > 0.5 ? own.slice(0, 3) : groundOf(el, t);
      if (!ground || fg.length < 3 || ratio(fg.slice(0, 3), ground) >= 3) continue;
      // The theme's own label and accent colours are chosen by the brand (light blue labels on Sky,
      // Sky blue labels on white): kept unless they truly vanish.
      const hx = toHex(getComputedStyle(el).color);
      const onGround = ratio(ground, hexRgb(t.solid)) < 1.1;
      if (onGround && (hx === toHex(t.accent) || hx === toHex(t.text)) && ratio(fg.slice(0, 3), ground) >= 1.9) continue;
      const options = ['#FFFFFF', t.text, t.accent, '#00004E', '#013DF5'];
      const best = options.map((c) => [c, ratio(hexRgb(c), ground)]).sort((a, b) => b[1] - a[1])[0][0];
      keep(el); el.style.color = best;
    }
  }

  // Contrast of a text against what is behind it (null when a photo is behind).
  function contrastOf(el) {
    const rgb = (c) => (c.match(/[\d.]+/g) ?? []).map(Number);
    const lum = ([r0, g0, b0]) => [r0, g0, b0].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
    let bg = null;
    for (let n = el; n && !bg; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (/url\(/.test(cs.backgroundImage)) return null;
      const stops = cs.backgroundImage.match(/rgba?\([^)]*\)/g);
      if (stops?.length) { const all = stops.map(rgb); bg = [0, 1, 2].map((i) => all.reduce((a, c) => a + c[i], 0) / all.length); break; }
      const c = rgb(cs.backgroundColor);
      if (c.length >= 3 && (c[3] ?? 1) > 0.5) bg = c;
      if (n === root) break;
    }
    const fg = rgb(getComputedStyle(el).color);
    if (!bg || fg.length < 3) return null;
    const [l1, l2] = [lum(fg), lum(bg)].sort((x, y) => y - x);
    return Math.round(((l1 + 0.05) / (l2 + 0.05)) * 100) / 100;
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

// Moves an element by (dx, dy) on top of the translate it has in the design (Paper places some stickers
// with one, e.g. `calc(-50% + 361px) -132px`): never instead of it, so it stays where it was drawn.
function moveBy(el, dx, dy) {
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

// ---- Reframing a photo inside its frame (Canvas) ----
// The window a photo is seen through: the layer clipped by its clipping ancestors, relative to the layer.
// A photo's frame (the first clipping frame around it, below the artboard) is the window, even where the
// photo layer itself is smaller (a frame made taller by hand): the photo is then grown to fill it.
window.__photoWindow = function photoWindow(el) {
  const E = el.getBoundingClientRect();
  const art = document.querySelector('body > [data-node]');
  let V = { left: E.left, top: E.top, right: E.right, bottom: E.bottom };
  let framed = false;
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    const cs = getComputedStyle(p);
    if (/(hidden|clip)/.test(cs.overflow + cs.overflowX + cs.overflowY)) {
      const b = p.getBoundingClientRect();
      if (!framed && p !== art) { V = { left: b.left, top: b.top, right: b.right, bottom: b.bottom }; framed = true; continue; }
      V = { left: Math.max(V.left, b.left), top: Math.max(V.top, b.top), right: Math.min(V.right, b.right), bottom: Math.min(V.bottom, b.bottom) };
    }
  }
  return { x: V.left - E.left, y: V.top - E.top, w: Math.max(1, V.right - V.left), h: Math.max(1, V.bottom - V.top), E };
};
// A photo can be reframed: a slot photo whose size is known, not a Pixel Tone ground (already cut to its window).
window.__canCrop = (el) => !!el && !!el.dataset.imgW && !el.dataset.toneOwn;
// crop { x, y, zoom }: the photo covers the window at zoom 1; x, y place it like background-position %.
window.__setCrop = function setCrop(el, crop) {
  if (!window.__canCrop(el)) return;
  if (crop.src && el.dataset.slotSrc && crop.src !== el.dataset.slotSrc) return; // another photo (another size): automatic framing
  let W = window.__photoWindow(el);
  // The photo layer covers its whole frame (it may have been left smaller than a frame grown by hand).
  if (W.x < -0.5 || W.y < -0.5 || W.x + W.w > W.E.width + 0.5 || W.y + W.h > W.E.height + 0.5) {
    const cs = getComputedStyle(el), abs = cs.position === 'absolute';
    if (abs && W.x < 0) el.style.left = `${parseFloat(cs.left) + W.x}px`;
    if (abs && W.y < 0) el.style.top = `${parseFloat(cs.top) + W.y}px`;
    el.style.width = `${Math.max(W.E.width - Math.min(0, W.x), W.w + Math.max(0, W.x))}px`;
    el.style.height = `${Math.max(W.E.height - Math.min(0, W.y), W.h + Math.max(0, W.y))}px`;
    el.style.flexShrink = '0';
    W = window.__photoWindow(el);
  }
  const iw = +el.dataset.imgW, ih = +el.dataset.imgH;
  const k = Math.max(W.w / iw, W.h / ih) * (crop.zoom || 1);
  const bw = iw * k, bh = ih * k;
  const px = W.x + (W.w - bw) * (crop.x / 100), py = W.y + (W.h - bh) * (crop.y / 100);
  el.style.backgroundSize = `${bw.toFixed(1)}px ${bh.toFixed(1)}px`;
  el.style.backgroundPosition = `${px.toFixed(1)}px ${py.toFixed(1)}px`;
  el.style.backgroundRepeat = 'no-repeat';
};
// The framing a photo has now (automatic or by hand), as a crop: where a reframe starts.
window.__cropOf = function cropOf(el) {
  if (!window.__canCrop(el)) return null;
  const iw = +el.dataset.imgW, ih = +el.dataset.imgH, W = window.__photoWindow(el), E = W.E;
  const cs = getComputedStyle(el);
  const ew = E.width, eh = E.height;
  let bw, bh;
  const size = cs.backgroundSize.split(',')[0].trim();
  if (size === 'cover' || size === 'contain') {
    const k = size === 'cover' ? Math.max(ew / iw, eh / ih) : Math.min(ew / iw, eh / ih);
    bw = iw * k; bh = ih * k;
  } else {
    const [a, b = 'auto'] = size.split(/\s+/);
    const len = (v, ref) => (v.endsWith('%') ? (parseFloat(v) / 100) * ref : parseFloat(v));
    bw = a === 'auto' ? NaN : len(a, ew); bh = b === 'auto' ? NaN : len(b, eh);
    if (Number.isNaN(bw) && Number.isNaN(bh)) { bw = iw; bh = ih; }
    else if (Number.isNaN(bw)) bw = (bh * iw) / ih;
    else if (Number.isNaN(bh)) bh = (bw * ih) / iw;
  }
  const [px0, py0 = '50%'] = cs.backgroundPosition.split(',')[0].trim().split(/\s+/);
  const pos = (v, room) => (v.endsWith('%') ? (parseFloat(v) / 100) * room : v === 'center' ? room / 2 : v === 'left' || v === 'top' ? 0 : v === 'right' || v === 'bottom' ? room : parseFloat(v));
  const px = pos(px0, ew - bw), py = pos(py0, eh - bh);
  const cover = Math.max(W.w / iw, W.h / ih);
  const pct = (p, room) => (Math.abs(room) < 0.5 ? 50 : Math.max(0, Math.min(100, (p / room) * 100)));
  return { x: +pct(px - W.x, W.w - bw).toFixed(2), y: +pct(py - W.y, W.h - bh).toFixed(2), zoom: +((bw / iw) / cover).toFixed(3) };
};

