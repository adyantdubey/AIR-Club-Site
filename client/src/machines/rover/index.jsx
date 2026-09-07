import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Wire, Led, GLOW } from '../../three/wire';
import { createStore, useStore } from '../../lib/store';
import { clamp, damp } from '../../three/helpers';
import { bodyParts, wheelParts, WHEEL_POSITIONS, WHEEL_RADIUS, ANTENNA_TIP, LIDAR_TOP } from '../../components/three/roverParts';
import { Slider, Toggle, Readout, Row, Btn } from '../../components/ui/Controls';

// Terrain height (small bumps) so the suspension has something to do
const bump = (x, z) => 0.07 * Math.sin(x * 2.6) * Math.cos(z * 2.1) + 0.03 * Math.sin(x * 6 + z * 4);
const LABELS = { 0: 'Chassis', 3: 'Solar deck', 12: 'Camera mast', 13: 'Stereo camera', 16: 'LiDAR base', 17: 'Antenna', 18: 'Rocker arm', 20: 'Bogie arm' };

function createState() {
  const s = createStore({ speed: 1, lidar: true, showTrail: true, odometer: 0, heading: 0 });
  s.frame.keys = new Set();
  s.frame.pos = { x: 0, z: 0, yaw: 0 };
  s.frame.trail = [];
  return s;
}

function Model({ state, mode = 'hero' }) {
  const hero = mode === 'hero';
  const rover = useRef();
  const wheels = useRef([]);
  const lidar = useRef();
  const wedge = useRef();
  const body = useMemo(() => bodyParts(), []);
  const wheel = useMemo(() => wheelParts(hero ? 14 : 8), [hero]);
  const trailGeom = useRef();
  const trailPos = useMemo(() => new Float32Array(200 * 3), []);
  const spin = useRef(0);

  useFrame((sc, dt) => {
    const t = sc.clock.elapsedTime;
    const f = state.frame;
    const cfg = state.get();
    if (lidar.current) lidar.current.rotation.y += dt * 2.4;
    if (wedge.current) wedge.current.visible = cfg.lidar;

    let v = 0;
    let w = 0;
    if (hero) {
      const k = f.keys;
      const fwd = k.has('ArrowUp') || k.has('w');
      const back = k.has('ArrowDown') || k.has('s');
      const left = k.has('ArrowLeft') || k.has('a');
      const right = k.has('ArrowRight') || k.has('d');
      v = (fwd ? 1 : 0) - (back ? 1 : 0);
      w = (left ? 1 : 0) - (right ? 1 : 0);
    }
    f.vel = damp(f.vel || 0, v * 0.9 * cfg.speed, 6, dt);
    f.rot = damp(f.rot || 0, w * 1.6, 6, dt);
    const p = f.pos;
    p.yaw += f.rot * dt;
    p.x += Math.cos(p.yaw) * f.vel * dt;
    p.z -= Math.sin(p.yaw) * f.vel * dt;
    p.x = clamp(p.x, -1.4, 1.4);
    p.z = clamp(p.z, -1.4, 1.4);

    // suspension: sample terrain under each side, tilt the body
    const y = bump(p.x, p.z);
    const dx = bump(p.x + 0.9, p.z) - bump(p.x - 0.9, p.z);
    const dz = bump(p.x, p.z + 0.8) - bump(p.x, p.z - 0.8);
    if (rover.current) {
      rover.current.position.set(p.x, y + 0.02 + (hero ? 0 : Math.sin(t * 1.2) * 0.02), p.z);
      rover.current.rotation.set(dz * 0.6, p.yaw, -dx * 0.5);
    }
    spin.current -= (f.vel / WHEEL_RADIUS) * dt + (hero ? 0 : dt * 0.8);
    wheels.current.forEach((wh, i) => {
      if (!wh) return;
      wh.rotation.z = spin.current;
      const wp = WHEEL_POSITIONS[i];
      wh.position.y = bump(p.x + wp[0] * 0.5, p.z + wp[2] * 0.5) - y;
    });

    // odometer / trail (cheap reactive updates)
    if (hero) {
      f.odo = (f.odo || 0) + Math.abs(f.vel) * dt;
      f.tick = (f.tick || 0) + dt;
      if (f.tick > 0.25) {
        f.tick = 0;
        state.set({ odometer: f.odo, heading: ((p.yaw * 180) / Math.PI) % 360 });
        if (cfg.showTrail) {
          f.trail.push([p.x, y + 0.02, p.z]);
          if (f.trail.length > 200) f.trail.shift();
          const arr = trailPos;
          for (let i = 0; i < 200; i++) {
            const q = f.trail[Math.min(i, f.trail.length - 1)] || [p.x, y, p.z];
            arr[i * 3] = q[0];
            arr[i * 3 + 1] = q[1];
            arr[i * 3 + 2] = q[2];
          }
          if (trailGeom.current) trailGeom.current.attributes.position.needsUpdate = true;
        }
      }
    }
  });

  return (
    <group>
      {/* terrain plate (does not explode) */}
      {hero && (
        <group>
          <Wire kind="box" args={[4, 0.04, 4]} position={[0, -0.02, 0]} explode={false} edge="#1d3f7a" />
          {Array.from({ length: 12 }).map((_, i) => {
            const x = ((i % 4) - 1.5) * 1.0;
            const z = (Math.floor(i / 4) - 1) * 1.1;
            return <Wire key={i} kind="sphere" args={[0.12 + (i % 3) * 0.03, 8, 6]} position={[x + 0.3, 0.02, z - 0.2]} explode={false} edge="#274d8c" />;
          })}
          <line>
            <bufferGeometry ref={trailGeom}>
              <bufferAttribute attach="attributes-position" args={[trailPos, 3]} />
            </bufferGeometry>
            <lineBasicMaterial color={GLOW} transparent opacity={0.6} />
          </line>
        </group>
      )}

      <group ref={rover} position={[0, 0.02, 0]}>
        <group position={[0, WHEEL_RADIUS, 0]}>
          {body.map((p, i) => (
            <Wire key={`b${i}`} kind={p.kind} args={p.args} position={p.pos} rotation={p.rot} label={LABELS[i]} />
          ))}
          {WHEEL_POSITIONS.map((wp, wi) => (
            <group key={`w${wi}`} position={wp} ref={(el) => (wheels.current[wi] = el)}>
              {wheel.map((p, i) => (
                <Wire key={i} kind={p.kind} args={p.args} position={p.pos} rotation={p.rot} label={wi === 0 && i === 0 ? 'Wheel hub' : undefined} />
              ))}
            </group>
          ))}
          <group ref={lidar} position={LIDAR_TOP}>
            <Wire kind="cyl" args={[0.12, 0.12, 0.14, 16]} label="LiDAR puck" />
            <mesh ref={wedge} rotation-x={-Math.PI / 2} position={[0, 0.02, 0]} userData={{ explode: false }}>
              <circleGeometry args={[1.6, 24, 0, Math.PI / 4]} />
              <meshBasicMaterial color="#2d7bff" transparent opacity={0.14} side={THREE.DoubleSide} depthWrite={false} />
            </mesh>
          </group>
          <Led position={ANTENNA_TIP} />
        </group>
      </group>
    </group>
  );
}

function Panel({ state }) {
  const speed = useStore(state, (s) => s.speed);
  const lidar = useStore(state, (s) => s.lidar);
  const trail = useStore(state, (s) => s.showTrail);
  const odo = useStore(state, (s) => s.odometer);
  const heading = useStore(state, (s) => s.heading);
  return (
    <>
      <Slider label="Speed" min={0.3} max={2} step={0.1} value={speed} onChange={(v) => state.set({ speed: v })} format={(v) => `${v.toFixed(1)}×`} />
      <Toggle label="LiDAR sweep" value={lidar} onChange={(v) => state.set({ lidar: v })} />
      <Toggle label="Path trail" value={trail} onChange={(v) => state.set({ showTrail: v })} />
      <Readout label="Odometer" value={odo.toFixed(2)} unit="m" />
      <Readout label="Heading" value={Math.round(heading)} unit="°" />
      <Row>
        <Btn
          small
          onClick={() => {
            state.frame.pos = { x: 0, z: 0, yaw: 0 };
            state.frame.trail = [];
            state.frame.odo = 0;
            state.set({ odometer: 0, heading: 0 });
          }}
        >
          Reset position
        </Btn>
      </Row>
    </>
  );
}

export default {
  slug: 'rover',
  name: 'IRC Rover',
  tag: 'AUTONOMY',
  category: 'ground',
  oneLiner: 'Six-wheel rocker-bogie rover for the International Rover Challenge.',
  blurb:
    'Our flagship machine: a six-wheel rocker-bogie rover built for the International Rover Challenge 2027. It navigates without GPS using LiDAR, a stereo camera and visual odometry, and carries a science payload for soil sampling.',
  specs: [
    ['Drive', '6 × BLDC, rocker-bogie'],
    ['Compute', 'Jetson Orin Nano'],
    ['Sensors', 'LiDAR, stereo cam, IMU, PX4FLOW'],
    ['Mass', '≈ 42 kg'],
    ['Autonomy', 'GPS-denied SLAM'],
  ],
  tech: ['ROS 2', 'Jetson', 'YDLIDAR', 'PX4FLOW', 'goBILDA'],
  howItWorks: [
    { title: 'Sense', text: 'LiDAR sweeps the ground 10× a second; the stereo camera adds depth and colour.' },
    { title: 'Think', text: 'A SLAM node builds a map on the fly and a planner picks a safe path across it.' },
    { title: 'Act', text: 'Six independent motors follow the path while the rocker-bogie keeps all wheels grounded.' },
  ],
  buildLog: [
    { date: '2025-03', title: 'Chassis on goBILDA rails', text: 'First rolling frame, tethered.' },
    { date: '2025-08', title: 'LiDAR SLAM running', text: 'Cartographer map of the lab corridor.' },
    { date: '2026-01', title: 'Suspension redesign', text: 'Rocker-bogie pivots moved for a longer wheelbase.' },
    { date: '2026-06', title: 'Autonomous lap', text: 'First fully autonomous loop of the test track.' },
    { date: '2027-01', title: 'IRC 2027', text: 'Target: full mission run at the International Rover Challenge.' },
  ],
  controlsHelp: 'Drive with W A S D or the arrow keys. The suspension reacts to the bumps.',
  mobileKeys: ['ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'],
  createState,
  Model,
  Panel,
};
