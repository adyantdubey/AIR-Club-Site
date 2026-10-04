import { useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap } from '../../lib/gsap';
import { TLink } from '../../transitions/PageWipe';
import SectionHeading from '../ui/SectionHeading';
import { useContent } from '../../lib/content';

/** Frequently asked questions — one opens at a time, the answer slides down. */
export default function Faq({ contactLink = true }) {
  const root = useRef(null);
  const FAQ = useContent('faq'); // edited in Admin → Page content → FAQ
  const [open, setOpen] = useState(0);
  const panels = useRef([]);

  useGSAP(
    () => {
      gsap.from('.faq-row', { y: 30, opacity: 0, stagger: 0.1, duration: 0.7, ease: 'power3.out', scrollTrigger: { trigger: root.current, start: 'top 80%', once: true } });
    },
    { scope: root },
  );

  // slide the answers open / shut whenever the choice changes
  useGSAP(
    () => {
      panels.current.forEach((el, i) => {
        if (!el) return;
        gsap.to(el, { height: i === open ? 'auto' : 0, opacity: i === open ? 1 : 0, duration: 0.45, ease: 'power2.inOut' });
      });
    },
    { dependencies: [open] },
  );

  return (
    <section ref={root} className="section flush-bottom">
      <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr]">
        <div>
          <SectionHeading eyebrow="FAQ">Frequently asked questions.</SectionHeading>
          {contactLink && (
            <p className="-mt-6 text-base" style={{ color: 'var(--muted)' }}>
              If you have any more questions,{' '}
              <TLink to="/contact" style={{ color: 'var(--blue-glow)' }}>
                contact us →
              </TLink>
            </p>
          )}
        </div>
        <div className="flex flex-col">
          {FAQ.map(({ q, a }, i) => {
            const on = i === open;
            return (
              <div key={i} className="faq-row border-b" style={{ borderColor: 'var(--line)' }}>
                <button className="flex w-full items-center justify-between gap-6 py-5 text-left" onClick={() => setOpen(on ? -1 : i)} aria-expanded={on} data-cursor>
                  <span className="display text-lg font-bold md:text-xl" style={{ color: on ? 'var(--blue-glow)' : 'var(--fg)', transition: 'color .3s' }}>
                    {q}
                  </span>
                  <span className="relative h-5 w-5 shrink-0" aria-hidden="true">
                    <span className="absolute left-0 top-1/2 h-px w-5" style={{ background: 'var(--blue-glow)' }} />
                    <span className="absolute left-0 top-1/2 h-px w-5 transition-transform duration-300" style={{ background: 'var(--blue-glow)', transform: on ? 'rotate(0deg)' : 'rotate(90deg)' }} />
                  </span>
                </button>
                <div ref={(el) => (panels.current[i] = el)} className="overflow-hidden" style={{ height: i === 0 ? 'auto' : 0, opacity: i === 0 ? 1 : 0 }}>
                  <p className="max-w-2xl pb-6 text-[15px] leading-relaxed" style={{ color: 'var(--muted)' }}>
                    {a}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
