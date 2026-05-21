# Foto su Supabase Storage — Design

**Data:** 2026-05-21
**Autore:** Giulio Ballarin (brainstorming con Claude)
**Stato:** Design — in attesa di approvazione

## Obiettivo

Spostare le foto delle prenotazioni (documento d'identità fronte/retro, foto bici consegna/rientro) da stringhe base64 salvate nelle colonne del database a un bucket privato di Supabase Storage. Il database conserverà solo il path del file.

## Problema attuale

Le foto sono salvate come **data-URL base64** nelle colonne TEXT di `prenotazioni`: `documento_foto`, `documento_foto_retro`, `bici_foto_consegna`, `bici_foto_rientro`. Il frontend admin le comprime già lato client (`compressImage`: max 900px, JPEG q72), quindi non sono enormi (~150 KB l'una), ma:
- Gonfiano le righe del database (fino a ~600 KB per prenotazione con 4 foto)
- Ogni `GET /bookings/:id` (`select('*')`) trascina tutto il base64
- Erodono lo spazio del database (più costoso e limitato dell'object storage)
- Appesantiscono backup ed export

È un anti-pattern: le immagini vanno in un object storage, non nel DB.

## Requisiti (raccolti in brainstorming)

| Requisito | Decisione |
|---|---|
| Storage | Bucket **privato** Supabase Storage |
| Upload | Il frontend manda il base64 al backend (flusso attuale); il backend carica nel bucket |
| Accesso admin | Signed URL temporanei (~10 minuti) |
| Retention documento d'identità | Cancellato 30 giorni dopo `data_ritiro` |
| Retention foto bici | Vive quanto la prenotazione (cancellato col cron `gdpr-cleanup` a 5 anni) |

## Architettura

### Bucket

Bucket privato `prenotazioni-foto`. Una cartella per prenotazione, nominata in modo
leggibile `{nome-cliente-slug}-{id-breve}` (slug del nome senza accenti + primi 8 caratteri
dell'UUID), con dentro i file dei 4 slot:
```
mario-rossi-ca9ec549/documento-fronte.jpg
mario-rossi-ca9ec549/documento-retro.jpg
mario-rossi-ca9ec549/bici-consegna.jpg
mario-rossi-ca9ec549/bici-rientro.jpg
```
Il nome leggibile rende le cartelle facili da trovare nel Dashboard Supabase; l'id breve le
mantiene univoche tra clienti omonimi. Il path completo viene salvato nelle colonne DB, così
nessun consumatore deve ricostruirlo.
Privato = nessun accesso via URL pubblico. L'accesso avviene solo: dal backend con la service key (upload, remove, signed URL), o tramite signed URL temporaneo.

### Upload

Flusso minimamente cambiato. Il frontend admin continua a comprimere l'immagine e a mandare il base64 al backend negli endpoint `POST /api/admin/bookings/:id/checkin` e `/checkout`. Cambia il backend:
1. Riceve il base64 (validato come ora da `validImagePayload`).
2. Decodifica il base64 in Buffer.
3. Carica il Buffer nel bucket al path deterministico (`upload` con `upsert: true`).
4. Salva nella colonna (`documento_foto`, ecc.) il **path** del file (stringa corta), non più il base64.
5. Se l'upload nel bucket fallisce, l'endpoint restituisce errore 500 e NON salva un path verso un file inesistente.

Le foto compresse (~150 KB) sono ben sotto i limiti del body delle serverless function Vercel.

### Visualizzazione

L'admin apre le foto via `handleViewFoto` → oggi chiama `GET /api/admin/bookings/:id` e legge il base64 dalle colonne. Dopo la modifica:
- Le colonne contengono path, non immagini.
- Serve un modo per ottenere signed URL. Soluzione: il backend, nell'endpoint che fornisce i dati delle foto, per ogni colonna foto non vuota genera un signed URL (`createSignedUrl`, scadenza 600s) e restituisce gli URL. L'admin panel mostra le immagini da quegli URL.
- Implementazione: un endpoint dedicato `GET /api/admin/bookings/:id/foto` che ritorna `{ documento, documentoRetro, consegna, rientro }` come signed URL (o null se assenti). `handleViewFoto` chiama questo endpoint invece di `getBooking`.

### Compatibilità schema

Le 4 colonne sono già `TEXT`: conterranno un path invece di un base64, nessuna migrazione di schema. Il database ha 0 prenotazioni: nessuna foto esistente da convertire.

## Retention

### Documenti d'identità — 30 giorni

Nuovo cron `GET /api/cron/cleanup-documenti`, schedule giornaliero alle `0 2 * * *` (02:00 UTC, orario notturno tranquillo). Logica:
- Cerca prenotazioni con `data_ritiro` < (oggi − 30 giorni) e con `documento_foto` o `documento_foto_retro` non null.
- Per ciascuna: cancella i file documento dal bucket (`remove`), poi azzera le colonne `documento_foto` e `documento_foto_retro` (UPDATE a null).
- Le foto bici della stessa prenotazione NON vengono toccate.
- Aggiunto a `vercel.json` nei `crons`.

### Foto bici — vita = prenotazione

Il cron esistente `gdpr-cleanup` (cancella prenotazioni > 5 anni) viene esteso: per ogni prenotazione che sta per essere eliminata, prima cancella dal bucket i suoi file passando a `remove` i path salvati nelle 4 colonne foto della riga (`documento_foto`, `documento_foto_retro`, `bici_foto_consegna`, `bici_foto_rientro`). `remove` ignora silenziosamente i path null o inesistenti, quindi è sicuro passarli tutti.

## Edge case

- **Errore upload bucket**: l'endpoint checkin/checkout restituisce 500, la colonna non viene aggiornata.
- **Ri-caricamento foto**: path deterministico + `upsert: true` → il file viene sovrascritto, niente orfani.
- **Foto già scaduta**: se il documento è stato cancellato dalla retention, la colonna è null → l'admin panel mostra "documento non più disponibile".
- **Prenotazione cancellata** (`/cancel`): non elimina la riga, le foto restano fino al `gdpr-cleanup`. Caso raro: le prenotazioni cancellate raramente hanno foto (le foto si caricano al check-in/out).
- **Signed URL scaduto**: dopo 10 minuti il link non funziona; l'admin riapre le foto per generarne di nuovi.

## File coinvolti

| File | Modifica |
|---|---|
| Supabase Storage | Create — bucket privato `prenotazioni-foto` (dal Dashboard) |
| `backend/lib/storage.js` | Create — helper upload/signed URL/remove sul bucket |
| `backend/routes/admin.js` | Modify — checkin/checkout caricano nel bucket; nuovo endpoint `/bookings/:id/foto` |
| `backend/routes/cron.js` | Modify — nuovo cron `cleanup-documenti`; `gdpr-cleanup` cancella le foto |
| `frontend/src/components/AdminDashboard.jsx` | Modify — `handleViewFoto` usa il nuovo endpoint signed URL |
| `frontend/src/lib/api.js` | Modify — helper API per l'endpoint foto |
| `vercel.json` | Modify — aggiungere il cron `cleanup-documenti` |
| `supabase/schema.sql` | Modify — commento documentazione bucket (no DDL) |

## Testing

- Verifica manuale: creare una prenotazione, fare check-in con foto, verificare che il file compaia nel bucket e la colonna contenga il path.
- Aprire le foto dall'admin: le immagini si vedono via signed URL.
- Verifica retention: simulabile creando una prenotazione con `data_ritiro` vecchia > 30 giorni e invocando il cron.

## Non in scope

- Upload diretto frontend→bucket con signed upload URL (il backend-proxy basta, foto piccole).
- Migrazione di foto esistenti (il database è vuoto).
- Trasformazioni immagine lato Supabase (resize on-the-fly): la compressione lato client basta.
- Cancellazione foto su `/cancel` di una prenotazione (caso raro, gestito dal `gdpr-cleanup`).
