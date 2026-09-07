// Registry of AI labs (learning order). Full modules in ./<slug>/index.jsx — see CONTRACT.md.

export const LABS = [
  { slug: 'playground', name: 'Neural-net Playground', tag: 'FOUNDATIONS', difficulty: 1, oneLiner: 'Build a network, train it live, watch it learn.' },
  { slug: 'deep-net', name: 'Deep Net', tag: 'DEPTH', difficulty: 1, oneLiner: 'Fly through 8 layers; see what each one does.' },
  { slug: 'cnn', name: 'CNN Digit Reader', tag: 'VISION', difficulty: 2, oneLiner: 'Draw a digit, watch filters light up.' },
  { slug: 'transformer', name: 'Transformer Attention', tag: 'LANGUAGE', difficulty: 3, oneLiner: 'Type a sentence, see who attends to whom.' },
  { slug: 'svm', name: 'Support Vector Machine', tag: 'CLASSIFICATION', difficulty: 2, oneLiner: 'Drop points, watch the best dividing surface bend.' },
  { slug: 'gradient', name: 'Gradient Descent', tag: 'OPTIMISATION', difficulty: 1, oneLiner: 'Roll a ball down a loss landscape.' },
  { slug: 'distillation', name: 'Distillation', tag: 'COMPRESSION', difficulty: 3, oneLiner: 'A big teacher net teaches a tiny student.' },
  { slug: 'reinforcement', name: 'Reinforcement Learning', tag: 'AGENTS', difficulty: 2, oneLiner: 'The rover learns its own path to the flag.' },
];

const modules = import.meta.glob('./*/index.jsx');

export function loadLab(slug) {
  const key = `./${slug}/index.jsx`;
  if (!modules[key]) return Promise.reject(new Error(`No lab "${slug}"`));
  return modules[key]().then((m) => m.default);
}

export function loadAllLabs() {
  return Promise.all(LABS.map((l) => loadLab(l.slug).catch(() => null)));
}

export const labMeta = (slug) => LABS.find((l) => l.slug === slug);
export const nextLab = (slug) => LABS[(LABS.findIndex((l) => l.slug === slug) + 1) % LABS.length];
