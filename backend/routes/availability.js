/**
 * POST /api/availability         — disponibilità bici per data + tipo_noleggio
 * POST /api/availability/calcola-restituzione — calcola data/orario restituzione
 * POST /api/availability/calendario           — disponibilità mensile
 */

const express  = require('express');
const router   = express.Router();
const supabase = require('../lib/supabase');

// ─── Prezzi stagionali ────────────────────────────────────────────────────────
// Bassa stagione: 01/04–30/06 e 01/09–31/10
// Alta stagione:  01/07–31/08
// Fuori stagione: novembre–marzo (nessuna prenotazione)

const SEASONAL_PRICES = {
  bassa: {
    ecity: { mezza: 35, intera: 45, due_giorni: 84,  extra: 40 },
    emtb:  { mezza: 40, intera: 55, due_giorni: 100, extra: 50 },
    bimbo: { mezza: 8,  intera: 11, due_giorni: 20,  extra: 9  },
  },
  alta: {
    ecity: { mezza: 40, intera: 50, due_giorni: 95,  extra: 45 },
    emtb:  { mezza: 45, intera: 55, due_giorni: 100, extra: 50 },
    bimbo: { mezza: 10, intera: 14, due_giorni: 26,  extra: 12 },
  },
};

function getStagione(dateStr) {
  const [, mm, dd] = dateStr.split('-').map(Number);
  const mmdd = mm * 100 + dd;
  if (mmdd >= 401 && mmdd <= 630) return 'bassa';
  if (mmdd >= 701 && mmdd <= 831) return 'alta';
  if (mmdd >= 901 && mmdd <= 1031) return 'bassa';
  return null; // nov–mar: fuori stagione
}

function calcolaPrezzo(bike_type, tipo_noleggio, giorni, data_ritiro) {
  const stagione = getStagione(data_ritiro);
  if (!stagione) return 0;
  const p = SEASONAL_PRICES[stagione][bike_type];
  if (!p) return 0;
  if (tipo_noleggio === 'mezza_mattina' || tipo_noleggio === 'mezza_pomeriggio') return p.mezza;
  if (tipo_noleggio === 'intera_giornata') return p.intera;
  if (tipo_noleggio === 'multi_giorno') {
    const n = Number(giorni);
    if (n < 2) return 0;
    return p.due_giorni + (n - 2) * p.extra;
  }
  return 0;
}

// ─── Helpers di calcolo ───────────────────────────────────────────────────────

function getOrari(tipo_noleggio) {
  if (tipo_noleggio === 'mezza_mattina')    return { ritiro: '09:00', restituzione: '13:00' };
  if (tipo_noleggio === 'mezza_pomeriggio') return { ritiro: '14:00', restituzione: '18:00' };
  if (tipo_noleggio === 'intera_giornata')  return { ritiro: '09:00', restituzione: '18:00' };
  if (tipo_noleggio === 'multi_giorno')     return { ritiro: '09:00', restituzione: '18:00' };
  return { ritiro: '09:00', restituzione: '18:00' };
}

function calcRange(data_ritiro, tipo_noleggio, giorni = 1) {
  const orari = getOrari(tipo_noleggio);
  const start = new Date(`${data_ritiro}T${orari.ritiro}:00+01:00`);
  let end;

  if (tipo_noleggio === 'mezza_mattina') {
    end = new Date(`${data_ritiro}T13:00:00+01:00`);
  } else if (tipo_noleggio === 'mezza_pomeriggio') {
    end = new Date(`${data_ritiro}T18:00:00+01:00`);
  } else if (tipo_noleggio === 'intera_giornata') {
    end = new Date(`${data_ritiro}T18:00:00+01:00`);
  } else {
    // multi_giorno: giorno 1 ore 09:00 → giorno N ore 18:00
    const base = new Date(`${data_ritiro}T00:00:00+01:00`);
    base.setDate(base.getDate() + Number(giorni) - 1);
    const lastDay = base.toISOString().substring(0, 10);
    end = new Date(`${lastDay}T18:00:00+01:00`);
  }

  return { start, end };
}

function calcRestituzione(data_ritiro, tipo_noleggio, giorni = 1) {
  const { end } = calcRange(data_ritiro, tipo_noleggio, giorni);
  const orari   = getOrari(tipo_noleggio);

  let data_restituzione;
  if (tipo_noleggio === 'multi_giorno') {
    const base = new Date(`${data_ritiro}T00:00:00+01:00`);
    base.setDate(base.getDate() + Number(giorni) - 1);
    data_restituzione = base.toISOString().substring(0, 10);
  } else {
    data_restituzione = data_ritiro;
  }

  return {
    data_restituzione,
    orario_restituzione: tipo_noleggio === 'multi_giorno' ? '18:00' : orari.restituzione,
    orario_ritiro:       orari.ritiro,
    end_ts:              end.toISOString(),
  };
}

// ─── POST /api/availability ────────────────────────────────────────────────────

router.post('/', async (req, res) => {
  const { data_ritiro, tipo_noleggio, giorni = 1 } = req.body;
  if (!data_ritiro || !tipo_noleggio) return res.status(400).json({ error: 'Parametri mancanti' });

  if (!getStagione(data_ritiro)) {
    return res.status(400).json({ error: 'Data fuori stagione — apertura dal 1 aprile al 31 ottobre', fuori_stagione: true });
  }

  const { data: chiusureRows } = await supabase.from('chiusure').select('data');
  const chiusureSet = new Set((chiusureRows || []).map(c => c.data));
  const numGiorniReq = Number(giorni);
  if (!Number.isInteger(numGiorniReq) || numGiorniReq < 1 || numGiorniReq > 30) {
    return res.status(400).json({ error: 'Numero giorni non valido (1-30)' });
  }
  for (let i = 0; i < (tipo_noleggio === 'multi_giorno' ? numGiorniReq : 1); i++) {
    const d = new Date(`${data_ritiro}T00:00:00`);
    d.setDate(d.getDate() + i);
    const ds = d.toISOString().substring(0, 10);
    if (chiusureSet.has(ds)) {
      return res.status(400).json({ error: 'Data non disponibile — negozio chiuso', chiuso: true });
    }
  }

  const { start, end } = calcRange(data_ritiro, tipo_noleggio, Number(giorni));

  const { data: occupate, error } = await supabase
    .from('prenotazioni')
    .select('bicicletta_id, bici_ids')
    .eq('pagamento_status', 'paid')
    .lt('start_ts', end.toISOString())
    .gt('end_ts', start.toISOString());

  if (error) return res.status(500).json({ error: 'Errore database' });

  // Escludi bici in manutenzione/guasto/fuori uso dalla flotta noleggiabile
  const { data: flotta } = await supabase
    .from('biciclette')
    .select('id, stato')
    .eq('stato', 'disponibile');
  const fleetActive  = new Set((flotta || []).map(r => r.id));

  // Una prenotazione può coprire più bici: usa bici_ids se presente, altrimenti bicicletta_id
  const biciOccupate = new Set();
  for (const r of (occupate || [])) {
    const ids = Array.isArray(r.bici_ids) && r.bici_ids.length ? r.bici_ids : [r.bicicletta_id];
    for (const id of ids) biciOccupate.add(id);
  }
  const tutti        = [1,2,3,4,5,6,7,8,9,10].filter(id => fleetActive.has(id));
  const disponibili  = tutti.filter(id => !biciOccupate.has(id));

  const PER_TIPO = { ecity: [1,2], emtb: [3,4,5,6,7,8,9], bimbo: [10] };
  const per_tipo = {};
  for (const [tipo, ids] of Object.entries(PER_TIPO)) {
    per_tipo[tipo] = ids.filter(id => disponibili.includes(id)).length;
  }

  return res.json({ disponibili: disponibili.length, bici_ids: disponibili, per_tipo, occupate: biciOccupate.size });
});

// ─── POST /api/availability/calcola-restituzione ──────────────────────────────

router.post('/calcola-restituzione', (req, res) => {
  const { data_ritiro, tipo_noleggio, giorni = 1 } = req.body;
  if (!data_ritiro || !tipo_noleggio) return res.status(400).json({ error: 'Parametri mancanti' });
  const g = Number(giorni);
  if (!Number.isInteger(g) || g < 1 || g > 30) {
    return res.status(400).json({ error: 'Numero giorni non valido (1-30)' });
  }
  return res.json(calcRestituzione(data_ritiro, tipo_noleggio, g));
});

// ─── POST /api/availability/calendario ───────────────────────────────────────

router.post('/calendario', async (req, res) => {
  const { anno, mese } = req.body;
  if (!anno || !mese) return res.status(400).json({ error: 'anno e mese obbligatori' });

  const annoN = Number(anno), meseN = Number(mese);
  if (!Number.isInteger(annoN) || annoN < 2024 || annoN > 2035 ||
      !Number.isInteger(meseN) || meseN < 1 || meseN > 12) {
    return res.status(400).json({ error: 'anno (2024-2035) o mese (1-12) non validi' });
  }

  const primoGiorno  = new Date(annoN, meseN - 1, 1);
  const ultimoGiorno = new Date(annoN, meseN, 0);
  const dataInizio   = primoGiorno.toISOString().substring(0, 10);
  const dataFine     = ultimoGiorno.toISOString().substring(0, 10);

  const { data: prenotazioni, error } = await supabase
    .from('prenotazioni')
    .select('bicicletta_id, bici_ids, start_ts, end_ts')
    .eq('pagamento_status', 'paid')
    .gte('end_ts',   dataInizio + 'T00:00:00Z')
    .lte('start_ts', dataFine   + 'T23:59:59Z');

  if (error) return res.status(500).json({ error: 'Errore database' });

  const { data: chiusureCal } = await supabase.from('chiusure').select('data');
  const chiusureCalSet = new Set((chiusureCal || []).map(c => c.data));

  // Conta solo le bici operative (escludi guasto/manutenzione/fuori uso)
  const { data: flottaCal } = await supabase
    .from('biciclette')
    .select('id, stato')
    .eq('stato', 'disponibile');
  const fleetActiveCal = new Set((flottaCal || []).map(r => r.id));
  const TOTALE = fleetActiveCal.size || 10;
  const risultati = {};
  for (let d = 1; d <= ultimoGiorno.getDate(); d++) {
    const dataStr  = `${anno}-${String(mese).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const dayStart = new Date(dataStr + 'T00:00:00+01:00');
    const dayEnd   = new Date(dataStr + 'T23:59:59+01:00');

    if (!getStagione(dataStr)) {
      risultati[dataStr] = { disponibili: 0, occupate: 0, chiuso: false, fuori_stagione: true };
      continue;
    }

    const chiuso = chiusureCalSet.has(dataStr);
    const occupate = new Set();
    for (const p of prenotazioni) {
      if (!(new Date(p.start_ts) < dayEnd && new Date(p.end_ts) > dayStart)) continue;
      const ids = Array.isArray(p.bici_ids) && p.bici_ids.length ? p.bici_ids : [p.bicicletta_id];
      for (const id of ids) if (fleetActiveCal.has(id)) occupate.add(id);
    }

    risultati[dataStr] = {
      disponibili: chiuso ? 0 : TOTALE - occupate.size,
      occupate:    occupate.size,
      chiuso,
    };
  }

  return res.json(risultati);
});

module.exports = router;
module.exports.calcRange        = calcRange;
module.exports.calcRestituzione = calcRestituzione;
module.exports.getStagione      = getStagione;
module.exports.calcolaPrezzo    = calcolaPrezzo;
module.exports.SEASONAL_PRICES  = SEASONAL_PRICES;
