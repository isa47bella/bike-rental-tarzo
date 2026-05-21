# Statistiche più ricche — Design

**Data:** 2026-05-21
**Autore:** Giulio Ballarin (brainstorming con Claude)
**Stato:** Design — in attesa di approvazione

## Obiettivo

Arricchire la vista "Report" dell'admin con tre nuove metriche: bici più noleggiata,
giorni della settimana più richiesti, clienti di ritorno.

## Contesto

La vista "Report" dell'admin mostra già: incasso totale, prenotazioni pagate, valore
medio, andamento mensile dell'incasso, incasso per tipo di noleggio, e tasso di
occupazione mensile (ultimi 6 mesi). È alimentata dall'endpoint `GET /api/admin/report`
(aggrega tutte le prenotazioni pagate) e da `GET /api/admin/occupazione`.

Delle quattro metriche richieste, **l'occupazione mensile esiste già**: resta invariata.
Le altre tre sono nuove.

## Requisiti (raccolti in brainstorming)

| Requisito | Decisione |
|---|---|
| Bici più noleggiata | Classifica delle 10 bici per numero di noleggi |
| Giorni più richiesti | **Giorno della settimana** (lun→dom) con più ritiri |
| Clienti che tornano | Solo dato sintetico: numero + percentuale (nessuna lista) |
| Occupazione mensile | Già esistente — **non si tocca** |
| Periodo | Tutte le prenotazioni pagate (come già fa `/report`) |

## Architettura

Si estende ciò che esiste: nuove aggregazioni nell'endpoint `/report`, nuove sezioni
nella vista "Report". Nessun endpoint nuovo, nessuna pagina nuova.

### Backend — estensione di `GET /api/admin/report`

L'endpoint carica già tutte le prenotazioni pagate. Si aggiungono alla `select` le colonne
`bicicletta_id`, `bici_ids`, `cliente_telefono`, e si calcolano tre nuove aggregazioni
restituite insieme a quelle attuali:

- **`by_bike`** — oggetto `{ [bicicletta_id]: numero_noleggi }`. Per ogni prenotazione si
  contano le bici da `bici_ids` se è un array non vuoto, altrimenti da `bicicletta_id`
  (singola). Una prenotazione multi-bici conta per ciascuna delle sue bici.
- **`by_weekday`** — array di 7 interi, indice 0 = Lunedì … 6 = Domenica. Per ogni
  prenotazione si ricava il giorno da `data_ritiro` con `new Date(data_ritiro + 'T12:00:00')`
  (mezzogiorno per evitare slittamenti di fuso) e si mappa a lunedì-primo.
- **`returning`** — oggetto `{ totali, di_ritorno, percentuale }`. Le prenotazioni si
  raggruppano per cliente usando come chiave il **numero di telefono normalizzato** (sole
  cifre): è il dato più affidabile perché `cliente_telefono` è obbligatorio, mentre l'email
  a volte manca o è un segnaposto. `totali` = clienti distinti; `di_ritorno` = clienti con
  ≥ 2 prenotazioni; `percentuale` = `round(di_ritorno / totali * 100)` (0 se `totali` è 0).
  Le prenotazioni senza telefono valido vengono ignorate in questo conteggio.

I campi attuali della risposta (`total_revenue`, `total_bookings`, `avg_booking`,
`by_month`, `by_type`) restano invariati.

### Frontend — estensione di `renderReport`

La vista "Report" guadagna:

- **Clienti di ritorno** — una **quarta card** nella riga di card in alto (accanto a
  Incasso totale / Prenotazioni pagate / Valore medio). Mostra la percentuale in grande
  (es. "38%") con sotto il dettaglio "8 di 21 clienti".
- **"Bici più noleggiate"** — nuova sezione: classifica delle bici per numero di noleggi,
  ordinata in modo decrescente, a barre orizzontali (stesso stile dell'andamento mensile).
  Etichetta di ogni bici tramite l'helper `biciNome` già esistente.
- **"Giorni più richiesti"** — nuova sezione: 7 barre (Lun→Dom) con il numero di ritiri
  per giorno della settimana.

Si riusano gli stili già presenti della vista Report (`ac-report-stat`, `ac-bar-chart`,
`ac-section-title`, ecc.). Se la quarta card richiede un piccolo aggiustamento di layout,
si aggiunge una regola minima in `index.css`.

## Error handling

- L'endpoint `/report` già gestisce l'errore DB con un `500`. Le nuove aggregazioni
  girano sugli stessi dati già caricati: nessun nuovo punto di fallimento.
- Database vuoto / nessuna prenotazione: `by_bike` e `by_weekday` risultano a zero,
  `returning` è `{ totali: 0, di_ritorno: 0, percentuale: 0 }`. Il frontend mostra le
  sezioni con valori a zero o uno stato vuoto, senza errori.

## File coinvolti

| File | Modifica |
|---|---|
| `backend/routes/admin.js` | Modify — endpoint `/report`: nuove aggregazioni `by_bike`, `by_weekday`, `returning` |
| `frontend/src/components/AdminDashboard.jsx` | Modify — `renderReport`: quarta card + due nuove sezioni |
| `frontend/src/index.css` | Modify (eventuale) — piccola regola per la quarta card, solo se necessario |

## Testing

Il progetto non ha test automatici. Verifica:
- `node -c` sul backend, build Vite per il frontend.
- Manuale: aprire la vista "Report" e verificare che le tre nuove parti compaiano con
  numeri coerenti; con database vuoto le sezioni non devono andare in errore.

## Non in scope

- Tasso di occupazione mensile: già esistente, resta invariato.
- Lista dei clienti di ritorno (deciso: solo numero + percentuale).
- Filtri per periodo sulle statistiche (l'aggregazione resta su tutte le prenotazioni
  pagate, come già fa `/report`).
- Nuove pagine o nuovi endpoint.
