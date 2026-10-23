/* POST /api/send-reset  { email }  ->  { ok, token, expiresIn }  — emails a 6-digit password-reset code. */
const nodemailer = require('nodemailer');
const R = require('./_reset');

// Best-effort abuse protection (per server instance): one email per address per 60 s, at most 5 per address per hour.
const recent = new Map();
function limited(email) {
  const now = Date.now(), list = (recent.get(email) || []).filter(t => now - t < 3600e3);
  if (list.length && now - list[list.length - 1] < 60e3) return 'Please wait a minute before asking for another code.';
  if (list.length >= 5) return 'Too many codes requested for this email. Try again in an hour.';
  list.push(now); recent.set(email, list); return null;
}

function emailHtml(code, name) {
  return `<!doctype html><html><body style="margin:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif;color:#111">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#fff;border:1px solid #e5e5e5;border-radius:14px;padding:28px">
  <tr><td style="font-size:13px;letter-spacing:2px;font-weight:700;color:#666">${name.toUpperCase()}</td></tr>
  <tr><td style="padding-top:14px;font-size:20px;font-weight:700">Your password reset code</td></tr>
  <tr><td style="padding-top:10px;font-size:15px;color:#444;line-height:1.5">Use this code to reset your password. It expires in 15 minutes.</td></tr>
  <tr><td align="center" style="padding:22px 0"><div style="display:inline-block;font-family:'Courier New',monospace;font-size:34px;letter-spacing:8px;font-weight:700;border:2px dashed #111;border-radius:10px;padding:12px 20px">${code}</div></td></tr>
  <tr><td style="font-size:13px;color:#666;line-height:1.5">If you did not ask to reset your password, you can ignore this email — your password will not change.</td></tr>
  </table></td></tr></table></body></html>`;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return R.send(res, 405, { error: 'Use POST.' });
  const user = process.env.GMAIL_USER, pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass || !R.secret()) return R.send(res, 503, { error: 'Email is not set up yet. The site owner must add GMAIL_USER and GMAIL_APP_PASSWORD in Vercel.', code: 'not_configured' });

  const body = await R.readBody(req);
  const email = R.normEmail(body.email);
  if (!R.EMAIL_RE.test(email) || email.length > 254) return R.send(res, 400, { error: 'Please enter a valid email address.' });
  const wait = limited(email); if (wait) return R.send(res, 429, { error: wait, code: 'rate_limited' });

  const code = R.sixDigits(), name = process.env.MAIL_FROM_NAME || 'Exam Paper Maker';
  try {
    const transport = module.exports._transport || nodemailer.createTransport({ service: 'gmail', auth: { user, pass: pass.replace(/\s+/g, '') } });
    await transport.sendMail({
      from: { name, address: user }, to: email,
      subject: code + ' is your ' + name + ' password reset code',
      text: 'Your password reset code is ' + code + '\n\nIt expires in 15 minutes. If you did not ask for this, ignore this email.',
      html: emailHtml(code, name)
    });
  } catch (e) {
    console.error('send-reset failed:', e && e.message);
    return R.send(res, 502, { error: 'Could not send the email right now. Please try again in a minute.', code: 'send_failed' });
  }
  return R.send(res, 200, { ok: true, token: R.makeToken(email, code), expiresIn: R.CODE_TTL_MS / 1000 });
};
