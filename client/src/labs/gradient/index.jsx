import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { createStore, useStore } from '../../lib/store';
import { clamp, damp } from '../../three/helpers';
import { GLOW } from '../../three/wire';
import { Slider, Btn, Readout, Row, Seg, MiniGraph } from '../../components/ui/Controls';
import { makeStepper, landscapeByName, clampToDomain, LANDSCAPE_LIST, LANDSCAPES } from '../../ml/optim';
import { SEG, HALF, HS, GRID_CAPACITY, makeTerrainGeometry, paintTerrain, gridLines, toWorld, toData, heightAt } from './terrain';

// ---------- constants ----------
const BLUE = '#2d7bff';
const WHITE = '#ffffff';
const RED = '#ff6b6b'; // "wrong / diverging" only
const COL = { blue: new THREE.Color(BLUE), white: new THREE.Color(WHITE), red: new THREE.Color(RED) };
const TRAIL_MAX = 400;
const BALL_R = 0.07;
const DIVERGE_LOSS = 50;
const METHODS = [
  ['sgd', 'SGD'],
  ['momentum', 'Momentum'],
  ['adam', 'Adam'],
];

// ---------- state ----------
function createState() {
  return createStore({
    landscape: 'eggbox',
    methodA: 'adam',
    methodB: 'sgd',
    lr: 0.05,
    momentum: 0.9,
    sps: 20, // optimiser steps per second
    running: true,
    start: null, // [x, y] in data space; null → landscape default
    // readouts (≤ 10×/s)
    stepA: 0,
    stepB: 0,
    lossA: 0,
    lossB: 0,
    divergedA: false,
    divergedB: false,
    histA: [],
    histB: [],
    // challenge memory
    stuckVsEscaped: false,
    diverged: false,
    valleyFast: false,
  });
}

/** One rolling ball: position in data space + optimiser scratch + bookkeeping. */
function newBall(start) {
  return { x: start[0], y: start[1], step: 0, loss: 0, gx: 0, gy: 0, diverged: false, hist: [] };
}

/** Lazily (re)build per-frame data — survives state.reset(). */
function ensure(state) {
  const f = state.frame;
  if (!f.balls) {
    f.balls = [null, null];
    f.steppers = [null, null];
    f.cfgKey = '';
    f.acc = 0;
    f.trailN = [0, 0];
    f.trails = [new Float32Array(TRAIL_MAX * 3), new Float32Array(TRAIL_MAX * 3)];
    f.trailDirty = [true, true];
    f.resetAll = true;
    f.tick = 0;
  }
  return f;
}

function startOf(cfg) {
  return cfg.start || landscapeByName(cfg.landscape).start;
}

/** Put both balls back on the start point, clear trails. */
function resetBalls(state) {
  const f = ensure(state);
  const cfg = state.get();
  const s = startOf(cfg);
  f.balls = [newBall(s), newBall(s)];
  f.trailN = [0, 0];
  f.trailDirty = [true, true];
  f.acc = 0;
  f.cfgKey = ''; // force steppers to rebuild
  f.resetAll = false;
  const land = landscapeByName(cfg.landscape);
  const l = land.f(s[0], s[1]);
  f.balls[0].loss = l;
  f.balls[1].loss = l;
  state.set({ stepA: 0, stepB: 0, lossA: l, lossB: l, divergedA: false, divergedB: false, histA: [l], histB: [l] });
}

/** Advance one ball by one optimiser step; clamp to the board; detect blow-ups. */
function stepBall(ball, stepper, land) {
  const px = ball.x;
  const py = ball.y;
  stepper(ball);
  const raw = land.f(ball.x, ball.y);
  const jump = Math.hypot(ball.x - px, ball.y - py);
  if (!isFinite(raw) || raw > DIVERGE_LOSS || jump > 50 || !isFinite(jump)) {
    ball.diverged = true;
    if (!isFinite(ball.x) || !isFinite(ball.y)) {
      ball.x = px;
      ball.y = py;
    }
  }
  clampToDomain(land, ball);
  ball.loss = land.f(ball.x, ball.y);
  ball.step++;
  ball.hist.push(ball.loss);
  if (ball.hist.length > 120) ball.hist.shift();
}

function stepBoth(state) {
  const f = ensure(state);
  const land = landscapeByName(state.get().landscape);
  for (let k = 0; k < 2; k++) {
    stepBall(f.balls[k], f.steppers[k], land);
    // trail point (world space)
    const b = f.balls[k];
    const [X, Z] = toWorld(land, b.x, b.y);
    const Y = heightAt(land, b.x, b.y) + 0.04;
    const tr = f.trails[k];
    if (f.trailN[k] >= TRAIL_MAX) {
      tr.copyWithin(0, 3);
      f.trailN[k] = TRAIL_MAX - 1;
    }
    const i = f.trailN[k];
    tr[i * 3] = X;
    tr[i * 3 + 1] = Y;
    tr[i * 3 + 2] = Z;
    f.trailN[k]++;
    f.trailDirty[k] = true;
  }
}

/** Make sure the two optimisers match the current sliders (cheap: only rebuilds on change). */
function syncSteppers(state) {
  const f = ensure(state);
  const cfg = state.get();
  const key = `${cfg.landscape}|${cfg.methodA}|${cfg.methodB}|${cfg.lr}|${cfg.momentum}`;
  if (key === f.cfgKey) return;
  const land = landscapeByName(cfg.landscape);
  const opts = { lr: cfg.lr, momentum: cfg.momentum };
  f.steppers = [makeStepper(land.grad, { ...opts, method: cfg.methodA }), makeStepper(land.grad, { ...opts, method: cfg.methodB })];
  f.cfgKey = key;
}

// ---------- 3-D scene ----------
function Ball({ color, ballRef, lightRef, arrowRef, trailRef, trailPos }) {
  const arrow = useMemo(() => {
    const a = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 0.4, GLOW, 0.12, 0.07);
    a.line.material.transparent = true;
    a.cone.material.transparent = true;
    return a;
  }, []);
  useEffect(() => {
    arrowRef.current = arrow;
  }, [arrow, arrowRef]);
  return (
    <group>
      <mesh ref={ballRef} raycast={() => null}>
        <sphereGeometry args={[BALL_R, 18, 14]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.2} toneMapped={false} roughness={0.3} />
      </mesh>
      <pointLight ref={lightRef} color={color} intensity={1.6} distance={1.6} decay={2} />
      <primitive object={arrow} />
      <line ref={trailRef} raycast={() => null}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[trailPos, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color={color} transparent opacity={0.7} />
      </line>
    </group>
  );
}

function Scene({ state }) {
  const landscape = useStore(state, (s) => s.landscape);
  const land = landscapeByName(landscape);
  const geom = useMemo(() => makeTerrainGeometry(SEG), []);
  const gridPos = useMemo(() => new Float32Array(GRID_CAPACITY), []);
  const gridGeom = useRef();
  const ballRefs = [useRef(), useRef()];
  const lightRefs = [useRef(), useRef()];
  const arrowRefs = [useRef(), useRef()];
  const trailRefs = [useRef(), useRef()];
  const f = ensure(state);
  const dir = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => () => geom.dispose(), [geom]);

  // rebuild terrain + grid when the landscape changes
  useEffect(() => {
    paintTerrain(geom, land, SEG);
    const n = gridLines(land, gridPos, { seg: SEG, every: 4 });
    if (gridGeom.current) {
      gridGeom.current.attributes.position.needsUpdate = true;
      gridGeom.current.setDrawRange(0, n);
    }
    state.frame.resetAll = true;
  }, [land, geom, gridPos, state]);

  const onSurfaceClick = (e) => {
    if (e.delta > 4) return; // orbit drag, not a click
    const [x, y] = toData(land, clamp(e.point.x, -HALF, HALF), clamp(e.point.z, -HALF, HALF));
    state.set({ start: [x, y] });
    state.frame.resetAll = true;
  };

  useFrame((sc, dt) => {
    const f = ensure(state);
    const cfg = state.get();
    const t = sc.clock.elapsedTime;
    if (f.resetAll || !f.balls[0]) resetBalls(state);
    syncSteppers(state);

    // run the optimisers at `sps` steps per second (max 60 per frame)
    if (cfg.running) {
      f.acc += Math.min(dt, 0.1) * cfg.sps;
      let n = 0;
      while (f.acc >= 1 && n < 60) {
        stepBoth(state);
        f.acc -= 1;
        n++;
      }
    }

    // move the visuals (smoothly) to the balls' true positions
    for (let k = 0; k < 2; k++) {
      const b = f.balls[k];
      const mesh = ballRefs[k].current;
      if (!mesh) continue;
      const [X, Z] = toWorld(land, b.x, b.y);
      const Y = heightAt(land, b.x, b.y) + BALL_R;
      mesh.position.x = damp(mesh.position.x, X, 22, dt);
      mesh.position.y = damp(mesh.position.y, Y, 22, dt);
      mesh.position.z = damp(mesh.position.z, Z, 22, dt);
      const pulse = 1.1 + Math.sin(t * 3 + k) * 0.35;
      mesh.material.emissiveIntensity = b.diverged ? 1.4 + Math.sin(t * 12) * 0.8 : pulse;
      mesh.material.emissive.copy(b.diverged ? COL.red : k === 0 ? COL.blue : COL.white);
      const light = lightRefs[k].current;
      if (light) {
        light.position.copy(mesh.position).y += 0.25;
        light.intensity = 1.2 + pulse * 0.6;
      }
      // arrow = −gradient, length ∝ slope
      const arrow = arrowRefs[k].current;
      if (arrow) {
        const gx = b.gx || 0;
        const gy = b.gy || 0;
        const mag = Math.hypot(gx, gy);
        arrow.visible = mag > 1e-4;
        if (arrow.visible) {
          const { x: dx, y: dy } = land.domain;
          dir.set((-gx * 2 * HALF) / (dx[1] - dx[0]), 0, (-gy * 2 * HALF) / (dy[1] - dy[0])).normalize();
          arrow.setDirection(dir);
          const len = clamp(mag * 0.7, 0.12, 1.2);
          arrow.setLength(len, Math.min(0.12, len * 0.4), 0.06);
          arrow.position.copy(mesh.position).y += 0.06;
          arrow.line.material.opacity = arrow.cone.material.opacity = 0.75 + Math.sin(t * 2.5) * 0.2;
        }
      }
      const trail = trailRefs[k].current;
      if (trail && f.trailDirty[k]) {
        f.trailDirty[k] = false;
        const attr = trail.geometry.attributes.position;
        if (attr.array !== f.trails[k]) attr.array = f.trails[k]; // frame data was rebuilt (state.reset)
        attr.needsUpdate = true;
        trail.geometry.setDrawRange(0, f.trailN[k]);
      }
    }

    // cheap reactive summary ≤ 10×/s
    f.tick += dt;
    if (f.tick > 0.1) {
      f.tick = 0;
      const [a, b] = f.balls;
      const patch = {
        stepA: a.step,
        stepB: b.step,
        lossA: a.loss,
        lossB: b.loss,
        divergedA: a.diverged,
        divergedB: b.diverged,
        histA: a.hist.slice(),
        histB: b.hist.slice(),
      };
      // challenge checks
      if ((a.diverged || b.diverged) && !cfg.diverged) patch.diverged = true;
      if (cfg.landscape === 'valley' && ((a.loss < 0.01 && a.step < 100 && a.step > 0) || (b.loss < 0.01 && b.step < 100 && b.step > 0))) patch.valleyFast = true;
      if (cfg.landscape === 'eggbox' && !cfg.stuckVsEscaped) {
        const pair = [
          [cfg.methodA, a],
          [cfg.methodB, b],
        ];
        const sgd = pair.find((p) => p[0] === 'sgd')?.[1];
        const adam = pair.find((p) => p[0] === 'adam')?.[1];
        if (sgd && adam && sgd.step >= 80 && adam.step >= 80) {
          const stuck = sgd.loss > 0.08 && Math.hypot(sgd.gx, sgd.gy) < 0.03;
          if (stuck && adam.loss < 0.05) patch.stuckVsEscaped = true;
        }
      }
      state.set(patch);
    }
  });

  return (
    <group>
      <mesh geometry={geom} onClick={onSurfaceClick}>
        <meshStandardMaterial vertexColors side={THREE.DoubleSide} roughness={0.85} metalness={0.05} />
      </mesh>
      <lineSegments raycast={() => null}>
        <bufferGeometry ref={gridGeom}>
          <bufferAttribute attach="attributes-position" args={[gridPos, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color={GLOW} transparent opacity={0.14} />
      </lineSegments>
      <Ball color={BLUE} ballRef={ballRefs[0]} lightRef={lightRefs[0]} arrowRef={arrowRefs[0]} trailRef={trailRefs[0]} trailPos={f.trails[0]} />
      <Ball color={WHITE} ballRef={ballRefs[1]} lightRef={lightRefs[1]} arrowRef={arrowRefs[1]} trailRef={trailRefs[1]} trailPos={f.trails[1]} />
    </group>
  );
}

// ---------- DOM panel ----------
const fmtLoss = (v) => (v >= 100 ? v.toExponential(1) : v >= 10 ? v.toFixed(1) : v.toFixed(3));
// Red-ish flash without a new hex in the DOM: rotate the theme's blue-glow hue.
const flash = { color: 'var(--blue-glow)', filter: 'hue-rotate(150deg) saturate(1.5)' };

function BallReadout({ name, step, loss, diverged, hist, color }) {
  return (
    <div className="rounded-lg px-2 py-1" style={{ background: 'rgba(110,178,255,.06)' }}>
      <Readout label={`${name} · step`} value={step} />
      <Readout label={`${name} · loss`} value={<span className={diverged ? 'animate-pulse' : ''} style={diverged ? flash : undefined}>{diverged ? `${fmtLoss(loss)} ⚠ diverging` : fmtLoss(loss)}</span>} />
      <MiniGraph values={hist} min={0} max={Math.max(0.05, ...hist.map((v) => Math.min(v, 5)))} color={color} height={36} />
    </div>
  );
}

function Panel({ state }) {
  const landscape = useStore(state, (s) => s.landscape);
  const methodA = useStore(state, (s) => s.methodA);
  const methodB = useStore(state, (s) => s.methodB);
  const lr = useStore(state, (s) => s.lr);
  const momentum = useStore(state, (s) => s.momentum);
  const sps = useStore(state, (s) => s.sps);
  const running = useStore(state, (s) => s.running);
  const stepA = useStore(state, (s) => s.stepA);
  const stepB = useStore(state, (s) => s.stepB);
  const lossA = useStore(state, (s) => s.lossA);
  const lossB = useStore(state, (s) => s.lossB);
  const divergedA = useStore(state, (s) => s.divergedA);
  const divergedB = useStore(state, (s) => s.divergedB);
  const histA = useStore(state, (s) => s.histA);
  const histB = useStore(state, (s) => s.histB);
  const reset = () => {
    state.frame.resetAll = true;
  };
  return (
    <>
      <Seg
        label="Landscape"
        options={LANDSCAPE_LIST.map((l) => [l.name, l.label])}
        value={landscape}
        onChange={(v) => {
          state.set({ landscape: v, start: null });
          reset();
        }}
      />
      <Seg
        label="Ball A (blue)"
        options={METHODS}
        value={methodA}
        onChange={(v) => {
          state.set({ methodA: v });
          reset();
        }}
      />
      <Seg
        label="Ball B (white)"
        options={METHODS}
        value={methodB}
        onChange={(v) => {
          state.set({ methodB: v });
          reset();
        }}
      />
      <Slider label="Learning rate" min={-3} max={Math.log10(0.5)} step={0.01} value={Math.log10(lr)} onChange={(v) => state.set({ lr: Math.pow(10, v) })} format={() => lr.toFixed(lr < 0.01 ? 4 : 3)} />
      <Slider label="Momentum β" min={0} max={0.99} step={0.01} value={momentum} onChange={(v) => state.set({ momentum: v })} format={(v) => v.toFixed(2)} />
      <Slider label="Steps per second" min={1} max={60} step={1} value={sps} onChange={(v) => state.set({ sps: v })} format={(v) => `${v}`} />
      <Row>
        <Btn small primary={!running} onClick={() => state.set({ running: !running })}>
          {running ? 'Pause' : 'Run'}
        </Btn>
        <Btn
          small
          onClick={() => {
            ensure(state);
            if (!state.frame.balls[0]) resetBalls(state);
            syncSteppers(state);
            state.set({ running: false });
            stepBoth(state);
          }}
        >
          Step
        </Btn>
        <Btn small onClick={reset}>
          Reset
        </Btn>
      </Row>
      <BallReadout name="A" step={stepA} loss={lossA} diverged={divergedA} hist={histA} color="var(--blue-glow)" />
      <BallReadout name="B" step={stepB} loss={lossB} diverged={divergedB} hist={histB} color="var(--fg)" />
    </>
  );
}

// ---------- hub card ----------
function MiniScene() {
  const seg = 24;
  const land = LANDSCAPES.bowl;
  const geom = useMemo(() => {
    const g = makeTerrainGeometry(seg);
    paintTerrain(g, land, seg);
    return g;
  }, [land]);
  const trailPos = useMemo(() => new Float32Array(120 * 3), []);
  const ball = useRef();
  const trail = useRef();
  const f = useRef({ b: null, stepper: makeStepper(land.grad, { method: 'momentum', lr: 0.08, momentum: 0.85 }), acc: 0, n: 0, life: 99 });
  useFrame((sc, dt) => {
    const s = f.current;
    s.life += dt;
    if (s.life > 4.5 || !s.b) {
      // new run from a random spot on the rim
      const a = Math.random() * Math.PI * 2;
      s.b = { x: Math.cos(a) * 1.7, y: Math.sin(a) * 1.7 };
      s.n = 0;
      s.life = 0;
      s.acc = 0;
    }
    s.acc += dt * 30;
    while (s.acc >= 1) {
      s.acc -= 1;
      s.stepper(s.b);
      clampToDomain(land, s.b);
      if (s.n < 120) {
        const [X, Z] = toWorld(land, s.b.x, s.b.y);
        trailPos[s.n * 3] = X;
        trailPos[s.n * 3 + 1] = heightAt(land, s.b.x, s.b.y) + 0.04;
        trailPos[s.n * 3 + 2] = Z;
        s.n++;
      }
      if (trail.current) {
        trail.current.geometry.attributes.position.needsUpdate = true;
        trail.current.geometry.setDrawRange(0, s.n);
      }
    }
    if (ball.current) {
      const [X, Z] = toWorld(land, s.b.x, s.b.y);
      ball.current.position.set(X, heightAt(land, s.b.x, s.b.y) + 0.09, Z);
      ball.current.material.emissiveIntensity = 1.1 + Math.sin(sc.clock.elapsedTime * 3) * 0.3;
    }
  });
  return (
    <group scale={0.55}>
      <mesh geometry={geom}>
        <meshStandardMaterial vertexColors side={THREE.DoubleSide} roughness={0.85} />
      </mesh>
      <mesh ref={ball}>
        <sphereGeometry args={[0.09, 12, 10]} />
        <meshStandardMaterial color={BLUE} emissive={BLUE} emissiveIntensity={1.2} toneMapped={false} />
      </mesh>
      <line ref={trail}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[trailPos, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color={GLOW} transparent opacity={0.7} />
      </line>
    </group>
  );
}

// ---------- module ----------
const statusLine = (s) => `${s.landscape} · ${s.methodA} vs ${s.methodB} · step ${s.stepA} · loss ${fmtLoss(s.lossA)} / ${fmtLoss(s.lossB)}`;
const challengeCheck = (s) => [s.stuckVsEscaped, s.diverged, s.valleyFast];

export default {
  slug: 'gradient',
  name: 'Gradient Descent',
  tag: 'OPTIMISATION',
  difficulty: 1,
  oneLiner: 'Roll a ball down a loss landscape.',
  blurb:
    'Every neural network is trained by gradient descent: measure how wrong you are, look at which way is downhill, take a small step. Here the "wrongness" is a landscape you can see, and two balls race down it using different optimisers — plain SGD, momentum and Adam.',
  explain: [
    {
      title: 'What is it?',
      text: 'The height of the surface is the loss: how wrong a model is for a given choice of two parameters (x and y). Training means finding the lowest point. Gradient descent does this blindly: it only knows the slope under its feet and steps downhill.',
    },
    {
      title: 'What am I looking at?',
      text: 'Two glowing balls start from the same spot (click anywhere on the surface to move it). The arrow at each ball is the negative gradient — the downhill direction, longer where the slope is steeper. The trail shows the path taken; the graphs show each ball\'s loss over its recent steps.',
    },
    {
      title: 'The optimisers',
      text: 'SGD steps straight downhill, a distance proportional to the slope, so it crawls on flat ground and can get trapped in a small dip. Momentum keeps a velocity like a heavy ball, so it rolls through shallow dips and along curved valleys. Adam scales each direction by its recent gradient size, so it moves about the same distance per step whether the ground is steep or flat.',
    },
    {
      title: 'What the sliders do',
      text: 'The learning rate is the step size: too small and the ball takes forever; too big and it overshoots, bounces and finally flies off (the readout flashes red). β is how much of its speed a momentum ball keeps each step (Adam uses it as the memory of the gradient average).',
    },
  ],
  challenges: ['Make SGD get stuck in the eggbox while Adam escapes', 'Diverge with a learning rate that is too big', 'Reach loss < 0.01 in under 100 steps on the valley'],
  orbit: true,
  cameraPos: [0, 3.4, 5.6],
  createState,
  Scene,
  Panel,
  MiniScene,
  statusLine,
  challengeCheck,
};
