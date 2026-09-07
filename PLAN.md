# NIT AP AI & Robotics Club — Website Plan

**Status:** waiting for your approval. Nothing is built yet.

Plain-English rule used throughout: every animation below says **what you see**, **what triggers it**, and **which tool does it**.

The three tools:

| Tool | Used for |
|---|---|
| **GSAP** (+ ScrollTrigger) | Anything tied to scrolling, big timelines, pinning sections, text reveals |
| **anime.js** | Small "sparkly" details — SVG line drawing, number counters, staggered grids, button micro-effects |
| **Three.js** (through React Three Fiber) | The 3D rover in the hero and the particle background |

Colour rules: background is near-black `#050810`, text is white `#F5F7FF`, accent is electric blue `#2D7BFF` with a lighter glow `#6EB2FF`. Nothing else, so the site feels like one piece.

---

## 0. Global things (apply to every section)

| # | Animation | What you see | Trigger | Tool |
|---|---|---|---|---|
| G1 | **Preloader** | Black screen, a thin blue line draws the club's outline logo (a hexagon with a rover-wheel dot), then a percentage counter runs 0→100. Curtain splits top/bottom and slides away to reveal the hero. | Page load, ~1.8 s max (skips if already visited this session) | anime.js (SVG draw + counter), GSAP (curtain) |
| G2 | **Smooth scroll** | Scrolling feels heavy and buttery instead of jumpy | Always | Lenis (small helper library that GSAP ScrollTrigger plugs into) |
| G3 | **Custom cursor** | A small blue dot follows the mouse with a slight lag; it grows into a ring over links/buttons and shows "VIEW" over project cards | Mouse move | GSAP `quickTo` |
| G4 | **Navbar** | Transparent at top. After scrolling 80 px it shrinks, gets a frosted-glass black background and a 1 px blue bottom line. Active section link gets a blue underline that slides between links. | Scroll | GSAP ScrollTrigger |
| G5 | **Link hover** | Nav text splits into letters; on hover each letter flips upward and a blue copy flips in from below | Hover | GSAP stagger |
| G6 | **Section headings** | Every big heading is split into characters that rise from below a mask, one after another, with a slight blur → sharp | Heading enters viewport (once) | GSAP SplitText-style (we use a free splitter) |
| G7 | **Background grid** | A faint blue dot-grid sits behind the whole page and slowly drifts; a soft blue spotlight follows the cursor over it | Always / mouse | CSS + GSAP |
| G8 | **Reduced motion** | If the visitor's OS says "reduce motion", all of the above become simple fades | Automatic | `prefers-reduced-motion` check |

---

## 1. HOME — Hero (the animejs.com-style showpiece)

Layout: full screen. Left = text. Right/centre = the 3D rover floating in space. Behind everything = star-particle field.

| # | Animation | What you see | Trigger | Tool |
|---|---|---|---|---|
| H1 | **Rover assembly** | The rover starts as ~200 scattered blue wireframe fragments. Over 1.6 s they fly inward and snap into a complete 6-wheel rocker-bogie rover (chassis, two rocker arms, two bogies, mast with camera + LiDAR puck, solar panel top, antenna). Wireframe edges glow blue, faces are matte black. | Right after preloader finishes | Three.js (custom geometry built in code), GSAP timeline drives the fragment positions |
| H2 | **Idle float** | Rover gently bobs up/down and yaws ±8°; wheels slowly spin; LiDAR puck rotates continuously; a thin blue scan-cone sweeps out of the LiDAR | Always, after H1 | Three.js `useFrame` |
| H3 | **Mouse parallax** | Move the mouse and the rover tilts toward it; the star field moves the opposite way (depth feeling) | Mouse move | Three.js + GSAP `quickTo` |
| H4 | **Headline** | "BUILDING THE MACHINES THAT EXPLORE" — words slide up out of a mask, staggered, with the word "EXPLORE" in blue that flickers on like a neon sign | After preloader, overlaps H1 | GSAP (mask reveal) + anime.js (flicker) |
| H5 | **Sub-line typewriter** | "AI & Robotics Club · NIT Andhra Pradesh" types itself with a blinking blue cursor | After H4 | anime.js |
| H6 | **CTA buttons** | "See the Rover" and "Join Us" fade up. On hover: a blue fill sweeps in from the left and a magnetic effect pulls the button slightly toward the cursor | After H5 / hover | GSAP |
| H7 | **Stat strip** | Three counters at the bottom-left: "40+ members", "12 projects", "IRC 2027 target" — numbers count up from 0 | After H6 | anime.js counter |
| H8 | **Scroll hint** | A tiny mouse icon with a dot that drops repeatedly, plus "SCROLL" text | Loop | anime.js |
| H9 | **Scroll-out** | As you scroll down, the hero is **pinned** for 100 vh: the rover rotates a full 180° to show its back, the headline fades and slides left, and the rover shrinks and drifts up-right to "park" behind the About section | Scroll (scrubbed — moves exactly with your scroll) | GSAP ScrollTrigger `scrub` + Three.js |
| H10 | **Star field** | ~1500 tiny points in 3D, slowly drifting; a few brighter blue ones twinkle | Always | Three.js Points |

---

## 2. ABOUT — "Who we are"

Layout: two columns. Left = a big paragraph. Right = a vertical timeline of the club's story (founded → first bot → IRC 2027).

| # | Animation | What you see | Trigger | Tool |
|---|---|---|---|---|
| A1 | **Paragraph scrub reveal** | The paragraph text starts dim grey; each word lights up to white as you scroll, like a highlighter moving across | Scroll (scrubbed) | GSAP ScrollTrigger |
| A2 | **Timeline line draw** | A vertical blue line draws itself downward; each milestone dot pops in with a ring pulse when the line reaches it | Scroll | anime.js SVG draw + GSAP |
| A3 | **Milestone cards** | Card slides in from the right with a slight 3D tilt that settles flat | When card reaches 80% of viewport | GSAP |
| A4 | **Parked rover** | The small rover from H9 sits faintly in the corner, still idle-floating, and slowly rotates as you scroll this section | Scroll | Three.js (same canvas, camera moves) |
| A5 | **Pillars row** | Three pillar cards (Perception · Autonomy · Hardware). Each has an icon that draws its SVG outline on entry; hover lifts the card and a blue border light travels around its edge | Enter / hover | anime.js (draw + border travel) |

---

## 3. PROJECTS — "What we build"

Layout: **horizontal scroll** section. You scroll down, but the cards move sideways.

| # | Animation | What you see | Trigger | Tool |
|---|---|---|---|---|
| P1 | **Horizontal pin** | Section pins; 5 large project cards slide horizontally as you scroll. A progress bar at the bottom fills blue. | Scroll (scrubbed) | GSAP ScrollTrigger pin + horizontal tween |
| P2 | **Card parallax** | The image inside each card moves slower than the card itself (depth) | Scroll | GSAP |
| P3 | **Card entry** | Each card's title letters cascade in; a corner tag ("AUTONOMY", "CV", "FPGA") types in | Card enters view | anime.js |
| P4 | **Hover** | Card tilts toward cursor (3D), a blue glow follows the cursor across the card surface, image zooms 5% | Hover | GSAP |
| P5 | **Featured: IRC Rover card** | Bigger card. Its image is replaced by a live mini 3D view of the same rover, rotating slowly. | Always | Three.js second viewport (same rover model reused) |
| P6 | **Tech chips** | Small chips (ROS, Jetson, LiDAR, PX4…) pop in staggered with a bounce | Card enters | anime.js `stagger` + elastic ease |

Cards planned: IRC Rover (featured) · Vision-based Vital Monitor · Neuromorphic SNN chip · Line-follower bot · Drone autonomy. You can rename these.

---

## 4. TEAM — "The people"

Layout: leads row on top, then a grid of members.

| # | Animation | What you see | Trigger | Tool |
|---|---|---|---|---|
| T1 | **Grid reveal** | Member cards appear in a wave from the centre outward (not left-to-right) | Section enters | anime.js `stagger` with `from: 'center'` grid mode |
| T2 | **Photo effect** | Photos are black-and-white with a blue duotone; hover turns them full colour and slides the name/role up from the bottom | Hover | GSAP |
| T3 | **Lead cards** | Bigger cards for leads. Behind each is a faint rotating hexagon outline that spins on hover | Hover | anime.js |
| T4 | **Role filter** | Buttons: All · Core · Software · Hardware. Clicking re-flows the grid — cards that leave shrink and fade, remaining ones slide into place | Click | GSAP Flip plugin |
| T5 | **Social icons** | Icon draws its outline on hover | Hover | anime.js SVG draw |

---

## 5. EVENTS — "What's happening"

Layout: an upcoming-events list on the left, past-events gallery strip on the right.

| # | Animation | What you see | Trigger | Tool |
|---|---|---|---|---|
| E1 | **Date flip** | Each event's date is a flip-clock style card that flips into view | Enter | anime.js |
| E2 | **List rows** | Rows slide in from the left with a blue line that wipes across underneath | Enter | GSAP stagger |
| E3 | **Row hover** | Row expands slightly, a blue arrow slides in from the right, the row background gets a soft gradient | Hover | GSAP |
| E4 | **Past-events marquee** | Photos scroll in an endless horizontal loop; hover slows it down; each photo has a tilt on hover | Always / hover | GSAP `horizontalLoop` |
| E5 | **Countdown** | A big countdown to the next event (days : hours : mins) with each digit rolling like a slot machine when it changes | Live (every second) | anime.js |

---

## 6. CONTACT / JOIN — "Get in touch"

Layout: left = big "Join the club" text and a form; right = the rover returns.

| # | Animation | What you see | Trigger | Tool |
|---|---|---|---|---|
| C1 | **Rover returns** | The 3D rover drives in from the right (wheels spinning, slight suspension bounce over an invisible bump) and stops, then its camera "looks" at the form | Section enters | Three.js + GSAP timeline |
| C2 | **Form fields** | Fields have only a bottom line. On focus the line draws blue from left to right and the label floats up | Focus | anime.js |
| C3 | **Submit** | Button morphs into a loading ring; on success the ring becomes a blue tick and the rover's antenna light blinks twice | Click / server response | anime.js (morph) + Three.js |
| C4 | **Big footer text** | "AI & ROBOTICS" in huge letters at the very bottom; letters slide up individually as the footer reaches view, and slowly drift sideways with scroll | Scroll | GSAP |
| C5 | **Footer links** | Same letter-flip as G5 | Hover | GSAP |

---

## 7. Mobile behaviour (kept honest)

The 3D rover stays but with fewer fragments (H1 uses ~80 instead of 200) and no mouse parallax. Horizontal project scroll (P1) becomes a normal vertical stack with the same card animations. Custom cursor (G3) is off. Everything else is the same but shorter.

---

## 8. Tech stack

**Frontend**

- React 18 + Vite (fast dev server)
- Tailwind CSS (spacing/colours) — all animation is JS, not CSS classes
- GSAP 3 + ScrollTrigger + Flip
- anime.js v4
- Three.js + @react-three/fiber + @react-three/drei
- Lenis (smooth scroll)
- React Router is **not** needed — one page, nav scrolls to sections

**Backend (Node.js — my recommended shape)**

Because it's a landing page with no database, the backend is small on purpose:

```
server/
  src/
    app.js            – Express app, security headers, CORS, rate limit
    routes/
      contact.js      – POST /api/contact   → validates, sends email
      newsletter.js   – POST /api/join      → validates, appends to a JSON file + emails you
      health.js       – GET  /api/health
    services/
      mailer.js       – Nodemailer (Gmail/SMTP) with an HTML template
    middleware/
      validate.js     – zod schema checks
      rateLimit.js    – 5 requests / 10 min per IP
  .env.example
```

- **Express** — simplest, well-known
- **zod** for checking form input
- **Nodemailer** to email you when someone submits the Join/Contact form
- **express-rate-limit + helmet** to stop spam
- In production, Express also serves the built React files (`client/dist`) so it's **one deploy** (Render / Railway free tier works)

**Folder layout**

```
rover-site/
  client/      – React app
  server/      – Node API
  REACT_SKILLS.md
  PLAN.md
```

---

## 9. Build order (once approved)

1. Scaffold client + server, theme tokens, Lenis, navbar (G2, G4, G5)
2. Rover 3D model in code + star field (H1, H2, H3, H10)
3. Hero text + preloader (G1, H4–H8)
4. Hero scroll-out + About (H9, A1–A5)
5. Projects horizontal section (P1–P6)
6. Team + Events (T1–T5, E1–E5)
7. Contact + backend + footer (C1–C5, server)
8. Mobile pass, reduced-motion pass, performance check (aim: 60 fps, Lighthouse ≥ 85)

---

## 10. Things to confirm

1. Headline text OK? ("BUILDING THE MACHINES THAT EXPLORE")
2. Project names — use my 5 placeholders, or send real ones?
3. Contact form emails go to which address?
4. Any club logo file? If not, I'll draw a simple hexagon-wheel logo.
