/* ============================================================
   app.js — โค้ดร่วมของหน้า Dashboard (Shared UI layer)
   ดึงส่วนที่ oe/ และ welfare/ เคยซ้ำกัน ~80% มาไว้ที่เดียว:
   - Chart.js: ค่า default + plugin ตัวเลขบนยอดแท่ง + drawBar/drawDoughnut
   - Modal: เปิด/ปิด + Esc + focus trap
   - helper: esc (กัน XSS), emptyRow, debounce
   หมายเหตุ: drawBar/drawDoughnut รับ `charts` (registry ของแต่ละหน้า)
   เพื่อ destroy ตัวเก่าก่อนวาดใหม่ — พฤติกรรมเหมือนเดิมทุกประการ
   ============================================================ */
(function (global) {
  'use strict';
  var U = global.U;

  /* ---- plugin วาดค่าตัวเลขไว้บนยอดแท่ง (อ่านได้ทันทีไม่ต้อง hover)
         ฟอนต์ override ได้ผ่าน options.plugins.barValueLabel.font (ใช้ตอน export) ---- */
  var barValueLabel = {
    id: 'barValueLabel',
    afterDatasetsDraw: function (chart) {
      var ctx = chart.ctx;
      var opt = (chart.options.plugins && chart.options.plugins.barValueLabel) || {};
      chart.data.datasets.forEach(function (ds, di) {
        var meta = chart.getDatasetMeta(di);
        meta.data.forEach(function (elm, i) {
          var v = ds.data[i];
          if (!v) return;
          ctx.save();
          ctx.fillStyle = '#374151';
          ctx.font = opt.font || '600 11px Sarabun';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(U.fmtShort(v), elm.x, elm.y - 4);
          ctx.restore();
        });
      });
    }
  };

  function applyChartDefaults() {
    if (!global.Chart) return;
    Chart.defaults.font.family = 'Sarabun';
    Chart.defaults.color = '#4b5563';
    Chart.defaults.plugins.legend.labels.boxWidth = 12;
  }

  function drawDoughnut(charts, id, labels, data, colors) {
    if (!global.Chart) return;
    var ctx = U.el(id); if (!ctx) return;
    if (charts[id]) charts[id].destroy();
    charts[id] = new Chart(ctx, {
      type: 'doughnut',
      data: { labels: labels, datasets: [{ data: data, backgroundColor: colors, borderWidth: 2, borderColor: '#fff' }] },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '58%',
        plugins: {
          legend: { position: 'bottom' },
          tooltip: { callbacks: { label: function (c) { var t = c.dataset.data.reduce(function (a, b) { return a + (+b || 0); }, 0); return c.label + ': ' + U.fmt(c.parsed) + ' ฿ (' + U.pct(c.parsed, t) + '%)'; } } }
        }
      }
    });
  }

  function drawBar(charts, id, labels, data, color, label, unit) {
    if (!global.Chart) return;
    unit = unit || '฿';
    var ctx = U.el(id); if (!ctx) return;
    if (charts[id]) charts[id].destroy();
    charts[id] = new Chart(ctx, {
      type: 'bar',
      plugins: [barValueLabel],
      data: { labels: labels, datasets: [{ label: label, data: data, backgroundColor: color, borderRadius: 6, maxBarThickness: 46 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        layout: { padding: { top: 18 } },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: function (c) { return U.fmt(c.parsed.y) + ' ' + unit; } } }
        },
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true, ticks: { callback: function (v) { return U.fmtShort(v); } } }
        }
      }
    });
  }

  /** สำหรับ export infographic: re-render โดนัทลง canvas จัตุรัส
      เพื่อให้รูปที่ได้เต็มช่อง ไม่มีขอบว่างซ้าย-ขวาที่ Chart.js เว้นไว้ตอนวาดใน canvas แนวกว้าง
      colors (ถ้ามี): override สีชิ้นโดนัทเฉพาะในรูป export — array สี หรือชื่อ palette ('green') */
  function chartSquareImage(chart, size, colors) {
    if (!global.Chart || !chart) return null;
    size = size || 460;
    var cv = document.createElement('canvas');
    cv.width = size; cv.height = size;
    var src = chart.config;
    var data = JSON.parse(JSON.stringify(src.data));
    if (colors) data.datasets.forEach(function (ds) {
      ds.backgroundColor = (typeof colors === 'string') ? U.palette(colors, ds.data.length) : colors;
    });
    var tmp = new Chart(cv, {
      type: src.type,
      data: data,
      options: {
        responsive: false, maintainAspectRatio: false, animation: false,
        cutout: (src.options && src.options.cutout) || '58%',
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 16, padding: 12, font: { size: 16 } } },
          tooltip: { enabled: false }
        }
      }
    });
    var url = tmp.toBase64Image('image/png', 1);
    tmp.destroy();
    return url;
  }

  /** สำหรับ export infographic: re-render กราฟแท่งลง canvas ออฟสกรีน
      พร้อม override สีให้เข้าธีมรายงาน (ไม่กระทบกราฟบนจอ)
      ค่า default 530×420 = สัดส่วนเดียวกับช่องกราฟใน report (265×210) → ภาพเต็มช่อง ไม่โดนย่อทิ้ง
      ฟอนต์ตัวเลขขยายตามสเกล export ให้อ่านชัดในไฟล์ PNG */
  function chartBarImage(chart, color, w, h) {
    if (!global.Chart || !chart) return null;
    var cv = document.createElement('canvas');
    cv.width = w || 530; cv.height = h || 420;
    var data = JSON.parse(JSON.stringify(chart.config.data));
    if (color) data.datasets.forEach(function (ds) { ds.backgroundColor = color; });
    var tmp = new Chart(cv, {
      type: 'bar',
      plugins: [barValueLabel],
      data: data,
      options: {
        responsive: false, maintainAspectRatio: false, animation: false,
        layout: { padding: { top: 26 } },
        plugins: {
          legend: { display: false }, tooltip: { enabled: false },
          barValueLabel: { font: '600 17px Sarabun' }
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 14 } } },
          y: { beginAtZero: true, ticks: { font: { size: 13 }, callback: function (v) { return U.fmtShort(v); } } }
        }
      }
    });
    var url = tmp.toBase64Image('image/png', 1);
    tmp.destroy();
    return url;
  }

  /* ---------------- Modal ---------------- */
  function openModal(id) {
    var ov = U.el(id);
    ov.classList.add('open');
    // โฟกัสช่องกรอก/ปุ่มใน body ก่อน — ไม่ให้ตกที่ปุ่มปิด × ใน header
    var f = ov.querySelector('.modal-body input, .modal-body select, .modal-body textarea, .modal-body button') ||
      ov.querySelector('input, button, select, textarea, [tabindex]');
    if (f) f.focus();
  }
  function closeModal(id) { U.el(id).classList.remove('open'); }

  /** ติดตั้ง: ปิด modal ที่เปิดอยู่ด้วยปุ่ม Esc + กักโฟกัสไว้ใน modal (focus trap) ด้วย Tab */
  function installModalKeytrap() {
    document.addEventListener('keydown', function (e) {
      var ov = document.querySelector('.modal-overlay.open');
      if (!ov) return;
      if (e.key === 'Escape') { closeModal(ov.id); return; }
      if (e.key !== 'Tab') return;
      var f = U.$$('input, button, select, textarea, [tabindex]', ov).filter(function (n) { return !n.disabled && n.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }

  /* ---------------- helper ---------------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  function emptyRow(cols) { return '<tr><td colspan="' + cols + '" class="empty">ไม่มีข้อมูลตามตัวกรอง</td></tr>'; }

  /** หน่วงการเรียกซ้ำ ๆ (เช่น เปลี่ยนฟิลเตอร์รัว ๆ) ให้วาดครั้งเดียว */
  function debounce(fn, ms) {
    var t = null;
    return function () {
      var ctx = this, args = arguments;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, ms);
    };
  }

  global.App = {
    barValueLabel: barValueLabel,
    applyChartDefaults: applyChartDefaults,
    drawDoughnut: drawDoughnut,
    drawBar: drawBar,
    chartSquareImage: chartSquareImage,
    chartBarImage: chartBarImage,
    openModal: openModal,
    closeModal: closeModal,
    installModalKeytrap: installModalKeytrap,
    esc: esc,
    emptyRow: emptyRow,
    debounce: debounce
  };

  /* ---- shared dashboard setup factory ---- */
  App.dashboardSetup = function (kind, cfg) {
    /* cfg: { getRaw(), onRaw(records), buildFilters(), render(), debouncedRender() } */
    var lastSource = 'sample', lastUpdated = null;

    function setStatus(cls, text) {
      U.el('status').className = 'status ' + cls;
      U.el('status-text').textContent = text;
    }

    function updateStatus(res) {
      var s = U.el('status'), txt = U.el('status-text');
      s.className = 'status ' + (lastSource === 'sheets' || lastSource === 'excel' ? 'ok' : res.fellBack ? 'err' : 'demo');
      if (lastSource === 'sheets') txt.textContent = 'เชื่อม Google Sheets';
      else if (lastSource === 'sheets-cache') { s.className = 'status err'; txt.textContent = 'Google Sheets (แคชออฟไลน์)'; }
      else if (lastSource === 'excel') txt.textContent = 'ไฟล์ Excel';
      else if (lastSource === 'local') { s.className = 'status ok'; txt.textContent = 'แก้ไขในเครื่อง (เบราว์เซอร์นี้)'; }
      else if (res.fellBack) { s.className = 'status err'; txt.textContent = 'ต่อชีตไม่ได้ — แสดงข้อมูลตัวอย่าง'; }
      else txt.textContent = 'ข้อมูลตัวอย่าง (Demo)';
      U.el('src-info').textContent = '• ' + (res.count || cfg.getRaw().length) + ' รายการ' + (res.fileName ? ' • ' + res.fileName : '');
      U.el('src-updated').textContent = res.cachedAt
        ? 'แคชเมื่อ: ' + new Date(res.cachedAt).toLocaleString('th-TH', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
        : 'อัปเดต: ' + lastUpdated.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    }

    function onLoaded(res) {
      cfg.onRaw(res.records || []);
      lastSource = res.source || 'sample';
      lastUpdated = new Date();
      if (res.error) {
        if (res.source === 'sheets-cache') U.toast('เน็ตหลุด — แสดงข้อมูลแคชล่าสุด (เปิดดูออฟไลน์ได้)', 'ok');
        else U.toast('ดึง Google Sheets ไม่สำเร็จ: ' + res.error, 'err');
      }
      updateStatus(res);
      cfg.buildFilters();
      cfg.render();
    }

    function loadData(forceSheets) {
      setStatus('loading', 'กำลังโหลดข้อมูล…');
      var p = forceSheets ? DataSource.fromSheetsCached(kind) : DataSource.loadAuto(kind);
      p.then(onLoaded).catch(function (err) {
        var s = DataSource.sample(kind); s.error = err.message; s.fellBack = true; onLoaded(s);
      });
    }

    function buildMonthFilter() {
      var y = U.el('f-year').value;
      var raw = cfg.getRaw();
      var ms = U.uniqSorted(raw.filter(function (r) { return !y || U.yearOf(r.month) === y; }).map(function (r) { return r.month; }));
      var cur = U.el('f-month').value;
      U.fillSelect(U.el('f-month'), ms, { allLabel: 'ทุกเดือน', label: U.monthLabelFull });
      if (ms.indexOf(cur) >= 0) U.el('f-month').value = cur;
    }

    function openConnect() {
      var c = DataSource.config.get(kind);
      U.el('in-sheet').value = c.sheetId ? DataSource.buildCsvUrl(c.sheetId, c.sheetName).split('/gviz')[0] : '';
      U.el('in-tab').value = c.sheetName || 'RAW_DATA';
      App.openModal('modal-connect');
    }

    function openManage(focusIndex, search) {
      DataEditor.open({
        kind: kind, records: cfg.getRaw(),
        focusIndex: (typeof focusIndex === 'number' ? focusIndex : -1),
        search: (typeof search === 'string' ? search : ''),
        onApply: function (records) {
          onLoaded({ records: records, source: 'local', count: records.length });
          U.toast('บันทึกข้อมูลแล้ว (เก็บในเบราว์เซอร์นี้)', 'ok');
        },
        onReset: function () {
          loadData(!!DataSource.config.get(kind).sheetId);
          U.toast('ล้างข้อมูลที่แก้ไข กลับไปใช้ข้อมูลต้นทาง', 'ok');
        }
      });
    }

    function periodLabel(filtered) {
      var ms = U.uniqSorted(filtered.map(function (r) { return r.month; }));
      if (!ms.length) return 'ปีงบประมาณ พ.ศ. 2569';
      if (ms.length === 1) return U.monthLabelFull(ms[0]);
      return 'ปีงบประมาณ พ.ศ. ' + U.yearOf(ms[0]) + ' (' + U.monthLabel(ms[0]) + ' – ' + U.monthLabel(ms[ms.length - 1]) + ')';
    }

    function bindCommonEvents() {
      U.el('f-year').addEventListener('change', function () { buildMonthFilter(); cfg.debouncedRender(); });
      U.el('btn-refresh').addEventListener('click', function () { loadData(!!DataSource.config.get(kind).sheetId); });
      U.el('btn-connect').addEventListener('click', openConnect);
      U.el('btn-manage').addEventListener('click', openManage);
      U.el('btn-save-src').addEventListener('click', function () {
        var id = DataSource.extractSheetId(U.el('in-sheet').value);
        var tab = U.el('in-tab').value.trim() || 'RAW_DATA';
        if (!id) { U.toast('กรุณาวางลิงก์หรือ Sheet ID', 'err'); return; }
        DataSource.config.set(kind, { sheetId: id, sheetName: tab });
        DataSource.local.clear(kind);
        App.closeModal('modal-connect'); loadData(true);
      });
      U.el('btn-clear-src').addEventListener('click', function () {
        DataSource.config.clear(kind); DataSource.local.clear(kind);
        App.closeModal('modal-connect'); loadData(false); U.toast('กลับไปใช้ข้อมูลตัวอย่าง', 'ok');
      });
      U.el('btn-upload').addEventListener('click', function () { U.el('file-input').click(); });
      U.el('file-input').addEventListener('change', function (e) {
        var f = e.target.files[0]; if (!f) return;
        setStatus('loading', 'กำลังอ่านไฟล์…');
        DataSource.fromExcel(kind, f).then(function (res) {
          DataSource.config.clear(kind); DataSource.local.clear(kind);
          App.closeModal('modal-connect'); onLoaded(res); U.toast('โหลดไฟล์ Excel สำเร็จ', 'ok');
        }).catch(function (err) { U.toast(err.message, 'err'); loadData(false); });
        e.target.value = '';
      });
      U.$$('[data-close]').forEach(function (b) { b.addEventListener('click', function () { App.closeModal(b.closest('.modal-overlay').id); }); });
      U.$$('.modal-overlay').forEach(function (o) { o.addEventListener('click', function (e) { if (e.target === o) App.closeModal(o.id); }); });
    }

    return {
      loadData: loadData,
      onLoaded: onLoaded,
      setStatus: setStatus,
      buildMonthFilter: buildMonthFilter,
      openConnect: openConnect,
      openManage: openManage,
      periodLabel: periodLabel,
      bindCommonEvents: bindCommonEvents,
      getLastSource: function () { return lastSource; }
    };
  };
})(window);
