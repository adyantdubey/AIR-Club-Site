// Registry of machines. Metadata here is used by menus/cards before the 3D module loads.
// The full module (Model, Panel, state) lives in ./<slug>/index.jsx — see CONTRACT.md.

export const MACHINES = [
  { slug: 'rover', name: 'IRC Rover', tag: 'AUTONOMY', category: 'ground', oneLiner: 'Six-wheel rocker-bogie rover for the International Rover Challenge.' },
  { slug: 'arm', name: 'Robotic Arm', tag: 'MANIPULATION', category: 'manipulation', oneLiner: '6-axis arm that reaches any point you drag.' },
  { slug: 'drone', name: 'Quadcopter', tag: 'AERIAL', category: 'air', oneLiner: 'Fly it with a throttle and a joystick.' },
  { slug: 'uav', name: 'Fixed-wing UAV', tag: 'AERIAL', category: 'air', oneLiner: 'Your mouse is the control stick.' },
  { slug: 'balancer', name: 'Self-balancing Robot', tag: 'CONTROL', category: 'ground', oneLiner: 'Push it. Watch PID catch it.' },
  { slug: 'cube', name: 'Rubik\'s Cube Solver', tag: 'PUZZLE', category: 'puzzle', oneLiner: 'Scramble, then watch the claws solve it.' },
  { slug: 'butterfly', name: 'RC Butterfly', tag: 'ORNITHOPTER', category: 'air', oneLiner: 'Flapping-wing flyer with a figure-8 stroke.' },
  { slug: 'hexabot', name: 'Hexabot', tag: 'LEGGED', category: 'ground', oneLiner: 'Six legs, tripod gait, walks where wheels can\'t.' },
];

export const CATEGORIES = [
  ['all', 'All'],
  ['ground', 'Ground'],
  ['air', 'Air'],
  ['manipulation', 'Manipulation'],
  ['puzzle', 'Puzzle'],
];

const modules = import.meta.glob('./*/index.jsx');

export function loadMachine(slug) {
  const key = `./${slug}/index.jsx`;
  if (!modules[key]) return Promise.reject(new Error(`No machine "${slug}"`));
  return modules[key]().then((m) => m.default);
}

export function loadAllMachines() {
  return Promise.all(MACHINES.map((m) => loadMachine(m.slug).catch(() => null)));
}

export const machineMeta = (slug) => MACHINES.find((m) => m.slug === slug);
export const nextMachine = (slug) => MACHINES[(MACHINES.findIndex((m) => m.slug === slug) + 1) % MACHINES.length];
