import { useEffect, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import { animate, stagger } from 'animejs';
import { gsap } from '../../lib/gsap';
import { useInView } from '../../hooks/useInView';
import { upcoming, past } from '../../data/events';
import SectionHeading from '../ui/SectionHeading';

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export default function Events() {
  const root = useRef(null);
  const list = useRef(null);
  const listIn = useInView(list, 0.2);

  useGSAP(
    () => {
      // E2 — rows slide in from the left with a blue line wiping underneath
      gsap.from('.ev-row', {
        x: -40,
        opacity: 0,
        stagger: 0.12,
        duration: 0.9,
        scrollTrigger: { trigger: list.current, start: 'top 80%', once: true },
      });
      gsap.from('.ev-line', {
        scaleX: 0,
        transformOrigin: 'left',
        stagger: 0.12,
        duration: 1,
        ease: 'power3.inOut',
        scrollTrigger: { trigger: list.current, start: 'top 80%', once: true },
      });

      // E3 — hover: arrow slides in, row lifts
      gsap.utils.toArray('.ev-row').forEach((row) => {
        const arrow = row.querySelector('.ev-arrow');
        row.addEventListener('mouseenter', () => {
          gsap.to(arrow, { x: 0, opacity: 1, duration: 0.4 });
          gsap.to(row, { x: 8, duration: 0.4 });
        });
        row.addEventListener('mouseleave', () => {
          gsap.to(arrow, { x: -12, opacity: 0, duration: 0.4 });
          gsap.to(row, { x: 0, duration: 0.4 });
        });
      });

      // E4 — endless marquee; slows down on hover
      const loop = gsap.to('.marquee', { xPercent: -50, ease: 'none', duration: 28, repeat: -1 });
      const wrap = root.current.querySelector('.marquee-wrap');
      wrap.addEventListener('mouseenter', () => gsap.to(loop, { timeScale: 0.25, duration: 0.6 }));
      wrap.addEventListener('mouseleave', () => gsap.to(loop, { timeScale: 1, duration: 0.6 }));
    },
    { scope: root },
  );

  // E1 — flip-clock dates
  useEffect(() => {
    if (!listIn) return;
    const a = animate('.ev-date', {
      rotateX: [-90, 0],
      opacity: [0, 1],
      delay: stagger(120, { start: 200 }),
      duration: 800,
      ease: 'outBack(1.4)',
    });
    return () => a.cancel();
  }, [listIn]);

  return (
    <section id="events" ref={root} className="section">
      <SectionHeading eyebrow="04 — What's happening">Workshops, build nights and the road to IRC.</SectionHeading>

      <div className="grid gap-14 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <Countdown target={upcoming[0].date} title={upcoming[0].title} />

          <div ref={list} className="mt-10 flex flex-col">
            {upcoming.map((e) => {
              const d = new Date(e.date);
              return (
                <a key={e.title} href="#contact" className="ev-row group relative flex items-center gap-6 py-6" data-cursor>
                  <div
                    className="ev-date card flex h-16 w-16 shrink-0 flex-col items-center justify-center"
                    style={{ transformStyle: 'preserve-3d', perspective: 600 }}
                  >
                    <span className="display text-xl font-bold leading-none">{d.getDate()}</span>
                    <span className="mono text-[10px] tracking-[0.2em]" style={{ color: 'var(--blue-glow)' }}>{MONTHS[d.getMonth()]}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mono text-[10px] tracking-[0.22em]" style={{ color: 'var(--blue-glow)' }}>{e.kind}</div>
                    <div className="display truncate text-xl font-bold">{e.title}</div>
                    <div className="text-sm" style={{ color: 'var(--muted)' }}>{e.where}</div>
                  </div>
                  <span className="ev-arrow -translate-x-3 text-2xl opacity-0" style={{ color: 'var(--blue)' }} aria-hidden="true">→</span>
                  <span className="ev-line absolute bottom-0 left-0 h-px w-full" style={{ background: 'var(--line)' }} />
                </a>
              );
            })}
          </div>
        </div>

        <div className="min-w-0">
          <div className="mono mb-4 text-xs uppercase tracking-[0.22em]" style={{ color: 'var(--muted)' }}>
            Past events
          </div>
          <div className="marquee-wrap w-full overflow-hidden rounded-2xl" style={{ maskImage: 'linear-gradient(90deg, transparent, #000 10%, #000 90%, transparent)' }}>
            <div className="marquee py-2">
              {[...past, ...past].map((name, i) => (
                <PastCard key={i} name={name} index={i % past.length} />
              ))}
            </div>
          </div>
          <p className="mt-6 text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
            Every semester we run a freshers' bootcamp, a build weekend and at least one campus competition.
            Slow the strip down with your cursor.
          </p>
        </div>
      </div>
    </section>
  );
}

function PastCard({ name, index }) {
  const ref = useRef(null);
  return (
    <div
      ref={ref}
      className="card flex h-40 w-56 shrink-0 flex-col justify-end p-4 transition-transform duration-500 hover:-rotate-2 hover:scale-105"
      style={{ background: `linear-gradient(160deg, hsl(${205 + index * 6} 60% ${18 - index}% ), #050810)` }}
    >
      <div className="mono text-[10px] tracking-[0.2em]" style={{ color: 'var(--blue-glow)' }}>2026</div>
      <div className="display text-base font-bold">{name}</div>
    </div>
  );
}

// E5 — countdown with slot-machine digits
function Countdown({ target, title }) {
  const [t, setT] = useState(() => diff(target));
  useEffect(() => {
    const id = setInterval(() => setT(diff(target)), 1000);
    return () => clearInterval(id);
  }, [target]);

  return (
    <div className="card p-6">
      <div className="mono text-[10px] tracking-[0.22em]" style={{ color: 'var(--blue-glow)' }}>NEXT UP · {title.toUpperCase()}</div>
      <div className="mt-4 flex items-end gap-5">
        <Unit label="days" value={t.d} />
        <Sep />
        <Unit label="hrs" value={t.h} />
        <Sep />
        <Unit label="min" value={t.m} />
        <Sep />
        <Unit label="sec" value={t.s} />
      </div>
    </div>
  );
}

const Sep = () => (
  <span className="display mb-6 text-3xl font-bold" style={{ color: 'var(--blue)' }}>
    :
  </span>
);

function Unit({ label, value }) {
  const str = String(value).padStart(2, '0');
  return (
    <div className="flex flex-col items-center">
      <div className="flex gap-1">
        {[...str].map((ch, i) => (
          <Digit key={i} ch={ch} />
        ))}
      </div>
      <div className="mono mt-2 text-[10px] tracking-[0.2em]" style={{ color: 'var(--muted)' }}>{label}</div>
    </div>
  );
}

function Digit({ ch }) {
  const ref = useRef(null);
  const prev = useRef(ch);
  useEffect(() => {
    if (prev.current === ch) return;
    prev.current = ch;
    const el = ref.current;
    const a = animate(el, {
      translateY: [-14, 0],
      opacity: [0, 1],
      duration: 380,
      ease: 'outCubic',
    });
    return () => a.cancel();
  }, [ch]);
  return (
    <span className="display inline-block h-12 w-9 overflow-hidden rounded-md text-center text-3xl font-bold leading-[3rem]" style={{ background: 'rgba(45,123,255,0.1)' }}>
      <span ref={ref} className="inline-block">{ch}</span>
    </span>
  );
}

function diff(target) {
  const ms = Math.max(0, new Date(target).getTime() - Date.now());
  const s = Math.floor(ms / 1000);
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}
