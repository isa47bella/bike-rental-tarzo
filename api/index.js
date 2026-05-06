require('dotenv').config();
const express  = require('express');
const cors     = require('cors');

const availabilityRoutes = require('./routes/availability');
const paymentsRoutes     = require('./routes/payments');
const adminRoutes        = require('./routes/admin');

const app = express();

app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'https://bike-rental-tarzo-app.vercel.app',
    'http://localhost:5173',
    'http://localhost:4173',
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-token'],
}));

app.use(express.json());

app.use('/api/availability', availabilityRoutes);
app.use('/api/payments',     paymentsRoutes);
app.use('/api/admin',        adminRoutes);

app.get('/api/health', (_, res) => res.json({ ok: true, ts: new Date().toISOString() }));

app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Errore interno del server' });
});

module.exports = app;
