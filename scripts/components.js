// Runs inside the template page (after __fill), in the Canvas editor and on the server (MCP tools).
// A template is a tree of Paper layers (frames inside frames, "Group", "Vector"…). People edit
// components instead: a text, a button, an icon, a photo, the background, and the named groups that
// hold them (Content, Details, Header…). Generic wrappers stay out of sight. The Archy logo is a
// component too: its drawing is locked; it can only be moved and scaled.
//
// window.__components() → { comps, safe }
//   comps: [{ id, kind, name, parent, slot?, textId?, textSlot?, iconId? }] in visual order
//          kind: background | group | text | button | icon | photo | partner | archy | tag | line | decoration
//   safe:  the safe area (the content frame of the design), in artboard px
// window.__alignBox(id) → the box a component aligns in: its container without padding, or the safe area.
(() => {
  const ARCHY = /^(Logo Archy|Archy Wordmark)/;
  const BUTTON = /^(CTA|Button)$/i;
  const DECORATION = /^(Mascot|Stars|Swoosh|Drinks Pattern|Pixel Dissolve|Rulers|BK Fade|Scrim|RIBBON|Border|Photo Panel|Cocktail|Illustration)/i;
  const LINE = /^(Ruler|Divider|Dot)\b/;
  const GENERIC = /^(Label|Text|Title|Copy|Group|Vector|SVG|Frame|Info|Body|Row|Items|Hero|Mask|Wrapper)$/i;

  const root = () => document.querySelector('body > [data-node]');
  const nameOf = (el) => el.getAttribute('data-name') ?? '';
  const idOf = (el) => el.getAttribute('data-node');
  const isSvg = (el) => el.namespaceURI === 'http://www.w3.org/2000/svg';
  // "slot-text-ae-first-name" → "AE first name", "Photo Panel · Gradient Royal Blue" → "Photo panel", "RIBBON" → "Ribbon".
  const human = (s) => {
    let t = s.replace(/^(slot-(text|image|logo)-|optional-)/, '').replace(/\s*·.*$/, '').replace(/-/g, ' ').trim();
    if (t === t.toUpperCase()) t = t.toLowerCase();
    t = t.replace(/\b(ae|cta|og)\b/gi, (w) => w.toUpperCase());
    return t.charAt(0).toUpperCase() + t.slice(1).replace(/\b([A-Z])([a-z]+)\b/g, (w, a, b) => (/^(AE|CTA|OG)$/.test(w) ? w : a.toLowerCase() + b));
  };
  const fromText = (s) => {
    const t = s.replace(/\s+/g, ' ').trim();
    const short = t.length > 28 ? `${t.slice(0, 27)}…` : t;
    return short === short.toUpperCase() ? short.charAt(0) + short.slice(1).toLowerCase() : short;
  };
  const optionalOf = (el) => el.closest('[data-optional]')?.getAttribute('data-optional') ?? null;
  const hasFill = (el) => { const bg = getComputedStyle(el).backgroundColor; return !!bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent'; };
  const isIcon = (el) => isSvg(el) && (/^Icon/.test(nameOf(el)) || /^Icon$/.test(nameOf(el.parentElement)) || el.getAttribute('viewBox') === '0 0 24 24');
  const firstText = (el) => [...el.querySelectorAll('[data-node]')].find((n) => !isSvg(n) && !n.querySelector('[data-node]') && n.textContent.trim()) ?? null;
  const kids = (el) => [...el.children].filter((c) => c.hasAttribute('data-node'));
  const visual = (a, b) => { const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(); return Math.abs(ra.top - rb.top) > 4 ? ra.top - rb.top : ra.left - rb.left; };

  window.__components = function components() {
    const r = root();
    const comps = [];
    const add = (c) => { comps.push(c); return c.id; };

    // Each element gives back the items it puts at its level: one component, a group, or (for a plain
    // wrapper) the items of its children, flattened.
    const walk = (el) => {
      const name = nameOf(el);
      const type = el.dataset?.slotType;
      const slot = el.dataset?.slot;
      const id = idOf(el);
      if (ARCHY.test(name)) return [add({ id, kind: 'archy', name: 'Archy logo' })];
      if (type === 'logo') return [add({ id, kind: 'partner', name: `${human((slot ?? 'partner').replace(/^logo-/, ''))} logo`, slot })];
      if (type === 'image') {
        const what = human((slot ?? 'photo').replace(/^image-/, ''));
        return [add({ id, kind: 'photo', name: /^photo$/i.test(what) ? 'Photo' : `${what} photo`, slot })];
      }
      if (type === 'text') return [add({ id, kind: 'text', name: human(slot), slot })];
      if (BUTTON.test(name)) {
        const t = firstText(el), icon = el.querySelector('svg[data-node]');
        return [add({ id, kind: 'button', name: t ? fromText(t.textContent) : 'Button', textId: t ? idOf(t) : undefined, textSlot: t?.dataset.slot, iconId: icon ? idOf(icon) : undefined })];
      }
      if (isSvg(el) && isIcon(el)) {
        const own = name.replace(/^Icon\s*·?\s*/, '').trim();
        const label = own && !GENERIC.test(own) ? own : optionalOf(el) ?? nameOf(el.closest('[data-name^="Benefit"]') ?? el).replace(/^Benefit\s*·\s*/, '');
        return [add({ id, kind: 'icon', name: label && !GENERIC.test(label) && !/^Icon/.test(label) ? `${human(label)} icon` : 'Icon' })];
      }
      if (LINE.test(name)) return [add({ id, kind: 'line', name: name.startsWith('Dot') ? 'Dot' : 'Line' })];
      if (DECORATION.test(name) || el.dataset?.optional === 'illustration') return [add({ id, kind: 'decoration', name: human(name) })];
      if (isSvg(el)) return [add({ id, kind: 'decoration', name: GENERIC.test(name) ? 'Graphic' : human(name) })];
      const children = kids(el);
      if (!children.length && el.textContent.trim()) {
        // Field labels set in capitals ("LOCATION", "BOOTH") read as labels.
        const caps = el.textContent.trim() === el.textContent.trim().toUpperCase() || getComputedStyle(el).textTransform === 'uppercase';
        const n = GENERIC.test(name) || !name || caps ? fromText(el.textContent) : human(name);
        return [add({ id, kind: 'text', name: caps && el.textContent.trim().length <= 24 ? `${n} label` : n })];
      }
      if (!children.length && /url\(/.test(getComputedStyle(el).backgroundImage)) return [add({ id, kind: 'decoration', name: GENERIC.test(name) ? 'Image' : human(name) })];
      if (!children.length) return [];

      // A container: a pill, plate or badge with its own fill (tag), a named frame holding several
      // things (group), or a wrapper that is flattened away.
      const opt = el.dataset?.optional;
      const tag = opt && hasFill(el);
      const at = comps.length;
      const own = { id, kind: tag ? 'tag' : 'group', name: tag ? `${human(opt)} tag` : human(name || 'Group') };
      if (tag) comps.push(own);
      const items = children.sort(visual).flatMap(walk);
      const named = name && !GENERIC.test(name) && !/^TPL/.test(name);
      if (!tag && !(named && items.length >= 2)) return items;
      if (!tag) comps.splice(at, 0, own);
      for (const c of comps) if (items.includes(c.id) && c.parent === undefined) c.parent = id;
      return [id];
    };

    comps.push({ id: idOf(r), kind: 'background', name: 'Background', parent: null });
    kids(r).sort(visual).forEach(walk);
    for (const c of comps) c.parent ??= null; // top level
    // Repeated names of the same kind get a number ("Line 2"); "Date • Group" and "Date • Text" can share one.
    const key = (c) => `${c.kind}:${c.name}`;
    const count = {};
    for (const c of comps) count[key(c)] = (count[key(c)] ?? 0) + 1;
    const seen = {};
    for (const c of comps) if (count[key(c)] > 1) { const k = key(c); seen[k] = (seen[k] ?? 0) + 1; c.name = `${c.name} ${seen[k]}`; }
    return { comps, safe: safeArea() };
  };

  // The safe area: the design's content frame (an absolute "Content" frame on the artboard); without
  // one, the smallest margin the design keeps around its texts.
  function safeArea() {
    const r = root(), R = r.getBoundingClientRect();
    const frames = kids(r).filter((k) => /^Content/.test(nameOf(k)) && getComputedStyle(k).position === 'absolute');
    if (frames.length) {
      const rs = frames.map((f) => f.getBoundingClientRect());
      const x = Math.min(...rs.map((b) => b.left)) - R.left, y = Math.min(...rs.map((b) => b.top)) - R.top;
      return { x, y, w: Math.max(...rs.map((b) => b.right)) - R.left - x, h: Math.max(...rs.map((b) => b.bottom)) - R.top - y, name: 'the content area' };
    }
    const texts = [...r.querySelectorAll('[data-slot-type="text"]')].map((t) => t.getBoundingClientRect()).filter((b) => b.width);
    const m = texts.length ? Math.max(24, Math.min(...texts.map((b) => Math.min(b.left - R.left, R.right - b.right)))) : Math.round(R.width * 0.08);
    return { x: m, y: m, w: R.width - 2 * m, h: R.height - 2 * m, name: 'the safe area' };
  }

  // Where "align" puts a component: inside its nearest container that has room (without its padding),
  // or the safe area when that container is the artboard itself.
  window.__alignBox = function alignBox(id) {
    const r = root(), R = r.getBoundingClientRect();
    const el = r.querySelector(`[data-node="${CSS.escape(id)}"]`);
    if (!el) return null;
    const e = el.getBoundingClientRect();
    for (let p = el.parentElement; p && p !== r; p = p.parentElement) {
      const b = p.getBoundingClientRect(), cs = getComputedStyle(p);
      const x = b.left + parseFloat(cs.paddingLeft), y = b.top + parseFloat(cs.paddingTop);
      const w = b.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight), h = b.height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      if (w > e.width + 1 || h > e.height + 1) return { x: x - R.left, y: y - R.top, w, h, name: human(nameOf(p)) || 'its container' };
    }
    return safeArea();
  };
})();
