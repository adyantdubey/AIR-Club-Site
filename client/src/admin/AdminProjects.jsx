import { useMemo, useState } from 'react';
import { useTable } from '../lib/useData';
import { insert, update, remove } from '../lib/db';
import { required, max, range, url } from '../lib/validate';
import DataTable from '../components/ui/DataTable';
import { StatusBadge, Progress, SearchBox, Chips, ConfirmButton, timeAgo, statusLabel } from '../components/ui/kit';
import { AdminPage, FormModal, ViewOnly, useCanEdit, useOpenNew, PlusIcon } from './ui';

const STATUS = ['planning', 'in_progress', 'testing', 'completed', 'on_hold', 'idea'];
const CATEGORIES = ['Robotics', 'Computer Vision', 'AI / ML', 'Hardware', 'Embedded', 'Aerial', 'IoT', 'Software', 'Other'];

const FIELDS = [
  { section: 'Basic info', key: 'title', label: 'Title', rules: [required(), max(120)], span: 2 },
  { section: 'Basic info', key: 'summary', label: 'One-line summary', rules: [required(), max(240)], span: 2, hint: 'Shown on cards and in the table' },
  { section: 'Basic info', key: 'description', label: 'Full description', type: 'textarea', rows: 5 },
  { section: 'Basic info', key: 'category', label: 'Area', type: 'select', options: CATEGORIES, default: 'Robotics' },
  { section: 'Basic info', key: 'featured', label: 'Feature on the home page', type: 'checkbox' },
  { section: 'Basic info', key: 'archived', label: 'Earlier project (shown in the archive section)', type: 'checkbox', hint: 'Archived projects get their own story page' },
  { section: 'Story page', key: 'image_url', label: 'Main photo', type: 'image', folder: 'projects' },
  { section: 'Story page', key: 'image2_url', label: 'Second photo', type: 'image', folder: 'projects' },
  { section: 'Story page', key: 'body', label: 'Full write-up', type: 'textarea', rows: 10, hint: 'Start a line with "## " for a heading and "- " for a bullet. Leave a blank line between paragraphs.' },
  { section: 'Technical details', key: 'tech', label: 'Tech used', type: 'tags', placeholder: 'ROS 2, Jetson, OpenCV', span: 2 },
  { section: 'Technical details', key: 'lead', label: 'Project lead' },
  { section: 'Technical details', key: 'team_size', label: 'Team size', type: 'number', min: 0, max: 200, default: 1, rules: [range(0, 200)] },
  { section: 'Timeline', key: 'status', label: 'Status', type: 'select', options: STATUS.map((s) => [s, statusLabel(s)]), default: 'planning' },
  { section: 'Timeline', key: 'progress', label: 'Progress', type: 'range', default: 0 },
  { section: 'Timeline', key: 'start_date', label: 'Start date', type: 'date' },
  { section: 'Timeline', key: 'end_date', label: 'Target date', type: 'date' },
  { section: 'Links', key: 'repo_url', label: 'Code repository', placeholder: 'https://github.com/…', rules: [url()] },
  { section: 'Links', key: 'demo_url', label: 'Demo / video', placeholder: 'https://…', rules: [url()] },
];

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60);

export default function AdminProjects() {
  const { rows, loading } = useTable('projects', { order: ['updated_at', false] });
  const can = useCanEdit('projects');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [editing, setEditing] = useState(null);
  useOpenNew(can, () => setEditing('new')); // row | 'new' | null

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((r) => (status === 'all' || r.status === status) && (!s || `${r.title} ${r.lead} ${r.category}`.toLowerCase().includes(s)));
  }, [rows, q, status]);

  const save = async (v) => {
    if (editing === 'new') await insert('projects', { ...v, slug: `${slugify(v.title)}-${Date.now().toString(36).slice(-4)}` });
    else await update('projects', editing.id, v);
  };

  const columns = [
    {
      key: 'title',
      label: 'Project',
      sort: true,
      render: (r) => (
        <div className="min-w-[200px]">
          <div className="font-medium">
            {r.featured && <span title="Featured on home" style={{ color: 'var(--warn)' }}>★ </span>}
            {r.title}
            {r.archived && (
              <span className="badge ml-2" data-tone="muted">
                earlier
              </span>
            )}
          </div>
          <div className="text-xs" style={{ color: 'var(--muted)' }}>
            {r.category} · lead {r.lead || '—'}
          </div>
        </div>
      ),
    },
    { key: 'status', label: 'Status', sort: true, render: (r) => <StatusBadge status={r.status} /> },
    { key: 'progress', label: 'Progress', sort: true, width: 160, sortValue: (r) => Number(r.progress), render: (r) => <Progress value={r.progress} /> },
    { key: 'team_size', label: 'Team', sort: true, align: 'right', sortValue: (r) => Number(r.team_size) },
    { key: 'updated_at', label: 'Updated', sort: true, render: (r) => <span className="text-xs" style={{ color: 'var(--muted)' }}>{timeAgo(r.updated_at || r.created_at)}</span> },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (r) =>
        can && (
          <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
            <button className="ctl-btn small" onClick={() => setEditing(r)}>
              Edit
            </button>
            <ConfirmButton onConfirm={() => remove('projects', r.id)} />
          </div>
        ),
    },
  ];

  return (
    <AdminPage
      title="Projects"
      subtitle={`${rows.length} projects · ${rows.filter((r) => r.status === 'in_progress').length} in progress`}
      actions={
        can && (
          <button className="ctl-btn primary inline-flex items-center gap-2" onClick={() => setEditing('new')}>
            <PlusIcon /> New project
          </button>
        )
      }
    >
      <ViewOnly area="projects" />
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <SearchBox value={q} onChange={setQ} placeholder="Search projects…" className="md:w-80" />
        <Chips value={status} onChange={setStatus} options={['all', ...STATUS.slice(0, 5)].map((s) => [s, s === 'all' ? 'All' : statusLabel(s)])} />
      </div>
      <DataTable rows={shown} columns={columns} loading={loading} onRowClick={(r) => setEditing(r)} empty="No projects yet" />
      <FormModal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'New project' : can ? `Edit · ${editing?.title || ''}` : editing?.title || ''}
        fields={FIELDS}
        initial={editing === 'new' ? null : editing}
        onSave={save}
        readOnly={!can}
      />
    </AdminPage>
  );
}
