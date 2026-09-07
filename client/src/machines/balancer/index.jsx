import { useCallback, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Wire, Led, Strut, EDGE_SOFT } from '../../three/wire';
import { createStore, useStore } from '../../lib/store';
import { Slider, Btn, Readout, Row, MiniGraph } from '../../components/ui/Controls';
import { initialState, step, push, reset, DEFAULT_GAINS, X_LIMIT } from './physics';

// ---- geometry constants (model units; drawn robot is ≈ 1.7 tall) ----
const R = 0.26; // wheel radius
const WHEEL_Z = 0.3; // wheels sit at z = ±WHEEL_Z
const BODY_SCALE = 1.25; // the robot is drawn a bit larger than the physics units so it fills the plate
const PUSH = 1.6; // rad/s of tilt rate one shove adds
const RAD = 180 / Math.PI;

function createState() {
  const s = createStore({
    kp: DEFAULT_GAINS.kp,
    ki: DEFAULT_GAINS.ki,
    kd: DEFAULT_GAINS.kd,
    tilt: 0, // degrees, for the readout
    tiltHist: [], // last ~120 tilt samples for the graph
    fallen: false,
  });
  s.frame.keys = new Set();
  s.frame.sim = initialState(); // physics state lives here (never re-renders)
  s.frame.pendingPush = 0; // shove requested by the panel, consumed next frame
  s.frame.n = 0; // frame counter (graph sampling)
  return s;
}

/** One wheel: a tyre (torus) whose axle points along z, a hub, and a few spokes so you can see it spin. */
function Wheel({ spokes, label, ...rest }) {
  return (
    <group {...rest}>
      <Wire kind="torus" args={[R - 0.035, 0.035, 8, 24]} label={label} />
      <Wire kind="cyl" args={[0.06, 0.06, 0.1, 12]} rotation={[Math.PI / 2, 0, 0]} edge={EDGE_SOFT} />
      {Array.from({ length: spokes }).map((_, i) => (
        <Wire key={i} kind="box" args={[0.025, (R - 0.05) * 2, 0.025]} rotation={[0, 0, (i * Math.PI) / spokes]} edge={EDGE_SOFT} />
      ))}
    </group>
  );
}

function Model({ state, mode = 'hero' }) {
  const hero = mode === 'hero';
  const root = useRef(); // slides along x with the wheels
  const body = useRef(); // tilts about the axle
  const wheelL = useRef();
  const wheelR = useRef();
  const eyeL = useRef();
  const eyeR = useRef();
  const gl = useThree((t) => t.gl);
  const tmp = useMemo(() => ({ a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3() }), []);

  useFrame((sc, rawDt) => {
    const f = state.frame;
    const sim = f.sim;
    const dt = Math.min(rawDt, 1 / 30); // tab switches must not explode the integrator
    const gains = hero ? state.get() : DEFAULT_GAINS;

    if (hero) {
      if (f.pendingPush) {
        push(sim, f.pendingPush);
        f.pendingPush = 0;
      }
    } else {
      // mini: tiny random nudges so the PID is visibly working
      push(sim, (Math.random() - 0.5) * 0.12);
    }
    step(sim, gains, dt);

    // ---- drive the 3D parts from the physics ----
    if (root.current) root.current.position.x = sim.x;
    if (body.current) body.current.rotation.z = -sim.theta; // +theta = lean toward +x
    // rolling: wheel angle from distance travelled (the drawn wheel radius is BODY_SCALE·R)
    const spin = -sim.x / (R * BODY_SCALE);
    if (wheelL.current) wheelL.current.rotation.z = spin;
    if (wheelR.current) wheelR.current.rotation.z = spin;
    // "face": eyes glow harder the harder the controller is working; dim when fallen
    const effort = sim.fallen ? 0.15 : 1 + Math.min(1.5, Math.abs(sim.u) / 6);
    if (eyeL.current) eyeL.current.material.emissiveIntensity = effort;
    if (eyeR.current) eyeR.current.material.emissiveIntensity = effort;

    // ---- cheap reactive updates for the panel ----
    if (hero) {
      f.n++;
      if (f.n % 3 === 0) {
        const deg = sim.theta * RAD;
        const hist = state.get().tiltHist.slice(-119);
        hist.push(deg);
        const patch = { tilt: deg, tiltHist: hist };
        if (sim.fallen !== state.get().fallen) patch.fallen = sim.fallen;
        state.set(patch);
      }
    }
  });

  // Click the top of the robot to shove it away from the side you clicked (screen space).
  const onPush = useCallback(
    (e) => {
      e.stopPropagation();
      if (!root.current || state.frame.sim.fallen) return;
      const { a, b, c } = tmp;
      root.current.localToWorld(a.set(0, R + 0.6, 0)).project(e.camera); // body centre on screen
      root.current.localToWorld(b.set(1, R + 0.6, 0)).project(e.camera); // where world +x points on screen
      c.copy(e.point).project(e.camera); // the click
      const clickSide = Math.sign(c.x - a.x) || 1; // +1 = clicked right of centre
      const plusX = Math.sign(b.x - a.x) || 1; // +1 = world +x is screen-right
      state.frame.pendingPush = -clickSide * plusX * PUSH; // shove away from the click
    },
    [state, tmp],
  );

  const spokes = hero ? 5 : 3;
  const pointer = hero ? { onPointerDown: onPush, onPointerOver: () => (gl.domElement.style.cursor = 'pointer'), onPointerOut: () => (gl.domElement.style.cursor = '') } : {};

  return (
    <group>
      {/* ground plate with end stops (does not explode) */}
      {hero && (
        <group>
          <Wire kind="box" args={[2.9, 0.04, 1.3]} position={[0, -0.02, 0]} explode={false} edge={EDGE_SOFT} />
          <Wire kind="box" args={[0.06, 0.14, 1.3]} position={[X_LIMIT + 0.12, 0.07, 0]} explode={false} edge={EDGE_SOFT} />
          <Wire kind="box" args={[0.06, 0.14, 1.3]} position={[-X_LIMIT - 0.12, 0.07, 0]} explode={false} edge={EDGE_SOFT} />
        </group>
      )}

      <group ref={root} scale={BODY_SCALE}>
        {/* wheels: axle along z, spin about z as the robot rolls */}
        <Wheel ref={wheelL} position={[0, R, WHEEL_Z]} spokes={spokes} label="Wheel" />
        <Wheel ref={wheelR} position={[0, R, -WHEEL_Z]} spokes={spokes} />

        {/* everything below is rigidly attached to the tilting body; y is relative to the axle */}
        <group ref={body} position={[0, R, 0]}>
          {/* motor block between the wheels + the two N20 gear motors */}
          <Wire kind="box" args={[0.3, 0.16, 0.36]} position={[0, 0, 0]} />
          <Wire kind="cyl" args={[0.045, 0.045, 0.1, 12]} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.23]} label="Gear motor" />
          <Wire kind="cyl" args={[0.045, 0.045, 0.1, 12]} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.23]} />

          {/* vertical frame */}
          <Strut from={[0.16, 0.08, 0]} to={[0.16, 0.92, 0]} thick={0.035} label="Frame" />
          <Strut from={[-0.16, 0.08, 0]} to={[-0.16, 0.92, 0]} thick={0.035} />
          {hero && <Strut from={[-0.16, 0.12, 0]} to={[0.16, 0.38, 0]} thick={0.02} edge={EDGE_SOFT} />}
          {hero && <Strut from={[0.16, 0.12, 0]} to={[-0.16, 0.38, 0]} thick={0.02} edge={EDGE_SOFT} />}

          {/* battery pack low down (keeps the centre of mass sensible) */}
          <Wire kind="box" args={[0.26, 0.09, 0.17]} position={[0, 0.25, 0]} label="Battery" />

          {/* mid deck with the IMU chip */}
          <Wire kind="box" args={[0.42, 0.025, 0.3]} position={[0, 0.42, 0]} />
          <Wire kind="box" args={[0.07, 0.02, 0.05]} position={[0.06, 0.445, 0.06]} label="IMU" />
          <Led position={[0.06, 0.465, 0.06]} size={0.014} />

          {/* top deck with the controller board and the face */}
          <Wire kind="box" args={[0.42, 0.025, 0.3]} position={[0, 0.78, 0]} {...pointer} />
          <Wire kind="box" args={[0.24, 0.015, 0.18]} position={[0, 0.8, -0.03]} label="Controller" />
          <Wire kind="box" args={[0.06, 0.02, 0.1]} position={[-0.07, 0.815, -0.03]} edge={EDGE_SOFT} />
          {hero && <Wire kind="box" args={[0.04, 0.015, 0.04]} position={[0.04, 0.815, -0.06]} edge={EDGE_SOFT} />}
          <Led position={[0.1, 0.82, 0.02]} size={0.012} />

          {/* face display: a bezel + glass screen + two LED eyes. Clicking it shoves the robot. */}
          <Wire kind="box" args={[0.3, 0.19, 0.02]} position={[0, 0.9, 0.09]} {...pointer} />
          <Wire kind="box" args={[0.27, 0.16, 0.03]} position={[0, 0.9, 0.11]} glass explode={false} />
          <Led ref={eyeL} position={[-0.06, 0.91, 0.125]} size={0.022} />
          <Led ref={eyeR} position={[0.06, 0.91, 0.125]} size={0.022} />
        </group>
      </group>
    </group>
  );
}

function Panel({ state }) {
  const kp = useStore(state, (s) => s.kp);
  const ki = useStore(state, (s) => s.ki);
  const kd = useStore(state, (s) => s.kd);
  const tilt = useStore(state, (s) => s.tilt);
  const hist = useStore(state, (s) => s.tiltHist);
  const fallen = useStore(state, (s) => s.fallen);
  const shove = (dir) => (state.frame.pendingPush = dir * PUSH);
  const standUp = () => {
    reset(state.frame.sim);
    state.set({ fallen: false, tilt: 0, tiltHist: [] });
  };
  return (
    <>
      <Slider label="P gain" min={0} max={60} step={1} value={kp} onChange={(v) => state.set({ kp: v })} />
      <Slider label="I gain" min={0} max={5} step={0.1} value={ki} onChange={(v) => state.set({ ki: v })} format={(v) => v.toFixed(1)} />
      <Slider label="D gain" min={0} max={8} step={0.1} value={kd} onChange={(v) => state.set({ kd: v })} format={(v) => v.toFixed(1)} />
      <Row>
        <Btn small disabled={fallen} onClick={() => shove(-1)}>
          ← Push left
        </Btn>
        <Btn small disabled={fallen} onClick={() => shove(1)}>
          Push right →
        </Btn>
      </Row>
      {fallen ? (
        <Row>
          <span className="mono text-[10px] tracking-[0.18em]" style={{ color: 'var(--blue-glow)' }}>
            FELL — RESET
          </span>
          <Btn primary small onClick={standUp}>
            Stand up
          </Btn>
        </Row>
      ) : (
        <Readout label="Tilt" value={tilt.toFixed(1)} unit="°" />
      )}
      <MiniGraph label="Tilt · last 6 s" values={hist} min={-30} max={30} />
    </>
  );
}

export default {
  slug: 'balancer',
  name: 'Self-balancing Robot',
  tag: 'CONTROL',
  category: 'ground',
  fit: 2.6,
  oneLiner: 'Push it. Watch PID catch it.',
  blurb:
    'A two-wheeled inverted pendulum: the body wants to fall over, and the only thing stopping it is a control loop running 200 times a second. An MPU-6050 measures the tilt, an ESP32 runs the PID maths and two N20 gear motors drive the wheels under the falling body. It is our standard first project for new members because every gain you tune has a visible effect.',
  specs: [
    ['Sensor', 'MPU-6050 IMU (gyro + accel)'],
    ['Brain', 'ESP32, 200 Hz loop'],
    ['Motors', '2 × N20 6 V gear, 300 rpm'],
    ['Driver', 'TB6612FNG dual H-bridge'],
    ['Battery', '2S Li-ion 18650, 7.4 V'],
    ['Mass', '≈ 310 g'],
  ],
  tech: ['ESP32', 'MPU-6050', 'PID', 'Complementary filter', 'TB6612FNG', 'PlatformIO'],
  howItWorks: [
    { title: 'Sense', text: 'The IMU gyro gives tilt rate, the accelerometer gives a noisy tilt angle; a complementary filter blends them into one clean tilt value.' },
    { title: 'Think', text: 'PID: P pushes against the lean, D fights the lean rate so it does not overshoot, I removes the slow steady-state lean caused by an off-centre battery.' },
    { title: 'Act', text: 'The output is a wheel acceleration. The motors drive the wheels under the body — accelerating toward the fall is what stands it back up.' },
  ],
  buildLog: [
    { date: '2025-02', title: 'Cardboard-and-tape prototype', text: 'Balanced for 4 seconds before the wheels slipped. Good enough to prove the loop.' },
    { date: '2025-04', title: 'Laser-cut acrylic frame', text: 'Stacked decks on M3 standoffs, battery moved to the bottom to lower the centre of mass.' },
    { date: '2025-07', title: 'Gyro drift fixed', text: 'Switched from raw accel angle to a complementary filter (0.98 gyro / 0.02 accel). Night-and-day difference.' },
    { date: '2025-11', title: 'Encoders + position hold', text: 'N20 motors with magnetic encoders so it stops wandering across the table.' },
    { date: '2026-03', title: 'Workshop kit', text: 'Ten kits built for the freshers’ PID workshop; tuning contest won with Kp 34, Kd 4.' },
  ],
  controlsHelp: 'Click the robot (or use Push) to shove it. Drop P until it falls, drop D until it wobbles.',
  mobileKeys: null,
  createState,
  Model,
  Panel,
};
