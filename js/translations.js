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
      duration: 'وقفہ', marks: 'نشانات', passing: 'پاس نمبر', prepared: 'تیار کردہ', answer: 'جواب:',
      q: 'سوال', true_: 'درست', false_: 'غلط', col_a: 'کالم الف', col_b: 'کالم ب', instructions: 'ہدایات',
      marks_word: 'نشانات', passage: 'عبارت', tf_hint: 'درست یا غلط لکھیے۔',
      types: {
        mcq: 'کثیر انتخابی سوالات', math: 'ریاضی کے سوالات', fill: 'خالی جگہ پر کریں', tf: 'درست یا غلط', match: 'کالم الف کو کالم ب سے ملائیں',
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
})();
