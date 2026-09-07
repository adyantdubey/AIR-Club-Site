import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router';
import { gsap, ScrollTrigger } from '../../lib/gsap';
import { initLenis } from '../../lib/lenis';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { PageWipeProvider } from '../../transitions/PageWipe';
import { MiniPort } from '../../three/MiniView';
import Preloader from './Preloader';
import Navbar from './Navbar';
import Cursor from './Cursor';
import Footer from '../sections/Footer';

// `ready` becomes true once the preloader curtain has opened (Home's hero waits for it)
const ReadyCtx = createContext(false);
export const useReady = () => useContext(ReadyCtx);

export default function Layout() {
  const [ready, setReady] = useState(false);
  const spot = useRef(null);
  const location = useLocation();
  useReducedMotion();

  useEffect(() => {
    const lenis = initLenis();
    lenis.stop();
    const mx = gsap.quickTo(spot.current, '--mx', { duration: 0.9, ease: 'power3.out' });
    const my = gsap.quickTo(spot.current, '--my', { duration: 0.9, ease: 'power3.out' });
    const onMove = (e) => {
      mx(`${(e.clientX / window.innerWidth) * 100}%`);
      my(`${(e.clientY / window.innerHeight) * 100}%`);
    };
    window.addEventListener('mousemove', onMove);
    const refresh = () => ScrollTrigger.refresh();
    window.addEventListener('load', refresh);
    document.fonts?.ready.then(refresh);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('load', refresh);
    };
  }, []);

  const onLoaded = useCallback(() => {
    setReady(true);
    initLenis().start();
    ScrollTrigger.refresh();
  }, []);

  // G14 — breadcrumb ticker data attribute for pages that want it
  useEffect(() => {
    document.title = titleFor(location.pathname);
  }, [location.pathname]);

  return (
    <ReadyCtx.Provider value={ready}>
      <PageWipeProvider>
        <Preloader onDone={onLoaded} />
        <div className="bg-grid" aria-hidden="true" />
        <div ref={spot} className="bg-spot" aria-hidden="true" />
        <MiniPort />
        <Cursor />
        <Navbar />
        <main className="relative" style={{ zIndex: 2 }}>
          <Outlet />
        </main>
        <Footer />
      </PageWipeProvider>
    </ReadyCtx.Provider>
  );
}

function titleFor(path) {
  const base = 'AI & Robotics Club · NIT AP';
  if (path === '/') return base;
  const seg = path.split('/').filter(Boolean);
  const nice = seg.map((s) => s.replace(/-/g, ' ')).map((s) => s.charAt(0).toUpperCase() + s.slice(1));
  return `${nice.join(' / ')} · ${base}`;
}
