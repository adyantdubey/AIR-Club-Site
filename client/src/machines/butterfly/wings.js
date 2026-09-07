// Wing outlines + the flapping maths for the RC butterfly. Pure JS, no React.
import * as THREE from 'three';

// Outlines are drawn in (span x, forward z) for the RIGHT wing, hinge at the origin.
// The left wing is the same geometry inside a mirrored (scale x = -1) group.
export const FOREWING = [
  [0, 0.08],
  [0.45, 0.24],
  [0.82, 0.34],
  [0.92, 0.22],
  [0.86, 0.04],
  [0.66, -0.08],
  [0.3, -0.13],
  [0, -0.1],
];
export const HINDWING = [
  [0, 0.02],
  [0.35, 0.06],
  [0.6, 0.02],
  [0.68, -0.14],
  [0.55, -0.32],
  [0.32, -0.42],
  [0.12, -0.34],
  [0, -0.2],
];
// vein tips: each becomes a Strut from the hinge to the tip
export const FORE_VEINS = [
  [0.82, 0.33],
  [0.9, 0.2],
  [0.7, -0.07],
];
export const HIND_VEINS = [
  [0.62, 0.0],
  [0.4, -0.38],
];

/** A flat ShapeGeometry lying in the XZ plane (we rotate it so shape-y becomes -z). */
export function wingGeometry(outline) {
  const shape = new THREE.Shape();
  outline.forEach(([x, z], i) => (i === 0 ? shape.moveTo(x, -z) : shape.lineTo(x, -z)));
  shape.closePath();
  return new THREE.ShapeGeometry(shape, 1);
}

/** The outline as a flat Float32Array of (x, y, z) points for a glowing <lineLoop>. */
export function outlinePoints(outline, y = 0.004) {
  const a = new Float32Array(outline.length * 3);
  outline.forEach(([x, z], i) => a.set([x, y, z], i * 3));
  return a;
}

export const HIND_LAG = 0.15; // hindwings trail the forewings by this fraction of a cycle

/**
 * Wing angles for a given stroke phase (in cycles, 0..1 = one full flap).
 *   flap  – up/down about the body axis. +ve = tip up.
 *   pitch – rotation about the wing's own long axis. Leads the flap by 90° so the wing
 *           is flat on the downstroke (pushes air) and feathered on the upstroke.
 *   sweep – small fore/aft motion at twice the frequency → the tip traces a figure-8.
 * `amp` scales everything (perched = small lazy pumps, flying = full stroke).
 */
export function wingAngles(phase, amp) {
  const a = phase * Math.PI * 2;
  return {
    flap: 1.05 * amp * Math.sin(a),
    pitch: 0.55 * amp * Math.cos(a),
    sweep: 0.14 * amp * Math.sin(2 * a),
  };
}

/** Downstroke = the half of the cycle where the flap angle is decreasing. */
export const isDownstroke = (phase) => Math.cos(phase * Math.PI * 2) < 0;
