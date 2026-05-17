const supabase = require('./supabase');

/**
 * Scrive una notifica per l'admin nel pannello.
 * Non blocca: errori sono solo loggati.
 *
 * @param {string} tipo          - es. 'cauzione_failed', 'no_show', 'pending_auto_cancelled'
 * @param {object} payload
 * @param {string} payload.titolo
 * @param {string} [payload.descrizione]
 * @param {string} [payload.booking_id]
 */
async function writeNotification(tipo, { titolo, descrizione = null, booking_id = null }) {
  try {
    const { error } = await supabase.from('notifiche').insert({
      tipo, titolo, descrizione, booking_id,
    });
    if (error) console.error('[notifications] insert error:', error.message);
  } catch (e) {
    console.error('[notifications] unexpected error:', e.message);
  }
}

module.exports = { writeNotification };
