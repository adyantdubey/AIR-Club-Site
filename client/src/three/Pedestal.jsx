import { Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Canvas, createPortal, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { gsap } from '../lib/gsap';
import { isMobile } from '../lib/motion';
import { useExplode } from './useExplode';

/**
 * G11 — the shared 3D viewer every machine sits on.
 *  - drag to rotate, wheel/pinch to zoom (limited), auto-spins when idle, snaps upright after 3 s
 *  - double-click resets the view
 *  - floor ring + compass
 *  - explodeRef (0..1) drives G12 exploded view; labels appear when > 0.35
 *  - the model is auto-fitted: scaled so its largest side is ~2.4 units and it stands on the floor
 *
 *   <Pedestal explodeRef={explode} controlsRef={orbit}>
 *     <arm.Model state={state} mode="hero" />
 *   </Pedestal>
 */
export default function Pedestal({ children, explodeRef, controlsRef, autoRotate = true, fit = 2.4, className = '', cameraPos = [3.2, 2.2, 4.2], bloom = true, floor = true, onReady }) {
  const mobile = isMobile();
  const localExplode = useRef(0);
  const ex = explodeRef || localExplode;
  return (
    <div className={`relative h-full w-full ${className}`}>
      <Canvas
        dpr={[1, mobile ? 1.25 : 1.6]}
        camera={{ position: cameraPos, fov: 36, near: 0.1, far: 100 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        onDoubleClick={() => controlsRef?.current?.reset()}
      >
        <ambientLight intensity={0.4} />
        <pointLight position={[4, 6, 4]} intensity={45} color="#6eb2ff" />
        <pointLight position={[-5, 3, -3]} intensity={18} color="#ffffff" />
        <spotLight position={[0, 8, 0]} intensity={30} angle={0.5} penumbra={1} color="#2d7bff" />
        <Suspense fallback={null}>
          <FitAndExplode explodeRef={ex} fit={fit} onReady={onReady}>
            {children}
          </FitAndExplode>
        </Suspense>
        {floor && <Floor />}
        <OrbitControls
          ref={controlsRef}
          makeDefault
          enablePan={false}
          minDistance={2.5}
          maxDistance={9}
          maxPolarAngle={Math.PI * 0.55}
          autoRotate={autoRotate}
          autoRotateSpeed={0.6}
          enableDamping
          dampingFactor={0.08}
          target={[0, 0.9, 0]}
        />
        <IdleSnap controlsRef={controlsRef} />
        {bloom && !mobile && (
          <EffectComposer disableNormalPass multisampling={0}>
            <Bloom luminanceThreshold={0.35} luminanceSmoothing={0.4} intensity={0.9} mipmapBlur />
          </EffectComposer>
        )}
      </Canvas>
      <Compass controlsRef={controlsRef} />
    </div>
  );
}

function FitAndExplode({ children, explodeRef, fit, onReady }) {
  const outer = useRef();
  const inner = useRef();
  const [labels, setLabels] = useState([]);
  useExplode(inner, explodeRef);

  // Auto-fit: scale + centre the model so it stands on y=0 and fills the pedestal
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
      const center = box.getCenter(new THREE.Vector3());
      outer.current.scale.setScalar(s);
      outer.current.position.set(-center.x * s, -box.min.y * s, -center.z * s);
      // collect labels
      const list = [];
      g.traverse((o) => {
        if (o.isMesh && o.userData.label) {
          const anchor = new THREE.Object3D();
          o.add(anchor);
          list.push({ anchor, text: o.userData.label });
        }
      });
      setLabels(list);
      onReady?.();
    });
    return () => cancelAnimationFrame(id);
  }, [fit, onReady]);

  return (
    <group ref={outer}>
      <group ref={inner}>{children}</group>
      {labels.map((l, i) => (
        <PartLabel key={i} anchor={l.anchor} text={l.text} explodeRef={explodeRef} index={i} />
      ))}
    </group>
  );
}

function PartLabel({ anchor, text, explodeRef, index }) {
  const ref = useRef(null);
  useFrame(() => {
    if (!ref.current) return;
    const a = explodeRef.current;
    const show = a > 0.35;
    ref.current.style.opacity = show ? String(Math.min(1, (a - 0.35) * 4)) : '0';
    ref.current.style.transform = `translateY(${show ? 0 : 8}px)`;
  });
  return createPortal(
    <Html center distanceFactor={10} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
      <div
        ref={ref}
        className="mono whitespace-nowrap rounded-md border px-2 py-1 text-[10px] tracking-[0.15em]"
        style={{
          opacity: 0,
          transition: 'opacity .3s, transform .3s',
          background: 'rgba(5,8,16,.85)',
          borderColor: 'rgba(110,178,255,.35)',
          color: '#6eb2ff',
          backdropFilter: 'blur(6px)',
        }}
      >
        <span style={{ color: '#8a93b2' }}>{String(index + 1).padStart(2, '0')}</span> {text.toUpperCase()}
      </div>
    </Html>,
    anchor,
  );
}

function Floor() {
  const ring = useRef();
  useFrame((s) => {
    if (ring.current) ring.current.rotation.z = s.clock.elapsedTime * 0.15;
  });
  return (
    <group position={[0, -0.005, 0]} rotation-x={-Math.PI / 2}>
      <mesh>
        <ringGeometry args={[1.55, 1.6, 96]} />
        <meshBasicMaterial color="#2d7bff" transparent opacity={0.55} toneMapped={false} />
      </mesh>
      <mesh ref={ring}>
        <ringGeometry args={[1.85, 1.87, 96, 1, 0, Math.PI * 1.4]} />
        <meshBasicMaterial color="#6eb2ff" transparent opacity={0.35} toneMapped={false} />
      </mesh>
      <mesh>
        <circleGeometry args={[2.6, 64]} />
        <meshBasicMaterial color="#0b1020" transparent opacity={0.55} depthWrite={false} />
      </mesh>
      <gridHelper args={[6, 18, '#1a2a55', '#101a38']} rotation-x={Math.PI / 2} position={[0, 0, -0.01]} />
    </group>
  );
}

// Snap back upright after 3 s idle, and resume auto-rotate
function IdleSnap({ controlsRef }) {
  const timer = useRef(null);
  const { gl } = useThree();
  useEffect(() => {
    const c = controlsRef?.current;
    if (!c) return;
    const onStart = () => {
      c.autoRotate = false;
      clearTimeout(timer.current);
    };
    const onEnd = () => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        // ease polar angle back toward the default (0.32π) without moving azimuth
        const polar = c.getPolarAngle();
        const targetPolar = Math.PI * 0.36;
        const obj = { p: polar };
        gsap.to(obj, {
          p: targetPolar,
          duration: 1.2,
          ease: 'power2.inOut',
          onUpdate: () => {
            c.minPolarAngle = obj.p;
            c.maxPolarAngle = obj.p;
            c.update();
          },
          onComplete: () => {
            c.minPolarAngle = 0;
            c.maxPolarAngle = Math.PI * 0.55;
            c.autoRotate = true;
          },
        });
      }, 3000);
    };
    c.addEventListener('start', onStart);
    c.addEventListener('end', onEnd);
    return () => {
      c.removeEventListener('start', onStart);
      c.removeEventListener('end', onEnd);
      clearTimeout(timer.current);
    };
  }, [controlsRef, gl]);
  return null;
}

// Small compass in the corner showing which way is "front" (+Z of the model)
function Compass({ controlsRef }) {
  const needle = useRef(null);
  useEffect(() => {
    let raf;
    const tick = () => {
      const c = controlsRef?.current;
      if (c && needle.current) needle.current.style.transform = `rotate(${-c.getAzimuthalAngle()}rad)`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [controlsRef]);
  return (
    <div className="pointer-events-none absolute bottom-4 right-4 flex flex-col items-center gap-1" aria-hidden="true">
      <div className="relative h-12 w-12 rounded-full border" style={{ borderColor: 'rgba(110,178,255,.3)' }}>
        <div ref={needle} className="absolute inset-0 flex items-start justify-center pt-1 transition-transform duration-100">
          <div className="h-4 w-[2px] rounded" style={{ background: '#6eb2ff' }} />
        </div>
        <span className="mono absolute inset-0 flex items-center justify-center text-[8px]" style={{ color: '#8a93b2' }}>F</span>
      </div>
      <span className="mono text-[9px] tracking-[0.25em]" style={{ color: '#8a93b2' }}>DRAG · ZOOM · 2×CLICK</span>
    </div>
  );
}
