// LAB 1 — Neural-net Playground. Build a small network, train it live on a toy dataset and watch
// the decision surface bend. All the maths lives in src/ml/mlp.js; this file is the visuals + panel.

import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { createStore, useStore } from '../../lib/store';
import { createMLP, trainStep, accuracy, forward, predictProb, unitActivation, exploded } from '../../ml/mlp';
import { DATASETS } from '../../ml/datasets';
import { Slider, Btn, Readout, MiniGraph, Row, Seg } from '../../components/ui/Controls';
import { NetView, Surface, DataPoints, rowLayout, sweepProbe, C_GLOW } from './viz';

const MAX_LAYERS = 4;
const MAX_WIDTH = 8;
const N_POINTS = 250;
const SURF = 4.4; // world size of the floor tile

// Learning-rate slider is logarithmic: slider 0..1 → 0.001..10
const lrFromSlider = (s) => Math.pow(10, -3 + s * 4);
const sliderFromLr = (lr) => (Math.log10(lr) + 3) / 4;

function createState() {
  return createStore({
    dataset: 'circle',
    hidden: [4, 4],
    activation: 'tanh',
    optimizer: 'adam',
    lr: 0.03,
    noise: 0.1,
    training: false,
    epoch: 0,
    loss: 0,
    acc: 0,
    hist: [],
    probe: null, // { layer, idx } when a neuron is being probed
    maxLoss: 0,
    exploded: false,
    done: [false, false, false],
  });
}

// (Re)build the dataset + net when the structure changes. Called lazily from useFrame.
function ensure(state) {
  const s = state.get();
  const f = state.frame;
  const key = `${s.dataset}|${s.hidden.join(',')}|${s.activation}|${s.noise}|${f.gen || 0}`;
  if (f.key === key && f.net) return f;
  f.key = key;
  f.data = DATASETS[s.dataset](N_POINTS, s.noise, 1);
  f.net = createMLP([2, ...s.hidden, 1], { activation: s.activation, seed: 1 + (f.gen || 0) });
  f.steps = 0;
  f.tick = 0;
  f.hist = [];
  f.histEpoch = -1;
  f.lastLoss = 0;
  f.maxLossPending = 0;
  f.probeXY = [0, 0];
  state.set({ epoch: 0, loss: 0, acc: 0, hist: [], probe: null, maxLoss: 0, exploded: false });
  return f;
}

const STEPS_PER_EPOCH = Math.ceil(N_POINTS / 16);

// A few mini-batch steps (≤ 3 ms, ≤ 1 epoch) and cheap summaries pushed to reactive state ~10×/s.
function trainTick(state, f, stepsWanted) {
  const s = state.get();
  const { xs, ys } = f.data;
  const t0 = performance.now();
  let loss = s.loss;
  let n = 0;
  while (n < stepsWanted && performance.now() - t0 < 3) {
    loss = trainStep(f.net, xs, ys, { lr: s.lr, optimizer: s.optimizer, batch: 16, lossType: 'bce' });
    f.steps++;
    n++;
    if (!Number.isFinite(loss) || loss > 1e6) {
      state.set({ training: false, exploded: true, loss: Infinity, done: [s.done[0], s.done[1], true] });
      return;
    }
  }
  f.lastLoss = loss;
  if (loss > (s.maxLoss || 0)) f.maxLossPending = loss;
}

function summarise(state, f) {
  const s = state.get();
  const { xs, ys } = f.data;
  const epoch = Math.floor(f.steps / STEPS_PER_EPOCH);
  const loss = f.lastLoss ?? 0;
  const acc = accuracy(f.net, xs, ys);
  const hist = f.hist;
  if (f.steps > 0 && (hist.length === 0 || epoch > f.histEpoch)) {
    hist.push(loss);
    if (hist.length > 120) hist.shift();
    f.histEpoch = epoch;
  }
  const maxLoss = Math.max(s.maxLoss || 0, f.maxLossPending || 0);
  const blew = exploded(f.net);
  const done = [
    s.done[0] || (s.dataset === 'spiral' && acc >= 0.9),
    s.done[1] || (s.dataset === 'xor' && s.hidden.length === 1 && s.hidden[0] === 1 && epoch >= 100),
    s.done[2] || maxLoss > 5 || blew,
  ];
  state.set({ epoch, loss, acc, hist: hist.slice(), maxLoss, exploded: s.exploded || blew, done, training: blew ? false : s.training });
}

function Scene({ state }) {
  const marker = useRef();
  const layout = rowLayout({ x0: -2.2, x1: 2.2, y: 1.9, z: -1.8, gap: 0.36 });

  useFrame((sc, dt) => {
    const f = ensure(state);
    const s = state.get();
    const t = sc.clock.elapsedTime;
    f.probeXY = sweepProbe(t);
    if (marker.current) {
      const [x, y] = f.probeXY;
      marker.current.position.set((x * SURF) / 2, surfaceHeight(f, x, y) + 0.12, (-y * SURF) / 2);
      marker.current.material.emissiveIntensity = 1.4 + Math.sin(t * 6) * 0.4;
    }
    if (s.training) trainTick(state, f, STEPS_PER_EPOCH);
    else if (f.stepOnce) {
      f.stepOnce = false;
      trainTick(state, f, STEPS_PER_EPOCH);
      f.forceSummary = true;
    }
    f.tick++;
    if ((s.training && f.tick % 6 === 0) || f.forceSummary) {
      f.forceSummary = false;
      summarise(state, f);
    }
  });

  // What the floor shows: the output probability, or one probed neuron's activation
  const surfaceValue = (x, y) => {
    const f = state.frame;
    if (!f.net) return 0.5;
    const p = state.get().probe;
    if (!p) return predictProb(f.net, [x, y]);
    const acts = forward(f.net, [x, y]);
    const L = f.net.sizes.length - 1;
    if (p.layer === 0) return (acts[0][p.idx] + 1) * 0.5;
    if (p.layer === L) return predictProb(f.net, [x, y]);
    return unitActivation(acts[p.layer][p.idx], f.net.activation);
  };
  const surfaceHeight = (f, x, y) => (surfaceValue(x, y) - 0.5) * 0.6;

  return (
    <group>
      {/* the network, floating above the floor */}
      <NetView
        getNet={() => state.frame.net}
        layout={layout}
        getProbe={() => state.frame.probeXY}
        getSelected={() => {
          const p = state.get().probe;
          return p ? [p.layer, p.idx] : null;
        }}
        onNeuronClick={(layer, idx) => state.set({ probe: { layer, idx } })}
        particles={300}
        maxNeurons={2 + MAX_LAYERS * MAX_WIDTH + 1}
        maxEdges={2 * MAX_WIDTH + (MAX_LAYERS - 1) * MAX_WIDTH * MAX_WIDTH + MAX_WIDTH}
      />
      {/* the floor: dataset + decision surface */}
      <group position={[0, 0, 0.4]}>
        <Surface getValue={surfaceValue} res={40} size={SURF} height={0.5} every={6} />
        <DataPoints getData={() => state.frame.data} size={SURF} getHeight={(x, y) => surfaceHeight(state.frame, x, y)} />
        <mesh ref={marker}>
          <sphereGeometry args={[0.07, 10, 8]} />
          <meshStandardMaterial color={C_GLOW} emissive={C_GLOW} emissiveIntensity={1.6} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

function Panel({ state }) {
  const s = useStore(state);
  const set = (patch) => state.set(patch);
  const rebuild = () => {
    state.frame.gen = (state.frame.gen || 0) + 1;
    state.frame.net = null;
  };
  const setHidden = (hidden) => set({ hidden, training: false });
  return (
    <>
      <Seg label="Dataset" options={[['circle', 'Circle'], ['xor', 'XOR'], ['spiral', 'Spiral'], ['gauss', 'Gauss']]} value={s.dataset} onChange={(v) => set({ dataset: v, training: false })} />
      <div>
        <div className="mono mb-1 flex items-center justify-between text-[10px] tracking-[0.18em]" style={{ color: 'var(--muted)' }}>
          <span>HIDDEN LAYERS</span>
          <span>
            <Btn small disabled={s.hidden.length <= 1} onClick={() => setHidden(s.hidden.slice(0, -1))}>− layer</Btn>{' '}
            <Btn small disabled={s.hidden.length >= MAX_LAYERS} onClick={() => setHidden([...s.hidden, 4])}>+ layer</Btn>
          </span>
        </div>
        <Row>
          {s.hidden.map((n, i) => (
            <div key={i} className="mono flex items-center gap-1 rounded-md px-2 py-1 text-[11px]" style={{ background: 'rgba(110,178,255,.08)', color: 'var(--fg)' }}>
              <button className="ctl-btn small" disabled={n <= 1} onClick={() => setHidden(s.hidden.map((v, k) => (k === i ? v - 1 : v)))}>−</button>
              <span style={{ minWidth: 18, textAlign: 'center' }}>{n}</span>
              <button className="ctl-btn small" disabled={n >= MAX_WIDTH} onClick={() => setHidden(s.hidden.map((v, k) => (k === i ? v + 1 : v)))}>+</button>
            </div>
          ))}
        </Row>
      </div>
      <Seg label="Activation" options={[['tanh', 'tanh'], ['relu', 'ReLU'], ['sigmoid', 'sigmoid']]} value={s.activation} onChange={(v) => set({ activation: v, training: false })} />
      <Seg label="Optimiser" options={[['sgd', 'SGD'], ['adam', 'Adam']]} value={s.optimizer} onChange={(v) => set({ optimizer: v })} />
      <Slider label="Learning rate" min={0} max={1} step={0.005} value={sliderFromLr(s.lr)} onChange={(v) => set({ lr: lrFromSlider(v) })} format={() => s.lr.toPrecision(2)} />
      <Slider label="Noise" min={0} max={1} step={0.05} value={s.noise} onChange={(v) => set({ noise: v, training: false })} format={(v) => v.toFixed(2)} />
      <Row>
        <Btn primary onClick={() => set({ training: !s.training, exploded: false })} disabled={s.exploded}>
          {s.training ? 'Pause' : 'Train'}
        </Btn>
        <Btn onClick={() => (state.frame.stepOnce = true)} disabled={s.training || s.exploded}>Step</Btn>
        <Btn onClick={() => { set({ training: false }); rebuild(); }}>Reset</Btn>
      </Row>
      {s.probe && (
        <Row>
          <Readout label="Probing" value={s.probe.layer === 0 ? `input ${['x', 'y'][s.probe.idx]}` : s.probe.layer > s.hidden.length ? 'output' : `layer ${s.probe.layer} · neuron ${s.probe.idx + 1}`} />
          <Btn small onClick={() => set({ probe: null })}>Back to output</Btn>
        </Row>
      )}
      {!s.probe && (
        <div className="mono text-[10px] tracking-[0.12em]" style={{ color: 'var(--muted)' }}>
          CLICK A NEURON TO SEE WHAT IT HAS LEARNED
        </div>
      )}
      <Readout label="Epoch" value={s.epoch} />
      <Readout label="Loss" value={s.exploded ? 'exploded!' : s.loss.toFixed(3)} />
      <Readout label="Accuracy" value={Math.round(s.acc * 100)} unit="%" />
      <MiniGraph label="Loss history" values={s.hist} min={0} />
    </>
  );
}

/** Hub-card version: a tiny 2→4→1 net with particles flowing. */
function MiniScene() {
  const ref = useRef({ net: null });
  const probe = useRef([0, 0]);
  useEffect(() => {
    ref.current.net = createMLP([2, 4, 3, 1], { activation: 'tanh', seed: 5 });
  }, []);
  useFrame((sc) => {
    probe.current = sweepProbe(sc.clock.elapsedTime * 2);
  });
  const layout = rowLayout({ x0: -1.3, x1: 1.3, y: 0, z: 0, gap: 0.5 });
  return <NetView getNet={() => ref.current.net} layout={layout} getProbe={() => probe.current} particles={60} radius={0.14} maxNeurons={12} maxEdges={30} />;
}

export default {
  slug: 'playground',
  name: 'Neural-net Playground',
  tag: 'FOUNDATIONS',
  difficulty: 1,
  oneLiner: 'Build a network, train it live, watch it learn.',
  blurb:
    'Stack a few layers of neurons, pick a dataset and press Train. The floor is the network\'s current guess for every point in the plane; watch it bend from a flat blur into a shape that fits the dots. Click any neuron to see the little piece of the picture it is responsible for.',
  explain: [
    {
      title: 'What is it?',
      text: 'A neural network is a chain of tiny calculators. Each neuron adds up its inputs with different weights, squashes the sum with a simple curve (tanh, ReLU or sigmoid) and passes the result on. Training nudges every weight a little at a time so the final answer gets closer to the labels.',
    },
    {
      title: 'What am I looking at?',
      text: 'Left to right: the two inputs (x and y), the hidden layers, and the single output neuron. Lines are weights — blue means positive, white negative, brighter means stronger. Particles show the signal flowing forward. The glowing dot on the floor is the input the network is looking at right now; neurons light up with their response to it.',
    },
    {
      title: 'The floor',
      text: 'Every point of the floor is coloured by what the network would answer there: blue for class 1, white for class 0, and the height follows the confidence. As training runs the surface bends to separate the dots. Click a neuron and the floor shows that neuron\'s own activation instead — a single hidden neuron can only draw a straight fold; layers stack folds into curves.',
    },
    {
      title: 'The sliders',
      text: 'Learning rate is the size of each nudge: too small is slow, too large overshoots until the loss explodes. Noise scatters the data so a perfect fit is impossible. Adam adapts the step size per weight and usually trains faster than plain SGD. The spiral is the hard one — try ReLU and more neurons.',
    },
  ],
  challenges: ['Get spiral above 90% accuracy', 'Make XOR train with a single hidden neuron (it can\'t — watch why)', 'Find a learning rate that explodes the loss'],
  orbit: true,
  cameraPos: [0, 3.2, 8.2],
  createState,
  Scene,
  Panel,
  MiniScene,
  statusLine: (s) => `epoch ${s.epoch} · loss ${s.exploded ? '∞' : s.loss.toFixed(3)} · acc ${Math.round(s.acc * 100)}%`,
  challengeCheck: (s) => s.done,
};
