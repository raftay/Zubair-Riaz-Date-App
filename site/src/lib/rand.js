// Seeded PRNG so every render of the page is identical.
export function rng(seed = 1) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.range = (a, b) => a + (b - a) * next();
  next.pick = (arr) => arr[Math.floor(next() * arr.length)];
  next.sign = () => (next() < 0.5 ? -1 : 1);
  return next;
}

// Cheap 1D value noise for organic wobble.
export function noise1(seed = 1) {
  const r = rng(seed);
  const table = Array.from({ length: 256 }, () => r() * 2 - 1);
  return (x) => {
    const i = Math.floor(x);
    const f = x - i;
    const a = table[i & 255];
    const b = table[(i + 1) & 255];
    const u = f * f * (3 - 2 * f);
    return a + (b - a) * u;
  };
}

// Smooth 3D value noise in [-1, 1] (used for the date's wrinkles).
export function noise3(seed = 1) {
  const r = rng(seed);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const vals = Float32Array.from({ length: 256 }, () => r() * 2 - 1);
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const h = (i, j, k) => vals[perm[perm[perm[i & 255] + (j & 255)] + (k & 255)]];
  const l = (a, b, t) => a + (b - a) * t;
  return (x, y, z) => {
    const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z);
    const u = fade(x - X), v = fade(y - Y), w = fade(z - Z);
    return l(
      l(l(h(X, Y, Z), h(X + 1, Y, Z), u), l(h(X, Y + 1, Z), h(X + 1, Y + 1, Z), u), v),
      l(l(h(X, Y, Z + 1), h(X + 1, Y, Z + 1), u), l(h(X, Y + 1, Z + 1), h(X + 1, Y + 1, Z + 1), u), v),
      w,
    );
  };
}
