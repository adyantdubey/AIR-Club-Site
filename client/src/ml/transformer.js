// A very small GPT-style transformer (word level, trained on Shakespeare).
// Pure JS forward pass; weights come from /weights/transformer.json.
//
//   d = 48 numbers per token, 4 attention heads (12 numbers each), 2 blocks,
//   context of 24 tokens, vocabulary of 2000 words (0 = <unk>, 1 = <pad>).
//
// One block ("pre-LN"):  h = ln1(x);  x += o(attention(q(h), k(h), v(h)));
//                        x += f2(gelu(f1(ln2(x))))
// Output: ln(x) · embᵀ  (the same table is used to read words in and score them out).

let _promise = null;
let _model = null;

/** Fetch + prepare the weights once. Returns a cached promise. */
export function loadTransformer() {
  if (!_promise) {
    _promise = fetch('/weights/transformer.json')
      .then((r) => r.json())
      .then((raw) => {
        _model = prepare(raw);
        return _model;
      });
  }
  return _promise;
}

/** The model if it has already loaded (sync), else null. */
export const getTransformer = () => _model;

const f32 = (a) => Float32Array.from(a);
const lin = (l) => ({ w: f32(l.w), b: f32(l.b), out: l.b.length, inp: l.w.length / l.b.length });
const norm = (l) => ({ g: f32(l.g), b: f32(l.b) });

function prepare(raw) {
  const m = {
    d: raw.d,
    heads: raw.heads,
    layers: raw.layers,
    ctx: raw.ctx,
    vocab: raw.vocab,
    loss: raw.loss,
    emb: f32(raw.emb), // [vocab][d]
    pos: f32(raw.pos), // [ctx][d]
    ln: norm(raw.ln),
    blocks: raw.blocks.map((b) => ({
      ln1: norm(b.ln1),
      ln2: norm(b.ln2),
      q: lin(b.q),
      k: lin(b.k),
      v: lin(b.v),
      o: lin(b.o),
      f1: lin(b.f1),
      f2: lin(b.f2),
    })),
  };
  m.index = new Map(m.vocab.map((w, i) => [w, i]));
  let n = m.emb.length + m.pos.length + 2 * m.d;
  for (const b of m.blocks) for (const k of ['q', 'k', 'v', 'o', 'f1', 'f2']) n += b[k].w.length + b[k].b.length;
  m.params = n + m.blocks.length * 4 * m.d;
  return m;
}

/**
 * Split text into word tokens the model knows.
 *   ids:     vocab indices (unknown words → 0)
 *   tokens:  display strings ('<unk>' words shown as "[word]")
 *   raw:     the original lower-case pieces (to rebuild text)
 *   unknown: how many words were not in the vocabulary
 * Only the last `ctx` (24) tokens are kept — the model has no position slots beyond that.
 */
export function tokenize(text, vocab) {
  const index = vocab instanceof Map ? vocab : new Map(vocab.map((w, i) => [w, i]));
  const pieces = (text.toLowerCase().match(/[a-z']+|[.,;:!?]/g) || []).slice(-24);
  const ids = [];
  const tokens = [];
  let unknown = 0;
  for (const p of pieces) {
    const id = index.get(p);
    if (id === undefined) {
      ids.push(0);
      tokens.push(`[${p}]`);
      unknown++;
    } else {
      ids.push(id);
      tokens.push(p);
    }
  }
  return { ids, tokens, raw: pieces, unknown };
}

// y = W·x + b for one vector
function linear(l, x, out) {
  const { w, b, inp } = l;
  for (let o = 0; o < l.out; o++) {
    let s = b[o];
    const off = o * inp;
    for (let i = 0; i < inp; i++) s += w[off + i] * x[i];
    out[o] = s;
  }
  return out;
}

// layer norm over the d numbers of one token
function layerNorm(ln, x, out) {
  const n = x.length;
  let mean = 0;
  for (let i = 0; i < n; i++) mean += x[i];
  mean /= n;
  let v = 0;
  for (let i = 0; i < n; i++) v += (x[i] - mean) ** 2;
  const inv = 1 / Math.sqrt(v / n + 1e-5);
  for (let i = 0; i < n; i++) out[i] = (x[i] - mean) * inv * ln.g[i] + ln.b[i];
  return out;
}

// exact-ish GELU (what torch uses by default): x * Φ(x)
function erf(x) {
  const s = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return s * y;
}
const gelu = (x) => 0.5 * x * (1 + erf(x / Math.SQRT2));

export function softmaxInPlace(v, n = v.length) {
  let mx = -Infinity;
  for (let i = 0; i < n; i++) if (v[i] > mx) mx = v[i];
  let sum = 0;
  for (let i = 0; i < n; i++) {
    v[i] = Math.exp(v[i] - mx);
    sum += v[i];
  }
  for (let i = 0; i < n; i++) v[i] /= sum;
  return v;
}

/**
 * Forward pass for a list of token ids (length T ≤ 24).
 * Returns:
 *   attn:   [layer][head][T][T]  softmax attention weights (row i sums to 1; j > i is 0 — causal)
 *   scores: [layer][head][T][T]  raw q·k/√dh before softmax (masked entries = 0)
 *   hidden: [layer+1][T]         Float32Array(d) per token (after the embedding, after each block)
 *   logits: [T]                  Float32Array(vocab) — next-word scores after each position
 *   topk(t, k): the k most likely next words after position t: [{ id, word, p }]
 * Takes a few milliseconds for 24 tokens; the vocab projection is most of it.
 */
export function transformerForward(model, ids) {
  const { d, heads, blocks, vocab, emb, pos } = model;
  const dh = d / heads;
  const T = Math.min(ids.length, model.ctx);
  const scale = 1 / Math.sqrt(dh);

  // token + position embeddings
  const x = [];
  for (let t = 0; t < T; t++) {
    const v = new Float32Array(d);
    const e = ids[t] * d;
    const p = t * d;
    for (let i = 0; i < d; i++) v[i] = emb[e + i] + pos[p + i];
    x.push(v);
  }
  const hidden = [x.map((v) => Float32Array.from(v))];
  const attn = [];
  const scores = [];
  const h = new Float32Array(d);
  const tmp = new Float32Array(d);
  const ff = new Float32Array(blocks[0].f1.out);

  for (const blk of blocks) {
    // --- attention ---
    const q = [], k = [], vv = [];
    for (let t = 0; t < T; t++) {
      layerNorm(blk.ln1, x[t], h);
      q.push(linear(blk.q, h, new Float32Array(d)));
      k.push(linear(blk.k, h, new Float32Array(d)));
      vv.push(linear(blk.v, h, new Float32Array(d)));
    }
    const A = [];
    const S = [];
    const ctx = x.map(() => new Float32Array(d));
    for (let hd = 0; hd < heads; hd++) {
      const off = hd * dh;
      const Ah = [];
      const Sh = [];
      for (let i = 0; i < T; i++) {
        const row = new Float32Array(T);
        const raw = new Float32Array(T);
        for (let j = 0; j <= i; j++) {
          let s = 0;
          for (let c = 0; c < dh; c++) s += q[i][off + c] * k[j][off + c];
          raw[j] = s * scale;
          row[j] = raw[j];
        }
        for (let j = i + 1; j < T; j++) row[j] = -Infinity; // causal mask: no peeking ahead
        softmaxInPlace(row);
        for (let j = 0; j <= i; j++) {
          const a = row[j];
          if (a === 0) continue;
          const vj = vv[j];
          const ci = ctx[i];
          for (let c = 0; c < dh; c++) ci[off + c] += a * vj[off + c];
        }
        Ah.push(row);
        Sh.push(raw);
      }
      A.push(Ah);
      S.push(Sh);
    }
    attn.push(A);
    scores.push(S);
    for (let t = 0; t < T; t++) {
      linear(blk.o, ctx[t], tmp);
      for (let i = 0; i < d; i++) x[t][i] += tmp[i];
    }
    // --- feed-forward ---
    for (let t = 0; t < T; t++) {
      layerNorm(blk.ln2, x[t], h);
      linear(blk.f1, h, ff);
      for (let i = 0; i < ff.length; i++) ff[i] = gelu(ff[i]);
      linear(blk.f2, ff, tmp);
      for (let i = 0; i < d; i++) x[t][i] += tmp[i];
    }
    hidden.push(x.map((v) => Float32Array.from(v)));
  }

  // final norm + tied output projection: score every vocab word
  const V = vocab.length;
  const logits = [];
  for (let t = 0; t < T; t++) {
    layerNorm(model.ln, x[t], h);
    const lg = new Float32Array(V);
    for (let w = 0; w < V; w++) {
      let s = 0;
      const off = w * d;
      for (let i = 0; i < d; i++) s += emb[off + i] * h[i];
      lg[w] = s;
    }
    logits.push(lg);
  }

  const topk = (t, kk = 5) => {
    const p = softmaxInPlace(Float32Array.from(logits[t]));
    const idx = [];
    for (let w = 2; w < V; w++) {
      // skip <unk>/<pad>: never suggest those
      if (idx.length < kk) {
        idx.push(w);
        idx.sort((a, b) => p[b] - p[a]);
      } else if (p[w] > p[idx[kk - 1]]) {
        idx[kk - 1] = w;
        idx.sort((a, b) => p[b] - p[a]);
      }
    }
    return idx.map((id) => ({ id, word: vocab[id], p: p[id] }));
  };

  return { T, attn, scores, hidden, logits, topk };
}
