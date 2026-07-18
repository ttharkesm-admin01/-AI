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
      localKey: 'cpf_oe_records',
      // 0:เดือน 1:หมวดหมู่ 2:ประเภท 3:กลุ่ม 4:รายละเอียด 5:จำนวนเงิน 6:ผู้ยืม
      cols: ['month', 'category', 'type', 'group', 'detail', 'amount', 'borrower'],
      amountIndex: 5
    },
    welfare: {
      sheetName: 'RAW_DATA',
      storageKey: 'cpf_welfare_source',
      localKey: 'cpf_welfare_records',
      // 0:เดือน 1:ชื่อพนักงาน 2:ตำแหน่ง 3:ประเภทสวัสดิการ 4:จำนวนเงิน 5:หมายเหตุ
      cols: ['month', 'employee', 'position', 'wtype', 'amount', 'note'],
      amountIndex: 4
    }
  };

  var MONTH_RE = /^\s*(\d{4})\s*-\s*(\d{1,2})(?!\d)/;

  /* ชื่อเดือนไทย (เต็ม/ย่อ) -> เลขเดือน 1–12 */
  var THAI_MONTHS = [
    ['มกราคม', 'ม.ค.'], ['กุมภาพันธ์', 'ก.พ.'], ['มีนาคม', 'มี.ค.'],
    ['เมษายน', 'เม.ย.'], ['พฤษภาคม', 'พ.ค.'], ['มิถุนายน', 'มิ.ย.'],
    ['กรกฎาคม', 'ก.ค.'], ['สิงหาคม', 'ส.ค.'], ['กันยายน', 'ก.ย.'],
    ['ตุลาคม', 'ต.ค.'], ['พฤศจิกายน', 'พ.ย.'], ['ธันวาคม', 'ธ.ค.']
  ];
  /** หาเดือนแบบไทย ("มกราคม 2569" / "ม.ค.69") ในข้อความใด ๆ -> "2569-01" หรือ '' */
  function thaiMonthToCode(text) {
    var s = String(text || '');
    for (var i = 0; i < THAI_MONTHS.length; i++) {
      var names = THAI_MONTHS[i];
      for (var k = 0; k < names.length; k++) {
        var idx = s.indexOf(names[k]);
        if (idx < 0) continue;
        var ym = s.slice(idx + names[k].length).match(/(\d{2,4})/);
        if (!ym) continue;
        var y = parseInt(ym[1], 10);
        if (y < 100) y += 2500;
        var mo = i + 1;
        return y + '-' + (mo < 10 ? '0' + mo : '' + mo);
      }
    }
    return '';
  }

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

  /* ---------------- ข้อมูลที่ผู้ใช้แก้ไขเอง (localStorage) ----------------
     เก็บ records ที่เพิ่ม/แก้ไข/ลบ ในหน้าเว็บ — ถ้ามี จะใช้แทนข้อมูลต้นทาง
     (กดล้างเพื่อกลับไปใช้ Google Sheets / Excel / ตัวอย่าง) */
  function localHas(kind) {
    try { return !!localStorage.getItem(SCHEMA[kind].localKey); } catch (e) { return false; }
  }
  function localGet(kind) {
    try {
      var raw = localStorage.getItem(SCHEMA[kind].localKey);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }
  function localSet(kind, records) {
    localStorage.setItem(SCHEMA[kind].localKey, JSON.stringify(records || []));
  }
  function localClear(kind) { localStorage.removeItem(SCHEMA[kind].localKey); }

  /* ---------------- แคชข้อมูล Sheets (สำหรับเปิดดูออฟไลน์เมื่อเน็ตหลุด) ----------------
     เก็บผลดึง Sheets ครั้งล่าสุด แยกจาก local override (ผู้ใช้แก้เอง) */
  function cacheKey(kind) { return SCHEMA[kind].localKey + '_sheetcache'; }
  function cacheSet(kind, records) {
    try { localStorage.setItem(cacheKey(kind), JSON.stringify({ records: records, ts: Date.now() })); } catch (e) { /* เต็ม/ปิด storage */ }
  }
  function cacheGet(kind) {
    try { var r = localStorage.getItem(cacheKey(kind)); return r ? JSON.parse(r) : null; } catch (e) { return null; }
  }

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
      var fm = first.match(MONTH_RE);
      if (!fm) continue;
      var rec = {};
      sc.cols.forEach(function (name, idx) {
        var v = cells[idx];
        rec[name] = (v == null ? '' : String(v)).trim();
      });
      // เก็บเฉพาะส่วน YYYY-MM ที่ match (ตัดข้อความปนท้ายเซลล์ทิ้ง) + pad เลขเดือนเป็น 2 หลัก
      rec.month = fm[1] + '-' + (fm[2].length < 2 ? '0' + fm[2] : fm[2]);
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

    // หาเดือน — รับทั้งรูปแบบ 25xx-xx และชื่อเดือนไทย ("ประจำเดือน มกราคม 2569")
    var month = '';
    for (var r0 = 0; r0 < rows.length && !month; r0++) {
      var cs = rows[r0] || [];
      for (var c0 = 0; c0 < cs.length; c0++) {
        var txt = cellStr(cs[c0]);
        var m = txt.match(/(\d{4})\s*-\s*(\d{1,2})/);
        if (m) { month = m[1] + '-' + (m[2].length < 2 ? '0' + m[2] : m[2]); break; }
        var tm = thaiMonthToCode(txt);
        if (tm) { month = tm; break; }
      }
    }
    if (!month) return null; // ไม่ใช่ฟอร์ม wide ที่สมบูรณ์ → ให้ normalizeAny fallback ไป long format

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
        cacheSet(kind, records); // เก็บไว้เปิดดูออฟไลน์ครั้งหน้า
        return { records: records, source: 'sheets', sheetName: sheetName, count: records.length };
      });
  }

  /* ดึง Sheets; ถ้าล้มเหลว (เน็ตหลุด ฯลฯ) ใช้แคชล่าสุดแทน — ไม่มีแคชค่อยโยน error ต่อ */
  function fromSheetsCached(kind) {
    return fromSheets(kind).catch(function (err) {
      var cached = cacheGet(kind);
      if (cached && cached.records && cached.records.length) {
        return { records: cached.records, source: 'sheets-cache', count: cached.records.length, error: err.message, fellBack: true, cachedAt: cached.ts };
      }
      throw err;
    });
  }

  function fromExcel(kind, file) {
    if (typeof XLSX === 'undefined') return Promise.reject(new Error('ไลบรารีอ่าน Excel ยังโหลดไม่เสร็จ ลองใหม่อีกครั้ง'));
    return file.arrayBuffer().then(function (buf) {
      var wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
      var sheetRows = function (n) { return XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: '' }); };
      var hasRaw = wb.SheetNames.some(function (n) { return String(n).trim().toUpperCase() === 'RAW_DATA'; });

      // สวัสดิการแบบ wide ที่แยกชีตตามเดือน (ไม่มีแท็บ RAW_DATA) -> อ่านรวมทุกชีต
      if (kind === 'welfare' && !hasRaw) {
        var all = [], used = [];
        wb.SheetNames.forEach(function (n) {
          if (/คำอธิบาย|readme|instruction/i.test(n)) return;
          try {
            var w = normalizeWelfareWide(sheetRows(n));
            if (w && w.length) { all = all.concat(w); used.push(n); }
          } catch (e) { /* ข้ามชีตที่ไม่ใช่ฟอร์มสวัสดิการ */ }
        });
        if (all.length) {
          return { records: all, source: 'excel', sheetName: used.join(', '), fileName: file.name, count: all.length };
        }
      }

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
      var rows = sheetRows(name);
      var records = normalizeAny(kind, rows);
      if (!records.length) throw new Error('ไม่พบข้อมูลในไฟล์ (ต้องมีแท็บ RAW_DATA และลำดับคอลัมน์ถูกต้อง)');
      return { records: records, source: 'excel', sheetName: name, fileName: file.name, count: records.length };
    });
  }

  /* ---------------- โหลดอัตโนมัติ: มี config -> Sheets, ไม่มี -> ตัวอย่าง ---------------- */
  function loadAuto(kind) {
    // ข้อมูลที่ผู้ใช้แก้ไขในเครื่อง (ถ้ามี) มาก่อนเสมอ
    if (localHas(kind)) {
      var recs = localGet(kind);
      return Promise.resolve({ records: recs, source: 'local', count: recs.length });
    }
    var cfg = cfgGet(kind);
    if (cfg.sheetId) {
      return fromSheetsCached(kind).catch(function (err) {
        // ล้มเหลวและไม่มีแคช -> ตกไปใช้ตัวอย่าง พร้อมแจ้ง error
        var s = sample(kind);
        s.error = err.message || String(err);
        s.fellBack = true;
        return s;
      });
    }
    return Promise.resolve(sample(kind));
  }

  /* ============================================================
     ข้อมูลตัวอย่าง (Demo) — ข้อมูลจริงฝังในตัว ปีงบประมาณ พ.ศ. 2569
     ============================================================ */
  var _cache = {};

  function sampleOE() {
    if (_cache.oe) return JSON.parse(JSON.stringify(_cache.oe));
    // ข้อมูลจริง: ค่าใช้จ่าย OE โรงงานธารเกษม เดือน เม.ย. 2569 (2569-04)
    // (แถวที่ไม่มีจำนวนเงินถูกตัดออกตามพฤติกรรม normalize)
    var recs = [
      { month: "2569-04", category: "ค่าอาหารและเครื่องดื่ม - ค่าใช้จ่ายในการประชุม", type: "ค่าใช้จ่าย", group: "แปรผัน", detail: "", amount: 4386, borrower: "" },
      { month: "2569-04", category: "ค่าของไหว้ตามประเพณี", type: "ค่าใช้จ่าย", group: "แปรผัน", detail: "", amount: 25835, borrower: "" },
      { month: "2569-04", category: "ค่าจัดส่งเอกสารและพัสดุ ไปรษณีย์", type: "ค่าใช้จ่าย", group: "แปรผัน", detail: "", amount: 310, borrower: "" },
      { month: "2569-04", category: "ค่าเหยื่อสด-Pest Control", type: "ค่าใช้จ่าย", group: "แปรผัน", detail: "", amount: 200, borrower: "" },
      { month: "2569-04", category: "ค่าบำรุงสมาคมผู้ผลิตอาหารสัตว์ไทย", type: "ค่าใช้จ่าย", group: "แปรผัน", detail: "", amount: 128275, borrower: "" },
      { month: "2569-04", category: "ค่าน้ำบาดาล", type: "ค่าใช้จ่าย", group: "แปรผัน", detail: "", amount: 30548, borrower: "" },
      { month: "2569-04", category: "ค่าใบอนุญาต", type: "ค่าใช้จ่าย", group: "แปรผัน", detail: "", amount: 731, borrower: "" },
      { month: "2569-04", category: "ค่ากิจกรรมชุมชน", type: "ค่าใช้จ่าย", group: "แปรผัน", detail: "", amount: 51106, borrower: "" },
      { month: "2569-04", category: "เงินยืมทดรอง", type: "เงินยืมทดรอง", group: "", detail: "", amount: 104234, borrower: "" },
      { month: "2569-04", category: "น้ำดื่มถังธารตะวัน", type: "ค่าใช้จ่าย", group: "แปรผัน", detail: "", amount: 15947, borrower: "" },
      { month: "2569-04", category: "ค่าบริการ ซัก รีด", type: "ค่าใช้จ่าย", group: "แปรผัน", detail: "", amount: 2325, borrower: "" },
      { month: "2569-04", category: "ค่าเครื่องบิน", type: "ค่าใช้จ่าย", group: "แปรผัน", detail: "", amount: 7200, borrower: "" },
      { month: "2569-04", category: "ค่าอื่นๆ , เงินรางวัล,กิจกรรมชมรม", type: "ค่าใช้จ่าย", group: "แปรผัน", detail: "", amount: 8884, borrower: "" },
      { month: "2569-04", category: "ค่าบริการจราจร และสายตรวจโรงงาน", type: "ค่าใช้จ่าย", group: "คงที่", detail: "", amount: 1500, borrower: "" },
      { month: "2569-04", category: "ค่าบริการจ้างเหมา-งานสวน", type: "ค่าใช้จ่าย", group: "คงที่", detail: "", amount: 60800, borrower: "" },
      { month: "2569-04", category: "งานจ้างเหมากำจัดสิ่งปฏิกูล", type: "ค่าใช้จ่าย", group: "คงที่", detail: "", amount: 24000, borrower: "" },
      { month: "2569-04", category: "ค่าซักผ้าชุดพนักงานาไซโล", type: "ค่าใช้จ่าย", group: "คงที่", detail: "", amount: 24000, borrower: "" },
      { month: "2569-04", category: "ค่าใช้จ่ายสำนักงาน", type: "ค่าใช้จ่าย", group: "แปรผัน", detail: "", amount: 32124, borrower: "" }
    ];
    _cache.oe = { records: recs, source: 'sample', count: recs.length };
    return JSON.parse(JSON.stringify(_cache.oe));
  }

  function sampleWelfare() {
    if (_cache.welfare) return JSON.parse(JSON.stringify(_cache.welfare));
    // ข้อมูลจริง: สวัสดิการ & OT พนักงานสังกัดธุรการ โรงงานธารเกษม
    // ม.ค.–พ.ค. 2569 (มิ.ย.69 ยังไม่กรอกข้อมูล) — OT เป็น "จำนวนชั่วโมง" รวมทุกอัตรา
    var recs = [
      { month: "2569-01", employee: "นางจารุวิจิตร์ ฤทธินาคา", position: "ผู้จัดการฝ่ายธุรการ", wtype: "ค่ารักษาพยาบาล", amount: 2550 },
      { month: "2569-01", employee: "นายธรพล อินทร์รำพันธุ", position: "พนักงานขับรถ", wtype: "เบี้ยเลี้ยง", amount: 1500 },
      { month: "2569-01", employee: "นายธรพล อินทร์รำพันธุ", position: "พนักงานขับรถ", wtype: "สวัสดิการอื่นๆ", amount: 385 },
      { month: "2569-01", employee: "นายธรพล อินทร์รำพันธุ", position: "พนักงานขับรถ", wtype: "OT", amount: 11, note: "ชั่วโมง" },
      { month: "2569-01", employee: "นางสาวลลิตวดี ตรวจนอก", position: "พนักงานรับแจ้งคิว", wtype: "OT", amount: 3, note: "ชั่วโมง" },
      { month: "2569-01", employee: "นางสาวอำไพ คำแดง", position: "คนงานทำความสะอาดรอบนอก", wtype: "OT", amount: 9, note: "ชั่วโมง" },
      { month: "2569-01", employee: "นางสาวอาภัสรา วงษ์น้อย", position: "คนงานทำความสะอาดรอบนอก", wtype: "OT", amount: 2, note: "ชั่วโมง" },
      { month: "2569-01", employee: "นางสาวรพีพรรณ ปั้นสนิท", position: "คนงานทำความสะอาดสำนักงาน", wtype: "OT", amount: 4, note: "ชั่วโมง" },
      { month: "2569-01", employee: "นางสาวสุธิดา บุญส่ง", position: "คนงานทำความสะอาดสำนักงาน", wtype: "OT", amount: 4, note: "ชั่วโมง" },
      { month: "2569-01", employee: "นายสุพจน์ โพธิ์นวล", position: "พนักงานรักษาความปลอดภัย", wtype: "OT", amount: 65, note: "ชั่วโมง" },
      { month: "2569-01", employee: "นายทองล้วน ทองเหลื่อม", position: "พนักงานรักษาความปลอดภัย", wtype: "OT", amount: 52, note: "ชั่วโมง" },
      { month: "2569-01", employee: "นายชวลิต สีแวงนอก", position: "พนักงานรักษาความปลอดภัย", wtype: "OT", amount: 48, note: "ชั่วโมง" },
      { month: "2569-01", employee: "นายนคร ผ่องศรี", position: "พนักงานรักษาความปลอดภัย", wtype: "OT", amount: 53, note: "ชั่วโมง" },
      { month: "2569-01", employee: "นายสามารถ ใหมธรรมจักร", position: "พนักงานรักษาความปลอดภัย", wtype: "OT", amount: 65, note: "ชั่วโมง" },
      { month: "2569-01", employee: "นายยงยุทธ์ ออสถิตย์", position: "พนักงานรักษาความปลอดภัย", wtype: "OT", amount: 20, note: "ชั่วโมง" },
      { month: "2569-01", employee: "นายนพดล วงษ์ตา", position: "พนักงานรักษาความปลอดภัย", wtype: "OT", amount: 50, note: "ชั่วโมง" },
      { month: "2569-01", employee: "นายกริช ภักดี", position: "พนักงานรักษาความปลอดภัย", wtype: "OT", amount: 52, note: "ชั่วโมง" },
      { month: "2569-01", employee: "นายชนุดม จันทร์สีขาว", position: "พนักงานรักษาความปลอดภัย", wtype: "OT", amount: 48, note: "ชั่วโมง" },
      { month: "2569-01", employee: "นายวิษณุ ชัยพร", position: "พนักงานรักษาความปลอดภัย", wtype: "OT", amount: 51, note: "ชั่วโมง" },
      { month: "2569-01", employee: "นายกฤษณะ ใจธรรม", position: "พนักงานรักษาความปลอดภัย", wtype: "OT", amount: 48, note: "ชั่วโมง" },
      { month: "2569-01", employee: "นายธีรวัฒน์ ทองพุ", position: "พนักงานรักษาความปลอดภัย", wtype: "OT", amount: 65, note: "ชั่วโมง" },
      { month: "2569-02", employee: "นางจารุวิจิตร์ ฤทธินาคา", position: "ผู้จัดการฝ่ายธุรการ", wtype: "ค่ารักษาพยาบาล", amount: 3020 },
      { month: "2569-02", employee: "นางสาวจันทร์รัตน์ มงคลทรัพย์", position: "ผู้จัดการแผนกบริการสำนักงาน", wtype: "ค่ารักษาพยาบาล", amount: 415 },
      { month: "2569-02", employee: "นายกันตภณ เศวตพันธ์", position: "พนักงานริการสำนักงาน", wtype: "ค่ารักษาพยาบาล", amount: 470 },
      { month: "2569-02", employee: "นายฉัตรเทพ จ้ายทองอยู่", position: "พนักงานซ่อมบำรุง", wtype: "ค่ารักษาพยาบาล", amount: 550 },
      { month: "2569-02", employee: "นายฉัตรเทพ จ้ายทองอยู่", position: "พนักงานซ่อมบำรุง", wtype: "OT", amount: 7, note: "ชั่วโมง" },
      { month: "2569-02", employee: "นายธรพล อินทร์รำพันธุ", position: "พนักงานขับรถ", wtype: "ค่ารักษาพยาบาล", amount: 515 },
      { month: "2569-02", employee: "นายธรพล อินทร์รำพันธุ", position: "พนักงานขับรถ", wtype: "เบี้ยเลี้ยง", amount: 1800 },
      { month: "2569-02", employee: "นายธรพล อินทร์รำพันธุ", position: "พนักงานขับรถ", wtype: "สวัสดิการอื่นๆ", amount: 845 },
      { month: "2569-02", employee: "นายธรพล อินทร์รำพันธุ", position: "พนักงานขับรถ", wtype: "OT", amount: 12.23, note: "ชั่วโมง" },
      { month: "2569-02", employee: "นางสาวลลิตวดี ตรวจนอก", position: "พนักงานรับแจ้งคิว", wtype: "ค่ารักษาพยาบาล", amount: 460 },
      { month: "2569-02", employee: "นางสาวลลิตวดี ตรวจนอก", position: "พนักงานรับแจ้งคิว", wtype: "OT", amount: 9, note: "ชั่วโมง" },
      { month: "2569-02", employee: "นางสาวอำไพ คำแดง", position: "คนงานทำความสะอาดรอบนอก", wtype: "OT", amount: 5, note: "ชั่วโมง" },
      { month: "2569-02", employee: "นางสาวรพีพรรณ ปั้นสนิท", position: "คนงานทำความสะอาดสำนักงาน", wtype: "OT", amount: 3, note: "ชั่วโมง" },
      { month: "2569-02", employee: "นายสุพจน์ โพธิ์นวล", position: "พนักงานรักษาความปลอดภัย", wtype: "ค่ารักษาพยาบาล", amount: 485 },
      { month: "2569-02", employee: "นายสุพจน์ โพธิ์นวล", position: "พนักงานรักษาความปลอดภัย", wtype: "OT", amount: 48, note: "ชั่วโมง" },
      { month: "2569-02", employee: "นายทองล้วน ทองเหลื่อม", position: "พนักงานรักษาความปลอดภัย", wtype: "ค่ารักษาพยาบาล", amount: 485 },
      { month: "2569-02", employee: "นายทองล้วน ทองเหลื่อม", position: "พนักงานรักษาความปลอดภัย", wtype: "สวัสดิการอื่นๆ", amount: 4800 },
      { month: "2569-02", employee: "นายทองล้วน ทองเหลื่อม", position: "พนักงานรักษาความปลอดภัย", wtype: "OT", amount: 51, note: "ชั่วโมง" },
      { month: "2569-02", employee: "นายชวลิต สีแวงนอก", position: "พนักงานรักษาความปลอดภัย", wtype: "ค่ารักษาพยาบาล", amount: 485 },
      { month: "2569-02", employee: "นายชวลิต สีแวงนอก", position: "พนักงานรักษาความปลอดภัย", wtype: "OT", amount: 48, note: "ชั่วโมง" },
      { month: "2569-02", employee: "นายนคร ผ่องศรี", position: "พนักงานรักษาความปลอดภัย", wtype: "OT", amount: 40, note: "ชั่วโมง" },
      { month: "2569-02", employee: "นายสามารถ ใหมธรรมจักร", position: "พนักงานรักษาความปลอดภัย", wtype: "ค่ารักษาพยาบาล", amount: 415 },
      { month: "2569-02", employee: "นายสามารถ ใหมธรรมจักร", position: "พนักงานรักษาความปลอดภัย", wtype: "OT", amount: 45, note: "ชั่วโมง" },
      { month: "2569-02", employee: "นายยงยุทธ์ ออสถิตย์", position: "พนักงานรักษาความปลอดภัย", wtype: "ค่ารักษาพยาบาล", amount: 415 },
      { month: "2569-02", employee: "นายยงยุทธ์ ออสถิตย์", position: "พนักงานรักษาความปลอดภัย", wtype: "OT", amount: 46.42, note: "ชั่วโมง" },
      { month: "2569-02", employee: "นายนพดล วงษ์ตา", position: "พนักงานรักษาความปลอดภัย", wtype: "ค่ารักษาพยาบาล", amount: 460 },
      { month: "2569-02", employee: "นายนพดล วงษ์ตา", position: "พนักงานรักษาความปลอดภัย", wtype: "OT", amount: 53, note: "ชั่วโมง" },
      { month: "2569-02", employee: "นายกริช ภักดี", position: "พนักงานรักษาความปลอดภัย", wtype: "ค่ารักษาพยาบาล", amount: 460 },
      { month: "2569-02", employee: "นายกริช ภักดี", position: "พนักงานรักษาความปลอดภัย", wtype: "OT", amount: 33, note: "ชั่วโมง" },
      { month: "2569-02", employee: "นายชนุดม จันทร์สีขาว", position: "พนักงานรักษาความปลอดภัย", wtype: "ค่ารักษาพยาบาล", amount: 460 },
      { month: "2569-02", employee: "นายชนุดม จันทร์สีขาว", position: "พนักงานรักษาความปลอดภัย", wtype: "OT", amount: 53, note: "ชั่วโมง" },
      { month: "2569-02", employee: "นายวิษณุ ชัยพร", position: "พนักงานรักษาความปลอดภัย", wtype: "ค่ารักษาพยาบาล", amount: 460 },
      { month: "2569-02", employee: "นายวิษณุ ชัยพร", position: "พนักงานรักษาความปลอดภัย", wtype: "OT", amount: 48, note: "ชั่วโมง" },
      { month: "2569-02", employee: "นายกฤษณะ ใจธรรม", position: "พนักงานรักษาความปลอดภัย", wtype: "ค่ารักษาพยาบาล", amount: 460 },
      { month: "2569-02", employee: "นายกฤษณะ ใจธรรม", position: "พนักงานรักษาความปลอดภัย", wtype: "OT", amount: 50, note: "ชั่วโมง" },
      { month: "2569-02", employee: "นายธีรวัฒน์ ทองพุ", position: "พนักงานรักษาความปลอดภัย", wtype: "ค่ารักษาพยาบาล", amount: 460 },
      { month: "2569-02", employee: "นายธีรวัฒน์ ทองพุ", position: "พนักงานรักษาความปลอดภัย", wtype: "OT", amount: 56, note: "ชั่วโมง" },
      { month: "2569-03", employee: "นางจารุวิจิตร์ ฤทธินาคา", position: "ผู้จัดการฝ่ายธุรการ", wtype: "ค่ารักษาพยาบาล", amount: 2550 },
      { month: "2569-03", employee: "นางสาวจันทร์รัตน์ มงคลทรัพย์", position: "ผู้จัดการแผนกบริการสำนักงาน", wtype: "ค่ารักษาพยาบาล", amount: 4825 },
      { month: "2569-03", employee: "นางสาวจันทร์รัตน์ มงคลทรัพย์", position: "ผู้จัดการแผนกบริการสำนักงาน", wtype: "เบี้ยเลี้ยง", amount: 300 },
      { month: "2569-03", employee: "นายกันตภณ เศวตพันธ์", position: "พนักงานริการสำนักงาน", wtype: "เบี้ยเลี้ยง", amount: 300 },
      { month: "2569-03", employee: "นายกันตภณ เศวตพันธ์", position: "พนักงานริการสำนักงาน", wtype: "OT", amount: 3.5, note: "ชั่วโมง" },
      { month: "2569-03", employee: "นายฉัตรเทพ จ้ายทองอยู่", position: "พนักงานซ่อมบำรุง", wtype: "OT", amount: 15, note: "ชั่วโมง" },
      { month: "2569-03", employee: "นายธรพล อินทร์รำพันธุ", position: "พนักงานขับรถ", wtype: "เบี้ยเลี้ยง", amount: 1800 },
      { month: "2569-03", employee: "นายธรพล อินทร์รำพันธุ", position: "พนักงานขับรถ", wtype: "สวัสดิการอื่นๆ", amount: 1415 },
      { month: "2569-03", employee: "นายธรพล อินทร์รำพันธุ", position: "พนักงานขับรถ", wtype: "OT", amount: 14, note: "ชั่วโมง" },
      { month: "2569-03", employee: "นางสาวลลิตวดี ตรวจนอก", position: "พนักงานรับแจ้งคิว", wtype: "OT", amount: 9, note: "ชั่วโมง" },
      { month: "2569-03", employee: "นางสาวอำไพ คำแดง", position: "คนงานทำความสะอาดรอบนอก", wtype: "OT", amount: 13, note: "ชั่วโมง" },
      { month: "2569-03", employee: "นางสาวอาภัสรา วงษ์น้อย", position: "คนงานทำความสะอาดรอบนอก", wtype: "OT", amount: 3, note: "ชั่วโมง" },
      { month: "2569-03", employee: "นางสาวรพีพรรณ ปั้นสนิท", position: "คนงานทำความสะอาดสำนักงาน", wtype: "OT", amount: 14, note: "ชั่วโมง" },
      { month: "2569-03", employee: "นางสาวสุธิดา บุญส่ง", position: "คนงานทำความสะอาดสำนักงาน", wtype: "OT", amount: 9, note: "ชั่วโมง" },
      { month: "2569-03", employee: "นายสุพจน์ โพธิ์นวล", position: "พนักงานรักษาความปลอดภัย", wtype: "OT", amount: 59, note: "ชั่วโมง" },
      { month: "2569-03", employee: "นายทองล้วน ทองเหลื่อม", position: "พนักงานรักษาความปลอดภัย", wtype: "OT", amount: 62, note: "ชั่วโมง" },
      { month: "2569-03", employee: "นายชวลิต สีแวงนอก", position: "พนักงานรักษาความปลอดภัย", wtype: "OT", amount: 62, note: "ชั่วโมง" },
      { month: "2569-03", employee: "นายนคร ผ่องศรี", position: "พนักงานรักษาความปลอดภัย", wtype: "OT", amount: 59, note: "ชั่วโมง" },
      { month: "2569-03", employee: "นายสามารถ ใหมธรรมจักร", position: "พนักงานรักษาความปลอดภัย", wtype: "OT", amount: 50, note: "ชั่วโมง" },
      { month: "2569-03", employee: "นายยงยุทธ์ ออสถิตย์", position: "พนักงานรักษาความปลอดภัย", wtype: "ค่ารักษาพยาบาล", amount: 2068 },
      { month: "2569-03", employee: "นายยงยุทธ์ ออสถิตย์", position: "พนักงานรักษาความปลอดภัย", wtype: "OT", amount: 56, note: "ชั่วโมง" },
      { month: "2569-03", employee: "นายนพดล วงษ์ตา", position: "พนักงานรักษาความปลอดภัย", wtype: "OT", amount: 62, note: "ชั่วโมง" },
      { month: "2569-03", employee: "นายกริช ภักดี", position: "พนักงานรักษาความปลอดภัย", wtype: "OT", amount: 44, note: "ชั่วโมง" },
      { month: "2569-03", employee: "นายชนุดม จันทร์สีขาว", position: "พนักงานรักษาความปลอดภัย", wtype: "OT", amount: 64, note: "ชั่วโมง" },
      { month: "2569-03", employee: "นายวิษณุ ชัยพร", position: "พนักงานรักษาความปลอดภัย", wtype: "OT", amount: 54, note: "ชั่วโมง" },
      { month: "2569-03", employee: "นายกฤษณะ ใจธรรม", position: "พนักงานรักษาความปลอดภัย", wtype: "OT", amount: 56, note: "ชั่วโมง" },
      { month: "2569-03", employee: "นายธีรวัฒน์ ทองพุ", position: "พนักงานรักษาความปลอดภัย", wtype: "ค่ารักษาพยาบาล", amount: 14259.5 },
      { month: "2569-03", employee: "นายธีรวัฒน์ ทองพุ", position: "พนักงานรักษาความปลอดภัย", wtype: "OT", amount: 45, note: "ชั่วโมง" },
      { month: "2569-04", employee: "นางจารุวิจิตร์ ฤทธินาคา", position: "ผู้จัดการฝ่ายธุรการ", wtype: "ค่ารักษาพยาบาล", amount: 2550 },
      { month: "2569-04", employee: "นางสาวจันทร์รัตน์ มงคลทรัพย์", position: "ผู้จัดการแผนกบริการสำนักงาน", wtype: "ค่าน้ำมัน", amount: 688 },
      { month: "2569-04", employee: "นายกันตภณ เศวตพันธ์", position: "พนักงานริการสำนักงาน", wtype: "OT", amount: 4.5, note: "ชั่วโมง" },
      { month: "2569-04", employee: "นายฉัตรเทพ จ้ายทองอยู่", position: "พนักงานซ่อมบำรุง", wtype: "OT", amount: 5.5, note: "ชั่วโมง" },
      { month: "2569-04", employee: "นายธรพล อินทร์รำพันธุ", position: "พนักงานขับรถ", wtype: "เบี้ยเลี้ยง", amount: 2400 },
      { month: "2569-04", employee: "นายธรพล อินทร์รำพันธุ", position: "พนักงานขับรถ", wtype: "สวัสดิการอื่นๆ", amount: 1515 },
      { month: "2569-04", employee: "นายธรพล อินทร์รำพันธุ", position: "พนักงานขับรถ", wtype: "OT", amount: 17.5, note: "ชั่วโมง" },
      { month: "2569-04", employee: "นางสาวลลิตวดี ตรวจนอก", position: "พนักงานรับแจ้งคิว", wtype: "OT", amount: 15, note: "ชั่วโมง" },
      { month: "2569-04", employee: "นางสาวอำไพ คำแดง", position: "คนงานทำความสะอาดรอบนอก", wtype: "OT", amount: 7.5, note: "ชั่วโมง" },
      { month: "2569-04", employee: "นางสาวอาภัสรา วงษ์น้อย", position: "คนงานทำความสะอาดรอบนอก", wtype: "OT", amount: 5.5, note: "ชั่วโมง" },
      { month: "2569-04", employee: "นางสาวรพีพรรณ ปั้นสนิท", position: "คนงานทำความสะอาดสำนักงาน", wtype: "OT", amount: 10.5, note: "ชั่วโมง" },
      { month: "2569-04", employee: "นางสาวสุธิดา บุญส่ง", position: "คนงานทำความสะอาดสำนักงาน", wtype: "OT", amount: 3, note: "ชั่วโมง" },
      { month: "2569-04", employee: "นายสุพจน์ โพธิ์นวล", position: "พนักงานรักษาความปลอดภัย", wtype: "OT", amount: 75, note: "ชั่วโมง" },
      { month: "2569-04", employee: "นายทองล้วน ทองเหลื่อม", position: "พนักงานรักษาความปลอดภัย", wtype: "OT", amount: 69, note: "ชั่วโมง" },
      { month: "2569-04", employee: "นายชวลิต สีแวงนอก", position: "พนักงานรักษาความปลอดภัย", wtype: "OT", amount: 68, note: "ชั่วโมง" },
      { month: "2569-04", employee: "นายนคร ผ่องศรี", position: "พนักงานรักษาความปลอดภัย", wtype: "OT", amount: 31, note: "ชั่วโมง" },
      { month: "2569-04", employee: "นายสามารถ ใหมธรรมจักร", position: "พนักงานรักษาความปลอดภัย", wtype: "OT", amount: 67, note: "ชั่วโมง" },
      { month: "2569-04", employee: "นายยงยุทธ์ ออสถิตย์", position: "พนักงานรักษาความปลอดภัย", wtype: "OT", amount: 69, note: "ชั่วโมง" },
      { month: "2569-04", employee: "นายนพดล วงษ์ตา", position: "พนักงานรักษาความปลอดภัย", wtype: "OT", amount: 61, note: "ชั่วโมง" },
      { month: "2569-04", employee: "นายกริช ภักดี", position: "พนักงานรักษาความปลอดภัย", wtype: "ค่ารักษาพยาบาล", amount: 1720 },
      { month: "2569-04", employee: "นายกริช ภักดี", position: "พนักงานรักษาความปลอดภัย", wtype: "OT", amount: 72, note: "ชั่วโมง" },
      { month: "2569-04", employee: "นายชนุดม จันทร์สีขาว", position: "พนักงานรักษาความปลอดภัย", wtype: "OT", amount: 64, note: "ชั่วโมง" },
      { month: "2569-04", employee: "นายวิษณุ ชัยพร", position: "พนักงานรักษาความปลอดภัย", wtype: "OT", amount: 55, note: "ชั่วโมง" },
      { month: "2569-04", employee: "นายกฤษณะ ใจธรรม", position: "พนักงานรักษาความปลอดภัย", wtype: "OT", amount: 56, note: "ชั่วโมง" },
      { month: "2569-04", employee: "นายธีรวัฒน์ ทองพุ", position: "พนักงานรักษาความปลอดภัย", wtype: "OT", amount: 47, note: "ชั่วโมง" },
      { month: "2569-05", employee: "นางจารุวิจิตร์ ฤทธินาคา", position: "ผู้จัดการฝ่ายธุรการ", wtype: "ค่ารักษาพยาบาล", amount: 2550 },
      { month: "2569-05", employee: "นางจารุวิจิตร์ ฤทธินาคา", position: "ผู้จัดการฝ่ายธุรการ", wtype: "เบี้ยเลี้ยง", amount: 600 },
      { month: "2569-05", employee: "นางจารุวิจิตร์ ฤทธินาคา", position: "ผู้จัดการฝ่ายธุรการ", wtype: "ค่าที่พัก", amount: 696 },
      { month: "2569-05", employee: "นางสาวจันทร์รัตน์ มงคลทรัพย์", position: "ผู้จัดการแผนกบริการสำนักงาน", wtype: "ค่ารักษาพยาบาล", amount: 3600 },
      { month: "2569-05", employee: "นายฉัตรเทพ จ้ายทองอยู่", position: "พนักงานซ่อมบำรุง", wtype: "OT", amount: 11.5, note: "ชั่วโมง" },
      { month: "2569-05", employee: "นายธรพล อินทร์รำพันธุ", position: "พนักงานขับรถ", wtype: "ค่ารักษาพยาบาล", amount: 3575 },
      { month: "2569-05", employee: "นายธรพล อินทร์รำพันธุ", position: "พนักงานขับรถ", wtype: "เบี้ยเลี้ยง", amount: 600 },
      { month: "2569-05", employee: "นายธรพล อินทร์รำพันธุ", position: "พนักงานขับรถ", wtype: "OT", amount: 25, note: "ชั่วโมง" },
      { month: "2569-05", employee: "นางสาวลลิตวดี ตรวจนอก", position: "พนักงานรับแจ้งคิว", wtype: "OT", amount: 9, note: "ชั่วโมง" },
      { month: "2569-05", employee: "นางสาวอำไพ คำแดง", position: "คนงานทำความสะอาดรอบนอก", wtype: "OT", amount: 9.5, note: "ชั่วโมง" },
      { month: "2569-05", employee: "นางสาวรพีพรรณ ปั้นสนิท", position: "คนงานทำความสะอาดสำนักงาน", wtype: "OT", amount: 4, note: "ชั่วโมง" },
      { month: "2569-05", employee: "นายสุพจน์ โพธิ์นวล", position: "พนักงานรักษาความปลอดภัย", wtype: "OT", amount: 73, note: "ชั่วโมง" },
      { month: "2569-05", employee: "นายทองล้วน ทองเหลื่อม", position: "พนักงานรักษาความปลอดภัย", wtype: "OT", amount: 67, note: "ชั่วโมง" },
      { month: "2569-05", employee: "นายยงยุทธ์ ออสถิตย์", position: "พนักงานรักษาความปลอดภัย", wtype: "OT", amount: 50, note: "ชั่วโมง" },
      { month: "2569-05", employee: "นายนพดล วงษ์ตา", position: "พนักงานรักษาความปลอดภัย", wtype: "OT", amount: 61, note: "ชั่วโมง" },
      { month: "2569-05", employee: "นายกริช ภักดี", position: "พนักงานรักษาความปลอดภัย", wtype: "OT", amount: 55, note: "ชั่วโมง" }
    ];
    _cache.welfare = { records: recs, source: 'sample', count: recs.length };
    return JSON.parse(JSON.stringify(_cache.welfare));
  }

  function sample(kind) { return kind === 'welfare' ? sampleWelfare() : sampleOE(); }

  global.DataSource = {
    SCHEMA: SCHEMA,
    config: { get: cfgGet, set: cfgSet, clear: cfgClear },
    local: { get: localGet, set: localSet, clear: localClear, has: localHas },
    extractSheetId: extractSheetId,
    buildCsvUrl: buildCsvUrl,
    parseCSV: parseCSV,
    normalize: normalize,
    normalizeAny: normalizeAny,
    fromSheets: fromSheets,
    fromSheetsCached: fromSheetsCached,
    fromExcel: fromExcel,
    loadAuto: loadAuto,
    sample: sample
  };
})(window);
