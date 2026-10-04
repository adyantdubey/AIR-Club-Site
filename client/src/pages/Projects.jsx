import { useMemo, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap } from '../lib/gsap';
import { useTable } from '../lib/useData';
import { PageTop, StatusBadge, Progress, SearchBox, Chips, Select, Modal, Empty, Skeleton, fmtDate, statusLabel } from '../components/ui/kit';
import DataTable from '../components/ui/DataTable';
import SafeImg from '../components/ui/SafeImg';
import { TLink } from '../transitions/PageWipe';

const STATUSES = ['all', 'planning', 'in_progress', 'testing', 'completed', 'on_hold'];

/** /projects — every club project: search, filter by status/category, progress, team size. */
export default function Projects() {
  const { rows: all, loading, error } = useTable('projects', { order: ['updated_at', false] });
  // current projects are the main list; older ones (archived) get their own section below
  const rows = useMemo(() => all.filter((r) => !r.archived), [all]);
  const earlier = useMemo(() => all.filter((r) => r.archived), [all]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [cat, setCat] = useState('all');
  const [view, setView] = useState('table');
  const [open, setOpen] = useState(null);
  const stats = useRef(null);

  const categories = useMemo(() => ['all', ...new Set(rows.map((r) => r.category).filter(Boolean))], [rows]);
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (status === 'all' || r.status === status) &&
        (cat === 'all' || r.category === cat) &&
        (!s || [r.title, r.summary, r.lead, r.category, ...(r.tech || [])].join(' ').toLowerCase().includes(s)),
    );
  }, [rows, q, status, cat]);

  const counts = useMemo(() => Object.fromEntries(STATUSES.map((k) => [k, k === 'all' ? rows.length : rows.filter((r) => r.status === k).length])), [rows]);
  const totalPeople = rows.reduce((a, r) => a + (Number(r.team_size) || 0), 0);
  const avg = rows.length ? Math.round(rows.reduce((a, r) => a + (Number(r.progress) || 0), 0) / rows.length) : 0;

  useGSAP(
    () => {
      if (!rows.length) return;
      gsap.from('.pstat', { y: 24, opacity: 0, stagger: 0.08, duration: 0.7, ease: 'power3.out' });
    },
    { scope: stats, dependencies: [rows.length > 0] },
  );

  const columns = [
    {
      key: 'title',
      label: 'Project',
      sort: true,
      render: (r) => (
        <div className="min-w-[220px]">
          <div className="display font-bold">{r.title}</div>
          <div className="mt-0.5 line-clamp-1 text-xs" style={{ color: 'var(--muted)' }}>
            {r.summary}
          </div>
        </div>
      ),
    },
    { key: 'category', label: 'Area', sort: true, render: (r) => <span className="chip">{r.category || '—'}</span> },
    { key: 'status', label: 'Status', sort: true, render: (r) => <StatusBadge status={r.status} /> },
    { key: 'progress', label: 'Progress', sort: true, width: 180, sortValue: (r) => Number(r.progress), render: (r) => <Progress value={r.progress} /> },
    {
      key: 'team_size',
      label: 'Team',
      sort: true,
      align: 'right',
      sortValue: (r) => Number(r.team_size),
      render: (r) => (
        <span className="mono" style={{ color: 'var(--blue-glow)' }}>
          {r.team_size} <span style={{ color: 'var(--muted)' }}>ppl</span>
        </span>
      ),
    },
  ];

  return (
    <>
      <PageTop crumbs={['Projects']} eyebrow="Build log" title="Everything on the bench." intro="Every project the club is running — what stage it is at, how far along, and how many people are on it. Click a row for details." />

      <section className="section tight-top">
        {/* summary */}
        <div ref={stats} className="mb-10 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            ['Projects', rows.length],
            ['Active now', (counts.in_progress || 0) + (counts.testing || 0)],
            ['People building', totalPeople],
            ['Average progress', `${avg}%`],
          ].map(([l, v]) => (
            <div key={l} className="pstat glass p-5">
              <div className="display text-3xl font-bold">{loading ? '—' : v}</div>
              <div className="mono mt-1 text-[10px] uppercase tracking-[0.22em]" style={{ color: 'var(--muted)' }}>
                {l}
              </div>
            </div>
          ))}
        </div>

        {/* toolbar */}
        <div className="mb-5 flex flex-col gap-4">
          <div className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
            <SearchBox value={q} onChange={setQ} placeholder="Search by name, tech, lead…" />
            <Select value={cat} onChange={(e) => setCat(e.target.value)} options={categories.map((c) => [c, c === 'all' ? 'All areas' : c])} aria-label="Area" />
            <div className="flex gap-1 rounded-lg p-1" style={{ background: 'rgba(110,178,255,.08)' }}>
              {['table', 'cards'].map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className="mono rounded-md px-3 py-1.5 text-[10px] uppercase tracking-[0.15em]"
                  style={view === v ? { background: 'var(--blue)', color: '#fff' } : { color: 'var(--muted)' }}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
          <Chips value={status} onChange={setStatus} options={STATUSES.map((s) => [s, s === 'all' ? 'All' : statusLabel(s), counts[s]])} />
        </div>

        {error && <Empty title="Could not load projects" text={error} />}
        {!error && view === 'table' && <DataTable rows={shown} columns={columns} loading={loading} onRowClick={setOpen} empty="No project matches that search" />}
        {!error && view === 'cards' &&
          (loading ? (
            <Skeleton rows={3} height={120} />
          ) : shown.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map((r, i) => (
                <button key={r.id} onClick={() => setOpen(r)} className="card card-glow p-5 text-left animate-slide-up" style={{ animationDelay: `${i * 50}ms` }} data-cursor="view">
                  <div className="flex items-center justify-between gap-2">
                    <span className="mono text-[10px] tracking-[0.22em]" style={{ color: 'var(--blue-glow)' }}>
                      {(r.category || '').toUpperCase()}
                    </span>
                    <StatusBadge status={r.status} />
                  </div>
                  <div className="display mt-3 text-xl font-bold">{r.title}</div>
                  <p className="mt-1 line-clamp-2 text-sm" style={{ color: 'var(--muted)' }}>
                    {r.summary}
                  </p>
                  <div className="mt-5">
                    <Progress value={r.progress} />
                  </div>
                  <div className="mono mt-3 text-[10px] tracking-[0.18em]" style={{ color: 'var(--muted)' }}>
                    TEAM OF {r.team_size} · LEAD {String(r.lead || '—').toUpperCase()}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <Empty title="No project matches that search" />
          ))}
      </section>

      <Earlier list={earlier} />

      <Modal open={!!open} onClose={() => setOpen(null)} title={open?.title || ''} wide>
        {open && <ProjectDetail p={open} />}
      </Modal>
    </>
  );
}

function ProjectDetail({ p }) {
  return (
    <div className="grid gap-6 md:grid-cols-[1.4fr_1fr]">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={p.status} />
          {p.category && <span className="chip">{p.category}</span>}
        </div>
        <p className="mt-4 text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
          {p.description || p.summary}
        </p>
        {!!p.tech?.length && (
          <div className="mt-5 flex flex-wrap gap-2">
            {p.tech.map((t) => (
              <span key={t} className="chip">
                {t}
              </span>
            ))}
          </div>
        )}
        <div className="mt-6 flex flex-wrap gap-3">
          {p.repo_url && (
            <a className="ctl-btn" href={p.repo_url} target="_blank" rel="noreferrer">
              Code ↗
            </a>
          )}
          {p.demo_url && (
            <a className="ctl-btn primary" href={p.demo_url} target="_blank" rel="noreferrer">
              Demo ↗
            </a>
          )}
        </div>
      </div>
      <div className="glass flex flex-col gap-4 p-5">
        <div>
          <div className="lbl">Progress</div>
          <Progress value={p.progress} />
        </div>
        {[
          ['Lead', p.lead],
          ['Team size', `${p.team_size} people`],
          ['Started', fmtDate(p.start_date)],
          ['Target', fmtDate(p.end_date)],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 text-sm">
            <span className="mono text-[10px] uppercase tracking-[0.18em]" style={{ color: 'var(--muted)' }}>
              {k}
            </span>
            <span>{v || '—'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Earlier projects (from the previous website) — each opens its own page ---------------- */
function Earlier({ list }) {
  const root = useRef(null);
  useGSAP(
    () => {
      if (!list.length) return;
      gsap.from('.ep-card', { y: 50, opacity: 0, stagger: 0.1, duration: 0.8, ease: 'power3.out', scrollTrigger: { trigger: root.current, start: 'top 82%', once: true } });
    },
    { scope: root, dependencies: [list.length] },
  );
  if (!list.length) return null;
  return (
    <section ref={root} className="section flush-top">
      <div className="mono mb-3 flex items-center gap-3 text-xs uppercase tracking-[0.22em]" style={{ color: 'var(--blue-glow)' }}>
        <span className="inline-block h-px w-8" style={{ background: 'var(--blue)' }} />
        Earlier projects
      </div>
      <h2 className="display mb-8 text-[clamp(1.8rem,4vw,3rem)] font-bold leading-tight">Where the club started.</h2>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((p, i) => (
          <TLink key={p.id} to={`/projects/${p.slug || p.id}`} className="ep-card card card-glow group flex flex-col overflow-hidden" data-cursor="view">
            <div className="relative aspect-[16/10] overflow-hidden">
              <SafeImg
                src={p.image_url}
                alt={p.title}
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                fallback={<div className="h-full w-full" style={{ background: `linear-gradient(160deg, hsl(${212 + i * 6} 55% 20%), #050810)` }} />}
              />
              <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(5,8,16,.85), transparent 55%)' }} />
              <div className="absolute left-3 top-3">
                <StatusBadge status={p.status} />
              </div>
            </div>
            <div className="flex flex-1 flex-col p-5">
              <div className="mono text-[10px] tracking-[0.22em]" style={{ color: 'var(--blue-glow)' }}>
                {(p.category || '').toUpperCase()}
              </div>
              <div className="display mt-2 text-xl font-bold">{p.title}</div>
              <p className="mt-1 line-clamp-3 flex-1 text-sm" style={{ color: 'var(--muted)' }}>
                {p.summary}
              </p>
              <div className="mt-4 text-sm" style={{ color: 'var(--blue-glow)' }}>
                Read the story <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
              </div>
            </div>
          </TLink>
        ))}
      </div>
    </section>
  );
}
