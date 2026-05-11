/**
 * Cron routes (chiamate da Vercel Cron Jobs)
 * GET /api/cron/deposit — eseguito ogni giorno alle 07:00 UTC
 *   Trova prenotazioni con data_ritiro = oggi+2, pagamento_status=paid, cauzione_status=pending
 *   Blocca €1.000 sulla carta del cliente via Stripe PaymentIntent (capture_method: manual)
 */

const express  = require('express');
const router   = express.Router();
const stripe   = require('stripe')(process.env.STRIPE_SECRET_KEY);
const supabase = require('../lib/supabase');
const { sendFirmaLinkEmail, sendReminderEmail } = require('../lib/email');

// ─── Middleware: verifica CRON_SECRET ────────────────────────────────────────

function cronAuth(req, res, next) {
  const cronSecret = process.env.CRON_SECRET;
  // In sviluppo locale senza CRON_SECRET, permetti accesso con admin token
  if (!cronSecret) {
    const adminToken = req.headers['x-admin-token'];
    if (adminToken && adminToken === process.env.ADMIN_TOKEN) return next();
    return res.status(401).json({ error: 'CRON_SECRET non configurato' });
  }
  if (req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Non autorizzato' });
  }
  next();
}

// ─── GET /api/cron/deposit ────────────────────────────────────────────────────

router.get('/deposit', cronAuth, async (req, res) => {
  // Data target: oggi + 2 giorni
  const target = new Date();
  target.setDate(target.getDate() + 2);
  const dateStr = target.toISOString().split('T')[0]; // YYYY-MM-DD

  console.log(`[CRON deposit] Cerco prenotazioni con ritiro il ${dateStr}`);

  // Trova prenotazioni eleggibili
  const { data: bookings, error } = await supabase
    .from('prenotazioni')
    .select('id, cliente_nome, stripe_customer_id, stripe_payment_method_id, cauzione_status')
    .eq('data_ritiro', dateStr)
    .eq('pagamento_status', 'paid')
    .or('cauzione_status.eq.pending,cauzione_status.is.null');

  if (error) {
    console.error('[CRON deposit] Errore Supabase:', error);
    return res.status(500).json({ error: error.message });
  }

  if (!bookings || bookings.length === 0) {
    console.log('[CRON deposit] Nessuna prenotazione da processare');
    return res.json({ processed: 0, results: [] });
  }

  console.log(`[CRON deposit] ${bookings.length} prenotazioni da processare`);

  const results = [];

  for (const booking of bookings) {
    if (!booking.stripe_customer_id || !booking.stripe_payment_method_id) {
      console.warn(`[CRON deposit] ${booking.id} — metodo di pagamento mancante, skip`);
      await supabase.from('prenotazioni').update({ cauzione_status: 'failed' }).eq('id', booking.id);
      results.push({ id: booking.id, status: 'failed', reason: 'no payment method' });
      continue;
    }

    try {
      const pi = await stripe.paymentIntents.create({
        amount:         100000, // €1.000 in centesimi
        currency:       'eur',
        customer:       booking.stripe_customer_id,
        payment_method: booking.stripe_payment_method_id,
        capture_method: 'manual', // blocca senza addebitare
        confirm:        true,
        off_session:    true,
        description:    `Cauzione bici — ${booking.cliente_nome} (${booking.id.substring(0, 8)})`,
      });

      const status = pi.status === 'requires_capture' ? 'authorized' : 'failed';
      await supabase
        .from('prenotazioni')
        .update({ cauzione_pi_id: pi.id, cauzione_status: status })
        .eq('id', booking.id);

      console.log(`[CRON deposit] ${booking.id} — cauzione ${status}`);
      results.push({ id: booking.id, status });
    } catch (err) {
      console.error(`[CRON deposit] ${booking.id} — errore Stripe: ${err.message}`);
      await supabase.from('prenotazioni').update({ cauzione_status: 'failed' }).eq('id', booking.id);
      results.push({ id: booking.id, status: 'failed', error: err.message });
    }
  }

  const ok     = results.filter(r => r.status === 'authorized').length;
  const failed = results.filter(r => r.status === 'failed').length;
  console.log(`[CRON deposit] Done — ${ok} autorizzate, ${failed} fallite`);

  return res.json({ processed: bookings.length, authorized: ok, failed, results });
});

// ─── GET /api/cron/firma-reminder ─────────────────────────────────────────────
// Invia promemoria firma ai clienti con ritiro domani e contratto non firmato

router.get('/firma-reminder', cronAuth, async (req, res) => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = tomorrow.toISOString().split('T')[0];

  console.log(`[CRON firma-reminder] Cerco prenotazioni senza firma per il ${dateStr}`);

  const { data: bookings, error } = await supabase
    .from('prenotazioni')
    .select('id, cliente_nome, cliente_email, lingua')
    .eq('data_ritiro', dateStr)
    .eq('pagamento_status', 'paid')
    .is('firma_at', null);

  if (error) {
    console.error('[CRON firma-reminder] Errore Supabase:', error);
    return res.status(500).json({ error: error.message });
  }

  if (!bookings || bookings.length === 0) {
    console.log('[CRON firma-reminder] Nessuna prenotazione da notificare');
    return res.json({ processed: 0, results: [] });
  }

  const results = [];
  for (const booking of bookings) {
    if (!booking.cliente_email || booking.cliente_email === 'noemail@bikerentaltarzo.it') {
      results.push({ id: booking.id, status: 'skipped', reason: 'no email' });
      continue;
    }
    try {
      await sendFirmaLinkEmail(booking);
      console.log(`[CRON firma-reminder] Inviato a ${booking.cliente_email}`);
      results.push({ id: booking.id, status: 'sent' });
    } catch (e) {
      console.error(`[CRON firma-reminder] ${booking.id} — errore: ${e.message}`);
      results.push({ id: booking.id, status: 'failed', error: e.message });
    }
  }

  const sent   = results.filter(r => r.status === 'sent').length;
  const failed = results.filter(r => r.status === 'failed').length;
  console.log(`[CRON firma-reminder] Done — ${sent} inviati, ${failed} falliti`);

  return res.json({ processed: bookings.length, sent, failed, results });
});

// ─── GET /api/cron/reminder ───────────────────────────────────────────────────
// Invia promemoria ritiro ai clienti con noleggio domani

router.get('/reminder', cronAuth, async (req, res) => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = tomorrow.toISOString().split('T')[0];

  console.log(`[CRON reminder] Cerco prenotazioni per il ${dateStr}`);

  const { data: bookings, error } = await supabase
    .from('prenotazioni')
    .select('id, cliente_nome, cliente_email, orario_ritiro, data_ritiro')
    .eq('data_ritiro', dateStr)
    .eq('pagamento_status', 'paid');

  if (error) {
    console.error('[CRON reminder] Errore Supabase:', error);
    return res.status(500).json({ error: error.message });
  }

  if (!bookings || bookings.length === 0) {
    console.log('[CRON reminder] Nessuna prenotazione domani');
    return res.json({ processed: 0, results: [] });
  }

  const results = [];
  for (const booking of bookings) {
    if (!booking.cliente_email || booking.cliente_email === 'noemail@bikerentaltarzo.it') {
      results.push({ id: booking.id, status: 'skipped', reason: 'no email' });
      continue;
    }
    try {
      await sendReminderEmail(booking);
      console.log(`[CRON reminder] Inviato a ${booking.cliente_email}`);
      results.push({ id: booking.id, status: 'sent' });
    } catch (e) {
      console.error(`[CRON reminder] ${booking.id} — errore: ${e.message}`);
      results.push({ id: booking.id, status: 'failed', error: e.message });
    }
  }

  const sent   = results.filter(r => r.status === 'sent').length;
  const failed = results.filter(r => r.status === 'failed').length;
  console.log(`[CRON reminder] Done — ${sent} inviati, ${failed} falliti`);
  return res.json({ processed: bookings.length, sent, failed, results });
});

module.exports = router;
