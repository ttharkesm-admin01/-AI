/* export-img.js — สร้าง infographic report DOM แล้ว capture เป็น JPG/PDF
   ไม่ได้ screenshot DOM เดิม — สร้าง layout ใหม่ให้เหมือน report จริง */
var ExportImg = (function () {
  'use strict';
  var H2C_URL = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
  var PDF_URL = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';

  var FONT = "'Sarabun','Segoe UI',Tahoma,sans-serif";
  var G = '#2E7D32', GD = '#1B5E20';
  var INK = '#1f2937', MUTED = '#6b7280', LINE = '#e5e7eb';

  /* ── utils ───────────────────────────────────────────────── */
  function loadScript(src) {
    return new Promise(function (res, rej) {
      if (document.querySelector('script[src="' + src + '"]')) { res(); return; }
      var s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  function mk(tag, css, html) {
    var d = document.createElement(tag);
    if (css) d.style.cssText = css;
    if (html !== undefined) d.innerHTML = html;
    return d;
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function today() {
    return new Date().toLocaleDateString('th-TH', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
  }

  /* ── sub-components ──────────────────────────────────────── */
  function kpiBox(k) {
    var fontSize = k.value.length > 9 ? '18px' : k.value.length > 6 ? '21px' : '24px';
    return mk('div',
      'background:#fff;border:1.5px solid ' + LINE + ';border-radius:12px;padding:12px 16px',
      '<div style="font-size:11px;color:' + MUTED + ';margin-bottom:4px">' + k.icon + ' ' + k.label + '</div>' +
      '<div style="font-size:' + fontSize + ';font-weight:800;color:' + GD + ';letter-spacing:-.3px;line-height:1.1">' +
        k.value + ' <span style="font-size:12px;font-weight:500;color:' + INK + '">' + k.unit + '</span></div>' +
      (k.sub ? '<div style="font-size:10.5px;color:' + MUTED + ';margin-top:3px">' + k.sub + '</div>' : '')
    );
  }

  function chartCell(title, imgSrc) {
    var wrap = mk('div', 'min-width:0');
    wrap.appendChild(mk('div', 'font-size:10px;font-weight:700;color:#374151;margin-bottom:5px;line-height:1.3', title));
    if (imgSrc) {
      var img = document.createElement('img');
      img.src = imgSrc;
      img.style.cssText = 'width:100%;height:auto;max-height:145px;object-fit:contain;display:block';
      wrap.appendChild(img);
    } else {
      wrap.appendChild(mk('div',
        'height:100px;background:#f3f4f6;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:11px;color:' + MUTED,
        'ไม่มีข้อมูล'
      ));
    }
    return wrap;
  }

  function tableCell(title, heads, rows, color) {
    var wrap = mk('div', 'min-width:0');
    wrap.appendChild(mk('div', 'font-size:10px;font-weight:700;color:#374151;margin-bottom:5px;line-height:1.3', title));
    if (!rows || !rows.length) {
      wrap.appendChild(mk('div', 'font-size:10px;color:' + MUTED + ';padding:6px', 'ไม่มีข้อมูล'));
      return wrap;
    }
    var tbl = '<table style="width:100%;border-collapse:collapse;font-size:10px">';
    tbl += '<thead><tr style="background:' + color + '">' +
      heads.map(function (h, i) {
        return '<th style="padding:4px 6px;color:#fff;font-weight:600;text-align:' + (i > 0 ? 'right' : 'left') + ';white-space:nowrap">' + esc(h) + '</th>';
      }).join('') + '</tr></thead><tbody>';
    rows.forEach(function (row, ri) {
      tbl += '<tr style="background:' + (ri % 2 === 0 ? '#f9fafb' : '#fff') + '">' +
        row.map(function (cell, ci) {
          return '<td style="padding:4px 6px;border-bottom:1px solid #f3f4f6;text-align:' + (ci > 0 ? 'right' : 'left') + ';max-width:110px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">' + esc(cell) + '</td>';
        }).join('') + '</tr>';
    });
    tbl += '</tbody></table>';
    wrap.insertAdjacentHTML('beforeend', tbl);
    return wrap;
  }

  function buildPanel(p) {
    var panel = mk('div', 'border:1.5px solid ' + LINE + ';border-radius:12px;overflow:hidden');

    // header badge
    panel.appendChild(mk('div',
      'background:' + p.color + ';color:#fff;padding:8px 14px;font-size:14px;font-weight:700',
      p.title
    ));

    // mini KPI row
    var mkRow = mk('div', 'display:flex;border-bottom:1px solid ' + LINE + ';background:#fafafa');
    p.miniKpis.forEach(function (m, i) {
      mkRow.appendChild(mk('div',
        'padding:9px 12px;flex:1' + (i < p.miniKpis.length - 1 ? ';border-right:1px solid ' + LINE : ''),
        '<div style="font-size:10px;color:' + MUTED + ';margin-bottom:2px">' + esc(m.label) + '</div>' +
        '<div style="font-size:12.5px;font-weight:700;color:' + INK + '">' + esc(m.value) + '</div>'
      ));
    });
    panel.appendChild(mkRow);

    // 3-column: A (donut), B (bar), C (table)
    var grid = mk('div', 'display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;padding:10px;align-items:start');
    grid.appendChild(chartCell(p.sectionA.title, p.sectionA.chartImg));
    grid.appendChild(chartCell(p.sectionB.title, p.sectionB.chartImg));
    grid.appendChild(tableCell(p.sectionC.title, p.sectionC.heads, p.sectionC.rows, p.color));
    panel.appendChild(grid);

    return panel;
  }

  /* ── main template ───────────────────────────────────────── */
  function buildReportDOM(cfg) {
    var root = mk('div',
      'width:1200px;background:#fff;font-family:' + FONT + ';color:' + INK + ';padding:26px 30px;box-sizing:border-box;line-height:1.5'
    );

    // ─ Title
    var titleWrap = mk('div', 'margin-bottom:16px;padding-bottom:10px;border-bottom:3px solid ' + G);
    titleWrap.appendChild(mk('div', 'font-size:24px;font-weight:800;color:' + GD + ';line-height:1.2', cfg.title));
    titleWrap.appendChild(mk('div', 'font-size:12px;color:' + MUTED + ';margin-top:4px', cfg.subtitle));
    root.appendChild(titleWrap);

    // ─ KPI row
    var kpiRow = mk('div', 'display:grid;grid-template-columns:repeat(' + cfg.kpis.length + ',1fr);gap:10px;margin-bottom:14px');
    cfg.kpis.forEach(function (k) { kpiRow.appendChild(kpiBox(k)); });
    root.appendChild(kpiRow);

    // ─ Two panels
    var panels = mk('div', 'display:grid;grid-template-columns:1fr 1fr;gap:14px');
    [cfg.leftPanel, cfg.rightPanel].forEach(function (p) { panels.appendChild(buildPanel(p)); });
    root.appendChild(panels);

    // ─ Insights
    if (cfg.insights && cfg.insights.length) {
      var insWrap = mk('div', 'background:#fffde7;border:1.5px solid #f9a825;border-radius:10px;padding:10px 14px;margin-top:12px');
      insWrap.appendChild(mk('div', 'font-size:12px;font-weight:800;color:#e65100;margin-bottom:7px', '⭐ ประเด็นสำคัญ'));
      var cols = Math.min(cfg.insights.length, 4);
      var insGrid = mk('div', 'display:grid;grid-template-columns:repeat(' + cols + ',1fr);gap:10px');
      cfg.insights.forEach(function (ins) {
        insGrid.appendChild(mk('div', 'font-size:11px;color:' + INK + ';line-height:1.55',
          '<span style="background:#e65100;color:#fff;border-radius:4px;padding:1px 5px;font-size:10px;font-weight:700;margin-right:5px">' + esc(ins.num) + '</span>' + esc(ins.text)
        ));
      });
      insWrap.appendChild(insGrid);
      root.appendChild(insWrap);
    }

    // ─ Footnote
    if (cfg.footnote) {
      root.appendChild(mk('div',
        'margin-top:9px;font-size:10px;color:#9ca3af;border-top:1px solid ' + LINE + ';padding-top:7px',
        cfg.footnote
      ));
    }

    return root;
  }

  /* ── off-screen capture ──────────────────────────────────── */
  function captureDOM(domEl) {
    domEl.style.position = 'absolute';
    domEl.style.left = '-9999px';
    domEl.style.top = '0';
    document.body.appendChild(domEl);

    return new Promise(function (res, rej) {
      requestAnimationFrame(function () {
        window.html2canvas(domEl, {
          scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false
        }).then(function (c) {
          if (domEl.parentNode) document.body.removeChild(domEl);
          res(c);
        }).catch(function (e) {
          if (domEl.parentNode) document.body.removeChild(domEl);
          rej(e);
        });
      });
    });
  }

  /* ── public API ──────────────────────────────────────────── */
  function jpg(prefix, cfg) {
    return loadScript(H2C_URL)
      .then(function () { return captureDOM(buildReportDOM(cfg)); })
      .then(function (c) {
        var a = document.createElement('a');
        a.download = prefix + '_' + today() + '.jpg';
        a.href = c.toDataURL('image/jpeg', 0.92);
        a.click();
      });
  }

  function pdf(prefix, cfg) {
    return loadScript(H2C_URL)
      .then(function () {
        return Promise.all([captureDOM(buildReportDOM(cfg)), loadScript(PDF_URL)]);
      })
      .then(function (results) {
        var c = results[0];
        var doc = new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        var pw = doc.internal.pageSize.getWidth();   // 297 mm
        var ph = doc.internal.pageSize.getHeight();  // 210 mm
        var pageHeightPx = Math.floor(c.width * ph / pw);
        var totalPages = Math.ceil(c.height / pageHeightPx);
        for (var i = 0; i < totalPages; i++) {
          if (i > 0) doc.addPage();
          var sliceH = Math.min(pageHeightPx, c.height - i * pageHeightPx);
          var slice = document.createElement('canvas');
          slice.width = c.width; slice.height = sliceH;
          slice.getContext('2d').drawImage(c, 0, i * pageHeightPx, c.width, sliceH, 0, 0, c.width, sliceH);
          doc.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pw, sliceH * pw / c.width);
        }
        doc.save(prefix + '_' + today() + '.pdf');
      });
  }

  return { jpg: jpg, pdf: pdf };
})();
