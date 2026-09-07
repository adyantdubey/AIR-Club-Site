import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Wire, Led, Strut, GLOW, glassMaterial } from '../../three/wire';
import { createStore, useStore } from '../../lib/store';
import { clamp, damp } from '../../three/helpers';
import { Slider, Toggle, Readout, Row, Btn } from '../../components/ui/Controls';
import Joystick from './Joystick';

/*
 * Quadcopter. Front is +Z. The airframe is an "X": four arms from a centre hub, a motor + prop on each tip.
 * Flight is "physics-lite": throttle sets climb rate, the stick tilts the frame and the frame's tilt
 * pushes it sideways. Every motor gets its own prop speed so you can see which side is lifting.
 */

const RED = '#ff6b6b'; // rear (tail) LED colour
const ARM = 0.6; // hub → motor distance
const D = ARM * Math.SQRT1_2; // 45° arms: x and z offset of each motor
// Motor layout: [sx, sz, spin direction]. Diagonal pairs spin the same way (like a real quad).
const MOTORS = [
  [1, 1, 1], // front-right
  [-1, 1, -1], // front-left
  [-1, -1, 1], // rear-left
  [1, -1, -1], // rear-right
];
const DEG = Math.PI / 180;
const LIMIT = 1.5; // horizontal box (± units)
const FLOOR_Y = 0.25; // body height when the skids rest on the pad
const CEIL_Y = 1.35; // ceiling
const HOVER_Y = 1.0; // start / idle height
const TRAIL_MAX = 300; // ring buffer size for the path trail
const AUTO_TIME = 8; // seconds for one figure-8

// Figure-8 (lemniscate-style) path used by "Auto loop". u in 0..2π.
const fig8 = (u) => ({ x: 1.1 * Math.sin(u), z: 0.75 * Math.sin(2 * u) });

function createState() {
  const s = createStore({ throttle: 0.5, showTrail: true, auto: false, altitude: HOVER_Y - FLOOR_Y });
  s.frame.stick = { x: 0, y: 0 }; // from the DOM joystick (-1..1, y = forward)
  s.frame.pos = { x: 0, y: HOVER_Y, z: 0 };
  s.frame.vel = { x: 0, y: 0, z: 0 };
  s.frame.att = { pitch: 0, roll: 0, yaw: 0 }; // attitude, radians
  s.frame.autoT = -1; // -1 = not flying the loop; otherwise seconds elapsed
  s.frame.trail = []; // ring buffer of [x, y, z]
  return s;
}

function Model({ state, mode = 'hero' }) {
  const hero = mode === 'hero';
  const body = useRef(); // position
  const tilt = useRef(); // pitch / roll / yaw
  const props = useRef([]); // the 4 spinning prop groups
  const gimbalPitch = useRef();
  const gimbalRoll = useRef();
  const rearLed = useRef();
  const trailGeom = useRef();
  const trailLine = useRef();
  const trailPos = useMemo(() => new Float32Array(TRAIL_MAX * 3), []);
  const spin = useRef([0, 0, 0, 0]);
  const tick = useRef(0);

  // One translucent disc material per prop, so each can fade with its own rpm
  const discMats = useMemo(() => MOTORS.map(() => glassMaterial().clone()), []);

  useFrame((sc, dt) => {
    dt = Math.min(dt, 0.05); // avoid huge jumps after a tab switch
    const t = sc.clock.elapsedTime;
    const f = state.frame;
    const cfg = state.get();
    const p = f.pos;
    const v = f.vel;
    const att = f.att;

    // ---- 1. decide the stick input (user joystick, or the auto-loop "virtual pilot")
    let sx = 0;
    let sy = 0;
    if (hero) {
      if (f.autoT >= 0) {
        f.autoT += dt;
        const u = (f.autoT / AUTO_TIME) * Math.PI * 2;
        const tgt = fig8(u);
        const ahead = fig8(u + 0.15); // a little ahead → velocity feed-forward
        sx = clamp((tgt.x - p.x) * 2.2 + (ahead.x - tgt.x) * 4, -1, 1);
        sy = clamp((tgt.z - p.z) * 2.2 + (ahead.z - tgt.z) * 4, -1, 1);
        if (f.autoT >= AUTO_TIME) {
          f.autoT = -1;
          state.set({ auto: false });
        }
      } else {
        sx = f.stick.x;
        sy = f.stick.y;
      }
    }

    // ---- 2. attitude: tilt toward the stick (max 20°) + a gentle hover wobble
    // (the wobble is visual only: it is added when posing the model, not to the control tilt)
    const wobble = hero ? 1.2 : 2.5;
    const wobP = Math.sin(t * 1.7) * wobble * DEG;
    const wobR = Math.sin(t * 1.3 + 1) * wobble * DEG;
    att.pitch = damp(att.pitch, sy * 20 * DEG, 6, dt);
    att.roll = damp(att.roll, -sx * 20 * DEG, 6, dt);
    // yaw drifts a little on its own, and a bit more while turning hard
    att.yaw += (Math.sin(t * 0.35) * 0.06 + sx * sy * 0.4) * dt;

    // ---- 3. translation: tilt pushes the drone in the tilt direction (body frame → world by yaw)
    const bodyAx = -att.roll / (20 * DEG); // roll right → move +X (body)
    const bodyAz = att.pitch / (20 * DEG); // nose down → move +Z (body)
    const cy = Math.cos(att.yaw);
    const sn = Math.sin(att.yaw);
    const tx = (bodyAx * cy + bodyAz * sn) * 1.3;
    const tz = (-bodyAx * sn + bodyAz * cy) * 1.3;
    v.x = damp(v.x, hero ? tx : 0, 2.5, dt);
    v.z = damp(v.z, hero ? tz : 0, 2.5, dt);
    // altitude: throttle 0.5 = hover; above climbs, below descends
    const climb = hero ? (cfg.throttle - 0.5) * 2.2 : 0;
    v.y = damp(v.y, climb, 3, dt);
    p.x += v.x * dt;
    p.z += v.z * dt;
    p.y += v.y * dt;
    if (p.x > LIMIT || p.x < -LIMIT) v.x = 0;
    if (p.z > LIMIT || p.z < -LIMIT) v.z = 0;
    if (p.y > CEIL_Y || p.y < FLOOR_Y) v.y = 0;
    p.x = clamp(p.x, -LIMIT, LIMIT);
    p.z = clamp(p.z, -LIMIT, LIMIT);
    p.y = clamp(p.y, FLOOR_Y, CEIL_Y);
    const landed = p.y <= FLOOR_Y + 1e-3;
    const bob = hero ? 0 : -0.3 + Math.sin(t * 1.1) * 0.05; // mini: hover a little lower so the card is compact
    if (body.current) body.current.position.set(p.x, p.y + bob, p.z);
    if (tilt.current) tilt.current.rotation.set(landed ? 0 : att.pitch + wobP, att.yaw, landed ? 0 : att.roll + wobR);

    // ---- 4. motors: base rpm from throttle, ± a differential so the lifting side spins faster
    const thr = hero ? cfg.throttle : 0.55;
    const base = landed && thr < 0.05 ? 0 : 25 + thr * 55;
    const pitchN = att.pitch / (20 * DEG);
    const rollN = -att.roll / (20 * DEG);
    MOTORS.forEach(([mx, mz, dir], i) => {
      const rpm = Math.max(0, base + 18 * (-mz * pitchN - mx * rollN));
      spin.current[i] += rpm * dir * dt;
      const g = props.current[i];
      if (g) g.rotation.y = spin.current[i];
      // translucent disc fades in as the prop gets fast enough to blur
      discMats[i].opacity = clamp((rpm - 30) / 45, 0, 1) * 0.22;
    });

    // ---- 5. gimbal keeps the camera level by cancelling the body tilt
    if (gimbalPitch.current) gimbalPitch.current.rotation.x = -(landed ? 0 : att.pitch);
    if (gimbalRoll.current) gimbalRoll.current.rotation.z = -(landed ? 0 : att.roll);

    // ---- 6. rear LED: double blink once per second
    if (rearLed.current) {
      const ph = t % 1;
      rearLed.current.material.emissiveIntensity = ph < 0.12 || (ph > 0.25 && ph < 0.37) ? 3 : 0.15;
    }

    // ---- 7. path trail (ring buffer, 20 samples per second) + cheap altitude readout
    if (hero) {
      tick.current += dt;
      if (tick.current > 0.05) {
        tick.current = 0;
        if (cfg.showTrail) {
          f.trail.push([p.x, p.y - 0.05, p.z]);
          if (f.trail.length > TRAIL_MAX) f.trail.shift();
          const n = f.trail.length;
          for (let i = 0; i < n; i++) {
            const q = f.trail[i];
            trailPos[i * 3] = q[0];
            trailPos[i * 3 + 1] = q[1];
            trailPos[i * 3 + 2] = q[2];
          }
          if (trailGeom.current) {
            trailGeom.current.setDrawRange(0, n);
            trailGeom.current.attributes.position.needsUpdate = true;
          }
        } else if (f.trail.length) {
          f.trail.length = 0;
          if (trailGeom.current) trailGeom.current.setDrawRange(0, 0);
        }
        if (trailLine.current) trailLine.current.visible = cfg.showTrail;
        f.altTick = (f.altTick || 0) + 1;
        if (f.altTick % 5 === 0) state.set({ altitude: p.y - FLOOR_Y });
      }
    }
  });

  return (
    <group>
      {/* landing pad at y = 0 (fixed, never explodes) with an "H" */}
      <Wire kind="cyl" args={[0.9, 0.9, 0.03, 40]} position={[0, 0.015, 0]} explode={false} edge="#1d3f7a" />
      <Wire kind="box" args={[0.06, 0.012, 0.5]} position={[-0.18, 0.036, 0]} explode={false} edge={GLOW} />
      <Wire kind="box" args={[0.06, 0.012, 0.5]} position={[0.18, 0.036, 0]} explode={false} edge={GLOW} />
      <Wire kind="box" args={[0.3, 0.012, 0.06]} position={[0, 0.036, 0]} explode={false} edge={GLOW} />

      {/* the path trail: a single line whose points come from a ring buffer */}
      {hero && (
        <line ref={trailLine} frustumCulled={false}>
          <bufferGeometry ref={trailGeom} drawRange={{ start: 0, count: 0 }}>
            <bufferAttribute attach="attributes-position" args={[trailPos, 3]} />
          </bufferGeometry>
          <lineBasicMaterial color={GLOW} transparent opacity={0.55} />
        </line>
      )}

      <group ref={body} position={[0, HOVER_Y, 0]}>
        <group ref={tilt}>
          {/* centre hub + flight controller stack */}
          <Wire kind="box" args={[0.3, 0.07, 0.3]} label="Flight controller" />
          <Wire kind="box" args={[0.22, 0.02, 0.22]} position={[0, 0.05, 0]} />
          {hero && <Wire kind="cyl" args={[0.012, 0.012, 0.12, 6]} position={[0, 0.12, 0]} />}
          <Wire kind="cyl" args={[0.06, 0.06, 0.025, 16]} position={[0, hero ? 0.19 : 0.08, 0]} label="GPS puck" />

          {/* four arms, motors and props */}
          {MOTORS.map(([mx, mz], i) => {
            const tip = [mx * D, 0, mz * D];
            return (
              <group key={i}>
                <Strut from={[0, 0, 0]} to={tip} thick={0.045} />
                <Wire kind="cyl" args={[0.055, 0.06, 0.07, 12]} position={[tip[0], 0.05, tip[2]]} label={i === 0 ? 'Motor' : undefined} />
                <group ref={(el) => (props.current[i] = el)} position={[tip[0], 0.1, tip[2]]}>
                  {/* two blades with opposite pitch, like a real 2-blade prop */}
                  <Wire kind="box" args={[0.22, 0.008, 0.035]} position={[0.12, 0, 0]} rotation={[0.35, 0, 0]} label={i === 0 ? 'Propeller' : undefined} />
                  <Wire kind="box" args={[0.22, 0.008, 0.035]} position={[-0.12, 0, 0]} rotation={[-0.35, 0, 0]} />
                  {/* blur disc: opacity is animated with rpm */}
                  <Wire kind="cyl" args={[0.25, 0.25, 0.004, 28]} glass material={discMats[i]} explode={false} />
                </group>
              </group>
            );
          })}

          {/* battery underneath, with two straps */}
          <Wire kind="box" args={[0.26, 0.08, 0.15]} position={[0, -0.08, 0]} label="Battery" />
          {hero && <Wire kind="box" args={[0.28, 0.09, 0.02]} position={[0, -0.08, 0.05]} />}
          {hero && <Wire kind="box" args={[0.28, 0.09, 0.02]} position={[0, -0.08, -0.05]} />}

          {/* 2-axis camera gimbal at the front (pitch, then roll) */}
          <group position={[0, -0.04, 0.2]}>
            <Wire kind="box" args={[0.03, 0.07, 0.03]} position={[0.06, -0.02, 0]} />
            <group ref={gimbalPitch} position={[0, -0.07, 0]}>
              <group ref={gimbalRoll}>
                <Wire kind="box" args={[0.09, 0.06, 0.07]} label="Gimbal camera" />
                <Wire kind="cyl" args={[0.025, 0.025, 0.03, 12]} position={[0, 0, 0.05]} rotation={[Math.PI / 2, 0, 0]} />
              </group>
            </group>
          </group>

          {/* two landing skids: a rail each, on two legs */}
          {[-1, 1].map((s) => (
            <group key={s}>
              <Wire kind="box" args={[0.04, 0.03, 0.55]} position={[s * 0.2, -0.2, 0]} label={s === -1 ? 'Landing skid' : undefined} />
              <Strut from={[s * 0.1, -0.03, 0.18]} to={[s * 0.2, -0.19, 0.18]} thick={0.03} />
              <Strut from={[s * 0.1, -0.03, -0.18]} to={[s * 0.2, -0.19, -0.18]} thick={0.03} />
            </group>
          ))}

          {/* LEDs: two front (green-ish glow), one blinking red at the rear */}
          <Led position={[0.32, -0.02, 0.32]} size={0.03} />
          <Led position={[-0.32, -0.02, 0.32]} size={0.03} />
          <Led ref={rearLed} position={[0, -0.01, -0.2]} size={0.03} color={RED} />
        </group>
      </group>
    </group>
  );
}

function Panel({ state }) {
  const throttle = useStore(state, (s) => s.throttle);
  const trail = useStore(state, (s) => s.showTrail);
  const auto = useStore(state, (s) => s.auto);
  const alt = useStore(state, (s) => s.altitude);
  return (
    <>
      <Slider label="Throttle" min={0} max={1} step={0.01} value={throttle} onChange={(v) => state.set({ throttle: v })} format={(v) => `${Math.round(v * 100)}%`} />
      <Row className="justify-between">
        <Joystick state={state} disabled={auto} />
        <div className="flex flex-1 flex-col gap-2 pl-3">
          <Readout label="Alt" value={alt.toFixed(2)} unit="m" />
          <Btn
            small
            disabled={auto}
            onClick={() => {
              state.frame.autoT = 0;
              state.set({ auto: true });
            }}
          >
            {auto ? 'Flying…' : 'Auto loop'}
          </Btn>
          <Btn
            small
            onClick={() => {
              state.frame.pos = { x: 0, y: HOVER_Y, z: 0 };
              state.frame.vel = { x: 0, y: 0, z: 0 };
              state.frame.trail = [];
              state.frame.autoT = -1;
              state.set({ throttle: 0.5, auto: false });
            }}
          >
            Reset
          </Btn>
        </div>
      </Row>
      <Toggle label="Show path trail" value={trail} onChange={(v) => state.set({ showTrail: v })} />
    </>
  );
}

export default {
  slug: 'drone',
  name: 'Quadcopter',
  tag: 'AERIAL',
  category: 'air',
  oneLiner: 'Fly it with a throttle and a joystick.',
  blurb:
    'A 450 mm X-frame quad we built to learn flight control from the ground up: Pixhawk running PX4, four 1400 kV motors on 30 A ESCs, a 4S LiPo and a two-axis camera gimbal. It is our test-bed for GPS missions and, later, for the vision code that will move onto the rover.',
  specs: [
    ['Frame', '450 mm X, carbon arms'],
    ['Motors', '4 × 2212 1400 kV, 9045 props'],
    ['Flight controller', 'Pixhawk 6C · PX4'],
    ['Battery', '4S 5200 mAh LiPo'],
    ['Flight time', '≈ 14 min hover'],
    ['AUW', '1.35 kg'],
  ],
  tech: ['PX4', 'Pixhawk 6C', 'BLHeli_S ESC', 'M8N GPS', 'QGroundControl'],
  howItWorks: [
    { title: 'Sense', text: 'The IMU samples 1000× a second; GPS, barometer and compass are fused by an EKF into one position and attitude estimate.' },
    { title: 'Think', text: 'Cascaded PID loops turn your stick into a target tilt, then into a target rotation rate, then into a torque request.' },
    { title: 'Act', text: 'The mixer sends that torque to four ESCs: to tilt forward, the rear motors simply spin a little faster than the front ones.' },
  ],
  buildLog: [
    { date: '2025-02', title: 'Frame and ESC bench test', text: 'Motors spun on the bench; one ESC re-flashed after a failed calibration.' },
    { date: '2025-04', title: 'First hover', text: 'Manual mode in the sports hall, PIDs from the PX4 defaults; it drifted but stayed up.' },
    { date: '2025-09', title: 'Position hold', text: 'M8N GPS on a mast fixed the compass noise; position mode holds within a metre.' },
    { date: '2026-02', title: 'Gimbal + camera', text: '2-axis brushless gimbal, camera stays level through 20° tilts.' },
    { date: '2026-06', title: 'First waypoint mission', text: 'Figure-8 survey pattern flown from QGroundControl, fully autonomous.' },
  ],
  controlsHelp: 'Throttle sets climb (50% = hover). Drag the stick to tilt and move. Auto loop flies a figure-8.',
  mobileKeys: null,
  fit: 3.0,
  createState,
  Model,
  Panel,
};
