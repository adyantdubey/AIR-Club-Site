// Inverted-pendulum-on-wheels physics + PID controller for the self-balancing robot.
// Pure maths, no React, so it can be unit-tested in Node (`node physics.js`-style scripts).
//
// State (all SI-ish, model units ≈ metres):
//   theta  – tilt from vertical, radians. +theta = leaning toward +x.
//   omega  – tilt rate, rad/s
//   x, v   – wheel position / velocity along the ground
//   integ  – PID integral of tilt error
//
// Dynamics (simplified, ignores the wheel/body mass ratio):
//   theta'' = (g/L)·sin(theta) − (u/L)·cos(theta)     u = wheel acceleration the motors produce
//   x''     = u
// Accelerating the base toward the lean pushes the top back upright — that's the whole trick.

export const G = 9.81;
export const L = 0.55; // height of the centre of mass above the axle
export const U_MAX = 14; // motor saturation: max wheel acceleration (m/s²)
export const V_MAX = 3.2; // motor saturation: max wheel speed (m/s)
export const FALL_ANGLE = (80 * Math.PI) / 180; // past this it's on the floor
export const X_LIMIT = 1.3; // edge of the ground plate
export const SUBSTEPS = 4;

export const DEFAULT_GAINS = { kp: 34, ki: 0.6, kd: 4.2 };

export function initialState() {
  return { theta: 0, omega: 0, x: 0, v: 0, integ: 0, u: 0, fallen: false };
}

/**
 * PID on tilt. The set-point is not exactly 0: a tiny lean back toward the plate centre
 * keeps the robot from wandering off (real balancers do the same with wheel encoders).
 */
export function controller(s, gains, dt) {
  const { kp, ki, kd } = gains;
  // lean toward the centre when it has drifted, and against its own velocity
  const setpoint = clamp(-0.08 * s.x - 0.06 * s.v, -0.1, 0.1);
  const err = s.theta - setpoint;
  s.integ = clamp(s.integ + err * dt, -2, 2); // anti-windup
  let u = kp * err + ki * s.integ + kd * s.omega;
  return clamp(u, -U_MAX, U_MAX);
}

/** Advance the physics by dt using SUBSTEPS small semi-implicit Euler steps. */
export function step(s, gains, dt) {
  if (s.fallen) return s;
  const h = dt / SUBSTEPS;
  for (let i = 0; i < SUBSTEPS; i++) {
    let u = controller(s, gains, h);
    // motor speed limit: once the wheels are at full speed they cannot accelerate further
    if ((s.v >= V_MAX && u > 0) || (s.v <= -V_MAX && u < 0)) u = 0;
    s.u = u;
    const alpha = (G / L) * Math.sin(s.theta) - (u / L) * Math.cos(s.theta);
    s.omega += alpha * h;
    s.omega *= 1 - 0.02 * h; // a whiff of air/bearing damping
    s.theta += s.omega * h;
    s.v += u * h;
    s.x += s.v * h;
    if (s.x > X_LIMIT || s.x < -X_LIMIT) {
      // hit the edge of the plate: the wheels stop dead
      s.x = clamp(s.x, -X_LIMIT, X_LIMIT);
      s.v = 0;
    }
    if (Math.abs(s.theta) > FALL_ANGLE) {
      s.theta = Math.sign(s.theta) * FALL_ANGLE;
      s.omega = 0;
      s.v = 0;
      s.u = 0;
      s.fallen = true;
      break;
    }
  }
  return s;
}

/** A shove: adds tilt rate (rad/s). Positive = topples toward +x. */
export function push(s, impulse) {
  if (!s.fallen) s.omega += impulse;
}

export function reset(s) {
  Object.assign(s, initialState());
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
