import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { useGSAP } from '@gsap/react';
import { animate, svg } from 'animejs';
import { gsap, ScrollTrigger } from '../lib/gsap';
import { LABS, loadAllLabs } from '../labs';
import { MiniView } from '../three/MiniView';
import NeuralTunnel from '../three/NeuralTunnel';
import { TLink } from '../transitions/PageWipe';
import SectionHeading from '../components/ui/SectionHeading';
import Breadcrumb from '../components/ui/Breadcrumb';
import { useInView } from '../hooks/useInView';

export default function AiHub() {
  const [mods, setMods] = useState(null);
  useEffect(() => {
    let alive = true;
    loadAllLabs().then((m) => alive && setMods(m));
    return () => {
      alive = false;
    };
  }, []);
  const states = useMemo(() => (mods ? mods.map((m) => (m ? m.createState() : null)) : null), [mods]);
  return (
    <>
      <TunnelHero />
      <LabGrid mods={mods} states={states} />
    </>
  );
}

/* A1 — camera sits inside a giant network; scrolling flies through it */
function TunnelHero() {
  const root = useRef(null);
  const prog = useRef(0);
  useGSAP(
    () => {
      gsap.from('.ah-title', { yPercent: 40, opacity: 0, duration: 1.2, ease: 'expo.out', delay: 0.3 });
      gsap.from('.ah-sub > *', { y: 20, opacity: 0, stagger: 0.1, duration: 0.8, delay: 0.7 });
      ScrollTrigger.create({
        trigger: root.current,
        start: 'top top',
        end: 'bottom top',
        scrub: 0.6,
        onUpdate: (self) => {
          prog.current = self.progress * 0.6;
        },
      });
    },
    { scope: root },
  );
  return (
    <section ref={root} className="relative h-screen overflow-hidden">
      <div className="absolute inset-0">
        <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0, -2.5], fov: 60, near: 0.1, far: 80 }} gl={{ antialias: true, alpha: true }}>
          <Suspense fallback={null}>
            <NeuralTunnel progressRef={prog} />
          </Suspense>
        </Canvas>
      </div>
      <div className="pointer-events-none absolute left-[var(--pad-x)] top-28 md:top-32">
        <Breadcrumb parts={['AI Lab', 'Hub']} />
      </div>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <div className="ah-title display text-[clamp(3rem,10vw,8.5rem)] font-bold leading-none" style={{ textShadow: '0 0 40px rgba(45,123,255,.35)' }}>
          THE AI LAB
        </div>
        <div className="ah-sub mt-6 flex flex-col items-center gap-3">
          <p className="max-w-[520px] text-base leading-relaxed" style={{ color: 'var(--muted)' }}>
            Eight models you can touch. Build a network, draw a digit, drop points for a support-vector machine — every one runs real maths in your browser.
          </p>
          <span className="mono text-[10px] tracking-[0.3em]" style={{ color: 'var(--blue-glow)' }}>
            SCROLL TO FLY THROUGH
          </span>
        </div>
      </div>
    </section>
  );
}

/* A2 / A3 / A4 — lab cards with live mini scenes, pips, and a learning-path line */
function LabGrid({ mods, states }) {
  const root = useRef(null);
  const grid = useRef(null);
  // Reveal is driven by an IntersectionObserver, NOT by `mods`: the 3D previews load
  // a second or two later, and re-running the animation then used to kill the fade
  // half-way and leave the cards (and their text) stuck semi-transparent.
  const gridIn = useInView(grid, 0.12);
  const revealed = useRef(false);

  useEffect(() => {
    if (!gridIn || revealed.current || !grid.current) return;
    revealed.current = true;
    const cards = grid.current.querySelectorAll('.lab-card');
    gsap.to(cards, { opacity: 1, y: 0, stagger: 0.09, duration: 0.9, ease: 'power3.out', overwrite: 'auto' });
  }, [gridIn]);

  // Failsafe: if the observer never fires (odd browser, page restored from bfcache),
  // show the cards anyway rather than leaving unreadable text on screen.
  useEffect(() => {
    const t = setTimeout(() => {
      if (!revealed.current && grid.current) {
        revealed.current = true;
        gsap.set(grid.current.querySelectorAll('.lab-card'), { opacity: 1, y: 0 });
      }
    }, 2500);
    return () => clearTimeout(t);
  }, []);

  useGSAP(
    () => {
      ScrollTrigger.create({
        trigger: '.lab-grid',
        start: 'top 70%',
        end: 'bottom 70%',
        scrub: true,
        onUpdate: (self) => {
          const p = root.current.querySelector('.path-line');
          if (p) p.style.strokeDashoffset = String((1 - self.progress) * 1000);
        },
      });
    },
    { scope: root },
  );
  return (
    <section ref={root} className="section">
      <SectionHeading eyebrow="Learning path">Start simple. End with attention.</SectionHeading>
      <div className="relative">
        <svg className="pointer-events-none absolute left-[-1.6rem] top-0 hidden h-full w-4 lg:block" viewBox="0 0 16 1000" preserveAspectRatio="none" aria-hidden="true">
          <line className="path-line" x1="8" y1="0" x2="8" y2="1000" stroke="var(--blue)" strokeWidth="2" strokeDasharray="6 8" style={{ strokeDashoffset: 1000 }} pathLength="1000" />
        </svg>
        <div ref={grid} className="lab-grid grid gap-5 md:grid-cols-2">
          {LABS.map((l, i) => (
            <LabCard key={l.slug} meta={l} mod={mods?.[i]} state={states?.[i]} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

function LabCard({ meta, mod, state, index }) {
  const Mini = mod?.MiniScene;
  return (
    <TLink to={`/ai/${meta.slug}`} data-cursor="view" className="lab-card reveal card card-glow group grid gap-4 p-5 sm:grid-cols-[180px_1fr]">
      <div className="relative h-40 overflow-hidden rounded-xl" style={{ background: 'rgba(45,123,255,.06)' }}>
        {Mini && state ? (
          <MiniView className="h-full w-full" noFit cameraPos={[0, 2.4, 5.2]} target={[0, 0.3, 0]}>
            <Mini state={state} />
          </MiniView>
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="h-8 w-8 animate-pulse rounded-full border" style={{ borderColor: 'var(--blue)' }} />
          </div>
        )}
        <span className="display absolute left-3 top-2 text-2xl font-bold" style={{ color: 'rgba(110,178,255,.2)' }}>
          {String(index + 1).padStart(2, '0')}
        </span>
      </div>
      <div className="flex flex-col">
        <div className="flex items-center justify-between gap-3">
          <span className="mono text-[10px] tracking-[0.25em]" style={{ color: 'var(--blue-glow)' }}>
            {meta.tag}
          </span>
          <span className="flex items-end gap-0.5" aria-label={`difficulty ${meta.difficulty}`}>
            {[1, 2, 3].map((p) => (
              <span
                key={p}
                className="block w-1.5 rounded-sm transition-colors duration-300"
                style={{ height: 4 + p * 3, background: p <= meta.difficulty ? 'var(--blue)' : 'rgba(110,178,255,.2)' }}
              />
            ))}
          </span>
        </div>
        <div className="display mt-2 text-xl font-bold">{meta.name}</div>
        <div className="mt-1 text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
          {meta.oneLiner}
        </div>
        <div className="mt-auto inline-flex items-center gap-2 pt-3 text-sm" style={{ color: 'var(--blue-glow)' }}>
          Open lab <span className="transition-transform group-hover:translate-x-1">→</span>
        </div>
      </div>
    </TLink>
  );
}
