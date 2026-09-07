// Leg geometry, tripod gait and 2-link IK for the hexabot. Plain maths only.

export const BODY_R = 0.45; // hexagon "radius" (centre → corner where a leg mounts)
export const LC = 0.14; // coxa (hip) link, horizontal
export const LF = 0.28; // femur (thigh)
export const LT = 0.38; // tibia (shin)
export const FOOT_R = 0.86; // where the feet rest, measured from the body centre

// Six legs, going round the body. +X is forward, +Z is the robot's right side.
// Index order matters: even legs (0,2,4) form tripod A, odd legs (1,3,5) form tripod B,
// and each tripod is front+rear on one side plus the middle leg on the other.
export const LEGS = [
  { name: 'FL', phi: -30 }, // front-left
  { name: 'ML', phi: -90 }, // middle-left
  { name: 'RL', phi: -150 }, // rear-left
  { name: 'RR', phi: 150 }, // rear-right
  { name: 'MR', phi: 90 }, // middle-right
  { name: 'FR', phi: 30 }, // front-right
].map((l) => {
  const a = (l.phi * Math.PI) / 180;
  return {
    ...l,
    angle: a,
    cos: Math.cos(a),
    sin: Math.sin(a),
    mount: [BODY_R * Math.cos(a), 0, BODY_R * Math.sin(a)], // hip position in the body frame
    home: [FOOT_R * Math.cos(a), FOOT_R * Math.sin(a)], // resting foot position (x, z)
  };
});

/**
 * Tripod gait timing. `phase` runs 0→1 over one full cycle.
 * Returns, for leg i: swing (true = foot in the air) and progress s (0→1 inside that half).
 */
export function legPhase(phase, i) {
  const q = (phase + (i % 2 ? 0.5 : 0)) % 1;
  return q < 0.5 ? { swing: true, s: q / 0.5 } : { swing: false, s: (q - 0.5) / 0.5 };
}

/**
 * Foot offset from its home position for one leg (body frame).
 *  stride: [sx, sz] = how far ahead of home the foot lands (half the total travel each way)
 *  During swing the foot travels from -stride to +stride in an arc (lift = sin bump).
 *  During stance it slides back from +stride to -stride, pushing the body along.
 */
export function footOffset(swing, s, stride, lift, out) {
  const e = swing ? s * s * (3 - 2 * s) : s; // ease the swing, keep stance linear
  const k = swing ? -1 + 2 * e : 1 - 2 * e;
  out[0] = stride[0] * k;
  out[1] = swing ? Math.sin(s * Math.PI) * lift : 0;
  out[2] = stride[1] * k;
  return out;
}

/**
 * Stride vector for a leg given the body's forward speed v and turn rate w (rad/s).
 * Stance feet must move relative to the body at (-v - rz·w, +rx·w), so the landing
 * point is the opposite direction, scaled by half a stance period.
 */
export function legStride(leg, v, w, halfPeriod, out) {
  const rx = leg.mount[0];
  const rz = leg.mount[2];
  out[0] = (v + rz * w) * halfPeriod;
  out[1] = -rx * w * halfPeriod;
  const len = Math.hypot(out[0], out[1]);
  if (len > 0.3) {
    out[0] *= 0.3 / len; // never over-stretch a leg
    out[1] *= 0.3 / len;
  }
  return out;
}

/**
 * Leg IK. `p` = foot target relative to the hip, in the body frame (x, y, z).
 * Returns [coxaYaw, femurPitch, tibiaPitch] in radians for the leg's local frame,
 * where local +X points outward from the body along the leg's mount angle.
 */
export function solveLeg(leg, px, py, pz, out) {
  // rotate into the leg's frame (so +x is "outward")
  const lx = px * leg.cos + pz * leg.sin;
  const lz = -px * leg.sin + pz * leg.cos;
  const coxa = Math.atan2(-lz, lx);
  const hd = Math.hypot(lx, lz) - LC; // horizontal distance past the coxa
  let d = Math.hypot(hd, py);
  d = Math.min(Math.max(d, Math.abs(LF - LT) + 0.01), LF + LT - 0.005);
  const cosKnee = (LF * LF + LT * LT - d * d) / (2 * LF * LT);
  const knee = Math.acos(Math.max(-1, Math.min(1, cosKnee))); // inner knee angle
  const cosA = (d * d + LF * LF - LT * LT) / (2 * d * LF);
  const femur = Math.atan2(py, hd) + Math.acos(Math.max(-1, Math.min(1, cosA)));
  const tibia = -(Math.PI - knee);
  out[0] = coxa;
  out[1] = femur;
  out[2] = tibia;
  return out;
}

// ---- terrain ----
// "Rocks" = a few spheres half-sunk into the plate. Height under any (x, z) is the
// top surface of whichever rock is there (0 on flat ground).
export const ROCKS = [
  [0.7, 0.5, 0.26],
  [-0.9, -0.4, 0.3],
  [0.1, -1.0, 0.22],
  [-0.4, 0.95, 0.24],
  [1.3, -0.8, 0.28],
  [-1.3, 0.3, 0.2],
  [0.9, 1.35, 0.22],
  [-1.0, -1.3, 0.25],
];
export const ROCK_SINK = 0.55; // fraction of the radius buried below the plate

export function groundHeight(x, z, rocks) {
  if (!rocks) return 0;
  let h = 0;
  for (let i = 0; i < ROCKS.length; i++) {
    const r = ROCKS[i][2];
    const dx = x - ROCKS[i][0];
    const dz = z - ROCKS[i][1];
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      const top = Math.sqrt(r * r - d2) - r * ROCK_SINK;
      if (top > h) h = top;
    }
  }
  return h;
}
