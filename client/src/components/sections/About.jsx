import { useEffect, useRef } from 'react';
import { useGSAP } from '@gsap/react';
import { animate, svg, stagger } from 'animejs';
import { gsap, ScrollTrigger } from '../../lib/gsap';
import { splitText } from '../../lib/split';
import { roverStore } from '../../lib/roverStore';
import { useInView } from '../../hooks/useInView';
import SectionHeading from '../ui/SectionHeading';

const STORY = [
  { year: '2019', title: 'Founded', text: 'A handful of ECE students and one soldering iron in a borrowed lab.' },
  { year: '2021', title: 'First autonomous bot', text: 'Line-follower that placed at the state-level tech fest.' },
  { year: '2024', title: 'Vision & FPGA tracks', text: 'Computer-vision and neuromorphic-hardware teams formed.' },
  { year: '2027', title: 'International Rover Challenge', text: 'Full six-wheel rover with GPS-denied autonomy heading to IRC.' },
];

const PILLARS = [
  {
    title: 'Perception',
    text: 'Cameras, LiDAR and the software that turns pixels into a map of the world.',
    icon: 'M12 5C7 5 3 12 3 12s4 7 9 7 9-7 9-7-4-7-9-7Zm0 10a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z',
  },
  {
    title: 'Autonomy',
    text: 'Path planning, control loops and decision-making that run without a driver.',
    icon: 'M4 12h4l2-6 4 12 2-6h4',
  },
  {
    title: 'Hardware',
    text: 'Chassis, PCBs, motors and custom silicon — designed, machined and tested in-house.',
    icon: 'M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3M6 6h12v12H6z',
  },
];

export default function About() {
  const root = useRef(null);
  const para = useRef(null);
  const timeline = useRef(null);
  const pillars = useRef(null);
  const timelineIn = useInView(timeline, 0.25);
  const pillarsIn = useInView(pillars, 0.3);

  useGSAP(
    () => {
      // A1 — words light up as you scroll
      const words = splitText(para.current, 'words');
      gsap.set(words, { opacity: 0.18 });
      gsap.to(words, {
        opacity: 1,
        stagger: 0.04,
        ease: 'none',
        scrollTrigger: { trigger: para.current, start: 'top 75%', end: 'bottom 45%', scrub: true },
      });

      // A3 — milestone cards tilt in from the right
      gsap.utils.toArray('.milestone').forEach((card) => {
        gsap.from(card, {
          x: 60,
          rotationY: -18,
          opacity: 0,
          duration: 1,
          transformPerspective: 800,
          scrollTrigger: { trigger: card, start: 'top 80%', once: true },
        });
        gsap.from(card.querySelector('.dot'), {
          scale: 0,
          duration: 0.6,
          ease: 'back.out(3)',
          scrollTrigger: { trigger: card, start: 'top 80%', once: true },
        });
      });

      // A4 — the parked rover keeps rotating through this section
      ScrollTrigger.create({
        trigger: root.current,
        start: 'top bottom',
        end: 'bottom top',
        scrub: true,
        onUpdate: (self) => {
          roverStore.about = self.progress;
        },
      });
    },
    { scope: root },
  );

  // A2 — vertical line draws itself
  useEffect(() => {
    if (!timelineIn) return;
    const a = animate(svg.createDrawable('.tl-line'), { draw: ['0 0', '0 1'], duration: 1800, ease: 'inOutQuart' });
    return () => a.cancel();
  }, [timelineIn]);

  // A5 — pillar icons draw their outline on entry
  useEffect(() => {
    if (!pillarsIn) return;
    const a = animate(svg.createDrawable('.pillar-icon path'), {
      draw: ['0 0', '0 1'],
      duration: 1400,
      delay: stagger(180),
      ease: 'inOutSine',
    });
    const b = animate('.pillar', { translateY: [40, 0], opacity: [0, 1], delay: stagger(120), duration: 900, ease: 'outExpo' });
    return () => {
      a.cancel();
      b.cancel();
    };
  }, [pillarsIn]);

  return (
    <section id="about" ref={root} className="section">
      <SectionHeading eyebrow="01 — Who we are">Engineers who ship robots, not slides.</SectionHeading>

      <div className="grid gap-16 lg:grid-cols-2">
        <p ref={para} className="display max-w-[560px] text-[clamp(1.35rem,2.4vw,2rem)] font-medium leading-[1.35]">
          We are the AI & Robotics Club of NIT Andhra Pradesh. We build machines that see, think and move —
          autonomous rovers, camera-based medical devices and brain-inspired chips. Every member touches
          hardware and code, and every project ends on a competition floor or in someone's hands.
        </p>

        <div ref={timeline} className="relative pl-10">
          <svg className="absolute left-3 top-2 h-[calc(100%-1rem)] w-1" viewBox="0 0 2 100" preserveAspectRatio="none" aria-hidden="true">
            <line className="tl-line" x1="1" y1="0" x2="1" y2="100" stroke="var(--blue)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          </svg>
          <div className="flex flex-col gap-8">
            {STORY.map((s) => (
              <div key={s.year} className="milestone relative">
                <span className="dot absolute -left-[2.05rem] top-6 h-3 w-3 rounded-full ring-4" style={{ background: 'var(--blue)', '--tw-ring-color': 'rgba(45,123,255,0.25)' }} />
                <div className="card p-5">
                <div className="mono text-xs tracking-[0.2em]" style={{ color: 'var(--blue-glow)' }}>{s.year}</div>
                <div className="display mt-1 text-lg font-bold">{s.title}</div>
                <div className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>{s.text}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div ref={pillars} className="mt-24 grid gap-5 md:grid-cols-3">
        {PILLARS.map((p) => (
          <div key={p.title} className="pillar card card-glow group p-7 opacity-0" data-cursor>
            <BorderTravel />
            <svg className="pillar-icon h-10 w-10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d={p.icon} stroke="var(--blue-glow)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <h3 className="display mt-6 text-xl font-bold">{p.title}</h3>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>{p.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// A5 — a blue light that travels around the card border while hovering.
function BorderTravel() {
  const ref = useRef(null);
  useEffect(() => {
    const rect = ref.current;
    const card = rect.closest('.pillar');
    let anim = null;
    const start = () => {
      anim?.cancel();
      anim = animate(svg.createDrawable(rect), { draw: ['0 0.3', '0.7 1'], duration: 1200, ease: 'inOutSine', loop: true, alternate: true });
      rect.style.opacity = 1;
    };
    const stop = () => {
      anim?.cancel();
      rect.style.opacity = 0;
    };
    card.addEventListener('mouseenter', start);
    card.addEventListener('mouseleave', stop);
    return () => {
      anim?.cancel();
      card.removeEventListener('mouseenter', start);
      card.removeEventListener('mouseleave', stop);
    };
  }, []);
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
      <rect
        ref={ref}
        rx="20"
        fill="none"
        stroke="var(--blue-glow)"
        strokeWidth="2"
        style={{ x: 1, y: 1, width: 'calc(100% - 2px)', height: 'calc(100% - 2px)', opacity: 0, transition: 'opacity 0.3s' }}
      />
    </svg>
  );
}
