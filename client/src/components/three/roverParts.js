// Describes the rover as a list of simple shapes (boxes, cylinders, spheres).
// Each entry: { kind, args, pos, rot } in metres. Wheels are built separately (see wheelParts).

const seg = (a, b, thick = 0.06, z = 0) => {
  // A thin box stretched between two 2D points (x, y) — used for rocker/bogie arms.
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  return {
    kind: 'box',
    args: [len, thick, thick],
    pos: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, z],
    rot: [0, 0, Math.atan2(dy, dx)],
  };
};

export function bodyParts() {
  const parts = [];

  // Chassis
  parts.push({ kind: 'box', args: [1.7, 0.42, 1.1], pos: [0, 0.45, 0], rot: [0, 0, 0] });
  parts.push({ kind: 'box', args: [0.22, 0.28, 0.9], pos: [0.96, 0.42, 0], rot: [0, 0, 0] });
  parts.push({ kind: 'box', args: [0.22, 0.28, 0.9], pos: [-0.96, 0.42, 0], rot: [0, 0, 0] });

  // Top deck + solar slats
  parts.push({ kind: 'box', args: [1.5, 0.04, 1.0], pos: [0, 0.68, 0], rot: [0, 0, 0] });
  for (let i = 0; i < 8; i++) {
    parts.push({
      kind: 'box',
      args: [0.15, 0.02, 0.9],
      pos: [-0.62 + i * 0.177, 0.71, 0],
      rot: [0, 0, 0],
    });
  }

  // Mast + camera head
  parts.push({ kind: 'cyl', args: [0.03, 0.03, 0.9, 8], pos: [0.55, 1.13, 0.2], rot: [0, 0, 0] });
  parts.push({ kind: 'box', args: [0.28, 0.14, 0.36], pos: [0.55, 1.62, 0.2], rot: [0, 0, 0] });
  parts.push({ kind: 'cyl', args: [0.04, 0.04, 0.06, 10], pos: [0.7, 1.62, 0.28], rot: [0, 0, Math.PI / 2] });
  parts.push({ kind: 'cyl', args: [0.04, 0.04, 0.06, 10], pos: [0.7, 1.62, 0.12], rot: [0, 0, Math.PI / 2] });

  // LiDAR base (the spinning puck is added in RoverModel)
  parts.push({ kind: 'cyl', args: [0.15, 0.15, 0.08, 16], pos: [-0.35, 0.74, 0], rot: [0, 0, 0] });

  // Antenna
  parts.push({ kind: 'cyl', args: [0.015, 0.015, 0.8, 6], pos: [-0.75, 1.1, -0.3], rot: [0, 0, 0] });

  // Rocker-bogie suspension (both sides)
  const P = [0.15, 0.32]; // chassis pivot
  const F = [0.9, 0]; // front wheel
  const B = [-0.35, 0.18]; // bogie pivot
  const M = [0, 0]; // middle wheel
  const R = [-0.9, 0]; // rear wheel
  for (const z of [0.66, -0.66]) {
    parts.push(seg(P, F, 0.06, z));
    parts.push(seg(P, B, 0.06, z));
    parts.push(seg(B, M, 0.05, z));
    parts.push(seg(B, R, 0.05, z));
    parts.push({ kind: 'cyl', args: [0.07, 0.07, 0.1, 10], pos: [P[0], P[1], z], rot: [Math.PI / 2, 0, 0] });
    parts.push({ kind: 'cyl', args: [0.05, 0.05, 0.08, 10], pos: [B[0], B[1], z], rot: [Math.PI / 2, 0, 0] });
  }

  return parts;
}

export const WHEEL_POSITIONS = [
  [0.9, 0, 0.85],
  [0, 0, 0.85],
  [-0.9, 0, 0.85],
  [0.9, 0, -0.85],
  [0, 0, -0.85],
  [-0.9, 0, -0.85],
];

export const WHEEL_RADIUS = 0.32;

// Parts of ONE wheel, in the wheel's own local space (axle along Z).
export function wheelParts(treads = 16) {
  const parts = [];
  parts.push({ kind: 'cyl', args: [0.19, 0.19, 0.24, 12], pos: [0, 0, 0], rot: [Math.PI / 2, 0, 0] });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI;
    parts.push({ kind: 'box', args: [0.5, 0.04, 0.1], pos: [0, 0, 0], rot: [0, 0, a] });
  }
  for (let i = 0; i < treads; i++) {
    const a = (i / treads) * Math.PI * 2;
    parts.push({
      kind: 'box',
      args: [(2 * Math.PI * WHEEL_RADIUS) / treads - 0.02, 0.09, 0.22],
      pos: [Math.cos(a) * WHEEL_RADIUS, Math.sin(a) * WHEEL_RADIUS, 0],
      rot: [0, 0, a + Math.PI / 2],
    });
  }
  return parts;
}

export const ANTENNA_TIP = [-0.75, 1.52, -0.3];
export const LIDAR_TOP = [-0.35, 0.86, 0];
