/**
 * Small building blocks shared by the new public pages and the admin area.
 * Theme tokens only (see styles/tokens.css) — no hard-coded colours.
 */
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Breadcrumb from './Breadcrumb';
import SectionHeading from './SectionHeading';

/* ---------------- public page header ---------------- */
export function PageTop({ crumbs, eyebrow, title, intro, children }) {
  return (
    <section className="section page-top flush-bottom">
      <Breadcrumb parts={crumbs} />
      <div className="mt-10">
        <SectionHeading eyebrow={eyebrow}>{title}</SectionHeading>
      </div>
      {intro && (
        <p className="-mt-6 max-w-[620px] text-base leading-relaxed" style={{ color: 'var(--muted)' }}>
          {intro}
        </p>
      )}
      {children}
    </section>
  );
}

/* ---------------- status badge ---------------- */
const TONE = {
  // projects
  idea: 'muted',
  planning: 'muted',
  in_progress: 'live',
  testing: 'warn',
  completed: 'ok',
  on_hold: 'bad',
  // ideas
  pending: 'warn',
  under_review: 'live',
  approved: 'ok',
  rejected: 'bad',
  implemented: 'ok',
  // misc
  new: 'live',
  read: 'muted',
  open: 'ok',
  closed: 'muted',
  upcoming: 'live',
  past: 'muted',
};
export const statusLabel = (s = '') => s.replace(/_/g, ' ');
export function StatusBadge({ status, label }) {
  return (
    <span className="badge" data-tone={TONE[status] || ''}>
      {label || statusLabel(status)}
    </span>
  );
}

/* ---------------- priority indicator: 4 bars ---------------- */
const PRIO = { urgent: [4, 'var(--bad)'], high: [3, 'var(--warn)'], normal: [2, 'var(--blue-glow)'], low: [1, 'var(--muted)'] };
export function Priority({ level = 'normal', showLabel = true }) {
  const [n, color] = PRIO[level] || PRIO.normal;
  return (
    <span className="prio" style={{ color }} title={`${level} priority`}>
      <span className="flex items-end gap-[2px]" aria-hidden="true">
        {[1, 2, 3, 4].map((i) => (
          <i key={i} className={i <= n ? 'on' : ''} style={{ height: 4 + i * 3 }} />
        ))}
      </span>
      {showLabel && level}
    </span>
  );
}

/* ---------------- progress ---------------- */
export function Progress({ value = 0, showValue = true }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className="flex items-center gap-3">
      <div className="progress flex-1">
        <span style={{ width: `${v}%` }} />
      </div>
      {showValue && (
        <span className="mono w-9 text-right text-[11px]" style={{ color: 'var(--blue-glow)' }}>
          {v}%
        </span>
      )}
    </div>
  );
}

/* ---------------- form fields ---------------- */
export function Field({ label, error, hint, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      {label && <span className="lbl">{label}</span>}
      {children}
      {error ? <div className="err-text">{error}</div> : hint ? <div className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>{hint}</div> : null}
    </label>
  );
}
export function Input({ error, className = '', ...rest }) {
  return <input className={`inp ${error ? 'err' : ''} ${className}`} aria-invalid={!!error} {...rest} />;
}
export function TextArea({ error, className = '', ...rest }) {
  return <textarea className={`inp ${error ? 'err' : ''} ${className}`} aria-invalid={!!error} {...rest} />;
}
export function Select({ error, options, className = '', ...rest }) {
  return (
    <select className={`inp ${error ? 'err' : ''} ${className}`} aria-invalid={!!error} {...rest}>
      {options.map((o) => {
        const [v, l] = Array.isArray(o) ? o : [o, o];
        return (
          <option key={v} value={v}>
            {l}
          </option>
        );
      })}
    </select>
  );
}
export function Check({ label, checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 text-sm">
      <span
        className="relative h-5 w-9 shrink-0 rounded-full transition-colors"
        style={{ background: checked ? 'var(--blue)' : 'rgba(110,178,255,.18)' }}
      >
        <span className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform" style={{ left: 2, transform: checked ? 'translateX(16px)' : 'none' }} />
      </span>
      <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

/* ---------------- search box ---------------- */
export function SearchBox({ value, onChange, placeholder = 'Search…', className = '' }) {
  return (
    <div className={`relative ${className}`}>
      <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M11 4a7 7 0 1 0 0 14a7 7 0 1 0 0-14M20 20l-3.5-3.5" stroke="var(--muted)" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <input className="inp" style={{ paddingLeft: '2.25rem' }} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
    </div>
  );
}

/* ---------------- filter chips ---------------- */
export function Chips({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const [k, l, count] = Array.isArray(o) ? o : [o, o];
        const on = value === k;
        return (
          <button
            key={k}
            type="button"
            onClick={() => onChange(k)}
            className="chip transition-colors"
            style={on ? { background: 'var(--blue)', color: '#fff', borderColor: 'var(--blue)' } : undefined}
          >
            {l}
            {count != null && <span className="ml-1.5 opacity-70">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------- modal ---------------- */
export function Modal({ open, onClose, title, children, wide = false }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()} data-lenis-prevent>
      <div className={`modal glass p-6 md:p-8 ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} style={{ background: 'rgba(8,12,24,.96)' }}>
        <div className="mb-6 flex items-start justify-between gap-4">
          <h3 className="display text-2xl font-bold">{title}</h3>
          <button onClick={onClose} className="ctl-btn small" aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

/* ---------------- empty / loading / error ---------------- */
export function Empty({ title = 'Nothing here yet', text, children }) {
  return (
    <div className="glass flex flex-col items-center justify-center px-6 py-14 text-center">
      <svg className="h-10 w-10" viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <polygon points="32,4 56,18 56,46 32,60 8,46 8,18" stroke="var(--blue)" strokeWidth="2" />
      </svg>
      <div className="display mt-4 text-lg font-bold">{title}</div>
      {text && <p className="mt-1 max-w-sm text-sm" style={{ color: 'var(--muted)' }}>{text}</p>}
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}
export function Skeleton({ rows = 4, height = 44 }) {
  return (
    <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height }} />
      ))}
    </div>
  );
}
export function ErrorNote({ children }) {
  if (!children) return null;
  return (
    <div className="rounded-xl border px-4 py-3 text-sm" style={{ borderColor: 'var(--bad)', color: 'var(--bad)', background: 'rgba(255,107,107,.06)' }} role="alert">
      {children}
    </div>
  );
}

/* ---------------- two-click delete ---------------- */
export function ConfirmButton({ onConfirm, children = 'Delete', confirmText = 'Sure?', disabled }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 2500);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      type="button"
      disabled={disabled}
      className="ctl-btn small"
      style={armed ? { borderColor: 'var(--bad)', color: 'var(--bad)' } : undefined}
      onClick={(e) => {
        e.stopPropagation();
        if (armed) {
          setArmed(false);
          onConfirm();
        } else setArmed(true);
      }}
    >
      {armed ? confirmText : children}
    </button>
  );
}

/* ---------------- dates ---------------- */
export const fmtDate = (d, opts = { day: 'numeric', month: 'short', year: 'numeric' }) => (d ? new Date(d).toLocaleDateString('en-IN', opts) : '—');
export const fmtTime = (d) => (d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '');
export function timeAgo(d) {
  if (!d) return '';
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)} d ago`;
  return fmtDate(d);
}
/** "2026-10-04T17:00" style value for <input type="datetime-local"> */
export function toLocalInput(d) {
  if (!d) return '';
  const x = new Date(d);
  const pad = (n) => String(n).padStart(2, '0');
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(x.getMinutes())}`;
}
