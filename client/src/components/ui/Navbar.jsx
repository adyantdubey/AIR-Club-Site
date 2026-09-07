import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import { useGSAP } from '@gsap/react';
import { gsap, ScrollTrigger } from '../../lib/gsap';
import { TLink } from '../../transitions/PageWipe';
import { MACHINES } from '../../machines';
import { LABS } from '../../labs';
import Logo from './Logo';
import FlipLink from './FlipLink';

const LINKS = [
  { to: '/robotics', label: 'Robotics', mega: 'robotics' },
  { to: '/ai', label: 'AI Lab', mega: 'ai' },
  { to: '/about', label: 'About' },
  { to: '/events', label: 'Events' },
  { to: '/team', label: 'Team' },
  { to: '/contact', label: 'Contact' },
];

// Tiny wireframe glyphs for the mega-menu (G10)
const GLYPH = {
  rover: 'M4 16h16M7 16v-4h10v4M6 18a2 2 0 1 0 4 0a2 2 0 1 0-4 0M14 18a2 2 0 1 0 4 0a2 2 0 1 0-4 0M12 12V7h4',
  arm: 'M5 20h6M8 20V12l5-5 5 3M13 7l-2-3M18 10l2 2',
  drone: 'M12 12l-6-6M12 12l6-6M12 12l-6 6M12 12l6 6M4 6a2 2 0 1 0 4 0a2 2 0 1 0-4 0M16 6a2 2 0 1 0 4 0a2 2 0 1 0-4 0M4 18a2 2 0 1 0 4 0a2 2 0 1 0-4 0M16 18a2 2 0 1 0 4 0a2 2 0 1 0-4 0',
  uav: 'M3 12h18M12 5v14M8 19h8M12 5l-2 3h4z',
  balancer: 'M12 4v12M9 16h6M8 20a2 2 0 1 0 4 0a2 2 0 1 0-4 0M12 20a2 2 0 1 0 4 0a2 2 0 1 0-4 0M9 8h6',
  cube: 'M4 6h16v12H4zM9 6v12M15 6v12M4 12h16',
  butterfly: 'M12 4v16M12 8c-3-4-8-3-8 1s5 5 8 3M12 8c3-4 8-3 8 1s-5 5-8 3M12 14c-2-1-6 0-6 3s4 3 6 0M12 14c2-1 6 0 6 3s-4 3-6 0',
  hexabot: 'M8 8h8l3 4-3 4H8l-3-4zM5 12H2M22 12h-3M8 8L5 4M16 8l3-4M8 16l-3 4M16 16l3 4',
  playground: 'M4 8a2 2 0 1 0 4 0a2 2 0 1 0-4 0M4 16a2 2 0 1 0 4 0a2 2 0 1 0-4 0M16 12a2 2 0 1 0 4 0a2 2 0 1 0-4 0M8 8l8 4M8 16l8-4',
  'deep-net': 'M3 12h3M9 12h3M15 12h3M21 12h0M4 8v8M10 6v12M16 8v8M22 10v4',
  cnn: 'M4 4h8v8H4zM8 8h8v8H8zM12 12h8v8h-8z',
  transformer: 'M5 18a7 7 0 0 1 14 0M5 18c0-3 3-6 7-6M19 18c0-3-3-6-7-6M9 8a3 3 0 1 0 6 0a3 3 0 1 0-6 0',
  svm: 'M4 20L20 4M6 6h.01M9 5h.01M5 10h.01M18 18h.01M15 19h.01M19 14h.01',
  gradient: 'M3 16c4-8 6-8 9 0s5 8 9 0M12 8a1 1 0 1 0 2 0a1 1 0 1 0-2 0',
  distillation: 'M4 6h8v12H4zM16 9h4v6h-4zM12 12h4',
  reinforcement: 'M4 4h16v16H4zM4 12h16M12 4v16M8 16l4-4',
};

export default function Navbar() {
  const root = useRef(null);
  const [open, setOpen] = useState(false);
  const [mega, setMega] = useState(null);
  const location = useLocation();
  const closeTimer = useRef(null);

  useGSAP(
    () => {
      ScrollTrigger.create({
        start: 80,
        onToggle: (self) => {
          gsap.to(root.current, {
            paddingTop: self.isActive ? 10 : 22,
            paddingBottom: self.isActive ? 10 : 22,
            backgroundColor: self.isActive ? 'rgba(5,8,16,0.72)' : 'rgba(5,8,16,0)',
            borderBottomColor: self.isActive ? 'rgba(110,178,255,0.18)' : 'rgba(110,178,255,0)',
            backdropFilter: self.isActive ? 'blur(14px)' : 'blur(0px)',
            duration: 0.4,
          });
        },
      });
    },
    { scope: root },
  );

  useEffect(() => {
    setOpen(false);
    setMega(null);
  }, [location.pathname]);

  const showMega = (key) => {
    clearTimeout(closeTimer.current);
    setMega(key);
  };
  const hideMega = () => {
    closeTimer.current = setTimeout(() => setMega(null), 160);
  };

  const active = (to) => location.pathname === to || (to !== '/' && location.pathname.startsWith(to + '/'));

  return (
    <header ref={root} className="fixed left-0 top-0 z-[80] w-full border-b" style={{ padding: '22px var(--pad-x)', borderBottomColor: 'transparent' }}>
      <nav className="relative flex items-center justify-between">
        <TLink to="/" className="flex items-center gap-3" aria-label="Home">
          <Logo size={34} />
          <span className="display hidden text-sm font-bold tracking-wide sm:block">
            AI & ROBOTICS <span style={{ color: 'var(--muted)' }}>· NIT AP</span>
          </span>
        </TLink>

        <div className="relative hidden items-center gap-8 md:flex" onMouseLeave={hideMega}>
          {LINKS.map((l) => (
            <div key={l.to} onMouseEnter={() => (l.mega ? showMega(l.mega) : setMega(null))} className="relative py-2">
              <FlipLink to={l.to} as={TLink} className="mono text-xs uppercase tracking-[0.18em]">
                {l.label}
              </FlipLink>
              <span
                className="absolute -bottom-1 left-0 h-px transition-all duration-300"
                style={{ background: 'var(--blue)', width: active(l.to) ? '100%' : 0 }}
              />
            </div>
          ))}
          {mega && (
            <div className="mega" onMouseEnter={() => showMega(mega)} onMouseLeave={hideMega}>
              <MegaItems kind={mega} />
            </div>
          )}
        </div>

        <button className="mono text-xs uppercase tracking-[0.18em] md:hidden" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label="Menu">
          {open ? 'Close' : 'Menu'}
        </button>
      </nav>

      {open && (
        <div className="mt-6 flex max-h-[80vh] flex-col gap-4 overflow-auto pb-4 md:hidden">
          {LINKS.map((l) => (
            <TLink key={l.to} to={l.to} className="display text-2xl font-bold">
              {l.label}
            </TLink>
          ))}
        </div>
      )}
    </header>
  );
}

function MegaItems({ kind }) {
  const items = kind === 'robotics' ? MACHINES : LABS;
  const base = kind === 'robotics' ? '/robotics/' : '/ai/';
  const ref = useRef(null);
  useGSAP(
    () => {
      gsap.from('.mega-item', { y: 10, opacity: 0, stagger: 0.03, duration: 0.4 });
      gsap.to('.mega-glyph', { rotation: 360, duration: 12, ease: 'none', repeat: -1 });
    },
    { scope: ref, dependencies: [kind] },
  );
  return (
    <div ref={ref} className="contents">
      {items.map((it) => (
        <TLink key={it.slug} to={base + it.slug} className="mega-item">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: 'rgba(45,123,255,.1)' }}>
            <svg className="mega-glyph h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d={GLYPH[it.slug]} stroke="var(--blue-glow)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="min-w-0">
            <span className="display block truncate text-sm font-bold">{it.name}</span>
            <span className="mono block text-[9px] tracking-[0.18em]" style={{ color: 'var(--muted)' }}>
              {it.tag}
            </span>
          </span>
        </TLink>
      ))}
    </div>
  );
}
