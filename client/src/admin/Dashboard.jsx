import { useMemo } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../lib/auth';
import { useTable } from '../lib/useData';
import { update, remove } from '../lib/db';
import { canEdit } from '../lib/roles';
import { StatusBadge, Empty, Skeleton, ConfirmButton, timeAgo, fmtDate, fmtTime } from '../components/ui/kit';
import { AdminPage, StatCard } from './ui';

const ACTION_WORD = { insert: 'added', update: 'updated', delete: 'deleted' };
const TABLE_WORD = {
  projects: 'project',
  events: 'event',
  announcements: 'announcement',
  ideas: 'idea',
  achievements: 'achievement',
  media: 'photo',
  team_members: 'team member',
  site_settings: 'settings',
  profiles: 'role',
  resources: 'resource',
  contact_messages: 'message',
  site_content: 'page text',
};

export default function Dashboard() {
  const { user, role } = useAuth();
  const projects = useTable('projects', { order: null });
  const events = useTable('events', { order: ['starts_at', true] });
  const ideas = useTable('ideas', { order: ['created_at', false] });
  const regs = useTable('event_registrations', { order: null });
  const media = useTable('media', { order: null });
  const messages = useTable('contact_messages', { order: ['created_at', false] });
  const audit = useTable('audit_log', { order: ['created_at', false], limit: 12 });

  const now = Date.now();
  const upcoming = events.rows.filter((e) => new Date(e.starts_at).getTime() >= now);
  const pending = ideas.rows.filter((i) => i.status === 'pending');
  const newMsgs = messages.rows.filter((m) => m.status === 'new');
  const active = projects.rows.filter((p) => p.status === 'in_progress' || p.status === 'testing');

  // what changed lately: audit log + things visitors sent
  const activity = useMemo(() => {
    const a = audit.rows.map((r) => ({
      id: `a-${r.id}`,
      at: r.created_at,
      who: r.actor_email?.split('@')[0] || 'someone',
      text: `${ACTION_WORD[r.action] || r.action} ${TABLE_WORD[r.table_name] || r.table_name}`,
      what: r.summary,
    }));
    const i = ideas.rows.slice(0, 6).map((r) => ({ id: `i-${r.id}`, at: r.created_at, who: r.is_anonymous ? 'anonymous' : r.author_name || 'a student', text: 'submitted an idea', what: r.title, visitor: true }));
    const m = messages.rows.slice(0, 6).map((r) => ({ id: `m-${r.id}`, at: r.created_at, who: r.name, text: 'asked to join', what: r.team || '', visitor: true }));
    return [...a, ...i, ...m].sort((x, y) => (x.at < y.at ? 1 : -1)).slice(0, 12);
  }, [audit.rows, ideas.rows, messages.rows]);

  const quick = [
    ['projects', '/admin/projects?new=1', 'New project'],
    ['events', '/admin/events?new=1', 'New event'],
    ['announcements', '/admin/announcements?new=1', 'Post announcement'],
    ['ideas', '/admin/ideas', `Review ideas${pending.length ? ` (${pending.length})` : ''}`],
    ['gallery', '/admin/gallery', 'Upload photos'],
    ['achievements', '/admin/achievements?new=1', 'Add achievement'],
  ].filter(([area]) => canEdit(role, area));

  const loading = projects.loading || events.loading;
  const hour = new Date().getHours();

  return (
    <AdminPage title={`Good ${hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'}, ${user.full_name.split(' ')[0]}.`} subtitle="Here's what's happening in the club.">
      {/* stats */}
      <div className="mb-8 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="Active projects" value={loading ? '—' : active.length} hint={`${projects.rows.length} in total`} icon="M4 16h16M7 16v-4h10v4M8 20a2 2 0 1 0 0-4a2 2 0 1 0 0 4M16 20a2 2 0 1 0 0-4a2 2 0 1 0 0 4" />
        <StatCard label="Upcoming events" value={loading ? '—' : upcoming.length} hint={`${regs.rows.length} registrations`} icon="M4 6h16v14H4zM4 10h16M8 3v4M16 3v4" />
        <StatCard label="Ideas waiting" value={pending.length} tone={pending.length ? 'warn' : undefined} hint={`${ideas.rows.length} submitted so far`} icon="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.4.3.5.7.5 1.1v1h6v-1c0-.4.2-.8.5-1.1A6 6 0 0 0 12 3" />
        <StatCard label="New join requests" value={newMsgs.length} tone={newMsgs.length ? 'blue-glow' : undefined} hint={`${media.rows.length} photos in gallery`} icon="M4 6h16v12H4zM4 7l8 6 8-6" />
      </div>

      {/* quick actions */}
      {!!quick.length && (
        <div className="mb-8">
          <div className="lbl">Quick actions</div>
          <div className="flex flex-wrap gap-2">
            {quick.map(([area, to, label]) => (
              <Link key={area} to={to} className="ctl-btn" style={{ textTransform: 'none', letterSpacing: '0.02em', fontSize: 12 }}>
                + {label}
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        {/* activity */}
        <section className="glass p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="display text-lg font-bold">Recent activity</h2>
            <span className="mono text-[9px] tracking-[0.2em]" style={{ color: 'var(--muted)' }}>
              AUDIT LOG
            </span>
          </div>
          {audit.loading ? (
            <Skeleton rows={5} height={36} />
          ) : !activity.length ? (
            <Empty title="Nothing yet" />
          ) : (
            <ol className="relative flex flex-col gap-4 pl-5">
              <span className="absolute bottom-2 left-[5px] top-2 w-px" style={{ background: 'var(--line)' }} aria-hidden="true" />
              {activity.map((a) => (
                <li key={a.id} className="relative animate-fade-in">
                  <span className="absolute -left-5 top-1.5 h-[11px] w-[11px] rounded-full border-2" style={{ borderColor: a.visitor ? 'var(--ok)' : 'var(--blue)', background: 'var(--bg)' }} />
                  <div className="text-sm">
                    <span className="font-medium">{a.who}</span> <span style={{ color: 'var(--muted)' }}>{a.text}</span> {a.what && <span>“{a.what}”</span>}
                  </div>
                  <div className="mono text-[10px] tracking-[0.12em]" style={{ color: 'var(--muted)' }}>
                    {timeAgo(a.at)}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        <div className="flex flex-col gap-6">
          {/* next events */}
          <section className="glass p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="display text-lg font-bold">Next up</h2>
              <Link to="/admin/events" className="mono text-[10px] tracking-[0.18em]" style={{ color: 'var(--blue-glow)' }}>
                ALL EVENTS →
              </Link>
            </div>
            {!upcoming.length ? (
              <p className="text-sm" style={{ color: 'var(--muted)' }}>
                No upcoming events.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {upcoming.slice(0, 3).map((e) => {
                  const n = regs.rows.filter((r) => r.event_id === e.id).length;
                  return (
                    <div key={e.id} className="flex items-center gap-4">
                      <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl" style={{ background: 'rgba(45,123,255,.12)' }}>
                        <span className="display font-bold leading-none">{new Date(e.starts_at).getDate()}</span>
                        <span className="mono text-[8px] tracking-[0.15em]" style={{ color: 'var(--blue-glow)' }}>
                          {fmtDate(e.starts_at, { month: 'short' }).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{e.title}</div>
                        <div className="text-xs" style={{ color: 'var(--muted)' }}>
                          {fmtTime(e.starts_at)} · {e.venue}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="display font-bold">{n}</div>
                        <div className="mono text-[8px] tracking-[0.15em]" style={{ color: 'var(--muted)' }}>
                          {e.capacity ? `/ ${e.capacity}` : 'REG.'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* inbox */}
          <section className="glass p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="display text-lg font-bold">Join requests</h2>
              <StatusBadge status="new" label={`${newMsgs.length} new`} />
            </div>
            {!messages.rows.length ? (
              <p className="text-sm" style={{ color: 'var(--muted)' }}>
                No messages yet.
              </p>
            ) : (
              <div className="flex max-h-[360px] flex-col gap-3 overflow-auto pr-1">
                {messages.rows.slice(0, 20).map((m) => (
                  <div key={m.id} className="rounded-xl border p-3" style={{ borderColor: m.status === 'new' ? 'var(--blue)' : 'var(--line)', opacity: m.status === 'new' ? 1 : 0.7 }}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium">{m.name}</div>
                        <a href={`mailto:${m.email}`} className="truncate text-xs" style={{ color: 'var(--blue-glow)' }}>
                          {m.email}
                        </a>
                      </div>
                      <span className="mono shrink-0 text-[9px]" style={{ color: 'var(--muted)' }}>
                        {timeAgo(m.created_at)}
                      </span>
                    </div>
                    {(m.branch || m.team) && (
                      <div className="mono mt-1 text-[9px] tracking-[0.12em]" style={{ color: 'var(--muted)' }}>
                        {[m.branch, m.team].filter(Boolean).join(' · ').toUpperCase()}
                      </div>
                    )}
                    {m.message && <p className="mt-2 text-sm">{m.message}</p>}
                    {canEdit(role, 'settings') && (
                      <div className="mt-2 flex gap-2">
                        <button className="ctl-btn small" onClick={() => update('contact_messages', m.id, { status: m.status === 'new' ? 'read' : 'new' })}>
                          {m.status === 'new' ? 'Mark read' : 'Mark new'}
                        </button>
                        <ConfirmButton onConfirm={() => remove('contact_messages', m.id)} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </AdminPage>
  );
}
