# AI & Robotics Club — NIT Andhra Pradesh · Website

Multi-page club site: 8 code-built, rotatable 3D machines, 8 interactive AI labs (real maths in the browser),
GSAP scroll animations and anime.js details — plus a club platform: projects list, gallery, Idea Box,
announcements, staff log-in and an admin dashboard.
Frontend: React + Vite + React Router. Backend: Node + Express (forms/email) + Supabase (database + log-ins).

Public pages: `/` · `/robotics` · `/robotics/<machine>` · `/ai` · `/ai/<lab>` · `/projects` · `/events` ·
`/ideas` · `/announcements` · `/gallery` · `/learn` · `/about` · `/team` · `/contact` · `/login`,
plus a story page for each earlier project (`/projects/<name>`) and each event (`/events/<id>`)

Admin pages (log-in needed): `/admin` (dashboard) · `/admin/projects` · `/admin/events` ·
`/admin/announcements` · `/admin/ideas` · `/admin/achievements` · `/admin/gallery` · `/admin/team` ·
`/admin/content` (page text: headline, counters, About, values, history, lab tour, week, sponsors, FAQ, Techkriya) ·
`/admin/learn` (Learn videos) · `/admin/settings`

## Demo mode vs real database

Out of the box the site runs in **demo mode** — no setup needed. It uses the sample data in
`client/src/data/seed.js`, saves your admin changes in your own browser only, and the `/login`
page lists six demo accounts (one per role, password `demo1234`).

To make it real and shared, follow **`SUPABASE_SETUP.md`** (about 10 minutes, free): create a
Supabase project, run `supabase/database_schema.sql` then `supabase/seed_content.sql`, paste two keys into `client/.env`.

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

Open http://localhost:5173. Admin: http://localhost:5173/login → pick a demo account.

While `SEND_EMAILS=false` in `server/.env`, form submissions are printed in the server terminal
and saved to `server/data/signups.jsonl` instead of being emailed.

## Hosting it free (no server)

**Recommended: Supabase + Cloudflare Pages — both free. Full step-by-step in `HOSTING.md`.**

Short version: run the two SQL files in Supabase, push this folder to GitHub, then in
Cloudflare → **Workers & Pages → Create application → Pages → Connect to Git** set
root directory `client`, build command `npm run build`, output `dist`, and add the
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` variables.

Once Supabase is connected the two forms (Join, Event registration) save straight to the
database and show up in the admin area, so the Node server is not needed. To also get each
form by email, use a free form service — see Option A in `client/.env.example`.

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
| Lab tour spots, achievements, week, sponsors | `client/src/pages/About.jsx` (arrays at the top of each section) |
| Projects, events, team, achievements, gallery, announcements, ideas | **Admin dashboard** (`/admin`) — no code needed |
| Club email, office hours, mission/vision, social links | **Admin → Settings** |
| Real club content from the previous website (about text, team, earlier projects, past events, FAQ, Learn videos) | `client/src/data/oldSite.js` |
| Sample data used in demo mode | `client/src/data/seed.js` |
| Who may edit what (roles) | `client/src/lib/roles.js` + `supabase/database_schema.sql` (the real lock) |
| Colours / fonts | `client/src/styles/tokens.css` |
| Headline, hero text | `client/src/components/sections/Hero.jsx` |
| Club story timeline | `client/src/components/sections/About.jsx` |
| Email address in footer/contact | `client/src/components/sections/Contact.jsx` |

## How the new parts fit together

| Piece | File |
|---|---|
| Reads/writes all data (Supabase or demo) | `client/src/lib/db.js` |
| Log-in state + roles | `client/src/lib/auth.jsx`, `client/src/lib/roles.js` |
| Database tables, security rules, audit log | `supabase/database_schema.sql` |
| New public pages | `client/src/pages/Projects.jsx`, `Gallery.jsx`, `Ideas.jsx`, `Announcements.jsx`, `Login.jsx` |
| New home-page sections | `client/src/components/sections/HomeExtras.jsx` |
| Admin pages | `client/src/admin/*` |
| Shared UI (badges, tables, forms, modal) | `client/src/components/ui/kit.jsx`, `DataTable.jsx` |

## Docs

- `SUPABASE_SETUP.md` — connect the real database and make yourself super admin
- `PLAN.md` (v1) and `PLAN_V2.md` — every animation, page by page
- `REACT_SKILLS.md` — rules for writing new components
- `client/src/machines/CONTRACT.md`, `client/src/labs/CONTRACT.md` — how to build a new machine / lab module
- `client/AGENT_BRIEF.md` — the brief given to the module builders (useful for new contributors)

## Form data

- Join requests and event registrations are also saved to the database — they show up in
  **Admin → Dashboard** (join requests) and **Admin → Events** (registrations, with CSV download).
- With the Node server: join requests → `server/data/signups.jsonl`, event registrations →
  `server/data/registrations.jsonl` (+ email when `SEND_EMAILS=true`).
- Hosted free/static: submissions go to whichever service you set in `client/.env`
  (Web3Forms/Formspree email them to you; Netlify Forms lists them in its dashboard).

Where the forms send data is decided in one file: `client/src/lib/forms.js`.
