/* app.js — bootstrap: login / register screens, session handling, routing.
   NOTE: LocalStorage "authentication" is a DEMO ONLY and is NOT secure. The real product must use
   server-side authentication and authorization (e.g. WordPress auth + per-request capability checks). */
(function () {
  var esc = PaperRenderer.esc;
  var root = document.getElementById('root');
  var emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function pwField(id, label, auto) {
    return '<div class="field"><label for="' + id + '">' + label + '</label><div class="pw-row"><input id="' + id + '" type="password" autocomplete="' + auto + '"><button type="button" class="pw-toggle" data-for="' + id + '" aria-label="Show or hide password">Show</button></div></div>';
  }
  function bindToggles() {
    root.querySelectorAll('.pw-toggle').forEach(function (b) {
      b.onclick = function () { var i = document.getElementById(b.getAttribute('data-for')); var show = i.type === 'password'; i.type = show ? 'text' : 'password'; b.textContent = show ? 'Hide' : 'Show'; };
    });
  }
  function showErr(msg) { var e = root.querySelector('#err'); e.innerHTML = msg ? '<div class="form-error" role="alert">' + esc(msg) + '</div>' : ''; }

  function loginScreen() {
    root.innerHTML = '<div class="auth-wrap"><div class="auth-card"><div class="brand"><span class="brand-mark">P</span> Exam Paper Maker</div><h1>Log in</h1><p class="sub">Welcome back. Enter your details to continue.</p><div id="err"></div>' +
      '<form id="f" novalidate><div class="field"><label for="em">Email address</label><input id="em" type="email" autocomplete="email"></div>' + pwField('pw', 'Password', 'current-password') + '<button class="btn primary" style="width:100%">Log in</button></form>' +
      '<div class="auth-switch">No account? <button class="link-btn" id="to-reg">Create one</button></div>' +
      '<div class="demo-box"><b>Demo shortcuts</b> <span class="muted">(testing only — not real security)</span><div class="row"><button class="btn small" id="d-teacher">Log in as Teacher</button><button class="btn small" id="d-admin">Log in as Admin</button></div><div class="muted">Teacher: teacher@demo.test / teacher123<br>Admin: admin@demo.test / admin123</div></div></div></div>';
    bindToggles();
    root.querySelector('#to-reg').onclick = registerScreen;
    root.querySelector('#d-teacher').onclick = function () { PMStorage.loginAs('teacher'); boot(); };
    root.querySelector('#d-admin').onclick = function () { PMStorage.loginAs('admin'); boot(); };
    root.querySelector('#f').onsubmit = function (e) {
      e.preventDefault();
      var em = root.querySelector('#em').value.trim(), pw = root.querySelector('#pw').value;
      if (!em || !pw) return showErr('Please enter both your email and password.');
      if (!emailRe.test(em)) return showErr('Please enter a valid email address.');
      var r = PMStorage.login(em, pw); if (r.error) return showErr(r.error);
      boot();
    };
  }

  function registerScreen() {
    root.innerHTML = '<div class="auth-wrap"><div class="auth-card"><div class="brand"><span class="brand-mark">P</span> Exam Paper Maker</div><h1>Create account</h1><p class="sub">Register as a teacher.</p><div id="err"></div>' +
      '<form id="f" novalidate><div class="field"><label for="nm">Full name</label><input id="nm" autocomplete="name"></div><div class="field"><label for="em">Email address</label><input id="em" type="email" autocomplete="email"></div>' +
      pwField('pw', 'Password', 'new-password') + pwField('pw2', 'Confirm password', 'new-password') + '<button class="btn primary" style="width:100%">Create account</button></form>' +
      '<div class="auth-switch">Already registered? <button class="link-btn" id="to-login">Log in</button></div></div></div>';
    bindToggles();
    root.querySelector('#to-login').onclick = loginScreen;
    root.querySelector('#f').onsubmit = function (e) {
      e.preventDefault();
      var nm = root.querySelector('#nm').value.trim(), em = root.querySelector('#em').value.trim(), pw = root.querySelector('#pw').value, pw2 = root.querySelector('#pw2').value;
      if (!nm || !em || !pw || !pw2) return showErr('Please fill in all fields.');
      if (!emailRe.test(em)) return showErr('Please enter a valid email address.');
      if (pw.length < 6) return showErr('Password must be at least 6 characters.');
      if (pw !== pw2) return showErr('Passwords do not match.');
      var r = PMStorage.register(nm, em, pw); if (r.error) return showErr(r.error);
      PMStorage.login(em, pw); boot();
    };
  }

  var current = { view: 'dashboard', id: null };
  function boot() {
    PMStorage.seed();
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

  boot();
})();
