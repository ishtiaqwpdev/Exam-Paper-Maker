/* POST /api/data  { action, ...fields }  (send "Authorization: Bearer <token>" after login)
   The app's database API: accounts, login, papers and admin tools. Every action checks who is asking:
   teachers can only read and change their own papers; admin actions need the admin role.
   GET /api/data?action=status tells the app whether the database is connected. */
const DB = require('./_db');
const A = require('./_auth');
const R = require('./_reset');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_PAPER_BYTES = 3 * 1024 * 1024;

class HttpError extends Error { constructor(status, message, code) { super(message); this.status = status; this.code = code; } }
const fail = (status, message, code) => { throw new HttpError(status, message, code); };

function publicUser(u) { return { id: u.id, name: u.name, email: u.email, role: u.role, academy: u.academy || '' }; }
function str(v, max) { return String(v == null ? '' : v).trim().slice(0, max || 200); }

// Slow down password guessing: after 10 wrong passwords for one email, wait 15 minutes (per server instance).
const loginFails = new Map();
function loginLocked(email) { const f = loginFails.get(email); return f && f.n >= 10 && Date.now() - f.t < 15 * 60e3; }
function loginFailed(email) { const f = loginFails.get(email) || { n: 0, t: 0 }; if (Date.now() - f.t > 15 * 60e3) f.n = 0; f.n++; f.t = Date.now(); loginFails.set(email, f); }

async function currentUser(req) {
  const h = req.headers && (req.headers.authorization || req.headers.Authorization) || '';
  const t = A.readToken(h.replace(/^Bearer\s+/i, ''));
  if (!t) fail(401, 'Please log in again.', 'auth');
  const rows = await DB.query('SELECT * FROM pm_users WHERE id = $1', [t.u]);
  if (!rows.length || rows[0].token_version !== t.v) fail(401, 'Please log in again.', 'auth');
  return rows[0];
}
function needAdmin(u) { if (u.role !== 'admin') fail(403, 'Only an admin can do this.', 'forbidden'); }

function cleanPaper(p) {
  if (!p || typeof p !== 'object' || typeof p.id !== 'string' || !/^[\w-]{3,80}$/.test(p.id)) fail(400, 'This paper could not be saved (bad data).', 'bad_paper');
  if (!p.settings || !Array.isArray(p.sections)) fail(400, 'This paper could not be saved (bad data).', 'bad_paper');
  const json = JSON.stringify(p);
  if (Buffer.byteLength(json) > MAX_PAPER_BYTES) fail(413, 'This paper is too large to save (try a smaller logo).', 'too_large');
  return p;
}

/* Saves one paper. A new paper belongs to the caller (an admin may keep a teacher as owner);
   an existing paper can only be changed by its owner or an admin. */
async function upsertPaper(me, p) {
  p = cleanPaper(p);
  const existing = await DB.query('SELECT owner_id FROM pm_papers WHERE id = $1', [p.id]);
  let owner = me.id;
  if (existing.length) {
    owner = existing[0].owner_id;
    if (owner !== me.id && me.role !== 'admin') fail(403, 'You can only change your own papers.', 'forbidden');
  } else if (me.role === 'admin' && p.ownerId && p.ownerId !== me.id) {
    const o = await DB.query('SELECT id FROM pm_users WHERE id = $1', [p.ownerId]);
    if (o.length) owner = p.ownerId;
  }
  p.ownerId = owner;
  const created = p.createdAt && !isNaN(Date.parse(p.createdAt)) ? p.createdAt : new Date().toISOString();
  p.updatedAt = new Date().toISOString();
  await DB.query(
    `INSERT INTO pm_papers (id, owner_id, data, created_at, updated_at) VALUES ($1, $2, $3::jsonb, $4, now())
     ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
    [p.id, owner, JSON.stringify(p), created]);
  return p;
}

const actions = {
  async status() { return { db: DB.configured(), email: !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) }; },

  async register(b) {
    const name = str(b.name, 80), email = str(b.email, 254).toLowerCase(), academy = str(b.academy, 120), pw = String(b.password || '');
    if (!name || !email || !pw) fail(400, 'Please fill in your name, email and password.');
    if (!EMAIL_RE.test(email)) fail(400, 'Please enter a valid email address.');
    if (pw.length < 6) fail(400, 'Password must be at least 6 characters.');
    if (pw.length > 200) fail(400, 'Password is too long.');
    const dup = await DB.query('SELECT 1 FROM pm_users WHERE email = $1', [email]);
    if (dup.length) fail(409, 'An account with this email already exists.', 'exists');
    const count = await DB.query('SELECT count(*)::int AS n FROM pm_users');
    const role = count[0].n === 0 ? 'admin' : 'teacher';           // the very first account runs the site
    const id = A.newId('u');
    try {
      await DB.query('INSERT INTO pm_users (id, email, name, academy, role, pass_hash) VALUES ($1,$2,$3,$4,$5,$6)', [id, email, name, academy, role, A.hashPassword(pw)]);
    } catch (e) { if (/unique|duplicate/i.test(e.message)) fail(409, 'An account with this email already exists.', 'exists'); throw e; }
    const u = (await DB.query('SELECT * FROM pm_users WHERE id = $1', [id]))[0];
    return { token: A.makeToken(u), user: publicUser(u), first: role === 'admin' };
  },

  async login(b) {
    const email = str(b.email, 254).toLowerCase(), pw = String(b.password || '');
    if (!email || !pw) fail(400, 'Please enter both your email and password.');
    if (loginLocked(email)) fail(429, 'Too many wrong passwords. Try again in 15 minutes, or use “Forgot your password?”.', 'locked');
    const rows = await DB.query('SELECT * FROM pm_users WHERE email = $1', [email]);
    if (!rows.length) fail(404, 'No account found with this email. Click “Create Account” to register first.', 'no_account');
    if (!A.checkPassword(pw, rows[0].pass_hash)) { loginFailed(email); fail(401, 'Incorrect password. Please try again.', 'wrong_password'); }
    loginFails.delete(email);
    return { token: A.makeToken(rows[0]), user: publicUser(rows[0]) };
  },

  async me(b, req) { return { user: publicUser(await currentUser(req)) }; },

  async updateProfile(b, req) {
    const me = await currentUser(req), name = str(b.name, 80);
    if (!name) fail(400, 'Name cannot be empty.');
    await DB.query('UPDATE pm_users SET name = $1, academy = $2 WHERE id = $3', [name, str(b.academy, 120), me.id]);
    return { user: publicUser((await DB.query('SELECT * FROM pm_users WHERE id = $1', [me.id]))[0]) };
  },

  async changePassword(b, req) {
    const me = await currentUser(req), np = String(b.newPassword || '');
    if (!A.checkPassword(String(b.oldPassword || ''), me.pass_hash)) fail(400, 'Current password is incorrect.', 'wrong_password');
    if (np.length < 6) fail(400, 'New password must be at least 6 characters.');
    // bumping token_version logs out every other device
    const u = (await DB.query('UPDATE pm_users SET pass_hash = $1, token_version = token_version + 1 WHERE id = $2 RETURNING *', [A.hashPassword(np), me.id]))[0];
    return { token: A.makeToken(u) };
  },

  async resetPassword(b) {
    const email = str(b.email, 254).toLowerCase(), np = String(b.newPassword || '');
    if (np.length < 6) fail(400, 'New password must be at least 6 characters.');
    const c = R.checkCode(email, b.code, b.resetToken);
    if (!c.ok) fail(c.status, c.error, c.code);
    const rows = await DB.query('SELECT * FROM pm_users WHERE email = $1', [email]);
    if (!rows.length) fail(404, 'No account found with this email.', 'no_account');
    if (c.t.p !== A.passPrint(rows[0].pass_hash)) fail(400, 'This code has already been used. Ask for a new code.', 'used');
    await DB.query('UPDATE pm_users SET pass_hash = $1, token_version = token_version + 1 WHERE id = $2', [A.hashPassword(np), rows[0].id]);
    loginFails.delete(email);
    return { ok: true };
  },

  async listPapers(b, req) {
    const me = await currentUser(req);
    const rows = me.role === 'admin'
      ? await DB.query('SELECT p.data, p.owner_id, u.name AS owner_name FROM pm_papers p JOIN pm_users u ON u.id = p.owner_id ORDER BY p.updated_at DESC')
      : await DB.query('SELECT p.data, p.owner_id FROM pm_papers p WHERE p.owner_id = $1 ORDER BY p.updated_at DESC', [me.id]);
    const owners = {};
    const papers = rows.map(r => { const d = typeof r.data === 'string' ? JSON.parse(r.data) : r.data; d.ownerId = r.owner_id; if (r.owner_name) owners[r.owner_id] = r.owner_name; return d; });
    owners[me.id] = me.name;
    return { papers, owners, user: publicUser(me) };
  },

  async savePaper(b, req) { const me = await currentUser(req); const p = await upsertPaper(me, b.paper); return { ok: true, updatedAt: p.updatedAt, ownerId: p.ownerId }; },

  async importPapers(b, req) {
    const me = await currentUser(req), list = Array.isArray(b.papers) ? b.papers.slice(0, 200) : [];
    let n = 0;
    for (const p of list) {
      try {
        const ex = await DB.query('SELECT owner_id FROM pm_papers WHERE id = $1', [p && p.id]);
        if (ex.length) continue;                       // already there (or someone else's id) — never overwrite
        p.ownerId = me.id; await upsertPaper(me, p); n++;
      } catch (e) { /* skip a bad paper, keep importing the rest */ }
    }
    return { imported: n };
  },

  async deletePaper(b, req) {
    const me = await currentUser(req), id = str(b.id, 80);
    const rows = await DB.query('SELECT owner_id FROM pm_papers WHERE id = $1', [id]);
    if (!rows.length) return { ok: true };
    if (rows[0].owner_id !== me.id && me.role !== 'admin') fail(403, 'You can only delete your own papers.', 'forbidden');
    await DB.query('DELETE FROM pm_papers WHERE id = $1', [id]);
    return { ok: true };
  },

  async listUsers(b, req) {
    const me = await currentUser(req); needAdmin(me);
    const rows = await DB.query(`SELECT u.*, (SELECT count(*)::int FROM pm_papers p WHERE p.owner_id = u.id AND coalesce(p.data->>'kind', '') = '') AS papers FROM pm_users u ORDER BY u.created_at`);
    return { users: rows.map(u => Object.assign(publicUser(u), { papers: u.papers, createdAt: u.created_at })) };
  },

  async adminSetPassword(b, req) {
    const me = await currentUser(req); needAdmin(me);
    const np = String(b.password || ''); if (np.length < 6) fail(400, 'Password must be at least 6 characters.');
    const r = await DB.query('UPDATE pm_users SET pass_hash = $1, token_version = token_version + 1 WHERE id = $2 RETURNING id', [A.hashPassword(np), str(b.id, 80)]);
    if (!r.length) fail(404, 'Account not found.');
    return { ok: true };
  },

  async deleteUser(b, req) {
    const me = await currentUser(req); needAdmin(me);
    const id = str(b.id, 80);
    if (id === me.id) fail(400, 'You cannot remove your own account.');
    const r = await DB.query('SELECT role FROM pm_users WHERE id = $1', [id]);
    if (!r.length) return { ok: true };
    if (r[0].role === 'admin') fail(400, 'Admin accounts cannot be removed here.');
    await DB.query('DELETE FROM pm_users WHERE id = $1', [id]);   // their papers are removed too (ON DELETE CASCADE)
    return { ok: true };
  },

  async setRole(b, req) {
    const me = await currentUser(req); needAdmin(me);
    const id = str(b.id, 80), role = b.role === 'admin' ? 'admin' : 'teacher';
    if (id === me.id && role !== 'admin') fail(400, 'You cannot remove your own admin role.');
    const r = await DB.query('UPDATE pm_users SET role = $1 WHERE id = $2 RETURNING id', [role, id]);
    if (!r.length) fail(404, 'Account not found.');
    return { ok: true };
  }
};

module.exports = async function handler(req, res) {
  try {
    const q = (req.url || '').split('?')[1] || '';
    const qAction = new URLSearchParams(q).get('action');
    if (req.method === 'GET' && qAction === 'status') return R.send(res, 200, await actions.status());
    if (req.method !== 'POST') return R.send(res, 405, { error: 'Use POST.' });
    if (!DB.configured()) return R.send(res, 503, { error: 'The database is not connected yet.', code: 'no_db' });
    const body = await R.readBody(req);
    const fn = Object.prototype.hasOwnProperty.call(actions, body.action) && actions[body.action];
    if (!fn) return R.send(res, 400, { error: 'Unknown action.' });
    return R.send(res, 200, await fn(body, req));
  } catch (e) {
    if (e instanceof HttpError) return R.send(res, e.status, { error: e.message, code: e.code });
    console.error('data api error:', e && e.message);
    return R.send(res, 500, { error: 'Something went wrong on the server. Please try again.', code: 'server_error' });
  }
};
