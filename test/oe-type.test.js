/* ============================================================
   oe-type.test.js — ทดสอบการแปลงคอลัมน์ "ประเภท" ของ OE ให้เป็นค่ามาตรฐาน
   รัน: node --test    (ใช้ node:test ในตัว ไม่ต้องลง dependency)
   เหตุ: ชีตจริงพิมพ์มือ จึงมีตัวสะกดปนกัน (ทดรอง↔ทดลอง, ยืม↔เยืม)
         ก่อนแก้ แถว "คืนเงินยืมทดลอง" ไม่ตรงกับทั้ง ค่าใช้จ่าย/เงินยืมทดรอง
         → ถูกทิ้งเงียบ ๆ ทุก KPI/กราฟ/ตาราง
   ============================================================ */
'use strict';
const test = require('node:test');
const assert = require('node:assert');

global.window = global;
require('../assets/utils.js');
require('../assets/data.js');
const DS = global.DataSource;
const T = DS.OE_TYPE;

test('canonOEType: รวมทุกตัวสะกดของ "คืนเงินยืมทดรอง" ให้เป็นค่าเดียว', () => {
  ['คืนเงินยืมทดรอง', 'คืนเงินยืมทดลอง', 'คืนเงินเยืมทดรอง', 'คืนเงินเยืมทดลอง', ' คืนเงินยืมทดลอง ']
    .forEach(s => assert.strictEqual(DS.canonOEType(s), T.RETURN, s));
});

test('canonOEType: "เงินยืมทดรอง" ไม่ถูกจับเป็นการคืน', () => {
  ['เงินยืมทดรอง', 'เงินยืมทดลอง', 'เงินเยืมทดรอง'].forEach(s =>
    assert.strictEqual(DS.canonOEType(s), T.ADVANCE, s));
});

test('canonOEType: ค่าใช้จ่ายและค่าว่างไม่ถูกแตะ', () => {
  assert.strictEqual(DS.canonOEType('ค่าใช้จ่าย'), T.EXPENSE);
  assert.strictEqual(DS.canonOEType(''), '');
  assert.strictEqual(DS.canonOEType(null), '');
});

test('normalize: แถวคืนเงินยืมในชีตจริง (สะกด "ทดลอง") ต้องไม่หาย', () => {
  const rows = [
    ['เดือน', 'หมวดหมู่', 'ประเภท', 'กลุ่ม', 'รายละเอียด', 'จำนวนเงิน', 'ผู้ยืม'],
    ['2569-01', 'เงินยืมทดรอง', 'เงินยืมทดรอง', '', 'ยืมเงินกิจกรรม', '30,000', 'ผู้ยืม ก'],
    ['2569-02', 'คืนเงินเยืมทดรอง', 'คืนเงินยืมทดลอง', '', 'ยืมเงินกิจกรรม', '30,000.00', 'ผู้ยืม ก'],
    ['2569-02', 'ค่าน้ำบาดาล', 'ค่าใช้จ่าย', 'แปรผัน', '', '31523.1', ''],
  ];
  const recs = DS.normalizeAny('oe', rows);
  assert.strictEqual(recs.length, 3);
  assert.deepStrictEqual(recs.map(r => r.type), [T.ADVANCE, T.RETURN, T.EXPENSE]);
  // ยอดคงค้างของผู้ยืม ก = ยืม 30,000 − คืน 30,000 = 0
  const loan = recs.filter(r => r.type === T.ADVANCE).reduce((s, r) => s + r.amount, 0);
  const back = recs.filter(r => r.type === T.RETURN).reduce((s, r) => s + r.amount, 0);
  assert.strictEqual(loan - back, 0);
});

test('demo OE: มีรายการคืนเงินยืม และคงค้างคำนวณได้', () => {
  const recs = DS.sample('oe').records;
  const ret = recs.filter(r => r.type === T.RETURN);
  assert.ok(ret.length > 0, 'demo ต้องมีรายการคืนเงินยืมให้เห็นฟีเจอร์');
  const loan = recs.filter(r => r.type === T.ADVANCE).reduce((s, r) => s + r.amount, 0);
  const back = ret.reduce((s, r) => s + r.amount, 0);
  assert.ok(back > 0 && back < loan, 'ยอดคืนต้องมากกว่า 0 และไม่เกินยอดยืม');
  // ทุกแถวคืนต้องระบุผู้ยืม (ไม่งั้นจับคู่คงค้างรายคนไม่ได้)
  assert.ok(ret.every(r => r.borrower), 'แถวคืนเงินยืมใน demo ต้องมีชื่อผู้ยืม');
});
