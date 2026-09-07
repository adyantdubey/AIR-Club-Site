---
name: react-motion-site
description: Skills and rules for building the NIT AP AI & Robotics Club landing page — React + GSAP + anime.js + Three.js. Read before writing any frontend code for this project.
---

# React Skills for a Stunning Animated Site

This file is the rulebook. Every component in `client/` follows it.

## 1. Stack (exact versions to install)

```bash
npm create vite@latest client -- --template react
cd client
npm i gsap @gsap/react animejs three @react-three/fiber @react-three/drei lenis
npm i -D tailwindcss @tailwindcss/vite
```

| Library | Job | Never use it for |
|---|---|---|
| **gsap** + `ScrollTrigger`, `Flip` | scroll-linked motion, pinning, timelines, text reveals, magnetic buttons | SVG path drawing (anime does it simpler) |
| **animejs** (v4) | SVG line draw, counters, staggered grids, small hovers, flip-clock digits | anything scroll-scrubbed (GSAP owns scroll) |
| **three** via **@react-three/fiber** | 3D rover, star field | UI elements |
| **@react-three/drei** | ready helpers: `Float`, `Edges`, `Points`, `Html`, `useGLTF` | — |
| **lenis** | smooth scroll | — |

One rule to keep the codebase sane: **GSAP owns the scroll, anime.js owns the details, Three.js owns the 3D.**

## 2. Folder layout

```
client/src/
  main.jsx
  App.jsx                 – sections in order
  styles/
    tokens.css            – colours, fonts, spacing as CSS variables
  lib/
    gsap.js               – registers plugins once, exports gsap
    lenis.js              – creates Lenis, wires it to ScrollTrigger
    motion.js             – reusable easing + duration constants
    split.js              – splits text into <span> per char/word
  hooks/
    useReducedMotion.js
    useMagnetic.js
    useTilt.js
    useCounter.js
  components/
    ui/        Button, Chip, SectionHeading, Cursor, Navbar, Preloader
    three/     RoverModel, RoverScene, StarField, Fragments
    sections/  Hero, About, Projects, Team, Events, Contact, Footer
  data/
    projects.js, team.js, events.js   – plain arrays; edit content here
```

## 3. Theme tokens (`tokens.css`)

```css
:root {
  --bg: #050810;
  --bg-2: #0B1020;
  --fg: #F5F7FF;
  --muted: #8A93B2;
  --blue: #2D7BFF;
  --blue-glow: #6EB2FF;
  --line: rgba(110,178,255,.18);
  --font-display: "Space Grotesk", system-ui, sans-serif;
  --font-body: "Inter", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", monospace;
}
```

Use only these. No new hex codes inside components.

## 4. GSAP in React — the one correct pattern

Always use `useGSAP` from `@gsap/react`. It cleans up automatically when the component unmounts, so no memory leaks and no double animations in dev mode.

```jsx
import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap } from '../lib/gsap';

export default function About() {
  const root = useRef(null);

  useGSAP(() => {
    gsap.from('.card', {
      y: 60, opacity: 0, stagger: 0.12, duration: 0.9, ease: 'power3.out',
      scrollTrigger: { trigger: root.current, start: 'top 75%' },
    });
  }, { scope: root });          // scope = selectors only search inside this section

  return <section ref={root}>…</section>;
}
```

Rules:

- `scope: root` on every `useGSAP` so `.card` in one section never hits another section's `.card`.
- Never `document.querySelector` inside components. Use refs or scoped selectors.
- Scroll-linked = `scrub: true` (moves with scroll). One-shot = `toggleActions: 'play none none reverse'`.
- Pinning: `pin: true, anticipatePin: 1`, and put the pinned section's content in a child wrapper.
- After images/fonts load, call `ScrollTrigger.refresh()` once (do this in `App.jsx` on `window.load`).
- Register plugins once in `lib/gsap.js`:

```js
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Flip } from 'gsap/Flip';
gsap.registerPlugin(ScrollTrigger, Flip);
export { gsap, ScrollTrigger, Flip };
```

## 5. Lenis + ScrollTrigger (`lib/lenis.js`)

```js
import Lenis from 'lenis';
import { gsap, ScrollTrigger } from './gsap';

export function initLenis() {
  const lenis = new Lenis({ lerp: 0.08, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  return lenis;
}
```

Call once in `App.jsx` inside `useEffect`. Nav links scroll with `lenis.scrollTo('#about')`.

## 6. anime.js in React

anime.js v4 API: `import { animate, stagger, svg, createTimeline } from 'animejs'`.

```jsx
useEffect(() => {
  const anim = animate(svg.createDrawable('.logo path'), {
    draw: '0 1', duration: 1400, ease: 'inOutQuad',
  });
  return () => anim.cancel();     // always cancel on unmount
}, []);
```

Common recipes:

- **Counter**: `animate(obj, { value: 40, round: 1, duration: 1500, onUpdate: () => el.textContent = obj.value })`
- **Grid wave from centre**: `animate('.member', { opacity: [0,1], scale: [.8,1], delay: stagger(60, { grid: [cols, rows], from: 'center' }) })`
- **Chip bounce**: `animate('.chip', { translateY: [20,0], opacity: [0,1], delay: stagger(50), ease: 'outElastic(1, .6)' })`

Trigger anime.js "on enter" with a tiny `IntersectionObserver` hook (`useInView`) — not with GSAP ScrollTrigger, to keep the two libraries from fighting.

## 7. Three.js with React Three Fiber

```jsx
<Canvas dpr={[1, 1.5]} camera={{ position: [0, 1.2, 6], fov: 40 }} gl={{ antialias: true, alpha: true }}>
  <ambientLight intensity={0.4} />
  <pointLight position={[4, 6, 4]} intensity={30} color="#6EB2FF" />
  <StarField />
  <RoverModel />
</Canvas>
```

Rules:

- **One `<Canvas>` for the whole page**, fixed behind content (`position: fixed; inset: 0; z-index: 0; pointer-events: none`). Sections sit above it. The camera/rover moves per section via GSAP ScrollTrigger writing to a shared `useRef` — never React state (state re-renders 60×/s and kills performance).
- Rover is built from primitives: `boxGeometry` chassis, `cylinderGeometry` wheels ×6, thin boxes for rocker/bogie arms, a `cylinderGeometry` LiDAR puck, a `coneGeometry` scan-cone with `transparent opacity 0.15`. Each part gets `<Edges color="#2D7BFF" />` from drei for the glowing wireframe look, with a matte black `meshStandardMaterial`.
- **Assembly animation**: store each part's final position; on mount, place parts at random spheres of radius 6, then one GSAP timeline tweens `part.position` and `part.rotation` back. Use `gsap.to(ref.current.position, {...})` — GSAP can animate any object's numbers.
- Idle motion inside `useFrame((state, dt) => …)`; use `dt` so speed is the same on all screens.
- Mouse parallax: read `state.pointer` inside `useFrame`, lerp the group rotation toward it.
- `dpr` capped at 1.5; on mobile (`window.innerWidth < 768`) cut particle count and fragment count.
- Wrap the canvas in `<Suspense>` and show nothing while loading — the preloader covers it.

## 8. Text splitting (`lib/split.js`)

Free replacement for SplitText: wrap each character in `<span class="char" style="display:inline-block">` inside an overflow-hidden parent. Then `gsap.from('.char', { yPercent: 110, stagger: 0.02 })`. Keep the original text in `aria-label` on the parent so screen readers still read it.

## 9. Reusable hooks

- `useReducedMotion()` → boolean. When true, every `useGSAP` returns early and sets `gsap.globalTimeline.timeScale(0)`-style instant fades.
- `useMagnetic(ref, strength = 0.3)` → moves the element toward the cursor with `gsap.quickTo`.
- `useTilt(ref, max = 12)` → `rotateX/rotateY` from cursor position, `transform-style: preserve-3d`.
- `useInView(ref, threshold)` → boolean, for anime.js triggers.
- `useCounter(ref, to)` → anime.js counter when in view.

## 10. Performance rules

- Animate only `transform` and `opacity`. Never `top/left/width/height`.
- Add `will-change: transform` only on elements that are currently animating (GSAP does this via `force3D`).
- Images: `.webp`, `loading="lazy"`, fixed `width/height` to avoid layout jumps (ScrollTrigger hates layout jumps).
- Fonts: preload the two display weights; `font-display: swap`.
- Check with Chrome DevTools → Performance: 60 fps on the hero, no "long tasks" > 50 ms after load.
- Lighthouse target: Performance ≥ 85, Accessibility ≥ 95.

## 11. Accessibility

- All motion respects `prefers-reduced-motion`.
- Every interactive element is a real `<button>` or `<a>`; custom cursor is decorative only.
- Colour contrast: white on `#050810` passes; blue `#2D7BFF` text only at ≥ 24 px.
- Split-text headings keep `aria-label`.

## 12. Component checklist (before marking any section done)

- [ ] Uses `useGSAP` with `scope`
- [ ] No hex colours outside `tokens.css`
- [ ] Works with reduced motion
- [ ] Looks right at 375 px, 768 px, 1440 px
- [ ] No console warnings
- [ ] Content comes from `data/*.js`, not hard-coded JSX
