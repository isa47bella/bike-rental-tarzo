# Lista del giorno stampabile — Design

**Data:** 2026-05-21
**Autore:** Giulio Ballarin (brainstorming con Claude)
**Stato:** Design — in attesa di approvazione

## Obiettivo

Dare all'admin un **foglio stampabile** con i ritiri e le restituzioni di una giornata,
comodo da tenere al negozio. La data è scegliibile, così si può stampare anche la lista
del giorno dopo (es. la sera prima, per preparare il negozio).

## Contesto

L'admin ha già una vista "Oggi" che mostra ritiri, restituzioni e bici in ritardo della
giornata corrente, alimentata dall'endpoint `GET /api/admin/oggi`. Esiste già il
meccanismo di stampa `handlePrintRiepilogo` in `AdminDashboard.jsx`: genera una pagina
HTML pulita con CSS da stampa e apre la stampa del browser — ma per **una singola**
prenotazione. Questa feature riusa lo stesso pattern per l'intera giornata.

## Requisiti (raccolti in brainstorming)

| Requisito | Decisione |
|---|---|
| Giorno | Data **scegliibile** (default: oggi); si può stampare anche una data futura |
| Contenuto | Ritiri e restituzioni della data; se la data è oggi, anche le bici in ritardo |
| Formato | Pagina HTML + stampa del browser (stesso pattern di `handlePrintRiepilogo`) |
| Posizione | Selettore data + bottone "Stampa lista" nella vista "Oggi" |

## Architettura

### Backend — `GET /api/admin/oggi` con parametro data opzionale

L'endpoint oggi calcola la data internamente: `const oggi = new Date().toISOString().substring(0, 10)`.
Si aggiunge un parametro query opzionale `?data=AAAA-MM-GG`:
- **Senza** `?data=` → comportamento attuale invariato (giornata corrente).
- **Con** `?data=AAAA-MM-GG` valida → `ritiri` e `restituzioni` sono filtrati su quella data.
- `?data=` con formato non valido → `400` con messaggio d'errore (validazione regex
  `^\d{4}-\d{2}-\d{2}$`).

`inRitardo` resta sempre calcolato rispetto a **oggi reale** (`data_restituzione < oggi` e
`checkout_at` null): è un concetto "adesso", indipendente dalla data stampata. La vista
"Oggi" live continua a usarlo per il badge dei ritardi senza alcun cambiamento.

### Frontend — selettore + bottone nella vista "Oggi"

Nella vista "Oggi" (`renderOggi`) si aggiunge una piccola barra: un `<input type="date">`
preimpostato sulla data odierna e un bottone **"Stampa lista"**. Il selettore serve
**solo per la stampa**: la vista "Oggi" a schermo resta invariata e mostra sempre la
giornata corrente. Al clic sul bottone: si richiama `getOggi(data)`, si genera il foglio
HTML e si apre la stampa.

`frontend/src/lib/api.js` — `getOggi` accetta una data opzionale e, se presente, la passa
come query string (`/admin/oggi?data=...`).

### Il foglio stampabile — `handlePrintGiornata`

Nuova funzione in `AdminDashboard.jsx`, modellata su `handlePrintRiepilogo`: costruisce
una stringa HTML completa, la apre in una finestra/`iframe` e invoca `window.print()`.
Contenuto del foglio:

- **Intestazione**: "Lista del giorno — [data per esteso, es. 'martedì 21 maggio 2026']",
  sottotitolo "Arfanta Bike Rental · Via Pecol 22, Arfanta di Tarzo (TV)".
- **Sezione "Ritiri"** — tabella ordinata per `orario_ritiro`. Colonne per riga:
  casella vuota da spuntare ☐ · Orario · Cliente · Telefono · Bici (es. `#3`, o `#3, #5`
  se multi-bici) · Tipo noleggio · Accessori · Firma (`✓` se `firma_at` valorizzato,
  altrimenti `✗`).
- **Sezione "Restituzioni"** — tabella ordinata per `orario_restituzione`. Colonne:
  ☐ · Orario · Cliente · Telefono · Bici · Tipo noleggio.
- **Sezione "Bici ancora da rientrare (in ritardo)"** — mostrata **solo se la data
  stampata è oggi**. Elenca le prenotazioni `inRitardo`.
- Se una sezione è vuota: riga "Nessun ritiro" / "Nessuna restituzione".
- **CSS da stampa**: formato A4, il bottone di stampa non compare sul foglio
  (`@media print { .btn { display:none } }`), stesso stile del riepilogo esistente.

## Error handling

- `?data=` con formato non valido → `400`, il frontend mostra un alert.
- Errore di rete nel recupero dati → alert "Impossibile caricare la lista", niente stampa.
- Giornata senza prenotazioni → il foglio si stampa comunque, con le sezioni che
  riportano "Nessun ritiro" / "Nessuna restituzione".

## File coinvolti

| File | Modifica |
|---|---|
| `backend/routes/admin.js` | Modify — `/oggi` accetta `?data=` opzionale (validata) |
| `frontend/src/lib/api.js` | Modify — `getOggi` accetta una data opzionale |
| `frontend/src/components/AdminDashboard.jsx` | Modify — `handlePrintGiornata` + selettore data e bottone nella vista "Oggi" |

## Testing

Il progetto non ha test automatici. Verifica:
- `node -c` sul backend, build Vite per il frontend.
- Manuale: dalla vista "Oggi", stampare la lista di oggi e di domani; verificare che
  ritiri/restituzioni e gli orari siano corretti, che la sezione "in ritardo" compaia
  solo per oggi, e che il foglio sia leggibile in anteprima di stampa.

## Non in scope

- Rendere la vista "Oggi" navigabile per data (il selettore serve solo alla stampa).
- Generazione PDF lato server (si usa la stampa del browser, che permette già "Salva come PDF").
- Statistiche/aggregazioni (sono il secondo sub-progetto, separato).
