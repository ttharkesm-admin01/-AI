/* export-img.js — ส่งออก Dashboard เป็น JPG / PDF (multi-page A4 landscape)
   โหลด html2canvas + jsPDF แบบ on-demand (ไม่บล็อก page load) */
var ExportImg = (function () {
  'use strict';
  var H2C_URL = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
  var PDF_URL = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';

  function loadScript(src) {
    return new Promise(function (res, rej) {
      if (document.querySelector('script[src="' + src + '"]')) { res(); return; }
      var s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  function capture() {
    // de-sticky header so it doesn't double-render at top
    var hdr = document.querySelector('.app-header');
    var hdrPos = hdr ? hdr.style.position : '';
    if (hdr) hdr.style.position = 'relative';

    // expand any capped tables so full content appears
    var wraps = document.querySelectorAll('.tbl-wrap');
    var saved = [];
    wraps.forEach(function (el) {
      saved.push({ el: el, mh: el.style.maxHeight, ov: el.style.overflow });
      el.style.maxHeight = 'none';
      el.style.overflow = 'visible';
    });

    window.scrollTo(0, 0);

    return window.html2canvas(document.body, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#f4f7f5',
      logging: false,
      ignoreElements: function (el) {
        return el.classList && (el.classList.contains('modal-overlay') || el.classList.contains('toast-stack'));
      }
    }).then(function (canvas) {
      if (hdr) hdr.style.position = hdrPos;
      saved.forEach(function (s) { s.el.style.maxHeight = s.mh; s.el.style.overflow = s.ov; });
      return canvas;
    });
  }

  function today() {
    return new Date().toLocaleDateString('th-TH', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
  }

  function jpg(prefix) {
    return loadScript(H2C_URL).then(capture).then(function (c) {
      var a = document.createElement('a');
      a.download = prefix + '_' + today() + '.jpg';
      a.href = c.toDataURL('image/jpeg', 0.92);
      a.click();
    });
  }

  function pdf(prefix) {
    return loadScript(H2C_URL).then(function () {
      return Promise.all([capture(), loadScript(PDF_URL)]);
    }).then(function (results) {
      var c = results[0];
      var doc = new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      var pw = doc.internal.pageSize.getWidth();   // 297 mm
      var ph = doc.internal.pageSize.getHeight();  // 210 mm
      // scale image to fit page width; determine how many px = 1 page height
      var pageHeightPx = Math.floor(c.width * ph / pw);
      var totalPages = Math.ceil(c.height / pageHeightPx);

      for (var i = 0; i < totalPages; i++) {
        if (i > 0) doc.addPage();
        var sliceH = Math.min(pageHeightPx, c.height - i * pageHeightPx);
        var slice = document.createElement('canvas');
        slice.width = c.width; slice.height = sliceH;
        slice.getContext('2d').drawImage(c, 0, i * pageHeightPx, c.width, sliceH, 0, 0, c.width, sliceH);
        var sliceMmH = sliceH * pw / c.width;
        doc.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pw, sliceMmH);
      }
      doc.save(prefix + '_' + today() + '.pdf');
    });
  }

  return { jpg: jpg, pdf: pdf };
})();
