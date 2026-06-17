/* ============================================================
   utils.js — ฟังก์ชันช่วยเหลือกลาง (Shared helpers)
   จัดรูปแบบตัวเลข / เดือน พ.ศ. / สี / DOM
   ============================================================ */
(function (global) {
  'use strict';

  // ---- เดือนไทย ----
  var TH_MONTH_FULL = ['', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  var TH_MONTH_ABBR = ['', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

  /** แปลงค่าใด ๆ เป็นตัวเลข — ลบ comma/ช่องว่าง/สัญลักษณ์เงินออก ("1,234 บาท" -> 1234) */
  function parseNumber(v) {
    if (v == null) return 0;
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    var s = String(v).replace(/[\s,฿]/g, '').replace(/บาท/g, '').trim();
    if (s === '' || s === '-') return 0;
    var n = parseFloat(s);
    return isFinite(n) ? n : 0;
  }

  /** จัดรูปแบบตัวเลขมีคอมมา ไม่มีทศนิยม (1234567 -> "1,234,567") */
  function fmt(n) {
    n = Math.round(parseNumber(n));
    return n.toLocaleString('en-US');
  }

  /** จัดรูปแบบเงินบาท ("1,234,567 ฿") */
  function fmtBaht(n) { return fmt(n) + ' ฿'; }

  /** ย่อจำนวนเงินเป็น K/M ("1,280,000" -> "1.28M") สำหรับ KPI */
  function fmtShort(n) {
    n = parseNumber(n);
    var abs = Math.abs(n);
    if (abs >= 1e6) return (n / 1e6).toFixed(2).replace(/\.00$/, '') + 'M';
    if (abs >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
    return fmt(n);
  }

  /** เปอร์เซ็นต์ (part/total) */
  function pct(part, total) {
    total = parseNumber(total);
    if (!total) return 0;
    return Math.round((parseNumber(part) / total) * 1000) / 10;
  }

  /** แยกปี พ.ศ. จากรหัสเดือน "2569-01" -> "2569" */
  function yearOf(month) {
    return String(month || '').split('-')[0] || '';
  }

  /** เลขเดือนจากรหัส "2569-01" -> 1 */
  function monthNumOf(month) {
    var parts = String(month || '').split('-');
    return parts.length > 1 ? parseInt(parts[1], 10) : 0;
  }

  /** ป้ายเดือนแบบย่อ "2569-01" -> "ม.ค. 69" */
  function monthLabel(month) {
    var m = monthNumOf(month), y = yearOf(month);
    if (!m) return month || '';
    return TH_MONTH_ABBR[m] + ' ' + String(y).slice(-2);
  }

  /** ป้ายเดือนแบบเต็ม "2569-01" -> "มกราคม 2569" */
  function monthLabelFull(month) {
    var m = monthNumOf(month), y = yearOf(month);
    if (!m) return month || '';
    return TH_MONTH_FULL[m] + ' ' + y;
  }

  /** เรียงรหัสเดือนจากมาก/น้อย (ใช้ sort) */
  function cmpMonth(a, b) { return String(a).localeCompare(String(b)); }

  /** ค่าไม่ซ้ำเรียงแล้ว */
  function uniqSorted(arr) {
    return Array.from(new Set(arr.filter(function (x) { return x != null && x !== ''; }))).sort();
  }

  /** ผลรวมของ field ใน array ของ object */
  function sumBy(arr, field) {
    return arr.reduce(function (s, r) { return s + parseNumber(r[field]); }, 0);
  }

  /** จัดกลุ่มผลรวมตาม key -> { key: total } */
  function groupSum(arr, keyField, valField) {
    var out = {};
    arr.forEach(function (r) {
      var k = r[keyField] == null ? '' : r[keyField];
      out[k] = (out[k] || 0) + parseNumber(r[valField]);
    });
    return out;
  }

  /** แปลง map {k:v} เป็น array [{key,value}] เรียงค่ามาก->น้อย */
  function toSortedPairs(map) {
    return Object.keys(map).map(function (k) { return { key: k, value: map[k] }; })
      .sort(function (a, b) { return b.value - a.value; });
  }

  // ---- สีชาร์ต ----
  var PALETTE_GREEN = ['#1B5E20', '#2E7D32', '#43A047', '#66BB6A', '#81C784', '#A5D6A7', '#C8E6C9'];
  var PALETTE_BLUE = ['#0D47A1', '#1565C0', '#1976D2', '#42A5F5', '#64B5F6', '#90CAF9', '#BBDEFB'];
  var PALETTE_MIX = ['#2E7D32', '#1565C0', '#F9A825', '#00897B', '#6A1B9A', '#EF6C00', '#43A047',
    '#42A5F5', '#C62828', '#26A69A', '#8D6E63', '#5C6BC0'];

  function palette(name, n) {
    var base = name === 'blue' ? PALETTE_BLUE : name === 'mix' ? PALETTE_MIX : PALETTE_GREEN;
    var out = [];
    for (var i = 0; i < n; i++) out.push(base[i % base.length]);
    return out;
  }

  // ---- DOM helpers ----
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function el(id) { return document.getElementById(id); }

  /** สร้าง <option> เติมลง select */
  function fillSelect(select, values, opts) {
    opts = opts || {};
    select.innerHTML = '';
    if (opts.allLabel) {
      var o = document.createElement('option');
      o.value = '';
      o.textContent = opts.allLabel;
      select.appendChild(o);
    }
    values.forEach(function (v) {
      var o = document.createElement('option');
      o.value = (typeof v === 'object') ? v.value : v;
      o.textContent = (typeof v === 'object') ? v.label : (opts.label ? opts.label(v) : v);
      select.appendChild(o);
    });
  }

  var _toastTimer = null;
  /** แสดง toast ข้อความ */
  function toast(msg, type) {
    var t = el('toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'toast';
      t.className = 'toast';
      t.setAttribute('role', 'status');
      t.setAttribute('aria-live', 'polite');
      document.body.appendChild(t);
    }
    t.className = 'toast' + (type ? ' ' + type : '');
    t.textContent = msg;
    // force reflow then show
    void t.offsetWidth;
    t.classList.add('show');
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(function () { t.classList.remove('show'); }, 3200);
  }

  global.U = {
    TH_MONTH_FULL: TH_MONTH_FULL, TH_MONTH_ABBR: TH_MONTH_ABBR,
    parseNumber: parseNumber, fmt: fmt, fmtBaht: fmtBaht, fmtShort: fmtShort, pct: pct,
    yearOf: yearOf, monthNumOf: monthNumOf, monthLabel: monthLabel, monthLabelFull: monthLabelFull,
    cmpMonth: cmpMonth, uniqSorted: uniqSorted, sumBy: sumBy, groupSum: groupSum, toSortedPairs: toSortedPairs,
    palette: palette, PALETTE_GREEN: PALETTE_GREEN, PALETTE_BLUE: PALETTE_BLUE, PALETTE_MIX: PALETTE_MIX,
    $: $, $$: $$, el: el, fillSelect: fillSelect, toast: toast
  };
})(window);
