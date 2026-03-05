// server.js — Flashsport Order System
require('dotenv').config();

const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');
const path      = require('path');
const { v4: uuidv4 } = require('uuid');
const stripe    = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');

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
const ALBUM_PRICE = 5000; // 50€ en centimes

// ── Middleware ──
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));
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

// ── ROUTE 3 — Créer un Payment Intent Stripe ──
app.post('/api/order/payment-intent', async (req, res) => {
  const { token, packId, extraAlbums = 0, customerEmail, customerName, equipageNumber } = req.body;
  const v = tokens.verify(token);
  if (!v.ok) return res.status(400).json({ error: v.reason });
  const pack = PACKS[packId];
  if (!pack) return res.status(400).json({ error: 'Pack invalide' });

  const totalAmount = pack.amount + (parseInt(extraAlbums) || 0) * ALBUM_PRICE;

  try {
    const intent = await stripe.paymentIntents.create({
      amount:        totalAmount,
      currency:      'eur',
      metadata:      { token, packId, extraAlbums: String(extraAlbums), customerEmail, customerName, equipageNumber, vendorId: v.payload.vendorId },
      receipt_email: customerEmail,
    });
    res.json({ clientSecret: intent.client_secret });
  } catch (err) {
    console.error('[stripe]', err.message);
    res.status(500).json({ error: 'Erreur Stripe' });
  }
});

// ── ROUTE 4 — Commande stand (TPE ou espèces) ──
app.post('/api/order/cash', async (req, res) => {
  const { token, packId, extraAlbums = 0, customerName, customerEmail, customerPhone, equipageNumber, paymentMethod = 'cash' } = req.body;
  const v = tokens.verify(token);
  if (!v.ok) return res.status(400).json({ error: v.reason });
  const pack = PACKS[packId];
  if (!pack) return res.status(400).json({ error: 'Pack invalide' });

  tokens.consume(token);

  const totalAmount = pack.amount + (parseInt(extraAlbums) || 0) * ALBUM_PRICE;

  const order = {
    orderNumber:   `FS-${Date.now()}-${equipageNumber.replace(/\W/g,'')}`,
    createdAt:     new Date().toISOString(),
    customerName,
    customerEmail,
    customerPhone,
    equipageNumber,
    packId,
    extraAlbums:   parseInt(extraAlbums) || 0,
    amount:        (totalAmount / 100).toFixed(2),
    paymentMethod,
    paymentStatus: 'pending',
    vendorId:      v.payload.vendorId,
  };

  Promise.all([
    sheets.appendOrder(order).catch(e => console.error('[sheets]', e)),
    (async () => {
      try {
        const pdfBuf = await pdf.generate(order);
        await mailer.sendOrderConfirmation(order, pdfBuf);
      } catch (e) { console.error('[mail/pdf]', e); }
    })(),
  ]);

  res.json({ ok: true, order });
});

// ── ROUTE 5 — Webhook Stripe ──
app.post('/api/stripe/webhook', async (req, res) => {
  const sig    = req.headers['stripe-signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  let event;
  try {
    event = secret && secret !== 'placeholder'
      ? stripe.webhooks.constructEvent(req.body, sig, secret)
      : JSON.parse(req.body);
  } catch (err) {
    return res.status(400).send(`Webhook error: ${err.message}`);
  }

  if (event.type === 'payment_intent.succeeded') {
    const intent = event.data.object;
    const m      = intent.metadata;
    if (m.token) tokens.consume(m.token);

    const pack  = PACKS[m.packId] || {};
    const order = {
      orderNumber:     `FS-${Date.now()}-${(m.equipageNumber||'').replace(/\W/g,'')}`,
      createdAt:       new Date().toISOString(),
      customerName:    m.customerName,
      customerEmail:   m.customerEmail,
      customerPhone:   m.customerPhone || '',
      equipageNumber:  m.equipageNumber,
      packId:          m.packId,
      extraAlbums:     parseInt(m.extraAlbums) || 0,
      amount:          ((intent.amount_received || intent.amount) / 100).toFixed(2),
      paymentMethod:   'card',
      paymentStatus:   'paid',
      vendorId:        m.vendorId,
      stripePaymentId: intent.id,
    };

    Promise.all([
      sheets.appendOrder(order).catch(e => console.error('[sheets]', e)),
      (async () => {
        try {
          const pdfBuf = await pdf.generate(order);
          await mailer.sendOrderConfirmation(order, pdfBuf);
        } catch (e) { console.error('[mail/pdf]', e); }
      })(),
    ]);
  }

  res.json({ received: true });
});

// ── ROUTE 6 — Confirmer encaissement ──
app.post('/api/vendor/confirm-cash', adminAuth, async (req, res) => {
  const { orderNumber } = req.body;
  if (!orderNumber) return res.status(400).json({ error: 'orderNumber requis' });
  try {
    await sheets.markPaid(orderNumber);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── ROUTE 7 — Stats vendeur ──
app.get('/api/vendor/stats', adminAuth, (req, res) => {
  res.json({ ok: true });
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
