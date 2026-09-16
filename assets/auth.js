/* auth.js — ประตูรหัสผ่านหน้าเว็บ (เว็บ static ไม่มีเซิร์ฟเวอร์)
   ────────────────────────────────────────────────────────────
   ขอบเขตที่กันได้จริง: กันคนที่บังเอิญเจอลิงก์ / เครื่องที่ใช้ร่วมกันในออฟฟิศ
   ไม่ได้กัน: คนที่เปิดซอร์สโค้ดดูแล้วตั้งใจแกะรหัสแบบ offline (เว็บ static ทำได้เท่านี้)
   ตัวข้อมูลจริงไม่ได้อยู่ในเว็บ — อยู่ในชีต/เครื่องผู้ใช้ ประตูนี้กันคนเปิด "หน้าจอ" เท่านั้น

   ใช้ SHA-256 เขียนเองล้วน ๆ (ไม่พึ่ง crypto.subtle) เพราะ crypto.subtle ใช้ไม่ได้
   ตอนเปิดไฟล์แบบ file:// (ไม่ใช่ secure context) ซึ่งเป็นวิธีเปิดเว็บที่โปรเจกต์นี้รองรับ

   เปลี่ยนรหัสผ่าน: เปิดหน้าไหนก็ได้ของเว็บ → คอนโซล → Auth.makeConfig('รหัสใหม่')
   แล้วเอาบรรทัดที่ได้ไปวางแทน CONFIG ด้านล่าง (commit ขึ้น repo — เก็บเฉพาะ hash ไม่ใช่รหัส)
   ============================================================ */
var Auth = (function () {
  'use strict';

  /* hash ของรหัสผ่าน (ไม่ใช่ตัวรหัส) — สร้างด้วย Auth.makeConfig() */
  var CONFIG = {
    salt: 'qEQxGYK6S2xEQlym',
    iter: 120000,
    hash: '47b489aaa8d7793db8aedca6c4aca5367f2a77fee8f93733c12a7ab8ac0e8822'
  };

  var SESSION_KEY = 'cpf_auth';
  var SESSION_HOURS = 8;          // ครบ 8 ชม. (หนึ่งวันทำงาน) ต้องใส่รหัสใหม่
  var LOGIN_PAGE = 'login.html';

  /* ── SHA-256 (pure JS) ─────────────────────────────────────
     คืนค่าเป็น hex string · ใช้กับสตริงสั้น ๆ เท่านั้น (รหัสผ่าน+salt) */
  var K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  function utf8Bytes(str) {
    var out = [], i, c;
    for (i = 0; i < str.length; i++) {
      c = str.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
      else if (c < 0xd800 || c >= 0xe000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      else { // surrogate pair
        c = 0x10000 + (((c & 0x3ff) << 10) | (str.charCodeAt(++i) & 0x3ff));
        out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      }
    }
    return out;
  }

  function sha256Bytes(bytes) {
    var h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    var len = bytes.length, bitLen = len * 8;
    var padded = bytes.slice();
    padded.push(0x80);
    while (padded.length % 64 !== 56) padded.push(0);
    padded.push(0, 0, 0, 0,
      (bitLen >>> 24) & 255, (bitLen >>> 16) & 255, (bitLen >>> 8) & 255, bitLen & 255);

    var w = new Array(64), i, j, a, b, c, d, e, f, g, hh, s0, s1, ch, maj, t1, t2;
    for (i = 0; i < padded.length; i += 64) {
      for (j = 0; j < 16; j++) {
        w[j] = (padded[i + j * 4] << 24) | (padded[i + j * 4 + 1] << 16) |
               (padded[i + j * 4 + 2] << 8) | padded[i + j * 4 + 3];
      }
      for (j = 16; j < 64; j++) {
        s0 = rotr(w[j - 15], 7) ^ rotr(w[j - 15], 18) ^ (w[j - 15] >>> 3);
        s1 = rotr(w[j - 2], 17) ^ rotr(w[j - 2], 19) ^ (w[j - 2] >>> 10);
        w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
      }
      a = h[0]; b = h[1]; c = h[2]; d = h[3]; e = h[4]; f = h[5]; g = h[6]; hh = h[7];
      for (j = 0; j < 64; j++) {
        s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        ch = (e & f) ^ (~e & g);
        t1 = (hh + s1 + ch + K[j] + w[j]) | 0;
        s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        maj = (a & b) ^ (a & c) ^ (b & c);
        t2 = (s0 + maj) | 0;
        hh = g; g = f; f = e; e = (d + t1) | 0;
        d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0; h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0;
      h[4] = (h[4] + e) | 0; h[5] = (h[5] + f) | 0; h[6] = (h[6] + g) | 0; h[7] = (h[7] + hh) | 0;
    }
    var out = [];
    for (i = 0; i < 8; i++) {
      out.push((h[i] >>> 24) & 255, (h[i] >>> 16) & 255, (h[i] >>> 8) & 255, h[i] & 255);
    }
    return out;
  }

  function rotr(x, n) { return (x >>> n) | (x << (32 - n)); }

  function toHex(bytes) {
    var s = '', i;
    for (i = 0; i < bytes.length; i++) s += (bytes[i] >>> 4).toString(16) + (bytes[i] & 15).toString(16);
    return s;
  }

  function sha256Hex(str) { return toHex(sha256Bytes(utf8Bytes(str))); }

  /* หมุน SHA-256 ซ้ำหลายรอบ (key stretching อย่างง่าย) — ทำให้เดารหัสแบบไล่ทีละคำช้าลงมาก
     รอบแรกผูก salt ไว้ด้วย รอบต่อ ๆ ไปวนบน byte เดิม ไม่ต้องแปลง hex กลับไปมา */
  function stretch(pass, salt, iter) {
    var bytes = sha256Bytes(utf8Bytes(salt + '|' + pass)), i;
    for (i = 1; i < iter; i++) bytes = sha256Bytes(bytes);
    return toHex(bytes);
  }

  /* ── session ───────────────────────────────────────────────
     token ที่เก็บ = ค่า stretch ของรหัสผ่าน (`full`) ซึ่ง **ไม่ได้อยู่ในไฟล์**
     ไฟล์เก็บแค่ CONFIG.hash = sha256('cpf-verify|' + full) ไว้ตรวจว่า token ถูกต้อง
     → ใครอ่าน auth.js (ไฟล์เสิร์ฟให้ทุกคน) ก็ปลอม token ไม่ได้ ต้องย้อน SHA-256 กลับ
       (ก่อนหน้านี้เก็บ CONFIG.hash เป็น token ตรง ๆ = คัดลอกจากไฟล์แล้วเข้าได้เลย)
     เปลี่ยนรหัสใหม่เมื่อไหร่ session เก่าหลุดทันที เพราะ full เปลี่ยน */
  function tokenOk(tok) {
    return typeof tok === 'string' && tok.length === 64 && sha256Hex('cpf-verify|' + tok) === CONFIG.hash;
  }

  function readSession() {
    try {
      var raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function isLoggedIn() {
    var s = readSession();
    return !!(s && s.exp > Date.now() && tokenOk(s.t));
  }

  function startSession(token) {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify({
        t: token, exp: Date.now() + SESSION_HOURS * 3600 * 1000
      }));
      return isLoggedIn();
    } catch (e) { return false; }   /* โหมดส่วนตัว/ปิด storage */
  }

  function logout(base) {
    try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
    location.replace((base || '') + LOGIN_PAGE);
  }

  /* ── ตัวกันหน้า ────────────────────────────────────────────
     เรียกใน <head> ก่อน body ถูก parse → ถ้ายังไม่ล็อกอินจะเด้งออกก่อนหน้าจะวาด
     base = path ไปยังรากเว็บ ('' สำหรับหน้าแรก, '../' สำหรับ oe/ กับ welfare/) */
  function require(base) {
    if (isLoggedIn()) return true;
    /* ซ่อนหน้าไว้ก่อนเด้ง — location.replace ไม่ได้หยุด parser ทันที เบราว์เซอร์ยังโหลด
       และรันสคริปต์แดชบอร์ดต่อจนกว่าการเปลี่ยนหน้าจะ commit (วัดแล้ว: data.js/app.js
       ถูกโหลดครบทุกตัว) การซ่อนไว้ทำให้ไม่มีโอกาสเห็นข้อมูลแวบ ๆ แน่นอน ไม่ใช่แค่แข่งเวลา */
    try { document.documentElement.style.display = 'none'; } catch (e) {}
    var here = location.pathname + location.search + location.hash;
    location.replace((base || '') + LOGIN_PAGE + '?next=' + encodeURIComponent(here));
    return false;
  }

  /* ตรวจรหัสผ่าน — คืน true/false (ใช้เวลาหลักร้อย ms ตามจำนวนรอบ) */
  function verify(pass) {
    if (!pass || typeof pass !== 'string') return false;
    return tokenOk(stretch(pass, CONFIG.salt, CONFIG.iter));
  }

  /* คืน 'ok' | 'bad-pass' | 'no-storage'
     แยก no-storage ออกมาเพราะถ้าเขียน localStorage ไม่ได้ (โหมดส่วนตัว/ปิดคุกกี้)
     การเด้งไปหน้าปลายทางจะเจอ guard เตะกลับมาวนไม่รู้จบโดยผู้ใช้ไม่รู้สาเหตุ */
  function login(pass) {
    if (!pass || typeof pass !== 'string') return 'bad-pass';
    var full = stretch(pass, CONFIG.salt, CONFIG.iter);
    if (!tokenOk(full)) return 'bad-pass';
    return startSession(full) ? 'ok' : 'no-storage';
  }

  /* ใช้ตอนตั้ง/เปลี่ยนรหัสผ่าน: พิมพ์ในคอนโซลแล้วเอาผลไปวางแทน CONFIG */
  function makeConfig(pass, iter) {
    var chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    var salt = '', i;
    for (i = 0; i < 16; i++) salt += chars.charAt(Math.floor(Math.random() * chars.length));
    iter = iter || CONFIG.iter;
    var cfg = { salt: salt, iter: iter, hash: sha256Hex('cpf-verify|' + stretch(pass, salt, iter)) };
    try {
      console.log('วางบล็อกนี้แทน CONFIG ใน assets/auth.js:\n' +
        '  var CONFIG = {\n' +
        "    salt: '" + cfg.salt + "',\n" +
        '    iter: ' + cfg.iter + ',\n' +
        "    hash: '" + cfg.hash + "'\n" +
        '  };');
    } catch (e) {}
    return cfg;
  }

  return {
    require: require, isLoggedIn: isLoggedIn, verify: verify, login: login,
    logout: logout, makeConfig: makeConfig, sha256Hex: sha256Hex, _config: CONFIG
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Auth;
