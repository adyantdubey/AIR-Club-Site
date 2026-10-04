// Smooth scrolling. Lenis moves the page; GSAP ScrollTrigger listens to it.
import Lenis from 'lenis';
import { gsap, ScrollTrigger } from './gsap';

let lenis = null;
let tick = null;

export function initLenis() {
  if (lenis) return lenis;
  lenis = new Lenis({ lerp: 0.08, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  tick = (t) => lenis?.raf(t * 1000);
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);
  return lenis;
}

export function getLenis() {
  return lenis;
}

/** Turn smooth scrolling off completely (the admin area uses normal scrolling). */
export function destroyLenis() {
  if (!lenis) return;
  gsap.ticker.remove(tick);
  lenis.destroy();
  lenis = null;
  tick = null;
}

export function scrollToSection(id) {
  const target = document.querySelector(id);
  if (!target) return;
  if (lenis) lenis.scrollTo(target, { offset: 0, duration: 1.4 });
  else target.scrollIntoView({ behavior: 'smooth' });
}
