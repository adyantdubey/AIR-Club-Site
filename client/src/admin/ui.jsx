/**
 * Shared pieces for admin pages.
 *
 *  <AdminPage title="Projects" subtitle="…" actions={<button…/>}> … </AdminPage>
 *  <FormModal fields={[…]} initial={row} onSave={(values) => …} />
 *
 * FormModal builds a whole form from a list of fields, checks it, and shows errors —
 * so each admin page only has to describe WHAT to edit.
 */
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useAuth } from '../lib/auth';
import { canEdit } from '../lib/roles';
import { uploadFile } from '../lib/db';
import { validate } from '../lib/validate';
import { Modal, Field, Input, TextArea, Select, Check, ErrorNote, toLocalInput } from '../components/ui/kit';

export function AdminPage({ title, subtitle, actions, children }) {
  return (
    <div className="mx-auto w-full max-w-[1200px] animate-fade-in">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-3xl font-bold md:text-4xl">{title}</h1>
          {subtitle && (
            <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
              {subtitle}
            </p>
          )}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

/** true if the logged-in role may change this area; also gives a small "view only" note. */
export function useCanEdit(area) {
  const { role } = useAuth();
  return canEdit(role, area);
}
/** Opens the "new" form when the page is opened as /admin/xyz?new=1 (Dashboard quick actions). */
export function useOpenNew(can, open) {
  const [params, setParams] = useSearchParams();
  useEffect(() => {
    if (params.get('new') && can) {
      open();
      setParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [can]);
}

export function ViewOnly({ area }) {
  const ok = useCanEdit(area);
  if (ok) return null;
  return (
    <div className="mb-6 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm" style={{ borderColor: 'var(--line)', color: 'var(--muted)' }}>
      <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="var(--blue-glow)" strokeWidth="1.8" aria-hidden="true">
        <path d="M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5z" />
      </svg>
      View only — your role can see this page but not change it.
    </div>
  );
}

export function StatCard({ label, value, hint, icon, tone }) {
  return (
    <div className="glass relative overflow-hidden p-5 animate-slide-up">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="mono text-[10px] uppercase tracking-[0.2em]" style={{ color: 'var(--muted)' }}>
            {label}
          </div>
          <div className="display mt-2 text-3xl font-bold" style={tone ? { color: `var(--${tone})` } : undefined}>
            {value}
          </div>
          {hint && (
            <div className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
              {hint}
            </div>
          )}
        </div>
        {icon && (
          <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'rgba(45,123,255,.12)' }}>
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="var(--blue-glow)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d={icon} />
            </svg>
          </span>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ FormModal
 field = {
   key, label, type: 'text'|'textarea'|'number'|'select'|'date'|'datetime'|'checkbox'|'tags'|'image'|'range',
   options (select), rules (validate.js checks), hint, span: 2 (full width), section: 'Basic info',
   placeholder, min, max
 }
*/
export function FormModal({ open, onClose, title, fields, initial, onSave, wide = true, readOnly = false }) {
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!open) return;
    const v = {};
    for (const f of fields) {
      let x = initial?.[f.key];
      if (x === undefined || x === null) x = f.default ?? (f.type === 'checkbox' ? false : f.type === 'tags' ? [] : '');
      if (f.type === 'datetime') x = toLocalInput(x);
      if (f.type === 'date' && x) x = String(x).slice(0, 10);
      if (f.type === 'tags') x = Array.isArray(x) ? x.join(', ') : x;
      v[f.key] = x;
    }
    setValues(v);
    setErrors({});
    setErr('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial]);

  const set = (k, val) => setValues((s) => ({ ...s, [k]: val }));

  const submit = async (e) => {
    e.preventDefault();
    if (readOnly) return;
    const rules = Object.fromEntries(fields.filter((f) => f.rules).map((f) => [f.key, f.rules]));
    const errs = validate(values, rules);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    // turn form strings back into proper values
    const out = {};
    for (const f of fields) {
      let x = values[f.key];
      if (f.type === 'number' || f.type === 'range') x = x === '' ? null : Number(x);
      if (f.type === 'datetime') x = x ? new Date(x).toISOString() : null;
      if (f.type === 'date') x = x || null;
      if (f.type === 'tags') x = String(x || '').split(',').map((t) => t.trim()).filter(Boolean);
      if (typeof x === 'string') x = x.trim();
      out[f.key] = x;
    }
    setBusy(true);
    setErr('');
    try {
      await onSave(out);
      onClose();
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  };

  // group fields by section, keeping order
  const sections = [];
  for (const f of fields) {
    const name = f.section || '';
    let s = sections.find((x) => x.name === name);
    if (!s) sections.push((s = { name, fields: [] }));
    s.fields.push(f);
  }

  return (
    <Modal open={open} onClose={onClose} title={title} wide={wide}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-7">
        {sections.map((s) => (
          <fieldset key={s.name} disabled={readOnly} className="flex flex-col gap-4">
            {s.name && (
              <legend className="mono mb-3 flex w-full items-center gap-3 text-[10px] uppercase tracking-[0.22em]" style={{ color: 'var(--blue-glow)' }}>
                {s.name}
                <span className="h-px flex-1" style={{ background: 'var(--line)' }} />
              </legend>
            )}
            <div className="grid gap-4 md:grid-cols-2">
              {s.fields.map((f) => (
                <div key={f.key} className={f.span === 2 || f.type === 'textarea' || f.type === 'image' ? 'md:col-span-2' : ''}>
                  <FieldInput f={f} value={values[f.key]} error={errors[f.key]} onChange={(v) => set(f.key, v)} />
                </div>
              ))}
            </div>
          </fieldset>
        ))}
        {err && <ErrorNote>{err}</ErrorNote>}
        <div className="flex justify-end gap-2 border-t pt-5" style={{ borderColor: 'var(--line)' }}>
          <button type="button" className="ctl-btn" onClick={onClose}>
            {readOnly ? 'Close' : 'Cancel'}
          </button>
          {!readOnly && (
            <button className="ctl-btn primary" disabled={busy}>
              {busy ? 'Saving…' : 'Save'}
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}

function FieldInput({ f, value, error, onChange }) {
  const common = { error, placeholder: f.placeholder };
  if (f.type === 'checkbox') {
    return (
      <div className="pt-6">
        <Check label={f.label} checked={!!value} onChange={onChange} />
        {f.hint && <div className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>{f.hint}</div>}
      </div>
    );
  }
  if (f.type === 'image') return <ImageField f={f} value={value} onChange={onChange} error={error} />;
  let input;
  switch (f.type) {
    case 'textarea':
      input = <TextArea {...common} rows={f.rows || 4} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />;
      break;
    case 'select':
      input = <Select {...common} options={f.options} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />;
      break;
    case 'range':
      input = (
        <div className="flex items-center gap-3 pt-2">
          <input type="range" className="ctl-range flex-1" min={f.min ?? 0} max={f.max ?? 100} value={value || 0} onChange={(e) => onChange(e.target.value)} />
          <span className="mono w-12 text-right text-sm" style={{ color: 'var(--blue-glow)' }}>
            {value || 0}%
          </span>
        </div>
      );
      break;
    default:
      input = (
        <Input
          {...common}
          type={f.type === 'datetime' ? 'datetime-local' : f.type === 'tags' ? 'text' : f.type || 'text'}
          min={f.min}
          max={f.max}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
  return (
    <Field label={f.label} error={error} hint={f.hint || (f.type === 'tags' ? 'Separate with commas' : undefined)}>
      {input}
    </Field>
  );
}

/** URL box + upload button + preview. Upload goes to Supabase Storage (or the browser in demo mode). */
function ImageField({ f, value, onChange, error }) {
  const fileRef = useRef(null);
  const [state, setState] = useState('');
  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) return setState('That file is over 8 MB — please pick a smaller one.');
    setState('Uploading…');
    try {
      onChange(await uploadFile(file, f.folder || 'uploads'));
      setState('');
    } catch (err) {
      setState(err.message);
    }
  };
  return (
    <Field label={f.label} error={error} hint={f.hint}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex h-28 w-full shrink-0 items-center justify-center overflow-hidden rounded-xl border sm:w-40" style={{ borderColor: 'var(--line)', background: 'rgba(110,178,255,.05)' }}>
          {value ? (
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="mono text-[10px] tracking-[0.2em]" style={{ color: 'var(--muted)' }}>
              NO IMAGE
            </span>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <Input value={value?.startsWith('data:') ? '(uploaded image)' : (value ?? '')} onChange={(e) => onChange(e.target.value)} placeholder="https://… or upload" readOnly={value?.startsWith('data:')} />
          <div className="flex gap-2">
            <button type="button" className="ctl-btn small" onClick={() => fileRef.current.click()}>
              Upload image
            </button>
            {value && (
              <button type="button" className="ctl-btn small" onClick={() => onChange('')}>
                Remove
              </button>
            )}
          </div>
          {state && (
            <div className="text-xs" style={{ color: state === 'Uploading…' ? 'var(--blue-glow)' : 'var(--bad)' }}>
              {state}
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pick} />
        </div>
      </div>
    </Field>
  );
}

export const PlusIcon = () => (
  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
);
