// LAB 2 — Deep Net. An 8-layer network laid out along Z like a tunnel you can fly through, and an
// optional shallow-but-wide twin trained on the same data at the same time (depth vs width).

import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { createStore, useStore } from '../../lib/store';
import { createMLP, trainStep, accuracy, evaluate, predictProb, paramCount } from '../../ml/mlp';
import { DATASETS } from '../../ml/datasets';
import { Slider, Btn, Readout, MiniGraph, Row, Seg, Toggle } from '../../components/ui/Controls';
import { NetView, Surface, DataPoints, rowLayout, sweepProbe, C_GLOW } from '../playground/viz';
import { damp } from '../../three/helpers';

const N_LAYERS = 8; // input + 6 hidden + output
const GAP = 1.5; // world distance between layers along Z
const N_POINTS = 250;
const WIDE_X = 3.4; // where the wide twin stands
const TILE_Z = -(N_LAYERS - 1) * GAP - 3.0;
const STEPS_PER_EPOCH = Math.ceil(N_POINTS / 16);
const lrFromSlider = (s) => Math.pow(10, -3 + s * 2.5); // 0.001 .. 0.3
const sliderFromLr = (lr) => (Math.log10(lr) + 3) / 2.5;

function createState() {
  return createStore({
    dataset: 'spiral',
    width: 6,
    activation: 'relu',
    lr: 0.01,
    compare: true,
    training: false,
    fly: 0,
    epoch: 0,
    deepLoss: 0,
    wideLoss: 0,
    deepAcc: 0,
    wideAcc: 0,
    deepParams: 0,
    wideWidth: 0,
    wideParams: 0,
    hist: [],
    done: [false, false, false],
  });
}

function ensure(state) {
  const s = state.get();
  const f = state.frame;
  const key = `${s.dataset}|${s.width}|${s.activation}|${f.gen || 0}`;
  if (f.key === key && f.deep) return f;
  f.key = key;
  f.data = DATASETS[s.dataset](N_POINTS, 0.15, 1);
  const sizes = [2, ...Array(N_LAYERS - 2).fill(s.width), 1];
  f.deep = createMLP(sizes, { activation: s.activation, seed: 1 + (f.gen || 0) });
  // the wide twin gets (roughly) the same number of parameters: a 2→w→1 net has 4w+1 of them
  const dp = paramCount(f.deep);
  const ww = Math.max(8, Math.min(48, Math.round((dp - 1) / 4)));
  f.wide = createMLP([2, ww, 1], { activation: s.activation, seed: 1 + (f.gen || 0) });
  f.steps = 0;
  f.tick = 0;
  f.hist = [];
  f.histEpoch = -1;
  f.probeXY = [0, 0];
  state.set({ epoch: 0, deepLoss: 0, wideLoss: 0, deepAcc: 0, wideAcc: 0, deepParams: dp, wideWidth: ww, wideParams: paramCount(f.wide), hist: [] });
  return f;
}

// One epoch (≤ 3 ms) for the deep net and, if comparing, the wide net — same batches count for both.
function trainTick(state, f) {
  const s = state.get();
  const { xs, ys } = f.data;
  const opts = { lr: s.lr, optimizer: 'adam', batch: 16, lossType: 'bce' };
  const t0 = performance.now();
  let n = 0;
  while (n < STEPS_PER_EPOCH && performance.now() - t0 < 3) {
    trainStep(f.deep, xs, ys, opts);
    if (s.compare) trainStep(f.wide, xs, ys, opts);
    f.steps++;
    n++;
  }
}

function summarise(state, f) {
  const s = state.get();
  const { xs, ys } = f.data;
  const epoch = Math.floor(f.steps / STEPS_PER_EPOCH);
  const opts = { lossType: 'bce' };
  const deepLoss = evaluate(f.deep, xs, ys, opts);
  const wideLoss = s.compare ? evaluate(f.wide, xs, ys, opts) : s.wideLoss;
  const deepAcc = accuracy(f.deep, xs, ys);
  const wideAcc = s.compare ? accuracy(f.wide, xs, ys) : s.wideAcc;
  if (epoch > f.histEpoch) {
    f.hist.push(deepLoss);
    if (f.hist.length > 120) f.hist.shift();
    f.histEpoch = epoch;
  }
  const done = [
    s.done[0] || (s.fly === N_LAYERS && s.training && f.arrived),
    s.done[1] || (epoch >= 200 && s.compare && s.dataset === 'circle' && wideLoss < deepLoss),
    s.done[2] || (epoch >= 200 && s.compare && s.dataset === 'spiral' && deepLoss < wideLoss),
  ];
  state.set({ epoch, deepLoss, wideLoss, deepAcc, wideAcc, hist: f.hist.slice(), done });
}

// Neurons of one layer sit on a ring around the Z axis; the camera flies down the middle.
function ringLayout(cx) {
  return (l, i, n, L) => {
    const r = n <= 2 ? 0.35 : n <= 10 ? 0.65 : 1.35;
    const a = (i / n) * Math.PI * 2 + Math.PI / 2;
    const z = -(l * ((N_LAYERS - 1) / Math.max(1, L - 1))) * GAP;
    return [cx + r * Math.cos(a), 1.6 + r * Math.sin(a), z];
  };
}

function Scene({ state, controlsRef }) {
  const { camera } = useThree();
  const goal = useRef({ pos: new THREE.Vector3(), tgt: new THREE.Vector3(), lastFly: state.get().fly });
  const markerDeep = useRef();
  const markerWide = useRef();
  const wideGroup = useRef();

  useEffect(() => {
    // start looking a little way down the tunnel
    if (controlsRef?.current) {
      controlsRef.current.target.set(1.2, 1.4, -3);
      controlsRef.current.update();
    }
  }, [controlsRef]);

  useFrame((sc, dt) => {
    const f = ensure(state);
    const s = state.get();
    const t = sc.clock.elapsedTime;
    f.probeXY = sweepProbe(t);
    if (wideGroup.current) wideGroup.current.visible = s.compare;

    // "Fly to layer": when the slider moves, glide the camera to that layer, then hand control back
    const g = goal.current;
    if (s.fly !== g.lastFly) {
      g.lastFly = s.fly;
      f.flying = true;
      f.arrived = false;
      const z = -s.fly * GAP;
      g.pos.set(1.4, 3.8, z + 5.8);
      g.tgt.set(0.6, 1.3, z - 2.5);
    }
    if (f.flying) {
      camera.position.x = damp(camera.position.x, g.pos.x, 4, dt);
      camera.position.y = damp(camera.position.y, g.pos.y, 4, dt);
      camera.position.z = damp(camera.position.z, g.pos.z, 4, dt);
      const ctl = controlsRef?.current;
      if (ctl) {
        ctl.target.x = damp(ctl.target.x, g.tgt.x, 4, dt);
        ctl.target.y = damp(ctl.target.y, g.tgt.y, 4, dt);
        ctl.target.z = damp(ctl.target.z, g.tgt.z, 4, dt);
        ctl.update();
      } else camera.lookAt(g.tgt);
      if (camera.position.distanceTo(g.pos) < 0.05) {
        f.flying = false;
        f.arrived = true;
      }
    }

    // probe markers on the tiles
    const [px, py] = f.probeXY;
    if (markerDeep.current) markerDeep.current.position.set(px * 1.2, 1.6 + py * 1.2, TILE_Z + 0.1);
    if (markerWide.current) markerWide.current.position.set(WIDE_X + px * 1.2, 1.6 + py * 1.2, TILE_Z + 0.1);

    if (s.training) trainTick(state, f);
    f.tick++;
    if (s.training && f.tick % 6 === 0) summarise(state, f);
  });

  const deepValue = (x, y) => (state.frame.deep ? predictProb(state.frame.deep, [x, y]) : 0.5);
  const wideValue = (x, y) => (state.frame.wide ? predictProb(state.frame.wide, [x, y]) : 0.5);
  const maxEdgesDeep = 2 * 10 + 5 * 10 * 10 + 10;

  return (
    <group>
      {/* the deep tunnel */}
      <NetView getNet={() => state.frame.deep} layout={ringLayout(0)} getProbe={() => state.frame.probeXY} particles={260} radius={0.09} maxNeurons={2 + 6 * 10 + 1} maxEdges={maxEdgesDeep} />
      {/* its decision tile, standing upright at the far end */}
      <group position={[0, 1.6, TILE_Z]} rotation={[Math.PI / 2, 0, 0]}>
        <Surface getValue={deepValue} res={24} size={2.4} height={0.25} every={6} />
        <DataPoints getData={() => state.frame.data} size={2.4} radius={0.03} lift={0.14} />
      </group>
      <mesh ref={markerDeep}>
        <sphereGeometry args={[0.05, 8, 6]} />
        <meshStandardMaterial color={C_GLOW} emissive={C_GLOW} emissiveIntensity={1.6} toneMapped={false} />
      </mesh>

      {/* the wide twin */}
      <group ref={wideGroup}>
        <NetView getNet={() => state.frame.wide} layout={ringLayout(WIDE_X)} getProbe={() => state.frame.probeXY} particles={160} radius={0.08} maxNeurons={2 + 48 + 1} maxEdges={48 * 3} />
        <group position={[WIDE_X, 1.6, TILE_Z]} rotation={[Math.PI / 2, 0, 0]}>
          <Surface getValue={wideValue} res={24} size={2.4} height={0.25} every={6} />
          <DataPoints getData={() => state.frame.data} size={2.4} radius={0.03} lift={0.14} />
        </group>
        <mesh ref={markerWide}>
          <sphereGeometry args={[0.05, 8, 6]} />
          <meshStandardMaterial color={C_GLOW} emissive={C_GLOW} emissiveIntensity={1.6} toneMapped={false} />
        </mesh>
      </group>

      {/* faint floor line so the tunnel has a ground reference */}
      <gridHelper args={[16, 16, '#1d3f7a', '#122a52']} position={[1.2, 0, -6]} />
    </group>
  );
}

function Panel({ state }) {
  const s = useStore(state);
  const set = (patch) => state.set(patch);
  const rebuild = () => {
    state.frame.gen = (state.frame.gen || 0) + 1;
    state.frame.deep = null;
  };
  return (
    <>
      <Seg label="Dataset" options={[['spiral', 'Spiral'], ['circle', 'Circle'], ['xor', 'XOR']]} value={s.dataset} onChange={(v) => set({ dataset: v, training: false })} />
      <Slider label="Fly to layer" min={0} max={N_LAYERS} step={1} value={s.fly} onChange={(v) => set({ fly: v })} format={(v) => (v === 0 ? 'input' : v === N_LAYERS ? 'output' : `layer ${v}`)} />
      <Slider label="Width (neurons per layer)" min={2} max={10} step={1} value={s.width} onChange={(v) => set({ width: v, training: false })} />
      <Seg label="Activation" options={[['relu', 'ReLU'], ['tanh', 'tanh']]} value={s.activation} onChange={(v) => set({ activation: v, training: false })} />
      <Slider label="Learning rate" min={0} max={1} step={0.005} value={sliderFromLr(s.lr)} onChange={(v) => set({ lr: lrFromSlider(v) })} format={() => s.lr.toPrecision(2)} />
      <Toggle label="Depth vs width" value={s.compare} onChange={(v) => set({ compare: v })} />
      <Row>
        <Btn primary onClick={() => set({ training: !s.training })}>{s.training ? 'Pause' : 'Train'}</Btn>
        <Btn onClick={() => { set({ training: false }); rebuild(); }}>Reset</Btn>
      </Row>
      <Readout label="Epoch" value={s.epoch} />
      <Readout label="Deep net" value={`${s.deepLoss.toFixed(3)} · ${Math.round(s.deepAcc * 100)}%`} unit={`(${s.deepParams} params)`} />
      {s.compare && <Readout label="Wide net" value={`${s.wideLoss.toFixed(3)} · ${Math.round(s.wideAcc * 100)}%`} unit={`(2→${s.wideWidth}→1, ${s.wideParams} params)`} />}
      <MiniGraph label="Deep loss" values={s.hist} min={0} />
    </>
  );
}

/** Hub card: a long thin 8-layer net with a pulse running along it. */
function MiniScene() {
  const ref = useRef({ net: null });
  const probe = useRef([0, 0]);
  useEffect(() => {
    ref.current.net = createMLP([2, 3, 3, 3, 3, 3, 3, 1], { activation: 'tanh', seed: 2 });
  }, []);
  useFrame((sc) => {
    // a single bright pulse: sweep a strong input through so layers light one after another
    const t = sc.clock.elapsedTime;
    probe.current = [Math.sin(t * 1.3), Math.cos(t * 0.9)];
  });
  const layout = rowLayout({ x0: -2.1, x1: 2.1, y: 0, z: 0, gap: 0.42 });
  return <NetView getNet={() => ref.current.net} layout={layout} getProbe={() => probe.current} particles={90} radius={0.1} maxNeurons={24} maxEdges={60} speed={1.6} />;
}

export default {
  slug: 'deep-net',
  name: 'Deep Net',
  tag: 'DEPTH',
  difficulty: 1,
  oneLiner: 'Fly through 8 layers; see what each one does.',
  blurb:
    'Eight layers of neurons standing in a row like hoops in a tunnel. Fly the camera from the inputs to the output and watch each ring light up in turn. Flip on "depth vs width" and a short, fat network with the same number of weights trains beside it — which one wins depends on the data.',
  explain: [
    {
      title: 'What is it?',
      text: 'A "deep" network is just a network with many layers. Each layer can only bend the picture it receives a little, but eight small bends in a row can trace a spiral that a single bend never could. The price is that the learning signal has to travel back through all eight layers to reach the first one.',
    },
    {
      title: 'What am I looking at?',
      text: 'Each ring is one layer; the input ring has two neurons (x and y), the last ring is the single output. Neurons glow with their activation for the input that is currently sweeping the data, and particles show the signal flowing down the tunnel. The tile at the far end is the decision surface — what the net predicts for every point — with the data dots on top.',
    },
    {
      title: 'Depth vs width',
      text: 'The twin on the right has only one hidden layer, but it is wide enough to hold about the same number of weights. Both train on exactly the same batches. On simple shapes the wide net often wins because it is easier to train; on the spiral the deep net usually wins because it can compose curves. Try both with tanh: gradients shrink each time they pass through a tanh layer, which is why very deep tanh nets learn slowly.',
    },
    {
      title: 'The sliders',
      text: '"Fly to layer" glides the camera to any ring — you can still drag to look around. Width changes neurons per layer (the wide net is re-sized to match). Learning rate is the step size; too high and the deep net collapses to guessing 50/50.',
    },
  ],
  challenges: ['Fly to layer 8 while training', 'Make the wide net win on circle', 'Make the deep net win on spiral'],
  orbit: true,
  cameraPos: [4.2, 3.6, 4.5],
  createState,
  Scene,
  Panel,
  MiniScene,
  statusLine: (s) => (s.compare ? `deep loss ${s.deepLoss.toFixed(3)} · wide loss ${s.wideLoss.toFixed(3)} · epoch ${s.epoch}` : `deep loss ${s.deepLoss.toFixed(3)} · acc ${Math.round(s.deepAcc * 100)}% · epoch ${s.epoch}`),
  challengeCheck: (s) => s.done,
};
