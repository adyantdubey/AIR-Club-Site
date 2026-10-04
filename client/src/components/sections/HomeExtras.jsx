/**
 * New Home sections (v3): featured projects, achievements ticker, priority notices, Idea Box call-to-action.
 * All read from the database, so admins update them without touching code.
 */
import { useMemo, useRef } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap } from '../../lib/gsap';
import { useTable } from '../../lib/useData';
import { TLink } from '../../transitions/PageWipe';
import { StatusBadge, Progress } from '../ui/kit';
import { AnnouncementCard, isLive, sortAnnouncements } from '../../pages/Announcements';

/* ---------------- urgent / high notices ---------------- */
export function NoticeStrip() {
  const { rows } = useTable('announcements', { order: ['publish_at', false] });
  const top = useMemo(() => sortAnnouncements(rows.filter((a) => isLive(a) && (a.priority === 'urgent' || a.priority === 'high' || a.pinned))).slice(0, 2), [rows]);
  const root = useRef(null);
  useGSAP(
    () => {
      if (!top.length) return;
      gsap.from('.ann', { y: 30, opacity: 0, stagger: 0.12, duration: 0.8, scrollTrigger: { trigger: root.current, start: 'top 85%', once: true } });
    },
    { scope: root, dependencies: [top.length] },
  );
  if (!top.length) return null;
  return (
    <section ref={root} className="section flush-bottom">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div className="mono flex items-center gap-3 text-xs uppercase tracking-[0.22em]" style={{ color: 'var(--blue-glow)' }}>
          <span className="inline-block h-2 w-2 animate-pulse rounded-full" style={{ background: 'var(--bad)' }} />
          Notice board
        </div>
        <TLink to="/announcements" className="mono text-[11px] tracking-[0.2em]" style={{ color: 'var(--blue-glow)' }}>
          ALL NOTICES →
        </TLink>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {top.map((a) => (
          <AnnouncementCard key={a.id} a={a} compact />
        ))}
      </div>
    </section>
  );
}

/* ---------------- featured projects ---------------- */
export function FeaturedProjects() {
  const { rows } = useTable('projects', { order: ['updated_at', false] });
  const list = useMemo(() => {
    const current = rows.filter((p) => !p.archived);
    const f = current.filter((p) => p.featured);
    return (f.length ? f : current).slice(0, 3);
  }, [rows]);
  const root = useRef(null);
  useGSAP(
    () => {
      if (!list.length) return;
      gsap.from('.fp-card', { y: 50, opacity: 0, rotateX: -12, stagger: 0.12, duration: 0.9, ease: 'power3.out', scrollTrigger: { trigger: root.current, start: 'top 80%', once: true } });
    },
    { scope: root, dependencies: [list.length] },
  );
  if (!list.length) return null;
  return (
    <section ref={root} className="section flush-bottom">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mono mb-3 text-xs uppercase tracking-[0.22em]" style={{ color: 'var(--blue-glow)' }}>
            03 — On the bench
          </div>
          <h2 className="display text-[clamp(2rem,5vw,3.6rem)] font-bold leading-[1.05]">Featured projects.</h2>
        </div>
        <TLink to="/projects" className="btn text-xs" style={{ padding: '0.7rem 1.2rem' }}>
          <span className="btn-fill" />
          All projects →
        </TLink>
      </div>
      <div className="grid gap-5 md:grid-cols-3" style={{ perspective: 1000 }}>
        {list.map((p) => (
          <TLink key={p.id} to="/projects" className="fp-card card card-glow group flex flex-col p-6" data-cursor="view">
            <div className="flex items-center justify-between gap-2">
              <span className="mono text-[10px] tracking-[0.22em]" style={{ color: 'var(--blue-glow)' }}>
                {(p.category || '').toUpperCase()}
              </span>
              <StatusBadge status={p.status} />
            </div>
            <div className="display mt-4 text-2xl font-bold">{p.title}</div>
            <p className="mt-2 line-clamp-3 flex-1 text-sm" style={{ color: 'var(--muted)' }}>
              {p.summary}
            </p>
            <div className="mt-6">
              <Progress value={p.progress} />
            </div>
            <div className="mono mt-3 flex justify-between text-[10px] tracking-[0.18em]" style={{ color: 'var(--muted)' }}>
              <span>TEAM OF {p.team_size}</span>
              <span className="transition-transform group-hover:translate-x-1" style={{ color: 'var(--blue-glow)' }}>
                DETAILS →
              </span>
            </div>
          </TLink>
        ))}
      </div>
    </section>
  );
}

/* ---------------- achievements ticker ---------------- */
export function AchievementsStrip() {
  const { rows } = useTable('achievements', { order: ['year', false] });
  const root = useRef(null);
  useGSAP(
    () => {
      if (!rows.length) return;
      const loop = gsap.to('.ach-track', { xPercent: -50, ease: 'none', duration: 36, repeat: -1 });
      const el = root.current;
      const slow = () => gsap.to(loop, { timeScale: 0.2, duration: 0.6 });
      const fast = () => gsap.to(loop, { timeScale: 1, duration: 0.6 });
      el.addEventListener('mouseenter', slow);
      el.addEventListener('mouseleave', fast);
      return () => {
        el.removeEventListener('mouseenter', slow);
        el.removeEventListener('mouseleave', fast);
      };
    },
    { scope: root, dependencies: [rows.length], revertOnUpdate: true },
  );
  if (!rows.length) return null;
  const items = [...rows, ...rows];
  return (
    <section className="relative py-14" style={{ zIndex: 2 }}>
      <div className="mb-5 flex items-center justify-between px-[var(--pad-x)]">
        <div className="mono text-xs uppercase tracking-[0.22em]" style={{ color: 'var(--blue-glow)' }}>
          Things we brought home
        </div>
        <TLink to="/about" className="mono text-[11px] tracking-[0.2em]" style={{ color: 'var(--blue-glow)' }}>
          ALL ACHIEVEMENTS →
        </TLink>
      </div>
      <div ref={root} className="overflow-hidden border-y py-5" style={{ borderColor: 'var(--line)', maskImage: 'linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)' }}>
        <div className="ach-track flex w-max gap-10">
          {items.map((a, i) => (
            <div key={i} className="flex shrink-0 items-center gap-4">
              <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M8 4h8v6a4 4 0 0 1-8 0zM6 6H3v2a3 3 0 0 0 3 3M18 6h3v2a3 3 0 0 1-3 3M12 14v4M9 20h6" stroke="var(--blue-glow)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div>
                <div className="display whitespace-nowrap text-lg font-bold">{a.title}</div>
                <div className="mono whitespace-nowrap text-[10px] tracking-[0.18em]" style={{ color: 'var(--muted)' }}>
                  {(a.event_name || '').toUpperCase()} · {a.year}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Idea Box CTA ---------------- */
export function IdeaBoxCta() {
  const root = useRef(null);
  useGSAP(
    () => {
      const tl = gsap.timeline({ scrollTrigger: { trigger: root.current, start: 'top 80%', once: true } });
      tl.from('.ib-box', { y: 40, opacity: 0, duration: 0.8, ease: 'power3.out' })
        .from('.ib-note', { y: -120, rotate: -25, opacity: 0, duration: 0.9, ease: 'bounce.out', stagger: 0.18 }, '-=0.3')
        .from('.ib-text > *', { y: 20, opacity: 0, stagger: 0.1, duration: 0.6 }, '-=0.8');
      gsap.to('.ib-note', { y: '-=6', duration: 2, ease: 'sine.inOut', yoyo: true, repeat: -1, stagger: 0.4, delay: 2 });
    },
    { scope: root },
  );
  return (
    <section ref={root} className="section flush-bottom">
      <div className="ib-box card relative grid items-center gap-10 overflow-hidden p-8 md:grid-cols-[1.3fr_1fr] md:p-12" style={{ background: 'linear-gradient(135deg, rgba(45,123,255,.22), rgba(5,8,16,.92) 60%)' }}>
        <div className="ib-text">
          <div className="mono text-xs uppercase tracking-[0.22em]" style={{ color: 'var(--blue-glow)' }}>
            Idea Box
          </div>
          <h2 className="display mt-3 text-[clamp(2rem,5vw,3.6rem)] font-bold leading-[1.05]">Your idea could be our next build.</h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
            Drop a project, event or lab idea — with your name or anonymously. The committee reviews every one, and the most-voted get a mentor and a parts budget.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <TLink to="/ideas" className="btn solid">
              <span className="btn-fill" />
              Submit an idea →
            </TLink>
            <TLink to="/ideas" className="btn">
              <span className="btn-fill" />
              Vote on ideas
            </TLink>
          </div>
        </div>
        {/* little box with notes dropping in */}
        <div className="relative mx-auto h-56 w-56" aria-hidden="true">
          {['Delivery bot', 'Paper circle', 'Tree-map drone'].map((t, i) => (
            <div
              key={t}
              className="ib-note glass absolute px-3 py-2 text-xs"
              style={{ left: `${10 + i * 22}%`, top: `${4 + i * 14}%`, transform: `rotate(${(i - 1) * 8}deg)`, background: 'rgba(11,16,32,.9)' }}
            >
              <span className="mono text-[9px] tracking-[0.18em]" style={{ color: 'var(--blue-glow)' }}>
                IDEA
              </span>
              <div className="display font-bold">{t}</div>
            </div>
          ))}
          <svg className="absolute bottom-0 left-0 h-32 w-56" viewBox="0 0 224 128" fill="none">
            <path d="M12 40h200v80H12z" fill="rgba(5,8,16,.95)" stroke="var(--blue)" strokeWidth="1.5" />
            <path d="M12 40l24-24h152l24 24" stroke="var(--blue-glow)" strokeWidth="1.5" />
            <path d="M72 64h80" stroke="var(--blue-glow)" strokeWidth="3" strokeLinecap="round" />
            <text x="112" y="100" textAnchor="middle" fill="var(--muted)" fontFamily="JetBrains Mono, monospace" fontSize="10" letterSpacing="3">
              IDEA BOX
            </text>
          </svg>
        </div>
      </div>
    </section>
  );
}
