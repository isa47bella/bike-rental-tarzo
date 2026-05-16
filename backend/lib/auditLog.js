const supabase = require('./supabase');

const CRITICAL_ACTIONS = new Set(['charge_damage', 'capture_deposit', 'refund']);

async function logAction(azione, bookingId, dettagli = {}, ip = null) {
  try {
    await supabase.from('audit_log').insert({
      azione,
      booking_id: bookingId || null,
      dettagli,
      ip,
    });
  } catch (e) {
    if (CRITICAL_ACTIONS.has(azione)) {
      // Per azioni finanziarie: log strutturato per recupero manuale da Vercel logs
      console.error('[audit_log CRITICO] Azione finanziaria non registrata nel DB:', JSON.stringify({ azione, bookingId, dettagli, error: e.message }));
    } else {
      console.error('[audit_log]', e.message);
    }
  }
}

module.exports = { logAction };
