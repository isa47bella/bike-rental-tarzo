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
const { calcRange, calcRestituzione } = require('./availability');
const { sendPushToAll } = require('../lib/push');

// Prezzi per tipo di bici (Dobbiaco bassa stagione)
const PREZZI = {
  ecity: { mezza: 35, intera: 45, multi: { 2:84,3:120,4:152,5:180,6:205,7:225 }, extra: 20 },
  emtb:  { mezza: 35, intera: 45, multi: { 2:84,3:120,4:152,5:180,6:205,7:225 }, extra: 20 },
  bimbo: { mezza: 28, intera: 40, multi: { 2:75,3:107,4:136,5:163,6:187,7:208 }, extra: 20 },
};

const TIPO_IDS_BICI = { ecity: [1,2], emtb: [3,4,5,6,7,8,9], bimbo: [10] };

function calcolaPrezzo(bike_type, tipo_noleggio, giorni = 1) {
  const p = PREZZI[bike_type];
  if (!p) throw new Error('Tipo bici non valido');
  if (tipo_noleggio === 'mezza_mattina' || tipo_noleggio === 'mezza_pomeriggio') return p.mezza;
  if (tipo_noleggio === 'intera_giornata') return p.intera;
  if (tipo_noleggio === 'multi_giorno') {
    const n = Number(giorni);
    if (n >= 2 && n <= 7) return p.multi[n];
    if (n > 7) return p.multi[7] + (n - 7) * p.extra;
    throw new Error('Multi-giorno richiede almeno 2 giorni');
  }
  throw new Error('Tipo noleggio non valido');
}

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

// ─── POST /api/payments/checkout ─────────────────────────────────────────────

router.post('/checkout', async (req, res) => {
  const {
    cliente_nome, cliente_email, cliente_telefono, cliente_note,
    bike_type,
    tipo_noleggio, giorni = 1,
    data_ritiro,
    accessori: accessoriRaw = [],
    lingua = 'it',
  } = req.body;

  const VALID_ACC = ['casco', 'lucchetto', 'kit_foro'];
  const accessoriStr = (Array.isArray(accessoriRaw) ? accessoriRaw : [])
    .filter(a => VALID_ACC.includes(a))
    .join(',');

  // Validazione
  if (!cliente_nome || !cliente_email || !cliente_telefono) {
    return res.status(400).json({ error: 'Dati cliente mancanti' });
  }
  if (!bike_type || !tipo_noleggio || !data_ritiro) {
    return res.status(400).json({ error: 'Dati prenotazione mancanti' });
  }
  if (!PREZZI[bike_type]) {
    return res.status(400).json({ error: 'Tipo bici non valido' });
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

  // Calcola orari e range temporale
  const orari    = getOrariFromTipo(tipo_noleggio);
  const numGiorni = Number(giorni);
  const { start, end } = calcRange(data_ritiro, tipo_noleggio, numGiorni);
  const { data_restituzione, orario_restituzione } = calcRestituzione(data_ritiro, tipo_noleggio, numGiorni);

  // Trova bici disponibili del tipo richiesto
  const idsCandidati = TIPO_IDS_BICI[bike_type];
  const { data: conflitti } = await supabase
    .from('prenotazioni')
    .select('bicicletta_id')
    .eq('pagamento_status', 'paid')
    .lt('start_ts', end.toISOString())
    .gt('end_ts', start.toISOString())
    .in('bicicletta_id', idsCandidati);

  const biciOccupate  = new Set((conflitti || []).map(r => r.bicicletta_id));
  const biciLibere    = idsCandidati.filter(id => !biciOccupate.has(id));

  if (biciLibere.length === 0) {
    return res.status(409).json({ error: `Nessuna ${bike_type === 'bimbo' ? 'E-MTB Bimbo' : bike_type === 'ecity' ? 'E-City Bike' : 'E-MTB'} disponibile per questa data. Scegli un altro modello o contattaci.` });
  }

  const bicicletta_id = biciLibere[0]; // assegna la prima libera
  const prezzo        = calcolaPrezzo(bike_type, tipo_noleggio, numGiorni);

  // Crea prenotazione PENDING
  const { data: prenotazione, error: dbError } = await supabase
    .from('prenotazioni')
    .insert({
      cliente_nome,
      cliente_email,
      cliente_telefono,
      cliente_note:        cliente_note || null,
      bicicletta_id,
      tipo_noleggio,
      giorni:              numGiorni,
      data_ritiro,
      orario_ritiro:       orari.ritiro,
      data_restituzione,
      orario_restituzione,
      start_ts:            start.toISOString(),
      end_ts:              end.toISOString(),
      prezzo_totale:       prezzo,
      accessori:           accessoriStr,
      lingua:              ['it','en','de','es','fr'].includes(lingua) ? lingua : 'it',
      pagamento_status:    'pending',
    })
    .select()
    .single();

  if (dbError) {
    console.error('Errore creazione prenotazione:', dbError);
    return res.status(500).json({ error: 'Errore salvataggio prenotazione' });
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
      line_items: [{
        price_data: {
          currency:     'eur',
          unit_amount:  prezzo * 100,
          product_data: {
            name:        tipoLabel(tipo_noleggio),
            description: `Noleggio e-bike — ${data_ritiro} ore ${orari.ritiro}`,
            images:      [],
          },
        },
        quantity: 1,
      }],
      payment_intent_data: { setup_future_usage: 'off_session' },
      metadata: { prenotazione_id: prenotazione.id, bicicletta_id: String(bicicletta_id), tipo_noleggio },
      success_url: `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${process.env.FRONTEND_URL}/cancel`,
    });

    await supabase.from('prenotazioni').update({ stripe_session_id: session.id }).eq('id', prenotazione.id);
    return res.json({ url: session.url, session_id: session.id });

  } catch (stripeError) {
    console.error('Errore Stripe:', stripeError);
    await supabase.from('prenotazioni').delete().eq('id', prenotazione.id);
    return res.status(500).json({ error: 'Errore pagamento: ' + stripeError.message });
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

    // Aggiorna prenotazione a PAID
    const { data: prenotazione, error } = await supabase
      .from('prenotazioni')
      .update({
        pagamento_status:  'paid',
        stripe_session_id: session.id,
        stripe_payment_id: session.payment_intent,
      })
      .eq('stripe_session_id', session.id)
      .select()
      .single();

    if (error) {
      console.error('Errore update prenotazione:', error);
      return res.status(500).send('DB error');
    }

    // Salva customer_id e payment_method
    let paymentMethodId = null;
    if (session.payment_intent) {
      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent);
        paymentMethodId = paymentIntent.payment_method;
        await supabase
          .from('prenotazioni')
          .update({
            stripe_customer_id:       session.customer,
            stripe_payment_method_id: paymentMethodId,
          })
          .eq('stripe_session_id', session.id);
      } catch (e) {
        console.error('Errore salvataggio payment method:', e);
      }
    }

    // Cauzione: il blocco €1.000 avviene tramite cron job 2 giorni prima del ritiro
    // (cauzione_status rimane 'pending' fino all'esecuzione del cron)

    // Invia email + WhatsApp (non bloccante — ignora errori)
    if (prenotazione) {
      const tipoMap = { mezza_mattina: '½ Mattina', mezza_pomeriggio: '½ Pomeriggio', intera_giornata: 'Giornata', multi_giorno: 'Multi-giorno' };
      Promise.all([
        sendConfirmationToCliente(prenotazione).catch(e => console.error('Email cliente:', e)),
        sendNotificationToGestore(prenotazione).catch(e => console.error('Email gestore:', e)),
        sendWhatsAppAlert(prenotazione).catch(e => console.error('WhatsApp alert:', e)),
        sendPushToAll({
          title: '🚲 Nuova prenotazione!',
          body:  `${prenotazione.cliente_nome} — ${tipoMap[prenotazione.tipo_noleggio] || prenotazione.tipo_noleggio} · ${prenotazione.data_ritiro} · €${prenotazione.prezzo_totale}`,
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
    .single();

  if (error || !data) {
    return res.status(404).json({ error: 'Prenotazione non trovata' });
  }

  return res.json(data);
});

module.exports = router;
