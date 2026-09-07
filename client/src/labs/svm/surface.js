// Heightfield helpers for the SVM lab: a 48×48 plane whose height + colour show the
// decision value, and a marching-squares contour line where the decision is exactly 0.
import * as THREE from 'three';
import { decision } from '../../ml/svm';

export const HALF = 2.2; // the floor covers [-HALF, HALF]² in data space
export const SEG = 48;

const BLUE = new THREE.Color('#2d7bff');
const WHITE = new THREE.Color('#ffffff');
const GLOW = new THREE.Color('#6eb2ff');
const tmp = new THREE.Color();

/** Smoothly capped height for a decision value (so one far point can't spike the mesh). */
export const hgt = (d) => 1.5 * Math.tanh(d / 1.5);

/** Plane geometry lying flat (XZ), with a colour attribute ready to be written. */
export function makeSurfaceGeometry(seg = SEG) {
  const g = new THREE.PlaneGeometry(HALF * 2, HALF * 2, seg, seg);
  g.rotateX(-Math.PI / 2); // lie flat: plane's local Y becomes world -Z … we map data y → world z
  const n = g.attributes.position.count;
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  return g;
}

/** Data (x, y) ↔ world (x, ·, z). Data y goes to world z directly. */
export const toWorld = (x, y) => [x, y];
/** Vertex (i, j) of the grid → data coordinates. */
export const gridToData = (i, j, seg = SEG) => [-HALF + (2 * HALF * i) / seg, -HALF + (2 * HALF * j) / seg];

/**
 * Fill `values[j*(seg+1)+i]` with the decision value at every vertex.
 * (The plane's vertices run row by row from -z to +z after the rotation, so row j ↔ data y.)
 */
export function sampleDecision(model, values, seg = SEG) {
  const pt = [0, 0];
  let k = 0;
  for (let j = 0; j <= seg; j++) {
    for (let i = 0; i <= seg; i++) {
      pt[0] = -HALF + (2 * HALF * i) / seg;
      pt[1] = -HALF + (2 * HALF * j) / seg;
      values[k++] = model ? decision(model, pt) : 0;
    }
  }
}

/**
 * Write heights + colours from the sampled values into the geometry.
 *   heightScale: 0 for a flat floor (linear kernel), ~0.45 for the RBF hills.
 *   dim: overall colour intensity (0–1)
 */
export function paintSurface(geom, values, { heightScale = 0.45, dim = 1 } = {}) {
  const pos = geom.attributes.position;
  const col = geom.attributes.color;
  const P = pos.array;
  const C = col.array;
  for (let k = 0; k < values.length; k++) {
    const d = values[k];
    P[k * 3 + 1] = hgt(d) * heightScale;
    // colour: blue side vs (dark) white side, brighter the more confident; glow near the boundary
    const conf = Math.min(1, Math.abs(d));
    if (d > 0) tmp.copy(BLUE).multiplyScalar((0.3 + 0.7 * conf) * dim);
    else tmp.copy(WHITE).multiplyScalar((0.1 + 0.28 * conf) * dim);
    const edge = 1 - Math.min(1, Math.abs(d) / 0.12);
    if (edge > 0) tmp.lerp(GLOW, edge * 0.9);
    C[k * 3] = tmp.r;
    C[k * 3 + 1] = tmp.g;
    C[k * 3 + 2] = tmp.b;
  }
  pos.needsUpdate = true;
  col.needsUpdate = true;
  geom.computeVertexNormals();
}

/**
 * Marching squares: line segments where `values` crosses `level`.
 * Writes into `out` (Float32Array, capacity in points) and returns the number of points used.
 * Segments are lifted to y = height(level)·heightScale + lift so they sit on top of the surface.
 */
export function contour(values, level, out, { seg = SEG, heightScale = 0.45, lift = 0.02 } = {}) {
  const W = seg + 1;
  const y = hgt(level) * heightScale + lift;
  const cell = (2 * HALF) / seg;
  let n = 0;
  const maxPts = out.length / 3;
  const pts = []; // scratch for one cell (≤ 4 points)
  for (let j = 0; j < seg; j++) {
    for (let i = 0; i < seg; i++) {
      const v00 = values[j * W + i] - level;
      const v10 = values[j * W + i + 1] - level;
      const v01 = values[(j + 1) * W + i] - level;
      const v11 = values[(j + 1) * W + i + 1] - level;
      const x0 = -HALF + i * cell;
      const z0 = -HALF + j * cell;
      pts.length = 0;
      // each edge that changes sign contributes one interpolated point
      if (v00 * v10 < 0) pts.push(x0 + (cell * v00) / (v00 - v10), z0);
      if (v10 * v11 < 0) pts.push(x0 + cell, z0 + (cell * v10) / (v10 - v11));
      if (v01 * v11 < 0) pts.push(x0 + (cell * v01) / (v01 - v11), z0 + cell);
      if (v00 * v01 < 0) pts.push(x0, z0 + (cell * v00) / (v00 - v01));
      // 2 points → one segment; 4 points (saddle cell) → two segments
      for (let p = 0; p + 3 < pts.length; p += 4) {
        if (n + 2 > maxPts) return n;
        out[n * 3] = pts[p];
        out[n * 3 + 1] = y;
        out[n * 3 + 2] = pts[p + 1];
        out[n * 3 + 3] = pts[p + 2];
        out[n * 3 + 4] = y;
        out[n * 3 + 5] = pts[p + 3];
        n += 2;
      }
    }
  }
  return n;
}
