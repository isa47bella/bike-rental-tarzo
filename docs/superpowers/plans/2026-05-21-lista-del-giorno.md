# Lista del giorno stampabile — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dare all'admin un foglio stampabile con ritiri e restituzioni di una giornata scegliibile, da tenere al negozio.

**Architecture:** L'endpoint `/api/admin/oggi` guadagna un parametro `?data=` opzionale. Nella vista "Oggi" un selettore data + bottone "Stampa lista" generano una pagina HTML (stesso pattern di `handlePrintRiepilogo`) e aprono la stampa del browser.

**Tech Stack:** Node.js + Express (backend), React 18 (frontend, Vite).

**Spec di riferimento:** [`docs/superpowers/specs/2026-05-21-lista-del-giorno-design.md`](../specs/2026-05-21-lista-del-giorno-design.md)

## File Structure

| File | Modifica |
|---|---|
| `backend/routes/admin.js` | Modify — endpoint `/oggi` accetta `?data=` opzionale (validato) |
| `frontend/src/lib/api.js` | Modify — `getOggi` accetta una data opzionale |
| `frontend/src/components/AdminDashboard.jsx` | Modify — stato `printDate`, funzione `handlePrintGiornata`, selettore data + bottone nella vista "Oggi" |

## Note sul testing

Il progetto **non ha test automatici**. Verifica: `node -c` per il backend, build Vite per il frontend, verifica funzionale manuale. Non scrivere test Jest/Vitest.

---

## Task 1: Backend — `/oggi` accetta `?data=`

**Files:**
- Modify: `backend/routes/admin.js` — endpoint `router.get('/oggi', ...)`

**Contesto:** l'endpoint oggi calcola la data internamente ed è fisso su "oggi". Va esteso con un parametro query `?data=AAAA-MM-GG` opzionale. `ritiri` e `restituzioni` usano la data scelta; `inRitardo` resta sempre relativo a oggi reale (è un concetto "adesso").

- [ ] **Step 1: Sostituire il corpo dell'endpoint `/oggi`**

In `backend/routes/admin.js`, sostituire INTERAMENTE l'endpoint `router.get('/oggi', ...)`. Codice attuale:

```javascript
router.get('/oggi', async (req, res) => {
  const oggi = new Date().toISOString().substring(0, 10);
  const fields = `id, cliente_nome, cliente_email, cliente_telefono, bicicletta_id, bici_ids,
    tipo_noleggio, giorni, data_ritiro, orario_ritiro, data_restituzione,
    orario_restituzione, prezzo_totale, pagamento_status, cauzione_status,
    checkin_at, checkout_at, accessori, firma_at, firma_nome`;

  const [
    { data: ritiri },
    { data: restituzioni },
    { data: inRitardo },
  ] = await Promise.all([
    supabase.from('prenotazioni').select(fields).eq('pagamento_status', 'paid').eq('data_ritiro', oggi).order('orario_ritiro'),
    supabase.from('prenotazioni').select(fields).eq('pagamento_status', 'paid').eq('data_restituzione', oggi).order('orario_restituzione'),
    supabase.from('prenotazioni').select(fields).eq('pagamento_status', 'paid').lt('data_restituzione', oggi).is('checkout_at', null),
  ]);

  return res.json({
    ritiri:       ritiri       || [],
    restituzioni: restituzioni || [],
    inRitardo:    inRitardo    || [],
    data:         oggi,
  });
});
```

Nuovo codice:

```javascript
router.get('/oggi', async (req, res) => {
  const oggiReale = new Date().toISOString().substring(0, 10);

  // Parametro opzionale ?data=AAAA-MM-GG per stampare la lista di un altro giorno.
  const dataParam = req.query.data;
  if (dataParam !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(dataParam)) {
    return res.status(400).json({ error: 'Parametro data non valido (atteso AAAA-MM-GG)' });
  }
  const targetDate = dataParam || oggiReale;

  const fields = `id, cliente_nome, cliente_email, cliente_telefono, bicicletta_id, bici_ids,
    tipo_noleggio, giorni, data_ritiro, orario_ritiro, data_restituzione,
    orario_restituzione, prezzo_totale, pagamento_status, cauzione_status,
    checkin_at, checkout_at, accessori, firma_at, firma_nome`;

  const [
    { data: ritiri },
    { data: restituzioni },
    { data: inRitardo },
  ] = await Promise.all([
    supabase.from('prenotazioni').select(fields).eq('pagamento_status', 'paid').eq('data_ritiro', targetDate).order('orario_ritiro'),
    supabase.from('prenotazioni').select(fields).eq('pagamento_status', 'paid').eq('data_restituzione', targetDate).order('orario_restituzione'),
    supabase.from('prenotazioni').select(fields).eq('pagamento_status', 'paid').lt('data_restituzione', oggiReale).is('checkout_at', null),
  ]);

  return res.json({
    ritiri:       ritiri       || [],
    restituzioni: restituzioni || [],
    inRitardo:    inRitardo    || [],
    data:         targetDate,
  });
});
```

- [ ] **Step 2: Verificare la sintassi**

Run: `cd "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo" && node -c backend/routes/admin.js && echo OK`
Expected: stampa `OK`.

- [ ] **Step 3: Commit**

```bash
cd "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo"
git add backend/routes/admin.js
git commit -m "feat(admin): endpoint /oggi accetta parametro data opzionale"
```

---

## Task 2: Frontend — selettore data e foglio stampabile

**Files:**
- Modify: `frontend/src/lib/api.js` — `getOggi` accetta una data opzionale
- Modify: `frontend/src/components/AdminDashboard.jsx` — stato `printDate`, funzione `handlePrintGiornata`, selettore + bottone nella vista "Oggi"

**Contesto:** la vista "Oggi" (`renderOggi`) mostra ritiri/restituzioni/ritardi del giorno corrente. Va aggiunta una barra con selettore data + bottone "Stampa lista" che genera un foglio HTML e apre la stampa. Il pattern di stampa esiste già in `handlePrintRiepilogo` (genera HTML, `Blob`, `window.open`). I helper `tipoLabel(tipo)` e `parseAccessori(raw)` sono già definiti a livello di modulo nel file e usati nella vista "Oggi".

- [ ] **Step 1: Far accettare a `getOggi` una data opzionale**

In `frontend/src/lib/api.js`, trovare:

```javascript
  getOggi: () =>
    adminGet('/admin/oggi'),
```

e sostituirlo con:

```javascript
  getOggi: (data) =>
    adminGet(data ? `/admin/oggi?data=${encodeURIComponent(data)}` : '/admin/oggi'),
```

- [ ] **Step 2: Aggiungere lo stato `printDate`**

In `frontend/src/components/AdminDashboard.jsx`, trovare le righe di stato:

```javascript
  const [oggiData,   setOggiData]   = useState(null);
  const [oggiLoading, setOggiLoading] = useState(false);
```

e sostituirle con:

```javascript
  const [oggiData,   setOggiData]   = useState(null);
  const [oggiLoading, setOggiLoading] = useState(false);
  const [printDate,  setPrintDate]  = useState(() => new Date().toISOString().slice(0, 10));
```

- [ ] **Step 3: Aggiungere la funzione `handlePrintGiornata`**

In `frontend/src/components/AdminDashboard.jsx`, trovare la fine della funzione `handlePrintRiepilogo` seguita dal commento del Refund:

```javascript
    if (win) setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  // ─── Refund ──────────────────────────────────────────────────────────────────
```

e sostituirla con (aggiunge `handlePrintGiornata` prima del commento Refund):

```javascript
    if (win) setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  // ─── Stampa lista del giorno ─────────────────────────────────────────────────

  async function handlePrintGiornata() {
    let dati;
    try {
      dati = await adminApi.getOggi(printDate);
    } catch (e) {
      alert('Impossibile caricare la lista: ' + e.message);
      return;
    }
    const esc = s => String(s ?? '').replace(/[&<>"]/g,
      c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
    const ritiri       = dati.ritiri       || [];
    const restituzioni = dati.restituzioni || [];
    const inRitardo    = dati.inRitardo    || [];
    const isOggi   = dati.data === new Date().toISOString().slice(0, 10);
    const dataLunga = new Date(dati.data + 'T00:00:00')
      .toLocaleDateString('it-IT', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
    const biciStr = b => (b.bici_ids && b.bici_ids.length ? b.bici_ids : [b.bicicletta_id])
      .map(x => '#' + x).join(', ');

    const ritiriRows = ritiri.length
      ? ritiri.map(b => `<tr><td class="chk">&#9744;</td><td>${(b.orario_ritiro||'').slice(0,5)}</td>`
          + `<td>${esc(b.cliente_nome)}</td><td>${esc(b.cliente_telefono)}</td>`
          + `<td>${biciStr(b)}</td><td>${esc(tipoLabel(b.tipo_noleggio))}</td>`
          + `<td>${esc(parseAccessori(b.accessori).join(', '))}</td>`
          + `<td class="ctr">${b.firma_at ? '&#10003;' : '&#10007;'}</td></tr>`).join('')
      : '<tr><td colspan="8" class="empty">Nessun ritiro</td></tr>';

    const restRows = restituzioni.length
      ? restituzioni.map(b => `<tr><td class="chk">&#9744;</td><td>${(b.orario_restituzione||'').slice(0,5)}</td>`
          + `<td>${esc(b.cliente_nome)}</td><td>${esc(b.cliente_telefono)}</td>`
          + `<td>${biciStr(b)}</td><td>${esc(tipoLabel(b.tipo_noleggio))}</td></tr>`).join('')
      : '<tr><td colspan="6" class="empty">Nessuna restituzione</td></tr>';

    const ritardoSection = (isOggi && inRitardo.length)
      ? `<h2>Bici ancora da rientrare (in ritardo)</h2>`
        + `<table><thead><tr><th>Cliente</th><th>Telefono</th><th>Bici</th>`
        + `<th>Restituzione prevista</th></tr></thead><tbody>`
        + inRitardo.map(b => `<tr><td>${esc(b.cliente_nome)}</td>`
            + `<td>${esc(b.cliente_telefono)}</td><td>${biciStr(b)}</td>`
            + `<td>${b.data_restituzione}</td></tr>`).join('')
        + `</tbody></table>`
      : '';

    const html = `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8">
<title>Lista del giorno — ${dataLunga}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}@page{margin:14mm 12mm;size:A4}
body{font-family:Arial,sans-serif;font-size:10pt;color:#1a1a1a;background:#f0f4f0}
.page{max-width:760px;margin:0 auto;background:#fff}
.hdr{background:#2D8659;color:#fff;padding:18px 28px}
.hdr h1{font-size:1.15rem;margin-bottom:2px}
.hdr p{font-size:.92rem;text-transform:capitalize}
.hdr .sub{font-size:.7rem;opacity:.82;text-transform:none;margin-top:4px}
.body{padding:20px 28px}
h2{font-size:.95rem;color:#2D8659;margin:18px 0 8px;border-bottom:2px solid #2D8659;padding-bottom:3px}
h2:first-child{margin-top:0}
table{width:100%;border-collapse:collapse;margin-bottom:6px}
th{text-align:left;font-size:.68rem;color:#777;border-bottom:1px solid #ccc;padding:5px 6px}
td{font-size:.82rem;border-bottom:1px solid #eee;padding:7px 6px}
.chk{font-size:1.1rem;color:#999}.ctr{text-align:center}
.empty{color:#999;font-style:italic;text-align:center}
.btn{display:block;margin:18px auto 0;padding:9px 26px;background:#2D8659;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:.88rem;font-weight:600}
.ftr{text-align:center;margin-top:16px;font-size:.66rem;color:#aaa;border-top:1px solid #ddd;padding:10px 28px}
@media print{.btn{display:none!important}body{background:#fff}}</style>
</head><body><div class="page">
<div class="hdr"><h1>Lista del giorno</h1><p>${dataLunga}</p>
<p class="sub">Arfanta Bike Rental · Via Pecol 22, Arfanta di Tarzo (TV)</p></div>
<div class="body">
<h2>Ritiri (${ritiri.length})</h2>
<table><thead><tr><th></th><th>Ora</th><th>Cliente</th><th>Telefono</th><th>Bici</th><th>Tipo</th><th>Accessori</th><th>Firma</th></tr></thead><tbody>${ritiriRows}</tbody></table>
<h2>Restituzioni (${restituzioni.length})</h2>
<table><thead><tr><th></th><th>Ora</th><th>Cliente</th><th>Telefono</th><th>Bici</th><th>Tipo</th></tr></thead><tbody>${restRows}</tbody></table>
${ritardoSection}
</div>
<button class="btn" onclick="window.print()">Stampa / Salva PDF</button>
<div class="ftr">Arfanta Bike Rental · Stampato il ${new Date().toLocaleDateString('it-IT')}</div>
</div></body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url  = URL.createObjectURL(blob);
    const win  = window.open(url, '_blank');
    if (win) setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  // ─── Refund ──────────────────────────────────────────────────────────────────
```

- [ ] **Step 4: Aggiungere il selettore data e il bottone nella vista "Oggi"**

In `frontend/src/components/AdminDashboard.jsx`, dentro `renderOggi`, trovare il blocco `<ActionFeed>` seguito dalla riga del banner ritardi:

```javascript
        <ActionFeed
          onAction={handleFeedAction}
          refreshTick={feedRefresh}
          onCount={setFeedCount}
        />
        {inRitardo.length > 0 && (
```

e sostituirlo con (aggiunge la barra di stampa tra `ActionFeed` e il banner):

```javascript
        <ActionFeed
          onAction={handleFeedAction}
          refreshTick={feedRefresh}
          onCount={setFeedCount}
        />
        <div className="ac-print-bar" style={{ display:'flex', alignItems:'center', gap:8, margin:'0 0 20px' }}>
          <span style={{ fontSize:'.85rem', color:'#6B7280' }}>Stampa lista del giorno:</span>
          <input
            type="date"
            className="ac-input"
            style={{ maxWidth:170 }}
            value={printDate}
            onChange={e => setPrintDate(e.target.value)}
          />
          <button className="ac-btn ghost sm" onClick={handlePrintGiornata} title="Genera il foglio stampabile">
            <IconDownload /> Stampa lista
          </button>
        </div>
        {inRitardo.length > 0 && (
```

- [ ] **Step 5: Verificare sintassi e build**

```bash
cd "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo/frontend" && npm run build 2>&1 | tail -5
```
Expected: build completata senza errori.

- [ ] **Step 6: Commit**

```bash
cd "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo"
git add frontend/src/lib/api.js frontend/src/components/AdminDashboard.jsx
git commit -m "feat(admin): lista del giorno stampabile nella vista Oggi"
```

---

## Task 3: Deploy e verifica

- [ ] **Step 1: Deploy**

```bash
cd "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo"
~/.npm-global/bin/vercel --prod --yes 2>&1 | grep -iE "error|Ready|Production|readyState" | head -6
```
Expected: deploy `READY`.

- [ ] **Step 2: Smoke test**

```bash
curl -s -o /dev/null -w "health: %{http_code}\n" https://bike-rental-tarzo-app.vercel.app/api/health
curl -s -o /dev/null -w "oggi senza token (401 atteso): %{http_code}\n" https://bike-rental-tarzo-app.vercel.app/api/admin/oggi
```
Expected: health `200`, oggi `401` (endpoint protetto da admin token).

- [ ] **Step 3: Verifica funzionale (manuale)**

Dall'admin panel, vista "Oggi":
- Il selettore data deve essere preimpostato su oggi; cliccando "Stampa lista" si apre il foglio con ritiri e restituzioni di oggi e l'anteprima di stampa.
- Cambiare la data a domani e ristampare: il foglio deve mostrare ritiri/restituzioni di domani e NON la sezione "in ritardo".
- Stampando oggi, se ci sono bici in ritardo, la sezione "Bici ancora da rientrare" deve comparire.
- Una data senza prenotazioni produce comunque il foglio, con "Nessun ritiro" / "Nessuna restituzione".

Questo step richiede dati reali: va eseguito dall'utente o concordato con lui.

---

## Self-Review

- **Spec coverage:**
  - `/oggi` con `?data=` opzionale validato → Task 1
  - `getOggi` accetta data → Task 2 Step 1
  - Stato `printDate` (default oggi) → Task 2 Step 2
  - `handlePrintGiornata` — foglio HTML con sezioni Ritiri/Restituzioni/in ritardo → Task 2 Step 3
  - Sezione "in ritardo" solo se data == oggi → Task 2 Step 3 (`isOggi && inRitardo.length`)
  - Selettore data + bottone nella vista "Oggi" → Task 2 Step 4
  - Stati vuoti "Nessun ritiro/restituzione" → Task 2 Step 3 (`ritiriRows`/`restRows`)
- **Placeholder scan:** nessun TBD/TODO. Tutto il codice è completo e mostrato.
- **Type consistency:** `getOggi(data)` (Task 2 Step 1) ↔ chiamata `adminApi.getOggi(printDate)` in `handlePrintGiornata` (Task 2 Step 3). Il backend ritorna `{ ritiri, restituzioni, inRitardo, data }` (Task 1) e `handlePrintGiornata` legge esattamente quei campi. `printDate` definito in Step 2 e usato in Step 3 e Step 4. I helper `tipoLabel`/`parseAccessori` sono preesistenti a livello di modulo. `IconDownload` è già usato altrove in `AdminDashboard.jsx`.

## Definition of Done

- `/api/admin/oggi` accetta `?data=` e lo valida
- La vista "Oggi" ha un selettore data + bottone "Stampa lista"
- Il foglio stampabile mostra ritiri, restituzioni e (solo per oggi) bici in ritardo, con stati vuoti gestiti
- Deploy completato, smoke test ok
