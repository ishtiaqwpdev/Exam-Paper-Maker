/* POST /api/verify-reset  { email, code, token }  ->  { ok }  — checks the 6-digit code from the email. */
const R = require('./_reset');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return R.send(res, 405, { error: 'Use POST.' });
  if (!R.secret()) return R.send(res, 503, { error: 'Email is not set up yet.', code: 'not_configured' });
  const body = await R.readBody(req);
  const r = R.checkCode(body.email, body.code, body.token);
  if (!r.ok) return R.send(res, r.status, { error: r.error, code: r.code });
  return R.send(res, 200, { ok: true });
};
