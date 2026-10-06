// Archy Pixel Gradient as a live shader, faithful to the brand tool (archy-design: tools/pixel/pixel.py):
// six Gaussian blobs (presets.json recipe.blobs), scale 1.08, ordered 8x8 Bayer dithering into a short
// tone ramp. On top, a cursor field dithered with the same Bayer matrix into Archy's blue ramp, so the
// blue appears as pixels that follow the pointer and dissolve at the edges.

// recipe.blobs: [x, y, radius, weight] in a 0..1 frame.
export const BLOBS: [number, number, number, number][] = [
  [0.650115, 0.976657, 0.335137, 0.720067],
  [0.948264, -0.093682, 0.344246, -0.918828],
  [0.461522, 0.263639, 0.235685, 0.778031],
  [0.505458, 0.564197, 0.3791, -0.917065],
  [0.646615, 1.086752, 0.223062, 0.845016],
  [-0.04727, -0.057184, 0.282978, -0.786482],
];
export const SCALE = 1.08;
export const ORBIT = 0.1;
export const TRAIL = 32;
export const RIPPLES = 4;

// Same recursion as bayer() in the brand tool, values (v + 0.5) / 64, row-major.
export const BAYER: number[] = (() => {
  let m = [[0, 2], [3, 1]];
  while (m.length < 8) {
    const k = m.length;
    m = Array.from({ length: 2 * k }, (_, y) => Array.from({ length: 2 * k }, (_, x) =>
      4 * m[y % k][x % k] + [0, 2, 3, 1][Math.floor(y / k) * 2 + Math.floor(x / k)]));
  }
  return m.flat().map((v) => (v + 0.5) / 64);
})();

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);

// Brand tokens.
export const TOKENS = {
  white: hex('#FFFFFF'),
  neutralLightest: hex('#EEEEEE'),
  neutralSuperLight: hex('#F7F7F7'),
  blueTint100: hex('#E6F4FF'),
  blueTint200: hex('#CCEAFF'),
  blueTint300: hex('#66BFFF'),
  skyBlue400: hex('#0095FF'),
  royalBlue500: hex('#013DF5'),
};

// Raw blob field at frame point (x, y) in CSS px, loop phase t (0..1). Same maths as Field.raw().
export function fieldAt(x: number, y: number, w: number, h: number, t: number) {
  const bw = w * SCALE, bh = h * SCALE, m = Math.max(bw, bh);
  const xx = ((bw - w) / 2 + x) / m, yy = ((bh - h) / 2 + y) / m;
  let v = 0;
  BLOBS.forEach(([bx, by, r, a], k) => {
    const ph = k * 1.7, d = k % 2 === 0 ? 1 : -1, ang = 2 * Math.PI * t * d + ph;
    const cx = (bx + ORBIT * (Math.cos(ang) - Math.cos(ph))) * bw / m;
    const cy = (by + ORBIT * 0.8 * (Math.sin(ang) - Math.sin(ph))) * bh / m;
    v += a * Math.exp(-((xx - cx) ** 2 + (yy - cy) ** 2) / (2 * r * r));
  });
  return v;
}

// Normalisation like the tool: 2nd and 98th percentile of the full field at t = 0.
export function fieldRange(w: number, h: number) {
  const vals: number[] = [];
  const n = 64;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) vals.push(fieldAt((i / (n - 1)) * w, (j / (n - 1)) * h, w, h, 0));
  vals.sort((a, b) => a - b);
  const p = (q: number) => vals[Math.round((q / 100) * (vals.length - 1))];
  return [p(2), p(98)];
}

export const archyPixelShader = /* glsl */ `#version 300 es
precision mediump float;

uniform float u_time;
uniform vec2 u_resolution;
uniform float u_pixelRatio;

uniform float u_cell;        // cell size, CSS px
uniform float u_loop;        // seconds per blob orbit
uniform vec2 u_range;        // field normalisation (lo, hi)
uniform float u_gamma;       // base dominance (Pure White: 3)
uniform float u_steps;       // tone steps between base and front
uniform float u_floor;       // minimum field level, so no area stays flat white
uniform float u_noise;       // 0 = pure Bayer, 1 = pure random threshold (breaks banding into fine grain)
uniform vec3 u_base;
uniform vec3 u_front;
uniform vec4 u_trail[${TRAIL}];  // cursor trail: x, y (CSS px, top-left origin), weight 0..1, age 0..1
uniform float u_radius;      // CSS px
uniform float u_intensity;   // peak strength of the blue (1 = solid royal blue at the centre)
uniform float u_spread;      // how much a point grows as it fades (ink spreading), e.g. 0.35
uniform float u_wobble;      // organic edge: noise displacement as a fraction of the radius
uniform vec4 u_ripples[${RIPPLES}];  // click waves: x, y (CSS px), progress 0..1, on (0/1)
uniform float u_rippleSize;  // CSS px a wave travels
uniform vec3 u_t1;           // trail: very light blues
uniform vec3 u_t2;
uniform vec3 u_t3;

out vec4 fragColor;

const float BAYER[64] = float[64](${BAYER.map((v) => v.toFixed(6)).join(', ')});

const vec4 BLOBS[6] = vec4[6](
  vec4(${BLOBS.map((b) => b.map((n) => n.toFixed(6)).join(', ')).join('),\n  vec4(')})
);

float bayer8(vec2 p) {
  ivec2 q = ivec2(mod(p, 8.0));
  return BAYER[q.y * 8 + q.x];
}

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

// Smooth value noise (0..1) for the organic edge of the blue.
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float field(vec2 px, vec2 wh, float t) {
  vec2 bwh = wh * ${SCALE.toFixed(2)};
  float m = max(bwh.x, bwh.y);
  vec2 xy = ((bwh - wh) * 0.5 + px) / m;
  float v = 0.0;
  for (int k = 0; k < 6; k++) {
    vec4 b = BLOBS[k];
    float ph = float(k) * 1.7;
    float d = (k % 2 == 0) ? 1.0 : -1.0;
    float ang = 6.2831853 * t * d + ph;
    vec2 c = vec2(b.x + ${ORBIT.toFixed(2)} * (cos(ang) - cos(ph)), b.y + ${(ORBIT * 0.8).toFixed(2)} * (sin(ang) - sin(ph))) * bwh / m;
    vec2 dd = xy - c;
    v += b.w * exp(-dot(dd, dd) / (2.0 * b.z * b.z));
  }
  return v;
}

void main() {
  vec2 wh = u_resolution / u_pixelRatio;                       // CSS px
  vec2 frag = vec2(gl_FragCoord.x, u_resolution.y - gl_FragCoord.y) / u_pixelRatio;
  vec2 cell = floor(frag / u_cell);                            // whole cells, anchored top-left
  vec2 center = (cell + 0.5) * u_cell;                         // sample at the cell centre
  float thr = bayer8(cell);

  // Ground: brand Pixel Gradient.
  float t = fract(u_time / u_loop);
  float v = clamp((field(center, wh, t) - u_range.x) / (u_range.y - u_range.x), 0.0, 1.0);
  v = mix(u_floor, 1.0, pow(v, u_gamma));
  // Ground threshold: Bayer mixed with a per-cell random value so tone steps read as fine grain, not bands.
  float gthr = mix(thr, hash(cell), u_noise);
  float idx = clamp(floor(v * u_steps + gthr), 0.0, u_steps);
  vec3 col = mix(u_base, u_front, idx / u_steps);

  // Cursor: a ribbon of soft points that melt together, spread as they fade and have a slowly
  // drifting, noisy edge; dithered into the blue ramp like the ground.
  vec2 q = center / u_radius;
  float tt = u_time;
  vec2 warp = vec2(
    vnoise(q * 1.3 + vec2(tt * 0.15, 0.0)) + 0.5 * vnoise(q * 2.7 - vec2(0.0, tt * 0.11)),
    vnoise(q * 1.3 + vec2(17.0, -tt * 0.13)) + 0.5 * vnoise(q * 2.7 + vec2(9.0 + tt * 0.09, 3.0))
  ) / 1.5 - 0.5;
  vec2 pos = center + warp * 2.0 * u_wobble * u_radius;
  float sum = 0.0;
  for (int k = 0; k < ${TRAIL}; k++) {
    vec4 p = u_trail[k];
    if (p.z <= 0.0) continue;
    vec2 dd = pos - p.xy;
    float r = u_radius * (0.42 + 0.3 * p.z) * (1.0 + u_spread * p.w);
    sum += p.z * exp(-dot(dd, dd) / (2.0 * r * r));
  }
  float g = (1.0 - exp(-0.5 * sum)) * u_intensity;
  // Click: a soft hole that opens in the trail from the click, grows and closes again (same organic edge).
  float w = 0.0;
  for (int k = 0; k < ${RIPPLES}; k++) {
    vec4 rp = u_ripples[k];
    if (rp.w <= 0.0) continue;
    float pr = rp.z;
    float reach = (1.0 - pow(1.0 - pr, 3.0)) * u_rippleSize;   // fast start, slow end
    float d = length(pos - rp.xy);
    float fill = 1.0 - smoothstep(reach * 0.55, reach, d);       // soft disc, densest inside the front
    w = max(w, fill * pow(1.0 - pr, 1.3));
  }

  // The trail in the light blues, dithered in three steps (tint 100, 200, 300 at the core), minus the hole.
  float lv = g * (1.0 - clamp(w, 0.0, 1.0));
  float tl = clamp(floor(lv * 3.0 + thr - 0.3), 0.0, 3.0);
  if (tl >= 3.0) col = u_t3;
  else if (tl >= 2.0) col = u_t2;
  else if (tl >= 1.0) col = u_t1;

  fragColor = vec4(col, 1.0);
}
`;
