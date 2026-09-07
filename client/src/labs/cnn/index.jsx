import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, Edges } from '@react-three/drei';
import * as THREE from 'three';
import { Wire, Led, GLOW, EDGE, EDGE_SOFT } from '../../three/wire';
import { createStore, useStore } from '../../lib/store';
import { clamp, damp } from '../../three/helpers';
import { Slider, Toggle, Readout, Row, Btn } from '../../components/ui/Controls';
import { loadCNN, getCNN, cnnForward, centre28, kernel1 } from '../../ml/cnn';

/*
 * CNN Digit Reader — draw a digit on the pad, watch it flow through a small
 * convolutional network. The maths lives in src/ml/cnn.js; this file only draws it.
 */

const PAD = 196; // drawing pad size in px
const ctx2d = (cv) => cv.getContext('2d', { willReadFrequently: true }); // we read pixels back ~10×/s
const BLUE = new THREE.Color('#2d7bff');
const WHITE = new THREE.Color('#ffffff');
const DARK = new THREE.Color('#0c1a33');

// Where each layer sits along Z (camera slides between these with the "Layer focus" slider)
const Z = { input: 0, conv1: -1.7, pool1: -3.1, conv2: -4.5, pool2: -5.7, out: -7.0 };
const FOCUS_Z = [Z.input, Z.conv1, Z.pool1, (Z.conv2 + Z.pool2) / 2, Z.out];
const BAR_BASE = -0.9;

function createState() {
  const s = createStore({
    loaded: false,
    pred: -1,
    conf: 0,
    probs: Array(10).fill(0),
    showFilters: true,
    focus: 0,
    hovered: -1,
    version: 0,
    c1: false,
    c2: false,
    c3: false,
  });
  return s;
}

// Both Panel and Scene call this: kicks off the (cached) download and flips `loaded`.
function useModel(state) {
  const loaded = useStore(state, (s) => s.loaded);
  useEffect(() => {
    let alive = true;
    loadCNN().then(() => alive && !state.get().loaded && state.set({ loaded: true }));
    // state.reset() wipes `loaded` even though the weights are still in memory — put it back
    const unsub = state.subscribe(() => {
      if (!state.get().loaded && getCNN()) state.set({ loaded: true });
    });
    return () => {
      alive = false;
      unsub();
    };
  }, [state]);
  return loaded;
}

/* ------------------------------------------------------------------ */
/* Sample digits: tiny hand-made stroke paths (unit square, y down)     */
/* ------------------------------------------------------------------ */
const ring = (cx, cy, rx, ry, n = 24, a0 = 0) => Array.from({ length: n + 1 }, (_, i) => [cx + rx * Math.cos(a0 + (i / n) * Math.PI * 2), cy + ry * Math.sin(a0 + (i / n) * Math.PI * 2)]);
const SAMPLES = [
  [ring(0.5, 0.5, 0.2, 0.34)],
  [[[0.38, 0.24], [0.52, 0.1], [0.52, 0.9]]],
  [[[0.3, 0.3], [0.38, 0.15], [0.6, 0.13], [0.7, 0.3], [0.62, 0.48], [0.3, 0.86], [0.74, 0.86]]],
  [[[0.3, 0.16], [0.62, 0.14], [0.68, 0.3], [0.46, 0.46], [0.7, 0.6], [0.66, 0.84], [0.3, 0.84]]],
  [[[0.62, 0.1], [0.28, 0.6], [0.78, 0.6]], [[0.62, 0.1], [0.62, 0.9]]],
  [[[0.7, 0.12], [0.32, 0.12], [0.3, 0.48], [0.56, 0.44], [0.72, 0.62], [0.62, 0.86], [0.28, 0.82]]],
  [[[0.66, 0.12], [0.42, 0.34], [0.3, 0.62], [0.42, 0.86], [0.64, 0.86], [0.72, 0.66], [0.56, 0.5], [0.32, 0.58]]],
  [[[0.26, 0.14], [0.74, 0.14], [0.46, 0.9]]],
  [Array.from({ length: 41 }, (_, i) => {
    const t = (i / 40) * Math.PI * 2;
    return [0.5 + 0.2 * Math.sin(2 * t), 0.5 + 0.36 * Math.sin(t)];
  })],
  [[[0.68, 0.4], [0.5, 0.2], [0.32, 0.36], [0.48, 0.56], [0.7, 0.42], [0.68, 0.62], [0.5, 0.9]]],
];

/* ------------------------------------------------------------------ */
/* Panel: drawing pad + controls                                        */
/* ------------------------------------------------------------------ */
function Panel({ state }) {
  const loaded = useModel(state);
  const pred = useStore(state, (s) => s.pred);
  const conf = useStore(state, (s) => s.conf);
  const probs = useStore(state, (s) => s.probs);
  const showFilters = useStore(state, (s) => s.showFilters);
  const focus = useStore(state, (s) => s.focus);
  const canvas = useRef(null);
  const drawing = useRef(false);
  const last = useRef(null);
  const lastRun = useRef(0);
  const byHand = useRef(false); // true when the current ink was drawn by the user

  // Read the pad, centre it MNIST-style, run the net, publish cheap summaries.
  const run = () => {
    const model = getCNN();
    const cv = canvas.current;
    if (!model || !cv) return;
    const px = ctx2d(cv).getImageData(0, 0, PAD, PAD).data;
    const gray = new Float32Array(PAD * PAD);
    for (let i = 0; i < gray.length; i++) gray[i] = px[i * 4] / 255;
    const { img, empty, aspect } = centre28(gray, PAD, PAD);
    const f = state.frame;
    f.img = img;
    f.out = empty ? null : cnnForward(model, img);
    f.version = (f.version || 0) + 1;
    const s = state.get();
    const out = f.out;
    const p = out ? out.pred : -1;
    const c = out ? out.probs[p] : 0;
    state.set({
      pred: p,
      conf: c,
      probs: out ? Array.from(out.probs) : Array(10).fill(0),
      version: f.version,
      // challenge 1: a tall thin hand-drawn stroke (a "1") that the net calls a 7
      c1: s.c1 || (byHand.current && !empty && aspect < 0.45 && p === 7),
      c2: s.c2 || (byHand.current && c > 0.99),
    });
  };

  const clear = () => {
    const ctx = ctx2d(canvas.current);
    ctx.shadowBlur = 0; // the brush leaves a glow shadow on the context; a shadowed fill misreads on some GPUs
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, PAD, PAD);
  };
  const brush = (ctx) => {
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 16;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = 5;
  };
  const sample = () => {
    const d = Math.floor(Math.random() * 10);
    clear();
    const ctx = ctx2d(canvas.current);
    brush(ctx);
    const jx = (Math.random() - 0.5) * 0.08;
    const jy = (Math.random() - 0.5) * 0.08;
    const rot = (Math.random() - 0.5) * 0.3;
    for (const stroke of SAMPLES[d]) {
      ctx.beginPath();
      stroke.forEach(([x, y], i) => {
        // small random tilt + shift so samples are never identical
        const dx = x - 0.5;
        const dy = y - 0.5;
        const X = (0.5 + jx + dx * Math.cos(rot) - dy * Math.sin(rot)) * PAD;
        const Y = (0.5 + jy + dx * Math.sin(rot) + dy * Math.cos(rot)) * PAD;
        i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
      });
      ctx.stroke();
    }
    byHand.current = false;
    run();
  };

  // first paint: a sample digit so the stack is never empty
  useEffect(() => {
    clear();
    if (loaded) {
      sample();
      // after state.reset() the frame bag is empty — recompute from whatever is on the pad
      return state.subscribe(() => {
        if (!state.frame.out && !state.frame.img && getCNN()) run();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  const pos = (e) => {
    const r = canvas.current.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * PAD, ((e.clientY - r.top) / r.height) * PAD];
  };
  const onDown = (e) => {
    e.preventDefault();
    canvas.current.setPointerCapture?.(e.pointerId);
    drawing.current = true;
    byHand.current = true;
    last.current = pos(e);
    const ctx = ctx2d(canvas.current);
    brush(ctx);
    ctx.beginPath();
    ctx.arc(last.current[0], last.current[1], 8, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
  };
  const onMove = (e) => {
    if (!drawing.current) return;
    const p = pos(e);
    const ctx = ctx2d(canvas.current);
    brush(ctx);
    ctx.beginPath();
    ctx.moveTo(last.current[0], last.current[1]);
    ctx.lineTo(p[0], p[1]);
    ctx.stroke();
    last.current = p;
    const now = performance.now();
    if (now - lastRun.current > 100) {
      lastRun.current = now;
      run();
    }
  };
  const onUp = () => {
    if (!drawing.current) return;
    drawing.current = false;
    run();
  };

  return (
    <>
      <div className="mono text-[10px] tracking-[0.18em]" style={{ color: 'var(--muted)' }}>
        DRAW A DIGIT
      </div>
      <canvas
        ref={canvas}
        width={PAD}
        height={PAD}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onPointerLeave={onUp}
        className="rounded-lg"
        style={{ width: PAD, height: PAD, touchAction: 'none', border: '1px solid var(--line)', background: '#000', cursor: 'crosshair', display: 'block' }}
      />
      <Row>
        <Btn small onClick={() => { clear(); byHand.current = false; run(); }}>Clear</Btn>
        <Btn small primary onClick={sample} disabled={!loaded}>Random sample</Btn>
      </Row>
      {!loaded ? (
        <div className="mono text-[10px] tracking-[0.18em]" style={{ color: 'var(--muted)' }}>loading weights…</div>
      ) : (
        <>
          <Readout label="Prediction" value={pred < 0 ? '—' : pred} />
          <Readout label="Confidence" value={pred < 0 ? '—' : Math.round(conf * 100)} unit="%" />
          <div className="flex items-end gap-[3px]" style={{ height: 28 }} aria-hidden="true">
            {probs.map((p, i) => (
              <div key={i} className="flex flex-1 flex-col items-center justify-end gap-[2px]" style={{ height: '100%' }}>
                <div style={{ width: '100%', height: `${Math.max(2, p * 100)}%`, background: i === pred ? 'var(--blue-glow)' : 'var(--blue)', opacity: i === pred ? 1 : 0.45, borderRadius: 2 }} />
                <span className="mono text-[8px]" style={{ color: 'var(--muted)' }}>{i}</span>
              </div>
            ))}
          </div>
        </>
      )}
      <Toggle label="Show filters" value={showFilters} onChange={(v) => state.set({ showFilters: v })} />
      <Slider label="Layer focus" min={0} max={4} step={1} value={focus} onChange={(v) => state.set({ focus: v })} format={(v) => ['input', 'conv1', 'pool1', 'conv2', 'output'][v]} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Scene                                                                */
/* ------------------------------------------------------------------ */

// One feature map = a DataTexture we repaint in place (cheap: no geometry churn).
class ActMap {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.data = new Uint8Array(w * h * 4);
    this.tex = new THREE.DataTexture(this.data, w, h, THREE.RGBAFormat);
    this.tex.magFilter = THREE.NearestFilter;
    this.tex.minFilter = THREE.NearestFilter;
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.write(null, 1);
  }
  // blue-white ramp: 0 → dark & mostly transparent, 1 → white
  write(src, max) {
    const { w, h, data } = this;
    const c = new THREE.Color();
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const v = src ? clamp(src[y * w + x] / max, 0, 1) : 0;
        if (v < 0.5) c.lerpColors(DARK, BLUE, v * 2);
        else c.lerpColors(BLUE, WHITE, (v - 0.5) * 2);
        const i = ((h - 1 - y) * w + x) * 4; // texture rows run bottom-up
        data[i] = c.r * 255;
        data[i + 1] = c.g * 255;
        data[i + 2] = c.b * 255;
        data[i + 3] = 70 + 185 * v;
      }
    this.tex.needsUpdate = true;
  }
}

const maxOf = (maps) => {
  let m = 1e-6;
  for (const a of maps) for (let i = 0; i < a.length; i++) if (a[i] > m) m = a[i];
  return m;
};

function MapPlane({ map, size, position, onOver, onOut, edge = EDGE_SOFT }) {
  return (
    <mesh position={position} onPointerOver={onOver} onPointerOut={onOut}>
      <planeGeometry args={[size, size]} />
      <meshBasicMaterial map={map.tex} transparent depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
      <Edges color={edge} />
    </mesh>
  );
}

function Label({ position, children, dim }) {
  return (
    <Html center position={position} zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
      <div className="mono text-[9px] tracking-[0.2em]" style={{ whiteSpace: 'nowrap', color: dim ? 'var(--muted)' : 'var(--blue-glow)' }}>
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
    <group ref={g} position={[0, 0.2, 0]}>
      <Wire kind="torus" args={[1, 0.035, 8, 48]} rotation={[Math.PI / 2, 0, 0]} />
      <Led position={[0, 0, 0]} size={0.08} />
    </group>
  );
}

function Stack({ state, controlsRef }) {
  const model = getCNN();
  const maps = useMemo(
    () => ({
      input: new ActMap(28, 28),
      conv1: Array.from({ length: 6 }, () => new ActMap(24, 24)),
      pool1: Array.from({ length: 6 }, () => new ActMap(12, 12)),
      conv2: Array.from({ length: 12 }, () => new ActMap(8, 8)),
      pool2: Array.from({ length: 12 }, () => new ActMap(4, 4)),
    }),
    [],
  );
  useEffect(() => () => {
    [maps.input, ...maps.conv1, ...maps.pool1, ...maps.conv2, ...maps.pool2].forEach((m) => m.tex.dispose());
  }, [maps]);

  const bars = useRef([]);
  const led = useRef();
  const sweep = useRef();
  const kernels = useRef();
  const lines = useRef();
  const lineGeom = useRef();
  const linePos = useMemo(() => new Float32Array(8 * 3), []);
  const painted = useRef(-1);
  const kernelState = useRef('');
  const hoverRef = useRef(-1);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const x1 = (i) => (i - 2.5) * 1.12; // conv1 / pool1 columns
  const x2 = (i) => ((i % 6) - 2.5) * 0.7; // conv2 / pool2 columns
  const y2 = (i) => (i < 6 ? 0.42 : -0.42); // two rows

  // kernel cubes: 6 filters × 25 weights, coloured once (weights never change)
  useEffect(() => {
    const im = kernels.current;
    if (!im) return;
    const c = new THREE.Color();
    for (let f = 0; f < 6; f++) {
      const k = kernel1(model, f);
      let mx = 1e-6;
      for (let j = 0; j < 25; j++) mx = Math.max(mx, Math.abs(k[j]));
      for (let j = 0; j < 25; j++) {
        const v = k[j] / mx; // -1..1 : dark → blue → white
        if (v < 0) c.lerpColors(BLUE, DARK, -v);
        else c.lerpColors(BLUE, WHITE, v);
        im.setColorAt(f * 25 + j, c);
      }
    }
    im.instanceColor.needsUpdate = true;
  }, [model]);

  useEffect(() => {
    const c = controlsRef?.current;
    if (c) {
      c.target.set(0, 0, -1.2);
      c.update?.();
    }
  }, [controlsRef]);

  useFrame((sc, dt) => {
    const t = sc.clock.elapsedTime;
    const f = state.frame;
    const cfg = state.get();

    // 1. repaint textures when a new forward pass has happened
    if (f.version !== undefined && painted.current !== f.version) {
      painted.current = f.version;
      const o = f.out;
      maps.input.write(f.img, 1);
      const m1 = o ? maxOf(o.conv1) : 1;
      const m2 = o ? maxOf(o.conv2) : 1;
      for (let i = 0; i < 6; i++) {
        maps.conv1[i].write(o && o.conv1[i], m1);
        maps.pool1[i].write(o && o.pool1[i], m1);
      }
      for (let i = 0; i < 12; i++) {
        maps.conv2[i].write(o && o.conv2[i], m2);
        maps.pool2[i].write(o && o.pool2[i], m2);
      }
    }

    // 2. output bars ease toward the probabilities; LED sits on the winner
    const probs = f.out ? f.out.probs : null;
    const pred = f.out ? f.out.pred : -1;
    bars.current.forEach((b, i) => {
      if (!b) return;
      const target = 0.06 + (probs ? probs[i] : 0) * 1.5;
      const h = damp(b.scale.y, target, 8, dt);
      b.scale.y = h;
      b.position.y = BAR_BASE + h / 2;
    });
    if (led.current) {
      led.current.visible = pred >= 0;
      if (pred >= 0) {
        const b = bars.current[pred];
        led.current.position.set(b.position.x, BAR_BASE + b.scale.y + 0.08, Z.out);
        led.current.material.emissiveIntensity = 1.6 + Math.sin(t * 5) * 0.8;
      }
    }

    // 3. idle "scan" pulse travelling down the stack
    if (sweep.current) {
      const u = (t * 0.25) % 1;
      sweep.current.position.set(0, -1.5, Z.input + 0.6 + (Z.out - 1.2 - Z.input) * u);
      sweep.current.rotation.z = t * 2;
    }

    // 4. kernels (show-filters toggle + hovered filter) and receptive-field lines
    const hovered = cfg.hovered;
    const key = `${cfg.showFilters}|${hovered}`;
    if (kernels.current && kernelState.current !== key) {
      kernelState.current = key;
      const im = kernels.current;
      for (let fI = 0; fI < 6; fI++) {
        const on = cfg.showFilters || hovered === fI;
        const big = hovered === fI;
        const cell = big ? 0.11 : 0.075;
        const cube = big ? 0.1 : 0.065;
        for (let j = 0; j < 25; j++) {
          const kx = j % 5;
          const ky = Math.floor(j / 5);
          dummy.position.set(x1(fI) + (kx - 2) * cell, 0.72 + (2 - ky) * cell + (big ? 0.1 : 0), Z.conv1 + (big ? 0.15 : 0));
          dummy.scale.setScalar(on ? cube : 0.0001);
          dummy.updateMatrix();
          im.setMatrixAt(fI * 25 + j, dummy.matrix);
        }
      }
      im.instanceMatrix.needsUpdate = true;
    }
    if (hoverRef.current !== hovered) {
      hoverRef.current = hovered;
      if (lines.current) lines.current.visible = hovered >= 0;
      if (hovered >= 0 && lineGeom.current) {
        // the 24×24 map "sees" the central 24×24 of the 28×28 input (a 5×5 window slides over it)
        const s = 0.5 * (24 / 28) * 2.0;
        const cx = x1(hovered);
        const hs = 0.475;
        const corners = [[-1, 1], [1, 1], [1, -1], [-1, -1]];
        corners.forEach(([sx, sy], i) => {
          linePos.set([cx + sx * hs, sy * hs, Z.conv1, sx * s, sy * s, Z.input + 0.01], i * 6);
        });
        lineGeom.current.attributes.position.needsUpdate = true;
      }
    }

    // 5. camera focus slides along Z with the slider (keeps whatever orbit angle the user chose)
    const c = controlsRef?.current;
    if (c) {
      const goal = FOCUS_Z[cfg.focus] ?? 0;
      const nz = damp(c.target.z, goal, 4, dt);
      const dz = nz - c.target.z;
      c.target.z = nz;
      sc.camera.position.z += dz;
    }
  });

  const over = (i) => (e) => {
    e.stopPropagation();
    const s = state.get();
    state.set({ hovered: i, c3: s.c3 || i === model.verticalFilter });
  };
  const out = () => state.set({ hovered: -1 });

  return (
    <group>
      {/* input image */}
      <MapPlane map={maps.input} size={2.0} position={[0, 0, Z.input]} edge={EDGE} />
      <Label position={[0, 1.25, Z.input]}>INPUT 28×28</Label>

      {/* conv1: 6 maps fanned along X, kernels above them */}
      {maps.conv1.map((m, i) => (
        <MapPlane key={i} map={m} size={0.95} position={[x1(i), 0, Z.conv1]} onOver={over(i)} onOut={out} edge={EDGE} />
      ))}
      <Label position={[0, 1.3, Z.conv1]}>CONV1 · 6 × 24×24 · HOVER A MAP</Label>
      <instancedMesh ref={kernels} args={[undefined, undefined, 150]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <lineSegments ref={lines} visible={false}>
        <bufferGeometry ref={lineGeom}>
          <bufferAttribute attach="attributes-position" args={[linePos, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color={GLOW} transparent opacity={0.4} />
      </lineSegments>

      {/* pool1 */}
      {maps.pool1.map((m, i) => (
        <MapPlane key={i} map={m} size={0.62} position={[x1(i), 0, Z.pool1]} />
      ))}
      <Label position={[0, 1.0, Z.pool1]} dim>POOL 6 × 12×12</Label>

      {/* conv2 + pool2: 12 maps in two rows */}
      {maps.conv2.map((m, i) => (
        <MapPlane key={i} map={m} size={0.58} position={[x2(i), y2(i), Z.conv2]} />
      ))}
      <Label position={[0, 1.0, Z.conv2]} dim>CONV2 · 12 × 8×8</Label>
      {maps.pool2.map((m, i) => (
        <MapPlane key={i} map={m} size={0.42} position={[x2(i), y2(i), Z.pool2]} />
      ))}
      <Label position={[0, 1.0, Z.pool2]} dim>POOL 12 × 4×4</Label>

      {/* output: 10 bars, height = probability */}
      {Array.from({ length: 10 }, (_, i) => {
        const x = (i - 4.5) * 0.42;
        return (
          <group key={i}>
            <Wire ref={(el) => (bars.current[i] = el)} kind="box" args={[0.24, 1, 0.24]} position={[x, BAR_BASE + 0.03, Z.out]} scale={[1, 0.06, 1]} />
            <Label position={[x, BAR_BASE - 0.22, Z.out]}>{i}</Label>
          </group>
        );
      })}
      <Led ref={led} size={0.07} position={[0, 0, Z.out]} />
      <Label position={[0, 1.1, Z.out]}>SOFTMAX · 10 CLASSES</Label>

      {/* scan pulse (idle animation) */}
      <group ref={sweep}>
        <Led size={0.05} intensity={2} />
        <Wire kind="torus" args={[0.16, 0.012, 6, 24]} rotation={[0, 0, 0]} edge={GLOW} />
      </group>

      {/* floor line hinting the Z axis */}
      <line>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[new Float32Array([0, -1.5, 0.6, 0, -1.5, Z.out - 0.6]), 3]} />
        </bufferGeometry>
        <lineBasicMaterial color={EDGE_SOFT} transparent opacity={0.5} />
      </line>
    </group>
  );
}

function Scene({ state, controlsRef }) {
  const loaded = useModel(state);
  if (!loaded) return <LoadingRing />;
  return <Stack state={state} controlsRef={controlsRef} />;
}

/* ------------------------------------------------------------------ */
/* Mini scene for the hub card: 3 planes, a pulse passing through       */
/* ------------------------------------------------------------------ */
function MiniScene() {
  const led = useRef();
  const planes = useRef([]);
  useFrame((sc) => {
    const t = sc.clock.elapsedTime;
    const u = (t * 0.5) % 1;
    if (led.current) {
      led.current.position.z = 0.9 - 1.8 * u;
      led.current.material.emissiveIntensity = 1.5 + Math.sin(t * 6) * 0.6;
    }
    planes.current.forEach((p, i) => {
      if (!p) return;
      const d = Math.abs(0.9 - 0.9 * i - led.current.position.z);
      p.scale.setScalar(1 + Math.max(0, 0.25 - d) * 0.6);
    });
  });
  return (
    <group position={[0, 0.7, 0]} rotation={[0, 1.1, 0]}>
      {[0, 1, 2].map((i) => (
        <Wire key={i} ref={(el) => (planes.current[i] = el)} kind="box" args={[1.4 - i * 0.3, 1.1 - i * 0.25, 0.03]} position={[0, 0, 0.9 - i * 0.9]} glass={i === 1} />
      ))}
      <Led ref={led} size={0.06} />
    </group>
  );
}

const CHALLENGES = ['Draw a 1 that it reads as a 7', 'Get > 99% confidence on any digit', 'Find which conv1 filter reacts to vertical strokes'];

export default {
  slug: 'cnn',
  name: 'CNN Digit Reader',
  tag: 'VISION',
  difficulty: 2,
  oneLiner: 'Draw a digit, watch filters light up.',
  blurb:
    'A convolutional network reads your handwriting. Draw a digit on the pad and follow it through two layers of filters, two pooling steps and a final vote. Every number on screen comes from a real forward pass of a 3.9k-parameter net trained on MNIST.',
  explain: [
    {
      title: 'What is it?',
      text: 'A convolutional neural network (CNN) is a net built for pictures. Instead of looking at all 784 pixels at once, it slides tiny 5×5 "filters" over the image and notes where each one matches — an edge here, a curve there. Stack two rounds of that and the net can tell a 3 from an 8. This one has only 3,898 weights (a phone-camera net has millions) yet scores 97.7% on the MNIST test set.',
    },
    {
      title: 'What am I looking at?',
      text: 'Left to right along the stack: your 28×28 drawing, then the 6 maps conv1 makes (bright = "my filter matched here"), the same maps shrunk by max-pooling, 12 conv2 maps that combine them, another pooling, and finally 10 bars — one per digit — whose heights are the softmax probabilities. The glowing bar is the answer.',
    },
    {
      title: 'What the controls do',
      text: 'Hover a conv1 map to see its actual 5×5 filter (white = positive weight, dark = negative) and lines back to the input it scans. "Show filters" keeps all six on screen. "Layer focus" slides the camera along the stack. "Random sample" draws a synthetic digit so there is always something to inspect.',
    },
    {
      title: 'Why it sometimes fails',
      text: 'MNIST digits are centred, 20 px tall and written with a pen, so we centre your stroke the same way before feeding it in. Thin, tilted or unusual shapes still fool a net this small — that is what the challenges are about.',
    },
  ],
  challenges: CHALLENGES,
  orbit: true,
  cameraPos: [5.4, 2.6, 4.6],
  createState,
  Scene,
  Panel,
  MiniScene,
  statusLine: (state) => {
    const s = state.get();
    const m = getCNN();
    const acc = m ? `${(m.acc * 100).toFixed(1)}%` : '97.7%';
    const params = m ? `${(m.params / 1000).toFixed(1)}k` : '3.9k';
    if (!s.loaded) return 'loading weights…';
    const read = s.pred < 0 ? 'reads: —' : `reads: ${s.pred} (${Math.round(s.conf * 100)}%)`;
    return `${read} · ${params} parameters · ${acc} on MNIST`;
  },
  challengeCheck: (state) => {
    const s = state.get();
    return [s.c1, s.c2, s.c3];
  },
};
