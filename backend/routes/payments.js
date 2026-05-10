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
const { sendConfirmationToCliente, sendNotificationToGestore } = require('../lib/email');
const { calcRange, calcRestituzione } = require('./availability');

const TOTAL_BIKES = 10;

// ─── Calcolo prezzo ───────────────────────────────────────────────────────────

function calcolaPrezzo(tipo_noleggio, giorni = 1) {
  if (tipo_noleggio === '4_ore')           return 30;
  if (tipo_noleggio === 'intera_giornata') return 50;
  if (tipo_noleggio === '3_piu_giorni')    return 45 * Number(giorni);
  throw new Error('Tipo noleggio non valido');
}

function tipoLabel(tipo) {
  const labels = {
    '4_ore':           'Noleggio 4 Ore (€30)',
    'intera_giornata': 'Noleggio Intera Giornata (€50)',
    '3_piu_giorni':    'Noleggio Multi-Giorno',
  };
  return labels[tipo] || tipo;
}

// ─── POST /api/payments/checkout ─────────────────────────────────────────────

router.post('/checkout', async (req, res) => {
  const {
    cliente_nome, cliente_email, cliente_telefono, cliente_note,
    bicicletta_id,
    tipo_noleggio, giorni = 1,
    data_ritiro, orario_ritiro,
  } = req.body;

  // Validazione input
  if (!cliente_nome || !cliente_email || !cliente_telefono) {
    return res.status(400).json({ error: 'Dati cliente mancanti' });
  }
  if (!bicicletta_id || !tipo_noleggio || !data_ritiro || !orario_ritiro) {
    return res.status(400).json({ error: 'Dati prenotazione mancanti' });
  }
  if (bicicletta_id < 1 || bicicletta_id > TOTAL_BIKES) {
    return res.status(400).json({ error: 'Bicicletta non valida' });
  }

  // Calcola range prenotazione
  const numGiorni = Number(giorni);
  const { start, end } = calcRange(data_ritiro, orario_ritiro, tipo_noleggio, numGiorni);
  const { data_restituzione, orario_restituzione } = calcRestituzione(
    data_ritiro, orario_ritiro, tipo_noleggio, numGiorni
  );

  // Double-check disponibilità bici scelta
  const { data: conflitti } = await supabase
    .from('prenotazioni')
    .select('id')
    .eq('bicicletta_id', bicicletta_id)
    .eq('pagamento_status', 'paid')
    .lt('start_ts', end.toISOString())
    .gt('end_ts', start.toISOString());

  if (conflitti && conflitti.length > 0) {
    return res.status(409).json({
      error: 'La bicicletta selezionata non è più disponibile. Aggiorna la pagina e riprova.',
    });
  }

  const prezzo = calcolaPrezzo(tipo_noleggio, numGiorni);

  // Crea prenotazione PENDING nel database
  const { data: prenotazione, error: dbError } = await supabase
    .from('prenotazioni')
    .insert({
      cliente_nome,
      cliente_email,
      cliente_telefono,
      cliente_note:        cliente_note || null,
      bicicletta_id:       Number(bicicletta_id),
      tipo_noleggio,
      giorni:              numGiorni,
      data_ritiro,
      orario_ritiro,
      data_restituzione,
      orario_restituzione,
      start_ts:            start.toISOString(),
      end_ts:              end.toISOString(),
      prezzo_totale:       prezzo,
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
          unit_amount:  prezzo * 100, // centesimi
          product_data: {
            name:        tipoLabel(tipo_noleggio),
            description: `Noleggio bici Papin Sport — ${data_ritiro} ore ${orario_ritiro}`,
            images:      [],
          },
        },
        quantity: 1,
      }],
      payment_intent_data: {
        setup_future_usage: 'off_session',
      },
      metadata: {
        prenotazione_id: prenotazione.id,
        bicicletta_id:   String(bicicletta_id),
        tipo_noleggio,
      },
      success_url: `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${process.env.FRONTEND_URL}/cancel`,
    });

    // Salva stripe_session_id
    await supabase
      .from('prenotazioni')
      .update({ stripe_session_id: session.id })
      .eq('id', prenotazione.id);

    return res.json({ url: session.url, session_id: session.id });

  } catch (stripeError) {
    console.error('Errore Stripe:', stripeError);
    // Rimuovi prenotazione pending se Stripe fallisce
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

    // Invia email (non bloccante — ignora errori email)
    if (prenotazione) {
      Promise.all([
        sendConfirmationToCliente(prenotazione).catch(e => console.error('Email cliente:', e)),
        sendNotificationToGestore(prenotazione).catch(e => console.error('Email gestore:', e)),
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
