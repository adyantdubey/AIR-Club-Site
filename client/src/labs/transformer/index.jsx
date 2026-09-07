import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { Wire, Led, GLOW, EDGE, EDGE_SOFT } from '../../three/wire';
import { createStore, useStore } from '../../lib/store';
import { Slider, Toggle, Readout, Row, Btn, Seg } from '../../components/ui/Controls';
import { loadTransformer, getTransformer, tokenize, transformerForward } from '../../ml/transformer';

/*
 * Transformer Attention — type a sentence, see which earlier words each word
 * "looks at" inside a tiny GPT trained on Shakespeare. Maths in src/ml/transformer.js.
 */

const DEFAULT_TEXT = 'to be or not to be , that is the question';
const RADIUS = 2.2;
const LAYER_Y = [0, 1.4];
const HEAD_HEX = ['#2d7bff', '#6eb2ff', '#ffffff', '#9cc4ff'];
const HEAD_COLORS = HEAD_HEX.map((h) => new THREE.Color(h));
const SEG = 14; // line segments per arc
const MAX_ARCS = 4 * 300; // 4 heads × (24·25/2) token pairs
const BLUE = new THREE.Color('#2d7bff');
const WHITE = new THREE.Color('#ffffff');
const DARK = new THREE.Color('#0c1a33');

function createState() {
  return createStore({
    loaded: false,
    text: DEFAULT_TEXT,
    layer: 2,
    head: 'all',
    heatmap: false,
    threshold: 0.05,
    hovered: -1,
    tokens: [],
    unknown: 0,
    top5: [],
    next: '',
    nextP: 0,
    version: 0,
    c1: false,
    c2: false,
    c3: false,
  });
}

function useModel(state) {
  const loaded = useStore(state, (s) => s.loaded);
  useEffect(() => {
    let alive = true;
    loadTransformer().then(() => alive && !state.get().loaded && state.set({ loaded: true }));
    const unsub = state.subscribe(() => {
      if (!state.get().loaded && getTransformer()) state.set({ loaded: true });
    });
    return () => {
      alive = false;
      unsub();
    };
  }, [state]);
  return loaded;
}

// Position of token i on a ring of T tokens (token 0 at the back, going clockwise seen from above)
function ringPos(i, T, y, r = RADIUS) {
  const a = Math.PI / 2 + (i / Math.max(T, 1)) * Math.PI * 2;
  return new THREE.Vector3(Math.cos(a) * r, y, -Math.sin(a) * r);
}

// Which heads are shown: 'all' → [0,1,2,3], '1' → [0] …
const headList = (head) => (head === 'all' ? [0, 1, 2, 3] : [Number(head) - 1]);

// Tokenise + run the net, then publish the cheap bits to reactive state.
function compute(state, text) {
  const model = getTransformer();
  if (!model) return;
  const tk = tokenize(text, model.index);
  const f = state.frame;
  f.tokens = tk;
  f.out = tk.ids.length ? transformerForward(model, tk.ids) : null;
  f.version = (f.version || 0) + 1;
  f.grow = 0;
  const top5 = f.out ? f.out.topk(tk.ids.length - 1, 5) : [];
  const s = state.get();
  state.set({
    text,
    tokens: tk.tokens,
    unknown: tk.unknown,
    top5,
    next: top5[0]?.word || '',
    nextP: top5[0]?.p || 0,
    version: f.version,
    c2: s.c2 || top5[0]?.word === 'king',
    c3: s.c3 || tk.unknown >= 3,
  });
}

// Does token `i` put more than half of its attention on itself (in the chosen layer / head)?
function selfAttends(out, layer, head, i) {
  if (!out || i >= out.T) return false;
  const A = out.attn[layer - 1];
  for (const h of headList(head)) if (A[h][i][i] > 0.5) return true;
  return false;
}

/* ------------------------------------------------------------------ */
/* Panel                                                                */
/* ------------------------------------------------------------------ */
function Panel({ state }) {
  const loaded = useModel(state);
  const text = useStore(state, (s) => s.text);
  const layer = useStore(state, (s) => s.layer);
  const head = useStore(state, (s) => s.head);
  const heatmap = useStore(state, (s) => s.heatmap);
  const threshold = useStore(state, (s) => s.threshold);
  const tokens = useStore(state, (s) => s.tokens);
  const unknown = useStore(state, (s) => s.unknown);
  const top5 = useStore(state, (s) => s.top5);
  const timer = useRef(null);

  useEffect(() => {
    if (!loaded) return;
    compute(state, state.get().text);
    // after state.reset() the frame bag is empty — recompute
    return state.subscribe(() => {
      if (!state.frame.out && !state.frame.tokens && getTransformer()) compute(state, state.get().text);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  const onText = (v) => {
    state.set({ text: v });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => compute(state, v), 150); // debounce typing
  };
  const nextWord = () => {
    const w = state.get().next;
    if (!w) return;
    let t = state.get().text.trimEnd() + (/^[.,;:!?]$/.test(w) ? '' : ' ') + w;
    // keep at most 24 tokens (the model's context): drop words from the front
    const model = getTransformer();
    const pieces = t.toLowerCase().match(/[a-z']+|[.,;:!?]/g) || [];
    if (pieces.length > model.ctx) t = pieces.slice(-model.ctx).join(' ');
    compute(state, t);
  };
  const pick = (patch) => state.set(patch);
  const maxP = top5[0]?.p || 1;

  return (
    <>
      <label className="block">
        <div className="mono mb-1 text-[10px] tracking-[0.18em]" style={{ color: 'var(--muted)' }}>TEXT (≤ 24 WORDS)</div>
        <input
          value={text}
          onChange={(e) => onText(e.target.value)}
          spellCheck={false}
          className="mono w-full rounded-lg px-2 py-1.5 text-xs outline-none"
          style={{ background: 'rgba(110,178,255,.08)', border: '1px solid var(--line)', color: 'var(--fg)' }}
        />
      </label>
      {!loaded ? (
        <div className="mono text-[10px] tracking-[0.18em]" style={{ color: 'var(--muted)' }}>loading weights…</div>
      ) : (
        <>
          <Row>
            <div className="flex-1"><Seg label="Layer" options={[[1, 'L1'], [2, 'L2']]} value={layer} onChange={(v) => pick({ layer: v })} /></div>
            <div className="flex-[2]"><Seg label="Head" options={[['all', 'All'], ['1', '1'], ['2', '2'], ['3', '3'], ['4', '4']]} value={head} onChange={(v) => pick({ head: v })} /></div>
          </Row>
          <Row>
            <Btn small primary onClick={nextWord} disabled={!top5.length}>Next word</Btn>
            <span className="mono text-[10px]" style={{ color: 'var(--muted)' }}>appends the top guess</span>
          </Row>
          <div>
            <div className="mono mb-1 text-[10px] tracking-[0.18em]" style={{ color: 'var(--muted)' }}>NEXT WORD · TOP 5</div>
            {top5.map((t, i) => (
              <div key={t.id} className="mono flex items-center gap-2 py-[1px] text-[11px]">
                <span className="w-16 truncate" style={{ color: i === 0 ? 'var(--fg)' : 'var(--muted)' }}>{t.word}</span>
                <span className="h-[3px] flex-1 rounded-full" style={{ background: 'rgba(110,178,255,.12)' }}>
                  <span className="block h-full rounded-full" style={{ width: `${(t.p / maxP) * 100}%`, background: i === 0 ? 'var(--blue-glow)' : 'var(--blue)' }} />
                </span>
                <span className="w-9 text-right" style={{ color: 'var(--muted)' }}>{(t.p * 100).toFixed(1)}%</span>
              </div>
            ))}
          </div>
          <Toggle label="Q·K heatmap" value={heatmap} onChange={(v) => state.set({ heatmap: v })} />
          <Slider label="Attention threshold" min={0} max={0.5} step={0.01} value={threshold} onChange={(v) => state.set({ threshold: v })} format={(v) => v.toFixed(2)} />
          <Readout label="Tokens" value={tokens.length} unit="/ 24" />
          <Readout label="Unknown words" value={unknown} />
          <div className="mono flex flex-wrap gap-1 text-[10px]">
            {tokens.map((t, i) => (
              <span key={i} className="rounded px-1" style={{ background: 'rgba(110,178,255,.08)', color: t.startsWith('[') ? 'var(--muted)' : 'var(--blue-glow)' }}>
                {t}
              </span>
            ))}
          </div>
        </>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Scene                                                                */
/* ------------------------------------------------------------------ */

// Pre-allocated line buffers for one layer's arcs. Each arc = SEG segments = 2·SEG vertices.
function makeArcBuffers() {
  const n = MAX_ARCS * SEG * 2 * 3;
  return { pos: new Float32Array(n), col: new Float32Array(n) };
}

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _m = new THREE.Vector3();
const _p = new THREE.Vector3();
const _c = new THREE.Color();
const curve = new THREE.QuadraticBezierCurve3(_a, _b, _m);

// Control point of the arc between token i and j: through the ring centre, lifted in Y.
function arcControl(from, to, y, out) {
  const d = from.distanceTo(to);
  return out.set(0, y + 0.35 + 0.55 * (d / (2 * RADIUS)), 0);
}

// Self-attention (i → i) has nowhere to go, so we draw a small loop standing on the tile.
const _r = new THREE.Vector3();
function selfLoopPoint(tile, s, out) {
  _r.set(tile.x, 0, tile.z).normalize();
  const a = s * Math.PI * 2;
  return out.set(tile.x + _r.x * 0.16 * Math.sin(a), tile.y + 0.2 + 0.16 * Math.cos(a), tile.z + _r.z * 0.16 * Math.sin(a));
}

// Fill the buffers with the arcs of one layer. Returns the number of vertices written.
function buildArcs(buf, out, layerIdx, opts) {
  const { heads, threshold, hovered, bright } = opts;
  const y = LAYER_Y[layerIdx];
  const A = out.attn[layerIdx];
  const T = out.T;
  let v = 0;
  for (const h of heads) {
    const base = HEAD_COLORS[h];
    for (let i = 0; i < T; i++) {
      const from = ringPos(i, T, y);
      for (let j = 0; j <= i; j++) {
        const a = A[h][i][j];
        if (a < threshold) continue;
        let k = bright * Math.pow(a, 0.7);
        if (hovered >= 0 && hovered !== i) k *= 0.08; // hovering: only that token's arcs stay bright
        if (k < 0.01) continue;
        const to = ringPos(j, T, y);
        const self = i === j;
        curve.v0.copy(from);
        curve.v2.copy(to);
        arcControl(from, to, y, curve.v1);
        _c.copy(base).multiplyScalar(k);
        const at = (u, o) => (self ? selfLoopPoint(from, u, o) : curve.getPoint(u, o));
        for (let s = 0; s < SEG; s++) {
          at(s / SEG, _p);
          buf.pos[v * 3] = _p.x; buf.pos[v * 3 + 1] = _p.y; buf.pos[v * 3 + 2] = _p.z;
          buf.col[v * 3] = _c.r; buf.col[v * 3 + 1] = _c.g; buf.col[v * 3 + 2] = _c.b;
          v++;
          at((s + 1) / SEG, _p);
          buf.pos[v * 3] = _p.x; buf.pos[v * 3 + 1] = _p.y; buf.pos[v * 3 + 2] = _p.z;
          buf.col[v * 3] = _c.r; buf.col[v * 3 + 1] = _c.g; buf.col[v * 3 + 2] = _c.b;
          v++;
        }
      }
    }
  }
  return v;
}

function ArcLayer({ buf, layerRef, geomRef, y }) {
  return (
    <group ref={layerRef} position={[0, y, 0]}>
      <group position={[0, -y, 0]}>
        <lineSegments frustumCulled={false}>
          <bufferGeometry ref={geomRef}>
            <bufferAttribute attach="attributes-position" args={[buf.pos, 3]} />
            <bufferAttribute attach="attributes-color" args={[buf.col, 3]} />
          </bufferGeometry>
          <lineBasicMaterial vertexColors transparent opacity={0.95} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </lineSegments>
      </group>
    </group>
  );
}

function Label({ position, children, dim, big }) {
  return (
    <Html center position={position} zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
      <div className={`mono ${big ? 'text-[11px]' : 'text-[9px]'} tracking-[0.12em]`} style={{ whiteSpace: 'nowrap', color: dim ? 'var(--muted)' : 'var(--blue-glow)' }}>
        {children}
      </div>
    </Html>
  );
}

function LoadingRing() {
  const g = useRef();
  useFrame((sc) => {
    const t = sc.clock.elapsedTime;
    if (!g.current) return;
    g.current.scale.setScalar(1 + 0.12 * Math.sin(t * 4));
    g.current.rotation.y = t * 0.8;
  });
  return (
    <group ref={g} position={[0, 0.7, 0]}>
      <Wire kind="torus" args={[1.4, 0.035, 8, 48]} rotation={[Math.PI / 2, 0, 0]} />
      <Led position={[0, 0, 0]} size={0.08} />
    </group>
  );
}

function Ring({ state, controlsRef }) {
  const tokens = useStore(state, (s) => s.tokens);
  const layer = useStore(state, (s) => s.layer);
  const heatmap = useStore(state, (s) => s.heatmap);
  const bufs = useMemo(() => [makeArcBuffers(), makeArcBuffers()], []);
  const geoms = useRef([null, null]);
  const layers = useRef([null, null]);
  const led = useRef();
  const pulse = useRef();
  const key = useRef('');
  const heat = useMemo(() => {
    const data = new Uint8Array(24 * 24 * 4);
    const tex = new THREE.DataTexture(data, 24, 24, THREE.RGBAFormat);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return { data, tex };
  }, []);
  useEffect(() => () => heat.tex.dispose(), [heat]);

  useEffect(() => {
    const c = controlsRef?.current;
    if (c) {
      c.target.set(0, 0.7, 0);
      c.update?.();
    }
  }, [controlsRef]);

  const T = tokens.length;

  useFrame((sc, dt) => {
    const t = sc.clock.elapsedTime;
    const f = state.frame;
    const cfg = state.get();
    const out = f.out;

    // rebuild arcs only when something relevant changed
    const k = `${f.version}|${cfg.layer}|${cfg.head}|${cfg.threshold}|${cfg.hovered}`;
    if (out && key.current !== k) {
      key.current = k;
      const heads = headList(cfg.head);
      for (let l = 0; l < 2; l++) {
        const g = geoms.current[l];
        if (!g) continue;
        const n = buildArcs(bufs[l], out, l, { heads, threshold: cfg.threshold, hovered: cfg.hovered, bright: cfg.layer - 1 === l ? 1 : 0.07 });
        g.attributes.position.needsUpdate = true;
        g.attributes.color.needsUpdate = true;
        g.setDrawRange(0, n);
      }
      // heatmap texture: rows = query token, columns = key token, averaged over the shown heads
      const A = out.attn[cfg.layer - 1];
      heat.data.fill(0);
      for (let i = 0; i < out.T; i++)
        for (let j = 0; j < out.T; j++) {
          let a = 0;
          for (const h of heads) a += A[h][i][j];
          a /= heads.length;
          if (a < 0.5) _c.lerpColors(DARK, BLUE, a * 2);
          else _c.lerpColors(BLUE, WHITE, (a - 0.5) * 2);
          const idx = ((out.T - 1 - i) * 24 + j) * 4;
          heat.data[idx] = _c.r * 255;
          heat.data[idx + 1] = _c.g * 255;
          heat.data[idx + 2] = _c.b * 255;
          heat.data[idx + 3] = 255;
        }
      heat.tex.repeat.set(out.T / 24, out.T / 24);
      heat.tex.needsUpdate = true;
    }

    // arcs grow from the ring centre after each input change (0.5 s)
    f.grow = Math.min(1, (f.grow ?? 1) + dt / 0.5);
    const s = 1 - Math.pow(1 - f.grow, 3);
    layers.current.forEach((g) => g && g.scale.setScalar(Math.max(0.001, s)));

    // idle: centre light breathes, a dot rides the strongest arc of the selected layer
    if (led.current) led.current.material.emissiveIntensity = 1.2 + Math.sin(t * 2.5) * 0.5;
    if (pulse.current) {
      if (out && out.T > 1) {
        const l = cfg.layer - 1;
        const A = out.attn[l];
        const heads = headList(cfg.head);
        let best = 0, bi = 1, bj = 0;
        for (const h of heads)
          for (let i = 1; i < out.T; i++)
            for (let j = 0; j < i; j++) if (A[h][i][j] > best) { best = A[h][i][j]; bi = i; bj = j; }
        const from = ringPos(bi, out.T, LAYER_Y[l]);
        const to = ringPos(bj, out.T, LAYER_Y[l]);
        curve.v0.copy(from);
        curve.v2.copy(to);
        arcControl(from, to, LAYER_Y[l], curve.v1);
        curve.getPoint((t * 0.4) % 1, pulse.current.position);
        pulse.current.visible = true;
      } else pulse.current.visible = false;
    }
  });

  const over = (i) => (e) => {
    e.stopPropagation();
    const s = state.get();
    // challenge 1: the hovered token (not the first — it can only see itself) keeps > 50 % of its attention
    state.set({ hovered: i, c1: s.c1 || (i > 0 && selfAttends(state.frame.out, s.layer, s.head, i)) });
  };
  const out = () => state.set({ hovered: -1 });

  return (
    <group>
      {/* two rings of token tiles, one per layer; the selected one is bright and labelled */}
      {LAYER_Y.map((y, l) => {
        const sel = layer - 1 === l;
        return (
          <group key={l}>
            {tokens.map((tok, i) => {
              const p = ringPos(i, T, y);
              return (
                <group key={i} position={p.toArray()}>
                  <Wire kind="box" args={[0.26, 0.05, 0.26]} edge={sel ? EDGE : EDGE_SOFT} onPointerOver={over(i)} onPointerOut={out} />
                  {sel && <Led size={0.03} position={[0, 0.05, 0]} intensity={1.2} />}
                  {sel && (
                    <Label position={[0, -0.22, 0]} dim={tok.startsWith('[')}>
                      {tok}
                    </Label>
                  )}
                </group>
              );
            })}
            {/* faint guide ring */}
            <mesh position={[0, y - 0.03, 0]} rotation-x={-Math.PI / 2}>
              <ringGeometry args={[RADIUS - 0.01, RADIUS + 0.01, 96]} />
              <meshBasicMaterial color={sel ? GLOW : EDGE_SOFT} transparent opacity={sel ? 0.35 : 0.15} toneMapped={false} side={THREE.DoubleSide} />
            </mesh>
            <Label position={[RADIUS + 0.55, y, 0]} dim={!sel}>{`LAYER ${l + 1}`}</Label>
            <ArcLayer buf={bufs[l]} layerRef={(el) => (layers.current[l] = el)} geomRef={(el) => (geoms.current[l] = el)} y={y} />
          </group>
        );
      })}
      <Led ref={led} size={0.06} position={[0, 0.7, 0]} />
      <Led ref={pulse} size={0.04} color="#ffffff" />

      {/* attention heatmap (T×T) beside the ring */}
      {heatmap && (
        <group position={[0, 1.95, -3.6]} rotation={[-0.25, 0, 0]}>
          <mesh>
            <planeGeometry args={[2.0, 2.0]} />
            <meshBasicMaterial map={heat.tex} toneMapped={false} side={THREE.DoubleSide} />
          </mesh>
          <Label position={[0, 1.18, 0]}>ATTENTION · ROW = QUERY · COL = KEY</Label>
          <Label position={[0, -1.18, 0]} dim>{`LAYER ${layer} · TOP-LEFT = FIRST TOKEN`}</Label>
        </group>
      )}

      {/* head colour legend */}
      <group position={[-2.75, 0.95, 1.7]}>
        {HEAD_HEX.map((h, i) => (
          <group key={i} position={[0, -i * 0.26, 0]}>
            <Led size={0.05} color={h} intensity={1.4} />
            <Label position={[-0.36, 0, 0]} dim>{`HEAD ${i + 1}`}</Label>
          </group>
        ))}
      </group>
    </group>
  );
}

function Scene({ state, controlsRef }) {
  const loaded = useModel(state);
  if (!loaded) return <LoadingRing />;
  return <Ring state={state} controlsRef={controlsRef} />;
}

/* ------------------------------------------------------------------ */
/* Mini scene: 6 tiles in a ring, a few arcs pulsing                    */
/* ------------------------------------------------------------------ */
const MINI_PAIRS = [[3, 0], [4, 1], [5, 2], [2, 0], [5, 4]];
function MiniScene() {
  const mats = useRef([]);
  const geoms = useMemo(
    () =>
      MINI_PAIRS.map(([i, j]) => {
        const a = ringPos(i, 6, 0, 1);
        const b = ringPos(j, 6, 0, 1);
        const c = new THREE.QuadraticBezierCurve3(a, new THREE.Vector3(0, 0.7, 0), b);
        return new THREE.BufferGeometry().setFromPoints(c.getPoints(16));
      }),
    [],
  );
  useEffect(() => () => geoms.forEach((g) => g.dispose()), [geoms]);
  useFrame((sc) => {
    const t = sc.clock.elapsedTime;
    mats.current.forEach((m, i) => {
      if (m) m.opacity = 0.35 + 0.55 * Math.max(0, Math.sin(t * 1.6 + i * 1.3));
    });
  });
  return (
    <group position={[0, 0.5, 0]}>
      {Array.from({ length: 6 }, (_, i) => (
        <Wire key={i} kind="box" args={[0.24, 0.05, 0.24]} position={ringPos(i, 6, 0, 1).toArray()} />
      ))}
      {geoms.map((g, i) => (
        <line key={i} geometry={g}>
          <lineBasicMaterial ref={(el) => (mats.current[i] = el)} color={HEAD_HEX[i % 4]} transparent opacity={0.6} toneMapped={false} />
        </line>
      ))}
      <Led size={0.05} position={[0, 0.7, 0]} />
    </group>
  );
}

export default {
  slug: 'transformer',
  name: 'Transformer Attention',
  tag: 'LANGUAGE',
  difficulty: 3,
  oneLiner: 'Type a sentence, see who attends to whom.',
  blurb:
    'Inside every chatbot is attention: each word decides which earlier words matter to it. Type a sentence and watch a real, tiny GPT (2 layers, 4 heads, 154k parameters, trained on Shakespeare) draw those connections as arcs — then ask it for the next word.',
  explain: [
    {
      title: 'What is it?',
      text: 'A transformer is the network behind modern language models. It reads words as vectors and lets every word "attend" to the words before it: a query from one word is compared with a key from each earlier word, the scores go through a softmax, and the result says how much of each earlier word to mix in. This one is deliberately tiny — 2 layers, 4 heads, 48 numbers per word, a 2,000-word vocabulary — so its guesses are Shakespeare-flavoured but far from fluent (validation loss ≈ 4.2).',
    },
    {
      title: 'What am I looking at?',
      text: 'Your tokens sit on a ring; the lower ring is layer 1, the upper one layer 2. Each arc runs from a word to an earlier word it attends to, and brighter means more attention. The four heads are four tints of blue and white. Because of the causal mask a word can only look backwards, never at words that come later, so every arc points to an earlier (or the same) token.',
    },
    {
      title: 'What the controls do',
      text: 'Pick a layer and a head, hover a tile to isolate that word\'s arcs, raise the threshold to hide weak links, and flip on the heatmap to see the whole T×T attention matrix (rows = the word looking, columns = the word looked at). "Next word" appends the model\'s top guess so you can watch it write.',
    },
    {
      title: 'Honest caveats',
      text: 'Words outside the 2,000-word vocabulary become <unk> (shown in brackets); the model has never seen modern words like "laptop". Real models have thousands of times more parameters and a vocabulary of sub-word pieces, but the attention mechanism you see here is exactly the same idea.',
    },
  ],
  challenges: ['Find a token that mostly attends to itself', "Make the model predict 'king'", 'Type a sentence with 3 unknown words and see attention scatter'],
  orbit: true,
  cameraPos: [0.4, 5.0, 8.4],
  createState,
  Scene,
  Panel,
  MiniScene,
  statusLine: (state) => {
    const s = state.get();
    if (!s.loaded) return 'loading weights…';
    const head = s.head === 'all' ? 'all heads' : `head ${s.head}`;
    const nx = s.next ? `next: '${s.next}' (${Math.round(s.nextP * 100)}%)` : 'next: —';
    return `${s.tokens.length} tokens · layer ${s.layer} · ${head} · ${nx}`;
  },
  challengeCheck: (state) => {
    const s = state.get();
    return [s.c1, s.c2, s.c3];
  },
};
