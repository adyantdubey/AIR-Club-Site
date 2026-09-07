import { Suspense, useLayoutEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { View, OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

/**
 * Many small 3D previews on ONE WebGL context (hub cards, showroom, mega-menu icons).
 *
 *   Mount <MiniPort /> once in the Layout (it's a fixed, full-screen, click-through canvas).
 *   Then anywhere in the DOM:
 *     <MiniView className="h-48">  <arm.Model state={s} mode="mini" />  </MiniView>
 *
 * The children are auto-fitted (scaled so the largest side ≈ 2.2 and standing on y=0).
 */
export function MiniPort() {
  return (
    <Canvas
      eventSource={typeof document !== 'undefined' ? document.body : undefined}
      style={{ position: 'fixed', inset: 0, zIndex: 3, pointerEvents: 'none' }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
    >
      <View.Port />
    </Canvas>
  );
}

export function MiniView({ children, className = '', style, fit = 2.2, noFit = false, cameraPos = [2.6, 1.9, 3.4], spin = 0.35, orbit = false, target = [0, 0.8, 0], ...rest }) {
  return (
    <View className={`relative ${className}`} style={{ overflow: 'hidden', ...style }} {...rest}>
      <ambientLight intensity={0.45} />
      <pointLight position={[3, 5, 3]} intensity={30} color="#6eb2ff" />
      <pointLight position={[-4, 2, -2]} intensity={12} />
      <PerspectiveCamera makeDefault position={cameraPos} fov={34} onUpdate={(c) => c.lookAt(target[0], target[1], target[2])} />
      <Suspense fallback={null}>
        {noFit ? (
          children
        ) : (
          <FitGroup fit={fit} spin={spin}>
            {children}
          </FitGroup>
        )}
      </Suspense>
      {orbit && <OrbitControls makeDefault enablePan={false} enableZoom={false} target={target} autoRotate autoRotateSpeed={0.8} />}
    </View>
  );
}

/** Auto-fits children (largest side = fit, standing on y=0) and optionally spins them. Reusable in any canvas. */
export function FitGroup({ children, fit = 2.2, spin = 0 }) {
  const outer = useRef();
  const inner = useRef();
  const spinner = useRef();
  useLayoutEffect(() => {
    const id = requestAnimationFrame(() => {
      const g = inner.current;
      if (!g) return;
      g.updateWorldMatrix(true, true);
      const box = new THREE.Box3().setFromObject(g);
      if (box.isEmpty()) return;
      // measure in the parent's local space (the group may sit anywhere in the world)
      outer.current.updateWorldMatrix(true, false);
      box.applyMatrix4(outer.current.matrixWorld.clone().invert());
      const size = box.getSize(new THREE.Vector3());
      const max = Math.max(size.x, size.y, size.z) || 1;
      const s = fit / max;
      const c = box.getCenter(new THREE.Vector3());
      outer.current.scale.setScalar(s);
      outer.current.position.set(-c.x * s, -box.min.y * s, -c.z * s);
    });
    return () => cancelAnimationFrame(id);
  }, [fit]);
  return (
    <group ref={spinner}>
      <Spin speed={spin} target={spinner} />
      <group ref={outer}>
        <group ref={inner}>{children}</group>
      </group>
    </group>
  );
}

function Spin({ speed, target }) {
  useFrame((_, dt) => {
    if (target.current && speed) target.current.rotation.y += dt * speed;
  });
  return null;
}
