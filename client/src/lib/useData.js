import { useCallback, useEffect, useMemo, useState } from 'react';
import { list, getSettings, onChange } from './db';

/**
 * Read a table and keep it fresh.
 *   const { rows, loading, error, reload } = useTable('projects', { order: ['title', true] });
 * Re-loads by itself whenever anything writes to that table.
 */
export function useTable(table, opts = {}) {
  const key = JSON.stringify(opts);
  const [state, setState] = useState({ rows: [], loading: true, error: null });

  const load = useCallback(() => {
    return list(table, JSON.parse(key))
      .then((rows) => setState({ rows, loading: false, error: null }))
      .catch((e) => setState((s) => ({ ...s, loading: false, error: e.message })));
  }, [table, key]);

  useEffect(() => {
    let alive = true;
    const run = () => alive && load();
    run();
    const off = onChange((t) => t === table && run());
    return () => {
      alive = false;
      off();
    };
  }, [table, load]);

  return { ...state, reload: load };
}

/** Club settings (email, socials, office hours…) with sensible blanks while loading. */
export function useSettings() {
  const [s, setS] = useState({});
  useEffect(() => {
    let alive = true;
    const load = () => getSettings().then((v) => alive && setS(v)).catch(() => {});
    load();
    const off = onChange((t) => t === 'site_settings' && load());
    return () => {
      alive = false;
      off();
    };
  }, []);
  return s;
}

/**
 * Events split into upcoming / past, in the shape the original v1/v2 components use:
 *   { id, date, title, where, kind, description, registration_open, capacity }
 * Until the first load finishes it returns `fallback` (the static list) so nothing flashes empty.
 */
const NONE = [];
export function useEvents(fallback = NONE) {
  const { rows, loading } = useTable('events', { order: ['starts_at', true] });
  return useMemo(() => {
    const src = loading && !rows.length ? fallback : rows.map((e) => ({ ...e, date: e.starts_at, where: e.venue }));
    const now = Date.now();
    const upcoming = src.filter((e) => new Date(e.date).getTime() >= now - 3 * 3600e3);
    const past = src.filter((e) => new Date(e.date).getTime() < now - 3 * 3600e3).reverse();
    return { upcoming, past, loading };
  }, [rows, loading, fallback]);
}
