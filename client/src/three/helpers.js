import { useRef, useCallback } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Drag a 3D object on a plane facing the camera (used for the arm's target ball, pushing the balancer…).
 *
 *   const drag = useDragOnPlane({ onMove: (pos) => state.frame.target = pos, controlsRef });
 *   <mesh {...drag.handlers} />
 *
 * While dragging, OrbitControls are paused so the model doesn't spin.
 */
export function useDragOnPlane({ onMove, onStart, onEnd, controlsRef, planeNormal } = {}) {
  const { camera, gl } = useThree();
  const dragging = useRef(false);
  const plane = useRef(new THREE.Plane());
  const hit = useRef(new THREE.Vector3());

  const onPointerDown = useCallback(
    (e) => {
      e.stopPropagation();
      dragging.current = true;
      const n = planeNormal ? new THREE.Vector3(...planeNormal) : camera.getWorldDirection(new THREE.Vector3()).negate();
      plane.current.setFromNormalAndCoplanarPoint(n, e.point);
      if (controlsRef?.current) controlsRef.current.enabled = false;
      e.target.setPointerCapture?.(e.pointerId);
      gl.domElement.style.cursor = 'grabbing';
      onStart?.(e.point.clone());
    },
    [camera, controlsRef, gl, onStart, planeNormal],
  );
  const onPointerMove = useCallback(
    (e) => {
      if (!dragging.current) return;
      e.stopPropagation();
      if (e.ray.intersectPlane(plane.current, hit.current)) onMove?.(hit.current.clone());
    },
    [onMove],
  );
  const onPointerUp = useCallback(
    (e) => {
      if (!dragging.current) return;
      dragging.current = false;
      if (controlsRef?.current) controlsRef.current.enabled = true;
      e.target.releasePointerCapture?.(e.pointerId);
      gl.domElement.style.cursor = '';
      onEnd?.();
    },
    [controlsRef, gl, onEnd],
  );
  return {
    dragging,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerOver: () => (gl.domElement.style.cursor = 'grab'),
      onPointerOut: () => !dragging.current && (gl.domElement.style.cursor = ''),
    },
  };
}

/** Keyboard state you can read every frame: keys.has('ArrowUp') */
export function createKeyTracker() {
  const keys = new Set();
  const down = (e) => keys.add(e.key.length === 1 ? e.key.toLowerCase() : e.key);
  const up = (e) => keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key);
  const attach = () => {
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      keys.clear();
    };
  };
  return { keys, attach };
}

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (cur, target, lambda, dt) => lerp(cur, target, 1 - Math.exp(-lambda * dt));
