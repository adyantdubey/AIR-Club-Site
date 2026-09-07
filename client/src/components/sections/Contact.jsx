import { useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import { animate } from 'animejs';
import { gsap, ScrollTrigger } from '../../lib/gsap';
import { roverStore } from '../../lib/roverStore';
import SectionHeading from '../ui/SectionHeading';
import Button from '../ui/Button';
import { submitForm } from '../../lib/forms';

const EMPTY = { name: '', email: '', branch: '', message: '', team: '' };
const TEAMS = ['Rover', 'Robotic arm', 'Drones & UAV', 'Hexabot', 'AI Lab', 'Web & outreach'];

export default function Contact({ showTeams = false }) {
  const root = useRef(null);
  const btnWrap = useRef(null);
  const [form, setForm] = useState(EMPTY);
  const [status, setStatus] = useState('idle'); // idle | sending | done | error
  const [error, setError] = useState('');

  // C1 — rover drives in from the right when the section appears
  useGSAP(
    () => {
      ScrollTrigger.create({
        trigger: root.current,
        start: 'top 65%',
        onEnter: () => gsap.to(roverStore, { contact: 1, duration: 2.4, ease: 'power2.out', overwrite: true }),
        onLeaveBack: () => gsap.to(roverStore, { contact: 0, duration: 0.8, ease: 'power2.in', overwrite: true }),
      });
      gsap.from('.c-field', {
        y: 30,
        opacity: 0,
        stagger: 0.1,
        duration: 0.8,
        scrollTrigger: { trigger: '.c-form', start: 'top 80%', once: true },
      });
    },
    { scope: root },
  );

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // C3 — button morphs into a loading ring, then a tick; rover antenna blinks on success
  const submit = async (e) => {
    e.preventDefault();
    if (status === 'sending' || status === 'done') return;
    setError('');
    setStatus('sending');
    const btn = btnWrap.current.querySelector('.btn');
    animate(btn, { width: 52, height: 52, paddingLeft: 0, paddingRight: 0, duration: 450, ease: 'inOutQuad' });

    try {
      await submitForm('join', form);
      await new Promise((r) => setTimeout(r, 500));
      setStatus('done');
      roverStore.antennaBlink = 1;
      setForm(EMPTY);
    } catch (err) {
      setStatus('error');
      setError(err.message);
      animate(btn, { width: 'auto', height: 'auto', paddingLeft: 27, paddingRight: 27, duration: 400, ease: 'outQuad' });
      animate(btnWrap.current, { translateX: [0, -8, 8, -6, 6, 0], duration: 500, ease: 'linear' });
    }
  };

  return (
    <section id="contact" ref={root} className="section">
      <div className="grid gap-14 lg:grid-cols-2">
        <div>
          <SectionHeading eyebrow="05 — Get in touch">Join the club. Build the rover.</SectionHeading>
          <p className="max-w-[440px] text-base leading-relaxed" style={{ color: 'var(--muted)' }}>
            Open to every branch and every year. No experience needed — bring curiosity, we bring the
            soldering irons. Fill in the form and a lead will get back within two days.
          </p>
          <div className="mono mt-10 flex flex-col gap-3 text-xs tracking-[0.15em]" style={{ color: 'var(--muted)' }}>
            <div>ROBOTICS LAB · NIT ANDHRA PRADESH · TADEPALLIGUDEM</div>
            <a href="mailto:airclub@nitandhra.ac.in" className="hover:text-white" style={{ color: 'var(--blue-glow)' }}>
              AIRCLUB@NITANDHRA.AC.IN
            </a>
          </div>
        </div>

        <form className="c-form flex flex-col gap-2" onSubmit={submit} noValidate>
          <Field label="Your name" value={form.name} onChange={set('name')} required />
          <Field label="College email" type="email" value={form.email} onChange={set('email')} required />
          <Field label="Branch & year (e.g. ECE, 2nd year)" value={form.branch} onChange={set('branch')} />
          {showTeams && (
            <div className="c-field mt-4">
              <div className="mono mb-2 text-[10px] tracking-[0.2em]" style={{ color: 'var(--muted)' }}>
                WHICH TEAM?
              </div>
              <div className="flex flex-wrap gap-2">
                {TEAMS.map((t) => (
                  <button
                    type="button"
                    key={t}
                    onClick={() => setForm((f) => ({ ...f, team: f.team === t ? '' : t }))}
                    className="chip transition-colors"
                    style={form.team === t ? { background: 'var(--blue)', color: '#fff', borderColor: 'var(--blue)' } : undefined}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}
          <Field label="What do you want to build?" value={form.message} onChange={set('message')} textarea />

          <div ref={btnWrap} className="mt-6 flex items-center gap-4">
            <Button solid type="submit" className="justify-center overflow-hidden whitespace-nowrap" aria-live="polite" disabled={status === 'sending' || status === 'done'}>
              {status === 'idle' || status === 'error' ? (
                <>Send it <span aria-hidden="true">→</span></>
              ) : status === 'sending' ? (
                <span className="block h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-label="Sending" />
              ) : (
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-label="Sent">
                  <path d="M5 12l5 5 9-10" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </Button>
            {status === 'done' && (
              <span className="mono text-xs tracking-[0.15em]" style={{ color: 'var(--blue-glow)' }}>RECEIVED — SEE YOU IN THE LAB</span>
            )}
            {status === 'error' && (
              <span className="mono text-xs tracking-[0.1em]" style={{ color: '#ff6b6b' }}>{error}</span>
            )}
          </div>
        </form>
      </div>
    </section>
  );
}

// C2 — bottom line draws blue on focus; label floats up
function Field({ label, value, onChange, type = 'text', textarea = false, required = false }) {
  const line = useRef(null);
  const [focus, setFocus] = useState(false);
  const active = focus || value.length > 0;

  const onFocus = () => {
    setFocus(true);
    animate(line.current, { scaleX: [0, 1], duration: 500, ease: 'outExpo' });
  };
  const onBlur = () => {
    setFocus(false);
    animate(line.current, { scaleX: 0, duration: 300, ease: 'inQuad' });
  };

  const Tag = textarea ? 'textarea' : 'input';
  return (
    <div className={`c-field field ${active ? 'active' : ''}`}>
      <label>{label}{required ? ' *' : ''}</label>
      <Tag type={type} value={value} onChange={onChange} onFocus={onFocus} onBlur={onBlur} rows={textarea ? 3 : undefined} required={required} />
      <span ref={line} className="line" />
    </div>
  );
}
