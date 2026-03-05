// lib/sheets.js
const { google } = require('googleapis');

const SCOPES   = ['https://www.googleapis.com/auth/spreadsheets'];
const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const TAB_NAME = 'Commandes';

let _sheets = null;

async function getSheetsClient() {
  if (_sheets) return _sheets;
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key:  (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    },
    scopes: SCOPES,
  });
  _sheets = google.sheets({ version: 'v4', auth });
  return _sheets;
}

async function ensureHeader(sheets) {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range:         `${TAB_NAME}!A1:L1`,
    });
    if (res.data.values && res.data.values.length) return;
  } catch (_) {}

  await sheets.spreadsheets.values.update({
    spreadsheetId:    SHEET_ID,
    range:            `${TAB_NAME}!A1:L1`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [[
        'N° commande', 'Date', 'Nom', 'Email', 'Téléphone',
        'Équipage', 'Pack', 'Montant (€)', 'Paiement', 'Statut',
        'Vendeur', 'Stripe ID',
      ]],
    },
  });
}

async function appendOrder(order) {
  if (!SHEET_ID) {
    console.warn('[sheets] GOOGLE_SHEET_ID non défini — ignoré.');
    return;
  }
  const sheets = await getSheetsClient();
  await ensureHeader(sheets);

  const pad = n => String(n).padStart(2, '0');
  const dt  = new Date(order.createdAt);
  const dateStr = `${pad(dt.getDate())}/${pad(dt.getMonth()+1)}/${dt.getFullYear()} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;

  await sheets.spreadsheets.values.append({
    spreadsheetId:    SHEET_ID,
    range:            `${TAB_NAME}!A:L`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: [[
        order.orderNumber,
        dateStr,
        order.customerName,
        order.customerEmail,
        order.customerPhone  || '',
        order.equipageNumber,
        order.packId,
        order.amount,
        order.paymentMethod === 'card' ? 'Carte / Apple Pay' : 'Espèces',
        order.paymentStatus === 'paid' ? 'Payé' : 'En attente',
        order.vendorId       || 'stand',
        order.stripePaymentId || '',
      ]],
    },
  });
}

async function markPaid(orderNumber) {
  if (!SHEET_ID) return;
  const sheets = await getSheetsClient();

  const res  = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range:         `${TAB_NAME}!A:A`,
  });
  const rows = res.data.values || [];
  const idx  = rows.findIndex(r => r[0] === orderNumber);
  if (idx < 1) return;

  await sheets.spreadsheets.values.update({
    spreadsheetId:    SHEET_ID,
    range:            `${TAB_NAME}!I${idx + 1}:J${idx + 1}`,
    valueInputOption: 'RAW',
    requestBody: { values: [['Espèces', 'Payé']] },
  });
}

module.exports = { appendOrder, markPaid };