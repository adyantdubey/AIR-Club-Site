import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap, ScrollTrigger } from '../../lib/gsap';
import { roverStore } from '../../lib/roverStore';
import { TLink } from '../../transitions/PageWipe';
import FlipLink from '../ui/FlipLink';
import Logo from '../ui/Logo';

const WORD = 'AI & ROBOTICS';

// C4 — huge outlined letters rise one by one, then drift sideways with scroll. C5 — flip links.
export default function Footer() {
  const root = useRef(null);

  useGSAP(
    () => {
      gsap.from('.big-char', {
        yPercent: 100,
        opacity: 0,
        stagger: 0.04,
        duration: 1,
        ease: 'expo.out',
        scrollTrigger: { trigger: '.big-word', start: 'top 90%', once: true },
      });
      ScrollTrigger.create({
        trigger: root.current,
        start: 'top 95%',
        end: 'top 45%',
        scrub: true,
        onUpdate: (self) => {
          roverStore.footer = self.progress;
        },
      });
      gsap.to('.big-word', {
        xPercent: -6,
        ease: 'none',
        scrollTrigger: { trigger: root.current, start: 'top bottom', end: 'bottom bottom', scrub: true },
      });
    },
    { scope: root },
  );

  return (
    <footer ref={root} className="relative overflow-hidden px-[var(--pad-x)] pt-16" style={{ zIndex: 2, borderTop: '1px solid var(--line)' }}>
      <div className="flex flex-col justify-between gap-10 md:flex-row md:items-end">
        <div className="flex items-center gap-3">
          <Logo size={40} />
          <div>
            <div className="display text-sm font-bold">AI & Robotics Club</div>
            <div className="mono text-[10px] tracking-[0.2em]" style={{ color: 'var(--muted)' }}>NIT ANDHRA PRADESH</div>
          </div>
        </div>
        <nav className="flex flex-wrap gap-x-8 gap-y-3">
          {[['robotics', 'robotics'], ['ai', 'ai lab'], ['about', 'about'], ['events', 'events'], ['team', 'team'], ['contact', 'contact']].map(([id, label]) => (
            <FlipLink key={id} as={TLink} to={`/${id}`} className="mono text-xs uppercase tracking-[0.18em]">
              {label}
            </FlipLink>
          ))}
          <FlipLink href="https://instagram.com" target="_blank" rel="noreferrer" className="mono text-xs uppercase tracking-[0.18em]">
            instagram
          </FlipLink>
          <FlipLink href="https://github.com" target="_blank" rel="noreferrer" className="mono text-xs uppercase tracking-[0.18em]">
            github
          </FlipLink>
        </nav>
      </div>

      <div className="big-word mt-12 flex select-none overflow-hidden whitespace-nowrap" aria-hidden="true">
        {[...WORD].map((c, i) => (
          <span key={i} className="big-char outline-text display inline-block text-[clamp(4rem,15vw,15rem)] font-bold leading-[0.9]">
            {c === ' ' ? ' ' : c}
          </span>
        ))}
      </div>

      <div className="mono flex flex-col gap-2 py-6 text-[10px] tracking-[0.15em] sm:flex-row sm:justify-between" style={{ color: 'var(--muted)' }}>
        <span>© {new Date().getFullYear()} AI & ROBOTICS CLUB, NIT AP</span>
        <span>BUILT WITH REACT · GSAP · ANIME.JS · THREE.JS</span>
      </div>
    </footer>
  );
}
