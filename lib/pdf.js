// lib/pdf.js
const PDFDocument = require('pdfkit');

const PACKS = {
  essentiel: { label: 'Essentiel',  desc: '20 photos HD · livraison e-mail' },
  premium:   { label: 'Premium',    desc: '50 photos HD + vidéo highlights' },
  integral:  { label: 'Intégral',   desc: 'Photos illimitées + drone + montage vidéo' },
  duo:       { label: 'Duo',        desc: '2 équipages · pack partagé' },
};

const PAY_LABELS = {
  card: 'Carte bancaire / Apple Pay (Stripe)',
  cash: 'Espèces — à régler au stand',
};

function pad(n) { return String(n).padStart(2, '0'); }

function fmtDate(d) {
  const dt = new Date(d);
  return `${pad(dt.getDate())}/${pad(dt.getMonth()+1)}/${dt.getFullYear()} à ${pad(dt.getHours())}h${pad(dt.getMinutes())}`;
}

function generate(order) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0 });
    const buf = [];
    doc.on('data', c => buf.push(c));
    doc.on('end',  () => resolve(Buffer.concat(buf)));
    doc.on('error', reject);

    const W     = 595;
    const ink   = '#0F1117';
    const sub   = '#6B7280';
    const line  = '#E5E7EB';
    const blue  = '#2563EB';
    const amber = '#D97706';
    const green = '#059669';

    doc.rect(0, 0, W, 80).fill(ink);
    doc.roundedRect(40, 22, 36, 36, 7).fill(blue);
    doc.fontSize(18).font('Helvetica-Bold').fillColor('#fff').text('FS', 50, 30);
    doc.fontSize(18).font('Helvetica-Bold').fillColor('#fff').text('Flash', 88, 27, { continued: true });
    doc.fillColor(blue).text('Sport');
    doc.fontSize(9).font('Helvetica').fillColor('rgba(255,255,255,0.55)')
       .text('Pack photo souvenir · 4L Trophy 2025', 88, 50);
    doc.fontSize(8).fillColor('rgba(255,255,255,0.4)')
       .text('BON DE COMMANDE', 380, 24, { width: 175, align: 'right' });
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#fff')
       .text(order.orderNumber, 380, 36, { width: 175, align: 'right' });
    doc.fontSize(8).font('Helvetica').fillColor('rgba(255,255,255,0.4)')
       .text(fmtDate(order.createdAt), 380, 52, { width: 175, align: 'right' });

    const statusColor = order.paymentMethod === 'card' ? green : amber;
    const statusText  = order.paymentMethod === 'card'
      ? 'Paiement confirmé'
      : 'En attente de paiement espèces au stand';
    doc.rect(0, 80, W, 36).fill(statusColor + '15');
    doc.rect(0, 80, 3,  36).fill(statusColor);
    doc.fontSize(10).font('Helvetica-Bold').fillColor(statusColor).text(statusText, 18, 93);

    let y = 136;

    function sectionTitle(t) {
      doc.fontSize(8).font('Helvetica-Bold').fillColor(sub)
         .text(t.toUpperCase(), 40, y, { characterSpacing: 0.8 });
      y += 16;
      doc.moveTo(40, y).lineTo(W - 40, y).strokeColor(line).lineWidth(1).stroke();
      y += 14;
    }

    function row(key, val, valColor) {
      doc.fontSize(10).font('Helvetica').fillColor(sub).text(key, 40, y);
      doc.fontSize(10).font('Helvetica-Bold').fillColor(valColor || ink)
         .text(val, W / 2, y, { width: W / 2 - 40, align: 'right' });
      y += 26;
    }

    sectionTitle('Informations équipage');
    row('Nom / Prénom',  order.customerName);
    row('N° équipage',   order.equipageNumber, blue);
    row('E-mail',        order.customerEmail);
    row('Téléphone',     order.customerPhone || '—');
    y += 8;

    sectionTitle('Détail de la commande');
    const pack = PACKS[order.packId] || { label: order.packId, desc: '' };
    row('Pack',    pack.label);
    row('Contenu', pack.desc, sub);
    row('Vendeur', order.vendorId || 'Stand principal');
    y += 8;

    sectionTitle('Paiement');
    row('Mode',   PAY_LABELS[order.paymentMethod] || order.paymentMethod);
    row('Statut',
      order.paymentMethod === 'card' ? 'Confirmé' : 'À régler au stand',
      order.paymentMethod === 'card' ? green : amber
    );
    y += 12;

    doc.roundedRect(W - 200, y, 160, 52, 6).fill(ink);
    doc.fontSize(8).font('Helvetica').fillColor('rgba(255,255,255,0.5)')
       .text('TOTAL TTC', W - 196, y + 10, { width: 152, align: 'center' });
    doc.fontSize(26).font('Helvetica-Bold').fillColor('#fff')
       .text(`${order.amount} €`, W - 196, y + 22, { width: 152, align: 'center' });
    y += 70;

    doc.roundedRect(40, y, W - 80, 46, 6).fill(blue + '10');
    doc.rect(40, y, 3, 46).fill(blue);
    doc.fontSize(9).font('Helvetica-Bold').fillColor(blue)
       .text('Autocollant prioritaire', 54, y + 10);
    doc.fontSize(9).font('Helvetica').fillColor('#1E40AF')
       .text('À récupérer auprès de notre équipe au stand Flashsport — Zone départ.', 54, y + 24, { width: W - 120 });
    y += 66;

    doc.fontSize(7).font('Helvetica').fillColor(sub)
       .text('Flashsport — contact@flashsport.fr · Ce document fait office de bon de commande officiel.',
             40, y, { width: W - 80, align: 'center' });

    doc.end();
  });
}

module.exports = { generate };