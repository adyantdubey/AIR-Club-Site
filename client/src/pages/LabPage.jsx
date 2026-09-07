import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useGSAP } from '@gsap/react';
import { animate, stagger } from 'animejs';
import { gsap } from '../lib/gsap';
import { splitText } from '../lib/split';
import { useStore } from '../lib/store';
import { isMobile } from '../lib/motion';
import { loadLab, labMeta, nextLab, LABS } from '../labs';
import { TLink } from '../transitions/PageWipe';
import { Btn } from '../components/ui/Controls';
import Breadcrumb from '../components/ui/Breadcrumb';
import NotFound from './NotFound';

export default function LabPage() {
  const { slug } = useParams();
  const [mod, setMod] = useState(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    let alive = true;
    setMod(null);
    setMissing(false);
    loadLab(slug)
      .then((m) => alive && setMod(m))
      .catch(() => alive && setMissing(true));
    return () => {
      alive = false;
    };
  }, [slug]);
  if (missing || !labMeta(slug)) return <NotFound />;
  if (!mod) return <Loading />;
  return <LabView key={slug} lab={mod} next={nextLab(slug)} index={LABS.findIndex((l) => l.slug === slug)} />;
}

function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-24 w-24 animate-pulse rounded-full border-2" style={{ borderColor: 'var(--blue)' }} />
    </div>
  );
}

function LabView({ lab, next, index }) {
  const state = useMemo(() => lab.createState(), [lab]);
  const controls = useRef(null);
  const root = useRef(null);
  const [explain, setExplain] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const mobile = isMobile();
  const { Scene, Panel } = lab;

  useGSAP(
    () => {
      const chars = splitText(root.current.querySelector('.l-name'), 'chars');
      gsap.from(chars, { yPercent: 110, opacity: 0, stagger: 0.03, duration: 0.9, ease: 'expo.out', delay: 0.2 });
      gsap.from('.l-intro > *', { y: 16, opacity: 0, stagger: 0.08, duration: 0.7, delay: 0.5 });
      gsap.from('.l-panel', { x: -30, opacity: 0, duration: 0.8, delay: 0.7 });
      gsap.from('.l-canvas', { opacity: 0, scale: 0.98, duration: 1, delay: 0.6 });
      animate('.pip', { scaleY: [0, 1], delay: stagger(80, { start: 800 }), duration: 400, ease: 'outBack(1.6)' });
    },
    { scope: root, dependencies: [lab] },
  );

  return (
    <article ref={root} className="pt-24 md:pt-28">
      {/* header */}
      <header className="px-[var(--pad-x)]">
        <Breadcrumb parts={['AI Lab', lab.name]} />
        <div className="mt-3 flex flex-wrap items-end justify-between gap-6">
          <div>
            <h1 className="l-name display text-[clamp(2rem,4.6vw,3.8rem)] font-bold leading-[1.02]">{lab.name}</h1>
            <div className="l-intro mt-3 flex flex-wrap items-center gap-4">
              <p className="max-w-[560px] text-base leading-relaxed" style={{ color: 'var(--muted)' }}>
                {lab.oneLiner}
              </p>
              <Pips n={lab.difficulty} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="mono text-[10px] tracking-[0.25em]" style={{ color: 'var(--muted)' }}>
              {String(index + 1).padStart(2, '0')} / {String(LABS.length).padStart(2, '0')}
            </span>
            <Btn small onClick={() => state.reset()}>
              Reset
            </Btn>
            <Btn small primary onClick={() => setExplain(true)}>
              Explain
            </Btn>
          </div>
        </div>
      </header>

      {/* lab body */}
      <div className={`mt-8 px-[var(--pad-x)] ${mobile ? 'flex flex-col gap-4' : 'grid gap-6 lg:grid-cols-[320px_1fr]'}`}>
        {!mobile && (
          <aside className="l-panel panel self-start lg:sticky lg:top-24" style={{ maxHeight: 'calc(100vh - 7rem)', overflowY: 'auto' }}>
            <Panel state={state} />
            <Challenges lab={lab} state={state} />
          </aside>
        )}

        <div className="l-canvas relative overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--line)', height: mobile ? '62vh' : 'calc(100vh - 7rem)', background: 'rgba(11,16,32,.35)' }}>
          <Canvas dpr={[1, 1.5]} camera={{ position: lab.cameraPos || [0, 3, 7], fov: 40, near: 0.05, far: 200 }} gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}>
            <ambientLight intensity={0.5} />
            <pointLight position={[4, 6, 4]} intensity={40} color="#6eb2ff" />
            <pointLight position={[-5, 3, -3]} intensity={16} />
            {lab.orbit !== false && <OrbitControls ref={controls} makeDefault enablePan={false} enableDamping dampingFactor={0.08} maxDistance={30} />}
            <Suspense fallback={null}>
              <Scene state={state} controlsRef={controls} />
            </Suspense>
          </Canvas>
          <StatusLine lab={lab} state={state} />
        </div>

        {mobile && (
          <div className="panel">
            <button className="mono flex w-full items-center justify-between text-[10px] tracking-[0.25em]" style={{ color: 'var(--blue-glow)' }} onClick={() => setPanelOpen((v) => !v)}>
              CONTROLS <span>{panelOpen ? '−' : '+'}</span>
            </button>
            {panelOpen && (
              <>
                <Panel state={state} />
                <Challenges lab={lab} state={state} />
              </>
            )}
          </div>
        )}
      </div>

      {/* explain overlay */}
      {explain && <Explain lab={lab} onClose={() => setExplain(false)} />}

      {/* next lab */}
      {next && (
        <section className="section">
          <TLink to={`/ai/${next.slug}`} className="card card-glow group flex items-center justify-between gap-6 p-6" data-cursor="view">
            <div>
              <div className="mono text-[10px] tracking-[0.25em]" style={{ color: 'var(--muted)' }}>
                NEXT LAB
              </div>
              <div className="display mt-2 text-3xl font-bold">{next.name}</div>
              <div className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
                {next.oneLiner}
              </div>
            </div>
            <span className="display text-4xl transition-transform group-hover:translate-x-2" style={{ color: 'var(--blue)' }}>
              →
            </span>
          </TLink>
        </section>
      )}
    </article>
  );
}

function Pips({ n }) {
  return (
    <span className="flex items-end gap-1" aria-label={`difficulty ${n} of 3`}>
      {[1, 2, 3].map((i) => (
        <span key={i} className="pip block w-1.5 origin-bottom rounded-sm" style={{ height: 6 + i * 4, background: i <= n ? 'var(--blue)' : 'rgba(110,178,255,.2)' }} />
      ))}
      <span className="mono ml-2 text-[10px] tracking-[0.2em]" style={{ color: 'var(--muted)' }}>
        {['', 'INTRO', 'CORE', 'ADVANCED'][n]}
      </span>
    </span>
  );
}

function StatusLine({ lab, state }) {
  const s = useStore(state);
  let text = '';
  try {
    text = lab.statusLine ? lab.statusLine(s) : '';
  } catch {
    text = '';
  }
  return (
    <div className="mono pointer-events-none absolute bottom-3 left-4 right-4 flex items-center gap-3 text-[10px] tracking-[0.2em]" style={{ color: 'var(--blue-glow)' }}>
      <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: 'var(--blue)' }} />
      <span className="truncate">{text}</span>
    </div>
  );
}

function Challenges({ lab, state }) {
  const s = useStore(state);
  let done = [];
  try {
    done = lab.challengeCheck ? lab.challengeCheck(s) : [];
  } catch {
    done = [];
  }
  return (
    <div className="mt-2 border-t pt-3" style={{ borderColor: 'var(--line)' }}>
      <div className="mono mb-2 text-[10px] tracking-[0.25em]" style={{ color: 'var(--blue-glow)' }}>
        TRY THIS
      </div>
      <ul className="flex flex-col gap-2">
        {lab.challenges.map((c, i) => (
          <li key={c} className="flex items-start gap-2 text-xs leading-relaxed" style={{ color: done[i] ? 'var(--fg)' : 'var(--muted)' }}>
            <span
              className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] transition-colors"
              style={{ borderColor: done[i] ? 'var(--blue)' : 'var(--line)', background: done[i] ? 'var(--blue)' : 'transparent', color: '#fff' }}
            >
              {done[i] ? '✓' : ''}
            </span>
            {c}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Explain({ lab, onClose }) {
  const ref = useRef(null);
  useGSAP(
    () => {
      gsap.from(ref.current, { opacity: 0, duration: 0.3 });
      gsap.from('.ex-card', { y: 40, opacity: 0, duration: 0.6, ease: 'expo.out' });
      gsap.from('.ex-block', { y: 16, opacity: 0, stagger: 0.08, duration: 0.5, delay: 0.2 });
    },
    { scope: ref },
  );
  return (
    <div ref={ref} className="fixed inset-0 z-[85] flex items-center justify-center p-6" style={{ background: 'rgba(5,8,16,.7)', backdropFilter: 'blur(8px)' }} onClick={onClose}>
      <div className="ex-card card max-h-[85vh] w-full max-w-[720px] overflow-auto p-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="mono text-[10px] tracking-[0.25em]" style={{ color: 'var(--blue-glow)' }}>
              EXPLAIN · {lab.tag}
            </div>
            <h2 className="display mt-2 text-3xl font-bold">{lab.name}</h2>
          </div>
          <Btn small onClick={onClose}>
            Close
          </Btn>
        </div>
        <p className="mt-4 text-base leading-relaxed" style={{ color: 'var(--muted)' }}>
          {lab.blurb}
        </p>
        <div className="mt-6 flex flex-col gap-5">
          {lab.explain.map((b) => (
            <div key={b.title} className="ex-block">
              <div className="display text-lg font-bold">{b.title}</div>
              <p className="mt-1 text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
                {b.text}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
