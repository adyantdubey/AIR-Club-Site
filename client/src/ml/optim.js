// Gradient-descent optimisers on a 2-D function, plus four named loss landscapes.
//
//   const step = makeStepper(land.grad, { method: 'adam', lr: 0.05 });
//   const s = { x: 1.5, y: -1.2 };
//   step(s);            // moves s.x, s.y one step downhill (mutates + returns s)
//
// Landscapes: LANDSCAPES.bowl / valley / saddle / eggbox → { name, f(x,y), grad(x,y) → [gx, gy], domain, start }
// Heights inside the domain are roughly 0 .. 2 (the valley's walls go higher; see `display`).

/**
 * Build a step function for one optimiser. `state` = { x, y } plus scratch fields the
 * optimiser adds (vx, vy for momentum; mx, my, vx, vy, t for Adam).
 *   method: 'sgd' | 'momentum' | 'adam'
 *   lr: learning rate;  momentum: β for heavy-ball;  beta1/beta2/eps: Adam constants
 */
export function makeStepper(gradFn, opts = {}) {
  const { method = 'sgd', lr = 0.05, momentum = 0.9, beta1 = 0.9, beta2 = 0.999, eps = 1e-8 } = opts;

  if (method === 'momentum') {
    // Heavy ball: keep a velocity, add the gradient to it, roll. β = how much velocity survives.
    return (s) => {
      const [gx, gy] = gradFn(s.x, s.y);
      s.vx = momentum * (s.vx || 0) - lr * gx;
      s.vy = momentum * (s.vy || 0) - lr * gy;
      s.x += s.vx;
      s.y += s.vy;
      s.gx = gx;
      s.gy = gy;
      return s;
    };
  }

  if (method === 'adam') {
    // Adam: running mean of the gradient (m) divided by running RMS (√v) → every
    // coordinate moves about `lr` per step no matter how steep or flat it is.
    return (s) => {
      const [gx, gy] = gradFn(s.x, s.y);
      s.t = (s.t || 0) + 1;
      s.mx = beta1 * (s.mx || 0) + (1 - beta1) * gx;
      s.my = beta1 * (s.my || 0) + (1 - beta1) * gy;
      s.vx = beta2 * (s.vx || 0) + (1 - beta2) * gx * gx;
      s.vy = beta2 * (s.vy || 0) + (1 - beta2) * gy * gy;
      const c1 = 1 - Math.pow(beta1, s.t); // bias corrections (early steps would be too small otherwise)
      const c2 = 1 - Math.pow(beta2, s.t);
      s.x -= (lr * (s.mx / c1)) / (Math.sqrt(s.vx / c2) + eps);
      s.y -= (lr * (s.my / c1)) / (Math.sqrt(s.vy / c2) + eps);
      s.gx = gx;
      s.gy = gy;
      return s;
    };
  }

  // Plain gradient descent: step straight downhill, distance ∝ slope.
  return (s) => {
    const [gx, gy] = gradFn(s.x, s.y);
    s.x -= lr * gx;
    s.y -= lr * gy;
    s.gx = gx;
    s.gy = gy;
    return s;
  };
}

// ---------- landscapes ----------
// Each has f (height), grad (exact analytic derivative), a square-ish domain and a default start.

const bowl = {
  name: 'bowl',
  label: 'Bowl',
  domain: { x: [-2, 2], y: [-2, 2] },
  start: [1.6, -1.3],
  minimum: [0, 0],
  // simple round bowl, 0 at the centre, 2 at the corners
  f: (x, y) => (x * x + y * y) / 4,
  grad: (x, y) => [x / 2, y / 2],
};

// Rosenbrock-style curved valley. The floor of the valley is very flat and curved,
// the walls are steep — GD zig-zags across it, momentum/Adam glide along it.
const VA = 8; // wall steepness
const VS = 0.12; // overall scale
const valley = {
  name: 'valley',
  label: 'Valley',
  domain: { x: [-2, 2], y: [-1, 3] },
  start: [-1.4, 2.4],
  minimum: [1, 1],
  f: (x, y) => VS * ((1 - x) * (1 - x) + VA * (y - x * x) * (y - x * x)),
  grad: (x, y) => {
    const q = y - x * x;
    return [VS * (-2 * (1 - x) - 4 * VA * q * x), VS * (2 * VA * q)];
  },
};

// Saddle: downhill along y, uphill along x. GD crawls near the flat centre, then falls off.
const saddle = {
  name: 'saddle',
  label: 'Saddle',
  domain: { x: [-2, 2], y: [-2, 2] },
  start: [1.7, 0.08],
  minimum: null,
  f: (x, y) => (x * x - y * y) / 4 + 1,
  grad: (x, y) => [x / 2, -y / 2],
};

// Egg box: a bowl with sin/cos ripples → lots of shallow local minima to get stuck in.
const EF = 4.2; // ripple frequency
const EA = 0.16; // ripple amplitude
const eggbox = {
  name: 'eggbox',
  label: 'Eggbox',
  domain: { x: [-2, 2], y: [-2, 2] },
  start: [1.55, 1.25],
  minimum: [0, 0],
  f: (x, y) => (x * x + y * y) / 4.4 + EA * (Math.sin(EF * x) * Math.cos(EF * y) + 0.85),
  grad: (x, y) => [
    x / 2.2 + EA * EF * Math.cos(EF * x) * Math.cos(EF * y),
    y / 2.2 - EA * EF * Math.sin(EF * x) * Math.sin(EF * y),
  ],
};

export const LANDSCAPES = { bowl, valley, saddle, eggbox };
export const LANDSCAPE_LIST = [bowl, valley, saddle, eggbox];
export const landscapeByName = (name) => LANDSCAPES[name] || bowl;

/** Clamp a point into the landscape's domain (the ball never leaves the board). */
export function clampToDomain(land, s) {
  const { x, y } = land.domain;
  if (s.x < x[0]) s.x = x[0];
  else if (s.x > x[1]) s.x = x[1];
  if (s.y < y[0]) s.y = y[0];
  else if (s.y > y[1]) s.y = y[1];
  return s;
}

/**
 * Height used for DRAWING only: squashes tall walls (valley) smoothly so the mesh stays
 * inside ~0..2.2 while the true loss value is unchanged.
 */
export const display = (f) => (f <= 1.2 ? f : 1.2 + (f - 1.2) / (1 + (f - 1.2) / 1.1));
