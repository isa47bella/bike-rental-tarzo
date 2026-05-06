/**
 * Admin routes (protette da token)
 * GET  /api/admin/bookings              — lista prenotazioni (con filtri)
 * GET  /api/admin/bookings/:id          — dettaglio singola
 * POST /api/admin/bookings/:id/cancel   — cancella prenotazione
 * GET  /api/admin/stats                 — statistiche rapide
 */

const express  = require('express');
const router   = express.Router();
const stripe   = require('stripe')(process.env.STRIPE_SECRET_KEY);
const supabase = require('../lib/supabase');

// ─── Middleware auth ──────────────────────────────────────────────────────────

function authMiddleware(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (!token || token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Non autorizzato' });
  }
  next();
}

router.use(authMiddleware);

// ─── GET /api/admin/bookings ──────────────────────────────────────────────────

router.get('/bookings', async (req, res) => {
  const { status, from, to } = req.query;
  const limit  = Math.min(Math.max(parseInt(req.query.limit,  10) || 50,  1), 200);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

  let query = supabase
    .from('prenotazioni')
    .select(`
      id, cliente_nome, cliente_email, cliente_telefono,
      bicicletta_id, tipo_noleggio, giorni,
      data_ritiro, orario_ritiro, data_restituzione, orario_restituzione,
      prezzo_totale, pagamento_status, created_at,
      stripe_payment_method_id, danno_status, danno_amount
    `)
    .order('data_ritiro', { ascending: true })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq('pagamento_status', status);
  if (from)   query = query.gte('data_ritiro', from);
  if (to)     query = query.lte('data_ritiro', to);

  const { data, error, count } = await query;

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ bookings: data, total: count });
});

// ─── GET /api/admin/bookings/:id ──────────────────────────────────────────────

router.get('/bookings/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('prenotazioni')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (error || !data) return res.status(404).json({ error: 'Non trovata' });
  return res.json(data);
});

// ─── POST /api/admin/bookings/:id/cancel ─────────────────────────────────────

router.post('/bookings/:id/cancel', async (req, res) => {
  const { data, error } = await supabase
    .from('prenotazioni')
    .update({ pagamento_status: 'cancelled' })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ success: true, booking: data });
});

// ─── GET /api/admin/stats ─────────────────────────────────────────────────────

router.get('/stats', async (req, res) => {
  const oggi = new Date().toISOString().substring(0, 10);

  const [
    { count: totali },
    { count: oggi_count },
    { data: incasso_data },
    { count: future },
  ] = await Promise.all([
    supabase.from('prenotazioni').select('*', { count: 'exact', head: true }).eq('pagamento_status', 'paid'),
    supabase.from('prenotazioni').select('*', { count: 'exact', head: true }).eq('pagamento_status', 'paid').eq('data_ritiro', oggi),
    supabase.from('prenotazioni').select('prezzo_totale').eq('pagamento_status', 'paid'),
    supabase.from('prenotazioni').select('*', { count: 'exact', head: true }).eq('pagamento_status', 'paid').gte('data_ritiro', oggi),
  ]);

  const incasso_totale = (incasso_data || []).reduce((sum, r) => sum + Number(r.prezzo_totale), 0);

  return res.json({
    prenotazioni_totali:  totali || 0,
    prenotazioni_oggi:    oggi_count || 0,
    prenotazioni_future:  future || 0,
    incasso_totale:       incasso_totale.toFixed(2),
  });
});

// ─── POST /api/admin/bookings/:id/charge-damage ───────────────────────────────

router.post('/bookings/:id/charge-damage', async (req, res) => {
  const { amount, motivo } = req.body;
  const amountNum = parseFloat(amount);
  if (!amountNum || amountNum <= 0 || amountNum > 5000) {
    return res.status(400).json({ error: 'Importo non valido (max €5.000)' });
  }

  const { data: prenotazione, error } = await supabase
    .from('prenotazioni')
    .select('stripe_customer_id, stripe_payment_method_id, cliente_nome, danno_status')
    .eq('id', req.params.id)
    .single();

  if (error || !prenotazione) return res.status(404).json({ error: 'Prenotazione non trovata' });
  if (!prenotazione.stripe_payment_method_id) {
    return res.status(400).json({ error: 'Nessuna carta salvata per questa prenotazione' });
  }
  if (prenotazione.danno_status === 'charged') {
    return res.status(400).json({ error: 'Danno già addebitato' });
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount:         Math.round(amountNum * 100),
      currency:       'eur',
      customer:       prenotazione.stripe_customer_id,
      payment_method: prenotazione.stripe_payment_method_id,
      confirm:        true,
      off_session:    true,
      description:    `Danno bici — ${prenotazione.cliente_nome}${motivo ? ': ' + motivo : ''}`,
    });

    await supabase
      .from('prenotazioni')
      .update({ danno_status: 'charged', danno_amount: amountNum })
      .eq('id', req.params.id);

    return res.json({ success: true, payment_intent_id: paymentIntent.id });
  } catch (stripeError) {
    console.error('Stripe charge-damage error:', stripeError);
    return res.status(402).json({ error: stripeError.message || 'Pagamento rifiutato dalla carta' });
  }
});

module.exports = router;
