// LAB 3 — Distillation. A big "teacher" net learns the data, then a small "student" net learns from
// the teacher's soft probabilities (at temperature T) instead of the raw labels. A twin student
// trained on the labels alone shows whether distillation actually helped.

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { createStore, useStore } from '../../lib/store';
import { createMLP, trainStep, accuracy, forward, predictProb, temperatureSoftmax, softTargets, clone, paramCount } from '../../ml/mlp';
import { DATASETS } from '../../ml/datasets';
import { Slider, Btn, Readout, MiniGraph, Row, Seg } from '../../components/ui/Controls';
import { NetView, Surface, DataPoints, rowLayout, sweepProbe, C_BLUE, C_WHITE } from '../playground/viz';

const N_POINTS = 250;
const NOISE = 0.2; // noisy labels — exactly the situation where soft labels help
const STEPS_PER_EPOCH = Math.ceil(N_POINTS / 16);
const STUDENT_EPOCHS = 300;
const TEACHER_SIZES = [2, 16, 16, 2];
const STUDENT_SIZES = [2, 6, 6, 2];
const TEACHER_X = [-4.9, -1.5]; // teacher spans these x positions (input → output)
const STUDENT_X = [4.9, 1.5]; // student is mirrored: input on the right, output facing the teacher
const NET_Y = 1.7;
const NET_Z = -1.4;
const TILE = 3.0;
const TEACHER_PARAMS = paramCount(createMLP(TEACHER_SIZES));
const STUDENT_PARAMS = paramCount(createMLP(STUDENT_SIZES));

function createState() {
  return createStore({
    dataset: 'spiral',
    T: 4,
    alpha: 0,
    phase: 'idle', // 'teacher' | 'distil' | 'alone'
    teacherAcc: 0,
    distAcc: 0,
    aloneAcc: 0,
    teacherEpoch: 0,
    distEpoch: 0,
    aloneEpoch: 0,
    teacherDone: false,
    distDone: false,
    aloneDone: false,
    studentLoss: 0,
    hist: [],
    lastT: null,
    done: [false, false, false],
  });
}

function ensure(state) {
  const s = state.get();
  const f = state.frame;
  const key = `${s.dataset}|${f.gen || 0}`;
  if (f.key === key && f.teacher) return f;
  f.key = key;
  const seed = 1 + (f.gen || 0);
  f.data = DATASETS[s.dataset](N_POINTS, NOISE, seed);
  f.test = DATASETS[s.dataset](400, 0.05, 99 + seed); // held-out points to measure real accuracy
  f.teacher = createMLP(TEACHER_SIZES, { activation: 'relu', seed });
  f.student0 = createMLP(STUDENT_SIZES, { activation: 'relu', seed: seed + 2 }); // shared starting point
  f.student = clone(f.student0);
  f.alone = clone(f.student0);
  f.soft = null;
  f.steps = { teacher: 0, distil: 0, alone: 0 };
  f.tick = 0;
  f.hist = [];
  f.histEpoch = -1;
  f.probeXY = [0, 0];
  state.set({ phase: 'idle', teacherAcc: 0, distAcc: 0, aloneAcc: 0, teacherEpoch: 0, distEpoch: 0, aloneEpoch: 0, teacherDone: false, distDone: false, aloneDone: false, studentLoss: 0, hist: [], lastT: null });
  return f;
}

// Runs whichever training phase is active for ≤ 1 epoch / ≤ 3 ms, and pushes summaries every 6 frames.
function trainTick(state, f) {
  const s = state.get();
  const { xs, ys } = f.data;
  const t0 = performance.now();
  let n = 0;
  let loss = f.lastLoss || 0;
  if (s.phase === 'teacher') {
    while (n < STEPS_PER_EPOCH && performance.now() - t0 < 3) {
      trainStep(f.teacher, xs, ys, { lr: 0.01, optimizer: 'adam', batch: 16, lossType: 'softmax' });
      f.steps.teacher++;
      n++;
    }
  } else if (s.phase === 'distil') {
    if (!f.soft) f.soft = softTargets(f.teacher, xs, s.T);
    while (n < STEPS_PER_EPOCH && performance.now() - t0 < 3) {
      loss = trainStep(f.student, xs, f.soft, { lr: 0.02, optimizer: 'adam', batch: 16, lossType: 'softmax', temperature: s.T, hardYs: ys, alpha: s.alpha });
      f.steps.distil++;
      n++;
    }
  } else if (s.phase === 'alone') {
    while (n < STEPS_PER_EPOCH && performance.now() - t0 < 3) {
      loss = trainStep(f.alone, xs, ys, { lr: 0.02, optimizer: 'adam', batch: 16, lossType: 'softmax' });
      f.steps.alone++;
      n++;
    }
  }
  f.lastLoss = loss;
}

function summarise(state, f) {
  const s = state.get();
  const { xs, ys } = f.data;
  const test = f.test;
  const patch = {};
  if (s.phase === 'teacher') {
    const epoch = Math.floor(f.steps.teacher / STEPS_PER_EPOCH);
    const trainAcc = accuracy(f.teacher, xs, ys);
    patch.teacherEpoch = epoch;
    patch.teacherAcc = accuracy(f.teacher, test.xs, test.ys);
    if ((trainAcc >= 0.97 && epoch >= 120) || epoch >= 400) {
      patch.phase = 'idle';
      patch.teacherDone = true;
    }
  } else if (s.phase === 'distil') {
    const epoch = Math.floor(f.steps.distil / STEPS_PER_EPOCH);
    patch.distEpoch = epoch;
    patch.distAcc = accuracy(f.student, test.xs, test.ys);
    patch.studentLoss = f.lastLoss;
    if (epoch > f.histEpoch) {
      f.hist.push(f.lastLoss);
      if (f.hist.length > 120) f.hist.shift();
      f.histEpoch = epoch;
      patch.hist = f.hist.slice();
    }
    if (epoch >= STUDENT_EPOCHS) {
      patch.phase = 'idle';
      patch.distDone = true;
      patch.lastT = s.T;
    }
  } else if (s.phase === 'alone') {
    const epoch = Math.floor(f.steps.alone / STEPS_PER_EPOCH);
    patch.aloneEpoch = epoch;
    patch.aloneAcc = accuracy(f.alone, test.xs, test.ys);
    if (epoch >= STUDENT_EPOCHS) {
      patch.phase = 'idle';
      patch.aloneDone = true;
    }
  }
  const n = { ...s, ...patch };
  const both = n.distDone && n.aloneDone;
  patch.done = [
    s.done[0] || n.teacherAcc >= 0.95,
    s.done[1] || (both && n.distAcc - n.aloneAcc >= 0.05),
    s.done[2] || (both && n.distAcc <= n.aloneAcc + 0.01),
  ];
  state.set(patch);
}

/** Soft-label particles flying from the teacher's output neurons to the student's. */
function SoftStream({ state, count = 160 }) {
  const pts = useRef();
  const pos = useMemo(() => new Float32Array(count * 3), [count]);
  const col = useMemo(() => new Float32Array(count * 3), [count]);
  const parts = useMemo(() => Array.from({ length: count }, () => ({ t: Math.random(), v: 0.35 + Math.random() * 0.3, y0: 0, y1: 0, dy: 0, dz: 0, p: 0.5 })), [count]);
  const tmp = useMemo(() => new THREE.Color(), []);
  const from = TEACHER_X[1];
  const to = STUDENT_X[1];

  useFrame((_, dt) => {
    const f = state.frame;
    if (!pts.current || !f.teacher) return;
    const s = state.get();
    const { xs } = f.data;
    const L = TEACHER_SIZES.length - 1;
    const spread = 0.04 + 0.5 * ((s.T - 1) / 9); // hotter → wider, more mixed stream
    for (let k = 0; k < count; k++) {
      const p = parts[k];
      p.t += dt * p.v;
      if (p.t > 1) {
        // spawn: pick a data point, ask the teacher, colour by its (softened) probability of class 1
        p.t = 0;
        const i = Math.floor(Math.random() * xs.length);
        p.p = temperatureSoftmax(forward(f.teacher, xs[i])[L], s.T)[1];
        p.y0 = NET_Y + (p.p > 0.5 ? 0.1 : -0.1); // leave from the matching output neuron
        p.y1 = NET_Y + (p.p > 0.5 ? 0.18 : -0.18);
        p.dy = (Math.random() - 0.5) * 2 * spread;
        p.dz = (Math.random() - 0.5) * 2 * spread;
        tmp.copy(C_WHITE).lerp(C_BLUE, p.p);
        col[k * 3] = tmp.r;
        col[k * 3 + 1] = tmp.g;
        col[k * 3 + 2] = tmp.b;
      }
      const t = p.t;
      const arc = Math.sin(t * Math.PI);
      pos[k * 3] = from + (to - from) * t;
      pos[k * 3 + 1] = p.y0 + (p.y1 - p.y0) * t + arc * (0.5 + p.dy);
      pos[k * 3 + 2] = NET_Z + arc * p.dz;
    }
    pts.current.geometry.attributes.position.needsUpdate = true;
    pts.current.geometry.attributes.color.needsUpdate = true;
  });

  return (
    <points ref={pts} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[pos, 3]} />
        <bufferAttribute attach="attributes-color" args={[col, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.09} vertexColors transparent opacity={0.95} sizeAttenuation toneMapped={false} depthWrite={false} />
    </points>
  );
}

function Scene({ state }) {
  const teacherLayout = rowLayout({ x0: TEACHER_X[0], x1: TEACHER_X[1], y: NET_Y, z: NET_Z, gap: 0.2 });
  const studentLayout = rowLayout({ x0: STUDENT_X[0], x1: STUDENT_X[1], y: NET_Y, z: NET_Z, gap: 0.36 });

  useFrame((sc) => {
    const f = ensure(state);
    const s = state.get();
    f.probeXY = sweepProbe(sc.clock.elapsedTime);
    if (s.phase !== 'idle') trainTick(state, f);
    f.tick++;
    if (s.phase !== 'idle' && f.tick % 6 === 0) summarise(state, f);
  });

  const val = (which) => (x, y) => (state.frame[which] ? predictProb(state.frame[which], [x, y]) : 0.5);
  const tileX = (TEACHER_X[0] + TEACHER_X[1]) / 2;

  return (
    <group position={[0, -0.9, 0]}>
      <NetView getNet={() => state.frame.teacher} layout={teacherLayout} getProbe={() => state.frame.probeXY} particles={220} radius={0.085} maxNeurons={36} maxEdges={2 * 16 + 16 * 16 + 16 * 2} />
      <NetView getNet={() => state.frame.student} layout={studentLayout} getProbe={() => state.frame.probeXY} particles={90} radius={0.11} maxNeurons={16} maxEdges={2 * 6 + 6 * 6 + 6 * 2} />
      <SoftStream state={state} />

      {/* decision tiles: teacher (left), distilled student (right), student-alone (faint, behind) */}
      <group position={[tileX, 0, 0.6]}>
        <Surface getValue={val('teacher')} res={32} size={TILE} height={0.35} every={6} />
        <DataPoints getData={() => state.frame.data} size={TILE} radius={0.035} lift={0.22} />
      </group>
      <group position={[-tileX, 0, 0.6]}>
        <Surface getValue={val('student')} res={32} size={TILE} height={0.35} every={6} />
        <DataPoints getData={() => state.frame.data} size={TILE} radius={0.035} lift={0.22} />
      </group>
      <group position={[-tileX + 0.6, 0, -4.0]} scale={[0.7, 0.7, 0.7]}>
        <Surface getValue={val('alone')} res={24} size={TILE} height={0.35} every={9} opacity={0.5} wire={false} />
      </group>
    </group>
  );
}

/** Horizontal accuracy bar (DOM, theme tokens only). */
function Bar({ label, value, faint = false, note }) {
  return (
    <div>
      <div className="mono flex justify-between text-[10px] tracking-[0.18em]" style={{ color: 'var(--muted)' }}>
        <span>{label.toUpperCase()}</span>
        <span style={{ color: faint ? 'var(--muted)' : 'var(--blue-glow)' }}>{note ? `${note} · ` : ''}{Math.round(value * 100)}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full" style={{ background: 'var(--line)' }}>
        <div className="h-1.5 rounded-full transition-[width]" style={{ width: `${Math.round(value * 100)}%`, background: faint ? 'var(--muted)' : 'var(--blue)' }} />
      </div>
    </div>
  );
}

function Panel({ state }) {
  const s = useStore(state);
  const set = (patch) => state.set(patch);
  const f = state.frame;
  const busy = s.phase !== 'idle';
  const startDistil = () => {
    if (!f.steps) return;
    f.student = clone(f.student0);
    f.soft = null;
    f.steps.distil = 0;
    f.hist = [];
    f.histEpoch = -1;
    set({ phase: 'distil', distDone: false, distEpoch: 0, distAcc: 0, hist: [] });
  };
  const startAlone = () => {
    if (!f.steps) return;
    f.alone = clone(f.student0);
    f.steps.alone = 0;
    set({ phase: 'alone', aloneDone: false, aloneEpoch: 0, aloneAcc: 0 });
  };
  const reset = () => {
    f.gen = (f.gen || 0) + 1;
    f.teacher = null;
    set({ phase: 'idle' });
  };
  return (
    <>
      <Seg label="Dataset" options={[['spiral', 'Spiral'], ['circle', 'Circle']]} value={s.dataset} onChange={(v) => set({ dataset: v, phase: 'idle' })} />
      <Slider label="Temperature T" min={1} max={10} step={0.5} value={s.T} onChange={(v) => set({ T: v })} format={(v) => v.toFixed(1)} />
      <Slider label="α (hard-label mix)" min={0} max={1} step={0.05} value={s.alpha} onChange={(v) => set({ alpha: v })} format={(v) => v.toFixed(2)} />
      <Row>
        <Btn primary disabled={busy} onClick={() => { if (!f.steps) return; f.steps.teacher = 0; set({ phase: 'teacher', teacherDone: false, teacherEpoch: 0 }); }}>
          {s.phase === 'teacher' ? `Teacher… ${s.teacherEpoch}` : 'Train teacher'}
        </Btn>
        <Btn disabled={busy || !s.teacherDone} onClick={startDistil}>
          {s.phase === 'distil' ? `Distilling… ${s.distEpoch}/${STUDENT_EPOCHS}` : 'Distil'}
        </Btn>
      </Row>
      <Row>
        <Btn disabled={busy} onClick={startAlone}>{s.phase === 'alone' ? `Student alone… ${s.aloneEpoch}/${STUDENT_EPOCHS}` : 'Train student alone'}</Btn>
        <Btn onClick={reset}>Reset</Btn>
      </Row>
      {!s.teacherDone && !busy && (
        <div className="mono text-[10px] tracking-[0.12em]" style={{ color: 'var(--muted)' }}>
          1 · TRAIN THE TEACHER  2 · DISTIL  3 · TRAIN A STUDENT ALONE, COMPARE
        </div>
      )}
      <Bar label="Teacher (test acc)" value={s.teacherAcc} note={`${TEACHER_PARAMS} params`} />
      <Bar label="Student · distilled" value={s.distAcc} note={s.lastT !== null ? `T=${s.lastT}` : undefined} />
      <Bar label="Student · alone" value={s.aloneAcc} faint note={`${STUDENT_PARAMS} params`} />
      <Readout label="Student loss" value={s.studentLoss.toFixed(3)} />
      <MiniGraph label="Student loss (distilling)" values={s.hist} min={0} />
    </>
  );
}

/** Hub card: two small nets with a particle stream between them. */
function MiniScene() {
  const nets = useRef({ a: null, b: null });
  const probe = useRef([0, 0]);
  const pts = useRef();
  const N = 40;
  const pos = useMemo(() => new Float32Array(N * 3), []);
  const col = useMemo(() => new Float32Array(N * 3), []);
  const parts = useMemo(() => Array.from({ length: N }, () => ({ t: Math.random(), dy: (Math.random() - 0.5) * 0.4 })), []);
  useEffect(() => {
    nets.current.a = createMLP([2, 5, 5, 2], { activation: 'tanh', seed: 4 });
    nets.current.b = createMLP([2, 3, 2], { activation: 'tanh', seed: 6 });
    const c = new THREE.Color();
    for (let k = 0; k < N; k++) {
      c.copy(C_WHITE).lerp(C_BLUE, Math.random());
      col[k * 3] = c.r;
      col[k * 3 + 1] = c.g;
      col[k * 3 + 2] = c.b;
    }
  }, [col]);
  useFrame((sc, dt) => {
    probe.current = sweepProbe(sc.clock.elapsedTime * 2);
    if (!pts.current) return;
    for (let k = 0; k < N; k++) {
      const p = parts[k];
      p.t = (p.t + dt * 0.5) % 1;
      pos[k * 3] = -0.55 + 1.1 * p.t;
      pos[k * 3 + 1] = Math.sin(p.t * Math.PI) * (0.5 + p.dy);
      pos[k * 3 + 2] = 0;
    }
    pts.current.geometry.attributes.position.needsUpdate = true;
  });
  return (
    <group>
      <NetView getNet={() => nets.current.a} layout={rowLayout({ x0: -2.2, x1: -0.7, y: 0, z: 0, gap: 0.32 })} getProbe={() => probe.current} particles={40} radius={0.09} maxNeurons={14} maxEdges={45} />
      <NetView getNet={() => nets.current.b} layout={rowLayout({ x0: 2.2, x1: 0.7, y: 0, z: 0, gap: 0.4 })} getProbe={() => probe.current} particles={20} radius={0.1} maxNeurons={7} maxEdges={12} />
      <points ref={pts} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[pos, 3]} />
          <bufferAttribute attach="attributes-color" args={[col, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.07} vertexColors sizeAttenuation toneMapped={false} depthWrite={false} />
      </points>
    </group>
  );
}

export default {
  slug: 'distillation',
  name: 'Distillation',
  tag: 'COMPRESSION',
  difficulty: 3,
  oneLiner: 'A big teacher net teaches a tiny student.',
  blurb:
    'Train a large teacher network, then let a network six times smaller learn from the teacher\'s soft probabilities instead of the raw labels. The stream between them carries those soft labels — pure blue or white when the teacher is sure, mixed when it is not. A twin student trained on labels alone shows whether the teacher\'s "dark knowledge" actually helped.',
  explain: [
    {
      title: 'What is it?',
      text: 'Big networks are accurate but expensive to run. Distillation squeezes what a big "teacher" has learned into a small "student": instead of copying the labels, the student copies the teacher\'s probabilities. A 70/30 answer carries much more information than a plain "class 1" — it says where the boundary is and how sure to be.',
    },
    {
      title: 'What am I looking at?',
      text: 'Left: the teacher (2→16→16→2). Right, mirrored so its output faces the teacher: the student (2→6→6→2). Each particle in the stream is one training point whose colour is the teacher\'s probability for it. The tiles underneath are each net\'s decision surface; the faint tile behind the student belongs to the twin trained on labels alone.',
    },
    {
      title: 'Temperature',
      text: 'The teacher\'s outputs are divided by T before the softmax. T = 1 gives the teacher\'s normal, confident answers, so the stream is almost pure blue and white. Higher T flattens them, revealing which points the teacher finds hard — the stream turns mixed and wide. Somewhere in the middle the student learns best; push T too high and the signal turns to mush. The α slider mixes a share of plain hard-label loss back in.',
    },
    {
      title: 'Why it helps here',
      text: 'The training labels are deliberately noisy. The student trained alone tries to honour every wrong dot; the distilled student follows the teacher\'s smooth surface instead, so it usually scores higher on the clean held-out test points that the bars report. Both students start from identical weights and train for the same 300 epochs, so the only difference is what they were told.',
    },
  ],
  challenges: ['Train the teacher above 95%', 'Distilled student beats student-alone by 5 points', 'Find a temperature where distillation stops helping'],
  orbit: true,
  cameraPos: [0, 4.2, 12.5],
  createState,
  Scene,
  Panel,
  MiniScene,
  statusLine: (s) => `teacher ${Math.round(s.teacherAcc * 100)}% · student (distilled) ${Math.round(s.distAcc * 100)}% · student (alone) ${Math.round(s.aloneAcc * 100)}%`,
  challengeCheck: (s) => s.done,
};
