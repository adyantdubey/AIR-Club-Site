import { Router } from 'express';
import { z } from 'zod';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate } from '../middleware/validate.js';
import { sendMail } from '../services/mailer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EVENTS_FILE = path.resolve(__dirname, '../../data/events.json');
const REG_FILE = path.resolve(__dirname, '../../data/registrations.jsonl');

export const eventsRouter = Router();

// GET /api/events — serves server/data/events.json if it exists (edit it without rebuilding the site)
eventsRouter.get('/', async (_req, res) => {
  try {
    const raw = await fs.readFile(EVENTS_FILE, 'utf8');
    res.json(JSON.parse(raw));
  } catch {
    res.json({ events: [] });
  }
});

const regSchema = z.object({
  name: z.string().trim().min(2, 'please enter your name').max(80),
  email: z.string().trim().email('please enter a valid email'),
  event: z.string().trim().min(2).max(120),
  website: z.string().max(0).optional(),
});

export const registerRouter = Router();

// POST /api/register — event registration; saved to a file and emailed
registerRouter.post('/', validate(regSchema), async (req, res, next) => {
  try {
    const { name, email, event } = req.body;
    await fs.mkdir(path.dirname(REG_FILE), { recursive: true });
    await fs.appendFile(REG_FILE, JSON.stringify({ at: new Date().toISOString(), name, email, event }) + '\n');
    await sendMail({
      subject: `Event registration: ${event}`,
      title: 'New event registration',
      rows: [
        ['Event', event],
        ['Name', name],
        ['Email', email],
      ],
      replyTo: email,
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
