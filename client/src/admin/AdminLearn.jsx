import { useMemo, useState } from 'react';
import { useTable } from '../lib/useData';
import { insert, update, remove } from '../lib/db';
import { required, max } from '../lib/validate';
import DataTable from '../components/ui/DataTable';
import { Chips, ConfirmButton } from '../components/ui/kit';
import { VIDEO_GROUPS } from '../data/oldSite';
import { AdminPage, FormModal, ViewOnly, useCanEdit, useOpenNew, PlusIcon } from './ui';

const GROUPS = VIDEO_GROUPS.map(([k, label]) => [k, label]);
const isYouTube = (u = '') => /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)[\w-]{6,}/.test(u);

const FIELDS = [
  { key: 'title', label: 'Title', rules: [required(), max(160)], span: 2 },
  {
    key: 'url',
    label: 'Link',
    span: 2,
    placeholder: 'https://www.youtube.com/watch?v=…',
    rules: [required(), (v) => (v && !/^https?:\/\//i.test(String(v).trim()) ? 'Start with https://' : null)],
    hint: 'A YouTube link plays right on the Learn page. Any other link appears under "More resources".',
  },
  { key: 'kind', label: 'Group', type: 'select', options: GROUPS, default: 'initial' },
  { key: 'sort_order', label: 'Order (smaller = first)', type: 'number', default: 50 },
];

/** Admin → Learn videos: the videos and links on the public Learn page. */
export default function AdminLearn() {
  const { rows, loading } = useTable('resources', { order: ['sort_order', true] });
  const can = useCanEdit('learn');
  const [group, setGroup] = useState('all');
  const [editing, setEditing] = useState(null);
  useOpenNew(can, () => setEditing('new'));

  const shown = useMemo(() => (group === 'all' ? rows : rows.filter((r) => r.kind === group)), [rows, group]);
  const save = (v) => (editing === 'new' ? insert('resources', v) : update('resources', editing.id, v));

  const columns = [
    { key: 'sort_order', label: '#', sort: true, width: 60, sortValue: (r) => Number(r.sort_order) },
    {
      key: 'title',
      label: 'Title',
      sort: true,
      render: (r) => (
        <div className="min-w-[220px]">
          <div className="font-medium">{r.title}</div>
          <a href={r.url} target="_blank" rel="noreferrer" className="block max-w-[420px] truncate text-xs" style={{ color: 'var(--blue-glow)' }} onClick={(e) => e.stopPropagation()}>
            {r.url}
          </a>
        </div>
      ),
    },
    { key: 'kind', label: 'Group', sort: true, render: (r) => <span className="chip">{GROUPS.find((g) => g[0] === r.kind)?.[1] || r.kind}</span> },
    {
      key: 'type',
      label: 'Shows as',
      render: (r) => (
        <span className="badge" data-tone={isYouTube(r.url) ? 'ok' : 'muted'}>
          {isYouTube(r.url) ? 'video' : 'link'}
        </span>
      ),
    },
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
            <ConfirmButton onConfirm={() => remove('resources', r.id)} />
          </div>
        ),
    },
  ];

  return (
    <AdminPage
      title="Learn videos"
      subtitle={`${rows.length} items on the Learn page`}
      actions={
        can && (
          <button className="ctl-btn primary inline-flex items-center gap-2" onClick={() => setEditing('new')}>
            <PlusIcon /> Add a video
          </button>
        )
      }
    >
      <ViewOnly area="learn" />
      <div className="mb-4">
        <Chips value={group} onChange={setGroup} options={[['all', 'All', rows.length], ...GROUPS.map(([k, l]) => [k, l, rows.filter((r) => r.kind === k).length])]} />
      </div>
      <DataTable rows={shown} columns={columns} loading={loading} onRowClick={(r) => setEditing(r)} empty="No videos yet" />
      <FormModal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Add a video' : editing?.title || ''}
        fields={FIELDS}
        initial={editing === 'new' ? null : editing}
        onSave={save}
        readOnly={!can}
        wide={false}
      />
    </AdminPage>
  );
}
