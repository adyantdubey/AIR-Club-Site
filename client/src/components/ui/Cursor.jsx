import { useEffect, useRef } from 'react';
import { gsap } from '../../lib/gsap';

// G3 — small blue dot that lags behind the mouse; grows to a ring over links; says "VIEW" over project cards.
export default function Cursor() {
  const dot = useRef(null);
  const ring = useRef(null);
  const label = useRef(null);

  useEffect(() => {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    document.body.classList.add('has-cursor');

    const dx = gsap.quickTo(dot.current, 'x', { duration: 0.12, ease: 'power3.out' });
    const dy = gsap.quickTo(dot.current, 'y', { duration: 0.12, ease: 'power3.out' });
    const rx = gsap.quickTo(ring.current, 'x', { duration: 0.45, ease: 'power3.out' });
    const ry = gsap.quickTo(ring.current, 'y', { duration: 0.45, ease: 'power3.out' });

    const onMove = (e) => {
      dx(e.clientX);
      dy(e.clientY);
      rx(e.clientX);
      ry(e.clientY);
    };
    const onOver = (e) => {
      const t = e.target.closest('a, button, [data-cursor]');
      const view = e.target.closest('[data-cursor="view"]');
      gsap.to(ring.current, { scale: view ? 3.2 : t ? 1.8 : 1, duration: 0.35 });
      gsap.to(dot.current, { scale: t ? 0 : 1, duration: 0.25 });
      gsap.to(label.current, { opacity: view ? 1 : 0, duration: 0.2 });
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseover', onOver);
    return () => {
      document.body.classList.remove('has-cursor');
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseover', onOver);
    };
  }, []);

  return (
    <>
      <div
        ref={dot}
        className="pointer-events-none fixed left-0 top-0 z-[90] h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: 'var(--blue-glow)' }}
      />
      <div
        ref={ring}
        className="pointer-events-none fixed left-0 top-0 z-[90] flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border"
        style={{ borderColor: 'var(--blue)', mixBlendMode: 'difference' }}
      >
        <span ref={label} className="mono text-[6px] tracking-widest opacity-0" style={{ color: 'var(--fg)' }}>
          VIEW
        </span>
      </div>
    </>
  );
}
