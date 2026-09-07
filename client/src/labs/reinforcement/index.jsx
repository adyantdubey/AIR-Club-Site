import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Wire, Led, Strut, GLOW, EDGE_SOFT } from '../../three/wire';
import { createStore, useStore } from '../../lib/store';
import { clamp, damp } from '../../three/helpers';
import { bodyParts, wheelParts, WHEEL_POSITIONS, WHEEL_RADIUS } from '../../components/three/roverParts';
import { Slider, Btn, Toggle, Readout, MiniGraph, Row, Seg } from '../../components/ui/Controls';
import * as QL from '../../ml/qlearn';

/*
 * Reinforcement Learning lab — a mini rover learns its own way to a flag on an 8×8 grid
 * with tabular Q-learning (maths in src/ml/qlearn.js).
 *
 * Reactive state (Panel, status line):   state.get() / state.set()
 * Per-frame data (agent, rover pose):    state.frame.*  (rebuilt lazily by ensure())
 */

const W = 8;
const H = 8;
const TILE = 1; // grid units per tile (the whole scene is scaled by SCENE_SCALE to fit the camera)
const SCENE_SCALE = 0.75;
const ROVER_SCALE = 0.35;
const DRIVE_SECONDS = 0.35; // seconds per tile in "Drive" mode
const LEARN_BUDGET_MS = 3; // max time per frame spent stepping the agent

// Colours for the data visuals (tiles + arrows). Solid parts use wire.jsx.
const C_DARK = new THREE.Color('#0a0f1e');
const C_BLUE = new THREE.Color('#2d7bff');
const C_WHITE = new THREE.Color('#dfe9ff');
const C_GLOW = new THREE.Color(GLOW);
const C_DIM = new THREE.Color('#16305e');

// Default world: chosen so that a greedy-only agent (ε = 0) settles on an 11-move route
// while an exploring agent finds the 9-move optimum — see challenge 3.
const DEFAULT_ROCKS = ['1,7', '2,7', '2,5', '4,6', '5,4', '7,4', '1,1'];
const DEFAULT_START = [0, 7];
const DEFAULT_FLAG = [7, 7];

// grid (x, y) → world (x, z); y grows toward the camera
const gx = (x) => (x - (W - 1) / 2) * TILE;
const gz = (y) => (y - (H - 1) / 2) * TILE;

function shortestFor(rocks, start, flag) {
  return QL.shortestPathLength(QL.createWorld({ w: W, h: H, rocks: new Set(rocks), start, flag }));
}

function createState() {
  const s = createStore({
    // knobs
    alpha: 0.3,
    gamma: 0.95,
    epsilon: 0.2,
    decay: true,
    speed: 5, // episodes per frame
    mode: 'idle', // idle | learn | drive
    edit: 'rocks', // rocks | flag | start
    // world
    rocks: [...DEFAULT_ROCKS],
    start: [...DEFAULT_START],
    flag: [...DEFAULT_FLAG],
    shortest: shortestFor(DEFAULT_ROCKS, DEFAULT_START, DEFAULT_FLAG),
    // readouts
    episode: 0,
    lastReturn: 0,
    bestReturn: null,
    pathLen: 0,
    pathReached: false,
    returns: [],
    epsAtStart: 0.2, // ε when episode 0 began (for challenge 3)
  });
  return s;
}

/** Make sure the agent + rover pose exist and match the current world. Safe to call every frame. */
function ensure(state) {
  const f = state.frame;
  const s = state.get();
  const worldKey = `${s.rocks.join('|')}/${s.start}/${s.flag}`;
  if (!f.agent || f.worldKey !== worldKey) {
    const world = QL.createWorld({ w: W, h: H, rocks: new Set(s.rocks), start: s.start, flag: s.flag });
    f.agent = QL.createAgent(world, { alpha: s.alpha, gamma: s.gamma, epsilon: s.epsilon });
    f.worldKey = worldKey;
    f.returns = [];
    f.avgLen = 60; // running average episode length (steps)
    f.epsAtStart = s.epsilon;
    f.rover = { x: gx(s.start[0]), z: gz(s.start[1]), yaw: 0, spin: 0 };
    f.target = { x: gx(s.start[0]), z: gz(s.start[1]), yaw: 0 };
    f.drive = null;
    f.pulse = 0;
    f.dirty = true; // arrows / tile colours need redrawing
    f.statsDirty = true;
    f.tick = 0;
  }
  return f.agent;
}

const yawOf = (dx, dz) => Math.atan2(-dz, dx); // rover model faces +x
function dampAngle(cur, target, lambda, dt) {
  let d = target - cur;
  d = Math.atan2(Math.sin(d), Math.cos(d)); // shortest way round
  return cur + d * (1 - Math.exp(-lambda * dt));
}

/* ------------------------------------------------------------------ brain (no visuals) */

function Brain({ state }) {
  useFrame((_, dt) => {
    const s = state.get();
    const f = state.frame;
    const agent = ensure(state);
    agent.alpha = s.alpha;
    agent.gamma = s.gamma;

    if (s.mode === 'learn') {
      // Fast-forward: about `speed` episodes per frame, but never more than ~3 ms.
      const t0 = performance.now();
      let budget = Math.max(1, Math.round(s.speed * f.avgLen));
      while (budget-- > 0) {
        if (agent.totalSteps === 0) f.epsAtStart = agent.epsilon;
        const ep = agent.episode;
        const last = QL.step(agent);
        if (agent.episode !== ep) {
          // an episode just finished
          f.avgLen = f.avgLen * 0.9 + agent.lastSteps * 0.1;
          f.returns.push(agent.lastReturn);
          if (f.returns.length > 100) f.returns.shift();
          if (s.decay) QL.epsilonDecay(agent);
          if (last.reward === QL.REWARD_FLAG) f.pulse = Math.max(f.pulse, 0.35);
        }
        if ((budget & 15) === 0 && performance.now() - t0 > LEARN_BUDGET_MS) break;
      }
      // rover jumps to wherever the agent is now
      const l = agent.last;
      f.target.x = gx(agent.x);
      f.target.z = gz(agent.y);
      if (!l.bumped && (l.toX !== l.fromX || l.toY !== l.fromY)) f.target.yaw = yawOf(l.toX - l.fromX, l.toY - l.fromY);
      f.dirty = true;
      f.statsDirty = true;
    } else if (s.mode === 'drive' && f.drive) {
      // Follow the greedy path slowly, one tile every DRIVE_SECONDS.
      const d = f.drive;
      d.t += dt;
      while (d.t >= DRIVE_SECONDS && d.i < d.path.length - 1) {
        d.t -= DRIVE_SECONDS;
        d.i++;
      }
      const a = d.path[d.i];
      const b = d.path[Math.min(d.i + 1, d.path.length - 1)];
      const k = d.i < d.path.length - 1 ? clamp(d.t / DRIVE_SECONDS, 0, 1) : 1;
      f.target.x = gx(a[0]) + (gx(b[0]) - gx(a[0])) * k;
      f.target.z = gz(a[1]) + (gz(b[1]) - gz(a[1])) * k;
      if (b !== a) f.target.yaw = yawOf(b[0] - a[0], b[1] - a[1]);
      if (d.i >= d.path.length - 1) {
        if (d.reached) f.pulse = 2.2; // flag light pulses on arrival
        f.drive = null;
        state.set({ mode: 'idle' });
      }
    }

    // Move the rover toward its target (fast snap while learning, smooth while driving)
    const r = f.rover;
    const lambda = s.mode === 'drive' ? 30 : 18;
    const px = r.x;
    const pz = r.z;
    r.x = damp(r.x, f.target.x, lambda, dt);
    r.z = damp(r.z, f.target.z, lambda, dt);
    r.yaw = dampAngle(r.yaw, f.target.yaw, 14, dt);
    const moved = Math.hypot(r.x - px, r.z - pz);
    r.spin -= moved / (WHEEL_RADIUS * ROVER_SCALE) + (s.mode === 'idle' ? 0 : dt * 0.5);
    f.pulse = Math.max(0, f.pulse - dt);

    // Cheap reactive summary, ~10× per second
    f.tick += dt;
    if (f.tick > 0.1 && f.statsDirty) {
      f.tick = 0;
      f.statsDirty = false;
      const gp = QL.greedyPath(agent);
      state.set({
        episode: agent.episode,
        lastReturn: agent.lastReturn,
        bestReturn: Number.isFinite(agent.bestReturn) ? agent.bestReturn : null,
        pathLen: gp.path.length - 1,
        pathReached: gp.reached,
        returns: f.returns.slice(),
        epsilon: agent.epsilon,
        epsAtStart: f.epsAtStart,
      });
    }
  });
  return null;
}

/* ------------------------------------------------------------------ floor tiles */

function Floor({ state, onTile }) {
  const mesh = useRef();
  const { gl } = useThree();
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), c: new THREE.Color() }), []);

  useLayoutEffect(() => {
    const im = mesh.current;
    for (let i = 0; i < W * H; i++) {
      tmp.m.makeTranslation(gx(i % W), 0, gz(Math.floor(i / W)));
      im.setMatrixAt(i, tmp.m);
      im.setColorAt(i, C_DARK);
    }
    im.instanceMatrix.needsUpdate = true;
    im.instanceColor.needsUpdate = true;
  }, [tmp]);

  useFrame(() => {
    const f = state.frame;
    const agent = ensure(state);
    if (!f.dirty || !mesh.current) return;
    // tint = max Q on the tile, normalised over the whole grid (dark → blue → white)
    let lo = Infinity;
    let hi = -Infinity;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const v = QL.maxQ(agent, x, y);
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
    const range = hi - lo;
    const im = mesh.current;
    for (let i = 0; i < W * H; i++) {
      const x = i % W;
      const y = Math.floor(i / W);
      let t = range > 1e-6 ? (QL.maxQ(agent, x, y) - lo) / range : 0;
      if (agent.world.rocks.has(QL.key(x, y))) t = 0;
      if (t < 0.6) tmp.c.copy(C_DARK).lerp(C_BLUE, t / 0.6);
      else tmp.c.copy(C_BLUE).lerp(C_WHITE, (t - 0.6) / 0.4);
      im.setColorAt(i, tmp.c);
    }
    im.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={mesh}
      args={[undefined, undefined, W * H]}
      onClick={(e) => {
        e.stopPropagation();
        if (e.instanceId != null) onTile(e.instanceId);
      }}
      onPointerOver={() => (gl.domElement.style.cursor = 'pointer')}
      onPointerOut={() => (gl.domElement.style.cursor = '')}
    >
      <boxGeometry args={[TILE * 0.94, 0.08, TILE * 0.94]} />
      <meshStandardMaterial color="#ffffff" roughness={0.6} metalness={0.4} />
    </instancedMesh>
  );
}

/** Glowing grid lines between the tiles. */
function GridLines() {
  const geom = useMemo(() => {
    const pts = [];
    const x0 = gx(0) - TILE / 2;
    const x1 = gx(W - 1) + TILE / 2;
    const z0 = gz(0) - TILE / 2;
    const z1 = gz(H - 1) + TILE / 2;
    for (let i = 0; i <= W; i++) pts.push(x0 + i * TILE, 0.045, z0, x0 + i * TILE, 0.045, z1);
    for (let j = 0; j <= H; j++) pts.push(x0, 0.045, z0 + j * TILE, x1, 0.045, z0 + j * TILE);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, []);
  return (
    <lineSegments geometry={geom}>
      <lineBasicMaterial color={EDGE_SOFT} transparent opacity={0.45} />
    </lineSegments>
  );
}

/* ------------------------------------------------------------------ Q arrows */

const UP = new THREE.Vector3(0, 1, 0);
// one quaternion per action: cone (points +y) → points along the move direction
const ARROW_QUAT = QL.ACTIONS.map(([dx, dy]) => new THREE.Quaternion().setFromUnitVectors(UP, new THREE.Vector3(dx, 0, dy)));

function Arrows({ state }) {
  const mesh = useRef();
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), p: new THREE.Vector3(), s: new THREE.Vector3(), c: new THREE.Color() }), []);

  useFrame(() => {
    const f = state.frame;
    const agent = ensure(state);
    if (!f.dirty || !mesh.current) return;
    f.dirty = false; // Floor runs before Arrows (declaration order), so clear here
    const im = mesh.current;
    const Q = agent.Q;
    for (let i = 0; i < W * H; i++) {
      const x = i % W;
      const y = Math.floor(i / W);
      const b = i * 4;
      const rock = agent.world.rocks.has(QL.key(x, y));
      let lo = Infinity;
      let hi = -Infinity;
      let best = 0;
      for (let a = 0; a < 4; a++) {
        const v = Q[b + a];
        if (v < lo) lo = v;
        if (v > hi) {
          hi = v;
          best = a;
        }
      }
      const learned = hi - lo > 1e-6;
      for (let a = 0; a < 4; a++) {
        const t = learned ? (Q[b + a] - lo) / (hi - lo) : 0; // 0..1 within this tile
        const len = rock ? 0 : 0.1 + 0.22 * t;
        const [dx, dy] = QL.ACTIONS[a];
        tmp.p.set(gx(x) + dx * (0.12 + len * 0.5), 0.1, gz(y) + dy * (0.12 + len * 0.5));
        tmp.s.set(1, len, 1);
        tmp.m.compose(tmp.p, ARROW_QUAT[a], tmp.s);
        im.setMatrixAt(b + a, tmp.m);
        if (learned && a === best) tmp.c.copy(C_GLOW);
        else tmp.c.copy(C_DIM).lerp(C_BLUE, t * 0.6);
        im.setColorAt(b + a, tmp.c);
      }
    }
    im.instanceMatrix.needsUpdate = true;
    im.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, W * H * 4]} frustumCulled={false}>
      <coneGeometry args={[0.06, 1, 5]} />
      <meshBasicMaterial color="#ffffff" toneMapped={false} />
    </instancedMesh>
  );
}

/* ------------------------------------------------------------------ rover, flag, rocks */

function MiniRover({ state }) {
  const root = useRef();
  const wheels = useRef([]);
  const led = useRef();
  const body = useMemo(() => bodyParts(), []);
  const wheel = useMemo(() => wheelParts(8), []);

  useFrame((sc) => {
    const f = state.frame;
    if (!f.rover || !root.current) return;
    const r = f.rover;
    const t = sc.clock.elapsedTime;
    root.current.position.set(r.x, 0.04 + Math.sin(t * 2.2) * 0.006, r.z);
    root.current.rotation.y = r.yaw;
    wheels.current.forEach((w) => w && (w.rotation.z = r.spin));
    if (led.current) led.current.material.emissiveIntensity = 1.2 + Math.sin(t * 4) * 0.8;
  });

  return (
    <group ref={root} scale={ROVER_SCALE}>
      <group position={[0, WHEEL_RADIUS, 0]}>
        {body.map((p, i) => (
          <Wire key={`b${i}`} kind={p.kind} args={p.args} position={p.pos} rotation={p.rot} />
        ))}
        {WHEEL_POSITIONS.map((wp, wi) => (
          <group key={`w${wi}`} position={wp} ref={(el) => (wheels.current[wi] = el)}>
            {wheel.map((p, i) => (
              <Wire key={i} kind={p.kind} args={p.args} position={p.pos} rotation={p.rot} />
            ))}
          </group>
        ))}
        <Led ref={led} position={[-0.75, 1.52, -0.3]} size={0.06} />
      </group>
    </group>
  );
}

function Flag({ state }) {
  const flag = useStore(state, (s) => s.flag);
  const led = useRef();
  const cloth = useRef();
  useFrame((sc) => {
    const t = sc.clock.elapsedTime;
    const pulse = state.frame.pulse || 0;
    if (led.current) led.current.material.emissiveIntensity = 1.4 + Math.sin(t * 3) * 0.4 + pulse * (2.5 + Math.sin(t * 18) * 2);
    if (cloth.current) cloth.current.rotation.y = Math.sin(t * 2.5) * 0.18; // gentle flutter
  });
  return (
    <group position={[gx(flag[0]), 0.04, gz(flag[1])]}>
      <Strut from={[0, 0, 0]} to={[0, 1.05, 0]} thick={0.035} />
      <group ref={cloth} position={[0, 0.85, 0]}>
        <Wire kind="plane" args={[0.45, 0.28]} glass position={[0.24, 0, 0]} />
      </group>
      <Led ref={led} position={[0, 1.08, 0]} size={0.05} />
      <mesh position={[0, 0.01, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.3, 0.36, 32]} />
        <meshBasicMaterial color={GLOW} transparent opacity={0.5} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Rocks({ state }) {
  const rocks = useStore(state, (s) => s.rocks);
  return rocks.map((k) => {
    const [x, y] = k.split(',').map(Number);
    return (
      <group key={k} position={[gx(x), 0.04, gz(y)]}>
        <Wire kind="sphere" args={[0.26, 10, 7]} position={[0.05, 0.2, -0.04]} edge={EDGE_SOFT} />
        <Wire kind="sphere" args={[0.15, 8, 6]} position={[-0.22, 0.12, 0.2]} edge={EDGE_SOFT} />
      </group>
    );
  });
}

function StartMarker({ state }) {
  const start = useStore(state, (s) => s.start);
  return (
    <mesh position={[gx(start[0]), 0.09, gz(start[1])]} rotation-x={-Math.PI / 2}>
      <ringGeometry args={[0.36, 0.42, 4]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0.35} toneMapped={false} />
    </mesh>
  );
}

/* ------------------------------------------------------------------ scene */

function Scene({ state }) {
  const onTile = (id) => {
    const s = state.get();
    const x = id % W;
    const y = Math.floor(id / W);
    const k = QL.key(x, y);
    const isStart = x === s.start[0] && y === s.start[1];
    const isFlag = x === s.flag[0] && y === s.flag[1];
    const isRock = s.rocks.includes(k);
    let patch = null;
    if (s.edit === 'rocks' && !isStart && !isFlag) patch = { rocks: isRock ? s.rocks.filter((r) => r !== k) : [...s.rocks, k] };
    else if (s.edit === 'flag' && !isRock && !isStart) patch = { flag: [x, y] };
    else if (s.edit === 'start' && !isRock && !isFlag) patch = { start: [x, y] };
    if (!patch) return;
    // any world change wipes what was learned (the old Q values are about a different world)
    const next = { ...s, ...patch };
    state.set({
      ...patch,
      shortest: shortestFor(next.rocks, next.start, next.flag),
      mode: 'idle',
      episode: 0,
      lastReturn: 0,
      bestReturn: null,
      pathLen: 0,
      pathReached: false,
      returns: [],
    });
  };

  return (
    <group scale={SCENE_SCALE}>
      <Brain state={state} />
      <Floor state={state} onTile={onTile} />
      <GridLines />
      <Arrows state={state} />
      <Rocks state={state} />
      <StartMarker state={state} />
      <Flag state={state} />
      <MiniRover state={state} />
    </group>
  );
}

/* ------------------------------------------------------------------ panel */

function Panel({ state }) {
  const alpha = useStore(state, (s) => s.alpha);
  const gamma = useStore(state, (s) => s.gamma);
  const epsilon = useStore(state, (s) => s.epsilon);
  const decay = useStore(state, (s) => s.decay);
  const speed = useStore(state, (s) => s.speed);
  const mode = useStore(state, (s) => s.mode);
  const edit = useStore(state, (s) => s.edit);
  const episode = useStore(state, (s) => s.episode);
  const lastReturn = useStore(state, (s) => s.lastReturn);
  const bestReturn = useStore(state, (s) => s.bestReturn);
  const pathLen = useStore(state, (s) => s.pathLen);
  const pathReached = useStore(state, (s) => s.pathReached);
  const shortest = useStore(state, (s) => s.shortest);
  const returns = useStore(state, (s) => s.returns);

  const learn = () => state.set({ mode: mode === 'learn' ? 'idle' : 'learn' });
  const drive = () => {
    const agent = ensure(state);
    const gp = QL.greedyPath(agent);
    const f = state.frame;
    // start from the start tile, then roll along the greedy path
    f.rover.x = gx(agent.world.start[0]);
    f.rover.z = gz(agent.world.start[1]);
    f.target.x = f.rover.x;
    f.target.z = f.rover.z;
    f.drive = { path: gp.path, reached: gp.reached, i: 0, t: 0 };
    state.set({ mode: 'drive' });
  };
  const resetQ = () => {
    const agent = ensure(state);
    QL.resetQ(agent);
    const f = state.frame;
    f.returns = [];
    f.avgLen = 60;
    f.epsAtStart = agent.epsilon;
    f.drive = null;
    f.target.x = gx(agent.world.start[0]);
    f.target.z = gz(agent.world.start[1]);
    f.dirty = true;
    state.set({ mode: 'idle', episode: 0, lastReturn: 0, bestReturn: null, pathLen: 0, pathReached: false, returns: [], epsAtStart: agent.epsilon });
  };

  return (
    <>
      <Row>
        <Btn primary small onClick={learn}>
          {mode === 'learn' ? 'Pause' : 'Learn'}
        </Btn>
        <Btn small onClick={() => state.set({ mode: 'idle' })} disabled={mode === 'idle'}>
          Pause
        </Btn>
        <Btn small onClick={drive} disabled={mode === 'drive'}>
          Drive
        </Btn>
        <Btn small onClick={resetQ}>
          Reset Q
        </Btn>
      </Row>
      <Slider label="α learning rate" min={0.05} max={1} step={0.01} value={alpha} onChange={(v) => state.set({ alpha: v })} format={(v) => v.toFixed(2)} />
      <Slider label="γ discount" min={0.5} max={0.99} step={0.01} value={gamma} onChange={(v) => state.set({ gamma: v })} format={(v) => v.toFixed(2)} />
      <Slider
        label="ε explore"
        min={0}
        max={1}
        step={0.01}
        value={epsilon}
        onChange={(v) => {
          const f = state.frame;
          if (f.agent) {
            f.agent.epsilon = v;
            if (f.agent.totalSteps === 0) f.epsAtStart = v;
          }
          state.set({ epsilon: v, ...(f.agent && f.agent.totalSteps === 0 ? { epsAtStart: v } : {}) });
        }}
        format={(v) => v.toFixed(2)}
      />
      <Toggle label="Decay ε" value={decay} onChange={(v) => state.set({ decay: v })} />
      <Slider label="Speed" min={1} max={20} step={1} value={speed} onChange={(v) => state.set({ speed: v })} format={(v) => `${v} ep/frame`} />
      <Seg
        label="Edit mode · click a tile"
        options={[
          ['rocks', 'Rocks'],
          ['flag', 'Flag'],
          ['start', 'Start'],
        ]}
        value={edit}
        onChange={(v) => state.set({ edit: v })}
      />
      <Readout label="Episode" value={episode} />
      <Readout label="Last return" value={lastReturn} />
      <Readout label="Best return" value={bestReturn == null ? '—' : bestReturn} />
      <Readout label="Greedy path" value={pathReached ? pathLen : `${pathLen} ✕`} unit={shortest >= 0 ? `tiles · min ${shortest}` : 'tiles · no route'} />
      <MiniGraph label="Return · last 100 episodes" values={returns} />
    </>
  );
}

/* ------------------------------------------------------------------ hub card */

const MINI_N = 5;
const MINI_PATH = [
  [0, 4],
  [1, 4],
  [2, 4],
  [2, 3],
  [2, 2],
  [3, 2],
  [4, 2],
  [4, 1],
  [4, 0],
];
const MINI_ROCKS = [
  [1, 3],
  [3, 3],
  [3, 0],
];
const mx = (x) => (x - (MINI_N - 1) / 2) * TILE;
const mz = (y) => (y - (MINI_N - 1) / 2) * TILE;

function MiniScene() {
  const tiles = useRef();
  const arrows = useRef();
  const rover = useRef();
  const wheels = useRef([]);
  const led = useRef();
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), p: new THREE.Vector3(), s: new THREE.Vector3(), c: new THREE.Color() }), []);
  const pose = useRef({ x: mx(0), z: mz(4), yaw: 0, spin: 0, t: 0 });

  // which arrow on each tile points along the path (best action), -1 if none
  const bestOnTile = useMemo(() => {
    const best = new Int8Array(MINI_N * MINI_N).fill(-1);
    for (let i = 0; i < MINI_PATH.length - 1; i++) {
      const [x, y] = MINI_PATH[i];
      const [nx, ny] = MINI_PATH[i + 1];
      best[y * MINI_N + x] = QL.ACTIONS.findIndex(([dx, dy]) => dx === nx - x && dy === ny - y);
    }
    return best;
  }, []);

  useLayoutEffect(() => {
    const im = tiles.current;
    for (let i = 0; i < MINI_N * MINI_N; i++) {
      const x = i % MINI_N;
      const y = Math.floor(i / MINI_N);
      tmp.m.makeTranslation(mx(x), 0, mz(y));
      im.setMatrixAt(i, tmp.m);
      // tint grows along the path (like max Q growing toward the flag)
      const k = MINI_PATH.findIndex(([px, py]) => px === x && py === y);
      const t = k < 0 ? 0.05 : 0.25 + (0.75 * k) / (MINI_PATH.length - 1);
      if (t < 0.6) tmp.c.copy(C_DARK).lerp(C_BLUE, t / 0.6);
      else tmp.c.copy(C_BLUE).lerp(C_WHITE, (t - 0.6) / 0.4);
      im.setColorAt(i, tmp.c);
    }
    im.instanceMatrix.needsUpdate = true;
    im.instanceColor.needsUpdate = true;
  }, [tmp]);

  useFrame((sc, dt) => {
    const t = sc.clock.elapsedTime;
    // arrows breathe; the path arrows glow
    const im = arrows.current;
    if (im) {
      for (let i = 0; i < MINI_N * MINI_N; i++) {
        const x = i % MINI_N;
        const y = Math.floor(i / MINI_N);
        for (let a = 0; a < 4; a++) {
          const best = bestOnTile[i] === a;
          const len = best ? 0.3 + Math.sin(t * 3 + i) * 0.03 : 0.12;
          const [dx, dy] = QL.ACTIONS[a];
          tmp.p.set(mx(x) + dx * (0.12 + len * 0.5), 0.1, mz(y) + dy * (0.12 + len * 0.5));
          tmp.s.set(1, len, 1);
          tmp.m.compose(tmp.p, ARROW_QUAT[a], tmp.s);
          im.setMatrixAt(i * 4 + a, tmp.m);
          im.setColorAt(i * 4 + a, best ? C_GLOW : C_DIM);
        }
      }
      im.instanceMatrix.needsUpdate = true;
      im.instanceColor.needsUpdate = true;
    }
    // rover hops along the fixed path, pausing at the flag
    const p = pose.current;
    p.t += dt;
    const HOP = 0.45;
    const total = MINI_PATH.length * HOP + 1.2;
    const cyc = p.t % total;
    const i = Math.min(MINI_PATH.length - 1, Math.floor(cyc / HOP));
    const a = MINI_PATH[i];
    const b = MINI_PATH[Math.min(i + 1, MINI_PATH.length - 1)];
    const px = p.x;
    const pz = p.z;
    p.x = damp(p.x, mx(a[0]), 16, dt);
    p.z = damp(p.z, mz(a[1]), 16, dt);
    if (b !== a) p.yaw = dampAngle(p.yaw, yawOf(b[0] - a[0], b[1] - a[1]), 12, dt);
    p.spin -= Math.hypot(p.x - px, p.z - pz) / (0.12) + dt * 0.6;
    if (rover.current) {
      rover.current.position.set(p.x, 0.04, p.z);
      rover.current.rotation.y = p.yaw;
    }
    wheels.current.forEach((w) => w && (w.rotation.z = p.spin));
    const atFlag = i === MINI_PATH.length - 1;
    if (led.current) led.current.material.emissiveIntensity = atFlag ? 2.5 + Math.sin(t * 16) * 1.5 : 1.4 + Math.sin(t * 3) * 0.4;
  });

  const flag = MINI_PATH[MINI_PATH.length - 1];
  return (
    <group>
      <instancedMesh ref={tiles} args={[undefined, undefined, MINI_N * MINI_N]}>
        <boxGeometry args={[TILE * 0.94, 0.08, TILE * 0.94]} />
        <meshStandardMaterial color="#ffffff" roughness={0.6} metalness={0.4} />
      </instancedMesh>
      <instancedMesh ref={arrows} args={[undefined, undefined, MINI_N * MINI_N * 4]} frustumCulled={false}>
        <coneGeometry args={[0.06, 1, 5]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </instancedMesh>
      {MINI_ROCKS.map(([x, y]) => (
        <Wire key={`${x},${y}`} kind="sphere" args={[0.24, 8, 6]} position={[mx(x), 0.24, mz(y)]} edge={EDGE_SOFT} />
      ))}
      <group position={[mx(flag[0]), 0.04, mz(flag[1])]}>
        <Strut from={[0, 0, 0]} to={[0, 1.0, 0]} thick={0.035} />
        <Wire kind="plane" args={[0.42, 0.26]} glass position={[0.22, 0.82, 0]} />
        <Led ref={led} position={[0, 1.03, 0]} size={0.05} />
      </group>
      {/* very simple rover: chassis + six wheels */}
      <group ref={rover}>
        <Wire kind="box" args={[0.56, 0.16, 0.36]} position={[0, 0.24, 0]} />
        <Wire kind="box" args={[0.5, 0.02, 0.32]} position={[0, 0.33, 0]} />
        {[
          [0.24, 0.21],
          [0, 0.21],
          [-0.24, 0.21],
          [0.24, -0.21],
          [0, -0.21],
          [-0.24, -0.21],
        ].map(([x, z], i) => (
          <group key={i} position={[x, 0.12, z]} ref={(el) => (wheels.current[i] = el)}>
            <Wire kind="cyl" args={[0.12, 0.12, 0.08, 8]} rotation={[Math.PI / 2, 0, 0]} />
          </group>
        ))}
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------ module */

function statusLine(s) {
  return `episode ${s.episode} · return ${s.lastReturn} · greedy path ${s.pathLen} tiles`;
}

/** True if some row or column is entirely rocks except for exactly one gap. */
function hasWallWithGap(rocks) {
  const set = new Set(rocks);
  for (let y = 0; y < H; y++) {
    let n = 0;
    for (let x = 0; x < W; x++) if (set.has(QL.key(x, y))) n++;
    if (n === W - 1) return true;
  }
  for (let x = 0; x < W; x++) {
    let n = 0;
    for (let y = 0; y < H; y++) if (set.has(QL.key(x, y))) n++;
    if (n === H - 1) return true;
  }
  return false;
}

function challengeCheck(s) {
  const optimal = s.pathReached && s.shortest >= 0 && s.pathLen === s.shortest;
  const wall = hasWallWithGap(s.rocks) && s.pathReached && s.episode > 0;
  // "stuck": never explored, and after 50 episodes still on a worse route than the best possible
  const stuck = s.epsAtStart === 0 && s.episode >= 50 && (!s.pathReached || s.pathLen > s.shortest);
  return [optimal, wall, stuck];
}

export default {
  slug: 'reinforcement',
  name: 'Reinforcement Learning',
  tag: 'AGENTS',
  difficulty: 2,
  oneLiner: 'The rover learns its own path to the flag.',
  blurb:
    'Nobody tells this rover where the flag is. It tries moves, gets a small penalty for every step and a big reward at the flag, and slowly builds a table of "how good is each move from each tile". That table is the whole brain — and you can watch it fill in.',
  explain: [
    {
      title: 'What is it?',
      text: 'Reinforcement learning is learning by trial and reward. The rover (the "agent") picks a move, the world answers with a score: −1 for every step, −5 for bumping a rock, +50 for reaching the flag. Its only goal is to collect the most score per run ("episode").',
    },
    {
      title: 'What am I looking at?',
      text: 'Every tile holds four arrows, one per direction. Arrow length and brightness show the Q-value: how much total future reward the rover expects if it moves that way. The bright arrow is the move it currently believes is best; the tile tint shows the best value on that tile. Early on everything is dim guesswork; as episodes pile up, a bright road forms from start to flag.',
    },
    {
      title: 'How it learns',
      text: 'After each move the rover nudges one number: Q(tile, move) moves a little toward "reward I just got + γ × the best Q on the tile I landed on". That is the whole Q-learning rule. Good news at the flag leaks backwards one tile per visit, which is why the road grows from the flag outward.',
    },
    {
      title: 'What the sliders do',
      text: 'α is how big each nudge is. γ is how much the rover cares about rewards that are still far away. ε is the chance it ignores its best guess and tries a random move — exploration. Turn ε off and it exploits the first decent route it finds and never looks for a better one; keep ε high and it never settles. "Decay ε" starts curious and grows confident.',
    },
  ],
  challenges: [
    'Reach the flag in the minimum number of tiles',
    'Add a wall of rocks with one gap and see the path re-route',
    'Set ε to 0 from the start and watch it get stuck',
  ],
  orbit: true,
  cameraPos: [5, 7, 8],
  createState,
  Scene,
  Panel,
  MiniScene,
  statusLine,
  challengeCheck,
};
