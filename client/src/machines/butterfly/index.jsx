import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Wire, Led, Strut, EDGE_SOFT, GLOW } from '../../three/wire';
import { createStore, useStore } from '../../lib/store';
import { clamp, damp } from '../../three/helpers';
import { Slider, Toggle, Readout, Row } from '../../components/ui/Controls';
import { FOREWING, HINDWING, FORE_VEINS, HIND_VEINS, HIND_LAG, wingGeometry, outlinePoints, wingAngles, isDownstroke } from './wings';

const PERCH_Y = 0.42; // body height when sitting on the twig
const LIFT = 0.8; // how high it climbs when flying
const RADIUS = 0.9; // circle radius around the pedestal centre
const SPEED = 1.25; // flight speed (units/s)
const TRAIL_N = 200; // dust particles (ring buffer)

function createState() {
  const s = createStore({ flapRate: 3, slowmo: false, phase: 0, down: true, flying: false });
  s.frame.keys = new Set();
  s.frame.holdFly = false; // panel button held
  s.frame.phase = 0; // stroke phase in cycles
  s.frame.air = 0; // 0 = perched … 1 = flying (blends height, radius, amplitude)
  s.frame.ang = 0; // angle around the circle
  s.frame.yaw = 0;
  s.frame.prev = null; // last position, for velocity
  s.frame.n = 0;
  s.frame.trailT = 0;
  s.frame.trailI = 0;
  return s;
}

/** One wing: hinge group → veins + translucent membrane + glowing outline. Geometry is for the right side. */
function Wing({ outline, veins, geometry, labelWing, labelVein, ...rest }) {
  const edgePts = useMemo(() => outlinePoints(outline), [outline]);
  return (
    <group {...rest}>
      {veins.map(([x, z], i) => (
        <Strut key={i} from={[0, 0.006, 0]} to={[x, 0.006, z]} thick={0.014} edge={i === 0 ? undefined : EDGE_SOFT} label={i === 0 ? labelVein : undefined} />
      ))}
      <Wire geometry={<primitive object={geometry} attach="geometry" />} rotation={[-Math.PI / 2, 0, 0]} glass explode={false} label={labelWing} />
      {/* the film's edge (the carbon rod that frames the wing) */}
      <lineLoop>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[edgePts, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color={GLOW} transparent opacity={0.7} />
      </lineLoop>
    </group>
  );
}

// tiny point shader so each dust mote can shrink and fade on its own
const TRAIL_VERT = `
  attribute float aSize; varying float vA;
  void main() { vA = aSize; vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * 55.0 / -mv.z; gl_Position = projectionMatrix * mv; }`;
const TRAIL_FRAG = `
  uniform vec3 uColor; varying float vA;
  void main() { float d = length(gl_PointCoord - 0.5); if (d > 0.5 || vA < 0.02) discard;
    gl_FragColor = vec4(uColor, (0.5 - d) * 1.6 * vA); }`;

function Model({ state, mode = 'hero' }) {
  const hero = mode === 'hero';
  const bird = useRef(); // whole butterfly: position + heading + bank
  const bob = useRef(); // body bob inside it
  const crank = useRef();
  const wings = useRef([]); // [foreR, foreL, hindR, hindL] hinge groups
  const trailGeom = useRef();
  const foreGeom = useMemo(() => wingGeometry(FOREWING), []);
  const hindGeom = useMemo(() => wingGeometry(HINDWING), []);
  const trail = useMemo(() => ({ pos: new Float32Array(TRAIL_N * 3), size: new Float32Array(TRAIL_N) }), []);
  const trailMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uColor: { value: new THREE.Color(GLOW) } },
        vertexShader: TRAIL_VERT,
        fragmentShader: TRAIL_FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );
  const tmp = useMemo(() => ({ p: new THREE.Vector3() }), []);

  useFrame((sc, rawDt) => {
    const f = state.frame;
    const cfg = state.get();
    const dt = Math.min(rawDt, 1 / 30) * (hero && cfg.slowmo ? 0.25 : 1);

    // ---- flight state ----
    const fly = hero && (f.holdFly || f.keys.has(' '));
    f.air = damp(f.air, fly ? 1 : 0, fly ? 2.2 : 1.1, dt); // quick take-off, lazy glide down
    const air = f.air;
    const rate = hero ? cfg.flapRate * (0.35 + 0.65 * air) : 1.1; // perched = lazy pumps
    f.phase += rate * dt;
    const amp = hero ? 0.42 + 0.58 * air : 0.45;

    // circle around the pedestal centre; radius and height both scale with `air`
    const r = RADIUS * air;
    if (air > 0.02) f.ang += (SPEED / Math.max(r, 0.35)) * air * dt;
    const px = r * Math.cos(f.ang);
    const pz = r * Math.sin(f.ang);
    const py = PERCH_Y + LIFT * air;
    const p = tmp.p.set(px, py, pz);

    // heading follows the velocity; bank into the turn; nose up while climbing
    let yawT = 0;
    let vy = 0;
    if (f.prev) {
      const vx = (px - f.prev.x) / dt;
      const vz = (pz - f.prev.z) / dt;
      vy = (py - f.prev.y) / dt;
      if (air < 0.12) yawT = 0; // settled on the twig: face forward again
      else if (vx * vx + vz * vz > 0.01) yawT = Math.atan2(vx, vz);
      else yawT = f.yaw;
    } else f.prev = new THREE.Vector3();
    f.prev.copy(p);
    let dYaw = yawT - f.yaw;
    dYaw = Math.atan2(Math.sin(dYaw), Math.cos(dYaw)); // shortest way round
    f.yaw += dYaw * (1 - Math.exp(-6 * dt));
    if (bird.current) {
      bird.current.position.copy(p);
      bird.current.rotation.set(-clamp(vy * 0.5, -0.4, 0.4) - 0.1 * air, f.yaw, -0.55 * air);
    }

    // ---- wings: figure-8 stroke, hindwings lag, body bobs with the downstroke ----
    const w = wings.current;
    const fore = wingAngles(f.phase, amp);
    const hind = wingAngles(f.phase - HIND_LAG, amp * 0.9);
    for (let i = 0; i < 4; i++) {
      const g = w[i];
      if (!g) continue;
      const a = i < 2 ? fore : hind;
      g.rotation.set(a.pitch, a.sweep, a.flap);
    }
    if (crank.current) crank.current.rotation.x = f.phase * Math.PI * 2;
    if (bob.current) bob.current.position.y = -0.035 * Math.sin(f.phase * Math.PI * 2) * (0.4 + 0.6 * air);

    if (!hero) return;

    // ---- dust trail: ring buffer of motes that shrink away ----
    const { pos, size } = trail;
    for (let i = 0; i < TRAIL_N; i++) if (size[i] > 0) size[i] = Math.max(0, size[i] - dt * 0.9);
    f.trailT += dt;
    if (air > 0.3 && f.trailT > 0.03) {
      f.trailT = 0;
      const i = f.trailI;
      f.trailI = (i + 1) % TRAIL_N;
      pos[i * 3] = px + (Math.random() - 0.5) * 0.08;
      pos[i * 3 + 1] = py - 0.08 + (Math.random() - 0.5) * 0.05;
      pos[i * 3 + 2] = pz + (Math.random() - 0.5) * 0.08;
      size[i] = 1;
    }
    if (trailGeom.current) {
      trailGeom.current.attributes.position.needsUpdate = true;
      trailGeom.current.attributes.aSize.needsUpdate = true;
    }

    // ---- panel readouts, ~10 Hz ----
    f.n++;
    if (f.n % 6 === 0) {
      const ph = ((f.phase % 1) + 1) % 1;
      state.set({ phase: ph, down: isDownstroke(ph), flying: fly });
    }
  });

  const setWing = (i) => (el) => (wings.current[i] = el);
  // hinge positions on the body (right side; the left side is mirrored)
  const FORE_POS = [0.06, 0.03, 0.06];
  const HIND_POS = [0.05, 0.02, -0.1];

  return (
    <group>
      {/* the perch: a twig on a short stalk, fixed to the floor */}
      <Wire kind="cyl" args={[0.025, 0.045, 0.34, 8]} position={[0, 0.17, 0]} rotation={[0, 0, 0.12]} explode={false} edge={EDGE_SOFT} />
      <Wire kind="cyl" args={[0.018, 0.028, 0.7, 8]} position={[0, 0.34, 0]} rotation={[0, 0.5, Math.PI / 2 - 0.1]} explode={false} edge={EDGE_SOFT} />

      {hero && (
        <points frustumCulled={false} material={trailMat}>
          <bufferGeometry ref={trailGeom}>
            <bufferAttribute attach="attributes-position" args={[trail.pos, 3]} />
            <bufferAttribute attach="attributes-aSize" args={[trail.size, 1]} />
          </bufferGeometry>
        </points>
      )}

      <group ref={bird} position={[0, PERCH_Y, 0]} rotation-order="YXZ">
        <group ref={bob}>
          {/* body: thorax, abdomen, head */}
          <Wire kind="cyl" args={[0.065, 0.055, 0.28, 10]} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0]} />
          <Wire kind="cyl" args={[0.045, 0.018, 0.46, 8]} rotation={[Math.PI / 2, 0, 0]} position={[0, -0.01, -0.36]} />
          <Wire kind="sphere" args={[0.06, 10, 8]} position={[0, 0.01, 0.2]} />
          {/* antennae with LED tips (also the nav lights) */}
          <Strut from={[0.03, 0.05, 0.23]} to={[0.13, 0.22, 0.42]} thick={0.01} label="Antenna" />
          <Strut from={[-0.03, 0.05, 0.23]} to={[-0.13, 0.22, 0.42]} thick={0.01} />
          <Led position={[0.13, 0.22, 0.42]} size={0.018} />
          <Led position={[-0.13, 0.22, 0.42]} size={0.018} />
          {/* crank motor on the thorax: the crank spins once per wingbeat */}
          <Wire kind="box" args={[0.09, 0.06, 0.1]} position={[0, 0.085, 0.0]} label="Crank motor" />
          <group ref={crank} position={[0, 0.1, 0.07]}>
            <Wire kind="box" args={[0.16, 0.012, 0.03]} />
          </group>
          {/* battery under the thorax, receiver on the abdomen root */}
          <Wire kind="box" args={[0.06, 0.04, 0.13]} position={[0, -0.075, -0.02]} label="Battery" />
          <Wire kind="box" args={[0.05, 0.022, 0.06]} position={[0, 0.055, -0.14]} label="Receiver" />
          {/* tail fins */}
          <Wire kind="box" args={[0.13, 0.008, 0.11]} position={[0.07, -0.005, -0.58]} rotation={[0, 0.45, 0]} edge={EDGE_SOFT} />
          <Wire kind="box" args={[0.13, 0.008, 0.11]} position={[-0.07, -0.005, -0.58]} rotation={[0, -0.45, 0]} edge={EDGE_SOFT} />

          {/* right wings */}
          <Wing ref={setWing(0)} position={FORE_POS} rotation-order="ZYX" outline={FOREWING} veins={FORE_VEINS} geometry={foreGeom} labelWing="Forewing" labelVein="Wing vein" />
          <Wing ref={setWing(2)} position={HIND_POS} rotation-order="ZYX" outline={HINDWING} veins={HIND_VEINS} geometry={hindGeom} labelWing="Hindwing" />
          {/* left wings: same parts inside a mirrored group */}
          <group scale={[-1, 1, 1]}>
            <Wing ref={setWing(1)} position={FORE_POS} rotation-order="ZYX" outline={FOREWING} veins={FORE_VEINS} geometry={foreGeom} />
            <Wing ref={setWing(3)} position={HIND_POS} rotation-order="ZYX" outline={HINDWING} veins={HIND_VEINS} geometry={hindGeom} />
          </group>
        </group>
      </group>
    </group>
  );
}

function Panel({ state }) {
  const rate = useStore(state, (s) => s.flapRate);
  const slow = useStore(state, (s) => s.slowmo);
  const phase = useStore(state, (s) => s.phase);
  const down = useStore(state, (s) => s.down);
  const flying = useStore(state, (s) => s.flying);
  const hold = (v) => (state.frame.holdFly = v);
  return (
    <>
      <Slider label="Flap rate" min={0.5} max={6} step={0.1} value={rate} onChange={(v) => state.set({ flapRate: v })} format={(v) => `${v.toFixed(1)} Hz`} />
      <Toggle label="Slow motion" value={slow} onChange={(v) => state.set({ slowmo: v })} />
      <Row>
        <button
          type="button"
          className={`ctl-btn ${flying ? 'primary' : ''}`}
          onPointerDown={(e) => {
            e.preventDefault();
            hold(true);
          }}
          onPointerUp={() => hold(false)}
          onPointerLeave={() => hold(false)}
          onPointerCancel={() => hold(false)}
        >
          {flying ? 'Flying — release to land' : 'Hold to fly'}
        </button>
      </Row>
      <Readout label="Stroke phase" value={`${Math.round(phase * 100)}% ${down ? '↓ down' : '↑ up'}`} />
    </>
  );
}

export default {
  slug: 'butterfly',
  name: 'RC Butterfly',
  tag: 'ORNITHOPTER',
  category: 'air',
  fit: 2.8,
  oneLiner: 'Flapping-wing flyer with a figure-8 stroke.',
  blurb:
    'A 9-gram radio-controlled ornithopter that flies like the real thing: no propeller, just four film wings driven by a crank on a coreless motor. A single flap cycle is a figure-8 — the wings pitch as they beat so the downstroke pushes air and the upstroke slices through it. Built to learn about unsteady aerodynamics, and because it is the most beautiful thing we have ever launched off a table.',
  specs: [
    ['Wingspan', '260 mm'],
    ['All-up mass', '9.4 g'],
    ['Motor', '12 g-class 6 mm coreless, 50:1 gearbox'],
    ['Radio', '2 ch 2.4 GHz micro receiver'],
    ['Battery', '1S 150 mAh LiPo, ≈ 6 min'],
    ['Wing film', '12 µm mylar on 0.8 mm carbon rod'],
  ],
  tech: ['Coreless motor', 'Crank-rocker linkage', 'Carbon rod', 'Mylar film', 'DSM2 receiver', '1S LiPo'],
  howItWorks: [
    { title: 'Sense', text: 'The pilot is the sensor: two sticks on a transmitter send throttle and rudder to a 0.7 g receiver on the thorax.' },
    { title: 'Think', text: 'There is no autopilot. Throttle sets flap rate (more flaps = more lift); the rudder servo bends the tail to yaw and bank it round.' },
    { title: 'Act', text: 'A crank on the motor gearbox drives two rocker arms; the hinge geometry makes the wings pitch on their own, so each beat is a figure-8 that feathers on the upstroke.' },
  ],
  buildLog: [
    { date: '2025-09', title: 'Paper wings, rubber band', text: 'Rubber-powered mock-up to check the crank linkage. Flew 4 m across the lab.' },
    { date: '2025-11', title: 'Coreless motor + 1S LiPo', text: 'First powered hop. 14 g was too heavy — it flapped hard and went nowhere.' },
    { date: '2026-01', title: 'Diet to 9.4 g', text: 'Carbon rod spars, mylar film and a stripped receiver. Sustained flight for 40 s.' },
    { date: '2026-03', title: 'Hindwing lag', text: 'Offsetting the hindwing crank by ~50° smoothed the lift pulse and killed the bobbing.' },
    { date: '2026-05', title: 'Tech-fest demo', text: 'Ten laps of the auditorium; a small crowd; one antenna lost to a ceiling fan.' },
  ],
  controlsHelp: 'Hold Fly (or Space) to take off and circle; release to glide back to the twig. Slow motion shows the stroke.',
  mobileKeys: [' '],
  createState,
  Model,
  Panel,
};
