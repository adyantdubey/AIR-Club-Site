/**
 * Editable page text.
 *
 *   const about = useContent('about');     // → { lead, more, community, signoff }
 *
 * Reads the `site_content` table once when the site opens. Any section an admin has not
 * touched falls back to src/data/content.js. Pages are held back for a moment until this
 * first read finishes, so animated headings always start with the right words.
 */
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { list, onChange } from './db';
import { DEFAULT_CONTENT } from '../data/content';

const Ctx = createContext(DEFAULT_CONTENT);

export function ContentProvider({ children }) {
  const [saved, setSaved] = useState(null); // { key: value } once loaded

  useEffect(() => {
    let alive = true;
    const load = () =>
      list('site_content', { order: null })
        .then((rows) => alive && setSaved(Object.fromEntries(rows.map((r) => [r.id, r.value]))))
        .catch(() => alive && setSaved((s) => s || {}));
    load();
    // never keep visitors waiting on a slow database: show defaults after 2.5 s
    const t = setTimeout(() => alive && setSaved((s) => s || {}), 2500);
    const off = onChange((table) => table === 'site_content' && load());
    return () => {
      alive = false;
      clearTimeout(t);
      off();
    };
  }, []);

  const value = useMemo(() => ({ ...DEFAULT_CONTENT, ...(saved || {}) }), [saved]);

  if (!saved) {
    return (
      <div className="flex min-h-screen items-center justify-center" aria-busy="true">
        <div className="h-16 w-16 animate-pulse rounded-full border" style={{ borderColor: 'var(--blue)' }} />
      </div>
    );
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** One section of editable content (always defined — falls back to the defaults). */
export function useContent(key) {
  const all = useContext(Ctx);
  return all[key] ?? DEFAULT_CONTENT[key];
}
