/* เทสต์ประตูรหัสผ่าน (assets/auth.js) — รันด้วย `node --test` ที่รากโปรเจกต์
   auth.js ไม่พึ่ง DOM/crypto.subtle จึง require ตรง ๆ ใน node ได้เลย

   ⚠️ ห้ามใส่รหัสผ่านตัวจริงในไฟล์นี้ — repo เป็น Public การ commit รหัสลงมาเท่ากับ
   ยกเลิกประโยชน์ของ hash ทั้งหมด · อยากตรวจว่ารหัสที่ใช้อยู่ตรงกับ CONFIG จริงไหม
   ให้ส่งผ่าน env ตอนรัน:  CPF_PASSCODE='รหัส' node --test                       */
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const Auth = require('../assets/auth.js');
const SRC = fs.readFileSync(path.join(__dirname, '../assets/auth.js'), 'utf8');

test('SHA-256 ที่เขียนเองให้ผลตรงกับ crypto ของ node', () => {
  for (const s of ['', 'abc', 'CPF ธารเกษม 2569', 'a'.repeat(1000), '😀 ไทย+emoji']) {
    assert.strictEqual(Auth.sha256Hex(s), crypto.createHash('sha256').update(s, 'utf8').digest('hex'), s.slice(0, 20));
  }
});

test('รหัสผ่านที่เดาง่าย/ค่าที่ไม่ใช่สตริง ไม่ผ่าน', () => {
  for (const wrong of ['', 'admin', '1234', 'password', 'cpf', 'CPF2569', null, undefined, 0, false, {}]) {
    assert.strictEqual(Auth.verify(wrong), false, JSON.stringify(wrong));
  }
});

test('CONFIG เก็บแค่ hash — ไม่มีรหัสผ่านอยู่ในไฟล์', () => {
  assert.match(Auth._config.hash, /^[a-f0-9]{64}$/);
  assert.match(Auth._config.salt, /^[A-Za-z0-9]{12,}$/);
  assert.ok(Auth._config.iter >= 100000, 'จำนวนรอบต้องมากพอให้การไล่เดารหัสช้า');
  // กันพลาดซ้ำรอย: อย่าให้มีคำว่า pass/รหัส แบบเก็บค่าจริงหลุดเข้ามาใน CONFIG
  assert.doesNotMatch(SRC, /CONFIG\s*=\s*\{[^}]*\b(pass|passcode|password)\s*:/i);
});

test('session token ต้องไม่ใช่ค่าที่เผยแพร่อยู่ในไฟล์ (กันปลอม token)', () => {
  /* เคยพลาด: เก็บ CONFIG.hash เป็น token ตรง ๆ → ใครเปิด assets/auth.js ก็คัดลอกไปยัด
     localStorage แล้วเข้าได้โดยไม่รู้รหัส · ตอนนี้ token = ค่า stretch ที่ไม่ได้อยู่ในไฟล์
     ทดสอบโดยเช็คว่า hash ที่เผยแพร่ ใช้เป็น token ไม่ผ่านการตรวจ */
  const published = Auth._config.hash;
  assert.strictEqual(Auth.sha256Hex('cpf-verify|' + published) === published, false,
    'hash ในไฟล์ต้องใช้เป็น token ไม่ได้');
});

test('makeConfig: salt สุ่มใหม่ทุกครั้ง และ hash ที่ได้ตรวจรหัสเดิมได้', () => {
  const pass = 'รหัสทดสอบ-๑๒๓-abc';
  const a = Auth.makeConfig(pass, 500);
  const b = Auth.makeConfig(pass, 500);
  assert.notStrictEqual(a.salt, b.salt, 'salt ต้องสุ่มใหม่');
  assert.notStrictEqual(a.hash, b.hash, 'salt ต่างกัน hash ต้องต่างกัน');
  assert.match(a.hash, /^[a-f0-9]{64}$/);
});

test('รหัสจริง (ใส่ผ่าน env CPF_PASSCODE เท่านั้น) ตรงกับ CONFIG', { skip: !process.env.CPF_PASSCODE }, () => {
  assert.strictEqual(Auth.verify(process.env.CPF_PASSCODE), true);
  assert.strictEqual(Auth.verify(process.env.CPF_PASSCODE + 'x'), false);
});
