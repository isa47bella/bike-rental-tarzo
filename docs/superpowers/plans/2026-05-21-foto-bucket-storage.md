# Foto su Supabase Storage — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Spostare le foto delle prenotazioni (documenti, bici) da base64 nel database a un bucket privato Supabase Storage, con retention automatica.

**Architecture:** Un helper `storage.js` incapsula le operazioni sul bucket. Gli endpoint checkin/checkout caricano i file nel bucket e salvano il path nelle colonne (già TEXT). Un endpoint dedicato genera signed URL per la visualizzazione. Due cron gestiscono la retention.

**Tech Stack:** Node.js, `@supabase/supabase-js` (API Storage già inclusa), Vercel cron.

**Spec di riferimento:** [`docs/superpowers/specs/2026-05-21-foto-bucket-storage-design.md`](../specs/2026-05-21-foto-bucket-storage-design.md)

## File Structure

| File | Modifica |
|---|---|
| Supabase Storage | Create — bucket privato `prenotazioni-foto` (via script) |
| `backend/lib/storage.js` | Create — helper upload / signed URL / remove |
| `backend/routes/admin.js` | Modify — checkin/checkout caricano nel bucket; nuovo endpoint `/bookings/:id/foto` |
| `backend/routes/cron.js` | Modify — cron `cleanup-documenti`; `gdpr-cleanup` cancella le foto |
| `frontend/src/lib/api.js` | Modify — helper `getBookingFoto` |
| `frontend/src/components/AdminDashboard.jsx` | Modify — `handleViewFoto` usa il nuovo endpoint |
| `vercel.json` | Modify — cron `cleanup-documenti` |

## Note sul testing

Il progetto non ha test automatici. Verifica: `node -c` per la sintassi backend, build Vite per il frontend, e verifica funzionale manuale (Task 6). Non scrivere test Jest/Vitest.

I 4 "slot" foto e la corrispondenza con le colonne DB (riferimento per tutto il piano):

| Colonna DB | Slot (nome file) |
|---|---|
| `documento_foto` | `documento-fronte` |
| `documento_foto_retro` | `documento-retro` |
| `bici_foto_consegna` | `bici-consegna` |
| `bici_foto_rientro` | `bici-rientro` |

Path nel bucket: `{booking_id}/{slot}.jpg`.

---

## Task 1: Creare il bucket privato

**Files:** nessun file del repo — crea il bucket su Supabase Storage.

- [ ] **Step 1: Eseguire lo script di creazione bucket**

```bash
cd "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo/backend"
node -e "
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
s.storage.createBucket('prenotazioni-foto', { public: false }).then(({ error }) => {
  if (error && !/already exists/i.test(error.message)) { console.error('ERRORE:', error.message); process.exit(1); }
  console.log(error ? 'bucket già esistente — ok' : 'bucket creato — ok');
});
"
```
Expected: stampa `bucket creato — ok` (o `bucket già esistente — ok`).

- [ ] **Step 2: Verificare che il bucket sia privato**

```bash
cd "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo/backend"
node -e "
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
s.storage.getBucket('prenotazioni-foto').then(({ data, error }) => {
  if (error) { console.error(error.message); process.exit(1); }
  console.log('bucket:', data.name, 'public:', data.public);
});
"
```
Expected: `bucket: prenotazioni-foto public: false`. Se `public: true`, la task è fallita — riportalo.

Non c'è commit in questo task (nessun file del repo modificato).

---

## Task 2: Helper `backend/lib/storage.js`

**Files:**
- Create: `backend/lib/storage.js`

- [ ] **Step 1: Creare il file**

Crea `backend/lib/storage.js` con questo contenuto esatto:

```javascript
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
```

- [ ] **Step 2: Verificare sintassi**

Run: `cd "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo" && node -c backend/lib/storage.js`
Expected: nessun output.

- [ ] **Step 3: Commit**

```bash
cd "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo"
git add backend/lib/storage.js
git commit -m "feat(storage): helper Supabase Storage per le foto prenotazioni"
```

---

## Task 3: Checkin/checkout caricano nel bucket

**Files:**
- Modify: `backend/routes/admin.js` — endpoint `checkin` (righe ~796-813) e `checkout` (righe ~817+)

**Contesto:** oggi gli endpoint salvano il base64 direttamente nelle colonne. Vanno modificati per caricare il base64 nel bucket via `uploadFoto` e salvare il path. La validazione `validImagePayload` resta invariata (controlla il base64 in ingresso).

- [ ] **Step 1: Importare l'helper storage**

In `backend/routes/admin.js`, dopo la riga `const { writeNotification } = require('../lib/notifications');`, aggiungere:

```javascript
const { uploadFoto, getSignedUrl, removeBookingFoto } = require('../lib/storage');
```

- [ ] **Step 2: Riscrivere l'endpoint `checkin`**

Sostituire INTERAMENTE il corpo della funzione `router.post('/bookings/:id/checkin', ...)` (attualmente righe ~796-813) con:

```javascript
router.post('/bookings/:id/checkin', async (req, res) => {
  const { checkin_note, documento_foto, documento_foto_retro, bici_foto_consegna } = req.body;
  const fotoInput = [
    ['documento_foto',       'documento-fronte', documento_foto],
    ['documento_foto_retro', 'documento-retro',  documento_foto_retro],
    ['bici_foto_consegna',   'bici-consegna',    bici_foto_consegna],
  ];
  for (const [nome, , val] of fotoInput) {
    if (val != null && val !== '' && !validImagePayload(val)) {
      return res.status(400).json({ error: `Foto "${nome}" non valida (atteso JPEG/PNG/WebP, max 8MB)` });
    }
  }

  const update = { checkin_at: new Date().toISOString() };
  if (checkin_note) update.checkin_note = checkin_note;

  // Carica le foto nel bucket; nelle colonne va il path, non il base64.
  try {
    for (const [colonna, slot, val] of fotoInput) {
      if (val) update[colonna] = await uploadFoto(req.params.id, slot, val);
    }
  } catch (e) {
    console.error('[checkin] upload foto:', e.message);
    return res.status(500).json({ error: 'Errore caricamento foto: ' + e.message });
  }

  const { data, error } = await supabase.from('prenotazioni').update(update).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  await logAction('checkin', req.params.id, {}, getIp(req));
  return res.json(data);
});
```

- [ ] **Step 3: Modificare l'endpoint `checkout`**

Nell'endpoint `router.post('/bookings/:id/checkout', ...)`, trovare il blocco:

```javascript
  const update = { checkout_at: new Date().toISOString() };
  if (checkout_note)   update.checkout_note   = checkout_note;
  if (bici_foto_rientro) update.bici_foto_rientro = bici_foto_rientro;
```

e sostituirlo con:

```javascript
  const update = { checkout_at: new Date().toISOString() };
  if (checkout_note) update.checkout_note = checkout_note;
  if (bici_foto_rientro) {
    try {
      update.bici_foto_rientro = await uploadFoto(req.params.id, 'bici-rientro', bici_foto_rientro);
    } catch (e) {
      console.error('[checkout] upload foto:', e.message);
      return res.status(500).json({ error: 'Errore caricamento foto: ' + e.message });
    }
  }
```

(La validazione `validImagePayload` di `bici_foto_rientro` poco sopra resta invariata.)

- [ ] **Step 4: Verificare sintassi**

Run: `cd "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo" && node -c backend/routes/admin.js`
Expected: nessun output.

- [ ] **Step 5: Commit**

```bash
cd "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo"
git add backend/routes/admin.js
git commit -m "feat(storage): checkin/checkout caricano le foto nel bucket"
```

---

## Task 4: Endpoint signed URL + visualizzazione admin

**Files:**
- Modify: `backend/routes/admin.js` — nuovo endpoint `GET /bookings/:id/foto`
- Modify: `frontend/src/lib/api.js` — helper `getBookingFoto`
- Modify: `frontend/src/components/AdminDashboard.jsx` — `handleViewFoto`

- [ ] **Step 1: Aggiungere l'endpoint foto in `admin.js`**

In `backend/routes/admin.js`, subito dopo la fine dell'endpoint `router.get('/bookings/:id', ...)` (la riga `});` che lo chiude), aggiungere:

```javascript
// ─── GET /api/admin/bookings/:id/foto ─────────────────────────────────────────
// Ritorna signed URL temporanei (10 min) per le foto della prenotazione.
router.get('/bookings/:id/foto', async (req, res) => {
  const { data, error } = await supabase
    .from('prenotazioni')
    .select('documento_foto, documento_foto_retro, bici_foto_consegna, bici_foto_rientro')
    .eq('id', req.params.id)
    .single();
  if (error || !data) return res.status(404).json({ error: 'Prenotazione non trovata' });

  const [documento, documentoRetro, consegna, rientro] = await Promise.all([
    getSignedUrl(data.documento_foto),
    getSignedUrl(data.documento_foto_retro),
    getSignedUrl(data.bici_foto_consegna),
    getSignedUrl(data.bici_foto_rientro),
  ]);
  return res.json({ documento, documentoRetro, consegna, rientro });
});
```

- [ ] **Step 2: Aggiungere l'helper API nel frontend**

In `frontend/src/lib/api.js`, dopo la riga `getBooking: (id) => adminGet(\`/admin/bookings/${id}\`),`, aggiungere:

```javascript
  getBookingFoto: (id) =>
    adminGet(`/admin/bookings/${id}/foto`),
```

- [ ] **Step 3: Modificare `handleViewFoto` in AdminDashboard.jsx**

Sostituire la funzione `handleViewFoto` esistente con:

```javascript
  async function handleViewFoto(id, nome) {
    setActionSheet(null);
    setFotoModal({ loading: true, nome, foto: {} });
    try {
      const data = await adminApi.getBookingFoto(id);
      setFotoModal({
        loading: false,
        nome,
        foto: {
          documento:      data.documento      || null,
          documentoRetro: data.documentoRetro || null,
          consegna:       data.consegna       || null,
          rientro:        data.rientro        || null,
        },
      });
    } catch {
      setFotoModal(null);
      alert('Impossibile caricare le foto.');
    }
  }
```

Nota: `renderFotoModal` non cambia — usa già `foto.documento`, `foto.documentoRetro`, `foto.consegna`, `foto.rientro` come `src` dei tag `<img>`, e ora quei valori sono signed URL invece di base64. Funziona identico.

- [ ] **Step 4: Verificare sintassi e build**

```bash
cd "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo" && node -c backend/routes/admin.js
cd "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo/frontend" && npm run build 2>&1 | tail -4
```
Expected: nessun errore di sintassi, build completata.

- [ ] **Step 5: Commit**

```bash
cd "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo"
git add backend/routes/admin.js frontend/src/lib/api.js frontend/src/components/AdminDashboard.jsx
git commit -m "feat(storage): visualizzazione foto admin via signed URL"
```

---

## Task 5: Retention — cron cleanup-documenti + gdpr-cleanup

**Files:**
- Modify: `backend/routes/cron.js` — nuovo cron `cleanup-documenti`; estensione `gdpr-cleanup`
- Modify: `vercel.json` — schedule del nuovo cron

- [ ] **Step 1: Importare l'helper storage in `cron.js`**

In `backend/routes/cron.js`, dopo la riga `const { writeNotification } = require('../lib/notifications');`, aggiungere:

```javascript
const { removeBookingFoto } = require('../lib/storage');
```

- [ ] **Step 2: Estendere `gdpr-cleanup` per cancellare le foto**

Nel cron `router.get('/gdpr-cleanup', ...)`, nel loop `while`, trovare il blocco che cancella il batch:

```javascript
    if (!batch || batch.length === 0) break;
    const { error: delErr } = await supabase
      .from('prenotazioni')
      .delete()
      .in('id', batch.map(r => r.id));
```

e sostituirlo con (aggiunge la rimozione delle foto PRIMA del delete):

```javascript
    if (!batch || batch.length === 0) break;
    // Prima di eliminare le righe, rimuove le foto dal bucket.
    for (const r of batch) {
      await removeBookingFoto(r.id, ['documento-fronte', 'documento-retro', 'bici-consegna', 'bici-rientro']);
    }
    const { error: delErr } = await supabase
      .from('prenotazioni')
      .delete()
      .in('id', batch.map(r => r.id));
```

- [ ] **Step 3: Aggiungere il cron `cleanup-documenti`**

In `backend/routes/cron.js`, subito prima della riga finale `module.exports = router;`, aggiungere:

```javascript
// ─── GET /api/cron/cleanup-documenti ──────────────────────────────────────────
// Cancella le foto del documento d'identità 30 giorni dopo il noleggio.
// Le foto bici NON vengono toccate (vivono quanto la prenotazione).
router.get('/cleanup-documenti', cronAuth, async (req, res) => {
  const cutoff = romeDateStr(-30); // data_ritiro più vecchia di 30 giorni

  const { data: rows, error } = await supabase
    .from('prenotazioni')
    .select('id')
    .lt('data_ritiro', cutoff)
    .or('documento_foto.not.is.null,documento_foto_retro.not.is.null');

  if (error) {
    console.error('[CRON cleanup-documenti] db error:', error.message);
    return res.status(500).json({ error: error.message });
  }

  let cleaned = 0;
  for (const r of (rows || [])) {
    await removeBookingFoto(r.id, ['documento-fronte', 'documento-retro']);
    await supabase
      .from('prenotazioni')
      .update({ documento_foto: null, documento_foto_retro: null })
      .eq('id', r.id);
    cleaned++;
  }

  console.log(`[CRON cleanup-documenti] ${cleaned} documenti cancellati (cutoff ${cutoff})`);
  return res.json({ cleaned, cutoff });
});

```

(L'helper `romeDateStr` è già definito in `cron.js` e accetta un offset di giorni: `romeDateStr(-30)` = 30 giorni fa nel fuso Europe/Rome.)

- [ ] **Step 4: Aggiungere il cron a `vercel.json`**

In `vercel.json`, nell'array `crons`, dopo l'ultima voce (`daily-summary`), aggiungere:

```json
    { "path": "/api/cron/cleanup-documenti",   "schedule": "0 2 * * *"  }
```

Ricordarsi la virgola alla fine della voce precedente.

- [ ] **Step 5: Verificare sintassi**

Run: `cd "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo" && node -c backend/routes/cron.js && node -e "JSON.parse(require('fs').readFileSync('vercel.json'))" && echo OK`
Expected: stampa `OK` (cron.js valido + vercel.json JSON valido).

- [ ] **Step 6: Commit**

```bash
cd "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo"
git add backend/routes/cron.js vercel.json
git commit -m "feat(storage): retention foto — cron cleanup-documenti + gdpr-cleanup"
```

---

## Task 6: Deploy e verifica

- [ ] **Step 1: Deploy**

```bash
cd "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo"
~/.npm-global/bin/vercel --prod --yes 2>&1 | grep -iE "error|Ready|Production" | head -5
```
Expected: deploy `READY`.

- [ ] **Step 2: Smoke test endpoint**

```bash
curl -s -o /dev/null -w "health: %{http_code}\n" https://bike-rental-tarzo-app.vercel.app/api/health
curl -s -o /dev/null -w "cleanup-documenti (401 atteso): %{http_code}\n" https://bike-rental-tarzo-app.vercel.app/api/cron/cleanup-documenti
```
Expected: health `200`, cleanup-documenti `401` (endpoint vivo e protetto da CRON_SECRET).

- [ ] **Step 3: Verifica funzionale (manuale)**

Dall'admin panel: aprire una prenotazione, fare check-in caricando una foto. Poi:
- Aprire il menu azioni → "Vedi foto": l'immagine deve comparire (servita via signed URL).
- Controllare nel Supabase Dashboard → Storage → bucket `prenotazioni-foto` che il file sia presente al path `{booking_id}/documento-fronte.jpg`.
- Controllare che la colonna `documento_foto` della prenotazione contenga il path (stringa corta), non più un base64.

Questo step richiede una prenotazione reale: va eseguito dall'utente o concordato con lui.

---

## Self-Review

- [x] **Spec coverage:**
  - Bucket privato → Task 1
  - Helper storage (upload/signed URL/remove) → Task 2
  - Upload nel bucket da checkin/checkout → Task 3
  - Visualizzazione via signed URL → Task 4
  - Retention documenti 30gg (cron) → Task 5
  - Retention foto bici via gdpr-cleanup esteso → Task 5
  - Cron in vercel.json → Task 5
- [x] **Placeholder scan:** nessun TBD/TODO. Tutto il codice è completo e mostrato.
- [x] **Type consistency:** gli slot (`documento-fronte`, `documento-retro`, `bici-consegna`, `bici-rientro`) sono identici in `storage.js`, `admin.js` checkin/checkout, e `cron.js`. Le funzioni `uploadFoto(bookingId, slot, dataUrl)`, `getSignedUrl(path)`, `removeBookingFoto(bookingId, slots)` hanno la stessa firma ovunque usate. Le chiavi della risposta `/foto` (`documento`, `documentoRetro`, `consegna`, `rientro`) corrispondono tra endpoint backend (Task 4 Step 1) e `handleViewFoto` (Task 4 Step 3).

## Definition of Done

- Bucket `prenotazioni-foto` privato creato
- checkin/checkout caricano le foto nel bucket, le colonne contengono path
- L'admin vede le foto via signed URL
- Cron `cleanup-documenti` attivo (vercel.json), `gdpr-cleanup` cancella le foto
- Deploy completato, smoke test ok
