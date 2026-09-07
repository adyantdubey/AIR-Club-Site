import { useEffect, useRef } from 'react';
import { animate, utils } from 'animejs';

// G14 — "ROBOTICS / HEXABOT" types itself on page load
export default function Breadcrumb({ parts }) {
  const ref = useRef(null);
  const text = parts.map((p) => p.toUpperCase()).join('  /  ');
  useEffect(() => {
    const o = { i: 0 };
    const a = animate(o, {
      i: text.length,
      duration: 700,
      ease: 'linear',
      modifier: utils.round(0),
      onUpdate: () => {
        if (ref.current) ref.current.textContent = text.slice(0, o.i);
      },
    });
    return () => a.cancel();
  }, [text]);
  return (
    <div className="mono flex items-center gap-3 text-[10px] tracking-[0.25em]" style={{ color: 'var(--blue-glow)' }}>
      <span className="inline-block h-px w-6" style={{ background: 'var(--blue)' }} />
      <span ref={ref} aria-label={text} />
      <span className="inline-block h-3 w-[2px] animate-pulse" style={{ background: 'var(--blue)' }} />
    </div>
  );
}
