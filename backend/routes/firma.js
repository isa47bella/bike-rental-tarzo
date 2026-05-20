const express  = require('express');
const crypto   = require('crypto');
const router   = express.Router();
const supabase = require('../lib/supabase');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Confronto timing-safe del token segreto.
function safeEqual(a, b) {
  const bufA = Buffer.from(String(a ?? ''));
  const bufB = Buffer.from(String(b ?? ''));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// Verifica il token segreto contro la prenotazione. Le prenotazioni create
// prima della migrazione hanno firma_token NULL → modalità legacy senza token.
function tokenValido(prenotazione, tokenFornito) {
  if (!prenotazione.firma_token) return true; // riga pre-migrazione
  return safeEqual(tokenFornito, prenotazione.firma_token);
}

// GET /api/firma/:id?token=... — info prenotazione per la pagina contratto
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  if (!UUID_RE.test(id)) return res.status(404).json({ error: 'Prenotazione non trovata' });

  const { data, error } = await supabase
    .from('prenotazioni')
    .select('id, cliente_nome, tipo_noleggio, giorni, data_ritiro, orario_ritiro, data_restituzione, orario_restituzione, prezzo_totale, lingua, firma_at, firma_nome, pagamento_status, firma_token')
    .eq('id', id)
    .single();

  if (error || !data) return res.status(404).json({ error: 'Prenotazione non trovata' });
  if (!tokenValido(data, req.query.token)) {
    return res.status(403).json({ error: 'Link non valido o scaduto' });
  }
  if (data.pagamento_status !== 'paid') return res.status(403).json({ error: 'Prenotazione non confermata' });

  delete data.firma_token; // non esporre il segreto nella risposta
  return res.json(data);
});

// POST /api/firma/:id — salva la firma (accettazione + nome + IP)
router.post('/:id', async (req, res) => {
  const { id } = req.params;
  if (!UUID_RE.test(id)) return res.status(404).json({ error: 'Prenotazione non trovata' });

  const { firma_nome, token } = req.body;
  if (!firma_nome || !firma_nome.trim()) {
    return res.status(400).json({ error: 'Nome firma obbligatorio' });
  }

  const { data: existing, error: fetchErr } = await supabase
    .from('prenotazioni')
    .select('firma_at, pagamento_status, firma_token')
    .eq('id', id)
    .single();

  if (fetchErr || !existing) return res.status(404).json({ error: 'Prenotazione non trovata' });
  if (!tokenValido(existing, token)) return res.status(403).json({ error: 'Link non valido o scaduto' });
  if (existing.pagamento_status !== 'paid') return res.status(403).json({ error: 'Prenotazione non confermata' });
  if (existing.firma_at) return res.status(409).json({ error: 'Contratto già firmato' });

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || '';

  // Update atomico: il filtro .is('firma_at', null) impedisce la doppia firma
  // concorrente (due POST simultanee → solo la prima aggiorna una riga).
  const { data: updated, error: updateErr } = await supabase
    .from('prenotazioni')
    .update({ firma_at: new Date().toISOString(), firma_nome: firma_nome.trim(), firma_ip: ip })
    .eq('id', id)
    .is('firma_at', null)
    .select('id');

  if (updateErr) return res.status(500).json({ error: 'Errore salvataggio firma' });
  if (!updated || updated.length === 0) return res.status(409).json({ error: 'Contratto già firmato' });

  return res.json({ ok: true });
});

module.exports = router;
