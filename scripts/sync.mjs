#!/usr/bin/env node
// Paper template → self-contained HTML per format, with slot annotations.
// Usage: node scripts/sync.mjs templates/<id> [--offline]
//   --offline rebuilds from source/*.json without calling Paper.
import fs from 'node:fs/promises';
import path from 'node:path';
import { call, callJSON } from './paper.mjs';

const dir = path.resolve(process.argv[2] ?? '');
const offline = process.argv.includes('--offline');
const config = JSON.parse(await fs.readFile(path.join(dir, 'template.config.json'), 'utf8'));
const fileId = config.paperFileId;
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

// ---------- 1. Dump from Paper ----------
async function dump(rootId) {
  const nodes = {};
  const svgs = {};
  async function walk(id) {
    const info = await callJSON('get_node_info', { fileId, nodeId: id });
    const node = {
      id, name: info.name, component: info.component, visible: info.isVisible,
      text: info.textContent ?? null, children: [],
    };
    nodes[id] = node;
    if (info.component === 'SVG') {
      svgs[id] = await call('get_jsx', { fileId, nodeId: id, format: 'inline-styles' });
      return;
    }
    if (info.childCount > 0) {
      const { children } = await callJSON('get_children', { fileId, nodeId: id });
      node.children = children.map((c) => c.id);
      for (const c of node.children) await walk(c);
    }
  }
  await walk(rootId);
  const { styles } = await callJSON('get_computed_styles', { fileId, nodeIds: Object.keys(nodes) });
  const tokensCss = await call('get_tokens', { fileId, format: 'css' });
  return { rootId, nodes, styles, svgs, tokensCss };
}

// ---------- 2. Helpers ----------
const PX_PROPS = new Set(['left', 'top', 'right', 'bottom', 'width', 'height']);
const kebab = (s) => s.replace(/^(Webkit|Moz)/, (m) => `-${m.toLowerCase()}`).replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Paper writes face aliases ("Inter-Regular_Medium"); the weight already lives in fontWeight.
function normalizeFontFamily(v) {
  const fams = v.split(',').map((f) => f.trim());
  const keep = fams.filter((f) => !/^"[^"]+[-_][^"]+"$/.test(f) || !fams.some((g) => g !== f && f.startsWith(g.replace(/"$/, ''))));
  return keep.join(', ');
}

function cssText(style, { root = false } = {}) {
  const out = [];
  for (let [k, v] of Object.entries(style)) {
    if (root && ['position', 'left', 'top'].includes(k)) continue;
    if (typeof v === 'number' && PX_PROPS.has(k)) v = `${v}px`;
    if (k === 'fontFamily') v = normalizeFontFamily(v);
    out.push(`${kebab(k)}: ${v}`);
  }
  if (root) out.push('position: relative');
  return out.join('; ');
}

const SVG_CAMEL_OK = new Set(['viewBox', 'preserveAspectRatio', 'gradientUnits', 'gradientTransform', 'patternUnits',
  'patternContentUnits', 'patternTransform', 'clipPathUnits', 'maskUnits', 'maskContentUnits', 'spreadMethod',
  'stdDeviation', 'baseFrequency', 'numOctaves', 'filterUnits', 'primitiveUnits', 'textLength', 'lengthAdjust',
  'startOffset', 'markerWidth', 'markerHeight', 'refX', 'refY', 'pathLength']);

// get_jsx SVG → plain SVG markup. var() in presentation attributes is resolved to the token value.
function svgFromJsx(jsx, tokens, extraAttrs, computedStyle) {
  let s = jsx.trim().replace(/^\(\s*/, '').replace(/\s*\)\s*$/, '');
  let svgStyle = {};
  s = s.replace(/style=\{\{(.*?)\}\}/s, (_, obj) => {
    svgStyle = Function(`return ({${obj}})`)();
    return '__STYLE__';
  });
  s = s.replace(/\s([a-z]+[A-Z][A-Za-z]*)=/g, (m, a) => (SVG_CAMEL_OK.has(a) ? m : ` ${kebab(a)}=`));
  s = s.replace(/="var\((--[\w-]+)\)"/g, (m, t) => (tokens[t] ? `="${tokens[t]}"` : m));
  s = s.replace(/\{'(\s*)'\}/g, '$1');
  const style = cssText({ ...computedStyle, ...svgStyle });
  s = s.replace('__STYLE__', `style="${esc(style)}" ${extraAttrs}`);
  return s;
}

const urlOf = (bg) => bg?.match(/url\(([^)]+)\)/)?.[1];

// ---------- 3. Build HTML ----------
async function build(format, d) {
  const tokens = Object.fromEntries([...d.tokensCss.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
  const slots = {};
  const optionals = {};

  // Image slots: the photo is the image inside the `slot-image-*` frame; every node showing the same
  // picture (e.g. Stories "Photo Pop-out") is bound to the same slot.
  const imageSlotByUrl = {};
  for (const n of Object.values(d.nodes)) {
    const m = n.name.match(/^slot-image-([\w-]+)/);
    if (!m) continue;
    // Preferred: the image layer itself is named slot-image-<role>. Legacy: a frame holding it.
    const own = urlOf(d.styles[n.id]?.backgroundImage);
    if (own) { imageSlotByUrl[own] = m[1]; continue; }
    const stack = [...n.children];
    while (stack.length) {
      const c = d.nodes[stack.shift()];
      const u = urlOf(d.styles[c.id]?.backgroundImage);
      if (c.component === 'Rectangle' && u) { imageSlotByUrl[u] = m[1]; break; }
      stack.push(...c.children);
    }
  }

  // Localize every image asset.
  const assetMap = {};
  for (const st of Object.values(d.styles)) {
    const u = urlOf(st.backgroundImage);
    if (u && !assetMap[u]) assetMap[u] = `assets/${path.basename(new URL(u).pathname)}`;
  }
  if (!offline) {
    for (const [u, rel] of Object.entries(assetMap)) {
      const dest = path.join(dir, rel);
      try { await fs.access(dest); continue; } catch {}
      const res = await fetch(u, { headers: { 'User-Agent': UA } });
      if (!res.ok) throw new Error(`Asset ${u}: ${res.status}`);
      await fs.writeFile(dest, Buffer.from(await res.arrayBuffer()));
    }
  }

  function render(id, depth) {
    const n = d.nodes[id];
    if (!n.visible) return '';
    const st = { ...(d.styles[id] ?? {}) };
    const u = urlOf(st.backgroundImage);
    if (u) st.backgroundImage = `url(${assetMap[u]})`;
    const attrs = [`data-node="${id}"`, `data-name="${esc(n.name)}"`];
    let m;
    if ((m = n.name.match(/^slot-text-([\w-]+)/))) {
      attrs.push(`data-slot="${m[1]}"`, 'data-slot-type="text"');
      slots[m[1]] = { type: 'text', default: n.text, style: pick(st, ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing']) };
    }
    if (u && imageSlotByUrl[u]) {
      const role = imageSlotByUrl[u];
      attrs.push(`data-slot="${role}"`, 'data-slot-type="image"');
      slots[role] ??= { type: 'image', default: assetMap[u], nodes: 0 };
      slots[role].nodes++;
    }
    if ((m = n.name.match(/^optional-([\w-]+)/))) {
      attrs.push(`data-optional="${m[1]}"`);
      optionals[m[1]] = { contains: [] };
    }
    const pad = '  '.repeat(depth);
    if (n.component === 'SVG') {
      return pad + svgFromJsx(d.svgs[id], tokens, attrs.join(' '), d.styles[id] ?? {}) + '\n';
    }
    const style = cssText(st, { root: id === d.rootId });
    if (n.component === 'Text') {
      return `${pad}<div ${attrs.join(' ')} style="${esc(style)}">${esc(n.text ?? '')}</div>\n`;
    }
    const kids = n.children.map((c) => render(c, depth + 1)).join('');
    return `${pad}<div ${attrs.join(' ')} style="${esc(style)}">\n${kids}${pad}</div>\n`;
  }

  const body = render(d.rootId, 2);
  // Which slots live inside each optional block (so the renderer knows what removing it means).
  for (const n of Object.values(d.nodes)) {
    const m = n.name.match(/^optional-([\w-]+)/);
    if (!m) continue;
    const stack = [...n.children];
    while (stack.length) {
      const c = d.nodes[stack.shift()];
      const s = c.name.match(/^slot-text-([\w-]+)/);
      if (s) optionals[m[1]].contains.push(s[1]);
      stack.push(...c.children);
    }
  }

  const rootStyle = d.styles[d.rootId];
  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${esc(config.title)} · ${esc(config.formats[format].label)}</title>
<link rel="stylesheet" href="../../fonts/fonts.css">
<style>
${d.tokensCss.trim()}
html, body { margin: 0; padding: 0; background: transparent; }
* { box-sizing: border-box; }
[data-node="${d.rootId}"], [data-node="${d.rootId}"] * {
  font-synthesis: none; overflow-wrap: anywhere;
  /* Paper does not apply optical sizing (Inter 4 renders at opsz 14 at every size). */
  font-optical-sizing: none;
  -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;
}
</style>
</head>
<body>
${body}</body>
</html>
`;
  await fs.writeFile(path.join(dir, `${format}.html`), html);
  return { width: parseInt(rootStyle.width), height: parseInt(rootStyle.height), slots, optionals };
}

function pick(o, keys) {
  return Object.fromEntries(keys.filter((k) => o[k] != null).map((k) => [k, o[k]]));
}

// ---------- main ----------
const manifest = { id: config.id, title: config.title, description: config.description, formats: {}, slots: {}, optionals: {} };
for (const [format, { nodeId, label }] of Object.entries(config.formats)) {
  const srcFile = path.join(dir, 'source', `${format}.json`);
  let d;
  if (offline) d = JSON.parse(await fs.readFile(srcFile, 'utf8'));
  else {
    d = await dump(nodeId);
    await fs.writeFile(srcFile, JSON.stringify(d, null, 2));
  }
  const r = await build(format, d);
  manifest.formats[format] = { label, width: r.width, height: r.height, html: `${format}.html` };
  for (const [role, s] of Object.entries(r.slots)) {
    manifest.slots[role] ??= { type: s.type, default: s.default, perFormat: {} };
    manifest.slots[role].perFormat[format] = s.style ?? { nodes: s.nodes };
  }
  Object.assign(manifest.optionals, r.optionals);
  console.log(`${format}: ${r.width}×${r.height}, slots: ${Object.keys(r.slots).join(', ')}`);
}
await fs.writeFile(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log('manifest.json written');
