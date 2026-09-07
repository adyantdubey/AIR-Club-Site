// Tabular Q-learning on a small grid world. Pure JS, no rendering here.
//
//   const world = createWorld({ w: 8, h: 8, rocks: new Set(['3,3']), flag: [7, 7], start: [0, 0] });
//   const agent = createAgent(world, { alpha: 0.3, gamma: 0.95, epsilon: 0.2 });
//   step(agent);          // one move: pick an action, get a reward, update one Q value
//   runEpisode(agent);    // keep stepping until the flag is reached (or 200 steps)
//   greedyPath(agent);    // the path you get by always taking the best-known action
//
// Q is a flat Float32Array of size w*h*4: Q[(y*w + x)*4 + action] = "how good is it to
// take `action` from tile (x,y)". Bigger is better. It starts at 0 and is learned.

// The four moves, in grid coordinates (y grows downward like a table).
export const ACTIONS = [
  [0, -1], // 0 up
  [1, 0], // 1 right
  [0, 1], // 2 down
  [-1, 0], // 3 left
];
export const ACTION_NAMES = ['up', 'right', 'down', 'left'];

// Rewards. Every step costs 1 so shorter paths score higher.
export const REWARD_STEP = -1;
export const REWARD_ROCK = -5; // bumping into a rock: bounce back and lose 5 (episode keeps going)
export const REWARD_FLAG = 50;
export const MAX_STEPS = 200;

export const key = (x, y) => `${x},${y}`;

export function createWorld({ w = 8, h = 8, rocks = new Set(), flag = [w - 1, h - 1], start = [0, 0] } = {}) {
  return { w, h, rocks: new Set(rocks), flag: [...flag], start: [...start] };
}

// Small seedable random generator so runs can be repeated (mulberry32).
export function makeRng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createAgent(world, { alpha = 0.3, gamma = 0.95, epsilon = 0.2, epsilonDecay = 0.995, epsilonMin = 0.02, seed = 7 } = {}) {
  const agent = {
    world,
    alpha, // learning rate: how much a new experience overwrites the old estimate
    gamma, // discount: how much future reward counts compared with reward now
    epsilon, // exploration: chance of trying a random move instead of the best-known one
    epsilonDecay,
    epsilonMin,
    rng: makeRng(seed),
    Q: new Float32Array(world.w * world.h * 4),
    // current position inside the episode
    x: world.start[0],
    y: world.start[1],
    steps: 0, // steps taken in the current episode
    ret: 0, // total reward collected in the current episode ("return")
    done: false, // true when the current episode has finished
    // stats
    episode: 0, // completed episodes
    lastReturn: 0,
    bestReturn: -Infinity,
    lastSteps: 0,
    totalSteps: 0,
    // details of the most recent move (for drawing)
    last: { fromX: 0, fromY: 0, toX: 0, toY: 0, action: 0, reward: 0, bumped: false },
  };
  return agent;
}

/** Wipe everything the agent learned. */
export function resetQ(agent) {
  agent.Q.fill(0);
  agent.episode = 0;
  agent.lastReturn = 0;
  agent.bestReturn = -Infinity;
  agent.lastSteps = 0;
  agent.totalSteps = 0;
  startEpisode(agent);
}

/** Put the agent back on the start tile with a fresh episode. */
export function startEpisode(agent) {
  agent.x = agent.world.start[0];
  agent.y = agent.world.start[1];
  agent.steps = 0;
  agent.ret = 0;
  agent.done = false;
}

/** Index of the best action on tile (x,y). Ties go to the lowest index. */
export function bestAction(agent, x, y) {
  const Q = agent.Q;
  const b = (y * agent.world.w + x) * 4;
  let best = 0;
  let bv = Q[b];
  for (let a = 1; a < 4; a++) if (Q[b + a] > bv) (bv = Q[b + a]), (best = a);
  return best;
}

export function maxQ(agent, x, y) {
  const Q = agent.Q;
  const b = (y * agent.world.w + x) * 4;
  return Math.max(Q[b], Q[b + 1], Q[b + 2], Q[b + 3]);
}

/**
 * ONE environment step:
 *  1. choose an action (ε-greedy: mostly the best-known, sometimes random)
 *  2. move, collect the reward
 *  3. nudge Q toward  reward + γ · (best Q on the next tile)   ← the Q-learning rule
 * Returns the agent's `last` record. Starts a new episode automatically if the last one ended.
 */
export function step(agent) {
  if (agent.done) startEpisode(agent);
  const { world, Q } = agent;
  const { w, h } = world;
  const x = agent.x;
  const y = agent.y;
  const base = (y * w + x) * 4;

  // 1. pick an action
  const action = agent.rng() < agent.epsilon ? Math.floor(agent.rng() * 4) : bestAction(agent, x, y);

  // 2. move
  let nx = x + ACTIONS[action][0];
  let ny = y + ACTIONS[action][1];
  let reward = REWARD_STEP;
  let bumped = false;
  if (nx < 0 || ny < 0 || nx >= w || ny >= h) {
    // walked into the edge: stay put, still pay the step cost
    nx = x;
    ny = y;
    bumped = true;
  } else if (world.rocks.has(key(nx, ny))) {
    // hit a rock: bounce back and pay extra
    nx = x;
    ny = y;
    reward = REWARD_ROCK;
    bumped = true;
  }
  const atFlag = nx === world.flag[0] && ny === world.flag[1];
  if (atFlag) reward = REWARD_FLAG;

  // 3. learn:  Q(s,a) += α · ( r + γ·maxQ(s') − Q(s,a) ).  At the flag there is no future.
  const target = atFlag ? reward : reward + agent.gamma * maxQ(agent, nx, ny);
  Q[base + action] += agent.alpha * (target - Q[base + action]);

  // bookkeeping
  agent.x = nx;
  agent.y = ny;
  agent.steps++;
  agent.totalSteps++;
  agent.ret += reward;
  const l = agent.last;
  l.fromX = x;
  l.fromY = y;
  l.toX = nx;
  l.toY = ny;
  l.action = action;
  l.reward = reward;
  l.bumped = bumped;

  if (atFlag || agent.steps >= MAX_STEPS) {
    agent.done = true;
    agent.episode++;
    agent.lastReturn = agent.ret;
    agent.lastSteps = agent.steps;
    if (agent.ret > agent.bestReturn) agent.bestReturn = agent.ret;
  }
  return l;
}

/** Run steps until the current episode ends. Returns the episode return. */
export function runEpisode(agent) {
  if (agent.done) startEpisode(agent);
  while (!agent.done) step(agent);
  return agent.lastReturn;
}

/** Shrink ε a little (call once per episode when "decay ε" is on). */
export function epsilonDecay(agent) {
  agent.epsilon = Math.max(agent.epsilonMin, agent.epsilon * agent.epsilonDecay);
  return agent.epsilon;
}

/**
 * Follow the best-known action from the start until the flag.
 * Returns { path: [[x,y], …], reached: bool }. Stops early if it loops or bumps.
 */
export function greedyPath(agent) {
  const { world } = agent;
  const seen = new Set();
  let x = world.start[0];
  let y = world.start[1];
  const path = [[x, y]];
  let reached = x === world.flag[0] && y === world.flag[1];
  for (let i = 0; i < world.w * world.h && !reached; i++) {
    seen.add(key(x, y));
    const a = bestAction(agent, x, y);
    const nx = x + ACTIONS[a][0];
    const ny = y + ACTIONS[a][1];
    if (nx < 0 || ny < 0 || nx >= world.w || ny >= world.h || world.rocks.has(key(nx, ny))) break; // walks into something
    if (seen.has(key(nx, ny))) break; // going in circles
    x = nx;
    y = ny;
    path.push([x, y]);
    reached = x === world.flag[0] && y === world.flag[1];
  }
  return { path, reached };
}

/** Shortest possible path length in tiles (breadth-first search), or -1 if the flag is walled off. */
export function shortestPathLength(world) {
  const { w, h } = world;
  const dist = new Int16Array(w * h).fill(-1);
  const queue = [world.start];
  dist[world.start[1] * w + world.start[0]] = 0;
  while (queue.length) {
    const [x, y] = queue.shift();
    const d = dist[y * w + x];
    if (x === world.flag[0] && y === world.flag[1]) return d;
    for (const [dx, dy] of ACTIONS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      if (world.rocks.has(key(nx, ny)) || dist[ny * w + nx] >= 0) continue;
      dist[ny * w + nx] = d + 1;
      queue.push([nx, ny]);
    }
  }
  return -1;
}
