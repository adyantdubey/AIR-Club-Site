/**
 * One place that decides WHERE the two forms (Join and Event registration) send their data.
 *
 * Set the mode in `client/.env` — see `client/.env.example`.
 *
 *   VITE_FORM_MODE=api        (default) POST to our own Node server: /api/join, /api/register
 *   VITE_FORM_MODE=endpoint   POST to any form service (Web3Forms, Formspree, Google Apps Script)
 *   VITE_FORM_MODE=netlify    Netlify Forms — no server, no third-party service
 *
 * The last two need NO backend at all, so the site can be hosted free as plain static files.
 */

const MODE = import.meta.env.VITE_FORM_MODE || 'api';
const ENDPOINT = import.meta.env.VITE_FORM_ENDPOINT || '';
const ACCESS_KEY = import.meta.env.VITE_FORM_ACCESS_KEY || '';

/** True when no Node server is involved (used to hide server-only bits of the UI). */
export const isStatic = MODE !== 'api';

/**
 * @param {'join'|'register'} kind   which form this is
 * @param {object} data              the field values
 * @returns {Promise<void>}          resolves on success, throws with a readable message
 */
export async function submitForm(kind, data) {
  if (MODE === 'netlify') return submitNetlify(kind, data);
  if (MODE === 'endpoint') return submitEndpoint(kind, data);
  return submitApi(kind, data);
}

// --- our own Node server ---------------------------------------------------
async function submitApi(kind, data) {
  const res = await fetch(kind === 'join' ? '/api/join' : '/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'Something went wrong');
}

// --- a form service (Web3Forms, Formspree, Apps Script…) -------------------
async function submitEndpoint(kind, data) {
  if (!ENDPOINT) throw new Error('No form endpoint configured');
  const payload = {
    ...data,
    subject: kind === 'join' ? `New member request: ${data.name}` : `Event registration: ${data.event}`,
    from_name: 'AIR Club Website',
  };
  // Web3Forms wants the key in the body; Formspree ignores it harmlessly.
  if (ACCESS_KEY) payload.access_key = ACCESS_KEY;

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  // Web3Forms replies { success: false, message }, Formspree replies { errors: [...] }
  if (!res.ok || body.success === false) {
    throw new Error(body.message || body.errors?.[0]?.message || 'Could not send — please try again');
  }
}

// --- Netlify Forms ---------------------------------------------------------
// Netlify scans the built HTML for forms; index.html carries a hidden copy of each
// one so the fields are registered. Submissions are POSTed url-encoded to any path.
async function submitNetlify(kind, data) {
  const formName = kind === 'join' ? 'air-join' : 'air-register';
  const body = new URLSearchParams({ 'form-name': formName });
  Object.entries(data).forEach(([k, v]) => body.append(k, v ?? ''));
  const res = await fetch('/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) throw new Error('Could not send — please try again');
}
