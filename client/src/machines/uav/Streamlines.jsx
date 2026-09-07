import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GLOW } from '../../three/wire';

/**
 * 12 "wind streamlines" flowing nose → tail over the wing.
 * Each is a short glowing streak (a THREE.Line of SEG points) whose head travels along a path.
 * The path is straight, except it lifts over the wing (upwash) and bends down behind it (downwash);
 * both grow with the angle of attack, which is read every frame from `aoaRef.current` (radians).
 * Speed comes from `speedRef.current` (path lengths per second).
 */
const COUNT = 12;
const SEG = 18; // points per streak
const STREAK = 0.32; // streak length as a fraction of the path
const Z_NOSE = 0.88; // path start (at the nose tip)
const Z_TAIL = -0.84; // path end (at the tail)

// Lateral (x) and height (y) offsets for the 12 lines: two rows across the span
const LANES = Array.from({ length: COUNT }, (_, i) => {
  const row = i < 7 ? 0 : 1;
  const n = row === 0 ? 7 : 5;
  const k = row === 0 ? i : i - 7;
  const x = ((k + 0.5) / n - 0.5) * 1.5; // spread across the 1.6 wingspan
  const y = row === 0 ? 0.13 : 0.25;
  return { x, y, phase: (i * 0.37) % 1 };
});

// Height of the stream at path position z (plane-local, before pitch), for angle of attack `aoa`
function streamY(base, z, aoa) {
  const upwash = (0.05 + 0.32 * aoa) * Math.exp(-(((z - 0.18) / 0.32) ** 2)); // bump over the wing
  const behind = 1 / (1 + Math.exp((z + 0.05) / 0.08)); // 0 ahead of the trailing edge → 1 behind
  const downwash = -0.55 * aoa * behind;
  return base + upwash + downwash;
}

export default function Streamlines({ aoaRef, speedRef, visibleRef }) {
  const group = useRef();
  const geoms = useRef([]);
  const buffers = useMemo(() => LANES.map(() => new Float32Array(SEG * 3)), []);
  const phases = useRef(LANES.map((l) => l.phase));
  const mat = useMemo(() => new THREE.LineBasicMaterial({ color: GLOW, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }), []);

  useFrame((_, dt) => {
    if (!group.current) return;
    const show = visibleRef.current;
    group.current.visible = show;
    if (!show) return;
    const aoa = aoaRef.current;
    const v = speedRef.current;
    for (let i = 0; i < COUNT; i++) {
      const lane = LANES[i];
      let ph = phases.current[i] + v * dt;
      if (ph > 1 + STREAK) ph -= 1 + STREAK; // wrap so the streak fully leaves before re-entering
      phases.current[i] = ph;
      const arr = buffers[i];
      for (let k = 0; k < SEG; k++) {
        // s runs from the head (ph) back along the streak; clamp so the streak "enters" and "leaves" cleanly
        const s = Math.min(1, Math.max(0, ph - (k / (SEG - 1)) * STREAK));
        const z = Z_NOSE + (Z_TAIL - Z_NOSE) * s;
        arr[k * 3] = lane.x;
        arr[k * 3 + 1] = streamY(lane.y, z, aoa);
        arr[k * 3 + 2] = z;
      }
      const g = geoms.current[i];
      if (g) g.attributes.position.needsUpdate = true;
    }
  });

  return (
    <group ref={group}>
      {LANES.map((_, i) => (
        <line key={i} material={mat} frustumCulled={false}>
          <bufferGeometry ref={(el) => (geoms.current[i] = el)}>
            <bufferAttribute attach="attributes-position" args={[buffers[i], 3]} />
          </bufferGeometry>
        </line>
      ))}
    </group>
  );
}
