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

  /* ---- plugin วาดค่าตัวเลขไว้บนยอดแท่ง (อ่านได้ทันทีไม่ต้อง hover) ---- */
  var barValueLabel = {
    id: 'barValueLabel',
    afterDatasetsDraw: function (chart) {
      var ctx = chart.ctx;
      chart.data.datasets.forEach(function (ds, di) {
        var meta = chart.getDatasetMeta(di);
        meta.data.forEach(function (elm, i) {
          var v = ds.data[i];
          if (!v) return;
          ctx.save();
          ctx.fillStyle = '#374151';
          ctx.font = '600 11px Sarabun';
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

  /* ---------------- Modal ---------------- */
  function openModal(id) {
    var ov = U.el(id);
    ov.classList.add('open');
    var f = ov.querySelector('input, button, select, textarea, [tabindex]');
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
    openModal: openModal,
    closeModal: closeModal,
    installModalKeytrap: installModalKeytrap,
    esc: esc,
    emptyRow: emptyRow,
    debounce: debounce
  };
})(window);
