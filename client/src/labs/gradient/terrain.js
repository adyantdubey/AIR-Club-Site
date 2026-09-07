// Heightfield for a loss landscape: 64×64 plane, vertex colours from height, faint grid lines.
import * as THREE from 'three';
import { display } from '../../ml/optim';

export const SEG = 64;
export const HALF = 2; // world extent: the board is 4 × 4 units
export const HS = 0.8; // world height per unit of (display) loss

const BLUE = new THREE.Color('#2d7bff');
const GLOW = new THREE.Color('#6eb2ff');
const WHITE = new THREE.Color('#ffffff');
const DEEP = BLUE.clone().multiplyScalar(0.22);
const tmp = new THREE.Color();

/** data (x, y) → world (X, Z) inside the 4×4 board */
export function toWorld(land, x, y) {
  const { x: dx, y: dy } = land.domain;
  return [-HALF + (2 * HALF * (x - dx[0])) / (dx[1] - dx[0]), -HALF + (2 * HALF * (y - dy[0])) / (dy[1] - dy[0])];
}
/** world (X, Z) → data (x, y) */
export function toData(land, X, Z) {
  const { x: dx, y: dy } = land.domain;
  return [dx[0] + ((X + HALF) / (2 * HALF)) * (dx[1] - dx[0]), dy[0] + ((Z + HALF) / (2 * HALF)) * (dy[1] - dy[0])];
}
/** world height of the surface at data (x, y) */
export const heightAt = (land, x, y) => display(land.f(x, y)) * HS;

/** Colour for a display-height t in 0..~2.2: deep blue → blue → glow → white */
function colourFor(h, out) {
  const t = Math.sqrt(Math.min(1, h / 2.1)); // sqrt: more colour change on the low, interesting part
  if (t < 0.45) out.copy(DEEP).lerp(BLUE, t / 0.45);
  else if (t < 0.78) out.copy(BLUE).lerp(GLOW, (t - 0.45) / 0.33);
  else out.copy(GLOW).lerp(WHITE, (t - 0.78) / 0.22);
  return out;
}

export function makeTerrainGeometry(seg = SEG) {
  const g = new THREE.PlaneGeometry(HALF * 2, HALF * 2, seg, seg);
  g.rotateX(-Math.PI / 2); // lie flat; row j ↔ world z from -HALF to +HALF
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3), 3));
  return g;
}

/** Write the landscape's heights + colours into the geometry. */
export function paintTerrain(geom, land, seg = SEG) {
  const P = geom.attributes.position.array;
  const C = geom.attributes.color.array;
  let k = 0;
  for (let j = 0; j <= seg; j++) {
    for (let i = 0; i <= seg; i++) {
      const [x, y] = toData(land, -HALF + (2 * HALF * i) / seg, -HALF + (2 * HALF * j) / seg);
      const h = heightAt(land, x, y);
      P[k * 3 + 1] = h;
      colourFor(h, tmp).multiplyScalar(0.85);
      C[k * 3] = tmp.r;
      C[k * 3 + 1] = tmp.g;
      C[k * 3 + 2] = tmp.b;
      k++;
    }
  }
  geom.attributes.position.needsUpdate = true;
  geom.attributes.color.needsUpdate = true;
  geom.computeVertexNormals();
}

/**
 * Faint grid lines over the terrain (every `every`-th row and column), as one LineSegments buffer.
 * Returns the number of points written into `out`.
 */
export function gridLines(land, out, { seg = SEG, every = 4, lift = 0.012 } = {}) {
  let n = 0;
  const max = out.length / 3;
  const put = (X, Z) => {
    const [x, y] = toData(land, X, Z);
    out[n * 3] = X;
    out[n * 3 + 1] = heightAt(land, x, y) + lift;
    out[n * 3 + 2] = Z;
    n++;
  };
  const step = (2 * HALF) / seg;
  for (let a = 0; a <= seg; a += every) {
    const fixed = -HALF + a * step;
    for (let b = 0; b < seg; b++) {
      if (n + 4 > max) return n;
      put(fixed, -HALF + b * step); // column line segment
      put(fixed, -HALF + (b + 1) * step);
      put(-HALF + b * step, fixed); // row line segment
      put(-HALF + (b + 1) * step, fixed);
    }
  }
  return n;
}
export const GRID_CAPACITY = ((SEG / 4 + 1) * SEG * 4 + 8) * 3;
