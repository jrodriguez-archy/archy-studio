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
      if (type === 'logo') return [add({ id, kind: 'partner', name: `${human((slot ?? 'partner').replace(/^logo-/, ''))} logo`, slot, logoAuto: el.querySelector('[data-logo-mark]')?.dataset.logoAuto })];
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
      // A decoration that holds copy or a photo from the brief (the AE photo on its gradient panel) is
      // not a leaf: what it holds is listed instead.
      if ((DECORATION.test(name) || el.dataset?.optional === 'illustration') && el.querySelector('[data-slot]')) return kids(el).sort(visual).flatMap(walk);
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

  // The same layer in every format of a template: each format is its own page with its own data-node
  // ids, but the Paper layer names (and the slots) repeat. Key: the slot, or the path of layer names from
  // the artboard (with the place among same-named siblings). Plus the text size as filled, so a size
  // changed in one format can follow in proportion in the others.
  window.__keys = function keys() {
    const r = root();
    const out = { [idOf(r)]: { key: ':root' } };
    const visit = (el, path) => {
      const count = {};
      for (const k of kids(el)) {
        const n = nameOf(k);
        count[n] = (count[n] ?? 0) + 1;
        const here = `${path}/${n}#${count[n]}`;
        const slot = k.getAttribute('data-slot');
        const leaf = !isSvg(k) && !k.querySelector('[data-node]') && k.textContent.trim();
        out[idOf(k)] = { key: slot ? `slot:${slot}` : here, ...(leaf ? { fontSize: parseFloat(getComputedStyle(k).fontSize) } : {}) };
        visit(k, here);
      }
    };
    visit(r, '');
    return out;
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

  // For the server (Claude's Canvas tools): each component with what it says, where it sits and where
  // it aligns, and the brand colours by name (aliases that repeat a colour left out).
  window.__inspect = function inspect() {
    const r = root(), R = r.getBoundingClientRect();
    const node = (id) => (id ? r.querySelector(`[data-node="${CSS.escape(id)}"]`) ?? (idOf(r) === id ? r : null) : null);
    const comps = window.__components().comps.map((c) => {
      const el = node(c.id), b = el.getBoundingClientRect();
      const textEl = c.kind === 'button' ? node(c.textId) : c.kind === 'text' ? el : null;
      const cs = getComputedStyle(el);
      const flex = ['group', 'tag', 'button'].includes(c.kind) && cs.display.includes('flex');
      return {
        ...c, text: textEl?.textContent ?? undefined, hidden: cs.display === 'none',
        layout: flex ? `${cs.flexDirection.startsWith('column') ? 'vertical' : 'horizontal'}, ${/space-/.test(cs.justifyContent) ? 'space between' : `packed, gap ${parseFloat(cs.gap) || 0}px`}` : undefined,
        box: { x: Math.round(b.left - R.left), y: Math.round(b.top - R.top), w: Math.round(b.width), h: Math.round(b.height) },
        alignBox: c.kind === 'background' ? null : window.__alignBox(c.id),
      };
    });
    const tokens = {}, seen = new Set();
    for (const sheet of document.styleSheets) {
      let rules; try { rules = sheet.cssRules; } catch { continue; }
      for (const rule of rules) if (rule.selectorText === ':root') for (const p of rule.style) {
        if (!p.startsWith('--color-') || /^--color-(light|dark)-/.test(p)) continue;
        const v = getComputedStyle(document.documentElement).getPropertyValue(p).trim().toUpperCase();
        if (!seen.has(v)) { seen.add(v); tokens[p.slice(8)] = v; }
      }
    }
    return { comps, tokens };
  };

  // The Inspector: design suggestions after hand edits, never a block. It compares with the piece as
  // designed (edits.js keeps each layer's original box, size and line count) so it only speaks about
  // what the edits changed. Each suggestion may carry a fix: a nudge (dx, dy) for that component.
  window.__review = function review(edits, rules, format) {
    const r = root(), R = r.getBoundingClientRect();
    const { comps, safe } = window.__components();
    const W = R.width, H = R.height;
    const node = (id) => r.querySelector(`[data-node="${CSS.escape(id)}"]`);
    const boxOf = (el) => { const b = el.getBoundingClientRect(); return { x: b.left - R.left, y: b.top - R.top, w: b.width, h: b.height }; };
    const baseOf = (el) => { const v = el.dataset?.baseBox?.split(',').map(Number); return v ? { x: v[0], y: v[1], w: v[2], h: v[3] } : null; };
    const touched = new Set(Object.entries(edits ?? {}).filter(([id, e]) => id !== ':theme' && e && Object.keys(e).length).map(([id]) => id));
    const changed = (el) => { for (let n = el; n && n !== r; n = n.parentElement) if (touched.has(idOf(n))) return true; return [...touched].some((id) => el.contains(node(id))); };
    const out = [];
    // Reverts: undo the hand edit that caused a problem (back to the design's value), for the
    // suggestions that have no exact nudge. path: 'box.width', 'style.fontSize'…
    const has = (id, path) => { const [k, f] = path.split('.'); const v = edits?.[id]?.[k]; return f ? v?.[f] != null : v != null; };
    const revertOn = (el, paths, label) => {
      for (let n = el; n && n !== r; n = n.parentElement) {
        const id = idOf(n), fields = id ? paths.filter((p) => has(id, p)) : [];
        if (fields.length) return { revert: { id, fields, label } };
      }
      return {};
    };
    // What pushed something that was not edited itself: the closest earlier sibling branch whose size,
    // type size, layout or copy changed.
    const SIZE = ['box.width', 'box.height', 'box.scale', 'style.fontSize', 'style.fontWeight', 'layout', 'text'];
    const pusher = (el) => {
      for (let n = el; n && n !== r; n = n.parentElement) {
        for (let sib = n.previousElementSibling; sib; sib = sib.previousElementSibling) {
          for (const t of [sib, ...sib.querySelectorAll('[data-node]')]) {
            const id = idOf(t), fields = id ? SIZE.filter((p) => has(id, p)) : [];
            if (fields.length) return { revert: { id, fields, label: 'Undo what pushed it' } };
          }
        }
      }
      return {};
    };
    const inside = (a, b, m = 1) => a.x >= b.x - m && a.y >= b.y - m && a.x + a.w <= b.x + b.w + m && a.y + a.h <= b.y + b.h + m;
    const meet = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
    const pick = (v) => (v && typeof v === 'object' ? v[format] : v);
    const lines = (el) => { const g = document.createRange(); g.selectNodeContents(el); return new Set([...g.getClientRects()].filter((x) => x.width > 0).map((x) => Math.round(x.top / 4))).size || 1; };
    const rgb = (c) => (c.match(/[\d.]+/g) ?? []).map(Number);
    const lum = ([r0, g0, b0]) => [r0, g0, b0].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
    const ground = (el) => {
      for (let n = el; n; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (/url\(/.test(cs.backgroundImage)) return null; // a photo behind: can't judge
        const stops = cs.backgroundImage.match(/rgba?\([^)]*\)/g);
        if (stops?.length) { const all = stops.map(rgb); return [0, 1, 2].map((i) => all.reduce((a, c) => a + c[i], 0) / all.length); }
        const c = rgb(cs.backgroundColor);
        if (c.length >= 3 && (c[3] ?? 1) > 0.5) return c;
        if (n === r) return null;
      }
      return null;
    };
    const visible = comps.filter((c) => c.kind !== 'background' && c.kind !== 'group' && node(c.id) && getComputedStyle(node(c.id)).display !== 'none');
    const solid = visible.filter((c) => ['text', 'button', 'photo', 'partner', 'archy', 'tag', 'icon'].includes(c.kind));
    const boxes = new Map(visible.map((c) => [c.id, boxOf(node(c.id))]));

    const near = new Map();
    const nearMiss = (c, el, b, b0) => {
      let best = null;
      const art = { x: 0, y: 0, w: W, h: H };
      const targets = [
        ...(safe ? [{ name: 'the safe area', now: safe, then: safe }] : []),
        { name: 'the middle of the piece', now: { x: W / 2, y: H / 2, w: 0, h: 0 }, then: { x: W / 2, y: H / 2, w: 0, h: 0 } },
        { name: 'the piece', now: art, then: art },
        ...visible.filter((o) => o.id !== c.id && !el.contains(node(o.id)) && !node(o.id).contains(el))
          .map((o) => ({ name: o.name, now: boxes.get(o.id), then: baseOf(node(o.id)) })).filter((t) => t.then),
      ];
      const edges = (x, axis) => (axis === 'x' ? [x.x, x.x + x.w / 2, x.x + x.w] : [x.y, x.y + x.h / 2, x.y + x.h]);
      for (const axis of ['x', 'y']) {
        if (Math.abs(axis === 'x' ? b.x - b0.x : b.y - b0.y) < 0.5) continue; // it did not move this way
        const p = edges(b, axis), p0 = edges(b0, axis);
        for (const t of targets) {
          const q = edges(t.now, axis), q0 = edges(t.then, axis);
          for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
            if (Math.abs(p0[i] - q0[j]) >= 0.5) continue; // not aligned in the design
            const d = q[j] - p[i];
            if (Math.abs(d) >= 1 && Math.abs(d) <= 8 && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, axis, name: t.name };
          }
        }
      }
      return best;
    };

    for (const c of visible) {
      const el = node(c.id), b = boxes.get(c.id), b0 = baseOf(el);
      if (!b0) continue;
      // Cut off / outside the safe area: also when another edit pushed it there.
      const own = changed(el);
      const moved = own && (Math.abs(b.x - b0.x) > 0.5 || Math.abs(b.y - b0.y) > 0.5);
      // Off the piece, or out of the safe area, when the design had it in.
      if (!inside(b, { x: 0, y: 0, w: W, h: H }) && inside(b0, { x: 0, y: 0, w: W, h: H })) {
        out.push({ id: c.id, level: 'warn', title: `${c.name} is cut off`, detail: own ? 'Part of it falls off the piece.' : 'Another change pushed part of it off the piece.', ...(own ? { fix: { dx: Math.round(Math.min(0, W - b.x - b.w) - Math.min(0, b.x)), dy: Math.round(Math.min(0, H - b.y - b.h) - Math.min(0, b.y)) } } : pusher(el)) });
      } else if (safe && !inside(b, safe, 2) && inside(b0, safe, 2) && c.kind !== 'decoration') {
        out.push({ id: c.id, level: 'warn', title: `${c.name} is outside the safe area`, detail: own ? 'Keep it inside the margins the design uses.' : 'Another change pushed it past the margins.', ...(own ? { fix: { dx: Math.round(Math.min(0, safe.x + safe.w - b.x - b.w) - Math.min(0, b.x - safe.x)), dy: Math.round(Math.min(0, safe.y + safe.h - b.y - b.h) - Math.min(0, b.y - safe.y)) } } : pusher(el)) });
      }
      // Almost aligned: an alignment the design had (an edge or centre shared with another component,
      // the safe area or the middle of the piece) is now off by a few px. Only for what moved, and only
      // design alignments, so fixing one never creates another.
      if (moved && c.kind !== 'decoration') {
        const best = nearMiss(c, el, b, b0);
        if (best) near.set(c.id, best);
      }
      if (!own) continue;
      // Texts: more lines than designed, smaller than readable.
      if (c.kind === 'text') {
        const allowed = Math.max(Number(el.dataset.baseLines) || 1, (c.slot && pick(rules?.slots?.[c.slot]?.maxLines)) || 0);
        const now = lines(el);
        if (now > allowed) out.push({ id: c.id, level: 'warn', title: `${c.name} runs to ${now} lines`, detail: `The design uses ${allowed}. A wider box or a smaller size keeps it tidy.`, ...revertOn(el, ['box.width', 'style.fontSize', 'style.fontWeight'], 'Undo size change') });
        const size = parseFloat(getComputedStyle(el).fontSize), size0 = Number(el.dataset.baseFont) || size;
        const forced = edits?.[c.id]?.style?.fontSize;
        if (c.slot && forced && forced < size0 * 0.85 && !out.some((x) => x.id === c.id)) out.push({ id: c.id, level: 'warn', title: `${c.name} is smaller than the design`, detail: `${Math.round(forced)} px; the design sets it at ${Math.round(size0)} px and never goes below ${Math.round(size0 * 0.85)}.`, revert: { id: c.id, fields: ['style.fontSize'], label: 'Back to design size' }, auto: true });
        if (size < size0 && size < 18 * (W / 1080)) out.push({ id: c.id, level: 'tip', title: `${c.name} is small to read`, detail: `${Math.round(size)} px; keep text at ${Math.round(18 * (W / 1080))} px or more.`, ...revertOn(el, ['style.fontSize'], 'Reset size') });
      }
      if (c.kind === 'archy') {
        const k = b.w / b0.w;
        if (k < 0.6) out.push({ id: c.id, level: 'tip', title: 'The Archy logo is small', detail: `${Math.round(k * 100)}% of its designed size.`, revert: { id: c.id, fields: ['box.scale'], label: 'Reset size' } });
      }
    }

    // Report near misses by cause: when every visible item of a group is off by the same amount, the
    // group moved; one suggestion for the group, fixed by moving the group (its items stay together).
    const under = (id, gid) => { for (let p = comps.find((y) => y.id === id)?.parent; p; p = comps.find((y) => y.id === p)?.parent) if (p === gid) return true; return false; };
    const kidsOf = (gid) => visible.filter((x) => under(x.id, gid));
    const groups = comps.filter((g) => g.kind === 'group' || g.kind === 'tag');
    const taken = new Set();
    for (const g of groups) {
      if (taken.has(g.id)) continue;
      const kids = kidsOf(g.id);
      if (kids.length < 2) continue;
      const first = near.get(kids[0].id);
      if (!first || !kids.every((k) => { const n = near.get(k.id); return n && n.axis === first.axis && Math.abs(n.d - first.d) < 0.5; })) continue;
      for (const k of kids) { near.delete(k.id); taken.add(k.id); }
      for (const sub of groups) if (under(sub.id, g.id)) taken.add(sub.id);
      near.set(g.id, { ...first, group: g.name });
    }
    for (const [id, n] of near) {
      const c = comps.find((x) => x.id === id);
      out.push({ id, level: 'tip', title: `${c.name} is ${Math.abs(Math.round(n.d))} px off ${n.name}`, detail: n.group ? 'Its items moved together; this puts them back in line.' : 'It was aligned with it in the design.', fix: n.axis === 'x' ? { dx: Math.round(n.d), dy: 0 } : { dx: 0, dy: Math.round(n.d) } });
    }

    // Things that now sit on top of each other but did not in the design.
    for (let i = 0; i < solid.length; i++) for (let j = i + 1; j < solid.length; j++) {
      const a = solid[i], c = solid[j], ea = node(a.id), ec = node(c.id);
      if (ea.contains(ec) || ec.contains(ea)) continue;
      const a0 = baseOf(ea), c0 = baseOf(ec);
      // A text is its letters, not its box (a full-width venue line next to a badge does not overlap it).
      const inkOf = (el, c0, box) => {
        if (!['text', 'tag', 'button'].includes(c0.kind)) return [box];
        const rg = document.createRange(); rg.selectNodeContents(el);
        const rs = [...rg.getClientRects()].filter((x) => x.width > 0).map((x) => ({ x: x.left - R.left, y: x.top - R.top, w: x.width, h: x.height }));
        return rs.length ? rs : [box];
      };
      const inkMeet = () => { const A = inkOf(ea, a, boxes.get(a.id)), C = inkOf(ec, c, boxes.get(c.id)); return A.reduce((s0, p) => s0 + C.reduce((s1, q) => s1 + meet(p, q), 0), 0); };
      if (meet(boxes.get(a.id), boxes.get(c.id)) > 16 && a0 && c0 && meet(a0, c0) <= 16 && inkMeet() > 16) {
        const who = changed(ea) ? a : c;
        out.push({ id: who.id, level: 'warn', title: `${a.name} overlaps ${c.name}`, detail: 'Move one of them so both read clearly.', ...revertOn(node(who.id), ['box.dx', 'box.dy', 'box.width', 'box.height', 'style.fontSize'], 'Move back') });
      }
    }

    // Empty space: the content column fills much less than it did as drawn (a type size forced down, a
    // block hidden). The fix undoes the edit that emptied it most.
    const col = r.querySelector('[data-filled]');
    if (col && getComputedStyle(col).display !== 'none') {
      const kids = [...col.children].filter((k) => getComputedStyle(k).position !== 'absolute' && getComputedStyle(k).display !== 'none');
      const cs = getComputedStyle(col), gap = /space-/.test(cs.justifyContent) ? 0 : parseFloat(cs.rowGap) || 0;
      const used = kids.reduce((a, k) => a + k.getBoundingClientRect().height + (k.style.marginTop === 'auto' ? 0 : parseFloat(getComputedStyle(k).marginTop) || 0), 0)
        + gap * Math.max(0, kids.length - 1) + parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
      const filled = Number(col.dataset.filled);
      if (filled && used < filled * 0.85) {
        let cause = null;
        for (const [id, e] of Object.entries(edits ?? {})) {
          const el = node(id);
          if (!el || !col.contains(el)) continue;
          const base = Number(el.dataset.baseFont), now = e.style?.fontSize;
          const loss = e.hidden ? (baseOf(el)?.h ?? 0) : now && base && now < base ? (1 - now / base) * (baseOf(el)?.h ?? 0) : 0;
          if (loss > (cause?.loss ?? 0)) cause = { id, loss, field: e.hidden ? 'hidden' : 'style.fontSize' };
        }
        // Only when a hand edit emptied it (the design fills its own room by itself).
        const name = comps.find((c) => c.id === cause?.id)?.name ?? 'An edit';
        if (cause) out.push({
          id: cause.id, level: 'warn', title: 'Too much empty space',
          detail: `The content fills ${Math.round((used / filled) * 100)}% of the room the design gives it. ${name} is what emptied it most.`,
          revert: { id: cause.id, fields: [cause.field], label: cause.field === 'hidden' ? 'Show it again' : 'Back to design size' }, auto: true,
        });
      }
    }

    // Contrast of every text against what is behind it (themes and colours can change it).
    for (const c of visible.filter((x) => x.kind === 'text' || x.kind === 'button')) {
      const el = c.kind === 'button' ? node(c.textId) : node(c.id);
      if (!el) continue;
      const fg = rgb(getComputedStyle(el).color), bg = ground(el);
      if (!bg || fg.length < 3) continue;
      const [l1, l2] = [lum(fg), lum(bg)].sort((x, y) => y - x);
      const ratio = (l1 + 0.05) / (l2 + 0.05);
      // Only worse than as designed counts (no baseline yet: nothing to compare with).
      const ratio0 = Number(el.dataset.baseContrast);
      if (ratio0 && ratio < 3 && ratio < ratio0 - 0.2) out.push({ id: c.id, level: 'warn', title: `${c.name} is hard to read`, detail: `Low contrast with what is behind it (${ratio.toFixed(1)}:1). Try another colour or theme.`, ...revertOn(el, ['style.color', 'style.backgroundColor'], 'Use the theme colour') });
    }
    return out;
  };

  // Fix all: apply every automatic fix, draw again, review again, until nothing fixable is left (at
  // most 4 rounds). Returns the edits to keep; the page is left as those edits draw it.
  window.__autofix = function autofix(edits, rules, format, urls, icons) {
    const e = JSON.parse(JSON.stringify(edits ?? {}));
    for (let round = 0; round < 4; round++) {
      const review = window.__review(e, rules, format);
      const fixes = review.filter((x) => x.fix && (x.fix.dx || x.fix.dy));
      // Reverts marked auto (a size forced below the design, what emptied the column) are safe to apply.
      const reverts = review.filter((x) => x.auto && x.revert);
      if (!fixes.length && !reverts.length) break;
      for (const { revert: v } of reverts) {
        const one = { ...(e[v.id] ?? {}) };
        for (const f of v.fields) { const [k, sub] = f.split('.'); if (sub) { if (one[k]) { one[k] = { ...one[k] }; delete one[k][sub]; } } else delete one[k]; }
        e[v.id] = one;
      }
      const done = new Set();
      for (const f of fixes) {
        if (done.has(f.id)) continue;
        done.add(f.id);
        const box = { ...(e[f.id]?.box ?? {}) };
        box.dx = Math.round((box.dx ?? 0) + f.fix.dx);
        box.dy = Math.round((box.dy ?? 0) + f.fix.dy);
        e[f.id] = { ...(e[f.id] ?? {}), box };
      }
      window.__applyEdits(e, urls, icons);
    }
    return e;
  };

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
