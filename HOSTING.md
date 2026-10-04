# Putting the site online for free — Supabase + Cloudflare Pages

Two free services:

- **Supabase** keeps the data (projects, events, team, page text, photos) and the admin log-ins.
- **Cloudflare Pages** serves the website itself and rebuilds it whenever you push to GitHub.

No card is needed for either. About 30 minutes, start to finish.

---

## Part 1 — Supabase (the database)

1. Open https://supabase.com → **Start your project** → sign up (GitHub or email).
2. **New project**. Name `air-club`, set a database password (save it somewhere safe),
   region **Mumbai (ap-south-1)**, plan **Free**. Wait about 2 minutes.
3. Left menu → **SQL Editor** → **New query**. Open `supabase/database_schema.sql` from this
   folder, copy everything, paste, press **Run**. You should see "Success".
4. **New query** again → same with `supabase/seed_content.sql`. This loads the club's real
   content (team, faculty coordinator, earlier projects, past events, Learn videos, contact).
5. Make your admin log-in: left menu → **Authentication** → **Users** → **Add user** →
   **Create new user**. Enter your email and a password, tick **Auto Confirm User**.
6. Back in **SQL Editor**, run this with your email:

   ```sql
   update public.profiles set role = 'super_admin' where email = 'you@example.com';
   ```

7. Copy two values (you paste them into Cloudflare in Part 3):
   - **Project URL** — looks like `https://abcdxyz.supabase.co`
     (**Project Settings → Data API**, or the **Connect** button at the top).
   - **Publishable key** — starts with `sb_publishable_` (**Project Settings → API Keys**).
     Older projects call it the **anon public** key and it starts with `eyJ`. Either works.

   Never use the **secret** / **service_role** key in the website.

## Part 2 — Put the code on GitHub

On your laptop, open Command Prompt:

```
cd /d "D:\air club website\AIR-Club-Site"
git add .
git commit -m "Club platform, admin area, real content"
git push origin main
```

(If Git asks who you are, run `git config --global user.name "Your Name"` and
`git config --global user.email "you@example.com"` once, then repeat the commit.)

The `.env` file is never uploaded — that is on purpose.

## Part 3 — Cloudflare Pages (the website)

1. Open https://dash.cloudflare.com/sign-up → sign up with your email and verify it.
2. Left menu → **Workers & Pages** → **Create application** → **Pages** →
   **Connect to Git** (also shown as "Import an existing Git repository").
3. **Connect GitHub** → sign in → allow access to the `AIR-Club-Site` repository →
   pick it → **Begin setup**.
4. Fill in:

   | Box | Value |
   |---|---|
   | Project name | `air-club` (your address becomes `air-club.pages.dev`) |
   | Production branch | `main` |
   | Framework preset | `None` |
   | Build command | `npm run build` |
   | Build output directory | `dist` |
   | Root directory (advanced) | `client` |

5. Open **Environment variables (advanced)** and add:

   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | the Project URL from Part 1 |
   | `VITE_SUPABASE_ANON_KEY` | the publishable key from Part 1 |
   | `NODE_VERSION` | `22` |

6. **Save and Deploy**. After 2–3 minutes you get a live address like
   `https://air-club.pages.dev`.

## Part 4 — Last two settings

1. Supabase → **Authentication** → **URL Configuration** → set **Site URL** to your live
   address (e.g. `https://air-club.pages.dev`) and add the same address under
   **Redirect URLs**. This makes "Forgot password" emails link to the right place.
2. Open `https://air-club.pages.dev/login`, log in with the user from Part 1.
   You land on `/admin`. The yellow "Demo mode" badge should be gone.

## Part 5 — Check it works

- Admin → **Page content** → change an FAQ answer → Save → open the home page: it changed.
- Admin → **Team** → add a member with a photo.
- Public site → **Join** form → send a test → it appears on the Admin **Dashboard**.

## Adding more admins

Supabase → **Authentication → Users → Add user** for each person. Then on the site:
**Admin → Settings → Access & roles** and pick their role.

## Updating the site later

- **Content** (people, projects, events, text, photos): just use `/admin`. No rebuild.
- **Code**: `git add .` → `git commit -m "..."` → `git push`. Cloudflare rebuilds by itself.
- **Changed an environment variable?** Cloudflare → your project → **Deployments** →
  **Retry deployment**, otherwise the old value stays.

## Your own address (optional)

Cloudflare → your Pages project → **Custom domains** → **Set up a custom domain**.
For `airclub.nitandhra.ac.in`, the institute's IT team must add one DNS record
(a CNAME pointing to `air-club.pages.dev`) — Cloudflare shows the exact record to send them.
Afterwards, update the **Site URL** in Supabase to the new address.

## Good to know (free plan limits)

- Supabase free: 2 projects, 500 MB database, 1 GB photos, 5 GB traffic a month.
- A free Supabase project **pauses after 7 days with no activity**. Any visit to the site
  counts as activity. If it does pause: Supabase dashboard → **Restore project**.
- Cloudflare Pages free: unlimited visitors, 500 builds a month.
- Forms (Join, event registration) are saved in the database and shown in the admin area.
  Nobody is emailed. For emails as well, see Option A in `client/.env.example`.
- The old Node `server/` folder is not used in this setup.

## If something goes wrong

| What you see | Fix |
|---|---|
| Site still says "Demo mode" | The two `VITE_SUPABASE_…` variables are missing or mistyped in Cloudflare. Fix, then **Retry deployment**. |
| Build fails in Cloudflare | Check Root directory is `client` and output is `dist`. |
| Log-in says "Invalid login credentials" | User not created, or "Auto Confirm" was not ticked. Re-create the user. |
| Logged in but everything is read-only | Run the `update public.profiles … super_admin` line from Part 1 step 6. |
| "permission denied for table …" | Run `supabase/database_schema.sql` again (safe to repeat). |
| A page shows "Not found" after refresh | `client/public/_redirects` must be in the repo (it is). |
