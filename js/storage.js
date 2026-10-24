/* storage.js — where accounts and papers are kept.

   Two modes, chosen automatically by PMStorage.init():
   - "cloud": the live site with a database connected (Vercel + Postgres). Accounts, passwords (hashed on the server)
     and papers live in the database, so a teacher can log in from any device. Papers are kept in memory for instant
     screens; every change is sent to the server in the background (retried if the internet drops).
   - "local": index.html opened from a folder, or no database yet. Everything stays in this browser (demo only).

   Reads (currentUser, papersFor, getPaper, …) are instant in both modes. Account actions (login, register, password,
   admin tools) return Promises. */
(function () {
  var K = { users: 'pm_users', papers: 'pm_papers', session: 'pm_session', token: 'pm_token' };

  function read(key, fallback, store) {
    try { var v = (store || localStorage).getItem(key); return v ? JSON.parse(v) : fallback; }
    catch (e) { return fallback; }
  }
  function write(key, val, store) {
    try { (store || localStorage).setItem(key, JSON.stringify(val)); return true; } catch (e) { return false; }
  }
  function remove(key) { try { localStorage.removeItem(key); } catch (e) {} try { sessionStorage.removeItem(key); } catch (e) {} }
  function uid(p) { return (p || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function ok(v) { return Promise.resolve(v); }

  // Local (demo) mode only: light obfuscation, NOT real security. Cloud mode hashes passwords on the server (scrypt).
  function fakeHash(s) { var h = 5381; for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return 'demo$' + h; }

  /* ============================ local backend ============================ */
  var Local = {
    seed: function () {
      if (!read(K.users, null)) {
        write(K.users, [
          { id: 'u_admin', name: 'Main Admin', email: 'admin@demo.test', pass: fakeHash('admin123'), role: 'admin', academy: 'Demo Academy' },
          { id: 'u_teacher', name: 'Demo Teacher', email: 'teacher@demo.test', pass: fakeHash('teacher123'), role: 'teacher', academy: 'Demo Academy' }
        ]);
      }
      if (!read(K.papers, null)) {
        write(K.papers, window.PaperBuilder ? [window.PaperBuilder.sampleEnglish('u_teacher'), window.PaperBuilder.sampleUrdu('u_teacher'), window.PaperBuilder.sampleMath('u_teacher')] : []);
      }
    },
    users: function () { return read(K.users, []); },
    saveUsers: function (u) { if (!write(K.users, u)) alert('Browser storage is full or blocked.'); },
    find: function (email) { email = String(email || '').toLowerCase(); return this.users().find(function (x) { return x.email.toLowerCase() === email; }) || null; },
    update: function (id, patch) { var us = this.users(); us.forEach(function (u) { if (u.id === id) for (var k in patch) u[k] = patch[k]; }); this.saveUsers(us); },
    session: function () { return read(K.session, null) || read(K.session, null, sessionStorage); },
    papers: function () { return read(K.papers, []); },
    savePapers: function (all) { if (!write(K.papers, all)) alert('Browser storage is full or blocked.'); }
  };

  /* ============================ cloud backend ============================ */
  var cloud = { user: null, papers: [], owners: {}, users: null, token: null, remember: true };
  var pending = {}, pendingDeletes = {}, timers = {}, syncError = '', listeners = [], retryTimer = null, retryDelay = 4000;

  function api(action, data, opts) {
    var body = Object.assign({ action: action }, data || {});
    var headers = { 'Content-Type': 'application/json' };
    if (cloud.token) headers.Authorization = 'Bearer ' + cloud.token;
    return fetch('/api/data', { method: 'POST', headers: headers, body: JSON.stringify(body), keepalive: !!(opts && opts.keepalive) })
      .then(function (r) {
        return r.text().then(function (t) {
          var j = null; try { j = JSON.parse(t); } catch (e) {}
          if (!j) return { error: 'The server did not answer. Please try again.', code: 'bad_response', status: r.status };
          if (!r.ok) { j.status = r.status; if (r.status === 401 && cloud.user) onLoggedOut(); }
          return j;
        });
      }, function () { return { error: 'No internet connection. Check it and try again.', code: 'offline' }; });
  }
  function saveToken(token, remember) {
    cloud.token = token; cloud.remember = remember !== false;
    remove(K.token);
    write(K.token, token, cloud.remember ? localStorage : sessionStorage);
  }
  function readToken() { return read(K.token, null) || read(K.token, null, sessionStorage); }
  function onLoggedOut() {
    remove(K.token); cloud.token = null; cloud.user = null; cloud.papers = []; cloud.users = null;
    if (window.__onSessionExpired) window.__onSessionExpired();
  }

  function status() {
    return { pending: Object.keys(pending).length + Object.keys(pendingDeletes).length, error: syncError };
  }
  function notify() { var s = status(); listeners = listeners.filter(function (fn) { try { return fn(s) !== false; } catch (e) { return false; } }); }
  function scheduleRetry() {
    clearTimeout(retryTimer);
    retryTimer = setTimeout(function () { flush(); }, retryDelay);
    retryDelay = Math.min(retryDelay * 2, 60000);
  }
  function pushPaper(id) {
    var p = pending[id]; if (!p) return ok(true);
    return api('savePaper', { paper: p }).then(function (r) {
      if (r.error) {
        if (r.code === 'offline' || r.status >= 500 || !r.status) { syncError = 'Not saved yet — no connection. Retrying…'; scheduleRetry(); }
        else { delete pending[id]; syncError = r.error; }          // a real refusal (too large, no permission…): stop retrying
        notify(); return false;
      }
      if (pending[id] === p) delete pending[id];                  // newer edits made meanwhile stay queued
      var c = cloud.papers.find(function (x) { return x.id === id; }); if (c && r.ownerId) c.ownerId = r.ownerId;
      if (!Object.keys(pending).length && !Object.keys(pendingDeletes).length) { syncError = ''; retryDelay = 4000; }
      notify(); return true;
    });
  }
  function pushDelete(id) {
    return api('deletePaper', { id: id }).then(function (r) {
      if (r.error && (r.code === 'offline' || r.status >= 500 || !r.status)) { syncError = 'Not deleted on the server yet — retrying…'; scheduleRetry(); notify(); return false; }
      delete pendingDeletes[id]; if (r.error) syncError = r.error; else if (!status().pending) syncError = '';
      notify(); return !r.error;
    });
  }
  function flush(keepalive) {
    var jobs = Object.keys(pending).map(function (id) { clearTimeout(timers[id]); return keepalive ? api('savePaper', { paper: pending[id] }, { keepalive: true }) : pushPaper(id); });
    Object.keys(pendingDeletes).forEach(function (id) { jobs.push(pushDelete(id)); });
    return Promise.all(jobs);
  }
  window.addEventListener('online', function () { if (Storage.mode === 'cloud') flush(); });
  window.addEventListener('pagehide', function () { if (Storage.mode === 'cloud' && status().pending) flush(true); });
  window.addEventListener('beforeunload', function (e) { if (Storage.mode === 'cloud' && Object.keys(pending).length && navigator.onLine === false) { e.preventDefault(); e.returnValue = ''; } });

  function applyList(r) { cloud.user = r.user; cloud.papers = r.papers || []; cloud.owners = r.owners || {}; }

  /* Papers made in this browser before the database existed are copied up once, for the same email. */
  function importLocal(user) {
    var flag = 'pm_imported_' + user.email.toLowerCase();
    if (read(flag, false)) return ok(0);
    var lu = Local.find(user.email); if (!lu) return ok(0);
    var mine = Local.papers().filter(function (p) { return p.ownerId === lu.id; });
    if (!mine.length) { write(flag, true); return ok(0); }
    return api('importPapers', { papers: mine }).then(function (r) {
      if (r.error) return 0;
      write(flag, true);
      return api('listPapers').then(function (l) { if (!l.error) applyList(l); return r.imported || 0; });
    });
  }

  /* ============================ public API ============================ */
  var Storage = {
    uid: uid,
    mode: 'local',
    syncStatus: status,
    onSync: function (fn) { listeners.push(fn); fn(status()); },
    flush: function () { return flush(); },

    /* decide the mode and load the logged-in account (call once at start) */
    init: function () {
      if (!/^https?:$/.test(location.protocol)) { this.mode = 'local'; Local.seed(); return ok('local'); }
      var self = this, ctl = window.AbortController ? new AbortController() : null, t = setTimeout(function () { if (ctl) ctl.abort(); }, 7000);
      return fetch('/api/data?action=status', ctl ? { signal: ctl.signal } : {}).then(function (r) { return r.ok ? r.json() : null; }, function () { return null; })
        .then(function (st) {
          clearTimeout(t);
          self.serverStatus = st;
          // no database, or it cannot be reached: keep working in this browser and say so clearly
          if (!st || !st.db || st.dbOk === false) { self.mode = 'local'; self.dbProblem = st && st.db ? (st.dbError || 'The database could not be reached.') : ''; Local.seed(); return 'local'; }
          self.mode = 'cloud'; self.emailReady = !!st.email;
          cloud.token = readToken(); cloud.remember = !!read(K.token, null);
          if (!cloud.token) return 'cloud';
          return api('listPapers').then(function (r) { if (r.error) { if (r.status === 401) remove(K.token), cloud.token = null; else self.loadError = r.error; } else applyList(r); return 'cloud'; });
        });
    },
    isCloud: function () { return this.mode === 'cloud'; },

    /* ----- account ----- */
    currentUser: function () {
      if (this.mode === 'cloud') return cloud.user;
      var s = Local.session(); if (!s) return null;
      return Local.users().find(function (u) { return u.id === s.userId; }) || null;
    },
    login: function (email, password, remember) {
      if (this.mode === 'cloud') {
        return api('login', { email: email, password: password }).then(function (r) {
          if (r.error) return r;
          saveToken(r.token, remember);
          return api('listPapers').then(function (l) {
            if (l.error) return l; applyList(l);
            return importLocal(l.user).then(function (n) { return { user: cloud.user, imported: n }; });
          });
        });
      }
      var u = Local.find(email);
      if (!u) return ok({ error: 'No account found with this email. Click “Create Account” to register first.', code: 'no_account' });
      if (u.pass !== fakeHash(password)) return ok({ error: 'Incorrect password. Please try again.' });
      this.logout();
      write(K.session, { userId: u.id }, remember === false ? sessionStorage : localStorage);
      return ok({ user: u });
    },
    register: function (name, email, password, academy) {
      if (this.mode === 'cloud') {
        return api('register', { name: name, email: email, password: password, academy: academy }).then(function (r) {
          if (r.error) return r;
          saveToken(r.token, true); cloud.user = r.user; cloud.papers = []; cloud.owners = {};
          return importLocal(r.user).then(function (n) { return { user: cloud.user, first: r.first, imported: n }; });
        });
      }
      var users = Local.users();
      if (users.some(function (u) { return u.email.toLowerCase() === email.toLowerCase(); })) return ok({ error: 'An account with this email already exists.' });
      var user = { id: uid('u'), name: name, email: email, pass: fakeHash(password), role: 'teacher', academy: academy || '' };
      users.push(user); Local.saveUsers(users);
      write(K.session, { userId: user.id });
      return ok({ user: user });
    },
    logout: function () {
      if (this.mode === 'cloud') { if (status().pending) flush(true); remove(K.token); cloud.token = null; cloud.user = null; cloud.papers = []; cloud.users = null; return; }
      remove(K.session);
    },
    updateProfile: function (user, patch) {
      if (this.mode === 'cloud') return api('updateProfile', patch).then(function (r) { if (!r.error) { cloud.user = r.user; cloud.owners[r.user.id] = r.user.name; } return r; });
      Local.update(user.id, { name: patch.name, academy: patch.academy }); return ok({ ok: true });
    },
    changePassword: function (user, oldPw, newPw) {
      if (this.mode === 'cloud') return api('changePassword', { oldPassword: oldPw, newPassword: newPw }).then(function (r) { if (!r.error) saveToken(r.token, cloud.remember); return r; });
      var u = Local.users().find(function (x) { return x.id === user.id; });
      if (!u || u.pass !== fakeHash(oldPw)) return ok({ error: 'Current password is incorrect.' });
      if (!newPw || newPw.length < 6) return ok({ error: 'New password must be at least 6 characters.' });
      Local.update(user.id, { pass: fakeHash(newPw) }); return ok({ ok: true });
    },
    /* local mode only (cloud: the server answers "No account found" when the code is requested) */
    localAccountExists: function (email) { return this.mode === 'cloud' ? true : !!Local.find(email); },
    /* final step of "Forgot password" (the emailed code is checked again by the server in cloud mode) */
    resetPassword: function (email, code, resetToken, newPw) {
      if (this.mode === 'cloud') return api('resetPassword', { email: email, code: code, resetToken: resetToken, newPassword: newPw });
      var u = Local.find(email); if (!u) return ok({ error: 'No account found with this email.' });
      if (!newPw || newPw.length < 6) return ok({ error: 'New password must be at least 6 characters.' });
      Local.update(u.id, { pass: fakeHash(newPw) }); return ok({ ok: true });
    },

    /* ----- papers (instant reads; cloud writes sync in the background) ----- */
    allPapers: function () { return this.mode === 'cloud' ? cloud.papers : Local.papers(); },
    /* working papers (My Papers). Library copies (kind: 'library') are kept apart — see libraryFor */
    papersFor: function (user) { return this.visibleFor(user).filter(function (p) { return !p.kind; }); },
    /* My templates: papers saved as reusable layouts (kind: 'template') */
    templatesFor: function (user) { return this.visibleFor(user).filter(function (p) { return p.kind === 'template'; }); },
    /* Paper Library: saved copies a teacher can reuse later */
    libraryFor: function (user) { return this.visibleFor(user).filter(function (p) { return p.kind === 'library'; }); },
    visibleFor: function (user) {
      if (!user) return [];
      var all = this.allPapers();
      return user.role === 'admin' ? all.slice() : all.filter(function (p) { return p.ownerId === user.id; });
    },
    getPaper: function (id, user) {
      var p = this.allPapers().find(function (x) { return x.id === id; });
      if (!p || !user) return null;
      if (user.role !== 'admin' && p.ownerId !== user.id) return null;
      return p;
    },
    savePaper: function (paper, user) {
      if (!user || (user.role !== 'admin' && paper.ownerId !== user.id)) return false;
      paper.updatedAt = new Date().toISOString();
      if (this.mode === 'cloud') {
        var i = cloud.papers.findIndex(function (x) { return x.id === paper.id; });
        if (i >= 0) cloud.papers[i] = paper; else cloud.papers.unshift(paper);
        pending[paper.id] = clone(paper); delete pendingDeletes[paper.id];
        clearTimeout(timers[paper.id]); timers[paper.id] = setTimeout(function () { pushPaper(paper.id); }, 600);
        notify(); return true;
      }
      var all = Local.papers(), found = false;
      all = all.map(function (p) { if (p.id === paper.id) { found = true; return paper; } return p; });
      if (!found) all.push(paper);
      Local.savePapers(all); return true;
    },
    deletePaper: function (id, user) {
      if (!this.getPaper(id, user)) return false;
      if (this.mode === 'cloud') {
        cloud.papers = cloud.papers.filter(function (x) { return x.id !== id; });
        clearTimeout(timers[id]); delete pending[id]; pendingDeletes[id] = true; notify(); pushDelete(id); return true;
      }
      Local.savePapers(Local.papers().filter(function (x) { return x.id !== id; })); return true;
    },
    ownerName: function (ownerId) {
      if (this.mode === 'cloud') return cloud.owners[ownerId] || '';
      return (Local.users().find(function (u) { return u.id === ownerId; }) || {}).name || '';
    },
    reload: function () {
      if (this.mode !== 'cloud') return ok(true);
      return api('listPapers').then(function (r) { if (!r.error) applyList(r); return r; });
    },

    /* ----- admin ----- */
    listUsers: function () {
      if (this.mode === 'cloud') return api('listUsers').then(function (r) { if (!r.error) { cloud.users = r.users; r.users.forEach(function (u) { cloud.owners[u.id] = u.name; }); } return r; });
      var papers = Local.papers();
      return ok({ users: Local.users().map(function (u) { return { id: u.id, name: u.name, email: u.email, role: u.role, academy: u.academy, papers: papers.filter(function (p) { return p.ownerId === u.id && !p.kind; }).length }; }) });
    },
    adminSetPassword: function (admin, id, newPw) {
      if (!admin || admin.role !== 'admin') return ok({ error: 'Only an admin can do this.' });
      if (this.mode === 'cloud') return api('adminSetPassword', { id: id, password: newPw });
      if (!newPw || newPw.length < 6) return ok({ error: 'Password must be at least 6 characters.' });
      if (!Local.users().some(function (x) { return x.id === id; })) return ok({ error: 'Account not found.' });
      Local.update(id, { pass: fakeHash(newPw) }); return ok({ ok: true });
    },
    deleteUser: function (admin, id) {
      if (!admin || admin.role !== 'admin') return ok({ error: 'Only an admin can do this.' });
      if (this.mode === 'cloud') return api('deleteUser', { id: id }).then(function (r) { if (!r.error) cloud.papers = cloud.papers.filter(function (p) { return p.ownerId !== id; }); return r; });
      if (id === admin.id) return ok({ error: 'You cannot remove your own account.' });
      Local.saveUsers(Local.users().filter(function (u) { return u.id !== id; }));
      Local.savePapers(Local.papers().filter(function (p) { return p.ownerId !== id; }));
      return ok({ ok: true });
    },
    setRole: function (admin, id, role) {
      if (!admin || admin.role !== 'admin') return ok({ error: 'Only an admin can do this.' });
      if (this.mode === 'cloud') return api('setRole', { id: id, role: role });
      if (id === admin.id && role !== 'admin') return ok({ error: 'You cannot remove your own admin role.' });
      Local.update(id, { role: role === 'admin' ? 'admin' : 'teacher' }); return ok({ ok: true });
    },

    /* local demo only */
    resetDemo: function () { try { ['pm_users', 'pm_papers', 'pm_session', 'pm_tr_cache_v1'].forEach(function (k) { localStorage.removeItem(k); }); } catch (e) {} }
  };
  window.PMStorage = Storage;
})();
