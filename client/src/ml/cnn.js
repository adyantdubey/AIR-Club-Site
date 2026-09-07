// Tiny convolutional net for handwritten digits (MNIST). Pure JS forward pass,
// weights come from /weights/cnn.json (trained in PyTorch, 97.7 % test accuracy).
//
// Layout of the net:
//   28×28 image → conv1 (6 filters, 5×5) → ReLU → max-pool 2  → 6 maps of 12×12
//               → conv2 (12 filters, 5×5) → ReLU → max-pool 2 → 12 maps of 4×4
//               → flatten (192 numbers) → fully-connected → 10 scores → softmax
//
// All feature maps are flat Float32Arrays in row-major order (index = y * width + x).

let _promise = null;
let _model = null;

/** Fetch + prepare the weights once. Returns a cached promise. */
export function loadCNN() {
  if (!_promise) {
    _promise = fetch('/weights/cnn.json')
      .then((r) => r.json())
      .then((raw) => {
        _model = prepare(raw);
        return _model;
      });
  }
  return _promise;
}

/** The model if it has already loaded (sync), else null. */
export const getCNN = () => _model;

function prepare(raw) {
  const m = {
    arch: raw.arch,
    acc: raw.acc,
    conv1: { w: Float32Array.from(raw.conv1.w), b: Float32Array.from(raw.conv1.b) }, // [6][1][5][5]
    conv2: { w: Float32Array.from(raw.conv2.w), b: Float32Array.from(raw.conv2.b) }, // [12][6][5][5]
    fc: { w: Float32Array.from(raw.fc.w), b: Float32Array.from(raw.fc.b) }, // [10][192]
    params: raw.conv1.w.length + 6 + raw.conv2.w.length + 12 + raw.fc.w.length + 10,
  };
  m.verticalFilter = findVerticalFilter(m);
  return m;
}

/** The 25 weights of conv1 filter `i` (row-major 5×5). */
export function kernel1(model, i) {
  return model.conv1.w.subarray(i * 25, i * 25 + 25);
}

// Which conv1 filter looks most like a "vertical stroke" detector?
// We compare each 5×5 kernel with three templates: a bright vertical bar,
// a left edge and a right edge, and keep the best positive match.
function findVerticalFilter(model) {
  const bar = [];
  const edgeL = [];
  const edgeR = [];
  for (let y = 0; y < 5; y++)
    for (let x = 0; x < 5; x++) {
      bar.push(x === 2 ? 1 : -0.25);
      edgeL.push(x - 2); // dark left, bright right
      edgeR.push(2 - x);
    }
  let best = 0;
  let bestScore = -Infinity;
  for (let i = 0; i < 6; i++) {
    const k = kernel1(model, i);
    let a = 0;
    let b = 0;
    let c = 0;
    for (let j = 0; j < 25; j++) {
      a += k[j] * bar[j];
      b += k[j] * edgeL[j];
      c += k[j] * edgeR[j];
    }
    const s = Math.max(a, b, c);
    if (s > bestScore) {
      bestScore = s;
      best = i;
    }
  }
  return best;
}

/**
 * Full forward pass. `img28` = Float32Array(784), values 0..1, white digit on black.
 * Returns every intermediate map so the lab can draw them:
 *   conv1: 6 × Float32Array(24*24)   pool1: 6 × Float32Array(12*12)
 *   conv2: 12 × Float32Array(8*8)    pool2: 12 × Float32Array(4*4)
 *   logits: Float32Array(10)         probs: Float32Array(10)   pred: argmax
 * Runs in about a millisecond.
 */
export function cnnForward(model, img28) {
  const conv1 = conv(img28, 28, 1, model.conv1, 6);
  const pool1 = conv1.map((m) => maxPool(m, 24));
  const conv2 = conv(pool1, 12, 6, model.conv2, 12);
  const pool2 = conv2.map((m) => maxPool(m, 8));

  // flatten channel-major: index = c*16 + y*4 + x  (pool2 maps are already y*4+x)
  const flat = new Float32Array(192);
  for (let c = 0; c < 12; c++) flat.set(pool2[c], c * 16);

  const logits = new Float32Array(10);
  const { w, b } = model.fc;
  for (let o = 0; o < 10; o++) {
    let s = b[o];
    const off = o * 192;
    for (let i = 0; i < 192; i++) s += w[off + i] * flat[i];
    logits[o] = s;
  }
  const probs = softmax(logits);
  let pred = 0;
  for (let i = 1; i < 10; i++) if (probs[i] > probs[pred]) pred = i;
  return { conv1, pool1, conv2, pool2, logits, probs, pred };
}

// 5×5 "valid" convolution + ReLU. `input` is one Float32Array (cin=1) or an array of maps.
function conv(input, size, cin, layer, cout) {
  const maps = cin === 1 ? [input] : input;
  const os = size - 4;
  const out = [];
  for (let o = 0; o < cout; o++) {
    const res = new Float32Array(os * os);
    const bias = layer.b[o];
    for (let y = 0; y < os; y++) {
      for (let x = 0; x < os; x++) {
        let s = bias;
        for (let c = 0; c < cin; c++) {
          const src = maps[c];
          const wOff = (o * cin + c) * 25;
          for (let ky = 0; ky < 5; ky++) {
            const row = (y + ky) * size + x;
            const wr = wOff + ky * 5;
            s += layer.w[wr] * src[row] + layer.w[wr + 1] * src[row + 1] + layer.w[wr + 2] * src[row + 2] + layer.w[wr + 3] * src[row + 3] + layer.w[wr + 4] * src[row + 4];
          }
        }
        res[y * os + x] = s > 0 ? s : 0; // ReLU
      }
    }
    out.push(res);
  }
  return out;
}

// 2×2 max-pool: keeps the strongest response in every 2×2 block.
function maxPool(map, size) {
  const os = size / 2;
  const out = new Float32Array(os * os);
  for (let y = 0; y < os; y++)
    for (let x = 0; x < os; x++) {
      const i = y * 2 * size + x * 2;
      out[y * os + x] = Math.max(map[i], map[i + 1], map[i + size], map[i + size + 1]);
    }
  return out;
}

export function softmax(v) {
  let mx = -Infinity;
  for (let i = 0; i < v.length; i++) if (v[i] > mx) mx = v[i];
  const out = new Float32Array(v.length);
  let sum = 0;
  for (let i = 0; i < v.length; i++) {
    out[i] = Math.exp(v[i] - mx);
    sum += out[i];
  }
  for (let i = 0; i < v.length; i++) out[i] /= sum;
  return out;
}

/**
 * MNIST-style preprocessing of a drawing: `gray` is a Float32Array(w*h) 0..1.
 * Crops to the ink's bounding box, scales the longest side to 20 px, then pastes
 * it into a 28×28 image so that the centre of mass sits in the middle.
 * Returns { img: Float32Array(784), empty, aspect } (aspect = ink width / height).
 */
export function centre28(gray, w, h) {
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (gray[y * w + x] > 0.05) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
  const img = new Float32Array(784);
  if (maxX < 0) return { img, empty: true, aspect: 1 };

  const bw = maxX - minX + 1;
  const bh = maxY - minY + 1;
  const scale = 20 / Math.max(bw, bh);
  const tw = Math.max(1, Math.round(bw * scale));
  const th = Math.max(1, Math.round(bh * scale));

  // resample the crop into a tw×th box (box filter: average the source pixels)
  const small = new Float32Array(tw * th);
  for (let y = 0; y < th; y++) {
    const sy0 = minY + (y / th) * bh;
    const sy1 = minY + ((y + 1) / th) * bh;
    for (let x = 0; x < tw; x++) {
      const sx0 = minX + (x / tw) * bw;
      const sx1 = minX + ((x + 1) / tw) * bw;
      let sum = 0;
      let n = 0;
      for (let sy = Math.floor(sy0); sy < Math.ceil(sy1); sy++)
        for (let sx = Math.floor(sx0); sx < Math.ceil(sx1); sx++) {
          sum += gray[sy * w + sx];
          n++;
        }
      small[y * tw + x] = n ? sum / n : 0;
    }
  }

  // centre of mass of the small image
  let mass = 0, cx = 0, cy = 0;
  for (let y = 0; y < th; y++)
    for (let x = 0; x < tw; x++) {
      const v = small[y * tw + x];
      mass += v;
      cx += v * x;
      cy += v * y;
    }
  cx = mass ? cx / mass : tw / 2;
  cy = mass ? cy / mass : th / 2;
  const ox = Math.round(14 - cx - 0.5);
  const oy = Math.round(14 - cy - 0.5);
  for (let y = 0; y < th; y++)
    for (let x = 0; x < tw; x++) {
      const X = x + ox;
      const Y = y + oy;
      if (X >= 0 && X < 28 && Y >= 0 && Y < 28) img[Y * 28 + X] = Math.min(1, small[y * tw + x]);
    }
  return { img, empty: false, aspect: bw / bh };
}
