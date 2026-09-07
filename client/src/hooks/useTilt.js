import { useEffect } from 'react';
import { gsap } from '../lib/gsap';
import { isMobile } from '../lib/motion';

// 3D tilt toward the cursor + moves a CSS spotlight (--gx / --gy) across the card.
export function useTilt(ref, max = 10) {
  useEffect(() => {
    const el = ref.current;
    if (!el || isMobile()) return;
    el.style.transformStyle = 'preserve-3d';
    const rx = gsap.quickTo(el, 'rotationX', { duration: 0.6, ease: 'power3.out' });
    const ry = gsap.quickTo(el, 'rotationY', { duration: 0.6, ease: 'power3.out' });

    const onMove = (e) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      ry((px - 0.5) * max * 2);
      rx((0.5 - py) * max * 2);
      el.style.setProperty('--gx', `${px * 100}%`);
      el.style.setProperty('--gy', `${py * 100}%`);
    };
    const onLeave = () => {
      rx(0);
      ry(0);
    };
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    return () => {
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
    };
  }, [ref, max]);
}
