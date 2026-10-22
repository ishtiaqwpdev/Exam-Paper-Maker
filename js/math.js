/* math.js — small offline equation engine (LaTeX-style input -> HTML/CSS).
   No external library: renders identically in the live preview, thumbnails, print and PDF.

   Syntax (inside $...$ for inline, or $$...$$ for its own centred line):
     \frac{a}{b}   \sqrt{x}   \sqrt[3]{x}   x^{2}   x_{1}   x_{1}^{2}   \pi   \times   \leq   \overline{AB}
   Escape a literal dollar sign with \$ .                                                            */
(function () {
  var SYM = {
    times: '×', div: '÷', pm: '±', mp: '∓', cdot: '·', leq: '≤', le: '≤', geq: '≥', ge: '≥', neq: '≠', ne: '≠', approx: '≈', equiv: '≡', sim: '∼', cong: '≅',
    pi: 'π', theta: 'θ', alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', lambda: 'λ', mu: 'μ', sigma: 'σ', phi: 'φ', omega: 'ω', rho: 'ρ', tau: 'τ',
    Delta: 'Δ', Sigma: 'Σ', Omega: 'Ω', Pi: 'Π', Theta: 'Θ', Phi: 'Φ', infty: '∞', degree: '°', circ: '°', angle: '∠', triangle: '△', perp: '⊥', parallel: '∥',
    therefore: '∴', because: '∵', rightarrow: '→', to: '→', leftarrow: '←', Rightarrow: '⇒', Leftrightarrow: '⇔', leftrightarrow: '↔', in: '∈', notin: '∉',
    subset: '⊂', subseteq: '⊆', cup: '∪', cap: '∩', emptyset: '∅', forall: '∀', exists: '∃', ldots: '…', cdots: '⋯', prime: '′', nabla: '∇', partial: '∂',
    propto: '∝', neg: '¬', mid: '∣', setminus: '∖', square: '□', lt: '<', gt: '>', '%': '%', '$': '$', '{': '{', '}': '}', '_': '_', '&': '&', '#': '#', lbrace: '{', rbrace: '}'
  };
  var SPACES = { ',': '', ';': '', ' ': '', ':': '', '!': '', quad: 'q', qquad: 'qq' };
  var OPS = '=+<>≤≥≠≈×÷±∓·→←⇒⇔↔∈∉⊂⊆∪∩≡∼≅∝∴∵∠';
  var BIG = { sum: '∑', prod: '∏', int: '∫', oint: '∮' };
  var FUNCS = ['sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'log', 'ln', 'lim', 'exp', 'min', 'max', 'sinh', 'cosh', 'tanh', 'arcsin', 'arccos', 'arctan', 'gcd', 'lcm'];
  var ACCENTS = { vec: '→', hat: '^', tilde: '~', dot: '˙', bar: '¯' };

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  function parse(src) {
    src = String(src == null ? '' : src).slice(0, 3000);
    var i = 0, n = src.length, kind = 'start';

    function ws() { while (i < n && /\s/.test(src.charAt(i))) i++; }

    function expr(stop) {
      var out = ''; kind = 'start';
      while (i < n) {
        ws(); if (i >= n) break;
        var c = src.charAt(i);
        if (stop && c === stop) break;
        if (c === '}') { i++; continue; }
        out += withScripts(atom());
      }
      return out;
    }
    function group() { // assumes src[i] === '{'
      i++; var h = expr('}'); if (src.charAt(i) === '}') i++; kind = 'val'; return h;
    }
    function rawGroup() { // text between balanced braces, not parsed
      ws(); if (src.charAt(i) !== '{') { var ch = src.charAt(i++); return ch; }
      var depth = 0, start = i + 1, j = i;
      for (; j < n; j++) { if (src.charAt(j) === '{') depth++; else if (src.charAt(j) === '}') { depth--; if (depth === 0) break; } }
      var txt = src.slice(start, j); i = Math.min(j + 1, n); return txt;
    }
    function arg() { ws(); if (src.charAt(i) === '{') return group(); var a = atom(); return a; }

    function withScripts(h) {
      var sup = null, sub = null;
      for (;;) {
        var save = i; ws(); var c = src.charAt(i);
        if (c === '^') { i++; sup = scriptArg(); } else if (c === '_') { i++; sub = scriptArg(); } else { i = save; break; }
      }
      if (sup !== null && sub !== null) return h + '<span class="msupsub"><span class="msup2">' + sup + '</span><span class="msub2">' + sub + '</span></span>';
      if (sup !== null) return h + '<sup class="msup">' + sup + '</sup>';
      if (sub !== null) return h + '<sub class="msub">' + sub + '</sub>';
      return h;
    }
    function scriptArg() {
      ws(); var saved = kind; var r;
      if (src.charAt(i) === '{') r = group(); else if (i < n) r = atom(); else r = '';
      kind = 'val'; return r;
    }
    function op(ch, unaryAware) {
      var unary = unaryAware && (kind === 'start' || kind === 'op' || kind === 'open');
      kind = 'op';
      return '<span class="' + (unary ? 'mu' : 'mo') + '">' + esc(ch) + '</span>';
    }
    function atom() {
      var c = src.charAt(i);
      if (c === '^' || c === '_') return ''; // empty base, scripts handled by caller
      if (c === '{') return group();
      if (c === '\\') return command();
      i++;
      if (/[A-Za-z]/.test(c)) { kind = 'val'; return '<i class="mv">' + c + '</i>'; }
      if (c === '-') return op('−', true);
      if (c === '+') return op('+', true);
      if (OPS.indexOf(c) >= 0) return op(c, false);
      if (c === '(' || c === '[' || c === ',') { kind = 'open'; return esc(c); }
      if (c === "'") { kind = 'val'; return '′'; }
      if (c === '*') { kind = 'op'; return '<span class="mo">∗</span>'; }
      kind = 'val'; return esc(c);
    }
    function accent(sym, body) { return '<span class="macc"><span class="macc-top">' + sym + '</span><span>' + body + '</span></span>'; }

    function command() {
      i++; // backslash
      var name = '';
      if (/[A-Za-z]/.test(src.charAt(i))) { while (i < n && /[A-Za-z]/.test(src.charAt(i))) name += src.charAt(i++); }
      else if (i < n) { name = src.charAt(i++); }
      var a, b;
      switch (name) {
        case 'frac': case 'dfrac': case 'tfrac':
          a = arg(); b = arg(); kind = 'val';
          return '<span class="mfrac"><span class="mnum">' + a + '</span><span class="mden">' + b + '</span></span>';
        case 'sqrt': {
          var idx = ''; ws();
          if (src.charAt(i) === '[') { i++; idx = expr(']'); if (src.charAt(i) === ']') i++; }
          a = arg(); kind = 'val';
          return '<span class="msqrt">' + (idx ? '<span class="msqrt-ind">' + idx + '</span>' : '') + '<span class="msqrt-sign"><span class="r1"></span><span class="r2"></span></span><span class="msqrt-body">' + a + '</span></span>';
        }
        case 'text': case 'mathrm': case 'textrm': case 'mbox': kind = 'val'; return '<span class="mt">' + esc(rawGroup()) + '</span>';
        case 'textbf': case 'mathbf': kind = 'val'; return '<b class="mt">' + esc(rawGroup()) + '</b>';
        case 'overline': a = arg(); kind = 'val'; return '<span class="mover">' + a + '</span>';
        case 'underline': a = arg(); kind = 'val'; return '<span class="munder">' + a + '</span>';
        case 'left': case 'right': {
          ws(); var d = src.charAt(i);
          if (d === '.') { i++; return ''; }
          if (d === '\\') { i++; var dn = src.charAt(i++); d = dn === '{' ? '{' : dn === '}' ? '}' : dn === '|' ? '‖' : (dn === 'l' || dn === 'r') ? '' : dn; }
          else i++;
          kind = name === 'left' ? 'open' : 'val'; return '<span class="mdel">' + esc(d) + '</span>';
        }
        case '\\': kind = 'start'; return '<br>';
      }
      if (ACCENTS[name]) { a = arg(); kind = 'val'; return accent(ACCENTS[name], a); }
      if (BIG[name]) { kind = 'val'; return '<span class="mbig">' + BIG[name] + '</span>'; }
      if (FUNCS.indexOf(name) >= 0) { kind = 'val'; return '<span class="mf">' + name + '</span><span class="msp"></span>'; }
      if (SPACES.hasOwnProperty(name)) return '<span class="msp' + (SPACES[name] ? ' ' + SPACES[name] : '') + '"></span>';
      if (SYM.hasOwnProperty(name)) { var s = SYM[name]; if (OPS.indexOf(s) >= 0) return op(s, false); kind = 'val'; return esc(s); }
      kind = 'val'; return esc('\\' + name);
    }

    return expr(null);
  }

  /* split mixed text into text / inline-math / display-math segments */
  function segments(s) {
    s = String(s == null ? '' : s).replace(/\\\$/g, '\u0001');
    var out = [], buf = '', i = 0, e;
    function flush() { if (buf) { out.push({ t: 'text', v: buf }); buf = ''; } }
    while (i < s.length) {
      if (s.substr(i, 2) === '$$') { e = s.indexOf('$$', i + 2); if (e >= 0) { flush(); out.push({ t: 'display', v: s.slice(i + 2, e) }); i = e + 2; continue; } }
      if (s.charAt(i) === '$') { e = s.indexOf('$', i + 1); if (e >= 0) { flush(); out.push({ t: 'inline', v: s.slice(i + 1, e) }); i = e + 1; continue; } }
      buf += s.charAt(i++);
    }
    flush();
    return out;
  }
  function unescDollar(x) { return x.replace(/\u0001/g, '$'); }

  function inline(src) { return '<span class="math">' + parse(unescDollar(src)) + '</span>'; }
  function block(src) { return '<span class="math-display"><span class="math">' + parse(unescDollar(src)) + '</span></span>'; }

  /* opts.blanks: turn runs of 2+ underscores (outside math) into answer blanks.
     opts.appendBlank: if no blank was found, add one at the end. */
  function text(s, opts) {
    opts = opts || {};
    var segs = segments(s), html = '', found = false;
    segs.forEach(function (g) {
      if (g.t === 'text') {
        var t = esc(unescDollar(g.v));
        if (opts.blanks && /_{2,}/.test(t)) { found = true; t = t.replace(/_{2,}/g, '<span class="blank"></span>'); }
        html += t.replace(/\n/g, '<br>');
      } else if (g.t === 'inline') html += inline(g.v);
      else html += block(g.v);
    });
    if (opts.blanks && opts.appendBlank && !found) html += ' <span class="blank"></span>';
    return html;
  }

  window.PMath = {
    parse: parse, text: text, inline: inline, block: block, segments: segments,
    /* lines of a bare equation (no $ needed) */
    equation: function (src) { return block(src); }
  };
})();
