/**
 * ONE place every page reads and writes club data through.
 *
 *  - If client/.env has VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY → the real Supabase database.
 *  - Otherwise → DEMO MODE: the sample data in src/data/seed.js, saved in this browser only.
 *
 * Pages never need to know which one is active. They call:
 *   list('projects')          get('projects', id)
 *   insert('ideas', {...})    update('events', id, {...})    remove('media', id)
 * and useTable('projects') (see useData.js) re-renders automatically after any change.
 */
import { SEED, DEMO_USERS } from '../data/seed';

const SB_URL = import.meta.env.VITE_SUPABASE_URL || '';
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isDemo = !(SB_URL && KEY);

// ---------------------------------------------------------------- change events
const listeners = new Set();
/** Call fn(tableName) whenever something is written. Returns an unsubscribe function. */
export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
const emit = (table) => listeners.forEach((l) => l(table));

// ---------------------------------------------------------------- who is acting (for the audit log)
let actor = null;
export const setActor = (user) => {
  actor = user;
};

// ---------------------------------------------------------------- Supabase client (loaded only if needed)
let clientPromise = null;
export function getClient() {
  if (isDemo) return Promise.resolve(null);
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(SB_URL, KEY, { auth: { persistSession: true, autoRefreshToken: true } }),
    );
  }
  return clientPromise;
}

// ---------------------------------------------------------------- demo store
const STORE_KEY = 'air-demo-db-v2'; // bump when the sample data changes shape
let mem = null;

function loadDemo() {
  if (mem) return mem;
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) mem = JSON.parse(raw);
  } catch {
    /* storage blocked — fall back to memory */
  }
  if (!mem) mem = freshSeed();
  // add any table that a newer version of the seed introduced
  for (const k of Object.keys(SEED)) if (!mem[k]) mem[k] = structuredClone(SEED[k]);
  if (!mem.profiles) mem.profiles = structuredClone(DEMO_USERS);
  return mem;
}
function freshSeed() {
  return { ...structuredClone(SEED), profiles: structuredClone(DEMO_USERS) };
}
function saveDemo() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(mem));
  } catch {
    // usually "storage full" after many large photo uploads
    console.warn('[demo] could not save to browser storage — changes last until refresh');
  }
}
/** Admin → Settings → "Reset demo data". */
export function resetDemo() {
  mem = freshSeed();
  saveDemo();
  Object.keys(mem).forEach(emit);
}

const uid = () =>
  globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const AUDITED = ['site_content', 'projects', 'events', 'announcements', 'ideas', 'achievements', 'media', 'team_members', 'site_settings', 'profiles', 'resources'];
function demoAudit(action, table, row) {
  if (!actor || !AUDITED.includes(table)) return;
  const summary = row?.title || row?.name || row?.club_name || row?.email || (table === 'site_content' ? row?.id : '') || '';
  mem.audit_log.unshift({
    id: uid(),
    actor_email: actor.email,
    action,
    table_name: table,
    record_id: String(row?.id ?? ''),
    summary: action === 'update' && row?.status && table === 'ideas' ? `${summary} → ${row.status}` : summary,
    created_at: new Date().toISOString(),
  });
  mem.audit_log = mem.audit_log.slice(0, 200);
  emit('audit_log');
}

// small delay so loading states behave like the real thing
const tick = () => new Promise((r) => setTimeout(r, 60));

// ---------------------------------------------------------------- public API
/**
 * @param {string} table
 * @param {{ order?: [string, boolean], eq?: object, inValues?: [string, any[]], limit?: number }} opts
 *        order = [column, ascending]   eq = { column: value }
 */
export async function list(table, opts = {}) {
  const { order = ['created_at', false], eq, inValues, limit } = opts;
  if (isDemo) {
    await tick();
    let rows = [...(loadDemo()[table] || [])];
    if (eq) rows = rows.filter((r) => Object.entries(eq).every(([k, v]) => r[k] === v));
    if (inValues) rows = rows.filter((r) => inValues[1].includes(r[inValues[0]]));
    if (order) {
      const [col, asc] = order;
      rows.sort((a, b) => {
        const x = a[col] ?? '';
        const y = b[col] ?? '';
        return (x > y ? 1 : x < y ? -1 : 0) * (asc ? 1 : -1);
      });
    }
    if (limit) rows = rows.slice(0, limit);
    return structuredClone(rows);
  }
  const sb = await getClient();
  let q = sb.from(table).select('*');
  if (eq) Object.entries(eq).forEach(([k, v]) => (q = q.eq(k, v)));
  if (inValues) q = q.in(inValues[0], inValues[1]);
  if (order) q = q.order(order[0], { ascending: order[1] });
  if (limit) q = q.limit(limit);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data;
}

export async function get(table, id) {
  if (isDemo) {
    await tick();
    const row = (loadDemo()[table] || []).find((r) => r.id === id);
    return row ? structuredClone(row) : null;
  }
  const sb = await getClient();
  const { data, error } = await sb.from(table).select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Add a row. `returning: false` is for public forms (ideas, registrations, messages):
 * visitors are allowed to add but not to read those tables back.
 */
export async function insert(table, row, { returning = true } = {}) {
  if (isDemo) {
    await tick();
    const db = loadDemo();
    const stamp = new Date().toISOString();
    const full = { id: uid(), created_at: stamp, updated_at: stamp, ...row };
    db[table] = [full, ...(db[table] || [])];
    demoAudit('insert', table, full);
    saveDemo();
    emit(table);
    return structuredClone(full);
  }
  const sb = await getClient();
  if (!returning) {
    const { error } = await sb.from(table).insert(row);
    if (error) throw new Error(error.message);
    emit(table);
    return null;
  }
  const { data, error } = await sb.from(table).insert(row).select().single();
  if (error) throw new Error(error.message);
  emit(table);
  return data;
}

export async function update(table, id, patch) {
  if (isDemo) {
    await tick();
    const db = loadDemo();
    const i = (db[table] || []).findIndex((r) => r.id === id);
    if (i < 0) throw new Error('Not found');
    db[table][i] = { ...db[table][i], ...patch, updated_at: new Date().toISOString() };
    demoAudit('update', table, db[table][i]);
    saveDemo();
    emit(table);
    return structuredClone(db[table][i]);
  }
  const sb = await getClient();
  const { data, error } = await sb.from(table).update(patch).eq('id', id).select().single();
  if (error) throw new Error(error.message);
  emit(table);
  return data;
}

export async function remove(table, id) {
  if (isDemo) {
    await tick();
    const db = loadDemo();
    const row = (db[table] || []).find((r) => r.id === id);
    db[table] = (db[table] || []).filter((r) => r.id !== id);
    demoAudit('delete', table, row);
    saveDemo();
    emit(table);
    return;
  }
  const sb = await getClient();
  const { error } = await sb.from(table).delete().eq('id', id);
  if (error) throw new Error(error.message);
  emit(table);
}

// ---------------------------------------------------------------- settings (single row, id = 1)
export async function getSettings() {
  const rows = await list('site_settings', { order: null });
  return rows[0] || {};
}
export const saveSettings = (patch) => update('site_settings', 1, patch);

// ---------------------------------------------------------------- editable page text (one row per section)
/** Save one section of page text. `key` is e.g. 'faq' or 'about'; `value` is any JSON. */
export async function saveContent(key, value) {
  if (isDemo) {
    const exists = (loadDemo().site_content || []).some((r) => r.id === key);
    return exists ? update('site_content', key, { value }) : insert('site_content', { id: key, value });
  }
  const sb = await getClient();
  const { error } = await sb.from('site_content').upsert({ id: key, value });
  if (error) throw new Error(error.message);
  emit('site_content');
}
/** Forget the saved version so the built-in default text shows again. */
export async function resetContent(key) {
  if (isDemo) {
    if ((loadDemo().site_content || []).some((r) => r.id === key)) await remove('site_content', key);
    return;
  }
  const sb = await getClient();
  const { error } = await sb.from('site_content').delete().eq('id', key);
  if (error) throw new Error(error.message);
  emit('site_content');
}

// ---------------------------------------------------------------- ideas helpers
/** Counts of ideas by status (works for visitors too — they can't read pending ideas directly). */
export async function ideaStats() {
  if (isDemo) {
    await tick();
    const all = loadDemo().ideas;
    const by = (s) => all.filter((i) => i.status === s).length;
    return {
      total: all.length,
      pending: by('pending') + by('under_review'),
      approved: by('approved'),
      implemented: by('implemented'),
      rejected: by('rejected'),
    };
  }
  const sb = await getClient();
  const { data, error } = await sb.rpc('idea_stats');
  if (error) throw new Error(error.message);
  return data;
}

/** Look up one idea's status by its tracking code (e.g. AIR-7Q2K). */
export async function trackIdea(code) {
  const c = code.trim().toUpperCase();
  if (isDemo) {
    await tick();
    const i = loadDemo().ideas.find((x) => x.tracking_code === c);
    return i ? { title: i.title, status: i.status, review_note: i.review_note, created_at: i.created_at } : null;
  }
  const sb = await getClient();
  const { data, error } = await sb.rpc('track_idea', { code: c });
  if (error) throw new Error(error.message);
  return data?.[0] || null;
}

export function newTrackingCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 4; i++) s += A[Math.floor(Math.random() * A.length)];
  return `AIR-${s}`;
}

/** One vote per browser per idea. Returns the new count (or throws "already voted"). */
export async function voteIdea(ideaId, voterKey) {
  if (isDemo) {
    await tick();
    const db = loadDemo();
    if (db.idea_votes.some((v) => v.idea_id === ideaId && v.voter_key === voterKey)) throw new Error('already voted');
    db.idea_votes.push({ id: uid(), idea_id: ideaId, voter_key: voterKey, created_at: new Date().toISOString() });
    const idea = db.ideas.find((i) => i.id === ideaId);
    if (idea) idea.upvotes = (idea.upvotes || 0) + 1;
    saveDemo();
    emit('ideas');
    return idea?.upvotes ?? 0;
  }
  const sb = await getClient();
  const { error } = await sb.from('idea_votes').insert({ idea_id: ideaId, voter_key: voterKey });
  if (error) throw new Error(error.code === '23505' ? 'already voted' : error.message);
  emit('ideas');
  return null;
}

// ---------------------------------------------------------------- file upload (gallery, photos, certificates)
/**
 * Upload an image and get back a URL to store in the database.
 * Demo mode: the image is shrunk to max 1200px and kept inside the browser.
 */
export async function uploadFile(file, folder = 'gallery') {
  if (isDemo) {
    if (!file.type.startsWith('image/')) throw new Error('Demo mode can only keep images');
    return shrinkImage(file, 1200, 0.8);
  }
  const sb = await getClient();
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await sb.storage.from('media').upload(path, file, { cacheControl: '3600', upsert: false });
  if (error) throw new Error(error.message);
  return sb.storage.from('media').getPublicUrl(path).data.publicUrl;
}

function shrinkImage(file, max, quality) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * s);
      c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => reject(new Error('Could not read that image'));
    img.src = url;
  });
}
