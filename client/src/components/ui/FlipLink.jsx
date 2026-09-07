import { useRef } from 'react';
import { gsap } from '../../lib/gsap';
import { STAGGER } from '../../lib/motion';

// G5 — on hover each letter flips up and a blue copy flips in from below.
export default function FlipLink({ children, className = '', as: Tag = 'a', ...rest }) {
  const root = useRef(null);
  const text = String(children);
  const chars = [...text];

  const over = () => {
    const a = root.current.querySelectorAll('.flip-a .char');
    const b = root.current.querySelectorAll('.flip-b .char');
    gsap.to(a, { yPercent: -100, stagger: STAGGER.chars, duration: 0.45, ease: 'power3.inOut', overwrite: true });
    gsap.to(b, { yPercent: -100, stagger: STAGGER.chars, duration: 0.45, ease: 'power3.inOut', overwrite: true });
  };
  const out = () => {
    const a = root.current.querySelectorAll('.flip-a .char');
    const b = root.current.querySelectorAll('.flip-b .char');
    gsap.to(a, { yPercent: 0, stagger: STAGGER.chars, duration: 0.45, ease: 'power3.inOut', overwrite: true });
    gsap.to(b, { yPercent: 0, stagger: STAGGER.chars, duration: 0.45, ease: 'power3.inOut', overwrite: true });
  };

  return (
    <Tag
      ref={root}
      className={`link-flip ${className}`}
      onMouseEnter={over}
      onMouseLeave={out}
      aria-label={text}
      {...rest}
    >
      <span className="flip-a" aria-hidden="true">
        {chars.map((c, i) => (
          <span key={i} className="char">
            {c === ' ' ? ' ' : c}
          </span>
        ))}
      </span>
      <span className="flip-b flip-copy" aria-hidden="true" style={{ transform: 'translateY(100%)' }}>
        {chars.map((c, i) => (
          <span key={i} className="char">
            {c === ' ' ? ' ' : c}
          </span>
        ))}
      </span>
    </Tag>
  );
}
