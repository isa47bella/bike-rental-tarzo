/**
 * Rotte pagamento Stripe:
 *  POST /api/payments/checkout   — crea sessione Stripe + prenotazione pending
 *  POST /api/payments/webhook    — Stripe invia evento payment_intent.succeeded
 *  GET  /api/payments/session/:id — recupera dettagli prenotazione da session_id
 */

const express  = require('express');
const crypto   = require('crypto');
const router   = express.Router();
const stripe   = require('stripe')(process.env.STRIPE_SECRET_KEY);
const supabase = require('../lib/supabase');
const { sendConfirmationToCliente, sendNotificationToGestore, sendWhatsAppAlert } = require('../lib/email');
const { calcRange, calcRestituzione, getStagione, calcolaPrezzo } = require('./availability');
const { sendPushToAll } = require('../lib/push');

const TIPO_IDS_BICI = { ecity: [1,2], emtb: [3,4,5,6,7,8,9], bimbo: [10] };

// Feature flag: attivare SOLO dopo aver creato la colonna prenotazioni.firma_token
// su Supabase. Con flag spento le prenotazioni non includono firma_token nell'INSERT
// (la colonna potrebbe non esistere). Imposta FIRMA_TOKEN_ENABLED=1 dopo la migrazione.
const FIRMA_TOKEN_ENABLED = process.env.FIRMA_TOKEN_ENABLED === '1';


function tipoLabel(tipo) {
  const labels = {
    mezza_mattina:    'Mezza Giornata Mattina (9:00–13:00)',
    mezza_pomeriggio: 'Mezza Giornata Pomeriggio (14:00–18:00)',
    intera_giornata:  'Giornata Intera (9:00–18:00)',
    multi_giorno:     'Multi-Giorno',
  };
  return labels[tipo] || tipo;
}

function getOrariFromTipo(tipo_noleggio) {
  if (tipo_noleggio === 'mezza_mattina')    return { ritiro: '09:00', restituzione: '13:00' };
  if (tipo_noleggio === 'mezza_pomeriggio') return { ritiro: '14:00', restituzione: '18:00' };
  return { ritiro: '09:00', restituzione: '18:00' };
}

const BIKE_NOMI = { ecity: 'E-City Bike', emtb: 'E-MTB', bimbo: 'E-MTB Bimbo' };

// ─── POST /api/payments/checkout ─────────────────────────────────────────────

router.post('/checkout', async (req, res) => { try {
  const {
    cliente_nome, cliente_email, cliente_telefono, cliente_note,
    tipo_noleggio, giorni = 1,
    data_ritiro,
    accessori: accessoriRaw = [],
    accessori_qty: accessoriQtyInput,
    lingua = 'it',
  } = req.body;

  const VALID_ACC    = ['casco', 'lucchetto'];
  const ACC_PREZZI   = { casco: 2, lucchetto: 1 };
  const VALID_BIKE_TYPES = ['ecity', 'emtb', 'bimbo'];
  const accessoriArr = (Array.isArray(accessoriRaw) ? accessoriRaw : []).filter(a => VALID_ACC.includes(a));

  // Normalizza input: supporta sia il nuovo formato bici:[{bike_type, quantita}]
  // che il legacy bike_type stringa per compatibilità admin/test
  let biciArr;
  if (Array.isArray(req.body.bici) && req.body.bici.length > 0) {
    biciArr = req.body.bici;
  } else if (req.body.bike_type) {
    biciArr = [{ bike_type: req.body.bike_type, quantita: 1 }];
  } else {
    return res.status(400).json({ error: 'Dati bici mancanti' });
  }

  // Validazione
  if (!cliente_nome || !cliente_email || !cliente_telefono) {
    return res.status(400).json({ error: 'Dati cliente mancanti' });
  }
  if (!tipo_noleggio || !data_ritiro) {
    return res.status(400).json({ error: 'Dati prenotazione mancanti' });
  }
  for (const b of biciArr) {
    if (!VALID_BIKE_TYPES.includes(b.bike_type)) {
      return res.status(400).json({ error: 'Tipo bici non valido' });
    }
    if (!Number.isInteger(Number(b.quantita)) || Number(b.quantita) < 1) {
      return res.status(400).json({ error: 'Quantità bici non valida' });
    }
  }
  const tipiValidi = ['mezza_mattina','mezza_pomeriggio','intera_giornata','multi_giorno'];
  if (!tipiValidi.includes(tipo_noleggio)) {
    return res.status(400).json({ error: 'Tipo noleggio non valido' });
  }
  if (tipo_noleggio === 'multi_giorno' && Number(giorni) < 2) {
    return res.status(400).json({ error: 'Multi-giorno richiede almeno 2 giorni' });
  }

  // Anticipo minimo: 1 giorno (si può prenotare per domani, non per il giorno stesso)
  const oggi     = new Date(); oggi.setHours(0,0,0,0);
  const ritiro   = new Date(data_ritiro + 'T00:00:00');
  const diffDays = Math.floor((ritiro - oggi) / (1000*60*60*24));
  if (diffDays < 1) {
    return res.status(400).json({ error: 'La prenotazione richiede almeno 1 giorno di anticipo (non per il giorno stesso)' });
  }

  // Verifica stagione
  if (!getStagione(data_ritiro)) {
    return res.status(400).json({ error: 'Data non disponibile — apertura dal 1 aprile al 31 ottobre' });
  }

  // Calcola orari e range temporale
  const orari     = getOrariFromTipo(tipo_noleggio);
  // Solo multi_giorno usa giorni > 1; per gli altri tipi forziamo 1
  const numGiorni = tipo_noleggio === 'multi_giorno' ? Number(giorni) : 1;
  const { start, end } = calcRange(data_ritiro, tipo_noleggio, numGiorni);
  const { data_restituzione, orario_restituzione } = calcRestituzione(data_ritiro, tipo_noleggio, numGiorni);

  // Trova bici occupate nel range. Consideriamo:
  //  - tutte le prenotazioni 'paid' (occupazione confermata)
  //  - le 'pending' create nell'ultima ora: rappresentano un checkout in corso
  //    di un altro cliente → vanno trattate come occupate per evitare overbooking.
  //    Le pending più vecchie sono abbandonate (le pulisce il cron auto-cancel).
  const pendingCutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const [paidRes, pendingRes] = await Promise.all([
    supabase
      .from('prenotazioni')
      .select('bicicletta_id, bici_ids')
      .eq('pagamento_status', 'paid')
      .lt('start_ts', end.toISOString())
      .gt('end_ts', start.toISOString()),
    supabase
      .from('prenotazioni')
      .select('bicicletta_id, bici_ids')
      .eq('pagamento_status', 'pending')
      .gte('created_at', pendingCutoff)
      .lt('start_ts', end.toISOString())
      .gt('end_ts', start.toISOString()),
  ]);
  const conflitti = [...(paidRes.data || []), ...(pendingRes.data || [])];

  const biciOccupate = new Set();
  for (const r of (conflitti || [])) {
    const ids = Array.isArray(r.bici_ids) && r.bici_ids.length ? r.bici_ids : [r.bicicletta_id];
    for (const id of ids) biciOccupate.add(id);
  }

  // Assegna bici per ciascun tipo richiesto
  const linguaValida   = ['it','en','de','es','fr'].includes(lingua) ? lingua : 'it';

  const assignedBikes = []; // {bicicletta_id, bike_type, prezzoBase}

  for (const bItem of biciArr) {
    const bt  = bItem.bike_type;
    const qty = Number(bItem.quantita);
    const idsCandidati = TIPO_IDS_BICI[bt];
    const biciLibere   = idsCandidati.filter(id => !biciOccupate.has(id));

    if (biciLibere.length < qty) {
      return res.status(409).json({
        error: `Non ci sono abbastanza ${BIKE_NOMI[bt]} disponibili per questa data. Scegli un altro modello o contattaci.`,
      });
    }
    const prezzoBase = calcolaPrezzo(bt, tipo_noleggio, numGiorni, data_ritiro);
    for (let i = 0; i < qty; i++) {
      const bid = biciLibere[i];
      assignedBikes.push({ bicicletta_id: bid, bike_type: bt, prezzoBase });
      biciOccupate.add(bid); // previene doppia assegnazione nella stessa richiesta
    }
  }

  // Accessori: due modalità (uguale a /bookings/manual)
  //   (a) accessori_qty: { casco: N, lucchetto: M }  — quantità per-bici (max ≤ totBici)
  //   (b) accessori: ['casco','lucchetto']            — uniforme su tutte le bici (legacy)
  const totBici = assignedBikes.length;
  const accessoriPerRow = assignedBikes.map(() => []);
  const accCostPerRow   = assignedBikes.map(() => 0);
  let   accCostTotal    = 0;

  if (accessoriQtyInput && typeof accessoriQtyInput === 'object') {
    for (const [acc, qty] of Object.entries(accessoriQtyInput)) {
      if (!ACC_PREZZI[acc]) continue;
      const n = Math.max(0, Math.min(Number(qty) || 0, totBici));
      for (let i = 0; i < n; i++) {
        accessoriPerRow[i].push(acc);
        accCostPerRow[i] += ACC_PREZZI[acc];
        accCostTotal     += ACC_PREZZI[acc];
      }
    }
  } else {
    const perBike = accessoriArr.reduce((sum, a) => sum + (ACC_PREZZI[a] || 0), 0);
    for (let i = 0; i < totBici; i++) {
      accessoriPerRow[i] = [...accessoriArr];
      accCostPerRow[i]   = perBike;
    }
    accCostTotal = perBike * totBici;
  }

  // UNA sola prenotazione anche per multi-bici: bicicletta_id = prima, bici_ids = tutte
  const totalPrezzoBici = assignedBikes.reduce((s, b, i) => s + b.prezzoBase + accCostPerRow[i], 0);
  const accessoriUnione = Array.from(new Set(accessoriPerRow.flat()));

  const insertData = [{
    cliente_nome,
    cliente_email,
    cliente_telefono,
    cliente_note:        cliente_note || null,
    bicicletta_id:       assignedBikes[0].bicicletta_id,
    bici_ids:            assignedBikes.map(b => b.bicicletta_id),
    tipo_noleggio,
    giorni:              numGiorni,
    data_ritiro,
    orario_ritiro:       orari.ritiro,
    data_restituzione,
    orario_restituzione,
    start_ts:            start.toISOString(),
    end_ts:              end.toISOString(),
    prezzo_totale:       +totalPrezzoBici.toFixed(2),
    accessori:           accessoriUnione.join(','),
    lingua:              linguaValida,
    pagamento_status:    'pending',
    ...(FIRMA_TOKEN_ENABLED ? { firma_token: crypto.randomBytes(16).toString('hex') } : {}),
  }];

  const { data: prenotazioni, error: dbError } = await supabase
    .from('prenotazioni')
    .insert(insertData)
    .select();

  if (dbError || !prenotazioni?.length) {
    console.error('Errore creazione prenotazioni:', dbError);
    return res.status(500).json({ error: 'Errore salvataggio prenotazione' });
  }

  // Costruisci line items Stripe — una voce per tipo bici (al prezzo base)
  // + 1 voce aggregata per gli accessori (totale, non per-bici), così Stripe
  // checkout resta leggibile anche con accessori distribuiti su solo alcune bici.
  const byType = {};
  for (const b of assignedBikes) {
    if (!byType[b.bike_type]) byType[b.bike_type] = { count: 0, prezzoBase: b.prezzoBase };
    byType[b.bike_type].count++;
  }
  const lineItems = Object.entries(byType).map(([bt, info]) => ({
    price_data: {
      currency:     'eur',
      unit_amount:  info.prezzoBase * 100,
      product_data: {
        name:        `${BIKE_NOMI[bt]} — ${tipoLabel(tipo_noleggio)}`,
        description: `Noleggio e-bike — ${data_ritiro} ore ${orari.ritiro}`,
      },
    },
    quantity: info.count,
  }));

  if (accCostTotal > 0) {
    const accSummary = accessoriPerRow
      .flatMap(arr => arr)
      .reduce((acc, k) => { acc[k] = (acc[k] || 0) + 1; return acc; }, {});
    const accDesc = Object.entries(accSummary)
      .map(([k, n]) => `${n}× ${k}`)
      .join(', ');
    lineItems.push({
      price_data: {
        currency:    'eur',
        unit_amount: accCostTotal * 100,
        product_data: {
          name:        'Accessori',
          description: accDesc || 'Casco / Lucchetto',
        },
      },
      quantity: 1,
    });
  }

  // Crea sessione Stripe Checkout
  try {
    const customer = await stripe.customers.create({
      email: cliente_email,
      name:  cliente_nome,
      phone: cliente_telefono,
    });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode:                 'payment',
      customer:             customer.id,
      line_items:           lineItems,
      payment_intent_data:  { setup_future_usage: 'off_session' },
      metadata: {
        prenotazione_ids: prenotazioni.map(p => p.id).join(','),
        tipo_noleggio,
        total_bikes: String(assignedBikes.length),
      },
      success_url: `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${process.env.FRONTEND_URL}/cancel`,
    });

    await supabase
      .from('prenotazioni')
      .update({ stripe_session_id: session.id })
      .in('id', prenotazioni.map(p => p.id));

    return res.json({ url: session.url, session_id: session.id });

  } catch (stripeError) {
    console.error('Errore Stripe:', stripeError);
    await supabase.from('prenotazioni').delete().in('id', prenotazioni.map(p => p.id));
    return res.status(500).json({ error: 'Errore durante la creazione del pagamento. Riprova o contatta l\'assistenza.' });
  }
  } catch (err) {
    console.error('Errore checkout inatteso:', err);
    return res.status(500).json({ error: 'Errore interno del server' });
  }
});

// ─── POST /api/payments/webhook ───────────────────────────────────────────────
// NOTA: questo endpoint legge il body RAW (buffer), NON parsed JSON

router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Idempotenza: Stripe può ritentare lo stesso evento. Registriamo event.id in
  // stripe_events (PK su id): se l'INSERT fallisce per conflitto, l'evento è già
  // stato processato → usciamo subito senza rieseguire email/push/update.
  {
    const { error: dupErr } = await supabase
      .from('stripe_events')
      .insert({ id: event.id, type: event.type });
    if (dupErr) {
      if (dupErr.code === '23505') {
        console.log(`[webhook] evento ${event.id} già processato — skip`);
        return res.json({ received: true, duplicate: true });
      }
      // Errore DB diverso dal conflitto: logghiamo ma proseguiamo (meglio
      // processare due volte che perdere l'evento).
      console.error('[webhook] errore registrazione evento:', dupErr.message);
    }
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    // Aggiorna tutte le prenotazioni legate a questa sessione a PAID
    const { data: prenotazioni, error } = await supabase
      .from('prenotazioni')
      .update({
        pagamento_status:  'paid',
        stripe_session_id: session.id,
        stripe_payment_id: session.payment_intent,
      })
      .eq('stripe_session_id', session.id)
      .eq('pagamento_status', 'pending')
      .select();

    if (error) {
      console.error('Errore update prenotazioni:', error);
      // Rimuovi il marcatore di idempotenza così il retry di Stripe RIPROCESSA
      // l'evento. Senza questo, il retry vedrebbe event.id già in stripe_events,
      // lo scarterebbe come duplicato e la prenotazione pagata resterebbe 'pending'.
      await supabase.from('stripe_events').delete().eq('id', event.id);
      return res.status(500).send('DB error');
    }

    // Salva customer_id e payment_method su tutte le prenotazioni della sessione
    if (session.payment_intent) {
      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent);
        await supabase
          .from('prenotazioni')
          .update({
            stripe_customer_id:       session.customer,
            stripe_payment_method_id: paymentIntent.payment_method,
          })
          .eq('stripe_session_id', session.id);
      } catch (e) {
        console.error('Errore salvataggio payment method:', e);
      }
    }

    // Cauzione: il blocco €500 avviene tramite cron job 1 giorno prima del ritiro
    // (cauzione_status rimane 'pending' fino all'esecuzione del cron)

    // Invia email + notifiche solo per la prima prenotazione (lead)
    const lead = prenotazioni?.[0];
    if (lead) {
      const tipoMap = { mezza_mattina: '½ Mattina', mezza_pomeriggio: '½ Pomeriggio', intera_giornata: 'Giornata', multi_giorno: 'Multi-giorno' };
      const totalBici = prenotazioni.length;
      const totalPrezzo = prenotazioni.reduce((s, p) => s + Number(p.prezzo_totale), 0);
      const leadWithTotal = { ...lead, prezzo_totale: totalPrezzo };
      const pushBodyBase = `${lead.cliente_nome} — ${tipoMap[lead.tipo_noleggio] || lead.tipo_noleggio} · ${lead.data_ritiro} · ${totalBici > 1 ? `${totalBici} bici · ` : ''}€${totalPrezzo}`;

      // Email gestore + WhatsApp: fire-and-forget (non aspettano la push)
      sendNotificationToGestore(leadWithTotal).catch(e => console.error('Email gestore:', e));
      sendWhatsAppAlert(leadWithTotal).catch(e => console.error('WhatsApp alert:', e));

      // Email cliente: aspetta esito SMTP per includere risultato nella push
      sendConfirmationToCliente(leadWithTotal)
        .then(() => ({ ok: true }))
        .catch(e => { console.error('Email cliente:', e); return { ok: false }; })
        .then(({ ok }) => sendPushToAll({
          title: '🚲 Nuova prenotazione!',
          body:  pushBodyBase + (ok ? ' · ✓ email inviata' : ' · ⚠️ email fallita'),
          url:   '/admin',
        }))
        .catch(e => console.error('Push:', e));
    }
  }

  // Gestisci scadenza sessione → cancella prenotazione pending
  if (event.type === 'checkout.session.expired') {
    const session = event.data.object;
    await supabase
      .from('prenotazioni')
      .delete()
      .eq('stripe_session_id', session.id)
      .eq('pagamento_status', 'pending');
  }

  res.json({ received: true });
});

// ─── GET /api/payments/session/:sessionId ─────────────────────────────────────

router.get('/session/:sessionId', async (req, res) => {
  const { sessionId } = req.params;

  const { data, error } = await supabase
    .from('prenotazioni')
    .select(`
      id, cliente_nome, cliente_email, bicicletta_id, bici_ids, tipo_noleggio,
      giorni, data_ritiro, orario_ritiro, data_restituzione, orario_restituzione,
      prezzo_totale, pagamento_status, created_at
    `)
    .eq('stripe_session_id', sessionId)
    .eq('pagamento_status', 'paid')
    .order('created_at', { ascending: true });

  if (error || !data?.length) {
    return res.status(404).json({ error: 'Prenotazione non trovata' });
  }

  // Una sola riga = nuova logica. Più righe = legacy (somma).
  if (data.length === 1) {
    const r = data[0];
    const total_bikes = Array.isArray(r.bici_ids) && r.bici_ids.length ? r.bici_ids.length : 1;
    return res.json({ ...r, total_bikes });
  }
  const totalPrezzo = data.reduce((s, p) => s + Number(p.prezzo_totale), 0);
  return res.json({ ...data[0], prezzo_totale: totalPrezzo, total_bikes: data.length });
});

module.exports = router;
