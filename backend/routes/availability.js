/**
 * POST /api/availability         — disponibilità bici per data + tipo_noleggio
 * POST /api/availability/calcola-restituzione — calcola data/orario restituzione
 * POST /api/availability/calendario           — disponibilità mensile
 */

const express  = require('express');
const router   = express.Router();
const supabase = require('../lib/supabase');

// ─── Prezzi default + caricamento da config DB ────────────────────────────────

const PREZZI_DEFAULTS = {
  ecity: { mezza: 35, intera: 45, multi: { 2:84,3:120,4:152,5:180,6:205,7:225 }, extra: 20 },
  emtb:  { mezza: 35, intera: 45, multi: { 2:84,3:120,4:152,5:180,6:205,7:225 }, extra: 20 },
  bimbo: { mezza: 28, intera: 40, multi: { 2:75,3:107,4:136,5:163,6:187,7:208 }, extra: 20 },
};

async function loadPrezziFromConfig() {
  try {
    const { data } = await supabase.from('config').select('chiave, valore');
    if (!data || data.length === 0) return PREZZI_DEFAULTS;
    const cfg = {};
    data.forEach(r => { const v = Number(r.valore); if (v > 0) cfg[r.chiave] = v; });
    const result = JSON.parse(JSON.stringify(PREZZI_DEFAULTS));
    for (const bike of ['ecity', 'emtb', 'bimbo']) {
      if (cfg[`price_${bike}_mezza`])  result[bike].mezza  = cfg[`price_${bike}_mezza`];
      if (cfg[`price_${bike}_intera`]) result[bike].intera = cfg[`price_${bike}_intera`];
      for (let n = 2; n <= 7; n++) {
        if (cfg[`price_${bike}_multi_${n}`]) result[bike].multi[n] = cfg[`price_${bike}_multi_${n}`];
      }
    }
    return result;
  } catch {
    return PREZZI_DEFAULTS;
  }
}

// Mappa tipo_noleggio → orari fissi
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

  // Verifica chiusure
  const { data: chiusureRows } = await supabase.from('chiusure').select('data');
  const chiusureSet = new Set((chiusureRows || []).map(c => c.data));
  const numGiorniReq = Number(giorni);
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
    .select('bicicletta_id')
    .eq('pagamento_status', 'paid')
    .lt('start_ts', end.toISOString())
    .gt('end_ts', start.toISOString());

  if (error) return res.status(500).json({ error: 'Errore database' });

  const biciOccupate = new Set(occupate.map(r => r.bicicletta_id));
  const tutti        = [1,2,3,4,5,6,7,8,9,10];
  const disponibili  = tutti.filter(id => !biciOccupate.has(id));

  // Conta per tipo
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
  return res.json(calcRestituzione(data_ritiro, tipo_noleggio, Number(giorni)));
});

// ─── POST /api/availability/calendario ───────────────────────────────────────

router.post('/calendario', async (req, res) => {
  const { anno, mese } = req.body;
  if (!anno || !mese) return res.status(400).json({ error: 'anno e mese obbligatori' });

  const primoGiorno  = new Date(anno, mese - 1, 1);
  const ultimoGiorno = new Date(anno, mese, 0);
  const dataInizio   = primoGiorno.toISOString().substring(0, 10);
  const dataFine     = ultimoGiorno.toISOString().substring(0, 10);

  const { data: prenotazioni, error } = await supabase
    .from('prenotazioni')
    .select('bicicletta_id, start_ts, end_ts')
    .eq('pagamento_status', 'paid')
    .gte('end_ts',   dataInizio + 'T00:00:00Z')
    .lte('start_ts', dataFine   + 'T23:59:59Z');

  if (error) return res.status(500).json({ error: 'Errore database' });

  const { data: chiusureCal } = await supabase.from('chiusure').select('data');
  const chiusureCalSet = new Set((chiusureCal || []).map(c => c.data));

  const TOTALE = 10;
  const risultati = {};
  for (let d = 1; d <= ultimoGiorno.getDate(); d++) {
    const dataStr  = `${anno}-${String(mese).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const dayStart = new Date(dataStr + 'T00:00:00+01:00');
    const dayEnd   = new Date(dataStr + 'T23:59:59+01:00');

    const occupate = new Set(
      prenotazioni
        .filter(p => new Date(p.start_ts) < dayEnd && new Date(p.end_ts) > dayStart)
        .map(p => p.bicicletta_id)
    );

    risultati[dataStr] = {
      disponibili: TOTALE - occupate.size,
      occupate:    occupate.size,
      chiuso:      chiusureCalSet.has(dataStr),
    };
  }

  return res.json(risultati);
});

// ─── GET /api/availability/prezzi ─────────────────────────────────────────────
// Endpoint pubblico — restituisce prezzi correnti per il wizard di prenotazione

router.get('/prezzi', async (req, res) => {
  res.json(await loadPrezziFromConfig());
});

module.exports = router;
module.exports.calcRange             = calcRange;
module.exports.calcRestituzione      = calcRestituzione;
module.exports.loadPrezziFromConfig  = loadPrezziFromConfig;
