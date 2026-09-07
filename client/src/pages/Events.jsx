import { useEffect, useMemo, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import { animate, stagger } from 'animejs';
import { gsap, Flip } from '../lib/gsap';
import { useInView } from '../hooks/useInView';
import { upcoming as localUpcoming, past } from '../data/events';
import EventsSection from '../components/sections/Events';
import SectionHeading from '../components/ui/SectionHeading';
import Breadcrumb from '../components/ui/Breadcrumb';
import { Btn } from '../components/ui/Controls';
import { submitForm, isStatic } from '../lib/forms';

export default function Events() {
  const [events, setEvents] = useState(localUpcoming);
  useEffect(() => {
    // The server can override the list (server/data/events.json) without a rebuild.
    // Skipped when the site is hosted as static files with no Node server.
    if (isStatic) return;
    fetch('/api/events')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.events?.length && setEvents(d.events))
      .catch(() => {});
  }, []);
  return (
    <>
      <div className="px-[var(--pad-x)] pt-28 md:pt-32">
        <Breadcrumb parts={['Events']} />
      </div>
      <EventsSection />
      <Calendar events={events} />
      <PhotoWall />
    </>
  );
}

/* ---------------- Calendar: month grid, dots pulse, click flips a card ---------------- */
const DAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
function Calendar({ events }) {
  const root = useRef(null);
  const first = new Date(events[0]?.date || Date.now());
  const [month, setMonth] = useState(new Date(first.getFullYear(), first.getMonth(), 1));
  const [open, setOpen] = useState(null);
  const [reg, setReg] = useState('idle');
  const [form, setForm] = useState({ name: '', email: '' });

  const cells = useMemo(() => {
    const y = month.getFullYear();
    const m = month.getMonth();
    const start = (new Date(y, m, 1).getDay() + 6) % 7; // Monday first
    const n = new Date(y, m + 1, 0).getDate();
    const arr = [];
    for (let i = 0; i < start; i++) arr.push(null);
    for (let d = 1; d <= n; d++) arr.push(new Date(y, m, d));
    return arr;
  }, [month]);

  const evOn = (d) => events.filter((e) => sameDay(new Date(e.date), d));

  useGSAP(
    () => {
      gsap.from('.cal-cell', { scale: 0.7, opacity: 0, stagger: { each: 0.012, grid: 'auto', from: 'start' }, duration: 0.5, ease: 'back.out(1.5)', scrollTrigger: { trigger: root.current, start: 'top 80%', once: true } });
    },
    { scope: root, dependencies: [month] },
  );

  const shift = (k) => {
    setOpen(null);
    setMonth(new Date(month.getFullYear(), month.getMonth() + k, 1));
  };

  const register = async (e) => {
    e.preventDefault();
    setReg('sending');
    try {
      await submitForm('register', { ...form, event: open.title });
      setReg('done');
    } catch {
      setReg('error');
    }
  };

  return (
    <section ref={root} className="section pt-0">
      <SectionHeading eyebrow="Calendar">Pick a day. Show up.</SectionHeading>
      <div className="grid gap-8 lg:grid-cols-[1.3fr_1fr]">
        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <Btn small onClick={() => shift(-1)}>
              ←
            </Btn>
            <div className="display text-xl font-bold">{month.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</div>
            <Btn small onClick={() => shift(1)}>
              →
            </Btn>
          </div>
          <div className="mb-2 grid grid-cols-7 gap-1">
            {DAYS.map((d) => (
              <div key={d} className="mono py-1 text-center text-[10px] tracking-[0.2em]" style={{ color: 'var(--muted)' }}>
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((d, i) => {
              const evs = d ? evOn(d) : [];
              const has = evs.length > 0;
              const isOpen = open && d && sameDay(new Date(open.date), d);
              return (
                <button
                  key={i}
                  disabled={!d}
                  onClick={() => has && setOpen(isOpen ? null : evs[0])}
                  className="cal-cell relative aspect-square rounded-lg text-sm transition-colors"
                  style={{
                    background: isOpen ? 'var(--blue)' : has ? 'rgba(45,123,255,.14)' : d ? 'rgba(110,178,255,.04)' : 'transparent',
                    color: isOpen ? '#fff' : d ? 'var(--fg)' : 'transparent',
                    cursor: has ? 'pointer' : 'default',
                  }}
                >
                  {d ? d.getDate() : ''}
                  {has && !isOpen && (
                    <span className="absolute bottom-1.5 left-1/2 h-1.5 w-1.5 -translate-x-1/2 animate-pulse rounded-full" style={{ background: 'var(--blue-glow)' }} />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="relative min-h-[300px]">
          {open ? (
            <div key={open.title} className="card p-6" style={{ animation: 'flipIn .5s var(--ease-out)' }}>
              <div className="mono text-[10px] tracking-[0.25em]" style={{ color: 'var(--blue-glow)' }}>
                {open.kind} · {new Date(open.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}
              </div>
              <div className="display mt-2 text-2xl font-bold">{open.title}</div>
              <div className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
                {open.where} · {new Date(open.date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </div>
              {reg === 'done' ? (
                <div className="mono mt-6 text-xs tracking-[0.15em]" style={{ color: 'var(--blue-glow)' }}>
                  REGISTERED — SEE YOU THERE
                </div>
              ) : (
                <form onSubmit={register} className="mt-5 flex flex-col gap-3">
                  <input className="rounded-lg border bg-transparent px-3 py-2 text-sm outline-none" style={{ borderColor: 'var(--line)' }} placeholder="Your name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                  <input className="rounded-lg border bg-transparent px-3 py-2 text-sm outline-none" style={{ borderColor: 'var(--line)' }} placeholder="College email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                  <Btn primary disabled={reg === 'sending'}>
                    {reg === 'sending' ? 'Sending…' : 'Register for this event'}
                  </Btn>
                  {reg === 'error' && (
                    <span className="mono text-[10px]" style={{ color: 'var(--blue-glow)' }}>
                      Could not register — please try again in a moment.
                    </span>
                  )}
                </form>
              )}
            </div>
          ) : (
            <div className="card flex h-full min-h-[300px] flex-col items-center justify-center p-6 text-center">
              <div className="h-12 w-12 rounded-full border animate-pulse" style={{ borderColor: 'var(--blue)' }} />
              <div className="mono mt-4 text-[10px] tracking-[0.25em]" style={{ color: 'var(--muted)' }}>
                CLICK A GLOWING DAY
              </div>
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes flipIn { from { opacity: 0; transform: perspective(800px) rotateX(-18deg) translateY(20px);} to { opacity: 1; transform: none; } }`}</style>
    </section>
  );
}

const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/* ---------------- Photo wall (placeholders until real photos) ---------------- */
function PhotoWall() {
  const root = useRef(null);
  const grid = useRef(null);
  const inView = useInView(grid, 0.15);
  useEffect(() => {
    if (!inView) return;
    const a = animate('.photo', { opacity: [0, 1], scale: [0.9, 1], delay: stagger(60, { grid: [4, 3], from: 'center' }), duration: 700, ease: 'outExpo' });
    return () => a.cancel();
  }, [inView]);
  const tiles = past.concat(['Lab night', 'Rover test', 'Arm demo', 'Cage flight']).slice(0, 12);
  return (
    <section ref={root} className="section pt-0">
      <SectionHeading eyebrow="Photo wall">Moments from the floor.</SectionHeading>
      <div ref={grid} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {tiles.map((t, i) => (
          <div
            key={t + i}
            className={`photo card group relative overflow-hidden opacity-0 ${i % 5 === 0 ? 'row-span-2' : ''}`}
            style={{ minHeight: i % 5 === 0 ? 280 : 140, background: `linear-gradient(160deg, hsl(${210 + (i % 6) * 5} 55% ${16 + (i % 4) * 3}%), #050810)` }}
            data-cursor="view"
          >
            <div className="absolute inset-0 transition-transform duration-700 group-hover:scale-110" style={{ background: 'radial-gradient(60% 60% at 40% 30%, rgba(110,178,255,.18), transparent)' }} />
            <div className="absolute bottom-3 left-3">
              <div className="mono text-[9px] tracking-[0.25em]" style={{ color: 'var(--blue-glow)' }}>
                2026
              </div>
              <div className="display text-sm font-bold">{t}</div>
            </div>
          </div>
        ))}
      </div>
      <p className="mono mt-4 text-[10px] tracking-[0.2em]" style={{ color: 'var(--muted)' }}>
        DROP REAL PHOTOS INTO client/public/photos AND LIST THEM IN src/data/events.js
      </p>
    </section>
  );
}
