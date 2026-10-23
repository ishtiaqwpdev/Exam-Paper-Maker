/* Shared helpers for the password-reset email functions (files starting with "_" are not public routes on Vercel).

   Setup (Vercel → Project → Settings → Environment Variables), then Redeploy:
     GMAIL_USER          the Gmail address that sends the emails, e.g. visiboom@gmail.com
     GMAIL_APP_PASSWORD  a 16-character Google "App password" (Google Account → Security → 2-Step Verification → App passwords)
     RESET_SECRET        optional: any long random text used to sign codes (defaults to a value derived from the app password)
     MAIL_FROM_NAME      optional: sender name shown in the inbox (default "Exam Paper Maker")

   How it works: /api/send-reset makes a 6-digit code, emails it, and returns a signed token that holds only a hash of the
   code, the email and an expiry time (15 minutes). /api/verify-reset checks the code against that token. Nothing is stored
   on the server. */
const crypto = require('crypto');

const CODE_TTL_MS = 15 * 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function secret() {
  const s = process.env.RESET_SECRET || (process.env.GMAIL_APP_PASSWORD ? 'pm-reset:' + process.env.GMAIL_APP_PASSWORD : '');
  return s ? crypto.createHash('sha256').update(s).digest() : null;
}
function b64u(buf) { return Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_'); }
function fromB64u(s) { return Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64'); }
function hmac(data) { return crypto.createHmac('sha256', secret()).update(data).digest(); }
function codeHash(email, code, nonce) { return b64u(hmac('code|' + email + '|' + String(code).trim() + '|' + nonce)); }

function makeToken(email, code, passPrint) {
  const nonce = b64u(crypto.randomBytes(12));
  const payload = b64u(JSON.stringify({ e: email, h: codeHash(email, code, nonce), n: nonce, x: Date.now() + CODE_TTL_MS, p: passPrint || '' }));
  return payload + '.' + b64u(hmac('token|' + payload));
}
function readToken(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 2) return null;
  const expected = hmac('token|' + parts[0]), given = fromB64u(parts[1]);
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  try { return JSON.parse(fromB64u(parts[0]).toString('utf8')); } catch (e) { return null; }
}
function sixDigits() { return String(crypto.randomInt(0, 1000000)).padStart(6, '0'); }
function normEmail(e) { return String(e || '').trim().toLowerCase(); }

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}
async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch (e) { return {}; } }
  const chunks = []; for await (const c of req) chunks.push(c);
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch (e) { return {}; }
}

/* Check an emailed code against its token. At most 5 wrong tries per code (per server instance).
   Returns { ok, t } or { status, error, code }. */
const tries = new Map();
function checkCode(email, code, token) {
  email = normEmail(email); code = String(code || '').replace(/\D/g, '');
  const t = readToken(token);
  if (!t || t.e !== email) return { status: 400, error: 'This code request is not valid. Ask for a new code.', code: 'bad_token' };
  if (Date.now() > t.x) return { status: 400, error: 'This code has expired. Ask for a new code.', code: 'expired' };
  if (code.length !== 6) return { status: 400, error: 'Enter the 6-digit code from the email.', code: 'bad_code' };
  const now = Date.now(); for (const [k, v] of tries) if (v.x < now) tries.delete(k);
  const rec = tries.get(t.n) || { n: 0, x: t.x };
  if (rec.n >= 5) return { status: 429, error: 'Too many wrong codes. Ask for a new code.', code: 'locked' };
  const a = Buffer.from(codeHash(email, code, t.n)), b = Buffer.from(t.h);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    rec.n++; tries.set(t.n, rec); const left = 5 - rec.n;
    return left > 0 ? { status: 400, error: 'That code is not correct. ' + left + ' attempt(s) left.', code: 'wrong_code' } : { status: 429, error: 'Too many wrong codes. Ask for a new code.', code: 'locked' };
  }
  return { ok: true, t };
}

module.exports = { checkCode, CODE_TTL_MS, EMAIL_RE, secret, makeToken, readToken, codeHash, sixDigits, normEmail, send, readBody };
