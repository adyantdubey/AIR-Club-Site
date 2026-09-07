// Shared timing so the whole site "moves the same way".
export const DUR = {
  fast: 0.4,
  base: 0.9,
  slow: 1.4,
};

export const EASE = {
  out: 'power3.out',
  inOut: 'power2.inOut',
  expo: 'expo.out',
  back: 'back.out(1.6)',
};

export const STAGGER = {
  chars: 0.025,
  words: 0.06,
  items: 0.12,
};

export const isMobile = () => window.innerWidth < 768;
