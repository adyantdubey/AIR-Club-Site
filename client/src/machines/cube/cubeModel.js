// cubeModel.js — exact cube state using integers only (no drift after thousands of moves).
// Each of the 27 cubelets has an integer position p = [x, y, z] (each -1..1) and an
// orientation m = 3×3 signed-permutation matrix. A quarter turn multiplies both by a
// rotation matrix. Stickers are children of the cubelet in the 3D scene, so they follow.

import * as THREE from 'three';

export const SIZE = 0.3; // cubelet edge
export const GAP = 0.03; // gap between cubelets
export const PITCH = SIZE + GAP; // centre-to-centre distance

// Six sticker colours: a blue/white palette that still reads as six distinct faces.
// (site palette + two extra tints, agreed for this machine)
export const STICKER = {
  py: '#f5f7ff', // U  white
  ny: '#8a93b2', // D  grey
  px: '#2d7bff', // R  blue
  nx: '#6eb2ff', // L  light blue
  pz: '#123b8a', // F  navy
  nz: '#0b1020', // B  near-black blue (drawn with a bright edge)
};

export const I3 = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];

// +90° right-handed rotation about x, y, z (three's convention).
export const ROT = [
  [
    [1, 0, 0],
    [0, 0, -1],
    [0, 1, 0],
  ],
  [
    [0, 0, 1],
    [0, 1, 0],
    [-1, 0, 0],
  ],
  [
    [0, -1, 0],
    [1, 0, 0],
    [0, 0, 1],
  ],
];

export const mulMV = (M, v) => M.map((row) => row[0] * v[0] + row[1] * v[1] + row[2] * v[2]);
export const mulMM = (A, B) => A.map((row) => [0, 1, 2].map((j) => row[0] * B[0][j] + row[1] * B[1][j] + row[2] * B[2][j]));
export const transpose = (M) => [0, 1, 2].map((i) => [M[0][i], M[1][i], M[2][i]]);
export const sameM = (A, B) => A.every((row, i) => row.every((v, j) => v === B[i][j]));
export const isIdentity = (M) => sameM(M, I3);

/** ROT[axis] applied k times (k = 0..3). */
export function rotPow(axis, k) {
  let M = I3;
  for (let i = 0; i < k; i++) M = mulMM(ROT[axis], M);
  return M;
}

export const AXIS_VEC = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];

/** Cubelet index in the fixed array order (x outermost). */
export const homeIndex = (x, y, z) => (x + 1) * 9 + (y + 1) * 3 + (z + 1);

/** Fresh, solved cube. */
export function createCube() {
  const list = [];
  for (let x = -1; x <= 1; x++)
    for (let y = -1; y <= 1; y++)
      for (let z = -1; z <= 1; z++) list.push({ home: [x, y, z], p: [x, y, z], m: I3, quat: new THREE.Quaternion() });
  return list;
}

/** Signed quarter turns from (dir, clockwise turns): 3 turns → one turn the other way. */
export const signedQuarters = (dir, turns) => (turns === 3 ? -dir : dir * turns);
export const toK = (signed) => ((signed % 4) + 4) % 4;

/** Indices of cubelets in a layer (layer === null → all 27). */
export function layerIndices(cube, axis, layer) {
  const out = [];
  cube.forEach((c, i) => {
    if (layer === null || c.p[axis] === layer) out.push(i);
  });
  return out;
}

/** Apply k quarter turns about `axis` to the given cubelets (exact integer update). */
export function applyTurn(cube, indices, axis, k) {
  if (!k) return;
  const R = rotPow(axis, k);
  for (const i of indices) {
    const c = cube[i];
    c.p = mulMV(R, c.p);
    c.m = mulMM(R, c.m);
    quatFromM(c.m, c.quat);
  }
}

const _m4 = new THREE.Matrix4();
/** Orientation matrix → THREE quaternion. */
export function quatFromM(m, out) {
  _m4.set(m[0][0], m[0][1], m[0][2], 0, m[1][0], m[1][1], m[1][2], 0, m[2][0], m[2][1], m[2][2], 0, 0, 0, 0, 1);
  return out.setFromRotationMatrix(_m4);
}

/** True when every cubelet is back where it started with its home orientation. */
export const isSolved = (cube) => cube.every((c) => isIdentity(c.m) && c.p[0] === c.home[0] && c.p[1] === c.home[1] && c.p[2] === c.home[2]);

/**
 * Whole-cube rotations the claws can do to bring orientation `orient` back to identity.
 * Only the two claw axes (x, z) exist. Returns 1 op normally, 2 in rare cases, [] if identity.
 * `turns` follows the F-like clockwise convention used by solver.js (turns = (4 - k) % 4).
 */
export function restoreOps(orient) {
  if (isIdentity(orient)) return [];
  const target = transpose(orient); // inverse of a rotation matrix
  const axes = [
    ['x', 0],
    ['z', 2],
  ];
  for (const [name, a] of axes) for (let k = 1; k < 4; k++) if (sameM(rotPow(a, k), target)) return [{ kind: 'rotate', axis: name, turns: (4 - k) % 4, move: -1, first: true, last: true }];
  for (const [n1, a1] of axes)
    for (let k1 = 1; k1 < 4; k1++)
      for (const [n2, a2] of axes)
        for (let k2 = 1; k2 < 4; k2++)
          if (sameM(mulMM(rotPow(a2, k2), rotPow(a1, k1)), target))
            return [
              { kind: 'rotate', axis: n1, turns: (4 - k1) % 4, move: -1, first: true, last: false },
              { kind: 'rotate', axis: n2, turns: (4 - k2) % 4, move: -1, first: false, last: true },
            ];
  return [];
}
