import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Wire, Led, Strut, GLOW, EDGE } from '../../three/wire';
import { createStore, useStore } from '../../lib/store';
import { damp } from '../../three/helpers';
import { Slider, Toggle, Readout } from '../../components/ui/Controls';
import Streamlines from './Streamlines';

/*
 * Fixed-wing UAV, twin-boom pusher layout. Nose is +Z, right wing is +X.
 * In hero mode the mouse is the control stick: move it right → ailerons deflect and the plane banks right,
 * move it up → elevator deflects and the nose pitches up. The plane stays on its stand and just
 * banks / pitches in place, with wind streamlines flowing over the wing.
 */

const RED = '#ff6b6b'; // port (left) navigation light
const DEG = Math.PI / 180;
const BANK_MAX = 35 * DEG;
const PITCH_MAX = 20 * DEG;
const BASE_Y = 0.52; // height of the fuselage centre above the floor

function createState() {
  const s = createStore({ airspeed: 18, streamlines: true, showSurfaces: false, bank: 0, pitch: 0 });
  s.frame.bank = 0; // radians, current (damped)
  s.frame.pitch = 0;
  return s;
}

function Model({ state, mode = 'hero' }) {
  const hero = mode === 'hero';
  const { pointer } = useThree(); // normalised mouse position over the canvas, -1..1
  const showSurfaces = useStore(state, (s) => s.showSurfaces); // re-render only when toggled
  const hl = showSurfaces ? GLOW : EDGE; // edge colour for the control surfaces (+ a glass overlay when on)

  const plane = useRef(); // bob + sway (position)
  const roll = useRef(); // bank
  const pitchG = useRef(); // pitch (+ a touch of yaw)
  const ailL = useRef();
  const ailR = useRef();
  const elev = useRef();
  const rud = useRef();
  const prop = useRef();
  const spin = useRef(0);
  const tick = useRef(0);
  // refs the streamlines read every frame (no React state)
  const aoaRef = useRef(0);
  const speedRef = useRef(0.4);
  const streamVis = useRef(true);

  useFrame((sc, dt) => {
    dt = Math.min(dt, 0.05);
    const t = sc.clock.elapsedTime;
    const f = state.frame;
    const cfg = state.get();

    // ---- 1. stick input: the pointer in hero mode, a gentle banking loop in mini/idle mode
    let sx;
    let sy;
    if (hero) {
      sx = Math.max(-1, Math.min(1, pointer.x));
      sy = Math.max(-1, Math.min(1, pointer.y));
    } else {
      sx = Math.sin(t * 0.7) * 0.6;
      sy = Math.sin(t * 0.45 + 1) * 0.3;
    }
    // bank / pitch follow the stick smoothly (a real airframe cannot snap)
    f.bank = damp(f.bank, sx * BANK_MAX, 4, dt);
    f.pitch = damp(f.pitch, sy * PITCH_MAX, 4, dt);
    // control surfaces move with the stick itself, faster than the airframe responds
    f.ail = damp(f.ail || 0, sx * 25 * DEG, 12, dt);
    f.ele = damp(f.ele || 0, sy * 22 * DEG, 12, dt);
    f.rudr = damp(f.rudr || 0, sx * 12 * DEG, 8, dt); // coordinated: rudder into the turn

    // ---- 2. pose the airframe (banks and pitches in place, with a slight bob and fore-aft sway)
    if (roll.current) roll.current.rotation.z = -f.bank; // +X wing down for a right bank
    if (pitchG.current) {
      pitchG.current.rotation.x = -f.pitch; // nose (+Z) up for positive pitch
      pitchG.current.rotation.y = -f.bank * 0.12; // a little nose-yaw into the turn
    }
    if (plane.current) {
      plane.current.position.y = BASE_Y + Math.sin(t * 1.3) * 0.02 + Math.sin(t * 2.1) * 0.008;
      plane.current.position.z = Math.sin(t * 0.6) * 0.03;
    }
    // right aileron up + left aileron down for a right roll; elevator up for nose up
    if (ailR.current) ailR.current.rotation.x = f.ail;
    if (ailL.current) ailL.current.rotation.x = -f.ail;
    if (elev.current) elev.current.rotation.x = f.ele;
    if (rud.current) rud.current.rotation.y = f.rudr;

    // ---- 3. pusher prop: rpm rises with airspeed
    const v = hero ? cfg.airspeed : 16;
    spin.current += (12 + v * 3.2) * dt;
    if (prop.current) prop.current.rotation.z = spin.current;

    // ---- 4. feed the streamlines: angle of attack ≈ pitch; speed in path-lengths per second
    aoaRef.current = f.pitch;
    speedRef.current = 0.15 + v / 45;
    streamVis.current = hero ? cfg.streamlines : false;

    // ---- 5. readouts, ~6× per second
    if (hero) {
      tick.current += dt;
      if (tick.current > 0.16) {
        tick.current = 0;
        state.set({ bank: f.bank / DEG, pitch: f.pitch / DEG });
      }
    }
  });

  return (
    <group>
      {/* pedestal stand: never explodes, so the fit stands correctly */}
      <Wire kind="cyl" args={[0.2, 0.24, 0.03, 28]} position={[0, 0.015, 0]} explode={false} edge="#1d3f7a" />
      <Wire kind="cyl" args={[0.025, 0.035, BASE_Y - 0.1, 10]} position={[0, (BASE_Y - 0.1) / 2 + 0.03, 0]} explode={false} edge="#1d3f7a" />

      <group ref={plane} position={[0, BASE_Y, 0]}>
        <group ref={roll}>
          {/* streamlines bank with the plane but do NOT pitch with it: the wind stays horizontal */}
          {hero && <Streamlines aoaRef={aoaRef} speedRef={speedRef} visibleRef={streamVis} />}

          <group ref={pitchG}>
            {/* fuselage + nose */}
            <Wire kind="box" args={[0.16, 0.14, 1.0]} position={[0, 0, 0.12]} label="Fuselage" />
            <Wire kind="cone" args={[0.085, 0.28, 12]} position={[0, 0, 0.76]} rotation={[Math.PI / 2, 0, 0]} />
            <Wire kind="box" args={[0.12, 0.05, 0.3]} position={[0, 0.09, 0.3]} glass explode={false} />
            <Wire kind="box" args={[0.07, 0.03, 0.09]} position={[0, 0.04, 0.05]} label="Autopilot" />
            {/* nose camera bulge (glass) + pitot tube */}
            <Wire kind="sphere" args={[0.055, 12, 8]} position={[0, -0.07, 0.5]} glass explode={false} />
            <Wire kind="cyl" args={[0.006, 0.006, 0.22, 6]} position={[0.3, -0.01, 0.34]} rotation={[Math.PI / 2, 0, 0]} label="Pitot tube" />

            {/* main wing with a slight dihedral, plus two hinged ailerons */}
            <Wire kind="box" args={[1.6, 0.03, 0.28]} position={[0, 0.03, 0.1]} label="Wing" />
            <group ref={ailR} position={[0.53, 0.03, -0.04]}>
              <Wire kind="box" args={[0.5, 0.022, 0.1]} position={[0, 0, -0.05]} edge={hl} label="Aileron" />
              {showSurfaces && <Wire kind="box" args={[0.52, 0.04, 0.12]} position={[0, 0, -0.05]} glass explode={false} />}
            </group>
            <group ref={ailL} position={[-0.53, 0.03, -0.04]}>
              <Wire kind="box" args={[0.5, 0.022, 0.1]} position={[0, 0, -0.05]} edge={hl} />
              {showSurfaces && <Wire kind="box" args={[0.52, 0.04, 0.12]} position={[0, 0, -0.05]} glass explode={false} />}
            </group>

            {/* twin tail booms */}
            <Strut from={[0.28, 0, 0.05]} to={[0.28, 0, -0.78]} thick={0.035} />
            <Strut from={[-0.28, 0, 0.05]} to={[-0.28, 0, -0.78]} thick={0.035} />
            {/* horizontal tail + elevator */}
            <Wire kind="box" args={[0.62, 0.025, 0.16]} position={[0, 0, -0.66]} />
            <group ref={elev} position={[0, 0, -0.74]}>
              <Wire kind="box" args={[0.6, 0.02, 0.1]} position={[0, 0, -0.05]} edge={hl} label="Elevator" />
              {showSurfaces && <Wire kind="box" args={[0.62, 0.04, 0.12]} position={[0, 0, -0.05]} glass explode={false} />}
            </group>
            {/* vertical fin + rudder */}
            <Wire kind="box" args={[0.025, 0.27, 0.16]} position={[0, 0.14, -0.66]} />
            <group ref={rud} position={[0, 0.14, -0.74]}>
              <Wire kind="box" args={[0.02, 0.24, 0.09]} position={[0, 0, -0.045]} edge={hl} label="Rudder" />
              {showSurfaces && <Wire kind="box" args={[0.04, 0.26, 0.11]} position={[0, 0, -0.045]} glass explode={false} />}
            </group>

            {/* pusher motor and prop at the rear of the fuselage */}
            <Wire kind="cyl" args={[0.045, 0.05, 0.08, 12]} position={[0, 0, -0.42]} rotation={[Math.PI / 2, 0, 0]} label="Pusher motor" />
            <group ref={prop} position={[0, 0, -0.48]}>
              {/* two blades with opposite pitch */}
              <Wire kind="box" args={[0.2, 0.035, 0.01]} position={[0.11, 0, 0]} rotation={[0, 0.35, 0]} />
              <Wire kind="box" args={[0.2, 0.035, 0.01]} position={[-0.11, 0, 0]} rotation={[0, -0.35, 0]} />
            </group>

            {/* landing gear: nose wheel + two mains under the wing */}
            {hero && (
              <group>
                <Strut from={[0, -0.07, 0.4]} to={[0, -0.16, 0.4]} thick={0.02} />
                <Wire kind="cyl" args={[0.035, 0.035, 0.02, 10]} position={[0, -0.17, 0.4]} rotation={[0, 0, Math.PI / 2]} />
                <Strut from={[0.22, -0.02, 0.02]} to={[0.24, -0.15, 0.02]} thick={0.02} />
                <Wire kind="cyl" args={[0.035, 0.035, 0.02, 10]} position={[0.25, -0.17, 0.02]} rotation={[0, 0, Math.PI / 2]} />
                <Strut from={[-0.22, -0.02, 0.02]} to={[-0.24, -0.15, 0.02]} thick={0.02} />
                <Wire kind="cyl" args={[0.035, 0.035, 0.02, 10]} position={[-0.25, -0.17, 0.02]} rotation={[0, 0, Math.PI / 2]} />
              </group>
            )}

            {/* wing-tip navigation lights: red port, green-ish starboard */}
            <Led position={[-0.8, 0.03, 0.12]} size={0.03} color={RED} />
            <Led position={[0.8, 0.03, 0.12]} size={0.03} />
          </group>
        </group>
      </group>
    </group>
  );
}

function Panel({ state }) {
  const airspeed = useStore(state, (s) => s.airspeed);
  const stream = useStore(state, (s) => s.streamlines);
  const surf = useStore(state, (s) => s.showSurfaces);
  const bank = useStore(state, (s) => s.bank);
  const pitch = useStore(state, (s) => s.pitch);
  return (
    <>
      <Slider label="Airspeed" min={10} max={30} step={0.5} value={airspeed} onChange={(v) => state.set({ airspeed: v })} format={(v) => `${v.toFixed(1)} m/s`} />
      <Toggle label="Streamlines" value={stream} onChange={(v) => state.set({ streamlines: v })} />
      <Toggle label="Show control surfaces" value={surf} onChange={(v) => state.set({ showSurfaces: v })} />
      <Readout label="Bank" value={(bank >= 0 ? '+' : '') + bank.toFixed(1)} unit="°" />
      <Readout label="Pitch" value={(pitch >= 0 ? '+' : '') + pitch.toFixed(1)} unit="°" />
    </>
  );
}

export default {
  slug: 'uav',
  name: 'Fixed-wing UAV',
  tag: 'AERIAL',
  category: 'air',
  oneLiner: 'Your mouse is the control stick.',
  blurb:
    'A 1.6 m twin-boom pusher built from foam board and carbon tube for long, slow mapping flights. A Matek F405 running INAV flies waypoints from a GPS and a pitot-fed airspeed sensor, and a nose camera shoots the ground for photogrammetry. It stays up around 40 minutes on one 4S pack.',
  specs: [
    ['Wingspan', '1.6 m, 12% wing loading margin'],
    ['Autopilot', 'Matek F405-WING · INAV 7'],
    ['Motor', '2814 900 kV pusher, 10×6 prop'],
    ['Battery', '4S 6000 mAh Li-ion'],
    ['Cruise', '16–18 m/s'],
    ['Endurance', '≈ 40 min'],
  ],
  tech: ['INAV', 'Matek F405', 'M10 GPS', 'MS4525 pitot', 'ELRS 900 MHz'],
  howItWorks: [
    { title: 'Sense', text: 'The IMU gives attitude, the GPS gives position and track, and the pitot tube measures airspeed by comparing ram pressure with static pressure.' },
    { title: 'Think', text: 'INAV compares the aircraft to the next waypoint and asks for a bank and a pitch; a PIFF loop turns those into servo commands.' },
    { title: 'Act', text: 'Ailerons roll the wing into a bank, the elevator sets pitch, and a little rudder keeps the turn coordinated so the nose follows the wing.' },
  ],
  buildLog: [
    { date: '2025-05', title: 'Foam wing cut', text: 'Hot-wire cut a 1.6 m wing from XPS foam with a carbon spar, covered in laminating film.' },
    { date: '2025-07', title: 'Maiden flight', text: 'Hand launched in manual mode; nose-heavy, so the battery moved 3 cm back.' },
    { date: '2025-11', title: 'Airspeed sensor', text: 'Pitot tube on the wing fixed stalls in strong wind: INAV now holds a true airspeed.' },
    { date: '2026-03', title: 'First waypoint mission', text: 'Six waypoints over the sports field, automatic return-to-home and landing.' },
    { date: '2026-07', title: 'Mapping camera', text: 'Nose camera on an intervalometer; 300 photos stitched into an orthomosaic of the campus.' },
  ],
  controlsHelp: 'Move the mouse over the model: left/right banks, up/down pitches. Watch the ailerons and elevator move.',
  mobileKeys: null,
  fit: 3.0,
  createState,
  Model,
  Panel,
};
