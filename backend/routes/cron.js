/**
 * Cron routes (chiamate da Vercel Cron Jobs)
 * GET /api/cron/deposit — eseguito ogni giorno alle 07:00 UTC
 *   Trova prenotazioni con data_ritiro = domani (oggi+1), pagamento_status=paid, cauzione_status=pending
 *   Blocca €500 sulla carta del cliente via Stripe PaymentIntent (capture_method: manual)
 */

const express  = require('express');
const crypto   = require('crypto');
const router   = express.Router();
const stripe   = require('stripe')(process.env.STRIPE_SECRET_KEY);
const supabase = require('../lib/supabase');
const { sendFirmaLinkEmail, sendReminderEmail } = require('../lib/email');
const { sendPushToAll } = require('../lib/push');
const { CAUZIONE_AMOUNT_CENTS } = require('../lib/config');
const { writeNotification } = require('../lib/notifications');

// ─── Middleware: verifica CRON_SECRET ────────────────────────────────────────

// Confronto timing-safe: evita di rivelare il secret byte-per-byte via timing.
function safeEqual(a, b) {
  const bufA = Buffer.from(String(a ?? ''));
  const bufB = Buffer.from(String(b ?? ''));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function cronAuth(req, res, next) {
  const cronSecret = process.env.CRON_SECRET;
  // In sviluppo locale senza CRON_SECRET, permetti accesso con admin token
  if (!cronSecret) {
    const adminToken = req.headers['x-admin-token'];
    if (adminToken && safeEqual(adminToken, process.env.ADMIN_TOKEN)) return next();
    return res.status(401).json({ error: 'CRON_SECRET non configurato' });
  }
  if (!safeEqual(req.headers.authorization, `Bearer ${cronSecret}`)) {
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
        amount:         CAUZIONE_AMOUNT_CENTS,
        currency:       'eur',
        customer:       booking.stripe_customer_id,
        payment_method: booking.stripe_payment_method_id,
        capture_method: 'manual',
        confirm:        true,
        off_session:    true,
        description:    `Cauzione bici — ${booking.cliente_nome} (${booking.id.substring(0, 8)})`,
      });

      // Race-condition guard: se l'admin ha cancellato la prenotazione
      // mentre creavamo il PI, rilascia subito l'hold sulla carta.
      const { data: current } = await supabase
        .from('prenotazioni')
        .select('pagamento_status')
        .eq('id', booking.id)
        .single();

      if (current && current.pagamento_status === 'cancelled') {
        try { await stripe.paymentIntents.cancel(pi.id); } catch (_) {}
        await supabase
          .from('prenotazioni')
          .update({ cauzione_pi_id: pi.id, cauzione_status: 'cancelled' })
          .eq('id', booking.id);
        console.warn(`[CRON deposit] ${booking.id} — booking cancellata durante autorizzazione, hold rilasciata (PI: ${pi.id})`);
        results.push({ id: booking.id, status: 'cancelled_during_auth' });
        continue;
      }

      const status = pi.status === 'requires_capture' ? 'authorized' : 'failed';
      // Salviamo PRIMA il cauzione_pi_id — così anche se il secondo update fallisce,
      // al prossimo giro vediamo pi_id != null e non creiamo un secondo PI
      await supabase
        .from('prenotazioni')
        .update({ cauzione_pi_id: pi.id, cauzione_status: status })
        .eq('id', booking.id);

      console.log(`[CRON deposit] ${booking.id} — cauzione ${status} (PI: ${pi.id})`);

      if (status === 'failed') {
        await sendPushToAll({
          title: '⚠️ Cauzione fallita',
          body:  `${booking.cliente_nome} (${booking.data_ritiro}) — stato Stripe: ${pi.status}`,
          url:   '/admin',
        }).catch(e => console.error('[CRON deposit] push fail notify error:', e.message));
        await writeNotification('cauzione_failed', {
          titolo: `Cauzione fallita — ${booking.cliente_nome}`,
          descrizione: `Data ritiro: ${booking.data_ritiro}.`,
          booking_id: booking.id,
        }).catch(_ => {});
      }

      results.push({ id: booking.id, status });
    } catch (err) {
      console.error(`[CRON deposit] ${booking.id} — errore Stripe: ${err.message}`);
      // Se Stripe ha comunque creato un PaymentIntent prima di fallire (es. timeout
      // di rete dopo la creazione), ne salviamo l'id: evita che al giro successivo
      // venga creato un SECONDO hold da €${CAUZIONE_AMOUNT_CENTS / 100} sulla carta del cliente.
      const failedPiId = err.payment_intent?.id || err.raw?.payment_intent?.id || null;
      const failUpdate = { cauzione_status: 'failed' };
      if (failedPiId) failUpdate.cauzione_pi_id = failedPiId;
      await supabase.from('prenotazioni').update(failUpdate).eq('id', booking.id);

      await sendPushToAll({
        title: '⚠️ Cauzione fallita',
        body:  `${booking.cliente_nome} (${booking.data_ritiro}) — ${err.message.substring(0, 80)}`,
        url:   '/admin',
      }).catch(e => console.error('[CRON deposit] push fail notify error:', e.message));
      await writeNotification('cauzione_failed', {
        titolo: `Cauzione fallita — ${booking.cliente_nome}`,
        descrizione: `Data ritiro: ${booking.data_ritiro}.`,
        booking_id: booking.id,
      }).catch(_ => {});

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
      sendPushToAll({
        title: '✍️ Reminder firma inviato',
        body:  `${booking.cliente_nome} · ritiro domani · ✓ email inviata`,
        url:   '/admin',
      }).catch(e => console.error('[CRON firma-reminder] push:', e.message));
      writeNotification('firma_reminder_sent', {
        titolo: `Reminder firma — ${booking.cliente_nome}`,
        descrizione: `Email inviata per ritiro di domani.`,
        booking_id: booking.id,
      }).catch(_ => {});
    } catch (e) {
      console.error(`[CRON firma-reminder] ${booking.id} — errore: ${e.message}`);
      results.push({ id: booking.id, status: 'failed', error: e.message });
      sendPushToAll({
        title: '⚠️ Reminder firma fallito',
        body:  `${booking.cliente_nome} · ${e.message.substring(0, 60)}`,
        url:   '/admin',
      }).catch(_ => {});
      writeNotification('firma_reminder_failed', {
        titolo: `Reminder firma fallito — ${booking.cliente_nome}`,
        descrizione: `Errore: ${e.message}`,
        booking_id: booking.id,
      }).catch(_ => {});
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
      const oraStr = (booking.orario_ritiro || '').substring(0, 5);
      sendPushToAll({
        title: '✉️ Promemoria ritiro inviato',
        body:  `${booking.cliente_nome} · ritiro domani${oraStr ? ' ore ' + oraStr : ''} · ✓ email inviata`,
        url:   '/admin',
      }).catch(e => console.error('[CRON reminder] push:', e.message));
      writeNotification('ritiro_reminder_sent', {
        titolo: `Promemoria ritiro — ${booking.cliente_nome}`,
        descrizione: `Email inviata per ritiro di domani${oraStr ? ' alle ' + oraStr : ''}.`,
        booking_id: booking.id,
      }).catch(_ => {});
    } catch (e) {
      console.error(`[CRON reminder] ${booking.id} — errore: ${e.message}`);
      results.push({ id: booking.id, status: 'failed', error: e.message });
      sendPushToAll({
        title: '⚠️ Promemoria ritiro fallito',
        body:  `${booking.cliente_nome} · ${e.message.substring(0, 60)}`,
        url:   '/admin',
      }).catch(_ => {});
      writeNotification('ritiro_reminder_failed', {
        titolo: `Promemoria ritiro fallito — ${booking.cliente_nome}`,
        descrizione: `Errore: ${e.message}`,
        booking_id: booking.id,
      }).catch(_ => {});
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

// ─── GET /api/cron/auto-cancel-pending ────────────────────────────────────────
// Cancella prenotazioni 'pending' più vecchie di 30 minuti.
// Tenta anche di scadere la sessione Stripe (no-op se già scaduta).

router.get('/auto-cancel-pending', cronAuth, async (req, res) => {
  const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();

  const { data: stale, error } = await supabase
    .from('prenotazioni')
    .select('id, stripe_session_id, cliente_nome')
    .eq('pagamento_status', 'pending')
    .lt('created_at', cutoff);

  if (error) {
    console.error('[cron auto-cancel-pending] db error:', error.message);
    return res.status(500).json({ error: error.message });
  }

  if (!stale?.length) {
    return res.json({ cancelled: 0 });
  }

  let cancelled = 0;
  for (const row of stale) {
    if (row.stripe_session_id && !row.stripe_session_id.startsWith('manual_')) {
      try { await stripe.checkout.sessions.expire(row.stripe_session_id); }
      catch (_) { /* sessione già scaduta o non esiste, ignora */ }
    }
    const { error: updErr } = await supabase
      .from('prenotazioni')
      .update({ pagamento_status: 'cancelled' })
      .eq('id', row.id)
      .eq('pagamento_status', 'pending');
    if (!updErr) cancelled++;
  }

  if (cancelled > 0) {
    await writeNotification('pending_auto_cancelled', {
      titolo: `${cancelled} prenotazion${cancelled === 1 ? 'e' : 'i'} pending scaduta${cancelled === 1 ? '' : 'e'}`,
      descrizione: 'Carrelli abbandonati >30min cancellati automaticamente.',
    });
  }

  console.log(`[cron auto-cancel-pending] cancellate ${cancelled}/${stale.length}`);
  return res.json({ cancelled, scanned: stale.length });
});

// ─── GET /api/cron/retry-cauzioni ─────────────────────────────────────────────
// Ritenta cauzioni in stato 'failed' per prenotazioni con data_ritiro futura.
// Max 3 tentativi, poi marca 'failed_permanent' e notifica.

router.get('/retry-cauzioni', cronAuth, async (req, res) => {
  const today = new Date().toISOString().substring(0, 10);

  const { data: bookings, error } = await supabase
    .from('prenotazioni')
    .select('id, cliente_nome, stripe_customer_id, stripe_payment_method_id, cauzione_retry_count, data_ritiro')
    .eq('cauzione_status', 'failed')
    .gte('data_ritiro', today)
    .lt('cauzione_retry_count', 3)
    .is('cauzione_pi_id', null);

  if (error) {
    console.error('[cron retry-cauzioni] db error:', error.message);
    return res.status(500).json({ error: error.message });
  }

  if (!bookings?.length) {
    return res.json({ retried: 0 });
  }

  const results = { ok: 0, failed: 0, permanent: 0 };

  for (const b of bookings) {
    if (!b.stripe_customer_id || !b.stripe_payment_method_id) {
      results.permanent++;
      await supabase.from('prenotazioni').update({ cauzione_status: 'no_card' }).eq('id', b.id);
      continue;
    }

    try {
      const pi = await stripe.paymentIntents.create({
        amount:         CAUZIONE_AMOUNT_CENTS,
        currency:       'eur',
        customer:       b.stripe_customer_id,
        payment_method: b.stripe_payment_method_id,
        capture_method: 'manual',
        confirm:        true,
        off_session:    true,
        description:    `Cauzione bici (retry) — ${b.cliente_nome} (${b.id.substring(0, 8)})`,
      });

      const newStatus = pi.status === 'requires_capture' ? 'authorized' : 'failed';
      await supabase.from('prenotazioni').update({
        cauzione_pi_id: pi.id,
        cauzione_status: newStatus,
        cauzione_retry_count: (b.cauzione_retry_count || 0) + 1,
      }).eq('id', b.id);

      if (newStatus === 'authorized') results.ok++;
      else results.failed++;
    } catch (err) {
      const newCount = (b.cauzione_retry_count || 0) + 1;
      const permanent = newCount >= 3;
      await supabase.from('prenotazioni').update({
        cauzione_status: permanent ? 'failed_permanent' : 'failed',
        cauzione_retry_count: newCount,
      }).eq('id', b.id);

      if (permanent) {
        results.permanent++;
        await writeNotification('cauzione_failed_permanent', {
          titolo: `Cauzione fallita 3 volte — ${b.cliente_nome}`,
          descrizione: `Stripe: ${err.message.substring(0, 120)}. Serve intervento manuale.`,
          booking_id: b.id,
        });
      } else {
        results.failed++;
      }
    }
  }

  console.log(`[cron retry-cauzioni] ok=${results.ok} failed=${results.failed} permanent=${results.permanent}`);
  return res.json({ retried: bookings.length, ...results });
});

// ─── GET /api/cron/cleanup-audit ──────────────────────────────────────────────
// Elimina record audit_log più vecchi di 180 giorni.

router.get('/cleanup-audit', cronAuth, async (req, res) => {
  const cutoff = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();

  const { error, count } = await supabase
    .from('audit_log')
    .delete({ count: 'exact' })
    .lt('created_at', cutoff);

  if (error) {
    console.error('[cron cleanup-audit] db error:', error.message);
    return res.status(500).json({ error: error.message });
  }

  console.log(`[cron cleanup-audit] eliminati ${count || 0} record (cutoff ${cutoff})`);
  return res.json({ deleted: count || 0, cutoff });
});

// ─── GET /api/cron/daily-summary ──────────────────────────────────────────────
// Push notification con riepilogo della giornata.
// Schedule: 0 17 * * * UTC (19:00 IT in estate, 18:00 IT in inverno).
// "Oggi" = giornata UTC corrente (alle 17 UTC siamo dentro lo stesso giorno IT).
// Conta: prenotazioni pagate, check-in, check-out. Se tutto a zero non manda nulla.

router.get('/daily-summary', cronAuth, async (req, res) => {
  const now = new Date();
  const todayStart    = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setUTCDate(tomorrowStart.getUTCDate() + 1);
  const fromIso = todayStart.toISOString();
  const toIso   = tomorrowStart.toISOString();

  const [nuove, ritiri, restituzioni] = await Promise.all([
    supabase
      .from('prenotazioni')
      .select('id, prezzo_totale')
      .eq('pagamento_status', 'paid')
      .gte('created_at', fromIso)
      .lt('created_at',  toIso),
    supabase
      .from('prenotazioni')
      .select('id')
      .gte('checkin_at', fromIso)
      .lt('checkin_at',  toIso),
    supabase
      .from('prenotazioni')
      .select('id')
      .gte('checkout_at', fromIso)
      .lt('checkout_at',  toIso),
  ]);

  if (nuove.error || ritiri.error || restituzioni.error) {
    const msg = nuove.error?.message || ritiri.error?.message || restituzioni.error?.message;
    console.error('[CRON daily-summary] DB error:', msg);
    return res.status(500).json({ error: msg });
  }

  const nPrenot  = (nuove.data        || []).length;
  const totalEur = (nuove.data        || []).reduce((s, p) => s + Number(p.prezzo_totale), 0);
  const nRitiri  = (ritiri.data       || []).length;
  const nRest    = (restituzioni.data || []).length;

  if (nPrenot === 0 && nRitiri === 0 && nRest === 0) {
    console.log('[CRON daily-summary] Nessun evento oggi, skip push');
    return res.json({ skipped: true, prenotazioni: 0, ritiri: 0, restituzioni: 0 });
  }

  const parts = [];
  if (nPrenot > 0) parts.push(`${nPrenot} prenot. (€${totalEur.toFixed(0)})`);
  if (nRitiri > 0) parts.push(`${nRitiri} ritir${nRitiri === 1 ? 'o' : 'i'}`);
  if (nRest   > 0) parts.push(`${nRest} restituz${nRest === 1 ? 'ione' : 'ioni'}`);
  const body = parts.join(' · ');

  try {
    await sendPushToAll({
      title: '📊 Riepilogo giornata',
      body,
      url:   '/admin',
    });
  } catch (e) {
    console.error('[CRON daily-summary] push error:', e.message);
  }

  console.log(`[CRON daily-summary] Push inviata: ${body}`);
  return res.json({
    sent: true,
    prenotazioni: nPrenot,
    ritiri:       nRitiri,
    restituzioni: nRest,
    total_eur:    totalEur,
  });
});

module.exports = router;
