import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap, ScrollTrigger } from '../../lib/gsap';
import { roverStore } from '../../lib/roverStore';
import { TLink } from '../../transitions/PageWipe';
import FlipLink from '../ui/FlipLink';
import Logo from '../ui/Logo';
import { useSettings } from '../../lib/useData';

const WORD = 'AI & ROBOTICS';

const SOCIAL_ICON = {
  instagram: 'M4 4h16v16H4zM12 8.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7M17 7v.01',
  github: 'M9 19c-4 1.5-4-2-6-2.5M15 21v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12 12 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21',
  linkedin: 'M4 9h4v11H4zM6 4v.01M11 20v-6a3 3 0 0 1 6 0v6M11 9v11M17 14v6h3v-6.5a4 4 0 0 0-6-3.5',
  youtube: 'M3 7.5C3 6 4 5 5.5 5h13C20 5 21 6 21 7.5v9c0 1.5-1 2.5-2.5 2.5h-13C4 19 3 18 3 16.5zM10 9l5 3-5 3z',
};

// C4 — huge outlined letters rise one by one, then drift sideways with scroll. C5 — flip links.
const PAGES = [
  ['robotics', 'robotics'], ['ai', 'ai lab'], ['projects', 'projects'], ['events', 'events'], ['ideas', 'idea box'],
  ['announcements', 'notices'], ['learn', 'learn'], ['gallery', 'gallery'], ['about', 'about'], ['team', 'team'], ['contact', 'contact'],
];

export default function Footer() {
  const root = useRef(null);
  const settings = useSettings();
  const socials = [
    ['instagram', settings.instagram],
    ['github', settings.github],
    ['linkedin', settings.linkedin],
    ['youtube', settings.youtube],
  ].filter(([, url]) => url);

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
        <nav className="flex flex-wrap gap-x-8 gap-y-3 md:max-w-[640px] md:justify-end">
          {PAGES.map(([id, label]) => (
            <FlipLink key={id} as={TLink} to={`/${id}`} className="mono text-xs uppercase tracking-[0.18em]">
              {label}
            </FlipLink>
          ))}
        </nav>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        {socials.map(([name, url]) => (
          <a
            key={name}
            href={url}
            target="_blank"
            rel="noreferrer"
            aria-label={name}
            className="flex h-10 w-10 items-center justify-center rounded-full border transition-colors hover:bg-[rgba(45,123,255,.15)]"
            style={{ borderColor: 'var(--line)' }}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d={SOCIAL_ICON[name]} stroke="var(--blue-glow)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        ))}
        {settings.email && (
          <a href={`mailto:${settings.email}`} className="mono ml-1 text-[11px] tracking-[0.15em]" style={{ color: 'var(--blue-glow)' }}>
            {settings.email.toUpperCase()}
          </a>
        )}
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
