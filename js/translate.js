/* translate.js — automatic Urdu ⇄ English translation for the paper preview.

   How it works
   - The teacher writes the paper in one language. When "Auto-translate preview" is on, the preview,
     view page, thumbnails, print and PDF show the paper in the OTHER language:
       Urdu text   -> English preview (left-to-right, English labels)
       English text-> Urdu preview   (right-to-left, Urdu labels)
   - The source language is detected from what is actually typed (Urdu script vs Latin letters),
     per section, so it works even if the paper language setting was left on the default.
   - Maths ($…$, $$…$$), answer blanks (___) and numbers are never translated; they are protected
     with placeholders and put back after translation.
   - Common exam phrases (section types, subjects) translate offline from a built-in dictionary.
     Everything else uses a free online service (Google Translate web endpoint, with MyMemory as a
     fallback). Results are cached in this browser, so each sentence is fetched only once and works
     offline afterwards. If no service can be reached, the original text is shown and a warning appears.
   For production, swap `remote()` for your own server-side translation API (e.g. Google Cloud Translation). */
(function () {
  var CACHE_KEY = 'pm_tr_cache_v1', MAX_ENTRIES = 5000, CONCURRENCY = 4, TIMEOUT = 9000, RETRY_AFTER = 60000;

  /* ---------------- cache ---------------- */
  var cache = {};
  try { cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}') || {}; } catch (e) { cache = {}; }
  var persistTimer = null;
  function persist() {
    clearTimeout(persistTimer);
    persistTimer = setTimeout(function () {
      try {
        var keys = Object.keys(cache);
        if (keys.length > MAX_ENTRIES) keys.slice(0, keys.length - MAX_ENTRIES).forEach(function (k) { delete cache[k]; });
        localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
      } catch (e) { /* storage full or blocked — cache stays in memory for this session */ }
    }, 400);
  }

  /* ---------------- script detection ---------------- */
  var AR = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/g, LAT = /[A-Za-z]/g;
  function counts(s) { s = String(s || ''); return { ar: (s.match(AR) || []).length, la: (s.match(LAT) || []).length }; }
  function scriptOf(s) { var c = counts(s); if (!c.ar && !c.la) return null; return c.ar >= c.la ? 'ur' : 'en'; }
  function opposite(l) { return l === 'ur' ? 'en' : 'ur'; }

  /* ---------------- protect maths / blanks ---------------- */
  function closingDollar(s, from) {
    for (var j = from; j < s.length; j++) { if (s.charAt(j) === '$' && s.charAt(j - 1) !== '\\') return j; }
    return -1;
  }
  function mask(line) {
    var toks = [], out = '', i = 0, n = line.length, e;
    function put(raw) { out += '{{' + toks.length + '}}'; toks.push(raw); }
    while (i < n) {
      var c = line.charAt(i);
      if (c === '\\' && line.charAt(i + 1) === '$') { put('\\$'); i += 2; continue; }
      if (line.substr(i, 2) === '$$') { e = line.indexOf('$$', i + 2); if (e >= 0) { put(line.slice(i, e + 2)); i = e + 2; continue; } }
      if (c === '$') { e = closingDollar(line, i + 1); if (e >= 0) { put(line.slice(i, e + 1)); i = e + 1; continue; } }
      if (c === '_' && line.charAt(i + 1) === '_') { var j = i; while (j < n && line.charAt(j) === '_') j++; put(line.slice(i, j)); i = j; continue; }
      out += c; i++;
    }
    return { text: out, toks: toks };
  }
  var PH = /\{\s*\{\s*(\d+)\s*\}\s*\}/g;
  function unmask(t, toks) {
    var seen = {}, ok = true;
    var r = String(t).replace(PH, function (m, d) { d = +d; if (d >= toks.length || seen[d]) { ok = false; return ''; } seen[d] = 1; return toks[d]; });
    for (var k = 0; k < toks.length; k++) if (!seen[k]) ok = false;
    return ok ? r : null;
  }
  function plainOf(maskedText) { return maskedText.replace(PH, ' '); }

  /* ---------------- offline dictionary ---------------- */
  var DICT = null;
  function norm(s) { return String(s).toLowerCase().replace(/[\s.:،,۔!?؟]+$/g, '').replace(/\s+/g, ' ').trim(); }
  function buildDict() {
    DICT = { en: {}, ur: {} };
    function pair(en, ur) { DICT.ur[norm(en)] = ur; DICT.en[norm(ur)] = en; }
    var T = window.Translations && window.Translations.data;
    if (T) Object.keys(T.en.types).forEach(function (k) { pair(T.en.types[k], T.ur.types[k]); });
    [
      ['Fill in the blanks.', 'خالی جگہ پُر کریں۔'], ['Write True or False.', 'درست یا غلط لکھیے۔'],
      ['Choose the correct answer.', 'درست جواب کا انتخاب کریں۔'], ['Answer the following questions.', 'درج ذیل سوالات کے جوابات دیں۔'],
      ['Answer the following question.', 'درج ذیل سوال کا جواب دیں۔'], ['Solve the following equations.', 'درج ذیل مساوات حل کریں۔'],
      ['Match column A with column B.', 'کالم الف کو کالم ب سے ملائیں۔'], ['Read the passage and answer the questions.', 'عبارت پڑھ کر سوالات کے جوابات دیں۔'],
      ['English', 'انگریزی'], ['Urdu', 'اردو'], ['Mathematics', 'ریاضی'], ['Maths', 'ریاضی'], ['Math', 'ریاضی'], ['Science', 'سائنس'],
      ['General Science', 'جنرل سائنس'], ['Islamiat', 'اسلامیات'], ['Islamic Studies', 'اسلامیات'], ['Social Studies', 'معاشرتی علوم'],
      ['Pakistan Studies', 'مطالعہ پاکستان'], ['Computer', 'کمپیوٹر'], ['Computer Science', 'کمپیوٹر سائنس'], ['Physics', 'طبیعیات'],
      ['Chemistry', 'کیمیا'], ['Biology', 'حیاتیات'], ['History', 'تاریخ'], ['Geography', 'جغرافیہ'], ['Nazra Quran', 'ناظرہ قرآن']
    ].forEach(function (p) { pair(p[0], p[1]); });
  }
  function dict(core, tl) { if (!DICT) buildDict(); var v = DICT[tl][norm(core)]; return v || null; }

  /* ---------------- synchronous lookup (cache / dictionary) ---------------- */
  function trLine(line, tl, missing) {
    if (!/\S/.test(line)) return line;
    var m = mask(line), sc = scriptOf(plainOf(m.text));
    if (!sc || sc === tl) return line;                       // nothing to translate / already in target language
    var lead = m.text.match(/^\s*/)[0], trail = m.text.match(/\s*$/)[0], core = m.text.trim();
    if (!m.toks.length) { var d = dict(core, tl); if (d) return lead + d + trail; }
    var key = tl + '|' + core;
    if (Object.prototype.hasOwnProperty.call(cache, key)) { var u = unmask(cache[key], m.toks); if (u !== null) return lead + u + trail; }
    if (missing) missing.push({ key: key, text: core, sl: sc, tl: tl, toks: m.toks.length });
    return line;
  }
  function tr(s, tl, missing) {
    if (s == null || s === '') return s;
    return String(s).split('\n').map(function (l) { return trLine(l, tl, missing); }).join('\n');
  }

  /* ---------------- network ---------------- */
  var decoder = null;
  function decodeEntities(s) { if (!/&[#a-z0-9]+;/i.test(s)) return s; decoder = decoder || document.createElement('textarea'); decoder.innerHTML = s; return decoder.value; }
  function getJSON(url) {
    var ctl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, TIMEOUT);
    return fetch(url, ctl ? { signal: ctl.signal } : {}).then(function (r) { clearTimeout(timer); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); },
      function (e) { clearTimeout(timer); throw e; });
  }
  function google(text, sl, tl) {
    return getJSON('https://translate.googleapis.com/translate_a/single?client=gtx&sl=' + sl + '&tl=' + tl + '&dt=t&q=' + encodeURIComponent(text))
      .then(function (d) {
        if (!d || !Array.isArray(d[0])) throw new Error('bad response');
        var out = d[0].map(function (x) { return (x && typeof x[0] === 'string') ? x[0] : ''; }).join('');
        if (!out.trim()) throw new Error('empty');
        return out;
      });
  }
  function mymemory(text, sl, tl) {
    return getJSON('https://api.mymemory.translated.net/get?q=' + encodeURIComponent(text) + '&langpair=' + sl + '|' + tl)
      .then(function (d) {
        var t = d && d.responseData && d.responseData.translatedText;
        if (!t || +d.responseStatus !== 200 || /MYMEMORY WARNING|QUERY LENGTH LIMIT/i.test(t)) throw new Error('mymemory failed');
        return decodeEntities(t);
      });
  }
  function remote(text, sl, tl) { return google(text, sl, tl).catch(function () { return mymemory(text, sl, tl); }); }

  // Translate one masked sentence; if the service mangles the {{n}} placeholders, translate the
  // pieces between them separately so maths/blanks always survive.
  function translateItem(it) {
    return remote(it.text, it.sl, it.tl).then(function (t) {
      t = t.replace(/\s+$/, '');
      if (!it.toks || unmask(t, new Array(it.toks)) !== null) return t;
      var parts = it.text.split(/(\{\{\d+\}\})/);
      return Promise.all(parts.map(function (p) {
        if (/^\{\{\d+\}\}$/.test(p) || scriptOf(p) !== it.sl) return p;
        var lead = p.match(/^\s*/)[0], trail = p.match(/\s*$/)[0];
        return remote(p.trim(), it.sl, it.tl).then(function (x) { return lead + x.trim() + trail; });
      })).then(function (a) { return a.join(''); });
    });
  }

  var inflight = {}, failed = {}, queue = [], active = 0, listeners = [];
  function notify() { listeners.forEach(function (fn) { try { fn(status()); } catch (e) {} }); }
  function recentlyFailed(key) { return failed[key] && (Date.now() - failed[key] < RETRY_AFTER); }
  function pump() {
    while (active < CONCURRENCY && queue.length) {
      (function (job) {
        active++;
        translateItem(job.it).then(function (t) { cache[job.it.key] = t; delete failed[job.it.key]; lastError = ''; persist(); return true; },
          function (e) {
            failed[job.it.key] = Date.now();
            lastError = (e && e.name === 'AbortError') ? 'Translation service is not answering — check the internet, then press Retry.'
              : 'Could not reach the translation service (no internet, or blocked by the browser/network) — press Retry.';
            return false;
          })
          .then(function (ok) { delete inflight[job.it.key]; active--; job.res(ok); notify(); pump(); });
      })(queue.shift());
    }
  }
  function enqueue(it) { return new Promise(function (res) { queue.push({ it: it, res: res }); pump(); notify(); }); }

  /* ---------------- Claude (online preview on claude.ai) ----------------
     When the page runs inside the Claude artifact viewer, the browser may not reach outside
     translation sites, so translation is done by Claude through the viewer (`sample` capability):
     one batched request per pause in typing, cached for 24 h. Outside the viewer this is skipped. */
  var sampleFn = null, lastError = '';
  var sampleReady = (window.claude && typeof window.claude.use === 'function')
    ? Promise.resolve().then(function () { return window.claude.use('sample'); })
        .then(function (fn) { sampleFn = fn || null; }, function () { sampleFn = null; })
    : Promise.resolve();
  var HIDE_CODES = ['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed'];
  function sampleErrorText(code) {
    if (code === 'not_granted') return 'Claude translation was not allowed for this page.';
    if (code === 'rate_limited') return 'Too many translation requests — wait a minute, then press Retry.';
    if (code === 'session_expired') return 'Please sign in to Claude again, then press Retry.';
    if (HIDE_CODES.indexOf(code) >= 0) return 'Claude translation is not available here.';
    return 'Translation failed — press Retry.';
  }
  function claudeBatch(items) {
    var prompt = 'You translate school exam paper text between Urdu and English.\n' +
      'Translate the "text" of every item in the JSON array below into its "to" language ("ur" = Urdu in Urdu script, "en" = English).\n' +
      'Rules:\n- Keep every placeholder such as {{0}} exactly as written (they stand for maths and answer blanks) and put it where it belongs in the translated sentence.\n' +
      '- Transliterate names of people, schools and places (e.g. "Ishtiaq Ahmad" -> "اشتیاق احمد", "سید رسول" -> "Syed Rasool").\n' +
      '- Keep numbers as digits. Use the clear, formal wording of an exam paper. No notes or explanations.\n' +
      'Reply with only a JSON array of ' + items.length + ' strings: the translations, in the same order.\n\n' +
      JSON.stringify(items.map(function (it) { return { to: it.tl, text: it.text }; }));
    return sampleFn.json(prompt, { modelTier: 'quick', cache: { gcTime: 86400000 } }).then(function (arr) {
      if (!Array.isArray(arr) || arr.length !== items.length) throw { code: 'invalid_json' };
      var bad = 0;
      items.forEach(function (it, i) {
        var t = typeof arr[i] === 'string' ? arr[i].trim() : '';
        if (t && (!it.toks || unmask(t, new Array(it.toks)) !== null)) { cache[it.key] = t; delete failed[it.key]; }
        else { failed[it.key] = Date.now(); bad++; }
      });
      persist(); lastError = bad ? 'Some text could not be translated — press Retry.' : '';
    }).catch(function (e) {
      var code = e && e.code;
      lastError = sampleErrorText(code);
      if (HIDE_CODES.indexOf(code) >= 0) sampleFn = null;      // fall back to the web services from now on
      items.forEach(function (it) { failed[it.key] = Date.now(); });
    });
  }
  var claudeChain = Promise.resolve();
  function viaClaude(list) {
    var todo = [], seen = {};
    list.forEach(function (it) { if (!seen[it.key] && !inflight[it.key]) { seen[it.key] = 1; todo.push(it); } });
    var ps = list.filter(function (it) { return inflight[it.key]; }).map(function (it) { return inflight[it.key]; });
    for (var i = 0; i < todo.length; i += 40) {
      (function (chunk) {
        // batches run one after another (never in parallel) to stay well inside the viewer's limits
        var p = claudeChain = claudeChain.then(function () { active += chunk.length; notify(); return claudeBatch(chunk); })
          .then(done, done);
        function done() { active = Math.max(0, active - chunk.length); chunk.forEach(function (it) { delete inflight[it.key]; }); notify(); }
        chunk.forEach(function (it) { inflight[it.key] = p; });
        ps.push(p);
      })(todo.slice(i, i + 40));
    }
    return Promise.all(ps);
  }

  /* Fetch every missing translation (deduplicated). Resolves when all are done (success or failure). */
  function fetchMissing(list) {
    list = (list || []).filter(function (it) { return !Object.prototype.hasOwnProperty.call(cache, it.key) && !recentlyFailed(it.key); });
    if (!list.length) return Promise.resolve();
    return sampleReady.then(function () {
      if (sampleFn) return viaClaude(list);
      var ps = [];
      list.forEach(function (it) {
        if (Object.prototype.hasOwnProperty.call(cache, it.key)) return;
        if (!inflight[it.key]) inflight[it.key] = enqueue(it);
        ps.push(inflight[it.key]);
      });
      return Promise.all(ps);
    });
  }
  function canFetch(it) { return !Object.prototype.hasOwnProperty.call(cache, it.key) && !recentlyFailed(it.key); }
  function status() {
    var f = 0, now = Date.now(); for (var k in failed) if (now - failed[k] < RETRY_AFTER) f++;
    return { pending: active + queue.length, failed: f, error: f ? lastError : '', viaClaude: !!sampleFn };
  }

  /* ---------------- whole paper ---------------- */
  var SETTINGS_FIELDS = ['school', 'examName', 'academicYear', 'className', 'subject', 'chapter', 'duration', 'totalMarks', 'passingMarks', 'instructions', 'preparedBy'];
  function sectionStrings(s) {
    var a = [s.title];
    (s.questions || []).forEach(function (q) { a.push(q.text); (q.options || []).forEach(function (o) { a.push(o); }); });
    (s.items || []).forEach(function (x) { a.push(x && typeof x === 'object' ? x.text : x); });
    (s.left || []).forEach(function (x) { a.push(x); }); (s.right || []).forEach(function (x) { a.push(x); });
    (s.rows || []).forEach(function (r) { (r || []).forEach(function (c) { a.push(c); }); });
    a.push(s.passage, s.text);
    return a;
  }
  function detect(strings, fallback) {
    var ar = 0, la = 0;
    strings.forEach(function (x) { if (!x) return; var c = counts(plainOf(mask(String(x)).text)); ar += c.ar; la += c.la; });
    if (!ar && !la) return fallback;
    return ar >= la ? 'ur' : 'en';
  }

  /* Returns { paper: translated copy, missing: [...], source, target } using cached translations only. */
  function view(paper) {
    var missing = [], p = JSON.parse(JSON.stringify(paper));
    var all = SETTINGS_FIELDS.map(function (k) { return paper.settings[k]; });
    // the default section titles don't say much about what the teacher typed; weigh content first
    paper.sections.forEach(function (s) { if (s.enabled !== false) all = all.concat(sectionStrings(s)); });
    var src = detect(all, paper.lang || 'en'), tl = opposite(src);
    p.lang = tl;
    SETTINGS_FIELDS.forEach(function (k) { p.settings[k] = tr(p.settings[k], tl, missing); });
    p.sections.forEach(function (s) {
      if (s.enabled === false) return;                       // hidden sections are not printed, so not translated
      var st =opposite(detect(sectionStrings(s), s.lang || src));
      var T = function (x) { return tr(x, st, missing); };
      s.lang = st;
      s.title = T(s.title); s.marks = T(s.marks);
      if (s.questions) s.questions.forEach(function (q) { q.text = T(q.text); q.options = (q.options || []).map(T); });
      if (s.items) s.items = s.items.map(function (x) { if (x && typeof x === 'object') { x.text = T(x.text); return x; } return T(x); });
      if (s.left) s.left = s.left.map(T);
      if (s.right) s.right = s.right.map(T);
      if (s.rows) s.rows = s.rows.map(function (r) { return (r || []).map(T); });
      if (s.passage) s.passage = T(s.passage);
      if (s.text) s.text = T(s.text);
    });
    return { paper: p, missing: missing, source: src, target: tl };
  }

  /* Fetch everything that is missing, then return the finished translated view (for print / PDF). */
  function prepare(paper) {
    var v = view(paper);
    if (!v.missing.length) return Promise.resolve(v);
    return fetchMissing(v.missing).then(function () { return view(paper); });
  }

  window.Translator = {
    view: view, prepare: prepare, fetch: fetchMissing, canFetch: canFetch, status: status,
    onChange: function (fn) { listeners.push(fn); return function () { listeners = listeners.filter(function (x) { return x !== fn; }); }; },
    retry: function () { failed = {}; lastError = ''; notify(); },
    usesClaude: function () { return !!sampleFn; },
    clearCache: function () { cache = {}; failed = {}; try { localStorage.removeItem(CACHE_KEY); } catch (e) {} },
    detect: detect, scriptOf: scriptOf, text: tr, langName: function (l) { return l === 'ur' ? 'اردو' : 'English'; }
  };
})();
