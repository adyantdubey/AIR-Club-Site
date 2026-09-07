import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// H10 — a drifting field of tiny points, plus a few brighter blue ones that twinkle.
export default function StarField({ count = 1500 }) {
  const dim = useRef();
  const bright = useRef();

  const [dimPos, brightPos] = useMemo(() => {
    const make = (n, r) => {
      const arr = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const v = new THREE.Vector3().randomDirection().multiplyScalar(6 + Math.random() * r);
        arr.set([v.x, v.y, v.z], i * 3);
      }
      return arr;
    };
    return [make(count, 30), make(Math.floor(count / 12), 20)];
  }, [count]);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    if (dim.current) dim.current.rotation.y += dt * 0.012;
    if (bright.current) {
      bright.current.rotation.y -= dt * 0.02;
      bright.current.material.size = 0.11 + Math.sin(t * 2.2) * 0.04;
    }
  });

  return (
    <>
      <points ref={dim}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[dimPos, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.035} color="#9cc4ff" transparent opacity={0.7} sizeAttenuation depthWrite={false} />
      </points>
      <points ref={bright}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[brightPos, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.11} color="#2d7bff" transparent opacity={0.9} sizeAttenuation depthWrite={false} />
      </points>
    </>
  );
}
