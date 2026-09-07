// Small 2-D toy datasets for the SVM lab. Coordinates live in roughly [-2, 2]².
// Each returns { xs: [[x, y], …], ys: [+1 | −1, …] } and is deterministic (seeded).

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
// Roughly Gaussian noise from a few uniform draws
const gauss = (r) => (r() + r() + r() - 1.5) * 1.15;

export function linearSeparable(n = 40, seed = 3) {
  const r = rng(seed);
  const xs = [];
  const ys = [];
  for (let i = 0; i < n; i++) {
    const c = i % 2 === 0 ? 1 : -1;
    xs.push([c * 0.85 + gauss(r) * 0.45, c * 0.55 + gauss(r) * 0.5]);
    ys.push(c);
  }
  return { xs, ys };
}

export function ring(n = 60, seed = 5) {
  const r = rng(seed);
  const xs = [];
  const ys = [];
  for (let i = 0; i < n; i++) {
    const inner = i % 2 === 0;
    const a = r() * Math.PI * 2;
    const rad = inner ? r() * 0.55 : 1.15 + r() * 0.45;
    xs.push([Math.cos(a) * rad, Math.sin(a) * rad]);
    ys.push(inner ? 1 : -1);
  }
  return { xs, ys };
}

export function twoMoons(n = 60, seed = 9) {
  const r = rng(seed);
  const xs = [];
  const ys = [];
  for (let i = 0; i < n; i++) {
    const top = i % 2 === 0;
    const a = r() * Math.PI;
    const nx = gauss(r) * 0.12;
    const ny = gauss(r) * 0.12;
    if (top) xs.push([Math.cos(a) * 1.1 - 0.5 + nx, Math.sin(a) * 1.1 - 0.3 + ny]);
    else xs.push([0.5 - Math.cos(a) * 1.1 + nx, 0.3 - Math.sin(a) * 1.1 + ny]);
    ys.push(top ? 1 : -1);
  }
  return { xs, ys };
}

export function xor(n = 48, seed = 11) {
  const r = rng(seed);
  const xs = [];
  const ys = [];
  for (let i = 0; i < n; i++) {
    const q = i % 4;
    const sx = q === 0 || q === 3 ? 1 : -1;
    const sy = q === 0 || q === 1 ? 1 : -1;
    xs.push([sx * (0.9 + r() * 0.8), sy * (0.9 + r() * 0.8)]);
    ys.push(sx * sy);
  }
  return { xs, ys };
}

export const PRESETS = {
  linear: { label: 'Linear', make: linearSeparable },
  ring: { label: 'Ring', make: ring },
  moons: { label: 'Moons', make: twoMoons },
  xor: { label: 'XOR', make: xor },
};
