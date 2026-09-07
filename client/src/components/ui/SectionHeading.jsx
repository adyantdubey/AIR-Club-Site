import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap } from '../../lib/gsap';
import { splitText } from '../../lib/split';
import { STAGGER } from '../../lib/motion';

// G6 — heading letters rise out of a mask, blurred → sharp, one after another.
export default function SectionHeading({ eyebrow, children, className = '', align = 'left' }) {
  const root = useRef(null);
  const h = useRef(null);

  useGSAP(
    () => {
      const chars = splitText(h.current, 'chars');
      gsap.set(chars, { yPercent: 110, filter: 'blur(6px)', opacity: 0 });
      gsap.to(chars, {
        yPercent: 0,
        filter: 'blur(0px)',
        opacity: 1,
        stagger: STAGGER.chars,
        duration: 0.9,
        ease: 'power3.out',
        scrollTrigger: { trigger: root.current, start: 'top 82%', once: true },
      });
      if (root.current.querySelector('.eyebrow')) {
        gsap.from('.eyebrow', {
          x: -16,
          opacity: 0,
          duration: 0.7,
          scrollTrigger: { trigger: root.current, start: 'top 85%', once: true },
        });
      }
    },
    { scope: root },
  );

  return (
    <div ref={root} className={`mb-12 ${align === 'center' ? 'text-center' : ''} ${className}`}>
      {eyebrow && (
        <div className="eyebrow mono mb-4 flex items-center gap-3 text-xs uppercase tracking-[0.22em]" style={{ color: 'var(--blue-glow)' }}>
          <span className="inline-block h-px w-8" style={{ background: 'var(--blue)' }} />
          {eyebrow}
        </div>
      )}
      <h2 ref={h} className="display text-[clamp(2.2rem,6vw,4.8rem)] font-bold leading-[1.1]">
        {children}
      </h2>
    </div>
  );
}
