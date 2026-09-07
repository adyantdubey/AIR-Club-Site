import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { createStore, useStore } from '../../lib/store';
import { useDragOnPlane, clamp } from '../../three/helpers';
import { GLOW } from '../../three/wire';
import { Slider, Btn, Toggle, Readout, Row, Seg } from '../../components/ui/Controls';
import { createSVM, svmStep, svmSummary, finalise, decision, trainSVM } from '../../ml/svm';
import { PRESETS } from './presets';
import { HALF, SEG, hgt, makeSurfaceGeometry, sampleDecision, paintSurface, contour } from './surface';

// ---------- palette (3-D only) ----------
const BLUE = '#2d7bff';
const WHITE = '#ffffff';
const MAX_POINTS = 400;
const RETRAIN_DELAY = 0.15; // seconds of quiet before retraining
const PASSES_PER_SECOND = 120; // slow SMO down so you can watch it converge (~1 s for a full run)

// ---------- state ----------
function createState() {
  const s = createStore({
    kernel: 'rbf',
    C: 5,
    gamma: 1.2,
    showMargin: true,
    showSV: true,
    dropClass: 1,
    preset: 'ring',
    // readouts (updated ≤ 10×/s)
    nPoints: 0,
    nSupport: 0,
    accuracy: 0,
    marginWidth: null,
    training: false,
    // challenge memory: things the user has achieved this session
    linearFailed: false,
    rbfFixed: false,
    overfit: false,
    version: 0, // bump → retrain
  });
  return s;
}

/** Lazily (re)build per-frame data — survives state.reset(). */
function ensure(state) {
  const f = state.frame;
  if (!f.xs) {
    const { xs, ys } = PRESETS[state.get().preset].make();
    f.xs = xs;
    f.ys = ys;
    f.model = null;
    f.dirty = true;
    f.dirtyAt = 0;
    f.values = new Float32Array((SEG + 1) * (SEG + 1));
    state.set({ nPoints: xs.length });
  }
  return f;
}

/** Mark data/params changed: retrain after a short quiet period. */
function touch(state, patch) {
  const f = ensure(state);
  f.dirty = true;
  f.dirtyAt = -1; // "stamp me on the next frame"
  state.set({ ...(patch || {}), version: state.get().version + 1 });
}

function loadPreset(state, key) {
  const f = ensure(state);
  const { xs, ys } = PRESETS[key].make();
  f.xs = xs;
  f.ys = ys;
  touch(state, { preset: key, nPoints: xs.length });
}

// ---------- 3-D scene ----------
function Scene({ state, controlsRef }) {
  const pointsMesh = useRef();
  const ringMesh = useRef();
  const surfMesh = useRef();
  const contourGeom = useRef();
  const marginGeom = useRef();
  const wallMain = useRef();
  const wallA = useRef();
  const wallB = useRef();
  const ringMat = useRef();
  const contourMat = useRef();
  const dragId = useRef(-1);

  const surfGeom = useMemo(() => makeSurfaceGeometry(SEG), []);
  const contourPos = useMemo(() => new Float32Array(SEG * SEG * 4 * 3), []);
  const marginPos = useMemo(() => new Float32Array(SEG * SEG * 8 * 3), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colBlue = useMemo(() => new THREE.Color(BLUE), []);
  const colWhite = useMemo(() => new THREE.Color(WHITE), []);
  const tick = useRef(0);

  useEffect(() => () => surfGeom.dispose(), [surfGeom]);

  // --- dragging an existing point ---
  const onMove = useCallback(
    (p) => {
      const f = ensure(state);
      const i = dragId.current;
      if (i < 0 || !f.xs[i]) return;
      f.xs[i][0] = clamp(p.x, -HALF, HALF);
      f.xs[i][1] = clamp(p.z, -HALF, HALF);
      f.dirty = true;
      f.dirtyAt = -1;
      f.needsPaint = true; // move the sphere right away; retraining follows after the pause
    },
    [state],
  );
  const onEnd = useCallback(() => {
    dragId.current = -1;
    touch(state);
  }, [state]);
  const drag = useDragOnPlane({ onMove, onEnd, controlsRef, planeNormal: [0, 1, 0] });
  const pointHandlers = {
    ...drag.handlers,
    onPointerDown: (e) => {
      dragId.current = e.instanceId ?? -1;
      drag.handlers.onPointerDown(e);
    },
    onClick: (e) => e.stopPropagation(), // a click on a point must not drop a new one
  };

  // --- dropping a new point on the floor ---
  const onFloorClick = (e) => {
    if (e.delta > 4) return; // that was an orbit drag, not a click
    const f = ensure(state);
    if (f.xs.length >= MAX_POINTS) return;
    f.xs.push([clamp(e.point.x, -HALF, HALF), clamp(e.point.z, -HALF, HALF)]);
    f.ys.push(state.get().dropClass);
    touch(state, { nPoints: f.xs.length });
  };

  // Rebuild everything visual from the current model (called after each SMO pass)
  const repaint = (f, cfg) => {
    const m = f.model;
    // follow the kernel of the model on screen (the panel may already say otherwise while we retrain)
    const linear = m ? m.kernel === 'linear' : cfg.kernel === 'linear';
    const hs = linear ? 0 : 0.45;
    sampleDecision(m, f.values);
    paintSurface(surfGeom, f.values, { heightScale: hs, dim: linear ? 0.7 : 1 });
    // contour at 0 (the decision boundary) and, for RBF, at ±1 (the margin)
    const n0 = contour(f.values, 0, contourPos, { heightScale: hs, lift: 0.015 });
    if (contourGeom.current) {
      contourGeom.current.attributes.position.needsUpdate = true;
      contourGeom.current.setDrawRange(0, n0);
    }
    let nm = 0;
    if (!linear && cfg.showMargin) {
      nm = contour(f.values, 1, marginPos, { heightScale: hs, lift: 0.015 });
      const nm2 = contour(f.values, -1, marginPos.subarray(nm * 3), { heightScale: hs, lift: 0.015 });
      nm += nm2;
    }
    if (marginGeom.current) {
      marginGeom.current.attributes.position.needsUpdate = true;
      marginGeom.current.setDrawRange(0, nm);
    }

    // points: sit on the surface, coloured by class
    const pm = pointsMesh.current;
    const n = f.xs.length;
    if (pm) {
      const pt = [0, 0];
      for (let i = 0; i < n; i++) {
        pt[0] = f.xs[i][0];
        pt[1] = f.xs[i][1];
        const d = m ? decision(m, pt) : 0;
        const y = hgt(d) * hs + 0.06;
        dummy.position.set(pt[0], y, pt[1]);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        pm.setMatrixAt(i, dummy.matrix);
        pm.setColorAt(i, f.ys[i] > 0 ? colBlue : colWhite);
      }
      pm.count = n;
      pm.instanceMatrix.needsUpdate = true;
      if (pm.instanceColor) pm.instanceColor.needsUpdate = true;
    }
    // support-vector rings
    const rm = ringMesh.current;
    if (rm) {
      let k = 0;
      if (m && cfg.showSV) {
        const pt = [0, 0];
        for (let i = 0; i < n; i++) {
          if (m.alphas[i] <= 1e-6) continue;
          pt[0] = f.xs[i][0];
          pt[1] = f.xs[i][1];
          const y = hgt(decision(m, pt)) * hs + 0.06;
          dummy.position.set(pt[0], y, pt[1]);
          dummy.rotation.set(-Math.PI / 2, 0, 0);
          dummy.updateMatrix();
          rm.setMatrixAt(k++, dummy.matrix);
        }
        dummy.rotation.set(0, 0, 0);
      }
      rm.count = k;
      rm.instanceMatrix.needsUpdate = true;
    }

    // linear kernel: glowing wall along w·x + b = 0, plus two margin walls at w·x + b = ±1
    const showWalls = linear && m;
    let wn = 0;
    let w = [0, 0];
    if (showWalls) {
      w = finalise(m).w;
      wn = Math.hypot(w[0], w[1]);
    }
    const place = (mesh, offset, on) => {
      if (!mesh) return;
      mesh.visible = !!on && wn > 1e-6;
      if (!mesh.visible) return;
      // closest point of the line to the origin, shifted by `offset` margin widths along the normal
      const cx = (-(m.b) + offset) * (w[0] / (wn * wn));
      const cz = (-(m.b) + offset) * (w[1] / (wn * wn));
      mesh.position.set(cx, 0.25, cz);
      const dx = -w[1] / wn;
      const dz = w[0] / wn;
      mesh.rotation.set(0, Math.atan2(-dz, dx), 0);
    };
    place(wallMain.current, 0, showWalls);
    place(wallA.current, 1, showWalls && cfg.showMargin);
    place(wallB.current, -1, showWalls && cfg.showMargin);
    if (surfMesh.current) surfMesh.current.visible = true;
  };

  useFrame((sc, dt) => {
    const f = ensure(state);
    const cfg = state.get();
    const t = sc.clock.elapsedTime;

    // idle glow: rings + boundary line breathe so the scene never looks frozen
    if (ringMat.current) ringMat.current.emissiveIntensity = 1.2 + Math.sin(t * 2.2) * 0.5;
    if (contourMat.current) contourMat.current.opacity = 0.75 + Math.sin(t * 1.6) * 0.2;

    // debounce: start a fresh model ~150 ms after the last change
    if (f.dirty) {
      if (f.dirtyAt < 0) f.dirtyAt = t;
      if (t - f.dirtyAt >= RETRAIN_DELAY || !f.model) {
        f.dirty = false;
        f.model =
          f.xs.length >= 2 && new Set(f.ys).size === 2
            ? createSVM(f.xs, f.ys, { C: cfg.C, gamma: cfg.gamma, kernel: cfg.kernel, maxPasses: 6 })
            : null;
        f.needsPaint = true;
        state.set({ training: !!f.model && !f.model.done });
      }
    }

    // animate SMO: a couple of passes per frame, within a small time budget
    const m = f.model;
    if (m && !m.done) {
      const t0 = performance.now();
      const passes = Math.max(1, Math.round(Math.min(dt, 0.1) * PASSES_PER_SECOND));
      for (let k = 0; k < passes && !m.done && performance.now() - t0 < 3; k++) svmStep(m);
      tick.current++;
      if (m.done || tick.current % 2 === 0) f.needsPaint = true; // repaint every other frame while training
      if (m.done || tick.current % 6 === 0) {
        const s = svmSummary(m);
        const acc = s.accuracy;
        const patch = { nSupport: s.nSupport, accuracy: acc, marginWidth: s.marginWidth, training: !m.done };
        if (m.done) {
          // remember achievements for the challenges
          if (cfg.kernel === 'linear' && acc < 0.8) patch.linearFailed = true;
          if (cfg.kernel === 'rbf' && acc >= 0.999 && cfg.linearFailed) patch.rbfFixed = true;
          if (cfg.kernel === 'rbf' && cfg.gamma >= 6 && acc >= 0.999 && s.nSupport >= 8) patch.overfit = true;
        }
        state.set(patch);
      }
    }
    if (f.needsPaint) {
      f.needsPaint = false;
      repaint(f, cfg);
    }
  });

  // repaint (no retrain) when a pure display toggle flips
  const showMargin = useStore(state, (s) => s.showMargin);
  const showSV = useStore(state, (s) => s.showSV);
  useEffect(() => {
    state.frame.needsPaint = true;
  }, [showMargin, showSV, state]);

  return (
    <group>
      {/* invisible floor that catches clicks (drop a point) */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.001, 0]} onClick={onFloorClick}>
        <planeGeometry args={[HALF * 2, HALF * 2]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <gridHelper args={[HALF * 2, 11, '#1d3f7a', '#122a52']} position={[0, -0.002, 0]} />

      {/* decision surface (flat floor in linear mode, hills in RBF mode) */}
      <mesh ref={surfMesh} geometry={surfGeom}>
        <meshStandardMaterial vertexColors side={THREE.DoubleSide} roughness={0.8} metalness={0.1} transparent opacity={0.92} />
      </mesh>
      {/* boundary contour (decision = 0) */}
      <lineSegments>
        <bufferGeometry ref={contourGeom}>
          <bufferAttribute attach="attributes-position" args={[contourPos, 3]} />
        </bufferGeometry>
        <lineBasicMaterial ref={contourMat} color={GLOW} transparent opacity={0.9} />
      </lineSegments>
      {/* margin contours (decision = ±1), RBF only */}
      <lineSegments>
        <bufferGeometry ref={marginGeom}>
          <bufferAttribute attach="attributes-position" args={[marginPos, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color={GLOW} transparent opacity={0.28} />
      </lineSegments>

      {/* linear kernel walls */}
      <mesh ref={wallMain} visible={false}>
        <planeGeometry args={[HALF * 2.3, 0.5]} />
        <meshBasicMaterial color={GLOW} transparent opacity={0.32} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh ref={wallA} visible={false}>
        <planeGeometry args={[HALF * 2.3, 0.5]} />
        <meshBasicMaterial color={BLUE} transparent opacity={0.1} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh ref={wallB} visible={false}>
        <planeGeometry args={[HALF * 2.3, 0.5]} />
        <meshBasicMaterial color={WHITE} transparent opacity={0.08} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>

      {/* data points (instanced) — drag to move */}
      <instancedMesh ref={pointsMesh} args={[undefined, undefined, MAX_POINTS]} {...pointHandlers}>
        <sphereGeometry args={[0.055, 12, 10]} />
        <meshStandardMaterial roughness={0.7} metalness={0} />
      </instancedMesh>
      {/* support-vector rings */}
      <instancedMesh ref={ringMesh} args={[undefined, undefined, MAX_POINTS]} raycast={() => null}>
        <torusGeometry args={[0.1, 0.012, 8, 24]} />
        <meshStandardMaterial ref={ringMat} color={GLOW} emissive={GLOW} emissiveIntensity={1.4} toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

// ---------- DOM panel ----------
const logC = (c) => Math.log10(c);
const fromLogC = (v) => Math.pow(10, v);

function Panel({ state }) {
  const kernel = useStore(state, (s) => s.kernel);
  const C = useStore(state, (s) => s.C);
  const gamma = useStore(state, (s) => s.gamma);
  const showMargin = useStore(state, (s) => s.showMargin);
  const showSV = useStore(state, (s) => s.showSV);
  const dropClass = useStore(state, (s) => s.dropClass);
  const preset = useStore(state, (s) => s.preset);
  const nPoints = useStore(state, (s) => s.nPoints);
  const nSupport = useStore(state, (s) => s.nSupport);
  const accuracy = useStore(state, (s) => s.accuracy);
  const marginWidth = useStore(state, (s) => s.marginWidth);
  const training = useStore(state, (s) => s.training);
  return (
    <>
      <Seg
        label="Drop class"
        options={[
          [1, 'A · blue'],
          [-1, 'B · white'],
        ]}
        value={dropClass}
        onChange={(v) => state.set({ dropClass: v })}
      />
      <Seg
        label="Preset"
        options={Object.entries(PRESETS).map(([k, p]) => [k, p.label])}
        value={preset}
        onChange={(k) => loadPreset(state, k)}
      />
      <Row>
        <Btn
          small
          onClick={() => {
            const f = ensure(state);
            f.xs = [];
            f.ys = [];
            f.model = null;
            f.needsPaint = true;
            touch(state, { nPoints: 0, nSupport: 0, accuracy: 0, marginWidth: null });
          }}
        >
          Clear
        </Btn>
        <Btn small onClick={() => loadPreset(state, preset)}>
          Reload preset
        </Btn>
      </Row>
      <Seg
        label="Kernel"
        options={[
          ['linear', 'Linear'],
          ['rbf', 'RBF'],
        ]}
        value={kernel}
        onChange={(k) => touch(state, { kernel: k })}
      />
      <Slider label="C (softness)" min={-1} max={1.7} step={0.01} value={logC(C)} onChange={(v) => touch(state, { C: fromLogC(v) })} format={() => C.toFixed(C < 1 ? 2 : 1)} />
      {kernel === 'rbf' && <Slider label="Gamma (γ)" min={0.1} max={10} step={0.1} value={gamma} onChange={(v) => touch(state, { gamma: v })} format={(v) => v.toFixed(1)} />}
      <Toggle label="Show margin" value={showMargin} onChange={(v) => state.set({ showMargin: v })} />
      <Toggle label="Show support vectors" value={showSV} onChange={(v) => state.set({ showSV: v })} />
      <Readout label="Points" value={nPoints} />
      <Readout label="Support vectors" value={nSupport} />
      <Readout label="Train accuracy" value={`${Math.round(accuracy * 100)}${training ? ' …' : ''}`} unit="%" />
      {kernel === 'linear' && <Readout label="Margin width" value={marginWidth == null || !isFinite(marginWidth) ? '—' : marginWidth.toFixed(2)} />}
    </>
  );
}

// ---------- hub card ----------
function MiniScene() {
  const seg = 28;
  const geom = useMemo(() => makeSurfaceGeometry(seg), []);
  const { xs, ys, model } = useMemo(() => {
    const d = PRESETS.ring.make(26, 5);
    return { ...d, model: trainSVM(d.xs, d.ys, { C: 5, gamma: 1.5, kernel: 'rbf' }) };
  }, []);
  const contourPos = useMemo(() => new Float32Array(seg * seg * 4 * 3), []);
  const contourN = useMemo(() => {
    const v = new Float32Array((seg + 1) * (seg + 1));
    sampleDecision(model, v, seg);
    paintSurface(geom, v, { heightScale: 0.4 });
    return contour(v, 0, contourPos, { seg, heightScale: 0.4, lift: 0.02 });
  }, [geom, model, contourPos]);
  const group = useRef();
  const ringMat = useRef();
  useFrame((sc, dt) => {
    if (group.current) group.current.rotation.y += dt * 0.25;
    if (ringMat.current) ringMat.current.emissiveIntensity = 1.2 + Math.sin(sc.clock.elapsedTime * 2.5) * 0.5;
  });
  return (
    <group ref={group} scale={0.5}>
      <mesh geometry={geom}>
        <meshStandardMaterial vertexColors side={THREE.DoubleSide} roughness={0.8} />
      </mesh>
      <lineSegments>
        <bufferGeometry drawRange={{ start: 0, count: contourN }}>
          <bufferAttribute attach="attributes-position" args={[contourPos, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color={GLOW} />
      </lineSegments>
      {xs.map((p, i) => {
        const y = hgt(decision(model, p)) * 0.4 + 0.06;
        const sv = model.alphas[i] > 1e-6;
        return (
          <group key={i} position={[p[0], y, p[1]]}>
            <mesh>
              <sphereGeometry args={[0.06, 8, 8]} />
              <meshStandardMaterial color={ys[i] > 0 ? BLUE : WHITE} />
            </mesh>
            {sv && (
              <mesh rotation-x={-Math.PI / 2}>
                <torusGeometry args={[0.11, 0.014, 6, 18]} />
                <meshStandardMaterial ref={i === 0 ? ringMat : undefined} color={GLOW} emissive={GLOW} emissiveIntensity={1.4} toneMapped={false} />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}

// ---------- module ----------
const statusLine = (s) => {
  const parts = [s.kernel, `C ${s.C < 1 ? s.C.toFixed(2) : s.C.toFixed(1)}`];
  if (s.kernel === 'rbf') parts.push(`γ ${s.gamma.toFixed(1)}`);
  parts.push(`${s.nSupport} support vector${s.nSupport === 1 ? '' : 's'}`);
  parts.push(`acc ${Math.round(s.accuracy * 100)}%${s.training ? ' (training)' : ''}`);
  return parts.join(' · ');
};

const challengeCheck = (s) => [s.linearFailed, s.rbfFixed, s.overfit];

export default {
  slug: 'svm',
  name: 'Support Vector Machine',
  tag: 'CLASSIFICATION',
  difficulty: 2,
  oneLiner: 'Drop points, watch the best dividing surface bend.',
  blurb:
    'A support vector machine finds the line (or curve) that separates two classes with the widest possible gap. Drop blue and white points on the floor, drag them around, and watch the boundary re-solve itself in real time — with a straight line or a bendy RBF kernel.',
  explain: [
    {
      title: 'What is it?',
      text: 'An SVM is a classifier: given points of two kinds, it finds the boundary that keeps both kinds as far away from it as possible. That gap is the "margin". Only the points touching the margin matter — these are the support vectors, and they get a glowing ring here.',
    },
    {
      title: 'What am I looking at?',
      text: 'Blue spheres are class A, white are class B. In linear mode the boundary is a straight glowing wall with two faint margin walls beside it. In RBF mode the floor bends: it rises where the model is confident a point is blue, sinks where it thinks white, and the bright line is where it is exactly undecided.',
    },
    {
      title: 'What the sliders do',
      text: 'C is how much the model hates mistakes: small C accepts a few wrong points for a wider margin, big C bends over backwards to get every training point right. Gamma (RBF only) is how local each point\'s influence is: small gamma gives smooth, broad hills; large gamma makes a tight bump around every single point — which is over-fitting.',
    },
    {
      title: 'How it trains',
      text: 'Training uses SMO (Sequential Minimal Optimisation): it repeatedly picks two points that break the rules and solves for them exactly. It is slowed to about 120 passes a second so you can watch the surface settle into place.',
    },
  ],
  challenges: ['Make the linear kernel fail (accuracy < 80%)', 'Fix it with RBF', 'Find a gamma that over-fits (surface hugs single points)'],
  orbit: true,
  cameraPos: [0, 3.2, 5.2],
  createState,
  Scene,
  Panel,
  MiniScene,
  statusLine,
  challengeCheck,
};
