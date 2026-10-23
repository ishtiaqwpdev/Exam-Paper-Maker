/* POST /api/translate  { items: [{ text, sl, tl }] }  ->  { results: [string | null] }
   Urdu ⇄ English translation done on the server, so it works on every device and network (no ad-blocker,
   school Wi-Fi or browser privacy setting can block it, and phones don't hit Google's per-device limits).
   - Uses Google Translate's web endpoint, then MyMemory as a fallback.
   - With the database connected, every translation is cached in the table pm_translations and shared by all
     users, so the same sentence is only ever translated once. */
const crypto = require('crypto');
const R = require('./_reset');
const DB = require('./_db');

const MAX_ITEMS = 60, MAX_CHARS = 1500, LANGS = ['en', 'ur'], CONCURRENCY = 5, TIMEOUT = 8000;

// Best-effort fair-use limit per server instance: 1500 sentences per minute per visitor IP.
const hits = new Map();
function limited(ip, n) {
  const now = Date.now(), h = hits.get(ip) || { n: 0, t: now };
  if (now - h.t > 60e3) { h.n = 0; h.t = now; }
  h.n += n; hits.set(ip, h); return h.n > 1500;
}

let tableReady = null;
function ensureTable() {
  if (!tableReady) tableReady = DB.query(`CREATE TABLE IF NOT EXISTS pm_translations (
      key TEXT PRIMARY KEY, sl TEXT NOT NULL, tl TEXT NOT NULL, src TEXT NOT NULL, out TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`)
    .catch(e => { tableReady = null; throw e; });
  return tableReady;
}
const keyOf = (sl, tl, text) => crypto.createHash('sha256').update(sl + '|' + tl + '|' + text).digest('hex');

async function getJSON(url) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), TIMEOUT);
  try {
    const r = await (module.exports._fetch || fetch)(url, { signal: ctl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (ExamPaperMaker)' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}
function decode(s) {
  return String(s).replace(/&#(\d+);/g, (m, d) => String.fromCharCode(+d)).replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}
async function google(text, sl, tl) {
  const d = await getJSON('https://translate.googleapis.com/translate_a/single?client=gtx&sl=' + sl + '&tl=' + tl + '&dt=t&q=' + encodeURIComponent(text));
  if (!d || !Array.isArray(d[0])) throw new Error('bad google response');
  const out = d[0].map(x => (x && typeof x[0] === 'string') ? x[0] : '').join('');
  if (!out.trim()) throw new Error('empty');
  return out;
}
async function mymemory(text, sl, tl) {
  const de = process.env.GMAIL_USER ? '&de=' + encodeURIComponent(process.env.GMAIL_USER) : '';   // registered email = higher daily limit
  const d = await getJSON('https://api.mymemory.translated.net/get?q=' + encodeURIComponent(text) + '&langpair=' + sl + '|' + tl + de);
  const t = d && d.responseData && d.responseData.translatedText;
  if (!t || +d.responseStatus !== 200 || /MYMEMORY WARNING|QUERY LENGTH LIMIT/i.test(t)) throw new Error('mymemory failed');
  return decode(t);
}
async function translateOne(text, sl, tl) {
  try { return await google(text, sl, tl); }
  catch (e) { return await mymemory(text, sl, tl); }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return R.send(res, 405, { error: 'Use POST.' });
  const body = await R.readBody(req);
  const items = Array.isArray(body.items) ? body.items.slice(0, MAX_ITEMS) : [];
  if (!items.length) return R.send(res, 400, { error: 'Nothing to translate.' });
  const ip = String((req.headers && (req.headers['x-forwarded-for'] || req.headers['x-real-ip'])) || 'local').split(',')[0].trim();
  if (limited(ip, items.length)) return R.send(res, 429, { error: 'Too many translations at once — wait a minute.', code: 'rate_limited' });

  const clean = items.map(it => {
    const sl = LANGS.includes(it && it.sl) ? it.sl : 'auto', tl = LANGS.includes(it && it.tl) ? it.tl : null;
    const text = String((it && it.text) || '').slice(0, MAX_CHARS);
    return tl && text.trim() ? { sl, tl, text, key: keyOf(sl, tl, text) } : null;
  });
  const results = new Array(clean.length).fill(null);

  // 1) shared cache in the database
  const useDb = DB.configured();
  if (useDb) {
    try {
      await ensureTable();
      const keys = clean.filter(Boolean).map(c => c.key);
      if (keys.length) {
        const rows = await DB.query('SELECT key, out FROM pm_translations WHERE key = ANY($1)', [keys]);
        const map = new Map(rows.map(r => [r.key, r.out]));
        clean.forEach((c, i) => { if (c && map.has(c.key)) results[i] = map.get(c.key); });
      }
    } catch (e) { console.error('translate cache read failed:', e && e.message); }
  }

  // 2) translate the rest (a few at a time)
  const todo = clean.map((c, i) => (c && results[i] === null ? i : -1)).filter(i => i >= 0);
  let next = 0; const fresh = [];
  async function worker() {
    while (next < todo.length) {
      const i = todo[next++], c = clean[i];
      try { results[i] = (await translateOne(c.text, c.sl, c.tl)).replace(/\s+$/, ''); fresh.push(c.key ? [c, results[i]] : null); }
      catch (e) { results[i] = null; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, todo.length) }, worker));

  // 3) remember new translations for everyone
  if (useDb && fresh.length) {
    try {
      for (const [c, out] of fresh.filter(Boolean)) {
        await DB.query('INSERT INTO pm_translations (key, sl, tl, src, out) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (key) DO NOTHING', [c.key, c.sl, c.tl, c.text, out]);
      }
    } catch (e) { console.error('translate cache write failed:', e && e.message); }
  }
  const failed = results.filter((r, i) => clean[i] && r === null).length;
  return R.send(res, 200, { results, failed });
};
