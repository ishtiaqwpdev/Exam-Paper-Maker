/* POST /api/verify-reset  { email, code, token }  ->  { ok }  — checks the 6-digit code from the email. */
const crypto = require('crypto');
const R = require('./_reset');

// At most 5 wrong tries per emailed code (per server instance, kept until the code expires).
const tries = new Map();
function tooMany(nonce, x) {
  const now = Date.now(); for (const [k, v] of tries) if (v.x < now) tries.delete(k);
  const t = tries.get(nonce) || { n: 0, x }; return t.n >= 5;
}
function addTry(nonce, x) { const t = tries.get(nonce) || { n: 0, x }; t.n++; tries.set(nonce, t); return 5 - t.n; }

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return R.send(res, 405, { error: 'Use POST.' });
  if (!R.secret()) return R.send(res, 503, { error: 'Email is not set up yet.', code: 'not_configured' });
  const body = await R.readBody(req);
  const email = R.normEmail(body.email), code = String(body.code || '').replace(/\D/g, '');
  const t = R.readToken(body.token);
  if (!t || t.e !== email) return R.send(res, 400, { error: 'This code request is not valid. Ask for a new code.', code: 'bad_token' });
  if (Date.now() > t.x) return R.send(res, 400, { error: 'This code has expired. Ask for a new code.', code: 'expired' });
  if (code.length !== 6) return R.send(res, 400, { error: 'Enter the 6-digit code from the email.', code: 'bad_code' });
  if (tooMany(t.n, t.x)) return R.send(res, 429, { error: 'Too many wrong codes. Ask for a new code.', code: 'locked' });
  const a = Buffer.from(R.codeHash(email, code, t.n)), b = Buffer.from(t.h);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    const left = addTry(t.n, t.x);
    return R.send(res, 400, left > 0 ? { error: 'That code is not correct. ' + left + ' attempt(s) left.', code: 'wrong_code' } : { error: 'Too many wrong codes. Ask for a new code.', code: 'locked' });
  }
  tries.delete(t.n);
  return R.send(res, 200, { ok: true });
};
