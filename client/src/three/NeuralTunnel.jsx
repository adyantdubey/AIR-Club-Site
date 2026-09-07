import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * A big 3D neural network the camera can sit inside / fly through.
 *   <NeuralTunnel progressRef={p} />   // p.current 0..1 moves the camera from the entrance to the exit
 * Layers along Z; neurons as instanced glowing spheres; edges as one LineSegments; pulses as Points.
 */
export default function NeuralTunnel({ progressRef, layers = 7, perLayer = 22, spacing = 2.4, radius = 2.6, pulses = 700, pointer = true, build = 1 }) {
  const neurons = useRef();
  const pulsePts = useRef();
  const lines = useRef();
  const group = useRef();

  const data = useMemo(() => {
    const rng = mulberry32(7);
    const pos = [];
    for (let l = 0; l < layers; l++) {
      for (let i = 0; i < perLayer; i++) {
        const a = (i / perLayer) * Math.PI * 2 + rng() * 0.5;
        const r = radius * (0.75 + rng() * 0.45);
        pos.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r * 0.75, l * spacing));
      }
    }
    const edges = [];
    for (let l = 0; l < layers - 1; l++) {
      for (let i = 0; i < perLayer; i++) {
        const a = l * perLayer + i;
        for (let k = 0; k < 4; k++) {
          const b = (l + 1) * perLayer + Math.floor(rng() * perLayer);
          edges.push([a, b]);
        }
      }
    }
    const linePos = new Float32Array(edges.length * 6);
    edges.forEach(([a, b], i) => {
      linePos.set([pos[a].x, pos[a].y, pos[a].z, pos[b].x, pos[b].y, pos[b].z], i * 6);
    });
    const pulse = new Array(pulses).fill(0).map(() => ({ e: Math.floor(rng() * edges.length), t: rng(), v: 0.25 + rng() * 0.6 }));
    const pulsePos = new Float32Array(pulses * 3);
    return { pos, edges, linePos, pulse, pulsePos, length: (layers - 1) * spacing };
  }, [layers, perLayer, spacing, radius, pulses]);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    const inst = neurons.current;
    if (inst) {
      data.pos.forEach((p, i) => {
        const glow = 0.5 + 0.5 * Math.sin(t * 1.6 + i * 0.7);
        const s = 0.035 + glow * 0.03;
        dummy.position.copy(p);
        dummy.scale.setScalar(s * build);
        dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix);
        color.setRGB(0.18 + glow * 0.25, 0.48 + glow * 0.25, 1);
        inst.setColorAt(i, color);
      });
      inst.instanceMatrix.needsUpdate = true;
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    }
    // pulses travel along edges
    const arr = data.pulsePos;
    data.pulse.forEach((p, i) => {
      p.t += dt * p.v;
      if (p.t > 1) {
        p.t = 0;
        p.e = Math.floor(Math.random() * data.edges.length);
      }
      const [a, b] = data.edges[p.e];
      const A = data.pos[a];
      const B = data.pos[b];
      arr[i * 3] = A.x + (B.x - A.x) * p.t;
      arr[i * 3 + 1] = A.y + (B.y - A.y) * p.t;
      arr[i * 3 + 2] = A.z + (B.z - A.z) * p.t;
    });
    if (pulsePts.current) pulsePts.current.geometry.attributes.position.needsUpdate = true;

    // camera fly-through
    const cam = state.camera;
    const prog = progressRef ? progressRef.current : 0;
    const z = -2.5 + prog * (data.length + 5);
    const px = pointer ? state.pointer.x * 0.6 : 0;
    const py = pointer ? state.pointer.y * 0.4 : 0;
    cam.position.x += (px - cam.position.x) * 0.05;
    cam.position.y += (py - cam.position.y) * 0.05;
    cam.position.z += (z - cam.position.z) * 0.08;
    cam.lookAt(px * 0.3, py * 0.2, cam.position.z + 6);
  });

  return (
    <group ref={group}>
      <instancedMesh ref={neurons} args={[null, null, data.pos.length]}>
        <sphereGeometry args={[1, 10, 10]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <lineSegments ref={lines}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[data.linePos, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color="#2d7bff" transparent opacity={0.16} />
      </lineSegments>
      <points ref={pulsePts}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[data.pulsePos, 3]} />
        </bufferGeometry>
        <pointsMaterial color="#9cc4ff" size={0.09} transparent opacity={0.95} sizeAttenuation depthWrite={false} />
      </points>
    </group>
  );
}

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
