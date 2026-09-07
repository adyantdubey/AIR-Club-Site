import nodemailer from 'nodemailer';

let transport = null;

function getTransport() {
  if (transport) return transport;
  transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 465,
    secure: (Number(process.env.SMTP_PORT) || 465) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return transport;
}

const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function template(title, rows) {
  const body = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:8px 12px;color:#8a93b2;font:12px/1.4 monospace;text-transform:uppercase;letter-spacing:.1em">${esc(k)}</td>
         <td style="padding:8px 12px;color:#f5f7ff;font:15px/1.5 sans-serif">${esc(v) || '—'}</td></tr>`,
    )
    .join('');
  return `
  <div style="background:#050810;padding:32px;font-family:sans-serif">
    <div style="max-width:560px;margin:0 auto;background:#0b1020;border:1px solid rgba(110,178,255,.18);border-radius:16px;overflow:hidden">
      <div style="padding:20px 24px;border-bottom:1px solid rgba(110,178,255,.18)">
        <div style="color:#6eb2ff;font:11px monospace;letter-spacing:.2em">AI & ROBOTICS CLUB · NIT AP</div>
        <div style="color:#f5f7ff;font:700 20px sans-serif;margin-top:6px">${esc(title)}</div>
      </div>
      <table style="width:100%;border-collapse:collapse;padding:12px">${body}</table>
    </div>
  </div>`;
}

/**
 * Sends an email, or logs it to the console when SEND_EMAILS is not "true".
 * @param {{ subject: string, title: string, rows: [string, string][], replyTo?: string }} msg
 */
export async function sendMail({ subject, title, rows, replyTo }) {
  const to = process.env.CONTACT_TO;
  if (process.env.SEND_EMAILS !== 'true') {
    console.log(`\n[mail → ${to}] ${subject}`);
    rows.forEach(([k, v]) => console.log(`  ${k}: ${v}`));
    return { logged: true };
  }
  await getTransport().sendMail({
    from: `"AIR Club Website" <${process.env.SMTP_USER}>`,
    to,
    replyTo,
    subject,
    html: template(title, rows),
    text: rows.map(([k, v]) => `${k}: ${v}`).join('\n'),
  });
  return { sent: true };
}
