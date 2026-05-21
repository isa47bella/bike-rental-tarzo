# Email manuali multilingua — Design

**Data:** 2026-05-21
**Autore:** Giulio Ballarin (brainstorming con Claude)
**Stato:** Design — in attesa di approvazione

## Obiettivo

Permettere all'admin di inviare le email manuali al cliente (menu 3 puntini → "Invia email")
nella lingua del cliente, scegliendola da un selettore. Gli 8 template rapidi già esistenti
vengono tradotti in tutte e 5 le lingue del sito (it/en/de/es/fr).

## Problema attuale

Il menu 3 puntini di una prenotazione → "Invia email" apre una finestra con un menu
**"Template rapido"** (8 messaggi pronti) + campi Oggetto e Messaggio. Oggi:

1. **Gli 8 template sono scritti solo in italiano**, hardcoded in `EMAIL_TEMPLATES` dentro
   `AdminDashboard.jsx`. Se il cliente è tedesco, l'admin non ha un template in tedesco.
2. **Bug backend**: l'endpoint `POST /api/admin/bookings/:id/send-email` seleziona la
   prenotazione senza la colonna `lingua`. La funzione `sendAdminEmail` fa
   `const lang = prenotazione.lingua || 'it'` → siccome `lingua` non viene mai passata,
   ricade **sempre su `it`**. L'involucro dell'email (intestazione, saluto "Ciao …",
   footer UNESCO, etichetta del bottone) esce sempre in italiano anche per clienti stranieri.

## Requisiti (raccolti in brainstorming)

| Requisito | Decisione |
|---|---|
| Lingua di default del selettore | La lingua con cui il cliente ha prenotato (campo `lingua`) — funzione **primaria/automatica** |
| Override manuale | Il selettore è un menu a tendina con tutte e 5 le lingue: l'admin può scegliere qualunque lingua — funzione **secondaria** |
| Nomi dei template (label) | Restano **in italiano**: l'admin li sceglie leggendoli, non conosce le altre lingue |
| Contenuto dei template (oggetto + messaggio) | Esce **nella lingua selezionata** |
| Testo a mano libera | Resta com'è (non traducibile in automatico); il selettore lingua gli dà comunque l'involucro corretto |

## Architettura

### File dati dei template

Nuovo file `frontend/src/lib/emailTemplates.js`. Sposta `EMAIL_TEMPLATES` fuori da
`AdminDashboard.jsx` (già enorme). Ogni template ha questa struttura:

```js
{
  label: 'Promemoria ritiro domani',   // sempre IT — etichetta nel menu a tendina
  it: { subject: '…', message: '…' },
  en: { subject: '…', message: '…' },
  de: { subject: '…', message: '…' },
  es: { subject: '…', message: '…' },
  fr: { subject: '…', message: '…' },
}
```

Gli 8 template attuali (Promemoria ritiro domani, Conferma rimborso, Cauzione non
autorizzata, Cambio bicicletta, Ritardo restituzione, Danni rilevati, Ringraziamento
post-noleggio, Avviso meteo avverso) vengono mantenuti. L'italiano esiste già; si
aggiungono en/de/es/fr. Numero WhatsApp e indirizzo restano invariati in ogni lingua.

### Finestra "Invia email" (`renderEmailModal`)

Si aggiunge un selettore **"Lingua"** sopra il menu "Template rapido":
- 5 opzioni: Italiano / English / Deutsch / Español / Français.
- Si apre preimpostato sulla `lingua` della prenotazione (se assente → `it`).
- Il menu "Template rapido" continua a mostrare le `label` in italiano.
- Quando l'admin sceglie un template, Oggetto e Messaggio si riempiono con il testo
  del template nella **lingua attualmente selezionata**.
- Se l'admin cambia la lingua **dopo** aver scelto un template, Oggetto e Messaggio si
  riaggiornano nella nuova lingua (eventuali modifiche manuali vengono sovrascritte —
  comportamento atteso, dato che il selettore lingua riapplica il template).
- Se non è stato scelto nessun template (testo a mano libera), cambiare la lingua non
  tocca i campi di testo: incide solo sull'involucro dell'email inviata.

Stato React aggiuntivo nel componente: `emailLang` (lingua selezionata) e
`emailTemplateIdx` (indice del template scelto, per il riempimento). All'apertura della
finestra `emailLang` viene inizializzata con la lingua della prenotazione e
`emailTemplateIdx` azzerato. Per questo lo stato `emailModal` deve includere anche la
`lingua` della prenotazione (passata quando si apre la finestra dal menu 3 puntini).

### Backend

`POST /api/admin/bookings/:id/send-email`:
- Legge dal body anche `lang`.
- Aggiunge `lingua` alle colonne selezionate dalla prenotazione (serve come fallback).
- Valida `lang` contro `['it','en','de','es','fr']`; se mancante o non valida ricade su
  `prenotazione.lingua`, poi su `'it'`.
- Passa la lingua risolta a `sendAdminEmail`.

`sendAdminEmail(prenotazione, subject, messageText)` → nuova firma
`sendAdminEmail(prenotazione, subject, messageText, lang)`: usa il parametro `lang` per
`emailT(lang)` e `buildEmailShell({ lang })`. Mantiene il fallback
`lang = lang || prenotazione.lingua || 'it'` per robustezza.

`frontend/src/lib/api.js` — `sendEmail` aggiunge `lang` al body della POST.

## Edge case

- **Prenotazione senza `lingua`** (vecchie o manuali): il selettore si apre su `it`.
- **`lang` non valida o assente nella richiesta**: il backend ricade su `prenotazione.lingua`,
  poi su `'it'`. L'email parte comunque.
- **Cambio lingua dopo aver modificato il testo**: il testo del template viene riapplicato
  nella nuova lingua, le modifiche manuali si perdono. Accettato (vedi sopra).
- **Testo a mano libera in lingua straniera**: l'admin lo scrive da sé; il sistema non lo
  traduce. Il selettore lingua serve a far uscire l'involucro nella lingua giusta.

## File coinvolti

| File | Modifica |
|---|---|
| `frontend/src/lib/emailTemplates.js` | Create — gli 8 template con `label` IT + testo in 5 lingue |
| `frontend/src/components/AdminDashboard.jsx` | Modify — rimuove `EMAIL_TEMPLATES` inline, importa dal nuovo file; aggiunge selettore Lingua, stato `emailLang`/`emailTemplateIdx`, aggiorna `renderEmailModal`, l'apertura della finestra e `handleSendEmail` |
| `frontend/src/lib/api.js` | Modify — `sendEmail` invia `lang` |
| `backend/routes/admin.js` | Modify — `send-email` legge/valida `lang`, seleziona `lingua` |
| `backend/lib/email.js` | Modify — `sendAdminEmail` accetta `lang` |

## Testing

Il progetto non ha test automatici. Verifica:
- `node -c` sui file backend modificati, build Vite per il frontend.
- Manuale: aprire una prenotazione con `lingua` straniera (es. `de`) → la finestra si apre
  su Deutsch; scegliere un template → oggetto e messaggio in tedesco; cambiare lingua su
  English → testo in inglese; inviare → email ricevuta con contenuto e involucro coerenti.
- Verificare che una prenotazione italiana funzioni come prima.

## Non in scope

- Traduzione automatica del testo scritto a mano libera (impossibile senza un servizio
  di traduzione; l'admin lo scrive da sé).
- Aggiunta/modifica dei template dall'interfaccia admin (restano definiti nel codice).
- Traduzione delle `label` dei template (restano in italiano per scelta).
- Modifica delle email automatiche (conferma, promemoria, ecc.): sono già multilingua.
