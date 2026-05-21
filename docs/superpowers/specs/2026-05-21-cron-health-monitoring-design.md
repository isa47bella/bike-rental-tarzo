# Monitoraggio salute cron — Design

**Data:** 2026-05-21
**Autore:** Giulio Ballarin (brainstorming con Claude)
**Stato:** Design — in attesa di approvazione

## Obiettivo

Accorgersi quando un cron job fallisce o non viene eseguito affatto. Oggi se un cron si
rompe (es. la cauzione da €500, i promemoria) non c'è alcuna traccia: il gestore non lo
sa finché non se ne accorge dalle conseguenze.

## Problema attuale

Il backend ha 9 cron job (`backend/routes/cron.js`, schedulati in `vercel.json`):
`deposit`, `firma-reminder`, `reminder`, `auto-cancel-pending`, `retry-cauzioni`,
`daily-summary`, `cleanup-documenti` (giornalieri), `cleanup-audit` (settimanale),
`gdpr-cleanup` (mensile). Nessuno di essi lascia traccia centralizzata della propria
esecuzione. Due modi di fallire restano invisibili:
- il cron **gira ma va in errore** (fallisce a metà);
- il cron **non viene eseguito affatto** (Vercel non lo lancia, deploy rotto, ecc.).

## Requisiti (raccolti in brainstorming)

| Requisito | Decisione |
|---|---|
| Cron da monitorare | Tutti e 9 |
| Canale di avviso | Push sul telefono **+** voce nella campanella admin (tabella `notifiche`) |
| Dove vive il controllo | Un cron "guardiano" dedicato |
| Tempestività | Rilevamento entro ~24h (al giro serale del guardiano); accettato |

## Architettura

### Meccanismo: heartbeat ("battito")

Ogni cron, quando termina **con successo**, registra `last_run_at = adesso` nella tabella
`cron_health`. Un singolo meccanismo copre entrambi i modi di fallire: un cron che va in
errore non arriva a registrare il battito; un cron che non parte non lo registra affatto.
In entrambi i casi il battito **invecchia** oltre la sua soglia → "cron rotto".

### Tabella `cron_health`

```sql
CREATE TABLE IF NOT EXISTS cron_health (
  job          TEXT         PRIMARY KEY,
  last_run_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
INSERT INTO cron_health (job) VALUES
  ('deposit'), ('firma-reminder'), ('reminder'), ('auto-cancel-pending'),
  ('retry-cauzioni'), ('daily-summary'), ('cleanup-documenti'),
  ('cleanup-audit'), ('gdpr-cleanup')
ON CONFLICT (job) DO NOTHING;
```

Va eseguita manualmente nel SQL Editor di Supabase (il progetto fa così le migrazioni —
il `.env` non ha la connection string Postgres per il DDL). Il seed delle 9 righe con
`NOW()` fa sì che al deploy nessun cron risulti già "in ritardo": il conteggio parte da
zero. La feature funziona solo dopo che la migrazione è stata eseguita; finché non lo è,
il codice non crasha (vedi Error handling).

### Heartbeat su ogni cron — `withHeartbeat`

Un wrapper `withHeartbeat(jobName, handler)` avvolge ognuna delle rotte cron esistenti:

```javascript
function withHeartbeat(job, handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (e) {
      console.error(`[CRON ${job}] errore non gestito:`, e.message);
      if (!res.headersSent) res.status(500).json({ error: e.message });
    }
    if (res.statusCode < 400) {
      await recordCronRun(job);
    }
  };
}
```

Registra il battito solo se la risposta è 2xx. Se il handler lancia un'eccezione, la
cattura, risponde 500 e **non** registra il battito (così il guasto resta visibile). Questo
migliora anche la robustezza attuale: oggi un'eccezione non gestita in un cron resta
una promise rejection non gestita.

Le rotte diventano: `router.get('/deposit', cronAuth, withHeartbeat('deposit', async (req, res) => { ... }))`.

### Helper `backend/lib/cronHealth.js` (nuovo)

Modulo di sola logica (nessuna dipendenza da Express), esporta:
- `recordCronRun(job)` — upsert di `{ job, last_run_at: NOW }` in `cron_health`.
  Non-bloccante: in caso di errore logga soltanto, come `writeNotification`.
- `CRON_EXPECTATIONS` — mappa `job → età massima in ore` (vedi Soglie).
- `checkCronHealth()` — legge `cron_health`, confronta ogni job di `CRON_EXPECTATIONS`
  con la sua soglia, ritorna l'elenco dei job "in ritardo" (con nome ed età in ore). Un
  job senza riga viene considerato in ritardo (anomalia da segnalare).

`withHeartbeat` vive invece in `cron.js` accanto alle rotte (è un wrapper di handler
Express). `cronHealth.js` resta puro: non importa né Express né il modulo push/notifiche.

### Soglie — `CRON_EXPECTATIONS` (ore)

| Cron | Frequenza | Soglia |
|---|---|---|
| `deposit`, `firma-reminder`, `reminder`, `auto-cancel-pending`, `retry-cauzioni`, `daily-summary`, `cleanup-documenti` | giornaliera | 26 |
| `cleanup-audit` | settimanale | 216 (9 giorni) |
| `gdpr-cleanup` | mensile | 816 (34 giorni) |

Le soglie hanno ampio margine: un cron sano è sempre lontano dalla soglia, l'allarme
scatta solo per un guasto reale.

### Cron guardiano — `GET /api/cron/cron-health`

Nuova rotta in `cron.js`, protetta da `cronAuth`, anch'essa avvolta da `withHeartbeat`.
Schedule in `vercel.json`: `0 22 * * *` (22:00 UTC), dopo che tutti i cron giornalieri
hanno girato — così un guasto in giornata di un cron giornaliero viene rilevato la sera
stessa. Logica:
1. `checkCronHealth()` → elenco dei cron in ritardo.
2. Se l'elenco è vuoto: logga "tutti i cron OK", risponde `{ ok: true }`, fine.
3. Se ci sono cron in ritardo: **un solo** avviso aggregato —
   - push (`sendPushToAll`): titolo `⚠️ Cron non eseguiti`, corpo con i nomi dei cron;
   - notifica admin (`writeNotification('cron_down', ...)`): titolo con i nomi, descrizione
     con le età degli ultimi battiti.
4. Risponde `{ down: [...] }`.

Se un guasto persiste, l'avviso si ripete a ogni giro serale finché non viene risolto.

### vercel.json

Aggiungere ai `crons`: `{ "path": "/api/cron/cron-health", "schedule": "0 22 * * *" }`.

## Error handling

- `recordCronRun` è non-bloccante: un errore nella scrittura del battito (incluso "tabella
  inesistente" prima della migrazione) viene solo loggato, non rompe il lavoro del cron.
- `withHeartbeat` cattura le eccezioni non gestite del handler e risponde 500.
- Il guardiano: se la lettura di `cron_health` fallisce, logga e risponde 500.

## Edge case

- **Prima della migrazione:** `cron_health` non esiste → `recordCronRun` logga l'errore e
  prosegue; il guardiano risponde 500 ma non crasha. La feature è inattiva finché la
  migrazione non viene eseguita.
- **Bootstrap:** il seed della migrazione mette `last_run_at = NOW()` per tutti e 9, quindi
  al primo giro del guardiano nessuno risulta in ritardo.
- **Job senza riga** (es. un cron aggiunto in futuro senza riga di seed): `checkCronHealth`
  lo segnala come in ritardo — è un'anomalia che vale la pena far emergere.
- **Guasto persistente:** avviso ripetuto ogni sera; cessa da solo quando il cron torna
  a girare.

## Limite noto e accettato

Il cron guardiano non è monitorato da nulla: se smette di girare lui, niente lo segnala.
Per una realtà piccola è un rischio residuo accettabile; un monitor esterno (UptimeRobot
ecc.) è fuori scope.

## File coinvolti

| File | Modifica |
|---|---|
| `supabase/schema.sql` | Modify — DDL `cron_health` + seed (migrazione manuale su Supabase) |
| `backend/lib/cronHealth.js` | Create — `recordCronRun`, `CRON_EXPECTATIONS`, `checkCronHealth` |
| `backend/routes/cron.js` | Modify — wrapper `withHeartbeat` su tutte le rotte; nuova rotta `/cron-health` |
| `vercel.json` | Modify — schedule del cron `cron-health` |

## Testing

Il progetto non ha test automatici. Verifica:
- `node -c` sui file backend, JSON valido per `vercel.json`.
- Smoke test: `GET /api/cron/cron-health` senza secret → 401; con secret → 200.
- Verifica funzionale: dopo deploy + migrazione, invocare il guardiano → deve rispondere
  "tutti OK". Poi mettere a mano un `last_run_at` molto vecchio per un job e rilanciare il
  guardiano → deve arrivare la push + la voce in campanella.

## Non in scope

- Monitoraggio esterno (UptimeRobot o simili) del guardiano stesso.
- Pannello admin "salute cron" con la lista visuale degli ultimi run (la tabella
  `cron_health` lo renderebbe possibile in futuro, ma ora basta l'avviso).
- Avviso immediato all'istante del guasto (oggi: entro il giro serale del guardiano).
- Storico delle esecuzioni: `cron_health` tiene solo l'ultimo run per cron, non una cronologia.
