import { useEffect, useMemo, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import { animate } from 'animejs';
import { gsap } from '../lib/gsap';
import { useTable } from '../lib/useData';
import { insert, ideaStats, trackIdea, voteIdea, newTrackingCode, onChange } from '../lib/db';
import { validate, required, min, max, email as isEmail } from '../lib/validate';
import { useCounter } from '../hooks/useCounter';
import { PageTop, Field, Input, TextArea, Select, Check, Chips, StatusBadge, Empty, Skeleton, ErrorNote, timeAgo } from '../components/ui/kit';

export const IDEA_CATEGORIES = ['Robotics', 'AI / ML', 'IoT', 'Aerial', 'Club activity', 'Lab & equipment', 'Other'];
const EMPTY_FORM = { title: '', description: '', category: 'Robotics', author_name: '', author_email: '', is_anonymous: false };

// tiny per-browser memory: which ideas I sent, which I voted for
const read = (k, d) => {
  try {
    return JSON.parse(localStorage.getItem(k) || 'null') ?? d;
  } catch {
    return d;
  }
};
const write = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* ignore */
  }
};
function voterKey() {
  let k = read('air-voter', null);
  if (!k) {
    k = `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    write('air-voter', k);
  }
  return k;
}

/** /ideas — the Idea Box: submit (optionally anonymous), track approval, upvote approved ideas. */
export default function Ideas() {
  return (
    <>
      <PageTop
        crumbs={['Idea Box']}
        eyebrow="Idea Box"
        title="Got an idea? Drop it in."
        intro="Projects, events, things the lab should buy — anything. Post with your name or anonymously. The committee reviews every idea, and you can track yours with its code."
      />
      <Stats />
      <section className="section tight-top">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr]">
          <SubmitForm />
          <div className="flex flex-col gap-8">
            <Tracker />
            <MySubmissions />
          </div>
        </div>
      </section>
      <Board />
    </>
  );
}

/* ---------------- stats strip ---------------- */
function Stats() {
  const [s, setS] = useState(null);
  useEffect(() => {
    const load = () => ideaStats().then(setS).catch(() => {});
    load();
    return onChange((t) => t === 'ideas' && load());
  }, []);
  const items = [
    ['Ideas submitted', s?.total],
    ['Waiting for review', s?.pending],
    ['Approved', s?.approved],
    ['Built for real', s?.implemented],
  ];
  return (
    <section className="section tight-top flush-bottom">
      <div className="grid grid-cols-2 gap-6 border-y py-8 lg:grid-cols-4" style={{ borderColor: 'var(--line)' }}>
        {items.map(([l, v]) => (
          <Stat key={l} label={l} value={v} />
        ))}
      </div>
    </section>
  );
}
function Stat({ label, value }) {
  const ref = useRef(null);
  useCounter(ref, value ?? 0, { suffix: '' });
  return (
    <div>
      <div ref={ref} className="display text-4xl font-bold">
        0
      </div>
      <div className="mono mt-1 text-[10px] uppercase tracking-[0.22em]" style={{ color: 'var(--muted)' }}>
        {label}
      </div>
    </div>
  );
}

/* ---------------- submit ---------------- */
function SubmitForm() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const [code, setCode] = useState('');
  const box = useRef(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const rules = {
      title: [required('Give it a short title'), min(3), max(140)],
      description: [required('Tell us a bit more'), min(10), max(4000)],
      author_email: [isEmail()],
    };
    if (!form.is_anonymous) rules.author_name = [required('Add your name, or switch on "post anonymously"')];
    const errs = validate(form, rules);
    setErrors(errs);
    if (Object.keys(errs).length) {
      animate(box.current, { translateX: [0, -8, 8, -5, 5, 0], duration: 450, ease: 'linear' });
      return;
    }
    setStatus('busy');
    const tracking_code = newTrackingCode();
    const row = {
      tracking_code,
      title: form.title.trim(),
      description: form.description.trim(),
      category: form.category,
      is_anonymous: form.is_anonymous,
      author_name: form.is_anonymous ? '' : form.author_name.trim(),
      author_email: form.is_anonymous ? '' : form.author_email.trim(),
      status: 'pending',
      upvotes: 0,
    };
    try {
      await insert('ideas', row, { returning: false });
      write('air-my-ideas', [tracking_code, ...read('air-my-ideas', [])].slice(0, 20));
      window.dispatchEvent(new Event('air-my-ideas'));
      setCode(tracking_code);
      setStatus('done');
      setForm(EMPTY_FORM);
    } catch (err) {
      setStatus('error');
      setMessage(err.message);
    }
  };

  if (status === 'done') {
    return (
      <div className="glass flex flex-col items-start p-6 md:p-8 animate-slide-up">
        <svg className="h-12 w-12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="10" stroke="var(--ok)" strokeWidth="1.5" />
          <path d="M7 12.5l3.2 3.2L17 9" stroke="var(--ok)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div className="display mt-4 text-2xl font-bold">Idea received.</div>
        <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
          Keep this code to check its status any time. It's also saved under "Your submissions" on this device.
        </p>
        <div className="mt-5 flex items-center gap-3">
          <span className="display rounded-xl border px-4 py-2 text-2xl font-bold tracking-widest animate-glow" style={{ borderColor: 'var(--blue)' }}>
            {code}
          </span>
          <button className="ctl-btn small" onClick={() => navigator.clipboard?.writeText(code)}>
            Copy
          </button>
        </div>
        <button className="ctl-btn mt-6" onClick={() => setStatus('idle')}>
          Submit another idea
        </button>
      </div>
    );
  }

  return (
    <form ref={box} onSubmit={submit} noValidate className="glass flex flex-col gap-4 p-6 md:p-8">
      <div className="display text-2xl font-bold">Submit an idea</div>
      <Field label="Title" error={errors.title}>
        <Input value={form.title} onChange={set('title')} error={errors.title} placeholder="e.g. A robot that waters the campus plants" maxLength={140} />
      </Field>
      <Field label="Describe it" error={errors.description} hint={`${form.description.length}/4000`}>
        <TextArea value={form.description} onChange={set('description')} error={errors.description} rows={5} placeholder="What is it, who is it for, what would we need?" />
      </Field>
      <Field label="Area">
        <Select value={form.category} onChange={set('category')} options={IDEA_CATEGORIES} />
      </Field>
      <div className="rounded-xl border p-4" style={{ borderColor: 'var(--line)' }}>
        <Check label="Post anonymously" checked={form.is_anonymous} onChange={(v) => setForm((f) => ({ ...f, is_anonymous: v }))} />
        <p className="mt-2 text-xs" style={{ color: 'var(--muted)' }}>
          {form.is_anonymous ? 'Your name and email are not saved anywhere — only the idea itself.' : 'Your name shows next to the idea if it is approved. Email is only seen by the committee.'}
        </p>
        {!form.is_anonymous && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 animate-fade-in">
            <Field label="Your name" error={errors.author_name}>
              <Input value={form.author_name} onChange={set('author_name')} error={errors.author_name} />
            </Field>
            <Field label="Email (optional)" error={errors.author_email}>
              <Input type="email" value={form.author_email} onChange={set('author_email')} error={errors.author_email} />
            </Field>
          </div>
        )}
      </div>
      {status === 'error' && <ErrorNote>{message}</ErrorNote>}
      <div>
        <button className="ctl-btn primary" disabled={status === 'busy'} style={{ padding: '0.8rem 1.4rem' }}>
          {status === 'busy' ? 'Sending…' : 'Drop it in the box →'}
        </button>
      </div>
    </form>
  );
}

/* ---------------- approval tracking ---------------- */
const STEPS = ['pending', 'under_review', 'approved', 'implemented'];
const STEP_LABEL = { pending: 'Submitted', under_review: 'In review', approved: 'Approved', implemented: 'Built' };

function Steps({ status }) {
  const rejected = status === 'rejected';
  const at = rejected ? 1 : STEPS.indexOf(status);
  return (
    <div className="mt-4 flex items-center">
      {STEPS.map((s, i) => {
        const done = i <= at;
        const isRejectStep = rejected && i === 2;
        return (
          <div key={s} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <span
                className="flex h-6 w-6 items-center justify-center rounded-full border text-[10px]"
                style={{
                  borderColor: isRejectStep ? 'var(--bad)' : done ? 'var(--blue)' : 'var(--line)',
                  background: isRejectStep ? 'rgba(255,107,107,.15)' : done ? 'var(--blue)' : 'transparent',
                  color: '#fff',
                }}
              >
                {isRejectStep ? '✕' : done ? '✓' : ''}
              </span>
              <span className="mono text-[9px] tracking-[0.12em]" style={{ color: isRejectStep ? 'var(--bad)' : done ? 'var(--fg)' : 'var(--muted)' }}>
                {isRejectStep ? 'NOT NOW' : STEP_LABEL[s].toUpperCase()}
              </span>
            </div>
            {i < STEPS.length - 1 && <span className="mx-1 mb-4 h-px flex-1" style={{ background: i < at ? 'var(--blue)' : 'var(--line)' }} />}
          </div>
        );
      })}
    </div>
  );
}

function Tracker() {
  const [code, setCode] = useState('');
  const [res, setRes] = useState(null);
  const [state, setState] = useState('idle');
  const look = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    setState('busy');
    try {
      const r = await trackIdea(code);
      setRes(r);
      setState(r ? 'found' : 'missing');
    } catch {
      setState('missing');
    }
  };
  return (
    <div className="glass p-6">
      <div className="display text-xl font-bold">Track your idea</div>
      <form onSubmit={look} className="mt-4 flex gap-2">
        <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="AIR-XXXX" aria-label="Tracking code" className="mono tracking-widest" />
        <button className="ctl-btn primary" disabled={state === 'busy'}>
          Check
        </button>
      </form>
      {state === 'missing' && (
        <p className="mt-3 text-sm" style={{ color: 'var(--bad)' }}>
          No idea found with that code.
        </p>
      )}
      {state === 'found' && res && (
        <div className="mt-5 animate-slide-up">
          <div className="flex items-start justify-between gap-3">
            <div className="display font-bold">{res.title}</div>
            <StatusBadge status={res.status} />
          </div>
          <Steps status={res.status} />
          {res.review_note && (
            <p className="mt-4 rounded-lg p-3 text-sm" style={{ background: 'rgba(45,123,255,.08)', color: 'var(--muted)' }}>
              <span className="mono text-[10px] tracking-[0.18em]" style={{ color: 'var(--blue-glow)' }}>
                COMMITTEE NOTE ·{' '}
              </span>
              {res.review_note}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function MySubmissions() {
  const [codes, setCodes] = useState(() => read('air-my-ideas', []));
  const [items, setItems] = useState([]);
  useEffect(() => {
    const refresh = () => setCodes(read('air-my-ideas', []));
    window.addEventListener('air-my-ideas', refresh);
    return () => window.removeEventListener('air-my-ideas', refresh);
  }, []);
  useEffect(() => {
    let alive = true;
    const load = () => Promise.all(codes.map((c) => trackIdea(c).then((r) => r && { ...r, code: c }).catch(() => null))).then((r) => alive && setItems(r.filter(Boolean)));
    load();
    const off = onChange((t) => t === 'ideas' && load());
    return () => {
      alive = false;
      off();
    };
  }, [codes]);
  if (!codes.length) return null;
  return (
    <div className="glass p-6">
      <div className="display text-xl font-bold">Your submissions</div>
      <div className="mt-4 flex flex-col divide-y" style={{ borderColor: 'var(--line)' }}>
        {items.map((r) => (
          <div key={r.code} className="flex items-center justify-between gap-3 py-3" style={{ borderColor: 'var(--line)' }}>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{r.title}</div>
              <div className="mono text-[10px] tracking-[0.15em]" style={{ color: 'var(--muted)' }}>
                {r.code} · {timeAgo(r.created_at)}
              </div>
            </div>
            <StatusBadge status={r.status} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- public board with upvotes ---------------- */
function Board() {
  const { rows, loading } = useTable('ideas', { order: ['upvotes', false], inValues: ['status', ['approved', 'implemented']] });
  const [sort, setSort] = useState('top');
  const [cat, setCat] = useState('all');
  const [voted, setVoted] = useState(() => read('air-voted', []));
  const root = useRef(null);

  const shown = useMemo(() => {
    const r = rows.filter((i) => cat === 'all' || i.category === cat);
    return sort === 'top' ? r : [...r].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  }, [rows, sort, cat]);

  useGSAP(
    () => {
      if (!shown.length) return;
      gsap.from('.idea-card', { y: 30, opacity: 0, stagger: 0.06, duration: 0.6, ease: 'power3.out', scrollTrigger: { trigger: root.current, start: 'top 85%', once: true } });
    },
    { scope: root, dependencies: [shown.length > 0] },
  );

  const vote = async (idea, btn) => {
    if (voted.includes(idea.id)) return;
    const next = [...voted, idea.id];
    setVoted(next);
    write('air-voted', next);
    animate(btn, { scale: [1, 1.25, 1], duration: 450, ease: 'outBack' });
    try {
      await voteIdea(idea.id, voterKey());
    } catch {
      /* already voted from this browser — keep it marked */
    }
  };

  return (
    <section ref={root} className="section flush-top">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mono mb-2 text-xs uppercase tracking-[0.22em]" style={{ color: 'var(--blue-glow)' }}>
            The board
          </div>
          <h2 className="display text-[clamp(1.8rem,4vw,3rem)] font-bold leading-tight">Approved ideas — vote for the next build.</h2>
        </div>
        <Chips value={sort} onChange={setSort} options={[['top', 'Most votes'], ['new', 'Newest']]} />
      </div>
      <div className="mb-6">
        <Chips value={cat} onChange={setCat} options={[['all', 'All areas'], ...IDEA_CATEGORIES.map((c) => [c, c])]} />
      </div>
      {loading ? (
        <Skeleton rows={3} height={90} />
      ) : !shown.length ? (
        <Empty title="No approved ideas in this area yet" text="Be the first — submit one above." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {shown.map((i) => {
            const has = voted.includes(i.id);
            return (
              <article key={i.id} className="idea-card card card-glow flex gap-4 p-5">
                <button
                  onClick={(e) => vote(i, e.currentTarget)}
                  disabled={has}
                  className="flex h-16 w-14 shrink-0 flex-col items-center justify-center rounded-xl border transition-colors"
                  style={{ borderColor: has ? 'var(--blue)' : 'var(--line)', background: has ? 'rgba(45,123,255,.18)' : 'transparent' }}
                  aria-label={has ? 'You voted for this' : `Upvote ${i.title}`}
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M12 5l7 8h-4.5v6h-5v-6H5z" stroke="var(--blue-glow)" strokeWidth="1.6" strokeLinejoin="round" fill={has ? 'var(--blue-glow)' : 'none'} />
                  </svg>
                  <span className="display mt-1 font-bold">{i.upvotes || 0}</span>
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={i.status} label={i.status === 'implemented' ? 'built' : 'approved'} />
                    <span className="chip">{i.category}</span>
                  </div>
                  <h3 className="display mt-2 text-lg font-bold">{i.title}</h3>
                  <p className="mt-1 line-clamp-3 text-sm" style={{ color: 'var(--muted)' }}>
                    {i.description}
                  </p>
                  <div className="mono mt-3 text-[10px] tracking-[0.15em]" style={{ color: 'var(--muted)' }}>
                    {i.is_anonymous ? 'ANONYMOUS' : (i.author_name || 'MEMBER').toUpperCase()} · {timeAgo(i.created_at).toUpperCase()}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
