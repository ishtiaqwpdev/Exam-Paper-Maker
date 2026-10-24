/* translations.js — UI strings for paper content (English / Urdu) */
(function () {
  var T = {
    en: {
      dir: 'ltr', name: 'English',
      name_label: 'Name', roll: 'Roll No', date: 'Date', class_label: 'Class', subject: 'Subject', chapter: 'Lesson',
      duration: 'Time', marks: 'Total Marks', passing: 'Passing Marks', prepared: 'Prepared by', answer: 'Answer:',
      q: 'Q', true_: 'True', false_: 'False', col_a: 'Column A', col_b: 'Column B', instructions: 'Instructions',
      marks_word: 'Marks', passage: 'Passage', tf_hint: 'Write True or False.',
      types: {
        mcq: 'Multiple choice', math: 'Mathematics (equations)', fill: 'Fill in the blanks', tf: 'True or false', match: 'Match Column A with Column B',
        short: 'Short answers', long: 'Long answers', sentence: 'Make sentences', rearrange: 'Rearrange the following',
        table: 'Table-based', passage: 'Passage / comprehension', instr: 'General instructions', custom: 'Custom text'
      }
    },
    ur: {
      dir: 'rtl', name: 'اردو',
      name_label: 'نام', roll: 'رول نمبر', date: 'تاریخ', class_label: 'جماعت', subject: 'مضمون', chapter: 'سبق',
      duration: 'وقت', marks: 'نشانات', passing: 'پاس نمبر', prepared: 'تیار کردہ', answer: 'جواب:',
      q: 'سوال', true_: 'درست', false_: 'غلط', col_a: 'کالم الف', col_b: 'کالم ب', instructions: 'ہدایات',
      marks_word: 'نشانات', passage: 'عبارت', tf_hint: 'درست یا غلط لکھیے۔',
      types: {
        mcq: 'کثیر انتخابی سوالات', math: 'ریاضی کے سوالات', fill: 'خالی جگہ پُر کریں', tf: 'درست یا غلط', match: 'کالم الف کو کالم ب سے ملائیں',
        short: 'مختصر جوابات', long: 'تفصیلی جوابات', sentence: 'جملے بنائیں', rearrange: 'ترتیب دیں',
        table: 'جدول والے سوالات', passage: 'عبارت اور فہم', instr: 'عمومی ہدایات', custom: 'متن'
      }
    }
  };
  var DIGITS = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
  window.Translations = {
    data: T,
    get: function (lang) { return T[lang] || T.en; },
    num: function (n, lang) { return String(n); },
    sectionLabel: function (n) { return 'Section ' + n; }
  };

  /* Classes, Nursery to 2nd Year (Pakistan). Papers store the value (e.g. "Class 6"); the paper prints it in the
     paper's language ("Class: 6" / "جماعت: 6"). Older free-text values ("6th", "Grade 8") are recognised too. */
  var CLASS_LIST = [
    { v: 'Nursery', label: 'Nursery', ur: 'نرسری' },
    { v: 'KG', label: 'KG / Prep', ur: 'کے جی / پریپ' }
  ];
  for (var c = 1; c <= 10; c++) CLASS_LIST.push({ v: 'Class ' + c, label: 'Class ' + c, ur: String(c), en: String(c) });
  CLASS_LIST.push({ v: '1st Year', label: '1st Year (Part 1 · Class 11)', ur: 'فرسٹ ایئر' }, { v: '2nd Year', label: '2nd Year (Part 2 · Class 12)', ur: 'سیکنڈ ایئر' });

  /* turns any class text into one standard name, so "6", "6th", "Grade 6" and "Class 6" count as the same class */
  function classKey(raw) {
    var t = String(raw == null ? '' : raw).trim(); if (!t) return 'No class';
    var low = t.toLowerCase();
    if (/nurs|نرسری/.test(low)) return 'Nursery';
    if (/\b(kg|k\.g|prep|kinder|montessori)\b|پریپ|کے جی/.test(low)) return 'KG';
    if (/1st\s*year|first\s*year|part\s*(1|i)\b|\b11(th)?\b|فرسٹ|سال اول|گیارہ/.test(low)) return '1st Year';
    if (/2nd\s*year|second\s*year|part\s*(2|ii)\b|\b12(th)?\b|سیکنڈ|سال دوم|بارہ/.test(low)) return '2nd Year';
    var m = /\d+/.exec(t.replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); }).replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); }));
    if (m && +m[0] >= 1 && +m[0] <= 10) return 'Class ' + (+m[0]);
    return t.replace(/\s+/g, ' ');
  }
  function classRank(k) {
    if (k === 'Nursery') return 0; if (k === 'KG') return 1;
    var m = /^Class (\d+)$/.exec(k); if (m) return 1 + (+m[1]);
    if (k === '1st Year') return 12; if (k === '2nd Year') return 13;
    return k === 'No class' ? 99 : 50;
  }
  window.Classes = {
    list: CLASS_LIST,
    key: classKey,
    isStandard: function (v) { return CLASS_LIST.some(function (c) { return c.v === v; }); },
    sort: function (a, b) { return classRank(a) - classRank(b) || String(a).localeCompare(String(b)); },
    label: function (v) { var c = CLASS_LIST.find(function (x) { return x.v === v; }); return c ? c.label : v; },
    /* what goes after "Class:" / "جماعت:" on the paper */
    display: function (v, lang) {
      var c = CLASS_LIST.find(function (x) { return x.v === v; });
      if (!c) return v;
      return lang === 'ur' ? c.ur : (c.en || c.v);
    },
    /* <option> list for a class picker; values not in the list show as "Other" */
    options: function (current, placeholder) {
      var std = !current || this.isStandard(current);
      return '<option value="">' + (placeholder || 'Select class…') + '</option>' + CLASS_LIST.map(function (c) { return '<option value="' + c.v + '"' + (c.v === current ? ' selected' : '') + '>' + c.label + '</option>'; }).join('') +
        '<option value="__other"' + (std ? '' : ' selected') + '>Other (type it)…</option>';
    }
  };
})();
