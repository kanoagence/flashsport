// lib/mailer.js
const nodemailer = require('nodemailer');

let _transport = null;

function transport() {
  if (_transport) return _transport;
  _transport = nodemailer.createTransport({
    host:   process.env.SMTP_HOST || 'smtp.gmail.com',
    port:   parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  return _transport;
}

const FROM = () =>
  `"${process.env.EMAIL_FROM_NAME || 'Flashsport'}" <${process.env.SMTP_USER}>`;

const PACKS = {
  essentiel: '20 photos HD',
  premium:   '50 photos HD + vidéo highlights',
  integral:  'Photos illimitées + drone + montage vidéo',
  duo:       '2 équipages · pack partagé',
};

function pad(n) { return String(n).padStart(2, '0'); }
function fmtDate(d) {
  const dt = new Date(d);
  return `${pad(dt.getDate())}/${pad(dt.getMonth()+1)}/${dt.getFullYear()}`;
}

function buildHtml(order) {
  const isCard      = order.paymentMethod === 'card';
  const statusColor = isCard ? '#059669' : '#D97706';
  const statusText  = isCard ? 'Paiement confirmé' : 'En attente de paiement au stand';
  const packDesc    = PACKS[order.packId] || order.packId;

  function row(k, v) {
    return `<tr>
      <td style="padding:10px 16px;font-size:13px;color:#6B7280;border-bottom:1px solid #F3F4F6;width:45%;">${k}</td>
      <td style="padding:10px 16px;font-size:13px;color:#0F1117;border-bottom:1px solid #F3F4F6;">${v}</td>
    </tr>`;
  }

  function capFirst(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F7F8FA;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#0F1117;">
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center" style="padding:32px 16px 24px;">
<table width="100%" style="max-width:520px;" cellpadding="0" cellspacing="0">

  <!-- Header -->
  <tr>
    <td style="background:#0F1117;border-radius:10px 10px 0 0;padding:24px 28px;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td>
          <div style="display:inline-block;background:#2563EB;border-radius:7px;width:34px;height:34px;text-align:center;line-height:34px;font-size:13px;font-weight:700;color:#fff;vertical-align:middle;">FS</div>
          <span style="font-size:16px;font-weight:700;color:#fff;vertical-align:middle;margin-left:8px;">Flash<span style="color:#2563EB;">Sport</span></span>
        </td>
        <td align="right"><span style="font-size:11px;color:rgba(255,255,255,.4);">4L Trophy 2025</span></td>
      </tr></table>
    </td>
  </tr>

  <!-- Status -->
  <tr>
    <td style="background:${statusColor}18;border-left:3px solid ${statusColor};padding:10px 28px;">
      <span style="font-size:12px;font-weight:600;color:${statusColor};">${statusText}</span>
    </td>
  </tr>

  <!-- Body -->
  <tr>
    <td style="background:#ffffff;padding:28px 28px 20px;border:1px solid #E5E7EB;border-top:none;">
      <p style="font-size:16px;font-weight:600;margin:0 0 6px;">Bonjour ${order.customerName.split(' ')[0]},</p>
      <p style="font-size:14px;color:#6B7280;margin:0 0 24px;line-height:1.6;">
        ${isCard
          ? 'Votre commande est confirmée. Retrouvez votre bon de commande en pièce jointe.'
          : 'Votre réservation est bien enregistrée. Présentez cet e-mail au stand Flashsport pour régler en espèces.'}
      </p>

      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;margin-bottom:20px;">
        <tr style="background:#F9FAFB;">
          <td colspan="2" style="padding:10px 16px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.7px;color:#9CA3AF;border-bottom:1px solid #E5E7EB;">
            Récapitulatif commande
          </td>
        </tr>
        ${row('Équipage', `<strong style="color:#2563EB;">${order.equipageNumber}</strong>`)}
        ${row('Pack', `${capFirst(order.packId)} — ${packDesc}`)}
        ${row('Montant', `<strong>${order.amount} €</strong>`)}
        ${row('N° commande', `<span style="color:#9CA3AF;font-size:12px;">${order.orderNumber}</span>`)}
        ${row('Date', fmtDate(order.createdAt))}
      </table>

      <table width="100%" cellpadding="0" cellspacing="0" style="background:#EFF6FF;border:1px solid #DBEAFE;border-radius:8px;margin-bottom:24px;">
        <tr><td style="padding:14px 16px;">
          <p style="font-size:13px;font-weight:600;color:#1E40AF;margin:0 0 4px;">Autocollant prioritaire</p>
          <p style="font-size:13px;color:#1D4ED8;margin:0;line-height:1.5;">
            Récupérez votre autocollant au <strong>stand Flashsport — Zone départ</strong>.
          </p>
        </td></tr>
      </table>

      ${!isCard ? `
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;margin-bottom:24px;">
        <tr><td style="padding:14px 16px;">
          <p style="font-size:13px;font-weight:600;color:#92400E;margin:0 0 4px;">Paiement à effectuer</p>
          <p style="font-size:13px;color:#B45309;margin:0;line-height:1.5;">
            Montant à régler : <strong>${order.amount} €</strong> en espèces au stand Flashsport.
          </p>
        </td></tr>
      </table>` : ''}

      <p style="font-size:12px;color:#9CA3AF;margin:0;">Une question ? contact@flashsport.fr</p>
    </td>
  </tr>

  <!-- Footer -->
  <tr>
    <td style="background:#F9FAFB;border:1px solid #E5E7EB;border-top:none;border-radius:0 0 10px 10px;padding:14px 28px;text-align:center;">
      <p style="font-size:11px;color:#9CA3AF;margin:0;">Flashsport &mdash; 4L Trophy 2025 &mdash; Bon de commande officiel.</p>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

async function sendOrderConfirmation(order, pdfBuffer) {
  const html    = buildHtml(order);
  const subject = order.paymentMethod === 'card'
    ? `Commande confirmée — ${order.orderNumber}`
    : `Réservation enregistrée — ${order.orderNumber}`;

  const attachments = pdfBuffer
    ? [{ filename: `bon-commande-${order.orderNumber}.pdf`, content: pdfBuffer }]
    : [];

  await transport().sendMail({
    from: FROM(), to: order.customerEmail, subject, html, attachments,
  });

  if (process.env.ADMIN_EMAIL) {
    await transport().sendMail({
      from:    FROM(),
      to:      process.env.ADMIN_EMAIL,
      subject: `[COPIE] ${subject} — ${order.customerName} — ${order.equipageNumber}`,
      html,
      attachments,
    });
  }
}

module.exports = { sendOrderConfirmation };