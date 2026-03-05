// lib/sheets.js — Google Sheets integration
const { google } = require('googleapis');

const SHEET_ID  = process.env.GOOGLE_SHEET_ID;
const SHEET_TAB = 'Commandes';

function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key:  (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

async function ensureHeaders(sheets) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range:         `${SHEET_TAB}!A1:N1`,
  });
  const row = res.data.values?.[0] || [];
  if (row.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId:     SHEET_ID,
      range:             `${SHEET_TAB}!A1`,
      valueInputOption:  'RAW',
      requestBody: {
        values: [[
          'N° Commande', 'Date', 'Nom', 'Email', 'Téléphone',
          'Équipage', 'Pack', 'Albums suppl.', 'Montant (€)',
          'Paiement', 'Statut', 'Vendeur', 'Stripe ID', 'Notes',
        ]],
      },
    });
  }
}

async function appendOrder(order) {
  if (!SHEET_ID || !process.env.GOOGLE_CLIENT_EMAIL) {
    console.log('[sheets] Config manquante, skip');
    return;
  }

  const auth    = getAuth();
  const sheets  = google.sheets({ version: 'v4', auth });

  await ensureHeaders(sheets);

  const date = new Date(order.createdAt).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });

  await sheets.spreadsheets.values.append({
    spreadsheetId:     SHEET_ID,
    range:             `${SHEET_TAB}!A:N`,
    valueInputOption:  'USER_ENTERED',
    insertDataOption:  'INSERT_ROWS',
    requestBody: {
      values: [[
        order.orderNumber,
        date,
        order.customerName,
        order.customerEmail,
        order.customerPhone  || '',
        order.equipageNumber,
        order.packLabel      || order.packId,
        order.extraAlbums    || 0,
        order.amount,
        order.paymentMethod  === 'card' ? 'Carte en ligne' : order.paymentMethod === 'tpe' ? 'CB TPE' : 'Espèces',
        order.paymentStatus  === 'paid' ? 'Payé' : 'En attente',
        order.vendorId       || '',
        order.stripePaymentId || '',
        '',
      ]],
    },
  });

  console.log(`[sheets] Commande ${order.orderNumber} ajoutée`);
}

async function markPaid(orderNumber) {
  if (!SHEET_ID || !process.env.GOOGLE_CLIENT_EMAIL) return;

  const auth   = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  // Cherche la ligne avec ce numéro de commande
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range:         `${SHEET_TAB}!A:A`,
  });

  const rows = res.data.values || [];
  const rowIndex = rows.findIndex(r => r[0] === orderNumber);
  if (rowIndex === -1) {
    console.log(`[sheets] Commande ${orderNumber} non trouvée`);
    return;
  }

  // Colonne K = statut (index 11, colonne 11 = K)
  const rowNum = rowIndex + 1;
  await sheets.spreadsheets.values.update({
    spreadsheetId:    SHEET_ID,
    range:            `${SHEET_TAB}!K${rowNum}`,
    valueInputOption: 'RAW',
    requestBody: { values: [['Payé']] },
  });

  console.log(`[sheets] Commande ${orderNumber} marquée Payé`);
}

module.exports = { appendOrder, markPaid };
