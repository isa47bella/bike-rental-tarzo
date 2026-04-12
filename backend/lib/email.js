const nodemailer = require('nodemailer');

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

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('it-IT', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

function tipoLabel(tipo) {
  const labels = {
    '4_ore':           'Noleggio 4 Ore',
    'intera_giornata': 'Noleggio Intera Giornata',
    '3_piu_giorni':    'Noleggio Multi-Giorno',
  };
  return labels[tipo] || tipo;
}

// ─── Template email conferma cliente ─────────────────────────────────────────

function buildClienteHtml(p) {
  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Conferma Prenotazione — Bike Rental Tarzo</title>
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
            <p style="color:#b7e4c7;margin:0;font-size:14px;">Bike Rental Tarzo — Colline Prosecco UNESCO</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 40px;">
            <p style="font-size:16px;color:#333;margin:0 0 24px;">
              Ciao <strong>${p.cliente_nome}</strong>,<br>
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
              ${row('🕗 Orario Ritiro',   p.orario_ritiro.substring(0,5))}
              ${row('📅 Giorno Restituzione', formatDate(p.data_restituzione))}
              ${row('🕔 Orario Restituzione', p.orario_restituzione.substring(0,5))}
              ${p.giorni > 1 ? row('📆 Numero Giorni', p.giorni + ' giorni') : ''}
              ${row('💶 Totale Pagato',   '€' + Number(p.prezzo_totale).toFixed(2))}
              ${row('🚲 Bicicletta',      'Bicicletta ' + p.bicicletta_id + ' (Papin Sport)')}
            </table>

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
                <li>Casco (consigliato, non incluso)</li>
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
            Bike Rental Tarzo · Via Pecol 22, Arfanta di Tarzo (TV)<br>
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
    <p><strong>Codice:</strong> ${p.id.toUpperCase().substring(0, 8)}</p>
    <p><strong>Cliente:</strong> ${p.cliente_nome}</p>
    <p><strong>Email:</strong> ${p.cliente_email}</p>
    <p><strong>Telefono:</strong> ${p.cliente_telefono}</p>
    <hr style="border:none;border-top:1px solid #eee;margin:16px 0;">
    <p><strong>Tipo:</strong> ${tipoLabel(p.tipo_noleggio)}</p>
    <p><strong>Ritiro:</strong> ${formatDate(p.data_ritiro)} alle ${p.orario_ritiro.substring(0,5)}</p>
    <p><strong>Restituzione:</strong> ${formatDate(p.data_restituzione)} alle ${p.orario_restituzione.substring(0,5)}</p>
    <p><strong>Bicicletta:</strong> #${p.bicicletta_id}</p>
    <p><strong>Totale:</strong> €${Number(p.prezzo_totale).toFixed(2)} — <span style="color:#2D8659;font-weight:bold;">PAGATO ✓</span></p>
    ${p.cliente_note ? `<p><strong>Note:</strong> ${p.cliente_note}</p>` : ''}
  </div>
</body></html>`;
}

// ─── Esportazioni ─────────────────────────────────────────────────────────────

async function sendConfirmationToCliente(prenotazione) {
  await transporter.sendMail({
    from:    process.env.EMAIL_FROM,
    to:      prenotazione.cliente_email,
    subject: `✅ Prenotazione confermata — ${formatDate(prenotazione.data_ritiro)} | Bike Rental Tarzo`,
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

module.exports = { sendConfirmationToCliente, sendNotificationToGestore };
