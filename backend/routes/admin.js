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
const { sendAdminEmail, sendWhatsAppAlert } = require('../lib/email');
const { calcRange, calcRestituzione }       = require('./availability');

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
      cauzione_status, cauzione_captured_amount, accessori
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
    return res.json({ success: true });
  } catch (e) {
    console.error('Errore release deposit:', e);
    return res.status(402).json({ error: e.message || 'Errore Stripe' });
  }
});

// ─── POST /api/admin/bookings/:id/capture-deposit ────────────────────────────
// Incassa la cauzione per danni (importo ≤ €1.000)

router.post('/bookings/:id/capture-deposit', async (req, res) => {
  const { amount, motivo } = req.body;
  const amountNum = parseFloat(amount);
  if (!amountNum || amountNum <= 0 || amountNum > 1000) {
    return res.status(400).json({ error: 'Importo non valido (max €1.000)' });
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
    return res.json({ success: true });
  } catch (e) {
    console.error('Errore capture deposit:', e);
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
    return res.json({ success: true });
  } catch (e) {
    console.error('[admin send-email] Errore:', e.message);
    return res.status(500).json({ error: 'Errore invio email: ' + e.message });
  }
});

// ─── GET /api/admin/oggi ──────────────────────────────────────────────────────

router.get('/oggi', async (req, res) => {
  const oggi = new Date().toISOString().substring(0, 10);
  const fields = `id, cliente_nome, cliente_email, cliente_telefono, bicicletta_id,
    tipo_noleggio, giorni, data_ritiro, orario_ritiro, data_restituzione,
    orario_restituzione, prezzo_totale, pagamento_status, cauzione_status,
    checkin_at, checkout_at, accessori`;

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
  const allowed = ['stato', 'batteria_pct', 'note_admin', 'ultima_manutenzione', 'prossima_manutenzione'];
  const update = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      update[key] = req.body[key] === '' ? null : req.body[key];
    }
  }
  if (update.batteria_pct !== null && update.batteria_pct !== undefined) {
    update.batteria_pct = parseInt(update.batteria_pct, 10);
  }
  const { data, error } = await supabase.from('biciclette').update(update).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
});

// ─── POST /api/admin/bookings/:id/checkin ────────────────────────────────────

router.post('/bookings/:id/checkin', async (req, res) => {
  const { checkin_note, documento_foto, bici_foto_consegna } = req.body;
  const update = { checkin_at: new Date().toISOString() };
  if (checkin_note)      update.checkin_note      = checkin_note;
  if (documento_foto)    update.documento_foto    = documento_foto;
  if (bici_foto_consegna) update.bici_foto_consegna = bici_foto_consegna;

  const { data, error } = await supabase.from('prenotazioni').update(update).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
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
// Crea prenotazione manuale (walk-in / telefono) senza Stripe

const PREZZI_MANUAL = {
  mezza_mattina:    35,
  mezza_pomeriggio: 35,
  intera_giornata:  45,
  multi_giorno:     null, // calcolato in base ai giorni
};
const PREZZI_MULTI = { 2:84, 3:120, 4:152, 5:180, 6:205, 7:225 };

function calcolaPrezzoManual(tipo_noleggio, giorni) {
  if (PREZZI_MANUAL[tipo_noleggio] !== null && PREZZI_MANUAL[tipo_noleggio] !== undefined) {
    return PREZZI_MANUAL[tipo_noleggio];
  }
  const n = Number(giorni);
  if (n >= 2 && n <= 7) return PREZZI_MULTI[n];
  if (n > 7) return PREZZI_MULTI[7] + (n - 7) * 20;
  return 45;
}

router.post('/bookings/manual', async (req, res) => {
  const {
    cliente_nome, cliente_telefono,
    cliente_email   = '',
    cliente_note    = '',
    tipo_noleggio, data_ritiro,
    giorni          = 1,
    bicicletta_id:  forcedBiciId,
    accessori:      accessoriRaw = [],
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

  let bicicletta_id;
  if (forcedBiciId) {
    if (occupate.has(Number(forcedBiciId))) {
      return res.status(409).json({ error: `Bici #${forcedBiciId} già occupata in questa fascia oraria` });
    }
    bicicletta_id = Number(forcedBiciId);
  } else {
    const { data: tutteLeBici } = await supabase.from('biciclette').select('id').order('id');
    const libera = (tutteLeBici || []).find(b => !occupate.has(b.id));
    if (!libera) return res.status(409).json({ error: 'Nessuna bici disponibile per questa data/orario' });
    bicicletta_id = libera.id;
  }

  const VALID_ACC   = ['casco', 'lucchetto', 'kit_foro'];
  const accessoriStr = (Array.isArray(accessoriRaw) ? accessoriRaw : []).filter(a => VALID_ACC.includes(a)).join(',');
  const prezzo      = prezzoOverride ? parseFloat(prezzoOverride) : calcolaPrezzoManual(tipo_noleggio, numGiorni);

  const noteFinale = [cliente_note, note_pagamento ? `Pagamento: ${note_pagamento}` : ''].filter(Boolean).join(' | ');

  const { data: prenotazione, error } = await supabase
    .from('prenotazioni')
    .insert({
      cliente_nome:        cliente_nome.trim(),
      cliente_email:       cliente_email.trim() || 'noemail@bikerentaltarzo.it',
      cliente_telefono:    (cliente_telefono || '').trim(),
      cliente_note:        noteFinale || null,
      bicicletta_id,
      tipo_noleggio,
      giorni:              numGiorni,
      data_ritiro,
      orario_ritiro,
      data_restituzione,
      orario_restituzione,
      start_ts:            start.toISOString(),
      end_ts:              end.toISOString(),
      prezzo_totale:       prezzo,
      accessori:           accessoriStr,
      pagamento_status:    'paid',
      stripe_session_id:   null,
    })
    .select()
    .single();

  if (error) {
    console.error('Errore prenotazione manuale:', error);
    return res.status(500).json({ error: error.message });
  }

  // WhatsApp alert (non bloccante)
  sendWhatsAppAlert(prenotazione).catch(e => console.error('WhatsApp manual:', e));

  return res.json({ success: true, booking: prenotazione });
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
