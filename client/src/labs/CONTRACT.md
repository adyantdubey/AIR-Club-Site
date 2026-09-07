# AI lab module contract

Every lab lives in `src/labs/<slug>/index.jsx` and exports **one default object**:

```js
import { createStore } from '../../lib/store';

export default {
  slug: 'svm',                        // URL: /ai/svm
  name: 'Support Vector Machine',
  tag: 'CLASSIFICATION',
  difficulty: 2,                      // 1–3 pips
  oneLiner: 'Drop points, watch the best dividing surface bend.',
  blurb: '2–3 sentences for the intro.',
  explain: [                          // "Explain" overlay, plain English, 3–4 short paragraphs
    { title: 'What is it?', text: '…' },
    { title: 'What am I looking at?', text: '…' },
    { title: 'What the sliders do', text: '…' },
  ],
  challenges: ['Make the linear kernel fail', 'Find a gamma that over-fits', '…'],   // 3 items
  orbit: true,                        // false if the scene handles its own camera/pointer
  cameraPos: [0, 3, 7],               // optional
  createState,                        // () => store
  Scene,                              // React component rendered INSIDE <Canvas>
  Panel,                              // React component: DOM controls
  MiniScene,                          // React component INSIDE a small Canvas view (hub card) — light, idle-animated
  statusLine,                         // (state) => string shown under the canvas, e.g. "epoch 120 · loss 0.031"
  challengeCheck,                     // (state) => [bool, bool, bool] — which challenges are done
};
```

## State
`createState()` returns `createStore(defaults)` (`src/lib/store.js`).
- Reactive values for UI (`useStore(state, s => s.lr)`), `state.set({...})`.
- `state.frame.*` for heavy/per-frame data: weights, particles, point arrays — mutate freely inside `useFrame`.
- Training loops: run a few steps per frame inside `useFrame` (never `setInterval`), and push cheap summaries to reactive state at most ~10×/s (e.g. `if (step % 6 === 0) state.set({ loss })`).
- Everything must survive `state.reset()` → rebuild frame data lazily.

## Scene component
```jsx
function Scene({ state, controlsRef }) { … }   // inside <Canvas>; lights + OrbitControls are provided by the page
```
- Use InstancedMesh / Points / Line for anything with > 100 items.
- Colours: class A `#2d7bff`, class B `#ffffff`, highlights `#6eb2ff`, negatives `#ff6b6b` (only for "wrong"/negative). Background is transparent (page is `#050810`).
- Pointer input (drop points, drag ball): use R3F pointer events on an invisible plane; set `controlsRef.current.enabled=false` while dragging.

## Panel component
DOM only; use `src/components/ui/Controls.jsx` widgets (`Slider`, `Btn`, `Toggle`, `Readout`, `MiniGraph`, `Row`, `Seg` (segmented choice)).

## Maths
Pure JS in `src/ml/` (shared): `mlp.js` (dense net, SGD/Adam, backprop), `svm.js` (SMO), `optim.js` (GD/momentum/Adam step on a function), `qlearn.js`, `datasets.js` (circle/xor/spiral/gauss generators), `cnn.js` (forward pass from `public/weights/cnn.json`), `transformer.js` (forward pass + attention from `public/weights/transformer.json`). Add to these files rather than duplicating.

## Checklist before done
- `npx vite build --outDir /tmp/build-<slug>` passes (run from `client/`).
- Runs at 60 fps with default settings on a laptop (keep per-frame work small).
- `statusLine` and `challengeCheck` implemented; `MiniScene` is cheap.
