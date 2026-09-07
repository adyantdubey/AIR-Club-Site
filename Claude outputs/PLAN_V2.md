# AI & Robotics Club Website — v2 Plan (multi-page, 3D robots + interactive AI lab)

**Status:** waiting for your approval. v1 stays running until v2 replaces it.

Same reading rule as before: every animation says **what you see**, **what triggers it**, **which tool**.
New this time: every 3D model says **how you can interact with it**.

Tools stay the same (GSAP owns scroll, anime.js owns details, Three.js owns 3D) plus a few additions listed in section 9.

---

## 0. Site map (what changes from v1)

v1 was one long page. v2 is **11 pages** with animated transitions between them.

```
/                    Home        (hero rover kept, rest re-cut into "portals")
/robotics            Robotics hub  – 8 machines, live 3D previews
/robotics/rover      ┐
/robotics/arm        │
/robotics/drone      │  one page per machine
/robotics/uav        │  (same template, unique model + unique interaction)
/robotics/balancer   │
/robotics/cube       │
/robotics/butterfly  │
/robotics/hexabot    ┘
/ai                  AI Lab hub  – 8 interactive model playgrounds
/ai/playground       ┐
/ai/deep-net         │
/ai/cnn              │
/ai/transformer      │  one page per model
/ai/svm              │  (each is a hands-on 3D toy you can poke)
/ai/gradient         │
/ai/distillation     │
/ai/reinforcement    ┘
/about               (upgraded — lab, achievements, sponsors)
/events              (upgraded — calendar + photo wall)
/team                (as v1, placeholders allowed)
/contact             (as v1, rover drive-in kept)
```

Every 3D model is **built in code** (no model files), so the style stays consistent with the rover: matte black faces, glowing blue edges.

---

## 1. Global (all pages)

Everything from v1 (preloader, smooth scroll, cursor, navbar, split headings, dot-grid, reduced-motion) stays. New:

| # | Animation | What you see | Trigger | Tool |
|---|---|---|---|---|
| G9 | **Page transition** | Click a link → a black panel wipes up from the bottom with a thin blue edge; the wireframe of the *destination* (rover outline for /robotics, neuron outline for /ai) draws in the middle for 0.4 s; panel wipes away revealing the new page already animating in. Back-button does it in reverse. | Any navigation | GSAP (wipe) + anime.js (SVG draw) + React Router |
| G10 | **Mega-menu** | Hovering ROBOTICS / AI in the navbar drops a panel: 8 small cards, each with a tiny spinning wireframe icon of that project. Cards cascade in. | Hover / tap | GSAP Flip + Three.js icons (one shared canvas, 8 tiny scenes) |
| G11 | **Shared 3D viewer** ("the pedestal") | Every project/model page uses the same viewer: drag to rotate, scroll-wheel/pinch to zoom (limited), auto-spins slowly when idle, snaps back after 3 s. A faint blue ring on the floor shows the rotation; a small compass in the corner shows which way is "front". Double-click resets. | Drag / wheel / touch | Three.js OrbitControls (drei) + GSAP for snap-back |
| G12 | **Exploded view** | On every machine page a toggle (or scrolling into the "Inside" section) makes all parts float outward along their own axis with labels drawing in — then click a label to see that part's note. | Toggle / scroll | GSAP timeline on part positions (same trick as the rover assembly) |
| G13 | **Bloom glow** | Blue edges actually glow instead of being flat lines; the antenna light blooms. | Always (desktop only) | postprocessing Bloom pass |
| G14 | **Breadcrumb ticker** | Top-left mono text `ROBOTICS / HEXABOT` types itself on every page load | Page load | anime.js |
| G15 | **Route loading** | Each 3D page is its own download chunk; while it loads, the pedestal ring pulses | Navigation | React lazy + Suspense |

---

## 2. HOME (/) — re-cut

Hero (H1–H10) stays exactly as built. The rest becomes "portals" that send people into the two big sections.

| # | Animation | What you see | Trigger | Tool |
|---|---|---|---|---|
| HM1 | **Robotics portal** | Full-screen dark band. 8 wireframe machines fly in one after another from the right and line up as a "showroom" row (rover, arm, drone, UAV, balancer, cube, butterfly, hexabot) — all idle-animating (props spinning, wings flapping, legs stepping). Scrolling pans the camera along the row. Big text "8 MACHINES. ONE LAB." | Section enters / scroll | Three.js (one scene, all 8 mini models) + GSAP scrub |
| HM2 | **Portal hover** | Hover any machine → it lifts, its name + one-liner slides in, cursor says "OPEN". Click → G9 transition to its page. | Hover / click | GSAP + raycasting |
| HM3 | **AI portal** | Band flips to white text on deep blue. A 3D neural network (5 layers, ~120 neurons) builds itself layer by layer; signal pulses travel left→right along the connections continuously. Text: "MODELS YOU CAN TOUCH." | Section enters | Three.js InstancedMesh + shader pulses |
| HM4 | **AI portal scroll** | As you scroll, the camera flies *through* the network (between the layers) and out the other side into the next section | Scroll (scrubbed) | GSAP camera path |
| HM5 | **Numbers band** | Counters: machines built, models in the lab, members, competitions — each with a small SVG that draws | Enter | anime.js |
| HM6 | **Latest strip** | 3 cards: next event, latest project, join CTA — tilt + glow | Enter / hover | GSAP |
| HM7 | Contact drive-in + footer | As v1 (C1–C5) | | |

---

## 3. ROBOTICS HUB (/robotics)

Layout: hero with the 8 machines orbiting a centre point; below it a filterable grid.

| # | Animation | What you see | Trigger | Tool |
|---|---|---|---|---|
| R1 | **Orbit hero** | The 8 machines orbit slowly in a ring around the title "ROBOTICS" like a carousel. Mouse drag spins the ring; the front-most machine is bigger and its name shows. | Drag / auto | Three.js + GSAP inertia |
| R2 | **Grid cards** | 8 cards, each a **live mini 3D** (not an image), auto-rotating slowly. Hover → model speeds up and does its signature move (arm waves, drone lifts, cube twists once…). | Hover | Three.js (8 small canvases via drei `View` — one WebGL context, no lag) |
| R3 | **Filter chips** | Ground · Air · Manipulation · Puzzle — grid re-flows | Click | GSAP Flip |
| R4 | **Stats rail** | Sticky right rail: "DOF", "sensors", "status" for the hovered card, digits roll | Hover | anime.js |
| R5 | **Card → page** | Click card: the mini model *grows* and flies to the centre, becomes the page hero (seamless) | Click | GSAP Flip + shared canvas |

---

## 4. ROBOTICS DETAIL PAGES (/robotics/:machine) — one template, 8 machines

**Template sections (same on every machine page):**

| # | Section | What you see | Trigger | Tool |
|---|---|---|---|---|
| D1 | **Pedestal hero** | Machine on the pedestal (G11), full screen, fully rotatable. Name types in, spec chips pop in. | Load | G11 + anime.js |
| D2 | **Signature interaction** | The unique thing you can *do* with this machine (table below) — controls appear as a small floating panel | Load | Three.js + custom code |
| D3 | **Inside (exploded)** | Scroll → parts explode outward (G12), 6–10 labels draw in with leader lines | Scroll (scrubbed) | GSAP + SVG |
| D4 | **How it works** | 3-step horizontal strip with animated mini-diagrams (SVG draw) | Enter | anime.js |
| D5 | **Spec sheet** | Table rows slide in; numbers count | Enter | GSAP + anime.js |
| D6 | **Build log** | Vertical timeline with photos (placeholders until you send real ones) | Scroll | As v1 About |
| D7 | **Next machine** | Bottom: the next machine peeks in from the right edge, rotating; click to go | Enter / click | Three.js + G9 |

**The 8 machines — model design + signature interaction:**

| Machine | How it's built in code (main pieces) | Idle animation | **What you can do (D2)** |
|---|---|---|---|
| **Rover** | existing 150-piece rocker-bogie | wheels, LiDAR sweep | Drive it with WASD/arrow keys on a small terrain; suspension reacts to bumps |
| **Robotic arm** (6-axis) | base turntable, shoulder, elbow, wrist ×3, 2-finger gripper — ~40 pieces | slow pick-and-place loop | **Drag a glowing target ball** anywhere; the arm reaches it in real time (inverse kinematics). Toggle "show joint angles". |
| **Quadcopter drone** | X-frame, 4 motors, 4 props, camera gimbal, landing legs — ~35 pieces | props blur-spin, gentle hover wobble | **Throttle slider + tilt joystick**: drone climbs, tilts and flies a loop; a glowing trail shows the path; props change speed per motor |
| **Fixed-wing UAV** | fuselage, wings, tail, ailerons, elevator, rudder, pusher prop — ~30 pieces | banks left/right | Move the mouse = control stick: ailerons/elevator/rudder move, plane rolls & pitches; blue wind-streamlines flow over the wings |
| **Self-balancing robot** | 2 wheels, tall body, IMU chip, battery — ~25 pieces | tiny corrective wobble | **Push it** (click/drag): it tips, then the PID controller catches it. Sliders for P / I / D so students see under- and over-correction; a live graph plots the angle |
| **Rubik's cube solver** | 27 cubelets + 2 gripper claws + frame + camera — ~45 pieces | cube slowly turns | **Scramble** button (random 20 moves, animated) then **Solve**: claws turn faces, move notation (R U R' …) types out on the side, counter shows moves left |
| **RC butterfly** (ornithopter) | body, 2 wing pairs with translucent membranes, tail, tiny motor — ~20 pieces | wings flap in a figure-8, whole thing bobs | **Flap-rate slider**; hold space to "fly": it lifts off and circles the pedestal leaving a faint blue dust trail |
| **Hexabot** (6-leg walker) | body + 6 legs × 3 segments, 18 servos, sensor head — ~50 pieces | tripod-gait walking in place | **Walk it**: arrow keys / on-screen d-pad; choose terrain (flat / rocks) — legs adapt with simple IK; speed slider; "show gait diagram" overlay |

---

## 5. AI LAB HUB (/ai)

| # | Animation | What you see | Trigger | Tool |
|---|---|---|---|---|
| A1 | **Neuron tunnel hero** | Camera sits inside a giant 3D neural net; pulses fly past you; mouse moves the camera slightly; title "THE AI LAB" | Load / mouse | Three.js + shader |
| A2 | **Lab cards** | 8 cards, each with a **live mini visual** of the model (mini network, mini attention arcs, mini SVM plane…) | Hover | Three.js `View` |
| A3 | **Difficulty pips** | Each card shows 1–3 pips; pips fill on hover | Hover | anime.js |
| A4 | **"Path" line** | A dotted line connects cards in learning order (Playground → Deep net → CNN → …) and draws in as you scroll | Scroll | anime.js SVG draw |

---

## 6. AI LAB PAGES (/ai/:model) — one template, 8 playgrounds

**Template:** left = controls panel (sliders, buttons, tiny live chart), right = full-height 3D canvas, below = "What just happened" explainer that updates as you play, then "Try this" challenges (3 checkboxes that tick when done).

All the maths runs **in the browser in plain JavaScript** (no heavy ML library) so pages stay fast. Two labs ship with small pre-trained weights I train offline in Python.

| Lab | 3D visual | **What you can do** | What's really computed |
|---|---|---|---|
| **1. Neural-net playground** | Layers of glowing neurons, connections as lines whose thickness = weight; signals travel as particles | Add/remove layers and neurons (+/− buttons); pick a dataset (circle / XOR / spiral); press **Train** and watch weights thicken/thin and the 3D decision surface morph; change learning rate; click any neuron to see what it "sees" | Real tiny MLP trained live with backprop (JS) |
| **2. Deep net** | A tall 8-layer network you can fly along; each layer's neurons light up per input | Slider picks an input; scrub through layers; "depth vs width" toggle shows two nets side by side racing to fit the same data | Same engine as Lab 1, bigger |
| **3. CNN — digit reader** | Draw a digit on a pad → your drawing floats into a 3D stack: conv filters, feature maps light up, final 10 bars rise | Draw, erase, watch the guess; hover a filter to see what it detects | Pre-trained tiny CNN weights (~150 KB JSON), forward pass in JS |
| **4. Transformer — attention** | Your sentence's tokens float in a ring; glowing arcs between tokens = attention; 4 heads as 4 colours; layers stacked in Z | Type any sentence; pick head/layer; toggle Q·K heatmap; "next word" button shows top-5 predictions | Pre-trained tiny 2-layer transformer (~400 KB), real attention maths in JS |
| **5. SVM** | 3D scatter of two classes; the separating plane (or curved surface for RBF) with margin planes; support vectors ringed | Click to drop points of class A/B; switch kernel linear/RBF; drag C and gamma sliders; watch the surface bend | Real SVM (SMO algorithm in JS) |
| **6. Gradient descent** | A 3D loss landscape (hills and valleys); a glowing ball rolls downhill leaving a trail | Choose landscape; set learning rate & momentum; drop the ball anywhere; race SGD vs Adam side by side | Real gradient steps on a chosen function |
| **7. Distillation** | Big "teacher" net left, small "student" right; soft-label particles flow teacher → student | Temperature slider (particles spread/sharpen); Train student; compare accuracy bars; "train student alone" to see the difference | Teacher = Lab 1 net trained big; student trained on teacher's soft outputs (JS) |
| **8. Reinforcement learning** | The rover on a 3D grid with rocks and a flag; Q-values shown as arrows on tiles | Press **Learn**: episodes run fast-forward; arrows grow; then **Drive** shows the learned path; move the flag/rocks and retrain | Q-learning in JS |

Each lab also has: **"Reset"**, **"Explain"** (opens a short plain-English overlay with an animated diagram), and **shareable state** in the URL (so students can send a link to a setup).

---

## 7. ABOUT / EVENTS / TEAM / CONTACT (upgraded so they look "filled")

**About (/about)**
- v1 story timeline + pillars kept
- **Lab tour**: 3D isometric map of the robotics lab (benches, 3D printer, test track); hover a spot → what happens there
- **Achievements wall**: cards with trophies that spin on hover; count-ups
- **Sponsors/partners marquee** (logos or names)
- **"A week in the club"** horizontal strip: Mon–Sun, each day's typical activity slides in

**Events (/events)**
- v1 list + countdown + marquee kept
- **Calendar view** (month grid, event dots pulse; click → detail card flips open)
- **Photo wall**: masonry of past-event photos with hover zoom (placeholders until you send photos)
- **Register** button per event → opens the same form as Contact (posts to the API with event name)

**Team (/team)** — as v1. Placeholders allowed.

**Contact (/contact)** — as v1 (rover drives in, form morphs), plus a "Which team?" chip row (Rover / Arm / Drone / AI Lab…).

---

## 8. Mobile

- All 3D pages work with touch (one-finger rotate, two-finger zoom)
- Lower part counts and no bloom on phones
- Signature interactions get on-screen buttons where keys are used (rover, hexabot)
- AI labs: controls panel collapses into a bottom sheet

---

## 9. Tech additions

| Add | Why |
|---|---|
| `react-router` v7 | multiple pages + transitions |
| drei `OrbitControls`, `View`, `Html` | rotatable models; many mini-3D cards on one canvas; labels |
| `@react-three/postprocessing` | bloom glow (desktop only) |
| Hand-written JS ML (`client/src/ml/`) | MLP, SVM (SMO), Q-learning, gradient descent — small and fast |
| Two weight files (`cnn.json`, `transformer.json`) | trained offline with PyTorch, shipped as static files |
| Route-level code splitting | each machine/lab is its own chunk — Home stays fast |

Backend: unchanged, plus `POST /api/register` (event name + form) and `GET /api/events` (serves `events.json` so you can edit events without rebuilding).

Folder additions:
```
client/src/
  pages/            Home, RoboticsHub, MachinePage, AiHub, LabPage, About, Events, Team, Contact
  machines/         rover/ arm/ drone/ uav/ balancer/ cube/ butterfly/ hexabot/   (parts.js + Model.jsx + Interaction.jsx + content.js)
  labs/             playground/ deepnet/ cnn/ transformer/ svm/ gradient/ distillation/ rl/
  ml/               mlp.js, svm.js, qlearn.js, optim.js
  three/            Pedestal.jsx, Exploded.jsx, MiniView.jsx, Bloom.jsx
  transitions/      PageWipe.jsx
public/weights/     cnn.json, transformer.json
```

---

## 10. Build order (once approved)

| Phase | What ships | Rough size |
|---|---|---|
| 1 | Router, page wipe, mega-menu, shared pedestal + exploded-view system, Home re-cut with 8-machine showroom (models can be simple placeholders first) | 1 session |
| 2 | 8 machine models + idle animations + hub page | 2 sessions |
| 3 | 8 signature interactions (IK arm, drone flight, PID balancer, cube solver, hexabot gait…) | 2 sessions |
| 4 | AI hub + labs 1, 2, 5, 6, 7, 8 (pure JS maths) | 2 sessions |
| 5 | Labs 3 & 4 (train weights offline, ship JSON) | 1 session |
| 6 | About/Events upgrades, register API, mobile pass, performance pass (60 fps, Lighthouse ≥ 85) | 1 session |

Each phase ends with screenshots for you to check before the next.

---

## 11. Confirm before I start

1. Machine list final? (rover, arm, quad drone, fixed-wing UAV, self-balancer, cube solver, butterfly, hexabot) — anything to add/remove?
2. AI lab list final? (playground, deep net, CNN, transformer, SVM, gradient descent, distillation, RL) — anything to add/remove?
3. OK that the CNN and transformer labs use *small* models I train offline (they'll be honest but simple — e.g. the transformer predicts next words on a small English text, not ChatGPT-level)?
4. Home page: keep About/Events condensed on Home, or Home = hero + two portals + contact only?
