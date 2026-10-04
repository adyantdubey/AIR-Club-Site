import { useRef, useState } from 'react';
import { useTable } from '../lib/useData';
import { insert, update, remove, uploadFile, isDemo } from '../lib/db';
import { required, max } from '../lib/validate';
import { Chips, ConfirmButton, Empty, Skeleton, Select, ErrorNote, fmtDate } from '../components/ui/kit';
import { MEDIA_CATEGORIES, Tile } from '../components/ui/MediaTile';
import { AdminPage, FormModal, ViewOnly, useCanEdit, PlusIcon } from './ui';

const FIELDS = [
  { key: 'url', label: 'Photo', type: 'image', folder: 'gallery' },
  { key: 'title', label: 'Title', rules: [required(), max(120)] },
  { key: 'category', label: 'Category', type: 'select', options: MEDIA_CATEGORIES, default: 'events' },
  { key: 'taken_on', label: 'Date taken', type: 'date' },
  { key: 'caption', label: 'Caption', span: 2 },
];

const niceName = (f) =>
  f.name
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .slice(0, 100);

export default function AdminGallery() {
  const { rows, loading } = useTable('media', { order: ['taken_on', false] });
  const can = useCanEdit('gallery');
  const [cat, setCat] = useState('all');
  const [editing, setEditing] = useState(null);
  const [upCat, setUpCat] = useState('events');
  const [progress, setProgress] = useState(null); // { done, total }
  const [err, setErr] = useState('');
  const [drag, setDrag] = useState(false);
  const fileRef = useRef(null);

  const shown = cat === 'all' ? rows : rows.filter((m) => m.category === cat);
  const save = (v) => (editing === 'new' ? insert('media', v) : update('media', editing.id, v));

  // many photos at once: upload each, then add a gallery row for it
  const uploadMany = async (files) => {
    const list = [...files].filter((f) => f.type.startsWith('image/'));
    if (!list.length) return;
    setErr('');
    setProgress({ done: 0, total: list.length });
    const failed = [];
    for (const f of list) {
      try {
        if (f.size > 8 * 1024 * 1024) throw new Error('over 8 MB');
        const url = await uploadFile(f, 'gallery');
        await insert('media', { title: niceName(f), category: upCat, url, kind: 'image', caption: '', taken_on: new Date().toISOString().slice(0, 10) });
      } catch (e) {
        failed.push(`${f.name} (${e.message})`);
      }
      setProgress((p) => ({ ...p, done: p.done + 1 }));
    }
    setProgress(null);
    if (failed.length) setErr(`Could not add: ${failed.join(', ')}`);
  };

  return (
    <AdminPage
      title="Gallery"
      subtitle={`${rows.length} photos across ${MEDIA_CATEGORIES.length} categories`}
      actions={
        can && (
          <button className="ctl-btn inline-flex items-center gap-2" onClick={() => setEditing('new')}>
            <PlusIcon /> Add by link
          </button>
        )
      }
    >
      <ViewOnly area="gallery" />

      {can && (
        <div
          className="glass mb-6 flex flex-col items-center justify-center gap-3 p-8 text-center transition-colors"
          style={drag ? { borderColor: 'var(--blue)', background: 'rgba(45,123,255,.12)' } : { borderStyle: 'dashed' }}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            uploadMany(e.dataTransfer.files);
          }}
        >
          <svg className="h-9 w-9" viewBox="0 0 24 24" fill="none" stroke="var(--blue-glow)" strokeWidth="1.4" aria-hidden="true">
            <path d="M12 16V4M7 9l5-5 5 5M4 16v4h16v-4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="display font-bold">{progress ? `Uploading ${progress.done} / ${progress.total}…` : 'Drop photos here'}</div>
          {progress ? (
            <div className="progress w-60">
              <span style={{ width: `${(progress.done / progress.total) * 100}%`, animation: 'none' }} />
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-center gap-2 text-sm" style={{ color: 'var(--muted)' }}>
              or
              <button className="ctl-btn small" onClick={() => fileRef.current.click()}>
                choose files
              </button>
              into
              <div className="w-40">
                <Select value={upCat} onChange={(e) => setUpCat(e.target.value)} options={MEDIA_CATEGORIES} aria-label="Category for uploads" />
              </div>
            </div>
          )}
          {isDemo && (
            <div className="text-xs" style={{ color: 'var(--warn)' }}>
              Demo mode: photos are shrunk and kept in this browser (about 20–30 fit). Connect Supabase for real storage.
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => uploadMany(e.target.files).then(() => (e.target.value = ''))} />
        </div>
      )}
      {err && (
        <div className="mb-4">
          <ErrorNote>{err}</ErrorNote>
        </div>
      )}

      <div className="mb-5">
        <Chips value={cat} onChange={setCat} options={[['all', 'All', rows.length], ...MEDIA_CATEGORIES.map(([k, l]) => [k, l, rows.filter((r) => r.category === k).length])]} />
      </div>

      {loading ? (
        <Skeleton rows={2} height={160} />
      ) : !shown.length ? (
        <Empty title="No photos here yet" />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((m, i) => (
            <div key={m.id} className="card group overflow-hidden animate-fade-in">
              <button className="relative block aspect-[4/3] w-full overflow-hidden" onClick={() => setEditing(m)} aria-label={`Edit ${m.title}`}>
                <Tile m={m} i={i} />
                {!m.url && (
                  <span className="mono absolute left-2 top-2 rounded px-1.5 py-0.5 text-[9px] tracking-[0.15em]" style={{ background: 'rgba(5,8,16,.8)', color: 'var(--warn)' }}>
                    NO PHOTO YET
                  </span>
                )}
              </button>
              <div className="flex items-start justify-between gap-2 p-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{m.title}</div>
                  <div className="mono text-[9px] tracking-[0.15em]" style={{ color: 'var(--muted)' }}>
                    {m.category.toUpperCase()} · {fmtDate(m.taken_on)}
                  </div>
                </div>
                {can && <ConfirmButton onConfirm={() => remove('media', m.id)}>✕</ConfirmButton>}
              </div>
            </div>
          ))}
        </div>
      )}

      <FormModal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Add photo' : editing?.title || ''}
        fields={FIELDS}
        initial={editing === 'new' ? null : editing}
        onSave={save}
        readOnly={!can}
        wide={false}
      />
    </AdminPage>
  );
}
