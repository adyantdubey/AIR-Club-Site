import { useEffect, useRef, useState } from 'react';
import { animate, stagger, svg } from 'animejs';
import { gsap, Flip } from '../../lib/gsap';
import { useInView } from '../../hooks/useInView';
import { leads, members, filters } from '../../data/team';
import SectionHeading from '../ui/SectionHeading';

const initials = (name) =>
  name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

export default function Team() {
  const root = useRef(null);
  const grid = useRef(null);
  const [filter, setFilter] = useState('all');
  const gridIn = useInView(grid, 0.15);
  const revealed = useRef(false);

  // T1 — cards ripple in from the centre of the grid
  useEffect(() => {
    if (!gridIn || revealed.current) return;
    revealed.current = true;
    const cards = grid.current.querySelectorAll('.member');
    const cols = getComputedStyle(grid.current).gridTemplateColumns.split(' ').length;
    const rows = Math.ceil(cards.length / cols);
    const a = animate(cards, {
      opacity: [0, 1],
      scale: [0.75, 1],
      translateY: [30, 0],
      delay: stagger(70, { grid: [cols, rows], from: 'center' }),
      duration: 900,
      ease: 'outExpo',
    });
    return () => a.cancel();
  }, [gridIn]);

  // T4 — re-flow the grid with GSAP Flip when a filter is picked
  const pick = (key) => {
    if (key === filter) return;
    const cards = gsap.utils.toArray('.member', grid.current);
    const state = Flip.getState(cards);
    setFilter(key);
    requestAnimationFrame(() => {
      Flip.from(state, {
        duration: 0.7,
        ease: 'power3.inOut',
        stagger: 0.03,
        absolute: true,
        onEnter: (els) => gsap.fromTo(els, { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, duration: 0.5 }),
        onLeave: (els) => gsap.to(els, { opacity: 0, scale: 0.8, duration: 0.4 }),
      });
    });
  };


  return (
    <section id="team" ref={root} className="section">
      <SectionHeading eyebrow="03 — The people">Forty pairs of hands, one rover.</SectionHeading>

      {/* T3 — leads */}
      <div className="mb-14 grid gap-5 sm:grid-cols-3">
        {leads.map((l) => (
          <MemberCard key={l.name} m={l} lead />
        ))}
      </div>

      <div className="mb-8 flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => pick(f.key)}
            className="chip transition-colors"
            style={
              filter === f.key
                ? { background: 'var(--blue)', color: '#fff', borderColor: 'var(--blue)' }
                : undefined
            }
          >
            {f.label}
          </button>
        ))}
      </div>

      <div ref={grid} className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {members.map((m) => (
          <MemberCard key={m.name} m={m} hidden={filter !== 'all' && m.group !== filter} />
        ))}
      </div>
    </section>
  );
}

function MemberCard({ m, lead = false, hidden = false }) {
  const ref = useRef(null);
  const hex = useRef(null);
  const icons = useRef(null);

  // T3 hexagon spin on hover; T5 social icon outline draws on hover
  useEffect(() => {
    const el = ref.current;
    let spin = null;
    const enter = () => {
      if (hex.current) {
        spin = animate(hex.current, { rotate: '+=180', duration: 1200, ease: 'inOutCubic' });
      }
      if (icons.current) {
        animate(svg.createDrawable(icons.current.querySelectorAll('path, circle, rect')), {
          draw: ['0 0', '0 1'],
          duration: 700,
          delay: stagger(80),
          ease: 'inOutSine',
        });
      }
    };
    el.addEventListener('mouseenter', enter);
    return () => {
      spin?.cancel();
      el.removeEventListener('mouseenter', enter);
    };
  }, []);

  return (
    <div
      ref={ref}
      data-flip-id={m.name}
      className={`member card group relative ${lead ? 'p-6' : 'p-4'} ${hidden ? 'hidden' : ''}`}
      style={{ opacity: lead ? 1 : 0 }}
      data-cursor
    >
      {lead && (
        <svg
          ref={hex}
          className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 opacity-30"
          viewBox="0 0 64 64"
          fill="none"
          aria-hidden="true"
        >
          <polygon points="32,4 56,18 56,46 32,60 8,46 8,18" stroke="var(--blue)" strokeWidth="1" />
        </svg>
      )}

      {/* T2 — duotone photo, full colour on hover */}
      <div className={`relative overflow-hidden rounded-xl ${lead ? 'aspect-[4/3]' : 'aspect-square'}`}>
        {m.photo ? (
          <img src={m.photo} alt={m.name} className="duotone h-full w-full object-cover" loading="lazy" />
        ) : (
          <div
            className="duotone flex h-full w-full items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #2a4f9e, #0b1020)' }}
          >
            <span className="display text-3xl font-bold" style={{ color: 'var(--blue-glow)' }}>
              {initials(m.name)}
            </span>
          </div>
        )}
        <div
          className="absolute inset-x-0 bottom-0 translate-y-full p-3 transition-transform duration-500 group-hover:translate-y-0"
          style={{ background: 'linear-gradient(to top, rgba(5,8,16,.95), transparent)', transitionTimingFunction: 'var(--ease-out)' }}
        >
          <div className="display text-sm font-bold">{m.name}</div>
          <div className="mono text-[10px] tracking-[0.2em]" style={{ color: 'var(--blue-glow)' }}>{m.role.toUpperCase()}</div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div>
          <div className="display text-sm font-bold">{m.name}</div>
          <div className="text-xs" style={{ color: 'var(--muted)' }}>{m.role}</div>
        </div>
        <svg ref={icons} className="h-4 w-10" viewBox="0 0 40 16" fill="none" aria-hidden="true">
          <rect x="1" y="1" width="14" height="14" rx="3" stroke="var(--blue-glow)" strokeWidth="1.3" />
          <circle cx="8" cy="8" r="3" stroke="var(--blue-glow)" strokeWidth="1.3" />
          <path d="M24 14V6M24 3v.5M29 14V9a2.5 2.5 0 0 1 5 0v5" stroke="var(--blue-glow)" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}
