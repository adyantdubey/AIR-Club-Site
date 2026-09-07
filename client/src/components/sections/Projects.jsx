import { useEffect, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import { animate, stagger } from 'animejs';
import { Canvas } from '@react-three/fiber';
import { gsap, ScrollTrigger } from '../../lib/gsap';
import { roverStore } from '../../lib/roverStore';
import { isMobile } from '../../lib/motion';
import { useTilt } from '../../hooks/useTilt';
import { useInView } from '../../hooks/useInView';
import { projects } from '../../data/projects';
import SectionHeading from '../ui/SectionHeading';
import Chip from '../ui/Chip';
import RoverModel from '../three/RoverModel';

export default function Projects() {
  const root = useRef(null);
  const track = useRef(null);
  const bar = useRef(null);
  const [mobile, setMobile] = useState(() => isMobile());

  useEffect(() => {
    const onResize = () => setMobile(isMobile());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useGSAP(
    () => {
      // Rover shrinks away while we're in Projects / Team / Events
      ScrollTrigger.create({
        trigger: root.current,
        start: 'top 70%',
        end: 'top 20%',
        scrub: true,
        onUpdate: (self) => {
          roverStore.hidden = self.progress;
        },
      });

      if (mobile) return;

      // P1 — pin and slide the track sideways as you scroll down
      const getDistance = () => track.current.scrollWidth - window.innerWidth;
      const tween = gsap.to(track.current, {
        x: () => -getDistance(),
        ease: 'none',
        scrollTrigger: {
          trigger: '.pin-wrap',
          start: 'top top',
          end: () => `+=${getDistance()}`,
          pin: true,
          scrub: 0.8,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            gsap.set(bar.current, { scaleX: self.progress });
          },
        },
      });

      // P2 — image inside each card moves slower than the card (depth)
      gsap.utils.toArray('.p-visual').forEach((v) => {
        gsap.fromTo(
          v,
          { xPercent: -8 },
          {
            xPercent: 8,
            ease: 'none',
            scrollTrigger: { trigger: v, containerAnimation: tween, start: 'left right', end: 'right left', scrub: true },
          },
        );
      });

    },
    { scope: root, dependencies: [mobile] },
  );

  return (
    <section id="projects" ref={root} className="relative" style={{ zIndex: 2 }}>
      <div className={`pin-wrap relative ${mobile ? '' : 'flex h-screen flex-col justify-center overflow-hidden pt-20'}`}>
        <div className={`px-[var(--pad-x)] ${mobile ? 'section pb-0' : ''}`}>
          <SectionHeading eyebrow="02 — What we build" className={mobile ? '' : '!mb-8'}>
            Projects with wheels, eyes and brains.
          </SectionHeading>
        </div>

        <div
          ref={track}
          className={`${mobile ? 'flex flex-col gap-6 px-[var(--pad-x)] pb-20' : 'flex w-max gap-6 px-[var(--pad-x)]'}`}
        >
          {projects.map((p, i) => (
            <ProjectCard key={p.id} p={p} index={i} mobile={mobile} />
          ))}
          {!mobile && <div className="w-[20vw] shrink-0" aria-hidden="true" />}
        </div>

        {!mobile && (
          <div className="absolute bottom-6 left-[var(--pad-x)] right-[var(--pad-x)] h-px" style={{ background: 'var(--line)' }}>
            <div ref={bar} className="h-full w-full origin-left" style={{ background: 'var(--blue)', transform: 'scaleX(0)' }} />
          </div>
        )}
      </div>
    </section>
  );
}

function enterCard(card) {
  const title = card.querySelector('.p-title');
  if (!title.dataset.split) {
    title.dataset.split = '1';
    title.innerHTML = [...title.textContent]
      .map((c) => `<span class="inline-block" style="opacity:0">${c === ' ' ? '&nbsp;' : c}</span>`)
      .join('');
  }
  animate(title.querySelectorAll('span'), {
    opacity: [0, 1],
    translateY: [18, 0],
    delay: stagger(22),
    duration: 700,
    ease: 'outExpo',
  });
  animate(card.querySelectorAll('.chip'), {
    opacity: [0, 1],
    translateY: [16, 0],
    scale: [0.8, 1],
    delay: stagger(60, { start: 300 }),
    duration: 800,
    ease: 'outElastic(1, .6)',
  });
  const tag = card.querySelector('.p-tag');
  const text = tag.dataset.text;
  const o = { i: 0 };
  animate(o, {
    i: text.length,
    duration: 600,
    ease: 'linear',
    modifier: (v) => Math.round(v),
    onUpdate: () => (tag.textContent = text.slice(0, o.i)),
  });
  gsap.fromTo(card, { opacity: 0.4, y: 30 }, { opacity: 1, y: 0, duration: 0.9 });
}

function ProjectCard({ p, index, mobile }) {
  const ref = useRef(null);
  useTilt(ref, 6);
  const inView = useInView(ref, 0.35);
  useEffect(() => {
    if (inView) enterCard(ref.current);
  }, [inView]);

  return (
    <article
      ref={ref}
      data-cursor="view"
      className={`p-card card card-glow group relative shrink-0 ${mobile ? 'w-full' : p.featured ? 'w-[min(78vw,720px)]' : 'w-[min(66vw,520px)]'}`}
      style={{ height: mobile ? 'auto' : '56vh', minHeight: mobile ? 0 : 440 }}
    >
      <div className={`relative overflow-hidden ${mobile ? 'h-56' : 'h-[58%]'}`}>
        {p.featured ? (
          <div className="absolute inset-0">
            <Canvas dpr={[1, 1.5]} camera={{ position: [0, 1.0, 4.3], fov: 35 }} gl={{ alpha: true, antialias: true }}>
              <ambientLight intensity={0.4} />
              <pointLight position={[3, 5, 3]} intensity={30} color="#6eb2ff" />
              <pointLight position={[-4, 2, -2]} intensity={12} />
              <RoverModel mini treads={10} />
            </Canvas>
            <div className="pointer-events-none absolute bottom-3 left-4 mono text-[10px] tracking-[0.25em]" style={{ color: 'var(--blue-glow)' }}>
              LIVE 3D · DRAG-FREE PREVIEW
            </div>
          </div>
        ) : (
          <div
            className="p-visual absolute inset-[-10%] transition-transform duration-700 group-hover:scale-105"
            style={{
              background: `radial-gradient(120% 80% at 30% 20%, hsl(${p.hue} 90% 55% / 0.45), transparent 60%), linear-gradient(160deg, hsl(${p.hue} 60% 14%), #050810 70%)`,
            }}
          >
            <svg className="absolute inset-0 h-full w-full opacity-30" aria-hidden="true">
              <defs>
                <pattern id={`grid-${p.id}`} width="28" height="28" patternUnits="userSpaceOnUse">
                  <path d="M28 0H0V28" fill="none" stroke="rgba(110,178,255,.35)" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill={`url(#grid-${p.id})`} />
            </svg>
            <div className="display absolute right-6 top-6 text-[7rem] font-bold leading-none" style={{ color: 'rgba(110,178,255,0.08)' }}>
              0{index + 1}
            </div>
          </div>
        )}
        <span className="p-tag mono absolute left-5 top-5 text-[10px] tracking-[0.25em]" style={{ color: 'var(--blue-glow)' }} data-text={p.tag} />
      </div>

      <div className="flex flex-col gap-3 p-6">
        <h3 className="p-title display text-2xl font-bold" style={{ opacity: 1 }}>
          {p.title}
        </h3>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
          {p.blurb}
        </p>
        <div className="mt-1 flex flex-wrap gap-2">
          {p.tech.map((t) => (
            <Chip key={t} className="opacity-0">
              {t}
            </Chip>
          ))}
        </div>
      </div>
    </article>
  );
}
