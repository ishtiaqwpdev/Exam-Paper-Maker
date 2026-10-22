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
    register: function (name, email, password) {
      var users = this.users();
      if (users.some(function (u) { return u.email.toLowerCase() === email.toLowerCase(); })) return { error: 'An account with this email already exists.' };
      var user = { id: uid('u'), name: name, email: email, pass: fakeHash(password), role: 'teacher', academy: '' };
      users.push(user); this.saveUsers(users);
      return { user: user };
    },
    login: function (email, password) {
      var u = this.users().find(function (x) { return x.email.toLowerCase() === email.toLowerCase(); });
      if (!u || u.pass !== fakeHash(password)) return { error: 'Incorrect email or password.' };
      write(K.session, { userId: u.id });
      return { user: u };
    },
    loginAs: function (role) {
      var u = this.users().find(function (x) { return x.role === role; });
      if (u) write(K.session, { userId: u.id });
      return u;
    },
    logout: function () { localStorage.removeItem(K.session); },
    currentUser: function () {
      var s = read(K.session, null); if (!s) return null;
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
    resetDemo: function () { Object.keys(K).forEach(function (k) { localStorage.removeItem(K[k]); }); }
  };
  window.PMStorage = Storage;
})();
