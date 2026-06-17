/* ============================================================
   data.js — ชั้นข้อมูล (Data layer)
   - ดึงข้อมูลสดจาก Google Sheets (published CSV ผ่าน gviz)
   - Fallback: อัปโหลดไฟล์ Excel (.xlsx) ด้วย SheetJS
   - ข้อมูลตัวอย่าง (demo) ฝังในตัวสำหรับเปิดดูได้ทันที
   - แปลงข้อมูลตาม "ลำดับคอลัมน์" (column index) ของ RAW_DATA
     *** ลำดับคอลัมน์ใน RAW_DATA สำคัญ — อย่าสลับ ***
   ============================================================ */
(function (global) {
  'use strict';
  var U = global.U;

  /* ---- โครงสร้างคอลัมน์ RAW_DATA (อ่านตาม index) ---- */
  var SCHEMA = {
    oe: {
      sheetName: 'RAW_DATA',
      storageKey: 'cpf_oe_source',
      // 0:เดือน 1:หมวดหมู่ 2:ประเภท 3:กลุ่ม 4:รายละเอียด 5:จำนวนเงิน 6:ผู้ยืม
      cols: ['month', 'category', 'type', 'group', 'detail', 'amount', 'borrower'],
      amountIndex: 5
    },
    welfare: {
      sheetName: 'RAW_DATA',
      storageKey: 'cpf_welfare_source',
      // 0:เดือน 1:ชื่อพนักงาน 2:ตำแหน่ง 3:ประเภทสวัสดิการ 4:จำนวนเงิน 5:หมายเหตุ
      cols: ['month', 'employee', 'position', 'wtype', 'amount', 'note'],
      amountIndex: 4
    }
  };

  var MONTH_RE = /^\s*\d{4}\s*-\s*\d{1,2}/;

  /* ---------------- Config (localStorage) ---------------- */
  function cfgGet(kind) {
    try {
      var raw = localStorage.getItem(SCHEMA[kind].storageKey);
      return raw ? JSON.parse(raw) : { sheetId: '', sheetName: SCHEMA[kind].sheetName };
    } catch (e) {
      return { sheetId: '', sheetName: SCHEMA[kind].sheetName };
    }
  }
  function cfgSet(kind, cfg) {
    var cur = cfgGet(kind);
    var merged = Object.assign({}, cur, cfg);
    localStorage.setItem(SCHEMA[kind].storageKey, JSON.stringify(merged));
    return merged;
  }
  function cfgClear(kind) { localStorage.removeItem(SCHEMA[kind].storageKey); }

  /* ---------------- Google Sheets ---------------- */
  /** รับได้ทั้ง URL เต็มหรือ ID ล้วน -> คืน ID */
  function extractSheetId(input) {
    if (!input) return '';
    var s = String(input).trim();
    var m = s.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (m) return m[1];
    // อาจเป็น ID ล้วน
    if (/^[a-zA-Z0-9-_]{20,}$/.test(s)) return s;
    return s;
  }

  function buildCsvUrl(sheetId, sheetName) {
    return 'https://docs.google.com/spreadsheets/d/' + encodeURIComponent(sheetId) +
      '/gviz/tq?tqx=out:csv&sheet=' + encodeURIComponent(sheetName || 'RAW_DATA');
  }

  /* ---------------- CSV parser (รองรับ field ที่มี comma/ขึ้นบรรทัด/quote) ---------------- */
  function parseCSV(text) {
    var rows = [], row = [], field = '', inQ = false, i = 0, c;
    text = String(text).replace(/^﻿/, ''); // ตัด BOM
    while (i < text.length) {
      c = text[i];
      if (inQ) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
          inQ = false; i++; continue;
        }
        field += c; i++; continue;
      }
      if (c === '"') { inQ = true; i++; continue; }
      if (c === ',') { row.push(field); field = ''; i++; continue; }
      if (c === '\r') { i++; continue; }
      if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
      field += c; i++;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows;
  }

  /* ---------------- Normalize (array-of-arrays -> records) ---------------- */
  function normalize(kind, rows) {
    var sc = SCHEMA[kind];
    var out = [];
    for (var r = 0; r < rows.length; r++) {
      var cells = rows[r] || [];
      var first = (cells[0] == null ? '' : String(cells[0])).trim();
      // ข้ามแถวหัวตาราง / แถวว่าง / แถวที่ไม่ใช่รหัสเดือน
      if (!MONTH_RE.test(first)) continue;
      var rec = {};
      sc.cols.forEach(function (name, idx) {
        var v = cells[idx];
        rec[name] = (v == null ? '' : String(v)).trim();
      });
      // ทำให้เป็นรูปแบบ YYYY-MM เสมอ (pad เลขเดือน 1 หลัก -> 2 หลัก) เพื่อให้เรียงลำดับถูกต้อง
      rec.month = rec.month.replace(/\s+/g, '').replace(/-(\d)$/, '-0$1');
      rec.amount = U.parseNumber(cells[sc.amountIndex]);
      if (rec.amount <= 0) continue; // ตัดแถวยอด 0
      out.push(rec);
    }
    return out;
  }

  /* ---------------- ฟอร์มสวัสดิการแบบกว้าง (wide) + OT ----------------
     ตารางแบบ 1 คน/แถว: คอลัมน์แยกตามประเภทสวัสดิการ + คอลัมน์ OT (ชั่วโมง)
     - หาเดือนจากเซลล์ใดก็ได้ในชีต (รูปแบบ 25xx-xx)
     - คอลัมน์ "ค่าจ้าง/ชม." + คอลัมน์ OT ที่หัวมีคำว่า "เท่า" -> คำนวณเงิน OT
       เงิน OT = ค่าจ้าง/ชม. × Σ(ชั่วโมง × ตัวคูณ)  -> รวมเข้า "สวัสดิการอื่นๆ"
     คืน null ถ้าไม่ใช่ฟอร์มแบบนี้ (เพื่อให้ตกไปใช้ normalize ปกติ) */
  var WTYPES = ['ค่ารักษาพยาบาล', 'เบี้ยเลี้ยง', 'ค่าน้ำมัน', 'ค่าที่พัก', 'สวัสดิการอื่นๆ'];
  function cellStr(v) { return (v == null ? '' : String(v)).replace(/\s+/g, ' ').trim(); }

  function normalizeWelfareWide(rows) {
    // หาแถวหัวตาราง (มีทั้ง "ชื่อ" และชื่อประเภทสวัสดิการอย่างน้อยหนึ่ง)
    var headIdx = -1, scanMax = Math.min(rows.length, 8);
    for (var i = 0; i < scanMax; i++) {
      var joined = (rows[i] || []).map(cellStr).join('|');
      if (/ชื่อ/.test(joined) && /(ค่ารักษาพยาบาล|เบี้ยเลี้ยง|ค่าที่พัก)/.test(joined)) { headIdx = i; break; }
    }
    if (headIdx < 0) return null;

    // หาเดือน (เซลล์ใดก็ได้ที่ตรงรูปแบบ 25xx-xx)
    var month = '';
    for (var r0 = 0; r0 < rows.length && !month; r0++) {
      var cs = rows[r0] || [];
      for (var c0 = 0; c0 < cs.length; c0++) {
        var m = cellStr(cs[c0]).match(/(\d{4})\s*-\s*(\d{1,2})/);
        if (m) { month = m[1] + '-' + (m[2].length < 2 ? '0' + m[2] : m[2]); break; }
      }
    }
    if (!month) throw new Error('ฟอร์มสวัสดิการไม่พบ "เดือน" (ใส่รูปแบบ 2569-01 ในชีต)');

    // รวมข้อความหัวจากแถว headIdx และแถวถัดไป (รองรับหัว 2 ชั้น เช่น OT)
    var h1 = (rows[headIdx] || []).map(cellStr);
    var h2 = (rows[headIdx + 1] || []).map(cellStr);
    var width = Math.max(h1.length, h2.length);
    var nameCol = -1, posCol = -1, rateCol = -1;
    var typeCols = {};   // colIndex -> wtype
    var otCols = [];     // { col, mult }
    for (var c = 0; c < width; c++) {
      var head = ((h1[c] || '') + ' ' + (h2[c] || '')).trim();
      if (nameCol < 0 && /ชื่อ/.test(head)) { nameCol = c; continue; }
      if (posCol < 0 && /ตำแหน่ง/.test(head)) { posCol = c; continue; }
      if (rateCol < 0 && /ค่าจ้าง/.test(head)) { rateCol = c; continue; }
      var hit = null;
      WTYPES.forEach(function (t) { if (head.indexOf(t) >= 0) hit = t; });
      if (hit && typeCols[c] === undefined) { typeCols[c] = hit; continue; }
      var mm = head.match(/([\d.]+)\s*เท่า/);
      if (mm) otCols.push({ col: c, mult: parseFloat(mm[1]) || 0 });
    }
    if (nameCol < 0 || !Object.keys(typeCols).length) return null;

    var out = [];
    for (var r = headIdx + 2; r < rows.length; r++) {
      var cells = rows[r] || [];
      var name = cellStr(cells[nameCol]);
      if (!name || /^รวม/.test(name)) continue; // ข้ามแถวสรุป/ว่าง
      var pos = posCol >= 0 ? cellStr(cells[posCol]) : '';
      // ยอดสวัสดิการ (บาท)
      Object.keys(typeCols).forEach(function (c) {
        var wtype = typeCols[c];
        var amt = U.parseNumber(cells[c]);
        if (amt > 0) out.push({ month: month, employee: name, position: pos, wtype: wtype, amount: amt, note: '' });
      });
      // OT รวมเป็น "จำนวนชั่วโมง" (ไม่แปลงเป็นเงิน) — หมวดแยก wtype = 'OT'
      var otHours = 0;
      otCols.forEach(function (o) { otHours += U.parseNumber(cells[o.col]); });
      if (otHours > 0) out.push({ month: month, employee: name, position: pos, wtype: 'OT', amount: otHours, note: 'ชั่วโมง' });
    }
    return out;
  }

  /* เลือก parser อัตโนมัติ: welfare ลองฟอร์ม wide ก่อน ถ้าไม่ใช่ใช้ long ปกติ */
  function normalizeAny(kind, rows) {
    if (kind === 'welfare') {
      var wide = normalizeWelfareWide(rows);
      if (wide && wide.length) return wide;
    }
    return normalize(kind, rows);
  }

  function fromSheets(kind) {
    var sc = SCHEMA[kind];
    var cfg = cfgGet(kind);
    if (!cfg.sheetId) return Promise.reject(new Error('ยังไม่ได้ตั้งค่า Google Sheets'));
    var sheetName = cfg.sheetName || sc.sheetName;
    var url = buildCsvUrl(cfg.sheetId, sheetName);
    return fetch(url, { cache: 'no-store', redirect: 'follow' })
      .then(function (res) {
        if (!res.ok) {
          if (res.status === 404) throw new Error('ไม่พบชีต — ตรวจสอบ Sheet ID และชื่อแท็บ "' + sheetName + '"');
          throw new Error('เชื่อมต่อชีตไม่สำเร็จ (HTTP ' + res.status + ')');
        }
        return res.text();
      })
      .then(function (text) {
        var head = text.slice(0, 200).toLowerCase();
        if (head.indexOf('<!doctype') >= 0 || head.indexOf('<html') >= 0) {
          throw new Error('เข้าถึงชีตไม่ได้ — โปรดตั้งค่าแชร์เป็น "ทุกคนที่มีลิงก์ (ผู้อ่าน)"');
        }
        var rows = parseCSV(text);
        var records = normalizeAny(kind, rows);
        if (!records.length) throw new Error('ไม่พบข้อมูลในแท็บ "' + sheetName + '" (ตรวจสอบลำดับคอลัมน์ RAW_DATA)');
        return { records: records, source: 'sheets', sheetName: sheetName, count: records.length };
      });
  }

  function fromExcel(kind, file) {
    if (typeof XLSX === 'undefined') return Promise.reject(new Error('ไลบรารีอ่าน Excel ยังโหลดไม่เสร็จ ลองใหม่อีกครั้ง'));
    return file.arrayBuffer().then(function (buf) {
      var wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
      // เลือกแท็บ RAW_DATA ก่อน ถ้าไม่มีเลือกแท็บที่มีข้อมูลมากสุด (ข้ามแท็บ "คำอธิบาย")
      var name = null;
      wb.SheetNames.forEach(function (n) { if (String(n).trim().toUpperCase() === 'RAW_DATA') name = n; });
      if (!name) {
        var best = -1;
        wb.SheetNames.forEach(function (n) {
          if (/คำอธิบาย|readme|instruction/i.test(n)) return;
          var rng = wb.Sheets[n] && wb.Sheets[n]['!ref'];
          var cnt = rng ? XLSX.utils.decode_range(rng).e.r : 0;
          if (cnt > best) { best = cnt; name = n; }
        });
        if (!name) name = wb.SheetNames[wb.SheetNames.length - 1];
      }
      var rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: '' });
      var records = normalizeAny(kind, rows);
      if (!records.length) throw new Error('ไม่พบข้อมูลในไฟล์ (ต้องมีแท็บ RAW_DATA และลำดับคอลัมน์ถูกต้อง)');
      return { records: records, source: 'excel', sheetName: name, fileName: file.name, count: records.length };
    });
  }

  /* ---------------- โหลดอัตโนมัติ: มี config -> Sheets, ไม่มี -> ตัวอย่าง ---------------- */
  function loadAuto(kind) {
    var cfg = cfgGet(kind);
    if (cfg.sheetId) {
      return fromSheets(kind).catch(function (err) {
        // ล้มเหลว -> ตกไปใช้ตัวอย่าง พร้อมแจ้ง error
        var s = sample(kind);
        s.error = err.message || String(err);
        s.fellBack = true;
        return s;
      });
    }
    return Promise.resolve(sample(kind));
  }

  /* ============================================================
     ข้อมูลตัวอย่าง (Demo) — สุ่มแบบกำหนดค่าคงที่ (deterministic)
     ปีงบประมาณ พ.ศ. 2569
     ============================================================ */
  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function months(year, n) {
    var arr = [];
    for (var m = 1; m <= n; m++) arr.push(year + '-' + (m < 10 ? '0' + m : '' + m));
    return arr;
  }
  function around(base, rnd, spread) { // ±spread%
    var f = 1 + (rnd() * 2 - 1) * (spread / 100);
    return Math.max(0, Math.round(base * f / 50) * 50);
  }

  var _cache = {};

  function sampleOE() {
    if (_cache.oe) return JSON.parse(JSON.stringify(_cache.oe));
    var rnd = rng(2569013);
    var MS = months('2569', 6); // ม.ค.–มิ.ย. 2569
    var cats = [
      ['ค่าจ้างเหมา', 'แปรผัน', 92000], ['ค่ากิจกรรมชุมชน', 'แปรผัน', 34000],
      ['ค่าบำรุงสมาคมฯ', 'คงที่', 25000], ['ค่าไฟฟ้า', 'แปรผัน', 28000],
      ['ค่าน้ำประปา', 'แปรผัน', 6000], ['ค่าโทรศัพท์/อินเทอร์เน็ต', 'คงที่', 5500],
      ['ค่าน้ำมันเชื้อเพลิง', 'แปรผัน', 18000], ['ค่าซ่อมแซมบำรุงรักษา', 'แปรผัน', 15000],
      ['ค่าวัสดุสำนักงาน', 'แปรผัน', 7000], ['ค่าเครื่องเขียนแบบพิมพ์', 'แปรผัน', 3500],
      ['ค่ารักษาความปลอดภัย', 'คงที่', 22000], ['ค่าทำความสะอาด', 'คงที่', 12000],
      ['ค่าเช่าอุปกรณ์', 'คงที่', 9000], ['ค่าประกันภัย', 'คงที่', 8000],
      ['ค่ารับรอง', 'แปรผัน', 6500], ['ค่าเดินทาง', 'แปรผัน', 9500],
      ['ค่าฝึกอบรม', 'แปรผัน', 7000], ['ค่าไปรษณีย์/ขนส่ง', 'แปรผัน', 4000],
      ['ค่าธรรมเนียมธนาคาร', 'คงที่', 2500], ['ค่าที่ปรึกษา', 'คงที่', 15000],
      ['ค่าบำรุงรักษาระบบ IT', 'คงที่', 6000], ['ค่าตรวจวิเคราะห์/แล็บ', 'แปรผัน', 8500],
      ['ค่าสาธารณูปโภคอื่นๆ', 'แปรผัน', 4500], ['ค่าใช้จ่ายเบ็ดเตล็ด', 'แปรผัน', 5000]
    ];
    var recs = [];
    MS.forEach(function (mo) {
      cats.forEach(function (c) {
        var spread = c[1] === 'คงที่' ? 4 : 30;
        recs.push({
          month: mo, category: c[0], type: 'ค่าใช้จ่าย', group: c[1],
          detail: '', amount: around(c[2], rnd, spread), borrower: ''
        });
      });
    });
    // เงินยืมทดรอง
    var borrowers = ['นายประสิทธิ์ แก้วใส', 'นางสาวสุดารัตน์ โพธิ์ทอง', 'นายวิชัย แสงทอง',
      'นายประยุทธ มั่นคง', 'นางสาวกนกวรรณ ใจดี'];
    var purposes = ['ซื้ออุปกรณ์ซ่อมบำรุง', 'ค่าเดินทางราชการ', 'จัดกิจกรรมชุมชน',
      'ซื้อวัสดุสิ้นเปลือง', 'ค่ารับรองลูกค้า', 'สำรองจ่ายค่าขนส่ง'];
    var nAdv = 18;
    for (var i = 0; i < nAdv; i++) {
      var mo = MS[Math.floor(rnd() * MS.length)];
      recs.push({
        month: mo, category: 'เงินยืมทดรอง', type: 'เงินยืมทดรอง', group: '',
        detail: purposes[Math.floor(rnd() * purposes.length)],
        amount: 5000 + Math.round(rnd() * 30) * 1000,
        borrower: borrowers[Math.floor(rnd() * borrowers.length)]
      });
    }
    var out = { records: recs, source: 'sample', count: recs.length };
    _cache.oe = JSON.parse(JSON.stringify(out));
    return out;
  }

  function sampleWelfare() {
    if (_cache.welfare) return JSON.parse(JSON.stringify(_cache.welfare));
    var rnd = rng(2569055);
    var MS = months('2569', 5); // ม.ค.–พ.ค. 2569
    var emps = [
      ['นายสมชาย ทองดี', 'ผู้จัดการ'], ['นางสาวสุดารัตน์ โพธิ์ทอง', 'ธุรการ'],
      ['นายประสิทธิ์ แก้วใส', 'ช่าง'], ['นายวิชัย แสงทอง', 'พนักงานขับรถ'],
      ['นางสาวกนกวรรณ ใจดี', 'ธุรการ'], ['นายประยุทธ มั่นคง', 'รปภ.'],
      ['นางมาลี ศรีสุข', 'แม่บ้าน'], ['นายอนุชา พรหมมา', 'ช่าง'],
      ['นายสมศักดิ์ บุญมี', 'พนักงานขับรถ'], ['นางสาวพิมพ์ใจ รักษ์ดี', 'ธุรการ'],
      ['นายเอกชัย วงศ์ไทย', 'รปภ.'], ['นายสุรชัย กล้าหาญ', 'ช่าง'],
      ['นางสาวนภาพร สดใส', 'แม่บ้าน'], ['นายชัยวัฒน์ ทรงศรี', 'พนักงานขับรถ'],
      ['นายมานพ คงเจริญ', 'รปภ.'], ['นางสาวอรทัย ดวงแก้ว', 'ธุรการ'],
      ['นายพิชิต เพิ่มพูล', 'ช่าง'], ['นายวีระ สุขสมบูรณ์', 'พนักงานขับรถ'],
      ['นางสาวจันทร์เพ็ญ งามตา', 'แม่บ้าน'], ['นายธีระพงษ์ ภักดี', 'รปภ.'],
      ['นายสมพร แก้วมณี', 'ช่าง'], ['นางสาวรัตนา พูนทรัพย์', 'ธุรการ']
    ];
    var recs = [];
    function add(mo, e, wtype, amt, note) {
      if (amt > 0) recs.push({ month: mo, employee: e[0], position: e[1], wtype: wtype, amount: amt, note: note || '' });
    }
    MS.forEach(function (mo) {
      emps.forEach(function (e) {
        var pos = e[1];
        var field = (pos === 'พนักงานขับรถ' || pos === 'ช่าง' || pos === 'ผู้จัดการ');
        // ค่ารักษาพยาบาล — เกิดเป็นครั้งคราว
        if (rnd() < 0.28) add(mo, e, 'ค่ารักษาพยาบาล', 500 + Math.round(rnd() * 15) * 500);
        // เบี้ยเลี้ยง — สาย field บ่อย
        if (rnd() < (field ? 0.8 : 0.35)) add(mo, e, 'เบี้ยเลี้ยง', 800 + Math.round(rnd() * 8) * 450);
        // ค่าน้ำมัน — พขร./ผู้จัดการ
        if ((pos === 'พนักงานขับรถ' || pos === 'ผู้จัดการ') && rnd() < 0.85)
          add(mo, e, 'ค่าน้ำมัน', 1500 + Math.round(rnd() * 9) * 500);
        // ค่าที่พัก — เดินทางค้างคืน
        if (field && rnd() < 0.22) add(mo, e, 'ค่าที่พัก', 1200 + Math.round(rnd() * 5) * 500);
        // สวัสดิการอื่นๆ
        if (rnd() < 0.4) add(mo, e, 'สวัสดิการอื่นๆ', 300 + Math.round(rnd() * 6) * 200);
        // OT — บันทึกเป็น "จำนวนชั่วโมง" (สาย field ทำ OT บ่อย/มากกว่า)
        if (rnd() < (field ? 0.7 : 0.4)) add(mo, e, 'OT', Math.round((field ? 6 : 3) + rnd() * (field ? 18 : 8)), 'ชั่วโมง');
      });
    });
    var out = { records: recs, source: 'sample', count: recs.length };
    _cache.welfare = JSON.parse(JSON.stringify(out));
    return out;
  }

  function sample(kind) { return kind === 'welfare' ? sampleWelfare() : sampleOE(); }

  global.DataSource = {
    SCHEMA: SCHEMA,
    config: { get: cfgGet, set: cfgSet, clear: cfgClear },
    extractSheetId: extractSheetId,
    buildCsvUrl: buildCsvUrl,
    parseCSV: parseCSV,
    normalize: normalize,
    normalizeAny: normalizeAny,
    fromSheets: fromSheets,
    fromExcel: fromExcel,
    loadAuto: loadAuto,
    sample: sample
  };
})(window);
