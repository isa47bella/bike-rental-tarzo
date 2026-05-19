# Notifiche WhatsApp via CallMeBot — Fase 1

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Attivare notifiche WhatsApp al proprietario (`+39 391 7563277`) ad ogni nuova prenotazione pagata, riusando il codice CallMeBot già presente nel webhook Stripe.

**Architecture:** La funzione `sendWhatsAppAlert()` esiste già in `backend/lib/email.js` ed è già agganciata al webhook `checkout.session.completed`. Bastano: (1) arricchire il template del messaggio, (2) aggiungere un endpoint admin di test + bottone UI, (3) configurare le due env vars CallMeBot su Vercel, (4) deploy + verifica.

**Tech Stack:** Node.js + Express (serverless Vercel), React 18 + Vite, CallMeBot HTTP API (`https://api.callmebot.com/whatsapp.php`).

**Spec di riferimento:** [`docs/superpowers/specs/2026-05-19-whatsapp-notifications-design.md`](../specs/2026-05-19-whatsapp-notifications-design.md)

## File Structure

| File | Responsabilità | Azione |
|---|---|---|
| `backend/lib/email.js` | Funzione `sendWhatsAppAlert()` con template arricchito | Modifica righe ~253-285 |
| `backend/routes/admin.js` | Nuovo endpoint `POST /api/admin/whatsapp/test` | Aggiunge ~15 righe dopo `/push/test` (riga 1198) |
| `frontend/src/lib/api.js` | Helper `adminApi.whatsappTest()` | Aggiunge 1 riga dopo `pushTest` (riga 167) |
| `frontend/src/components/AdminDashboard.jsx` | Bottone "Test WhatsApp" nella sezione notifiche | Aggiunge ~8 righe vicino al bottone "Test" push (~riga 3664-3671) |
| Vercel env vars (production) | `OWNER_WHATSAPP`, `CALLMEBOT_API_KEY` | Aggiunte via CLI |

Note: il codice in `backend/` viene copiato in `api/` dal `buildCommand` di Vercel — non serve modificare nulla in `api/`.

---

## Task 1: Arricchire il template del messaggio WhatsApp

**Files:**
- Modify: `backend/lib/email.js:257-285` (funzione `sendWhatsAppAlert`)

**Contesto:** Il template attuale include solo nome, data, tipo, giorni, prezzo, telefono, ID. Lo spec chiede di aggiungere: email cliente, data/ora restituzione, modello bici (via helper `biciLabel` già definito a riga 26), accessori (via helper `parseAccessori`/`accLabel` già definiti righe 47-54), note cliente. I campi opzionali appaiono solo se valorizzati.

- [ ] **Step 1: Sostituire l'intera funzione `sendWhatsAppAlert`**

Nel file `backend/lib/email.js`, sostituire le righe 253-285 (dall'inizio del commento `// ─── Notifica WhatsApp` fino alla chiusura `}` della funzione `sendWhatsAppAlert`) con:

```javascript
// ─── Notifica WhatsApp via CallMeBot ─────────────────────────────────────────
// Setup: salva il contatto +34 644 09 78 64 ("CallMeBot") e mandagli
// "I allow callmebot to send me messages". Ti risponde con la API key.
// Poi imposta CALLMEBOT_API_KEY + OWNER_WHATSAPP (numero senza +, es. 393917563277).

async function sendWhatsAppAlert(prenotazione) {
  const phone  = process.env.OWNER_WHATSAPP;
  const apikey = process.env.CALLMEBOT_API_KEY;
  if (!phone || !apikey) return; // non configurato, skip silenzioso

  const tipoShort = {
    mezza_mattina: '½ Mattina', mezza_pomeriggio: '½ Pomeriggio',
    intera_giornata: 'Giornata', multi_giorno: 'Multi-giorno',
  }[prenotazione.tipo_noleggio] || prenotazione.tipo_noleggio;

  const oraRitiro    = (prenotazione.orario_ritiro       || '').substring(0, 5);
  const oraRestit    = (prenotazione.orario_restituzione || '').substring(0, 5);
  const accessoriArr = parseAccessori(prenotazione.accessori);
  const accessoriStr = accessoriArr.length > 0
    ? accessoriArr.map(accLabel).join(', ')
    : '';
  const noteCliente  = (prenotazione.cliente_note || '').trim();

  const lines = [
    '🚲 NUOVA PRENOTAZIONE!',
    `👤 ${prenotazione.cliente_nome}`,
    prenotazione.cliente_email    ? `📧 ${prenotazione.cliente_email}`    : '',
    prenotazione.cliente_telefono ? `📞 ${prenotazione.cliente_telefono}` : '',
    `📅 ${prenotazione.data_ritiro} ${oraRitiro} — ${tipoShort}`,
    prenotazione.data_restituzione
      ? `🔄 Restituzione: ${prenotazione.data_restituzione} ${oraRestit}`
      : '',
    prenotazione.giorni > 1 ? `📆 ${prenotazione.giorni} giorni` : '',
    `🚴 ${biciLabel(prenotazione.bicicletta_id)}`,
    accessoriStr ? `🎒 Accessori: ${accessoriStr}` : '',
    `💶 €${Number(prenotazione.prezzo_totale).toFixed(2)} PAGATO`,
    noteCliente ? `📝 Note: ${noteCliente}` : '',
    `🔑 ${String(prenotazione.id).toUpperCase().substring(0, 8)}`,
  ].filter(Boolean).join('%0A');

  const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${lines}&apikey=${apikey}`;

  await new Promise(resolve => {
    https.get(url, res => {
      res.on('data', () => {});
      res.on('end', resolve);
    }).on('error', () => resolve()); // silenzioso in caso di errore
  });
}
```

**Note:**
- `biciLabel`, `parseAccessori`, `accLabel` sono già definiti più in alto nello stesso file (righe 26, 47, 52) → nessun import nuovo.
- `String(prenotazione.id)` per gestire ID che potrebbero non essere stringhe (uuid in Supabase ma per sicurezza).
- Email/telefono diventano condizionali per gestire prenotazioni manuali (walk-in) senza contatti.
- Il messaggio risultante può superare i 1000 caratteri ma CallMeBot accetta fino a ~4096 (limite WhatsApp).

- [ ] **Step 2: Verificare sintassi**

Run: `cd "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo" && node -e "require('./backend/lib/email.js')"`

Expected: nessun output (modulo carica senza errori). Se ci sono errori di sintassi vengono stampati subito.

- [ ] **Step 3: Commit**

```bash
cd "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo"
git add backend/lib/email.js
git commit -m "$(cat <<'EOF'
feat(whatsapp): arricchisce template messaggio CallMeBot

Aggiunge email cliente, data/ora restituzione, modello bici, accessori
e note cliente al messaggio WhatsApp inviato al proprietario.
I campi opzionali appaiono solo se valorizzati.
EOF
)"
```

---

## Task 2: Endpoint admin `POST /api/admin/whatsapp/test`

**Files:**
- Modify: `backend/routes/admin.js` — aggiungere import e nuovo endpoint subito dopo `/push/test` (riga 1197)

**Contesto:** Replica esattamente la struttura di `POST /api/admin/push/test` (righe 1189-1197). Genera una prenotazione fittizia e chiama `sendWhatsAppAlert()`. Logga l'azione su audit log come fa il test push.

- [ ] **Step 1: Aggiungere `sendWhatsAppAlert` all'import esistente**

Nel file `backend/routes/admin.js`, modificare la riga 16:

```javascript
const { sendAdminEmail, sendFirmaLinkEmail, sendWhatsAppAlert } = require('../lib/email');
```

(È già così — verificalo. Se così non fosse, sostituire la riga 16 esistente con quella sopra.)

- [ ] **Step 2: Aggiungere l'endpoint `/whatsapp/test`**

Subito dopo la chiusura `});` dell'endpoint `/push/test` (riga 1197), aggiungere:

```javascript

// ─── POST /api/admin/whatsapp/test ────────────────────────────────────────────

router.post('/whatsapp/test', async (req, res) => {
  try {
    if (!process.env.OWNER_WHATSAPP || !process.env.CALLMEBOT_API_KEY) {
      return res.status(400).json({
        error: 'WhatsApp non configurato: mancano OWNER_WHATSAPP o CALLMEBOT_API_KEY',
      });
    }
    const fakeBooking = {
      id:                  'test-' + Date.now(),
      cliente_nome:        'Mario Rossi (TEST)',
      cliente_email:       'test@arfantabikerental.it',
      cliente_telefono:    '+39 333 1234567',
      cliente_note:        'Questo è un messaggio di test inviato dall\'admin panel.',
      tipo_noleggio:       'intera_giornata',
      giorni:              1,
      data_ritiro:         new Date().toISOString().slice(0, 10),
      orario_ritiro:       '09:00:00',
      data_restituzione:   new Date().toISOString().slice(0, 10),
      orario_restituzione: '18:00:00',
      bicicletta_id:       1,
      accessori:           'casco,lucchetto',
      prezzo_totale:       45,
    };
    await sendWhatsAppAlert(fakeBooking);
    await logAction('whatsapp_test', null, {}, getIp(req));
    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});
```

- [ ] **Step 3: Verificare sintassi**

Run: `cd "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo" && node -e "require('./backend/routes/admin.js')"`

Expected: nessun output (modulo carica senza errori).

- [ ] **Step 4: Commit**

```bash
cd "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo"
git add backend/routes/admin.js
git commit -m "$(cat <<'EOF'
feat(admin): endpoint POST /api/admin/whatsapp/test

Genera una prenotazione fittizia e invia un messaggio WhatsApp di test
al proprietario. Riusa sendWhatsAppAlert() — utile a verificare la
configurazione (env vars CallMeBot) senza dover prenotare davvero.
EOF
)"
```

---

## Task 3: Helper frontend `adminApi.whatsappTest()`

**Files:**
- Modify: `frontend/src/lib/api.js:167` — aggiungere 1 riga dopo `pushTest`

- [ ] **Step 1: Aggiungere la riga `whatsappTest`**

Nel file `frontend/src/lib/api.js`, dopo la riga 167 (`pushTest: ...`), aggiungere:

```javascript
  whatsappTest:   ()                   => adminPost('/admin/whatsapp/test', {}),
```

L'allineamento delle frecce `=>` è coerente con le righe sopra.

- [ ] **Step 2: Commit**

```bash
cd "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo"
git add frontend/src/lib/api.js
git commit -m "feat(api): helper adminApi.whatsappTest()"
```

---

## Task 4: Bottone "Test WhatsApp" nell'admin panel

**Files:**
- Modify: `frontend/src/components/AdminDashboard.jsx:3664-3671` — aggiungere bottone dopo il "Test" push

**Contesto:** Il bottone "Test" per push è renderizzato dopo il toggle `pushSub`. Aggiungiamo un bottone analogo per WhatsApp, sempre visibile (non dipende dalla subscription push).

- [ ] **Step 1: Aggiungere il bottone**

Nel file `frontend/src/components/AdminDashboard.jsx`, subito dopo il blocco `{pushSub && (... "Test" ...)}` che termina a riga 3671 (`)}`), aggiungere:

```jsx
            <button
              className="ac-btn ghost sm"
              onClick={() =>
                adminApi.whatsappTest()
                  .then(() => alert('Messaggio WhatsApp di test inviato!'))
                  .catch(e => alert(e.message || 'Errore invio WhatsApp'))
              }
            >
              Test WhatsApp
            </button>
```

L'indentazione (12 spazi) deve matchare quella del bottone "Test" sopra.

- [ ] **Step 2: Verifica visiva locale (opzionale ma raccomandato)**

```bash
cd "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo/frontend"
npm run dev
```

Apri http://localhost:5173/admin — login con token `26arfanta` — verifica che il bottone "Test WhatsApp" appaia nella sezione notifiche, accanto a "Test" push.

Nota: localmente WhatsApp non funziona finché non sono configurate le env vars su Vercel — il bottone darà un errore 400 "WhatsApp non configurato". Questo è atteso. Lo scopo di questo step è verificare che il bottone sia presente e cliccabile.

Stop dev server con `Ctrl+C`.

- [ ] **Step 3: Commit**

```bash
cd "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo"
git add frontend/src/components/AdminDashboard.jsx
git commit -m "$(cat <<'EOF'
feat(admin): bottone "Test WhatsApp" in dashboard

Replica il pattern del bottone Test push. Cliccando, chiama
POST /api/admin/whatsapp/test e mostra un alert con esito.
EOF
)"
```

---

## Task 5: Setup CallMeBot (azione manuale di Giulio)

**Files:** nessuno (operazione sul telefono).

**Contesto:** Prima di configurare le env vars su Vercel servono i due valori — il numero destinatario (già noto: `+39 391 7563277`) e la API key personale di CallMeBot (da ottenere ora).

- [ ] **Step 1: Salvare il contatto CallMeBot**

Sul telefono di Giulio, salvare un nuovo contatto:
- **Nome:** CallMeBot
- **Numero:** `+34 644 09 78 64`

- [ ] **Step 2: Inviare il messaggio di autorizzazione**

Aprire WhatsApp, cercare il contatto "CallMeBot" appena salvato. Inviare esattamente questo messaggio (rispettare maiuscole e spazi):

```
I allow callmebot to send me messages
```

- [ ] **Step 3: Attendere risposta**

Entro 1-2 minuti, CallMeBot risponde con un messaggio del tipo:

```
API Activated for your phone number. Your APIKEY is 1234567
```

(Il numero `1234567` è un esempio — la tua chiave sarà diversa.)

- [ ] **Step 4: Annotare la API key**

Salvare la API key — servirà nel prossimo task. **NON committarla in git.**

---

## Task 6: Configurare env vars su Vercel

**Files:** nessuno (configurazione Vercel via CLI).

**Contesto:** Le due env vars vanno aggiunte all'environment `production`. Il numero va in formato internazionale **senza** `+` e **senza** spazi.

- [ ] **Step 1: Aggiungere `OWNER_WHATSAPP`**

```bash
cd "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo"
~/.npm-global/bin/vercel env add OWNER_WHATSAPP production
```

Alla richiesta del valore, inserire:

```
393917563277
```

(Senza `+` iniziale, senza spazi.)

- [ ] **Step 2: Aggiungere `CALLMEBOT_API_KEY`**

```bash
~/.npm-global/bin/vercel env add CALLMEBOT_API_KEY production
```

Alla richiesta del valore, inserire la API key ottenuta da CallMeBot nel Task 5.

- [ ] **Step 3: Verificare**

```bash
~/.npm-global/bin/vercel env ls | grep -E "OWNER_WHATSAPP|CALLMEBOT"
```

Expected: due righe, entrambe `production`, valore mascherato (mostra solo "Encrypted").

---

## Task 7: Deploy a production

**Files:** nessuno (operazione deploy).

- [ ] **Step 1: Deploy**

```bash
cd "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo"
~/.npm-global/bin/vercel --prod --yes
```

Expected: in 1-3 minuti termina con un URL `https://bike-rental-tarzo-app-*.vercel.app` e l'output `✓ Production: ...`.

- [ ] **Step 2: Health check**

```bash
curl -s https://bike-rental-tarzo-app.vercel.app/api/health
```

Expected output:

```json
{"status":"ok",...}
```

(Se ritorna errore, controllare `~/.npm-global/bin/vercel logs --prod` per dettagli.)

---

## Task 8: Test end-to-end

**Files:** nessuno (verifica funzionale).

- [ ] **Step 1: Test dell'endpoint admin**

Aprire https://bike-rental-tarzo-app.vercel.app/admin nel browser. Inserire admin token `26arfanta`. Trovare la sezione "Notifiche" / "Push notifications". Cliccare **"Test WhatsApp"**.

Expected:
- Alert nel browser: `Messaggio WhatsApp di test inviato!`
- Entro 5-15 secondi, messaggio WhatsApp ricevuto sul numero `+39 391 7563277` con contenuto:

```
🚲 NUOVA PRENOTAZIONE!
👤 Mario Rossi (TEST)
📧 test@arfantabikerental.it
📞 +39 333 1234567
📅 2026-05-19 09:00 — Giornata
🔄 Restituzione: 2026-05-19 18:00
🚴 E-City KTM #1
🎒 Accessori: Casco (+€2), Lucchetto (+€1)
💶 €45.00 PAGATO
📝 Note: Questo è un messaggio di test inviato dall'admin panel.
🔑 TEST-XXX
```

(La data sarà quella odierna, il suffisso `TEST-XXX` un timestamp.)

- [ ] **Step 2: Test end-to-end con prenotazione reale**

Aprire una finestra in incognito su https://bike-rental-tarzo-app.vercel.app. Completare una prenotazione di test:
- Bici: qualsiasi
- Data: una data libera futura
- Cliente: nome a piacere, email reale (es. la tua), telefono qualsiasi
- Carta Stripe: `4242 4242 4242 4242`, scadenza qualsiasi futura, CVC `123`, CAP `00000`

Expected entro 30 secondi dal pagamento:
- Email di conferma al cliente (già funzionante)
- Email al gestore (già funzionante)
- Push notification (se attivata, già funzionante)
- **Messaggio WhatsApp su `+39 391 7563277`** con i dati reali della prenotazione

- [ ] **Step 3: Verifica log produzione**

```bash
~/.npm-global/bin/vercel logs --prod 2>&1 | grep -i whatsapp | head -20
```

Expected: nessun errore (no righe contenenti `Error` o `Errore`). Se ci sono errori, leggerli e diagnosticare (es. API key sbagliata → messaggio CallMeBot di rifiuto).

- [ ] **Step 4: Cancellare la prenotazione di test (cleanup)**

Dall'admin panel: trovare la prenotazione di test creata al Step 2, premere il bottone di cancellazione/rimborso. Questo rilascia anche eventuali holds Stripe.

---

## Self-Review

- [x] **Spec coverage:** ogni requisito dello spec ha una task corrispondente:
  - Arricchimento template → Task 1
  - Endpoint admin di test → Task 2
  - Helper frontend → Task 3
  - Bottone admin panel → Task 4
  - Setup CallMeBot → Task 5
  - Env vars Vercel → Task 6
  - Deploy → Task 7
  - Testing end-to-end → Task 8
- [x] **Placeholder scan:** nessun TBD/TODO/"add appropriate handling"/"similar to". Ogni step contiene comando e/o codice completi.
- [x] **Type consistency:** `sendWhatsAppAlert` ha la stessa firma e set di campi atteso in Task 1 e Task 2. `whatsappTest` come nome è coerente tra api.js (Task 3) e AdminDashboard.jsx (Task 4). Endpoint path `/api/admin/whatsapp/test` coerente tra backend (Task 2) e frontend (Task 3).

## Definition of Done

- Tutti i commit creati (Task 1-4)
- CallMeBot autorizzato + API key annotata (Task 5)
- Env vars `OWNER_WHATSAPP` e `CALLMEBOT_API_KEY` presenti in Vercel production (Task 6)
- Deploy completato senza errori (Task 7)
- Messaggio WhatsApp di test ricevuto cliccando il bottone admin (Task 8 step 1)
- Messaggio WhatsApp ricevuto su prenotazione end-to-end reale (Task 8 step 2)
- Nessun errore nei log Vercel relativo a WhatsApp (Task 8 step 3)
