/* export.js — Print and PDF.
   Print uses the browser's print dialog (only the paper is printed).
   PDF: tries a client-side library (html2pdf.js from a CDN, needs internet once);
   if unavailable, falls back to the print dialog where you choose "Save as PDF". */
(function () {
  function fileName(p) { return (p.settings.title || 'paper').replace(/[^\w؀-ۿ\- ]+/g, '').trim().replace(/\s+/g, '_') || 'paper'; }

  function stage(paper) {
    var root = document.getElementById('print-root');
    root.innerHTML = '<div class="paper-wrap">' + PaperRenderer.render(paper, { showKeys: paper.showKeys }) + '</div>';
    return root;
  }

  function print(paper) {
    if (window.__ARTIFACT) { Dashboard.toast('Print and PDF are blocked in the online preview. Open index.html from the downloaded folder to use them.'); return; }
    stage(paper);
    var old = document.title; document.title = fileName(paper);
    setTimeout(function () { window.print(); document.title = old; }, 80);
  }

  function loadLib(cb) {
    if (window.html2pdf) return cb(true);
    var s = document.createElement('script'), done = false;
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    s.onload = function () { done = true; cb(true); };
    s.onerror = function () { if (!done) { done = true; cb(false); } };
    document.head.appendChild(s);
    setTimeout(function () { if (!done) { done = true; cb(false); } }, 6000);
  }

  function pdf(paper) {
    if (window.__ARTIFACT) { Dashboard.toast('Print and PDF are blocked in the online preview. Open index.html from the downloaded folder to use them.'); return; }
    Dashboard.toast('Preparing PDF…');
    loadLib(function (ok) {
      if (!ok || !window.html2pdf) {
        Dashboard.toast('PDF library not reachable — opening print dialog. Choose "Save as PDF".');
        return setTimeout(function () { print(paper); }, 900);
      }
      var host = document.createElement('div');
      host.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;background:#fff';
      host.innerHTML = PaperRenderer.render(paper, { showKeys: paper.showKeys });
      document.body.appendChild(host);
      var el = host.firstChild; el.style.boxShadow = 'none';
      var go = function () {
        window.html2pdf().set({ margin: 0, filename: fileName(paper) + '.pdf', image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'px', format: [794, 1123], hotfixes: ['px_scaling'] }, pagebreak: { mode: ['css', 'legacy'] } })
          .from(el).save().then(function () { host.remove(); Dashboard.toast('PDF downloaded'); }).catch(function () { host.remove(); Dashboard.toast('PDF failed — use Print → Save as PDF.'); });
      };
      (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(go);
    });
  }

  window.Export = { print: print, pdf: pdf };
})();
