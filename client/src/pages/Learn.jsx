import { useEffect, useMemo, useRef, useState } from 'react';
import { animate, stagger } from 'animejs';
import { useTable } from '../lib/useData';
import { PageTop, Chips, Skeleton, Empty } from '../components/ui/kit';
import SafeImg from '../components/ui/SafeImg';
import { VIDEO_GROUPS } from '../data/oldSite';

const ytId = (url = '') => (url.match(/(?:v=|embed\/|youtu\.be\/)([\w-]{6,})/) || [])[1] || '';

/** /learn — hand-picked videos to learn AI and robotics, grouped from "start here" to full courses. */
export default function Learn() {
  const { rows, loading } = useTable('resources', { order: ['sort_order', true] });
  const [group, setGroup] = useState('all');
  const videos = useMemo(() => rows.filter((r) => ytId(r.url)), [rows]);
  const links = useMemo(() => rows.filter((r) => !ytId(r.url)), [rows]);
  const groups = VIDEO_GROUPS.filter(([k]) => (group === 'all' || group === k) && videos.some((v) => v.kind === k));

  return (
    <>
      <PageTop crumbs={['Learn']} eyebrow="Learn the basics" title="Start from zero. Go as deep as you like." intro="Videos the club recommends — from a five-minute answer to “what is AI?” to full Stanford courses. Press play right here on the page." />
      <section className="section tight-top">
        <div className="mb-10">
          <Chips value={group} onChange={setGroup} options={[['all', 'Everything', videos.length], ...VIDEO_GROUPS.map(([k, l]) => [k, l, videos.filter((v) => v.kind === k).length])]} />
        </div>
        {loading ? (
          <Skeleton rows={2} height={180} />
        ) : !videos.length ? (
          <Empty title="No videos yet" />
        ) : (
          <div className="flex flex-col gap-14">
            {groups.map(([k, label, blurb], gi) => (
              <Group key={k} n={gi + 1} label={label} blurb={blurb} items={videos.filter((v) => v.kind === k)} />
            ))}
          </div>
        )}
        {!!links.length && (
          <div className="mt-14">
            <div className="lbl">More resources</div>
            <div className="flex flex-wrap gap-2">
              {links.map((r) => (
                <a key={r.id} href={r.url} target="_blank" rel="noreferrer" className="ctl-btn">
                  {r.title} ↗
                </a>
              ))}
            </div>
          </div>
        )}
      </section>
    </>
  );
}

function Group({ n, label, blurb, items }) {
  const grid = useRef(null);
  useEffect(() => {
    const a = animate(grid.current.querySelectorAll('.vid'), { opacity: [0, 1], translateY: [30, 0], delay: stagger(70), duration: 700, ease: 'outExpo' });
    return () => a.cancel();
  }, [items.length]);
  return (
    <div>
      <div className="mb-5 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="mono text-xs tracking-[0.22em]" style={{ color: 'var(--blue-glow)' }}>
          0{n}
        </span>
        <h2 className="display text-2xl font-bold md:text-3xl">{label}</h2>
        <span className="text-sm" style={{ color: 'var(--muted)' }}>
          {blurb}
        </span>
      </div>
      <div ref={grid} className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((v) => (
          <Video key={v.id} v={v} />
        ))}
      </div>
    </div>
  );
}

function Video({ v }) {
  const [playing, setPlaying] = useState(false);
  const id = ytId(v.url);
  return (
    <div className="vid card card-glow group overflow-hidden opacity-0">
      <div className="relative aspect-video overflow-hidden" style={{ background: 'linear-gradient(160deg, hsl(215 55% 18%), #050810)' }}>
        {playing ? (
          <iframe
            className="absolute inset-0 h-full w-full"
            src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
            title={v.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        ) : (
          <button className="absolute inset-0 h-full w-full" onClick={() => setPlaying(true)} aria-label={`Play: ${v.title}`} data-cursor="view">
            <SafeImg src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" className="h-full w-full object-cover opacity-80 transition-all duration-700 group-hover:scale-105 group-hover:opacity-100" />
            <span className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(5,8,16,.75), transparent 60%)' }} />
            <span className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border transition-transform duration-300 group-hover:scale-110" style={{ borderColor: 'var(--blue-glow)', background: 'rgba(5,8,16,.6)', backdropFilter: 'blur(6px)' }}>
              <svg className="ml-1 h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M7 4l13 8-13 8z" fill="var(--blue-glow)" />
              </svg>
            </span>
          </button>
        )}
      </div>
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="display text-sm font-bold leading-snug">{v.title}</div>
        <a href={v.url} target="_blank" rel="noreferrer" className="mono shrink-0 text-[10px] tracking-[0.15em]" style={{ color: 'var(--blue-glow)' }} aria-label="Open on YouTube">
          YOUTUBE ↗
        </a>
      </div>
    </div>
  );
}
