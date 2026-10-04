import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { useSettings, useTable } from '../lib/useData';
import { saveSettings, update, resetDemo, isDemo } from '../lib/db';
import { validate, email as isEmail, url, required } from '../lib/validate';
import { canEdit, ROLES, ROLE_LABEL } from '../lib/roles';
import { Field, Input, TextArea, Select, Check, Chips, ErrorNote, ConfirmButton } from '../components/ui/kit';
import { AdminPage, ViewOnly } from './ui';

const TABS = [
  ['club', 'Club info'],
  ['social', 'Social links'],
  ['access', 'Access & roles'],
  ['site', 'Site & data'],
];

export default function AdminSettings() {
  const [tab, setTab] = useState('club');
  return (
    <AdminPage title="Settings" subtitle="Club details shown across the site, social links, who can do what.">
      <ViewOnly area="settings" />
      <div className="mb-6">
        <Chips value={tab} onChange={setTab} options={TABS} />
      </div>
      {tab === 'club' && <ClubForm />}
      {tab === 'social' && <SocialForm />}
      {tab === 'access' && <Access />}
      {tab === 'site' && <SiteData />}
    </AdminPage>
  );
}

/* ---------------- generic settings form ---------------- */
function useSettingsForm(keys, rules) {
  const s = useSettings();
  const { role } = useAuth();
  const can = canEdit(role, 'settings');
  const [v, setV] = useState({});
  const [errors, setErrors] = useState({});
  const [state, setState] = useState('idle');
  const [msg, setMsg] = useState('');
  useEffect(() => {
    setV(Object.fromEntries(keys.map((k) => [k, s[k] ?? (k === 'recruitment_open' ? true : '')])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s]);
  const set = (k) => (e) => setV((x) => ({ ...x, [k]: e?.target ? e.target.value : e }));
  const submit = async (e) => {
    e.preventDefault();
    const errs = validate(v, rules);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setState('busy');
    try {
      await saveSettings(Object.fromEntries(Object.entries(v).map(([k, x]) => [k, typeof x === 'string' ? x.trim() : x])));
      setState('saved');
      setTimeout(() => setState('idle'), 2000);
    } catch (err) {
      setState('error');
      setMsg(err.message);
    }
  };
  return { v, set, errors, state, msg, submit, can };
}

function SaveBar({ state, msg, can }) {
  if (!can) return null;
  return (
    <div className="flex items-center gap-4 border-t pt-5 md:col-span-2" style={{ borderColor: 'var(--line)' }}>
      <button className="ctl-btn primary" disabled={state === 'busy'}>
        {state === 'busy' ? 'Saving…' : 'Save changes'}
      </button>
      {state === 'saved' && (
        <span className="text-sm" style={{ color: 'var(--ok)' }}>
          ✓ Saved — the site updates straight away
        </span>
      )}
      {state === 'error' && <ErrorNote>{msg}</ErrorNote>}
    </div>
  );
}

function ClubForm() {
  const f = useSettingsForm(['club_name', 'tagline', 'email', 'phone', 'address', 'office_hours', 'mission', 'vision', 'recruitment_open'], {
    club_name: [required()],
    email: [required(), isEmail()],
  });
  return (
    <form onSubmit={f.submit} noValidate className="glass grid gap-5 p-6 md:grid-cols-2">
      <fieldset disabled={!f.can} className="contents">
        <Field label="Club name" error={f.errors.club_name}>
          <Input value={f.v.club_name || ''} onChange={f.set('club_name')} error={f.errors.club_name} />
        </Field>
        <Field label="Tagline">
          <Input value={f.v.tagline || ''} onChange={f.set('tagline')} />
        </Field>
        <Field label="Club email" error={f.errors.email} hint="Shown on Contact and in the footer">
          <Input type="email" value={f.v.email || ''} onChange={f.set('email')} error={f.errors.email} />
        </Field>
        <Field label="Phone (optional)">
          <Input value={f.v.phone || ''} onChange={f.set('phone')} />
        </Field>
        <Field label="Address" className="md:col-span-2">
          <Input value={f.v.address || ''} onChange={f.set('address')} />
        </Field>
        <Field label="Office hours" hint={'One line each, like:  Mon–Fri · 5:00–8:00 PM'} className="md:col-span-2">
          <TextArea rows={3} value={f.v.office_hours || ''} onChange={f.set('office_hours')} />
        </Field>
        <Field label="Mission (About page)" className="md:col-span-2">
          <TextArea rows={2} value={f.v.mission || ''} onChange={f.set('mission')} />
        </Field>
        <Field label="Vision (About page)" className="md:col-span-2">
          <TextArea rows={2} value={f.v.vision || ''} onChange={f.set('vision')} />
        </Field>
        <div className="md:col-span-2">
          <Check label="Recruitment is open (shown on the Contact page)" checked={!!f.v.recruitment_open} onChange={f.set('recruitment_open')} />
        </div>
      </fieldset>
      <SaveBar {...f} />
    </form>
  );
}

function SocialForm() {
  const keys = ['instagram', 'github', 'linkedin', 'youtube'];
  const f = useSettingsForm(keys, Object.fromEntries(keys.map((k) => [k, [url()]])));
  return (
    <form onSubmit={f.submit} noValidate className="glass grid gap-5 p-6 md:grid-cols-2">
      <fieldset disabled={!f.can} className="contents">
        {keys.map((k) => (
          <Field key={k} label={k} error={f.errors[k]} hint="Leave empty to hide the icon in the footer">
            <Input value={f.v[k] || ''} onChange={f.set(k)} error={f.errors[k]} placeholder={`https://${k}.com/…`} />
          </Field>
        ))}
      </fieldset>
      <SaveBar {...f} />
    </form>
  );
}

/* ---------------- people with logins & their roles ---------------- */
function Access() {
  const { user, role } = useAuth();
  const { rows } = useTable('profiles', { order: ['email', true] });
  const can = canEdit(role, 'access');
  const [err, setErr] = useState('');
  const change = async (p, r) => {
    setErr('');
    try {
      await update('profiles', p.id, { role: r });
    } catch (e) {
      setErr(e.message);
    }
  };
  return (
    <div className="flex flex-col gap-5">
      <div className="glass p-6">
        <div className="display text-lg font-bold">What each role can change</div>
        <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          {[
            ['super_admin', 'Everything, including other people’s roles'],
            ['club_admin', 'Everything except roles'],
            ['project_coordinator', 'Projects and achievements'],
            ['event_coordinator', 'Events, announcements and the gallery'],
            ['idea_reviewer', 'Reviews the Idea Box'],
            ['viewer', 'Can look at the dashboard, changes nothing'],
          ].map(([r, d]) => (
            <div key={r} className="flex gap-3">
              <span className="mono w-40 shrink-0 text-[10px] uppercase tracking-[0.15em]" style={{ color: 'var(--blue-glow)' }}>
                {ROLE_LABEL[r]}
              </span>
              <span style={{ color: 'var(--muted)' }}>{d}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="glass p-6">
        <div className="display text-lg font-bold">People who can log in</div>
        <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
          {isDemo
            ? 'Demo mode: these are the six demo accounts. With Supabase, add people in Supabase → Authentication → Users; they appear here as "Viewer" and you pick their role.'
            : 'Add people in Supabase → Authentication → Users (or let them sign up). They appear here as "Viewer" — then pick their role.'}
        </p>
        {err && (
          <div className="mt-3">
            <ErrorNote>{err}</ErrorNote>
          </div>
        )}
        <div className="mt-4 flex flex-col divide-y" style={{ borderColor: 'var(--line)' }}>
          {rows.map((p) => (
            <div key={p.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: 'var(--line)' }}>
              <div className="min-w-0">
                <div className="text-sm font-medium">
                  {p.full_name || p.email} {p.id === user.id && <span style={{ color: 'var(--blue-glow)' }}>(you)</span>}
                </div>
                <div className="truncate text-xs" style={{ color: 'var(--muted)' }}>
                  {p.email}
                </div>
              </div>
              {can && p.id !== user.id ? (
                <div className="w-full sm:w-56">
                  <Select value={p.role} onChange={(e) => change(p, e.target.value)} options={ROLES.map((r) => [r, ROLE_LABEL[r]])} aria-label={`Role for ${p.email}`} />
                </div>
              ) : (
                <span className="badge">{ROLE_LABEL[p.role]}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------- connection status / demo reset ---------------- */
function SiteData() {
  const { role } = useAuth();
  const [done, setDone] = useState(false);
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <div className="glass p-6">
        <div className="display text-lg font-bold">Database</div>
        <div className="mt-3">
          <span className="badge" data-tone={isDemo ? 'warn' : 'ok'}>
            {isDemo ? 'demo mode' : 'supabase connected'}
          </span>
        </div>
        <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
          {isDemo
            ? 'Changes are kept in this browser only. To go live, follow SUPABASE_SETUP.md in the project folder: create a free Supabase project, run supabase/database_schema.sql, paste two keys into client/.env.'
            : 'Every change is saved to Supabase and protected by row-level security. Every edit is written to the audit log (see Dashboard → Recent activity).'}
        </p>
      </div>
      {isDemo && (
        <div className="glass p-6">
          <div className="display text-lg font-bold">Reset demo data</div>
          <p className="mt-2 text-sm" style={{ color: 'var(--muted)' }}>
            Puts every project, event, idea and photo back to the sample data in src/data/seed.js.
          </p>
          <div className="mt-4 flex items-center gap-3">
            {canEdit(role, 'settings') ? (
              <ConfirmButton
                onConfirm={() => {
                  resetDemo();
                  setDone(true);
                }}
                confirmText="Click again to reset"
              >
                Reset demo data
              </ConfirmButton>
            ) : (
              <span className="text-sm" style={{ color: 'var(--muted)' }}>
                Admins only.
              </span>
            )}
            {done && <span style={{ color: 'var(--ok)' }}>✓ Reset</span>}
          </div>
        </div>
      )}
    </div>
  );
}
