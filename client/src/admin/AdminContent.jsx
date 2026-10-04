import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../lib/auth';
import { canEdit } from '../lib/roles';
import { saveContent, resetContent } from '../lib/db';
import { useContent } from '../lib/content';
import { DEFAULT_CONTENT } from '../data/content';
import { Chips, Field, Input, TextArea, ErrorNote, ConfirmButton } from '../components/ui/kit';
import { AdminPage, ViewOnly } from './ui';

/**
 * Admin → Page content. Every block of text on the public pages that is not a project,
 * event, person or setting lives here: home headline and numbers, About text, values,
 * club history, lab tour, weekly schedule, sponsors, FAQ, Techkriya competitions.
 *
 * To make another piece of text editable: add its default to src/data/content.js,
 * describe its fields in SECTIONS below, and read it on the page with useContent('key').
 */
const T = (key, label, extra = {}) => ({ key, label, ...extra });
const NUM_ROW = [T('v', 'Number', { type: 'number', width: 'w-28' }), T('suffix', 'After it (e.g. +)', { width: 'w-32', optional: true }), T('label', 'Label')];

const SECTIONS = [
  {
    key: 'hero',
    tab: 'home',
    title: 'Home — top of the page',
    where: 'The big headline visitors see first.',
    fields: [
      T('sub', 'Small line above the headline (types itself)'),
      T('line1', 'Headline — line 1'),
      T('line2', 'Headline — line 2'),
      T('accent', 'Headline — glowing blue word'),
      T('text', 'Paragraph under the headline', { type: 'textarea' }),
    ],
    lists: [{ key: 'stats', label: 'The three numbers under the headline', fixed: true, fields: NUM_ROW }],
  },
  { key: 'counters', tab: 'home', title: 'Home — the four counters', where: 'The row of four numbers that count up as you scroll.', list: { fixed: true, fields: NUM_ROW } },
  {
    key: 'about',
    tab: 'about',
    title: 'About text',
    where: 'About page (and the first paragraph is also the big scroll-lit text).',
    fields: [T('lead', 'Opening paragraph (large text)', { type: 'textarea', rows: 4 }), T('more', 'Second paragraph', { type: 'textarea', rows: 4 }), T('community', 'Third paragraph', { type: 'textarea', rows: 3 }), T('signoff', 'Sign-off line')],
  },
  { key: 'values', tab: 'about', title: 'Values', where: 'About page, under Mission & vision.', list: { fields: [T('title', 'Value'), T('text', 'One sentence about it', { type: 'textarea', rows: 2 })], add: 'Add a value' } },
  { key: 'history', tab: 'history', title: 'Club history timeline', where: 'About page, next to the opening paragraph. Oldest first.', list: { fields: [T('year', 'Year', { width: 'w-28' }), T('title', 'What happened'), T('text', 'One line of detail', { type: 'textarea', rows: 2 })], add: 'Add a milestone' } },
  { key: 'lab', tab: 'lab', title: 'Lab tour', where: 'About page, the 3D lab map. Five fixed spots — you can rename and re-describe them.', list: { fixed: true, fields: [T('name', 'Spot name'), T('text', 'Description', { type: 'textarea', rows: 2 })] } },
  { key: 'week', tab: 'lab', title: 'A week in the club', where: 'About page. Seven entries fit best.', list: { fields: [T('day', 'Day', { width: 'w-28' }), T('title', 'Activity'), T('text', 'Short detail')], add: 'Add a day' } },
  { key: 'sponsors', tab: 'sponsors', title: 'Partners & supporters', where: 'About page, the scrolling strip of names.', list: { fields: [T('name', 'Name')], add: 'Add a partner' } },
  { key: 'faq', tab: 'faq', title: 'Frequently asked questions', where: 'Home and Contact pages.', list: { fields: [T('q', 'Question'), T('a', 'Answer', { type: 'textarea', rows: 3 })], add: 'Add a question' } },
  { key: 'techkriya', tab: 'techkriya', title: 'Techkriya competitions', where: "The Techkriya '23 event page.", list: { fields: [T('name', 'Competition'), T('text', 'One sentence about it', { type: 'textarea', rows: 2 })], add: 'Add a competition' } },
];

const TABS = [
  ['home', 'Home'],
  ['about', 'About & values'],
  ['history', 'History'],
  ['lab', 'Lab & week'],
  ['sponsors', 'Sponsors'],
  ['faq', 'FAQ'],
  ['techkriya', 'Techkriya'],
];

export default function AdminContent() {
  const { role } = useAuth();
  const can = canEdit(role, 'content');
  const [tab, setTab] = useState('home');
  return (
    <AdminPage title="Page content" subtitle="The words on the public pages. Save a section and the site updates straight away.">
      <ViewOnly area="content" />
      <div className="mb-6">
        <Chips value={tab} onChange={setTab} options={TABS} />
      </div>
      <div className="flex flex-col gap-6">
        {SECTIONS.filter((s) => s.tab === tab).map((s) => (
          <Section key={s.key} def={s} can={can} />
        ))}
      </div>
    </AdminPage>
  );
}

const clone = (v) => JSON.parse(JSON.stringify(v));
const blankRow = (fields) => Object.fromEntries(fields.map((f) => [f.key, '']));

function Section({ def, can }) {
  const saved = useContent(def.key);
  const [draft, setDraft] = useState(() => clone(saved));
  const [state, setState] = useState('idle'); // idle | busy | saved | error
  const [msg, setMsg] = useState('');
  const savedJson = useMemo(() => JSON.stringify(saved), [saved]);

  // when the saved version changes (after Save / Reset), start again from it
  useEffect(() => {
    setDraft(JSON.parse(savedJson));
  }, [savedJson]);

  const dirty = JSON.stringify(draft) !== savedJson;
  const isDefault = savedJson === JSON.stringify(DEFAULT_CONTENT[def.key]);

  // every non-optional box must be filled in; numbers must be numbers
  const problem = useMemo(() => {
    const check = (row, fields, where) => {
      for (const f of fields) {
        const v = row?.[f.key];
        if (f.type === 'number') {
          if (v === '' || v === null || Number.isNaN(Number(v))) return `${where}“${f.label}” needs a number`;
        } else if (!f.optional && !String(v ?? '').trim()) return `${where}“${f.label}” is empty`;
      }
      return '';
    };
    if (def.list) {
      if (!draft.length) return 'Add at least one entry';
      for (let i = 0; i < draft.length; i++) {
        const p = check(draft[i], def.list.fields, `Entry ${i + 1}: `);
        if (p) return p;
      }
      return '';
    }
    let p = check(draft, def.fields || [], '');
    for (const l of def.lists || []) {
      for (let i = 0; !p && i < (draft[l.key] || []).length; i++) p = check(draft[l.key][i], l.fields, `${l.label} ${i + 1}: `);
    }
    return p;
  }, [draft, def]);

  const save = async () => {
    if (problem) {
      setState('error');
      setMsg(problem);
      return;
    }
    setState('busy');
    try {
      // tidy: trim text, turn number boxes into real numbers
      const tidy = (row, fields) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, fields.find((f) => f.key === k)?.type === 'number' ? Number(v) : typeof v === 'string' ? v.trim() : v]));
      let out;
      if (def.list) out = draft.map((r) => tidy(r, def.list.fields));
      else {
        out = tidy(draft, def.fields || []);
        for (const l of def.lists || []) out[l.key] = (draft[l.key] || []).map((r) => tidy(r, l.fields));
      }
      await saveContent(def.key, out);
      setState('saved');
      setTimeout(() => setState('idle'), 2200);
    } catch (e) {
      setState('error');
      setMsg(e.message);
    }
  };

  const reset = async () => {
    setState('busy');
    try {
      await resetContent(def.key);
      setState('idle');
    } catch (e) {
      setState('error');
      setMsg(e.message);
    }
  };

  return (
    <section className="glass p-5 md:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="display text-xl font-bold">{def.title}</h2>
          <p className="mt-0.5 text-sm" style={{ color: 'var(--muted)' }}>
            {def.where}
          </p>
        </div>
        <span className="badge" data-tone={dirty ? 'warn' : isDefault ? 'muted' : 'ok'}>
          {dirty ? 'unsaved changes' : isDefault ? 'default text' : 'edited'}
        </span>
      </div>

      <fieldset disabled={!can} className="flex flex-col gap-5">
        {def.list ? (
          <ListEditor rows={draft} onChange={setDraft} fields={def.list.fields} fixed={def.list.fixed} add={def.list.add} />
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              {def.fields.map((f) => (
                <div key={f.key} className={f.type === 'textarea' ? 'md:col-span-2' : ''}>
                  <Box f={f} value={draft[f.key]} onChange={(v) => setDraft((d) => ({ ...d, [f.key]: v }))} />
                </div>
              ))}
            </div>
            {(def.lists || []).map((l) => (
              <div key={l.key}>
                <div className="lbl">{l.label}</div>
                <ListEditor rows={draft[l.key] || []} onChange={(rows) => setDraft((d) => ({ ...d, [l.key]: rows }))} fields={l.fields} fixed={l.fixed} add={l.add} />
              </div>
            ))}
          </>
        )}
      </fieldset>

      {can && (
        <div className="mt-6 flex flex-wrap items-center gap-3 border-t pt-5" style={{ borderColor: 'var(--line)' }}>
          <button className="ctl-btn primary" onClick={save} disabled={state === 'busy' || !dirty}>
            {state === 'busy' ? 'Saving…' : 'Save'}
          </button>
          {dirty && (
            <button className="ctl-btn" onClick={() => setDraft(clone(saved))}>
              Undo changes
            </button>
          )}
          {!isDefault && !dirty && (
            <ConfirmButton onConfirm={reset} confirmText="Click again to reset">
              Reset to default
            </ConfirmButton>
          )}
          {state === 'saved' && (
            <span className="text-sm" style={{ color: 'var(--ok)' }}>
              ✓ Saved
            </span>
          )}
          {state === 'error' && <ErrorNote>{msg}</ErrorNote>}
        </div>
      )}
    </section>
  );
}

function Box({ f, value, onChange, compact = false }) {
  const input =
    f.type === 'textarea' ? (
      <TextArea rows={f.rows || 3} value={value ?? ''} onChange={(e) => onChange(e.target.value)} style={{ minHeight: 0 }} />
    ) : (
      <Input type={f.type === 'number' ? 'number' : 'text'} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
    );
  return <Field label={compact ? undefined : f.label}>{compact ? <span aria-label={f.label}>{input}</span> : input}</Field>;
}

/** Rows of small forms with add / remove / move up / move down. `fixed` = same rows always. */
function ListEditor({ rows, onChange, fields, fixed = false, add = 'Add' }) {
  const set = (i, k, v) => onChange(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const move = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div className="flex flex-col gap-3">
      {rows.map((row, i) => (
        <div key={i} className="rounded-xl border p-3 md:p-4" style={{ borderColor: 'var(--line)', background: 'rgba(5,8,16,.35)' }}>
          <div className="flex flex-col gap-3 md:flex-row md:items-start">
            <span className="mono pt-1 text-[10px] tracking-[0.2em] md:pt-8" style={{ color: 'var(--blue-glow)' }}>
              {String(i + 1).padStart(2, '0')}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-3 md:flex-row md:flex-wrap">
              {fields.map((f) => (
                <div key={f.key} className={f.width ? `md:${f.width} shrink-0` : f.type === 'textarea' ? 'min-w-0 md:basis-full' : 'min-w-0 md:flex-1'}>
                  <Box f={f} value={row[f.key]} onChange={(v) => set(i, f.key, v)} />
                </div>
              ))}
            </div>
            {!fixed && (
              <div className="flex shrink-0 gap-1 md:pt-7">
                <button type="button" className="ctl-btn small" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
                  ↑
                </button>
                <button type="button" className="ctl-btn small" onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label="Move down">
                  ↓
                </button>
                <button type="button" className="ctl-btn small" onClick={() => onChange(rows.filter((_, j) => j !== i))} aria-label="Remove" style={{ color: 'var(--bad)' }}>
                  ✕
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
      {!fixed && (
        <button type="button" className="ctl-btn self-start" onClick={() => onChange([...rows, blankRow(fields)])}>
          + {add}
        </button>
      )}
    </div>
  );
}
