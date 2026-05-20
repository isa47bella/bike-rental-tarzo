const nodemailer = require('nodemailer');
const https      = require('https');

const transporter = nodemailer.createTransport({
  host:   process.env.EMAIL_HOST,
  port:   parseInt(process.env.EMAIL_PORT || '587'),
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

const BICI_NOMI = {
  1: 'E-City KTM #1',  2: 'E-City KTM #2',
  3: 'E-MTB KTM #1',   4: 'E-MTB KTM #2',   5: 'E-MTB KTM #3',
  6: 'E-MTB KTM #4',   7: 'E-MTB KTM #5',   8: 'E-MTB KTM #6',
  9: 'E-MTB KTM #7',  10: 'E-MTB Bimbo',
};
function biciLabel(id) { return BICI_NOMI[Number(id)] || `Bici #${id}`; }

const LOCALE_MAP = { it: 'it-IT', en: 'en-GB', de: 'de-DE', es: 'es-ES', fr: 'fr-FR' };

function formatDate(dateStr, lang = 'it') {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(LOCALE_MAP[lang] || 'it-IT', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

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

function accLabel(key) {
  const labels = { casco: 'Casco (+€2)', lucchetto: 'Lucchetto (+€1)' };
  return labels[key] || key;
}

function parseAccessori(raw) {
  return (raw || '').split(',').filter(Boolean);
}

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
    remTesto:       "Petit rappel : demain, c'est le jour de votre location. Nous vous attendons au Via Pecol 22, Arfanta di Tarzo (TV), Italie. Pensez à apporter une pièce d'identité valide et votre code de réservation.",
  },
};

function emailT(lang) { return EMAIL_I18N[lang] || EMAIL_I18N.it; }

// URL pagina firma. Include il firma_token come query param (se presente):
// senza il token corretto la pagina/API rifiuta lettura e firma.
// encodeURIComponent protegge da URL injection su id/token.
function buildFirmaUrl(p) {
  const base = `${process.env.FRONTEND_URL}/firma/${encodeURIComponent(p.id)}`;
  return p.firma_token ? `${base}?token=${encodeURIComponent(p.firma_token)}` : base;
}

// ─── Template email conferma cliente ─────────────────────────────────────────

// ─── Shell email condiviso ───────────────────────────────────────────────────
// Header (foto Colline del Prosecco + logo) e footer identici per ogni email.
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

// Etichette accessori multilingua per l'email di conferma.
const ACC_LABELS = {
  it: { casco: 'Casco', lucchetto: 'Lucchetto' },
  en: { casco: 'Helmet', lucchetto: 'Lock' },
  de: { casco: 'Helm', lucchetto: 'Schloss' },
  es: { casco: 'Casco', lucchetto: 'Candado' },
  fr: { casco: 'Casque', lucchetto: 'Antivol' },
};

function buildClienteHtml(p) {
  const lang = p.lingua || 'it';
  const t = emailT(lang);

  const accSet = ACC_LABELS[lang] || ACC_LABELS.it;
  const accessoriList = parseAccessori(p.accessori);
  const accessoriStr = accessoriList.map(a => accSet[a] || a).join(', ');

  const codice = String(p.id).toUpperCase().substring(0, 8);
  const oraRitiro = (p.orario_ritiro || '').substring(0, 5);
  const oraRestit = (p.orario_restituzione || '').substring(0, 5);

  // Riga etichetta/valore della tabella riepilogo (stile mockup).
  const summaryRow = (label, value) => `
              <tr>
                <td style="padding:13px 0;border-bottom:1px solid #EFE8DA;font-family:'Barlow',Arial,sans-serif;font-size:11px;font-weight:600;letter-spacing:0.13em;color:#9A8F80;text-transform:uppercase;">${label}</td>
                <td style="padding:13px 0;border-bottom:1px solid #EFE8DA;text-align:right;font-size:15px;font-weight:600;color:#2B2520;">${value}</td>
              </tr>`;

  const bodyHtml = `
        <!-- ── Corpo ── -->
        <tr>
          <td style="padding:38px 48px 8px;">

            <h1 style="margin:0 0 6px;font-family:'Barlow Semi Condensed','Barlow',Arial,sans-serif;font-size:34px;line-height:1.1;font-weight:700;color:#2B2520;letter-spacing:-0.01em;">
              ${t.confTitolo}
            </h1>
            <p style="margin:0 0 30px;font-size:15px;line-height:1.6;color:#7C7268;">
              ${t.saluto(`<strong style="color:#2B2520;font-weight:600;">${esc(p.cliente_nome)}</strong>`)} ${t.confIntro}
            </p>

            <!-- Codice prenotazione -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 32px;">
              <tr>
                <td style="border:1px solid #F0D9C6;background:#FDF6EF;padding:18px 24px;">
                  <div style="font-family:'Barlow',Arial,sans-serif;font-size:10px;font-weight:600;letter-spacing:0.2em;color:#A88B6E;text-transform:uppercase;">
                    ${t.lCodice}
                  </div>
                  <div style="font-family:'Barlow Semi Condensed','Barlow',Arial,sans-serif;font-size:30px;font-weight:700;letter-spacing:0.14em;color:#EA580C;margin-top:3px;">
                    ${esc(codice)}
                  </div>
                </td>
              </tr>
            </table>

            <!-- Riepilogo: coppie etichetta/valore -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px;">
              ${summaryRow(t.lTipo, esc(tipoLabel(p.tipo_noleggio, lang)))}
              ${summaryRow(t.lRitiro, esc(formatDate(p.data_ritiro, lang)) + ' &nbsp;·&nbsp; ' + esc(oraRitiro))}
              ${summaryRow(t.lRestituzione, esc(formatDate(p.data_restituzione, lang)) + ' &nbsp;·&nbsp; ' + esc(oraRestit))}
              ${summaryRow(t.lBici, esc(biciLabel(p.bicicletta_id)))}
              ${accessoriList.length > 0 ? summaryRow(t.lAccessori, esc(accessoriStr)) : ''}
              <tr>
                <td style="padding:15px 0 0;font-family:'Barlow Semi Condensed','Barlow',Arial,sans-serif;font-size:15px;font-weight:700;letter-spacing:0.03em;color:#2B2520;text-transform:uppercase;">${t.lTotale}</td>
                <td style="padding:15px 0 0;text-align:right;font-family:'Barlow Semi Condensed','Barlow',Arial,sans-serif;font-size:24px;font-weight:700;color:#2B2520;">€&thinsp;${Number(p.prezzo_totale).toFixed(2)}</td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- ── CTA firma ── -->
        <tr>
          <td style="padding:30px 48px 36px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #EFE8DA;">
              <tr><td style="padding-top:30px;">
                <h2 style="margin:0 0 4px;font-family:'Barlow Semi Condensed','Barlow',Arial,sans-serif;font-size:20px;font-weight:700;color:#2B2520;">
                  ${t.firmaTitolo}
                </h2>
                <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#7C7268;">
                  ${t.firmaTesto}
                </p>
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr><td style="background:#EA580C;">
                    <a href="${buildFirmaUrl(p)}" style="display:inline-block;padding:15px 38px;font-family:'Barlow',Arial,sans-serif;font-size:15px;font-weight:600;letter-spacing:0.02em;color:#FFFFFF;text-decoration:none;">
                      ${t.firmaBottone}
                    </a>
                  </td></tr>
                </table>
              </td></tr>
            </table>
          </td>
        </tr>

        <!-- ── Info pratiche ── -->
        <tr>
          <td style="padding:0 48px 40px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAF5EC;border:1px solid #EFE8DA;">
              <tr>
                <td style="padding:22px 26px;width:50%;vertical-align:top;border-right:1px solid #EFE8DA;">
                  <div style="font-family:'Barlow',Arial,sans-serif;font-size:10px;font-weight:600;letter-spacing:0.16em;color:#A88B6E;text-transform:uppercase;margin-bottom:8px;">${t.dove}</div>
                  <div style="font-size:14px;line-height:1.6;color:#2B2520;font-weight:600;">Via Pecol 22</div>
                  <div style="font-size:14px;line-height:1.6;color:#7C7268;">Arfanta di Tarzo (TV)</div>
                </td>
                <td style="padding:22px 26px;width:50%;vertical-align:top;">
                  <div style="font-family:'Barlow',Arial,sans-serif;font-size:10px;font-weight:600;letter-spacing:0.16em;color:#A88B6E;text-transform:uppercase;margin-bottom:8px;">${t.cosaPortare}</div>
                  <div style="font-size:14px;line-height:1.7;color:#2B2520;">${t.documento}</div>
                  <div style="font-size:14px;line-height:1.7;color:#2B2520;">${t.codicePort}</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>`;

  return buildEmailShell({ lang, heroAlt: t.footerUnesco, bodyHtml });
}

function row(label, value) {
  if (!value) return '';
  return `<tr>
    <td style="padding:8px 0;border-bottom:1px solid #eee;color:#666;font-size:14px;width:50%;">${label}</td>
    <td style="padding:8px 0;border-bottom:1px solid #eee;color:#333;font-size:14px;font-weight:600;">${value}</td>
  </tr>`;
}

// ─── Template email notifica gestore ─────────────────────────────────────────

function buildGestoreHtml(p) {
  const codice = String(p.id).toUpperCase().substring(0, 8);
  const oraRitiro = (p.orario_ritiro || '').substring(0, 5);
  const oraRestit = (p.orario_restituzione || '').substring(0, 5);
  const accessoriStr = parseAccessori(p.accessori).join(', ');
  const noteCliente = (p.cliente_note || '').trim();

  // Riga etichetta/valore della tabella riepilogo (stesso stile di buildClienteHtml).
  const summaryRow = (label, value) => `
              <tr>
                <td style="padding:13px 0;border-bottom:1px solid #EFE8DA;font-family:'Barlow',Arial,sans-serif;font-size:11px;font-weight:600;letter-spacing:0.13em;color:#9A8F80;text-transform:uppercase;">${label}</td>
                <td style="padding:13px 0;border-bottom:1px solid #EFE8DA;text-align:right;font-size:15px;font-weight:600;color:#2B2520;">${value}</td>
              </tr>`;

  const bodyHtml = `
        <!-- ── Corpo ── -->
        <tr>
          <td style="padding:38px 48px 40px;">

            <h1 style="margin:0 0 6px;font-family:'Barlow Semi Condensed','Barlow',Arial,sans-serif;font-size:28px;line-height:1.1;font-weight:700;color:#2B2520;letter-spacing:-0.01em;">
              Nuova prenotazione
            </h1>
            <p style="margin:0 0 28px;font-size:15px;line-height:1.6;color:#7C7268;">
              <strong style="color:#2B2520;font-weight:600;">${esc(p.cliente_nome)}</strong>
            </p>

            <!-- Riepilogo: coppie etichetta/valore -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px;">
              ${summaryRow('Email', esc(p.cliente_email))}
              ${summaryRow('Telefono', esc(p.cliente_telefono))}
              ${summaryRow('Codice', esc(codice))}
              ${summaryRow('Tipo noleggio', esc(tipoLabel(p.tipo_noleggio, 'it')))}
              ${summaryRow('Ritiro', esc(formatDate(p.data_ritiro, 'it')) + ' &nbsp;·&nbsp; ' + esc(oraRitiro))}
              ${summaryRow('Restituzione', esc(formatDate(p.data_restituzione, 'it')) + ' &nbsp;·&nbsp; ' + esc(oraRestit))}
              ${summaryRow('Bicicletta', esc(biciLabel(p.bicicletta_id)))}
              ${accessoriStr ? summaryRow('Accessori', esc(accessoriStr)) : ''}
              ${noteCliente ? summaryRow('Note cliente', esc(noteCliente)) : ''}
              <tr>
                <td style="padding:15px 0 0;font-family:'Barlow Semi Condensed','Barlow',Arial,sans-serif;font-size:15px;font-weight:700;letter-spacing:0.03em;color:#2B2520;text-transform:uppercase;">Totale</td>
                <td style="padding:15px 0 0;text-align:right;font-family:'Barlow Semi Condensed','Barlow',Arial,sans-serif;font-size:24px;font-weight:700;color:#2B2520;">€&thinsp;${Number(p.prezzo_totale).toFixed(2)}</td>
              </tr>
            </table>

          </td>
        </tr>`;

  return buildEmailShell({ lang: 'it', heroAlt: 'Arfanta Bike Rental — Colline del Prosecco', bodyHtml });
}

// ─── Esportazioni ─────────────────────────────────────────────────────────────

async function sendConfirmationToCliente(prenotazione) {
  const t = emailT(prenotazione.lingua || 'it');
  await transporter.sendMail({
    from:    process.env.EMAIL_FROM,
    to:      prenotazione.cliente_email,
    subject: `${t.confSubject} — ${formatDate(prenotazione.data_ritiro, prenotazione.lingua || 'it')} | Arfanta Bike Rental`,
    html:    buildClienteHtml(prenotazione),
  });
}

async function sendNotificationToGestore(prenotazione) {
  await transporter.sendMail({
    from:    process.env.EMAIL_FROM,
    to:      process.env.OWNER_EMAIL,
    subject: `🚲 Nuova prenotazione — ${prenotazione.cliente_nome} — ${formatDate(prenotazione.data_ritiro)}`,
    html:    buildGestoreHtml(prenotazione),
  });
}

// ─── Email manuale dall'admin panel ──────────────────────────────────────────

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

  const text = [
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
  ].filter(Boolean).join('\n');

  const params = new URLSearchParams({ phone, text, apikey });
  const url = `https://api.callmebot.com/whatsapp.php?${params.toString()}`;

  await new Promise(resolve => {
    https.get(url, res => {
      res.on('data', () => {});
      res.on('end', resolve);
    }).on('error', () => resolve()); // silenzioso in caso di errore
  });
}

// ─── Email link firma (inviata dall'admin panel) ──────────────────────────────

async function sendFirmaLinkEmail(prenotazione) {
  const firmaUrl = buildFirmaUrl(prenotazione);
  const lang = prenotazione.lingua || 'it';

  const subjects = {
    it: `✍️ Firma il contratto di noleggio — Arfanta Bike Rental`,
    en: `✍️ Please sign your rental agreement — Arfanta Bike Rental`,
    de: `✍️ Mietvertrag unterzeichnen — Arfanta Bike Rental`,
    es: `✍️ Firma tu contrato de alquiler — Arfanta Bike Rental`,
    fr: `✍️ Signez votre contrat de location — Arfanta Bike Rental`,
  };
  const messages = {
    it: `Ti chiediamo di firmare il contratto di noleggio prima del ritiro della bicicletta.\n\nÈ sufficiente aprire il link, leggere i termini e condizioni e apporre la firma digitale. Bastano meno di 2 minuti.\n\n→ ${firmaUrl}\n\nGrazie per la collaborazione.\nTi aspettiamo in Via Pecol 22, Arfanta di Tarzo (TV).`,
    en: `Please sign your rental agreement before picking up the bicycle.\n\nSimply open the link, read the terms and conditions, and add your digital signature. It takes less than 2 minutes.\n\n→ ${firmaUrl}\n\nThank you. We look forward to seeing you at Via Pecol 22, Arfanta di Tarzo (TV), Italy.`,
    de: `Bitte unterzeichnen Sie den Mietvertrag vor der Abholung des Fahrrads.\n\nÖffnen Sie einfach den Link, lesen Sie die Allgemeinen Geschäftsbedingungen und fügen Sie Ihre digitale Unterschrift hinzu. Es dauert weniger als 2 Minuten.\n\n→ ${firmaUrl}\n\nVielen Dank. Wir freuen uns auf Ihren Besuch in Via Pecol 22, Arfanta di Tarzo (TV), Italien.`,
    es: `Le pedimos que firme el contrato de alquiler antes de recoger la bicicleta.\n\nSimplemente abra el enlace, lea los términos y condiciones y añada su firma digital. Tarda menos de 2 minutos.\n\n→ ${firmaUrl}\n\nGracias. Le esperamos en Via Pecol 22, Arfanta di Tarzo (TV), Italia.`,
    fr: `Nous vous demandons de signer le contrat de location avant de récupérer le vélo.\n\nOuvrez simplement le lien, lisez les conditions générales et apposez votre signature numérique. Cela prend moins de 2 minutes.\n\n→ ${firmaUrl}\n\nMerci. Nous vous attendons au Via Pecol 22, Arfanta di Tarzo (TV), Italie.`,
  };

  await sendAdminEmail(
    prenotazione,
    subjects[lang] || subjects.it,
    messages[lang] || messages.it,
  );
}

// ─── Email promemoria ritiro (cron giorno prima) ──────────────────────────────

async function sendReminderEmail(prenotazione) {
  const lang = prenotazione.lingua || 'it';
  const t = emailT(lang);
  const codice = String(prenotazione.id).toUpperCase().substring(0, 8);
  const ora = (prenotazione.orario_ritiro || '').substring(0, 5);
  const message = `${t.remTesto}\n\n${t.lCodice}: ${codice}\n${t.lRitiro}: ${formatDate(prenotazione.data_ritiro, lang)} · ${ora}`;
  await sendAdminEmail(prenotazione, `${t.remSubject} | Arfanta Bike Rental`, message);
}

// ─── Email post check-out (ringraziamento, senza recensione) ─────────────────

async function sendCheckoutFarewellEmail(prenotazione) {
  const lang = prenotazione.lingua || 'it';

  const subjects = {
    it: `🚲 Grazie per il noleggio! — Arfanta Bike Rental`,
    en: `🚲 Thank you for renting with us! — Arfanta Bike Rental`,
    de: `🚲 Vielen Dank für die Anmietung! — Arfanta Bike Rental`,
    es: `🚲 ¡Gracias por alquilar con nosotros! — Arfanta Bike Rental`,
    fr: `🚲 Merci pour la location ! — Arfanta Bike Rental`,
  };
  const messages = {
    it: `Grazie per aver scelto Arfanta Bike Rental!\n\nSperiamo tu abbia trascorso una bella giornata pedalando tra le Colline del Prosecco UNESCO.\n\nQuando vorrai tornare a noleggiare le nostre e-bike ti aspettiamo a Via Pecol 22, Arfanta di Tarzo (TV).\n\nA presto!\nIl team Arfanta Bike Rental`,
    en: `Thank you for choosing Arfanta Bike Rental!\n\nWe hope you enjoyed a great day cycling through the UNESCO Prosecco Hills.\n\nWhenever you'd like to rent our e-bikes again, we'll be waiting at Via Pecol 22, Arfanta di Tarzo (TV), Italy.\n\nSee you soon!\nThe Arfanta Bike Rental team`,
    de: `Vielen Dank, dass Sie sich für Arfanta Bike Rental entschieden haben!\n\nWir hoffen, Sie hatten einen schönen Tag beim Radfahren durch die UNESCO-Prosecco-Hügel.\n\nWann immer Sie unsere E-Bikes wieder mieten möchten, erwarten wir Sie in Via Pecol 22, Arfanta di Tarzo (TV), Italien.\n\nBis bald!\nIhr Arfanta Bike Rental Team`,
    es: `¡Gracias por elegir Arfanta Bike Rental!\n\nEsperamos que hayas pasado un gran día pedaleando por las Colinas del Prosecco UNESCO.\n\nCuando quieras volver a alquilar nuestras e-bikes, te esperamos en Via Pecol 22, Arfanta di Tarzo (TV), Italia.\n\n¡Hasta pronto!\nEl equipo de Arfanta Bike Rental`,
    fr: `Merci d'avoir choisi Arfanta Bike Rental !\n\nNous espérons que vous avez passé une belle journée à pédaler dans les Collines du Prosecco UNESCO.\n\nQuand vous souhaiterez louer à nouveau nos e-bikes, nous vous attendrons au Via Pecol 22, Arfanta di Tarzo (TV), Italie.\n\nÀ bientôt !\nL'équipe Arfanta Bike Rental`,
  };

  await sendAdminEmail(
    prenotazione,
    subjects[lang] || subjects.it,
    messages[lang] || messages.it,
  );
}

// ─── Email conferma cancellazione prenotazione ──────────────────────────────

async function sendCancellationEmail(prenotazione, { cauzioneReleased = false } = {}) {
  const lang = prenotazione.lingua || 'it';
  const codice = String(prenotazione.id).toUpperCase().substring(0, 8);
  const dataIt = formatDate(prenotazione.data_ritiro);

  const subjects = {
    it: `❌ Prenotazione cancellata — Arfanta Bike Rental`,
    en: `❌ Booking cancelled — Arfanta Bike Rental`,
    de: `❌ Buchung storniert — Arfanta Bike Rental`,
    es: `❌ Reserva cancelada — Arfanta Bike Rental`,
    fr: `❌ Réservation annulée — Arfanta Bike Rental`,
  };

  const cauzioneNote = {
    it: cauzioneReleased ? `\n\nL'autorizzazione di cauzione sulla tua carta è stata rilasciata: non vedrai alcun addebito.` : '',
    en: cauzioneReleased ? `\n\nThe deposit authorization on your card has been released: you will see no charge.` : '',
    de: cauzioneReleased ? `\n\nDie Kautionsautorisierung auf Ihrer Karte wurde freigegeben: Sie werden keine Belastung sehen.` : '',
    es: cauzioneReleased ? `\n\nLa autorización de fianza en tu tarjeta ha sido liberada: no verás ningún cargo.` : '',
    fr: cauzioneReleased ? `\n\nL'autorisation de caution sur votre carte a été libérée : vous ne verrez aucun débit.` : '',
  };

  const messages = {
    it: `La tua prenotazione del ${dataIt} (codice ${codice}) è stata cancellata.${cauzioneNote.it}\n\nPer qualsiasi domanda scrivici via WhatsApp al +39 392 8614635 o rispondendo a questa email.\n\nGrazie,\nIl team Arfanta Bike Rental`,
    en: `Your booking for ${dataIt} (code ${codice}) has been cancelled.${cauzioneNote.en}\n\nFor any questions, write us on WhatsApp at +39 392 8614635 or reply to this email.\n\nThank you,\nThe Arfanta Bike Rental team`,
    de: `Ihre Buchung für den ${dataIt} (Code ${codice}) wurde storniert.${cauzioneNote.de}\n\nBei Fragen schreiben Sie uns per WhatsApp an +39 392 8614635 oder antworten Sie auf diese E-Mail.\n\nVielen Dank,\nIhr Arfanta Bike Rental Team`,
    es: `Tu reserva para el ${dataIt} (código ${codice}) ha sido cancelada.${cauzioneNote.es}\n\nPara cualquier pregunta, escríbenos por WhatsApp al +39 392 8614635 o responde a este correo.\n\nGracias,\nEl equipo de Arfanta Bike Rental`,
    fr: `Votre réservation du ${dataIt} (code ${codice}) a été annulée.${cauzioneNote.fr}\n\nPour toute question, écrivez-nous sur WhatsApp au +39 392 8614635 ou répondez à cet email.\n\nMerci,\nL'équipe Arfanta Bike Rental`,
  };

  await sendAdminEmail(
    prenotazione,
    subjects[lang] || subjects.it,
    messages[lang] || messages.it,
  );
}

// ─── Email conferma rimborso (parziale o totale) ─────────────────────────────

async function sendRefundEmail(prenotazione, { amount, isTotal = false } = {}) {
  const lang = prenotazione.lingua || 'it';
  const codice = String(prenotazione.id).toUpperCase().substring(0, 8);
  const dataIt = formatDate(prenotazione.data_ritiro);
  const importo = Number(amount).toFixed(2);

  const subjects = {
    it: isTotal ? `💶 Rimborso emesso e prenotazione cancellata — Arfanta Bike Rental` : `💶 Rimborso parziale emesso — Arfanta Bike Rental`,
    en: isTotal ? `💶 Refund issued and booking cancelled — Arfanta Bike Rental` : `💶 Partial refund issued — Arfanta Bike Rental`,
    de: isTotal ? `💶 Erstattung ausgestellt und Buchung storniert — Arfanta Bike Rental` : `💶 Teilerstattung ausgestellt — Arfanta Bike Rental`,
    es: isTotal ? `💶 Reembolso emitido y reserva cancelada — Arfanta Bike Rental` : `💶 Reembolso parcial emitido — Arfanta Bike Rental`,
    fr: isTotal ? `💶 Remboursement émis et réservation annulée — Arfanta Bike Rental` : `💶 Remboursement partiel émis — Arfanta Bike Rental`,
  };

  const totalNote = {
    it: isTotal ? `\n\nLa prenotazione del ${dataIt} è stata cancellata.` : '',
    en: isTotal ? `\n\nThe booking for ${dataIt} has been cancelled.` : '',
    de: isTotal ? `\n\nDie Buchung für den ${dataIt} wurde storniert.` : '',
    es: isTotal ? `\n\nLa reserva del ${dataIt} ha sido cancelada.` : '',
    fr: isTotal ? `\n\nLa réservation du ${dataIt} a été annulée.` : '',
  };

  const messages = {
    it: `Abbiamo emesso un rimborso di €${importo} per la prenotazione ${codice}.\n\nL'importo sarà accreditato sulla carta usata per il pagamento entro 5-10 giorni lavorativi (i tempi dipendono dalla tua banca).${totalNote.it}\n\nPer qualsiasi domanda scrivici via WhatsApp al +39 392 8614635 o rispondendo a questa email.\n\nGrazie,\nIl team Arfanta Bike Rental`,
    en: `We have issued a refund of €${importo} for booking ${codice}.\n\nThe amount will be credited to the card used for payment within 5-10 business days (timing depends on your bank).${totalNote.en}\n\nFor any questions, write us on WhatsApp at +39 392 8614635 or reply to this email.\n\nThank you,\nThe Arfanta Bike Rental team`,
    de: `Wir haben eine Rückerstattung von €${importo} für die Buchung ${codice} ausgestellt.\n\nDer Betrag wird innerhalb von 5-10 Werktagen auf die für die Zahlung verwendete Karte gutgeschrieben (Zeitpunkt hängt von Ihrer Bank ab).${totalNote.de}\n\nBei Fragen schreiben Sie uns per WhatsApp an +39 392 8614635 oder antworten Sie auf diese E-Mail.\n\nVielen Dank,\nIhr Arfanta Bike Rental Team`,
    es: `Hemos emitido un reembolso de €${importo} para la reserva ${codice}.\n\nEl importe se acreditará a la tarjeta utilizada para el pago en un plazo de 5-10 días laborables (los plazos dependen de tu banco).${totalNote.es}\n\nPara cualquier pregunta, escríbenos por WhatsApp al +39 392 8614635 o responde a este correo.\n\nGracias,\nEl equipo de Arfanta Bike Rental`,
    fr: `Nous avons émis un remboursement de €${importo} pour la réservation ${codice}.\n\nLe montant sera crédité sur la carte utilisée pour le paiement dans un délai de 5 à 10 jours ouvrables (les délais dépendent de votre banque).${totalNote.fr}\n\nPour toute question, écrivez-nous sur WhatsApp au +39 392 8614635 ou répondez à cet email.\n\nMerci,\nL'équipe Arfanta Bike Rental`,
  };

  await sendAdminEmail(
    prenotazione,
    subjects[lang] || subjects.it,
    messages[lang] || messages.it,
  );
}

// ─── Email conferma rilascio cauzione (nessun danno) ─────────────────────────

async function sendDepositReleasedEmail(prenotazione) {
  const lang = prenotazione.lingua || 'it';

  const subjects = {
    it: `✅ Cauzione rilasciata — Arfanta Bike Rental`,
    en: `✅ Deposit released — Arfanta Bike Rental`,
    de: `✅ Kaution freigegeben — Arfanta Bike Rental`,
    es: `✅ Fianza liberada — Arfanta Bike Rental`,
    fr: `✅ Caution libérée — Arfanta Bike Rental`,
  };

  const messages = {
    it: `L'autorizzazione di cauzione sulla tua carta è stata rilasciata: non c'è stato nessun addebito.\n\nLa bici è rientrata senza problemi — grazie!\n\nA presto,\nIl team Arfanta Bike Rental`,
    en: `The deposit authorization on your card has been released: no amount has been charged.\n\nThe bike was returned in good condition — thank you!\n\nSee you soon,\nThe Arfanta Bike Rental team`,
    de: `Die Kautionsautorisierung auf Ihrer Karte wurde freigegeben: es wurde kein Betrag abgebucht.\n\nDas Fahrrad wurde in gutem Zustand zurückgegeben — vielen Dank!\n\nBis bald,\nIhr Arfanta Bike Rental Team`,
    es: `La autorización de fianza en tu tarjeta ha sido liberada: no se ha cargado ningún importe.\n\nLa bici se devolvió en buenas condiciones — ¡gracias!\n\nHasta pronto,\nEl equipo de Arfanta Bike Rental`,
    fr: `L'autorisation de caution sur votre carte a été libérée : aucun montant n'a été débité.\n\nLe vélo a été rendu en bon état — merci !\n\nÀ bientôt,\nL'équipe Arfanta Bike Rental`,
  };

  await sendAdminEmail(
    prenotazione,
    subjects[lang] || subjects.it,
    messages[lang] || messages.it,
  );
}

module.exports = {
  sendConfirmationToCliente,
  _buildClienteHtml: buildClienteHtml,
  sendNotificationToGestore,
  _buildGestoreHtml: buildGestoreHtml,
  sendAdminEmail,
  sendFirmaLinkEmail,
  sendWhatsAppAlert,
  sendReminderEmail,
  sendCheckoutFarewellEmail,
  sendCancellationEmail,
  sendRefundEmail,
  sendDepositReleasedEmail,
};
