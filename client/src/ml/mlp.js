// A small dense neural network (multi-layer perceptron) in plain JS — no libraries.
// Everything is Float32Array so training a few hundred steps per second is cheap enough to run
// inside a render loop. Used by the Playground, Deep Net and Distillation labs.
//
// Shape of a net:  { sizes: [2, 4, 1], activation: 'tanh', W: [Float32Array…], b: [Float32Array…] }
//   W[l] is (sizes[l+1] × sizes[l]) row-major: W[l][j * nIn + i] connects input i → output j.
//   The LAST layer is linear (raw "logits"); predict() turns those into probabilities.
//
// Loss types (opts.lossType):
//   'bce'     1 output, sigmoid + binary cross-entropy   (labels 0/1)         — default for 2 classes
//   'mse'     sigmoid outputs, squared error              (labels 0/1 or vectors)
//   'softmax' softmax outputs, cross-entropy / KL         (labels: class index or probability vector)
//             + opts.temperature (T) for distillation, + opts.hardYs/opts.alpha to mix in hard labels.

import { mulberry32, randn } from './datasets.js';

let nextId = 1;

/** createMLP([2,4,1], {activation:'tanh'|'relu'|'sigmoid', seed}) → a fresh net (He init for relu, Xavier otherwise). */
export function createMLP(sizes, { activation = 'tanh', seed = 1 } = {}) {
  const rand = mulberry32(seed);
  const W = [];
  const b = [];
  for (let l = 0; l < sizes.length - 1; l++) {
    const nIn = sizes[l];
    const nOut = sizes[l + 1];
    const std = activation === 'relu' ? Math.sqrt(2 / nIn) : Math.sqrt(1 / nIn);
    const w = new Float32Array(nIn * nOut);
    for (let k = 0; k < w.length; k++) w[k] = randn(rand) * std;
    W.push(w);
    b.push(new Float32Array(nOut)); // biases start at zero
  }
  const net = { id: nextId++, sizes: sizes.slice(), activation, seed, W, b, rand, adam: null, steps: 0 };
  allocBuffers(net);
  return net;
}

// Scratch buffers (activations, error signals, gradients) so training does not allocate per step.
function allocBuffers(net) {
  const { sizes } = net;
  net.acts = sizes.map((n) => new Float32Array(n));
  net.deltas = sizes.map((n) => new Float32Array(n));
  net.gW = net.W.map((w) => new Float32Array(w.length));
  net.gb = net.b.map((bb) => new Float32Array(bb.length));
}

/** Number of trainable weights + biases. */
export function paramCount(net) {
  return net.W.reduce((s, w) => s + w.length, 0) + net.b.reduce((s, bb) => s + bb.length, 0);
}

/** Deep copy of a net (weights, optimiser state and RNG position). */
export function clone(net) {
  const out = {
    id: nextId++,
    sizes: net.sizes.slice(),
    activation: net.activation,
    seed: net.seed,
    W: net.W.map((w) => new Float32Array(w)),
    b: net.b.map((bb) => new Float32Array(bb)),
    rand: mulberry32(net.seed * 7919 + net.steps),
    adam: net.adam
      ? { t: net.adam.t, mW: net.adam.mW.map((m) => new Float32Array(m)), vW: net.adam.vW.map((v) => new Float32Array(v)), mb: net.adam.mb.map((m) => new Float32Array(m)), vb: net.adam.vb.map((v) => new Float32Array(v)) }
      : null,
    steps: net.steps,
  };
  allocBuffers(out);
  return out;
}

const act = (kind, z) => (kind === 'relu' ? (z > 0 ? z : 0) : kind === 'sigmoid' ? 1 / (1 + Math.exp(-z)) : Math.tanh(z));
// derivative written in terms of the activation value `a` (cheaper than recomputing)
const dact = (kind, a) => (kind === 'relu' ? (a > 0 ? 1 : 0) : kind === 'sigmoid' ? a * (1 - a) : 1 - a * a);

/** forward(net, [x, y]) → array of Float32Array, one per layer (input first, raw logits last). Buffers are reused — copy if you keep them. */
export function forward(net, x) {
  const { sizes, W, b, acts, activation } = net;
  const a0 = acts[0];
  for (let i = 0; i < a0.length; i++) a0[i] = x[i];
  const last = sizes.length - 2;
  for (let l = 0; l <= last; l++) {
    const nIn = sizes[l];
    const nOut = sizes[l + 1];
    const w = W[l];
    const bb = b[l];
    const ain = acts[l];
    const aout = acts[l + 1];
    for (let j = 0; j < nOut; j++) {
      let s = bb[j];
      const off = j * nIn;
      for (let i = 0; i < nIn; i++) s += w[off + i] * ain[i];
      aout[j] = l === last ? s : act(activation, s);
    }
  }
  return acts;
}

/** Sigmoid of one number. */
export const sigmoid = (z) => 1 / (1 + Math.exp(-z));

/** temperatureSoftmax(logits, T) → probabilities; large T flattens ("softens") them. */
export function temperatureSoftmax(logits, T = 1) {
  const n = logits.length;
  const out = new Float32Array(n);
  let mx = -Infinity;
  for (let i = 0; i < n; i++) mx = Math.max(mx, logits[i] / T);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    out[i] = Math.exp(logits[i] / T - mx);
    sum += out[i];
  }
  for (let i = 0; i < n; i++) out[i] /= sum;
  return out;
}

/** predict(net, x) → Float32Array of class probabilities (1 output → [p]; k outputs → softmax). */
export function predict(net, x, T = 1) {
  const z = forward(net, x)[net.sizes.length - 1];
  if (z.length === 1) return new Float32Array([sigmoid(z[0])]);
  return temperatureSoftmax(z, T);
}

/** predictProb(net, x) → a single number: probability of class 1 (the blue class). */
export function predictProb(net, x, T = 1) {
  const z = forward(net, x)[net.sizes.length - 1];
  if (z.length === 1) return sigmoid(z[0]);
  return temperatureSoftmax(z, T)[1];
}

/** accuracy(net, xs, ys) → fraction (0..1) of points classified correctly. ys may be labels or probability vectors. */
export function accuracy(net, xs, ys) {
  let ok = 0;
  for (let i = 0; i < xs.length; i++) {
    const p = predictProb(net, xs[i]);
    const y = ys[i];
    const label = typeof y === 'number' ? y : y.length === 1 ? (y[0] > 0.5 ? 1 : 0) : y[1] > y[0] ? 1 : 0;
    if ((p > 0.5 ? 1 : 0) === label) ok++;
  }
  return xs.length ? ok / xs.length : 0;
}

// Turns whatever kind of label we were given into a target vector of length nOut (written into `out`).
function targetVec(y, nOut, out) {
  if (typeof y === 'number') {
    if (nOut === 1) out[0] = y;
    else {
      for (let i = 0; i < nOut; i++) out[i] = 0;
      out[y] = 1;
    }
  } else for (let i = 0; i < nOut; i++) out[i] = y[i];
  return out;
}

// Loss for one sample given the raw output `z`; also writes dLoss/dz into `dz`. Returns the loss.
function lossAndGrad(z, y, dz, opts, tmp) {
  const nOut = z.length;
  const { lossType = nOut === 1 ? 'bce' : 'softmax', temperature: T = 1, alpha = 0, hardY } = opts;
  const t = targetVec(y, nOut, tmp.t);
  if (lossType === 'bce') {
    const p = sigmoid(z[0]);
    dz[0] = p - t[0];
    // numerically-safe cross-entropy from the logit
    const zz = z[0];
    return Math.max(zz, 0) - zz * t[0] + Math.log(1 + Math.exp(-Math.abs(zz)));
  }
  if (lossType === 'mse') {
    let L = 0;
    for (let i = 0; i < nOut; i++) {
      const p = sigmoid(z[i]);
      const d = p - t[i];
      L += d * d;
      dz[i] = (2 * d * p * (1 - p)) / nOut;
    }
    return L / nOut;
  }
  // softmax: soft (temperature) part, optionally mixed with a plain hard-label part
  const pT = temperatureSoftmax(z, T);
  let L = 0;
  const wSoft = hardY === undefined ? 1 : 1 - alpha;
  for (let i = 0; i < nOut; i++) {
    if (t[i] > 1e-7) L += t[i] * (Math.log(t[i]) - Math.log(pT[i] + 1e-9)); // KL(target ‖ prediction)
    dz[i] = wSoft * T * (pT[i] - t[i]); // T² scaling ÷ T from the chain rule
  }
  L *= wSoft * T * T;
  if (hardY !== undefined && alpha > 0) {
    const p1 = T === 1 ? pT : temperatureSoftmax(z, 1);
    const h = targetVec(hardY, nOut, tmp.h);
    for (let i = 0; i < nOut; i++) {
      if (h[i] > 1e-7) L -= alpha * h[i] * Math.log(p1[i] + 1e-9);
      dz[i] += alpha * (p1[i] - h[i]);
    }
  }
  return L;
}

// Backprop one sample's output error through the net, adding to the gradient accumulators gW/gb.
function backward(net, dzOut) {
  const { sizes, W, acts, deltas, gW, gb, activation } = net;
  const L = sizes.length - 1;
  const dL = deltas[L];
  for (let i = 0; i < dL.length; i++) dL[i] = dzOut[i];
  for (let l = L - 1; l >= 0; l--) {
    const nIn = sizes[l];
    const nOut = sizes[l + 1];
    const w = W[l];
    const g = gW[l];
    const gbb = gb[l];
    const ain = acts[l];
    const dout = deltas[l + 1];
    const din = deltas[l];
    for (let i = 0; i < nIn; i++) din[i] = 0;
    for (let j = 0; j < nOut; j++) {
      const d = dout[j];
      if (d === 0) continue;
      gbb[j] += d;
      const off = j * nIn;
      for (let i = 0; i < nIn; i++) {
        g[off + i] += d * ain[i];
        din[i] += d * w[off + i];
      }
    }
    // pass through the activation's slope (not needed for the input layer)
    if (l > 0) for (let i = 0; i < nIn; i++) din[i] *= dact(activation, ain[i]);
  }
}

/** trainStep(net, xs, ys, {lr, optimizer:'sgd'|'adam', batch, lossType, temperature, hardYs, alpha}) → one mini-batch step; returns its mean loss. */
export function trainStep(net, xs, ys, opts = {}) {
  const { lr = 0.03, optimizer = 'sgd', batch = 16 } = opts;
  const n = xs.length;
  if (!n) return 0;
  const bs = Math.min(batch, n);
  const { gW, gb } = net;
  for (const g of gW) g.fill(0);
  for (const g of gb) g.fill(0);
  const nOut = net.sizes[net.sizes.length - 1];
  const dz = net.deltas[net.sizes.length - 1];
  const tmp = net.tmp || (net.tmp = { t: new Float32Array(nOut), h: new Float32Array(nOut) });
  let total = 0;
  for (let k = 0; k < bs; k++) {
    const i = Math.floor(net.rand() * n);
    const z = forward(net, xs[i])[net.sizes.length - 1];
    const o = opts.hardYs ? { ...opts, hardY: opts.hardYs[i] } : opts;
    total += lossAndGrad(z, ys[i], dz, o, tmp);
    backward(net, dz);
  }
  const scale = 1 / bs;
  net.steps++;
  if (optimizer === 'adam') adamUpdate(net, lr, scale);
  else {
    for (let l = 0; l < net.W.length; l++) {
      const w = net.W[l];
      const g = gW[l];
      for (let k = 0; k < w.length; k++) w[k] -= lr * g[k] * scale;
      const bb = net.b[l];
      const gbb = gb[l];
      for (let k = 0; k < bb.length; k++) bb[k] -= lr * gbb[k] * scale;
    }
  }
  return total / bs;
}

function adamUpdate(net, lr, scale, b1 = 0.9, b2 = 0.999, eps = 1e-8) {
  if (!net.adam)
    net.adam = {
      t: 0,
      mW: net.W.map((w) => new Float32Array(w.length)),
      vW: net.W.map((w) => new Float32Array(w.length)),
      mb: net.b.map((b) => new Float32Array(b.length)),
      vb: net.b.map((b) => new Float32Array(b.length)),
    };
  const A = net.adam;
  A.t++;
  const c1 = 1 - Math.pow(b1, A.t);
  const c2 = 1 - Math.pow(b2, A.t);
  const step = (p, g, m, v) => {
    for (let k = 0; k < p.length; k++) {
      const gk = g[k] * scale;
      m[k] = b1 * m[k] + (1 - b1) * gk;
      v[k] = b2 * v[k] + (1 - b2) * gk * gk;
      p[k] -= (lr * (m[k] / c1)) / (Math.sqrt(v[k] / c2) + eps);
    }
  };
  for (let l = 0; l < net.W.length; l++) {
    step(net.W[l], net.gW[l], A.mW[l], A.vW[l]);
    step(net.b[l], net.gb[l], A.mb[l], A.vb[l]);
  }
}

/** evaluate(net, xs, ys, opts) → mean loss over the whole dataset (no learning). */
export function evaluate(net, xs, ys, opts = {}) {
  const nOut = net.sizes[net.sizes.length - 1];
  const dz = new Float32Array(nOut);
  const tmp = { t: new Float32Array(nOut), h: new Float32Array(nOut) };
  let total = 0;
  for (let i = 0; i < xs.length; i++) {
    const z = forward(net, xs[i])[net.sizes.length - 1];
    const o = opts.hardYs ? { ...opts, hardY: opts.hardYs[i] } : opts;
    total += lossAndGrad(z, ys[i], dz, o, tmp);
  }
  return xs.length ? total / xs.length : 0;
}

/** softTargets(teacher, xs, T) → array of teacher probability vectors at temperature T (for distillation). */
export function softTargets(teacher, xs, T = 1) {
  const L = teacher.sizes.length - 1;
  return xs.map((x) => temperatureSoftmax(forward(teacher, x)[L], T));
}

/** unitActivation(a, activation) → squashes a neuron's value to 0..1 for colouring (tanh: -1..1 → 0..1). */
export function unitActivation(a, activation) {
  if (activation === 'tanh') return (a + 1) * 0.5;
  if (activation === 'relu') return Math.tanh(a);
  return a;
}

/** isFinite guard: true when the weights have blown up (NaN / Infinity). */
export function exploded(net) {
  for (const w of net.W) for (let k = 0; k < w.length; k += 7) if (!Number.isFinite(w[k])) return true;
  return false;
}
