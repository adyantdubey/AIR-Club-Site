import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Wire, Led, Strut, GLOW, EDGE_SOFT } from '../../three/wire';
import { createStore, useStore } from '../../lib/store';
import { clamp, damp, lerp, useDragOnPlane } from '../../three/helpers';
import { Slider, Toggle, Readout, Row, Btn } from '../../components/ui/Controls';
import { L1, L2, SHOULDER_Y, solveArm, deg } from './ik';

// ---------- constants ----------
const BALL_R = 0.09;
const OUT_COLOR = '#ff6b7a'; // ball tint when the target is out of reach
const OPEN = 0.17; // finger half-gap when open
const CLOSED = BALL_R + 0.008; // finger half-gap when holding the ball
const HOME = { yaw: 0, a1: 1.25, a2: -2.1, wrist: -0.72 }; // folded "home" pose (rad)
// The two pick-and-place slots on the work mat (ball centre positions)
const SLOT_A = new THREE.Vector3(0.85, BALL_R, 0.45);
const SLOT_B = new THREE.Vector3(0.6, BALL_R, -0.65);
const JOINT_NAMES = ['Base yaw', 'Shoulder', 'Elbow', 'Wrist pitch', 'Wrist roll', 'Gripper'];

function createState() {
  const s = createStore({ speed: 1, showAngles: false, angles: [0, 0, 0, 0, 0, 0], inReach: true });
  fillFrame(s.frame);
  return s;
}

// Per-frame data lives in store.frame (never triggers React renders). Called again after reset().
function fillFrame(f) {
  if (f.target) return f;
  f.keys = f.keys || new Set();
  f.target = SLOT_A.clone(); // the glowing ball the user drags (model-space)
  f.goal = SLOT_A.clone(); // where the gripper should go (usually == target)
  f.angles = { ...HOME, roll: 0 }; // current (smoothed) joint angles
  f.grip = OPEN; // current finger half-gap
  f.gripGoal = OPEN;
  f.lastInput = -10; // clock time of the last drag
  f.dragging = false;
  f.homing = 0; // seconds left of "go to home pose"
  f.auto = { phase: 'approach', t: 0, from: SLOT_A.clone(), to: SLOT_B.clone(), reachable: true };
  f.tick = 0;
  f.reachable = true;
  return f;
}

// ---------- the automatic pick-and-place loop ----------
// Phases: approach (arm goes to the ball) → grab → carry (ball moves along an arc) →
// release → retreat (arm lifts away) → pause → swap slots and repeat.
const PHASES = { approach: 2.2, grab: 0.45, carry: 1.6, release: 0.4, retreat: 0.7, pause: 0.5 };
function stepAuto(f, dt, speed, tipDist) {
  const a = f.auto;
  a.t += dt * speed;
  const s = clamp(a.t / PHASES[a.phase], 0, 1);
  switch (a.phase) {
    case 'approach':
      f.goal.copy(f.target);
      f.gripGoal = OPEN;
      if (tipDist < 0.02 || s >= 1) next(a, 'grab');
      break;
    case 'grab':
      f.gripGoal = CLOSED;
      if (s >= 1) {
        a.from.copy(f.target);
        // the other slot is the destination; if the ball is nearer to B, go to A
        a.to.copy(f.target.distanceTo(SLOT_A) < f.target.distanceTo(SLOT_B) ? SLOT_B : SLOT_A);
        next(a, 'carry');
      }
      break;
    case 'carry': {
      const e = s * s * (3 - 2 * s); // smoothstep
      f.target.lerpVectors(a.from, a.to, e);
      f.target.y = lerp(a.from.y, a.to.y, e) + Math.sin(s * Math.PI) * 0.38; // lift over the mat
      f.goal.copy(f.target);
      if (s >= 1) next(a, 'release');
      break;
    }
    case 'release':
      f.gripGoal = OPEN;
      if (s >= 1) next(a, 'retreat');
      break;
    case 'retreat':
      f.goal.copy(f.target);
      f.goal.y += 0.35 * Math.min(1, s * 2);
      if (s >= 1) next(a, 'pause');
      break;
    default:
      if (s >= 1) next(a, 'approach');
  }
}
function next(a, phase) {
  a.phase = phase;
  a.t = 0;
}

// ---------- 3D model ----------
function Model({ state, mode = 'hero', controlsRef }) {
  const hero = mode === 'hero';
  const root = useRef();
  const turntable = useRef();
  const shoulder = useRef();
  const elbow = useRef();
  const wristPitch = useRef();
  const wristRoll = useRef();
  const fingerL = useRef();
  const fingerR = useRef();
  const ball = useRef();
  const ballHit = useRef();
  const leds = useRef([]);
  const tip = useMemo(() => new THREE.Vector3(), []);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const ballColor = useMemo(() => new THREE.Color(GLOW), []);
  const outColor = useMemo(() => new THREE.Color(OUT_COLOR), []);
  const glowColor = useMemo(() => new THREE.Color(GLOW), []);

  // Drag the ball on a camera-facing plane. Pointer positions arrive in world space,
  // but the viewer scales/centres the model, so convert into our own (model) space.
  const drag = useDragOnPlane({
    controlsRef,
    onStart: () => {
      const f = fillFrame(state.frame);
      f.dragging = true;
      f.homing = 0;
    },
    onMove: (p) => {
      const f = fillFrame(state.frame);
      if (root.current) root.current.worldToLocal(p);
      f.target.set(clamp(p.x, -1.6, 1.6), clamp(p.y, BALL_R, 1.6), clamp(p.z, -1.6, 1.6));
      f.goal.copy(f.target);
      f.lastInput = f.now;
    },
    onEnd: () => {
      const f = fillFrame(state.frame);
      f.dragging = false;
      f.lastInput = f.now;
      f.auto.phase = 'approach';
      f.auto.t = 0;
    },
  });

  useFrame((sc, dt) => {
    dt = Math.min(dt, 0.05);
    const t = sc.clock.elapsedTime;
    const f = fillFrame(state.frame);
    const cfg = state.get();
    const speed = cfg.speed;
    f.now = t;

    // where is the gripper tip right now? (model space, needed by the auto loop)
    if (wristRoll.current && root.current) {
      tmp.set(0.33, 0, 0); // finger centre in the roll group's frame
      wristRoll.current.localToWorld(tmp);
      root.current.worldToLocal(tmp);
      tip.copy(tmp);
    }
    const tipDist = tip.distanceTo(f.target);
    f.tipDist = tipDist; // handy for debugging / tests

    // Decide who is in charge: user drag, home button, or the auto loop.
    const idle = hero ? !f.dragging && t - f.lastInput > 2 : true;
    if (f.homing > 0) {
      f.homing -= dt;
      f.gripGoal = OPEN;
    } else if (idle) {
      stepAuto(f, dt, speed, tipDist);
    } else {
      f.goal.copy(f.target);
      // close the fingers once the arm has settled on the ball
      f.gripGoal = !f.dragging && tipDist < 0.03 ? CLOSED : OPEN;
    }

    // Solve IK for the goal point and ease each joint toward it (servo-like motion).
    let sol;
    if (f.homing > 0) sol = { ...HOME, reachable: true };
    else sol = solveArm(f.goal.x, f.goal.y, f.goal.z);
    const A = f.angles;
    const k = 7 * speed; // higher = snappier joints
    // unwrap yaw so the base takes the short way round
    let yawGoal = sol.yaw;
    while (yawGoal - A.yaw > Math.PI) yawGoal -= Math.PI * 2;
    while (yawGoal - A.yaw < -Math.PI) yawGoal += Math.PI * 2;
    A.yaw = damp(A.yaw, yawGoal, k, dt);
    A.a1 = damp(A.a1, sol.a1, k, dt);
    A.a2 = damp(A.a2, sol.a2, k, dt);
    A.wrist = damp(A.wrist, sol.wrist, k, dt);
    const rollGoal = f.auto.phase === 'carry' || f.gripGoal === CLOSED ? 0 : Math.sin(t * 0.7) * 0.6;
    A.roll = damp(A.roll, rollGoal, 3, dt);
    f.grip = damp(f.grip, f.gripGoal, 10 * speed, dt);

    if (turntable.current) turntable.current.rotation.y = A.yaw;
    if (shoulder.current) shoulder.current.rotation.z = A.a1;
    if (elbow.current) elbow.current.rotation.z = A.a2;
    if (wristPitch.current) wristPitch.current.rotation.z = A.wrist;
    if (wristRoll.current) wristRoll.current.rotation.x = A.roll;
    if (fingerL.current) fingerL.current.position.y = f.grip;
    if (fingerR.current) fingerR.current.position.y = -f.grip;

    // The ball: sits at the target; tinted red when the arm cannot reach it.
    if (ball.current) {
      ball.current.position.copy(f.target);
      if (ballHit.current) ballHit.current.position.copy(f.target);
      const m = ball.current.material;
      ballColor.lerpColors(glowColor, outColor, sol.reachable ? 0 : 1);
      m.color.copy(ballColor);
      m.emissive.copy(ballColor);
      m.emissiveIntensity = (sol.reachable ? 1.7 : 0.7) + Math.sin(t * 4) * 0.15;
    }
    // servo status LEDs blink faster while the arm is moving
    const moving = Math.abs(sol.a1 - A.a1) + Math.abs(sol.a2 - A.a2) > 0.02;
    leds.current.forEach((l, i) => {
      if (l) l.material.emissiveIntensity = 1 + (moving ? Math.sin(t * 12 + i) * 0.7 : Math.sin(t * 2 + i) * 0.25);
    });

    // Cheap reactive updates for the Panel (never per frame).
    if (hero) {
      if (f.reachable !== sol.reachable) {
        f.reachable = sol.reachable;
        state.set({ inReach: sol.reachable });
      }
      f.tick += dt;
      if (cfg.showAngles && f.tick > 1 / 8) {
        f.tick = 0;
        state.set({ angles: [deg(A.yaw), deg(A.a1), deg(A.a2), deg(A.wrist), deg(A.roll), Math.round(((OPEN - f.grip) / (OPEN - CLOSED)) * 90)] });
      }
    }
  });

  return (
    <group ref={root}>
      {/* work mat: does not explode, only in hero mode */}
      {hero && <Wire kind="box" args={[2.4, 0.04, 1.9]} position={[0.25, -0.02, 0]} explode={false} edge="#1d3f7a" />}

      {/* ---- fixed base ---- */}
      <Wire kind="cyl" args={[0.5, 0.52, 0.06, 24]} position={[0, 0.03, 0]} label="Base plate" />
      {hero &&
        [0, 1, 2, 3].map((i) => {
          const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
          return <Wire key={i} kind="cyl" args={[0.03, 0.03, 0.03, 8]} position={[Math.cos(a) * 0.42, 0.075, Math.sin(a) * 0.42]} />;
        })}
      <Wire kind="box" args={[0.18, 0.1, 0.14]} position={[-0.32, 0.11, 0.3]} edge={EDGE_SOFT} />
      <Led ref={(el) => (leds.current[0] = el)} position={[-0.32, 0.17, 0.3]} size={0.025} />

      {/* ---- turntable (base yaw) ---- */}
      <group ref={turntable} position={[0, 0.06, 0]}>
        <Wire kind="cyl" args={[0.32, 0.34, 0.12, 24]} position={[0, 0.06, 0]} label="Base turntable" />
        <Wire kind="torus" args={[0.33, 0.015, 8, 32]} position={[0, 0.125, 0]} rotation={[Math.PI / 2, 0, 0]} edge={EDGE_SOFT} />
        {/* shoulder brackets */}
        <Wire kind="box" args={[0.12, 0.34, 0.04]} position={[0, 0.28, 0.14]} />
        <Wire kind="box" args={[0.12, 0.34, 0.04]} position={[0, 0.28, -0.14]} />
        {/* shoulder servo on the side of the bracket */}
        <Wire kind="box" args={[0.22, 0.18, 0.16]} position={[0, 0.42, 0.24]} label="Shoulder servo" />
        <Led ref={(el) => (leds.current[1] = el)} position={[0.08, 0.52, 0.24]} size={0.025} />
        <Wire kind="cyl" args={[0.05, 0.05, 0.36, 12]} position={[0, 0.42, 0]} rotation={[Math.PI / 2, 0, 0]} />
        {hero && <Strut from={[-0.2, 0.15, 0.2]} to={[-0.08, 0.42, 0.3]} thick={0.015} edge={EDGE_SOFT} />}

        {/* ---- shoulder joint + upper arm ---- */}
        <group ref={shoulder} position={[0, 0.42, 0]}>
          <Wire kind="box" args={[L1, 0.08, 0.04]} position={[L1 / 2, 0, 0.09]} label="Upper arm" />
          <Wire kind="box" args={[L1, 0.08, 0.04]} position={[L1 / 2, 0, -0.09]} />
          <Wire kind="box" args={[0.05, 0.12, 0.22]} position={[0.2, 0, 0]} />
          <Wire kind="box" args={[0.05, 0.12, 0.22]} position={[0.5, 0, 0]} />
          {hero && <Strut from={[0.08, 0.08, 0]} to={[L1 - 0.06, 0.08, 0]} thick={0.015} edge={EDGE_SOFT} />}
          {/* elbow servo mounted on the end of the upper arm */}
          <Wire kind="box" args={[0.18, 0.15, 0.14]} position={[L1, 0, 0.16]} label="Elbow servo" />
          <Led ref={(el) => (leds.current[2] = el)} position={[L1 + 0.06, 0.09, 0.16]} size={0.022} />
          <Wire kind="cyl" args={[0.045, 0.045, 0.24, 12]} position={[L1, 0, 0]} rotation={[Math.PI / 2, 0, 0]} />

          {/* ---- elbow joint + forearm ---- */}
          <group ref={elbow} position={[L1, 0, 0]}>
            <Wire kind="box" args={[L2, 0.1, 0.1]} position={[L2 / 2, 0, 0]} label="Forearm" />
            <Wire kind="box" args={[0.06, 0.14, 0.14]} position={[0.1, 0, 0]} />
            {hero && <Strut from={[0.1, 0.07, 0.03]} to={[L2 - 0.05, 0.07, 0.03]} thick={0.012} edge={EDGE_SOFT} />}
            {/* wrist pitch servo */}
            <Wire kind="box" args={[0.14, 0.12, 0.12]} position={[L2, 0, 0.12]} label="Wrist" />
            <Led ref={(el) => (leds.current[3] = el)} position={[L2 + 0.05, 0.07, 0.12]} size={0.02} />
            <Wire kind="cyl" args={[0.035, 0.035, 0.2, 10]} position={[L2, 0, 0]} rotation={[Math.PI / 2, 0, 0]} />

            {/* ---- wrist pitch ---- */}
            <group ref={wristPitch} position={[L2, 0, 0]}>
              <Wire kind="box" args={[0.16, 0.09, 0.09]} position={[0.08, 0, 0]} />
              {/* ---- wrist roll (spins about the wrist's own axis) ---- */}
              <group ref={wristRoll} position={[0.16, 0, 0]}>
                <Wire kind="cyl" args={[0.06, 0.06, 0.12, 12]} position={[0.06, 0, 0]} rotation={[0, 0, Math.PI / 2]} />
                {/* ---- gripper: palm + two fingers that slide apart ---- */}
                <Wire kind="box" args={[0.08, 0.26, 0.12]} position={[0.16, 0, 0]} label="Gripper" />
                <Wire kind="cyl" args={[0.015, 0.015, 0.3, 8]} position={[0.2, 0, 0.05]} />
                <group ref={fingerL} position={[0.2, OPEN, 0]}>
                  <Wire kind="box" args={[0.2, 0.03, 0.06]} position={[0.1, 0, 0]} />
                  <Wire kind="box" args={[0.05, 0.05, 0.06]} position={[0.2, -0.015, 0]} />
                </group>
                <group ref={fingerR} position={[0.2, -OPEN, 0]}>
                  <Wire kind="box" args={[0.2, 0.03, 0.06]} position={[0.1, 0, 0]} />
                  <Wire kind="box" args={[0.05, 0.05, 0.06]} position={[0.2, 0.015, 0]} />
                </group>
              </group>
            </group>
          </group>
        </group>
      </group>

      {/* ---- the target ball (Led) + a larger invisible sphere so it is easy to grab ---- */}
      <Led ref={ball} size={BALL_R} position={SLOT_A.toArray()} />
      {hero && (
        <mesh ref={ballHit} position={SLOT_A.toArray()} userData={{ explode: false }} {...drag.handlers}>
          <sphereGeometry args={[0.16, 8, 8]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

// ---------- DOM panel ----------
function Panel({ state }) {
  const speed = useStore(state, (s) => s.speed);
  const showAngles = useStore(state, (s) => s.showAngles);
  const angles = useStore(state, (s) => s.angles);
  const inReach = useStore(state, (s) => s.inReach);
  return (
    <>
      <Slider label="Speed" min={0.3} max={2} step={0.1} value={speed} onChange={(v) => state.set({ speed: v })} format={(v) => `${v.toFixed(1)}×`} />
      <Readout label="Reach" value={inReach ? 'in reach' : 'out of reach'} />
      <Toggle label="Show joint angles" value={showAngles} onChange={(v) => state.set({ showAngles: v })} />
      {showAngles && angles.map((a, i) => <Readout key={i} label={JOINT_NAMES[i]} value={Math.round(a)} unit="°" />)}
      <Row>
        <Btn
          small
          onClick={() => {
            const f = fillFrame(state.frame);
            f.homing = 1.8; // hold the home pose for a moment, then the loop resumes
            f.lastInput = f.now ?? 0;
            f.target.copy(SLOT_A);
            f.goal.copy(SLOT_A);
            f.auto.phase = 'approach';
            f.auto.t = 0;
          }}
        >
          Home position
        </Btn>
      </Row>
    </>
  );
}

export default {
  slug: 'arm',
  name: 'Robotic Arm',
  tag: 'MANIPULATION',
  category: 'manipulation',
  fit: 2.6,
  oneLiner: '6-axis arm that reaches any point you drag.',
  blurb:
    'A desktop 6-axis arm we built to learn kinematics the hard way. An Arduino Mega drives six servos through a PCA9685 board, and our own inverse-kinematics code turns an (x, y, z) target into joint angles fast enough to follow a moving point. It picks, places and sorts coloured blocks at club demos.',
  specs: [
    ['DOF', '6 (yaw, shoulder, elbow, wrist pitch, wrist roll, gripper)'],
    ['Reach', '420 mm'],
    ['Payload', '≈ 350 g'],
    ['Servos', 'MG996R × 4, MG90S × 2'],
    ['Control', 'Arduino Mega + PCA9685'],
    ['Repeatability', '≈ ±3 mm'],
  ],
  tech: ['Arduino Mega', 'PCA9685', 'MG996R', 'Analytic IK', 'PLA + 2020 extrusion'],
  howItWorks: [
    { title: 'Sense', text: 'A target point comes from the joystick, a serial command or the demo script; the potentiometer in each servo reports where the joint is now.' },
    { title: 'Think', text: 'The Mega computes base yaw with atan2, then solves the shoulder and elbow as a two-link triangle (law of cosines) and keeps the wrist pointing down.' },
    { title: 'Act', text: 'The PCA9685 sends 50 Hz PWM to six servos; angles are eased over a few frames so the arm moves smoothly instead of snapping.' },
  ],
  buildLog: [
    { date: '2025-02', title: 'First joint moves', text: 'Single MG996R on a breadboard, driven from a potentiometer.' },
    { date: '2025-05', title: 'Printed arm assembled', text: 'PLA links on 2020 extrusion; the shoulder servo stalled until we added a second one in parallel.' },
    { date: '2025-09', title: 'IK solver working', text: 'Analytic 2-link solution replaced a slow numerical one; the arm now tracks a moving point at 30 Hz.' },
    { date: '2026-01', title: 'Parallel gripper', text: 'Rack-and-pinion gripper with rubber pads; holds a 40 mm cube reliably.' },
    { date: '2026-04', title: 'Colour-sort demo', text: 'Camera picks blocks by colour and the arm sorts them into bins at the open day.' },
  ],
  controlsHelp: 'Drag the blue ball anywhere. Leave it for 2 s and the arm runs its pick-and-place loop.',
  mobileKeys: null,
  createState,
  Model,
  Panel,
};
