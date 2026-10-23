/* storage.js — LocalStorage persistence (DEMO ONLY, not secure authentication) */
(function () {
  var K = { users: 'pm_users', papers: 'pm_papers', session: 'pm_session' };

  function read(key, fallback) {
    try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch (e) { return fallback; }
  }
  function write(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { alert('Storage full or unavailable.'); }
  }
  function uid(p) { return (p || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  // Demo-only obfuscation. NOT real hashing. Real product must use server-side hashing.
  function fakeHash(s) { var h = 5381; for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return 'demo$' + h; }

  /* ---- Password recovery (works without a mail server) ----
     Each account gets a one-time recovery code (e.g. K7Q4-9XMP-2RTA) when it is created. Only a hash is stored.
     "Forgot your password?" = email + recovery code + new password. A used code is replaced by a new one.
     5 wrong codes lock recovery for that account for 5 minutes. Admins can also set a new password for a teacher. */
  var CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', MAX_TRIES = 5, LOCK_MS = 5 * 60 * 1000;
  function makeCode() {
    var n = new Uint32Array(12), out = '';
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(n); else for (var j = 0; j < 12; j++) n[j] = Math.floor(Math.random() * 4294967296);
    for (var i = 0; i < 12; i++) out += CODE_CHARS[n[i] % CODE_CHARS.length];
    return out.slice(0, 4) + '-' + out.slice(4, 8) + '-' + out.slice(8);
  }
  function normCode(c) { return String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
  function codeHash(c) { return fakeHash('rc:' + normCode(c)); }

  var Storage = {
    uid: uid,
    seed: function () {
      var users = read(K.users, null);
      if (!users) {
        users = [
          { id: 'u_admin', name: 'Main Admin', email: 'admin@demo.test', pass: fakeHash('admin123'), role: 'admin', academy: 'Demo Academy' },
          { id: 'u_teacher', name: 'Demo Teacher', email: 'teacher@demo.test', pass: fakeHash('teacher123'), role: 'teacher', academy: 'Demo Academy' }
        ];
        write(K.users, users);
      }
      if (!read(K.papers, null)) {
        write(K.papers, window.PaperBuilder ? [window.PaperBuilder.sampleEnglish('u_teacher'), window.PaperBuilder.sampleUrdu('u_teacher'), window.PaperBuilder.sampleMath('u_teacher')] : []);
      }
    },
    users: function () { return read(K.users, []); },
    saveUsers: function (u) { write(K.users, u); },
    register: function (name, email, password, academy) {
      var users = this.users();
      if (users.some(function (u) { return u.email.toLowerCase() === email.toLowerCase(); })) return { error: 'An account with this email already exists.' };
      var user = { id: uid('u'), name: name, email: email, pass: fakeHash(password), role: 'teacher', academy: academy || '' };
      users.push(user); this.saveUsers(users);
      return { user: user };
    },
    // remember = "Keep me logged in": session survives closing the browser (localStorage);
    // otherwise it lasts only for this tab (sessionStorage).
    login: function (email, password, remember) {
      var u = this.users().find(function (x) { return x.email.toLowerCase() === email.toLowerCase(); });
      if (!u) return { error: 'No account found with this email. Click “Create Account” to register first.', noAccount: true };
      if (u.pass !== fakeHash(password)) return { error: 'Incorrect password. Please try again.' };
      this.logout();
      if (remember === false) { try { sessionStorage.setItem(K.session, JSON.stringify({ userId: u.id })); } catch (e) { write(K.session, { userId: u.id }); } }
      else write(K.session, { userId: u.id });
      return { user: u };
    },
    loginAs: function (role) {
      var users = this.users();
      var u = users.find(function (x) { return x.role === role; });
      if (!u) { // demo account was removed — recreate it so the demo shortcut always works
        var demoEmail = role === 'admin' ? 'admin@demo.test' : 'teacher@demo.test';
        u = users.find(function (x) { return x.email.toLowerCase() === demoEmail; });
        if (u) u.role = role;
        else { u = { id: role === 'admin' ? 'u_admin' : uid('u'), name: role === 'admin' ? 'Main Admin' : 'Demo Teacher', email: demoEmail, pass: fakeHash(role === 'admin' ? 'admin123' : 'teacher123'), role: role, academy: 'Demo Academy' }; users.push(u); }
        this.saveUsers(users);
      }
      write(K.session, { userId: u.id });
      return u;
    },
    logout: function () { try { localStorage.removeItem(K.session); } catch (e) {} try { sessionStorage.removeItem(K.session); } catch (e) {} },
    currentUser: function () {
      var s = read(K.session, null);
      if (!s) { try { s = JSON.parse(sessionStorage.getItem(K.session) || 'null'); } catch (e) { s = null; } }
      if (!s) return null;
      return this.users().find(function (u) { return u.id === s.userId; }) || null;
    },
    updateUser: function (id, patch) {
      var users = this.users();
      users.forEach(function (u) { if (u.id === id) { for (var k in patch) u[k] = patch[k]; } });
      this.saveUsers(users);
    },
    setPassword: function (id, pw) { this.updateUser(id, { pass: fakeHash(pw) }); },
    checkPassword: function (id, pw) { var u = this.users().find(function (x) { return x.id === id; }); return u && u.pass === fakeHash(pw); },

    allPapers: function () { return read(K.papers, []); },
    // Authorization: teachers only see their own papers; admin sees all.
    papersFor: function (user) {
      var all = this.allPapers();
      return user.role === 'admin' ? all : all.filter(function (p) { return p.ownerId === user.id; });
    },
    getPaper: function (id, user) {
      var p = this.allPapers().find(function (x) { return x.id === id; });
      if (!p) return null;
      if (user.role !== 'admin' && p.ownerId !== user.id) return null;
      return p;
    },
    savePaper: function (paper, user) {
      if (user.role !== 'admin' && paper.ownerId !== user.id) return false;
      var all = this.allPapers(), found = false;
      paper.updatedAt = new Date().toISOString();
      all = all.map(function (p) { if (p.id === paper.id) { found = true; return paper; } return p; });
      if (!found) all.push(paper);
      write(K.papers, all); return true;
    },
    deletePaper: function (id, user) {
      var p = this.getPaper(id, user); if (!p) return false;
      write(K.papers, this.allPapers().filter(function (x) { return x.id !== id; })); return true;
    },
    findByEmail: function (email) { email = String(email || '').toLowerCase(); return this.users().find(function (x) { return x.email.toLowerCase() === email; }) || null; },
    hasRecovery: function (id) { var u = this.users().find(function (x) { return x.id === id; }); return !!(u && u.recovery); },
    /* creates (or replaces) the account's recovery code and returns it in plain text — show it once */
    newRecoveryCode: function (id) { var code = makeCode(); this.updateUser(id, { recovery: codeHash(code), rcTries: 0, rcLock: 0 }); return code; },
    /* step 1 of "Forgot password": is there an account, and can it be recovered? */
    recoveryStatus: function (email) {
      var u = this.findByEmail(email);
      if (!u) return { error: 'No account found with this email.' };
      if (!u.recovery) return { error: 'This account has no recovery code. Ask your school admin to set a new password for you (All Teachers → Reset password).', noCode: true };
      if (u.rcLock && u.rcLock > Date.now()) return { error: 'Too many wrong codes. Try again in ' + Math.ceil((u.rcLock - Date.now()) / 60000) + ' minute(s).', locked: true };
      return { ok: true };
    },
    /* step 2: check the code, set the new password, issue a fresh code (the old one is used up) */
    resetWithCode: function (email, code, newPw) {
      var st = this.recoveryStatus(email); if (st.error) return st;
      if (!newPw || newPw.length < 6) return { error: 'New password must be at least 6 characters.' };
      var u = this.findByEmail(email);
      if (codeHash(code) !== u.recovery) {
        var tries = (u.rcTries || 0) + 1;
        if (tries >= MAX_TRIES) { this.updateUser(u.id, { rcTries: 0, rcLock: Date.now() + LOCK_MS }); return { error: 'Too many wrong codes. Recovery is locked for 5 minutes.', locked: true }; }
        this.updateUser(u.id, { rcTries: tries });
        return { error: 'That recovery code is not correct. ' + (MAX_TRIES - tries) + ' attempt(s) left.' };
      }
      this.updateUser(u.id, { pass: fakeHash(newPw), rcTries: 0, rcLock: 0 });
      return { ok: true, newCode: this.newRecoveryCode(u.id) };
    },
    /* admin sets a new password for a teacher (and clears any recovery lock) */
    adminSetPassword: function (admin, id, newPw) {
      if (!admin || admin.role !== 'admin') return { error: 'Only an admin can do this.' };
      if (!newPw || newPw.length < 6) return { error: 'Password must be at least 6 characters.' };
      if (!this.users().some(function (x) { return x.id === id; })) return { error: 'Account not found.' };
      this.updateUser(id, { pass: fakeHash(newPw), rcTries: 0, rcLock: 0 }); return { ok: true };
    },
    resetDemo: function () { try { Object.keys(K).forEach(function (k) { localStorage.removeItem(K[k]); }); localStorage.removeItem('pm_tr_cache_v1'); } catch (e) {} }
  };
  window.PMStorage = Storage;
})();
