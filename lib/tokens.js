// lib/tokens.js
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const SECRET  = process.env.JWT_SECRET || 'dev-secret-change-in-prod';
const MINUTES = parseInt(process.env.LINK_EXPIRY_MINUTES) || 15;

// Usage-unique store (mémoire). Remplacer par Redis en multi-instance.
const used = new Set();

function generate(vendorId) {
  const jti   = uuidv4();
  const token = jwt.sign({ type: 'order', vendorId, jti }, SECRET, {
    expiresIn: `${MINUTES}m`,
  });
  return { token, expiresInSeconds: MINUTES * 60 };
}

function verify(token) {
  try {
    if (used.has(token)) return { ok: false, reason: 'USED' };
    const p = jwt.verify(token, SECRET);
    if (p.type !== 'order') return { ok: false, reason: 'INVALID' };
    return { ok: true, payload: p };
  } catch (e) {
    return { ok: false, reason: e.name === 'TokenExpiredError' ? 'EXPIRED' : 'INVALID' };
  }
}

function consume(token) {
  used.add(token);
  setTimeout(() => used.delete(token), 60 * 60 * 1000);
}

module.exports = { generate, verify, consume, MINUTES };