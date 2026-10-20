export const TAU = Math.PI * 2;
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const invlerp = (a, b, v) => clamp((v - a) / (b - a));
export const remap = (v, a, b, c, d) => lerp(c, d, invlerp(a, b, v));
export const smooth = (t) => t * t * (3 - 2 * t);
export const smoothstep = (a, b, v) => smooth(invlerp(a, b, v));
export const fract = (v) => v - Math.floor(v);

export const ease = {
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  out: (t) => 1 - Math.pow(1 - t, 3),
  in: (t) => t * t * t,
  outExpo: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
};

// Piecewise keyframes [[x, value], ...] with eased segments.
export function keys(x, frames, fn = smooth) {
  if (x <= frames[0][0]) return frames[0][1];
  for (let i = 1; i < frames.length; i++) {
    const [x1, v1] = frames[i];
    if (x <= x1) {
      const [x0, v0] = frames[i - 1];
      return lerp(v0, v1, fn((x - x0) / (x1 - x0)));
    }
  }
  return frames[frames.length - 1][1];
}

export const hex = (h) => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
export const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
export const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
export const scale3 = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
export const luma = (c) => (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;

// Interpolate through a list of colour stops by t in [0,1].
export function ramp(stops, t) {
  const n = stops.length - 1;
  const x = clamp(t) * n;
  const i = Math.min(n - 1, Math.floor(x));
  return mix(stops[i], stops[i + 1], x - i);
}
