/* export-img.js — ส่งออก Dashboard เป็น JPG / PDF แบบ clean report
   ซ่อน nav/filter/status chrome ก่อน capture และใส่ print-header แทน */
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

  function buildPrintHeader() {
    var h1 = document.querySelector('.app-header h1');
    var sub = document.querySelector('.app-header .sub');
    var srcInfo = document.querySelector('#src-info');
    var updInfo = document.querySelector('#src-updated');
    var title = h1 ? h1.textContent.trim() : '';
    var subtitle = sub ? sub.textContent.trim() : '';
    var note = [(srcInfo ? srcInfo.textContent.replace(/^•\s*/, '') : ''), (updInfo ? updInfo.textContent : '')].filter(Boolean).join(' • ');

    var hdr = document.createElement('div');
    hdr.id = '__print-hdr__';
    hdr.style.cssText = [
      'background:linear-gradient(135deg,#1B5E20,#2E7D32 55%,#43A047)',
      'color:#fff', 'padding:20px 24px 16px', 'border-radius:12px',
      'margin-bottom:18px', 'display:flex', 'align-items:center', 'gap:16px'
    ].join(';');

    var logo = document.createElement('div');
    logo.style.cssText = 'width:52px;height:52px;border-radius:14px;background:rgba(255,255,255,.18);display:grid;place-items:center;font-weight:800;font-size:20px;border:1px solid rgba(255,255,255,.28);flex:none';
    logo.textContent = 'CPF';

    var info = document.createElement('div');
    info.innerHTML =
      '<div style="font-size:1.25rem;font-weight:800;line-height:1.2">' + title + '</div>' +
      '<div style="font-size:.85rem;opacity:.9;margin-top:3px">' + subtitle + '</div>' +
      (note ? '<div style="font-size:.78rem;opacity:.75;margin-top:4px">' + note + '</div>' : '');

    hdr.appendChild(logo);
    hdr.appendChild(info);
    return hdr;
  }

  function capture() {
    var wrap = document.querySelector('.wrap');
    if (!wrap) return Promise.reject(new Error('ไม่พบ .wrap element'));

    // ซ่อน navigation chrome
    var HIDE_SELS = ['.app-header', '.source-bar', '.filter-bar', '.app-foot'];
    var hidden = [];
    HIDE_SELS.forEach(function (sel) {
      var el = document.querySelector(sel);
      if (el) { hidden.push({ el: el, v: el.style.visibility, d: el.style.display }); el.style.display = 'none'; }
    });

    // ใส่ print-header แทน
    var printHdr = buildPrintHeader();
    wrap.insertBefore(printHdr, wrap.firstChild);

    // ขยาย table ที่มี scroll ให้แสดงครบ
    var tblWraps = wrap.querySelectorAll('.tbl-wrap');
    var savedTbl = [];
    tblWraps.forEach(function (el) {
      savedTbl.push({ el: el, mh: el.style.maxHeight, ov: el.style.overflow });
      el.style.maxHeight = 'none';
      el.style.overflow = 'visible';
    });

    window.scrollTo(0, 0);

    return window.html2canvas(wrap, {
      scale: 2, useCORS: true, backgroundColor: '#f4f7f5', logging: false,
      ignoreElements: function (el) { return el.classList && el.classList.contains('modal-overlay'); }
    }).then(function (canvas) {
      // คืนค่าเดิม
      wrap.removeChild(printHdr);
      hidden.forEach(function (s) { s.el.style.display = s.d; s.el.style.visibility = s.v; });
      savedTbl.forEach(function (s) { s.el.style.maxHeight = s.mh; s.el.style.overflow = s.ov; });
      return canvas;
    }).catch(function (err) {
      // คืนค่าแม้ error
      if (document.getElementById('__print-hdr__')) wrap.removeChild(printHdr);
      hidden.forEach(function (s) { s.el.style.display = s.d; });
      savedTbl.forEach(function (s) { s.el.style.maxHeight = s.mh; s.el.style.overflow = s.ov; });
      throw err;
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
      // ความสูงในหน่วย canvas px ที่พอดีหน้า A4 หนึ่งหน้า
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
