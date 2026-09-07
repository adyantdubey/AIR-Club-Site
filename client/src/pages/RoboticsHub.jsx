import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGSAP } from '@gsap/react';
import { gsap, Flip } from '../lib/gsap';
import { isMobile } from '../lib/motion';
import { MACHINES, CATEGORIES, loadAllMachines } from '../machines';
import { MiniView, FitGroup } from '../three/MiniView';
import { TLink } from '../transitions/PageWipe';
import SectionHeading from '../components/ui/SectionHeading';
import Breadcrumb from '../components/ui/Breadcrumb';
import { useInView } from '../hooks/useInView';

export default function RoboticsHub() {
  const [mods, setMods] = useState(null);
  useEffect(() => {
    let alive = true;
    loadAllMachines().then((m) => alive && setMods(m));
    return () => {
      alive = false;
    };
  }, []);
  const states = useMemo(() => (mods ? mods.map((m) => (m ? m.createState() : null)) : null), [mods]);

  return (
    <>
      <OrbitHero mods={mods} states={states} />
      <Grid mods={mods} states={states} />
    </>
  );
}

/* ---------------- R1 — orbit hero ---------------- */
function OrbitHero({ mods, states }) {
  const root = useRef(null);
  const [front, setFront] = useState(0);
  const spin = useRef({ angle: 0, vel: 0.12, dragging: false, lastX: 0 });
  const mobile = isMobile();

  useGSAP(
    () => {
      gsap.from('.oh-title', { yPercent: 40, opacity: 0, duration: 1.2, ease: 'expo.out', delay: 0.3 });
      gsap.from('.oh-sub > *', { y: 20, opacity: 0, stagger: 0.1, duration: 0.8, delay: 0.7 });
    },
    { scope: root },
  );

  const onDown = (e) => {
    spin.current.dragging = true;
    spin.current.lastX = e.clientX;
  };
  const onMove = (e) => {
    const s = spin.current;
    if (!s.dragging) return;
    const dx = e.clientX - s.lastX;
    s.lastX = e.clientX;
    s.vel = dx * 0.012;
  };
  const onUp = () => (spin.current.dragging = false);

  const meta = MACHINES[front];

  return (
    <section ref={root} className="relative h-screen overflow-hidden" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp} style={{ cursor: 'grab' }}>
      <div className="oh-title display pointer-events-none absolute left-1/2 top-[14%] -translate-x-1/2 whitespace-nowrap text-[clamp(3.5rem,14vw,12rem)] font-bold leading-none" style={{ color: 'rgba(245,247,255,.08)', letterSpacing: '-0.03em' }}>
        ROBOTICS
      </div>
      <div className="absolute inset-0">
        <Canvas dpr={[1, 1.5]} camera={{ position: [0, 1.6, 7.5], fov: 40 }} gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}>
          <ambientLight intensity={0.45} />
          <pointLight position={[4, 6, 4]} intensity={40} color="#6eb2ff" />
          <pointLight position={[-5, 3, -3]} intensity={14} />
          <Suspense fallback={null}>
            <Ring mods={mods} states={states} spin={spin} onFront={setFront} mobile={mobile} />
          </Suspense>
        </Canvas>
      </div>

      <div className="pointer-events-none absolute left-[var(--pad-x)] top-28 md:top-32">
        <Breadcrumb parts={['Robotics', 'Hub']} />
      </div>

      <div className="oh-sub pointer-events-none absolute bottom-10 left-[var(--pad-x)] right-[var(--pad-x)] flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="mono text-[10px] tracking-[0.25em]" style={{ color: 'var(--muted)' }}>
            FRONT · {String(front + 1).padStart(2, '0')} / 08
          </div>
          <div className="display mt-1 text-3xl font-bold md:text-4xl">{meta?.name}</div>
          <div className="mt-1 max-w-[420px] text-sm" style={{ color: 'var(--muted)' }}>
            {meta?.oneLiner}
          </div>
          <TLink to={`/robotics/${meta?.slug}`} className="btn pointer-events-auto mt-4 text-xs" style={{ padding: '0.6rem 1.1rem' }}>
            <span className="btn-fill" />
            Open {meta?.name} →
          </TLink>
        </div>
        <div className="mono text-[10px] tracking-[0.25em]" style={{ color: 'var(--muted)' }}>
          DRAG TO SPIN THE RING
        </div>
      </div>
    </section>
  );
}

function Ring({ mods, states, spin, onFront, mobile }) {
  const group = useRef();
  const lastFront = useRef(-1);
  const R = mobile ? 2.6 : 3.4;
  const n = MACHINES.length;
  useFrame((st, dt) => {
    const s = spin.current;
    if (!s.dragging) {
      s.vel += (0.12 - s.vel) * (1 - Math.exp(-0.8 * dt));
    }
    s.angle += s.vel * dt * (s.dragging ? 60 : 1);
    if (s.dragging) s.vel *= 0.85;
    if (!group.current) return;
    group.current.rotation.y = s.angle;
    // which one is nearest the camera (+Z)?
    let best = 0;
    let bestZ = -1e9;
    group.current.children.forEach((c, i) => {
      const z = Math.sin(s.angle + (i / n) * Math.PI * 2) * R;
      if (z > bestZ) {
        bestZ = z;
        best = i;
      }
      const t = (z / R + 1) / 2; // 0 back, 1 front
      const sc = 0.55 + t * 0.6;
      c.scale.setScalar(sc + (c.scale.x - sc) * Math.exp(-6 * dt));
    });
    if (best !== lastFront.current) {
      lastFront.current = best;
      onFront(best);
    }
  });
  return (
    <group ref={group} position={[0, -0.6, 0]}>
      {MACHINES.map((m, i) => {
        const a = (i / n) * Math.PI * 2;
        const mod = mods?.[i];
        return (
          <group key={m.slug} position={[Math.cos(a) * R, 0, Math.sin(a) * R]} rotation-y={-a + Math.PI / 2}>
            <group>
              {mod && states?.[i] ? (
                <FitGroup fit={1.9}>
                  <mod.Model state={states[i]} mode="mini" />
                </FitGroup>
              ) : (
                <mesh position={[0, 0.9, 0]}>
                  <boxGeometry args={[1.4, 1.4, 1.4]} />
                  <meshBasicMaterial color="#2d7bff" wireframe transparent opacity={0.3} />
                </mesh>
              )}
            </group>
            <mesh rotation-x={-Math.PI / 2} position={[0, 0.005, 0]}>
              <ringGeometry args={[1.0, 1.04, 48]} />
              <meshBasicMaterial color="#2d7bff" transparent opacity={0.4} toneMapped={false} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/* ---------------- R2 / R3 — grid with live minis + Flip filter ---------------- */
function Grid({ mods, states }) {
  const root = useRef(null);
  const grid = useRef(null);
  const [filter, setFilter] = useState('all');

  // Same as the AI hub: reveal on intersection, never re-run when the 3D previews load.
  const gridIn = useInView(grid, 0.12);
  const revealed = useRef(false);
  useEffect(() => {
    if (!gridIn || revealed.current || !grid.current) return;
    revealed.current = true;
    gsap.to(grid.current.querySelectorAll('.r-card'), { opacity: 1, y: 0, stagger: 0.08, duration: 0.9, ease: 'power3.out', overwrite: 'auto' });
  }, [gridIn]);

  // Failsafe: if the observer never fires (odd browser, page restored from bfcache),
  // show the cards anyway rather than leaving unreadable text on screen.
  useEffect(() => {
    const t = setTimeout(() => {
      if (!revealed.current && grid.current) {
        revealed.current = true;
        gsap.set(grid.current.querySelectorAll('.r-card'), { opacity: 1, y: 0 });
      }
    }, 2500);
    return () => clearTimeout(t);
  }, []);

  const pick = (key) => {
    if (key === filter) return;
    const cards = gsap.utils.toArray('.r-card', grid.current);
    const state = Flip.getState(cards);
    setFilter(key);
    requestAnimationFrame(() =>
      Flip.from(state, {
        duration: 0.7,
        ease: 'power3.inOut',
        stagger: 0.03,
        absolute: true,
        onEnter: (els) => gsap.fromTo(els, { opacity: 0, scale: 0.85 }, { opacity: 1, scale: 1, duration: 0.5 }),
        onLeave: (els) => gsap.to(els, { opacity: 0, scale: 0.85, duration: 0.4 }),
      }),
    );
  };

  return (
    <section ref={root} className="section">
      <SectionHeading eyebrow="All machines">Eight machines. One lab.</SectionHeading>
      <div className="mb-8 flex flex-wrap gap-2">
        {CATEGORIES.map(([k, l]) => (
          <button key={k} onClick={() => pick(k)} className="chip transition-colors" style={filter === k ? { background: 'var(--blue)', color: '#fff', borderColor: 'var(--blue)' } : undefined}>
            {l}
          </button>
        ))}
      </div>
      <div ref={grid} className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {MACHINES.map((m, i) => (
          <MachineCard key={m.slug} meta={m} mod={mods?.[i]} state={states?.[i]} hidden={filter !== 'all' && m.category !== filter} index={i} />
        ))}
      </div>
    </section>
  );
}

function MachineCard({ meta, mod, state, hidden, index }) {
  const [hover, setHover] = useState(false);
  const spec = mod?.specs?.slice(0, 2) || [];
  return (
    <TLink
      to={`/robotics/${meta.slug}`}
      data-flip-id={meta.slug}
      data-cursor="view"
      className={`r-card reveal card card-glow group flex flex-col ${hidden ? 'hidden' : ''}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className="relative h-52 w-full">
        {mod && state ? (
          <MiniView className="h-full w-full" spin={hover ? 1.4 : 0.35} fit={2.1}>
            <mod.Model state={state} mode="mini" />
          </MiniView>
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="h-10 w-10 animate-pulse rounded-full border" style={{ borderColor: 'var(--blue)' }} />
          </div>
        )}
        <span className="mono absolute left-4 top-4 text-[10px] tracking-[0.25em]" style={{ color: 'var(--blue-glow)' }}>
          {meta.tag}
        </span>
        <span className="display absolute right-4 top-3 text-3xl font-bold" style={{ color: 'rgba(110,178,255,.15)' }}>
          {String(index + 1).padStart(2, '0')}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-5">
        <div className="display text-xl font-bold">{meta.name}</div>
        <div className="text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
          {meta.oneLiner}
        </div>
        <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 pt-2">
          {spec.map(([k, v]) => (
            <span key={k} className="mono text-[10px] tracking-[0.15em]" style={{ color: 'var(--muted)' }}>
              {k.toUpperCase()} <span style={{ color: 'var(--blue-glow)' }}>{v}</span>
            </span>
          ))}
        </div>
      </div>
    </TLink>
  );
}
