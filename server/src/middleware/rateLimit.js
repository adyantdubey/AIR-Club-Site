import rateLimit from 'express-rate-limit';

// 5 form submissions per 10 minutes per visitor; health checks are excluded.
export const apiLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: (req) => req.method === 'GET',
  message: { error: 'Too many requests — please try again in a few minutes.' },
});
