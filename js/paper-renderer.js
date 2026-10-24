/* paper-renderer.js — turns a paper object into printable HTML (used by preview, thumbnails, print, PDF). */
(function () {
  var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  // Rich text: escapes HTML, keeps line breaks, renders $inline$ and $$display$$ maths.
  var nl = function (s) { return PMath.text(s); };
  var hasArabic = function (s) { return /[؀-ۿ]/.test(s || ''); };

  function blanks(text) {
    return PMath.text(text, { blanks: true, appendBlank: true });
  }
  function lines(n) {
    var h = '';
    for (var i = 0; i < n; i++) h += '<div class="ans-line"></div>';
    return h;
  }
  function marksText(m, t) {
    m = (m || '').trim(); if (!m) return '';
    return /^\d+(\.\d+)?$/.test(m) ? '(' + esc(m) + ' ' + t.marks_word + ')' : esc(m);
  }
  /* Bidi fix: inside an Urdu (RTL) section, a line with no Urdu letters at all (pure maths, numbers or
     English) is laid out left-to-right so equations keep their order; and vice versa for an English section. */
  function da(text, dir) {
    var raw = String(text == null ? '' : text), plain = raw.replace(/\$\$[\s\S]*?\$\$|\$[^$]*\$/g, ' ');
    var ar = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(plain), la = /[A-Za-z]/.test(plain);
    if (dir === 'rtl' && !ar && /\S/.test(raw)) return ' dir="ltr"';
    if (dir === 'ltr' && ar && !la) return ' dir="rtl"';
    return '';
  }
  function qnum(n, dir) { return dir === 'rtl' ? '(' + n + ')' : n + '.'; }

  function renderSection(s, qNo, paperLang) {
    var lang = s.lang || paperLang, t = Translations.get(lang), dir = t.dir, start = parseInt(s.startNo, 10) || 1;
    var h = '<div class="sec-r lang-' + lang + '" dir="' + dir + '" style="text-align:' + (dir === 'rtl' ? 'right' : 'left') + (s.lang ? ';font-family:var(--font-' + (lang === 'ur' ? 'urdu' : 'english') + ')' : '') + '">';
    var isQ = ['instr', 'custom'].indexOf(s.type) < 0;
    var label = isQ ? (lang === 'ur' ? t.q + ' ' + qNo + '۔ ' : 'Q' + qNo + '. ') : '';
    if (s.showTitle !== false && (s.title || s.marks)) {
      h += '<div class="s-head"><span class="s-title">' + (s.title ? label + PMath.text(s.title) : '') + '</span><span class="s-marks">' + marksText(s.marks, t) + '</span></div>';
    } else if (s.marks) h += '<div class="s-head"><span></span><span class="s-marks">' + marksText(s.marks, t) + '</span></div>';

    var items = s.items || [], i;
    switch (s.type) {
      case 'mcq':
        h += '<ul class="q-list">' + s.questions.map(function (q, qi) {
          // Empty options are skipped; letters stay sequential and the answer key follows the shown letter.
          var shown = []; (q.options || []).forEach(function (o, oi) { if (String(o == null ? '' : o).trim() !== '') shown.push(oi); });
          var opts = shown.map(function (oi, k) { return '<span>(' + 'abcdefgh'[k] + ') <span' + da(q.options[oi], dir) + '>' + PMath.text(q.options[oi]) + '</span></span>'; }).join('');
          var ck = shown.indexOf(q.correct);
          var key = (s.showKey || window.__showKeys) && ck >= 0 ? ' <span class="keyline">' + (lang === 'ur' ? 'درست جواب' : 'Ans') + ': ' + 'abcdefgh'[ck] + '</span>' : '';
          return '<li class="q-item"><span class="q-no">' + qnum(start + qi, dir) + '</span><div class="q-text"' + da(q.text, dir) + '>' + blanks2(q.text) + key + '<div class="q-opts" dir="' + dir + '">' + opts + '</div></div></li>';
        }).join('') + '</ul>'; break;
      case 'fill':
        h += '<ul class="q-list">' + items.map(function (x, k) { return '<li class="q-item"><span class="q-no">' + qnum(start + k, dir) + '</span><div class="q-text"' + da(x, dir) + '>' + blanks(x) + '</div></li>'; }).join('') + '</ul>'; break;
      case 'tf':
        h += '<ul class="q-list">' + items.map(function (x, k) { return '<li class="q-item"><span class="q-no">' + qnum(start + k, dir) + '</span><div class="q-text"' + da(x, dir) + '>' + nl(x) + ' &nbsp; <span class="tf-box"></span></div></li>'; }).join('') + '</ul>'; break;
      case 'match':
        var n = Math.max(s.left.length, s.right.length), rows = '';
        for (i = 0; i < n; i++) rows += '<div' + da(s.left[i], dir) + '>' + PMath.text(s.left[i] || '') + '</div><div' + da(s.right[i], dir) + '>' + PMath.text(s.right[i] || '') + '</div>';
        h += '<div class="match"><b>' + t.col_a + '</b><b>' + t.col_b + '</b>' + rows + '</div>'; break;
      case 'short': case 'long':
        h += '<ul class="q-list">' + items.map(function (x, k) { return '<li class="q-item"><span class="q-no">' + qnum(start + k, dir) + '</span><div class="q-text"' + da(x, dir) + '>' + nl(x) + (s.lines ? lines(s.lines) : (s.type === 'long' ? '<div class="ans-space"></div>' : '')) + '</div></li>'; }).join('') + '</ul>'; break;
      case 'sentence':
        h += '<div style="margin:2px 0 8px;margin-inline-start:26px;display:flex;flex-wrap:wrap;gap:4px 22px">' + items.filter(Boolean).map(function (x) { return '<span' + da(x, dir) + '>' + PMath.text(x) + '</span>'; }).join('') + '</div>'; break;
      case 'math':
        h += '<ul class="q-list">' + items.map(function (it, k) {
          it = typeof it === 'string' ? { text: it, eq: '', lines: 0 } : it;
          return '<li class="q-item"><span class="q-no">' + qnum(start + k, dir) + '</span><div class="q-text"' + da(it.text, dir) + '>' + (it.text ? PMath.text(it.text) : '') +
            (it.eq ? PMath.equation(it.eq) : '') + (it.lines ? lines(it.lines) : '') + '</div></li>';
        }).join('') + '</ul>'; break;
      case 'rearrange':
        h += '<ul class="q-list">' + items.map(function (x, k) { return '<li class="q-item"><span class="q-no">' + qnum(start + k, dir) + '</span><div class="q-text"' + da(x, dir) + '>' + nl(x) + '</div></li>'; }).join('') + '</ul>'; break;
      case 'table':
        h += '<table class="p-table">' + s.rows.map(function (r, ri) {
          var tag = s.header && ri === 0 ? 'th' : 'td';
          return '<tr>' + r.map(function (c) { return '<' + tag + da(c, dir) + '>' + nl(c) + '</' + tag + '>'; }).join('') + '</tr>';
        }).join('') + '</table>'; break;
      case 'passage':
        h += '<div class="passage">' + nl(s.passage) + '</div><ul class="q-list">' + items.map(function (x, k) { return '<li class="q-item"><span class="q-no">' + qnum(start + k, dir) + '</span><div class="q-text"' + da(x, dir) + '>' + nl(x) + (s.lines ? lines(s.lines) : '') + '</div></li>'; }).join('') + '</ul>'; break;
      case 'instr': case 'custom':
        h += '<div class="custom">' + nl(s.text) + '</div>'; break;
    }
    return h + '</div>';
  }
  function blanks2(text) { return PMath.text(text, { blanks: true }); }

  function render(paper, opts) {
    window.__showKeys = !!(opts && opts.showKeys);
    var S = paper.settings, sh = paper.show, lang = paper.lang, t = Translations.get(lang);
    var h = '<div class="paper ' + lang + '" dir="' + t.dir + '">';
    if (sh.logo && S.logo) h += '<img class="p-logo" src="' + esc(S.logo) + '" alt="Logo">';
    if (sh.school && S.school) h += '<div class="p-school">' + esc(S.school) + '</div>';
    var exam = S.examName || '';
    if (sh.examName && exam) h += '<div class="p-title' + (hasArabic(exam) ? '' : ' lang-en') + '" dir="' + (hasArabic(exam) ? t.dir : 'ltr') + '">' + esc(exam) + (sh.academicYear && S.academicYear ? ' ' + esc(S.academicYear) : '') + '</div>';
    else if (sh.academicYear && S.academicYear) h += '<div class="p-title">' + esc(S.academicYear) + '</div>';
    if (sh.chapter && S.chapter) h += '<div class="p-school" style="font-size:16px;margin-bottom:6px">' + esc(S.chapter) + '</div>';

    var meta = [];
    function m(show, label, val) { if (show && val) meta.push('<span class="meta-item">' + label + ': <bdi>' + esc(val) + '</bdi></span>'); }
    m(sh.className, t.class_label, window.Classes ? Classes.display(S.className, lang) : S.className); m(sh.subject, t.subject, S.subject);
    m(sh.date, t.date, fmtDate(S.date)); m(sh.duration, t.duration, S.duration);
    m(sh.totalMarks, t.marks, S.totalMarks); m(sh.passingMarks, t.passing, S.passingMarks);
    if (sh.studentName) meta.push('<span class="meta-item">' + t.name_label + ': ' + '<span class="blank" style="min-width:130px"></span></span>');
    if (sh.rollNo) meta.push('<span class="meta-item">' + t.roll + ': ' + '<span class="blank" style="min-width:70px"></span></span>');
    if (meta.length) h += '<div class="p-meta">' + meta.join('') + '</div>';
    if (sh.instructions && S.instructions) h += '<div class="p-instr"><b>' + t.instructions + ':</b> ' + nl(S.instructions) + '</div>';

    var qNo = 0;
    paper.sections.forEach(function (s) {
      if (!s.enabled) return;
      if (['instr', 'custom'].indexOf(s.type) < 0) qNo++;
      h += renderSection(s, qNo, lang);
    });
    if (!paper.sections.some(function (s) { return s.enabled; })) h += '<p class="muted" style="text-align:center;margin-top:40px">Add sections to see them here.</p>';
    if (sh.preparedBy && S.preparedBy) h += '<div class="p-footer"><span>' + t.prepared + ': ' + esc(S.preparedBy) + '</span><span></span></div>';
    return h + '</div>';
  }

  // yyyy-mm-dd (from the date picker) -> dd-mm-yyyy on the paper
  function fmtDate(d) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(d || '')); return m ? m[3] + '-' + m[2] + '-' + m[1] : d; }

  // Renders the auto-translated version when the paper has "Auto-translate preview" switched on
  // (uses translations already cached; missing ones show in the original language until fetched).
  function renderAuto(paper, opts) {
    if (paper.autoTranslate && window.Translator) return render(window.Translator.view(paper).paper, opts);
    return render(paper, opts);
  }

  /* Scale the A4 paper (794px) down to fit the preview / view area on any screen, so phones and
     tablets see the whole width without sideways scrolling. Runs on resize and whenever pages change. */
  function fitPapers() {
    document.querySelectorAll('.b-preview, .view-stage').forEach(function (box) {
      var wrap = box.querySelector('.paper-wrap'); if (!wrap || !box.clientWidth) return;
      var cs = getComputedStyle(box), avail = box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      var z = Math.min(1, avail / 794);
      wrap.style.zoom = z < 0.999 ? String(Math.max(0.2, z).toFixed(4)) : '';
      var banner = box.querySelector('.tr-banner'); if (banner) banner.style.width = z < 0.999 ? 'auto' : '';
    });
  }
  var fitQueued = false;
  function queueFit() { if (fitQueued) return; fitQueued = true; requestAnimationFrame(function () { fitQueued = false; fitPapers(); }); }
  window.addEventListener('resize', queueFit);
  window.addEventListener('orientationchange', queueFit);
  document.addEventListener('DOMContentLoaded', function () {
    var root = document.getElementById('root');
    if (root && window.MutationObserver) new MutationObserver(queueFit).observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-tab', 'class'] });
    queueFit();
  });

  window.PaperRenderer = { render: render, renderAuto: renderAuto, esc: esc, fit: fitPapers };
})();
