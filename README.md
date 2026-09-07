# AI & Robotics Club — NIT Andhra Pradesh · Website

Multi-page club site: 8 code-built, rotatable 3D machines, 8 interactive AI labs (real maths in the browser),
GSAP scroll animations and anime.js details. Frontend: React + Vite + React Router. Backend: Node + Express (no database).

Pages: `/` · `/robotics` · `/robotics/<machine>` · `/ai` · `/ai/<lab>` · `/about` · `/events` · `/team` · `/contact`

## Run it (first time)

You need Node.js 18 or newer.

```bash
# 1. install everything
npm run install:all

# 2. set up the server config
copy server\.env.example server\.env      # Windows
# cp server/.env.example server/.env      # Mac/Linux

# 3. start both (two terminals is simplest)
npm run dev:server     # → http://localhost:4000  (API)
npm run dev:client     # → http://localhost:5173  (website)
```

Open http://localhost:5173.

While `SEND_EMAILS=false` in `server/.env`, form submissions are printed in the server terminal
and saved to `server/data/signups.jsonl` instead of being emailed.

## Hosting it free (no server)

Almost the whole site is static files — the Node server exists **only** to receive the two
forms (Join and Event registration) and email/save them. Point the forms at a free form
service instead and you need no server at all.

**Recommended: Cloudflare Pages + Web3Forms — free, fast in India, nothing to maintain.**

1. Get a form key at https://web3forms.com (paste your club email, it mails you a key).
2. `copy client\.env.example client\.env` and uncomment the three `endpoint` lines,
   pasting your key into `VITE_FORM_ACCESS_KEY`.
3. Push this folder to GitHub.
4. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git**, then set:
   - Build command: `npm install && npm run build`
   - Build output directory: `client/dist`
   - Root directory: leave blank
5. Deploy. You get `your-club.pages.dev` free, and form submissions arrive by email.

`client/public/_redirects` is already in place so deep links like `/robotics/arm` survive a
refresh. **Netlify** works identically with the same settings (and you can use
`VITE_FORM_MODE=netlify` to skip Web3Forms — submissions then land in the Netlify dashboard).
**Vercel** works too — `client/vercel.json` handles the routing; set the root directory to `client`.

GitHub Pages also works but needs a `base` path in `vite.config.js`, so prefer the three above.

| Host | Free tier | Notes |
|---|---|---|
| Cloudflare Pages | unlimited bandwidth | fastest from India, no cold starts |
| Netlify | 100 GB/month | built-in form handling, no third-party needed |
| Vercel | 100 GB/month | set root directory to `client` |
| Render (Node) | 750 h/month | only if you want the Node server; it sleeps after 15 min idle |

## Build for production (one deploy, with the Node server)

```bash
npm run build      # builds client/dist
npm start          # server serves the API AND the built site on PORT (default 4000)
```

Deploy the whole folder to Render / Railway / a VPS. Set the `.env` values there.

## Where to edit content

| What | File |
|---|---|
| A machine's text, specs, build log | `client/src/machines/<slug>/index.jsx` (bottom of the file) |
| A lab's explain text / challenges | `client/src/labs/<slug>/index.jsx` (bottom of the file) |
| Add a machine or lab | copy a folder, then add a line in `client/src/machines/index.js` / `client/src/labs/index.js` |
| Events without rebuilding | rename `server/data/events.example.json` → `events.json` and edit |
| Lab tour spots, achievements, week, sponsors | `client/src/pages/About.jsx` (arrays at the top of each section) |
| Project cards | `client/src/data/projects.js` |
| Team members + photos | `client/src/data/team.js` |
| Events + countdown | `client/src/data/events.js` |
| Colours / fonts | `client/src/styles/tokens.css` |
| Headline, hero text | `client/src/components/sections/Hero.jsx` |
| Club story timeline | `client/src/components/sections/About.jsx` |
| Email address in footer/contact | `client/src/components/sections/Contact.jsx` |

## Docs

- `PLAN.md` (v1) and `PLAN_V2.md` — every animation, page by page
- `REACT_SKILLS.md` — rules for writing new components
- `client/src/machines/CONTRACT.md`, `client/src/labs/CONTRACT.md` — how to build a new machine / lab module
- `client/AGENT_BRIEF.md` — the brief given to the module builders (useful for new contributors)

## Form data

- With the Node server: join requests → `server/data/signups.jsonl`, event registrations →
  `server/data/registrations.jsonl` (+ email when `SEND_EMAILS=true`).
- Hosted free/static: submissions go to whichever service you set in `client/.env`
  (Web3Forms/Formspree email them to you; Netlify Forms lists them in its dashboard).

Where the forms send data is decided in one file: `client/src/lib/forms.js`.
