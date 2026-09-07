import { useEffect, useRef, useState } from 'react';
import { animate, svg, utils, createTimeline } from 'animejs';
import { gsap } from '../../lib/gsap';
import { roverStore } from '../../lib/roverStore';
import Logo from './Logo';

// G1 — logo draws itself, counter runs 0→100, then the black curtain splits open.
export default function Preloader({ onDone }) {
  const root = useRef(null);
  const counter = useRef(null);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    let visited = false;
    try {
      visited = sessionStorage.getItem('air-visited') === '1';
      sessionStorage.setItem('air-visited', '1');
    } catch {
      /* private mode etc. */
    }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fast = visited || reduced;

    const finish = () => {
      roverStore.assembled = 1;
      gsap
        .timeline({
          onComplete: () => {
            setGone(true);
            onDone?.();
          },
        })
        .to('.curtain-top', { yPercent: -100, duration: 1, ease: 'expo.inOut' }, 0)
        .to('.curtain-bottom', { yPercent: 100, duration: 1, ease: 'expo.inOut' }, 0)
        .to('.pre-content', { opacity: 0, duration: 0.3 }, 0);
    };

    if (fast) {
      const t = setTimeout(finish, 350);
      return () => clearTimeout(t);
    }

    const obj = { v: 0 };
    const tl = createTimeline({ onComplete: finish });
    tl.add(svg.createDrawable('.pre-logo path, .pre-logo polygon, .pre-logo circle'), {
      draw: ['0 0', '0 1'],
      duration: 1100,
      delay: (_, i) => i * 120,
      ease: 'inOutQuad',
    })
      .add(
        obj,
        {
          v: 100,
          duration: 1300,
          ease: 'inOutExpo',
          modifier: utils.round(0),
          onUpdate: () => {
            if (counter.current) counter.current.textContent = String(obj.v).padStart(3, '0');
          },
        },
        200,
      )
      .add('.pre-bar', { scaleX: [0, 1], duration: 1300, ease: 'inOutExpo' }, 200);

    return () => tl.cancel();
  }, [onDone]);

  if (gone) return null;

  return (
    <div ref={root} className="fixed inset-0 z-[100]" aria-hidden="true">
      <div className="curtain-top absolute left-0 top-0 h-1/2 w-full" style={{ background: 'var(--bg)' }} />
      <div className="curtain-bottom absolute bottom-0 left-0 h-1/2 w-full" style={{ background: 'var(--bg)' }} />
      <div className="pre-content absolute inset-0 flex flex-col items-center justify-center gap-6">
        <div className="pre-logo">
          <Logo size={96} />
        </div>
        <div className="mono text-sm tracking-[0.3em]" style={{ color: 'var(--muted)' }}>
          <span ref={counter}>000</span>
          <span style={{ color: 'var(--blue)' }}> %</span>
        </div>
        <div className="h-px w-40 overflow-hidden" style={{ background: 'var(--line)' }}>
          <div className="pre-bar h-full w-full origin-left" style={{ background: 'var(--blue)', transform: 'scaleX(0)' }} />
        </div>
      </div>
    </div>
  );
}
