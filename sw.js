/* ============================================================
   sw.js — Service Worker (PWA) สำหรับ CPF ธารเกษม Dashboard
   - precache แอปเชลล์ (HTML/CSS/JS) เพื่อเปิดใช้งานออฟไลน์
   - navigation: network-first (ได้หน้าใหม่เสมอเมื่อมีเน็ต, ออฟไลน์ใช้แคช)
   - static asset: stale-while-revalidate (เร็ว + อัปเดตเบื้องหลัง)
   - ไม่แตะคำขอ Google Sheets (docs.google.com) — ให้แอปจัดการแคชข้อมูลเอง
   *** เปลี่ยนโค้ดแอปแล้วให้เพิ่มเลข CACHE_VERSION เพื่อบังคับอัปเดตแคช ***
   ============================================================ */
var CACHE_VERSION = 'cpf-v8';
var CORE = [
  './',
  './index.html',
  './oe/index.html',
  './welfare/index.html',
  './assets/common.css',
  './assets/utils.js',
  './assets/data.js',
  './assets/app.js',
  './assets/editor.js',
  './assets/export-img.js',
  './assets/ppt.js',
  './assets/icon.svg',
  './manifest.webmanifest'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE_VERSION).then(function (c) { return c.addAll(CORE); }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE_VERSION; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);

  // ข้อมูลสด Google Sheets — ปล่อยให้แอปจัดการ (มีแคชใน localStorage เอง)
  if (url.hostname.indexOf('docs.google.com') >= 0) return;

  // การนำทาง (เปิดหน้า) — เอาของใหม่ก่อน, ออฟไลน์ค่อยใช้แคช
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE_VERSION).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () {
        return caches.match(req).then(function (c) { return c || caches.match('./index.html'); });
      })
    );
    return;
  }

  // asset อื่น ๆ (CSS/JS/ฟอนต์/CDN) — ใช้แคชก่อนแล้วอัปเดตเบื้องหลัง
  e.respondWith(
    caches.match(req).then(function (cached) {
      var net = fetch(req).then(function (res) {
        if (res && res.status === 200 && (res.type === 'basic' || res.type === 'cors')) {
          var copy = res.clone();
          caches.open(CACHE_VERSION).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () { return cached; });
      return cached || net;
    })
  );
});
