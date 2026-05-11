const express  = require('express');
const router   = express.Router();
const supabase = require('../lib/supabase');

// GET /api/firma/:id — public, limited booking info for contract page
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('prenotazioni')
    .select('id, cliente_nome, tipo_noleggio, giorni, data_ritiro, orario_ritiro, data_restituzione, orario_restituzione, prezzo_totale, lingua, firma_at, firma_nome, pagamento_status')
    .eq('id', id)
    .single();

  if (error || !data) return res.status(404).json({ error: 'Prenotazione non trovata' });
  if (data.pagamento_status !== 'paid') return res.status(403).json({ error: 'Prenotazione non confermata' });

  return res.json(data);
});

// POST /api/firma/:id — save signature (checkbox acceptance + name + IP)
router.post('/:id', async (req, res) => {
  const { id } = req.params;
  const { firma_nome } = req.body;

  if (!firma_nome || !firma_nome.trim()) {
    return res.status(400).json({ error: 'Nome firma obbligatorio' });
  }

  const { data: existing, error: fetchErr } = await supabase
    .from('prenotazioni')
    .select('firma_at, pagamento_status')
    .eq('id', id)
    .single();

  if (fetchErr || !existing) return res.status(404).json({ error: 'Prenotazione non trovata' });
  if (existing.pagamento_status !== 'paid') return res.status(403).json({ error: 'Prenotazione non confermata' });
  if (existing.firma_at) return res.status(409).json({ error: 'Contratto già firmato' });

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || '';

  const { error: updateErr } = await supabase
    .from('prenotazioni')
    .update({ firma_at: new Date().toISOString(), firma_nome: firma_nome.trim(), firma_ip: ip })
    .eq('id', id);

  if (updateErr) return res.status(500).json({ error: 'Errore salvataggio firma' });

  return res.json({ ok: true });
});

module.exports = router;
