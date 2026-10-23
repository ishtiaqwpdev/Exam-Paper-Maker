/* theme.js — light / dark mode.
   - First visit follows the computer's setting (prefers-color-scheme) and keeps following it.
   - Clicking the sun/moon button saves the choice in this browser (localStorage "pm_theme").
   - Only the app UI changes colour; the exam paper preview and print always stay black on white. */
(function () {
  var KEY = 'pm_theme', root = document.documentElement;
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  function saved() { try { var v = localStorage.getItem(KEY); return v === 'dark' || v === 'light' ? v : null; } catch (e) { return null; } }
  function current() { return saved() || (mq && mq.matches ? 'dark' : 'light'); }
  function apply() { root.setAttribute('data-theme', current()); refreshButtons(); }
  var MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
  var SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/></svg>';
  function refreshButtons() {
    var dark = current() === 'dark';
    document.querySelectorAll('[data-theme-toggle]').forEach(function (b) {
      b.innerHTML = dark ? SUN : MOON;
      var label = dark ? 'Switch to light mode' : 'Switch to dark mode';
      b.setAttribute('aria-label', label); b.title = label; b.setAttribute('aria-pressed', String(dark));
    });
  }
  function set(mode) { try { localStorage.setItem(KEY, mode); } catch (e) {} apply(); }
  function toggle() { set(current() === 'dark' ? 'light' : 'dark'); }
  // one delegated listener works for every toggle button, even ones rendered later
  document.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('[data-theme-toggle]'); if (b) toggle(); });
  if (mq) { var onSys = function () { if (!saved()) apply(); }; if (mq.addEventListener) mq.addEventListener('change', onSys); else if (mq.addListener) mq.addListener(onSys); }
  apply();
  window.Theme = { current: current, set: set, toggle: toggle, refresh: refreshButtons,
    button: function (cls) { return '<button type="button" class="icon-btn ' + (cls || '') + '" data-theme-toggle aria-label="Switch theme"></button>'; } };
})();
