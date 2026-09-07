import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Wire, Led, Strut, EDGE_SOFT } from '../../three/wire';
import { createStore, useStore } from '../../lib/store';
import { clamp, damp, lerp } from '../../three/helpers';
import { Slider, Toggle, Seg, Readout } from '../../components/ui/Controls';
import { LEGS, LC, LF, LT, BODY_R, ROCKS, ROCK_SINK, legPhase, footOffset, legStride, solveLeg, groundHeight } from './gait';

const LIMIT = 1.3; // the robot stays within ±LIMIT on the plate
const HIST = 40; // columns in the gait diagram
const EMPTY_KEYS = new Set();

function createState() {
  const s = createStore({ speed: 1, bodyHeight: 0.38, terrain: 'flat', showGait: false, gaitHist: [], heading: 0 });
  fillFrame(s.frame);
  return s;
}

// Per-frame scratch data (no React renders). Re-filled after store.reset().
function fillFrame(f) {
  if (f.pos) return f;
  f.keys = f.keys || new Set();
  f.pos = { x: 0, z: 0, yaw: 0 };
  f.v = 0; // forward speed (units/s)
  f.w = 0; // turn rate (rad/s)
  f.phase = 0; // gait cycle 0→1
  f.lift = 0; // smoothed body lift from the terrain
  f.pitch = 0;
  f.roll = 0;
  f.hist = new Array(HIST).fill(0); // gait diagram history (6-bit masks, newest last)
  f.tick = 0;
  f.hTick = 0;
  return f;
}

function Model({ state, mode = 'hero' }) {
  const hero = mode === 'hero';
  const robot = useRef();
  const head = useRef();
  const rocks = useRef();
  const eyes = useRef([]);
  const coxa = useRef([]);
  const femur = useRef([]);
  const tibia = useRef([]);
  // scratch objects reused every frame (no allocations in the loop)
  const S = useMemo(
    () => ({
      stride: [0, 0],
      off: [0, 0, 0],
      ang: [0, 0, 0],
      P: new THREE.Vector3(),
      F: new THREE.Vector3(),
      q: new THREE.Quaternion(),
      euler: new THREE.Euler(),
    }),
    [],
  );

  useFrame((sc, dt) => {
    dt = Math.min(dt, 0.05);
    const t = sc.clock.elapsedTime;
    const f = fillFrame(state.frame);
    const cfg = state.get();
    const speed = cfg.speed;
    const onRocks = hero && cfg.terrain === 'rocks';

    // ---- 1. what does the pilot want? ----
    let vCmd = 0;
    let wCmd = 0;
    if (hero) {
      const k = f.keys || EMPTY_KEYS;
      vCmd = (k.has('ArrowUp') || k.has('w') ? 1 : 0) - (k.has('ArrowDown') || k.has('s') ? 1 : 0);
      wCmd = (k.has('ArrowLeft') || k.has('a') ? 1 : 0) - (k.has('ArrowRight') || k.has('d') ? 1 : 0);
    } else {
      vCmd = 0.8; // mini: always walking (in place)
    }
    f.v = damp(f.v, vCmd * 0.55 * speed, 5, dt);
    f.w = damp(f.w, wCmd * 1.3 * speed, 5, dt);

    // ---- 2. gait clock: full steps when moving, a light march in place when idle ----
    const moving = clamp(Math.abs(f.v) / (0.55 * speed) + Math.abs(f.w) / (1.3 * speed), 0, 1);
    const freq = lerp(0.45, 1.5 * speed, moving); // gait cycles per second
    const liftH = lerp(0.035, 0.11, moving);
    f.phase = (f.phase + freq * dt) % 1;
    const halfPeriod = 0.5 / freq;

    // ---- 3. move the body (hero only; mini walks on the spot) ----
    const p = f.pos;
    if (hero) {
      p.yaw += f.w * dt;
      p.x = clamp(p.x + Math.cos(p.yaw) * f.v * dt, -LIMIT, LIMIT);
      p.z = clamp(p.z - Math.sin(p.yaw) * f.v * dt, -LIMIT, LIMIT);
    }
    const cy = Math.cos(p.yaw);
    const sy = Math.sin(p.yaw);

    // ---- 4. terrain under the body: average lift + a little pitch/roll ----
    const hFront = groundHeight(p.x + cy * 0.6, p.z - sy * 0.6, onRocks);
    const hBack = groundHeight(p.x - cy * 0.6, p.z + sy * 0.6, onRocks);
    const hRight = groundHeight(p.x + sy * 0.6, p.z + cy * 0.6, onRocks);
    const hLeft = groundHeight(p.x - sy * 0.6, p.z - cy * 0.6, onRocks);
    const hMid = groundHeight(p.x, p.z, onRocks);
    f.lift = damp(f.lift, (hFront + hBack + hLeft + hRight + hMid) / 5, 4, dt);
    f.pitch = damp(f.pitch, Math.atan2(hFront - hBack, 1.2) * 0.7, 4, dt);
    f.roll = damp(f.roll, -Math.atan2(hRight - hLeft, 1.2) * 0.7, 4, dt);
    const bob = hero ? Math.sin(t * 2.2) * 0.006 : Math.sin(t * 2.5) * 0.012;
    const bodyY = cfg.bodyHeight + f.lift + bob;

    S.P.set(p.x, bodyY, p.z);
    S.euler.set(f.roll, p.yaw, f.pitch, 'YZX');
    S.q.setFromEuler(S.euler);
    if (robot.current) {
      robot.current.position.copy(S.P);
      robot.current.quaternion.copy(S.q);
    }
    S.q.invert(); // world → body

    // ---- 5. each leg: where should the foot be, and which angles put it there ----
    let mask = 0;
    for (let i = 0; i < 6; i++) {
      const leg = LEGS[i];
      const ph = legPhase(f.phase, i);
      if (ph.swing) mask |= 1 << i;
      legStride(leg, f.v, f.w, halfPeriod, S.stride);
      footOffset(ph.swing, ph.s, S.stride, liftH, S.off);
      // foot in the yaw-only body frame → plate frame
      const hx = leg.home[0] + S.off[0];
      const hz = leg.home[1] + S.off[2];
      const wx = p.x + hx * cy + hz * sy;
      const wz = p.z - hx * sy + hz * cy;
      const wy = groundHeight(wx, wz, onRocks) + S.off[1];
      // plate frame → tilted body frame, relative to this leg's hip
      S.F.set(wx - S.P.x, wy - S.P.y, wz - S.P.z).applyQuaternion(S.q);
      solveLeg(leg, S.F.x - leg.mount[0], S.F.y, S.F.z - leg.mount[2], S.ang);
      if (coxa.current[i]) coxa.current[i].rotation.y = S.ang[0];
      if (femur.current[i]) femur.current[i].rotation.z = S.ang[1];
      if (tibia.current[i]) tibia.current[i].rotation.z = S.ang[2];
    }

    // ---- 6. small life: sensor head scans, eyes pulse ----
    if (head.current) head.current.rotation.y = Math.sin(t * 0.8) * 0.35;
    eyes.current.forEach((e, i) => {
      if (e) e.material.emissiveIntensity = 1.3 + Math.sin(t * 3 + i * 1.5) * 0.5;
    });
    if (rocks.current) rocks.current.visible = onRocks;

    // ---- 7. cheap reactive updates for the panel ----
    if (hero) {
      f.hTick += dt;
      if (f.hTick > 0.1) {
        f.hTick = 0;
        f.hist.push(mask);
        if (f.hist.length > HIST) f.hist.shift();
        if (cfg.showGait) state.set({ gaitHist: f.hist.slice() });
      }
      f.tick += dt;
      if (f.tick > 0.3) {
        f.tick = 0;
        const hd = Math.round((((p.yaw * 180) / Math.PI) % 360 + 360) % 360);
        if (hd !== cfg.heading) state.set({ heading: hd });
      }
    }
  });

  return (
    <group>
      {/* ground plate + rocks (hero only, never explode) */}
      {hero && (
        <group>
          <Wire kind="box" args={[4.2, 0.04, 4.2]} position={[0, -0.02, 0]} explode={false} edge="#1d3f7a" />
          <group ref={rocks} visible={false}>
            {ROCKS.map(([x, z, r], i) => (
              <Wire key={i} kind="sphere" args={[r, 10, 7]} position={[x, -r * ROCK_SINK, z]} explode={false} edge="#274d8c" />
            ))}
          </group>
        </group>
      )}

      <group ref={robot} position={[0, 0.38, 0]}>
        {/* ---- body ---- */}
        <Wire kind="cyl" args={[BODY_R, BODY_R, 0.14, 6]} label="Body" />
        <Wire kind="cyl" args={[0.34, 0.34, 0.03, 6]} position={[0, 0.085, 0]} edge={EDGE_SOFT} />
        <Wire kind="box" args={[0.3, 0.09, 0.2]} position={[0, -0.11, 0]} label="Battery" />
        <Wire kind="box" args={[0.2, 0.025, 0.12]} position={[-0.08, 0.11, 0]} />
        {hero && <Wire kind="box" args={[0.08, 0.02, 0.06]} position={[0.06, 0.11, 0.14]} />}
        {hero && <Strut from={[-0.28, 0.1, 0.12]} to={[-0.4, 0.42, 0.14]} thick={0.014} edge={EDGE_SOFT} />}
        {hero && <Led position={[-0.4, 0.43, 0.14]} size={0.022} />}
        {/* ---- sensor head (scans left/right) ---- */}
        <group ref={head} position={[0.42, 0.06, 0]}>
          <Wire kind="box" args={[0.16, 0.12, 0.2]} position={[0.08, 0, 0]} label="Sensor head" />
          <Led ref={(el) => (eyes.current[0] = el)} position={[0.165, 0.01, 0.06]} size={0.03} />
          <Led ref={(el) => (eyes.current[1] = el)} position={[0.165, 0.01, -0.06]} size={0.03} />
        </group>

        {/* ---- six legs ---- */}
        {LEGS.map((leg, i) => (
          <group key={leg.name} position={leg.mount} rotation={[0, -leg.angle, 0]}>
            {/* coxa: yaw servo at the hip */}
            <group ref={(el) => (coxa.current[i] = el)}>
              {hero && <Wire kind="box" args={[0.1, 0.11, 0.12]} position={[0.02, 0, 0]} label={i === 0 ? 'Coxa servo' : undefined} />}
              <Wire kind="box" args={[0.12, 0.05, 0.08]} position={[LC - 0.05, 0, 0]} />
              {/* femur: pitch servo */}
              <group ref={(el) => (femur.current[i] = el)} position={[LC, 0, 0]}>
                {hero && <Wire kind="box" args={[0.09, 0.12, 0.1]} position={[0.02, 0, 0]} />}
                <Wire kind="box" args={[LF, 0.06, 0.05]} position={[LF / 2, 0, 0]} label={i === 0 ? 'Femur' : undefined} />
                {/* tibia: knee servo */}
                <group ref={(el) => (tibia.current[i] = el)} position={[LF, 0, 0]}>
                  {hero && <Wire kind="box" args={[0.08, 0.1, 0.09]} position={[0, 0, 0]} />}
                  <Wire kind="box" args={[LT, 0.045, 0.04]} position={[LT / 2, 0, 0]} label={i === 0 ? 'Tibia' : undefined} />
                  <Wire kind="sphere" args={[0.045, 10, 8]} position={[LT, 0, 0]} label={i === 0 ? 'Foot' : undefined} />
                </group>
              </group>
            </group>
          </group>
        ))}
      </group>
    </group>
  );
}

// Small timeline: one row per leg, dark = stance, bright = swing, newest on the right.
function GaitDiagram({ hist }) {
  const w = 240;
  const rowH = 9;
  const h = rowH * 6;
  const cw = w / HIST;
  const rects = [];
  const start = HIST - hist.length;
  hist.forEach((mask, c) => {
    for (let i = 0; i < 6; i++) {
      if (mask & (1 << i)) rects.push(<rect key={`${c}-${i}`} x={(start + c) * cw} y={i * rowH + 1.5} width={cw - 0.6} height={rowH - 3} fill="var(--blue-glow)" rx="1" />);
    }
  });
  return (
    <div>
      <div className="mono mb-1 text-[10px] tracking-[0.18em]" style={{ color: 'var(--muted)' }}>
        GAIT · SWING PHASES
      </div>
      <div className="flex gap-1">
        <div className="mono flex flex-col justify-between text-[8px] leading-none" style={{ color: 'var(--muted)', height: h }}>
          {LEGS.map((l) => (
            <span key={l.name}>{l.name}</span>
          ))}
        </div>
        <svg viewBox={`0 0 ${w} ${h}`} style={{ height: h }} className="w-full" preserveAspectRatio="none" aria-hidden="true">
          {LEGS.map((_, i) => (
            <rect key={i} x="0" y={i * rowH + 1.5} width={w} height={rowH - 3} fill="rgba(110,178,255,.08)" rx="1" />
          ))}
          {rects}
        </svg>
      </div>
    </div>
  );
}

function Panel({ state }) {
  const speed = useStore(state, (s) => s.speed);
  const bodyHeight = useStore(state, (s) => s.bodyHeight);
  const terrain = useStore(state, (s) => s.terrain);
  const showGait = useStore(state, (s) => s.showGait);
  const hist = useStore(state, (s) => s.gaitHist);
  const heading = useStore(state, (s) => s.heading);
  return (
    <>
      <Seg
        label="Terrain"
        options={[
          ['flat', 'Flat'],
          ['rocks', 'Rocks'],
        ]}
        value={terrain}
        onChange={(v) => state.set({ terrain: v })}
      />
      <Slider label="Speed" min={0.3} max={2} step={0.1} value={speed} onChange={(v) => state.set({ speed: v })} format={(v) => `${v.toFixed(1)}×`} />
      <Slider label="Body height" min={0.25} max={0.5} step={0.01} value={bodyHeight} onChange={(v) => state.set({ bodyHeight: v })} format={(v) => `${Math.round(v * 250)} mm`} />
      <Readout label="Heading" value={heading} unit="°" />
      <Toggle label="Show gait diagram" value={showGait} onChange={(v) => state.set({ showGait: v })} />
      {showGait && <GaitDiagram hist={hist} />}
    </>
  );
}

export default {
  slug: 'hexabot',
  name: 'Hexabot',
  tag: 'LEGGED',
  category: 'ground',
  fit: 3.4,
  oneLiner: 'Six legs, tripod gait, walks where wheels can\'t.',
  blurb:
    'Hexabot is our six-legged walker: 18 MG90S servos on an ESP32, three per leg, and a tripod gait that keeps three feet on the ground at all times. It was built to explore stairs and rubble that the rover cannot drive over, and to teach the team leg kinematics before we attempt anything bigger.',
  specs: [
    ['Legs', '6 × 3 DOF (coxa, femur, tibia)'],
    ['Servos', '18 × MG90S'],
    ['Controller', 'ESP32 + 2 × PCA9685'],
    ['Battery', '2S LiPo 2200 mAh + 6 A BEC'],
    ['Mass', '≈ 1.1 kg'],
    ['Top speed', '≈ 0.15 m/s'],
  ],
  tech: ['ESP32', 'PCA9685', 'MG90S', 'Tripod gait', 'Leg IK', 'Wi-Fi gamepad'],
  howItWorks: [
    { title: 'Sense', text: 'A Wi-Fi gamepad sends forward speed and turn rate; an MPU-6050 on the body reports tilt so the gait can slow down on slopes.' },
    { title: 'Think', text: 'The ESP32 runs the gait clock at 50 Hz: legs 1-3-5 swing while 2-4-6 push, then swap. Each foot target goes through a 2-link IK to give coxa, femur and tibia angles.' },
    { title: 'Act', text: 'Two PCA9685 boards drive the 18 servos; swing legs trace a sine arc so the foot lifts cleanly over small rocks.' },
  ],
  buildLog: [
    { date: '2025-04', title: 'One leg on the bench', text: 'Three MG90S, a printed bracket and a lot of jitter until we added a proper 6 A BEC.' },
    { date: '2025-07', title: 'Body + six legs', text: '3 mm laser-cut hexagon; first stand-up, then a very wobbly first step.' },
    { date: '2025-11', title: 'Tripod gait', text: 'Replaced the hand-tuned wave gait with a phase-based tripod; walking speed tripled.' },
    { date: '2026-02', title: 'Terrain adaptation', text: 'Feet now probe downward until the servo current rises, so the body stays level on rubble.' },
    { date: '2026-05', title: 'Open-day walk', text: 'Walked a 5 m course over bricks, driven from a phone.' },
  ],
  controlsHelp: 'Walk with W A S D or the arrow keys. Switch to rocks to see the legs adapt.',
  mobileKeys: ['ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'],
  createState,
  Model,
  Panel,
};
