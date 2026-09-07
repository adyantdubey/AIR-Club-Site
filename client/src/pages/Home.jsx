import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGSAP } from '@gsap/react';
import { animate, svg, stagger } from 'animejs';
import { gsap, ScrollTrigger } from '../lib/gsap';
import { roverStore } from '../lib/roverStore';
import { isMobile } from '../lib/motion';
import { useReady } from '../components/ui/Layout';
import { useWipeNavigate, TLink } from '../transitions/PageWipe';
import { MACHINES, loadAllMachines } from '../machines';
import { FitGroup } from '../three/MiniView';
import NeuralTunnel from '../three/NeuralTunnel';
import { useCounter } from '../hooks/useCounter';
import RoverScene from '../components/three/RoverScene';
import Hero from '../components/sections/Hero';
import Contact from '../components/sections/Contact';
import { upcoming } from '../data/events';

export default function Home() {
  const ready = useReady();
  useEffect(() => {
    // fresh store every time Home mounts
    Object.assign(roverStore, { hero: 0, about: 0, hidden: 0, contact: 0, footer: 0 });
    if (ready) roverStore.assembled = 1;
  }, [ready]);
  return (
    <>
      <RoverScene />
      <Hero ready={ready} />
      <Showroom />
      <AiPortal />
      <Numbers />
      <Latest />
      <Contact />
    </>
  );
}

/* ---------------- HM1 / HM2 — the showroom ---------------- */
function Showroom() {
  const root = useRef(null);
  const wrap = useRef(null);
  const prog = useRef(0);
  const entered = useRef(0);
  const [mods, setMods] = useState(null);
  const [hovered, setHovered] = useState(null);
  const go = useWipeNavigate();
  const mobile = isMobile();

  useEffect(() => {
    let alive = true;
    loadAllMachines().then((m) => alive && setMods(m));
    return () => {
      alive = false;
    };
  }, []);
  const states = useMemo(() => (mods ? mods.map((m) => (m ? m.createState() : null)) : null), [mods]);

  useGSAP(
    () => {
      // rover from the hero shrinks away as the showroom arrives
      ScrollTrigger.create({
        trigger: root.current,
        start: 'top 80%',
        end: 'top 20%',
        scrub: true,
        onUpdate: (self) => {
          roverStore.hidden = self.progress;
        },
      });
      // camera pans along the row while pinned
      ScrollTrigger.create({
        trigger: wrap.current,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 0.5,
        onUpdate: (self) => {
          prog.current = self.progress;
        },
      });
      // fly-in
      ScrollTrigger.create({
        trigger: root.current,
        start: 'top 70%',
        once: true,
        onEnter: () => gsap.to(entered, { current: 1, duration: 2.2, ease: 'expo.out' }),
      });
      gsap.from('.sr-title', { yPercent: 30, opacity: 0, duration: 1, scrollTrigger: { trigger: root.current, start: 'top 70%', once: true } });
    },
    { scope: root },
  );

  const h = hovered != null ? MACHINES[hovered] : null;

  return (
    <section id="showroom" ref={root} className="relative" style={{ zIndex: 2 }}>
      <div ref={wrap} className="relative" style={{ height: mobile ? '100vh' : '260vh' }}>
        <div className="sticky top-0 h-screen w-full overflow-hidden">
          <div className="absolute inset-0">
            <Canvas dpr={[1, 1.5]} camera={{ position: [0, 1.4, 7], fov: 38 }} gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}>
              <ambientLight intensity={0.45} />
              <pointLight position={[4, 6, 4]} intensity={40} color="#6eb2ff" />
              <pointLight position={[-5, 3, -3]} intensity={14} />
              <Suspense fallback={null}>
                <Row mods={mods} states={states} prog={prog} entered={entered} onHover={setHovered} onOpen={(i) => go(`/robotics/${MACHINES[i].slug}`)} mobile={mobile} />
              </Suspense>
            </Canvas>
          </div>
          <div className="pointer-events-none absolute left-[var(--pad-x)] top-24 md:top-28">
            <div className="mono text-xs uppercase tracking-[0.22em]" style={{ color: 'var(--blue-glow)' }}>
              01 — Robotics
            </div>
            <h2 className="sr-title display mt-2 text-[clamp(2.2rem,6vw,5rem)] font-bold leading-[1.02]">
              8 MACHINES.
              <br />
              ONE LAB.
            </h2>
          </div>
          <div className="pointer-events-none absolute bottom-10 left-[var(--pad-x)] right-[var(--pad-x)] flex flex-wrap items-end justify-between gap-6">
            <div className="min-h-[64px]">
              <div className="mono text-[10px] tracking-[0.25em]" style={{ color: 'var(--muted)' }}>
                {h ? h.tag : 'HOVER A MACHINE'}
              </div>
              <div className="display mt-1 text-2xl font-bold md:text-3xl" style={{ opacity: h ? 1 : 0.35 }}>
                {h ? h.name : 'Scroll to pan the showroom'}
              </div>
            </div>
            <TLink to="/robotics" className="btn pointer-events-auto text-xs" style={{ padding: '0.7rem 1.2rem' }}>
              <span className="btn-fill" />
              Enter the robotics hub →
            </TLink>
          </div>
        </div>
      </div>
    </section>
  );
}

function Row({ mods, states, prog, entered, onHover, onOpen, mobile }) {
  const groups = useRef([]);
  const spacing = mobile ? 2.4 : 2.9;
  const n = MACHINES.length;
  const total = (n - 1) * spacing;
  const hover = useRef(-1);
  useFrame((st, dt) => {
    const cam = st.camera;
    const x = mobile ? total / 2 : prog.current * total;
    cam.position.x += (x - cam.position.x) * (1 - Math.exp(-6 * dt));
    cam.lookAt(cam.position.x, 0.8, 0);
    groups.current.forEach((g, i) => {
      if (!g) return;
      const e = Math.min(1, Math.max(0, entered.current * 1.6 - i * 0.09));
      const ease = 1 - Math.pow(1 - e, 3);
      const lift = hover.current === i ? 0.35 : 0;
      g.position.x = i * spacing + (1 - ease) * 9;
      g.position.y += (lift - g.position.y) * (1 - Math.exp(-8 * dt));
      g.rotation.y += dt * (hover.current === i ? 0.9 : 0.25);
    });
  });
  return (
    <group>
      {MACHINES.map((m, i) => {
        const mod = mods?.[i];
        return (
          <group
            key={m.slug}
            ref={(el) => (groups.current[i] = el)}
            position={[i * spacing + 9, 0, 0]}
            onPointerOver={(e) => {
              e.stopPropagation();
              hover.current = i;
              onHover(i);
              document.body.style.cursor = 'pointer';
            }}
            onPointerOut={() => {
              hover.current = -1;
              onHover(null);
              document.body.style.cursor = '';
            }}
            onClick={() => onOpen(i)}
          >
            {mod && states?.[i] ? (
              <FitGroup fit={1.8}>
                <mod.Model state={states[i]} mode="mini" />
              </FitGroup>
            ) : (
              <mesh position={[0, 0.9, 0]}>
                <boxGeometry args={[1.2, 1.2, 1.2]} />
                <meshBasicMaterial color="#2d7bff" wireframe transparent opacity={0.3} />
              </mesh>
            )}
            <mesh rotation-x={-Math.PI / 2} position={[0, 0.004, 0]}>
              <ringGeometry args={[1.05, 1.09, 48]} />
              <meshBasicMaterial color="#2d7bff" transparent opacity={0.45} toneMapped={false} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/* ---------------- HM3 / HM4 — AI portal: fly through a network ---------------- */
function AiPortal() {
  const root = useRef(null);
  const wrap = useRef(null);
  const prog = useRef(0);
  const mobile = isMobile();
  useGSAP(
    () => {
      ScrollTrigger.create({
        trigger: wrap.current,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 0.6,
        onUpdate: (self) => {
          prog.current = self.progress;
          gsap.set('.ai-text', { opacity: 1 - Math.min(1, self.progress * 1.8), y: -self.progress * 60 });
          gsap.set('.ai-cta', { opacity: Math.max(0, (self.progress - 0.6) * 2.5), y: (1 - self.progress) * 40 });
        },
      });
      gsap.from('.ai-title', { yPercent: 30, opacity: 0, duration: 1, scrollTrigger: { trigger: root.current, start: 'top 70%', once: true } });
    },
    { scope: root },
  );
  return (
    <section ref={root} className="relative" style={{ zIndex: 2 }}>
      <div ref={wrap} className="relative" style={{ height: mobile ? '120vh' : '260vh' }}>
        <div className="sticky top-0 h-screen w-full overflow-hidden" style={{ background: 'linear-gradient(180deg, rgba(5,8,16,0) 0%, rgba(11,20,50,.6) 50%, rgba(5,8,16,0) 100%)' }}>
          <div className="absolute inset-0">
            <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0, -2.5], fov: 60, near: 0.1, far: 80 }} gl={{ antialias: true, alpha: true }}>
              <Suspense fallback={null}>
                <NeuralTunnel progressRef={prog} pointer={!mobile} />
              </Suspense>
            </Canvas>
          </div>
          <div className="ai-text pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <div className="mono text-xs uppercase tracking-[0.22em]" style={{ color: 'var(--blue-glow)' }}>
              02 — AI Lab
            </div>
            <h2 className="ai-title display mt-3 text-[clamp(2.2rem,7vw,6rem)] font-bold leading-[1.02]" style={{ textShadow: '0 0 40px rgba(45,123,255,.35)' }}>
              MODELS YOU
              <br />
              CAN TOUCH.
            </h2>
            <p className="mt-4 max-w-[460px] text-base" style={{ color: 'var(--muted)' }}>
              Neural nets, transformers, SVMs — trained live in your browser. Scroll to fly through one.
            </p>
          </div>
          <div className="ai-cta pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center opacity-0">
            <div className="display text-3xl font-bold md:text-5xl">You just flew through a 154-neuron network.</div>
            <TLink to="/ai" className="btn solid pointer-events-auto mt-8">
              <span className="btn-fill" />
              Enter the AI lab →
            </TLink>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------- HM5 — numbers band ---------------- */
const NUMS = [
  { v: 8, suffix: '', label: 'machines built', icon: 'M4 16h16M7 16v-4h10v4M8 20a2 2 0 1 0 0-4a2 2 0 1 0 0 4M16 20a2 2 0 1 0 0-4a2 2 0 1 0 0 4' },
  { v: 8, suffix: '', label: 'models in the lab', icon: 'M5 8a2 2 0 1 0 4 0a2 2 0 1 0-4 0M5 16a2 2 0 1 0 4 0a2 2 0 1 0-4 0M15 12a2 2 0 1 0 4 0a2 2 0 1 0-4 0M9 8l6 4M9 16l6-4' },
  { v: 40, suffix: '+', label: 'members', icon: 'M8 10a3 3 0 1 0 6 0a3 3 0 1 0-6 0M3 20c1-4 4-6 8-6s7 2 8 6M16 6a2 2 0 1 0 4 0a2 2 0 1 0-4 0' },
  { v: 6, suffix: '', label: 'competitions', icon: 'M8 4h8v6a4 4 0 0 1-8 0zM6 6H3v2a3 3 0 0 0 3 3M18 6h3v2a3 3 0 0 1-3 3M12 14v4M9 20h6' },
];
function Numbers() {
  const root = useRef(null);
  useGSAP(
    () => {
      ScrollTrigger.create({
        trigger: root.current,
        start: 'top 80%',
        once: true,
        onEnter: () => {
          animate(svg.createDrawable('.num-icon path'), { draw: ['0 0', '0 1'], duration: 1200, delay: stagger(150), ease: 'inOutSine' });
          gsap.from('.num', { y: 30, opacity: 0, stagger: 0.12, duration: 0.8 });
        },
      });
    },
    { scope: root },
  );
  return (
    <section ref={root} className="section pb-0">
      <div className="grid gap-4 border-y py-10 sm:grid-cols-2 lg:grid-cols-4" style={{ borderColor: 'var(--line)' }}>
        {NUMS.map((n) => (
          <Num key={n.label} {...n} />
        ))}
      </div>
    </section>
  );
}
function Num({ v, suffix, label, icon }) {
  const ref = useRef(null);
  useCounter(ref, v, { suffix });
  return (
    <div className="num flex items-center gap-5">
      <svg className="num-icon h-10 w-10 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d={icon} stroke="var(--blue-glow)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div>
        <div ref={ref} className="display text-4xl font-bold">
          0
        </div>
        <div className="mono mt-1 text-[10px] uppercase tracking-[0.22em]" style={{ color: 'var(--muted)' }}>
          {label}
        </div>
      </div>
    </div>
  );
}

/* ---------------- HM6 — latest strip ---------------- */
function Latest() {
  const root = useRef(null);
  useGSAP(
    () => {
      gsap.from('.latest-card', { y: 40, opacity: 0, stagger: 0.12, duration: 0.9, scrollTrigger: { trigger: root.current, start: 'top 80%', once: true } });
    },
    { scope: root },
  );
  const ev = upcoming[0];
  const d = new Date(ev.date);
  return (
    <section ref={root} className="section">
      <div className="grid gap-5 md:grid-cols-3">
        <TLink to="/events" className="latest-card card card-glow group p-6" data-cursor="view">
          <div className="mono text-[10px] tracking-[0.25em]" style={{ color: 'var(--blue-glow)' }}>
            NEXT EVENT
          </div>
          <div className="display mt-3 text-2xl font-bold">{ev.title}</div>
          <div className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
            {d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })} · {ev.where}
          </div>
          <div className="mt-6 text-sm" style={{ color: 'var(--blue-glow)' }}>
            All events <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
          </div>
        </TLink>
        <TLink to="/robotics/rover" className="latest-card card card-glow group p-6" data-cursor="view">
          <div className="mono text-[10px] tracking-[0.25em]" style={{ color: 'var(--blue-glow)' }}>
            LATEST BUILD
          </div>
          <div className="display mt-3 text-2xl font-bold">IRC 2027 Rover — autonomous lap</div>
          <div className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
            First fully autonomous loop of the test track. Drive it yourself on the rover page.
          </div>
          <div className="mt-6 text-sm" style={{ color: 'var(--blue-glow)' }}>
            Open rover <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
          </div>
        </TLink>
        <TLink to="/contact" className="latest-card card card-glow group p-6" data-cursor="view" style={{ background: 'linear-gradient(160deg, rgba(45,123,255,.25), rgba(5,8,16,.9))' }}>
          <div className="mono text-[10px] tracking-[0.25em]" style={{ color: 'var(--blue-glow)' }}>
            JOIN
          </div>
          <div className="display mt-3 text-2xl font-bold">No experience needed.</div>
          <div className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
            Open to every branch and year. Bring curiosity — we bring the soldering irons.
          </div>
          <div className="mt-6 text-sm" style={{ color: 'var(--fg)' }}>
            Join the club <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
          </div>
        </TLink>
      </div>
    </section>
  );
}
