import { useEffect, useMemo, useState } from 'react';
import { useTable } from '../lib/useData';
import { update, remove } from '../lib/db';
import { StatusBadge, Chips, SearchBox, ConfirmButton, Modal, Field, TextArea, Empty, Skeleton, ErrorNote, timeAgo, fmtDate, statusLabel } from '../components/ui/kit';
import { AdminPage, ViewOnly, useCanEdit, StatCard } from './ui';

const STATUSES = ['pending', 'under_review', 'approved', 'implemented', 'rejected'];

export default function AdminIdeas() {
  const { rows, loading } = useTable('ideas', { order: ['created_at', false] });
  const can = useCanEdit('ideas');
  const [tab, setTab] = useState('pending');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);

  const count = (s) => rows.filter((r) => r.status === s).length;
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((r) => (tab === 'all' || r.status === tab) && (!s || `${r.title} ${r.description} ${r.author_name} ${r.tracking_code}`.toLowerCase().includes(s)));
  }, [rows, tab, q]);

  const decide = (idea, status, review_note) => update('ideas', idea.id, { status, reviewed_at: new Date().toISOString(), ...(review_note !== undefined ? { review_note } : {}) });

  return (
    <AdminPage title="Idea Box" subtitle="Review student ideas. Approved and built ideas appear on the public board; rejected and pending ones stay private.">
      <ViewOnly area="ideas" />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Waiting" value={count('pending')} tone={count('pending') ? 'warn' : undefined} hint="New, not looked at yet" />
        <StatCard label="In review" value={count('under_review')} />
        <StatCard label="Approved" value={count('approved')} tone="ok" />
        <StatCard label="Built" value={count('implemented')} />
      </div>
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Chips value={tab} onChange={setTab} options={[...STATUSES.map((s) => [s, statusLabel(s), count(s)]), ['all', 'All', rows.length]]} />
        <SearchBox value={q} onChange={setQ} placeholder="Search ideas or code…" className="lg:w-72" />
      </div>

      {loading ? (
        <Skeleton rows={4} height={100} />
      ) : !shown.length ? (
        <Empty title={tab === 'pending' ? 'Inbox zero — no ideas waiting' : 'Nothing here'} />
      ) : (
        <div className="flex flex-col gap-3">
          {shown.map((i, n) => (
            <article key={i.id} className="glass flex flex-col gap-4 p-5 animate-slide-up md:flex-row md:items-start" style={{ animationDelay: `${Math.min(n, 10) * 30}ms` }}>
              <button className="min-w-0 flex-1 text-left" onClick={() => setOpen(i)}>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={i.status} />
                  <span className="chip">{i.category}</span>
                  <span className="mono text-[10px] tracking-[0.15em]" style={{ color: 'var(--muted)' }}>
                    {i.tracking_code} · {timeAgo(i.created_at)} · ▲ {i.upvotes || 0}
                  </span>
                </div>
                <h3 className="display mt-2 text-lg font-bold">{i.title}</h3>
                <p className="mt-1 line-clamp-2 text-sm" style={{ color: 'var(--muted)' }}>
                  {i.description}
                </p>
                <div className="mt-2 text-xs" style={{ color: 'var(--muted)' }}>
                  {i.is_anonymous ? (
                    <span className="badge" data-tone="muted">
                      anonymous
                    </span>
                  ) : (
                    <>
                      by <span style={{ color: 'var(--fg)' }}>{i.author_name || '—'}</span>
                      {i.author_email && <> · {i.author_email}</>}
                    </>
                  )}
                </div>
              </button>
              {can && (
                <div className="flex shrink-0 flex-wrap gap-2 md:flex-col">
                  {i.status !== 'approved' && i.status !== 'implemented' && (
                    <button className="ctl-btn small" style={{ borderColor: 'var(--ok)', color: 'var(--ok)' }} onClick={() => decide(i, 'approved')}>
                      ✓ Approve
                    </button>
                  )}
                  {i.status !== 'rejected' && (
                    <button className="ctl-btn small" style={{ borderColor: 'var(--bad)', color: 'var(--bad)' }} onClick={() => setOpen({ ...i, _reject: true })}>
                      ✕ Reject
                    </button>
                  )}
                  <button className="ctl-btn small" onClick={() => setOpen(i)}>
                    Review…
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      <Review idea={open} onClose={() => setOpen(null)} can={can} decide={decide} />
    </AdminPage>
  );
}

function Review({ idea, onClose, can, decide }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => {
    setNote(idea?.review_note || '');
    setErr('');
  }, [idea]);
  if (!idea) return null;

  const go = async (status) => {
    if (status === 'rejected' && !note.trim()) return setErr('Add a short reason so the student knows why.');
    setBusy(true);
    try {
      await decide(idea, status, note.trim());
      onClose();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={!!idea} onClose={onClose} title={idea.title} wide>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={idea.status} />
        <span className="chip">{idea.category}</span>
        <span className="mono text-[10px] tracking-[0.15em]" style={{ color: 'var(--muted)' }}>
          {idea.tracking_code} · sent {fmtDate(idea.created_at)} · ▲ {idea.upvotes || 0}
        </span>
      </div>
      <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed">{idea.description}</p>
      <div className="mt-4 text-sm" style={{ color: 'var(--muted)' }}>
        {idea.is_anonymous ? 'Posted anonymously — no name or email kept.' : `By ${idea.author_name || '—'}${idea.author_email ? ` · ${idea.author_email}` : ''}`}
      </div>

      {can ? (
        <div className="mt-6 border-t pt-5" style={{ borderColor: 'var(--line)' }}>
          <Field label="Note to the student (shown when they track their code)" error={err}>
            <TextArea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder={idea._reject ? 'Why not now? Be kind and specific.' : 'Optional'} autoFocus={idea._reject} />
          </Field>
          {err && !err.startsWith('Add') && <ErrorNote>{err}</ErrorNote>}
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="ctl-btn" disabled={busy} onClick={() => go('under_review')}>
              Mark in review
            </button>
            <button className="ctl-btn" disabled={busy} style={{ borderColor: 'var(--ok)', color: 'var(--ok)' }} onClick={() => go('approved')}>
              ✓ Approve
            </button>
            <button className="ctl-btn" disabled={busy} onClick={() => go('implemented')}>
              Mark built
            </button>
            <button className="ctl-btn" disabled={busy} style={{ borderColor: 'var(--bad)', color: 'var(--bad)' }} onClick={() => go('rejected')}>
              ✕ Reject
            </button>
            <span className="flex-1" />
            <ConfirmButton
              onConfirm={async () => {
                await remove('ideas', idea.id);
                onClose();
              }}
            >
              Delete (spam)
            </ConfirmButton>
          </div>
        </div>
      ) : (
        idea.review_note && (
          <p className="mt-4 rounded-lg p-3 text-sm" style={{ background: 'rgba(45,123,255,.08)' }}>
            {idea.review_note}
          </p>
        )
      )}
    </Modal>
  );
}
