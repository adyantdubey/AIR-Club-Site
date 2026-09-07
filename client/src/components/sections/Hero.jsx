import { useEffect, useRef } from 'react';
import { useGSAP } from '@gsap/react';
import { animate, utils, createTimeline, steps } from 'animejs';
import { gsap } from '../../lib/gsap';
import { roverStore } from '../../lib/roverStore';
import { scrollToSection } from '../../lib/lenis';
import Button from '../ui/Button';

const SUB = 'AI & Robotics Club · NIT Andhra Pradesh';
const STATS = [
  { v: 40, suffix: '+', label: 'members' },
  { v: 12, suffix: '', label: 'projects' },
  { v: 2027, suffix: '', label: 'IRC target' },
];

export default function Hero({ ready }) {
  const root = useRef(null);
  const sub = useRef(null);
  const statRefs = useRef([]);

  // H9 — pin the hero for one screen height; the rover turns + parks as you scroll
  useGSAP(
    () => {
      gsap.set('.hl-line > span', { yPercent: 110 });
      gsap
        .timeline({
          scrollTrigger: {
            trigger: root.current,
            start: 'top top',
            end: '+=100%',
            pin: true,
            scrub: 0.6,
            anticipatePin: 1,
            onUpdate: (self) => {
              roverStore.hero = self.progress;
            },
          },
        })
        .to('.hero-copy', { x: -120, opacity: 0, ease: 'none' }, 0)
        .to('.hero-stats', { y: 60, opacity: 0, ease: 'none' }, 0)
        .to('.scroll-hint', { opacity: 0, ease: 'none' }, 0);
    },
    { scope: root },
  );

  // H4–H8 — play once the preloader curtain has opened
  useEffect(() => {
    if (!ready) return;
    const el = root.current;
    const reduced = roverStore.reducedMotion;
    const cleanups = [];

    const tl = gsap.timeline();
    tl.to(el.querySelectorAll('.hl-line > span'), {
      yPercent: 0,
      stagger: 0.12,
      duration: reduced ? 0.01 : 1.1,
      ease: 'expo.out',
    }, 0.2);

    // "EXPLORE" flickers on like a neon sign
    tl.call(() => {
      const a = animate('.hl-accent', {
        opacity: [0, 1, 0.25, 1, 0.4, 1],
        duration: reduced ? 10 : 900,
        ease: steps(6),
      });
      cleanups.push(() => a.cancel());
    }, null, 0.8);

    // H5 — typewriter
    tl.call(() => {
      const o = { i: 0 };
      const a = animate(o, {
        i: SUB.length,
        duration: reduced ? 10 : 1400,
        ease: 'linear',
        modifier: utils.round(0),
        onUpdate: () => {
          if (sub.current) sub.current.textContent = SUB.slice(0, o.i);
        },
      });
      cleanups.push(() => a.cancel());
    }, null, 1.1);

    // H6 — buttons
    tl.from('.hero-cta > *', { y: 24, opacity: 0, stagger: 0.12, duration: 0.8 }, 1.8);

    // H7 — stat counters
    tl.call(() => {
      STATS.forEach((s, i) => {
        const o = { v: 0 };
        const node = statRefs.current[i];
        const a = animate(o, {
          v: s.v,
          duration: reduced ? 10 : 1500,
          ease: 'outExpo',
          modifier: utils.round(0),
          onUpdate: () => {
            if (node) node.textContent = `${o.v}${s.suffix}`;
          },
        });
        cleanups.push(() => a.cancel());
      });
    }, null, 2.1);
    tl.from('.hero-stats > *', { y: 20, opacity: 0, stagger: 0.1, duration: 0.7 }, 2.0);

    // H8 — scroll hint loop
    tl.call(() => {
      gsap.to('.scroll-hint', { opacity: 1, duration: 0.6 });
      const a = createTimeline({ loop: true });
      a.add('.scroll-dot', { translateY: [0, 14], opacity: [1, 0], duration: 1100, ease: 'inOutQuad' });
      cleanups.push(() => a.cancel());
    }, null, 2.6);

    return () => {
      tl.kill();
      cleanups.forEach((c) => c());
    };
  }, [ready]);

  return (
    <section
      id="home"
      ref={root}
      className="section relative flex min-h-screen flex-col justify-end overflow-hidden md:justify-center"
      style={{ paddingTop: '6.5rem', paddingBottom: '3rem' }}
    >
      <div className="hero-copy max-w-[760px]">
        <div className="mono mb-6 text-xs uppercase tracking-[0.25em]" style={{ color: 'var(--blue-glow)' }}>
          <span ref={sub}>&nbsp;</span>
          <span className="type-cursor inline-block w-[2px] translate-y-[2px] animate-pulse" style={{ height: '1em', background: 'var(--blue)' }} />
        </div>

        <h1 className="display text-[clamp(2.4rem,5.6vw,5rem)] font-bold leading-[0.95]">
          <span className="hl-line block overflow-hidden"><span className="block">BUILDING THE</span></span>
          <span className="hl-line block overflow-hidden"><span className="block">MACHINES THAT</span></span>
          <span className="hl-line block overflow-hidden">
            <span className="block">
              <span className="hl-accent" style={{ color: 'var(--blue)', opacity: 0, textShadow: '0 0 28px rgba(110,178,255,0.7)' }}>EXPLORE</span>
            </span>
          </span>
        </h1>

        <p className="mt-5 max-w-[460px] text-base leading-relaxed" style={{ color: 'var(--muted)' }}>
          Students at NIT Andhra Pradesh designing autonomous rovers, vision systems and
          neuromorphic hardware — from first solder joint to competition field.
        </p>

        <div className="hero-cta mt-7 flex flex-wrap gap-4">
          <Button solid onClick={() => scrollToSection('#showroom')}>
            See the machines <span aria-hidden="true">→</span>
          </Button>
          <Button onClick={() => scrollToSection('#contact')}>Join Us</Button>
        </div>
      </div>

      <div className="hero-stats mt-10 flex gap-10">
        {STATS.map((s, i) => (
          <div key={s.label}>
            <div ref={(el) => (statRefs.current[i] = el)} className="display text-3xl font-bold" style={{ color: 'var(--fg)' }}>
              0
            </div>
            <div className="mono mt-1 text-[10px] uppercase tracking-[0.2em]" style={{ color: 'var(--muted)' }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>

      <div className="scroll-hint absolute bottom-12 right-[var(--pad-x)] hidden flex-col items-center gap-3 opacity-0 md:flex" aria-hidden="true">
        <div className="flex h-10 w-6 items-start justify-center rounded-full border p-1.5" style={{ borderColor: 'var(--line)' }}>
          <div className="scroll-dot h-1.5 w-1.5 rounded-full" style={{ background: 'var(--blue)' }} />
        </div>
        <span className="mono text-[10px] tracking-[0.3em]" style={{ color: 'var(--muted)' }}>SCROLL</span>
      </div>
    </section>
  );
}
