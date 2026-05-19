# Notifiche WhatsApp al proprietario — Design

**Data:** 2026-05-19
**Autore:** Giulio Ballarin (brainstorming con Claude)
**Stato:** Design — in attesa di approvazione

## Obiettivo

Ricevere un messaggio WhatsApp al numero del proprietario (`+39 392 8614635`) ogni volta che viene effettuata una nuova prenotazione pagata sul sito Arfanta Bike Rental.

## Requisiti (raccolti in brainstorming)

| Requisito | Decisione |
|---|---|
| Destinatario | Solo il proprietario (Giulio) — non i clienti |
| Numero destinatari | 1 (solo `+39 392 8614635`) |
| Servizio | **Fase 1**: CallMeBot (quick win); **Fase 2 (futuro)**: Meta WhatsApp Business Cloud API |
| Contenuto messaggio | Riepilogo completo (cliente, contatti, date, bici, accessori, prezzo, note, ID) |

## Stato attuale del codice

- Il webhook Stripe (`backend/routes/payments.js`, evento `checkout.session.completed`) chiama già `sendWhatsAppAlert(leadWithTotal)` in parallelo a email e push notification, all'interno di un `Promise.all([...])`.
- La funzione `sendWhatsAppAlert()` esiste già in `backend/lib/email.js` (riga 257), già implementata per CallMeBot.
- Le env vars `OWNER_WHATSAPP` e `CALLMEBOT_API_KEY` non sono configurate su Vercel, quindi la funzione attualmente fa un return silenzioso senza errori.
- Il template del messaggio attuale è semplificato: include nome, data, tipo noleggio, giorni, prezzo, telefono, ID. **Non** include: email cliente, data restituzione, modello bici, accessori, note cliente.

## Architettura

### Punto di aggancio (invariato in entrambe le fasi)

Il webhook in `payments.js` non si tocca. La firma della funzione `sendWhatsAppAlert(prenotazione)` resta identica tra Fase 1 e Fase 2 per minimizzare il blast radius del cambio.

```
Stripe Webhook
    ↓
checkout.session.completed
    ↓
Promise.all([
    sendConfirmationToCliente(),
    sendNotificationToGestore(),
    sendWhatsAppAlert(),    ←─── interesse di questo spec
    sendPushToAll(),
])
```

### Fase 1 — CallMeBot (quick win, ~5 min)

- Il codice di `sendWhatsAppAlert()` resta dov'è (`backend/lib/email.js`)
- Si configura solo `OWNER_WHATSAPP` e `CALLMEBOT_API_KEY` come Vercel env vars
- Si arricchisce il template del messaggio (vedi sezione "Template messaggio")
- Si aggiunge endpoint `POST /api/admin/whatsapp/test` + bottone "Testa WhatsApp" in admin panel

### Fase 2 — Meta WhatsApp Business Cloud API (migrazione futura)

- Si sposta `sendWhatsAppAlert()` da `backend/lib/email.js` a un nuovo file `backend/lib/whatsapp.js`
- Il modulo `email.js` smette di esportare quella funzione
- Il webhook in `payments.js` cambia solo l'import: da `require('../lib/email')` a `require('../lib/whatsapp')`
- L'implementazione interna passa da chiamata GET a CallMeBot a POST a Graph API Meta
- Stesso template di messaggio (ora parametrizzato attraverso un template Meta approvato `nuova_prenotazione`)
- Nuove env vars: `META_WA_TOKEN`, `META_WA_PHONE_NUMBER_ID`
- Rimozione env vars CallMeBot

**Motivazione separation of concerns:** `email.js` è già grande (~320 righe) e mescola email + WhatsApp. Estrarre WhatsApp in modulo dedicato apre spazio a future funzioni (es. promemoria WhatsApp, conferme cliente).

## Template messaggio (arricchito)

```
🚲 NUOVA PRENOTAZIONE!
👤 {cliente_nome}
📧 {cliente_email}
📞 {cliente_telefono}
📅 {data_ritiro} {orario_ritiro} — {tipo_noleggio}
🔄 Restituzione: {data_restituzione} {orario_restituzione}
🚴 {nome_bici} (n.{bicicletta_id})
🎒 Accessori: {accessori_formattati}     ← solo se ci sono
💶 €{prezzo_totale} PAGATO
📝 Note: {cliente_note}                  ← solo se valorizzato
🔑 {id_primi_8_char_uppercase}
```

I campi opzionali (accessori, note) appaiono solo se valorizzati per non sporcare il messaggio.

Il nome bici si recupera con un lookup su `biciclette` per `bicicletta_id`. Se il lookup fallisce, si mostra solo il numero.

## Componenti da modificare/aggiungere

### Fase 1

| File | Modifica |
|---|---|
| `backend/lib/email.js` | Arricchire il template di `sendWhatsAppAlert()` con email, data restituzione, bici, accessori, note |
| `backend/routes/admin.js` | Nuovo endpoint `POST /api/admin/whatsapp/test` che chiama `sendWhatsAppAlert()` con prenotazione fittizia |
| `frontend/src/components/AdminDashboard.jsx` | Nuovo bottone "Testa WhatsApp" (analogo a "Testa Push" esistente) |
| Vercel env vars | Aggiungere `OWNER_WHATSAPP=393928614635` e `CALLMEBOT_API_KEY=<da_callmebot>` |

### Fase 2 (futuro — non in questa iterazione)

| File | Modifica |
|---|---|
| `backend/lib/whatsapp.js` (nuovo) | Implementazione Meta Cloud API |
| `backend/lib/email.js` | Rimuovere `sendWhatsAppAlert()` dall'export |
| `backend/routes/payments.js` | Cambiare import da `email` a `whatsapp` |
| `backend/routes/admin.js` | Cambiare import nell'endpoint di test |
| Vercel env vars | Aggiungere `META_WA_TOKEN`, `META_WA_PHONE_NUMBER_ID`; rimuovere CallMeBot |

## Setup operativo CallMeBot (eseguito dall'utente)

1. Salvare il contatto `+34 644 09 78 64` come "CallMeBot" sul telefono
2. Aprire chat WhatsApp con quel contatto e inviare: `I allow callmebot to send me messages`
3. Attendere risposta (1-2 minuti) con la API key
4. Annotare la API key

## Error handling

- `sendWhatsAppAlert()` è in `Promise.all` con `.catch()` individuale → un fallimento WhatsApp non blocca email/push
- Se env vars mancanti, la funzione fa return silenzioso (no crash)
- Errori loggati su `console.error('WhatsApp alert:', e)` → visibili in Vercel Logs
- Endpoint `POST /api/admin/whatsapp/test` ritorna `{ ok: true }` in caso di successo, `{ ok: false, error: ... }` altrimenti

## Testing

### Test manuali post-deploy

1. **Test endpoint admin:** dall'admin panel premere "Testa WhatsApp" → ricevere messaggio fittizio entro 5 secondi
2. **Test end-to-end:** completare una prenotazione di test usando carta Stripe `4242 4242 4242 4242` → ricevere messaggio reale
3. **Verifica log:** `~/.npm-global/bin/vercel logs --prod | grep WhatsApp` per controllare l'assenza di errori

### Casi limite da verificare manualmente

- Prenotazione con accessori vuoti → il campo "Accessori" non deve apparire
- Prenotazione senza note cliente → il campo "Note" non deve apparire
- Bici non trovata nel lookup → fallback al numero senza crash
- Env vars mancanti → return silenzioso, altri Promise.all proseguono

## Costi & limiti

| | Fase 1 — CallMeBot | Fase 2 — Meta |
|---|---|---|
| Costo | Gratis | Gratis fino a 1000 msg/mese, poi pay-as-you-go |
| Rate limit | ~1 msg/min | ~250 msg/sec |
| Affidabilità | Discreta (servizio hobby) | Alta (infrastruttura Meta) |
| Setup | 5 minuti | 1-2 ore |
| Numero mittente | CallMeBot (numero spagnolo) | Numero di test Meta o numero business reale |

Per il volume previsto (stagionale, max ~10 prenotazioni/giorno in alta stagione = max 300/mese), entrambe le fasi sono ampiamente sufficienti.

## Decisioni architetturali

- **Stessa firma di funzione tra le fasi**: minimizza blast radius del cambio.
- **Modulo dedicato in Fase 2**: separation of concerns, prepara spazio a future funzioni WhatsApp.
- **Template Meta utility (non marketing)**: approvazione veloce e nessun limite di sessione 24h.
- **Endpoint admin di test**: prevenzione regressioni — utile a ogni cambio di configurazione futuro.

## Non in scope di questo spec

- Conferma WhatsApp automatica al cliente (richiede Meta verificato + numero business)
- Promemoria WhatsApp pre-ritiro
- Multi-destinatario (più numeri ricevono la stessa notifica)
- Gruppo WhatsApp come destinatario
- Notifiche WhatsApp per altri eventi (cancellazioni, refund, danni)

Questi sono naturali estensioni future ma fuori dall'obiettivo di questo spec.
