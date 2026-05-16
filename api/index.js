require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');

const availabilityRoutes = require('./routes/availability');
const paymentsRoutes     = require('./routes/payments');
const adminRoutes        = require('./routes/admin');
const cronRoutes         = require('./routes/cron');
const firmaRoutes        = require('./routes/firma');

const app = express();

// Security headers
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

const PROD_ORIGIN = process.env.FRONTEND_URL || 'https://bike-rental-tarzo-app.vercel.app';
const DEV_ORIGINS = ['http://localhost:5173', 'http://localhost:4173'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (origin === PROD_ORIGIN) return callback(null, true);
    if (!process.env.VERCEL && DEV_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error('CORS: origine non autorizzata'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-token'],
}));

// ─── Rate limiting ────────────────────────────────────────────────────────────
// Upstash Redis se configurato (funziona su serverless), altrimenti in-memory
// (in-memory si azzera ad ogni cold start su Vercel — solo come fallback)
let checkoutLimiter, adminLimiter;

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  const { Ratelimit } = require('@upstash/ratelimit');
  const { Redis }     = require('@upstash/redis');

  const redis = new Redis({
    url:   process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });

  const checkoutRL = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '15 m') });
  const adminRL    = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(60, '1 m')  });

  checkoutLimiter = async (req, res, next) => {
    const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip || 'unknown';
    const { success } = await checkoutRL.limit(`checkout:${ip}`);
    if (!success) return res.status(429).json({ error: 'Troppe richieste. Riprova tra qualche minuto.' });
    next();
  };

  adminLimiter = async (req, res, next) => {
    if (req.headers['x-admin-token'] === process.env.ADMIN_TOKEN) return next();
    const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip || 'unknown';
    const { success } = await adminRL.limit(`admin:${ip}`);
    if (!success) return res.status(429).json({ error: 'Troppe richieste.' });
    next();
  };
} else {
  const rateLimit = require('express-rate-limit');
  if (process.env.VERCEL) console.warn('[rate-limit] Upstash non configurato — rate limiting non funziona su serverless');

  checkoutLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, max: 10,
    standardHeaders: true, legacyHeaders: false,
    message: { error: 'Troppe richieste. Riprova tra qualche minuto.' },
    keyGenerator: (req) => req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip,
  });

  adminLimiter = rateLimit({
    windowMs: 60 * 1000, max: 60,
    standardHeaders: true, legacyHeaders: false,
    message: { error: 'Troppe richieste.' },
    keyGenerator: (req) => req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip,
    skip: (req) => req.headers['x-admin-token'] === process.env.ADMIN_TOKEN,
  });
}

// Webhook Stripe: body RAW obbligatorio per la verifica firma — deve stare PRIMA di express.json()
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '5mb' }));

app.use('/api/payments/checkout', checkoutLimiter);
app.use('/api/admin', adminLimiter);

app.use('/api/availability', availabilityRoutes);
app.use('/api/payments',     paymentsRoutes);
app.use('/api/admin',        adminRoutes);
app.use('/api/cron',         cronRoutes);
app.use('/api/firma',        firmaRoutes);

app.get('/api/health', (_, res) => res.json({ ok: true, ts: new Date().toISOString() }));

app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Errore interno del server' });
});

module.exports = app;
