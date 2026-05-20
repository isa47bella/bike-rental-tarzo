# Redesign email transazionali — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ridisegnare tutte le 8 email transazionali di Arfanta Bike Rental con un'estetica premium coerente col brand, e portare tutte le email rivolte al cliente al multilingua a 5 lingue (it/en/de/es/fr).

**Architecture:** Un unico `buildEmailShell()` genera header (foto Colline del Prosecco + logo) e footer condivisi. Ogni email fornisce solo il contenuto centrale. Un dizionario `EMAIL_I18N` centralizza tutte le stringhe tradotte. Tutto in `backend/lib/email.js`.

**Tech Stack:** Node.js, Nodemailer, HTML email table-based, Google Fonts (Barlow) con fallback.

**Spec di riferimento:** [`docs/superpowers/specs/2026-05-20-email-redesign-design.md`](../specs/2026-05-20-email-redesign-design.md)
**Mockup approvato:** [`docs/email-mockup.html`](../../email-mockup.html) — è il riferimento visivo/strutturale dell'HTML.

## File Structure

| File | Modifica |
|---|---|
| `frontend/public/email-hero.jpg` | Create — foto header scaricata da Unsplash |
| `backend/lib/email.js` | Modifica strutturale — nuovo dizionario i18n, shell, template ridisegnati |
| `backend/routes/cron.js` | Modifica 1 riga — aggiungere `lingua` al select del cron reminder |

## Note sul testing

Il progetto non ha test automatici. La verifica di ogni task è: (a) `node -c` per la sintassi, (b) generazione di un mockup HTML di prova ispezionato a vista, (c) al termine, deploy e invio di email di test. Non scrivere test Jest/Vitest.

---

## Task 1: Scaricare la foto header

**Files:**
- Create: `frontend/public/email-hero.jpg`

- [ ] **Step 1: Scaricare la foto**

```bash
cd "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo"
curl -s -o frontend/public/email-hero.jpg "https://images.unsplash.com/photo-1624715636409-6c1b6bc4fe9a?auto=format&fit=crop&w=1200&q=80"
```

- [ ] **Step 2: Verificare il download**

Run: `file frontend/public/email-hero.jpg`
Expected: `JPEG image data` con dimensioni circa 1200px di larghezza.

- [ ] **Step 3: Commit**

```bash
cd "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo"
git add frontend/public/email-hero.jpg
git commit -m "feat(email): foto header Colline del Prosecco per le email"
```

L'immagine sarà servita in produzione da `https://bike-rental-tarzo-app.vercel.app/email-hero.jpg`.

---

## Task 2: Dizionario i18n + helper multilingua

**Files:**
- Modify: `backend/lib/email.js` — aggiungere il dizionario e i helper dopo `parseAccessori` (riga ~54)

**Contesto:** `formatDate` e `tipoLabel` esistenti sono solo italiani. Vanno resi multilingua. Si aggiunge `EMAIL_I18N` con tutte le stringhe delle email.

- [ ] **Step 1: Aggiungere `LOCALE_MAP` e rendere `formatDate` multilingua**

In `backend/lib/email.js`, sostituire la funzione `formatDate` esistente (righe 28-33) con:

```javascript
const LOCALE_MAP = { it: 'it-IT', en: 'en-GB', de: 'de-DE', es: 'es-ES', fr: 'fr-FR' };

function formatDate(dateStr, lang = 'it') {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(LOCALE_MAP[lang] || 'it-IT', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}
```

- [ ] **Step 2: Rendere `tipoLabel` multilingua**

Sostituire la funzione `tipoLabel` esistente (righe 35-45) con:

```javascript
const TIPO_LABELS = {
  it: { mezza_mattina: 'Mezza giornata — Mattina (09:00–13:00)', mezza_pomeriggio: 'Mezza giornata — Pomeriggio (14:00–18:00)', intera_giornata: 'Giornata intera (09:00–18:00)', multi_giorno: 'Multi-giorno' },
  en: { mezza_mattina: 'Half day — Morning (09:00–13:00)',       mezza_pomeriggio: 'Half day — Afternoon (14:00–18:00)',     intera_giornata: 'Full day (09:00–18:00)',        multi_giorno: 'Multi-day' },
  de: { mezza_mattina: 'Halbtags — Vormittag (09:00–13:00)',     mezza_pomeriggio: 'Halbtags — Nachmittag (14:00–18:00)',    intera_giornata: 'Ganztags (09:00–18:00)',        multi_giorno: 'Mehrtägig' },
  es: { mezza_mattina: 'Media jornada — Mañana (09:00–13:00)',   mezza_pomeriggio: 'Media jornada — Tarde (14:00–18:00)',    intera_giornata: 'Jornada completa (09:00–18:00)', multi_giorno: 'Varios días' },
  fr: { mezza_mattina: 'Demi-journée — Matin (09h00–13h00)',     mezza_pomeriggio: 'Demi-journée — Après-midi (14h00–18h00)', intera_giornata: 'Journée entière (09h00–18h00)',  multi_giorno: 'Plusieurs jours' },
};

function tipoLabel(tipo, lang = 'it') {
  const set = TIPO_LABELS[lang] || TIPO_LABELS.it;
  return set[tipo] || TIPO_LABELS.it[tipo] || tipo;
}
```

- [ ] **Step 3: Aggiungere il dizionario `EMAIL_I18N`**

Subito dopo `parseAccessori` (riga ~54), aggiungere:

```javascript
// ─── Stringhe email multilingua (it/en/de/es/fr) ─────────────────────────────
const EMAIL_I18N = {
  it: {
    tagline:        'Noleggio e-bike · Colline del Prosecco UNESCO',
    footerUnesco:   'Colline del Prosecco di Conegliano e Valdobbiadene — Patrimonio UNESCO',
    footerContatto: 'Per modifiche o cancellazioni scrivici su WhatsApp al',
    saluto:         (nome) => `Gentile ${nome},`,
    confSubject:    'Prenotazione confermata',
    confTitolo:     'Prenotazione confermata',
    confIntro:      'la tua e-bike ti aspetta tra i vigneti. Ecco tutti i dettagli del noleggio.',
    lCodice:        'Codice prenotazione',
    lTipo:          'Tipo noleggio',
    lRitiro:        'Ritiro',
    lRestituzione:  'Restituzione',
    lBici:          'Bicicletta',
    lAccessori:     'Accessori',
    lTotale:        'Totale pagato',
    firmaTitolo:    'Un ultimo passaggio',
    firmaTesto:     'Firma il contratto di noleggio prima del ritiro. Bastano due minuti, dal tuo telefono.',
    firmaBottone:   'Firma il contratto',
    dove:           'Dove venirci a trovare',
    cosaPortare:    'Cosa portare',
    documento:      "Documento d'identità",
    codicePort:     'Il codice prenotazione',
    remSubject:     'Il tuo noleggio è domani',
    remTitolo:      'Il tuo noleggio è domani',
    remTesto:       "Ti ricordiamo che domani è il giorno del tuo noleggio. Ti aspettiamo a Via Pecol 22, Arfanta di Tarzo (TV). Ricordati di portare un documento d'identità valido e il tuo codice prenotazione.",
  },
  en: {
    tagline:        'E-bike rental · Prosecco Hills UNESCO Site',
    footerUnesco:   'Prosecco Hills of Conegliano and Valdobbiadene — UNESCO World Heritage Site',
    footerContatto: 'For changes or cancellations, message us on WhatsApp at',
    saluto:         (nome) => `Dear ${nome},`,
    confSubject:    'Booking confirmed',
    confTitolo:     'Booking confirmed',
    confIntro:      'your e-bike is waiting among the vineyards. Here are all the details of your rental.',
    lCodice:        'Booking code',
    lTipo:          'Rental type',
    lRitiro:        'Pick-up',
    lRestituzione:  'Return',
    lBici:          'Bicycle',
    lAccessori:     'Accessories',
    lTotale:        'Total paid',
    firmaTitolo:    'One last step',
    firmaTesto:     'Sign the rental agreement before pick-up. It only takes two minutes, from your phone.',
    firmaBottone:   'Sign the agreement',
    dove:           'Where to find us',
    cosaPortare:    'What to bring',
    documento:      'ID document',
    codicePort:     'Your booking code',
    remSubject:     'Your rental is tomorrow',
    remTitolo:      'Your rental is tomorrow',
    remTesto:       "A friendly reminder that tomorrow is your rental day. We'll be waiting for you at Via Pecol 22, Arfanta di Tarzo (TV), Italy. Remember to bring a valid ID document and your booking code.",
  },
  de: {
    tagline:        'E-Bike-Verleih · Prosecco-Hügel UNESCO-Welterbe',
    footerUnesco:   'Prosecco-Hügel von Conegliano und Valdobbiadene — UNESCO-Welterbe',
    footerContatto: 'Für Änderungen oder Stornierungen schreiben Sie uns auf WhatsApp:',
    saluto:         (nome) => `Hallo ${nome},`,
    confSubject:    'Buchung bestätigt',
    confTitolo:     'Buchung bestätigt',
    confIntro:      'Ihr E-Bike wartet schon zwischen den Weinbergen. Hier sind alle Details Ihrer Buchung.',
    lCodice:        'Buchungscode',
    lTipo:          'Mietart',
    lRitiro:        'Abholung',
    lRestituzione:  'Rückgabe',
    lBici:          'Fahrrad',
    lAccessori:     'Zubehör',
    lTotale:        'Bezahlter Betrag',
    firmaTitolo:    'Ein letzter Schritt',
    firmaTesto:     'Unterzeichnen Sie den Mietvertrag vor der Abholung. Es dauert nur zwei Minuten, direkt vom Handy.',
    firmaBottone:   'Vertrag unterzeichnen',
    dove:           'So finden Sie uns',
    cosaPortare:    'Was mitbringen',
    documento:      'Gültiger Ausweis',
    codicePort:     'Ihren Buchungscode',
    remSubject:     'Ihre Vermietung ist morgen',
    remTitolo:      'Ihre Vermietung ist morgen',
    remTesto:       'Eine kurze Erinnerung: Morgen ist Ihr Miettag. Wir erwarten Sie in Via Pecol 22, Arfanta di Tarzo (TV), Italien. Bitte denken Sie an einen gültigen Ausweis und Ihren Buchungscode.',
  },
  es: {
    tagline:        'Alquiler de e-bike · Colinas del Prosecco UNESCO',
    footerUnesco:   'Colinas del Prosecco de Conegliano y Valdobbiadene — Patrimonio de la UNESCO',
    footerContatto: 'Para cambios o cancelaciones, escríbenos por WhatsApp al',
    saluto:         (nome) => `Hola ${nome},`,
    confSubject:    'Reserva confirmada',
    confTitolo:     'Reserva confirmada',
    confIntro:      'tu e-bike te espera entre los viñedos. Aquí tienes todos los detalles del alquiler.',
    lCodice:        'Código de reserva',
    lTipo:          'Tipo de alquiler',
    lRitiro:        'Recogida',
    lRestituzione:  'Devolución',
    lBici:          'Bicicleta',
    lAccessori:     'Accesorios',
    lTotale:        'Total pagado',
    firmaTitolo:    'Un último paso',
    firmaTesto:     'Firma el contrato de alquiler antes de la recogida. Solo lleva dos minutos, desde tu móvil.',
    firmaBottone:   'Firmar el contrato',
    dove:           'Dónde encontrarnos',
    cosaPortare:    'Qué llevar',
    documento:      'Documento de identidad',
    codicePort:     'Tu código de reserva',
    remSubject:     'Tu alquiler es mañana',
    remTitolo:      'Tu alquiler es mañana',
    remTesto:       'Te recordamos que mañana es el día de tu alquiler. Te esperamos en Via Pecol 22, Arfanta di Tarzo (TV), Italia. Recuerda llevar un documento de identidad válido y tu código de reserva.',
  },
  fr: {
    tagline:        "Location d'e-bikes · Collines du Prosecco UNESCO",
    footerUnesco:   'Collines du Prosecco de Conegliano et Valdobbiadene — Patrimoine mondial UNESCO',
    footerContatto: 'Pour toute modification ou annulation, écrivez-nous sur WhatsApp au',
    saluto:         (nome) => `Bonjour ${nome},`,
    confSubject:    'Réservation confirmée',
    confTitolo:     'Réservation confirmée',
    confIntro:      'votre e-bike vous attend parmi les vignobles. Voici tous les détails de votre location.',
    lCodice:        'Code de réservation',
    lTipo:          'Type de location',
    lRitiro:        'Retrait',
    lRestituzione:  'Restitution',
    lBici:          'Vélo',
    lAccessori:     'Accessoires',
    lTotale:        'Total payé',
    firmaTitolo:    'Une dernière étape',
    firmaTesto:     'Signez le contrat de location avant le retrait. Cela ne prend que deux minutes, depuis votre téléphone.',
    firmaBottone:   'Signer le contrat',
    dove:           'Où nous trouver',
    cosaPortare:    'Quoi apporter',
    documento:      "Pièce d'identité",
    codicePort:     'Votre code de réservation',
    remSubject:     'Votre location est demain',
    remTitolo:      'Votre location est demain',
    remTesto:       'Petit rappel : demain, c\'est le jour de votre location. Nous vous attendons au Via Pecol 22, Arfanta di Tarzo (TV), Italie. Pensez à apporter une pièce d\'identité valide et votre code de réservation.',
  },
};

function emailT(lang) { return EMAIL_I18N[lang] || EMAIL_I18N.it; }
```

- [ ] **Step 4: Verificare sintassi**

Run: `cd "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo" && node -c backend/lib/email.js`
Expected: nessun output.

- [ ] **Step 5: Commit**

```bash
cd "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo"
git add backend/lib/email.js
git commit -m "feat(email): dizionario i18n a 5 lingue + formatDate/tipoLabel multilingua"
```

---

## Task 3: Lo shell condiviso `buildEmailShell`

**Files:**
- Modify: `backend/lib/email.js` — aggiungere `EMAIL_PALETTE` e `buildEmailShell` prima di `buildClienteHtml`

**Contesto:** `buildEmailShell` produce l'involucro HTML completo (doctype, head con web font, header foto+logo, footer) e inserisce il `bodyHtml` nel mezzo. Replica esattamente la struttura HTML del mockup approvato `docs/email-mockup.html` (header foto + logo + tagline, footer). Palette e font dal mockup.

- [ ] **Step 1: Aggiungere `buildEmailShell`**

Aggiungere in `backend/lib/email.js` prima della funzione `buildClienteHtml`:

```javascript
// ─── Shell email condiviso ───────────────────────────────────────────────────
// Header (foto Colline del Prosecco + logo) e footer identici per ogni email.
// La struttura HTML replica il mockup approvato docs/email-mockup.html.
const HERO_URL = 'https://bike-rental-tarzo-app.vercel.app/email-hero.jpg';

function buildEmailShell({ lang = 'it', heroAlt, bodyHtml }) {
  const t = emailT(lang);
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <link href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=Barlow+Semi+Condensed:wght@600;700&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#F6F1E8;font-family:'Barlow','Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F1E8;">
    <tr><td align="center" style="padding:40px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#FFFDFA;border:1px solid #EBE3D4;">

        <tr><td style="padding:0;font-size:0;line-height:0;">
          <img src="${HERO_URL}" alt="${esc(heroAlt)}" width="600" style="display:block;width:100%;max-width:600px;height:240px;object-fit:cover;">
        </td></tr>

        <tr><td style="padding:26px 48px 22px;text-align:center;border-bottom:1px solid #EFE8DA;">
          <div style="font-family:'Barlow Semi Condensed','Barlow',Arial,sans-serif;font-size:26px;font-weight:700;letter-spacing:0.04em;color:#2B2520;text-transform:uppercase;">
            Arfanta <span style="color:#EA580C;">Bike Rental</span>
          </div>
          <div style="font-size:11px;font-weight:500;letter-spacing:0.16em;color:#9A8F80;text-transform:uppercase;margin-top:6px;">
            ${esc(t.tagline)}
          </div>
        </td></tr>

        ${bodyHtml}

        <tr><td style="background:#F6F1E8;padding:26px 48px;text-align:center;border-top:1px solid #EBE3D4;">
          <div style="font-family:'Barlow Semi Condensed','Barlow',Arial,sans-serif;font-size:15px;font-weight:700;letter-spacing:0.05em;color:#2B2520;text-transform:uppercase;">Arfanta Bike Rental</div>
          <div style="font-size:12px;line-height:1.7;color:#9A8F80;margin-top:8px;">
            Via Pecol 22, Arfanta di Tarzo (TV) &nbsp;·&nbsp; Italia<br>${esc(t.footerUnesco)}
          </div>
          <div style="font-size:12px;color:#9A8F80;margin-top:12px;">
            ${esc(t.footerContatto)}
            <a href="https://wa.me/393928614635" style="color:#EA580C;text-decoration:none;font-weight:600;">+39 392 8614635</a>
          </div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
```

- [ ] **Step 2: Verificare sintassi**

Run: `cd "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo" && node -c backend/lib/email.js`
Expected: nessun output.

- [ ] **Step 3: Commit**

```bash
cd "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo"
git add backend/lib/email.js
git commit -m "feat(email): shell condiviso buildEmailShell con header foto e footer"
```

---

## Task 4: Email conferma prenotazione ridisegnata e multilingua

**Files:**
- Modify: `backend/lib/email.js` — sostituire `buildClienteHtml` (righe ~66-174) e `sendConfirmationToCliente`

**Contesto:** È l'email più ricca. Il corpo replica la struttura del mockup `docs/email-mockup.html` (codice prenotazione in cornice, riepilogo etichetta/valore, CTA firma, blocco dove/cosa portare), parametrizzata con `emailT(lang)`. Il valore tipo noleggio usa `tipoLabel(p.tipo_noleggio, lang)`, le date `formatDate(..., lang)`.

- [ ] **Step 1: Sostituire `buildClienteHtml`**

Sostituire l'intera funzione `buildClienteHtml` con una nuova che:
1. Calcola `lang = p.lingua || 'it'` e `t = emailT(lang)`.
2. Costruisce il `bodyHtml` come una serie di `<tr><td>` che replicano il corpo del mockup `docs/email-mockup.html` (sezioni: titolo `t.confTitolo`, saluto `t.saluto(p.cliente_nome)`, intro `t.confIntro`, riquadro codice `t.lCodice` + `id` primi 8 char, tabella riepilogo con le coppie `t.lTipo`/`tipoLabel(p.tipo_noleggio, lang)`, `t.lRitiro`/`formatDate(p.data_ritiro, lang)` + orario, `t.lRestituzione`/`formatDate(p.data_restituzione, lang)` + orario, `t.lBici`/`biciLabel(p.bicicletta_id)`, `t.lAccessori`/accessori se presenti, `t.lTotale`/prezzo; CTA firma con `t.firmaTitolo`/`t.firmaTesto`/`t.firmaBottone` che linka `buildFirmaUrl(p)`; blocco due colonne `t.dove`/indirizzo e `t.cosaPortare`/`t.documento`+`t.codicePort`).
3. Ritorna `buildEmailShell({ lang, heroAlt: t.footerUnesco, bodyHtml })`.

Usa esattamente gli stessi stili inline del mockup (colori, padding, font). Tutti i valori provenienti da `p` passano per `esc()`. Gli orari usano `(p.orario_ritiro || '').substring(0,5)`.

- [ ] **Step 2: Aggiornare `sendConfirmationToCliente`**

Sostituire la funzione con:

```javascript
async function sendConfirmationToCliente(prenotazione) {
  const t = emailT(prenotazione.lingua || 'it');
  await transporter.sendMail({
    from:    process.env.EMAIL_FROM,
    to:      prenotazione.cliente_email,
    subject: `${t.confSubject} — ${formatDate(prenotazione.data_ritiro, prenotazione.lingua || 'it')} | Arfanta Bike Rental`,
    html:    buildClienteHtml(prenotazione),
  });
}
```

- [ ] **Step 3: Verificare con un mockup**

Crea un file temporaneo che importa `buildClienteHtml` e scrive l'output per ogni lingua, poi ispeziona a vista:

```bash
cd "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo"
node -c backend/lib/email.js
```

Expected: nessun errore di sintassi. (La verifica visiva completa avviene nel Task 8.)

- [ ] **Step 4: Commit**

```bash
cd "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo"
git add backend/lib/email.js
git commit -m "feat(email): conferma prenotazione ridisegnata e multilingua"
```

---

## Task 5: Email "messaggio" — nuovo `sendAdminEmail` con shell

**Files:**
- Modify: `backend/lib/email.js` — sostituire `sendAdminEmail` (righe ~230-259)

**Contesto:** `sendAdminEmail(prenotazione, subject, messageText)` è il trasporto delle 6 email "messaggio" (firma, promemoria, cancellazione, rimborso, cauzione, checkout). Mantiene la firma identica per non toccare i 6 chiamanti. Cambia solo l'HTML: usa `buildEmailShell`. Il `messageText` (testo con `\n`) diventa paragrafi; un eventuale URL `http(s)://...` nel testo viene estratto e reso come bottone arancione.

- [ ] **Step 1: Sostituire `sendAdminEmail`**

```javascript
async function sendAdminEmail(prenotazione, subject, messageText) {
  const lang = prenotazione.lingua || 'it';
  const t = emailT(lang);

  // Estrae un eventuale URL dal testo: diventa un bottone, il resto paragrafi.
  const urlMatch = String(messageText).match(/https?:\/\/[^\s]+/);
  const ctaUrl = urlMatch ? urlMatch[0] : null;
  const testoSenzaUrl = ctaUrl
    ? String(messageText).replace(/→?\s*https?:\/\/[^\s]+/, '').trim()
    : String(messageText);

  const paragrafi = testoSenzaUrl.split('\n').filter(r => r.trim() !== '')
    .map(r => `<p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#5C5349;">${esc(r)}</p>`)
    .join('');

  const ctaHtml = ctaUrl ? `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:8px;">
      <tr><td style="background:#EA580C;">
        <a href="${esc(ctaUrl)}" style="display:inline-block;padding:14px 34px;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;">${esc(t.firmaBottone)}</a>
      </td></tr>
    </table>` : '';

  const bodyHtml = `
    <tr><td style="padding:38px 48px 40px;">
      <p style="margin:0 0 22px;font-size:16px;font-weight:600;color:#2B2520;">${esc(t.saluto(prenotazione.cliente_nome))}</p>
      ${paragrafi}
      ${ctaHtml}
    </td></tr>`;

  await transporter.sendMail({
    from:    process.env.EMAIL_FROM,
    to:      prenotazione.cliente_email,
    subject: subject,
    html:    buildEmailShell({ lang, heroAlt: t.footerUnesco, bodyHtml }),
  });
}
```

Nota: il bottone usa `t.firmaBottone` come etichetta. Per le email senza URL non appare alcun bottone, quindi l'etichetta non viene mai mostrata a sproposito. Per la sola email firma (che ha l'URL) "Firma il contratto" è l'etichetta corretta.

- [ ] **Step 2: Verificare sintassi**

Run: `cd "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo" && node -c backend/lib/email.js`
Expected: nessun output.

- [ ] **Step 3: Commit**

```bash
cd "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo"
git add backend/lib/email.js
git commit -m "feat(email): sendAdminEmail usa lo shell — 6 email messaggio ridisegnate"
```

---

## Task 6: Email notifica gestore ridisegnata

**Files:**
- Modify: `backend/lib/email.js` — sostituire `buildGestoreHtml` (righe ~186-206)

**Contesto:** Email interna per il gestore, resta solo in italiano. Usa lo shell per coerenza visiva, con un corpo asciutto: dati cliente + dati prenotazione.

- [ ] **Step 1: Sostituire `buildGestoreHtml`**

Nuova funzione che costruisce un `bodyHtml` con:
1. Titolo "Nuova prenotazione" in Barlow Semi Condensed.
2. Una tabella riepilogo (stesso stile etichetta/valore del mockup) con: Cliente `p.cliente_nome`, Email `p.cliente_email`, Telefono `p.cliente_telefono`, Codice `id` primi 8 char, Tipo `tipoLabel(p.tipo_noleggio, 'it')`, Ritiro `formatDate(p.data_ritiro,'it')` + orario, Restituzione `formatDate(p.data_restituzione,'it')` + orario, Bicicletta `biciLabel(p.bicicletta_id)`, Accessori (se presenti), Note `p.cliente_note` (se presenti), Totale prezzo.
3. Tutti i valori da `p` passano per `esc()`.
4. Ritorna `buildEmailShell({ lang: 'it', heroAlt: 'Arfanta Bike Rental', bodyHtml })`.

- [ ] **Step 2: Verificare sintassi**

Run: `cd "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo" && node -c backend/lib/email.js`
Expected: nessun output.

- [ ] **Step 3: Commit**

```bash
cd "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo"
git add backend/lib/email.js
git commit -m "feat(email): notifica gestore ridisegnata con lo shell"
```

---

## Task 7: Promemoria ritiro multilingua + fix cron

**Files:**
- Modify: `backend/lib/email.js` — `sendReminderEmail` (righe ~342-348)
- Modify: `backend/routes/cron.js` — query select del cron `/reminder`

**Contesto:** `sendReminderEmail` ha subject e messaggio italiani hardcoded. Va reso multilingua. E il cron `/reminder` non seleziona `lingua`, quindi va aggiunto al select.

- [ ] **Step 1: Sostituire `sendReminderEmail`**

```javascript
async function sendReminderEmail(prenotazione) {
  const lang = prenotazione.lingua || 'it';
  const t = emailT(lang);
  const codice = String(prenotazione.id).toUpperCase().substring(0, 8);
  const ora = (prenotazione.orario_ritiro || '').substring(0, 5);
  const message = `${t.remTesto}\n\n${t.lCodice}: ${codice}\n${t.lRitiro}: ${formatDate(prenotazione.data_ritiro, lang)} · ${ora}`;
  await sendAdminEmail(prenotazione, `${t.remSubject} | Arfanta Bike Rental`, message);
}
```

- [ ] **Step 2: Aggiungere `lingua` al select del cron `/reminder`**

In `backend/routes/cron.js`, nella route `/reminder`, trovare:

```javascript
    .select('id, cliente_nome, cliente_email, orario_ritiro, data_ritiro')
```

e sostituire con:

```javascript
    .select('id, cliente_nome, cliente_email, orario_ritiro, data_ritiro, lingua')
```

- [ ] **Step 3: Verificare sintassi**

Run: `cd "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo" && node -c backend/lib/email.js && node -c backend/routes/cron.js`
Expected: nessun output.

- [ ] **Step 4: Commit**

```bash
cd "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo"
git add backend/lib/email.js backend/routes/cron.js
git commit -m "feat(email): promemoria ritiro multilingua + lingua nel cron reminder"
```

---

## Task 8: Cleanup, verifica visiva e deploy

**Files:**
- Modify: `backend/lib/email.js` — rimuovere il helper `row` se non più usato

- [ ] **Step 1: Rimuovere codice morto**

Verificare se la funzione `row` (righe ~176-182) è ancora referenziata:

```bash
cd "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo"
grep -n "row(" backend/lib/email.js
```

Se `row` non è più chiamata da nessuna funzione (il nuovo `buildClienteHtml` e `buildGestoreHtml` non la usano), rimuoverla.

- [ ] **Step 2: Generare i mockup di verifica**

Creare uno script temporaneo `/tmp/email-preview.js` che importa `email.js` e per ogni tipo di email scrive l'HTML in `/tmp/`:

```javascript
process.env.FRONTEND_URL = 'https://bike-rental-tarzo-app.vercel.app';
const email = require('/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo/backend/lib/email.js');
const fs = require('fs');
const fake = {
  id: 'a1b2c3d4-0000-0000-0000-000000000000', cliente_nome: 'Mario Rossi',
  cliente_email: 't@t.it', cliente_telefono: '+39 333 1234567',
  tipo_noleggio: 'intera_giornata', giorni: 1,
  data_ritiro: '2026-05-23', orario_ritiro: '09:00:00',
  data_restituzione: '2026-05-23', orario_restituzione: '18:00:00',
  bicicletta_id: 1, accessori: 'casco,lucchetto', prezzo_totale: 48,
  firma_token: 'abc123',
};
for (const lang of ['it','en','de','es','fr']) {
  fs.writeFileSync(`/tmp/conferma-${lang}.html`, email._buildClienteHtmlForPreview({ ...fake, lingua: lang }));
}
```

Nota: per rendere `buildClienteHtml` testabile, aggiungere a fine `email.js`, nel `module.exports`, `_buildClienteHtmlForPreview: buildClienteHtml`. (In alternativa esporre le funzioni di build già necessarie.)

Run: `node /tmp/email-preview.js && open /tmp/conferma-it.html /tmp/conferma-de.html`
Expected: le email si aprono nel browser, design corretto, testi nella lingua giusta.

- [ ] **Step 3: Commit del cleanup**

```bash
cd "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo"
git add backend/lib/email.js
git commit -m "chore(email): rimuove helper row non più usato + export per preview"
```

- [ ] **Step 4: Deploy**

```bash
cd "/Users/giulio/Desktop/arfanta bike rental/bike-rental-tarzo"
~/.npm-global/bin/vercel --prod --yes
```

Expected: deploy `READY`. Verificare che la foto sia servita: `curl -s -o /dev/null -w "%{http_code}" https://bike-rental-tarzo-app.vercel.app/email-hero.jpg` → `200`.

- [ ] **Step 5: Test email reale (manuale)**

Dall'admin panel, usare "Invia email" su una prenotazione di test verso un indirizzo reale, e/o completare una prenotazione test con carta Stripe `4242 4242 4242 4242`. Controllare la resa su Gmail e su un client mobile.

---

## Self-Review

- [x] **Spec coverage:** ogni sezione dello spec ha una task:
  - Shell condiviso → Task 3
  - Sistema di design (palette, font) → Task 3 (shell) + Task 4 (corpo conferma)
  - Le 8 email → Task 4 (conferma), Task 5 (le 6 messaggio via sendAdminEmail), Task 6 (gestore)
  - Multilingua completo → Task 2 (dizionario) + Task 4 (conferma) + Task 7 (promemoria)
  - Fix cron reminder select lingua → Task 7
  - Foto header → Task 1
  - Vincoli tecnici email → rispettati in Task 3 (table layout, web font + fallback, HEX)
- [x] **Placeholder scan:** le traduzioni sono tutte esplicite nel Task 2. I template HTML di Task 4 e 6 fanno riferimento al mockup approvato `docs/email-mockup.html` (artefatto reale e completo nel repo), non a un placeholder.
- [x] **Type consistency:** `emailT(lang)` ritorna sempre un oggetto con le stesse chiavi (verificato: ogni lingua in `EMAIL_I18N` ha lo stesso set di chiavi). `buildEmailShell({ lang, heroAlt, bodyHtml })` ha la stessa firma in tutti i task. `tipoLabel(tipo, lang)` e `formatDate(dateStr, lang)` con la nuova firma a 2 argomenti sono usati coerentemente.

## Definition of Done

- Foto `email-hero.jpg` committata e servita in produzione
- Tutte le 8 email passano per `buildEmailShell` con header foto + logo
- Conferma prenotazione e promemoria ritiro multilingua (it/en/de/es/fr)
- Cron `/reminder` seleziona `lingua`
- Nessun riferimento al vecchio verde `#2D8659`, nessuna emoji-icona, nessun side-stripe border
- Deploy completato, mockup verificati a vista per almeno it e de
