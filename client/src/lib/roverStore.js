// A tiny shared "notebook" that GSAP writes numbers into and the 3D scene reads every frame.
// It is a plain object on purpose: changing it does NOT re-render React (which keeps 60 fps).
export const roverStore = {
  assembled: 0,     // 0 = scattered fragments, 1 = fully built (hero H1)
  hero: 0,          // 0..1 as the hero scrolls out (H9)
  about: 0,         // 0..1 through the About section (A4)
  hidden: 0,        // 1 = rover shrunk away (Projects / Team / Events)
  contact: 0,       // 0..1 rover drives in for Contact (C1)
  footer: 0,        // 0..1 as the footer comes up (rover shrinks away again)
  antennaBlink: 0,  // set to 1 to make the antenna light blink twice (C3)
  pointer: { x: 0, y: 0 },
  reducedMotion: false,
};
