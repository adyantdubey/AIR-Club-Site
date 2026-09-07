import { useEffect, useState } from 'react';
import { roverStore } from '../lib/roverStore';

// True when the visitor's OS asks for less motion. Sections then use simple fades.
export function useReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  useEffect(() => {
    roverStore.reducedMotion = reduced;
  }, [reduced]);
  return reduced;
}
