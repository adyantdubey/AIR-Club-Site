import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { useGSAP } from '@gsap/react';
import { animate, svg, stagger } from 'animejs';
import { gsap, ScrollTrigger } from '../lib/gsap';
import { getLenis } from '../lib/lenis';
import { isMobile } from '../lib/motion';
import { splitText } from '../lib/split';
import { loadMachine, machineMeta, nextMachine, MACHINES } from '../machines';
import Pedestal from '../three/Pedestal';
import { MiniView } from '../three/MiniView';
import { TLink } from '../transitions/PageWipe';
import { DPad, Btn } from '../components/ui/Controls';
import Chip from '../components/ui/Chip';
import SectionHeading from '../components/ui/SectionHeading';
import Breadcrumb from '../components/ui/Breadcrumb';
import NotFound from './NotFound';

export default function MachinePage() {
  const { slug } = useParams();
  const [mod, setMod] = useState(null);
  const [nextMod, setNextMod] = useState(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let alive = true;
    setMod(null);
    setNextMod(null);
    setMissing(false);
    loadMachine(slug)
      .then((m) => alive && setMod(m))
      .catch(() => alive && setMissing(true));
    const nx = nextMachine(slug);
    if (nx) loadMachine(nx.slug).then((m) => alive && setNextMod(m)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [slug]);

  if (missing || !machineMeta(slug)) return <NotFound />;
  if (!mod) return <Loading />;
  return <MachineView key={slug} machine={mod} nextMod={nextMod} nextMeta={nextMachine(slug)} index={MACHINES.findIndex((m) => m.slug === slug)} />;
}

function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-24 w-24 animate-pulse rounded-full border-2" style={{ borderColor: 'var(--blue)' }} />
    </div>
  );
}

function MachineView({ machine, nextMod, nextMeta, index }) {
  const state = useMemo(() => machine.createState(), [machine]);
  const explode = useRef(0);
  const controls = useRef(null);
  const wrap = useRef(null);
  const root = useRef(null);
  const mobile = isMobile();
  const [exploded, setExploded] = useState(false);
  const { Model, Panel } = machine;

  // Keyboard → state.frame.keys (the machine reads it every frame)
  useEffect(() => {
    const keys = state.frame.keys || (state.frame.keys = new Set());
    const norm = (k) => (k.length === 1 ? k.toLowerCase() : k);
    const down = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      keys.add(norm(e.key));
      if (['ArrowUp', 'ArrowDown', ' '].includes(e.key) && machine.mobileKeys?.includes(e.key)) e.preventDefault();
    };
    const up = (e) => keys.delete(norm(e.key));
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      keys.clear();
    };
  }, [state, machine]);

  // D1 — name letters rise; chips pop; D3 — scroll drives the exploded view (desktop)
  useGSAP(
    () => {
      const chars = splitText(root.current.querySelector('.m-name'), 'chars');
      gsap.from(chars, { yPercent: 110, opacity: 0, stagger: 0.03, duration: 0.9, ease: 'expo.out', delay: 0.2 });
      gsap.from('.m-intro > *', { y: 20, opacity: 0, stagger: 0.08, duration: 0.7, delay: 0.5 });
      gsap.from('.m-panel', { x: -30, opacity: 0, duration: 0.8, delay: 0.9 });
      animate('.m-chip', { opacity: [0, 1], translateY: [10, 0], delay: stagger(60, { start: 900 }), duration: 600, ease: 'outExpo' });

      if (!mobile) {
        ScrollTrigger.create({
          trigger: wrap.current,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.5,
          onUpdate: (self) => {
            const p = self.progress;
            const e = gsap.utils.clamp(0, 1, (p - 0.25) / 0.6);
            explode.current = e;
            gsap.set('.m-hero-text', { opacity: 1 - Math.min(1, e * 2.2), y: -e * 40 });
            gsap.set('.m-inside', { opacity: Math.max(0, (e - 0.35) * 2), y: (1 - e) * 30 });
            gsap.set('.m-panel', { opacity: 1 - Math.min(1, e * 1.6), pointerEvents: e > 0.5 ? 'none' : 'auto' });
          },
        });
      }
    },
    { scope: root, dependencies: [machine] },
  );

  const toggleExplode = () => {
    if (!mobile) {
      const lenis = getLenis();
      const target = exploded ? wrap.current.offsetTop : wrap.current.offsetTop + wrap.current.offsetHeight - window.innerHeight;
      lenis ? lenis.scrollTo(target, { duration: 1.6 }) : window.scrollTo({ top: target, behavior: 'smooth' });
    } else {
      gsap.to(explode, { current: exploded ? 0 : 1, duration: 1.2, ease: 'power2.inOut' });
    }
    setExploded((v) => !v);
  };

  const onKey = (k, down) => (down ? state.frame.keys.add(k) : state.frame.keys.delete(k));
  const labelledParts = useMemo(() => countLabels(machine), [machine]);

  return (
    <article ref={root}>
      {/* ---------- D1 / D2 / D3: sticky pedestal ---------- */}
      <div ref={wrap} className="relative" style={{ height: mobile ? 'auto' : '240vh' }}>
        <div className={`${mobile ? 'relative' : 'sticky top-0'} h-screen w-full overflow-hidden`}>
          <Pedestal explodeRef={explode} controlsRef={controls} fit={machine.fit || 2.4} className="absolute inset-0">
            <Model state={state} mode="hero" controlsRef={controls} />
          </Pedestal>

          {/* hero text */}
          <div className="m-hero-text pointer-events-none absolute left-[var(--pad-x)] top-28 max-w-[520px] md:top-32">
            <Breadcrumb parts={['Robotics', machine.name]} />
            <h1 className="m-name display mt-3 text-[clamp(2.2rem,5.5vw,4.6rem)] font-bold leading-[1.02]">{machine.name}</h1>
            <div className="m-intro mt-4">
              <p className="max-w-[440px] text-base leading-relaxed" style={{ color: 'var(--muted)' }}>
                {machine.oneLiner}
              </p>
              <div className="pointer-events-auto mt-4 flex flex-wrap gap-2">
                {machine.specs.slice(0, 4).map(([k, v]) => (
                  <span key={k} className="m-chip chip opacity-0">
                    {k}: {v}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* inside text (exploded) */}
          {!mobile && (
            <div className="m-inside pointer-events-none absolute right-[var(--pad-x)] top-32 max-w-[360px] text-right opacity-0">
              <div className="mono text-xs uppercase tracking-[0.22em]" style={{ color: 'var(--blue-glow)' }}>
                Inside the machine
              </div>
              <h2 className="display mt-2 text-3xl font-bold">{labelledParts} labelled parts</h2>
              <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
                Every part floats out along its own axis. Numbers match the labels — drag to look around while it's open.
              </p>
            </div>
          )}

          {/* explode button + index */}
          <div className="absolute right-[var(--pad-x)] top-24 flex items-center gap-3 md:top-28">
            <span className="mono text-[10px] tracking-[0.25em]" style={{ color: 'var(--muted)' }}>
              {String(index + 1).padStart(2, '0')} / {String(MACHINES.length).padStart(2, '0')}
            </span>
            <Btn small onClick={toggleExplode}>
              {exploded ? 'Assemble' : 'Explode view'}
            </Btn>
          </div>

          {/* floating control panel */}
          {!mobile && (
            <div className="m-panel panel absolute bottom-8 left-[var(--pad-x)] w-[300px]">
              <div className="mono text-[10px] tracking-[0.25em]" style={{ color: 'var(--blue-glow)' }}>
                CONTROLS
              </div>
              <Panel state={state} />
              <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
                {machine.controlsHelp}
              </p>
            </div>
          )}
        </div>

        {mobile && (
          <div className="panel mx-[var(--pad-x)] -mt-6 relative z-10">
            <div className="mono text-[10px] tracking-[0.25em]" style={{ color: 'var(--blue-glow)' }}>
              CONTROLS
            </div>
            {machine.mobileKeys && <DPad keys={machine.mobileKeys.length >= 4 ? machine.mobileKeys : ['ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight']} action={machine.mobileKeys.length === 1 ? machine.mobileKeys[0] : undefined} onKey={onKey} />}
            <Panel state={state} />
            <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
              {machine.controlsHelp}
            </p>
          </div>
        )}
      </div>

      {/* ---------- intro + D4 how it works ---------- */}
      <section className="section">
        <div className="grid gap-14 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <SectionHeading eyebrow="About this machine">{machine.name}</SectionHeading>
            <p className="max-w-[560px] text-lg leading-relaxed" style={{ color: 'var(--muted)' }}>
              {machine.blurb}
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {machine.tech.map((t) => (
                <Chip key={t}>{t}</Chip>
              ))}
            </div>
          </div>
          <HowItWorks steps={machine.howItWorks} />
        </div>
      </section>

      {/* ---------- D5 spec sheet ---------- */}
      <SpecSheet specs={machine.specs} />

      {/* ---------- D6 build log ---------- */}
      <BuildLog log={machine.buildLog} />

      {/* ---------- D7 next machine ---------- */}
      {nextMeta && <NextMachine meta={nextMeta} mod={nextMod} />}
    </article>
  );
}

function countLabels(machine) {
  // Rough count from the module source isn't possible; show a friendly fixed range
  return machine.labelCount || '6–10';
}

// D4 — three steps, each icon ring draws itself
function HowItWorks({ steps }) {
  const ref = useRef(null);
  useGSAP(
    () => {
      ScrollTrigger.create({
        trigger: ref.current,
        start: 'top 80%',
        once: true,
        onEnter: () => {
          animate(svg.createDrawable('.hw-ring'), { draw: ['0 0', '0 1'], duration: 1200, delay: stagger(200), ease: 'inOutSine' });
          gsap.from('.hw-step', { x: 40, opacity: 0, stagger: 0.15, duration: 0.8 });
        },
      });
    },
    { scope: ref },
  );
  return (
    <div ref={ref} className="flex flex-col gap-4">
      <div className="mono text-xs uppercase tracking-[0.22em]" style={{ color: 'var(--blue-glow)' }}>
        How it works
      </div>
      {steps.map((s, i) => (
        <div key={s.title} className="hw-step card flex gap-5 p-5">
          <svg className="h-12 w-12 shrink-0" viewBox="0 0 48 48" fill="none" aria-hidden="true">
            <circle className="hw-ring" cx="24" cy="24" r="21" stroke="var(--blue)" strokeWidth="1.5" />
            <text x="24" y="29" textAnchor="middle" fill="var(--blue-glow)" fontSize="14" fontFamily="JetBrains Mono, monospace">
              {i + 1}
            </text>
          </svg>
          <div>
            <div className="display text-lg font-bold">{s.title}</div>
            <div className="mt-1 text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
              {s.text}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// D5 — rows slide in, values type
function SpecSheet({ specs }) {
  const ref = useRef(null);
  useGSAP(
    () => {
      gsap.from('.spec-row', {
        x: -30,
        opacity: 0,
        stagger: 0.08,
        duration: 0.7,
        scrollTrigger: { trigger: ref.current, start: 'top 80%', once: true },
      });
      gsap.from('.spec-line', {
        scaleX: 0,
        transformOrigin: 'left',
        stagger: 0.08,
        duration: 0.9,
        ease: 'power3.inOut',
        scrollTrigger: { trigger: ref.current, start: 'top 80%', once: true },
      });
    },
    { scope: ref },
  );
  return (
    <section ref={ref} className="section pt-0">
      <div className="mono mb-6 text-xs uppercase tracking-[0.22em]" style={{ color: 'var(--blue-glow)' }}>
        Spec sheet
      </div>
      <div className="grid gap-x-12 md:grid-cols-2">
        {specs.map(([k, v]) => (
          <div key={k} className="spec-row relative flex items-baseline justify-between gap-6 py-4">
            <span className="mono text-[11px] uppercase tracking-[0.2em]" style={{ color: 'var(--muted)' }}>
              {k}
            </span>
            <span className="display text-right text-lg font-bold">{v}</span>
            <span className="spec-line absolute bottom-0 left-0 h-px w-full" style={{ background: 'var(--line)' }} />
          </div>
        ))}
      </div>
    </section>
  );
}

// D6 — vertical timeline
function BuildLog({ log }) {
  const ref = useRef(null);
  useGSAP(
    () => {
      ScrollTrigger.create({
        trigger: ref.current,
        start: 'top 75%',
        once: true,
        onEnter: () => {
          animate(svg.createDrawable('.bl-line'), { draw: ['0 0', '0 1'], duration: 1600, ease: 'inOutQuart' });
          gsap.from('.bl-item', { x: 40, opacity: 0, stagger: 0.15, duration: 0.8 });
          gsap.from('.bl-dot', { scale: 0, stagger: 0.15, duration: 0.5, ease: 'back.out(3)' });
        },
      });
    },
    { scope: ref },
  );
  return (
    <section ref={ref} className="section pt-0">
      <div className="mono mb-6 text-xs uppercase tracking-[0.22em]" style={{ color: 'var(--blue-glow)' }}>
        Build log
      </div>
      <div className="relative pl-10">
        <svg className="absolute left-3 top-2 h-[calc(100%-1rem)] w-1" viewBox="0 0 2 100" preserveAspectRatio="none" aria-hidden="true">
          <line className="bl-line" x1="1" y1="0" x2="1" y2="100" stroke="var(--blue)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="flex flex-col gap-6">
          {log.map((e) => (
            <div key={e.date + e.title} className="bl-item relative">
              <span className="bl-dot absolute -left-[2.05rem] top-5 h-3 w-3 rounded-full" style={{ background: 'var(--blue)', boxShadow: '0 0 0 4px rgba(45,123,255,.25)' }} />
              <div className="card grid gap-2 p-5 md:grid-cols-[120px_1fr]">
                <div className="mono text-xs tracking-[0.2em]" style={{ color: 'var(--blue-glow)' }}>
                  {e.date}
                </div>
                <div>
                  <div className="display text-lg font-bold">{e.title}</div>
                  <div className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
                    {e.text}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// D7 — next machine peeks in
function NextMachine({ meta, mod }) {
  const ref = useRef(null);
  const state = useMemo(() => (mod ? mod.createState() : null), [mod]);
  useGSAP(
    () => {
      gsap.from(ref.current, { x: 80, opacity: 0, duration: 1, scrollTrigger: { trigger: ref.current, start: 'top 85%', once: true } });
    },
    { scope: ref },
  );
  return (
    <section className="section pt-0">
      <TLink to={`/robotics/${meta.slug}`} ref={ref} className="card card-glow group grid items-center gap-6 p-6 md:grid-cols-[1fr_320px]" data-cursor="view">
        <div>
          <div className="mono text-[10px] tracking-[0.25em]" style={{ color: 'var(--muted)' }}>
            NEXT MACHINE
          </div>
          <div className="display mt-2 text-3xl font-bold">{meta.name}</div>
          <div className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
            {meta.oneLiner}
          </div>
          <div className="mt-4 inline-flex items-center gap-2 text-sm" style={{ color: 'var(--blue-glow)' }}>
            Open <span className="transition-transform group-hover:translate-x-1">→</span>
          </div>
        </div>
        <div className="h-56">
          {mod && state ? (
            <MiniView className="h-full w-full" spin={0.5}>
              <mod.Model state={state} mode="mini" />
            </MiniView>
          ) : (
            <div className="h-full w-full rounded-xl" style={{ background: 'rgba(45,123,255,.06)' }} />
          )}
        </div>
      </TLink>
    </section>
  );
}
