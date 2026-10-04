import { useMemo, useState } from 'react';
import { useTable } from '../lib/useData';
import { insert, update, remove } from '../lib/db';
import { required, max, range, url } from '../lib/validate';
import DataTable from '../components/ui/DataTable';
import { StatusBadge, Chips, ConfirmButton, Modal, Empty, fmtDate, fmtTime } from '../components/ui/kit';
import { AdminPage, FormModal, ViewOnly, useCanEdit, useOpenNew, PlusIcon } from './ui';

const KINDS = ['WORKSHOP', 'TALK', 'COMPETITION', 'HACKATHON', 'BOOTCAMP', 'SHOWCASE', 'RECRUITMENT', 'MEETUP'];

const FIELDS = [
  { section: 'Event', key: 'title', label: 'Title', rules: [required(), max(120)], span: 2 },
  { section: 'Event', key: 'kind', label: 'Type', type: 'select', options: KINDS, default: 'WORKSHOP' },
  { section: 'Event', key: 'venue', label: 'Venue', rules: [required()] },
  { section: 'Event', key: 'description', label: 'Short description', type: 'textarea', rows: 2 },
  { section: 'Date & time', key: 'starts_at', label: 'Starts', type: 'datetime', rules: [required()] },
  { section: 'Date & time', key: 'ends_at', label: 'Ends (optional)', type: 'datetime' },
  { section: 'Registration', key: 'registration_open', label: 'Registration open', type: 'checkbox', default: true },
  { section: 'Story page', key: 'image_url', label: 'Main photo', type: 'image', folder: 'events' },
  { section: 'Story page', key: 'image2_url', label: 'Second photo', type: 'image', folder: 'events' },
  { section: 'Story page', key: 'body', label: 'Full write-up', type: 'textarea', rows: 10, hint: 'Start a line with "## " for a heading and "- " for a bullet. Leave a blank line between paragraphs.' },
  { section: 'Story page', key: 'link', label: 'Outside link (optional)', placeholder: 'https://…', rules: [url()] },
  { section: 'Registration', key: 'capacity', label: 'Seats (0 = no limit)', type: 'number', min: 0, default: 0, rules: [range(0, 5000)] },
];

const isPast = (e) => new Date(e.starts_at).getTime() < Date.now() - 3 * 3600e3;

export default function AdminEvents() {
  const { rows, loading } = useTable('events', { order: ['starts_at', false] });
  const { rows: regs } = useTable('event_registrations', { order: ['created_at', false] });
  const can = useCanEdit('events');
  const [when, setWhen] = useState('upcoming');
  const [editing, setEditing] = useState(null);
  useOpenNew(can, () => setEditing('new'));
  const [viewRegs, setViewRegs] = useState(null);

  const regCount = useMemo(() => {
    const m = {};
    regs.forEach((r) => (m[r.event_id] = (m[r.event_id] || 0) + 1));
    return m;
  }, [regs]);
  const shown = rows.filter((e) => when === 'all' || (when === 'past' ? isPast(e) : !isPast(e)));

  const save = (v) => (editing === 'new' ? insert('events', v) : update('events', editing.id, v));

  const columns = [
    {
      key: 'starts_at',
      label: 'When',
      sort: true,
      render: (e) => (
        <div className="whitespace-nowrap">
          <div className="font-medium">{fmtDate(e.starts_at)}</div>
          <div className="text-xs" style={{ color: 'var(--muted)' }}>
            {fmtTime(e.starts_at)}
          </div>
        </div>
      ),
    },
    {
      key: 'title',
      label: 'Event',
      sort: true,
      render: (e) => (
        <div className="min-w-[180px]">
          <div className="font-medium">{e.title}</div>
          <div className="text-xs" style={{ color: 'var(--muted)' }}>
            {e.kind} · {e.venue}
          </div>
        </div>
      ),
    },
    { key: 'state', label: 'Status', render: (e) => <StatusBadge status={isPast(e) ? 'past' : 'upcoming'} /> },
    {
      key: 'reg',
      label: 'Registrations',
      sortValue: (e) => regCount[e.id] || 0,
      sort: true,
      render: (e) => (
        <button
          className="flex items-center gap-2 text-left"
          onClick={(ev) => {
            ev.stopPropagation();
            setViewRegs(e);
          }}
        >
          <span className="display font-bold">{regCount[e.id] || 0}</span>
          <span className="text-xs" style={{ color: 'var(--muted)' }}>
            {e.capacity ? `/ ${e.capacity}` : ''}
          </span>
          <span className="badge" data-tone={e.registration_open ? 'ok' : 'muted'}>
            {e.registration_open ? 'open' : 'closed'}
          </span>
        </button>
      ),
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (e) =>
        can && (
          <div className="flex justify-end gap-2" onClick={(ev) => ev.stopPropagation()}>
            <button className="ctl-btn small" onClick={() => update('events', e.id, { registration_open: !e.registration_open })}>
              {e.registration_open ? 'Close reg.' : 'Open reg.'}
            </button>
            <button className="ctl-btn small" onClick={() => setEditing(e)}>
              Edit
            </button>
            <ConfirmButton onConfirm={() => remove('events', e.id)} />
          </div>
        ),
    },
  ];

  return (
    <AdminPage
      title="Events"
      subtitle={`${rows.filter((e) => !isPast(e)).length} upcoming · ${regs.length} registrations in total`}
      actions={
        can && (
          <button className="ctl-btn primary inline-flex items-center gap-2" onClick={() => setEditing('new')}>
            <PlusIcon /> New event
          </button>
        )
      }
    >
      <ViewOnly area="events" />
      <div className="mb-4">
        <Chips value={when} onChange={setWhen} options={[['upcoming', 'Upcoming'], ['past', 'Past'], ['all', 'All']]} />
      </div>
      <DataTable rows={shown} columns={columns} loading={loading} onRowClick={(e) => setEditing(e)} empty="No events here" initialSort={when === 'upcoming' ? ['starts_at', true] : null} />
      <FormModal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'New event' : editing?.title || ''}
        fields={FIELDS}
        initial={editing === 'new' ? null : editing}
        onSave={save}
        readOnly={!can}
      />
      <Registrations event={viewRegs} regs={regs.filter((r) => r.event_id === viewRegs?.id)} onClose={() => setViewRegs(null)} can={can} />
    </AdminPage>
  );
}

function Registrations({ event, regs, onClose, can }) {
  const csv = () => {
    const lines = [['Name', 'Email', 'Registered at'], ...regs.map((r) => [r.name, r.email, new Date(r.created_at).toLocaleString('en-IN')])];
    const text = lines.map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
    a.download = `${(event?.title || 'event').replace(/\W+/g, '-')}-registrations.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <Modal open={!!event} onClose={onClose} title={`Registrations · ${event?.title || ''}`}>
      {!regs.length ? (
        <Empty title="No registrations yet" />
      ) : (
        <>
          <div className="mb-4 flex justify-between gap-3">
            <span className="text-sm" style={{ color: 'var(--muted)' }}>
              {regs.length} people{event?.capacity ? ` of ${event.capacity} seats` : ''}
            </span>
            <button className="ctl-btn small" onClick={csv}>
              Download CSV
            </button>
          </div>
          <div className="flex max-h-[50vh] flex-col divide-y overflow-auto" style={{ borderColor: 'var(--line)' }}>
            {regs.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 py-2.5" style={{ borderColor: 'var(--line)' }}>
                <div className="min-w-0">
                  <div className="text-sm font-medium">{r.name}</div>
                  <div className="truncate text-xs" style={{ color: 'var(--muted)' }}>
                    {r.email}
                  </div>
                </div>
                {can && <ConfirmButton onConfirm={() => remove('event_registrations', r.id)}>Remove</ConfirmButton>}
              </div>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}
