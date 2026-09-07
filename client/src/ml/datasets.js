// Toy 2-D datasets for the AI labs. Every generator returns { xs: [[x, y], …], ys: [0 | 1] }
// with coordinates in -1..1. Class 0 is drawn white, class 1 blue (see labs/CONTRACT.md).
// `noise` is 0..1: how much the points are jittered / how much the classes overlap.

/** Small seeded random-number generator (0..1). Same seed → same dataset every time. */
export function mulberry32(seed = 1) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Gaussian sample (mean 0, std 1) from a uniform RNG (Box–Muller). */
export function randn(rand) {
  const u = Math.max(1e-12, rand());
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const clamp1 = (v) => Math.max(-1, Math.min(1, v));

/** Two classes: an inner disc (class 1) inside a ring (class 0). */
export function circle(n = 250, noise = 0.1, seed = 1) {
  const rand = mulberry32(seed);
  const xs = [];
  const ys = [];
  for (let i = 0; i < n; i++) {
    const inner = i % 2 === 0;
    const r = inner ? rand() * 0.45 : 0.6 + rand() * 0.4;
    const a = rand() * Math.PI * 2;
    const x = r * Math.cos(a) + randn(rand) * noise * 0.25;
    const y = r * Math.sin(a) + randn(rand) * noise * 0.25;
    xs.push([clamp1(x), clamp1(y)]);
    ys.push(inner ? 1 : 0);
  }
  return { xs, ys };
}

/** XOR / checkerboard: class 1 where x and y have the same sign. */
export function xor(n = 250, noise = 0.1, seed = 1) {
  const rand = mulberry32(seed);
  const xs = [];
  const ys = [];
  for (let i = 0; i < n; i++) {
    let x = rand() * 2 - 1;
    let y = rand() * 2 - 1;
    // push points away from the axes so the pattern reads clearly
    x += x > 0 ? 0.12 : -0.12;
    y += y > 0 ? 0.12 : -0.12;
    const label = x * y > 0 ? 1 : 0;
    x += randn(rand) * noise * 0.3;
    y += randn(rand) * noise * 0.3;
    xs.push([clamp1(x), clamp1(y)]);
    ys.push(label);
  }
  return { xs, ys };
}

/** Two interleaved spiral arms — the classic "hard" toy problem. */
export function spiral(n = 250, noise = 0.1, seed = 1) {
  const rand = mulberry32(seed);
  const xs = [];
  const ys = [];
  const half = Math.floor(n / 2);
  for (let c = 0; c < 2; c++) {
    for (let i = 0; i < half; i++) {
      const r = (i / half) * 0.9 + 0.08;
      const t = 1.75 * (i / half) * 2 * Math.PI + c * Math.PI;
      const x = r * Math.sin(t) + randn(rand) * noise * 0.2;
      const y = r * Math.cos(t) + randn(rand) * noise * 0.2;
      xs.push([clamp1(x), clamp1(y)]);
      ys.push(c);
    }
  }
  return { xs, ys };
}

/** Two Gaussian blobs in opposite corners — the easy one. */
export function gauss(n = 250, noise = 0.1, seed = 1) {
  const rand = mulberry32(seed);
  const xs = [];
  const ys = [];
  const spread = 0.18 + noise * 0.35;
  for (let i = 0; i < n; i++) {
    const c = i % 2;
    const cx = c ? 0.5 : -0.5;
    const cy = c ? 0.5 : -0.5;
    xs.push([clamp1(cx + randn(rand) * spread), clamp1(cy + randn(rand) * spread)]);
    ys.push(c);
  }
  return { xs, ys };
}

/** Lookup by name, e.g. DATASETS.spiral(250, 0.1). */
export const DATASETS = { circle, xor, spiral, gauss };
