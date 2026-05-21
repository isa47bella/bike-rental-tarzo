# Monitoraggio salute cron — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Accorgersi quando un cron job fallisce o non viene eseguito, tramite un "battito" registrato a ogni run riuscito e un cron guardiano che avvisa (push + campanella) se un battito è troppo vecchio.

**Architecture:** Ogni cron registra un heartbeat in una tabella `cron_health` quando risponde con successo, grazie a un singolo middleware che sostituisce `res.json` (scrittura del battito prima del flush della risposta — su Vercel il lavoro async dopo la risposta non è garantito). Un nuovo cron guardiano `/api/cron/cron-health`, ogni sera, confronta ogni battito con la sua soglia e avvisa per quelli in ritardo.

**Tech Stack:** Node.js + Express (backend serverless Vercel), Supabase (PostgreSQL), Vercel cron.

**Spec di riferimento:** [`docs/superpowers/specs/2026-05-21-cron-health-monitoring-design.md`](../specs/2026-05-21-cron-health-monitoring-design.md)

## File Structure

| File | Modifica |
|---|---|
| `supabase/schema.sql` | Modify — DDL della tabella `cron_health` + seed (migrazione manuale su Supabase) |
| `backend/lib/cronHealth.js` | Create — `CRON_EXPECTATIONS`, `recordCronRun`, `checkCronHealth` |
| `backend/routes/cron.js` | Modify — import, middleware heartbeat, nuova rotta `/cron-health` |
| `vercel.json` | Modify — schedule del cron `cron-health` |

## Note sul testing

Il progetto **non ha test automatici**. Verifica: `node -c` per i file backend, JSON valido
per `vercel.json`, smoke test degli endpoint dopo il deploy. Non scrivere test Jet/Vitest.

## ⚠️ Migrazione manuale richiesta

La tabella `cron_health` va creata **a mano** nel SQL Editor di Supabase: il `.env` non ha
la connection string Postgres per il DDL, e il client `@supabase/supabase-js` non esegue
DDL. Task 1 aggiunge il blocco SQL a `schema.sql` (fonte di verità); l'esecuzione effettiva
su Supabase è un passo manuale dell'utente, descritto in Task 4. Finché la migrazione non
viene eseguita la feature è inattiva ma **non causa crash** (vedi Task 2: `recordCronRun`
è non-bloccante, il guardiano gestisce l'errore).

---

## Task 1: Tabella `cron_health` in schema.sql

**Files:**
- Modify: `supabase/schema.sql` — aggiunta in fondo al file

- [ ] **Step 1: Aggiungere il DDL della tabella**

In `supabase/schema.sql`, trovare l'ultima riga del file:

```sql
ALTER TABLE prenotazioni ADD COLUMN IF NOT EXISTS firma_token TEXT;
```

e sostituirla con (aggiunge il blocco `cron_health` dopo di essa):

```sql
ALTER TABLE prenotazioni ADD COLUMN IF NOT EXISTS firma_token TEXT;

-- ─── Salute cron: heartbeat dei cron job ──────────────────────────────────────
-- Ogni cron, completata con successo l'esecuzione, aggiorna la propria riga
-- (last_run_at). Il cron guardiano /api/cron/cron-health controlla che nessun
-- battito sia troppo vecchio. Il seed mette NOW() così al deploy nessun cron
-- risulta già "in ritardo": il conteggio parte da zero.
CREATE TABLE IF NOT EXISTS cron_health (
  job          TEXT         PRIMARY KEY,
  last_run_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
INSERT INTO cron_health (job) VALUES
  ('deposit'), ('firma-reminder'), ('reminder'), ('auto-cancel-pending'),
  ('retry-cauzioni'), ('daily-summary'), ('cleanup-documenti'),
  ('cleanup-audit'), ('gdpr-cleanup')
ON CONFLICT (job) DO NOTHING;
ALTER TABLE cron_health DISABLE ROW LEVEL SECURITY;
```

- [ ] **Step 2: Commit**

```bash
cd "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo"
git add supabase/schema.sql
git commit -m "feat(cron): schema tabella cron_health per il monitoraggio"
```

Nota: questo task modifica solo il file `schema.sql`. La tabella va poi creata davvero su
Supabase eseguendo quel blocco SQL nel SQL Editor — passo manuale, vedi Task 4.

---

## Task 2: Helper `backend/lib/cronHealth.js`

**Files:**
- Create: `backend/lib/cronHealth.js`

**Contesto:** modulo di sola logica (nessuna dipendenza da Express). `backend/lib/supabase.js`
esiste già ed esporta un client `@supabase/supabase-js` configurato con la service key.

- [ ] **Step 1: Creare il file**

Crea `backend/lib/cronHealth.js` con questo contenuto esatto:

```javascript
const supabase = require('./supabase');

// Età massima (in ore) ammessa dall'ultimo run riuscito, per ogni cron.
// Oltre la soglia il cron è considerato "non eseguito". Questa mappa fa anche
// da elenco dei cron monitorati: solo i job qui presenti vengono controllati.
const CRON_EXPECTATIONS = {
  'deposit':             26,
  'firma-reminder':      26,
  'reminder':            26,
  'auto-cancel-pending': 26,
  'retry-cauzioni':      26,
  'daily-summary':       26,
  'cleanup-documenti':   26,
  'cleanup-audit':       216, // settimanale → 9 giorni
  'gdpr-cleanup':        816, // mensile → 34 giorni
};

// Registra l'esecuzione riuscita di un cron (upsert del battito).
// Non-bloccante: in caso di errore logga soltanto e non lancia mai eccezioni —
// un problema col battito non deve mai rompere il lavoro del cron.
async function recordCronRun(job) {
  try {
    const { error } = await supabase
      .from('cron_health')
      .upsert({ job, last_run_at: new Date().toISOString() }, { onConflict: 'job' });
    if (error) console.error('[cronHealth] upsert error:', error.message);
  } catch (e) {
    console.error('[cronHealth] unexpected error:', e.message);
  }
}

// Controlla i battiti: ritorna l'elenco dei cron in ritardo oltre la soglia.
// Ogni voce: { job, ageHours } — ageHours è null se il cron non ha mai girato.
// Lancia un errore se la lettura della tabella fallisce.
async function checkCronHealth() {
  const { data, error } = await supabase
    .from('cron_health')
    .select('job, last_run_at');
  if (error) throw new Error(`Lettura cron_health fallita: ${error.message}`);

  const lastByJob = {};
  for (const row of (data || [])) lastByJob[row.job] = row.last_run_at;

  const now = Date.now();
  const down = [];
  for (const [job, maxHours] of Object.entries(CRON_EXPECTATIONS)) {
    const last = lastByJob[job];
    if (!last) {
      down.push({ job, ageHours: null });
      continue;
    }
    const ageHours = (now - new Date(last).getTime()) / 3600000;
    if (ageHours > maxHours) down.push({ job, ageHours: Math.round(ageHours) });
  }
  return down;
}

module.exports = { CRON_EXPECTATIONS, recordCronRun, checkCronHealth };
```

- [ ] **Step 2: Verificare la sintassi**

Run: `cd "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo" && node -c backend/lib/cronHealth.js && echo OK`
Expected: stampa `OK`.

- [ ] **Step 3: Commit**

```bash
cd "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo"
git add backend/lib/cronHealth.js
git commit -m "feat(cron): helper cronHealth — battito e controllo salute"
```

---

## Task 3: Middleware heartbeat + cron guardiano in `cron.js`

**Files:**
- Modify: `backend/routes/cron.js` — import, middleware, nuova rotta
- Modify: `vercel.json` — schedule del cron guardiano

**Contesto:** `cron.js` definisce 9 rotte cron, tutte `router.get('/nome', cronAuth, async (req, res) => {...})`,
e termina con `module.exports = router;`. `sendPushToAll` (da `../lib/push`) e
`writeNotification` (da `../lib/notifications`) sono già importati in cima al file.

- [ ] **Step 1: Importare l'helper cronHealth**

In `backend/routes/cron.js`, trovare la riga:

```javascript
const { removeFoto } = require('../lib/storage');
```

e sostituirla con:

```javascript
const { removeFoto } = require('../lib/storage');
const { recordCronRun, CRON_EXPECTATIONS, checkCronHealth } = require('../lib/cronHealth');
```

- [ ] **Step 2: Aggiungere il middleware heartbeat**

In `backend/routes/cron.js`, trovare la fine della funzione `cronAuth`:

```javascript
  if (!safeEqual(req.headers.authorization, `Bearer ${cronSecret}`)) {
    return res.status(401).json({ error: 'Non autorizzato' });
  }
  next();
}
```

e sostituirla con (aggiunge il middleware subito dopo `cronAuth`):

```javascript
  if (!safeEqual(req.headers.authorization, `Bearer ${cronSecret}`)) {
    return res.status(401).json({ error: 'Non autorizzato' });
  }
  next();
}

// ─── Heartbeat: registra l'esecuzione riuscita di ogni cron ──────────────────
// Per le richieste cron sostituisce res.json con una versione che, su risposta
// di successo (stato 2xx), registra il battito in cron_health PRIMA di inviare
// la risposta. Su Vercel il lavoro async DOPO l'invio della risposta non è
// garantito: scrivere prima del flush rende il battito affidabile.
router.use((req, res, next) => {
  const job = req.path.split('/').pop();
  if (CRON_EXPECTATIONS[job]) {
    const sendJson = res.json.bind(res);
    res.json = async (body) => {
      if (res.statusCode < 400) await recordCronRun(job);
      return sendJson(body);
    };
  }
  next();
});
```

- [ ] **Step 3: Aggiungere la rotta del cron guardiano**

In `backend/routes/cron.js`, trovare la riga finale:

```javascript
module.exports = router;
```

e sostituirla con (aggiunge la rotta `/cron-health` prima dell'export):

```javascript
// ─── GET /api/cron/cron-health ────────────────────────────────────────────────
// Cron guardiano: verifica che ogni cron abbia un battito recente.
// Schedule: 0 22 * * * UTC — dopo che tutti i cron giornalieri hanno girato.
router.get('/cron-health', cronAuth, async (req, res) => {
  let down;
  try {
    down = await checkCronHealth();
  } catch (e) {
    console.error('[CRON cron-health] errore:', e.message);
    return res.status(500).json({ error: e.message });
  }

  if (down.length === 0) {
    console.log('[CRON cron-health] Tutti i cron OK');
    return res.json({ ok: true, down: [] });
  }

  const nomi = down.map(d => d.job).join(', ');
  const dettaglio = down
    .map(d => d.ageHours == null ? `${d.job} (mai eseguito)` : `${d.job} (${d.ageHours}h fa)`)
    .join(', ');
  console.warn(`[CRON cron-health] Cron in ritardo: ${dettaglio}`);

  await sendPushToAll({
    title: '⚠️ Cron non eseguiti',
    body:  `${nomi} — controlla i log su Vercel`,
    url:   '/admin',
  }).catch(e => console.error('[CRON cron-health] push error:', e.message));

  await writeNotification('cron_down', {
    titolo: `Cron non eseguiti: ${nomi}`,
    descrizione: `Ultimo battito: ${dettaglio}. Controlla i log su Vercel.`,
  }).catch(_ => {});

  return res.json({ ok: false, down });
});

module.exports = router;
```

- [ ] **Step 4: Aggiungere il cron guardiano a `vercel.json`**

In `vercel.json`, nell'array `crons`, trovare l'ultima voce e la chiusura dell'array:

```json
    { "path": "/api/cron/cleanup-documenti",   "schedule": "0 2 * * *"  }
  ]
```

e sostituirla con (aggiunge la voce `cron-health`, ricordando la virgola sulla voce precedente):

```json
    { "path": "/api/cron/cleanup-documenti",   "schedule": "0 2 * * *"  },
    { "path": "/api/cron/cron-health",         "schedule": "0 22 * * *" }
  ]
```

- [ ] **Step 5: Verificare sintassi**

Run: `cd "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo" && node -c backend/routes/cron.js && node -e "JSON.parse(require('fs').readFileSync('vercel.json'))" && echo OK`
Expected: stampa `OK` (cron.js valido + vercel.json JSON valido).

- [ ] **Step 6: Commit**

```bash
cd "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo"
git add backend/routes/cron.js vercel.json
git commit -m "feat(cron): middleware heartbeat + cron guardiano cron-health"
```

---

## Task 4: Deploy, migrazione e verifica

- [ ] **Step 1: Deploy**

```bash
cd "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo"
~/.npm-global/bin/vercel --prod --yes 2>&1 | grep -iE "error|Ready|Production|readyState" | head -6
```
Expected: deploy `READY`.

- [ ] **Step 2: Smoke test**

```bash
curl -s -o /dev/null -w "health: %{http_code}\n" https://bike-rental-tarzo-app.vercel.app/api/health
curl -s -o /dev/null -w "cron-health (401 atteso): %{http_code}\n" https://bike-rental-tarzo-app.vercel.app/api/cron/cron-health
```
Expected: health `200`, cron-health `401` (endpoint vivo e protetto da `CRON_SECRET`).

- [ ] **Step 3: Migrazione manuale su Supabase (passo dell'utente)**

Questo step va eseguito dall'utente, o concordato con lui. Nel Supabase Dashboard →
SQL Editor, eseguire il blocco `cron_health` aggiunto a `schema.sql` in Task 1 (la
`CREATE TABLE` + l'`INSERT` di seed + l'`ALTER TABLE ... DISABLE ROW LEVEL SECURITY`).
Senza questa migrazione la feature resta inattiva (ma non causa errori bloccanti).

- [ ] **Step 4: Verifica funzionale (manuale, dopo la migrazione)**

- Invocare il guardiano con il `CRON_SECRET` (da Vercel env) — deve rispondere
  `{ "ok": true, "down": [] }` perché il seed ha messo `NOW()` per tutti:
  ```bash
  curl -s -H "Authorization: Bearer <CRON_SECRET>" https://bike-rental-tarzo-app.vercel.app/api/cron/cron-health
  ```
- Per simulare un cron rotto: nel SQL Editor di Supabase eseguire
  `UPDATE cron_health SET last_run_at = NOW() - INTERVAL '3 days' WHERE job = 'deposit';`
  poi reinvocare il guardiano → deve rispondere `{ "ok": false, "down": [...] }` e devono
  arrivare la push e la voce in campanella. Infine ripristinare:
  `UPDATE cron_health SET last_run_at = NOW() WHERE job = 'deposit';`

---

## Self-Review

- **Spec coverage:**
  - Tabella `cron_health` (heartbeat) → Task 1
  - Helper `recordCronRun` / `checkCronHealth` / soglie → Task 2
  - Middleware heartbeat (un solo punto, prima del flush) → Task 3 Step 2
  - Cron guardiano `/cron-health` con avviso push + campanella → Task 3 Step 3
  - Soglie 26h / 216h / 816h → Task 2 (`CRON_EXPECTATIONS`)
  - Schedule `0 22 * * *` in vercel.json → Task 3 Step 4
  - Migrazione manuale + bootstrap col seed → Task 1 + Task 4 Step 3
- **Placeholder scan:** nessun TBD/TODO. `<CRON_SECRET>` in Task 4 Step 4 è un valore reale
  che l'utente recupera dalle env Vercel per un test manuale opzionale, non un segnaposto di codice.
- **Type consistency:** `recordCronRun(job)`, `checkCronHealth()` → `[{job, ageHours}]`,
  `CRON_EXPECTATIONS` (mappa job→ore) hanno la stessa firma in `cronHealth.js` (Task 2) e
  negli usi in `cron.js` (Task 3). I 9 nomi dei job coincidono tra il seed SQL (Task 1),
  `CRON_EXPECTATIONS` (Task 2) e i path delle rotte cron esistenti. La rotta `/cron-health`
  non è in `CRON_EXPECTATIONS`, quindi il middleware non la monitora (guardiano non
  auto-monitorato, come da spec).

## Definition of Done

- Tabella `cron_health` creata su Supabase (migrazione manuale)
- Ogni cron registra il battito a ogni run riuscito (middleware)
- Il cron `cron-health` gira alle 22:00 UTC e avvisa (push + campanella) per i cron in ritardo
- Deploy completato, smoke test ok
