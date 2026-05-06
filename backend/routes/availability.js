/**
 * Rotta: POST /api/availability
 * Restituisce quante bici sono disponibili per una combinazione
 * data + orario + tipo_noleggio (+ giorni per multi-day).
 *
 * Logica overlap: una bici è OCCUPATA se esiste una prenotazione PAID
 * il cui intervallo [start_ts, end_ts] si sovrappone all'intervallo richiesto.
 * Overlap = NOT (existing_end <= new_start OR existing_start >= new_end)
 */

const express   = require('express');
const router    = express.Router();
const supabase  = require('../lib/supabase');

// ─── Helper: calcola start/end da input ──────────────────────────────────────

function calcRange(data_ritiro, orario_ritiro, tipo_noleggio, giorni = 1) {
  // Forza timezone Europa/Roma sommando offset (il server potrebbe girare in UTC)
  // Usiamo date string ISO-like con timezone esplicita
  const startStr = `${data_ritiro}T${orario_ritiro}:00+01:00`;
  const start    = new Date(startStr);
  let end;

  if (tipo_noleggio === '4_ore') {
    end = new Date(start.getTime() + 4 * 60 * 60 * 1000);
  } else if (tipo_noleggio === 'intera_giornata') {
    end = new Date(start.getTime() + 8 * 60 * 60 * 1000);
  } else {
    // 3_piu_giorni: stesso orario tra N giorni
    end = new Date(start.getTime() + giorni * 24 * 60 * 60 * 1000);
  }

  return { start, end };
}

function calcRestituzione(data_ritiro, orario_ritiro, tipo_noleggio, giorni = 1) {
  const { end } = calcRange(data_ritiro, orario_ritiro, tipo_noleggio, giorni);

  const data_restituzione  = end.toISOString().substring(0, 10);
  const orario_restituzione = end.toISOString().substring(11, 16);

  return { data_restituzione, orario_restituzione, end_ts: end.toISOString() };
}

// ─── POST /api/availability ───────────────────────────────────────────────────

router.post('/', async (req, res) => {
  const { data_ritiro, orario_ritiro, tipo_noleggio, giorni = 1 } = req.body;

  if (!data_ritiro || !orario_ritiro || !tipo_noleggio) {
    return res.status(400).json({ error: 'Parametri mancanti' });
  }

  const { start, end } = calcRange(data_ritiro, orario_ritiro, tipo_noleggio, Number(giorni));

  // Trova bici che hanno prenotazioni PAID che si sovrappongono
  const { data: occupate, error } = await supabase
    .from('prenotazioni')
    .select('bicicletta_id')
    .eq('pagamento_status', 'paid')
    .lt('start_ts', end.toISOString())
    .gt('end_ts', start.toISOString());

  if (error) {
    console.error('Errore availability:', error);
    return res.status(500).json({ error: 'Errore database' });
  }

  const biciOccupate = new Set(occupate.map(r => r.bicicletta_id));

  // Tutte e 5 le bici
  const tutteLeBici = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const biciDisponibili = tutteLeBici.filter(id => !biciOccupate.has(id));

  return res.json({
    disponibili: biciDisponibili.length,
    bici_ids:    biciDisponibili,
    occupate:    biciOccupate.size,
  });
});

// ─── POST /api/availability/calcola-restituzione ─────────────────────────────

router.post('/calcola-restituzione', (req, res) => {
  const { data_ritiro, orario_ritiro, tipo_noleggio, giorni = 1 } = req.body;

  if (!data_ritiro || !orario_ritiro || !tipo_noleggio) {
    return res.status(400).json({ error: 'Parametri mancanti' });
  }

  const result = calcRestituzione(data_ritiro, orario_ritiro, tipo_noleggio, Number(giorni));
  return res.json(result);
});

// ─── POST /api/availability/calendario ───────────────────────────────────────
// Restituisce disponibilità per ogni giorno di un mese (per colorare il calendario)

router.post('/calendario', async (req, res) => {
  const { anno, mese } = req.body; // mese: 1-12

  if (!anno || !mese) {
    return res.status(400).json({ error: 'anno e mese obbligatori' });
  }

  const primoGiorno   = new Date(anno, mese - 1, 1);
  const ultimoGiorno  = new Date(anno, mese, 0);

  const dataInizio = primoGiorno.toISOString().substring(0, 10);
  const dataFine   = ultimoGiorno.toISOString().substring(0, 10);

  // Prendi tutte le prenotazioni paid che toccano questo mese
  const { data: prenotazioni, error } = await supabase
    .from('prenotazioni')
    .select('bicicletta_id, start_ts, end_ts')
    .eq('pagamento_status', 'paid')
    .gte('end_ts', dataInizio + 'T00:00:00Z')
    .lte('start_ts', dataFine + 'T23:59:59Z');

  if (error) {
    return res.status(500).json({ error: 'Errore database' });
  }

  // Per ogni giorno calcola bici occupate (prende il worst case: orario 08:00)
  const risultati = {};
  for (let d = 1; d <= ultimoGiorno.getDate(); d++) {
    const dataStr = `${anno}-${String(mese).padStart(2,'0')}-${String(d).padStart(2,'0')}`;

    // Conta bici uniche occupate che hanno almeno un overlap con questa data intera
    const dayStart = new Date(dataStr + 'T00:00:00+01:00');
    const dayEnd   = new Date(dataStr + 'T23:59:59+01:00');

    const biciOccupate = new Set(
      prenotazioni
        .filter(p => new Date(p.start_ts) < dayEnd && new Date(p.end_ts) > dayStart)
        .map(p => p.bicicletta_id)
    );

    risultati[dataStr] = {
      disponibili: 5 - biciOccupate.size,
      occupate: biciOccupate.size,
    };
  }

  return res.json(risultati);
});

module.exports = router;
module.exports.calcRange = calcRange;
module.exports.calcRestituzione = calcRestituzione;
