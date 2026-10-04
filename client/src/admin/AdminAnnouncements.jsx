import { useMemo, useState } from 'react';
import { useTable } from '../lib/useData';
import { insert, update, remove } from '../lib/db';
import { required, max, url } from '../lib/validate';
import DataTable from '../components/ui/DataTable';
import { Priority, StatusBadge, Chips, ConfirmButton, fmtDate } from '../components/ui/kit';
import { ANN_CATEGORIES, PRIORITIES, sortAnnouncements } from '../pages/Announcements';
import { AdminPage, FormModal, ViewOnly, useCanEdit, useOpenNew, PlusIcon } from './ui';

const FIELDS = [
  { section: 'Announcement', key: 'title', label: 'Headline', rules: [required(), max(140)], span: 2 },
  { section: 'Announcement', key: 'body', label: 'Details', type: 'textarea', rows: 4 },
  { section: 'Announcement', key: 'category', label: 'Type', type: 'select', options: ANN_CATEGORIES, default: 'notice' },
  { section: 'Announcement', key: 'priority', label: 'Priority', type: 'select', options: PRIORITIES.map((p) => [p, p[0].toUpperCase() + p.slice(1)]), default: 'normal', hint: 'Urgent and high show on the home page' },
  { section: 'Announcement', key: 'link', label: 'Link (optional)', placeholder: '/events or https://…', rules: [url()] },
  { section: 'Announcement', key: 'pinned', label: 'Pin to the top', type: 'checkbox' },
  { section: 'Dates', key: 'publish_at', label: 'Publish from', type: 'datetime', rules: [required()], default: new Date().toISOString(), hint: 'Set a future time to schedule it' },
  {
    section: 'Dates',
    key: 'expires_at',
    label: 'Deadline / hide after (optional)',
    type: 'datetime',
    rules: [(v, all) => (v && all.publish_at && new Date(v) <= new Date(all.publish_at) ? 'Must be after the publish time' : null)],
  },
];

function stateOf(a) {
  const now = Date.now();
  if (new Date(a.publish_at).getTime() > now) return ['planning', 'scheduled'];
  if (a.expires_at && new Date(a.expires_at).getTime() <= now) return ['read', 'expired'];
  return ['open', 'live'];
}

export default function AdminAnnouncements() {
  const { rows, loading } = useTable('announcements', { order: ['publish_at', false] });
  const can = useCanEdit('announcements');
  const [cat, setCat] = useState('all');
  const [editing, setEditing] = useState(null);
  useOpenNew(can, () => setEditing('new'));
  const shown = useMemo(() => sortAnnouncements(rows.filter((a) => cat === 'all' || a.category === cat)), [rows, cat]);

  const save = (v) => (editing === 'new' ? insert('announcements', v) : update('announcements', editing.id, v));

  const columns = [
    {
      key: 'title',
      label: 'Announcement',
      sort: true,
      render: (a) => (
        <div className="min-w-[220px]">
          <div className="font-medium">
            {a.pinned && <span style={{ color: 'var(--blue-glow)' }}>◆ </span>}
            {a.title}
          </div>
          <div className="line-clamp-1 text-xs" style={{ color: 'var(--muted)' }}>
            {a.body}
          </div>
        </div>
      ),
    },
    { key: 'category', label: 'Type', sort: true, render: (a) => <span className="chip">{a.category}</span> },
    { key: 'priority', label: 'Priority', sort: true, sortValue: (a) => PRIORITIES.indexOf(a.priority), render: (a) => <Priority level={a.priority} /> },
    {
      key: 'state',
      label: 'Status',
      render: (a) => {
        const [tone, label] = stateOf(a);
        return <StatusBadge status={tone} label={label} />;
      },
    },
    {
      key: 'publish_at',
      label: 'Dates',
      sort: true,
      render: (a) => (
        <div className="whitespace-nowrap text-xs" style={{ color: 'var(--muted)' }}>
          {fmtDate(a.publish_at)}
          {a.expires_at && <div style={{ color: 'var(--warn)' }}>until {fmtDate(a.expires_at)}</div>}
        </div>
      ),
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (a) =>
        can && (
          <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
            <button className="ctl-btn small" onClick={() => update('announcements', a.id, { pinned: !a.pinned })}>
              {a.pinned ? 'Unpin' : 'Pin'}
            </button>
            <button className="ctl-btn small" onClick={() => setEditing(a)}>
              Edit
            </button>
            <ConfirmButton onConfirm={() => remove('announcements', a.id)} />
          </div>
        ),
    },
  ];

  return (
    <AdminPage
      title="Announcements"
      subtitle="Recruitment calls, event news, deadlines and notices. Pinned → urgent → newest."
      actions={
        can && (
          <button className="ctl-btn primary inline-flex items-center gap-2" onClick={() => setEditing('new')}>
            <PlusIcon /> New announcement
          </button>
        )
      }
    >
      <ViewOnly area="announcements" />
      <div className="mb-4">
        <Chips value={cat} onChange={setCat} options={[['all', 'All', rows.length], ...ANN_CATEGORIES.map(([k, l]) => [k, l, rows.filter((r) => r.category === k).length])]} />
      </div>
      <DataTable rows={shown} columns={columns} loading={loading} onRowClick={(a) => setEditing(a)} empty="No announcements yet" />
      <FormModal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'New announcement' : editing?.title || ''}
        fields={FIELDS}
        initial={editing === 'new' ? null : editing}
        onSave={save}
        readOnly={!can}
      />
    </AdminPage>
  );
}
