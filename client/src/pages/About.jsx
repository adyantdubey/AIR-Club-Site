import { Suspense, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { useGSAP } from '@gsap/react';
import { animate, stagger } from 'animejs';
import { gsap, ScrollTrigger } from '../lib/gsap';
import { useInView } from '../hooks/useInView';
import { useCounter } from '../hooks/useCounter';
import { Wire, Led } from '../three/wire';
import AboutSection from '../components/sections/About';
import SectionHeading from '../components/ui/SectionHeading';
import Breadcrumb from '../components/ui/Breadcrumb';
import { useTable, useSettings } from '../lib/useData';
import { CLUB } from '../data/oldSite';
import { useContent } from '../lib/content';

export default function About() {
  return (
    <>
      <div className="px-[var(--pad-x)] pt-28 md:pt-32">
        <Breadcrumb parts={['About']} />
      </div>
      <AboutSection />
      <MissionVision />
      <Activities />
      <LabTour />
      <Achievements />
      <Week />
      <Faculty />
      <Sponsors />
    </>
  );
}

/* ---------------- Lab tour: isometric 3D map ---------------- */
// Where each spot sits on the 3D map (fixed). Names and descriptions come from Admin → Page content.
const SPOT_POS = { bench: [-2.2, 0, -1.2], printer: [2.3, 0, -1.4], track: [0, 0, 1.4], rack: [-2.4, 0, 1.6], cage: [2.5, 0, 1.4] };

function LabTour() {
  const root = useRef(null);
  const SPOTS = useContent('lab').filter((x) => SPOT_POS[x.id]);
  const [active, setActive] = useState('track');
  useGSAP(
    () => {
      gsap.from('.tour-canvas', { opacity: 0, y: 40, duration: 1, scrollTrigger: { trigger: root.current, start: 'top 75%', once: true } });
      gsap.from('.tour-item', { x: 30, opacity: 0, stagger: 0.08, duration: 0.7, scrollTrigger: { trigger: root.current, start: 'top 75%', once: true } });
    },
    { scope: root },
  );
  const spot = SPOTS.find((s) => s.id === active);
  return (
    <section ref={root} className="section">
      <SectionHeading eyebrow="02 — The lab">Where the machines get built.</SectionHeading>
      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <div className="tour-canvas card h-[460px] overflow-hidden">
          <Canvas dpr={[1, 1.5]} camera={{ position: [6.5, 6.5, 6.5], fov: 30 }} gl={{ antialias: true, alpha: true }}>
            <ambientLight intensity={0.5} />
            <pointLight position={[4, 6, 4]} intensity={40} color="#6eb2ff" />
            <pointLight position={[-4, 4, -2]} intensity={16} />
            <Suspense fallback={null}>
              <LabMap active={active} onPick={setActive} names={Object.fromEntries(SPOTS.map((x) => [x.id, x.name]))} />
            </Suspense>
          </Canvas>
        </div>
        <div className="flex flex-col gap-2">
          {SPOTS.map((s) => (
            <button
              key={s.id}
              onMouseEnter={() => setActive(s.id)}
              onClick={() => setActive(s.id)}
              className="tour-item card card-glow p-4 text-left transition-colors"
              style={active === s.id ? { borderColor: 'var(--blue)' } : undefined}
            >
              <div className="display text-base font-bold">{s.name}</div>
              <div className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
                {s.text}
              </div>
            </button>
          ))}
          <div className="mono mt-2 text-[10px] tracking-[0.25em]" style={{ color: 'var(--muted)' }}>
            HOVER A SPOT · CURRENT: {(spot?.name || '').toUpperCase()}
          </div>
        </div>
      </div>
    </section>
  );
}

function LabMap({ active, onPick, names = {} }) {
  const g = useRef();
  useFrame((s) => {
    if (g.current) g.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.2) * 0.12;
  });
  const glow = (id) => (active === id ? '#6eb2ff' : '#2a5fc4');
  return (
    <group ref={g}>
      {/* floor */}
      <Wire kind="box" args={[7, 0.08, 5.2]} position={[0, -0.04, 0]} edge="#1d3f7a" />
      <gridHelper args={[7, 14, '#1a2a55', '#101a38']} position={[0, 0.01, 0]} />
      {/* electronics bench */}
      <group position={SPOT_POS.bench} onPointerOver={() => onPick('bench')}>
        <Wire kind="box" args={[1.8, 0.08, 0.7]} position={[0, 0.75, 0]} edge={glow('bench')} />
        <Wire kind="box" args={[0.06, 0.75, 0.06]} position={[-0.8, 0.37, -0.3]} edge={glow('bench')} />
        <Wire kind="box" args={[0.06, 0.75, 0.06]} position={[0.8, 0.37, -0.3]} edge={glow('bench')} />
        <Wire kind="box" args={[0.06, 0.75, 0.06]} position={[-0.8, 0.37, 0.3]} edge={glow('bench')} />
        <Wire kind="box" args={[0.06, 0.75, 0.06]} position={[0.8, 0.37, 0.3]} edge={glow('bench')} />
        <Wire kind="box" args={[0.4, 0.3, 0.25]} position={[-0.4, 0.95, 0]} edge={glow('bench')} />
        <Wire kind="box" args={[0.3, 0.05, 0.3]} position={[0.4, 0.82, 0]} edge={glow('bench')} />
        <Led position={[-0.4, 1.12, 0.13]} size={0.03} />
        <Spot show={active === 'bench'} name={names.bench || 'Electronics bench'} y={1.5} />
      </group>
      {/* printers */}
      <group position={SPOT_POS.printer} onPointerOver={() => onPick('printer')}>
        {[-0.45, 0.45].map((x) => (
          <group key={x} position={[x, 0, 0]}>
            <Wire kind="box" args={[0.6, 0.7, 0.6]} position={[0, 0.35, 0]} edge={glow('printer')} />
            <Wire kind="box" args={[0.5, 0.04, 0.5]} position={[0, 0.2, 0]} edge={glow('printer')} />
            <Wire kind="box" args={[0.08, 0.08, 0.5]} position={[0, 0.5, 0]} edge={glow('printer')} />
            <Led position={[0, 0.72, 0.28]} size={0.025} />
          </group>
        ))}
        <Spot show={active === 'printer'} name={names.printer || '3D print corner'} y={1.1} />
      </group>
      {/* test track */}
      <group position={SPOT_POS.track} onPointerOver={() => onPick('track')}>
        <Wire kind="box" args={[2.6, 0.06, 1.7]} position={[0, 0.03, 0]} edge={glow('track')} />
        <Wire kind="box" args={[0.9, 0.35, 0.8]} position={[0.7, 0.2, -0.3]} rotation={[0, 0, 0.35]} edge={glow('track')} />
        {[[-0.8, 0.3], [-0.3, -0.4], [0.2, 0.5], [-1, -0.2]].map(([x, z], i) => (
          <Wire key={i} kind="sphere" args={[0.12 + i * 0.02, 8, 6]} position={[x, 0.12, z]} edge={glow('track')} />
        ))}
        <TrackRover />
        <Spot show={active === 'track'} name={names.track || 'Test track'} y={0.9} />
      </group>
      {/* compute rack */}
      <group position={SPOT_POS.rack} onPointerOver={() => onPick('rack')}>
        <Wire kind="box" args={[0.6, 1.4, 0.6]} position={[0, 0.7, 0]} edge={glow('rack')} />
        {[0.3, 0.6, 0.9, 1.2].map((y) => (
          <Led key={y} position={[0.31, y, 0.2]} size={0.02} />
        ))}
        <Spot show={active === 'rack'} name={names.rack || 'Compute rack'} y={1.7} />
      </group>
      {/* drone cage */}
      <group position={SPOT_POS.cage} onPointerOver={() => onPick('cage')}>
        {[[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]].map(([x, z], i) => (
          <Wire key={i} kind="box" args={[0.04, 1.6, 0.04]} position={[x, 0.8, z]} edge={glow('cage')} />
        ))}
        <Wire kind="box" args={[1.3, 0.04, 1.3]} position={[0, 1.6, 0]} edge={glow('cage')} />
        <Wire kind="box" args={[1.24, 1.5, 1.24]} position={[0, 0.8, 0]} glass />
        <CageDrone />
        <Spot show={active === 'cage'} name={names.cage || 'Drone cage'} y={1.9} />
      </group>
    </group>
  );
}

function Spot({ show, name, y }) {
  return (
    <Html position={[0, y, 0]} center style={{ pointerEvents: 'none', opacity: show ? 1 : 0, transition: 'opacity .3s' }}>
      <div className="mono whitespace-nowrap rounded-md border px-2 py-1 text-[10px] tracking-[0.15em]" style={{ background: 'rgba(5,8,16,.85)', borderColor: 'rgba(110,178,255,.4)', color: '#6eb2ff' }}>
        {name.toUpperCase()}
      </div>
    </Html>
  );
}

function TrackRover() {
  const r = useRef();
  useFrame((s) => {
    const t = s.clock.elapsedTime * 0.5;
    if (r.current) {
      r.current.position.set(Math.cos(t) * 0.9, 0.1, Math.sin(t) * 0.5);
      r.current.rotation.y = -t + Math.PI / 2;
    }
  });
  return (
    <group ref={r} scale={0.35}>
      <Wire kind="box" args={[1.4, 0.3, 0.9]} position={[0, 0.35, 0]} />
      {[[0.6, 0.5], [0, 0.5], [-0.6, 0.5], [0.6, -0.5], [0, -0.5], [-0.6, -0.5]].map(([x, z], i) => (
        <Wire key={i} kind="cyl" args={[0.2, 0.2, 0.15, 10]} position={[x, 0.2, z]} rotation={[Math.PI / 2, 0, 0]} />
      ))}
      <Led position={[-0.5, 0.9, 0]} size={0.06} />
    </group>
  );
}

function CageDrone() {
  const d = useRef();
  const props = useRef([]);
  useFrame((s, dt) => {
    const t = s.clock.elapsedTime;
    if (d.current) {
      d.current.position.set(Math.sin(t * 0.8) * 0.3, 0.9 + Math.sin(t * 1.3) * 0.15, Math.cos(t * 0.6) * 0.3);
      d.current.rotation.z = Math.sin(t * 0.8) * 0.2;
    }
    props.current.forEach((p) => p && (p.rotation.y += dt * 30));
  });
  return (
    <group ref={d} scale={0.35}>
      <Wire kind="box" args={[0.4, 0.15, 0.4]} />
      {[[0.5, 0.5], [-0.5, 0.5], [0.5, -0.5], [-0.5, -0.5]].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <Wire kind="cyl" args={[0.08, 0.08, 0.12, 8]} />
          <group ref={(el) => (props.current[i] = el)} position={[0, 0.1, 0]}>
            <Wire kind="box" args={[0.5, 0.02, 0.06]} />
          </group>
        </group>
      ))}
    </group>
  );
}

/* ---------------- Achievements wall ---------------- */
const WINS = [
  { year: '2026', title: 'Robo Soccer — Winners', where: 'Inter-NIT Tech Fest', kind: 'GOLD' },
  { year: '2025', title: 'Line-follower — 2nd place', where: 'State Robotics League', kind: 'SILVER' },
  { year: '2025', title: 'Vision Hackathon — Best Hardware', where: 'ASTA × NIT AP', kind: 'SPECIAL' },
  { year: '2024', title: 'Drone Day — Autonomy award', where: 'Campus Aero Meet', kind: 'SPECIAL' },
  { year: '2024', title: 'FPGA Design Challenge — Finalists', where: 'National VLSI Contest', kind: 'FINAL' },
  { year: '2023', title: 'Freshers Bootcamp — 120 signups', where: 'NIT AP', kind: 'MILESTONE' },
];
const KIND_LABEL = { WIN: 'GOLD', PODIUM: 'PODIUM', FINAL: 'FINAL', SPECIAL: 'SPECIAL', MILESTONE: 'MILESTONE' };
function Achievements() {
  const root = useRef(null);
  const grid = useRef(null);
  const inView = useInView(grid, 0.2);
  // Managed in Admin → Achievements; WINS above is the first-paint fallback
  const { rows, loading } = useTable('achievements', { order: ['year', false] });
  const wins = loading && !rows.length ? WINS : rows.map((r) => ({ ...r, where: r.event_name, kind: KIND_LABEL[r.kind] || r.kind }));
  const winKey = wins.map((w) => w.id || w.title).join('|');
  useGSAP(
    () => {
      if (!inView) return;
      animate('.win', { opacity: [0, 1], translateY: [30, 0], rotateY: [-20, 0], delay: stagger(90), duration: 800, ease: 'outExpo' });
    },
    { scope: root, dependencies: [inView, winKey] },
  );
  const c1 = useRef(null);
  const c2 = useRef(null);
  const c3 = useRef(null);
  useCounter(c1, 14, { suffix: '' });
  useCounter(c2, 6, { suffix: '' });
  useCounter(c3, 3, { suffix: '' });
  return (
    <section ref={root} className="section pt-0">
      <SectionHeading eyebrow="03 — Achievements">Things we brought home.</SectionHeading>
      <div className="mb-10 grid gap-4 sm:grid-cols-3">
        {[
          ['Competitions entered', c1],
          ['Podiums', c2],
          ['National finals', c3],
        ].map(([label, ref]) => (
          <div key={label} className="card p-5">
            <div ref={ref} className="display text-4xl font-bold">
              0
            </div>
            <div className="mono mt-1 text-[10px] uppercase tracking-[0.22em]" style={{ color: 'var(--muted)' }}>
              {label}
            </div>
          </div>
        ))}
      </div>
      <div ref={grid} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" style={{ perspective: 1000 }}>
        {wins.map((w) => (
          <div key={w.id || w.title} className="win card card-glow group p-5 opacity-0" data-cursor>
            <div className="flex items-center justify-between">
              <span className="mono text-[10px] tracking-[0.25em]" style={{ color: 'var(--blue-glow)' }}>
                {w.kind}
              </span>
              <Trophy />
            </div>
            <div className="display mt-4 text-lg font-bold">{w.title}</div>
            <div className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
              {w.where} · {w.year}
            </div>
            {w.certificate_url && (
              <a href={w.certificate_url} target="_blank" rel="noreferrer" className="mono mt-3 inline-block text-[10px] tracking-[0.18em]" style={{ color: 'var(--blue-glow)' }}>
                VIEW CERTIFICATE ↗
              </a>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
function Trophy() {
  return (
    <svg className="h-6 w-6 transition-transform duration-700 group-hover:[transform:rotateY(360deg)]" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M8 4h8v6a4 4 0 0 1-8 0zM6 6H3v2a3 3 0 0 0 3 3M18 6h3v2a3 3 0 0 1-3 3M12 14v4M9 20h6" stroke="var(--blue-glow)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ---------------- A week in the club ---------------- */
function Week() {
  const root = useRef(null);
  const WEEK = useContent('week');
  useGSAP(
    () => {
      gsap.from('.day', { y: 40, opacity: 0, stagger: 0.08, duration: 0.7, scrollTrigger: { trigger: root.current, start: 'top 80%', once: true } });
      gsap.from('.day-line', { scaleX: 0, transformOrigin: 'left', duration: 1.4, ease: 'power3.inOut', scrollTrigger: { trigger: root.current, start: 'top 80%', once: true } });
    },
    { scope: root },
  );
  return (
    <section ref={root} className="section pt-0">
      <SectionHeading eyebrow="04 — A week in the club">Every day has a bench.</SectionHeading>
      <div className="relative">
        <div className="day-line absolute left-0 right-0 top-6 h-px" style={{ background: 'var(--blue)' }} />
        <div className="grid gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {WEEK.map(({ day: d, title: t, text: s }, i) => (
            <div key={i} className="day pt-10">
              <span className="absolute top-4 h-4 w-4 rounded-full border-2" style={{ borderColor: 'var(--blue)', background: 'var(--bg)' }} />
              <div className="mono text-[10px] tracking-[0.25em]" style={{ color: 'var(--blue-glow)' }}>
                {d}
              </div>
              <div className="display mt-1 text-base font-bold">{t}</div>
              <div className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
                {s}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Sponsors marquee ---------------- */
function Sponsors() {
  const root = useRef(null);
  const SPONSORS = useContent('sponsors').map((x) => x.name).filter(Boolean);
  useGSAP(
    () => {
      const loop = gsap.to('.sp-track', { xPercent: -50, ease: 'none', duration: 30, repeat: -1 });
      const el = root.current;
      el.addEventListener('mouseenter', () => gsap.to(loop, { timeScale: 0.2, duration: 0.5 }));
      el.addEventListener('mouseleave', () => gsap.to(loop, { timeScale: 1, duration: 0.5 }));
    },
    { scope: root },
  );
  return (
    <section ref={root} className="section pt-0">
      <div className="mono mb-4 text-xs uppercase tracking-[0.22em]" style={{ color: 'var(--muted)' }}>
        Partners & supporters
      </div>
      <div className="overflow-hidden border-y py-6" style={{ borderColor: 'var(--line)', maskImage: 'linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)' }}>
        <div className="sp-track flex w-max gap-14">
          {[...SPONSORS, ...SPONSORS].map((s, i) => (
            <span key={i} className="display whitespace-nowrap text-xl font-bold" style={{ color: 'rgba(245,247,255,.5)' }}>
              {s}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- v3: Mission, vision, values ---------------- */
function MissionVision() {
  const root = useRef(null);
  const s = useSettings();
  const ABOUT = useContent('about');
  const VALUES = useContent('values');
  useGSAP(
    () => {
      gsap.from('.mv-card', { y: 40, opacity: 0, stagger: 0.15, duration: 0.9, ease: 'power3.out', scrollTrigger: { trigger: root.current, start: 'top 80%', once: true } });
      gsap.from('.val', { x: -24, opacity: 0, stagger: 0.08, duration: 0.6, scrollTrigger: { trigger: '.vals', start: 'top 85%', once: true } });
      gsap.from('.mv-text > *', { y: 24, opacity: 0, stagger: 0.12, duration: 0.8, scrollTrigger: { trigger: '.mv-text', start: 'top 85%', once: true } });
    },
    { scope: root },
  );
  return (
    <section ref={root} className="section pt-0">
      <SectionHeading eyebrow="Mission & vision">{CLUB.tagline}</SectionHeading>
      <div className="mv-text mb-10 grid gap-8 md:grid-cols-2">
        <p className="text-base leading-relaxed" style={{ color: 'var(--muted)' }}>
          {ABOUT.more}
        </p>
        <div>
          <p className="text-base leading-relaxed" style={{ color: 'var(--muted)' }}>
            {ABOUT.community}
          </p>
          <div className="display mt-5 text-xl font-bold" style={{ color: 'var(--blue-glow)' }}>
            {ABOUT.signoff}
          </div>
        </div>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        {[
          ['MISSION', s.mission || CLUB.mission, 'M12 3l2.5 6H21l-5 4 2 7-6-4-6 4 2-7-5-4h6.5z'],
          ['VISION', s.vision || 'A campus lab that ships autonomous robots and useful AI.', 'M12 5C7 5 3 12 3 12s4 7 9 7 9-7 9-7-4-7-9-7Zm0 10a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z'],
        ].map(([k, text, icon]) => (
          <div key={k} className="mv-card card card-glow p-7" data-cursor>
            <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d={icon} stroke="var(--blue-glow)" strokeWidth="1.4" strokeLinejoin="round" />
            </svg>
            <div className="mono mt-5 text-[10px] tracking-[0.25em]" style={{ color: 'var(--blue-glow)' }}>
              {k}
            </div>
            <p className="display mt-2 text-xl font-bold leading-snug md:text-2xl">{text}</p>
          </div>
        ))}
      </div>
      <div className="vals mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {VALUES.map(({ title: t, text: d }, i) => (
          <div key={i} className="val glass p-5">
            <div className="mono text-[10px] tracking-[0.22em]" style={{ color: 'var(--blue-glow)' }}>
              VALUE {String(i + 1).padStart(2, '0')}
            </div>
            <div className="display mt-2 font-bold">{t}</div>
            <div className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
              {d}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------------- v3: Activities ---------------- */
const ACTIVITIES = [
  ['Workshops', 'Soldering, ROS 2, PCB design, CAD and ML — hands-on, laptop open.', 'M4 6h16v10H4zM9 20h6M12 16v4'],
  ['Competitions', 'IRC, Robo Soccer, line-follower leagues and hackathons, all year round.', 'M8 4h8v6a4 4 0 0 1-8 0zM6 6H3v2a3 3 0 0 0 3 3M18 6h3v2a3 3 0 0 1-3 3M12 14v4M9 20h6'],
  ['Build nights', 'Weekly lab nights where the rover, drones and arm actually move forward.', 'M4 16h16M7 16v-4h10v4M8 20a2 2 0 1 0 0-4a2 2 0 1 0 0 4M16 20a2 2 0 1 0 0-4a2 2 0 1 0 0 4'],
  ['Research', 'Paper-reading circle, neuromorphic hardware and vision projects aimed at publication.', 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5'],
  ['Mentorship', 'Every newcomer gets a senior buddy for their first build.', 'M8 10a3 3 0 1 0 0-6a3 3 0 1 0 0 6M2 20c.8-3.5 3-5 6-5s5.2 1.5 6 5M17 11l2 2 3-4'],
  ['Outreach', 'School demos, tech-fest stalls and open lab days for the whole campus.', 'M4 10v4h3l6 4V6L7 10zM16 9a4 4 0 0 1 0 6'],
];
function Activities() {
  const root = useRef(null);
  const grid = useRef(null);
  const inView = useInView(grid, 0.2);
  useGSAP(
    () => {
      if (!inView) return;
      animate('.act', { opacity: [0, 1], scale: [0.9, 1], delay: stagger(70, { grid: [3, 2], from: 'center' }), duration: 700, ease: 'outExpo' });
      animate('.act path', { strokeDashoffset: [60, 0], duration: 1200, delay: stagger(90), ease: 'inOutSine' });
    },
    { scope: root, dependencies: [inView] },
  );
  return (
    <section ref={root} className="section pt-0">
      <SectionHeading eyebrow="What we do">Six ways to get your hands dirty.</SectionHeading>
      <div ref={grid} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ACTIVITIES.map(([t, d, icon]) => (
          <div key={t} className="act card card-glow flex gap-4 p-5 opacity-0" data-cursor>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ background: 'rgba(45,123,255,.1)' }}>
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d={icon} stroke="var(--blue-glow)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="60" />
              </svg>
            </span>
            <div>
              <div className="display font-bold">{t}</div>
              <div className="mt-1 text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
                {d}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------------- v3: Faculty coordinators (Admin → Team, group "faculty") ---------------- */
function Faculty() {
  const root = useRef(null);
  const { rows } = useTable('team_members', { order: ['sort_order', true], eq: { group: 'faculty' } });
  useGSAP(
    () => {
      if (!rows.length) return;
      gsap.from('.fac', { y: 40, opacity: 0, stagger: 0.15, duration: 0.9, ease: 'power3.out', scrollTrigger: { trigger: root.current, start: 'top 85%', once: true } });
    },
    { scope: root, dependencies: [rows.length] },
  );
  if (!rows.length) return null;
  return (
    <section ref={root} className="section pt-0">
      <SectionHeading eyebrow="Faculty coordinators">The people who sign off the parts list.</SectionHeading>
      <div className="grid gap-5 md:grid-cols-2">
        {rows.map((f) => (
          <div key={f.id} className="fac card card-glow flex gap-5 p-6" data-cursor>
            <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl" style={{ background: 'linear-gradient(135deg, #2a4f9e, #0b1020)' }}>
              {f.photo_url ? (
                <img src={f.photo_url} alt={f.name} className="h-full w-full object-cover" loading="lazy" />
              ) : (
                <div className="display flex h-full w-full items-center justify-center text-2xl font-bold" style={{ color: 'var(--blue-glow)' }}>
                  {f.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <div className="mono text-[10px] tracking-[0.22em]" style={{ color: 'var(--blue-glow)' }}>
                {f.role.toUpperCase()}
              </div>
              <div className="display mt-1 text-xl font-bold">{f.name}</div>
              <div className="text-sm" style={{ color: 'var(--muted)' }}>
                {f.department}
              </div>
              {f.bio && (
                <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
                  {f.bio}
                </p>
              )}
              {f.email && (
                <a href={`mailto:${f.email}`} className="mono mt-2 inline-block text-[11px]" style={{ color: 'var(--blue-glow)' }}>
                  {f.email}
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
