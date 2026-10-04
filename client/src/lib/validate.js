/**
 * Tiny form checker.
 *   const errors = validate(values, {
 *     title: [required(), max(140)],
 *     email: [email()],
 *   });
 *   // → { title: 'Required' }   (empty object = all good)
 */
export function validate(values, rules) {
  const errors = {};
  for (const [field, checks] of Object.entries(rules)) {
    for (const check of checks) {
      const msg = check(values[field], values);
      if (msg) {
        errors[field] = msg;
        break;
      }
    }
  }
  return errors;
}

const empty = (v) => v == null || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0);

export const required = (msg = 'Required') => (v) => (empty(v) ? msg : null);
export const min = (n) => (v) => (!empty(v) && String(v).trim().length < n ? `At least ${n} characters` : null);
export const max = (n) => (v) => (!empty(v) && String(v).length > n ? `At most ${n} characters` : null);
export const email = () => (v) => (!empty(v) && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(v).trim()) ? 'Enter a valid email' : null);
export const url = () => (v) =>
  !empty(v) && !/^(https?:\/\/|\/)/i.test(String(v).trim()) ? 'Start with https:// (or / for a page on this site)' : null;
export const range = (lo, hi) => (v) => (!empty(v) && (Number(v) < lo || Number(v) > hi) ? `Between ${lo} and ${hi}` : null);
