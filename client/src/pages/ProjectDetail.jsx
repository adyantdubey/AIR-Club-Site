import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { useGSAP } from '@gsap/react';
import { gsap } from '../lib/gsap';
import { list } from '../lib/db';
import { TLink } from '../transitions/PageWipe';
import Breadcrumb from '../components/ui/Breadcrumb';
import SafeImg from '../components/ui/SafeImg';
import RichText from '../components/ui/RichText';
import { StatusBadge, Progress, Skeleton, Empty } from '../components/ui/kit';

/** /projects/:slug — the full story of one project, with its photos. */
export default function ProjectDetail() {
  const { slug } = useParams();
  const [state, setState] = useState({ loading: true, p: null });
  const root = useRef(null);

  useEffect(() => {
    let alive = true;
    setState({ loading: true, p: null });
    list('projects', { order: null })
      .then((rows) => alive && setState({ loading: false, p: rows.find((r) => r.slug === slug || r.id === slug) || null }))
      .catch(() => alive && setState({ loading: false, p: null }));
    return () => {
      alive = false;
    };
  }, [slug]);

  const { loading, p } = state;

  useGSAP(
    () => {
      if (!p) return;
      gsap.from('.d-head > *', { y: 30, opacity: 0, stagger: 0.08, duration: 0.8, ease: 'power3.out' });
      const imgs = root.current.querySelectorAll('.d-img');
      if (imgs.length) gsap.from(imgs, { scale: 1.08, opacity: 0, duration: 1.1, ease: 'power3.out', stagger: 0.15 });
      gsap.from('.d-body', { y: 30, opacity: 0, duration: 0.9, delay: 0.2 });
    },
    { scope: root, dependencies: [p?.id] },
  );

  return (
    <section ref={root} className="section page-top">
      <Breadcrumb parts={['Projects', p?.title || slug]} />
      {loading ? (
        <div className="mt-10">
          <Skeleton rows={4} height={60} />
        </div>
      ) : !p ? (
        <div className="mt-10">
          <Empty title="Project not found">
            <TLink to="/projects" className="ctl-btn">
              ← All projects
            </TLink>
          </Empty>
        </div>
      ) : (
        <>
          <div className="d-head mt-10 max-w-4xl">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={p.status} />
              {p.category && <span className="chip">{p.category}</span>}
            </div>
            <h1 className="display mt-4 text-[clamp(2.2rem,6vw,4.6rem)] font-bold leading-[1.05]">{p.title}</h1>
            <p className="mt-4 max-w-2xl text-lg" style={{ color: 'var(--muted)' }}>
              {p.summary}
            </p>
          </div>

          <div className="mt-10 grid gap-10 lg:grid-cols-[1.5fr_1fr]">
            <div className="d-body min-w-0">
              {p.image_url && (
                <div className="card relative mb-8 aspect-[16/9] overflow-hidden">
                  <SafeImg src={p.image_url} alt={p.title} className="d-img h-full w-full object-cover" fallback={<div className="h-full w-full" style={{ background: 'linear-gradient(160deg, hsl(215 55% 20%), #050810)' }} />} />
                </div>
              )}
              <RichText text={p.body || p.description || p.summary} />
            </div>

            <aside className="flex flex-col gap-5 lg:sticky lg:top-28 lg:self-start">
              {p.image2_url && (
                <div className="card relative aspect-[4/3] overflow-hidden">
                  <SafeImg src={p.image2_url} alt={`${p.title} — second photo`} className="d-img h-full w-full object-cover" fallback={<div className="h-full w-full" style={{ background: 'linear-gradient(160deg, hsl(225 55% 18%), #050810)' }} />} />
                </div>
              )}
              <div className="glass flex flex-col gap-4 p-5">
                {p.progress != null && p.progress !== '' && (
                  <div>
                    <div className="lbl">Progress</div>
                    <Progress value={p.progress} />
                  </div>
                )}
                {!!p.tech?.length && (
                  <div>
                    <div className="lbl">Built with</div>
                    <div className="flex flex-wrap gap-2">
                      {p.tech.map((t) => (
                        <span key={t} className="chip">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {(p.repo_url || p.demo_url) && (
                  <div className="flex flex-wrap gap-2">
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
                )}
              </div>
              <TLink to="/projects" className="ctl-btn self-start">
                ← All projects
              </TLink>
            </aside>
          </div>
        </>
      )}
    </section>
  );
}
