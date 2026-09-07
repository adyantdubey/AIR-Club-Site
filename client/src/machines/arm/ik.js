// Inverse kinematics for the 6-axis arm. Plain maths, no Three.js needed.
//
// The arm is a chain: base yaw → shoulder → elbow → wrist pitch → wrist roll → gripper.
// Shoulder/elbow move in one vertical plane, so once we know the base yaw we only
// need the classic 2-link "law of cosines" solution for the shoulder and elbow.

export const L1 = 0.7; // upper arm length (model units)
export const L2 = 0.6; // forearm length
export const SHOULDER_Y = 0.48; // height of the shoulder pivot above the floor
export const WRIST_DROP = 0.49; // wrist pivot → centre of the gripper fingers (pointing down)
export const MAX_REACH = L1 + L2;
export const MIN_REACH = Math.abs(L1 - L2) + 0.02;

/**
 * 2-link planar IK (elbow-up). Given a point (r, h) relative to the shoulder pivot,
 * returns the shoulder angle a1 (from horizontal) and the elbow angle a2 (relative to
 * the upper arm; negative = folding). `reachable` is false when the point was clamped.
 */
export function solve2Link(r, h, l1 = L1, l2 = L2) {
  let d = Math.hypot(r, h);
  let reachable = true;
  if (d > l1 + l2 - 0.005) {
    d = l1 + l2 - 0.005;
    reachable = false;
  }
  if (d < Math.abs(l1 - l2) + 0.02) {
    d = Math.abs(l1 - l2) + 0.02;
    reachable = false;
  }
  // law of cosines: angle inside the elbow triangle
  const cosElbow = (l1 * l1 + l2 * l2 - d * d) / (2 * l1 * l2);
  const elbowInner = Math.acos(Math.max(-1, Math.min(1, cosElbow))); // 0 = folded, π = straight
  const cosA = (d * d + l1 * l1 - l2 * l2) / (2 * d * l1);
  const a1 = Math.atan2(h, r) + Math.acos(Math.max(-1, Math.min(1, cosA)));
  const a2 = -(Math.PI - elbowInner);
  return { a1, a2, reachable };
}

/**
 * Full solution for a target point the gripper should hold (x, y, z in model space).
 * Returns joint angles in radians: [yaw, shoulder, elbow, wristPitch] plus `reachable`.
 * The wrist always points straight down, so wristPitch just cancels the other two.
 */
export function solveArm(x, y, z) {
  const yaw = Math.atan2(-z, x); // rotation about Y so local +X points at the target
  const r = Math.hypot(x, z); // horizontal distance from the base axis
  const h = y + WRIST_DROP - SHOULDER_Y; // wrist pivot height relative to the shoulder
  const { a1, a2, reachable } = solve2Link(r, h);
  const wrist = -Math.PI / 2 - a1 - a2;
  const tooLow = y < 0.06;
  return { yaw, a1, a2, wrist, reachable: reachable && !tooLow };
}

export const deg = (rad) => (rad * 180) / Math.PI;
