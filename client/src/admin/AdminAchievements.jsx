import { useState } from 'react';
import { useTable } from '../lib/useData';
import { insert, update, remove } from '../lib/db';
import { required, max } from '../lib/validate';
import { ConfirmButton, Empty, Skeleton } from '../components/ui/kit';
import { AdminPage, FormModal, ViewOnly, useCanEdit, useOpenNew, PlusIcon } from './ui';

const KINDS = [
  ['WIN', 'Winner / gold'],
  ['PODIUM', 'Podium (2nd / 3rd)'],
  ['FINAL', 'Finalist'],
  ['SPECIAL', 'Special award'],
  ['MILESTONE', 'Club milestone'],
];
const TONE = { WIN: 'var(--warn)', PODIUM: 'var(--blue-glow)', FINAL: 'var(--blue-glow)', SPECIAL: 'var(--ok)', MILESTONE: 'var(--muted)' };

const FIELDS = [
  { section: 'Achievement', key: 'title', label: 'Title', rules: [required(), max(140)], span: 2, placeholder: 'Robo Soccer — Winners' },
  { section: 'Achievement', key: 'event_name', label: 'Competition / event', rules: [required()] },
  { section: 'Achievement', key: 'year', label: 'Year', rules: [required(), (v) => (v && !/^\d{4}$/.test(String(v).trim()) ? 'Four digits, e.g. 2026' : null)], default: String(new Date().getFullYear()) },
  { section: 'Achievement', key: 'kind', label: 'Type', type: 'select', options: KINDS, default: 'WIN' },
  { section: 'Achievement', key: 'description', label: 'Short story (optional)', type: 'textarea', rows: 3 },
  { section: 'Certificate', key: 'certificate_url', label: 'Certificate or photo', type: 'image', folder: 'certificates', hint: 'Upload a scan / photo, or paste a link. Shown as "View certificate" on the About page.' },
];

export default function AdminAchievements() {
  const { rows, loading } = useTable('achievements', { order: ['year', false] });
  const can = useCanEdit('achievements');
  const [editing, setEditing] = useState(null);
  useOpenNew(can, () => setEditing('new'));
  const save = (v) => (editing === 'new' ? insert('achievements', v) : update('achievements', editing.id, v));

  return (
    <AdminPage
      title="Achievements"
      subtitle="Awards, podiums and milestones. They appear on the About page and the home-page ticker."
      actions={
        can && (
          <button className="ctl-btn primary inline-flex items-center gap-2" onClick={() => setEditing('new')}>
            <PlusIcon /> Add achievement
          </button>
        )
      }
    >
      <ViewOnly area="achievements" />
      {loading ? (
        <Skeleton rows={3} height={110} />
      ) : !rows.length ? (
        <Empty title="No achievements yet" text="Add your first win, podium or milestone." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((a, i) => (
            <div key={a.id} className="glass flex flex-col p-5 animate-slide-up" style={{ animationDelay: `${i * 40}ms` }}>
              <div className="flex items-center justify-between">
                <span className="mono text-[10px] tracking-[0.22em]" style={{ color: TONE[a.kind] }}>
                  {KINDS.find((k) => k[0] === a.kind)?.[1].toUpperCase() || a.kind}
                </span>
                <span className="display text-sm font-bold" style={{ color: 'var(--muted)' }}>
                  {a.year}
                </span>
              </div>
              <div className="display mt-3 text-lg font-bold">{a.title}</div>
              <div className="text-sm" style={{ color: 'var(--muted)' }}>
                {a.event_name}
              </div>
              <div className="mt-4 flex flex-1 items-end justify-between gap-2">
                {a.certificate_url ? (
                  <a href={a.certificate_url} target="_blank" rel="noreferrer" className="badge" data-tone="ok">
                    certificate
                  </a>
                ) : (
                  <span className="badge" data-tone="muted">
                    no certificate
                  </span>
                )}
                {can ? (
                  <div className="flex gap-2">
                    <button className="ctl-btn small" onClick={() => setEditing(a)}>
                      Edit
                    </button>
                    <ConfirmButton onConfirm={() => remove('achievements', a.id)} />
                  </div>
                ) : (
                  <button className="ctl-btn small" onClick={() => setEditing(a)}>
                    View
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <FormModal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Add achievement' : editing?.title || ''}
        fields={FIELDS}
        initial={editing === 'new' ? null : editing}
        onSave={save}
        readOnly={!can}
      />
    </AdminPage>
  );
}
