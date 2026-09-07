import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { sendMail } from '../services/mailer.js';

const schema = z.object({
  name: z.string().trim().min(2, 'please enter your name').max(80),
  email: z.string().trim().email('please enter a valid email'),
  message: z.string().trim().min(5, 'message is too short').max(2000),
  website: z.string().max(0).optional(), // honeypot — bots fill it, humans never see it
});

const router = Router();

// POST /api/contact — general enquiry
router.post('/', validate(schema), async (req, res, next) => {
  try {
    const { name, email, message } = req.body;
    await sendMail({
      subject: `Website enquiry from ${name}`,
      title: 'New contact message',
      rows: [
        ['Name', name],
        ['Email', email],
        ['Message', message],
      ],
      replyTo: email,
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
