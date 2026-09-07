// Support Vector Machine trained with simplified SMO (Platt / CS229 version).
// Pure JS, no dependencies. Works on 2-D points but the maths is dimension-free.
//
//   const model = createSVM(xs, ys, { C: 1, gamma: 1, kernel: 'rbf' });
//   while (!model.done) svmStep(model);      // one SMO pass per call (animate it!)
//   decision(model, [x, y])                  // > 0 → class +1, < 0 → class −1
//
//   trainSVM(xs, ys, opts)                   // same thing, run to completion
//   svmRun(model, 4)                         // run passes for ≤ 4 ms (per-frame budget)
//   svmSummary(model)                        // support vectors, accuracy, margin
//
// xs: array of [x, y]; ys: array of +1 / −1.

/** Kernel function K(a, b): how "similar" two points are. */
export function kernelFn(kernel, gamma) {
  if (kernel === 'rbf') {
    // Gaussian bump: 1 when a === b, fades to 0 as they move apart. gamma = how quickly.
    return (a, b) => {
      let d = 0;
      for (let k = 0; k < a.length; k++) {
        const t = a[k] - b[k];
        d += t * t;
      }
      return Math.exp(-gamma * d);
    };
  }
  // linear: plain dot product → straight-line boundary
  return (a, b) => {
    let s = 0;
    for (let k = 0; k < a.length; k++) s += a[k] * b[k];
    return s;
  };
}

/** Tiny deterministic random generator so training replays identically. */
function lcg(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Build a fresh (untrained) model: alphas all zero, kernel matrix cached. */
export function createSVM(xs, ys, opts = {}) {
  const { C = 1, gamma = 1, kernel = 'linear', maxPasses = 5, tol = 1e-3, maxTotalPasses = 150, seed = 7 } = opts;
  const n = xs.length;
  const K = kernelFn(kernel, gamma);
  // Cache K(i, j) for every pair once — SMO reads these thousands of times.
  const Kmat = new Float64Array(n * n);
  for (let i = 0; i < n; i++)
    for (let j = i; j < n; j++) {
      const v = K(xs[i], xs[j]);
      Kmat[i * n + j] = v;
      Kmat[j * n + i] = v;
    }
  return {
    xs,
    ys,
    n,
    C,
    gamma,
    kernel,
    tol,
    maxPasses,
    maxTotalPasses,
    K,
    Kmat,
    alphas: new Float64Array(n),
    b: 0,
    passes: 0, // consecutive passes with no change
    totalPasses: 0,
    changedLast: 0,
    done: n === 0,
    rand: lcg(seed),
  };
}

/** f(x_i) using the cached kernel matrix. */
function fCached(m, i) {
  const { alphas, ys, Kmat, n } = m;
  let s = m.b;
  const row = i * n;
  for (let k = 0; k < n; k++) if (alphas[k] !== 0) s += alphas[k] * ys[k] * Kmat[row + k];
  return s;
}

/**
 * One SMO pass: visit every point, and when it violates the KKT conditions
 * pair it with a random second point and solve the tiny 2-variable problem exactly.
 * Returns the model. `model.done` becomes true once `maxPasses` passes in a row change nothing.
 * (xs/ys/opts are accepted for convenience: pass model = null to create one.)
 */
export function svmStep(model, xs, ys, opts) {
  let m = model;
  if (!m) m = createSVM(xs, ys, opts);
  if (m.done) return m;
  const { n, ys: Y, alphas, Kmat, C, tol } = m;
  let changed = 0;
  for (let i = 0; i < n; i++) {
    const Ei = fCached(m, i) - Y[i];
    const ai = alphas[i];
    // KKT check: is this point on the wrong side of its margin (or wrongly a support vector)?
    if (!((Y[i] * Ei < -tol && ai < C) || (Y[i] * Ei > tol && ai > 0))) continue;
    let j = Math.floor(m.rand() * (n - 1));
    if (j >= i) j++;
    const Ej = fCached(m, j) - Y[j];
    const aj = alphas[j];
    // Box constraints for the pair
    let L, H;
    if (Y[i] !== Y[j]) {
      L = Math.max(0, aj - ai);
      H = Math.min(C, C + aj - ai);
    } else {
      L = Math.max(0, ai + aj - C);
      H = Math.min(C, ai + aj);
    }
    if (L === H) continue;
    const Kii = Kmat[i * n + i];
    const Kjj = Kmat[j * n + j];
    const Kij = Kmat[i * n + j];
    const eta = 2 * Kij - Kii - Kjj; // second derivative along the pair; must be negative
    if (eta >= 0) continue;
    let ajNew = aj - (Y[j] * (Ei - Ej)) / eta;
    ajNew = ajNew > H ? H : ajNew < L ? L : ajNew;
    if (Math.abs(ajNew - aj) < 1e-5) continue;
    const aiNew = ai + Y[i] * Y[j] * (aj - ajNew);
    // Update the bias so the KKT conditions hold for the changed pair
    const b1 = m.b - Ei - Y[i] * (aiNew - ai) * Kii - Y[j] * (ajNew - aj) * Kij;
    const b2 = m.b - Ej - Y[i] * (aiNew - ai) * Kij - Y[j] * (ajNew - aj) * Kjj;
    if (aiNew > 0 && aiNew < C) m.b = b1;
    else if (ajNew > 0 && ajNew < C) m.b = b2;
    else m.b = (b1 + b2) / 2;
    alphas[i] = aiNew;
    alphas[j] = ajNew;
    changed++;
  }
  m.changedLast = changed;
  m.totalPasses++;
  m.passes = changed === 0 ? m.passes + 1 : 0;
  if (m.passes >= m.maxPasses || m.totalPasses >= m.maxTotalPasses) m.done = true;
  return m;
}

/** Keep doing passes until done or the time budget (ms) is used up. Returns passes done. */
export function svmRun(model, budgetMs = 4) {
  const t0 = performance.now();
  let k = 0;
  while (!model.done && performance.now() - t0 < budgetMs) {
    svmStep(model);
    k++;
  }
  return k;
}

/** Train from scratch to completion. */
export function trainSVM(xs, ys, opts = {}) {
  const m = createSVM(xs, ys, opts);
  while (!m.done) svmStep(m);
  return finalise(m);
}

/** Attach the handy derived fields (supportIdx, w for linear). */
export function finalise(m) {
  m.supportIdx = [];
  for (let i = 0; i < m.n; i++) if (m.alphas[i] > 1e-6) m.supportIdx.push(i);
  if (m.kernel === 'linear') m.w = linearWeights(m);
  return m;
}

/** Decision value for any point: Σ α_i y_i K(x_i, x) + b. Only support vectors matter. */
export function decision(m, x) {
  let s = m.b;
  const { alphas, ys, xs, K } = m;
  for (let i = 0; i < m.n; i++) if (alphas[i] > 1e-6) s += alphas[i] * ys[i] * K(xs[i], x);
  return s;
}

/** Linear kernel only: the normal vector w of the separating line (w·x + b = 0). */
export function linearWeights(m) {
  const d = m.xs[0]?.length || 2;
  const w = new Array(d).fill(0);
  for (let i = 0; i < m.n; i++) {
    if (m.alphas[i] <= 1e-6) continue;
    for (let k = 0; k < d; k++) w[k] += m.alphas[i] * m.ys[i] * m.xs[i][k];
  }
  return w;
}

/** Cheap stats for readouts: support vectors, training accuracy, margin width (linear). */
export function svmSummary(m) {
  const supportIdx = [];
  let correct = 0;
  for (let i = 0; i < m.n; i++) {
    if (m.alphas[i] > 1e-6) supportIdx.push(i);
    if (decision(m, m.xs[i]) * m.ys[i] > 0) correct++;
  }
  const accuracy = m.n ? correct / m.n : 0;
  let marginWidth = null;
  let w = null;
  if (m.kernel === 'linear') {
    w = linearWeights(m);
    const norm = Math.hypot(...w);
    marginWidth = norm > 1e-9 ? 2 / norm : Infinity;
  }
  return { supportIdx, nSupport: supportIdx.length, accuracy, marginWidth, w, b: m.b, done: m.done, passes: m.totalPasses };
}
