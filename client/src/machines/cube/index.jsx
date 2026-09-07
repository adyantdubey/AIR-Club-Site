import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Edges } from '@react-three/drei';
import * as THREE from 'three';
import { Wire, Led, Strut, GLOW } from '../../three/wire';
import { createStore, useStore } from '../../lib/store';
import { clamp } from '../../three/helpers';
import { Slider, Toggle, Readout, Row, Btn } from '../../components/ui/Controls';
import { SIZE, PITCH, STICKER, I3, AXIS_VEC, createCube, layerIndices, applyTurn, signedQuarters, toK, isIdentity, mulMM, rotPow, restoreOps } from './cubeModel';
import { FACE_INFO, moveStr, simplify, inverse, randomMove, randomScramble, planProgram } from './solver';

/*
 * Rubik's Cube Solver — two stepper-driven claws on the +X (R face) and +Z (F face) axes.
 * The cube state is exact integer maths (cubeModel.js); this file animates it.
 * Per frame we only move the 9 (or 27) cubelet groups of the current turn and one claw cup.
 */

// ---- layout (units; the viewer auto-fits) ----
const CUBE_Y = 1.0; // cube centre height
const FRAME_H = 2.0;
const FRAME_R = 1.1; // strut distance from centre
const RELEASE_DIST = 0.22; // how far a claw backs off while the other one rotates the whole cube

// ---- timing at speed 1× (seconds) ----
const QUARTER = 0.28;
const HALF = 0.42;
const RELEASE = 0.12;
const SCAN = 0.6;

const ease = (u) => u * u * (3 - 2 * u); // smoothstep
const qTmp = new THREE.Quaternion();

// Shared sticker geometry + 6 materials (created once, reused by all 54 stickers)
let _stickerGeom = null;
let _stickerMats = null;
function stickerAssets() {
  if (!_stickerGeom) {
    _stickerGeom = new THREE.PlaneGeometry(SIZE * 0.8, SIZE * 0.8);
    _stickerMats = {};
    // lit + a little self-emission: bright enough in shadow, but not blown out by the viewer's bloom
    for (const [k, c] of Object.entries(STICKER)) _stickerMats[k] = new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.3, roughness: 0.9, metalness: 0, side: THREE.DoubleSide });
  }
  return { geom: _stickerGeom, mats: _stickerMats };
}

// Where each sticker sits on its cubelet (offset + rotation so the plane faces outward)
const O = SIZE / 2 + 0.002;
const STICKER_POSE = {
  px: { position: [O, 0, 0], rotation: [0, Math.PI / 2, 0] },
  nx: { position: [-O, 0, 0], rotation: [0, -Math.PI / 2, 0] },
  py: { position: [0, O, 0], rotation: [-Math.PI / 2, 0, 0] },
  ny: { position: [0, -O, 0], rotation: [Math.PI / 2, 0, 0] },
  pz: { position: [0, 0, O], rotation: [0, 0, 0] },
  nz: { position: [0, 0, -O], rotation: [0, Math.PI, 0] },
};

function createState() {
  const s = createStore({
    speed: 1,
    showScan: true,
    phase: 'idle', // idle | scramble | solve
    program: [], // move strings of the running/last program
    cursor: -1, // index of the current move (program.length when finished)
    movesLeft: 0,
    currentMove: '—',
    scrambled: false,
  });
  s.frame.keys = new Set();
  return s;
}

/** Per-frame data lives in state.frame; (re)create it lazily so store.reset() is safe. */
function ensureFrame(f) {
  if (f.cube) return f;
  f.cube = createCube();
  f.queue = []; // primitive ops waiting to run
  f.anim = null; // the op running right now
  f.history = []; // simplified list of moves applied since solved — Solve inverts it
  f.orient = I3; // whole-cube orientation relative to the frame (identity when idle)
  f.program = [];
  f.programMoves = [];
  f.rate = 1;
  f.busy = false;
  f.miniT = 0;
  f.lastMini = null;
  f.needSync = true;
  return f;
}

/** Queue a list of moves for the claws to execute (used by the Panel). */
function startProgram(state, moves, { phase, rate = 1, scan = false }) {
  const f = ensureFrame(state.frame);
  const ops = planProgram(moves);
  if (scan) ops.unshift({ kind: 'scan', move: -1, first: true, last: true });
  f.queue = ops;
  f.rate = rate;
  f.busy = true;
  f.programMoves = moves;
  f.program = moves.map(moveStr);
  state.set({ phase, program: f.program, cursor: -1, movesLeft: moves.length, currentMove: '—' });
}

// One sticker: a flat coloured plane, child of the cubelet mesh so it rotates with it.
function Sticker({ face }) {
  const { geom, mats } = stickerAssets();
  const pose = STICKER_POSE[face];
  return (
    <mesh geometry={geom} material={mats[face]} position={pose.position} rotation={pose.rotation} userData={{ explode: false }}>
      {face === 'nz' && <Edges color={GLOW} />}
    </mesh>
  );
}

// One gripper: motor box, shaft, and a rotating cup with two finger pads that straddle the outer layer.
// Built along +X; for the Z claw the whole thing is turned 90° so local +X becomes world +Z.
function Claw({ axis, slideRef, cupRef, label, motorLabel }) {
  return (
    <group rotation-y={axis === 'z' ? -Math.PI / 2 : 0}>
      <Wire kind="box" args={[0.28, 0.3, 0.3]} position={[1.05, CUBE_Y, 0]} label={motorLabel} />
      <Wire kind="box" args={[0.1, 0.4, 0.1]} position={[1.05, CUBE_Y - 0.35, 0]} />
      <group ref={slideRef}>
        <Strut from={[0.92, CUBE_Y, 0]} to={[0.64, CUBE_Y, 0]} thick={0.09} />
        <group ref={cupRef} position={[0.6, CUBE_Y, 0]}>
          <Wire kind="cyl" args={[0.36, 0.36, 0.08, 24]} rotation-z={Math.PI / 2} label={label} />
          <Wire kind="box" args={[0.3, 0.06, 0.28]} position={[-0.16, 0.52, 0]} />
          <Wire kind="box" args={[0.3, 0.06, 0.28]} position={[-0.16, -0.52, 0]} />
        </group>
      </group>
    </group>
  );
}

function Model({ state, mode = 'hero' }) {
  const hero = mode === 'hero';
  const groups = useRef([]); // 27 cubelet groups
  const cupX = useRef();
  const cupZ = useRef();
  const slideX = useRef();
  const slideZ = useRef();
  const scan = useRef();
  const camLed = useRef();
  const led1 = useRef();
  const led2 = useRef();
  const synced = useRef(false);

  // Static description of the 27 cubelets and their outward stickers
  const cubelets = useMemo(() => {
    const list = [];
    for (let x = -1; x <= 1; x++)
      for (let y = -1; y <= 1; y++)
        for (let z = -1; z <= 1; z++) {
          const stickers = [];
          if (x === 1) stickers.push('px');
          if (x === -1) stickers.push('nx');
          if (y === 1) stickers.push('py');
          if (y === -1) stickers.push('ny');
          if (z === 1) stickers.push('pz');
          if (z === -1) stickers.push('nz');
          list.push({ i: list.length, home: [x * PITCH, y * PITCH, z * PITCH], stickers });
        }
    return list;
  }, []);
  // scratch start poses for a turn (allocated once)
  const pool = useMemo(() => Array.from({ length: 27 }, () => ({ pos: new THREE.Vector3(), quat: new THREE.Quaternion() })), []);

  useEffect(() => {
    synced.current = false;
  }, [mode]);

  useFrame((sc, dt) => {
    const f = ensureFrame(state.frame);
    const cfg = state.get();
    const t = sc.clock.elapsedTime;
    dt = Math.min(dt, 0.1);

    const snap = (i) => {
      const c = f.cube[i];
      const g = groups.current[i];
      if (g) {
        g.position.set(c.p[0] * PITCH, c.p[1] * PITCH, c.p[2] * PITCH);
        g.quaternion.copy(c.quat);
      }
    };
    if (!synced.current || f.needSync) {
      for (let i = 0; i < 27; i++) snap(i);
      synced.current = true;
      f.needSync = false;
    }

    // idle life: status LEDs always pulse
    if (led1.current) led1.current.material.emissiveIntensity = Math.sin(t * 3) > 0 ? 2.5 : 0.3;
    if (led2.current) led2.current.material.emissiveIntensity = f.busy ? 1.5 + Math.sin(t * 14) * 1.2 : 0.8 + Math.sin(t * 1.5) * 0.4;
    if (camLed.current && !(f.anim && f.anim.op.kind === 'scan')) camLed.current.material.emissiveIntensity = 1.2 + Math.sin(t * 2) * 0.6;

    // mini mode: keep turning, one random move every ~1.5 s
    if (!hero && !f.anim && !f.queue.length) {
      f.miniT += dt;
      if (f.miniT > 1.5) {
        f.miniT = 0;
        const m = randomMove(f.lastMini);
        f.lastMini = m.face;
        f.queue = planProgram([m]);
        f.rate = 0.8;
        f.busy = true;
      }
    }

    // start the next primitive op
    if (!f.anim && f.queue.length) {
      const op = f.queue.shift();
      if (op.kind === 'scan') {
        f.anim = { op, t: 0, dur: SCAN };
        if (scan.current) scan.current.visible = true;
      } else {
        let axis, layer, dir;
        if (op.kind === 'twist') ({ axis, layer, dir } = FACE_INFO[op.face]);
        else {
          axis = op.axis === 'x' ? 0 : 2;
          layer = null;
          dir = -1;
        }
        const cup = axis === 0 ? cupX.current : cupZ.current;
        const other = op.kind === 'rotate' ? (axis === 0 ? slideZ.current : slideX.current) : null;
        const s = signedQuarters(dir, op.turns);
        const idx = layerIndices(f.cube, axis, layer);
        idx.forEach((i, n) => {
          const g = groups.current[i];
          if (g) {
            pool[n].pos.copy(g.position);
            pool[n].quat.copy(g.quaternion);
          }
        });
        const spin = Math.abs(s) === 2 ? HALF : QUARTER;
        const dur = op.kind === 'rotate' ? spin + 2 * RELEASE : spin;
        f.anim = { op, t: 0, dur, axis, angle: (s * Math.PI) / 2, k: toK(s), idx, cup, cupBase: cup ? cup.rotation.x : 0, other, r1: RELEASE / dur, r2: 1 - RELEASE / dur };
      }
      if (hero && op.first && op.move >= 0) state.set({ cursor: op.move, currentMove: f.program[op.move] || '—', movesLeft: f.program.length - op.move });
    }

    // nothing left: put the cube back upright (after Stop) or go idle
    if (!f.anim && !f.queue.length && f.busy) {
      if (!isIdentity(f.orient)) f.queue.push(...restoreOps(f.orient));
      else {
        f.busy = false;
        if (hero) state.set({ phase: 'idle', currentMove: '—', cursor: f.program.length, movesLeft: 0 });
      }
    }

    // advance the running op
    const a = f.anim;
    if (!a) return;
    if (a.op.kind === 'scan') {
      a.t += dt;
      const u = clamp(a.t / a.dur, 0, 1);
      if (scan.current) scan.current.position.y = 0.62 - u * 1.24; // local to the cube group: top → bottom
      if (camLed.current) camLed.current.material.emissiveIntensity = Math.floor(a.t / 0.08) % 2 ? 4 : 0.2;
      if (a.t >= a.dur) {
        if (scan.current) scan.current.visible = false;
        f.anim = null;
      }
      return;
    }
    a.t += dt * cfg.speed * f.rate;
    const u = clamp(a.t / a.dur, 0, 1);
    let rel = 0;
    let w = u;
    if (a.op.kind === 'rotate') {
      // release the other claw → rotate the whole cube → grip again
      if (u < a.r1) {
        rel = ease(u / a.r1);
        w = 0;
      } else if (u < a.r2) {
        rel = 1;
        w = ease((u - a.r1) / (a.r2 - a.r1));
      } else {
        rel = 1 - ease((u - a.r2) / (1 - a.r2));
        w = 1;
      }
    } else w = ease(u);
    const ang = a.angle * w;
    qTmp.setFromAxisAngle(AXIS_VEC[a.axis], ang);
    a.idx.forEach((i, n) => {
      const g = groups.current[i];
      if (!g) return;
      g.position.copy(pool[n].pos).applyQuaternion(qTmp);
      g.quaternion.copy(qTmp).multiply(pool[n].quat);
    });
    if (a.cup) a.cup.rotation.x = a.cupBase + ang;
    if (a.other) a.other.position.x = rel * RELEASE_DIST;

    if (a.t >= a.dur) {
      // finish: exact integer update, then snap the groups onto it
      applyTurn(f.cube, a.idx, a.axis, a.k);
      a.idx.forEach(snap);
      if (a.cup) a.cup.rotation.x = (a.cupBase + a.angle) % (Math.PI * 2);
      if (a.other) a.other.position.x = 0;
      if (a.op.kind === 'rotate') f.orient = mulMM(rotPow(a.axis, a.k), f.orient);
      f.anim = null;
      const op = a.op;
      if (hero && op.last && op.move >= 0) {
        f.history = simplify([...f.history, f.programMoves[op.move]]);
        state.set({ scrambled: f.history.length > 0, movesLeft: f.program.length - op.move - 1 });
      }
    }
  });

  return (
    <group>
      {/* frame: 4 corner struts + top/bottom plates */}
      <Wire kind="box" args={[2.4, 0.06, 2.4]} position={[0, 0.03, 0]} explode={false} />
      <Wire kind="box" args={[2.4, 0.06, 2.4]} position={[0, FRAME_H + 0.03, 0]} explode={false} label="Frame" />
      {[
        [FRAME_R, FRAME_R],
        [-FRAME_R, FRAME_R],
        [FRAME_R, -FRAME_R],
        [-FRAME_R, -FRAME_R],
      ].map(([x, z], i) => (
        <Strut key={i} from={[x, 0.06, z]} to={[x, FRAME_H, z]} thick={0.06} />
      ))}

      {/* the cube: 27 cubelet groups, each a black box with stickers as children */}
      <group position={[0, CUBE_Y, 0]}>
        {cubelets.map((c) => (
          <group key={c.i} ref={(el) => (groups.current[c.i] = el)} position={c.home}>
            <Wire kind="box" args={[SIZE, SIZE, SIZE]} label={c.i === 13 ? 'Cube' : undefined}>
              {c.stickers.map((s) => (
                <Sticker key={s} face={s} />
              ))}
            </Wire>
          </group>
        ))}
        {/* camera scan plane (hero only) */}
        {hero && (
          <mesh ref={scan} visible={false} rotation-x={-Math.PI / 2} position={[0, 0.6, 0]} userData={{ explode: false }}>
            <planeGeometry args={[1.15, 1.15]} />
            <meshBasicMaterial color={GLOW} transparent opacity={0.28} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
          </mesh>
        )}
      </group>

      {/* the two claws */}
      <Claw axis="x" slideRef={slideX} cupRef={cupX} label="Gripper A" motorLabel="Stepper motor" />
      <Claw axis="z" slideRef={slideZ} cupRef={cupZ} label="Gripper B" />

      {/* camera module under the top plate, looking down */}
      <Wire kind="box" args={[0.22, 0.12, 0.22]} position={[0, FRAME_H - 0.12, 0]} label="Camera" />
      <Wire kind="cyl" args={[0.05, 0.05, 0.05, 16]} position={[0, FRAME_H - 0.2, 0]} glass explode={false} />
      <Led ref={camLed} position={[0.08, FRAME_H - 0.19, 0.08]} size={0.02} />

      {/* controller box on the base plate */}
      {hero && (
        <>
          <Wire kind="box" args={[0.36, 0.1, 0.24]} position={[-0.85, 0.11, 0.85]} label="Controller" />
          <Strut from={[-0.85, 0.16, 0.85]} to={[-1.08, 0.5, 1.08]} thick={0.025} />
        </>
      )}
      <Led ref={led1} position={[-0.97, 0.17, 0.78]} size={0.02} />
      <Led ref={led2} position={[-0.9, 0.17, 0.78]} size={0.02} />
    </group>
  );
}

/** Mono strip of the move sequence: done moves dim, current one glows, upcoming normal. */
function MovesStrip({ program, cursor }) {
  const box = useRef(null);
  const cur = useRef(null);
  useEffect(() => {
    const b = box.current;
    const c = cur.current;
    if (!b) return;
    b.scrollTo({ left: c ? c.offsetLeft - b.clientWidth / 2 + c.offsetWidth / 2 : 0, behavior: 'smooth' });
  }, [cursor, program]);
  return (
    <div>
      <div className="mono mb-1 text-[10px] tracking-[0.18em]" style={{ color: 'var(--muted)' }}>
        SEQUENCE
      </div>
      <div
        ref={box}
        className="mono rounded-md px-2 py-1.5 text-xs"
        style={{ overflowX: 'hidden', whiteSpace: 'nowrap', background: 'rgba(110,178,255,.06)', border: '1px solid var(--line)', maxWidth: '100%' }}
      >
        {program.length === 0 && <span style={{ color: 'var(--muted)' }}>press scramble</span>}
        {program.map((m, i) => {
          const done = i < cursor;
          const now = i === cursor;
          return (
            <span
              key={i}
              ref={now ? cur : undefined}
              style={{
                display: 'inline-block',
                marginRight: '0.6em',
                color: now ? 'var(--blue-glow)' : done ? 'var(--muted)' : 'var(--fg)',
                opacity: done ? 0.45 : 1,
                textShadow: now ? '0 0 8px var(--blue-glow)' : 'none',
                transition: 'color .2s, opacity .2s',
              }}
            >
              {m}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function Panel({ state }) {
  const speed = useStore(state, (s) => s.speed);
  const showScan = useStore(state, (s) => s.showScan);
  const phase = useStore(state, (s) => s.phase);
  const program = useStore(state, (s) => s.program);
  const cursor = useStore(state, (s) => s.cursor);
  const movesLeft = useStore(state, (s) => s.movesLeft);
  const currentMove = useStore(state, (s) => s.currentMove);
  const scrambled = useStore(state, (s) => s.scrambled);
  const running = phase !== 'idle';

  const scramble = () => startProgram(state, randomScramble(20), { phase: 'scramble', rate: 1.8 });
  const solve = () => {
    const f = ensureFrame(state.frame);
    const solution = simplify(inverse(f.history)); // the web demo simply undoes the scramble
    startProgram(state, solution, { phase: 'solve', rate: 1, scan: showScan });
  };
  const stop = () => {
    // finish the move in progress (so the cube is never left mid-turn), drop the rest
    const f = ensureFrame(state.frame);
    const cur = f.anim ? f.anim.op.move : null;
    f.queue = cur === null || cur < 0 ? [] : f.queue.filter((op) => op.move === cur);
  };

  return (
    <>
      <Row>
        <Btn primary small onClick={scramble} disabled={running}>
          Scramble
        </Btn>
        <Btn small onClick={solve} disabled={running || !scrambled}>
          Solve
        </Btn>
        <Btn small onClick={stop} disabled={!running}>
          Stop
        </Btn>
      </Row>
      <Slider label="Speed" min={0.5} max={3} step={0.1} value={speed} onChange={(v) => state.set({ speed: v })} format={(v) => `${v.toFixed(1)}×`} />
      <Toggle label="Show camera scan" value={showScan} onChange={(v) => state.set({ showScan: v })} />
      <Readout label="Cube" value={scrambled ? 'SCRAMBLED' : 'SOLVED'} />
      <Readout label="Moves left" value={movesLeft} />
      <Readout label="Current move" value={currentMove} />
      <MovesStrip program={program} cursor={cursor} />
    </>
  );
}

export default {
  slug: 'cube',
  name: "Rubik's Cube Solver",
  tag: 'PUZZLE',
  category: 'puzzle',
  oneLiner: 'Scramble, then watch the claws solve it.',
  blurb:
    'A two-gripper cube robot: a Pi camera reads the six faces, a Kociemba solver finds a solution of about 20 moves, and two NEMA17 steppers twist the cube face by face. With only two claws it can turn the R and F faces directly, so every other face is first brought into a claw by rotating the whole cube.',
  specs: [
    ['Grippers', '2 × NEMA17 + 3D-printed claws'],
    ['Drivers', 'A4988 @ 1/16 microstep'],
    ['Compute', 'Raspberry Pi 4 + Pi Camera v2'],
    ['Solver', 'Kociemba two-phase (≤ 23 moves)'],
    ['Solve time', '≈ 45 s from scan to solved'],
  ],
  tech: ['Raspberry Pi 4', 'OpenCV', 'Kociemba', 'NEMA17', 'A4988', 'Python'],
  howItWorks: [
    { title: 'Scan', text: 'The Pi camera photographs each face; OpenCV samples nine HSV patches and labels the 54 stickers by colour.' },
    { title: 'Solve', text: 'The facelet string goes into the Kociemba two-phase algorithm, which returns a ≤ 23-move solution in under a second.' },
    { title: 'Turn', text: 'Moves are translated into claw actions: R and F twist directly; U, D, L and B need a whole-cube rotation first, then a twist.' },
  ],
  buildLog: [
    { date: '2025-02', title: 'First claw prints', text: 'Three iterations of the finger pads before the cube stopped slipping.' },
    { date: '2025-04', title: 'Two-claw kinematics', text: 'Worked out the z R z\' conjugations so every face is reachable with just two motors.' },
    { date: '2025-07', title: 'Colour detection fixed', text: 'Moved from RGB thresholds to HSV with a white-balance card; no more orange/red mix-ups.' },
    { date: '2025-11', title: 'First unattended solve', text: '38 seconds from scan to solved on a 20-move scramble.' },
    { date: '2026-03', title: 'Tech fest demo', text: 'Ran 60+ solves in a day; added a cube-detect timeout so it stops gracefully when the cube is removed.' },
  ],
  controlsHelp: 'Scramble, then Solve. The web demo undoes the scramble (simplified); the real robot runs Kociemba.',
  mobileKeys: null,
  fit: 2.6,
  createState,
  Model,
  Panel,
};
