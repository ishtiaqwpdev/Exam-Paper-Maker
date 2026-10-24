/* app.js — bootstrap: login / register screens, session handling, routing.
   NOTE: LocalStorage "authentication" is a DEMO ONLY and is NOT secure. The real product must use
   server-side authentication and authorization (e.g. WordPress auth + per-request capability checks). */
(function () {
  var esc = PaperRenderer.esc;
  var root = document.getElementById('root');
  var emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  /* ---------- Auth screens: one split card with Log In / Create Account tabs ---------- */
  var ART = '<svg class="auth-art" viewBox="0 0 220 230" aria-hidden="true">' +
    '<rect x="44" y="26" width="132" height="176" rx="10" fill="#fff" stroke="#000" stroke-width="2.5"/>' +
    '<rect x="62" y="44" width="96" height="10" rx="3" fill="#000"/>' +
    '<rect x="78" y="60" width="64" height="5" rx="2.5" fill="#BDBDBD"/>' +
    '<g stroke="#000" stroke-width="2" fill="none"><circle cx="66" cy="88" r="4.5"/><circle cx="66" cy="112" r="4.5"/><circle cx="66" cy="136" r="4.5"/></g>' +
    '<path d="M62.5 112 l3 3 l6 -7" stroke="#000" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<g fill="#D6D6D6"><rect x="78" y="85" width="72" height="6" rx="3"/><rect x="78" y="109" width="60" height="6" rx="3"/><rect x="78" y="133" width="66" height="6" rx="3"/></g>' +
    '<g stroke="#000" stroke-width="1.5"><line x1="62" y1="162" x2="158" y2="162"/><line x1="62" y1="180" x2="132" y2="180"/></g>' +
    '<text x="150" y="190" font-family="Cambria Math, Times New Roman, serif" font-size="20" font-style="italic" fill="#000">x²</text>' +
    '<g transform="rotate(38 168 120)"><rect x="160" y="64" width="16" height="96" rx="3" fill="#fff" stroke="#000" stroke-width="2.5"/><path d="M160 160 L168 178 L176 160 Z" fill="#000"/><rect x="160" y="64" width="16" height="14" fill="#000"/></g>' +
    '<g fill="#000"><path d="M30 60 l3 7 l7 3 l-7 3 l-3 7 l-3 -7 l-7 -3 l7 -3 z"/><path d="M192 30 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 l5 -2 z"/><circle cx="196" cy="206" r="3"/><circle cx="26" cy="180" r="2.5"/></g>' +
    '<text x="110" y="226" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-size="13" fill="#555">“Better papers, in less time.”</text></svg>';

  function pwField(id, label, auto, hint) {
    return '<div class="field"><label for="' + id + '">' + label + (hint ? ' <span class="label-hint">' + hint + '</span>' : '') + '</label>' +
      '<div class="pw-row"><input id="' + id + '" type="password" autocomplete="' + auto + '"><button type="button" class="pw-toggle" data-for="' + id + '" aria-label="Show or hide password">Show</button></div></div>';
  }
  function bindToggles(scope) {
    (scope || root).querySelectorAll('.pw-toggle').forEach(function (b) {
      b.onclick = function () { var i = document.getElementById(b.getAttribute('data-for')); var show = i.type === 'password'; i.type = show ? 'text' : 'password'; b.textContent = show ? 'Hide' : 'Show'; };
    });
  }
  function showErr(msg, good) { var e = root.querySelector('#err'); e.innerHTML = msg ? '<div class="form-error' + (good ? ' ok' : '') + '" role="' + (good ? 'status' : 'alert') + '">' + esc(msg) + '</div>' : ''; }

  function authScreen(tab) {
    var login = tab !== 'register';
    var left = '<div class="auth-side"><img class="auth-logo" src="assets/logo.png" width="640" height="567" alt="Exam Paper Maker logo — Learn, Grow, Succeed"><div class="auth-name">Exam Paper Maker</div>' +
      '<h1>' + (login ? 'Welcome back!' : 'Join Paper Maker') + '</h1>' +
      '<p class="sub">' + (login ? 'Log in to create, edit and print your exam papers.' : 'Create a teacher account to start building exam papers in English, Urdu or both.') + '</p>' + ART + '</div>';
    var tabs = '<div class="auth-tabs" role="tablist"><button type="button" role="tab" id="tab-login" aria-selected="' + login + '" class="' + (login ? 'on' : '') + '">Log In</button>' +
      '<button type="button" role="tab" id="tab-reg" aria-selected="' + !login + '" class="' + (!login ? 'on' : '') + '">Create Account</button></div>';
    var form = login
      ? '<form id="f" novalidate><div class="field"><label for="em">Email</label><input id="em" type="email" autocomplete="email" placeholder="you@example.com"></div>' +
        pwField('pw', 'Password', 'current-password') +
        '<label class="check remember"><input type="checkbox" id="remember" checked> Keep me logged in</label>' +
        '<button class="btn primary auth-submit">Log In</button></form>' +
        '<div class="auth-switch"><button type="button" class="link-btn" id="forgot">Forgot your password?</button></div>' +
        '<div class="auth-switch muted" style="font-size:14px">New here? <button type="button" class="link-btn" id="to-reg">Create an account</button></div>'
      : '<form id="f" novalidate><div class="field"><label for="nm">Your name</label><input id="nm" autocomplete="name" placeholder="e.g. Ayesha Khan"></div>' +
        '<div class="field"><label for="acad">School / academy name</label><input id="acad" autocomplete="organization" placeholder="e.g. Bright Future Academy"></div>' +
        '<div class="field"><label for="em">Email</label><input id="em" type="email" autocomplete="email" placeholder="you@example.com"></div>' +
        pwField('pw', 'Password', 'new-password', '(at least 6 characters)') +
        '<p class="muted auth-note">Your papers are private to your account.</p>' +
        '<button class="btn primary auth-submit">Create Account</button></form>';
    var note = PMStorage.isCloud()
      ? '<p class="db-note ok">✓ Connected to the database — your account and papers are saved online and work on any device.</p>'
      : location.protocol === 'file:' ? '<p class="muted local-note">Offline demo: accounts and papers are kept only in this browser.</p>'
      : PMStorage.dbProblem ? '<p class="db-note warn" role="alert">⚠ The database is set up but could not be reached, so accounts are saved only in this browser for now.<br><small>' + esc(PMStorage.dbProblem) + '</small></p>'
      : '<p class="db-note warn" role="alert">⚠ No database connected yet — accounts and papers are saved only in this browser on this device. To save them online: Vercel → Storage → Create Database (Neon) → Connect → Redeploy.</p>';
    root.innerHTML = '<div class="auth-wrap">' + Theme.button('auth-theme') + '<div class="auth-card">' + left + '<div class="auth-main">' + tabs + '<div id="err"></div>' + form + note + '</div></div></div>';
    bindToggles(); Theme.refresh();
    root.querySelector('#tab-login').onclick = function () { authScreen('login'); };
    root.querySelector('#tab-reg').onclick = function () { authScreen('register'); };
    var first = root.querySelector(login ? '#em' : '#nm'); if (first) first.focus();

    if (login) {
      root.querySelector('#to-reg').onclick = function () { authScreen('register'); };
      root.querySelector('#forgot').onclick = function () { forgotPassword(root.querySelector('#em').value.trim()); };
      root.querySelector('#f').onsubmit = function (e) {
        e.preventDefault();
        var em = root.querySelector('#em').value.trim(), pw = root.querySelector('#pw').value;
        if (!em || !pw) return showErr('Please enter both your email and password.');
        if (!emailRe.test(em)) return showErr('Please enter a valid email address.');
        var btn = root.querySelector('#f button.primary'); btn.disabled = true; btn.textContent = 'Logging in…';
        PMStorage.login(em, pw, root.querySelector('#remember').checked).then(function (r) {
          btn.disabled = false; btn.textContent = 'Log In';
          if (r.error) return showErr(r.error);
          boot();
          if (r.imported) Dashboard.toast(r.imported + ' paper(s) from this browser were saved to your account.');
        });
      };
    } else {
      root.querySelector('#f').onsubmit = function (e) {
        e.preventDefault();
        var nm = root.querySelector('#nm').value.trim(), ac = root.querySelector('#acad').value.trim(), em = root.querySelector('#em').value.trim(), pw = root.querySelector('#pw').value;
        if (!nm || !em || !pw) return showErr('Please fill in your name, email and password.');
        if (!emailRe.test(em)) return showErr('Please enter a valid email address.');
        if (pw.length < 6) return showErr('Password must be at least 6 characters.');
        var btn = root.querySelector('#f button.primary'); btn.disabled = true; btn.textContent = 'Creating account…';
        PMStorage.register(nm, em, pw, ac).then(function (r) {
          btn.disabled = false; btn.textContent = 'Create Account';
          if (r.error) return showErr(r.error);
          boot();
          if (r.first) Dashboard.toast('Welcome! You are the first account, so you are the admin of this site.');
          else if (r.imported) Dashboard.toast(r.imported + ' paper(s) from this browser were saved to your account.');
        });
      };
    }
  }
  /* Forgot password, like other apps: 1) email  2) 6-digit code sent to that email  3) new password.
     The code is emailed by the Vercel functions in /api (see api/_reset.js for the one-time setup). */
  function api(path, data) {
    return fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      .then(function (r) {
        return r.text().then(function (t) {
          var j = null; try { j = JSON.parse(t); } catch (e) {}
          if (!j) return { error: location.protocol === 'file:' || r.status === 404
            ? 'Reset emails work on the live website (exam-paper-maker.vercel.app), not when index.html is opened from a folder.'
            : 'The reset service did not answer. Please try again.', code: 'no_api' };
          return r.ok ? j : (j.error ? j : { error: 'Something went wrong. Please try again.' });
        });
      }, function () {
        return { error: location.protocol === 'file:' ? 'Reset emails work on the live website (exam-paper-maker.vercel.app), not when index.html is opened from a folder.' : 'No internet connection. Check it and try again.', code: 'offline' };
      });
  }
  function maskEmail(e) { var p = e.split('@'); return p[0].slice(0, 2) + '•••@' + p[1]; }

  function forgotPassword(prefill) {
    Dashboard.modal('<div id="fp"></div>', function (m, close) {
      var box = m.querySelector('#fp'), email = '', token = '', code = '', timer = null;
      function err(msg, good) { var el = box.querySelector('.fp-msg'); if (el) el.innerHTML = msg ? '<div class="form-error' + (good ? ' ok' : '') + '" role="' + (good ? 'status' : 'alert') + '">' + esc(msg) + '</div>' : ''; }
      function busy(btn, on, label) { btn.disabled = on; btn.textContent = on ? label : btn.getAttribute('data-label'); }
      function sendCode(btn, then) {
        busy(btn, true, 'Sending…');
        api('/api/send-reset', { email: email }).then(function (r) {
          busy(btn, false);
          if (r.error) return err(r.error);
          token = r.token; then();
        });
      }
      function step1() {
        clearInterval(timer);
        box.innerHTML = '<div class="fp-step">Step 1 of 3</div><h3>Forgot your password?</h3><p class="muted">Enter your account email. We will email you a 6-digit code.</p><div class="fp-msg"></div>' +
          '<form id="fp-f1" novalidate><div class="field"><label for="fp-em">Email</label><input id="fp-em" type="email" autocomplete="email" placeholder="you@example.com" value="' + esc(email || prefill || '') + '"></div>' +
          '<div class="actions"><button type="button" class="btn" data-no>Cancel</button><button class="btn primary" data-label="Send code">Send code</button></div></form>';
        box.querySelector('[data-no]').onclick = close;
        box.querySelector('#fp-f1').onsubmit = function (e) {
          e.preventDefault();
          var v = box.querySelector('#fp-em').value.trim().toLowerCase();
          if (!emailRe.test(v)) return err('Please enter a valid email address.');
          if (!PMStorage.localAccountExists(v)) return err('No account found with this email.');
          email = v; sendCode(box.querySelector('#fp-f1 .primary'), step2);
        };
        box.querySelector('#fp-em').focus();
      }
      function step2() {
        box.innerHTML = '<div class="fp-step">Step 2 of 3</div><h3>Check your email</h3><p class="muted">We sent a 6-digit code to <b>' + esc(maskEmail(email)) + '</b>. It expires in 15 minutes. Check the spam folder if you don’t see it.</p><div class="fp-msg"></div>' +
          '<form id="fp-f2" novalidate><div class="field"><label for="fp-code">6-digit code</label><input id="fp-code" class="otp" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="••••••"></div>' +
          '<div class="actions"><button type="button" class="btn" data-back>Change email</button><button class="btn primary" data-label="Verify code">Verify code</button></div></form>' +
          '<div class="auth-switch"><button type="button" class="link-btn" id="fp-resend" data-label="Resend code">Resend code</button> <span class="muted" id="fp-wait"></span></div>';
        var resend = box.querySelector('#fp-resend'), waitEl = box.querySelector('#fp-wait');
        function cooldown() {
          var left = 60; resend.disabled = true; waitEl.textContent = '(in ' + left + 's)';
          clearInterval(timer); timer = setInterval(function () { left--; if (left <= 0) { clearInterval(timer); resend.disabled = false; waitEl.textContent = ''; } else waitEl.textContent = '(in ' + left + 's)'; }, 1000);
        }
        cooldown();
        resend.onclick = function () { sendCode(resend, function () { err('A new code has been sent.', true); cooldown(); box.querySelector('#fp-code').value = ''; }); };
        box.querySelector('[data-back]').onclick = step1;
        var codeIn = box.querySelector('#fp-code');
        codeIn.addEventListener('input', function () { codeIn.value = codeIn.value.replace(/\D/g, '').slice(0, 6); });
        box.querySelector('#fp-f2').onsubmit = function (e) {
          e.preventDefault();
          var c = codeIn.value; if (c.length !== 6) return err('Enter the 6-digit code from the email.');
          var btn = box.querySelector('#fp-f2 .primary'); busy(btn, true, 'Checking…');
          api('/api/verify-reset', { email: email, code: c, token: token }).then(function (r) {
            busy(btn, false);
            if (r.error) return err(r.error);
            code = c; clearInterval(timer); step3();
          });
        };
        codeIn.focus();
      }
      function step3() {
        box.innerHTML = '<div class="fp-step">Step 3 of 3</div><h3>Set a new password</h3><p class="muted">For <b>' + esc(email) + '</b>.</p><div class="fp-msg"></div>' +
          '<form id="fp-f3" novalidate>' + pwField('fp-pw', 'New password', 'new-password', '(at least 6 characters)') + pwField('fp-pw2', 'Confirm new password', 'new-password') +
          '<div class="actions"><button class="btn primary">Save new password</button></div></form>';
        bindToggles(box);
        box.querySelector('#fp-f3').onsubmit = function (e) {
          e.preventDefault();
          var p1 = box.querySelector('#fp-pw').value, p2 = box.querySelector('#fp-pw2').value;
          if (p1.length < 6) return err('New password must be at least 6 characters.');
          if (p1 !== p2) return err('The two passwords do not match.');
          var btn = box.querySelector('#fp-f3 .primary'); btn.disabled = true; btn.textContent = 'Saving…';
          PMStorage.resetPassword(email, code, token, p1).then(function (r) {
            btn.disabled = false; btn.textContent = 'Save new password';
            if (r.error) return err(r.error);
            close(); authScreen('login');
            root.querySelector('#em').value = email; root.querySelector('#pw').focus();
            showErr('Password changed. Log in with your new password.', true);
          });
        };
        box.querySelector('#fp-pw').focus();
      }
      step1();
    });
  }
  function loginScreen() { authScreen('login'); }

  var current = { view: 'dashboard', id: null };
  function boot() {
    var user = PMStorage.currentUser();
    if (!user) return loginScreen();
    current = { view: 'dashboard', id: null };
    Dashboard.mountShell(user, goto);
    go();
    function refreshUser() { boot(); }
    window.__refreshUser = refreshUser;
  }
  function goto(view, id) {
    if (view === 'logout') { PMStorage.logout(); return loginScreen(); }
    current = { view: view, id: id || null }; go();
  }
  function go() {
    var user = PMStorage.currentUser(); if (!user) return loginScreen();
    Dashboard.render(user, current.view, current.id, goto, function () { var v = current; boot(); goto(v.view, v.id); });
  }

  // If the server says the login has expired (e.g. password changed on another device), go back to the login page.
  window.__onSessionExpired = function () { authScreen('login'); showErr('Your session has ended. Please log in again.'); };

  // Decide cloud (database) or local mode first, then show the app.
  root.innerHTML = '<div class="auth-wrap"><div class="boot-loading" role="status"><img src="assets/logo-mark.png" width="72" height="72" alt="" class="brand-logo"><div>Loading…</div></div></div>';
  PMStorage.init().then(function () {
    boot();
    if (PMStorage.loadError) Dashboard.toast(PMStorage.loadError);
  });
})();
