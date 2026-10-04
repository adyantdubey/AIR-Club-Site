# Connecting the real database (Supabase) — 10 minutes

Until you do this, the site runs in **demo mode**: sample data, saved only in your own
browser, with six demo log-ins on `/login` (password `demo1234`). Everything works, but
nobody else sees your changes.

Supabase is a free hosted database with log-ins built in. Once connected, every admin
edit is saved for everyone, and the security rules decide who can change what.

## 1. Make a Supabase project

1. Go to https://supabase.com → sign in → **New project**.
2. Name it (e.g. `air-club`), set a database password (save it somewhere), pick the
   **Mumbai (ap-south-1)** region, and create it. Wait ~2 minutes.

## 2. Create the tables

1. Left menu → **SQL Editor** → **New query**.
2. Open `supabase/database_schema.sql` from this folder, copy everything, paste, **Run**.
3. You should see "Success". (Running it again later is safe.)
4. Do the same with `supabase/seed_content.sql`. This loads the club's real content:
   team, faculty coordinator, earlier projects, past events, Learn videos and contact details.

This creates 15 tables, the security rules (row-level security) on every table,
the 6 roles, the audit log, and a public `media` storage folder for photos.

## 3. Paste two keys into the website

1. Left menu → **Project Settings** → **API Keys** (the **Project URL** is under **Data API**,
   or on the project's home page).
2. Copy the **Project URL** and the **publishable** key (starts with `sb_publishable_`).
   Older projects call it the **anon public** key (starts with `eyJ`). Either one works.
3. In this folder, copy `client/.env.example` to `client/.env` (if you haven't already) and
   fill in the last two lines (remove the `#` at the start):

   ```
   VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=sb_publishable_...
   ```

4. Stop and restart `npm run dev:client`. The yellow "Demo mode" badge in the admin area
   disappears.

The publishable / anon key is safe to put in the website — the security rules protect the data.
Never put the **secret** / **service_role** key in the website.

## 4. Make yourself the first super admin

1. Supabase → **Authentication** → **Users** → **Add user** → **Create new user**.
   Enter your email and a password, tick "Auto confirm".
2. Back in **SQL Editor**, run (with your email):

   ```sql
   update public.profiles set role = 'super_admin' where email = 'you@example.com';
   ```

3. Log in on the website at `/login`. You land on `/admin`.

## 5. Add the rest of the committee

Add each person in **Authentication → Users** the same way. They show up in
**Admin → Settings → Access & roles** as "Viewer"; pick their role there.

| Role | Can change |
|---|---|
| Super admin | Everything, including other people's roles |
| Club admin | Everything except roles (includes Page content and Learn videos) |
| Project coordinator | Projects, achievements |
| Event coordinator | Events, announcements, gallery |
| Idea reviewer | Idea Box decisions |
| Viewer | Nothing — can look at the dashboard |

## 6. Your content

After `seed_content.sql` the database holds the club's real content. Current projects,
upcoming events, announcements, achievements and gallery photos start empty — add them from `/admin`. The sample content you saw in demo mode lives in
`client/src/data/seed.js` if you want to copy text from it.

Text that is not a project, event or person — the home headline and counters, About
paragraphs, values, club history, lab tour, weekly schedule, sponsors, FAQ and the Techkriya
competition list — is edited in **Admin → Page content**. Learn page videos are in
**Admin → Learn videos**. Until someone edits a section, the built-in text is shown.

## When you host the site

See **HOSTING.md** for the full step-by-step (Supabase + Cloudflare Pages, both free).
