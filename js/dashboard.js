/* dashboard.js — shell (sidebar/topbar), dashboard, My Papers, templates, profile, settings, admin views, modals. */
(function () {
  var esc = PaperRenderer.esc;
  var state = { view: 'dashboard', q: '', cls: '', subj: '', lang: '', sort: 'updated', editing: null };
  var shell = null, builderHandle = null;

  function toast(msg) {
    var el = document.createElement('div'); el.className = 'toast'; el.textContent = msg; el.setAttribute('role', 'status');
    document.getElementById('toast-root').appendChild(el); setTimeout(function () { el.remove(); }, 3200);
  }
  function modal(html, onMount) {
    var bg = document.createElement('div'); bg.className = 'modal-bg'; bg.innerHTML = '<div class="modal" role="dialog" aria-modal="true">' + html + '</div>';
    function close() { bg.remove(); document.removeEventListener('keydown', onKey); }
    function onKey(e) { if (e.key === 'Escape') close(); }
    bg.addEventListener('mousedown', function (e) { if (e.target === bg) close(); });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(bg);
    if (onMount) onMount(bg.firstChild, close);
    return { el: bg, close: close };
  }
  function confirmBox(title, msg, okLabel, onOk) {
    modal('<h3>' + esc(title) + '</h3><p>' + esc(msg) + '</p><div class="actions"><button class="btn" data-no>Cancel</button><button class="btn primary" data-ok>' + esc(okLabel) + '</button></div>', function (m, close) {
      m.querySelector('[data-no]').onclick = close; m.querySelector('[data-ok]').onclick = function () { close(); onOk(); };
      m.querySelector('[data-ok]').focus();
    });
  }
  function fmtDate(iso) { try { return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch (e) { return ''; } }
  function langName(l) { return l === 'ur' ? 'Urdu' : 'English'; }
  function initials(n) { return (n || '?').split(/\s+/).map(function (x) { return x[0]; }).slice(0, 2).join('').toUpperCase(); }

  var NAV = [
    ['dashboard', '🏠', 'Dashboard'], ['papers', '📄', 'My Papers'], ['new', '➕', 'Create New Paper'], ['templates', '🗂', 'Templates'], ['sep'],
    ['profile', '👤', 'Profile'], ['settings', '⚙', 'Account Settings'], ['sep'], ['logout', '↩', 'Logout']
  ];
  var ADMIN_NAV = [['admin-teachers', '🎓', 'All Teachers'], ['admin-papers', '📚', 'All Papers'], ['admin-settings', '🛠', 'System Settings']];
  var TITLES = { dashboard: 'Dashboard', papers: 'My Papers', new: 'Create New Paper', templates: 'Templates', profile: 'Profile', settings: 'Account Settings', builder: 'Paper Builder', view: 'View Paper', 'admin-teachers': 'All Teachers', 'admin-papers': 'All Papers', 'admin-settings': 'System Settings' };

  function mountShell(user, goto) {
    var root = document.getElementById('root');
    var items = NAV.slice(); if (user.role === 'admin') items = NAV.slice(0, 4).concat([['sep']], ADMIN_NAV, NAV.slice(4));
    root.innerHTML =
      '<div class="app"><aside class="sidebar" id="sidebar"><div class="brand"><img class="brand-logo" src="assets/logo-mark.png" width="52" height="52" alt=""> Exam Paper Maker</div><ul class="nav">' +
      items.map(function (n) { return n[0] === 'sep' ? '<li class="sep" role="separator"></li>' : '<li><button data-nav="' + n[0] + '"><span class="ico" aria-hidden="true">' + n[1] + '</span>' + n[2] + '</button></li>'; }).join('') +
      '</ul></aside><div class="scrim" id="scrim"></div>' +
      '<div class="main"><header class="topbar"><div style="display:flex;align-items:center;gap:10px"><button class="icon-btn menu-toggle" id="menu-btn" aria-label="Open menu">☰</button><h1 id="page-title"></h1></div>' +
      '<div class="right">' + Theme.button('theme-btn') + '<button class="icon-btn" id="notif-btn" aria-label="Notifications" style="position:relative">🔔<span class="badge-dot"></span></button>' +
      '<button class="profile-btn" id="prof-btn"><span class="avatar">' + esc(initials(user.name)) + '</span><span class="pname">' + esc(user.name) + '</span> ▾</button></div></header>' +
      '<main class="content" id="view"></main></div></div>';
    shell = root; Theme.refresh();
    var sb = root.querySelector('#sidebar'), sc = root.querySelector('#scrim');
    function closeMenu() { sb.classList.remove('open'); sc.classList.remove('open'); }
    root.querySelector('#menu-btn').onclick = function () { sb.classList.add('open'); sc.classList.add('open'); };
    sc.onclick = closeMenu;
    root.querySelectorAll('[data-nav]').forEach(function (b) { b.onclick = function () { closeMenu(); goto(b.getAttribute('data-nav')); }; });
    var dd = null;
    function closeDD() { if (dd) { dd.remove(); dd = null; } }
    function openDD(html, handler) {
      closeDD(); dd = document.createElement('div'); dd.className = 'dropdown'; dd.innerHTML = html; root.querySelector('.topbar .right').appendChild(dd);
      dd.addEventListener('click', function (e) { var b = e.target.closest('[data-go]'); if (b) { closeDD(); handler(b.getAttribute('data-go')); } });
      setTimeout(function () { document.addEventListener('click', function once(ev) { if (dd && !dd.contains(ev.target)) { closeDD(); } document.removeEventListener('click', once); }); }, 0);
    }
    root.querySelector('#prof-btn').onclick = function (e) { e.stopPropagation(); openDD('<div class="note"><b>' + esc(user.name) + '</b><br><span class="muted">' + esc(user.email) + ' · ' + user.role + '</span></div><button data-go="profile">Profile</button><button data-go="settings">Account Settings</button><button data-go="logout">Logout</button>', goto); };
    root.querySelector('#notif-btn').onclick = function (e) {
      e.stopPropagation();
      var n = PMStorage.papersFor(user).length;
      openDD('<div class="note"><b>Notifications</b></div><div class="item">Welcome to Paper Maker (prototype).</div><div class="item muted">You have ' + n + ' saved paper' + (n === 1 ? '' : 's') + '.</div>', function () {});
    };
  }

  function setActive(view) {
    if (!shell) return;
    var map = { builder: 'papers', view: 'papers' };
    shell.querySelectorAll('[data-nav]').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-nav') === (map[view] || view)); });
    shell.querySelector('#page-title').textContent = TITLES[view] || '';
  }

  /* ---------- paper cards ---------- */
  function card(p, user, showOwner) {
    var owner = showOwner ? PMStorage.ownerName(p.ownerId) : '';
    return '<article class="card" data-id="' + p.id + '"><div class="thumb" data-act="view" title="View paper"><div class="thumb-inner">' + PaperRenderer.renderAuto(p) + '</div></div>' +
      '<div class="card-body"><h4>' + esc(p.settings.title) + '</h4><div class="meta"><b>Class</b><span>' + esc(p.settings.className || '—') + '</span><b>Subject</b><span>' + esc(p.settings.subject || '—') + '</span><b>Language</b><span>' + langName(p.lang) + (p.autoTranslate ? ' <span class="tag">auto-translated</span>' : '') + '</span><b>Updated</b><span>' + fmtDate(p.updatedAt) + '</span>' + (owner ? '<b>Teacher</b><span>' + esc(owner) + '</span>' : '') + '</div></div>' +
      '<div class="card-actions"><button class="btn small" data-act="view">View</button><button class="btn small" data-act="edit">Edit</button><button class="btn small" data-act="pdf">Download PDF</button><button class="btn small" data-act="print">Print</button>' +
      '<button class="icon-btn" data-act="more" aria-label="More options" aria-haspopup="true">⋯</button></div></article>';
  }

  function bindCards(container, user, goto, refresh) {
    container.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]'); if (!b) return;
      var c = b.closest('.card'); if (!c) return;
      var id = c.getAttribute('data-id'), act = b.getAttribute('data-act');
      var p = PMStorage.getPaper(id, user); if (!p) { toast('Paper not found or no permission.'); return; }
      if (act === 'view') goto('view', id);
      else if (act === 'edit') goto('builder', id);
      else if (act === 'print') Export.print(p);
      else if (act === 'pdf') Export.pdf(p);
      else if (act === 'more') {
        var old = c.querySelector('.dropdown'); if (old) { old.remove(); return; }
        document.querySelectorAll('.card .dropdown').forEach(function (d) { d.remove(); });
        var dd = document.createElement('div'); dd.className = 'dropdown'; dd.style.cssText = 'right:14px;top:auto;bottom:52px;min-width:160px';
        dd.innerHTML = '<button data-m="dup">Duplicate</button><button data-m="del">Delete</button>';
        c.querySelector('.card-actions').appendChild(dd);
        dd.onclick = function (ev) {
          var m = ev.target.getAttribute('data-m'); dd.remove();
          if (m === 'dup') { var cp = PaperBuilder.clone(p); cp.id = PaperBuilder.uid('p'); cp.settings.title += ' (copy)'; cp.createdAt = new Date().toISOString(); cp.ownerId = user.role === 'admin' ? p.ownerId : user.id; PMStorage.savePaper(cp, user); toast('Paper duplicated'); refresh(); }
          if (m === 'del') confirmBox('Delete paper?', '“' + p.settings.title + '” will be permanently deleted. This cannot be undone.', 'Delete', function () { PMStorage.deletePaper(id, user); toast('Paper deleted'); refresh(); });
        };
        setTimeout(function () { document.addEventListener('click', function once(ev) { if (!dd.contains(ev.target)) dd.remove(); document.removeEventListener('click', once); }); }, 0);
      }
    });
  }

  function emptyState(hasAny) {
    return '<div class="empty"><h4>' + (hasAny ? 'No papers match your filters' : 'No papers yet') + '</h4><p class="muted">' + (hasAny ? 'Try clearing the search or filters.' : 'Create your first exam paper to get started.') + '</p>' + (hasAny ? '' : '<button class="btn primary" data-nav-new>Create New Paper</button>') + '</div>';
  }

  /* ---------- views ---------- */
  function viewDashboard(el, user, goto) {
    var all = PMStorage.papersFor(user).sort(function (a, b) { return b.updatedAt.localeCompare(a.updatedAt); });
    var created = all.slice().sort(function (a, b) { return b.createdAt.localeCompare(a.createdAt); }).slice(0, 3);
    var week = Date.now() - 7 * 864e5;
    var recentCount = all.filter(function (p) { return new Date(p.updatedAt).getTime() > week; }).length;
    var subjects = {}; all.forEach(function (p) { if (p.settings.subject) subjects[p.settings.subject] = 1; });
    el.innerHTML =
      '<section class="welcome"><div><h2>Welcome back, ' + esc(user.name.split(' ')[0]) + '</h2><p class="muted" style="margin:0">Build, edit and print exam papers in English, Urdu or both.</p></div><button class="btn primary" data-go="new">+ Create New Paper</button></section>' +
      '<div class="stats"><div class="stat"><div class="n">' + all.length + '</div><div class="l">Total papers</div></div><div class="stat"><div class="n">' + recentCount + '</div><div class="l">Edited this week</div></div><div class="stat"><div class="n">' + Object.keys(subjects).length + '</div><div class="l">Subjects</div></div><div class="stat"><div class="n">' + all.filter(function (p) { return p.lang === 'ur'; }).length + '</div><div class="l">Urdu papers</div></div></div>' +
      '<section class="panel"><div class="panel-head"><h3>Recently edited</h3><button class="btn small ghost" data-go="papers">View all →</button></div><div class="grid" id="g1">' + (all.length ? all.slice(0, 3).map(function (p) { return card(p, user); }).join('') : emptyState(false)) + '</div></section>' +
      '<section class="panel"><div class="panel-head"><h3>Recently created</h3></div><div class="grid" id="g2">' + (created.length ? created.map(function (p) { return card(p, user); }).join('') : '<p class="muted">Nothing created yet.</p>') + '</div></section>';
    wire(el, user, goto, function () { viewDashboard(el, user, goto); });
  }
  function wire(el, user, goto, refresh) {
    el.querySelectorAll('[data-go]').forEach(function (b) { b.onclick = function () { goto(b.getAttribute('data-go')); }; });
    var nb = el.querySelector('[data-nav-new]'); if (nb) nb.onclick = function () { goto('new'); };
    el.querySelectorAll('.grid').forEach(function (g) { bindCards(g, user, goto, refresh); });
  }

  function options(vals, sel, label) { return '<option value="">' + label + '</option>' + vals.map(function (v) { return '<option' + (v === sel ? ' selected' : '') + ' value="' + esc(v) + '">' + esc(v) + '</option>'; }).join(''); }
  function uniq(arr) { return arr.filter(function (v, i) { return v && arr.indexOf(v) === i; }).sort(); }

  function viewPapers(el, user, goto, adminAll) {
    var all = PMStorage.papersFor(user);
    var classes = uniq(all.map(function (p) { return p.settings.className; })), subs = uniq(all.map(function (p) { return p.settings.subject; }));
    el.innerHTML = '<div class="toolbar"><input class="inp search" id="f-q" type="search" placeholder="Search by paper title…" aria-label="Search papers" value="' + esc(state.q) + '">' +
      '<select class="inp" id="f-c" aria-label="Filter by class">' + options(classes, state.cls, 'All classes') + '</select>' +
      '<select class="inp" id="f-s" aria-label="Filter by subject">' + options(subs, state.subj, 'All subjects') + '</select>' +
      '<select class="inp" id="f-l" aria-label="Filter by language"><option value="">All languages</option><option value="en"' + (state.lang === 'en' ? ' selected' : '') + '>English</option><option value="ur"' + (state.lang === 'ur' ? ' selected' : '') + '>Urdu</option></select>' +
      '<select class="inp" id="f-o" aria-label="Sort"><option value="updated">Most recently updated</option><option value="title"' + (state.sort === 'title' ? ' selected' : '') + '>Title A–Z</option><option value="created"' + (state.sort === 'created' ? ' selected' : '') + '>Newest created</option></select>' +
      '<button class="btn primary" data-go="new">+ New paper</button></div><div class="grid" id="list"></div>';
    function draw() {
      var list = all.filter(function (p) {
        return (!state.q || p.settings.title.toLowerCase().indexOf(state.q.toLowerCase()) >= 0) && (!state.cls || p.settings.className === state.cls) && (!state.subj || p.settings.subject === state.subj) && (!state.lang || p.lang === state.lang);
      });
      list.sort(function (a, b) { return state.sort === 'title' ? a.settings.title.localeCompare(b.settings.title) : state.sort === 'created' ? b.createdAt.localeCompare(a.createdAt) : b.updatedAt.localeCompare(a.updatedAt); });
      el.querySelector('#list').innerHTML = list.length ? list.map(function (p) { return card(p, user, adminAll); }).join('') : '<div style="grid-column:1/-1">' + emptyState(all.length > 0) + '</div>';
      var nb = el.querySelector('[data-nav-new]'); if (nb) nb.onclick = function () { goto('new'); };
    }
    el.querySelector('#f-q').oninput = function (e) { state.q = e.target.value; draw(); };
    el.querySelector('#f-c').onchange = function (e) { state.cls = e.target.value; draw(); };
    el.querySelector('#f-s').onchange = function (e) { state.subj = e.target.value; draw(); };
    el.querySelector('#f-l').onchange = function (e) { state.lang = e.target.value; draw(); };
    el.querySelector('#f-o').onchange = function (e) { state.sort = e.target.value; draw(); };
    el.querySelector('[data-go]').onclick = function () { goto('new'); };
    bindCards(el.querySelector('#list'), user, goto, function () { viewPapers(el, user, goto, adminAll); });
    draw();
  }

  function viewNew(el, user, goto) {
    el.innerHTML = '<div class="panel form-card"><h3 style="margin-bottom:12px">Start a new paper</h3><div class="field"><label>Paper title</label><input id="np-title" placeholder="e.g. Grade 6 Science Examination"></div><div class="field"><label>Language</label><select id="np-lang"><option value="en">English (LTR)</option><option value="ur">اردو (RTL)</option></select></div><button class="btn primary" id="np-go">Create and open builder</button></div>';
    el.querySelector('#np-go').onclick = function () {
      var p = PaperBuilder.newPaper(user.id, el.querySelector('#np-lang').value); p.settings.title = el.querySelector('#np-title').value.trim() || 'Untitled Paper';
      PMStorage.savePaper(p, user); goto('builder', p.id);
    };
  }

  function viewTemplates(el, user, goto) {
    var tpls = [
      { name: 'Blank English paper', desc: 'Empty paper, left-to-right.', make: function () { return PaperBuilder.newPaper(user.id, 'en'); } },
      { name: 'Blank Urdu paper', desc: 'Empty paper, right-to-left.', make: function () { return PaperBuilder.newPaper(user.id, 'ur'); } },
      { name: 'English sample (Grade 6)', desc: 'Fill blanks, matching, sentences, rearrange, short answers.', make: function () { return PaperBuilder.sampleEnglish(user.id); } },
      { name: 'Mathematics sample (Grade 8)', desc: 'Fractions, roots, powers, equations and symbols.', make: function () { return PaperBuilder.sampleMath(user.id); } },
      { name: 'Urdu Science sample (Grade 6)', desc: 'Urdu MCQs, table and written answer.', make: function () { return PaperBuilder.sampleUrdu(user.id); } }
    ];
    el.innerHTML = '<p class="muted">Start from a template. A copy is saved to your papers.</p><div class="grid">' + tpls.map(function (t, i) { return '<div class="card"><div class="card-body"><h4>' + t.name + '</h4><p class="muted" style="margin:0 0 10px">' + t.desc + '</p></div><div class="card-actions"><button class="btn small primary" data-i="' + i + '">Use template</button></div></div>'; }).join('') + '</div>';
    el.querySelectorAll('[data-i]').forEach(function (b) { b.onclick = function () { var p = tpls[+b.getAttribute('data-i')].make(); p.id = PaperBuilder.uid('p'); p.ownerId = user.id; if (/sample/i.test(p.settings.title)) p.settings.title += ' (copy)'; PMStorage.savePaper(p, user); goto('builder', p.id); }; });
  }

  function viewPaper(el, user, goto, id) {
    var p = PMStorage.getPaper(id, user);
    if (!p) { el.innerHTML = '<div class="empty"><h4>Paper not found</h4><p class="muted">It may have been deleted, or you do not have access.</p></div>'; return; }
    el.style.maxWidth = 'none';
    el.innerHTML = '<div class="toolbar"><button class="btn" data-go="papers">← Back</button><span style="flex:1"></span><button class="btn" id="v-edit">Edit</button><button class="btn" id="v-print">Print</button><button class="btn primary" id="v-pdf">Download PDF</button></div><div class="view-stage"><div id="v-note"></div><div class="paper-wrap" id="v-paper"></div></div>';
    var paperEl = el.querySelector('#v-paper'), note = el.querySelector('#v-note');
    function draw() {
      if (!p.autoTranslate || !window.Translator) { paperEl.innerHTML = PaperRenderer.render(p); return; }
      var v = Translator.view(p); paperEl.innerHTML = PaperRenderer.render(v.paper);
      var todo = v.missing.filter(Translator.canFetch);
      note.innerHTML = '<div class="tr-banner">Auto-translated preview: ' + Translator.langName(v.source) + ' → ' + Translator.langName(v.target) +
        (todo.length ? ' · translating…' : v.missing.length ? ' · ' + v.missing.length + ' item(s) not translated, shown in the original. ' + esc(Translator.status().error || '') : '') + '</div>';
      if (todo.length) Translator.fetch(todo).then(function () { if (paperEl.isConnected) draw(); });
    }
    draw();
    el.querySelector('[data-go]').onclick = function () { goto('papers'); };
    el.querySelector('#v-edit').onclick = function () { goto('builder', id); };
    el.querySelector('#v-print').onclick = function () { Export.print(p); };
    el.querySelector('#v-pdf').onclick = function () { Export.pdf(p); };
  }

  function errBox(el, sel, msg) { el.querySelector(sel).innerHTML = msg ? '<div class="form-error" role="alert">' + esc(msg) + '</div>' : ''; }
  function busyBtn(btn, on, label) { if (on) { btn.dataset.label = btn.textContent; btn.textContent = label; } else btn.textContent = btn.dataset.label || btn.textContent; btn.disabled = on; }

  function viewProfile(el, user, goto, refreshUser) {
    var n = PMStorage.papersFor(user).length;
    el.innerHTML = '<div class="panel form-card"><h3 style="margin-bottom:12px">Profile</h3><div id="pf-err"></div><div class="field"><label for="pf-name">Full name</label><input id="pf-name" value="' + esc(user.name) + '"></div><div class="field"><label for="pf-acad">Academy / school</label><input id="pf-acad" value="' + esc(user.academy || '') + '"></div><div class="field"><label>Email</label><input value="' + esc(user.email) + '" disabled></div><p class="muted">Role: ' + esc(user.role) + ' · Papers: ' + n + '</p><button class="btn primary" id="pf-save">Save profile</button></div>';
    el.querySelector('#pf-save').onclick = function () {
      var btn = this, nm = el.querySelector('#pf-name').value.trim(); if (!nm) return errBox(el, '#pf-err', 'Name cannot be empty.');
      busyBtn(btn, true, 'Saving…');
      PMStorage.updateProfile(user, { name: nm, academy: el.querySelector('#pf-acad').value.trim() }).then(function (r) {
        busyBtn(btn, false);
        if (r.error) return errBox(el, '#pf-err', r.error);
        toast('Profile updated'); refreshUser();
      });
    };
  }

  function viewSettings(el, user) {
    var cloud = PMStorage.isCloud();
    el.innerHTML = '<div class="panel form-card"><h3 style="margin-bottom:12px">Change password</h3><div id="pw-err"></div><div class="field"><label for="pw-old">Current password</label><input type="password" id="pw-old" autocomplete="current-password"></div><div class="field"><label for="pw-new">New password</label><input type="password" id="pw-new" autocomplete="new-password"><span class="hint">At least 6 characters.' + (cloud ? ' You will stay logged in here; other devices will be logged out.' : '') + '</span></div><div class="field"><label for="pw-con">Confirm new password</label><input type="password" id="pw-con" autocomplete="new-password"></div><button class="btn primary" id="pw-save">Update password</button></div>' +
      (cloud
        ? '<div class="panel form-card"><h3 style="margin-bottom:8px">Your data</h3><p class="muted">Your account and papers are saved in the online database, so you can log in from any computer or phone.</p><p class="muted" id="sync-line"></p></div>'
        : '<div class="panel form-card"><h3 style="margin-bottom:8px">Demo data</h3><p class="muted">This copy is not connected to the database, so accounts and papers are kept only in this browser. This resets them and restores the demo data.</p><button class="btn" id="reset">Reset demo data</button></div>');
    el.querySelector('#pw-save').onclick = function () {
      var btn = this, o = el.querySelector('#pw-old').value, n = el.querySelector('#pw-new').value, c = el.querySelector('#pw-con').value;
      if (!o || !n || !c) return errBox(el, '#pw-err', 'Please fill in all fields.');
      if (n.length < 6) return errBox(el, '#pw-err', 'New password must be at least 6 characters.');
      if (n !== c) return errBox(el, '#pw-err', 'New passwords do not match.');
      busyBtn(btn, true, 'Updating…');
      PMStorage.changePassword(user, o, n).then(function (r) {
        busyBtn(btn, false);
        if (r.error) return errBox(el, '#pw-err', r.error);
        errBox(el, '#pw-err', ''); toast('Password updated'); ['#pw-old', '#pw-new', '#pw-con'].forEach(function (s) { el.querySelector(s).value = ''; });
      });
    };
    if (cloud) {
      var line = el.querySelector('#sync-line');
      PMStorage.onSync(function (st) { if (!line.isConnected) return false; line.textContent = st.error ? '⚠ ' + st.error : st.pending ? 'Saving changes…' : 'All changes are saved.'; });
    } else el.querySelector('#reset').onclick = function () { confirmBox('Reset demo data?', 'All local accounts and papers will be removed and the demo data restored.', 'Reset', function () { PMStorage.resetDemo(); location.reload(); }); };
  }

  /* ---------- admin ---------- */
  function viewAdminTeachers(el, user, goto) {
    el.innerHTML = '<p class="muted">Loading accounts…</p>';
    PMStorage.listUsers().then(function (r) {
      if (!el.isConnected) return;
      if (r.error) { el.innerHTML = '<div class="empty"><h4>Could not load accounts</h4><p class="muted">' + esc(r.error) + '</p><button class="btn" id="re">Try again</button></div>'; el.querySelector('#re').onclick = function () { viewAdminTeachers(el, user, goto); }; return; }
      var users = r.users, papers = PMStorage.allPapers();
      el.innerHTML = '<div class="grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:18px"><div class="stat"><div class="n">' + users.filter(function (u) { return u.role === 'teacher'; }).length + '</div><div class="l">Teachers</div></div><div class="stat"><div class="n">' + papers.length + '</div><div class="l">All papers</div></div><div class="stat"><div class="n">' + papers.filter(function (p) { return p.lang === 'ur'; }).length + '</div><div class="l">Urdu papers</div></div></div>' +
        '<div class="panel"><table class="table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Papers</th><th></th></tr></thead><tbody>' + users.map(function (u) {
          var self = u.id === user.id;
          return '<tr><td>' + esc(u.name) + (self ? ' <span class="muted">(you)</span>' : '') + '</td><td>' + esc(u.email) + '</td><td><span class="tag">' + esc(u.role) + '</span></td><td>' + (u.papers || 0) + '</td><td class="row-actions">' +
            (self ? '' : '<button class="btn small" data-pw="' + esc(u.id) + '">Reset password</button> <button class="btn small" data-role="' + esc(u.id) + '" data-to="' + (u.role === 'admin' ? 'teacher' : 'admin') + '">' + (u.role === 'admin' ? 'Make teacher' : 'Make admin') + '</button>' + (u.role === 'teacher' ? ' <button class="btn small" data-del="' + esc(u.id) + '">Remove</button>' : '')) + '</td></tr>';
        }).join('') + '</tbody></table></div>';
      function find(id) { return users.find(function (u) { return u.id === id; }) || {}; }
      el.querySelectorAll('[data-pw]').forEach(function (b) {
        b.onclick = function () {
          var id = b.getAttribute('data-pw'), t = find(id);
          modal('<h3>Reset password</h3><p class="muted">Set a new password for <b>' + esc(t.name) + '</b> (' + esc(t.email) + '). Tell them the new password; they can change it in Account Settings.</p><div id="ap-err"></div>' +
            '<div class="field"><label for="ap-pw">New password <span class="label-hint">(at least 6 characters)</span></label><input id="ap-pw" type="text" autocomplete="off"></div>' +
            '<div class="actions"><button class="btn" data-no>Cancel</button><button class="btn primary" data-ok>Set password</button></div>', function (m, close) {
              m.querySelector('[data-no]').onclick = close;
              m.querySelector('[data-ok]').onclick = function () {
                var btn = this; busyBtn(btn, true, 'Saving…');
                PMStorage.adminSetPassword(user, id, m.querySelector('#ap-pw').value).then(function (r) {
                  busyBtn(btn, false);
                  if (r.error) { m.querySelector('#ap-err').innerHTML = '<div class="form-error" role="alert">' + esc(r.error) + '</div>'; return; }
                  close(); toast('Password updated for ' + (t.name || 'teacher'));
                });
              };
              m.querySelector('#ap-pw').focus();
            });
        };
      });
      el.querySelectorAll('[data-role]').forEach(function (b) {
        b.onclick = function () {
          var id = b.getAttribute('data-role'), to = b.getAttribute('data-to'), t = find(id);
          confirmBox(to === 'admin' ? 'Make admin?' : 'Make teacher?', to === 'admin' ? t.name + ' will see all papers and all accounts, and can manage teachers.' : t.name + ' will only see their own papers.', to === 'admin' ? 'Make admin' : 'Make teacher', function () {
            PMStorage.setRole(user, id, to).then(function (r) { if (r.error) return toast(r.error); toast(t.name + ' is now ' + (to === 'admin' ? 'an admin' : 'a teacher')); viewAdminTeachers(el, user, goto); });
          });
        };
      });
      el.querySelectorAll('[data-del]').forEach(function (b) {
        b.onclick = function () {
          var id = b.getAttribute('data-del');
          confirmBox('Remove teacher?', 'The account and all of their papers will be deleted.', 'Remove', function () {
            PMStorage.deleteUser(user, id).then(function (r) { if (r.error) return toast(r.error); toast('Teacher removed'); viewAdminTeachers(el, user, goto); });
          });
        };
      });
    });
  }
  function viewAdminSettings(el) {
    el.innerHTML = '<div class="panel form-card"><h3 style="margin-bottom:8px">System settings (preview)</h3><p class="muted">In the full product the admin will configure available section types, languages and fonts here. In this prototype fonts are changed through the CSS variables <code>--font-english</code> and <code>--font-urdu</code> at the top of <code>styles.css</code>.</p><p><b>Section types:</b> ' + PaperBuilder.TYPES.map(function (t) { return '<span class="tag">' + Translations.get('en').types[t] + '</span>'; }).join(' ') + '</p><p><b>Languages:</b> <span class="tag">English (LTR)</span> <span class="tag">اردو (RTL)</span></p></div>';
  }

  /* ---------- router ---------- */
  function render(user, view, id, goto, refreshUser) {
    var el = shell.querySelector('#view'); el.style.maxWidth = '';
    if (builderHandle) { builderHandle.flush(); builderHandle = null; }
    setActive(view);
    var main = shell.querySelector('.main'); main.classList.remove('is-builder');
    if (view === 'builder') {
      var p = PMStorage.getPaper(id, user);
      if (!p) { el.innerHTML = '<div class="empty"><h4>Paper not found</h4></div>'; return; }
      el.style.padding = '0'; el.style.maxWidth = 'none';
      builderHandle = PaperBuilder.mount(el, { paper: p, user: user, onClose: function () { goto('papers'); } });
      return;
    }
    el.style.padding = '';
    switch (view) {
      case 'dashboard': return viewDashboard(el, user, goto);
      case 'papers': return viewPapers(el, user, goto, false);
      case 'new': return viewNew(el, user, goto);
      case 'templates': return viewTemplates(el, user, goto);
      case 'view': return viewPaper(el, user, goto, id);
      case 'profile': return viewProfile(el, user, goto, refreshUser);
      case 'settings': return viewSettings(el, user);
      case 'admin-teachers': return user.role === 'admin' ? viewAdminTeachers(el, user, goto) : goto('dashboard');
      case 'admin-papers': return user.role === 'admin' ? viewPapers(el, user, goto, true) : goto('dashboard');
      case 'admin-settings': return user.role === 'admin' ? viewAdminSettings(el) : goto('dashboard');
    }
  }

  window.Dashboard = { toast: toast, mountShell: mountShell, render: render, modal: modal, confirm: confirmBox };
})();
