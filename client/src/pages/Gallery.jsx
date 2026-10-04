import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { animate, stagger } from 'animejs';
import { useTable } from '../lib/useData';
import { PageTop, Chips, Empty, Skeleton, fmtDate } from '../components/ui/kit';
import { MEDIA_CATEGORIES, Tile } from '../components/ui/MediaTile';

/** /gallery — photos by category, with a lightbox. Admins upload in /admin/gallery. */
export default function Gallery() {
  const { rows, loading } = useTable('media', { order: ['taken_on', false] });
  const [cat, setCat] = useState('all');
  const [index, setIndex] = useState(-1);
  const grid = useRef(null);

  const shown = useMemo(() => (cat === 'all' ? rows : rows.filter((m) => m.category === cat)), [rows, cat]);
  const counts = useMemo(() => Object.fromEntries(MEDIA_CATEGORIES.map(([k]) => [k, rows.filter((r) => r.category === k).length])), [rows]);

  // tiles ripple in from the centre whenever the filter changes
  useEffect(() => {
    if (!grid.current || !shown.length) return;
    const a = animate(grid.current.querySelectorAll('.g-tile'), {
      opacity: [0, 1],
      scale: [0.92, 1],
      translateY: [20, 0],
      delay: stagger(45, { from: 'center' }),
      duration: 650,
      ease: 'outExpo',
    });
    return () => a.cancel();
  }, [shown]);

  return (
    <>
      <PageTop crumbs={['Gallery']} eyebrow="Gallery" title="Moments from the floor." intro="Build nights, competitions, workshops and the lab itself. Tap any photo to open it." />
      <section className="section tight-top">
        <div className="mb-8">
          <Chips value={cat} onChange={setCat} options={[['all', 'All', rows.length], ...MEDIA_CATEGORIES.map(([k, l]) => [k, l, counts[k]])]} />
        </div>
        {loading ? (
          <Skeleton rows={3} height={160} />
        ) : !shown.length ? (
          <Empty title="No photos here yet" text="The committee adds photos from the admin dashboard." />
        ) : (
          <div ref={grid} className="grid auto-rows-[150px] grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" style={{ gridAutoFlow: 'dense' }}>
            {shown.map((m, i) => (
              <button
                key={m.id}
                onClick={() => setIndex(i)}
                className={`g-tile card group relative overflow-hidden text-left opacity-0 ${i % 7 === 0 ? 'row-span-2' : ''} ${i % 7 === 3 ? 'sm:col-span-2' : ''}`}
                data-cursor="view"
                aria-label={`Open ${m.title}`}
              >
                <Tile m={m} i={i} />
                <div className="absolute inset-x-0 bottom-0 p-3" style={{ background: 'linear-gradient(to top, rgba(5,8,16,.92), transparent)' }}>
                  <div className="mono text-[9px] tracking-[0.25em]" style={{ color: 'var(--blue-glow)' }}>
                    {m.category.toUpperCase()}
                  </div>
                  <div className="display text-sm font-bold">{m.title}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
      {index >= 0 && shown[index] && <Lightbox items={shown} index={index} setIndex={setIndex} />}
    </>
  );
}

function Lightbox({ items, index, setIndex }) {
  const m = items[index];
  const close = useCallback(() => setIndex(-1), [setIndex]);
  const step = useCallback((d) => setIndex((i) => (i + d + items.length) % items.length), [items.length, setIndex]);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft') step(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close, step]);

  return createPortal(
    <div className="lightbox" onMouseDown={(e) => e.target === e.currentTarget && close()} role="dialog" aria-modal="true" aria-label={m.title}>
      <button className="ctl-btn absolute right-5 top-5" onClick={close} aria-label="Close">
        ✕
      </button>
      <button className="ctl-btn absolute left-3 top-1/2 -translate-y-1/2 md:left-8" onClick={() => step(-1)} aria-label="Previous">
        ←
      </button>
      <button className="ctl-btn absolute right-3 top-1/2 -translate-y-1/2 md:right-8" onClick={() => step(1)} aria-label="Next">
        →
      </button>
      <figure key={m.id} className="w-full max-w-[1000px] animate-fade-in">
        <div className="card group relative aspect-[16/10] overflow-hidden">
          <Tile m={m} i={index} fit="contain" />
        </div>
        <figcaption className="mt-4 flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <div className="display text-xl font-bold">{m.title}</div>
            {m.caption && (
              <div className="text-sm" style={{ color: 'var(--muted)' }}>
                {m.caption}
              </div>
            )}
          </div>
          <div className="mono text-[10px] tracking-[0.2em]" style={{ color: 'var(--muted)' }}>
            {m.category.toUpperCase()} · {fmtDate(m.taken_on)} · {index + 1}/{items.length}
          </div>
        </figcaption>
      </figure>
    </div>,
    document.body,
  );
}
