/**
 * Rotte pagamento Stripe:
 *  POST /api/payments/checkout   — crea sessione Stripe + prenotazione pending
 *  POST /api/payments/webhook    — Stripe invia evento payment_intent.succeeded
 *  GET  /api/payments/session/:id — recupera dettagli prenotazione da session_id
 */

const express  = require('express');
const router   = express.Router();
const stripe   = require('stripe')(process.env.STRIPE_SECRET_KEY);
const supabase = require('../lib/supabase');
const { sendConfirmationToCliente, sendNotificationToGestore, sendWhatsAppAlert } = require('../lib/email');
const { calcRange, calcRestituzione, getStagione, calcolaPrezzo } = require('./availability');
const { sendPushToAll } = require('../lib/push');

const TIPO_IDS_BICI = { ecity: [1,2], emtb: [3,4,5,6,7,8,9], bimbo: [10] };


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
    lingua = 'it',
  } = req.body;

  const VALID_ACC    = ['casco', 'lucchetto'];
  const ACC_PREZZI   = { casco: 2, lucchetto: 1 };
  const VALID_BIKE_TYPES = ['ecity', 'emtb', 'bimbo'];
  const accessoriArr = (Array.isArray(accessoriRaw) ? accessoriRaw : []).filter(a => VALID_ACC.includes(a));
  const accessoriStr = accessoriArr.join(',');

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

  // Min 2 giorni di anticipo
  const oggi     = new Date(); oggi.setHours(0,0,0,0);
  const ritiro   = new Date(data_ritiro + 'T00:00:00');
  const diffDays = Math.floor((ritiro - oggi) / (1000*60*60*24));
  if (diffDays < 2) {
    return res.status(400).json({ error: 'La prenotazione richiede almeno 2 giorni di anticipo' });
  }

  // Verifica stagione
  if (!getStagione(data_ritiro)) {
    return res.status(400).json({ error: 'Data non disponibile — apertura dal 1 aprile al 31 ottobre' });
  }

  // Calcola orari e range temporale
  const orari     = getOrariFromTipo(tipo_noleggio);
  const numGiorni = Number(giorni);
  const { start, end } = calcRange(data_ritiro, tipo_noleggio, numGiorni);
  const { data_restituzione, orario_restituzione } = calcRestituzione(data_ritiro, tipo_noleggio, numGiorni);

  // Trova bici occupate nel range (tutti i tipi in un'unica query)
  const tuttiGliId = Object.values(TIPO_IDS_BICI).flat();
  const { data: conflitti } = await supabase
    .from('prenotazioni')
    .select('bicicletta_id')
    .eq('pagamento_status', 'paid')
    .lt('start_ts', end.toISOString())
    .gt('end_ts', start.toISOString())
    .in('bicicletta_id', tuttiGliId);

  const biciOccupate = new Set((conflitti || []).map(r => r.bicicletta_id));

  // Assegna bici per ciascun tipo richiesto
  const accCostPerBike = accessoriArr.reduce((sum, a) => sum + (ACC_PREZZI[a] || 0), 0);
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

  // Costruisci record prenotazione per ogni bici assegnata
  const insertData = assignedBikes.map(b => ({
    cliente_nome,
    cliente_email,
    cliente_telefono,
    cliente_note:        cliente_note || null,
    bicicletta_id:       b.bicicletta_id,
    tipo_noleggio,
    giorni:              numGiorni,
    data_ritiro,
    orario_ritiro:       orari.ritiro,
    data_restituzione,
    orario_restituzione,
    start_ts:            start.toISOString(),
    end_ts:              end.toISOString(),
    prezzo_totale:       b.prezzoBase + accCostPerBike,
    accessori:           accessoriStr,
    lingua:              linguaValida,
    pagamento_status:    'pending',
  }));

  const { data: prenotazioni, error: dbError } = await supabase
    .from('prenotazioni')
    .insert(insertData)
    .select();

  if (dbError || !prenotazioni?.length) {
    console.error('Errore creazione prenotazioni:', dbError);
    return res.status(500).json({ error: 'Errore salvataggio prenotazione' });
  }

  // Costruisci line items Stripe — una voce per tipo bici
  const byType = {};
  for (const b of assignedBikes) {
    if (!byType[b.bike_type]) byType[b.bike_type] = { count: 0, prezzoBase: b.prezzoBase };
    byType[b.bike_type].count++;
  }
  const lineItems = Object.entries(byType).map(([bt, info]) => ({
    price_data: {
      currency:     'eur',
      unit_amount:  (info.prezzoBase + accCostPerBike) * 100,
      product_data: {
        name:        `${BIKE_NOMI[bt]} — ${tipoLabel(tipo_noleggio)}`,
        description: `Noleggio e-bike — ${data_ritiro} ore ${orari.ritiro}`,
      },
    },
    quantity: info.count,
  }));

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
      Promise.all([
        sendConfirmationToCliente(leadWithTotal).catch(e => console.error('Email cliente:', e)),
        sendNotificationToGestore(leadWithTotal).catch(e => console.error('Email gestore:', e)),
        sendWhatsAppAlert(leadWithTotal).catch(e => console.error('WhatsApp alert:', e)),
        sendPushToAll({
          title: '🚲 Nuova prenotazione!',
          body:  `${lead.cliente_nome} — ${tipoMap[lead.tipo_noleggio] || lead.tipo_noleggio} · ${lead.data_ritiro} · ${totalBici > 1 ? `${totalBici} bici · ` : ''}€${totalPrezzo}`,
          url:   '/admin',
        }).catch(e => console.error('Push:', e)),
      ]);
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
      id, cliente_nome, cliente_email, bicicletta_id, tipo_noleggio,
      giorni, data_ritiro, orario_ritiro, data_restituzione, orario_restituzione,
      prezzo_totale, pagamento_status, created_at
    `)
    .eq('stripe_session_id', sessionId)
    .eq('pagamento_status', 'paid')
    .order('created_at', { ascending: true });

  if (error || !data?.length) {
    return res.status(404).json({ error: 'Prenotazione non trovata' });
  }

  const totalPrezzo = data.reduce((s, p) => s + Number(p.prezzo_totale), 0);
  return res.json({ ...data[0], prezzo_totale: totalPrezzo, total_bikes: data.length });
});

module.exports = router;
