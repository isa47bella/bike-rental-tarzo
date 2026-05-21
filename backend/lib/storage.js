const supabase = require('./supabase');

const BUCKET = 'prenotazioni-foto';

// Slug leggibile dal nome cliente: minuscolo, senza accenti, solo a-z 0-9 e
// trattini. Es. "Mario Rossi" -> "mario-rossi", "D'Angelo" -> "d-angelo".
function slugifyNome(nome) {
  const slug = String(nome || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // toglie gli accenti
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return slug || 'cliente';
}

// Nome della cartella di una prenotazione nel bucket: {nome-slug}-{id breve}.
// L'id breve (primi 8 caratteri dell'UUID) rende la cartella univoca anche tra
// clienti omonimi. Es. folderFor('ca9ec549-...', 'Mario Rossi') -> 'mario-rossi-ca9ec549'.
function folderFor(bookingId, clienteNome) {
  return `${slugifyNome(clienteNome)}-${String(bookingId).slice(0, 8)}`;
}

// Path deterministico di un file nel bucket. slot: documento-fronte |
// documento-retro | bici-consegna | bici-rientro
function pathFor(folder, slot) {
  return `${folder}/${slot}.jpg`;
}

// Carica un data-URL base64 nel bucket. Ritorna il path salvato.
// Lancia un errore se il formato non è valido o l'upload fallisce.
async function uploadFoto(folder, slot, dataUrl) {
  const m = String(dataUrl).match(/^data:(image\/[a-z+]+);base64,(.+)$/i);
  if (!m) throw new Error('Formato immagine non valido');
  const buffer = Buffer.from(m[2], 'base64');
  const path = pathFor(folder, slot);
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

// Rimuove dal bucket i file ai path indicati. Ignora i valori null/vuoti e
// (lato Supabase) i path inesistenti, quindi è sempre sicuro da chiamare.
async function removeFoto(paths) {
  const validi = (paths || []).filter(Boolean);
  if (validi.length === 0) return;
  const { error } = await supabase.storage.from(BUCKET).remove(validi);
  if (error) console.error('[storage] remove error:', error.message);
}

module.exports = { BUCKET, slugifyNome, folderFor, pathFor, uploadFoto, getSignedUrl, removeFoto };
