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

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('it-IT', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

function tipoLabel(tipo) {
  const labels = {
    'mezza_mattina':    'Mezza Giornata Mattina (09:00–13:00)',
    'mezza_pomeriggio': 'Mezza Giornata Pomeriggio (14:00–18:00)',
    'intera_giornata':  'Giornata Intera (09:00–18:00)',
    'multi_giorno':     'Multi-Giorno',
    '4_ore':            'Noleggio 4 Ore',
    '3_piu_giorni':     'Noleggio Multi-Giorno',
  };
  return labels[tipo] || tipo;
}

function accLabel(key) {
  const labels = { casco: 'Casco (+€2)', lucchetto: 'Lucchetto (+€1)' };
  return labels[key] || key;
}

function parseAccessori(raw) {
  return (raw || '').split(',').filter(Boolean);
}

// URL pagina firma. Include il firma_token come query param (se presente):
// senza il token corretto la pagina/API rifiuta lettura e firma.
// encodeURIComponent protegge da URL injection su id/token.
function buildFirmaUrl(p) {
  const base = `${process.env.FRONTEND_URL}/firma/${encodeURIComponent(p.id)}`;
  return p.firma_token ? `${base}?token=${encodeURIComponent(p.firma_token)}` : base;
}

// ─── Template email conferma cliente ─────────────────────────────────────────

function buildClienteHtml(p) {
  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Conferma Prenotazione — Arfanta Bike Rental</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0"
             style="background:#fff;border-radius:12px;overflow:hidden;max-width:600px;">

        <!-- Header -->
        <tr>
          <td style="background:#2D8659;padding:32px 40px;text-align:center;">
            <div style="font-size:40px;">🚲</div>
            <h1 style="color:#fff;margin:8px 0 4px;font-size:24px;">Prenotazione Confermata!</h1>
            <p style="color:#b7e4c7;margin:0;font-size:14px;">Arfanta Bike Rental — Colline Prosecco UNESCO</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 40px;">
            <p style="font-size:16px;color:#333;margin:0 0 24px;">
              Ciao <strong>${esc(p.cliente_nome)}</strong>,<br>
              la tua prenotazione è confermata e il pagamento ricevuto. Ti aspettiamo!
            </p>

            <!-- Riepilogo prenotazione -->
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="background:#f0faf4;border-radius:8px;padding:20px;margin-bottom:24px;">
              <tr>
                <td style="padding:6px 0;">
                  <strong style="color:#2D8659;">📋 Codice Prenotazione</strong><br>
                  <span style="font-size:18px;font-weight:bold;letter-spacing:2px;color:#1a5c3a;">
                    ${p.id.toUpperCase().substring(0, 8)}
                  </span>
                </td>
              </tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              ${row('🚲 Tipo Noleggio',   tipoLabel(p.tipo_noleggio))}
              ${row('📅 Giorno Ritiro',   formatDate(p.data_ritiro))}
              ${row('🕗 Orario Ritiro',   esc((p.orario_ritiro || '').substring(0,5)))}
              ${row('📅 Giorno Restituzione', formatDate(p.data_restituzione))}
              ${row('🕔 Orario Restituzione', esc((p.orario_restituzione || '').substring(0,5)))}
              ${p.giorni > 1 ? row('📆 Numero Giorni', p.giorni + ' giorni') : ''}
              ${row('💶 Totale Pagato',   '€' + Number(p.prezzo_totale).toFixed(2))}
              ${row('🚲 Bicicletta',      esc(biciLabel(p.bicicletta_id)))}
              ${parseAccessori(p.accessori).length > 0 ? row('🎒 Accessori inclusi', parseAccessori(p.accessori).map(accLabel).join(', ')) : ''}
            </table>

            <!-- Firma contratto -->
            <div style="background:#e8f5e9;border:1.5px solid #2D8659;border-radius:10px;padding:18px 20px;margin-bottom:24px;text-align:center;">
              <strong style="color:#1a5c3a;font-size:15px;">✍️ Firma il contratto di noleggio</strong><br>
              <p style="color:#555;font-size:13px;margin:6px 0 14px;">Leggi e accetta le condizioni prima del ritiro. Bastano 30 secondi.</p>
              <a href="${buildFirmaUrl(p)}"
                 style="display:inline-block;background:#2D8659;color:#fff;text-decoration:none;padding:11px 28px;border-radius:8px;font-weight:700;font-size:14px;">
                → Firma ora
              </a>
            </div>

            <!-- Dove venire -->
            <div style="background:#fff8e1;border-left:4px solid #FF6B6B;padding:16px 20px;
                        border-radius:0 8px 8px 0;margin-bottom:24px;">
              <strong style="color:#c0392b;">📍 Dove veniamo</strong><br>
              <span style="color:#555;font-size:14px;">
                Via Pecol 22, Arfanta di Tarzo (TV)<br>
                ${process.env.BUSINESS_PHONE || ''}
              </span>
            </div>

            <!-- Cosa portare -->
            <div style="background:#e8f5e9;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
              <strong style="color:#2D8659;">✅ Cosa portare al ritiro</strong>
              <ul style="color:#555;font-size:14px;margin:8px 0 0;padding-left:20px;">
                <li>Documento di identità</li>
                <li>Questo codice prenotazione: <strong>${p.id.toUpperCase().substring(0, 8)}</strong></li>
                ${parseAccessori(p.accessori).includes('casco') ? '<li>Casco <span style="color:#2D8659;font-weight:600;">(prenotato +€2 ✓)</span></li>' : '<li>Casco <span style="color:#888;">(consigliato, non prenotato)</span></li>'}
                ${parseAccessori(p.accessori).includes('lucchetto') ? '<li>Lucchetto <span style="color:#2D8659;font-weight:600;">(prenotato +€1 ✓)</span></li>' : ''}
              </ul>
            </div>

            <p style="font-size:13px;color:#888;margin:0;">
              Per cancellazioni o modifiche contattaci via WhatsApp al
              <strong>${process.env.BUSINESS_PHONE || 'numero in bio'}</strong>
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f0faf4;padding:20px 40px;text-align:center;
                     color:#888;font-size:12px;">
            Arfanta Bike Rental · Via Pecol 22, Arfanta di Tarzo (TV)<br>
            Colline del Prosecco di Conegliano e Valdobbiadene — Patrimonio UNESCO
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
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
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f5f5f5;padding:20px;">
  <div style="background:#fff;border-radius:8px;padding:24px;max-width:500px;">
    <h2 style="color:#2D8659;margin:0 0 16px;">🚲 Nuova Prenotazione!</h2>
    <p><strong>Codice:</strong> ${esc(p.id.toUpperCase().substring(0, 8))}</p>
    <p><strong>Cliente:</strong> ${esc(p.cliente_nome)}</p>
    <p><strong>Email:</strong> ${esc(p.cliente_email)}</p>
    <p><strong>Telefono:</strong> ${esc(p.cliente_telefono)}</p>
    <hr style="border:none;border-top:1px solid #eee;margin:16px 0;">
    <p><strong>Tipo:</strong> ${tipoLabel(p.tipo_noleggio)}</p>
    <p><strong>Ritiro:</strong> ${formatDate(p.data_ritiro)} alle ${esc((p.orario_ritiro || '').substring(0,5))}</p>
    <p><strong>Restituzione:</strong> ${formatDate(p.data_restituzione)} alle ${esc((p.orario_restituzione || '').substring(0,5))}</p>
    <p><strong>Bicicletta:</strong> #${Number(p.bicicletta_id)}</p>
    <p><strong>Totale:</strong> €${Number(p.prezzo_totale).toFixed(2)} — <span style="color:#2D8659;font-weight:bold;">PAGATO ✓</span></p>
    ${parseAccessori(p.accessori).length > 0 ? `<p><strong>Accessori richiesti:</strong> ${parseAccessori(p.accessori).map(accLabel).join(', ')}</p>` : '<p><strong>Accessori:</strong> Nessuno</p>'}
    ${p.cliente_note ? `<p><strong>Note:</strong> ${esc(p.cliente_note)}</p>` : ''}
  </div>
</body></html>`;
}

// ─── Esportazioni ─────────────────────────────────────────────────────────────

async function sendConfirmationToCliente(prenotazione) {
  await transporter.sendMail({
    from:    process.env.EMAIL_FROM,
    to:      prenotazione.cliente_email,
    subject: `✅ Prenotazione confermata — ${formatDate(prenotazione.data_ritiro)} | Arfanta Bike Rental`,
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
  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f5f5f5;padding:20px;">
  <div style="background:#fff;border-radius:8px;padding:24px;max-width:560px;margin:0 auto;">
    <div style="background:#2D8659;color:#fff;padding:16px 20px;border-radius:8px 8px 0 0;margin:-24px -24px 20px;">
      <h2 style="margin:0;font-size:18px;">🚲 Arfanta Bike Rental</h2>
    </div>
    <p style="font-size:16px;color:#333;margin:0 0 16px;">
      Gentile <strong>${esc(prenotazione.cliente_nome)}</strong>,
    </p>
    <div style="background:#f8f8f8;border-radius:8px;padding:16px 20px;font-size:15px;color:#444;line-height:1.65;">
      ${esc(messageText).replace(/\n/g, '<br>')}
    </div>
    <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
    <p style="font-size:12px;color:#aaa;margin:0;">
      Arfanta Bike Rental · Via Pecol 22, Arfanta di Tarzo (TV)<br>
      Per risposta: <a href="mailto:arfantabikerental@gmail.com" style="color:#2D8659;">arfantabikerental@gmail.com</a>
      · WhatsApp: <a href="https://wa.me/393928614635" style="color:#2D8659;">+39 392 8614635</a>
    </p>
  </div>
</body></html>`;

  await transporter.sendMail({
    from:    process.env.EMAIL_FROM,
    to:      prenotazione.cliente_email,
    subject: subject,
    html:    html,
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
  const subject = `🚲 Il tuo noleggio è domani — Arfanta Bike Rental`;
  const message = `Ti ricordiamo che domani è il giorno del tuo noleggio!\n\n📋 Codice prenotazione: ${prenotazione.id.toUpperCase().substring(0, 8)}\n📅 Ritiro: ${formatDate(prenotazione.data_ritiro)} alle ${(prenotazione.orario_ritiro || '').substring(0, 5)}\n📍 Dove: Via Pecol 22, Arfanta di Tarzo (TV)\n\nRicorda di portare:\n• Documento di identità valido\n• Il codice prenotazione sopra\n\nPer qualsiasi necessità contattaci via WhatsApp al +39 392 8614635.\n\nTi aspettiamo!`;
  await sendAdminEmail(prenotazione, subject, message);
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
  sendNotificationToGestore,
  sendAdminEmail,
  sendFirmaLinkEmail,
  sendWhatsAppAlert,
  sendReminderEmail,
  sendCheckoutFarewellEmail,
  sendCancellationEmail,
  sendRefundEmail,
  sendDepositReleasedEmail,
};
