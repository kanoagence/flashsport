// server.js — Flashsport Order System
require('dotenv').config();

const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');
const path      = require('path');

const tokens = require('./lib/tokens');
const pdf    = require('./lib/pdf');
const mailer = require('./lib/mailer');
const sheets = require('./lib/sheets');

const app  = express();
const PORT = process.env.PORT || 3000;

const PACKS = {
  pack1: { label: 'Pack Photo 1', amount: 22900 },
  pack2: { label: 'Pack Photo 2', amount: 32900 },
  pack3: { label: 'Pack Photo 3', amount: 35900 },
};
const ALBUM_PRICE = 5000;

// ── Stockage commandes en mémoire ──
const pendingOrders = [];

// ── Middleware ──
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 200, validate: { xForwardedForHeader: false } }));
app.use(express.static(path.join(__dirname, 'public')));

// ── Admin auth ──
function adminAuth(req, res, next) {
  const key = req.headers['x-admin-key'] || req.query.key;
  if (key !== (process.env.ADMIN_KEY || process.env.ADMIN_PASSWORD)) {
    return res.status(401).json({ error: 'Non autorisé' });
  }
  next();
}

// ── ROUTE 1 — Générer un lien vendeur ──
app.post('/api/vendor/generate-link', adminAuth, (req, res) => {
  const vendorId = req.body.vendorId || 'stand';
  const { token, expiresInSeconds } = tokens.generate(vendorId);
  const link = `${process.env.BASE_URL || `http://localhost:${PORT}`}/index.html?t=${token}`;
  res.json({ link, token, expiresInSeconds });
});

// ── ROUTE 2 — Valider un token ──
app.get('/api/order/validate', (req, res) => {
  const t = req.query.t;
  if (!t) return res.status(400).json({ ok: false, reason: 'MISSING' });
  res.json(tokens.verify(t));
});

// ── ROUTE 3 — Commande stand (TPE ou espèces) ──
app.post('/api/order/cash', async (req, res) => {
  const {
    token, packId, extraAlbums = 0,
    customerName, customerEmail, customerPhone, equipageNumber,
    paymentMethod = 'cash', deliveryAddress = null,
  } = req.body;

  const v = tokens.verify(token);
  if (!v.ok) return res.status(400).json({ error: v.reason });
  const pack = PACKS[packId];
  if (!pack) return res.status(400).json({ error: 'Pack invalide' });

  tokens.consume(token);

  const totalAmount = pack.amount + (parseInt(extraAlbums) || 0) * ALBUM_PRICE;

  const order = {
    orderNumber:     `FS-${Date.now()}-${equipageNumber.replace(/\W/g,'')}`,
    createdAt:       new Date().toISOString(),
    customerName,
    customerEmail,
    customerPhone,
    equipageNumber,
    packId,
    packLabel:       pack.label,
    extraAlbums:     parseInt(extraAlbums) || 0,
    amount:          (totalAmount / 100).toFixed(2),
    paymentMethod,
    paymentStatus:   'pending',
    vendorId:        v.payload.vendorId,
    deliveryAddress,
  };

  pendingOrders.push(order);
  console.log(`[order] ${order.orderNumber} — ${order.packLabel} — ${order.amount}€ — ${paymentMethod}`);

  Promise.all([
    sheets.appendOrder(order).catch(e => console.error('[sheets]', e.message)),
    (async () => {
      try {
        const pdfBuf = await pdf.generate(order);
        await mailer.sendOrderConfirmation(order, pdfBuf);
      } catch (e) { console.error('[mail/pdf]', e.message); }
    })(),
  ]);

  res.json({ ok: true, order });
});

// ── ROUTE 4 — Liste toutes les commandes ──
app.get('/api/vendor/orders', adminAuth, (req, res) => {
  res.json({ orders: pendingOrders });
});

// ── ROUTE 5 — Confirmer encaissement ──
app.post('/api/vendor/confirm-cash', adminAuth, async (req, res) => {
  const { orderNumber } = req.body;
  if (!orderNumber) return res.status(400).json({ error: 'orderNumber requis' });
  const order = pendingOrders.find(o => o.orderNumber === orderNumber);
  if (order) {
    order.paymentStatus = 'paid';
    console.log(`[confirm] ${orderNumber} marqué encaissé`);
  }
  sheets.markPaid(orderNumber).catch(e => console.error('[sheets]', e.message));
  res.json({ ok: true });
});

// ── ROUTE 6 — Stats ──
app.get('/api/vendor/stats', adminAuth, (req, res) => {
  const paid = pendingOrders.filter(o => o.paymentStatus === 'paid');
  const ca   = paid.reduce((sum, o) => sum + parseFloat(o.amount), 0);
  res.json({ total: pendingOrders.length, paid: paid.length, ca: ca.toFixed(2) });
});

// ── Fallback ──
app.get('/order', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n⚡ Flashsport server → http://localhost:${PORT}`);
  console.log(`   Admin key: ${process.env.ADMIN_KEY || process.env.ADMIN_PASSWORD || '(non défini)'}\n`);
});

module.exports = app;
