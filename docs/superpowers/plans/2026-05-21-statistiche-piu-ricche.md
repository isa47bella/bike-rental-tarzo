# Statistiche più ricche — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere alla vista "Report" dell'admin tre metriche: bici più noleggiate, giorni della settimana più richiesti, clienti di ritorno.

**Architecture:** Si estende l'endpoint `GET /api/admin/report` (che già aggrega tutte le prenotazioni pagate) con tre nuove aggregazioni, e la funzione `renderReport` con una quarta card e due nuove sezioni. Nessun endpoint o pagina nuova.

**Tech Stack:** Node.js + Express (backend), React 18 (frontend, Vite).

**Spec di riferimento:** [`docs/superpowers/specs/2026-05-21-statistiche-piu-ricche-design.md`](../specs/2026-05-21-statistiche-piu-ricche-design.md)

## File Structure

| File | Modifica |
|---|---|
| `backend/routes/admin.js` | Modify — endpoint `/report`: aggregazioni `by_bike`, `by_weekday`, `returning` |
| `frontend/src/components/AdminDashboard.jsx` | Modify — `renderReport`: variabili calcolate, quarta card, due nuove sezioni |

## Note sul testing

Il progetto **non ha test automatici**. Verifica: `node -c` per il backend, build Vite per il frontend, verifica funzionale manuale. Non scrivere test Jest/Vitest.

---

## Task 1: Backend — nuove aggregazioni in `/report`

**Files:**
- Modify: `backend/routes/admin.js` — endpoint `router.get('/report', ...)`

**Contesto:** l'endpoint `/report` carica già tutte le prenotazioni pagate (`limit(20000)`) e calcola `by_month` e `by_type`. Va esteso: si aggiungono colonne alla `select` e tre aggregazioni alla risposta. I campi esistenti restano invariati.

- [ ] **Step 1: Sostituire il corpo dell'endpoint `/report`**

In `backend/routes/admin.js`, sostituire INTERAMENTE l'endpoint `router.get('/report', ...)`. Codice attuale:

```javascript
router.get('/report', async (req, res) => {
  // limit(20000): safety cap — l'app non si avvicina a questo volume per anni.
  // Oltre, sostituire la somma JS con un aggregato lato DB.
  const { data: all, error } = await supabase
    .from('prenotazioni')
    .select('prezzo_totale, tipo_noleggio, giorni, data_ritiro')
    .eq('pagamento_status', 'paid')
    .limit(20000);

  if (error) return res.status(500).json({ error: error.message });

  const byMonth = {};
  const byType  = {};
  let total = 0;

  (all || []).forEach(b => {
    const n = Number(b.prezzo_totale);
    total += n;
    const month = b.data_ritiro ? b.data_ritiro.substring(0, 7) : 'unknown';
    byMonth[month] = (byMonth[month] || 0) + n;
    byType[b.tipo_noleggio] = (byType[b.tipo_noleggio] || 0) + n;
  });

  const months = Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([m, v]) => ({ month: m, revenue: parseFloat(v.toFixed(2)) }));

  return res.json({
    total_revenue:  total.toFixed(2),
    total_bookings: (all || []).length,
    avg_booking:    all?.length ? (total / all.length).toFixed(2) : '0',
    by_month:       months,
    by_type:        byType,
  });
});
```

Nuovo codice:

```javascript
router.get('/report', async (req, res) => {
  // limit(20000): safety cap — l'app non si avvicina a questo volume per anni.
  // Oltre, sostituire la somma JS con un aggregato lato DB.
  const { data: all, error } = await supabase
    .from('prenotazioni')
    .select('prezzo_totale, tipo_noleggio, giorni, data_ritiro, bicicletta_id, bici_ids, cliente_telefono')
    .eq('pagamento_status', 'paid')
    .limit(20000);

  if (error) return res.status(500).json({ error: error.message });

  const byMonth   = {};
  const byType    = {};
  const byBike    = {};
  const byWeekday = [0, 0, 0, 0, 0, 0, 0];   // 0 = Lunedì … 6 = Domenica
  const perCliente = {};                      // telefono normalizzato -> n. prenotazioni
  let total = 0;

  (all || []).forEach(b => {
    const n = Number(b.prezzo_totale);
    total += n;
    const month = b.data_ritiro ? b.data_ritiro.substring(0, 7) : 'unknown';
    byMonth[month] = (byMonth[month] || 0) + n;
    byType[b.tipo_noleggio] = (byType[b.tipo_noleggio] || 0) + n;

    // Bici più noleggiate: una prenotazione multi-bici conta per ciascuna sua bici.
    const bici = (Array.isArray(b.bici_ids) && b.bici_ids.length) ? b.bici_ids : [b.bicicletta_id];
    bici.forEach(id => { if (id != null) byBike[id] = (byBike[id] || 0) + 1; });

    // Giorni più richiesti: giorno della settimana del ritiro, lunedì-primo.
    if (b.data_ritiro) {
      const giorno = new Date(b.data_ritiro + 'T12:00:00').getDay(); // 0=Dom … 6=Sab
      byWeekday[(giorno + 6) % 7] += 1;                              // 0=Lun … 6=Dom
    }

    // Clienti di ritorno: raggruppa per telefono normalizzato (sole cifre).
    const tel = String(b.cliente_telefono || '').replace(/\D/g, '');
    if (tel) perCliente[tel] = (perCliente[tel] || 0) + 1;
  });

  const months = Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([m, v]) => ({ month: m, revenue: parseFloat(v.toFixed(2)) }));

  const clientiTotali  = Object.keys(perCliente).length;
  const clientiRitorno = Object.values(perCliente).filter(c => c >= 2).length;

  return res.json({
    total_revenue:  total.toFixed(2),
    total_bookings: (all || []).length,
    avg_booking:    all?.length ? (total / all.length).toFixed(2) : '0',
    by_month:       months,
    by_type:        byType,
    by_bike:        byBike,
    by_weekday:     byWeekday,
    returning: {
      totali:      clientiTotali,
      di_ritorno:  clientiRitorno,
      percentuale: clientiTotali ? Math.round((clientiRitorno / clientiTotali) * 100) : 0,
    },
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
git commit -m "feat(admin): report con bici top, giorni richiesti e clienti di ritorno"
```

---

## Task 2: Frontend — quarta card e due nuove sezioni

**Files:**
- Modify: `frontend/src/components/AdminDashboard.jsx` — funzione `renderReport`

**Contesto:** `renderReport` mostra una riga di 3 card statistiche, poi le sezioni "Andamento Mensile", "Per Tipo di Noleggio" e (se presente) l'occupazione. Si aggiungono: variabili calcolate, una quarta card "Clienti di Ritorno", e due sezioni "Bici più noleggiate" e "Giorni più richiesti" inserite prima del blocco occupazione. Si riusano gli stili esistenti (`ac-report-stat`, `ac-bar-chart`, `ac-bar-row`, `ac-section-title`, `ac-empty-sm`).

- [ ] **Step 1: Aggiungere le variabili calcolate**

In `frontend/src/components/AdminDashboard.jsx`, dentro `renderReport`, trovare:

```javascript
    const maxRev = Math.max(...(report.by_month || []).map(m => m.revenue), 1);
    const tipoLabels = { mezza_mattina: '½ Mattina', mezza_pomeriggio: '½ Pomeriggio', intera_giornata: 'Giornata', multi_giorno: 'Multi-giorno', '4_ore': '4 Ore', '3_piu_giorni': '3+ Giorni' };
```

e sostituirlo con:

```javascript
    const maxRev = Math.max(...(report.by_month || []).map(m => m.revenue), 1);
    const tipoLabels = { mezza_mattina: '½ Mattina', mezza_pomeriggio: '½ Pomeriggio', intera_giornata: 'Giornata', multi_giorno: 'Multi-giorno', '4_ore': '4 Ore', '3_piu_giorni': '3+ Giorni' };
    const bikeRanking = Object.entries(report.by_bike || {}).sort(([, a], [, b]) => b - a);
    const maxBike     = Math.max(...bikeRanking.map(([, c]) => c), 1);
    const giorniSett  = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
    const maxWeekday  = Math.max(...(report.by_weekday || []), 1);
```

- [ ] **Step 2: Aggiungere la quarta card "Clienti di Ritorno"**

In `renderReport`, trovare la card "Valore Medio" e la chiusura della riga di card:

```javascript
          <div className="ac-report-stat">
            <div className="ac-stat-label">Valore Medio</div>
            <div className="ac-stat-value">€{Number(report.avg_booking).toFixed(0)}</div>
          </div>
        </div>
```

e sostituirlo con (aggiunge la quarta card prima del `</div>` che chiude `ac-report-stats`):

```javascript
          <div className="ac-report-stat">
            <div className="ac-stat-label">Valore Medio</div>
            <div className="ac-stat-value">€{Number(report.avg_booking).toFixed(0)}</div>
          </div>
          <div className="ac-report-stat">
            <div className="ac-stat-label">Clienti di Ritorno</div>
            <div className="ac-stat-value">{report.returning?.percentuale ?? 0}%</div>
            <div style={{ fontSize: '.72rem', color: '#9CA3AF', marginTop: 2 }}>
              {report.returning?.di_ritorno ?? 0} di {report.returning?.totali ?? 0} clienti
            </div>
          </div>
        </div>
```

- [ ] **Step 3: Aggiungere le sezioni "Bici più noleggiate" e "Giorni più richiesti"**

In `renderReport`, trovare la riga che apre il blocco occupazione:

```javascript
        {occupazione && occupazione.length > 0 && (
```

e sostituirla con (aggiunge le due sezioni PRIMA del blocco occupazione):

```javascript
        <div className="ac-report-section">
          <h3 className="ac-section-title">Bici più noleggiate</h3>
          <div className="ac-bar-chart">
            {bikeRanking.length === 0
              ? <p className="ac-empty-sm">Nessun dato</p>
              : bikeRanking.map(([id, count]) => (
                <div key={id} className="ac-bar-row">
                  <span className="ac-bar-month">Bici #{id}</span>
                  <div className="ac-bar-track">
                    <div className="ac-bar-fill" style={{ width: `${(count / maxBike) * 100}%` }} />
                  </div>
                  <span className="ac-bar-value">{count}</span>
                </div>
              ))}
          </div>
        </div>

        <div className="ac-report-section">
          <h3 className="ac-section-title">Giorni più richiesti</h3>
          <div className="ac-bar-chart">
            {giorniSett.map((nome, i) => (
              <div key={nome} className="ac-bar-row">
                <span className="ac-bar-month">{nome}</span>
                <div className="ac-bar-track">
                  <div className="ac-bar-fill" style={{ width: `${((report.by_weekday?.[i] || 0) / maxWeekday) * 100}%` }} />
                </div>
                <span className="ac-bar-value">{report.by_weekday?.[i] || 0}</span>
              </div>
            ))}
          </div>
        </div>

        {occupazione && occupazione.length > 0 && (
```

- [ ] **Step 4: Verificare sintassi e build**

```bash
cd "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo/frontend" && npm run build 2>&1 | tail -5
```
Expected: build completata senza errori.

- [ ] **Step 5: Commit**

```bash
cd "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo"
git add frontend/src/components/AdminDashboard.jsx
git commit -m "feat(admin): vista Report con bici top, giorni richiesti, clienti di ritorno"
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
curl -s -o /dev/null -w "report senza token (401 atteso): %{http_code}\n" https://bike-rental-tarzo-app.vercel.app/api/admin/report
```
Expected: health `200`, report `401` (endpoint protetto da admin token).

- [ ] **Step 3: Verifica funzionale (manuale)**

Dall'admin panel, aprire la vista "Report":
- In cima devono esserci **4 card**: Incasso Totale, Prenotazioni Pagate, Valore Medio, Clienti di Ritorno (percentuale + dettaglio "X di Y clienti").
- Devono comparire le sezioni "Bici più noleggiate" (classifica a barre) e "Giorni più richiesti" (7 barre Lun→Dom).
- Con database vuoto: le sezioni non devono andare in errore — "Bici più noleggiate" mostra "Nessun dato", "Giorni più richiesti" mostra 7 barre a zero, la card clienti mostra "0%".
- Le sezioni preesistenti (Andamento Mensile, Per Tipo, Occupazione) devono restare invariate.

Questo step richiede dati reali per essere significativo: va eseguito dall'utente o concordato con lui.

---

## Self-Review

- **Spec coverage:**
  - `by_bike` (bici più noleggiate, multi-bici conta per ciascuna) → Task 1 + Task 2 Step 3
  - `by_weekday` (giorni della settimana, lunedì-primo) → Task 1 + Task 2 Step 3
  - `returning` (clienti di ritorno: telefono normalizzato, ≥2 prenotazioni, %) → Task 1 + Task 2 Step 2
  - Campi esistenti `/report` invariati → Task 1 (nuovo codice mantiene `total_revenue`/`total_bookings`/`avg_booking`/`by_month`/`by_type`)
  - Occupazione invariata → non toccata (Task 2 inserisce le sezioni PRIMA del blocco occupazione)
  - Stato DB vuoto senza errori → Task 2 (`?.`/`|| {}`/`|| []`, empty state "Nessun dato")
- **Placeholder scan:** nessun TBD/TODO. Tutto il codice è completo e mostrato.
- **Type consistency:** la risposta di `/report` (Task 1) espone `by_bike` (oggetto `{id: count}`), `by_weekday` (array di 7), `returning` (`{totali, di_ritorno, percentuale}`); `renderReport` (Task 2) legge esattamente quei nomi: `report.by_bike`, `report.by_weekday`, `report.returning?.percentuale/.di_ritorno/.totali`. `bikeRanking`/`maxBike`/`giorniSett`/`maxWeekday` definiti in Step 1 e usati in Step 3. Classi CSS riusate (`ac-bar-chart`, `ac-bar-row`, `ac-bar-month`, `ac-bar-track`, `ac-bar-fill`, `ac-bar-value`, `ac-empty-sm`, `ac-report-stat`, `ac-section-title`) tutte già presenti nella vista Report.

## Definition of Done

- `/api/admin/report` restituisce `by_bike`, `by_weekday`, `returning` oltre ai campi attuali
- La vista "Report" mostra la quarta card "Clienti di Ritorno" e le sezioni "Bici più noleggiate" e "Giorni più richiesti"
- Le sezioni preesistenti restano invariate; con DB vuoto niente errori
- Deploy completato, smoke test ok
