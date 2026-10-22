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
          var opts = q.options.filter(function (o) { return o !== ''; }).map(function (o, oi) { return '<span>(' + 'abcdefgh'[oi] + ') ' + PMath.text(o) + '</span>'; }).join('');
          var key = (s.showKey || window.__showKeys) && q.correct >= 0 ? ' <span class="keyline">' + (lang === 'ur' ? 'درست جواب' : 'Ans') + ': ' + 'abcdefgh'[q.correct] + '</span>' : '';
          return '<li class="q-item"><span class="q-no">' + qnum(start + qi, dir) + '</span><div class="q-text">' + blanks2(q.text) + key + '<div class="q-opts">' + opts + '</div></div></li>';
        }).join('') + '</ul>'; break;
      case 'fill':
        h += '<ul class="q-list">' + items.map(function (x, k) { return '<li class="q-item"><span class="q-no">' + qnum(start + k, dir) + '</span><div class="q-text">' + blanks(x) + '</div></li>'; }).join('') + '</ul>'; break;
      case 'tf':
        h += '<ul class="q-list">' + items.map(function (x, k) { return '<li class="q-item"><span class="q-no">' + qnum(start + k, dir) + '</span><div class="q-text">' + nl(x) + ' &nbsp; <span class="tf-box"></span></div></li>'; }).join('') + '</ul>'; break;
      case 'match':
        var n = Math.max(s.left.length, s.right.length), rows = '';
        for (i = 0; i < n; i++) rows += '<div>' + PMath.text(s.left[i] || '') + '</div><div>' + PMath.text(s.right[i] || '') + '</div>';
        h += '<div class="match"><b>' + t.col_a + '</b><b>' + t.col_b + '</b>' + rows + '</div>'; break;
      case 'short': case 'long':
        h += '<ul class="q-list">' + items.map(function (x, k) { return '<li class="q-item"><span class="q-no">' + qnum(start + k, dir) + '</span><div class="q-text">' + nl(x) + (s.lines ? lines(s.lines) : (s.type === 'long' ? '<div class="ans-space"></div>' : '')) + '</div></li>'; }).join('') + '</ul>'; break;
      case 'sentence':
        h += '<div style="margin:2px 0 8px 26px;display:flex;flex-wrap:wrap;gap:4px 22px">' + items.filter(Boolean).map(function (x) { return '<span>' + PMath.text(x) + '</span>'; }).join('') + '</div>'; break;
      case 'math':
        h += '<ul class="q-list">' + items.map(function (it, k) {
          it = typeof it === 'string' ? { text: it, eq: '', lines: 0 } : it;
          return '<li class="q-item"><span class="q-no">' + qnum(start + k, dir) + '</span><div class="q-text">' + (it.text ? PMath.text(it.text) : '') +
            (it.eq ? PMath.equation(it.eq) : '') + (it.lines ? lines(it.lines) : '') + '</div></li>';
        }).join('') + '</ul>'; break;
      case 'rearrange':
        h += '<ul class="q-list">' + items.map(function (x, k) { return '<li class="q-item"><span class="q-no">' + qnum(start + k, dir) + '</span><div class="q-text">' + nl(x) + '</div></li>'; }).join('') + '</ul>'; break;
      case 'table':
        h += '<table class="p-table">' + s.rows.map(function (r, ri) {
          var tag = s.header && ri === 0 ? 'th' : 'td';
          return '<tr>' + r.map(function (c) { return '<' + tag + '>' + nl(c) + '</' + tag + '>'; }).join('') + '</tr>';
        }).join('') + '</table>'; break;
      case 'passage':
        h += '<div class="passage">' + nl(s.passage) + '</div><ul class="q-list">' + items.map(function (x, k) { return '<li class="q-item"><span class="q-no">' + qnum(start + k, dir) + '</span><div class="q-text">' + nl(x) + (s.lines ? lines(s.lines) : '') + '</div></li>'; }).join('') + '</ul>'; break;
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
    function m(show, label, val) { if (show && val) meta.push('<span class="meta-item">' + label + ': ' + esc(val) + '</span>'); }
    m(sh.className, t.class_label, S.className); m(sh.subject, t.subject, S.subject);
    m(sh.date, t.date, S.date); m(sh.duration, t.duration, S.duration);
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

  window.PaperRenderer = { render: render, esc: esc };
})();
