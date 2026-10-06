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
export const TRAIL = 16;

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
uniform vec3 u_trail[${TRAIL}];  // cursor trail: x, y (CSS px, top-left origin), weight 0..1
uniform float u_radius;      // CSS px
uniform float u_glow;        // overall cursor intensity 0..1
uniform vec3 u_b1;
uniform vec3 u_b2;
uniform vec3 u_b3;
uniform vec3 u_b4;

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

  // Cursor: same dithering into the blue ramp.
  float g = 0.0;
  for (int k = 0; k < ${TRAIL}; k++) {
    vec3 p = u_trail[k];
    vec2 dd = center - p.xy;
    float r = u_radius * (0.55 + 0.45 * p.z);
    g = max(g, p.z * exp(-dot(dd, dd) / (2.0 * r * r)));
  }
  g *= u_glow;
  float b = clamp(floor(g * 4.0 + thr - 0.3), 0.0, 4.0);
  if (b >= 4.0) col = u_b4;
  else if (b >= 3.0) col = u_b3;
  else if (b >= 2.0) col = u_b2;
  else if (b >= 1.0) col = u_b1;

  fragColor = vec4(col, 1.0);
}
`;
