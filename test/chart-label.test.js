/* ============================================================
   chart-label.test.js — ทดสอบตัวเลขบนยอดแท่งกราฟ (App.barValueLabel)
   รัน: node --test    (ใช้ node:test ในตัว ไม่ต้องลง dependency)
   กันบั๊กเดิม: กราฟ OT ปัดชั่วโมงเป็นจำนวนเต็ม (607.65 -> 608) และย่อเป็น K
   ============================================================ */
'use strict';
const test = require('node:test');
const assert = require('node:assert');

global.window = global;
global.document = { createElement: () => ({}) };
require('../assets/utils.js');
require('../assets/app.js');

/** เรียก plugin กับ chart จำลอง แล้วคืน array ข้อความที่วาดลง canvas */
function labelsFor(hours, data) {
  const out = [];
  const ctx = {
    save() {}, restore() {}, fillText(t) { out.push(t); },
    set fillStyle(v) {}, set font(v) {}, set textAlign(v) {}, set textBaseline(v) {}
  };
  global.App.barValueLabel.afterDatasetsDraw({
    ctx,
    options: { plugins: { barValueLabel: { hours } } },
    data: { datasets: [{ data }] },
    getDatasetMeta: () => ({ data: data.map(() => ({ x: 0, y: 0 })) })
  });
  return out;
}

test('กราฟชั่วโมง (OT): คงทศนิยม ไม่ปัดเป็นจำนวนเต็ม ไม่ย่อเป็น K', () => {
  assert.deepStrictEqual(labelsFor(true, [650, 607.65, 1250.5]), ['650', '607.65', '1,250.5']);
});

test('กราฟเงิน: ย่อ K/M และปัดเป็นจำนวนเต็มเหมือนเดิม', () => {
  assert.deepStrictEqual(labelsFor(false, [650, 607.65, 1250500]), ['650', '608', '1.25M']);
});

test('ไม่ระบุ hours = โหมดเงิน (ค่า default เดิม)', () => {
  const out = [];
  const ctx = {
    save() {}, restore() {}, fillText(t) { out.push(t); },
    set fillStyle(v) {}, set font(v) {}, set textAlign(v) {}, set textBaseline(v) {}
  };
  global.App.barValueLabel.afterDatasetsDraw({
    ctx, options: {}, data: { datasets: [{ data: [1234] }] },
    getDatasetMeta: () => ({ data: [{ x: 0, y: 0 }] })
  });
  assert.deepStrictEqual(out, ['1.2K']);
});
