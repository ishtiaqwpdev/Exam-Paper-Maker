/* Passwords (scrypt + salt) and login tokens (signed, 30 days). */
const crypto = require('crypto');

function secret() {
  const s = process.env.AUTH_SECRET || ('pm-auth:' + (require('./_db').url() || 'test'));
  return crypto.createHash('sha256').update(s).digest();
}
const b64u = b => Buffer.from(b).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const fromB64u = s => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');

function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(String(pw), salt, 32, { N: 16384, r: 8, p: 1 });
  return 'scrypt$' + b64u(salt) + '$' + b64u(key);
}
function checkPassword(pw, stored) {
  const parts = String(stored || '').split('$'); if (parts[0] !== 'scrypt' || parts.length !== 3) return false;
  const key = crypto.scryptSync(String(pw), fromB64u(parts[1]), 32, { N: 16384, r: 8, p: 1 }), want = fromB64u(parts[2]);
  return key.length === want.length && crypto.timingSafeEqual(key, want);
}
const TOKEN_DAYS = 30;
function makeToken(user) {
  const payload = b64u(JSON.stringify({ u: user.id, v: user.token_version || 0, x: Date.now() + TOKEN_DAYS * 864e5 }));
  return payload + '.' + b64u(crypto.createHmac('sha256', secret()).update(payload).digest());
}
function readToken(t) {
  const [payload, sig] = String(t || '').split('.'); if (!payload || !sig) return null;
  const want = crypto.createHmac('sha256', secret()).update(payload).digest(), got = fromB64u(sig);
  if (got.length !== want.length || !crypto.timingSafeEqual(got, want)) return null;
  try { const d = JSON.parse(fromB64u(payload).toString('utf8')); return d.x > Date.now() ? d : null; } catch (e) { return null; }
}
/* fingerprint of the current password hash: a reset code stops working once the password has changed */
function passPrint(passHash) { return b64u(crypto.createHmac('sha256', secret()).update('pp|' + passHash).digest()).slice(0, 16); }
function newId(prefix) { return prefix + '_' + Date.now().toString(36) + crypto.randomBytes(5).toString('hex'); }

module.exports = { hashPassword, checkPassword, makeToken, readToken, passPrint, newId };
