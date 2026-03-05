// lib/mailer.js — Gmail transactional email
const nodemailer = require('nodemailer');

function getTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

function formatAmount(amount) {
  return `${parseFloat(amount).toFixed(2).replace('.', ',')} €`;
}

function paymentLabel(method) {
  if (method === 'card')  return 'Carte bancaire en ligne';
  if (method === 'tpe')   return 'Carte bancaire via TPE';
  if (method === 'cash')  return 'Espèces';
  return method;
}

function statusLabel(status) {
  return status === 'paid' ? '✅ Payé' : '⏳ En attente d\'encaissement';
}

function buildEmailHtml(order) {
  const albums = order.extraAlbums > 0
    ? `<tr><td style="padding:8px 0;color:#6B7280;border-bottom:1px solid #F3F4F6;">Albums supplémentaires</td><td style="padding:8px 0;font-weight:500;text-align:right;border-bottom:1px solid #F3F4F6;">${order.extraAlbums} album${order.extraAlbums > 1 ? 's' : ''}</td></tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Bon de commande Flashsport</title>
</head>
<body style="margin:0;padding:0;background:#F7F8FA;font-family:'Inter',Arial,sans-serif;">
<div style="max-width:520px;margin:40px auto;background:#fff;border-radius:12px;border:1px solid #E5E7EB;overflow:hidden;">

  <!-- Header -->
  <div style="background:#0F1117;padding:28px 32px;">
    <div style="display:inline-flex;align-items:center;gap:12px;">
      <div style="width:36px;height:36px;background:#fff;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;">
        <span style="font-size:18px;">⚡</span>
      </div>
      <div>
        <div style="color:#fff;font-size:17px;font-weight:700;letter-spacing:-.3px;">Flash<span style="color:#60A5FA;">Sport</span></div>
        <div style="color:#9CA3AF;font-size:12px;margin-top:2px;">Bon de commande</div>
      </div>
    </div>
  </div>

  <!-- Body -->
  <div style="padding:32px;">
    <h1 style="font-size:20px;font-weight:700;color:#0F1117;margin:0 0 8px;letter-spacing:-.3px;">
      ${order.paymentStatus === 'paid' ? 'Commande confirmée ✅' : 'Réservation enregistrée'}
    </h1>
    <p style="font-size:14px;color:#6B7280;margin:0 0 24px;line-height:1.6;">
      Bonjour <strong style="color:#374151;">${order.customerName}</strong>,<br>
      ${order.paymentStatus === 'paid'
        ? 'Votre paiement a bien été reçu. Voici le récapitulatif de votre commande.'
        : 'Votre réservation est enregistrée. Rendez-vous au stand Flashsport pour finaliser votre paiement.'}
    </p>

    <!-- Détails commande -->
    <div style="background:#F7F8FA;border:1px solid #E5E7EB;border-radius:8px;padding:20px;margin-bottom:24px;">
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr>
          <td style="padding:8px 0;color:#6B7280;border-bottom:1px solid #F3F4F6;">N° commande</td>
          <td style="padding:8px 0;font-weight:500;text-align:right;border-bottom:1px solid #F3F4F6;font-size:12px;color:#9CA3AF;">${order.orderNumber}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#6B7280;border-bottom:1px solid #F3F4F6;">Équipage</td>
          <td style="padding:8px 0;font-weight:600;color:#2563EB;text-align:right;border-bottom:1px solid #F3F4F6;">${order.equipageNumber}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#6B7280;border-bottom:1px solid #F3F4F6;">Pack</td>
          <td style="padding:8px 0;font-weight:500;text-align:right;border-bottom:1px solid #F3F4F6;">${order.packLabel || order.packId}</td>
        </tr>
        ${albums}
        <tr>
          <td style="padding:8px 0;color:#6B7280;border-bottom:1px solid #F3F4F6;">Mode de paiement</td>
          <td style="padding:8px 0;font-weight:500;text-align:right;border-bottom:1px solid #F3F4F6;">${paymentLabel(order.paymentMethod)}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#6B7280;border-bottom:1px solid #F3F4F6;">Statut</td>
          <td style="padding:8px 0;font-weight:500;text-align:right;border-bottom:1px solid #F3F4F6;">${statusLabel(order.paymentStatus)}</td>
        </tr>
        <tr>
          <td style="padding:12px 0 0;font-weight:700;font-size:15px;">Total TTC</td>
          <td style="padding:12px 0 0;font-weight:700;font-size:20px;color:#0F1117;text-align:right;">${formatAmount(order.amount)}</td>
        </tr>
      </table>
    </div>

    <!-- Instructions -->
    ${order.paymentStatus !== 'paid' ? `
    <div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;padding:16px;margin-bottom:24px;">
      <p style="font-size:13px;color:#92400E;margin:0;line-height:1.6;">
        ⚠️ <strong>Action requise</strong> — Rendez-vous au <strong>stand Flashsport · Zone départ</strong> pour régler votre commande
        ${order.paymentMethod === 'tpe' ? 'par carte sur le terminal' : 'en espèces'} et récupérer votre autocollant prioritaire.
      </p>
    </div>` : `
    <div style="background:#ECFDF5;border:1px solid #A7F3D0;border-radius:8px;padding:16px;margin-bottom:24px;">
      <p style="font-size:13px;color:#065F46;margin:0;line-height:1.6;">
        🎉 Votre autocollant prioritaire vous sera remis au <strong>stand Flashsport</strong>. Bonne course !
      </p>
    </div>`}

    <p style="font-size:12px;color:#9CA3AF;margin:0;line-height:1.6;">
      Conservez cet email comme preuve de commande.<br>
      Une question ? Contactez-nous directement au stand.
    </p>
  </div>

  <!-- Footer -->
  <div style="background:#F7F8FA;border-top:1px solid #E5E7EB;padding:16px 32px;text-align:center;">
    <p style="font-size:11px;color:#9CA3AF;margin:0;">
      ⚡ FlashSport — 4L Trophy 2025<br>
      Cet email a été envoyé automatiquement, merci de ne pas y répondre.
    </p>
  </div>

</div>
</body>
</html>`;
}

async function sendOrderConfirmation(order, pdfBuffer) {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.log('[mailer] Config Gmail manquante, skip');
    return;
  }

  const transporter = getTransporter();
  const subject = order.paymentStatus === 'paid'
    ? `✅ Commande confirmée — ${order.packLabel || order.packId} · Équipage ${order.equipageNumber}`
    : `📋 Réservation Flashsport — Équipage ${order.equipageNumber}`;

  const attachments = [];
  if (pdfBuffer) {
    attachments.push({
      filename:    `bon-commande-${order.orderNumber}.pdf`,
      content:     pdfBuffer,
      contentType: 'application/pdf',
    });
  }

  await transporter.sendMail({
    from:        `"FlashSport Photo" <${process.env.GMAIL_USER}>`,
    to:          order.customerEmail,
    bcc:         process.env.GMAIL_USER,
    subject,
    html:        buildEmailHtml(order),
    attachments,
  });

  console.log(`[mailer] Email envoyé à ${order.customerEmail} (bcc: ${process.env.GMAIL_USER})`);
}

module.exports = { sendOrderConfirmation };
