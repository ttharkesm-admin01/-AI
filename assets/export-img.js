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

  /* ไอคอน inline SVG (Lucide-style) สำหรับ KPI ใน report — ใช้ inline <svg> ไม่ใช่ CSS mask
     เพราะ html2canvas เรนเดอร์ mask-image ไม่ได้ แต่ rasterize inline <svg> ได้ */
  var ICONS = {
    coins: '<circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/>',
    wallet: '<path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>',
    package: '<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
    layers: '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
    medical: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.49 4.04 3 5.5l7 7Z"/><path d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27"/>',
    car: '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C1.4 11.3 1 12.1 1 13v3c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'
  };
  function iconSvg(key) {
    var p = ICONS[key];
    if (!p) return '';
    return '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="' + MUTED +
      '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:3px">' + p + '</svg>';
  }

  function today() {
    return new Date().toLocaleDateString('th-TH', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
  }

  /* ── sub-components ──────────────────────────────────────── */
  function kpiBox(k) {
    var fontSize = k.value.length > 9 ? '18px' : k.value.length > 6 ? '21px' : '24px';
    return mk('div',
      'background:#fff;border:1.5px solid ' + LINE + ';border-radius:12px;padding:12px 16px',
      '<div style="font-size:11px;color:' + MUTED + ';margin-bottom:4px">' + iconSvg(k.iconKey) + esc(k.label) + '</div>' +
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
      img.style.cssText = 'width:100%;height:210px;object-fit:contain;display:block;background:#fff;border:1px solid #eef0f2;border-radius:6px';
      wrap.appendChild(img);
    } else {
      wrap.appendChild(mk('div',
        'height:210px;background:#f3f4f6;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:11px;color:' + MUTED,
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

    // Row 1: charts — สองช่องเท่ากัน (สมมาตร) ใช้ object-fit:contain คงสัดส่วนกราฟ
    var chartRow = mk('div', 'display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:10px 10px 6px');
    chartRow.appendChild(chartCell(p.sectionA.title, p.sectionA.chartImg));
    chartRow.appendChild(chartCell(p.sectionB.title, p.sectionB.chartImg));
    panel.appendChild(chartRow);

    // Row 2: table — full panel width
    var tableRow = mk('div', 'padding:0 10px 10px');
    tableRow.appendChild(tableCell(p.sectionC.title, p.sectionC.heads, p.sectionC.rows, p.color));
    panel.appendChild(tableRow);

    return panel;
  }

  function buildOTSection(ot) {
    var COLOR = '#6A1B9A';
    var wrap = mk('div', 'border:1.5px solid #e1bee7;border-radius:12px;overflow:hidden;margin-top:14px');
    wrap.appendChild(mk('div',
      'background:' + COLOR + ';color:#fff;padding:8px 14px;font-size:13px;font-weight:700',
      ot.title + '  <span style="font-size:11px;font-weight:400;opacity:.85">รวม ' + esc(ot.totalHours) + '</span>'
    ));
    if (!ot.rows || !ot.rows.length) {
      wrap.appendChild(mk('div', 'padding:12px;font-size:11px;color:' + MUTED, 'ไม่มีข้อมูล OT'));
      return wrap;
    }

    // Body: chart (if available) left + Top 3 table right
    var body = mk('div', 'display:grid;grid-template-columns:' + (ot.chartImg ? '1.8fr 1fr' : '1fr') + ';gap:10px;padding:10px;align-items:start');

    if (ot.chartImg) {
      var chartWrap = mk('div', 'min-width:0');
      chartWrap.appendChild(mk('div', 'font-size:10px;font-weight:700;color:#374151;margin-bottom:5px', 'OT รายเดือน (ชม.)'));
      var ci = document.createElement('img');
      ci.src = ot.chartImg;
      ci.style.cssText = 'width:100%;height:180px;object-fit:contain;display:block;background:#fff;border:1px solid #eef0f2;border-radius:6px';
      chartWrap.appendChild(ci);
      body.appendChild(chartWrap);
    }

    // Top 3 table
    var heads = ['#', 'ชื่อพนักงาน']
      .concat(ot.months.map(function (m) { return m.label; }))
      .concat(['รวม (ชม.)']);
    var tbl = '<table style="width:100%;border-collapse:collapse;font-size:10px">';
    tbl += '<thead><tr style="background:' + COLOR + '">' +
      heads.map(function (h, i) {
        return '<th style="padding:4px 6px;color:#fff;font-weight:600;text-align:' +
          (i === 0 ? 'center' : i === 1 ? 'left' : 'right') + ';white-space:nowrap">' + esc(h) + '</th>';
      }).join('') + '</tr></thead><tbody>';
    ot.rows.forEach(function (row, ri) {
      tbl += '<tr style="background:' + (ri % 2 === 0 ? '#f3e5f5' : '#fff') + '">' +
        '<td style="padding:4px 6px;text-align:center;font-weight:700;color:' + COLOR + '">' + (ri + 1) + '</td>' +
        '<td style="padding:4px 6px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100px">' + esc(row.name) + '</td>' +
        ot.months.map(function (m) {
          var v = row.byMonth[m.code] || '';
          return '<td style="padding:4px 6px;text-align:right;color:' + (v ? INK : MUTED) + '">' + esc(v || '–') + '</td>';
        }).join('') +
        '<td style="padding:4px 6px;text-align:right;font-weight:700;color:' + COLOR + '">' + esc(row.total) + '</td>' +
        '</tr>';
    });
    tbl += '</tbody></table>';
    var tableWrap = mk('div', 'min-width:0');
    tableWrap.appendChild(mk('div', 'font-size:10px;font-weight:700;color:#374151;margin-bottom:5px', 'Top 3 OT (พนักงาน)'));
    tableWrap.insertAdjacentHTML('beforeend', tbl);
    body.appendChild(tableWrap);

    wrap.appendChild(body);
    return wrap;
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

    // ─ OT section (optional)
    if (cfg.otSection) {
      root.appendChild(buildOTSection(cfg.otSection));
    }

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

  /* เติมขอบขาวให้ canvas เป็นสัดส่วน A4 แนวนอน (297:210) พอดี — รูปต้นฉบับวางกึ่งกลาง
     คงขนาด/สัดส่วนกราฟ-ตัวอักษรเดิมเป๊ะ (ไม่ยืด) แค่เพิ่มขอบข้าง → output เป็น A4 แนวนอนจริง
     เลี่ยงอาการตัวอักษรยืดตอนนำรูป/PDF ที่เกือบจัตุรัสไปพิมพ์บนหน้าแนวนอน */
  var A4_RATIO = 297 / 210;
  function padToLandscapeA4(src) {
    var w = src.width, h = src.height, W, H;
    if (w / h >= A4_RATIO) { W = w; H = Math.round(w / A4_RATIO); }
    else { H = h; W = Math.round(h * A4_RATIO); }
    var cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    var ctx = cv.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
    ctx.drawImage(src, Math.round((W - w) / 2), Math.round((H - h) / 2));
    return cv;
  }

  /* ── public API ──────────────────────────────────────────── */
  function jpg(prefix, cfg) {
    return loadScript(H2C_URL)
      .then(function () { return captureDOM(buildReportDOM(cfg)); })
      .then(function (c) {
        var a = document.createElement('a');
        a.download = prefix + '_' + today() + '.jpg';
        a.href = padToLandscapeA4(c).toDataURL('image/jpeg', 0.92);
        a.click();
      });
  }

  function pdf(prefix, cfg) {
    return loadScript(H2C_URL)
      .then(function () {
        return Promise.all([captureDOM(buildReportDOM(cfg)), loadScript(PDF_URL)]);
      })
      .then(function (results) {
        var c = padToLandscapeA4(results[0]);   // canvas = สัดส่วน A4 แนวนอนพอดี → ใส่เต็มหน้าเดียวไม่ยืด
        var doc = new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        var pw = doc.internal.pageSize.getWidth();   // 297 mm
        var ph = doc.internal.pageSize.getHeight();  // 210 mm
        doc.addImage(c.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pw, ph);
        doc.save(prefix + '_' + today() + '.pdf');
      });
  }

  return { jpg: jpg, pdf: pdf };
})();
