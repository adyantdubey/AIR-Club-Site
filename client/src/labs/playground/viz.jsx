// Shared 3-D pieces for the neural-net labs (Playground, Deep Net, Distillation):
//   <NetView>     neurons (instanced spheres), weights (line segments), signal particles
//   <Surface>     a decision-surface heightfield / tile coloured by the net's prediction
//   <DataPoints>  the dataset as small instanced spheres (white = class 0, blue = class 1)
// Everything is updated with refs inside useFrame — no React state per frame.

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { forward, unitActivation } from '../../ml/mlp';

// Palette from labs/CONTRACT.md
export const C_BLUE = new THREE.Color('#2d7bff');
export const C_WHITE = new THREE.Color('#ffffff');
export const C_GLOW = new THREE.Color('#6eb2ff');
export const C_DIM = new THREE.Color('#0d1a3a'); // an "off" neuron
const C_SURF0 = new THREE.Color('#6b7390'); // surface tone for class 0 (dim white)
const C_SURF1 = new THREE.Color('#1f5fd6'); // surface tone for class 1 (dim blue)
const tmpColor = new THREE.Color();
const tmpM = new THREE.Matrix4();
const tmpV = new THREE.Vector3();

/** Blue ↔ white mix for a probability p (1 = fully blue). Writes into `out`. */
export function classColor(p, out = tmpColor) {
  return out.copy(C_WHITE).lerp(C_BLUE, Math.max(0, Math.min(1, p)));
}

/** A cheap "how many edges / neurons can this shape need" helper. */
export function countEdges(sizes) {
  let e = 0;
  for (let l = 0; l < sizes.length - 1; l++) e += sizes[l] * sizes[l + 1];
  return e;
}

/**
 * <NetView getNet={() => net} layout={(layer, i, n, L) => [x, y, z]} getProbe={() => [x, y]} />
 *  - getNet:        returns the net to draw (may change; re-laid-out when its `id` changes)
 *  - layout:        world position for neuron i (of n) in layer `layer` (of L layers)
 *  - getProbe:      current input; neurons glow with their activation for it
 *  - getSelected:   optional () => [layer, i] to highlight one neuron
 *  - onNeuronClick: optional (layer, i) callback (click on a sphere)
 *  - particles:     number of signal particles that travel along the weights
 */
export function NetView({ getNet, layout, getProbe, getSelected, onNeuronClick, particles = 200, radius = 0.11, maxNeurons = 64, maxEdges = 600, speed = 1 }) {
  const inst = useRef();
  const lines = useRef();
  const pts = useRef();
  const st = useRef({ netId: -1, pos: [], index: [], edges: [], tick: 0, parts: null }).current;

  const linePos = useMemo(() => new Float32Array(maxEdges * 2 * 3), [maxEdges]);
  const lineCol = useMemo(() => new Float32Array(maxEdges * 2 * 3), [maxEdges]);
  const partPos = useMemo(() => new Float32Array(particles * 3), [particles]);
  const partCol = useMemo(() => new Float32Array(particles * 3), [particles]);

  useEffect(() => {
    // per-particle state: which edge it rides, how far along, how fast
    st.parts = Array.from({ length: particles }, () => ({ e: 0, t: Math.random(), v: 0.6 + Math.random() * 0.8 }));
  }, [particles, st]);

  // Lay out neurons + edges whenever a new net object shows up
  function relayout(net) {
    st.netId = net.id;
    st.pos = [];
    st.index = [];
    const L = net.sizes.length;
    for (let l = 0; l < L; l++) {
      const row = [];
      for (let i = 0; i < net.sizes[l]; i++) {
        row.push(new THREE.Vector3(...layout(l, i, net.sizes[l], L)));
        st.index.push([l, i]);
      }
      st.pos.push(row);
    }
    st.edges = [];
    for (let l = 0; l < L - 1; l++) for (let j = 0; j < net.sizes[l + 1]; j++) for (let i = 0; i < net.sizes[l]; i++) st.edges.push([l, i, j]);
    const m = inst.current;
    if (m) {
      const n = Math.min(st.index.length, maxNeurons);
      for (let k = 0; k < n; k++) {
        const [l, i] = st.index[k];
        tmpM.makeTranslation(st.pos[l][i].x, st.pos[l][i].y, st.pos[l][i].z);
        m.setMatrixAt(k, tmpM);
        m.setColorAt(k, C_DIM);
      }
      m.count = n;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
    const ne = Math.min(st.edges.length, maxEdges);
    for (let k = 0; k < ne; k++) {
      const [l, i, j] = st.edges[k];
      const a = st.pos[l][i];
      const b = st.pos[l + 1][j];
      linePos.set([a.x, a.y, a.z, b.x, b.y, b.z], k * 6);
    }
    if (lines.current) {
      lines.current.geometry.setDrawRange(0, ne * 2);
      lines.current.geometry.attributes.position.needsUpdate = true;
    }
    if (st.parts) for (const p of st.parts) p.e = Math.floor(Math.random() * ne);
  }

  useFrame((_, dt) => {
    const net = getNet();
    if (!net) return;
    if (net.id !== st.netId) relayout(net);
    st.tick++;
    const L = net.sizes.length;

    // 1. neuron glow = activation for the probe input
    const m = inst.current;
    const probe = getProbe ? getProbe() : null;
    if (m && probe) {
      const acts = forward(net, probe);
      const sel = getSelected ? getSelected() : null;
      const n = Math.min(st.index.length, maxNeurons);
      for (let k = 0; k < n; k++) {
        const [l, i] = st.index[k];
        let a;
        if (l === 0) a = (acts[0][i] + 1) * 0.5; // inputs are in -1..1
        else if (l === L - 1) a = acts[l].length === 1 ? 1 / (1 + Math.exp(-acts[l][i])) : unitActivation(Math.tanh(acts[l][i] * 0.5), 'tanh');
        else a = unitActivation(acts[l][i], net.activation);
        a = Math.max(0, Math.min(1, a));
        tmpColor.copy(C_DIM).lerp(C_GLOW, a);
        if (a > 0.85) tmpColor.lerp(C_WHITE, (a - 0.85) * 3);
        if (sel && sel[0] === l && sel[1] === i) tmpColor.set('#ff6b6b');
        m.setColorAt(k, tmpColor);
      }
      m.instanceColor.needsUpdate = true;
    }

    // 2. weight colours (blue = positive, white = negative, brightness = |w|) — every 3rd frame
    if (lines.current && st.tick % 3 === 0) {
      const ne = Math.min(st.edges.length, maxEdges);
      for (let k = 0; k < ne; k++) {
        const [l, i, j] = st.edges[k];
        const w = net.W[l][j * net.sizes[l] + i];
        const s = Math.min(1, Math.abs(w) * 0.7);
        const base = w >= 0 ? C_BLUE : C_WHITE;
        tmpColor.copy(C_DIM).lerp(base, 0.15 + 0.85 * s);
        const o = k * 6;
        lineCol[o] = lineCol[o + 3] = tmpColor.r;
        lineCol[o + 1] = lineCol[o + 4] = tmpColor.g;
        lineCol[o + 2] = lineCol[o + 5] = tmpColor.b;
      }
      lines.current.geometry.attributes.color.needsUpdate = true;
    }

    // 3. signal particles sliding along edges, input side → output side
    if (pts.current && st.parts) {
      const ne = Math.min(st.edges.length, maxEdges);
      if (ne === 0) return;
      for (let k = 0; k < st.parts.length; k++) {
        const p = st.parts[k];
        p.t += dt * p.v * speed;
        if (p.t > 1 || p.e >= ne) {
          p.t = 0;
          p.e = Math.floor(Math.random() * ne);
        }
        const [l, i, j] = st.edges[p.e];
        const a = st.pos[l][i];
        const b = st.pos[l + 1][j];
        tmpV.lerpVectors(a, b, p.t);
        partPos[k * 3] = tmpV.x;
        partPos[k * 3 + 1] = tmpV.y;
        partPos[k * 3 + 2] = tmpV.z;
        const w = net.W[l][j * net.sizes[l] + i];
        const c = w >= 0 ? C_GLOW : C_WHITE;
        partCol[k * 3] = c.r;
        partCol[k * 3 + 1] = c.g;
        partCol[k * 3 + 2] = c.b;
      }
      pts.current.geometry.attributes.position.needsUpdate = true;
      pts.current.geometry.attributes.color.needsUpdate = true;
    }
  });

  return (
    <group>
      <instancedMesh
        ref={inst}
        args={[undefined, undefined, maxNeurons]}
        frustumCulled={false}
        onClick={(e) => {
          if (!onNeuronClick || e.instanceId === undefined) return;
          e.stopPropagation();
          const ix = st.index[e.instanceId];
          if (ix) onNeuronClick(ix[0], ix[1]);
        }}
      >
        <sphereGeometry args={[radius, 12, 10]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <lineSegments ref={lines} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[linePos, 3]} />
          <bufferAttribute attach="attributes-color" args={[lineCol, 3]} />
        </bufferGeometry>
        <lineBasicMaterial vertexColors transparent opacity={0.85} toneMapped={false} />
      </lineSegments>
      <points ref={pts} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[partPos, 3]} />
          <bufferAttribute attach="attributes-color" args={[partCol, 3]} />
        </bufferGeometry>
        <pointsMaterial size={radius * 0.5} vertexColors transparent opacity={0.9} sizeAttenuation toneMapped={false} depthWrite={false} />
      </points>
    </group>
  );
}

/** Layout helper: layers left→right along X, neurons stacked along Y. */
export function rowLayout({ x0 = -2.5, x1 = 2.5, y = 2.2, z = 0, gap = 0.42 } = {}) {
  return (l, i, n, L) => [x0 + ((x1 - x0) * l) / Math.max(1, L - 1), y + (i - (n - 1) / 2) * gap, z];
}

/**
 * <Surface getValue={(x, y) => 0..1} /> — a res×res grid over -1..1 whose height and colour follow
 * getValue (1 = blue class, 0 = white class). Re-sampled every `every` frames. `height` 0 = flat tile.
 */
export function Surface({ getValue, res = 40, size = 5, height = 0.6, every = 6, opacity = 1, wire = true }) {
  const mesh = useRef();
  const tick = useRef(0);
  const { geom, vals } = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const n = res * res;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    for (let j = 0; j < res; j++)
      for (let i = 0; i < res; i++) {
        const k = j * res + i;
        pos[k * 3] = (i / (res - 1) - 0.5) * size;
        pos[k * 3 + 1] = 0;
        pos[k * 3 + 2] = (0.5 - j / (res - 1)) * size; // +y of the data → -z (away from the camera)
      }
    const idx = [];
    for (let j = 0; j < res - 1; j++)
      for (let i = 0; i < res - 1; i++) {
        const a = j * res + i;
        idx.push(a, a + res, a + 1, a + 1, a + res, a + res + 1);
      }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return { geom: g, vals: new Float32Array(n) };
  }, [res, size]);

  useFrame(() => {
    tick.current++;
    if (tick.current % every !== 0 || !mesh.current) return;
    const pos = geom.attributes.position.array;
    const col = geom.attributes.color.array;
    for (let j = 0; j < res; j++)
      for (let i = 0; i < res; i++) {
        const k = j * res + i;
        const x = (i / (res - 1)) * 2 - 1;
        const y = (j / (res - 1)) * 2 - 1;
        let v = getValue(x, y);
        if (!Number.isFinite(v)) v = 0.5;
        v = Math.max(0, Math.min(1, v));
        vals[k] = v;
        pos[k * 3 + 1] = (v - 0.5) * height;
        // dimmer than the data points (which are pure white / blue) so the dots stay readable
        tmpColor.copy(C_SURF0).lerp(C_SURF1, v);
        col[k * 3] = tmpColor.r;
        col[k * 3 + 1] = tmpColor.g;
        col[k * 3 + 2] = tmpColor.b;
      }
    geom.attributes.position.needsUpdate = true;
    geom.attributes.color.needsUpdate = true;
    if (height) geom.computeVertexNormals();
  });

  return (
    <group>
      <mesh ref={mesh} geometry={geom} receiveShadow={false}>
        <meshStandardMaterial vertexColors roughness={0.7} metalness={0.15} transparent={opacity < 1} opacity={opacity} side={THREE.DoubleSide} />
      </mesh>
      {wire && (
        <mesh geometry={geom}>
          <meshBasicMaterial color={C_GLOW} wireframe transparent opacity={0.08} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

/** <DataPoints getData={() => ({xs, ys})} size={5} getHeight={(x,y)=>h} /> — instanced spheres for the dataset. */
export function DataPoints({ getData, size = 5, getHeight, max = 400, radius = 0.045, lift = 0.05 }) {
  const inst = useRef();
  const last = useRef(null);
  const tick = useRef(0);
  useFrame(() => {
    const m = inst.current;
    const d = getData();
    if (!m || !d) return;
    tick.current++;
    const changed = d.xs !== last.current;
    if (!changed && (!getHeight || tick.current % 6 !== 1)) return;
    last.current = d.xs;
    const n = Math.min(d.xs.length, max);
    for (let k = 0; k < n; k++) {
      const [x, y] = d.xs[k];
      const h = getHeight ? getHeight(x, y) : 0;
      tmpM.makeTranslation((x * size) / 2, h + lift, (-y * size) / 2);
      m.setMatrixAt(k, tmpM);
      if (changed) m.setColorAt(k, d.ys[k] ? C_BLUE : C_WHITE);
    }
    m.count = n;
    m.instanceMatrix.needsUpdate = true;
    if (changed && m.instanceColor) m.instanceColor.needsUpdate = true;
  });
  return (
    <instancedMesh ref={inst} args={[undefined, undefined, max]} frustumCulled={false}>
      <sphereGeometry args={[radius, 8, 6]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}

/** Slow Lissajous sweep over the -1..1 square: the "probe" input the neurons light up for. */
export function sweepProbe(t) {
  return [0.85 * Math.sin(t * 0.37), 0.85 * Math.sin(t * 0.53 + 1.2)];
}
