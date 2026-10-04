import { useMemo, useState } from 'react';
import { useTable } from '../lib/useData';
import { insert, update, remove } from '../lib/db';
import { required, max, email, url } from '../lib/validate';
import { Chips, ConfirmButton, Empty, Skeleton, SearchBox } from '../components/ui/kit';
import { AdminPage, FormModal, ViewOnly, useCanEdit, useOpenNew, PlusIcon } from './ui';

const GROUPS = [
  ['core', 'Office bearers'],
  ['executive', 'Executive members'],
  ['software', 'Software'],
  ['hardware', 'Hardware'],
  ['faculty', 'Faculty coordinator'],
];
const DEPTS = ['CSE', 'ECE', 'EEE', 'MECH', 'CIVIL', 'CHEM', 'MME', 'BIOTECH', 'SCI', 'Other'];

const FIELDS = [
  { section: 'Profile', key: 'photo_url', label: 'Photo', type: 'image', folder: 'team' },
  { section: 'Profile', key: 'name', label: 'Full name', rules: [required(), max(80)] },
  { section: 'Profile', key: 'role', label: 'Role / title', rules: [required(), max(80)], placeholder: 'Rover Team Captain' },
  { section: 'Profile', key: 'group', label: 'Group', type: 'select', options: GROUPS, default: 'core' },
  { section: 'Profile', key: 'department', label: 'Department', type: 'select', options: [['', '—'], ...DEPTS.map((d) => [d, d])] },
  { section: 'Profile', key: 'year', label: 'Year', type: 'select', options: ['', '1st year', '2nd year', '3rd year', '4th year', 'M.Tech', 'PhD'].map((y) => [y, y || '—']) },
  { section: 'Profile', key: 'bio', label: 'Short bio', type: 'textarea', rows: 3, rules: [max(400)] },
  { section: 'Contact & order', key: 'email', label: 'Email (optional)', rules: [email()] },
  { section: 'Contact & order', key: 'linkedin', label: 'LinkedIn (optional)', rules: [url()] },
  { section: 'Contact & order', key: 'is_lead', label: 'Show as a lead (big card)', type: 'checkbox' },
  { section: 'Contact & order', key: 'sort_order', label: 'Order (smaller = first)', type: 'number', default: 50 },
];

const initials = (n = '') =>
  n
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

export default function AdminTeam() {
  const { rows, loading } = useTable('team_members', { order: ['sort_order', true] });
  const can = useCanEdit('team');
  const [group, setGroup] = useState('all');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null);
  useOpenNew(can, () => setEditing('new'));

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((m) => (group === 'all' || m.group === group) && (!s || `${m.name} ${m.role} ${m.department}`.toLowerCase().includes(s)));
  }, [rows, group, q]);

  const save = (v) => (editing === 'new' ? insert('team_members', v) : update('team_members', editing.id, v));

  return (
    <AdminPage
      title="Team"
      subtitle="Committee members on the Team page, and faculty coordinators on the About page."
      actions={
        can && (
          <button className="ctl-btn primary inline-flex items-center gap-2" onClick={() => setEditing('new')}>
            <PlusIcon /> Add member
          </button>
        )
      }
    >
      <ViewOnly area="team" />
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Chips value={group} onChange={setGroup} options={[['all', 'All', rows.length], ...GROUPS.map(([k, l]) => [k, l, rows.filter((r) => r.group === k).length])]} />
        <SearchBox value={q} onChange={setQ} placeholder="Search people…" className="md:w-72" />
      </div>
      {loading ? (
        <Skeleton rows={3} height={90} />
      ) : !shown.length ? (
        <Empty title="Nobody here yet" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((m, i) => (
            <div key={m.id} className="glass flex gap-4 p-4 animate-slide-up" style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}>
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl" style={{ background: 'linear-gradient(135deg, #2a4f9e, #0b1020)' }}>
                {m.photo_url ? (
                  <img src={m.photo_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="display flex h-full w-full items-center justify-center font-bold" style={{ color: 'var(--blue-glow)' }}>
                    {initials(m.name)}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="truncate font-medium">{m.name}</div>
                  {m.is_lead && (
                    <span className="badge" data-tone="live">
                      lead
                    </span>
                  )}
                </div>
                <div className="truncate text-sm" style={{ color: 'var(--muted)' }}>
                  {m.role}
                </div>
                <div className="mono mt-0.5 text-[9px] tracking-[0.15em]" style={{ color: 'var(--blue-glow)' }}>
                  {[GROUPS.find((g) => g[0] === m.group)?.[1], m.department, m.year].filter(Boolean).join(' · ').toUpperCase()}
                </div>
                <div className="mt-3 flex gap-2">
                  <button className="ctl-btn small" onClick={() => setEditing(m)}>
                    {can ? 'Edit' : 'View'}
                  </button>
                  {can && <ConfirmButton onConfirm={() => remove('team_members', m.id)} />}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <FormModal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Add member' : editing?.name || ''}
        fields={FIELDS}
        initial={editing === 'new' ? null : editing}
        onSave={save}
        readOnly={!can}
      />
    </AdminPage>
  );
}
