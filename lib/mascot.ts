// Archy, the mascot (Paper › Archy - Brand › Mascot): the master drawing, its four expressions, and how he
// sits on each ground. Explorations place him with data-piece="mascot" (lib/compose.ts); the rules here are
// the brand's (brand skill, composition.md › The mascot):
// - one construction: short antenna, the wider shell; head only 670.54 × 444, full body 670.54 × 644
// - the antenna points into the canvas: off the top he is upside down, off a side turned 90°, off the bottom upright
// - about two thirds of him shows; the crop never touches the eyes; in a bleed the eyes rise 50 units
// - antenna colour follows the ground; a part that matches the ground gets a barely-there edge (5 units)

export const HEAD = { w: 670.54, h: 444 };
export const BODY = { w: 670.54, h: 644 };
export const EXPRESSIONS = ['neutral', 'happy', 'joyful', 'love'] as const;
export type Expression = (typeof EXPRESSIONS)[number];
export const BLEEDS = ['top', 'right', 'left', 'bottom', 'none'] as const;
export type Bleed = (typeof BLEEDS)[number];
export type MascotGround = 'royal' | 'primary' | 'navy' | 'white' | 'ice' | 'tint-300';

// Eye centres (head units): where the crop must never reach.
export const EYES = { y: 243.59, r: 43, xs: [235.15, 435.39] };
export const RAISE = 50;

const EAR_L = 'M152.52,173.91h0c10.58.08,20.74,2.46,30.21,7.1,1.44.71,2.87,1.47,4.25,2.27,20.49,11.87,33.5,33.04,34.81,56.65.07,1.31.11,2.62.11,3.93,0,25.76-14.08,49.36-36.73,61.62-9.970,5.39-21.26,8.27-32.65,8.35h0s-.47,0-.47,0c0,0,0,0,0,0h-82.66c-10.58-.08-20.74-2.46-30.21-7.1-1.44-.71-2.87-1.47-4.25-2.27C14.43,292.6,1.42,271.42.11,247.81c-.07-1.31-.11-2.62-.11-3.93,0-25.76,14.08-49.36,36.73-61.62,9.97-5.39,21.26-8.27,32.65-8.35h0s.47,0,.47,0h82.67';
const EAR_R = 'M601.16,173.91h0c10.58.08,20.74,2.46,30.21,7.1,1.44.71,2.87,1.47,4.25,2.27,20.49,11.87,33.5,33.04,34.81,56.65.07,1.31.11,2.62.11,3.93,0,25.76-14.08,49.36-36.73,61.62-9.97,5.39-21.26,8.27-32.65,8.35h0s-.47,0-.47,0c0,0,0,0,0,0h-82.66c-10.58-.08-20.74-2.46-30.21-7.1-1.44-.71-2.87-1.47-4.25-2.27-20.49-11.87-33.5-33.04-34.81-56.65-.07-1.31-.11-2.62-.11-3.93,0-25.76,14.08-49.36,36.73-61.62,9.97-5.39,21.26-8.27,32.65-8.35h0s.47,0,.47,0h82.67';
// The short antenna (24 units wide), as the master draws it.
const ANTENNA = 'M 335.27 53.41 c -6.63 0 -12 -5.37 -12 -12 V 12 c 0 -6.63 5.37 -12 12 -12 s 12 5.37 12 12 v 29.41 c 0 6.63 -5.37 12 -12 12 Z';
const SHELL = 'M420.55,44.41h-170.57c-.49,0-.99,0-1.48.02-32.16.4-63.98,8.64-92.12,23.86-64.56,34.93-104.67,102.22-104.67,175.61,0,3.52.1,7.21.29,10.96,0,.07,0,.14.01.21,3.75,67.31,40.84,127.68,99.23,161.51,3.94,2.29,8.02,4.47,12.13,6.49.01,0,.03.01.04.02,26.59,13.02,55.09,19.82,84.74,20.23.61.02,1.21.03,1.82.03h169.59s.1,0,.15,0h.83c.49,0,.98,0,1.47-.02,32.16-.4,64-8.640,92.13-23.86,64.56-34.93,104.67-102.22,104.67-175.61,0-3.52-.1-7.21-.29-10.96,0-.07,0-.14-.01-.21-3.75-67.31-40.84-127.68-99.23-161.51-3.94-2.29-8.02-4.47-12.13-6.49-.01,0-.03-.01-.04-.02-26.59-13.02-55.09-19.82-84.74-20.23-.61-.02-1.21-.03-1.82-.03h0Z';
const PLATE = 'M420.55,100.33h0c21.7.16,42.55,5.05,61.98,14.56,2.96,1.45,5.89,3.02,8.73,4.67,42.03,24.35,68.73,67.79,71.43,116.23.14,2.68.22,5.38.22,8.06,0,52.85-28.88,101.28-75.35,126.42-20.46,11.07-43.62,16.97-66.99,17.13h0s-.96,0-.96,0c0,0-.01,0-.02,0h-169.59c-21.7-.16-42.55-5.05-61.98-14.56-2.96-1.45-5.89-3.02-8.73-4.67-42.03-24.350-68.73-67.79-71.43-116.23-.14-2.68-.22-5.38-.22-8.06,0-52.85,28.88-101.28,75.35-126.42,20.46-11.07,43.62-16.97,66.99-17.13h0s.96,0,.96,0h169.61';
const BODY_CAPSULE = 'M447.99,463.32h0c13.64.1,26.75,3.17,38.96,9.15,1.86.91,3.7,1.9,5.49,2.93,26.42,15.31,43.21,42.62,44.91,73.08.09,1.69.14,3.38.14,5.07,0,33.23-18.16,63.67-47.38,79.48-12.86,6.96-27.43,10.67-42.12,10.77h0s-.6,0-.6,0c0,0,0,0-.01,0h-224.84c-13.64-.1-26.75-3.17-38.96-9.15-1.86-.91-3.7-1.9-5.49-2.93-26.42-15.31-43.21-42.62-44.91-73.08-.09-1.69-.14-3.38-.14-5.07,0-33.23,18.16-63.67,47.37-79.48,12.86-6.96,27.43-10.67,42.12-10.77h0s.61,0,.61,0h224.85';
const BODY_MARK = 'M304.84,601.66c0-16.76,13.65-30.39,30.43-30.39s30.43,13.63,30.43,30.39v6.74h19.87v-59.43c0-8.31-2.07-16.55-6.01-23.82-8.81-16.29-25.78-26.41-44.3-26.41-.94,0-1.89.03-2.83.08-16.98.95-32.2,10.3-40.73,25.03-.58.99-1.13,2.02-1.64,3.060-3.38,6.91-5.1,14.33-5.1,22.06v59.43h19.87v-6.74ZM304.84,548.96c0-4.69,1.04-9.17,3.08-13.34.31-.63.64-1.25.99-1.85,5.16-8.92,14.38-14.58,24.64-15.15.57-.03,1.16-.05,1.73-.05,11.21,0,21.47,6.12,26.8,15.99,2.37,4.39,3.63,9.37,3.63,14.4v12.73c-8.46-6.44-19-10.27-30.43-10.27s-21.97,3.83-30.43,10.27v-12.73Z';

// The eyes of each expression (a gradient pair each, left and right).
const EYE_PATHS: Record<Expression, { left: string; right: string; grads: [number[], number[]]; transform?: string }> = {
  neutral: {
    left: '<circle cx="235.15" cy="243.59" r="42.99" fill="url(#ID-eyeL)"/>', right: '<circle cx="435.39" cy="243.59" r="42.99" fill="url(#ID-eyeR)"/>',
    grads: [[204.75, 213.19, 265.55, 273.99], [404.99, 213.19, 465.79, 273.99]],
  },
  happy: {
    left: '<path d="M266.97,226.8c-9.53-17.62-27.89-28.57-47.93-28.57-1.02,0-2.04.03-3.06.08-18.37,1.02-34.84,11.14-44.07,27.08-.63,1.08-1.22,2.19-1.77,3.31-3.66,7.48-5.52,15.51-5.52,23.87v.19h21.5v-.19c0-5.07,1.12-9.92,3.33-14.43.33-.68.69-1.35,1.07-2,5.59-9.650,15.56-15.78,26.66-16.39.62-.04,1.25-.05,1.87-.05,12.12,0,23.23,6.63,29,17.3,2.57,4.75,3.92,10.14,3.92,15.58v.19h21.5v-.19c0-8.99-2.24-17.91-6.5-25.77Z" fill="url(#ID-eyeL)"/>',
    right: '<path d="M451.37,226.8c-9.53-17.62-27.89-28.57-47.93-28.57-1.02,0-2.04.03-3.06.08-18.37,1.02-34.84,11.14-44.07,27.08-.63,1.08-1.22,2.19-1.77,3.31-3.66,7.48-5.52,15.51-5.52,23.87v.19h21.5v-.19c0-5.07,1.12-9.92,3.33-14.43.33-.68.69-1.35,1.07-2,5.59-9.65,15.56-15.78,26.66-16.39.62-.04,1.25-.05,1.87-.05,12.12,0,23.230,6.63,29,17.3,2.57,4.75,3.92,10.14,3.92,15.58v.19h21.5v-.19c0-8.99-2.24-17.91-6.5-25.77Z" fill="url(#ID-eyeR)"/>',
    grads: [[164.62, 225.49, 273.47, 225.49], [349.02, 225.49, 457.87, 225.49]], transform: 'matrix(1.045 0 0 1.045 11.74 5.4)',
  },
  joyful: {
    left: '<path d="M172.59,240.81c0-6.87,1.52-13.44,4.51-19.56.45-.92.94-1.83,1.45-2.71,7.57-13.08,21.08-21.38,36.13-22.22.84-.05,1.69-.07,2.53-.07,16.43,0,31.48,8.98,39.3,23.44,3.48,6.44,5.32,13.74,5.32,21.12v18.67c-12.4-9.44-27.86-15.05-44.62-15.05s-32.22,5.62-44.62,15.05v-18.67Z" fill="url(#ID-eyeL)"/>',
    right: '<path d="M357.16,240.81c0-6.87,1.52-13.44,4.51-19.56.45-.92.94-1.83,1.45-2.71,7.57-13.08,21.08-21.38,36.13-22.22.84-.05,1.69-.07,2.53-.07,16.43,0,31.48,8.98,39.3,23.44,3.48,6.44,5.32,13.74,5.32,21.12v18.67c-12.4-9.44-27.86-15.05-44.62-15.05s-32.22,5.62-44.62,15.05v-18.67Z" fill="url(#ID-eyeR)"/>',
    grads: [[185.61, 209.33, 248.8, 272.51], [370.18, 209.33, 433.37, 272.51]], transform: 'matrix(1.045 0 0 1.045 11.74 5.4)',
  },
  love: {
    left: '<path d="M286.7,248.18c-9.32,18.32-29.04,28.97-47.06,37.96-18.02-8.99-37.74-19.63-47.06-37.96-8.6-15.9-6.93-39.61,12.22-45.38,14.37-4.37,27.66,3.81,34.84,15.89,7.18-12.09,20.47-20.26,34.84-15.89,19.15,5.76,20.81,29.48,12.22,45.38h0Z" fill="url(#ID-eyeL)"/>',
    right: '<path d="M477.95,248.18c-9.32,18.32-29.04,28.97-47.06,37.96-18.02-8.99-37.74-19.63-47.06-37.96-8.6-15.9-6.93-39.61,12.22-45.38,14.37-4.37,27.66,3.81,34.84,15.89,7.18-12.09,20.47-20.26,34.84-15.89,19.15,5.76,20.81,29.48,12.22,45.38h0Z" fill="url(#ID-eyeR)"/>',
    grads: [[187.63, 243.87, 291.66, 243.87], [378.87, 243.87, 482.91, 243.87]],
  },
};

// The ground decides the antenna and which part, if any, gets its tone-matched edge (5 units).
function looks(ground: MascotGround) {
  const light = ground === 'white' || ground === 'ice';
  return {
    antenna: light ? '#00004E' : '#66BFFF',
    shellEdge: ground === 'ice' ? '#C3DDF3' : null,
    earEdge: ground === 'tint-300' ? '#4DA8F0' : null,
    bodyEdge: ground === 'royal' ? '#0A30D6' : null,
  };
}

const grad = (id: string, [x1, y1, x2, y2]: number[], a: string, b: string) =>
  `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;

/** The mascot as an SVG (head, or the full body), for one ground, with the eyes raised when he bleeds. */
export function mascotSvg(input: { id: string; form: 'head' | 'body'; expression: Expression; ground: MascotGround; raise: boolean }): string {
  const { id, form, expression, ground, raise } = input;
  const L = looks(ground);
  const E = EYE_PATHS[expression];
  const box = form === 'body' ? BODY : HEAD;
  const edge = (c: string | null) => (c ? ` stroke="${c}" stroke-width="5"` : '');
  const defs = [
    grad(`${id}-earL`, [110.95, 173.91, 110.95, 313.84], '#66bdfd', '#0193fd'),
    grad(`${id}-earR`, [559.59, 173.91, 559.59, 313.84], '#66bdfd', '#0193fd'),
    grad(`${id}-shell`, [152.14, 60.74, 518.4, 427], '#e4f2fd', '#cae8fd'),
    grad(`${id}-plate`, [191.68, 100.29, 478.85, 387.46], '#000483', '#00004e'),
    grad(`${id}-eyeL`, E.grads[0], '#8addff', '#66bdfd'),
    grad(`${id}-eyeR`, E.grads[1], '#8addff', '#66bdfd'),
    ...(form === 'body' ? [grad(`${id}-body`, [215.44, 433.74, 455.09, 673.39], '#0492fc', '#033cf1')] : []),
  ].join('');
  const eyes = `<g transform="translate(0 ${raise ? -RAISE : 0})${E.transform ? ` ${E.transform}` : ''}" data-part="eyes">${(E.left + E.right).replace(/ID-/g, `${id}-`)}</g>`;
  const body = form === 'body'
    ? `<path d="${BODY_CAPSULE}" fill="url(#${id}-body)"${edge(L.bodyEdge)}/><path d="${BODY_MARK}" fill="#e2f1fd"/>`
    : '';
  return `<svg viewBox="0 0 ${box.w} ${box.h}" width="100%" height="100%" overflow="visible" xmlns="http://www.w3.org/2000/svg" style="display:block; overflow:visible"><defs>${defs}</defs>`
    + `<path d="${EAR_L}" fill="url(#${id}-earL)"${edge(L.earEdge)}/><path d="${EAR_R}" fill="url(#${id}-earR)"${edge(L.earEdge)}/>`
    + `<path d="${ANTENNA}" fill="${L.antenna}" data-part="antenna"/>`
    + `<path d="${SHELL}" fill="url(#${id}-shell)"${edge(L.shellEdge)}/><path d="${PLATE}" fill="url(#${id}-plate)"/>`
    + eyes + body + '</svg>';
}

/**
 * Where the mascot's box goes on the artboard for a bleed, and its rotation. `size` is his width (the
 * head's 670.54 units); `at` is where his centre sits along the edge; `show` how much of him is in
 * (about two thirds). Off the top he is upside down, off a side turned 90° with the antenna inward.
 */
export function bleedBox(input: { bleed: Bleed; size: number; at: number; show: number; artboard: { width: number; height: number }; form: 'head' | 'body' }) {
  const { bleed, size: W, at, artboard } = input;
  const box = input.form === 'body' ? BODY : HEAD;
  const H = (W * box.h) / box.w;
  const f = Math.min(0.8, Math.max(0.55, input.show));
  if (bleed === 'top') return { left: at - W / 2, top: -(1 - f) * H, width: W, height: H, rotate: 180 };
  if (bleed === 'bottom') return { left: at - W / 2, top: artboard.height - f * H, width: W, height: H, rotate: 0 };
  // Turned 90°: his box is W wide unrotated, H wide on the artboard; its centre stays put.
  const cx = bleed === 'right' ? artboard.width - f * H + H / 2 : f * H - H / 2;
  return { left: cx - W / 2, top: at - H / 2, width: W, height: H, rotate: bleed === 'right' ? -90 : 90 };
}
