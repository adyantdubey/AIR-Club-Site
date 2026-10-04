-- =====================================================================
--  AI & Robotics Club, NIT AP — database setup for Supabase
--
--  HOW TO USE: Supabase dashboard → SQL Editor → New query →
--  paste this whole file → Run. Safe to run again (it skips what exists).
--
--  15 tables · row-level security on every table · 6 roles · audit log
--  After this file, run supabase/seed_content.sql once to load the club's real content.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------
do $$ begin
  create type public.app_role as enum
    ('super_admin', 'club_admin', 'project_coordinator', 'event_coordinator', 'idea_reviewer', 'viewer');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- 1. profiles — one row per login, says what role that person has
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null unique,
  full_name   text,
  role        public.app_role not null default 'viewer',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Helper: does the logged-in person have one of these roles?
create or replace function public.has_role(roles public.app_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = any(roles));
$$;

-- Helper: is the logged-in person any kind of staff (all 6 roles)?
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid());
$$;

-- New sign-up → profile row with role 'viewer'
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 2. projects
-- ---------------------------------------------------------------------
create table if not exists public.projects (
  id          text primary key default gen_random_uuid()::text,
  slug        text unique,
  title       text not null,
  summary     text,
  description text,
  category    text,
  status      text not null default 'planning'
              check (status in ('idea','planning','in_progress','testing','completed','on_hold')),
  progress    int  default 0 check (progress between 0 and 100),
  team_size   int  default 1 check (team_size >= 0),
  lead        text,
  tech        text[] not null default '{}',
  start_date  date,
  end_date    date,
  repo_url    text,
  demo_url    text,
  featured    boolean not null default false,
  archived    boolean not null default false,   -- true = shown under "Earlier projects"
  body        text,                              -- full write-up for the project's own page
  image_url   text,
  image2_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists projects_status_idx on public.projects(status);
create index if not exists projects_featured_idx on public.projects(featured) where featured;

-- ---------------------------------------------------------------------
-- 3. events  ·  4. event_registrations
-- ---------------------------------------------------------------------
create table if not exists public.events (
  id                text primary key default gen_random_uuid()::text,
  title             text not null,
  description       text,
  kind              text not null default 'WORKSHOP',
  starts_at         timestamptz not null,
  ends_at           timestamptz,
  venue             text,
  registration_open boolean not null default true,
  capacity          int not null default 0,
  body              text,          -- full write-up for the event's own page
  image_url         text,
  image2_url        text,
  link              text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists events_starts_idx on public.events(starts_at);

create table if not exists public.event_registrations (
  id          uuid primary key default gen_random_uuid(),
  event_id    text not null references public.events(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 120),
  email       text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  created_at  timestamptz not null default now(),
  unique (event_id, email)
);
create index if not exists event_reg_event_idx on public.event_registrations(event_id);

-- ---------------------------------------------------------------------
-- 5. announcements
-- ---------------------------------------------------------------------
create table if not exists public.announcements (
  id          text primary key default gen_random_uuid()::text,
  title       text not null,
  body        text,
  category    text not null default 'notice' check (category in ('recruitment','event','deadline','notice')),
  priority    text not null default 'normal' check (priority in ('urgent','high','normal','low')),
  pinned      boolean not null default false,
  link        text,
  publish_at  timestamptz not null default now(),
  expires_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists announcements_publish_idx on public.announcements(publish_at desc);

-- ---------------------------------------------------------------------
-- 6. ideas  ·  7. idea_votes
-- ---------------------------------------------------------------------
create table if not exists public.ideas (
  id            text primary key default gen_random_uuid()::text,
  tracking_code text unique,
  title         text not null check (char_length(title) between 3 and 140),
  description   text not null check (char_length(description) between 10 and 4000),
  category      text,
  author_name   text,
  author_email  text,
  is_anonymous  boolean not null default false,
  status        text not null default 'pending'
                check (status in ('pending','under_review','approved','rejected','implemented')),
  review_note   text,
  upvotes       int not null default 0,
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists ideas_status_idx on public.ideas(status);

-- Anonymous ideas never keep a name or email, even if one was sent
create or replace function public.ideas_scrub_anonymous()
returns trigger language plpgsql as $$
begin
  if new.is_anonymous then new.author_name := null; new.author_email := null; end if;
  if tg_op = 'INSERT' then
    new.status := 'pending'; new.upvotes := 0; new.review_note := null; new.reviewed_at := null;
  end if;
  return new;
end $$;
drop trigger if exists ideas_scrub on public.ideas;
create trigger ideas_scrub before insert on public.ideas
  for each row execute function public.ideas_scrub_anonymous();

create table if not exists public.idea_votes (
  id          uuid primary key default gen_random_uuid(),
  idea_id     text not null references public.ideas(id) on delete cascade,
  voter_key   text not null check (char_length(voter_key) between 8 and 80),
  created_at  timestamptz not null default now(),
  unique (idea_id, voter_key)
);
create index if not exists idea_votes_idea_idx on public.idea_votes(idea_id);

-- Keep ideas.upvotes in step with the votes table
create or replace function public.bump_idea_votes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.ideas set upvotes = (select count(*) from public.idea_votes v where v.idea_id = new.idea_id)
  where id = new.idea_id;
  return new;
end $$;
drop trigger if exists idea_votes_bump on public.idea_votes;
create trigger idea_votes_bump after insert on public.idea_votes
  for each row execute function public.bump_idea_votes();

-- Counts for the public stats strip (visitors cannot read pending ideas themselves)
create or replace function public.idea_stats()
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'total',       count(*),
    'pending',     count(*) filter (where status in ('pending','under_review')),
    'approved',    count(*) filter (where status = 'approved'),
    'implemented', count(*) filter (where status = 'implemented'),
    'rejected',    count(*) filter (where status = 'rejected'))
  from public.ideas;
$$;

-- Look up one idea by its tracking code (only title + status are revealed)
create or replace function public.track_idea(code text)
returns table (title text, status text, review_note text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select i.title, i.status, i.review_note, i.created_at from public.ideas i where i.tracking_code = upper(code) limit 1;
$$;

-- ---------------------------------------------------------------------
-- 8. achievements
-- ---------------------------------------------------------------------
create table if not exists public.achievements (
  id              text primary key default gen_random_uuid()::text,
  title           text not null,
  event_name      text,
  year            text,
  kind            text not null default 'WIN' check (kind in ('WIN','PODIUM','FINAL','SPECIAL','MILESTONE')),
  description     text,
  certificate_url text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 9. media (gallery)
-- ---------------------------------------------------------------------
create table if not exists public.media (
  id          text primary key default gen_random_uuid()::text,
  title       text not null,
  category    text not null default 'events' check (category in ('events','builds','competitions','lab','workshops')),
  url         text,
  kind        text not null default 'image' check (kind in ('image','video')),
  caption     text,
  taken_on    date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists media_category_idx on public.media(category);

-- ---------------------------------------------------------------------
-- 10. team_members (public committee + faculty coordinators)
-- ---------------------------------------------------------------------
create table if not exists public.team_members (
  id          text primary key default gen_random_uuid()::text,
  name        text not null,
  role        text not null,
  "group"     text not null default 'core' check ("group" in ('core','executive','software','hardware','faculty')),
  department  text,
  year        text,
  bio         text,
  photo_url   text,
  email       text,
  linkedin    text,
  is_lead     boolean not null default false,
  sort_order  int not null default 50,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists team_sort_idx on public.team_members(sort_order);

-- ---------------------------------------------------------------------
-- 11. resources (links for members — guides, datasets, docs)
-- ---------------------------------------------------------------------
create table if not exists public.resources (
  id          text primary key default gen_random_uuid()::text,
  title       text not null,
  url         text not null,
  kind        text default 'guide',
  description text,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 12. contact_messages (join form)
-- ---------------------------------------------------------------------
create table if not exists public.contact_messages (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 120),
  email       text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  branch      text,
  team        text,
  message     text check (char_length(coalesce(message,'')) <= 4000),
  status      text not null default 'new' check (status in ('new','read')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 13. site_settings (exactly one row, id = 1)
-- ---------------------------------------------------------------------
create table if not exists public.site_settings (
  id               int primary key default 1 check (id = 1),
  club_name        text,
  tagline          text,
  email            text,
  phone            text,
  address          text,
  office_hours     text,
  instagram        text,
  github           text,
  linkedin         text,
  youtube          text,
  mission          text,
  vision           text,
  recruitment_open boolean not null default true,
  updated_at       timestamptz not null default now()
);
insert into public.site_settings (id, club_name, tagline, email, address, office_hours, mission, vision)
values (1, 'AI & Robotics Club', 'Transforming Visions into Reality.', 'airclub@nitandhra.ac.in',
        '102, Student Amenities Centre, NIT Andhra Pradesh, Tadepalligudem', E'Mon–Fri · 5:00–8:00 PM\nSat · 10:00 AM–1:00 PM',
        'Give every student at NIT AP a bench, a mentor and a real machine to build.',
        'A campus lab that ships autonomous robots and useful AI.')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 14. site_content — editable page text (Admin → Page content)
--     One row per block of text: id = 'hero', 'faq', 'sponsors', …
--     A missing row means "use the text built into the website".
-- ---------------------------------------------------------------------
create table if not exists public.site_content (
  id          text primary key check (char_length(id) between 1 and 40),
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Upgrades: if you ran an earlier version of this file, these add what is new.
-- (They do nothing on a fresh database.)
-- ---------------------------------------------------------------------
alter table public.projects add column if not exists archived boolean not null default false;
alter table public.projects add column if not exists body text;
alter table public.projects add column if not exists image_url text;
alter table public.projects add column if not exists image2_url text;
alter table public.projects alter column progress drop not null;
alter table public.projects alter column team_size drop not null;
alter table public.events add column if not exists body text;
alter table public.events add column if not exists image_url text;
alter table public.events add column if not exists image2_url text;
alter table public.events add column if not exists link text;
alter table public.resources add column if not exists sort_order int not null default 0;
alter table public.team_members drop constraint if exists team_members_group_check;
alter table public.team_members add constraint team_members_group_check
  check ("group" in ('core','executive','software','hardware','faculty'));

-- ---------------------------------------------------------------------
-- 15. audit_log — who changed what, written automatically by triggers
-- ---------------------------------------------------------------------
create table if not exists public.audit_log (
  id          bigint generated always as identity primary key,
  actor_id    uuid,
  actor_email text,
  action      text not null,          -- insert | update | delete
  table_name  text not null,
  record_id   text,
  summary     text,
  created_at  timestamptz not null default now()
);
create index if not exists audit_created_idx on public.audit_log(created_at desc);

create or replace function public.write_audit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  who text;
begin
  if auth.uid() is null then return coalesce(new, old); end if; -- public form posts are not audited
  select email into who from public.profiles where id = auth.uid();
  insert into public.audit_log (actor_id, actor_email, action, table_name, record_id, summary)
  values (auth.uid(), who, lower(tg_op), tg_table_name, r->>'id',
          coalesce(r->>'title', r->>'name', r->>'club_name', r->>'email', r->>'id', '')
          || case when tg_table_name = 'ideas' and tg_op = 'UPDATE' then ' → ' || (r->>'status') else '' end);
  return coalesce(new, old);
end $$;

-- updated_at stamp
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

do $$
declare t text;
begin
  foreach t in array array['projects','events','announcements','ideas','achievements','media',
                           'team_members','resources','site_settings','site_content','profiles','contact_messages']
  loop
    execute format('drop trigger if exists %I_audit on public.%I', t, t);
    execute format('create trigger %I_audit after insert or update or delete on public.%I
                    for each row execute function public.write_audit()', t, t);
    execute format('drop trigger if exists %I_touch on public.%I', t, t);
    execute format('create trigger %I_touch before update on public.%I
                    for each row execute function public.touch_updated_at()', t, t);
  end loop;
end $$;

-- =====================================================================
--  ROW-LEVEL SECURITY — the real lock. On for every table.
-- =====================================================================
alter table public.profiles            enable row level security;
alter table public.projects            enable row level security;
alter table public.events              enable row level security;
alter table public.event_registrations enable row level security;
alter table public.announcements       enable row level security;
alter table public.ideas               enable row level security;
alter table public.idea_votes          enable row level security;
alter table public.achievements        enable row level security;
alter table public.media               enable row level security;
alter table public.team_members        enable row level security;
alter table public.resources           enable row level security;
alter table public.contact_messages    enable row level security;
alter table public.site_settings       enable row level security;
alter table public.site_content        enable row level security;
alter table public.audit_log           enable row level security;

-- Drop old copies of our policies so this file can be re-run
do $$
declare p record;
begin
  for p in select policyname, tablename from pg_policies where schemaname = 'public' and policyname like 'air_%'
  loop execute format('drop policy %I on public.%I', p.policyname, p.tablename); end loop;
end $$;

-- profiles: you see yourself; staff see everyone; only super_admin changes roles
create policy air_profiles_read   on public.profiles for select using (id = auth.uid() or public.is_staff());
create policy air_profiles_update on public.profiles for update
  using (public.has_role(array['super_admin']::public.app_role[]))
  with check (public.has_role(array['super_admin']::public.app_role[]));

-- Public content: everyone reads; the right roles write
create policy air_projects_read  on public.projects for select using (true);
create policy air_projects_write on public.projects for all
  using (public.has_role(array['super_admin','club_admin','project_coordinator']::public.app_role[]))
  with check (public.has_role(array['super_admin','club_admin','project_coordinator']::public.app_role[]));

create policy air_achievements_read  on public.achievements for select using (true);
create policy air_achievements_write on public.achievements for all
  using (public.has_role(array['super_admin','club_admin','project_coordinator']::public.app_role[]))
  with check (public.has_role(array['super_admin','club_admin','project_coordinator']::public.app_role[]));

create policy air_events_read  on public.events for select using (true);
create policy air_events_write on public.events for all
  using (public.has_role(array['super_admin','club_admin','event_coordinator']::public.app_role[]))
  with check (public.has_role(array['super_admin','club_admin','event_coordinator']::public.app_role[]));

create policy air_announcements_read  on public.announcements for select using (publish_at <= now() or public.is_staff());
create policy air_announcements_write on public.announcements for all
  using (public.has_role(array['super_admin','club_admin','event_coordinator']::public.app_role[]))
  with check (public.has_role(array['super_admin','club_admin','event_coordinator']::public.app_role[]));

create policy air_media_read  on public.media for select using (true);
create policy air_media_write on public.media for all
  using (public.has_role(array['super_admin','club_admin','event_coordinator']::public.app_role[]))
  with check (public.has_role(array['super_admin','club_admin','event_coordinator']::public.app_role[]));

create policy air_team_read  on public.team_members for select using (true);
create policy air_team_write on public.team_members for all
  using (public.has_role(array['super_admin','club_admin']::public.app_role[]))
  with check (public.has_role(array['super_admin','club_admin']::public.app_role[]));

create policy air_resources_read  on public.resources for select using (true);
create policy air_resources_write on public.resources for all
  using (public.has_role(array['super_admin','club_admin']::public.app_role[]))
  with check (public.has_role(array['super_admin','club_admin']::public.app_role[]));

create policy air_content_read  on public.site_content for select using (true);
create policy air_content_write on public.site_content for all
  using (public.has_role(array['super_admin','club_admin']::public.app_role[]))
  with check (public.has_role(array['super_admin','club_admin']::public.app_role[]));

create policy air_settings_read  on public.site_settings for select using (true);
create policy air_settings_write on public.site_settings for update
  using (public.has_role(array['super_admin','club_admin']::public.app_role[]))
  with check (public.has_role(array['super_admin','club_admin']::public.app_role[]));

-- Ideas: anyone can submit; public sees approved + implemented; staff see all; reviewers decide
create policy air_ideas_insert on public.ideas for insert with check (true);
create policy air_ideas_read   on public.ideas for select using (status in ('approved','implemented') or public.is_staff());
create policy air_ideas_update on public.ideas for update
  using (public.has_role(array['super_admin','club_admin','idea_reviewer']::public.app_role[]))
  with check (public.has_role(array['super_admin','club_admin','idea_reviewer']::public.app_role[]));
create policy air_ideas_delete on public.ideas for delete
  using (public.has_role(array['super_admin','club_admin','idea_reviewer']::public.app_role[]));

-- Votes: anyone can add one; nobody reads them back except staff
create policy air_votes_insert on public.idea_votes for insert with check (true);
create policy air_votes_read   on public.idea_votes for select using (public.is_staff());

-- Event registrations: anyone registers (only while the event is open); staff read
create policy air_reg_insert on public.event_registrations for insert
  with check (exists (select 1 from public.events e where e.id = event_id and e.registration_open));
create policy air_reg_read   on public.event_registrations for select using (public.is_staff());
create policy air_reg_delete on public.event_registrations for delete
  using (public.has_role(array['super_admin','club_admin','event_coordinator']::public.app_role[]));

-- Contact messages: anyone sends; staff read; admins mark read / delete
create policy air_msg_insert on public.contact_messages for insert with check (true);
create policy air_msg_read   on public.contact_messages for select using (public.is_staff());
create policy air_msg_update on public.contact_messages for update
  using (public.has_role(array['super_admin','club_admin']::public.app_role[]));
create policy air_msg_delete on public.contact_messages for delete
  using (public.has_role(array['super_admin','club_admin']::public.app_role[]));

-- Audit log: staff read; nobody edits (triggers write it)
create policy air_audit_read on public.audit_log for select using (public.is_staff());

-- Visitors may call the two idea helpers
-- Let the website talk to these tables. The row-level security rules above still
-- decide what each visitor / admin can actually see or change.
-- (Newer Supabase projects no longer do this automatically, so it is spelled out here.)
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;
grant execute on function public.has_role(public.app_role[]) to anon, authenticated;
grant execute on function public.is_staff() to anon, authenticated;
grant execute on function public.idea_stats() to anon, authenticated;
grant execute on function public.track_idea(text) to anon, authenticated;

-- =====================================================================
--  STORAGE — a public "media" bucket for gallery photos, team photos, certificates
-- =====================================================================
insert into storage.buckets (id, name, public) values ('media', 'media', true)
on conflict (id) do nothing;

drop policy if exists air_media_public_read on storage.objects;
drop policy if exists air_media_staff_write on storage.objects;
drop policy if exists air_media_staff_delete on storage.objects;
create policy air_media_public_read on storage.objects for select using (bucket_id = 'media');
create policy air_media_staff_write on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and public.has_role(array['super_admin','club_admin','event_coordinator','project_coordinator']::public.app_role[]));
create policy air_media_staff_delete on storage.objects for delete to authenticated
  using (bucket_id = 'media' and public.has_role(array['super_admin','club_admin','event_coordinator','project_coordinator']::public.app_role[]));

-- =====================================================================
--  AFTER RUNNING: make yourself the first super admin
--  1. Supabase → Authentication → Users → Add user (your email + a password)
--  2. Run this line with your email:
--
--     update public.profiles set role = 'super_admin' where email = 'you@example.com';
--
--  From then on you can change everyone else's role in Admin → Settings → Access.
-- =====================================================================
