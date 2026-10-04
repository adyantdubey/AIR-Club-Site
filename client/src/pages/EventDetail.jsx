import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { useGSAP } from '@gsap/react';
import { animate, stagger } from 'animejs';
import { gsap } from '../lib/gsap';
import { get } from '../lib/db';
import { useInView } from '../hooks/useInView';
import { TLink } from '../transitions/PageWipe';
import Breadcrumb from '../components/ui/Breadcrumb';
import SafeImg from '../components/ui/SafeImg';
import RichText from '../components/ui/RichText';
import { Skeleton, Empty, fmtDate, fmtTime } from '../components/ui/kit';
import { TECHKRIYA } from '../data/oldSite';
import { useContent } from '../lib/content';

/** /events/:id — the write-up and photos of one event. */
export default function EventDetail() {
  const { id } = useParams();
  const [state, setState] = useState({ loading: true, e: null });
  const root = useRef(null);

  useEffect(() => {
    let alive = true;
    setState({ loading: true, e: null });
    get('events', id)
      .then((e) => alive && setState({ loading: false, e }))
      .catch(() => alive && setState({ loading: false, e: null }));
    return () => {
      alive = false;
    };
  }, [id]);

  const { loading, e } = state;

  useGSAP(
    () => {
      if (!e) return;
      gsap.from('.d-head > *', { y: 30, opacity: 0, stagger: 0.08, duration: 0.8, ease: 'power3.out' });
      const imgs = root.current.querySelectorAll('.d-img');
      if (imgs.length) gsap.from(imgs, { scale: 1.08, opacity: 0, duration: 1.1, ease: 'power3.out', stagger: 0.15 });
      gsap.from('.d-body', { y: 30, opacity: 0, duration: 0.9, delay: 0.2 });
    },
    { scope: root, dependencies: [e?.id] },
  );

  const past = e && new Date(e.starts_at).getTime() < Date.now();
  const facts = e
    ? [
        ['Date', fmtDate(e.starts_at, { day: 'numeric', month: 'long', year: 'numeric' })],
        ['Time', fmtTime(e.starts_at)],
        ['Venue', e.venue],
        e.capacity ? [past ? 'Participants' : 'Seats', e.capacity] : null,
      ].filter(Boolean)
    : [];

  return (
    <>
      <section ref={root} className="section page-top">
        <Breadcrumb parts={['Events', e?.title || '…']} />
        {loading ? (
          <div className="mt-10">
            <Skeleton rows={4} height={60} />
          </div>
        ) : !e ? (
          <div className="mt-10">
            <Empty title="Event not found">
              <TLink to="/events" className="ctl-btn">
                ← All events
              </TLink>
            </Empty>
          </div>
        ) : (
          <>
            <div className="d-head mt-10 max-w-4xl">
              <div className="mono text-xs tracking-[0.25em]" style={{ color: 'var(--blue-glow)' }}>
                {e.kind} · {fmtDate(e.starts_at, { month: 'long', year: 'numeric' }).toUpperCase()}
              </div>
              <h1 className="display mt-3 text-[clamp(2.2rem,6vw,4.6rem)] font-bold leading-[1.05]">{e.title}</h1>
              {e.description && (
                <p className="mt-4 max-w-2xl text-lg" style={{ color: 'var(--muted)' }}>
                  {e.description}
                </p>
              )}
            </div>

            <div className="mt-10 grid gap-10 lg:grid-cols-[1.5fr_1fr]">
              <div className="d-body min-w-0">
                {e.image_url && (
                  <div className="card relative mb-8 aspect-[16/9] overflow-hidden">
                    <SafeImg src={e.image_url} alt={e.title} className="d-img h-full w-full object-cover" fallback={<div className="h-full w-full" style={{ background: 'linear-gradient(160deg, hsl(215 55% 20%), #050810)' }} />} />
                  </div>
                )}
                <RichText text={e.body || ''} />
              </div>

              <aside className="flex flex-col gap-5 lg:sticky lg:top-28 lg:self-start">
                {e.image2_url && (
                  <div className="card relative aspect-[4/3] overflow-hidden">
                    <SafeImg src={e.image2_url} alt={`${e.title} — second photo`} className="d-img h-full w-full object-cover" fallback={<div className="h-full w-full" style={{ background: 'linear-gradient(160deg, hsl(225 55% 18%), #050810)' }} />} />
                  </div>
                )}
                <div className="glass flex flex-col gap-3 p-5">
                  {facts.map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-4 text-sm">
                      <span className="mono text-[10px] uppercase tracking-[0.18em]" style={{ color: 'var(--muted)' }}>
                        {k}
                      </span>
                      <span className="text-right">{v}</span>
                    </div>
                  ))}
                  {e.link && (
                    <a className="ctl-btn mt-2 text-center" href={e.link} target="_blank" rel="noreferrer">
                      Event page ↗
                    </a>
                  )}
                  {!past && e.registration_open && (
                    <TLink to="/events" className="ctl-btn primary mt-2 text-center">
                      Register on the calendar →
                    </TLink>
                  )}
                </div>
                <TLink to="/events" className="ctl-btn self-start">
                  ← All events
                </TLink>
              </aside>
            </div>
          </>
        )}
      </section>
      {e && (e.id === 'techkriya-2023' || /techkriya/i.test(e.title)) && <Competitions />}
    </>
  );
}

/* The six competitions the club ran at Techkriya */
function Competitions() {
  const grid = useRef(null);
  const list = useContent('techkriya'); // names + text from Admin → Page content; icons cycle through the built-in set
  const inView = useInView(grid, 0.15);
  useEffect(() => {
    if (!inView) return;
    const a = animate(grid.current.querySelectorAll('.comp'), { opacity: [0, 1], translateY: [30, 0], delay: stagger(80), duration: 700, ease: 'outExpo' });
    const b = animate(grid.current.querySelectorAll('.comp path'), { strokeDashoffset: [80, 0], duration: 1300, delay: stagger(90), ease: 'inOutSine' });
    return () => {
      a.cancel();
      b.cancel();
    };
  }, [inView]);
  return (
    <section className="section flush-top">
      <div className="mono mb-3 flex items-center gap-3 text-xs uppercase tracking-[0.22em]" style={{ color: 'var(--blue-glow)' }}>
        <span className="inline-block h-px w-8" style={{ background: 'var(--blue)' }} />
        Techkriya competitions
      </div>
      <h2 className="display mb-8 text-[clamp(1.8rem,4vw,3rem)] font-bold leading-tight">Six arenas, one fest.</h2>
      <div ref={grid} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map(({ name, text }, i) => {
          const icon = TECHKRIYA[i % TECHKRIYA.length][2];
          return (
          <div key={i} className="comp card card-glow flex gap-4 p-5 opacity-0" data-cursor>
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl" style={{ background: 'rgba(45,123,255,.1)' }}>
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d={icon} stroke="var(--blue-glow)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="80" />
              </svg>
            </span>
            <div>
              <div className="display font-bold">{name}</div>
              <div className="mt-1 text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
                {text}
              </div>
            </div>
          </div>
          );
        })}
      </div>
    </section>
  );
}
