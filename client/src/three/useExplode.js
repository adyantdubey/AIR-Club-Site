import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Exploded view for any model group.
 *   const amount = useRef(0);      // 0 = assembled, 1 = fully exploded (GSAP can tween amount.current)
 *   useExplode(groupRef, amount);
 * Every mesh with userData.explode !== false slides outward from the model's centre.
 * Original positions are remembered so it always returns exactly.
 */
export function useExplode(groupRef, amountRef, { distance = 1.2 } = {}) {
  const parts = useRef([]);
  const ready = useRef(false);

  useEffect(() => {
    const g = groupRef.current;
    if (!g) return;
    // wait a frame so animated groups have their initial transforms
    const id = requestAnimationFrame(() => {
      g.updateWorldMatrix(true, true);
      const box = new THREE.Box3().setFromObject(g);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3()).length() || 1;
      const list = [];
      g.traverse((o) => {
        if (!o.isMesh || o.userData.explode === false || !o.userData.wire) return;
        const world = o.getWorldPosition(new THREE.Vector3());
        let dir = world.clone().sub(center);
        if (dir.length() < 1e-4) dir.set(0, 1, 0);
        dir.normalize();
        // convert world direction into the parent's local space
        const parentQuat = o.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
        dir.applyQuaternion(parentQuat);
        const jitter = 0.7 + Math.random() * 0.6;
        list.push({ mesh: o, home: o.position.clone(), dir, dist: Math.min(distance * size * 0.16, 1.6) * jitter });
      });
      parts.current = list;
      ready.current = true;
    });
    return () => cancelAnimationFrame(id);
  }, [groupRef, distance]);

  const last = useRef(0);
  useFrame(() => {
    if (!ready.current) return;
    const a = amountRef.current;
    // When assembled, leave meshes alone so machines can animate their own parts.
    if (a === 0 && last.current === 0) return;
    last.current = a;
    const e = a < 0.5 ? 4 * a * a * a : 1 - Math.pow(-2 * a + 2, 3) / 2; // ease in-out
    for (const p of parts.current) {
      p.mesh.position.set(p.home.x + p.dir.x * p.dist * e, p.home.y + p.dir.y * p.dist * e, p.home.z + p.dir.z * p.dist * e);
    }
  });

  return parts;
}
