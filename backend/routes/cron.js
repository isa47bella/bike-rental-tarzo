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
const { removeFoto } = require('../lib/storage');
const { recordCronRun, CRON_EXPECTATIONS, checkCronHealth } = require('../lib/cronHealth');

// ─── Middleware: verifica CRON_SECRET ────────────────────────────────────────

// Confronto timing-safe: evita di rivelare il secret byte-per-byte via timing.
function safeEqual(a, b) {
  const bufA = Buffer.from(String(a ?? ''));
  const bufB = Buffer.from(String(b ?? ''));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// Data (YYYY-MM-DD) nel fuso Europe/Rome, indipendente dal fuso del server.
// I cron Vercel girano in UTC: senza questo, "domani" calcolato in UTC poteva
// sfasare di un giorno rispetto a data_ritiro (salvata come data locale IT).
// offsetGiorni: 0 = oggi, 1 = domani, -1 = ieri.
function romeDateStr(offsetGiorni = 0) {
  const oggiRoma = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date()); // formato YYYY-MM-DD
  if (offsetGiorni === 0) return oggiRoma;
  // Mezzogiorno UTC della data Roma: aggiungere/togliere giorni senza incappare nel DST.
  const d = new Date(`${oggiRoma}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offsetGiorni);
  return d.toISOString().split('T')[0];
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

// ─── Heartbeat: registra l'esecuzione riuscita di ogni cron ──────────────────
// Per le richieste cron sostituisce res.json con una versione che, su risposta
// di successo (stato 2xx), registra il battito in cron_health PRIMA di inviare
// la risposta. Su Vercel il lavoro async DOPO l'invio della risposta non è
// garantito: scrivere prima del flush rende il battito affidabile.
router.use((req, res, next) => {
  const job = req.path.split('/').pop();
  if (CRON_EXPECTATIONS[job]) {
    const sendJson = res.json.bind(res);
    res.json = async (body) => {
      if (res.statusCode < 400) await recordCronRun(job);
      return sendJson(body);
    };
  }
  next();
});

// ─── GET /api/cron/deposit ────────────────────────────────────────────────────

router.get('/deposit', cronAuth, async (req, res) => {
  // Target primario: domani (oggi + 1 giorno)
  // Fallback: oggi (per prenotazioni che ieri non hanno ricevuto la cauzione)
  const dateMain     = romeDateStr(1);
  const dateFallback = romeDateStr(0);

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
  const dateStr = romeDateStr(1);

  console.log(`[CRON firma-reminder] Cerco prenotazioni senza firma per il ${dateStr}`);

  const { data: bookings, error } = await supabase
    .from('prenotazioni')
    .select('id, cliente_nome, cliente_email, lingua, firma_token')
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
  const dateStr = romeDateStr(1);

  console.log(`[CRON reminder] Cerco prenotazioni per il ${dateStr}`);

  const { data: bookings, error } = await supabase
    .from('prenotazioni')
    .select('id, cliente_nome, cliente_email, orario_ritiro, data_ritiro, lingua')
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

  // Cancellazione a batch da 500: un DELETE unico su molti record rischierebbe
  // il timeout della serverless function (maxDuration 60s).
  let deleted = 0;
  while (true) {
    const { data: batch, error: selErr } = await supabase
      .from('prenotazioni')
      .select('id, documento_foto, documento_foto_retro, bici_foto_consegna, bici_foto_rientro')
      .lt('created_at', cutoff.toISOString())
      .limit(500);
    if (selErr) {
      console.error('[CRON gdpr-cleanup] Errore Supabase:', selErr);
      return res.status(500).json({ error: selErr.message });
    }
    if (!batch || batch.length === 0) break;
    // Prima di eliminare le righe, rimuove le foto dal bucket (per path salvato).
    for (const r of batch) {
      await removeFoto([r.documento_foto, r.documento_foto_retro, r.bici_foto_consegna, r.bici_foto_rientro]);
    }
    const { error: delErr } = await supabase
      .from('prenotazioni')
      .delete()
      .in('id', batch.map(r => r.id));
    if (delErr) {
      console.error('[CRON gdpr-cleanup] Errore delete:', delErr);
      return res.status(500).json({ error: delErr.message });
    }
    deleted += batch.length;
    if (batch.length < 500) break;
  }

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
  const today = romeDateStr(0);

  // NB: non filtriamo più su cauzione_pi_id IS NULL. Una cauzione 'failed' che ha
  // salvato un PI (es. decline che popola err.payment_intent, o salvataggio post-crash)
  // PRIMA restava esclusa per sempre → mai ritentata, mai escalata a failed_permanent.
  // Ora la includiamo e gestiamo il PI esistente verificandolo su Stripe (sotto).
  const { data: bookings, error } = await supabase
    .from('prenotazioni')
    .select('id, cliente_nome, stripe_customer_id, stripe_payment_method_id, cauzione_retry_count, cauzione_pi_id, data_ritiro')
    .eq('cauzione_status', 'failed')
    .gte('data_ritiro', today)
    .lt('cauzione_retry_count', 3);

  if (error) {
    console.error('[cron retry-cauzioni] db error:', error.message);
    return res.status(500).json({ error: error.message });
  }

  if (!bookings?.length) {
    return res.json({ retried: 0 });
  }

  const results = { ok: 0, recovered: 0, failed: 0, permanent: 0, skipped: 0 };

  for (const b of bookings) {
    if (!b.stripe_customer_id || !b.stripe_payment_method_id) {
      results.permanent++;
      await supabase.from('prenotazioni').update({ cauzione_status: 'no_card' }).eq('id', b.id);
      continue;
    }

    // LOCK ATOMICO ('failed' → 'authorizing'): rende mutuamente esclusivi due giri
    // di retry sovrapposti e il retry vs il pulsante admin 'autorizza-cauzione'.
    // Chi perde la corsa ottiene locked=null e salta (niente doppio hold da €500).
    const { data: locked } = await supabase
      .from('prenotazioni')
      .update({ cauzione_status: 'authorizing' })
      .eq('id', b.id)
      .eq('cauzione_status', 'failed')
      .select('id')
      .single();

    if (!locked) {
      results.skipped++;
      continue;
    }

    // Se esiste già un PI, verificalo su Stripe prima di crearne un altro:
    // se è un hold valido (requires_capture) recuperalo, evitando un secondo blocco.
    if (b.cauzione_pi_id) {
      try {
        const existing = await stripe.paymentIntents.retrieve(b.cauzione_pi_id);
        if (existing.status === 'requires_capture') {
          await supabase.from('prenotazioni').update({ cauzione_status: 'authorized' }).eq('id', b.id);
          results.recovered++;
          continue;
        }
      } catch (_) { /* PI non trovato su Stripe → si procede a crearne uno nuovo */ }
    }

    const newCount = (b.cauzione_retry_count || 0) + 1;
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
      }, {
        // Chiave deterministica per (prenotazione, tentativo): se la stessa riga
        // viene riprocessata con lo stesso retry_count, Stripe non crea un doppione.
        idempotencyKey: `retry-cauzione-${b.id}-${newCount}`,
      });

      const newStatus = pi.status === 'requires_capture' ? 'authorized' : 'failed';
      await supabase.from('prenotazioni').update({
        cauzione_pi_id: pi.id,
        cauzione_status: newStatus,
        cauzione_retry_count: newCount,
      }).eq('id', b.id);

      if (newStatus === 'authorized') results.ok++;
      else results.failed++;
    } catch (err) {
      const permanent = newCount >= 3;
      // Come nel cron deposit: se Stripe ha comunque creato un PI prima di fallire,
      // salvane l'id — così non resta un hold orfano e non se ne crea un secondo.
      const failedPiId = err.payment_intent?.id || err.raw?.payment_intent?.id || null;
      const upd = {
        cauzione_status: permanent ? 'failed_permanent' : 'failed',
        cauzione_retry_count: newCount,
      };
      if (failedPiId) upd.cauzione_pi_id = failedPiId;
      await supabase.from('prenotazioni').update(upd).eq('id', b.id);

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

  console.log(`[cron retry-cauzioni] ok=${results.ok} recovered=${results.recovered} failed=${results.failed} permanent=${results.permanent} skipped=${results.skipped}`);
  return res.json({ retried: bookings.length, ...results });
});

// ─── GET /api/cron/cleanup-audit ──────────────────────────────────────────────
// Elimina record audit_log più vecchi di 180 giorni.

router.get('/cleanup-audit', cronAuth, async (req, res) => {
  const cutoff = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();

  // Cancellazione a batch da 500 (vedi gdpr-cleanup): evita il timeout 60s.
  let deleted = 0;
  while (true) {
    const { data: batch, error: selErr } = await supabase
      .from('audit_log')
      .select('id')
      .lt('created_at', cutoff)
      .limit(500);
    if (selErr) {
      console.error('[cron cleanup-audit] db error:', selErr.message);
      return res.status(500).json({ error: selErr.message });
    }
    if (!batch || batch.length === 0) break;
    const { error: delErr } = await supabase
      .from('audit_log')
      .delete()
      .in('id', batch.map(r => r.id));
    if (delErr) {
      console.error('[cron cleanup-audit] delete error:', delErr.message);
      return res.status(500).json({ error: delErr.message });
    }
    deleted += batch.length;
    if (batch.length < 500) break;
  }

  console.log(`[cron cleanup-audit] eliminati ${deleted} record (cutoff ${cutoff})`);
  return res.json({ deleted, cutoff });
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

// ─── GET /api/cron/cleanup-documenti ──────────────────────────────────────────
// Cancella le foto del documento d'identità 30 giorni dopo il noleggio.
// Le foto bici NON vengono toccate (vivono quanto la prenotazione).
router.get('/cleanup-documenti', cronAuth, async (req, res) => {
  const cutoff = romeDateStr(-30); // data_ritiro più vecchia di 30 giorni

  const { data: rows, error } = await supabase
    .from('prenotazioni')
    .select('id, documento_foto, documento_foto_retro')
    .lt('data_ritiro', cutoff)
    .or('documento_foto.not.is.null,documento_foto_retro.not.is.null');

  if (error) {
    console.error('[CRON cleanup-documenti] db error:', error.message);
    return res.status(500).json({ error: error.message });
  }

  const scanned = (rows || []).length;
  let cleaned = 0;
  for (const r of (rows || [])) {
    await removeFoto([r.documento_foto, r.documento_foto_retro]);
    const { error: updErr } = await supabase
      .from('prenotazioni')
      .update({ documento_foto: null, documento_foto_retro: null })
      .eq('id', r.id);
    if (updErr) {
      console.error(`[CRON cleanup-documenti] update error ${r.id}:`, updErr.message);
    } else {
      cleaned++;
    }
  }

  console.log(`[CRON cleanup-documenti] ${cleaned}/${scanned} documenti cancellati (cutoff ${cutoff})`);
  return res.json({ cleaned, scanned, cutoff });
});

// ─── GET /api/cron/cron-health ────────────────────────────────────────────────
// Cron guardiano: verifica che ogni cron abbia un battito recente.
// Schedule: 0 22 * * * UTC — dopo che tutti i cron giornalieri hanno girato.
router.get('/cron-health', cronAuth, async (req, res) => {
  let down;
  try {
    down = await checkCronHealth();
  } catch (e) {
    console.error('[CRON cron-health] errore:', e.message);
    return res.status(500).json({ error: e.message });
  }

  if (down.length === 0) {
    console.log('[CRON cron-health] Tutti i cron OK');
    return res.json({ ok: true, down: [] });
  }

  const nomi = down.map(d => d.job).join(', ');
  const dettaglio = down
    .map(d => d.ageHours == null ? `${d.job} (mai eseguito)` : `${d.job} (${d.ageHours}h fa)`)
    .join(', ');
  console.warn(`[CRON cron-health] Cron in ritardo: ${dettaglio}`);

  await sendPushToAll({
    title: '⚠️ Cron non eseguiti',
    body:  `${nomi} — controlla i log su Vercel`,
    url:   '/admin',
  }).catch(e => console.error('[CRON cron-health] push error:', e.message));

  await writeNotification('cron_down', {
    titolo: `Cron non eseguiti: ${nomi}`,
    descrizione: `Ultimo battito: ${dettaglio}. Controlla i log su Vercel.`,
  }).catch(_ => {});

  return res.json({ ok: false, down });
});

// ─── GET /api/cron/reconcile-cauzioni ─────────────────────────────────────────
// Rete di sicurezza: allinea lo stato cauzione del DB alla realtà di Stripe.
// NON cattura e NON addebita mai — si limita a recuperare/segnalare.
//   (A) Righe bloccate in 'authorizing' (processo morto a metà): cerca su Stripe
//       l'eventuale hold orfano e lo adotta; se non esiste, riporta a 'failed'
//       (così il cron retry potrà riprovare per i ritiri futuri).
//   (B) Cauzioni 'authorized' il cui hold su Stripe è 'canceled' (scaduto ~7 giorni
//       o annullato fuori dall'app): aggiorna lo stato e avvisa il gestore.
router.get('/reconcile-cauzioni', cronAuth, async (req, res) => {
  const out = { authorizing_scanned: 0, recovered: 0, reset: 0, authorized_scanned: 0, lost: 0, errors: 0 };

  // ── (A) Righe appese in 'authorizing' ──
  const { data: stuck, error: stuckErr } = await supabase
    .from('prenotazioni')
    .select('id, cliente_nome, stripe_customer_id, cauzione_pi_id, data_ritiro')
    .eq('cauzione_status', 'authorizing');

  if (stuckErr) {
    console.error('[reconcile-cauzioni] db error (authorizing):', stuckErr.message);
    return res.status(500).json({ error: stuckErr.message });
  }

  for (const b of (stuck || [])) {
    out.authorizing_scanned++;
    try {
      let holdPi = null;

      // 1) Se conosciamo già un PI, verifichiamo che sia un hold valido.
      if (b.cauzione_pi_id) {
        try {
          const pi = await stripe.paymentIntents.retrieve(b.cauzione_pi_id);
          if (pi.status === 'requires_capture') holdPi = pi;
        } catch (_) { /* PI non trovato */ }
      }

      // 2) Altrimenti cerchiamo tra i PI recenti del cliente un hold cauzione
      //    valido (capture manuale, importo cauzione, requires_capture).
      if (!holdPi && b.stripe_customer_id) {
        const list = await stripe.paymentIntents.list({ customer: b.stripe_customer_id, limit: 10 });
        holdPi = (list.data || []).find(pi =>
          pi.status === 'requires_capture' &&
          pi.amount === CAUZIONE_AMOUNT_CENTS &&
          pi.capture_method === 'manual'
        ) || null;
      }

      if (holdPi) {
        // Hold orfano trovato → adottalo (guardia sullo stato per non sovrascrivere
        // un cambiamento concorrente).
        await supabase.from('prenotazioni')
          .update({ cauzione_pi_id: holdPi.id, cauzione_status: 'authorized' })
          .eq('id', b.id)
          .eq('cauzione_status', 'authorizing');
        out.recovered++;
      } else {
        // Nessun hold reale: la riga era solo "appesa" → torna a 'failed'
        // (il cron retry riproverà per i ritiri futuri).
        await supabase.from('prenotazioni')
          .update({ cauzione_status: 'failed' })
          .eq('id', b.id)
          .eq('cauzione_status', 'authorizing');
        out.reset++;
      }
    } catch (e) {
      out.errors++;
      console.error(`[reconcile-cauzioni] authorizing ${b.id}:`, e.message);
    }
  }

  // ── (B) Cauzioni 'authorized' con hold non più valido su Stripe ──
  // Orizzonte limitato (ritiri ultimi 30 giorni o futuri) per non scandire righe vecchie.
  const horizon = romeDateStr(-30);
  const { data: authd, error: authErr } = await supabase
    .from('prenotazioni')
    .select('id, cliente_nome, cauzione_pi_id, data_ritiro')
    .eq('cauzione_status', 'authorized')
    .not('cauzione_pi_id', 'is', null)
    .gte('data_ritiro', horizon);

  if (authErr) {
    console.error('[reconcile-cauzioni] db error (authorized):', authErr.message);
    return res.status(500).json({ ...out, error: authErr.message });
  }

  for (const b of (authd || [])) {
    out.authorized_scanned++;
    try {
      const pi = await stripe.paymentIntents.retrieve(b.cauzione_pi_id);
      // Solo 'canceled' = hold perso (scaduto/annullato). 'succeeded' = già catturato
      // (gestito da capture-deposit), 'requires_capture' = ancora valido → non toccare.
      if (pi.status === 'canceled') {
        await supabase.from('prenotazioni')
          .update({ cauzione_status: 'failed' })
          .eq('id', b.id)
          .eq('cauzione_status', 'authorized');
        out.lost++;
        const eur = CAUZIONE_AMOUNT_CENTS / 100;
        await sendPushToAll({
          title: '⚠️ Cauzione non più valida',
          body:  `${b.cliente_nome} (${b.data_ritiro}) — hold da €${eur} scaduto/annullato`,
          url:   '/admin',
        }).catch(() => {});
        await writeNotification('cauzione_lost', {
          titolo: `Cauzione non più valida — ${b.cliente_nome}`,
          descrizione: `L'hold da €${eur} non è più catturabile (Stripe: canceled). Per i ritiri futuri il retry proverà a ribloccarla; verifica se serve agire.`,
          booking_id: b.id,
        }).catch(() => {});
      }
    } catch (e) {
      out.errors++;
      console.error(`[reconcile-cauzioni] authorized ${b.id}:`, e.message);
    }
  }

  console.log(`[reconcile-cauzioni] ${JSON.stringify(out)}`);
  return res.json(out);
});

module.exports = router;
