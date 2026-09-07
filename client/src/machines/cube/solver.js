// solver.js — move notation, inverse, simplification, scrambles and the 2-claw execution plan.
// A "move" is a plain object { face: 'R', turns: 1 | 2 | 3 }  (turns = clockwise quarter turns, 3 = R').

export const FACES = ['R', 'L', 'U', 'D', 'F', 'B'];
const OPPOSITE = { R: 'L', L: 'R', U: 'D', D: 'U', F: 'B', B: 'F' };

/** Geometry of each face: which axis (0=x,1=y,2=z), which layer (+1/-1) and the sign of a
 *  clockwise turn about the +axis (clockwise seen from outside +X is a NEGATIVE rotation about +X). */
export const FACE_INFO = {
  R: { axis: 0, layer: 1, dir: -1 },
  L: { axis: 0, layer: -1, dir: 1 },
  U: { axis: 1, layer: 1, dir: -1 },
  D: { axis: 1, layer: -1, dir: 1 },
  F: { axis: 2, layer: 1, dir: -1 },
  B: { axis: 2, layer: -1, dir: 1 },
};

export const parseMove = (s) => ({ face: s[0], turns: s.endsWith('2') ? 2 : s.endsWith("'") ? 3 : 1 });
export const moveStr = (m) => m.face + (m.turns === 2 ? '2' : m.turns === 3 ? "'" : '');
export const seqStr = (seq) => seq.map(moveStr).join(' ');
export const parseSeq = (s) => s.trim().split(/\s+/).filter(Boolean).map(parseMove);

/** Inverse of a sequence: reverse the order and invert each move (R → R', R2 → R2). */
export const invertMove = (m) => ({ face: m.face, turns: (4 - m.turns) % 4 });
export const inverse = (seq) => seq.slice().reverse().map(invertMove);

/**
 * Simplify: merge R R → R2, cancel R R', R2 R2 → nothing, and also merge across an opposite
 * face (R L R' → L, because R and L commute). Works like a stack so cancellations cascade.
 */
export function simplify(seq) {
  const out = [];
  for (const m of seq) {
    const top = out[out.length - 1];
    const below = out[out.length - 2];
    if (top && top.face === m.face) {
      out.pop();
      const t = (top.turns + m.turns) % 4;
      if (t) out.push({ face: m.face, turns: t });
    } else if (top && below && OPPOSITE[top.face] === m.face && below.face === m.face) {
      const t = (below.turns + m.turns) % 4;
      if (t) below.turns = t;
      else out.splice(out.length - 2, 1);
    } else {
      out.push({ face: m.face, turns: m.turns });
    }
  }
  return out;
}

/** One random move that is not on the same face as `prev`. */
export function randomMove(prev = null) {
  let face = prev;
  while (face === prev) face = FACES[Math.floor(Math.random() * 6)];
  return { face, turns: 1 + Math.floor(Math.random() * 3) };
}

/** n random moves; never the same face twice in a row and never patterns like R L R. */
export function randomScramble(n = 20) {
  const seq = [];
  let prev = null;
  let prev2 = null;
  while (seq.length < n) {
    const face = FACES[Math.floor(Math.random() * 6)];
    if (face === prev) continue;
    if (prev2 && OPPOSITE[prev] === face && prev2 === face) continue;
    seq.push({ face, turns: 1 + Math.floor(Math.random() * 3) });
    prev2 = prev;
    prev = face;
  }
  return seq;
}

/**
 * The robot has only two claws: claw X grips the R face, claw Z grips the F face.
 * Faces R and F are twisted directly. Every other face is first brought to a claw by
 * rotating the WHOLE cube (notation x / z, same sense as R / F), twisted, then rotated back.
 *   U = z  R z'      D = z' R z      L = z2 R z2      B = x2 F x2
 */
const ROUTE = {
  R: { rot: null, via: 'R' },
  F: { rot: null, via: 'F' },
  U: { rot: { axis: 'z', turns: 1 }, via: 'R' },
  D: { rot: { axis: 'z', turns: 3 }, via: 'R' },
  L: { rot: { axis: 'z', turns: 2 }, via: 'R' },
  B: { rot: { axis: 'x', turns: 2 }, via: 'F' },
};

/** Primitive ops for one logical move. `move` = index of that move in the program (-1 = none). */
export function planMove(m, move = -1) {
  const r = ROUTE[m.face];
  const ops = [];
  if (r.rot) ops.push({ kind: 'rotate', axis: r.rot.axis, turns: r.rot.turns, move });
  ops.push({ kind: 'twist', face: r.via, turns: m.turns, move });
  if (r.rot) ops.push({ kind: 'rotate', axis: r.rot.axis, turns: (4 - r.rot.turns) % 4, move });
  return ops;
}

/**
 * Plan a whole program. Adjacent whole-cube rotations about the same axis are merged
 * (U D = z R z' z' R z → z R z2 R z), which is exactly what a real robot does.
 * Each op gets `first` / `last` flags marking the boundaries of its logical move.
 */
export function planProgram(moves) {
  const raw = moves.flatMap((m, i) => planMove(m, i));
  const ops = [];
  for (const op of raw) {
    const top = ops[ops.length - 1];
    if (op.kind === 'rotate' && top && top.kind === 'rotate' && top.axis === op.axis) {
      ops.pop();
      const t = (top.turns + op.turns) % 4;
      if (t) ops.push({ ...op, turns: t }); // merged op belongs to the later move
    } else ops.push({ ...op });
  }
  ops.forEach((op, i) => {
    op.first = i === 0 || ops[i - 1].move !== op.move;
    op.last = i === ops.length - 1 || ops[i + 1].move !== op.move;
  });
  return ops;
}
