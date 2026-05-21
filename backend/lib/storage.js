const supabase = require('./supabase');

const BUCKET = 'prenotazioni-foto';

// Path deterministico di un file nel bucket. slot: documento-fronte |
// documento-retro | bici-consegna | bici-rientro
function pathFor(bookingId, slot) {
  return `${bookingId}/${slot}.jpg`;
}

// Carica un data-URL base64 nel bucket. Ritorna il path salvato.
// Lancia un errore se il formato non è valido o l'upload fallisce.
async function uploadFoto(bookingId, slot, dataUrl) {
  const m = String(dataUrl).match(/^data:(image\/[a-z+]+);base64,(.+)$/i);
  if (!m) throw new Error('Formato immagine non valido');
  const buffer = Buffer.from(m[2], 'base64');
  const path = pathFor(bookingId, slot);
  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType: m[1],
    upsert: true,
  });
  if (error) throw new Error(`Upload foto fallito: ${error.message}`);
  return path;
}

// Signed URL temporaneo per un path del bucket. Ritorna null se path
// è vuoto o se la generazione fallisce (es. file già cancellato).
async function getSignedUrl(path, expiresIn = 600) {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn);
  if (error || !data) return null;
  return data.signedUrl;
}

// Rimuove dal bucket i file di una prenotazione per gli slot indicati.
// remove ignora i path inesistenti, quindi è sicuro elencarli tutti.
async function removeBookingFoto(bookingId, slots) {
  const paths = slots.map((s) => pathFor(bookingId, s));
  const { error } = await supabase.storage.from(BUCKET).remove(paths);
  if (error) console.error('[storage] remove error:', error.message);
}

module.exports = { BUCKET, pathFor, uploadFoto, getSignedUrl, removeBookingFoto };
