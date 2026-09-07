import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Edges } from '@react-three/drei';
import * as THREE from 'three';
import { gsap } from '../../lib/gsap';
import { roverStore } from '../../lib/roverStore';
import { bodyParts, wheelParts, WHEEL_POSITIONS, ANTENNA_TIP, LIDAR_TOP } from './roverParts';

const EDGE = '#3d86ff';
const lerp = (a, b, t) => a + (b - a) * t;

function Part({ p, material }) {
  return (
    <mesh position={p.pos} rotation={p.rot} userData={{ assemble: true }} material={material}>
      {p.kind === 'box' && <boxGeometry args={p.args} />}
      {p.kind === 'cyl' && <cylinderGeometry args={p.args} />}
      <Edges color={EDGE} threshold={20} />
    </mesh>
  );
}

/**
 * The rover, built from ~150 simple shapes.
 *  - Full mode (hero): fragments fly together (H1), idle float (H2), follows scroll via roverStore.
 *  - mini mode (project card): always assembled, just rotates.
 */
export default function RoverModel({ mini = false, treads = 16 }) {
  const root = useRef();
  const lidar = useRef();
  const wedge = useRef();
  const tip = useRef();
  const wheels = useRef([]);
  const tl = useRef(null);
  const progress = useRef(mini ? 1 : 0);
  const started = useRef(false);
  const blinkAt = useRef(-1);

  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#0a0f1e', roughness: 0.55, metalness: 0.5 }),
    [],
  );
  const body = useMemo(() => bodyParts(), []);
  const wheel = useMemo(() => wheelParts(treads), [treads]);

  // H1 — scatter every piece, then build one GSAP timeline that flies them home.
  useLayoutEffect(() => {
    const meshes = [];
    root.current.traverse((o) => {
      if (o.userData.assemble) meshes.push(o);
    });
    const timeline = gsap.timeline({
      paused: true,
      onUpdate: () => {
        progress.current = timeline.progress();
      },
    });
    meshes.forEach((m) => {
      if (!m.userData.final) {
        m.userData.final = {
          p: m.position.clone(),
          r: m.rotation.clone(),
        };
      }
      const { p, r } = m.userData.final;
      if (mini) {
        m.position.copy(p);
        m.rotation.copy(r);
        return;
      }
      const dir = new THREE.Vector3().randomDirection().multiplyScalar(3 + Math.random() * 4);
      m.position.set(p.x + dir.x, p.y + dir.y, p.z + dir.z);
      m.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      const at = Math.random() * 0.5;
      timeline.to(m.position, { x: p.x, y: p.y, z: p.z, duration: 1.6, ease: 'expo.inOut' }, at);
      timeline.to(m.rotation, { x: r.x, y: r.y, z: r.z, duration: 1.6, ease: 'expo.inOut' }, at);
    });
    if (mini) timeline.progress(1);
    tl.current = timeline;
    return () => timeline.kill();
  }, [mini]);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    const s = roverStore;
    const g = root.current;
    if (!g) return;

    if (!started.current && (mini || s.assembled)) {
      started.current = true;
      if (s.reducedMotion) tl.current.progress(1);
      else tl.current.play();
    }

    // H2 — wheels spin, LiDAR puck rotates, scan-cone appears once assembled
    const driving = s.contact > 0 && s.contact < 1;
    const wheelSpeed = mini ? 1.2 : driving ? 10 : 0.8;
    wheels.current.forEach((w) => w && (w.rotation.z -= dt * wheelSpeed));
    if (lidar.current) lidar.current.rotation.y += dt * 2.4;
    if (wedge.current) wedge.current.scale.setScalar(progress.current);

    // C3 — antenna blink (twice)
    if (tip.current) {
      if (s.antennaBlink) {
        s.antennaBlink = 0;
        blinkAt.current = t;
      }
      const el = t - blinkAt.current;
      const blinking = blinkAt.current >= 0 && el < 1.2;
      tip.current.material.emissiveIntensity = blinking ? (Math.sin(el * Math.PI * 3.4) > 0 ? 8 : 0.2) : 1.6;
    }

    if (mini) {
      g.rotation.y += dt * 0.45;
      g.position.y = -0.45 + Math.sin(t) * 0.05;
      return;
    }

    // ---- Pose from the shared store (hero → park → hidden → contact) ----
    const mobile = state.size.width < 768;
    const heroPos = mobile ? [0.2, 1.3, -1.6] : [1.75, -0.45, 0];
    const heroScale = mobile ? 0.5 : 0.95;
    const parkPos = mobile ? [1.3, 2.6, -2.2] : [3.4, 1.35, -1.2];
    const baseYaw = -0.55;

    let px, py, pz, sc, ry;
    let rx = 0;
    if (s.contact > 0) {
      const c = s.contact;
      const e = 1 - Math.pow(1 - c, 3);
      const endX = mobile ? 1.0 : -2.1;
      px = lerp(7.5, endX, e);
      py = (mobile ? -1.75 : -1.15) + Math.sin(c * Math.PI * 8) * 0.045 * (1 - c);
      pz = mobile ? -1.2 : 0;
      sc = (mobile ? 0.42 : 0.78) * (1 - s.footer);
      ry = Math.PI + 0.1 - 0.8 * c; // faces left while driving, then turns to "look" at the form
    } else {
      const h = s.hero;
      px = lerp(heroPos[0], parkPos[0], h);
      py = lerp(heroPos[1], parkPos[1], h);
      pz = lerp(heroPos[2], parkPos[2], h);
      sc = lerp(heroScale, heroScale * 0.45, h) * (1 - s.hidden);
      ry = baseYaw + h * Math.PI + s.about * Math.PI * 0.8;
    }

    // idle float + yaw
    py += Math.sin(t * 1.2) * 0.06;
    ry += Math.sin(t * 0.5) * 0.14;
    // H3 — mouse parallax
    ry += s.pointer.x * 0.28;
    rx += -s.pointer.y * 0.12;

    const k = 1 - Math.pow(0.001, dt); // frame-rate independent smoothing
    g.position.x += (px - g.position.x) * k;
    g.position.y += (py - g.position.y) * k;
    g.position.z += (pz - g.position.z) * k;
    const cur = g.scale.x;
    g.scale.setScalar(cur + (Math.max(sc, 0.0001) - cur) * k);
    g.rotation.x += (rx - g.rotation.x) * k;
    g.rotation.y += (ry - g.rotation.y) * k;
  });

  return (
    <group ref={root} position={mini ? [0, -0.45, 0] : [1.75, -0.45, 0]} scale={mini ? 0.9 : 0.0001}>
      {body.map((p, i) => (
        <Part key={`b${i}`} p={p} material={material} />
      ))}

      {WHEEL_POSITIONS.map((wp, wi) => (
        <group key={`w${wi}`} position={wp} ref={(el) => (wheels.current[wi] = el)}>
          {wheel.map((p, i) => (
            <Part key={`w${wi}-${i}`} p={p} material={material} />
          ))}
        </group>
      ))}

      {/* LiDAR puck + scan cone (rotates as one) */}
      <group ref={lidar} position={LIDAR_TOP}>
        <mesh userData={{ assemble: true }} material={material}>
          <cylinderGeometry args={[0.12, 0.12, 0.14, 16]} />
          <Edges color={EDGE} threshold={20} />
        </mesh>
        <mesh ref={wedge} rotation-x={-Math.PI / 2} position={[0, 0.02, 0]}>
          <circleGeometry args={[1.9, 24, 0, Math.PI / 4]} />
          <meshBasicMaterial color="#2d7bff" transparent opacity={0.14} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      </group>

      {/* Antenna light */}
      <mesh ref={tip} position={ANTENNA_TIP} userData={{ assemble: true }}>
        <sphereGeometry args={[0.045, 12, 12]} />
        <meshStandardMaterial color="#6eb2ff" emissive="#6eb2ff" emissiveIntensity={1.6} toneMapped={false} />
      </mesh>
    </group>
  );
}
