# Machine module contract

Every machine lives in `src/machines/<slug>/index.jsx` and exports **one default object**:

```js
import { Wire, Led, Strut } from '../../three/wire';   // shared wireframe-glow parts
import { createStore } from '../../lib/store';

export default {
  slug: 'arm',                       // URL: /robotics/arm
  name: 'Robotic Arm',
  tag: 'MANIPULATION',               // small mono label
  category: 'manipulation',          // ground | air | manipulation | puzzle
  oneLiner: '6-axis arm that reaches any point you drag.',
  blurb: '2–3 sentences for the page intro.',
  specs: [['DOF', '6'], ['Reach', '420 mm'], ['Payload', '500 g'], ['Servos', 'MG996R × 6']],
  tech: ['Arduino Mega', 'IK solver', 'PCA9685'],
  howItWorks: [                     // exactly 3 steps
    { title: 'Sense', text: '…' },
    { title: 'Think', text: '…' },
    { title: 'Act', text: '…' },
  ],
  buildLog: [{ date: '2025-08', title: 'First joint moves', text: '…' }, …],   // 3–5 entries
  controlsHelp: 'Drag the blue ball. Toggle angles to see joint values.',   // one line shown under the panel
  mobileKeys: null,                  // or ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '] → on-screen d-pad sends these
  createState,                       // () => store (see below)
  Model,                             // React component: the 3D model
  Panel,                             // React component: DOM controls (sliders/buttons)
};
```

## State

`createState()` returns `createStore(defaults)` from `src/lib/store.js`.
- Reactive values (`store.get() / store.set()` + `useStore(store, s => s.x)`) for things the Panel shows.
- `store.frame.*` for per-frame data (positions, angles) — read/write inside `useFrame`, never re-renders.
- Key presses arrive in `store.frame.keys` (a `Set` of key names like `'ArrowUp'`, `'w'`, `' '`) — the page fills it for you (keyboard + mobile d-pad).

## Model component

```jsx
function Model({ state, mode = 'hero', controlsRef }) { … return <group>…</group>; }
```
- `mode`: `'hero'` (full detail + interaction), `'mini'` (hub card / showroom: fewer parts, idle animation only, no pointer handlers).
- Build with `<Wire>` / `<Strut>` / `<Led>` only (keeps the look consistent). Use plain `<group>` for joints.
- Build at the origin, standing on **y = 0**, roughly **1–3 units** wide. The viewer auto-fits it.
- Idle animation always runs (props spin, legs step, wings flap…), driven from `useFrame((s, dt) => …)`. Use `dt` so speed is frame-rate independent.
- **Interaction** (hero mode) reads `state.frame` / `state.get()` every frame. Pointer dragging: `useDragOnPlane` from `src/three/helpers.js` (pass `controlsRef` so the orbit pauses).
- Exploded view is automatic: every `<Wire>` slides outward. Add `label="Servo hub"` on 6–10 important parts; put `explode={false}` on parts that must stay (lights, membranes). **Animate groups, not the Wire meshes' positions** (rotation on a mesh is fine), or the exploded view will fight you.
- Keep `hero` ≤ ~200 meshes, `mini` ≤ ~60.

## Panel component

```jsx
function Panel({ state }) { … }
```
DOM only. Use the shared widgets from `src/components/ui/Controls.jsx`:
`<Slider label min max step value onChange />`, `<Btn onClick>Scramble</Btn>`, `<Toggle label value onChange />`, `<Readout label value />`, `<MiniGraph values max color />`, `<Row>…</Row>`.
Read reactive values with `useStore(state, s => s.x)`; write with `state.set({...})`.
Keep it compact (fits in a 300 px wide floating panel).

## Checklist before done
- `npx vite build --outDir /tmp/build-<slug>` passes with no errors (run from `client/`).
- No hard-coded colours except via `wire.jsx` exports; UI colours via CSS variables.
- Works in `mini` mode with `state = createState()` and no Panel.
