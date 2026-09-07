import { Suspense, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { gsap } from '../../lib/gsap';
import { roverStore } from '../../lib/roverStore';
import { isMobile } from '../../lib/motion';
import RoverModel from './RoverModel';
import StarField from './StarField';

// ONE canvas for the whole page, fixed behind the content. Sections scroll over it.
export default function RoverScene() {
  useEffect(() => {
    // H3 — track the mouse (canvas has pointer-events:none, so we listen on the window)
    if (isMobile()) return;
    const px = gsap.quickTo(roverStore.pointer, 'x', { duration: 0.8, ease: 'power2.out' });
    const py = gsap.quickTo(roverStore.pointer, 'y', { duration: 0.8, ease: 'power2.out' });
    const onMove = (e) => {
      px((e.clientX / window.innerWidth) * 2 - 1);
      py((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  const mobile = isMobile();

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1, pointerEvents: 'none' }} aria-hidden="true">
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 0.8, 6.5], fov: 38 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      >
        <ambientLight intensity={0.35} />
        <pointLight position={[4, 6, 4]} intensity={40} color="#6eb2ff" />
        <pointLight position={[-5, 2, -3]} intensity={18} color="#ffffff" />
        <Suspense fallback={null}>
          <StarField count={mobile ? 600 : 1500} />
          <RoverModel treads={mobile ? 10 : 16} />
        </Suspense>
      </Canvas>
    </div>
  );
}
