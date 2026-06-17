/* ============================================================
   parse.test.js — ทดสอบ parser (normalizeAny) แบบไม่ต้องเปิดเบราว์เซอร์
   รัน: node --test    (ใช้ node:test ในตัว ไม่ต้องลง dependency)
   โหลด utils.js + data.js จริง โดย shim `window` = global
   ============================================================ */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

// utils.js / data.js เขียนแบบ (function(global){...})(window) — ทำให้ window = global
global.window = global;
require('../assets/utils.js');
require('../assets/data.js');
const DS = global.DataSource;

function loadCsv(name) {
  const text = fs.readFileSync(path.join(__dirname, '..', 'sample-data', name), 'utf8');
  return DS.parseCSV(text);
}

test('OE: แปลง RAW_DATA ตัวอย่างเป็น records ตามลำดับคอลัมน์', () => {
  const recs = DS.normalizeAny('oe', loadCsv('OE_RAW_DATA.csv'));
  assert.ok(recs.length > 0, 'ต้องมี records');
  const first = recs[0];
  assert.strictEqual(first.month, '2569-01');
  assert.strictEqual(first.category, 'ค่าจ้างเหมา');
  assert.strictEqual(first.type, 'ค่าใช้จ่าย');
  assert.strictEqual(first.group, 'แปรผัน');
  assert.strictEqual(first.amount, 92500);
  // ทุก record ต้องมียอด > 0 (แถวยอด 0 ถูกตัด)
  assert.ok(recs.every(r => r.amount > 0));
});

test('Welfare: แปลงฟอร์ม long ตัวอย่างได้ถูกต้อง', () => {
  const recs = DS.normalizeAny('welfare', loadCsv('welfare_RAW_DATA.csv'));
  assert.ok(recs.length > 0);
  const first = recs[0];
  assert.strictEqual(first.month, '2569-01');
  assert.strictEqual(first.employee, 'นายสมชาย ทองดี');
  assert.strictEqual(first.position, 'ผู้จัดการ');
  assert.strictEqual(first.wtype, 'เบี้ยเลี้ยง');
  assert.strictEqual(first.amount, 3600);
});

test('normalize: ข้ามแถวหัวตาราง / pad เลขเดือน 1 หลัก -> 2 หลัก / ตัดยอด <= 0', () => {
  const rows = [
    ['เดือน', 'หมวดหมู่', 'ประเภท', 'กลุ่ม', 'รายละเอียด', 'จำนวนเงิน', 'ผู้ยืม'], // หัว -> ข้าม
    ['2569-3', 'ค่าไฟฟ้า', 'ค่าใช้จ่าย', 'แปรผัน', '', '1,200 บาท', ''],          // เดือน 1 หลัก + เงินมี comma/บาท
    ['2569-04', 'ค่าศูนย์', 'ค่าใช้จ่าย', 'คงที่', '', '0', ''],                  // ยอด 0 -> ตัด
  ];
  const recs = DS.normalizeAny('oe', rows);
  assert.strictEqual(recs.length, 1);
  assert.strictEqual(recs[0].month, '2569-03', 'เลขเดือนต้อง pad เป็น 2 หลัก');
  assert.strictEqual(recs[0].amount, 1200, 'parseNumber ต้องลบ comma/บาท');
});

test('parseCSV: รองรับ field ที่มี comma อยู่ใน quote', () => {
  const rows = DS.parseCSV('a,"x,y",c\n');
  assert.deepStrictEqual(rows[0], ['a', 'x,y', 'c']);
});
