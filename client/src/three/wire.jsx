import { useMemo } from 'react';
import { Edges } from '@react-three/drei';
import * as THREE from 'three';

/**
 * Shared "wireframe-glow" look used by EVERY machine so the site feels like one set.
 * Matte near-black faces + glowing blue edges.
 */
export const EDGE = '#3d86ff';
export const EDGE_SOFT = '#2a5fc4';
export const GLOW = '#6eb2ff';

let _bodyMat = null;
export function bodyMaterial() {
  if (!_bodyMat) _bodyMat = new THREE.MeshStandardMaterial({ color: '#0a0f1e', roughness: 0.55, metalness: 0.5 });
  return _bodyMat;
}

let _glassMat = null;
export function glassMaterial() {
  if (!_glassMat)
    _glassMat = new THREE.MeshStandardMaterial({
      color: '#2d7bff',
      transparent: true,
      opacity: 0.18,
      roughness: 0.2,
      metalness: 0.1,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
  return _glassMat;
}

/**
 * One wireframe-glow part.
 *   <Wire kind="box" args={[1, .2, .5]} position={[0,0,0]} rotation={[0,0,0]} label="Chassis" explode />
 * kind: box | cyl | sphere | cone | torus | plane | custom (pass `geometry`)
 *  - label:   text shown in exploded view (optional)
 *  - explode: false to keep this part fixed during explode (default true)
 *  - glass:   translucent blue (for canopies, membranes, LiDAR cones)
 *  - edge:    edge colour override
 */
export function Wire({
  kind = 'box',
  args = [1, 1, 1],
  label,
  explode = true,
  glass = false,
  edge = EDGE,
  edgeThreshold = 20,
  geometry,
  children,
  ...rest
}) {
  const mat = glass ? glassMaterial() : bodyMaterial();
  const userData = useMemo(() => ({ explode, label, wire: true }), [explode, label]);
  return (
    <mesh material={mat} userData={userData} {...rest}>
      {geometry ? (
        geometry
      ) : kind === 'box' ? (
        <boxGeometry args={args} />
      ) : kind === 'cyl' ? (
        <cylinderGeometry args={args} />
      ) : kind === 'sphere' ? (
        <sphereGeometry args={args} />
      ) : kind === 'cone' ? (
        <coneGeometry args={args} />
      ) : kind === 'torus' ? (
        <torusGeometry args={args} />
      ) : kind === 'plane' ? (
        <planeGeometry args={args} />
      ) : (
        <boxGeometry args={args} />
      )}
      {!glass && <Edges color={edge} threshold={edgeThreshold} />}
      {children}
    </mesh>
  );
}

/** A glowing light dot (LED / status light). `ref.material.emissiveIntensity` can be animated. */
export function Led({ color = GLOW, size = 0.04, intensity = 1.6, ...rest }) {
  return (
    <mesh {...rest} userData={{ explode: false }}>
      <sphereGeometry args={[size, 10, 10]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={intensity} toneMapped={false} />
    </mesh>
  );
}

/** A thin box stretched between two 3D points (struts, arms, cables). */
export function Strut({ from, to, thick = 0.05, ...rest }) {
  const { pos, quat, len } = useMemo(() => {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const dir = b.clone().sub(a);
    const len = dir.length();
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    return { pos: mid.toArray(), quat, len };
  }, [from, to]);
  return <Wire kind="box" args={[thick, len, thick]} position={pos} quaternion={quat} {...rest} />;
}
