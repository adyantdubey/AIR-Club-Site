import { useEffect, useRef, useState } from 'react';
import { animate, stagger, svg } from 'animejs';
import { gsap, Flip } from '../../lib/gsap';
import { useInView } from '../../hooks/useInView';
import { leads as staticLeads, members as staticMembers, filters } from '../../data/team';
import { useTable } from '../../lib/useData';
import SectionHeading from '../ui/SectionHeading';
import SafeImg from '../ui/SafeImg';

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

  // Team comes from the database (Admin → Team); the static file is shown until it loads
  const { rows, loading } = useTable('team_members', { order: ['sort_order', true] });
  const people = loading && !rows.length ? null : rows.filter((m) => m.group !== 'faculty');
  const leads = people ? people.filter((m) => m.is_lead) : staticLeads;
  const members = people ? people.filter((m) => !m.is_lead) : staticMembers;
  const memberKey = members.map((m) => m.id || m.name).join('|');

  // T1 — cards ripple in from the centre of the grid (again if the list changes)
  useEffect(() => {
    if (!gridIn || !members.length) return;
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
  }, [gridIn, memberKey]);

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
          <MemberCard key={l.id || l.name} m={l} lead />
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
          <MemberCard key={m.id || m.name} m={m} hidden={filter !== 'all' && m.group !== filter} />
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
        <SafeImg
          src={m.photo || m.photo_url}
          alt={m.name}
          className="duotone h-full w-full object-cover object-top"
          fallback={
            <div className="duotone flex h-full w-full items-center justify-center" style={{ background: 'linear-gradient(135deg, #2a4f9e, #0b1020)' }}>
              <span className="display text-3xl font-bold" style={{ color: 'var(--blue-glow)' }}>
                {initials(m.name)}
              </span>
            </div>
          }
        />
        <div
          className="absolute inset-x-0 bottom-0 translate-y-full p-3 transition-transform duration-500 group-hover:translate-y-0"
          style={{ background: 'linear-gradient(to top, rgba(5,8,16,.95), transparent)', transitionTimingFunction: 'var(--ease-out)' }}
        >
          <div className="display text-sm font-bold">{m.name}</div>
          <div className="mono text-[10px] tracking-[0.2em]" style={{ color: 'var(--blue-glow)' }}>{m.role.toUpperCase()}</div>
          {m.bio && (
            <p className="mt-1 line-clamp-3 text-[11px] leading-snug" style={{ color: 'var(--muted)' }}>
              {m.bio}
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="display text-sm font-bold leading-snug">{m.name}</div>
          <div className="text-xs" style={{ color: 'var(--muted)' }}>{m.role}</div>
          {(m.department || m.year) && (
            <div className="mono mt-0.5 text-[9px] tracking-[0.15em]" style={{ color: 'var(--blue-glow)' }}>
              {[m.department, m.year].filter(Boolean).join(' · ').toUpperCase()}
            </div>
          )}
        </div>
{/^https:\/\/(www\.)?linkedin\.com\/in\//.test(m.linkedin || '') && (
          <a href={m.linkedin} target="_blank" rel="noreferrer" aria-label={`${m.name} on LinkedIn`} className="shrink-0 rounded-md p-1 transition-colors hover:bg-[rgba(45,123,255,.15)]" onClick={(e) => e.stopPropagation()}>
            <svg ref={icons} className="h-4 w-5" viewBox="20 0 18 16" fill="none" aria-hidden="true">
              <path d="M24 14V6M24 3v.5M29 14V9a2.5 2.5 0 0 1 5 0v5" stroke="var(--blue-glow)" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          </a>
        )}
      </div>
    </div>
  );
}
