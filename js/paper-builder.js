/* paper-builder.js — data model, sample papers, and the interactive editor.
   The `paper` object is the single source of truth used by both the editor and the live preview. */
(function () {
  var uid = function (p) { return (p || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  var clone = function (o) { return JSON.parse(JSON.stringify(o)); };

  var TYPES = ['mcq', 'math', 'fill', 'tf', 'match', 'short', 'long', 'sentence', 'rearrange', 'table', 'passage', 'instr', 'custom'];
  var QUESTION_TYPES = ['mcq', 'math', 'fill', 'tf', 'match', 'short', 'long', 'sentence', 'rearrange', 'table', 'passage'];

  function newSection(type, lang) {
    var t = Translations.get(lang || 'en');
    var s = { id: uid('s'), type: type, title: t.types[type], marks: '', enabled: true, lang: '', startNo: 1, showTitle: true };
    switch (type) {
      case 'mcq': s.questions = [{ text: '', options: ['', '', '', ''], correct: -1 }]; s.showKey = false; break;
      case 'math': s.items = [{ text: '', eq: '', lines: 3 }]; break;
      case 'fill': case 'tf': case 'rearrange': case 'sentence': s.items = ['']; break;
      case 'match': s.left = ['', '']; s.right = ['', '']; break;
      case 'short': s.items = ['']; s.lines = 2; break;
      case 'long': s.items = ['']; s.lines = 6; break;
      case 'table': s.rows = [['', '', ''], ['', '', '']]; s.header = false; break;
      case 'passage': s.passage = ''; s.items = ['']; s.lines = 2; break;
      case 'instr': case 'custom': s.text = ''; break;
    }
    if (type === 'instr' || type === 'custom') s.showTitle = true;
    return s;
  }

  function newPaper(ownerId, lang) {
    var now = new Date().toISOString();
    return {
      id: uid('p'), ownerId: ownerId, createdAt: now, updatedAt: now, lang: lang || 'en', showKeys: false, autoTranslate: false,
      settings: { title: 'Untitled Paper', examName: '', academicYear: '', className: '', subject: '', chapter: '', date: '', duration: '', totalMarks: '', passingMarks: '', school: '', instructions: '', preparedBy: '', logo: '' },
      show: { school: true, logo: true, examName: true, academicYear: false, className: true, subject: true, chapter: false, date: false, duration: true, totalMarks: true, passingMarks: false, studentName: true, rollNo: false, instructions: false, preparedBy: false },
      sections: []
    };
  }

  function sampleEnglish(owner) {
    var p = newPaper(owner, 'en');
    p.settings.title = 'Grade 6 English — Final Term';
    p.settings.examName = 'Final term Exam 2021-22'; p.settings.className = 'Class 6'; p.settings.subject = 'English A'; p.settings.totalMarks = '75';
    p.show.duration = false;
    var f = newSection('fill', 'en'); f.title = 'Fill in the blanks.';
    f.items = ['The ________ for road accidents is not so severe.', 'A regular ________ Showed also be started.', 'Sports promote ________.', 'We ________ out for recreation.', 'The ________ of sports are unexpected.'];
    var m = newSection('match', 'en'); m.title = 'Match the column A with Column B.';
    m.left = ['Donkey', 'Stars', 'Bomb', 'Lion', 'Sea']; m.right = ['Calm', 'exploded', 'brayed', 'twinkled', 'roar'];
    var w = newSection('sentence', 'en'); w.title = 'Make sentence of the following words.';
    w.items = ['Companion', 'Pleasant', 'Delight', 'believe', 'narrow', 'Sports', 'lesson', 'verses', 'worship'];
    var r = newSection('rearrange', 'en'); r.title = 'Rearrange the following.';
    r.items = ['Go out to hens wanted he.', 'Water of pool a in slipped hans.', 'Made sack a carry him.', 'Han to came miller one night.', 'Selfish was he.'];
    var a = newSection('short', 'en'); a.title = 'Answer of the following question.'; a.lines = 1;
    a.items = ['Who was miller died?', 'Was miler selfish man?', 'What are advantages of walking?', 'How can we solve the problem of traffic?', 'What is the problem of big cities?', 'How many elements are there in sports?', 'Where was hazrat umar (RA) buried?'];
    p.sections = [f, m, w, r, a];
    return p;
  }

  function sampleUrdu(owner) {
    var p = newPaper(owner, 'ur');
    p.settings.title = 'Grade 6 Science Examination';
    p.settings.examName = 'LESSON BASED ASSESSMENT 2025-26'; p.settings.className = 'Class 6'; p.settings.subject = 'سائنس';
    p.settings.chapter = 'سبق 8: پانی کی حالتوں کو جاننے کا سفر'; p.settings.duration = '40 منٹ'; p.settings.totalMarks = '20'; p.settings.preparedBy = 'SYED RASOOL';
    p.show.chapter = true; p.show.preparedBy = true;
    var q = newSection('mcq', 'ur'); q.title = 'ذیل میں دیے گئے چار متبادل جوابات میں سے صحیح جواب کا انتخاب کر کے لکھیے۔'; q.marks = '1 × 6 = 6';
    q.questions = [
      { text: 'پانی کی تین حالتیں کون سی ہیں؟', options: ['برف،پانی،تیل', 'ٹھوس،نیم ٹھوس،گیس', 'ٹھوس،مائع،گیس', 'برف،بادل،بھانپ'], correct: 2 },
      { text: 'پانی کی وہ حالت جو اپنے برتن کی شکل اختیار کر لیتی ہے لیکن اس کا حجم متعین ہوتا ہے۔', options: ['ٹھوس', 'مائع', 'گیس', 'پلازمہ'], correct: 1 },
      { text: 'جب آبی بخارات ٹھنڈے ہوتے ہیں تو وہ کیا بن جاتے ہیں؟', options: ['برف', 'دھند', 'پانی', 'برف باری'], correct: 2 },
      { text: 'بھانپ کیا ہے؟', options: ['پانی کی رقیق حالت', 'پانی کی ٹھوس حالت', 'آبی بخارات', 'برف'], correct: 2 },
      { text: 'تبخیر کا عمل کب جلدی ہوتا ہے؟', options: ['جب بادل آتے ہوں', 'جب گرم ہوا چلتی ہو', 'جب درجہ حرارت کم ہو', 'ان میں سے کوئی نہیں'], correct: 1 },
      { text: '________ دھند بنتی ہے۔', options: ['بخارات سے', 'مجمد ہونے سے', 'پگھلنے سے', 'تکثیف سے'], correct: 3 }
    ];
    var t = newSection('table', 'ur'); t.title = 'مندرجہ ذیل عمل کے نام لکھیے۔'; t.marks = '1 × 4 = 4'; t.showTitle = true;
    t.rows = [['7', 'شیشے کے گلاس کی بیرونی سطح پر پانی کے قطرے ہوتے ہیں۔', ''], ['8', 'پانی کو برف میں تبدیل کرنے کا عمل۔', ''], ['9', 'وہ عمل جس میں پانی بخارات میں تبدیل ہوتا ہے۔', ''], ['10', 'ٹھوس چیزوں کا گیسی حالت میں تبدیل ہونا۔', '']];
    var s = newSection('short', 'ur'); s.title = 'درج ذیل سوالات کے دو یا تین جملوں میں جواب دیں۔'; s.marks = '2 × 3 = 6'; s.startNo = 11; s.lines = 2;
    s.items = ['ایسی چند حالتیں بتائیں جو پانی کی تبخیر کو متاثر کرتی ہیں؟'];
    p.sections = [q, t, s];
    return p;
  }

  function sampleMath(owner) {
    var p = newPaper(owner, 'en');
    p.settings.title = 'Grade 8 Mathematics — Term Test';
    p.settings.examName = 'Mathematics Term Test'; p.settings.className = 'Class 8'; p.settings.subject = 'Mathematics'; p.settings.duration = '60 minutes'; p.settings.totalMarks = '25';
    var q = newSection('mcq', 'en'); q.title = 'Choose the correct answer.'; q.marks = '1 × 4 = 4'; q.showKey = false;
    q.questions = [
      { text: 'The value of $\\frac{3}{4} + \\frac{1}{2}$ is', options: ['$\\frac{5}{4}$', '$\\frac{4}{6}$', '$\\frac{4}{8}$', '$1$'], correct: 0 },
      { text: '$\\sqrt{144} =$', options: ['12', '14', '16', '72'], correct: 0 },
      { text: 'Simplify: $(2x^{3})^{2}$', options: ['$4x^{6}$', '$2x^{6}$', '$4x^{5}$', '$2x^{5}$'], correct: 0 },
      { text: 'The sum of the angles of a triangle is', options: ['$90°$', '$180°$', '$270°$', '$360°$'], correct: 1 }
    ];
    var m = newSection('math', 'en'); m.title = 'Solve the following equations.'; m.marks = '2 × 3 = 6'; m.startNo = 1;
    m.items = [
      { text: 'Solve for $x$.', eq: '2x + 5 = 17', lines: 3 },
      { text: 'Solve by factorisation.', eq: 'x^{2} - 5x + 6 = 0', lines: 4 },
      { text: 'Find the value of $x$.', eq: '\\frac{x}{3} + 2 = 5', lines: 3 },
      { text: 'Use the quadratic formula to solve $x^{2} + 4x - 5 = 0$.', eq: 'x = \\frac{-b \\pm \\sqrt{b^{2} - 4ac}}{2a}', lines: 4 }
    ];
    m.marks = '4 × 2 = 8';
    var f = newSection('fill', 'en'); f.title = 'Fill in the blanks.'; f.marks = '1 × 3 = 3';
    f.items = ['The area of a circle of radius $r$ is $\\pi r^{2}$. If $r = 7$ cm, the area is ______ cm$^{2}$ (use $\\pi = \\frac{22}{7}$).', '$\\sqrt{81} =$ ______', '$(a + b)^{2} = a^{2} + $ ______ $+ b^{2}$'];
    var t = newSection('tf', 'en'); t.title = 'Write True or False.'; t.marks = '1 × 3 = 3';
    t.items = ['$\\frac{2}{3} > \\frac{3}{4}$', '$5^{0} = 1$', '$\\sqrt{2}$ is a rational number.'];
    var l = newSection('long', 'en'); l.title = 'Answer the following question.'; l.marks = '5'; l.lines = 7;
    l.items = ['Prove that the sum of the interior angles of a quadrilateral is $360°$. Show all steps.'];
    p.sections = [q, m, f, t, l];
    return p;
  }

  /* ------------ class templates: English, Urdu and Mathematics for every class (Nursery → 2nd Year) ------------
     Each template has the sections, number of questions, marks, time and instructions that fit the class level.
     Question texts are short placeholders ("Question 1" / "سوال 1") for the teacher to replace.
     A section spec is [type, how many, marks each, attempt-any (optional), variant (optional)]. */
  var LEVELS = {
    early:   { marks: 20,  time: ['30 minutes', '30 منٹ'], lines: 1, opts: 3, eq: '2 + 3 =' },
    primary: { marks: 30,  time: ['1 hour', '1 گھنٹہ'], lines: 1, opts: 3, eq: '25 + 37 =' },
    upper:   { marks: 50,  time: ['1 hour 30 minutes', 'ڈیڑھ گھنٹہ'], lines: 2, opts: 4, eq: '\\frac{1}{2} + \\frac{1}{4} =' },
    middle:  { marks: 75,  time: ['2 hours 30 minutes', 'ڈھائی گھنٹے'], lines: 3, opts: 4, eq: '2x + 5 = 15' },
    matric:  { marks: 75,  time: ['3 hours', '3 گھنٹے'], lines: 0, opts: 4, board: true, eq: 'x^{2} - 5x + 6 = 0' },
    inter:   { marks: 100, time: ['3 hours', '3 گھنٹے'], lines: 0, opts: 4, board: true, eq: '\\int_{0}^{1} x^{2}\\,dx' }
  };
  // language papers (English and Urdu use the same layout)
  var LANG_SPEC = {
    early:   [['fill', 4, 1], ['match', 4, 1], ['mcq', 4, 1], ['short', 4, 2]],
    primary: [['mcq', 5, 1], ['fill', 5, 1], ['match', 5, 1], ['sentence', 5, 1], ['short', 5, 2]],
    upper:   [['mcq', 10, 1], ['fill', 5, 1], ['rearrange', 5, 1], ['sentence', 5, 2], ['passage', 5, 2], ['long', 2, 5]],
    middle:  [['mcq', 15, 1], ['fill', 5, 1], ['sentence', 5, 2], ['passage', 5, 2], ['short', 5, 3], ['long', 2, 10]],
    matric:  [['mcq', 15, 1], ['short', 14, 2, 10], ['passage', 5, 2], ['long', 4, 10, 3]],
    inter:   [['mcq', 20, 1], ['short', 15, 2, 10], ['passage', 5, 2], ['long', 7, 10, 5]]
  };
  var MATH_SPEC = {
    early:   [['math', 4, 2], ['fill', 4, 1], ['match', 4, 1], ['mcq', 4, 1]],
    primary: [['mcq', 5, 1], ['fill', 5, 1], ['tf', 5, 1], ['math', 5, 3]],
    upper:   [['mcq', 10, 1], ['fill', 5, 1], ['tf', 5, 1], ['math', 5, 2], ['math', 4, 5, 0, 'word']],
    middle:  [['mcq', 15, 1], ['fill', 5, 1], ['tf', 5, 1], ['math', 10, 3], ['math', 4, 5, 0, 'word']],
    matric:  [['mcq', 15, 1], ['math', 20, 2, 15], ['math', 5, 10, 3, 'long']],
    inter:   [['mcq', 20, 1], ['math', 30, 2, 20], ['math', 8, 8, 5, 'long']]
  };
  var SUBJECTS = {
    english: { name: ['English', 'انگریزی'], lang: 'en' },
    urdu:    { name: ['Urdu', 'اردو'], lang: 'ur' },
    math:    { name: ['Mathematics', 'ریاضی'], lang: null }          // English or Urdu medium
  };
  function levelOf(cls) {
    if (cls === 'Nursery' || cls === 'KG') return 'early';
    var m = /^Class (\d+)$/.exec(cls); if (m) { var n = +m[1]; return n <= 2 ? 'primary' : n <= 5 ? 'upper' : n <= 8 ? 'middle' : 'matric'; }
    return 'inter';
  }
  var INSTR = {
    early: ['Listen carefully and do your work neatly.', 'غور سے سنیں اور صاف ستھرا کام کریں۔'],
    primary: ['Attempt all questions. Write neatly.', 'تمام سوالات حل کریں۔ صاف لکھیں۔'],
    upper: ['Attempt all questions. Read each question carefully before answering.', 'تمام سوالات حل کریں۔ جواب دینے سے پہلے ہر سوال غور سے پڑھیں۔'],
    middle: ['Attempt all questions. Marks are shown against each question.', 'تمام سوالات حل کریں۔ ہر سوال کے سامنے نمبر درج ہیں۔'],
    matric: ['Section A (objective) must be answered first. Attempt the required number of questions from Sections B and C.', 'حصہ معروضی پہلے حل کریں۔ حصہ ب اور ج سے مطلوبہ تعداد میں سوالات حل کریں۔'],
    inter: ['Section A (objective) must be answered first. Attempt the required number of questions from Sections B and C. Write your roll number on the answer sheet.', 'حصہ معروضی پہلے حل کریں۔ حصہ ب اور ج سے مطلوبہ تعداد میں سوالات حل کریں۔ جوابی کاپی پر اپنا رول نمبر لکھیں۔']
  };
  function specFor(cls, subject) { return (subject === 'math' ? MATH_SPEC : LANG_SPEC)[levelOf(cls)]; }

  function classTemplate(cls, subject, lang, owner) {
    subject = SUBJECTS[subject] ? subject : 'english';
    var subj = SUBJECTS[subject]; lang = subj.lang || (lang === 'ur' ? 'ur' : 'en');
    var ur = lang === 'ur', lv = levelOf(cls), L = LEVELS[lv], spec = specFor(cls, subject), isMath = subject === 'math';
    var p = newPaper(owner, lang);
    var clsName = (window.Classes ? Classes.label(cls) : cls).replace(/ \(.*\)$/, '');
    p.settings.title = clsName + ' — ' + subj.name[0] + (isMath && ur ? ' (Urdu medium)' : '');
    p.settings.examName = ur ? 'سالانہ امتحان' : 'Annual Examination';
    p.settings.className = cls; p.settings.subject = subj.name[ur ? 1 : 0];
    p.settings.duration = L.time[ur ? 1 : 0]; p.settings.totalMarks = String(L.marks);
    p.settings.instructions = INSTR[lv][ur ? 1 : 0];
    p.show.instructions = true; p.show.rollNo = true; p.show.date = !!L.board;
    var Q = ur ? 'سوال' : 'Question', OPT = ur ? ['جواب الف', 'جواب ب', 'جواب ج', 'جواب د'] : ['Option A', 'Option B', 'Option C', 'Option D'];
    var num = 0;
    p.sections = spec.map(function (sp, si) {
      var type = sp[0], n = sp[1], each = sp[2], attempt = sp[3] || 0, variant = sp[4] || '';
      var s = newSection(type, lang), items = [], i;
      for (i = 1; i <= n; i++) items.push(i);
      var q = function (k) { return Q + ' ' + (num + k); };
      s.startNo = num + 1;
      if (type === 'mcq') {
        s.title = ur ? 'درست جواب کا انتخاب کریں۔' : 'Choose the correct answer.';
        s.questions = items.map(function (k) { return { text: q(k), options: OPT.slice(0, L.opts), correct: -1 }; });
      } else if (type === 'fill') {
        s.title = ur ? 'خالی جگہ پُر کریں۔' : 'Fill in the blanks.';
        s.items = items.map(function (k) { return lv === 'early' && !isMath ? (ur ? 'ا ب ______ ت' : 'A B ______ D') : lv === 'early' ? '1, 2, ______, 4' : (ur ? 'جملہ ' : 'Sentence ') + (num + k) + ' ______'; });
      } else if (type === 'tf') {
        s.title = ur ? 'درست یا غلط لکھیں۔' : 'Write True or False.';
        s.items = items.map(function (k) { return (ur ? 'بیان ' : 'Statement ') + (num + k); });
      } else if (type === 'match') {
        s.title = ur ? 'کالم الف کو کالم ب سے ملائیں۔' : 'Match Column A with Column B.';
        s.left = items.map(function (k) { return (ur ? 'الف ' : 'A') + k; }); s.right = items.map(function (k) { return (ur ? 'ب ' : 'B') + k; });
        s.startNo = 1;
      } else if (type === 'sentence') {
        s.title = ur ? 'درج ذیل الفاظ کے جملے بنائیں۔' : 'Make sentences with the following words.';
        s.items = items.map(function (k) { return (ur ? 'لفظ ' : 'Word ') + k; });
      } else if (type === 'rearrange') {
        s.title = ur ? 'درج ذیل جملوں کو ترتیب دیں۔' : 'Rearrange the following sentences.';
        s.items = items.map(function (k) { return (ur ? 'بے ترتیب جملہ ' : 'Jumbled sentence ') + (num + k); });
      } else if (type === 'passage') {
        s.title = ur ? 'عبارت پڑھ کر سوالات کے جوابات دیں۔' : 'Read the passage and answer the questions.';
        s.passage = ur ? 'یہاں عبارت لکھیں یا چسپاں کریں۔' : 'Write or paste the passage here.';
        s.items = items.map(q); s.lines = Math.max(L.lines, 1);
      } else if (type === 'math') {
        var word = variant === 'word';
        s.title = attempt ? (ur ? 'کوئی سے ' + attempt + ' سوالات حل کریں۔' : 'Solve any ' + attempt + ' questions.')
          : word ? (ur ? 'عبارتی سوالات حل کریں۔' : 'Solve the word problems.') : (ur ? 'درج ذیل سوالات حل کریں۔' : 'Solve the following.');
        s.items = items.map(function (k) { return { text: word ? (ur ? 'عبارتی سوال ' : 'Word problem ') + (num + k) : q(k), eq: word ? '' : L.eq, lines: L.board ? 0 : (word ? Math.max(L.lines, 2) + 2 : Math.max(L.lines, 2)) }; });
      } else {   // short / long
        if (attempt) s.title = ur ? 'کوئی سے ' + attempt + ' سوالات کے ' + (type === 'short' ? 'مختصر' : 'تفصیلی') + ' جوابات لکھیں۔' : (type === 'short' ? 'Write short answers to any ' + attempt + ' questions.' : 'Attempt any ' + attempt + ' questions.');
        else if (type === 'long' && !isMath) s.title = ur ? 'مضمون یا خط لکھیں۔' : 'Write an essay or a letter.';
        else s.title = ur ? (type === 'short' ? 'درج ذیل سوالات کے مختصر جوابات لکھیں۔' : 'درج ذیل سوالات کے تفصیلی جوابات لکھیں۔') : (type === 'short' ? 'Answer the following questions briefly.' : 'Answer the following questions in detail.');
        s.items = items.map(type === 'long' && !isMath && !attempt ? function (k) { return (ur ? 'عنوان ' : 'Topic ') + k; } : q);
        s.lines = type === 'long' ? (L.lines ? L.lines * 3 : 0) : L.lines;
      }
      var count = attempt || n;
      s.marks = count + ' × ' + each + ' = ' + (count * each);
      if (L.board) {
        var sec = si === 0 ? 0 : si === spec.length - 1 ? 2 : 1;
        s.title = (ur ? ['حصہ الف (معروضی)', 'حصہ ب', 'حصہ ج'] : ['Section A (Objective)', 'Section B', 'Section C'])[sec] + ' — ' + s.title;
      }
      if (type !== 'match') num += n;
      return s;
    });
    return p;
  }
  function templateInfo(cls, subject) {
    var spec = specFor(cls, subject), L = LEVELS[levelOf(cls)];
    return { marks: L.marks, time: L.time[0], sections: spec.length, questions: spec.reduce(function (n, sp) { return n + sp[1]; }, 0), board: !!L.board };
  }

  /* ------------ path helpers ------------ */
  function getAt(obj, path) { return path.split('.').reduce(function (o, k) { return o == null ? o : o[k]; }, obj); }
  function setAt(obj, path, val) {
    var parts = path.split('.'), last = parts.pop();
    var target = parts.reduce(function (o, k) { return o[k]; }, obj);
    target[last] = val;
  }

  /* ------------ editor templates ------------ */
  var SHOW_FIELDS = [
    ['school', 'School / academy'], ['logo', 'Logo'], ['examName', 'Exam name'], ['academicYear', 'Academic year'], ['className', 'Class'], ['subject', 'Subject'],
    ['chapter', 'Chapter / lesson'], ['date', 'Date'], ['duration', 'Duration'], ['totalMarks', 'Total marks'], ['passingMarks', 'Passing marks'],
    ['studentName', 'Student name line'], ['rollNo', 'Roll number line'], ['instructions', 'Instructions'], ['preparedBy', 'Prepared by']
  ];

  function fld(label, path, val, o) {
    o = o || {};
    var input = o.area
      ? '<textarea data-p="' + path + '" rows="' + (o.rows || 3) + '"' + (o.rtl ? ' dir="auto"' : '') + '>' + esc(val) + '</textarea>'
      : '<input type="' + (o.type || 'text') + '" data-p="' + path + '" value="' + esc(val) + '" dir="auto"' + (o.ph ? ' placeholder="' + esc(o.ph) + '"' : '') + '>';
    return '<div class="field"><label>' + label + '</label>' + input + '</div>';
  }
  function miniInput(path, val, o) {
    o = o || {};
    return '<' + (o.area ? 'textarea rows="2"' : 'input type="text"') + ' class="inp" dir="auto" data-p="' + path + '"' + (o.ph ? ' placeholder="' + esc(o.ph) + '"' : '') + (o.area ? '>' + esc(val) + '</textarea>' : ' value="' + esc(val) + '">');
  }
  function btn(act, label, attrs, cls) { return '<button type="button" class="btn small ' + (cls || 'ghost') + '" data-act="' + act + '" ' + (attrs || '') + '>' + label + '</button>'; }
  function ibtn(act, label, attrs, title) { return '<button type="button" class="icon-btn" data-act="' + act + '" ' + (attrs || '') + ' title="' + (title || '') + '" aria-label="' + (title || label) + '">' + label + '</button>'; }

  function stringList(base, arr, opts) {
    opts = opts || {};
    var h = arr.map(function (v, i) {
      return '<div class="item-row"><span class="num">' + (i + 1) + '</span>' + miniInput(base + '.' + i, v, { area: opts.area, ph: opts.ph }) +
        ibtn('del-item', '✕', 'data-base="' + base + '" data-i="' + i + '"', 'Remove item') + '</div>';
    }).join('');
    return h + btn('add-item', '+ ' + (opts.addLabel || 'Add item'), 'data-base="' + base + '"');
  }

  function sectionBody(s, si) {
    var b = 'sections.' + si, h = '';
    var qtype = QUESTION_TYPES.indexOf(s.type) >= 0;
    h += '<div class="row2"><div class="field" style="flex:1;min-width:160px;margin:0"><label>Section title</label><input type="text" dir="auto" data-p="' + b + '.title" value="' + esc(s.title) + '"></div>' +
      '<div class="field" style="width:120px;margin:0"><label>Marks (optional)</label><input type="text" data-p="' + b + '.marks" value="' + esc(s.marks) + '" placeholder="e.g. 5 or 1 × 5 = 5"></div></div>';
    h += '<div class="row2"><label class="check"><input type="checkbox" data-t="bool" data-p="' + b + '.showTitle"' + (s.showTitle !== false ? ' checked' : '') + '> Show title</label>' +
      '<label class="check">Language <select class="inp" data-p="' + b + '.lang"><option value=""' + (!s.lang ? ' selected' : '') + '>Same as paper</option><option value="en"' + (s.lang === 'en' ? ' selected' : '') + '>English</option><option value="ur"' + (s.lang === 'ur' ? ' selected' : '') + '>اردو (RTL)</option></select></label>' +
      (qtype && s.type !== 'table' ? '<label class="check">Start no. <input class="inp" type="number" min="1" style="width:64px" data-t="num" data-p="' + b + '.startNo" value="' + esc(s.startNo || 1) + '"></label>' : '') + '</div>';

    switch (s.type) {
      case 'mcq':
        h += '<label class="check" style="margin-bottom:8px"><input type="checkbox" data-t="bool" data-p="' + b + '.showKey"' + (s.showKey ? ' checked' : '') + '> Show correct answers (teacher copy)</label>';
        h += s.questions.map(function (q, qi) {
          var qb = b + '.questions.' + qi;
          return '<div class="q-box"><div class="item-row"><span class="num">' + (qi + 1) + '</span>' + miniInput(qb + '.text', q.text, { area: true, ph: 'Question text (use ___ for a blank)' }) +
            ibtn('del-item', '✕', 'data-base="' + b + '.questions" data-i="' + qi + '"', 'Delete question') + '</div>' +
            '<div class="opts">' + q.options.map(function (o, oi) {
              return '<div class="opt-line"><input type="radio" name="c_' + s.id + '_' + qi + '" data-t="correct" data-p="' + qb + '.correct" data-v="' + oi + '"' + (q.correct === oi ? ' checked' : '') + ' title="Mark as correct (teacher-only)" aria-label="Correct option ' + 'abcdefgh'[oi] + '">' +
                '<span>' + 'abcdefgh'[oi] + '</span>' + miniInput(qb + '.options.' + oi, o) + (q.options.length > 2 ? ibtn('del-opt', '✕', 'data-q="' + qb + '" data-i="' + oi + '"', 'Remove option') : '') + '</div>';
            }).join('') + '</div>' +
            '<div style="margin-top:6px">' + (q.options.length < 8 ? btn('add-opt', '+ Option', 'data-q="' + qb + '"') : '') + '</div></div>';
        }).join('');
        h += btn('add-q', '+ Add question', 'data-si="' + si + '"', 'primary');
        break;
      case 'math':
        h += '<p class="math-help" style="margin:0 0 8px">Put maths inside <code>$…$</code> in the question text. The equation box is shown centred under the question. Use the Math tools panel above to insert fractions, roots, powers and symbols.</p>';
        h += s.items.map(function (it, k) {
          var ib = b + '.items.' + k;
          return '<div class="q-box"><div class="item-row"><span class="num">' + (k + 1) + '</span>' + miniInput(ib + '.text', it.text, { area: true, ph: 'Question text, e.g. Solve for $x$.' }) +
            ibtn('del-item', '✕', 'data-base="' + b + '.items" data-i="' + k + '"', 'Delete question') + '</div>' +
            '<div class="field" style="margin:4px 0 6px 28px"><label>Equation (optional)</label><input type="text" class="inp mono" dir="ltr" data-math="1" data-p="' + ib + '.eq" value="' + esc(it.eq) + '" placeholder="e.g. \\frac{x}{3} + 2 = 5">' +
            '<div class="math-live">' + (it.eq ? PMath.equation(it.eq) : '<span class="muted" style="font-size:12px">Equation preview</span>') + '</div></div>' +
            '<div class="row2" style="margin-left:28px"><label class="check">Answer lines <input class="inp" type="number" min="0" max="20" style="width:64px" data-t="num" data-p="' + ib + '.lines" value="' + esc(it.lines) + '"></label></div></div>';
        }).join('');
        h += btn('add-math-q', '+ Add question', 'data-si="' + si + '"', 'primary');
        break;
      case 'fill': h += '<p class="muted" style="font-size:12px;margin:0 0 8px">Type ___ (underscores) where each blank should appear. Without underscores, one blank is added at the end.</p>' + stringList(b + '.items', s.items, { area: true, ph: 'Sentence with ___ blanks', addLabel: 'Add sentence' }); break;
      case 'tf': h += stringList(b + '.items', s.items, { area: true, ph: 'Statement', addLabel: 'Add statement' }); break;
      case 'rearrange': h += stringList(b + '.items', s.items, { ph: 'Jumbled sentence', addLabel: 'Add sentence' }); break;
      case 'sentence': h += '<p class="muted" style="font-size:12px;margin:0 0 8px">Each item is a word; words are shown together in a row.</p>' + stringList(b + '.items', s.items, { ph: 'Word', addLabel: 'Add word' }); break;
      case 'match':
        h += '<div class="two-col" style="gap:12px"><div><div class="lbl" style="margin-bottom:6px">Column A</div>' + stringList(b + '.left', s.left, { addLabel: 'Add to A' }) + '</div><div><div class="lbl" style="margin-bottom:6px">Column B</div>' + stringList(b + '.right', s.right, { addLabel: 'Add to B' }) + '</div></div>';
        break;
      case 'short': case 'long':
        h += '<div class="row2"><label class="check">Answer lines per question <input class="inp" type="number" min="0" max="20" style="width:64px" data-t="num" data-p="' + b + '.lines" value="' + esc(s.lines) + '"></label><span class="muted" style="font-size:12px">0 = no lines</span></div>';
        h += stringList(b + '.items', s.items, { area: true, ph: 'Question', addLabel: 'Add question' }); break;
      case 'passage':
        h += fld('Passage', b + '.passage', s.passage, { area: true, rows: 6 });
        h += '<div class="row2"><label class="check">Answer lines <input class="inp" type="number" min="0" max="20" style="width:64px" data-t="num" data-p="' + b + '.lines" value="' + esc(s.lines) + '"></label></div>';
        h += stringList(b + '.items', s.items, { area: true, ph: 'Question about the passage', addLabel: 'Add question' }); break;
      case 'table':
        h += '<label class="check" style="margin-bottom:8px"><input type="checkbox" data-t="bool" data-p="' + b + '.header"' + (s.header ? ' checked' : '') + '> First row is a header</label><div class="cell-grid"><table>' +
          s.rows.map(function (r, ri) {
            return '<tr>' + r.map(function (c, ci) { return '<td>' + miniInput(b + '.rows.' + ri + '.' + ci, c) + '</td>'; }).join('') + '<td>' + ibtn('del-row', '✕', 'data-si="' + si + '" data-i="' + ri + '"', 'Remove row') + '</td></tr>';
          }).join('') + '<tr>' + s.rows[0].map(function (c, ci) { return '<td style="text-align:center">' + (s.rows[0].length > 1 ? ibtn('del-col', '✕', 'data-si="' + si + '" data-i="' + ci + '"', 'Remove column') : '') + '</td>'; }).join('') + '<td></td></tr></table></div>';
        h += '<div class="row2" style="margin-top:8px">' + btn('add-row', '+ Row', 'data-si="' + si + '"') + btn('add-col', '+ Column', 'data-si="' + si + '"') + '</div>';
        break;
      case 'instr': case 'custom': h += fld(s.type === 'instr' ? 'Instructions text' : 'Text', b + '.text', s.text, { area: true, rows: 5 }); break;
    }
    return h;
  }

  function sectionHtml(s, si, total, open) {
    return '<div class="sec' + (s.enabled ? '' : ' disabled') + '" data-si="' + si + '">' +
      '<div class="sec-head"><span class="handle" title="Drag to reorder" aria-hidden="true">⠿</span>' +
      '<button type="button" class="title" data-act="sec-open" data-si="' + si + '" aria-expanded="' + !!open + '">' + (si + 1) + '. ' + esc(s.title || '(untitled)') + ' <span class="muted" style="font-weight:400">· ' + esc(Translations.get('en').types[s.type]) + '</span></button>' +
      ibtn('sec-up', '↑', 'data-si="' + si + '"' + (si === 0 ? ' disabled' : ''), 'Move up') + ibtn('sec-down', '↓', 'data-si="' + si + '"' + (si === total - 1 ? ' disabled' : ''), 'Move down') +
      ibtn('sec-toggle', s.enabled ? '👁' : '🚫', 'data-si="' + si + '"', s.enabled ? 'Disable section' : 'Enable section') +
      ibtn('sec-dup', '⧉', 'data-si="' + si + '"', 'Duplicate section') + ibtn('sec-del', '🗑', 'data-si="' + si + '"', 'Delete section') + '</div>' +
      '<div class="sec-body"' + (open ? '' : ' hidden') + '>' + sectionBody(s, si) + '</div></div>';
  }

  var MATH_TPL = [['a⁄b', '\\frac{|}{}', 'Fraction'], ['√', '\\sqrt{|}', 'Square root'], ['ⁿ√', '\\sqrt[|]{}', 'nth root'], ['xⁿ', '^{|}', 'Power / exponent'], ['xₙ', '_{|}', 'Subscript'],
    ['x̄', '\\overline{|}', 'Overline'], ['( )', '\\left( | \\right)', 'Large brackets'], ['∑', '\\sum_{|}^{}', 'Summation'], ['∫', '\\int_{|}^{}', 'Integral']];
  var MATH_SYM = ['×', '÷', '±', '≠', '≤', '≥', '≈', 'π', 'θ', 'α', 'β', 'γ', 'Δ', '∞', '°', '∠', '△', '⊥', '∥', '∴', '∵', '→', '∈', '∪', '∩', '∅', '%', '′'];
  var MATH_EQ = [['Quadratic', 'x^{2} + bx + c = 0'], ['Quadratic formula', 'x = \\frac{-b \\pm \\sqrt{b^{2} - 4ac}}{2a}'], ['Pythagoras', 'a^{2} + b^{2} = c^{2}'], ['Circle area', 'A = \\pi r^{2}'], ['Slope', 'm = \\frac{y_{2} - y_{1}}{x_{2} - x_{1}}']];
  function mathToolsHtml(open) {
    var b = function (kind, snip, label, title, cls) { return '<button type="button" class="mbtn ' + (cls || '') + '" data-act="math-ins" data-kind="' + kind + '" data-snip="' + esc(snip) + '" title="' + esc(title) + '" aria-label="' + esc(title) + '">' + label + '</button>'; };
    return '<details class="acc mtools" id="math-tools"' + (open ? ' open' : '') + '><summary>Math tools (equations &amp; symbols)</summary><div class="acc-body">' +
      '<p class="math-help" style="margin-top:0">Click inside any question field, then pick a button — it is inserted at the cursor. Maths goes between <code>$ $</code> (inline) or <code>$$ $$</code> (own line). Type <code>\\$</code> for a literal dollar sign.</p>' +
      '<div class="row-label">Structures</div><div class="mgrid">' + MATH_TPL.map(function (t) { return b('tpl', t[1], t[0], t[2]); }).join('') + '</div>' +
      '<div class="row-label">Symbols</div><div class="mgrid">' + MATH_SYM.map(function (t) { return b('sym', t, t, t); }).join('') + '</div>' +
      '<div class="row-label">Common equations</div><div class="mgrid">' + MATH_EQ.map(function (t) { return b('eq', t[1], t[0], t[1], 'wide'); }).join('') + '</div>' +
      '<p class="math-help">Typed examples: <code>\\frac{a}{b}</code> <code>\\sqrt{x}</code> <code>\\sqrt[3]{x}</code> <code>x^{2}</code> <code>x_{1}</code> <code>\\pi</code> <code>\\times</code> <code>\\leq</code> <code>\\theta</code> <code>\\overline{AB}</code> <code>\\text{cm}</code></p>' +
      '</div></details>';
  }

  function settingsHtml(p) {
    var S = p.settings, h = '';
    h += '<details class="acc" open><summary>Paper settings</summary><div class="acc-body">';
    h += '<div class="field"><label>Paper language / direction</label><select data-p="lang" data-rerender="1"><option value="en"' + (p.lang === 'en' ? ' selected' : '') + '>English (left-to-right)</option><option value="ur"' + (p.lang === 'ur' ? ' selected' : '') + '>اردو (right-to-left)</option></select></div>';
    h += fld('Paper title (internal / card name)', 'settings.title', S.title);
    h += fld('Exam name', 'settings.examName', S.examName, { ph: 'e.g. Lesson Based Assessment 2025-26' });
    var otherCls = S.className && !Classes.isStandard(S.className);
    h += '<div class="input-row">' + fld('Academic year', 'settings.academicYear', S.academicYear) +
      '<div class="field"><label for="b-class">Class</label><select id="b-class" data-class-select="1">' + Classes.options(S.className) + '</select>' +
      '<input type="text" data-p="settings.className" dir="auto" placeholder="Type the class, e.g. O Level" value="' + esc(otherCls ? S.className : '') + '"' + (otherCls ? '' : ' hidden') + ' style="margin-top:6px"></div></div>';
    h += '<div class="input-row">' + fld('Subject', 'settings.subject', S.subject) + fld('Chapter / lesson', 'settings.chapter', S.chapter) + '</div>';
    h += '<div class="input-row">' + fld('Exam date', 'settings.date', S.date, { type: 'date' }) + fld('Duration', 'settings.duration', S.duration, { ph: '40 minutes' }) + '</div>';
    h += '<div class="input-row">' + fld('Total marks', 'settings.totalMarks', S.totalMarks) + fld('Passing marks', 'settings.passingMarks', S.passingMarks) + '</div>';
    h += fld('School / academy name', 'settings.school', S.school);
    h += fld('Instructions', 'settings.instructions', S.instructions, { area: true });
    h += fld('Prepared by', 'settings.preparedBy', S.preparedBy);
    h += '<div class="field"><label>Logo (optional)</label><input type="file" accept="image/*" data-act-file="logo">' + (S.logo ? '<div style="margin-top:6px"><button type="button" class="btn small ghost" data-act="rm-logo">Remove logo</button></div>' : '') + '</div>';
    h += '<div class="lbl" style="margin-top:6px">Show on paper</div><div class="toggle-grid">' + SHOW_FIELDS.map(function (f) {
      return '<label class="check"><input type="checkbox" data-t="bool" data-p="show.' + f[0] + '"' + (p.show[f[0]] ? ' checked' : '') + '> ' + f[1] + '</label>';
    }).join('') + '</div>';
    h += '<label class="check"><input type="checkbox" data-t="bool" data-p="showKeys"' + (p.showKeys ? ' checked' : '') + '> Teacher copy: show MCQ answer key</label>';
    h += '</div></details>';
    return h;
  }

  /* ------------ the Builder ------------ */
  function mount(root, opts) {
    var paper = opts.paper, user = opts.user;
    var openSecs = {}; var saveTimer = null; var dirty = false;
    if (paper.sections.length) openSecs[paper.sections[0].id] = true;

    root.innerHTML =
      '<div class="builder">' +
      '<div class="b-toolbar">' +
        '<button class="btn small" id="b-back">← My Papers</button>' +
        '<label class="check">Language <select id="b-lang" class="inp" style="width:auto"><option value="en">English</option><option value="ur">اردو</option></select></label>' +
        '<label class="check tr-toggle" id="b-tr-wrap" title="Write in Urdu to see the preview in English, or write in English to see it in Urdu. Print and PDF use the translated version."><input type="checkbox" id="b-tr"> Auto-translate preview (اردو ⇄ English)</label>' +
        '<span class="tr-state" id="b-tr-state" aria-live="polite"></span>' +
        '<span class="grow"></span><span class="save-state" id="b-state">All changes saved</span>' +
        '<button class="btn small" id="b-save">Save</button>' +
        '<button class="btn small" id="b-print">Print</button>' +
        '<button class="btn small primary" id="b-pdf">Download PDF</button>' +
      '</div>' +
      '<div class="mobile-tabs"><button class="btn small primary" data-tab="edit">Edit</button><button class="btn small" data-tab="preview">Preview</button></div>' +
      '<div class="b-body" data-tab="edit"><div class="b-edit" id="b-edit"></div><div class="b-preview"><div class="paper-wrap" id="b-paper"></div></div></div>' +
      '</div>';

    var editEl = root.querySelector('#b-edit'), paperEl = root.querySelector('#b-paper'), stateEl = root.querySelector('#b-state'), body = root.querySelector('.b-body');
    var addMenuOpen = false;
    var mathOpen = paper.sections.some(function (x) { return x.type === 'math'; }) || /math/i.test(paper.settings.subject || '');
    var lastField = null;   // data-p path of the last text field the teacher clicked in (target for Math tools)
    editEl.addEventListener('focusin', function (e) { var t = e.target; if (t.getAttribute && t.getAttribute('data-p') && (t.tagName === 'TEXTAREA' || (t.tagName === 'INPUT' && t.type === 'text'))) lastField = t.getAttribute('data-p'); });
    editEl.addEventListener('toggle', function (e) { if (e.target.id === 'math-tools') mathOpen = e.target.open; }, true);
    editEl.addEventListener('mousedown', function (e) { if (e.target.closest && e.target.closest('.mbtn')) e.preventDefault(); }); // keep the caret in the text field

    function mathInsert(snip, kind) {
      var f = lastField ? editEl.querySelector('[data-p="' + lastField + '"]') : null;
      if (!f) { Dashboard.toast('Click inside a question or equation field first, then pick a symbol.'); return; }
      var v = f.value, st = f.selectionStart == null ? v.length : f.selectionStart, en = f.selectionEnd == null ? st : f.selectionEnd;
      var before = v.slice(0, st), inMath = f.hasAttribute('data-math') || ((before.replace(/\\\$/g, '').match(/\$/g) || []).length % 2 === 1);
      var caret = snip.indexOf('|'), body = snip.replace('|', '');
      var ins, pos;
      if (kind !== 'sym' && !inMath) { ins = '$' + body + '$'; pos = caret >= 0 ? 1 + caret : ins.length; }
      else { ins = body; pos = caret >= 0 ? caret : ins.length; }
      f.value = before + ins + v.slice(en);
      var np = before.length + pos; f.focus(); try { f.setSelectionRange(np, np); } catch (x) {}
      f.dispatchEvent(new Event('input', { bubbles: true }));
    }

    /* ----- preview (optionally auto-translated Urdu ⇄ English) ----- */
    var trTimer = null;
    function trStatus(v) {
      var el = root.querySelector('#b-tr-state'), wrap = root.querySelector('#b-tr-wrap');
      wrap.classList.toggle('on', !!paper.autoTranslate);
      if (!paper.autoTranslate || !v) { el.className = 'tr-state'; el.textContent = ''; return; }
      var dir = Translator.langName(v.source) + ' → ' + Translator.langName(v.target);
      if (!v.missing.length) { el.className = 'tr-state'; el.textContent = 'Preview: ' + dir; return; }
      if (Translator.status().pending || v.missing.some(Translator.canFetch)) { el.className = 'tr-state'; el.textContent = 'Translating ' + dir + '…'; return; }
      el.className = 'tr-state warn';
      el.innerHTML = '⚠ ' + v.missing.length + ' item' + (v.missing.length === 1 ? '' : 's') + ' not translated, shown in original. ' + esc(Translator.status().error || '') + ' <button type="button" class="link-btn" id="b-tr-retry">Retry</button>';
      el.querySelector('#b-tr-retry').onclick = function () { Translator.retry(); preview(); };
    }
    function preview() {
      if (!paper.autoTranslate || !window.Translator) { paperEl.innerHTML = PaperRenderer.render(paper, { showKeys: paper.showKeys }); trStatus(null); return; }
      var v = Translator.view(paper);
      paperEl.innerHTML = PaperRenderer.render(v.paper, { showKeys: paper.showKeys });
      trStatus(v);
      var todo = v.missing.filter(Translator.canFetch);
      clearTimeout(trTimer);
      // wait for a pause in typing before asking for translations (longer when Claude translates)
      if (todo.length) trTimer = setTimeout(function () { Translator.fetch(todo).then(function () { if (paperEl.isConnected) preview(); }); }, Translator.usesClaude() ? 1200 : 450);
    }
    // When the paper language changes, default section titles follow it (custom titles are kept).
    function applyLang(nl) {
      if ((nl === 'en' || nl === 'ur') && nl !== paper.lang) {
        var oldT = Translations.get(paper.lang).types, newT = Translations.get(nl).types;
        paper.sections.forEach(function (s) { if (!s.lang && s.title === oldT[s.type]) s.title = newT[s.type]; });
      }
      paper.lang = nl;
    }
    function save(manual) {
      clearTimeout(saveTimer);
      if (PMStorage.savePaper(paper, user)) { dirty = false; if (!PMStorage.isCloud()) stateEl.textContent = 'Saved ' + new Date().toLocaleTimeString(); if (manual) Dashboard.toast(PMStorage.isCloud() ? 'Saving to your account…' : 'Paper saved'); if (opts.onSaved) opts.onSaved(paper); }
      else stateEl.textContent = 'Could not save (no permission)';
    }
    function touch() { dirty = true; stateEl.textContent = 'Saving…'; clearTimeout(saveTimer); saveTimer = setTimeout(function () { save(false); }, 700); preview(); }
    function renderEditor() {
      var st = editEl.scrollTop;
      var h = settingsHtml(paper) + mathToolsHtml(mathOpen);
      h += '<div class="panel-head" style="margin-top:6px"><h3 style="font-size:16px">Sections (' + paper.sections.length + ')</h3>' + btn('toggle-add', addMenuOpen ? 'Close' : '+ Add section', '', 'primary') + '</div>';
      if (addMenuOpen) {
        h += '<div class="add-menu"><strong>Choose a section type</strong><div class="add-grid">' + TYPES.map(function (t) { return btn('add-section', Translations.get('en').types[t], 'data-type="' + t + '"'); }).join('') + '</div></div>';
      }
      if (!paper.sections.length) h += '<div class="empty"><h4>No sections yet</h4><p class="muted">Add a section to start building your paper.</p></div>';
      h += paper.sections.map(function (s, i) { return sectionHtml(s, i, paper.sections.length, !!openSecs[s.id]); }).join('');
      editEl.innerHTML = h; editEl.scrollTop = st;
      root.querySelector('#b-lang').value = paper.lang;
    }
    function rerender() { renderEditor(); touch(); }

    // ----- input handling (updates model and live preview) -----
    editEl.addEventListener('input', function (e) {
      var t = e.target;
      if (t.hasAttribute && t.hasAttribute('data-class-select')) {        // class picker: a standard class, or "Other" + typed text
        var other = t.parentNode.querySelector('input[data-p="settings.className"]');
        if (t.value === '__other') { other.hidden = false; other.value = Classes.isStandard(paper.settings.className) ? '' : paper.settings.className; other.focus(); paper.settings.className = other.value; }
        else { other.hidden = true; other.value = ''; paper.settings.className = t.value; }
        touch(); return;
      }
      var p = t.getAttribute('data-p'); if (!p) return;
      var kind = t.getAttribute('data-t'), val;
      if (kind === 'correct') { if (!t.checked) return; val = parseInt(t.getAttribute('data-v'), 10); }
      else if (kind === 'bool') val = t.checked;
      else if (kind === 'num') val = Math.max(0, parseInt(t.value || '0', 10) || 0);
      else val = t.value;
      if (p === 'lang') { applyLang(val); renderEditor(); touch(); return; }
      setAt(paper, p, val);
      if (t.hasAttribute('data-math')) { var lv = t.parentNode.querySelector('.math-live'); if (lv) lv.innerHTML = val ? PMath.equation(val) : '<span class="muted" style="font-size:12px">Equation preview</span>'; }
      if (/\.title$/.test(p) && p.indexOf('sections.') === 0) {
        var si = +p.split('.')[1]; var btnEl = editEl.querySelector('.sec[data-si="' + si + '"] .title');
        if (btnEl) btnEl.firstChild.textContent = (si + 1) + '. ' + (val || '(untitled)') + ' ';
      }
      if (t.getAttribute('data-rerender')) { root.querySelector('#b-lang').value = paper.lang; }
      touch();
    });
    editEl.addEventListener('change', function (e) {
      var t = e.target;
      if (t.getAttribute('data-act-file') === 'logo' && t.files && t.files[0]) {
        var f = t.files[0]; if (f.size > 400 * 1024) { Dashboard.toast('Logo is too large (max 400 KB).'); t.value = ''; return; }
        var fr = new FileReader(); fr.onload = function () { paper.settings.logo = fr.result; rerender(); }; fr.readAsDataURL(f);
      }
    });

    // ----- click actions -----
    editEl.addEventListener('click', function (e) {
      var el = e.target.closest('[data-act]'); if (!el) return;
      var act = el.getAttribute('data-act'), si = +el.getAttribute('data-si'), i = +el.getAttribute('data-i'), base = el.getAttribute('data-base');
      var secs = paper.sections;
      switch (act) {
        case 'toggle-add': addMenuOpen = !addMenuOpen; renderEditor(); return;
        case 'add-section': var ns = newSection(el.getAttribute('data-type'), paper.lang); secs.push(ns); openSecs[ns.id] = true; addMenuOpen = false; rerender();
          setTimeout(function () { var last = editEl.querySelector('.sec:last-child'); if (last) last.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 30); return;
        case 'sec-open': var sid = secs[si].id; openSecs[sid] = !openSecs[sid]; renderEditor(); return;
        case 'sec-up': if (si > 0) { var a = secs[si]; secs[si] = secs[si - 1]; secs[si - 1] = a; rerender(); focusAct('sec-up', si - 1); } return;
        case 'sec-down': if (si < secs.length - 1) { var b = secs[si]; secs[si] = secs[si + 1]; secs[si + 1] = b; rerender(); focusAct('sec-down', si + 1); } return;
        case 'sec-toggle': secs[si].enabled = !secs[si].enabled; rerender(); return;
        case 'sec-dup': var c = clone(secs[si]); c.id = uid('s'); c.title = (c.title || '') + ' (copy)'; secs.splice(si + 1, 0, c); openSecs[c.id] = true; rerender(); return;
        case 'sec-del': Dashboard.confirm('Delete section?', 'This section and its questions will be removed from the paper.', 'Delete', function () { secs.splice(si, 1); rerender(); }); return;
        case 'add-item': var arr = getAt(paper, base); arr.push(''); rerender(); return;
        case 'del-item': var arr2 = getAt(paper, base); if (arr2.length <= 1 && base.indexOf('.left') < 0 && base.indexOf('.right') < 0 && base.indexOf('questions') < 0) { arr2[0] = (typeof arr2[0] === 'object') ? { text: '', eq: '', lines: 3 } : ''; } else arr2.splice(i, 1); rerender(); return;
        case 'add-math-q': secs[si].items.push({ text: '', eq: '', lines: 3 }); rerender(); return;
        case 'math-ins': mathInsert(el.getAttribute('data-snip'), el.getAttribute('data-kind')); return;
        case 'add-q': secs[si].questions.push({ text: '', options: ['', '', '', ''], correct: -1 }); rerender(); return;
        case 'add-opt': getAt(paper, el.getAttribute('data-q')).options.push(''); rerender(); return;
        case 'del-opt': var q = getAt(paper, el.getAttribute('data-q')); q.options.splice(i, 1);
          if (q.correct === i) q.correct = -1; else if (q.correct > i) q.correct--; // keep the marked answer on the same option
          rerender(); return;
        case 'add-row': var cols = secs[si].rows[0].length; secs[si].rows.push(new Array(cols).fill('')); rerender(); return;
        case 'del-row': if (secs[si].rows.length > 1) { secs[si].rows.splice(i, 1); rerender(); } return;
        case 'add-col': secs[si].rows.forEach(function (r) { r.push(''); }); rerender(); return;
        case 'del-col': secs[si].rows.forEach(function (r) { r.splice(i, 1); }); rerender(); return;
        case 'rm-logo': paper.settings.logo = ''; rerender(); return;
      }
    });
    function focusAct(act, si) { var n = editEl.querySelector('[data-act="' + act + '"][data-si="' + si + '"]'); if (n && !n.disabled) n.focus(); }

    // ----- drag & drop reorder (keyboard alternative: ↑ ↓ buttons) -----
    var dragFrom = null;
    editEl.addEventListener('mousedown', function (e) { var h = e.target.closest('.handle'); if (h) h.closest('.sec').setAttribute('draggable', 'true'); });
    editEl.addEventListener('dragstart', function (e) { var s = e.target.closest && e.target.closest('.sec'); if (!s || s.getAttribute('draggable') !== 'true') return; dragFrom = +s.getAttribute('data-si'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', 'sec'); } catch (x) {} });
    editEl.addEventListener('dragover', function (e) { var s = e.target.closest && e.target.closest('.sec'); if (s && dragFrom !== null) { e.preventDefault(); editEl.querySelectorAll('.drag-over').forEach(function (n) { n.classList.remove('drag-over'); }); s.classList.add('drag-over'); } });
    editEl.addEventListener('drop', function (e) {
      var s = e.target.closest && e.target.closest('.sec'); if (!s || dragFrom === null) return; e.preventDefault();
      var to = +s.getAttribute('data-si'); if (to !== dragFrom) { var m = paper.sections.splice(dragFrom, 1)[0]; paper.sections.splice(to, 0, m); rerender(); } dragFrom = null;
    });
    editEl.addEventListener('dragend', function () { dragFrom = null; editEl.querySelectorAll('.drag-over').forEach(function (n) { n.classList.remove('drag-over'); }); editEl.querySelectorAll('.sec[draggable]').forEach(function (n) { n.removeAttribute('draggable'); }); });

    // ----- toolbar -----
    root.querySelector('#b-lang').addEventListener('change', function (e) { applyLang(e.target.value); rerender(); });
    var trBox = root.querySelector('#b-tr'); trBox.checked = !!paper.autoTranslate;
    trBox.addEventListener('change', function () {
      paper.autoTranslate = trBox.checked; touch();
      if (trBox.checked) Dashboard.toast('Auto-translate on: Urdu text shows in English, English text shows in Urdu.');
    });
    root.querySelector('#b-save').addEventListener('click', function () { save(true); });
    root.querySelector('#b-print').addEventListener('click', function () { save(false); Export.print(paper); });
    root.querySelector('#b-pdf').addEventListener('click', function () { save(false); Export.pdf(paper); });
    root.querySelector('#b-back').addEventListener('click', function () { if (dirty) save(false); opts.onClose(); });
    root.querySelectorAll('.mobile-tabs [data-tab]').forEach(function (bt) {
      bt.addEventListener('click', function () { body.setAttribute('data-tab', bt.getAttribute('data-tab')); root.querySelectorAll('.mobile-tabs .btn').forEach(function (x) { x.classList.toggle('primary', x === bt); }); });
    });

    // Cloud mode: show whether the latest changes have reached the database
    if (PMStorage.isCloud()) PMStorage.onSync(function (st) {
      if (!stateEl.isConnected) return false;
      if (dirty) return;
      stateEl.textContent = st.error ? '⚠ ' + st.error : st.pending ? 'Saving to cloud…' : 'Saved to cloud ✓';
      stateEl.classList.toggle('warn', !!st.error);
    });
    renderEditor(); preview();
    return { flush: function () { if (dirty) save(false); } };
  }

  window.PaperBuilder = { classTemplate: classTemplate, templateInfo: templateInfo, newPaper: newPaper, newSection: newSection, sampleEnglish: sampleEnglish, sampleUrdu: sampleUrdu, sampleMath: sampleMath, mount: mount, TYPES: TYPES, esc: esc, clone: clone, uid: uid };
})();
