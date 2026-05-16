/**
 * Cron routes (chiamate da Vercel Cron Jobs)
 * GET /api/cron/deposit — eseguito ogni giorno alle 07:00 UTC
 *   Trova prenotazioni con data_ritiro = domani (oggi+1), pagamento_status=paid, cauzione_status=pending
 *   Blocca €500 sulla carta del cliente via Stripe PaymentIntent (capture_method: manual)
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
  // Target primario: domani (oggi + 1 giorno)
  // Fallback: oggi (per prenotazioni che ieri non hanno ricevuto la cauzione)
  const makeDateStr = (daysAhead) => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    return d.toISOString().split('T')[0];
  };
  const dateMain     = makeDateStr(1);
  const dateFallback = makeDateStr(0);

  console.log(`[CRON deposit] Target principale: ${dateMain} — Fallback: ${dateFallback}`);

  // Solo prenotazioni senza PI già assegnato: previene doppia cauzione se cron
  // gira in contemporanea con il tasto manuale o con se stesso
  const { data: bookings, error } = await supabase
    .from('prenotazioni')
    .select('id, cliente_nome, stripe_customer_id, stripe_payment_method_id, cauzione_status, cauzione_pi_id, data_ritiro')
    .in('data_ritiro', [dateMain, dateFallback])
    .eq('pagamento_status', 'paid')
    .or('cauzione_status.eq.pending,cauzione_status.is.null')
    .is('cauzione_pi_id', null);

  if (error) {
    console.error('[CRON deposit] Errore Supabase:', error);
    return res.status(500).json({ error: error.message });
  }

  if (!bookings || bookings.length === 0) {
    console.log('[CRON deposit] Nessuna prenotazione da processare');
    return res.json({ processed: 0, results: [] });
  }

  const mainCount     = bookings.filter(b => b.data_ritiro === dateMain).length;
  const fallbackCount = bookings.filter(b => b.data_ritiro === dateFallback).length;
  console.log(`[CRON deposit] ${bookings.length} da processare (${mainCount} principale +1gg, ${fallbackCount} fallback stesso giorno)`);

  const results = [];

  for (const booking of bookings) {
    // Salta prenotazioni manuali senza carta Stripe — non ha senso ritentare
    if (!booking.stripe_customer_id || !booking.stripe_payment_method_id) {
      console.warn(`[CRON deposit] ${booking.id} — nessun metodo di pagamento Stripe (prenotazione manuale?), skip definitivo`);
      await supabase.from('prenotazioni').update({ cauzione_status: 'no_card' }).eq('id', booking.id);
      results.push({ id: booking.id, status: 'no_card' });
      continue;
    }

    // LOCK ATOMICO: aggiorna a 'authorizing' solo se ancora null/pending e PI assente.
    // Se un altro processo (admin + cron in parallelo) ha già preso il lock, data sarà null.
    const { data: locked } = await supabase
      .from('prenotazioni')
      .update({ cauzione_status: 'authorizing' })
      .eq('id', booking.id)
      .or('cauzione_status.eq.pending,cauzione_status.is.null')
      .is('cauzione_pi_id', null)
      .select('id')
      .single();

    if (!locked) {
      console.log(`[CRON deposit] ${booking.id} — lock non ottenuto, già in lavorazione`);
      results.push({ id: booking.id, status: 'skipped', reason: 'concurrent lock' });
      continue;
    }

    try {
      const pi = await stripe.paymentIntents.create({
        amount:         50000, // €500 in centesimi
        currency:       'eur',
        customer:       booking.stripe_customer_id,
        payment_method: booking.stripe_payment_method_id,
        capture_method: 'manual',
        confirm:        true,
        off_session:    true,
        description:    `Cauzione bici — ${booking.cliente_nome} (${booking.id.substring(0, 8)})`,
      });

      const status = pi.status === 'requires_capture' ? 'authorized' : 'failed';
      // Salviamo PRIMA il cauzione_pi_id — così anche se il secondo update fallisce,
      // al prossimo giro vediamo pi_id != null e non creiamo un secondo PI
      await supabase
        .from('prenotazioni')
        .update({ cauzione_pi_id: pi.id, cauzione_status: status })
        .eq('id', booking.id);

      console.log(`[CRON deposit] ${booking.id} — cauzione ${status} (PI: ${pi.id})`);
      results.push({ id: booking.id, status });
    } catch (err) {
      console.error(`[CRON deposit] ${booking.id} — errore Stripe: ${err.message}`);
      // Torna a 'failed' senza pi_id: al prossimo giro verrà riprovato
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

// ─── GET /api/cron/gdpr-cleanup ──────────────────────────────────────────────
// Cancella prenotazioni > 5 anni (come da Privacy Policy)
// Schedule: "0 3 1 * *" — ogni 1° del mese alle 03:00 UTC

router.get('/gdpr-cleanup', cronAuth, async (req, res) => {
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 5);
  const cutoffStr = cutoff.toISOString().split('T')[0];

  console.log(`[CRON gdpr-cleanup] Cancello prenotazioni create prima del ${cutoffStr}`);

  const { data, error } = await supabase
    .from('prenotazioni')
    .delete()
    .lt('created_at', cutoff.toISOString())
    .select('id');

  if (error) {
    console.error('[CRON gdpr-cleanup] Errore Supabase:', error);
    return res.status(500).json({ error: error.message });
  }

  const deleted = data?.length || 0;
  console.log(`[CRON gdpr-cleanup] Done — ${deleted} prenotazioni cancellate`);
  return res.json({ deleted, cutoff: cutoffStr });
});

module.exports = router;
