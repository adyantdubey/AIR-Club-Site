import { Router } from 'express';
import { z } from 'zod';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate } from '../middleware/validate.js';
import { sendMail } from '../services/mailer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_FILE = path.resolve(__dirname, '../../data/signups.jsonl');

const schema = z.object({
  name: z.string().trim().min(2, 'please enter your name').max(80),
  email: z.string().trim().email('please enter a valid email'),
  branch: z.string().trim().max(80).optional().default(''),
  message: z.string().trim().max(1000).optional().default(''),
  team: z.string().trim().max(60).optional().default(''),
  website: z.string().max(0).optional(), // honeypot
});

const router = Router();

// POST /api/join — "Join the club" form. Emails the club AND appends a line to data/signups.jsonl
router.post('/', validate(schema), async (req, res, next) => {
  try {
    const { name, email, branch, message, team } = req.body;

    // Keep a local copy so nothing is lost if email fails
    await fs.mkdir(path.dirname(LOG_FILE), { recursive: true });
    await fs.appendFile(LOG_FILE, JSON.stringify({ at: new Date().toISOString(), name, email, branch, team, message }) + '\n');

    await sendMail({
      subject: `New member request: ${name}`,
      title: 'Someone wants to join the club',
      rows: [
        ['Name', name],
        ['Email', email],
        ['Branch / year', branch],
        ['Team', team],
        ['Wants to build', message],
      ],
      replyTo: email,
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
