require('dotenv').config();
const express  = require('express');
const cors     = require('cors');

const availabilityRoutes = require('./routes/availability');
const paymentsRoutes     = require('./routes/payments');
const adminRoutes        = require('./routes/admin');

const app  = express();
const PORT = process.env.PORT || 3001;

// ─── CORS ─────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    'http://localhost:5173',
    'http://localhost:4173',
  ],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-token'],
}));

// ─── Body parsers ─────────────────────────────────────────────────────────────
// IMPORTANTE: la rotta /webhook nel router payments usa express.raw()
// internamente, quindi viene registrata DOPO express.json() ma il suo
// middleware raw() sovrascrive il body per quella singola rotta.
app.use(express.json({ limit: '10mb' }));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/availability', availabilityRoutes);
app.use('/api/payments',     paymentsRoutes);
app.use('/api/admin',        adminRoutes);

// ─── Health check ────────────────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// ─── Error handler ────────────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Errore interno del server' });
});

// Avvia il server solo in locale (non su Vercel serverless)
if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`\nBike Rental Tarzo — Backend`);
    console.log(`   Server:    http://localhost:${PORT}`);
    console.log(`   Health:    http://localhost:${PORT}/health`);
    console.log(`   Ambiente:  ${process.env.NODE_ENV || 'development'}\n`);
  });
}

module.exports = app;
