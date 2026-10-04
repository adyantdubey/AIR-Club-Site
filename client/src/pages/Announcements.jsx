import { useMemo, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap } from '../lib/gsap';
import { useTable } from '../lib/useData';
import { TLink } from '../transitions/PageWipe';
import { PageTop, Chips, Priority, Empty, Skeleton, fmtDate, timeAgo } from '../components/ui/kit';

export const ANN_CATEGORIES = [
  ['recruitment', 'Recruitment'],
  ['event', 'Events'],
  ['deadline', 'Deadlines'],
  ['notice', 'Notices'],
];
export const PRIORITIES = ['urgent', 'high', 'normal', 'low'];
const RANK = { urgent: 0, high: 1, normal: 2, low: 3 };

const ICON = {
  recruitment: 'M9 10a3 3 0 1 0 0-6a3 3 0 1 0 0 6M3 20c.8-3.5 3.2-5 6-5s5.2 1.5 6 5M19 8v6M16 11h6',
  event: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  deadline: 'M12 7v5l3 2M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18',
  notice: 'M4 10v4h3l6 4V6L7 10zM16 9a4 4 0 0 1 0 6',
};

/** Sort: pinned first, then priority (urgent → low), then newest. */
export function sortAnnouncements(rows) {
  return [...rows].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || RANK[a.priority] - RANK[b.priority] || (a.publish_at < b.publish_at ? 1 : -1));
}
export const isLive = (a, now = Date.now()) => new Date(a.publish_at).getTime() <= now && (!a.expires_at || new Date(a.expires_at).getTime() > now);

function closesIn(d) {
  const days = Math.ceil((new Date(d).getTime() - Date.now()) / 864e5);
  if (days <= 0) return 'closes today';
  return days === 1 ? 'closes tomorrow' : `closes in ${days} days`;
}

/** /announcements — recruitment, events, deadlines, notices. Filter by type; urgent ones float to the top. */
export default function Announcements() {
  const { rows, loading } = useTable('announcements', { order: ['publish_at', false] });
  const [cat, setCat] = useState('all');
  const [prio, setPrio] = useState('all');
  const root = useRef(null);

  const [now] = useState(() => Date.now());
  const live = useMemo(() => sortAnnouncements(rows.filter((a) => isLive(a, now))), [rows, now]);
  const archive = useMemo(() => rows.filter((a) => a.expires_at && new Date(a.expires_at).getTime() <= now), [rows, now]);
  const shown = live.filter((a) => (cat === 'all' || a.category === cat) && (prio === 'all' || a.priority === prio));
  const count = (k) => live.filter((a) => a.category === k).length;

  useGSAP(
    () => {
      if (!shown.length) return;
      gsap.from('.ann', { x: -30, opacity: 0, stagger: 0.07, duration: 0.6, ease: 'power3.out' });
    },
    { scope: root, dependencies: [cat, prio, shown.length > 0] },
  );

  return (
    <>
      <PageTop crumbs={['Announcements']} eyebrow="Notice board" title="What you need to know." intro="Recruitment calls, event updates, deadlines and lab notices. Urgent ones stay on top." />
      <section ref={root} className="section tight-top">
        <div className="mb-8 flex flex-col gap-3">
          <Chips value={cat} onChange={setCat} options={[['all', 'All', live.length], ...ANN_CATEGORIES.map(([k, l]) => [k, l, count(k)])]} />
          <div className="flex flex-wrap items-center gap-3">
            <span className="mono text-[10px] tracking-[0.2em]" style={{ color: 'var(--muted)' }}>
              PRIORITY
            </span>
            <Chips value={prio} onChange={setPrio} options={[['all', 'Any'], ...PRIORITIES.map((p) => [p, p])]} />
          </div>
        </div>

        {loading ? (
          <Skeleton rows={4} height={110} />
        ) : !shown.length ? (
          <Empty title="No announcements here" text="Check back soon, or switch the filter." />
        ) : (
          <div className="flex flex-col gap-4">
            {shown.map((a) => (
              <AnnouncementCard key={a.id} a={a} />
            ))}
          </div>
        )}

        {!!archive.length && (
          <details className="mt-12">
            <summary className="mono cursor-pointer text-[10px] tracking-[0.22em]" style={{ color: 'var(--muted)' }}>
              ARCHIVE · {archive.length} CLOSED
            </summary>
            <div className="mt-4 flex flex-col gap-3 opacity-60">
              {archive.map((a) => (
                <div key={a.id} className="glass flex items-center justify-between gap-4 px-5 py-3 text-sm">
                  <span>{a.title}</span>
                  <span className="mono text-[10px]" style={{ color: 'var(--muted)' }}>
                    CLOSED {fmtDate(a.expires_at).toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          </details>
        )}
      </section>
    </>
  );
}

export function AnnouncementCard({ a, compact = false }) {
  const urgent = a.priority === 'urgent';
  const internal = a.link?.startsWith('/');
  const LinkTag = internal ? TLink : 'a';
  return (
    <article
      className={`ann card card-glow relative flex gap-4 ${compact ? 'p-4' : 'p-5 md:p-6'}`}
      style={urgent ? { borderColor: 'rgba(255,107,107,.45)', boxShadow: '0 0 0 1px rgba(255,107,107,.15), 0 0 30px rgba(255,107,107,.08)' } : undefined}
    >
      <span className="absolute bottom-0 left-0 top-0 w-1" style={{ background: urgent ? 'var(--bad)' : a.priority === 'high' ? 'var(--warn)' : 'var(--blue)' }} aria-hidden="true" />
      <div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl sm:flex" style={{ background: 'rgba(45,123,255,.1)' }}>
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d={ICON[a.category] || ICON.notice} stroke="var(--blue-glow)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="mono text-[10px] tracking-[0.22em]" style={{ color: 'var(--blue-glow)' }}>
            {a.category.toUpperCase()}
          </span>
          <Priority level={a.priority} />
          {a.pinned && (
            <span className="mono text-[10px] tracking-[0.2em]" style={{ color: 'var(--fg)' }}>
              ◆ PINNED
            </span>
          )}
          <span className="mono ml-auto text-[10px] tracking-[0.15em]" style={{ color: 'var(--muted)' }}>
            {timeAgo(a.publish_at).toUpperCase()}
          </span>
        </div>
        <h3 className={`display mt-2 font-bold ${compact ? 'text-lg' : 'text-xl md:text-2xl'}`}>{a.title}</h3>
        {!compact && a.body && (
          <p className="mt-2 max-w-3xl text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
            {a.body}
          </p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-4">
          {a.expires_at && (
            <span className="mono text-[10px] tracking-[0.18em]" style={{ color: a.category === 'deadline' || urgent ? 'var(--warn)' : 'var(--muted)' }}>
              ⏱ {closesIn(a.expires_at).toUpperCase()} · {fmtDate(a.expires_at).toUpperCase()}
            </span>
          )}
          {a.link && (
            <LinkTag {...(internal ? { to: a.link } : { href: a.link, target: '_blank', rel: 'noreferrer' })} className="text-sm" style={{ color: 'var(--blue-glow)' }}>
              Open →
            </LinkTag>
          )}
        </div>
      </div>
    </article>
  );
}
