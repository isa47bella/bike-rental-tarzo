/**
 * Admin routes (protette da token)
 * GET  /api/admin/bookings              — lista prenotazioni (con filtri)
 * GET  /api/admin/bookings/:id          — dettaglio singola
 * POST /api/admin/bookings/:id/cancel   — cancella prenotazione
 * GET  /api/admin/stats                 — statistiche rapide
 */

const express  = require('express');
const router   = express.Router();
const crypto   = require('crypto');
const stripe   = require('stripe')(process.env.STRIPE_SECRET_KEY);
const supabase = require('../lib/supabase');
const { CONTRATTO_TERMS, TIPO_LABEL, CONTRATTO_TITLE, CONTRATTO_FIELDS, LOCALE_MAP } = require('../lib/contratto-terms');
const { sendPushToAll } = require('../lib/push');
const { sendAdminEmail, sendFirmaLinkEmail, sendWhatsAppAlert } = require('../lib/email');
const { calcRange, calcRestituzione, getStagione, calcolaPrezzo } = require('./availability');
const { logAction }                         = require('../lib/auditLog');
const { CAUZIONE_AMOUNT_EUR }               = require('../lib/config');

const getIp = req => req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || null;

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
      stripe_payment_method_id, danno_status, danno_amount,
      cauzione_status, cauzione_captured_amount, accessori,
      checkin_at, checkout_at,
      firma_at, firma_nome, note_admin
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
  // Carica lo stato attuale per gestire correttamente eventuale cauzione attiva
  const { data: current, error: loadErr } = await supabase
    .from('prenotazioni')
    .select('cauzione_pi_id, cauzione_status, cliente_nome')
    .eq('id', req.params.id)
    .single();

  if (loadErr || !current) return res.status(404).json({ error: 'Prenotazione non trovata' });

  // Se c'è una cauzione autorizzata/in autorizzazione su Stripe, rilascia la hold
  // PRIMA di marcare la prenotazione come cancellata, così la carta del cliente
  // non resta bloccata per i €500.
  let cauzioneReleased = false;
  if (current.cauzione_pi_id && ['authorized', 'authorizing'].includes(current.cauzione_status)) {
    try {
      await stripe.paymentIntents.cancel(current.cauzione_pi_id);
      cauzioneReleased = true;
    } catch (e) {
      // Stripe restituisce payment_intent_unexpected_state se il PI è già cancelled/expired
      // su Stripe — in quel caso possiamo proseguire senza errore.
      if (e.code !== 'payment_intent_unexpected_state') {
        console.error('[cancel] Errore release cauzione Stripe:', e.message);
        return res.status(502).json({ error: 'Impossibile rilasciare la cauzione su Stripe: ' + e.message });
      }
      cauzioneReleased = true;
    }
  }

  const update = { pagamento_status: 'cancelled' };
  if (cauzioneReleased) update.cauzione_status = 'cancelled';

  const { data, error } = await supabase
    .from('prenotazioni')
    .update(update)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  await logAction('cancel', req.params.id, { nome: data.cliente_nome, cauzione_released: cauzioneReleased }, getIp(req));
  return res.json({ success: true, booking: data, cauzione_released: cauzioneReleased });
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

    await logAction('charge_damage', req.params.id, { amount: amountNum, motivo: motivo || '', pi_id: paymentIntent.id }, getIp(req));
    return res.json({ success: true, payment_intent_id: paymentIntent.id });
  } catch (stripeError) {
    console.error('Stripe charge-damage error:', stripeError);
    return res.status(402).json({ error: stripeError.message || 'Pagamento rifiutato dalla carta' });
  }
});

// ─── POST /api/admin/bookings/:id/autorizza-cauzione ─────────────────────────
// Autorizza manualmente la cauzione (per prenotazioni pending/failed)

router.post('/bookings/:id/autorizza-cauzione', async (req, res) => {
  const { data: prenotazione, error } = await supabase
    .from('prenotazioni')
    .select('id, cliente_nome, stripe_customer_id, stripe_payment_method_id, cauzione_status, cauzione_pi_id, pagamento_status')
    .eq('id', req.params.id)
    .single();

  if (error || !prenotazione) return res.status(404).json({ error: 'Prenotazione non trovata' });
  if (prenotazione.pagamento_status !== 'paid') return res.status(400).json({ error: 'Prenotazione non pagata' });
  if (prenotazione.cauzione_status === 'authorized')  return res.status(400).json({ error: 'Cauzione già autorizzata' });
  if (prenotazione.cauzione_status === 'captured')    return res.status(400).json({ error: 'Cauzione già incassata' });
  if (prenotazione.cauzione_status === 'authorizing') return res.status(409).json({ error: 'Autorizzazione già in corso — riprova tra qualche secondo' });
  if (prenotazione.cauzione_status === 'no_card')     return res.status(400).json({ error: 'Nessuna carta Stripe salvata (prenotazione manuale)' });

  if (!prenotazione.stripe_customer_id || !prenotazione.stripe_payment_method_id) {
    return res.status(400).json({ error: 'Metodo di pagamento non disponibile — il cliente deve ricontattarci' });
  }

  // Se esiste già un cauzione_pi_id, verifica su Stripe prima di crearne un altro
  if (prenotazione.cauzione_pi_id) {
    try {
      const existingPi = await stripe.paymentIntents.retrieve(prenotazione.cauzione_pi_id);
      if (existingPi.status === 'requires_capture') {
        // PI già autorizzato su Stripe ma DB non aggiornato (crash precedente)
        await supabase.from('prenotazioni').update({ cauzione_status: 'authorized' }).eq('id', req.params.id);
        await logAction('autorizza_cauzione', req.params.id, { status: 'authorized', note: 'recuperato da Stripe', pi_id: existingPi.id }, getIp(req));
        return res.json({ success: true, status: 'authorized', note: 'recuperato da Stripe', payment_intent_id: existingPi.id });
      }
      // PI esiste ma non è valido (canceled/failed) → procedi a crearne uno nuovo
    } catch (_) {
      // PI non trovato su Stripe → procedi a crearne uno nuovo
    }
  }

  // LOCK ATOMICO: impedisce doppio click o esecuzione contemporanea con il cron
  const { data: locked } = await supabase
    .from('prenotazioni')
    .update({ cauzione_status: 'authorizing' })
    .eq('id', req.params.id)
    .or('cauzione_status.eq.pending,cauzione_status.is.null,cauzione_status.eq.failed')
    .select('id')
    .single();

  if (!locked) {
    return res.status(409).json({ error: 'Autorizzazione già in corso — riprova tra qualche secondo' });
  }

  try {
    const pi = await stripe.paymentIntents.create({
      amount:         50000,
      currency:       'eur',
      customer:       prenotazione.stripe_customer_id,
      payment_method: prenotazione.stripe_payment_method_id,
      capture_method: 'manual',
      confirm:        true,
      off_session:    true,
      description:    `Cauzione bici — ${prenotazione.cliente_nome} (${prenotazione.id.substring(0, 8)})`,
    });

    const status = pi.status === 'requires_capture' ? 'authorized' : 'failed';
    await supabase
      .from('prenotazioni')
      .update({ cauzione_pi_id: pi.id, cauzione_status: status })
      .eq('id', req.params.id);

    await logAction('autorizza_cauzione', req.params.id, { status, pi_id: pi.id }, getIp(req));
    return res.json({ success: true, status, payment_intent_id: pi.id });
  } catch (e) {
    await supabase.from('prenotazioni').update({ cauzione_status: 'failed' }).eq('id', req.params.id);
    return res.status(402).json({ error: e.message || 'Errore Stripe' });
  }
});

// ─── POST /api/admin/bookings/:id/release-deposit ────────────────────────────
// Rilascia la cauzione (bici restituita senza danni)

router.post('/bookings/:id/release-deposit', async (req, res) => {
  const { data: prenotazione, error } = await supabase
    .from('prenotazioni')
    .select('cauzione_pi_id, cauzione_status, cliente_nome')
    .eq('id', req.params.id)
    .single();

  if (error || !prenotazione) return res.status(404).json({ error: 'Prenotazione non trovata' });
  if (!prenotazione.cauzione_pi_id) return res.status(400).json({ error: 'Nessuna cauzione attiva' });
  if (prenotazione.cauzione_status !== 'authorized') {
    return res.status(400).json({ error: `Cauzione non rilasciabile (stato: ${prenotazione.cauzione_status})` });
  }

  try {
    await stripe.paymentIntents.cancel(prenotazione.cauzione_pi_id);
    await supabase
      .from('prenotazioni')
      .update({ cauzione_status: 'cancelled' })
      .eq('id', req.params.id);
    await logAction('release_deposit', req.params.id, { pi_id: prenotazione.cauzione_pi_id }, getIp(req));
    return res.json({ success: true });
  } catch (e) {
    console.error('Errore release deposit:', e);
    return res.status(402).json({ error: e.message || 'Errore Stripe' });
  }
});

// ─── POST /api/admin/bookings/:id/capture-deposit ────────────────────────────
// Incassa la cauzione per danni (importo ≤ €500)

router.post('/bookings/:id/capture-deposit', async (req, res) => {
  const { amount, motivo } = req.body;
  const amountNum = parseFloat(amount);
  if (!amountNum || amountNum <= 0 || amountNum > CAUZIONE_AMOUNT_EUR) {
    return res.status(400).json({ error: `Importo non valido (max €${CAUZIONE_AMOUNT_EUR})` });
  }

  const { data: prenotazione, error } = await supabase
    .from('prenotazioni')
    .select('cauzione_pi_id, cauzione_status, cliente_nome')
    .eq('id', req.params.id)
    .single();

  if (error || !prenotazione) return res.status(404).json({ error: 'Prenotazione non trovata' });
  if (!prenotazione.cauzione_pi_id) return res.status(400).json({ error: 'Nessuna cauzione attiva' });
  if (prenotazione.cauzione_status !== 'authorized') {
    return res.status(400).json({ error: `Cauzione non incassabile (stato: ${prenotazione.cauzione_status})` });
  }

  try {
    await stripe.paymentIntents.capture(prenotazione.cauzione_pi_id, {
      amount_to_capture: Math.round(amountNum * 100),
    });
    await supabase
      .from('prenotazioni')
      .update({
        cauzione_status:           'captured',
        cauzione_captured_amount:  amountNum,
      })
      .eq('id', req.params.id);
    await logAction('capture_deposit', req.params.id, { amount: amountNum, motivo: motivo || '' }, getIp(req));
    return res.json({ success: true });
  } catch (e) {
    console.error('Errore capture deposit:', e);
    return res.status(402).json({ error: e.message || 'Errore Stripe' });
  }
});

// ─── POST /api/admin/bookings/:id/refund-deposit ──────────────────────────────
// Rimborsa una cauzione già catturata (totale o parziale).
// Body: { amount?: number } — se omesso, rimborso totale del captured_amount

router.post('/bookings/:id/refund-deposit', async (req, res) => {
  const { amount } = req.body;

  const { data: p, error } = await supabase
    .from('prenotazioni')
    .select('cauzione_pi_id, cauzione_status, cauzione_captured_amount, cliente_nome')
    .eq('id', req.params.id)
    .single();

  if (error || !p) return res.status(404).json({ error: 'Prenotazione non trovata' });
  if (!p.cauzione_pi_id) return res.status(400).json({ error: 'Nessuna cauzione attiva' });
  if (p.cauzione_status !== 'captured') {
    return res.status(400).json({ error: `Cauzione non rimborsabile (stato: ${p.cauzione_status})` });
  }

  const capturedAmount = Number(p.cauzione_captured_amount || 0);
  const refundAmount   = amount != null ? parseFloat(amount) : capturedAmount;
  if (!refundAmount || refundAmount <= 0 || refundAmount > capturedAmount + 0.01) {
    return res.status(400).json({ error: `Importo non valido (max €${capturedAmount.toFixed(2)})` });
  }

  try {
    const refund = await stripe.refunds.create({
      payment_intent: p.cauzione_pi_id,
      amount:         Math.round(refundAmount * 100),
      metadata:       { booking_id: req.params.id, kind: 'cauzione' },
    });

    const newCaptured = Number((capturedAmount - refundAmount).toFixed(2));
    const isFull      = newCaptured <= 0.01;

    await supabase
      .from('prenotazioni')
      .update({
        cauzione_status:           isFull ? 'refunded' : 'captured',
        cauzione_captured_amount:  isFull ? null : newCaptured,
      })
      .eq('id', req.params.id);

    await logAction('refund_deposit', req.params.id, {
      amount: refundAmount, refund_id: refund.id, full: isFull,
    }, getIp(req));

    return res.json({ success: true, refunded: refundAmount, remaining: isFull ? 0 : newCaptured });
  } catch (e) {
    console.error('Errore refund deposit:', e);
    return res.status(402).json({ error: e.message || 'Errore Stripe' });
  }
});

// ─── POST /api/admin/bookings/:id/send-email ──────────────────────────────────
// Invia email personalizzata al cliente dall'admin panel

router.post('/bookings/:id/send-email', async (req, res) => {
  const { subject, message } = req.body;
  if (!subject?.trim() || !message?.trim()) {
    return res.status(400).json({ error: 'Oggetto e messaggio sono obbligatori' });
  }

  const { data: prenotazione, error } = await supabase
    .from('prenotazioni')
    .select('id, cliente_nome, cliente_email, data_ritiro')
    .eq('id', req.params.id)
    .single();

  if (error || !prenotazione) {
    return res.status(404).json({ error: 'Prenotazione non trovata' });
  }

  try {
    await sendAdminEmail(prenotazione, subject.trim(), message.trim());
    console.log(`[admin send-email] Email inviata a ${prenotazione.cliente_email} — "${subject}"`);
    await logAction('send_email', req.params.id, { subject: subject.trim(), to: prenotazione.cliente_email }, getIp(req));
    return res.json({ success: true });
  } catch (e) {
    console.error('[admin send-email] Errore:', e.message);
    return res.status(500).json({ error: 'Errore invio email: ' + e.message });
  }
});

// ─── POST /api/admin/bookings/:id/send-firma ─────────────────────────────────

router.post('/bookings/:id/send-firma', async (req, res) => {
  const { data: p, error } = await supabase
    .from('prenotazioni')
    .select('id, cliente_nome, cliente_email, lingua, firma_at')
    .eq('id', req.params.id)
    .single();

  if (error || !p) return res.status(404).json({ error: 'Prenotazione non trovata' });
  if (!p.cliente_email || p.cliente_email === 'noemail@bikerentaltarzo.it') {
    return res.status(400).json({ error: 'Nessuna email per questo cliente' });
  }

  try {
    await sendFirmaLinkEmail(p);
    await logAction('send_firma', req.params.id, { email: p.cliente_email }, getIp(req));
    return res.json({ success: true });
  } catch (e) {
    console.error('[send-firma]', e.message);
    return res.status(500).json({ error: 'Errore invio email: ' + e.message });
  }
});

// ─── GET /api/admin/oggi ──────────────────────────────────────────────────────

router.get('/oggi', async (req, res) => {
  const oggi = new Date().toISOString().substring(0, 10);
  const fields = `id, cliente_nome, cliente_email, cliente_telefono, bicicletta_id,
    tipo_noleggio, giorni, data_ritiro, orario_ritiro, data_restituzione,
    orario_restituzione, prezzo_totale, pagamento_status, cauzione_status,
    checkin_at, checkout_at, accessori, firma_at, firma_nome`;

  const [
    { data: ritiri },
    { data: restituzioni },
    { data: inRitardo },
  ] = await Promise.all([
    supabase.from('prenotazioni').select(fields).eq('pagamento_status', 'paid').eq('data_ritiro', oggi).order('orario_ritiro'),
    supabase.from('prenotazioni').select(fields).eq('pagamento_status', 'paid').eq('data_restituzione', oggi).order('orario_restituzione'),
    supabase.from('prenotazioni').select(fields).eq('pagamento_status', 'paid').lt('data_restituzione', oggi).is('checkout_at', null),
  ]);

  return res.json({
    ritiri:       ritiri       || [],
    restituzioni: restituzioni || [],
    inRitardo:    inRitardo    || [],
    data:         oggi,
  });
});

// ─── GET /api/admin/flotta ────────────────────────────────────────────────────

router.get('/flotta', async (req, res) => {
  const { data, error } = await supabase.from('biciclette').select('*').order('id');
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ bici: data || [] });
});

// ─── PATCH /api/admin/flotta/:id ─────────────────────────────────────────────

router.patch('/flotta/:id', async (req, res) => {
  const allowed = ['stato', 'note_admin', 'ultima_manutenzione', 'prossima_manutenzione'];
  const update = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      update[key] = req.body[key] === '' ? null : req.body[key];
    }
  }
  const { data, error } = await supabase.from('biciclette').update(update).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  await logAction('flotta_update', null, { bici_id: req.params.id, changes: update }, getIp(req));
  return res.json(data);
});

// ─── POST /api/admin/bookings/:id/checkin ────────────────────────────────────

router.post('/bookings/:id/checkin', async (req, res) => {
  const { checkin_note, documento_foto, documento_foto_retro, bici_foto_consegna } = req.body;
  const update = { checkin_at: new Date().toISOString() };
  if (checkin_note)          update.checkin_note          = checkin_note;
  if (documento_foto)        update.documento_foto        = documento_foto;
  if (documento_foto_retro)  update.documento_foto_retro  = documento_foto_retro;
  if (bici_foto_consegna)    update.bici_foto_consegna    = bici_foto_consegna;

  const { data, error } = await supabase.from('prenotazioni').update(update).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  await logAction('checkin', req.params.id, {}, getIp(req));
  return res.json(data);
});

// ─── POST /api/admin/bookings/:id/checkout ───────────────────────────────────

router.post('/bookings/:id/checkout', async (req, res) => {
  const { checkout_note, bici_foto_rientro } = req.body;
  const update = { checkout_at: new Date().toISOString() };
  if (checkout_note)   update.checkout_note   = checkout_note;
  if (bici_foto_rientro) update.bici_foto_rientro = bici_foto_rientro;

  const { data, error } = await supabase.from('prenotazioni').update(update).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  await logAction('checkout_bici', req.params.id, {}, getIp(req));
  return res.json(data);
});

// ─── GET /api/admin/report ────────────────────────────────────────────────────

router.get('/report', async (req, res) => {
  const { data: all, error } = await supabase
    .from('prenotazioni')
    .select('prezzo_totale, tipo_noleggio, giorni, data_ritiro')
    .eq('pagamento_status', 'paid');

  if (error) return res.status(500).json({ error: error.message });

  const byMonth = {};
  const byType  = {};
  let total = 0;

  (all || []).forEach(b => {
    const n = Number(b.prezzo_totale);
    total += n;
    const month = b.data_ritiro ? b.data_ritiro.substring(0, 7) : 'unknown';
    byMonth[month] = (byMonth[month] || 0) + n;
    byType[b.tipo_noleggio] = (byType[b.tipo_noleggio] || 0) + n;
  });

  const months = Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([m, v]) => ({ month: m, revenue: parseFloat(v.toFixed(2)) }));

  return res.json({
    total_revenue:  total.toFixed(2),
    total_bookings: (all || []).length,
    avg_booking:    all?.length ? (total / all.length).toFixed(2) : '0',
    by_month:       months,
    by_type:        byType,
  });
});

// ─── POST /api/admin/bookings/manual ─────────────────────────────────────────
// Crea prenotazione manuale (walk-in / telefono) senza Stripe.
// Pricing: SEASONAL_PRICES + tipo bici (allineato al sito) — vedi availability.js

const TIPO_IDS_BICI   = { ecity: [1,2], emtb: [3,4,5,6,7,8,9], bimbo: [10] };
const ACC_PREZZI      = { casco: 2, lucchetto: 1 };

function getBikeTypeFromId(id) {
  const n = Number(id);
  for (const [tipo, ids] of Object.entries(TIPO_IDS_BICI)) {
    if (ids.includes(n)) return tipo;
  }
  return 'ecity';
}

router.post('/bookings/manual', async (req, res) => {
  const {
    cliente_nome, cliente_telefono,
    cliente_email   = '',
    cliente_note    = '',
    tipo_noleggio, data_ritiro,
    giorni          = 1,
    bicicletta_id:  forcedBiciId,
    bike_type:      bikeTypeOverride,
    bici:           biciArrayInput,
    accessori:      accessoriRaw = [],
    accessori_qty:  accessoriQtyInput,
    prezzo_totale:  prezzoOverride,
    note_pagamento  = '',
  } = req.body;

  if (!cliente_nome?.trim() || !data_ritiro || !tipo_noleggio) {
    return res.status(400).json({ error: 'Campi obbligatori mancanti (nome, data, tipo)' });
  }

  const TIPI_VALIDI = ['mezza_mattina', 'mezza_pomeriggio', 'intera_giornata', 'multi_giorno'];
  if (!TIPI_VALIDI.includes(tipo_noleggio)) {
    return res.status(400).json({ error: 'Tipo noleggio non valido' });
  }
  if (tipo_noleggio === 'multi_giorno' && Number(giorni) < 2) {
    return res.status(400).json({ error: 'Multi-giorno richiede almeno 2 giorni' });
  }

  const numGiorni = Number(giorni);
  const { start, end } = calcRange(data_ritiro, tipo_noleggio, numGiorni);
  const { data_restituzione, orario_restituzione, orario_ritiro } = calcRestituzione(data_ritiro, tipo_noleggio, numGiorni);

  // Trova bici disponibile
  const { data: conflitti } = await supabase
    .from('prenotazioni')
    .select('bicicletta_id')
    .eq('pagamento_status', 'paid')
    .lt('start_ts', end.toISOString())
    .gt('end_ts', start.toISOString());

  const occupate = new Set((conflitti || []).map(r => r.bicicletta_id));

  // Normalizza l'input: tre modi supportati
  //   1) bici: [{ bike_type, quantita }, ...]                  → multi-bici (es. famiglia)
  //   2) bicicletta_id: N                                       → singola bici forzata
  //   3) bike_type: 'ecity' (legacy)                            → singola bici auto-assegnata
  const VALID_TYPES = ['ecity', 'emtb', 'bimbo'];
  let biciRequests; // array di { bike_type, quantita } da assegnare

  if (Array.isArray(biciArrayInput) && biciArrayInput.length > 0) {
    biciRequests = biciArrayInput
      .filter(b => VALID_TYPES.includes(b.bike_type) && Number(b.quantita) > 0)
      .map(b => ({ bike_type: b.bike_type, quantita: Math.min(Number(b.quantita), 10) }));
    if (!biciRequests.length) {
      return res.status(400).json({ error: 'Nessuna bici valida richiesta nel campo bici[]' });
    }
  } else if (forcedBiciId) {
    biciRequests = null; // gestito separatamente sotto
  } else {
    const bt = VALID_TYPES.includes(bikeTypeOverride) ? bikeTypeOverride : 'ecity';
    biciRequests = [{ bike_type: bt, quantita: 1 }];
  }

  // Assegnazione bici
  const assignedBikes = []; // [{ bicicletta_id, bike_type }]

  if (forcedBiciId) {
    if (occupate.has(Number(forcedBiciId))) {
      return res.status(409).json({ error: `Bici #${forcedBiciId} già occupata in questa fascia oraria` });
    }
    assignedBikes.push({
      bicicletta_id: Number(forcedBiciId),
      bike_type:     getBikeTypeFromId(forcedBiciId),
    });
  } else {
    for (const r of biciRequests) {
      const pool   = TIPO_IDS_BICI[r.bike_type];
      const libere = pool.filter(id => !occupate.has(id));
      if (libere.length < r.quantita) {
        return res.status(409).json({
          error: `Non ci sono abbastanza bici di tipo ${r.bike_type} disponibili (richieste ${r.quantita}, disponibili ${libere.length})`,
        });
      }
      for (let i = 0; i < r.quantita; i++) {
        const bid = libere[i];
        assignedBikes.push({ bicicletta_id: bid, bike_type: r.bike_type });
        occupate.add(bid); // previene doppia assegnazione nella stessa richiesta
      }
    }
  }

  // Accessori: due modalità supportate
  //  (a) accessori_qty: { casco: N, lucchetto: M } — distribuzione per bici (max N ≤ totBici)
  //  (b) accessori: ['casco','lucchetto'] — applicato a TUTTE le bici (legacy / website)
  const totBici = assignedBikes.length;
  const accessoriPerRow = assignedBikes.map(() => []); // [['casco'], ['casco','lucchetto'], ...]
  const accCostPerRow   = assignedBikes.map(() => 0);

  if (accessoriQtyInput && typeof accessoriQtyInput === 'object') {
    for (const [acc, qty] of Object.entries(accessoriQtyInput)) {
      if (!ACC_PREZZI[acc]) continue;
      const n = Math.max(0, Math.min(Number(qty) || 0, totBici));
      for (let i = 0; i < n; i++) {
        accessoriPerRow[i].push(acc);
        accCostPerRow[i] += ACC_PREZZI[acc];
      }
    }
  } else {
    const accArr = (Array.isArray(accessoriRaw) ? accessoriRaw : []).filter(a => ACC_PREZZI[a]);
    const accCostPerBike = accArr.reduce((sum, a) => sum + ACC_PREZZI[a], 0);
    for (let i = 0; i < totBici; i++) {
      accessoriPerRow[i] = [...accArr];
      accCostPerRow[i]   = accCostPerBike;
    }
  }

  // Pricing: per ogni bici applichiamo SEASONAL_PRICES + accessori effettivi della riga.
  // prezzoOverride (se fornito) = prezzo totale per TUTTE le bici; viene distribuito
  // equamente sulle righe (con eventuale resto sulla prima) per mantenere la somma esatta.
  let prezziPerBici; // array stesso indice di assignedBikes
  if (prezzoOverride !== undefined && prezzoOverride !== null && prezzoOverride !== '') {
    const totale = parseFloat(prezzoOverride);
    const each   = Math.floor((totale / totBici) * 100) / 100;
    const remainder = +(totale - each * totBici).toFixed(2);
    prezziPerBici = assignedBikes.map((_, i) => i === 0 ? +(each + remainder).toFixed(2) : each);
  } else {
    const stagione = getStagione(data_ritiro);
    if (!stagione) {
      return res.status(400).json({
        error: 'Data fuori stagione: indica un prezzo manuale (prezzo_totale) per procedere',
        fuori_stagione: true,
      });
    }
    prezziPerBici = assignedBikes.map((b, i) =>
      calcolaPrezzo(b.bike_type, tipo_noleggio, numGiorni, data_ritiro) + accCostPerRow[i]
    );
  }

  const noteFinale = [cliente_note, note_pagamento ? `Pagamento: ${note_pagamento}` : ''].filter(Boolean).join(' | ');

  // Group id sintetico (riusa stripe_session_id) per legare le righe della stessa prenotazione
  const groupId = `manual_${crypto.randomUUID()}`;

  const insertData = assignedBikes.map((b, i) => ({
    cliente_nome:        cliente_nome.trim(),
    cliente_email:       cliente_email.trim() || 'noemail@bikerentaltarzo.it',
    cliente_telefono:    (cliente_telefono || '').trim(),
    cliente_note:        noteFinale || null,
    bicicletta_id:       b.bicicletta_id,
    tipo_noleggio,
    giorni:              numGiorni,
    data_ritiro,
    orario_ritiro,
    data_restituzione,
    orario_restituzione,
    start_ts:            start.toISOString(),
    end_ts:              end.toISOString(),
    prezzo_totale:       prezziPerBici[i],
    accessori:           accessoriPerRow[i].join(','),
    pagamento_status:    'paid',
    stripe_session_id:   groupId,
  }));

  const { data: prenotazioni, error } = await supabase
    .from('prenotazioni')
    .insert(insertData)
    .select();

  if (error || !prenotazioni?.length) {
    console.error('Errore prenotazione manuale:', error);
    return res.status(500).json({ error: error?.message || 'Errore creazione prenotazioni' });
  }

  // WhatsApp alert sul lead (totale aggregato)
  const totaleAggregato = prenotazioni.reduce((s, p) => s + Number(p.prezzo_totale), 0);
  const leadAlert = { ...prenotazioni[0], prezzo_totale: totaleAggregato, _total_bikes: prenotazioni.length };
  sendWhatsAppAlert(leadAlert).catch(e => console.error('WhatsApp manual:', e));

  await logAction('manual_booking', prenotazioni[0].id, {
    nome: cliente_nome, tipo: tipo_noleggio, data: data_ritiro,
    bici_count: prenotazioni.length,
    bici_ids: prenotazioni.map(p => p.bicicletta_id),
    group_id: groupId,
  }, getIp(req));

  // Backward compat: ritorniamo .booking (singola, lead) + .bookings (array completo)
  return res.json({
    success:  true,
    booking:  prenotazioni[0],
    bookings: prenotazioni,
    total:    totaleAggregato,
  });
});

// ─── GET /api/admin/chiusure ──────────────────────────────────────────────────

router.get('/chiusure', async (req, res) => {
  const { data, error } = await supabase
    .from('chiusure')
    .select('*')
    .order('data', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ chiusure: data || [] });
});

// ─── POST /api/admin/chiusure ─────────────────────────────────────────────────

router.post('/chiusure', async (req, res) => {
  const { data: dateInput, motivo = '' } = req.body;
  if (!dateInput || !/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    return res.status(400).json({ error: 'Data non valida (formato: YYYY-MM-DD)' });
  }
  const { data, error } = await supabase
    .from('chiusure')
    .insert({ data: dateInput, motivo: motivo.trim() })
    .select()
    .single();
  if (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Questa data è già bloccata' });
    return res.status(500).json({ error: error.message });
  }
  await logAction('chiusura_add', null, { data: dateInput, motivo: motivo.trim() }, getIp(req));
  return res.json({ success: true, chiusura: data });
});

// ─── DELETE /api/admin/chiusure/:id ──────────────────────────────────────────

router.delete('/chiusure/:id', async (req, res) => {
  const { error } = await supabase
    .from('chiusure')
    .delete()
    .eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  await logAction('chiusura_delete', null, { chiusura_id: req.params.id }, getIp(req));
  return res.json({ success: true });
});

// ─── GET /api/admin/cauzioni ─────────────────────────────────────────────────

router.get('/cauzioni', async (req, res) => {
  // Mostra tutte le prenotazioni paid degli ultimi 90 giorni + prossimi 30
  const from = new Date();
  from.setDate(from.getDate() - 90);
  const to = new Date();
  to.setDate(to.getDate() + 30);

  const { data, error } = await supabase
    .from('prenotazioni')
    .select('id, cliente_nome, cliente_email, bicicletta_id, data_ritiro, data_restituzione, cauzione_status, cauzione_pi_id, cauzione_captured_amount, pagamento_status, prezzo_totale, tipo_noleggio')
    .eq('pagamento_status', 'paid')
    .gte('data_ritiro', from.toISOString().split('T')[0])
    .lte('data_ritiro', to.toISOString().split('T')[0])
    .order('data_ritiro', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ cauzioni: data || [] });
});

// ─── GET /api/admin/config ────────────────────────────────────────────────────

const CONFIG_DEFAULTS = {
  mezza_mattina: 35, mezza_pomeriggio: 35, intera_giornata: 45,
  multi_2: 84, multi_3: 120, multi_4: 152, multi_5: 180, multi_6: 205, multi_7: 225, multi_extra: 20,
};

router.get('/config', async (req, res) => {
  try {
    const { data, error } = await supabase.from('config').select('chiave, valore');
    if (error) throw error;
    const saved = {};
    (data || []).forEach(r => { saved[r.chiave] = isNaN(r.valore) ? r.valore : parseFloat(r.valore); });
    return res.json({ config: { ...CONFIG_DEFAULTS, ...saved }, needs_migration: false });
  } catch (_) {
    return res.json({ config: CONFIG_DEFAULTS, needs_migration: true });
  }
});

// ─── PUT /api/admin/config ────────────────────────────────────────────────────

router.put('/config', async (req, res) => {
  const rows = Object.entries(req.body).map(([chiave, valore]) => ({ chiave, valore: String(valore) }));
  try {
    const { error } = await supabase.from('config').upsert(rows, { onConflict: 'chiave' });
    if (error) throw error;
    await logAction('config_update', null, { keys: Object.keys(req.body) }, getIp(req));
    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: e.message, needs_migration: true });
  }
});

// ─── GET /api/admin/occupazione ──────────────────────────────────────────────

router.get('/occupazione', async (req, res) => {
  const TOTAL_BICI = 10;
  const months = [];
  const now = new Date();

  for (let m = 5; m >= 0; m--) {
    const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const year  = d.getFullYear();
    const month = d.getMonth() + 1;
    const daysInMonth = new Date(year, month, 0).getDate();
    const startStr = `${year}-${String(month).padStart(2,'0')}-01`;
    const endStr   = `${year}-${String(month).padStart(2,'0')}-${String(daysInMonth).padStart(2,'0')}`;

    const { data: pren } = await supabase
      .from('prenotazioni')
      .select('bicicletta_id, data_ritiro, data_restituzione, giorni, tipo_noleggio')
      .eq('pagamento_status', 'paid')
      .lte('data_ritiro', endStr)
      .gte('data_restituzione', startStr);

    let bookingDays = 0;
    (pren || []).forEach(p => {
      const from = new Date(Math.max(new Date(p.data_ritiro), new Date(startStr)));
      const to   = new Date(Math.min(new Date(p.data_restituzione), new Date(endStr)));
      const days = Math.max(0, Math.round((to - from) / 86400000) + 1);
      bookingDays += days;
    });

    const possibleDays = daysInMonth * TOTAL_BICI;
    const pct = Math.min(100, Math.round((bookingDays / possibleDays) * 100));

    months.push({
      month: `${year}-${String(month).padStart(2,'0')}`,
      label: d.toLocaleDateString('it-IT', { month: 'short', year: '2-digit' }),
      pct,
      bookings: (pren || []).length,
      bookingDays,
    });
  }

  return res.json({ months });
});

// ─── GET /api/admin/cliente ───────────────────────────────────────────────────

router.get('/cliente', async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 2) return res.status(400).json({ error: 'Query troppo corta (min 2 caratteri)' });
  const safe = q.trim().replace(/[%_]/g, '\\$&');
  const { data, error } = await supabase
    .from('prenotazioni')
    .select('id, cliente_nome, cliente_email, cliente_telefono, tipo_noleggio, giorni, data_ritiro, orario_ritiro, data_restituzione, orario_restituzione, prezzo_totale, pagamento_status, firma_at, note_admin, created_at')
    .or(`cliente_email.ilike.%${safe}%,cliente_nome.ilike.%${safe}%,cliente_telefono.ilike.%${safe}%`)
    .order('data_ritiro', { ascending: false })
    .limit(50);
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ results: data || [] });
});

// ─── PATCH /api/admin/bookings/:id/note ──────────────────────────────────────

router.patch('/bookings/:id/note', async (req, res) => {
  const { note_admin } = req.body;
  const { error } = await supabase
    .from('prenotazioni')
    .update({ note_admin: note_admin ?? null })
    .eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  await logAction('note_update', req.params.id, { has_note: !!(note_admin?.trim()) }, getIp(req));
  return res.json({ success: true });
});

// ─── POST /api/admin/push/subscribe ──────────────────────────────────────────

router.post('/push/subscribe', async (req, res) => {
  const { subscription } = req.body;
  if (!subscription?.endpoint) return res.status(400).json({ error: 'Subscription non valida' });
  try {
    await supabase.from('push_subscriptions')
      .upsert({ endpoint: subscription.endpoint, subscription: JSON.stringify(subscription), active: true }, { onConflict: 'endpoint' });
    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: e.message, needs_migration: true });
  }
});

// ─── DELETE /api/admin/push/subscribe ────────────────────────────────────────

router.delete('/push/subscribe', async (req, res) => {
  const { endpoint } = req.body;
  if (!endpoint) return res.status(400).json({ error: 'Endpoint mancante' });
  await supabase.from('push_subscriptions').update({ active: false }).eq('endpoint', endpoint).catch(() => {});
  return res.json({ success: true });
});

// ─── POST /api/admin/push/test ────────────────────────────────────────────────

router.post('/push/test', async (req, res) => {
  try {
    const result = await sendPushToAll({ title: '🚲 Test Notifica', body: 'Arfanta Bike Rental — notifiche push attive!', url: '/admin' });
    await logAction('push_test', null, {}, getIp(req));
    return res.json({ success: true, result });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// ─── GET /api/admin/bookings/:id/contratto ────────────────────────────────────
// Restituisce il contratto firmato come HTML (da aprire in nuova tab → stampa PDF)

router.get('/bookings/:id/contratto', async (req, res) => {
  const { data: b, error } = await supabase
    .from('prenotazioni')
    .select('id, cliente_nome, tipo_noleggio, giorni, data_ritiro, orario_ritiro, data_restituzione, orario_restituzione, prezzo_totale, lingua, firma_at, firma_nome, firma_ip')
    .eq('id', req.params.id)
    .single();

  if (error || !b) return res.status(404).json({ error: 'Prenotazione non trovata' });
  if (!b.firma_at)  return res.status(400).json({ error: 'Contratto non ancora firmato' });

  const lang   = b.lingua || 'it';
  const esc    = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const locale = LOCALE_MAP[lang] || 'it-IT';

  const fmtDate = ds => {
    if (!ds) return '—';
    return new Date(ds + 'T00:00:00').toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };
  const fmtDateTime = iso => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString(locale, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Europe/Rome' }) + ' (CET)';
  };

  const docHash = crypto.createHash('sha256')
    .update(`${b.id}|${b.firma_at}|${b.firma_nome}`)
    .digest('hex').slice(0, 16).toUpperCase();

  const f          = CONTRATTO_FIELDS[lang] || CONTRATTO_FIELDS.it;
  const title      = CONTRATTO_TITLE[lang]  || CONTRATTO_TITLE.it;
  const tipoLabels = TIPO_LABEL[lang]        || TIPO_LABEL.it;
  const tipoStr    = (tipoLabels[b.tipo_noleggio] || b.tipo_noleggio) + (Number(b.giorni) > 1 ? ` · ${b.giorni} giorni` : '');
  const terms      = CONTRATTO_TERMS[lang]   || CONTRATTO_TERMS.it;
  const shortId    = b.id.toUpperCase().slice(0, 8);

  const termsHtml = terms.map(a => `
    <div class="article">
      <h3>${esc(a.title)}</h3>
      <p>${esc(a.text)}</p>
    </div>`).join('');

  const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} — ${shortId} — Arfanta Bike Rental</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
@page{margin:18mm 14mm;size:A4}
body{font-family:Georgia,'Times New Roman',serif;font-size:11pt;line-height:1.65;color:#1a1a1a;background:#f2f4f0}
@media print{body{background:#fff}.no-print{display:none!important}}
.page{max-width:794px;margin:0 auto;background:#fff}
.hdr{background:#2D8659;color:#fff;padding:26px 36px 22px;display:flex;align-items:center;gap:18px}
.hdr-logo{font-size:44px;line-height:1}
.hdr-text h1{font-size:1.4rem;font-weight:700;margin-bottom:3px}
.hdr-text p{font-size:0.78rem;opacity:.82;font-family:Arial,sans-serif}
.body{padding:30px 36px}
.sec{margin-bottom:26px}
.sec-title{font-family:Arial,sans-serif;font-size:.62rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#2D8659;margin-bottom:10px;border-bottom:2px solid #2D8659;padding-bottom:3px}
.sum-table{width:100%;border-collapse:collapse;font-family:Arial,sans-serif}
.sum-table tr{border-bottom:1px solid #e4ece4}
.sum-table tr:last-child{border-bottom:none}
.sum-table td{padding:7px 4px;font-size:.87rem}
.sum-table td:first-child{color:#666;width:36%}
.sum-table td:last-child{font-weight:600;color:#111}
.code{background:#1a5c3a;color:#fff;border-radius:4px;padding:3px 10px;font-size:.83rem;letter-spacing:.12em;font-family:'Courier New',monospace;display:inline-block}
.terms-box{border:1px solid #cddacd;border-radius:6px;padding:15px 20px;background:#fafffe;font-size:.82rem;line-height:1.72}
.article+.article{border-top:1px solid #e8ede8;margin-top:11px;padding-top:11px}
.article h3{font-family:Arial,sans-serif;font-size:.78rem;font-weight:700;color:#1a5c3a;margin-bottom:4px}
.article p{color:#444}
.cert{background:#f0faf4;border:2px solid #2D8659;border-radius:10px;padding:22px 26px;margin-top:26px;page-break-inside:avoid}
.cert-hdr{display:flex;align-items:center;gap:14px;margin-bottom:16px}
.cert-seal{font-size:34px}
.cert-htitle{font-family:Arial,sans-serif;font-size:.97rem;font-weight:700;color:#1a5c3a}
.cert-hsub{font-family:Arial,sans-serif;font-size:.7rem;color:#666;margin-top:2px}
.cert-table{width:100%;border-collapse:collapse;font-family:Arial,sans-serif;font-size:.86rem}
.cert-table tr{border-bottom:1px solid #c4e0cc}
.cert-table tr:last-child{border-bottom:none}
.cert-table td{padding:7px 4px}
.cert-table td:first-child{color:#555;width:38%}
.cert-table td:last-child{font-weight:600;color:#111;font-family:'Courier New',monospace;font-size:.82rem}
.cert-table .hash td:last-child{color:#1a5c3a;font-size:.8rem}
.cert-foot{margin-top:12px;font-family:Arial,sans-serif;font-size:.7rem;color:#888;border-top:1px solid #c4e0cc;padding-top:9px;line-height:1.6}
.doc-foot{text-align:center;margin-top:26px;padding-top:12px;border-top:1px solid #ddd;font-family:Arial,sans-serif;font-size:.7rem;color:#aaa;line-height:1.8}
.print-btn{display:block;margin:18px auto 0;padding:11px 30px;background:#2D8659;color:#fff;border:none;border-radius:8px;font-family:Arial,sans-serif;font-size:.9rem;font-weight:600;cursor:pointer;letter-spacing:.03em}
.print-btn:hover{background:#1a5c3a}
</style>
</head>
<body>
<div class="page">
  <div class="hdr">
    <div class="hdr-logo">🚲</div>
    <div class="hdr-text">
      <h1>${esc(title)}</h1>
      <p>Arfanta Bike Rental &nbsp;·&nbsp; Via Pecol 22, Arfanta di Tarzo (TV) &nbsp;·&nbsp; arfantabikerental@gmail.com</p>
    </div>
  </div>
  <div class="body">

    <div class="sec">
      <div class="sec-title">${esc(f.summary)}</div>
      <table class="sum-table">
        <tr><td>${esc(f.code)}</td><td><span class="code">${shortId}</span></td></tr>
        <tr><td>${esc(f.client)}</td><td>${esc(b.cliente_nome)}</td></tr>
        <tr><td>${esc(f.type)}</td><td>${esc(tipoStr)}</td></tr>
        <tr><td>${esc(f.pickup)}</td><td>${esc(fmtDate(b.data_ritiro))} &nbsp;${esc(b.orario_ritiro ? b.orario_ritiro.slice(0,5) : '')}</td></tr>
        <tr><td>${esc(f.ret)}</td><td>${esc(fmtDate(b.data_restituzione))} &nbsp;${esc(b.orario_restituzione ? b.orario_restituzione.slice(0,5) : '')}</td></tr>
        <tr><td>${esc(f.price)}</td><td>€${esc(Number(b.prezzo_totale || 0).toFixed(2))}</td></tr>
      </table>
    </div>

    <div class="sec">
      <div class="sec-title">${esc(f.terms)}</div>
      <div class="terms-box">${termsHtml}</div>
    </div>

    <div class="cert">
      <div class="cert-hdr">
        <div class="cert-seal">✍️</div>
        <div>
          <div class="cert-htitle">${esc(f.cert)}</div>
          <div class="cert-hsub">Arfanta Bike Rental — ${shortId}</div>
        </div>
      </div>
      <table class="cert-table">
        <tr><td>${esc(f.signer)}</td><td>${esc(b.firma_nome)}</td></tr>
        <tr><td>${esc(f.date)}</td><td>${esc(fmtDateTime(b.firma_at))}</td></tr>
        <tr><td>${esc(f.ip)}</td><td>${esc(b.firma_ip || '—')}</td></tr>
        <tr><td>${esc(f.booking)}</td><td>${esc(b.id)}</td></tr>
        <tr class="hash"><td>${esc(f.docid)}</td><td>${docHash}</td></tr>
      </table>
      <div class="cert-foot">${esc(f.footer)}</div>
    </div>

    <div class="doc-foot">
      Arfanta Bike Rental &nbsp;·&nbsp; Via Pecol 22, Arfanta di Tarzo (TV) &nbsp;·&nbsp; Italy<br>
      arfantabikerental@gmail.com &nbsp;·&nbsp; Colline del Prosecco di Conegliano e Valdobbiadene — UNESCO
    </div>
  </div>
  <button class="print-btn no-print" onclick="window.print()">${esc(f.print)}</button>
</div>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.send(html);
});

// ─── POST /api/admin/bookings/:id/refund ─────────────────────────────────────

router.post('/bookings/:id/refund', async (req, res) => {
  const { amount, motivo = '' } = req.body;

  const { data: b, error } = await supabase
    .from('prenotazioni')
    .select('stripe_session_id, stripe_payment_id, pagamento_status, prezzo_totale, cliente_nome')
    .eq('id', req.params.id)
    .single();

  if (error || !b) return res.status(404).json({ error: 'Prenotazione non trovata' });
  if (b.pagamento_status !== 'paid') return res.status(400).json({ error: 'Prenotazione non pagata — rimborso non applicabile' });

  let paymentIntentId = b.stripe_payment_id;
  if (!paymentIntentId && b.stripe_session_id) {
    try {
      const session = await stripe.checkout.sessions.retrieve(b.stripe_session_id);
      paymentIntentId = session.payment_intent;
    } catch (e) {
      return res.status(400).json({ error: 'Impossibile recuperare dati di pagamento Stripe' });
    }
  }
  if (!paymentIntentId) return res.status(400).json({ error: 'Nessun pagamento Stripe trovato' });

  try {
    const refundParams = { payment_intent: paymentIntentId };
    if (amount) refundParams.amount = Math.round(parseFloat(amount) * 100);
    if (motivo) refundParams.metadata = { motivo, booking_id: req.params.id };

    const refund = await stripe.refunds.create(refundParams);

    const amountNum = parseFloat(amount) || Number(b.prezzo_totale);
    const isTotal   = amountNum >= Number(b.prezzo_totale) - 0.01;
    if (isTotal) await supabase.from('prenotazioni').update({ pagamento_status: 'cancelled' }).eq('id', req.params.id);

    console.log(`[admin refund] ${req.params.id} — €${refund.amount / 100} rimborsati`);
    await logAction('refund', req.params.id, { amount: refund.amount / 100, refund_id: refund.id, motivo: motivo || '' }, getIp(req));
    return res.json({ success: true, refund_id: refund.id, amount: refund.amount / 100 });
  } catch (e) {
    console.error('[admin refund] Stripe error:', e);
    return res.status(402).json({ error: e.message || 'Errore rimborso Stripe' });
  }
});

// ─── PATCH /api/admin/bookings/:id/reschedule ─────────────────────────────────

router.patch('/bookings/:id/reschedule', async (req, res) => {
  const { data_ritiro, tipo_noleggio, giorni = 1 } = req.body;
  if (!data_ritiro || !tipo_noleggio) return res.status(400).json({ error: 'data_ritiro e tipo_noleggio obbligatori' });

  const { data: booking, error } = await supabase
    .from('prenotazioni')
    .select('id, bicicletta_id, pagamento_status')
    .eq('id', req.params.id)
    .single();

  if (error || !booking) return res.status(404).json({ error: 'Prenotazione non trovata' });
  if (booking.pagamento_status !== 'paid') return res.status(400).json({ error: 'Prenotazione non attiva' });

  const numGiorni = Number(giorni);
  const { start, end } = calcRange(data_ritiro, tipo_noleggio, numGiorni);
  const { data_restituzione, orario_restituzione, orario_ritiro } = calcRestituzione(data_ritiro, tipo_noleggio, numGiorni);

  const { data: conflitti } = await supabase
    .from('prenotazioni')
    .select('id')
    .eq('pagamento_status', 'paid')
    .neq('id', req.params.id)
    .eq('bicicletta_id', booking.bicicletta_id)
    .lt('start_ts', end.toISOString())
    .gt('end_ts', start.toISOString());

  if (conflitti && conflitti.length > 0) {
    return res.status(409).json({ error: `Bici #${booking.bicicletta_id} già occupata in questa data/orario` });
  }

  const { data, error: uErr } = await supabase
    .from('prenotazioni')
    .update({
      data_ritiro, tipo_noleggio, giorni: numGiorni,
      orario_ritiro, data_restituzione, orario_restituzione,
      start_ts: start.toISOString(), end_ts: end.toISOString(),
    })
    .eq('id', req.params.id)
    .select().single();

  if (uErr) return res.status(500).json({ error: uErr.message });
  await logAction('reschedule', req.params.id, { data_ritiro, tipo_noleggio, giorni: numGiorni }, getIp(req));
  return res.json({ success: true, booking: data });
});

// ─── PATCH /api/admin/bookings/:id/assegna-bici ───────────────────────────────

router.patch('/bookings/:id/assegna-bici', async (req, res) => {
  const newBiciId = parseInt(req.body.bicicletta_id, 10);
  if (!newBiciId || newBiciId < 1) return res.status(400).json({ error: 'ID bici non valido' });

  const { data: booking, error } = await supabase
    .from('prenotazioni')
    .select('id, start_ts, end_ts, pagamento_status')
    .eq('id', req.params.id)
    .single();

  if (error || !booking) return res.status(404).json({ error: 'Prenotazione non trovata' });
  if (booking.pagamento_status !== 'paid') return res.status(400).json({ error: 'Prenotazione non attiva' });

  const { data: conflitti } = await supabase
    .from('prenotazioni')
    .select('id')
    .eq('pagamento_status', 'paid')
    .neq('id', req.params.id)
    .eq('bicicletta_id', newBiciId)
    .lt('start_ts', booking.end_ts)
    .gt('end_ts', booking.start_ts);

  if (conflitti && conflitti.length > 0) {
    return res.status(409).json({ error: `Bici #${newBiciId} non disponibile in questa fascia oraria` });
  }

  const { data, error: uErr } = await supabase
    .from('prenotazioni')
    .update({ bicicletta_id: newBiciId })
    .eq('id', req.params.id)
    .select().single();

  if (uErr) return res.status(500).json({ error: uErr.message });
  await logAction('assegna_bici', req.params.id, { bici_id: newBiciId }, getIp(req));
  return res.json({ success: true, booking: data });
});

// ─── GET /api/admin/audit-log ─────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

router.get('/audit-log', async (req, res) => {
  const limit  = Math.min(Math.max(parseInt(req.query.limit,  10) || 100, 1), 500);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

  if (req.query.booking_id && !UUID_RE.test(req.query.booking_id)) {
    return res.status(400).json({ error: 'booking_id non valido' });
  }

  let query = supabase
    .from('audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (req.query.booking_id) query = query.eq('booking_id', req.query.booking_id);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ log: data || [] });
});

// ─── Helper: tipo noleggio abbreviato (per dashboard admin) ──────────────────

function tipoShort(tipo) {
  const m = {
    mezza_mattina:    '½ Matt.',
    mezza_pomeriggio: '½ Pom.',
    intera_giornata:  'Giorn.',
    multi_giorno:     'Multi',
    // legacy
    '4_ore': '4h', 'intera_giornata_old': 'Giorn.', '3_piu_giorni': 'Multi',
  };
  return m[tipo] || tipo;
}

module.exports = router;
module.exports.tipoShort = tipoShort;
