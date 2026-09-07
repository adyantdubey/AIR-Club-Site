// Register GSAP plugins ONCE here. Every component imports gsap from this file.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Flip } from 'gsap/Flip';

gsap.registerPlugin(ScrollTrigger, Flip);

gsap.defaults({ ease: 'power3.out', duration: 0.9 });
if (typeof window !== 'undefined') window.__ST = ScrollTrigger; // handy for debugging in the console

export { gsap, ScrollTrigger, Flip };
