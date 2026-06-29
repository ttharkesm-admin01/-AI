/* ============================================================
   editor.js — โมดอล "จัดการข้อมูล" (เพิ่ม/แก้ไข/ลบ) ใช้ร่วม oe/ + welfare/
   - ทำงานบนสำเนาชั่วคราว (working copy) จนกด "บันทึกทั้งหมด"
   - บันทึกลง localStorage ผ่าน DataSource.local (ข้อมูลในเครื่องนี้)
   - ปุ่ม "ล้างข้อมูลที่แก้ไข" -> กลับไปใช้ต้นทาง (Sheets/Excel/ตัวอย่าง)
   - ถ้ามี config Google Sheets จะแสดงลิงก์ไปแก้แบบเรียลไทม/หลายคน
   - สำรอง/นำเข้า (Excel/CSV) · ค้นหา · เรียงลำดับ · เลือกหลายแถว+ลบ
     · เลือกเดือนแบบ dropdown · ทำซ้ำรายการ · ยอดรวม · กันลืมบันทึก
   สร้าง DOM ของโมดอลครั้งเดียวแล้ว reuse (App.installModalKeytrap รองรับอยู่แล้ว)
   ============================================================ */
(function (global) {
  'use strict';
  var U = global.U, App = global.App, DS = global.DataSource;

  /* ฟิลด์ของฟอร์มแต่ละชนิด (อิงลำดับคอลัมน์ RAW_DATA ใน data.js) */
  var FIELDS = {
    oe: [
      { k: 'month', label: 'เดือน (พ.ศ.)', type: 'month', req: true },
      { k: 'category', label: 'หมวดหมู่', type: 'text', req: true },
      { k: 'type', label: 'ประเภท', type: 'select', opts: ['ค่าใช้จ่าย', 'เงินยืมทดรอง'], req: true },
      { k: 'group', label: 'กลุ่ม', type: 'select', opts: ['', 'คงที่', 'แปรผัน'] },
      { k: 'detail', label: 'รายละเอียด', type: 'text' },
      { k: 'amount', label: 'จำนวนเงิน (บาท)', type: 'number', req: true },
      { k: 'borrower', label: 'ผู้ยืม (ถ้าเป็นเงินยืม)', type: 'text' }
    ],
    welfare: [
      { k: 'month', label: 'เดือน (พ.ศ.)', type: 'month', req: true },
      { k: 'employee', label: 'ชื่อพนักงาน', type: 'text', req: true },
      { k: 'position', label: 'ตำแหน่ง', type: 'text' },
      { k: 'wtype', label: 'ประเภทสวัสดิการ', type: 'select', opts: ['ค่ารักษาพยาบาล', 'เบี้ยเลี้ยง', 'ค่าน้ำมัน', 'ค่าที่พัก', 'สวัสดิการอื่นๆ', 'OT'], req: true },
      { k: 'amount', label: 'จำนวนเงิน (บาท) / ชั่วโมง (ถ้าเป็น OT)', type: 'number', req: true },
      { k: 'note', label: 'หมายเหตุ', type: 'text' }
    ]
  };

  /* หัวคอลัมน์ RAW_DATA (เรียงตาม SCHEMA.cols) สำหรับ Export — แปะลง Google Sheets ได้ทันที */
  var HEADERS = {
    oe: ['เดือน', 'หมวดหมู่', 'ประเภท', 'กลุ่ม', 'รายละเอียด', 'จำนวนเงิน', 'ผู้ยืม'],
    welfare: ['เดือน', 'ชื่อพนักงาน', 'ตำแหน่ง', 'ประเภทสวัสดิการ', 'จำนวนเงิน', 'หมายเหตุ']
  };

  var TMONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  var UNSAVED_MSG = 'มีการแก้ไขที่ยังไม่ได้กด "บันทึกทั้งหมด" — ปิดโดยไม่บันทึก?';

  var state = {
    kind: null, work: [], editIdx: -1, onApply: null, onReset: null,
    search: '', sortKey: 'month', sortDir: 'asc', selected: {}, dirty: false
  };
  var built = false;

  function rowLabel(r) { return state.kind === 'oe' ? r.category : r.employee; }
  function rowTag(r) { return state.kind === 'oe' ? r.type : r.wtype; }
  function defaultMonth() {
    var ms = U.uniqSorted(state.work.map(function (r) { return r.month; }));
    return ms.length ? ms[ms.length - 1] : '2569-01';
  }

  /* ---------- สร้าง DOM โมดอลครั้งเดียว ---------- */
  function ensureModal() {
    if (built) return;
    var ov = document.createElement('div');
    ov.className = 'modal-overlay';
    ov.id = 'modal-editor';
    ov.innerHTML =
      '<div class="modal modal-wide">' +
        '<div class="modal-head"><h3><span class="ic gi-edit"></span> จัดการข้อมูล (เพิ่ม / แก้ไข / ลบ)</h3>' +
          '<button class="x-close" id="ed-close" aria-label="ปิด">&times;</button></div>' +
        '<div class="modal-body">' +
          '<div id="ed-sheet-link" class="help-block" style="margin-bottom:12px"></div>' +
          '<div class="ed-tools">' +
            '<span class="ed-tools-label"><span class="ic gi-package"></span> สำรอง / นำเข้า:</span>' +
            '<button class="btn btn-light btn-sm gi-download" id="ed-exp-xlsx">Excel</button>' +
            '<button class="btn btn-light btn-sm gi-download" id="ed-exp-csv">CSV</button>' +
            '<button class="btn btn-light btn-sm gi-import" id="ed-imp">นำเข้าไฟล์</button>' +
            '<input type="file" id="ed-imp-file" accept=".xlsx,.xls,.csv" style="display:none" />' +
          '</div>' +
          '<div class="ed-grid">' +
            '<div class="ed-formwrap">' +
              '<div class="cb-title" id="ed-form-title"><span class="ic gi-plus"></span> เพิ่มรายการใหม่</div>' +
              '<div id="ed-form" class="ed-fields"></div>' +
              '<div class="ed-form-actions">' +
                '<button class="btn btn-primary btn-sm" id="ed-save-row">เพิ่มรายการ</button>' +
                '<button class="btn btn-light btn-sm" id="ed-cancel-row">ล้างฟอร์ม</button>' +
              '</div>' +
            '</div>' +
            '<div class="ed-listwrap">' +
              '<div class="cb-title">รายการทั้งหมด (<span id="ed-count">0</span>)</div>' +
              '<div class="ed-listbar">' +
                '<input type="search" id="ed-search" placeholder="🔍 ค้นหา…" autocomplete="off" />' +
                '<select id="ed-sort">' +
                  '<option value="month-asc">เดือน เก่า→ใหม่</option>' +
                  '<option value="month-desc">เดือน ใหม่→เก่า</option>' +
                  '<option value="amount-desc">จำนวน มาก→น้อย</option>' +
                  '<option value="amount-asc">จำนวน น้อย→มาก</option>' +
                  '<option value="label-asc">ชื่อ/หมวด ก→ฮ</option>' +
                '</select>' +
              '</div>' +
              '<div class="ed-bulk">' +
                '<label><input type="checkbox" id="ed-selall" /> เลือกทั้งหมด</label>' +
                '<span id="ed-selinfo"></span>' +
                '<button class="btn btn-light btn-sm gi-trash" id="ed-delsel" disabled>ลบที่เลือก</button>' +
              '</div>' +
              '<div class="tbl-wrap" style="max-height:330px;overflow:auto">' +
                '<table class="data"><thead><tr><th class="ed-cbcol"></th><th>#</th><th>เดือน</th>' +
                  '<th id="ed-h-label">รายการ</th><th id="ed-h-tag">ประเภท</th>' +
                  '<th class="num">จำนวน</th><th>จัดการ</th></tr></thead>' +
                  '<tbody id="ed-list"></tbody></table>' +
              '</div>' +
              '<div class="ed-summary" id="ed-summary"></div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="modal-foot">' +
          '<button class="btn btn-light gi-undo" id="ed-clear-local">ล้างข้อมูลที่แก้ไข (ใช้ข้อมูลต้นทาง)</button>' +
          '<button class="btn btn-primary gi-save" id="ed-save-all">บันทึกทั้งหมด</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(ov);

    U.el('ed-close').addEventListener('click', function () { close(false); });
    ov.addEventListener('click', function (e) { if (e.target === ov) close(false); });
    U.el('ed-save-row').addEventListener('click', saveRow);
    U.el('ed-cancel-row').addEventListener('click', function () { state.editIdx = -1; renderForm(); });
    U.el('ed-save-all').addEventListener('click', saveAll);
    U.el('ed-clear-local').addEventListener('click', clearLocal);
    U.el('ed-exp-xlsx').addEventListener('click', exportExcel);
    U.el('ed-exp-csv').addEventListener('click', exportCSV);
    U.el('ed-imp').addEventListener('click', function () { U.el('ed-imp-file').click(); });
    U.el('ed-imp-file').addEventListener('change', function (e) {
      var f = e.target.files[0]; e.target.value = '';
      if (f) importFile(f);
    });
    U.el('ed-search').addEventListener('input', function (e) { state.search = e.target.value; renderList(); });
    U.el('ed-sort').addEventListener('change', function (e) {
      var p = e.target.value.split('-'); state.sortKey = p[0]; state.sortDir = p[1]; renderList();
    });
    U.el('ed-selall').addEventListener('change', function (e) { toggleSelectAll(e.target.checked); });
    U.el('ed-delsel').addEventListener('click', deleteSelected);

    U.el('ed-list').addEventListener('change', function (e) {
      var c = e.target;
      if (c.getAttribute && c.getAttribute('data-ed') === 'sel') {
        var idx = parseInt(c.getAttribute('data-idx'), 10);
        if (c.checked) state.selected[idx] = true; else delete state.selected[idx];
        renderSelInfo(viewRows());
      }
    });
    U.el('ed-list').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-ed]'); if (!b) return;
      var idx = parseInt(b.getAttribute('data-idx'), 10), act = b.getAttribute('data-ed');
      if (act === 'edit') { state.editIdx = idx; renderForm(); U.el('ed-form').scrollIntoView({ block: 'nearest' }); }
      else if (act === 'dup') {
        state.work.splice(idx + 1, 0, Object.assign({}, state.work[idx]));
        state.selected = {}; state.dirty = true; renderList();
        U.toast('ทำซ้ำรายการแล้ว — แก้ไขได้ตามต้องการ', 'ok');
      } else if (act === 'del') {
        if (confirm('ลบรายการนี้?')) {
          state.work.splice(idx, 1);
          if (state.editIdx === idx) state.editIdx = -1;
          else if (state.editIdx > idx) state.editIdx--;
          state.selected = {}; state.dirty = true;
          renderForm(); renderList();
        }
      }
    });
    // กันลืมบันทึก: ดักปุ่ม Esc (capture ก่อน focus-trap ของ app.js)
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      var m = U.el('modal-editor');
      if (!m || !m.classList.contains('open')) return;
      if (state.dirty && !confirm(UNSAVED_MSG)) { e.stopImmediatePropagation(); e.preventDefault(); }
      else { state.dirty = false; }
    }, true);
    built = true;
  }

  /* ---------- ฟอร์ม ---------- */
  function monthFieldHtml() {
    var years = U.uniqSorted(state.work.map(function (r) { return U.yearOf(r.month); })).filter(Boolean);
    ['2568', '2569', '2570'].forEach(function (y) { if (years.indexOf(y) < 0) years.push(y); });
    years.sort();
    var yOpts = years.map(function (y) { return '<option value="' + y + '">' + y + '</option>'; }).join('');
    var mOpts = TMONTHS.map(function (nm, i) {
      var v = (i + 1 < 10 ? '0' : '') + (i + 1);
      return '<option value="' + v + '">' + nm + '</option>';
    }).join('');
    return '<div class="ed-month"><select id="fld-month-y">' + yOpts + '</select>' +
      '<select id="fld-month-m">' + mOpts + '</select></div>';
  }

  function renderForm() {
    var fields = FIELDS[state.kind];
    var html = fields.map(function (f) {
      var id = 'fld-' + f.k, input;
      if (f.type === 'month') {
        input = monthFieldHtml();
      } else if (f.type === 'select') {
        input = '<select id="' + id + '">' + f.opts.map(function (o) {
          return '<option value="' + App.esc(o) + '">' + (o || '— ไม่ระบุ —') + '</option>';
        }).join('') + '</select>';
      } else if (f.type === 'number') {
        input = '<input id="' + id + '" type="number" step="any" min="0" />';
      } else {
        input = '<input id="' + id + '" type="text" />';
      }
      return '<div class="field"><label for="' + id + '">' + f.label + (f.req ? ' *' : '') + '</label>' + input + '</div>';
    }).join('');
    U.el('ed-form').innerHTML = html;

    fillForm(state.editIdx >= 0 ? state.work[state.editIdx] : {});
    var editing = state.editIdx >= 0;
    U.el('ed-form-title').innerHTML = editing ? '<span class="ic gi-edit"></span> แก้ไขรายการ #' + (state.editIdx + 1) : '<span class="ic gi-plus"></span> เพิ่มรายการใหม่';
    U.el('ed-save-row').textContent = editing ? 'บันทึกการแก้ไข' : 'เพิ่มรายการ';
  }

  function fillForm(rec) {
    FIELDS[state.kind].forEach(function (f) {
      if (f.type === 'month') {
        var ym = (rec.month || defaultMonth()).split('-');
        var ys = U.el('fld-month-y'), ms = U.el('fld-month-m');
        if (ys) ys.value = ym[0];
        if (ms) ms.value = ym[1];
        return;
      }
      var el = U.el('fld-' + f.k); if (!el) return;
      var v = rec[f.k];
      el.value = (v == null || v === '') ? '' : v;
    });
  }

  function readForm() {
    var fields = FIELDS[state.kind], rec = {};
    for (var i = 0; i < fields.length; i++) {
      var f = fields[i];
      if (f.type === 'month') {
        rec[f.k] = U.el('fld-month-y').value + '-' + U.el('fld-month-m').value;
        continue;
      }
      var v = (U.el('fld-' + f.k).value || '').trim();
      if (f.type === 'number') {
        var n = U.parseNumber(v);
        if (f.req && !(n > 0)) { U.toast('จำนวนต้องมากกว่า 0', 'err'); return null; }
        rec[f.k] = n; continue;
      }
      if (f.req && !v) { U.toast('กรุณากรอก: ' + f.label, 'err'); return null; }
      rec[f.k] = v;
    }
    // OT ในสวัสดิการเก็บเป็น "ชั่วโมง" — ใส่หมายเหตุให้อัตโนมัติ
    if (state.kind === 'welfare' && rec.wtype === 'OT' && !rec.note) rec.note = 'ชั่วโมง';
    return rec;
  }

  function saveRow() {
    var rec = readForm(); if (!rec) return;
    if (state.editIdx >= 0) state.work[state.editIdx] = rec;
    else state.work.push(rec);
    state.editIdx = -1; state.dirty = true;
    renderForm(); renderList();
    U.toast('บันทึกลงตารางชั่วคราวแล้ว — อย่าลืมกด 💾 บันทึกทั้งหมด', 'ok');
  }

  /* ---------- ค้นหา + เรียงลำดับ (สร้าง view ที่อ้างอิง index จริงใน work) ---------- */
  function viewRows() {
    var q = state.search.trim().toLowerCase();
    var arr = state.work.map(function (r, i) { return { r: r, i: i }; });
    if (q) {
      arr = arr.filter(function (o) {
        return [o.r.month, rowLabel(o.r), rowTag(o.r), o.r.detail, o.r.borrower, o.r.position, o.r.note]
          .some(function (v) { return v != null && String(v).toLowerCase().indexOf(q) >= 0; });
      });
    }
    var dir = state.sortDir === 'desc' ? -1 : 1, k = state.sortKey;
    arr.sort(function (a, b) {
      if (k === 'amount') return ((+a.r.amount || 0) - (+b.r.amount || 0)) * dir;
      if (k === 'label') return String(rowLabel(a.r) || '').localeCompare(String(rowLabel(b.r) || ''), 'th') * dir;
      return String(a.r.month || '').localeCompare(String(b.r.month || ''), 'th') * dir;
    });
    return arr;
  }

  /* ---------- ตารางรายการ ---------- */
  function renderList() {
    U.el('ed-h-label').textContent = state.kind === 'oe' ? 'หมวดหมู่' : 'พนักงาน';
    U.el('ed-h-tag').textContent = state.kind === 'oe' ? 'ประเภท' : 'สวัสดิการ';
    var view = viewRows();
    U.el('ed-list').innerHTML = view.length ? view.map(function (o) {
      var r = o.r, i = o.i;
      return '<tr' + (state.editIdx === i ? ' class="ed-editing"' : '') + '>' +
        '<td class="ed-cbcol"><input type="checkbox" data-ed="sel" data-idx="' + i + '"' + (state.selected[i] ? ' checked' : '') + ' /></td>' +
        '<td>' + (i + 1) + '</td>' +
        '<td>' + U.monthLabel(r.month) + '</td>' +
        '<td>' + App.esc(rowLabel(r)) + '</td>' +
        '<td>' + App.esc(rowTag(r)) + '</td>' +
        '<td class="num">' + U.fmt(r.amount) + '</td>' +
        '<td class="ed-actions">' +
          '<button class="btn btn-light btn-sm gi-edit" data-ed="edit" data-idx="' + i + '" title="แก้ไข" aria-label="แก้ไข"></button> ' +
          '<button class="btn btn-light btn-sm gi-copy" data-ed="dup" data-idx="' + i + '" title="ทำซ้ำ" aria-label="ทำซ้ำ"></button> ' +
          '<button class="btn btn-light btn-sm gi-trash" data-ed="del" data-idx="' + i + '" title="ลบ" aria-label="ลบ"></button>' +
        '</td></tr>';
    }).join('') : '<tr><td colspan="7" class="empty">' +
      (state.search ? 'ไม่พบรายการที่ค้นหา' : 'ยังไม่มีรายการ — เพิ่มทางซ้าย') + '</td></tr>';
    U.el('ed-count').textContent = state.work.length;
    renderSummary(view);
    renderSelInfo(view);
  }

  function renderSummary(view) {
    var sumMoney = 0, otH = 0;
    view.forEach(function (o) {
      if (state.kind === 'welfare' && o.r.wtype === 'OT') otH += (+o.r.amount || 0);
      else sumMoney += (+o.r.amount || 0);
    });
    var s = 'แสดง ' + view.length + ' จาก ' + state.work.length + ' รายการ · รวม ' + U.fmt(sumMoney) + ' ฿';
    if (state.kind === 'welfare' && otH > 0) s += ' · OT ' + U.fmt(otH) + ' ชม.';
    U.el('ed-summary').textContent = s;
  }

  function renderSelInfo(view) {
    var n = Object.keys(state.selected).length;
    U.el('ed-selinfo').textContent = n ? ('เลือก ' + n + ' รายการ') : '';
    U.el('ed-delsel').disabled = n === 0;
    U.el('ed-selall').checked = view.length > 0 && view.every(function (o) { return state.selected[o.i]; });
  }

  function toggleSelectAll(on) {
    viewRows().forEach(function (o) { if (on) state.selected[o.i] = true; else delete state.selected[o.i]; });
    renderList();
  }

  function deleteSelected() {
    var idxs = Object.keys(state.selected).map(Number).sort(function (a, b) { return b - a; });
    if (!idxs.length) return;
    if (!confirm('ลบ ' + idxs.length + ' รายการที่เลือก?')) return;
    idxs.forEach(function (i) { state.work.splice(i, 1); });
    state.selected = {}; state.editIdx = -1; state.dirty = true;
    renderForm(); renderList();
    U.toast('ลบ ' + idxs.length + ' รายการแล้ว', 'ok');
  }

  /* ---------- ลิงก์ Google Sheets (แก้แบบเรียลไทม/หลายคน) ---------- */
  function renderSheetLink() {
    var cfg = DS.config.get(state.kind);
    var box = U.el('ed-sheet-link');
    if (cfg.sheetId) {
      var url = 'https://docs.google.com/spreadsheets/d/' + cfg.sheetId + '/edit';
      box.innerHTML = '🔗 ต้องการให้ <strong>หลายคนแก้พร้อมกันแบบเรียลไทม</strong>? แก้ที่ต้นทางได้เลย: ' +
        '<a href="' + App.esc(url) + '" target="_blank" rel="noopener">เปิด Google Sheets ↗</a>' +
        '<br><small>แก้ในชีตแล้วกด “🔄 รีเฟรช” ที่แดชบอร์ด ทุกเครื่องจะเห็นพร้อมกัน · ส่วนการแก้ด้านล่างนี้เก็บเฉพาะในเบราว์เซอร์นี้</small>';
    } else {
      box.innerHTML = '💡 การแก้ด้านล่างนี้เก็บไว้<strong>เฉพาะในเบราว์เซอร์นี้</strong> (เครื่องอื่นไม่เห็น). ' +
        'อยากให้<strong>หลายคนเห็นพร้อมกันแบบเรียลไทม</strong> ให้กด “🔗 เชื่อม Google Sheets” แล้วแก้ข้อมูลในชีตแทน';
    }
  }

  /* ---------- สำรอง (Export) / นำเข้า (Import) ---------- */
  function fileBase() {
    return 'CPF_ธารเกษม_' + (state.kind === 'oe' ? 'OE' : 'สวัสดิการ') + '_2569';
  }
  function buildAOA() {
    var cols = DS.SCHEMA[state.kind].cols;
    var aoa = [HEADERS[state.kind].slice()];
    state.work.forEach(function (r) {
      aoa.push(cols.map(function (c) { return r[c] == null ? '' : r[c]; }));
    });
    return aoa;
  }
  function exportExcel() {
    if (!state.work.length) { U.toast('ยังไม่มีข้อมูลให้สำรอง', 'err'); return; }
    if (typeof XLSX === 'undefined') { U.toast('ไลบรารี Excel ยังโหลดไม่เสร็จ ลองใหม่อีกครั้ง', 'err'); return; }
    var ws = XLSX.utils.aoa_to_sheet(buildAOA());
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'RAW_DATA');
    XLSX.writeFile(wb, fileBase() + '.xlsx');
    U.toast('ดาวน์โหลดไฟล์ Excel สำรองแล้ว', 'ok');
  }
  function csvCell(v) {
    var s = (v == null ? '' : String(v));
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function exportCSV() {
    if (!state.work.length) { U.toast('ยังไม่มีข้อมูลให้สำรอง', 'err'); return; }
    var csv = buildAOA().map(function (row) { return row.map(csvCell).join(','); }).join('\r\n');
    var blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileBase() + '.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    U.toast('ดาวน์โหลดไฟล์ CSV สำรองแล้ว', 'ok');
  }
  function importFile(file) {
    if (state.work.length && !confirm('นำเข้าจะแทนที่รายการทั้งหมดในตาราง (' + state.work.length + ' รายการ) ดำเนินการต่อ?')) return;
    var done = function (records) {
      if (!records || !records.length) { U.toast('ไม่พบข้อมูลในไฟล์ (ตรวจลำดับคอลัมน์ RAW_DATA)', 'err'); return; }
      state.work = records.map(function (r) { return Object.assign({}, r); });
      state.editIdx = -1; state.selected = {}; state.dirty = true;
      renderForm(); renderList();
      U.toast('นำเข้า ' + records.length + ' รายการแล้ว — ตรวจสอบแล้วกด 💾 บันทึกทั้งหมด', 'ok');
    };
    if (/\.csv$/i.test(file.name)) {
      file.text().then(function (t) { done(DS.normalizeAny(state.kind, DS.parseCSV(t))); })
        .catch(function (e) { U.toast('อ่าน CSV ไม่สำเร็จ: ' + e.message, 'err'); });
    } else {
      DS.fromExcel(state.kind, file).then(function (res) { done(res.records); })
        .catch(function (e) { U.toast(e.message, 'err'); });
    }
  }

  /* ---------- บันทึก / ล้าง / ปิด ---------- */
  function saveAll() {
    DS.local.set(state.kind, state.work);
    state.dirty = false;
    close(true);
    if (state.onApply) state.onApply(state.work.slice());
  }

  function clearLocal() {
    if (!confirm('ล้างข้อมูลที่แก้ไขในเครื่องนี้ แล้วกลับไปใช้ข้อมูลต้นทาง (Google Sheets / Excel / ตัวอย่าง)?')) return;
    DS.local.clear(state.kind);
    state.dirty = false;
    close(true);
    if (state.onReset) state.onReset();
  }

  function close(force) {
    if (!force && state.dirty && !confirm(UNSAVED_MSG)) return;
    state.dirty = false;
    App.closeModal('modal-editor');
  }

  /* ---------- เปิดโมดอล ---------- */
  function open(opts) {
    state.kind = opts.kind;
    state.work = (opts.records || []).map(function (r) { return Object.assign({}, r); });
    var fi = (typeof opts.focusIndex === 'number' && opts.focusIndex >= 0 && opts.focusIndex < state.work.length) ? opts.focusIndex : -1;
    state.editIdx = fi;
    state.onApply = opts.onApply;
    state.onReset = opts.onReset;
    state.search = (opts.search || '').trim(); state.sortKey = 'month'; state.sortDir = 'asc';
    state.selected = {}; state.dirty = false;
    ensureModal();
    U.el('ed-search').value = state.search;
    U.el('ed-sort').value = 'month-asc';
    renderSheetLink();
    renderForm();
    renderList();
    App.openModal('modal-editor');
    if (fi >= 0) U.el('ed-form').scrollIntoView({ block: 'nearest' });
  }

  global.DataEditor = { open: open };
})(window);
