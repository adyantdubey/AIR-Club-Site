# Brief for module builders (machines & AI labs)

Project: `/home/claude/rover-site/client` — React 19 + Vite 7 + Tailwind 4, GSAP 3.15 (+ScrollTrigger, Flip), anime.js 4.5, Three.js 0.185 via @react-three/fiber 9 + @react-three/drei 10. **Do not add npm packages.** Everything is already installed.

Look & feel: blue `#2d7bff` / glow `#6eb2ff`, white text `#f5f7ff`, near-black bg `#050810`. All 3D is "matte black faces + glowing blue edges" — use only the `<Wire>`, `<Strut>`, `<Led>` parts from `src/three/wire.jsx` for solid geometry. Lines/points/instanced meshes are fine for data visuals (labs).

Read first (short):
- `src/machines/CONTRACT.md` or `src/labs/CONTRACT.md` (whichever you build)
- `src/machines/rover/index.jsx` — a complete reference machine module
- `src/lib/store.js`, `src/three/helpers.js`, `src/three/wire.jsx`, `src/components/ui/Controls.jsx`
- `REACT_SKILLS.md` (rules: `useFrame` with `dt`, no React state per frame, refs for 3D)

Rules:
- Only create/edit files inside the folders you were assigned (plus the `src/ml/*.js` files you own, if any).
- Plain-English comments for a beginner reader; short.
- Real maths, not fake: if a lab says "trains", it must actually train.
- Performance: keep per-frame work small (≤ ~2 ms). Instanced meshes / Points for > 100 items.
- No `document.querySelector` in components; refs only. No inline hex colours in DOM UI (use CSS vars); 3D colours via `wire.jsx` exports or the palette in the contract.
- Idle animation must always be running, even with no user input, so hub cards look alive.

Verify (from `client/`):
1. `npx vite build --outDir /tmp/build-<yourname> --emptyOutDir 2>&1 | tail -5` → must end with "built in".
2. If `src/pages/MachinePage.jsx` (or `LabPage.jsx`) exists, also smoke-test visually:
   `npx vite --port <unique 5-digit port> &` then use Playwright from `/home/claude/.npm-global/lib/node_modules/playwright/index.mjs` (chromium launch args: `['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']`), open `http://localhost:<port>/robotics/<slug>` (or `/ai/<slug>`), wait 6 s, screenshot to `/tmp/shot-<slug>.png`, print any console errors, then kill the server. Look at the screenshot with the Read tool and fix obvious problems (nothing visible, wrong scale, errors).
3. Final message: list files created, what the interaction does, any contract deviations, and known limitations. Keep it short.
