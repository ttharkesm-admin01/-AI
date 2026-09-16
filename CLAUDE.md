# CLAUDE.md — บันทึกบริบทโปรเจกต์ (อ่านก่อนเริ่มงาน)

> ไฟล์นี้สรุปสถานะ/ข้อตกลงของโปรเจกต์ไว้ให้ session ใหม่เข้าใจได้ทันที

## ภาพรวม
Dashboard สรุป **ค่าใช้จ่าย OE** และ **สวัสดิการพนักงาน** ของ **โรงงานผลิตอาหารสัตว์ธารเกษม (CPF)** ปีงบประมาณ พ.ศ. 2569
- เว็บ static ล้วน (HTML/CSS/JS) ไม่มี build step — เปิดไฟล์ได้ตรง ๆ
- ภาษาไทยทั้งหมด · ปีเป็น **พ.ศ.** · ฟอนต์ Sarabun · ธีมเขียว CPF
- **ปีงบประมาณ = ปีปฏิทิน ม.ค.–ธ.ค.** (ผู้ใช้ยืนยันแล้ว) — ตัวกรอง "ปี" ตามปีปฏิทินถูกต้อง ไม่ต้องทำปีงบคร่อมปี
- **ห้ามใส่คำว่า "โคราช"** ในชื่อโรงงาน (เคยลบออกแล้ว)

## โครงสร้างไฟล์
```
index.html              # หน้า landing เลือกแดชบอร์ด
login.html              # หน้าเข้าสู่ระบบ (รหัสผ่านร่วม)
handover.html           # คู่มือใช้งาน + ส่งมอบงาน (พิมพ์/บันทึก PDF ได้ · อยู่หลัง login)
oe/index.html           # Dashboard OE (ค่าใช้จ่าย + เงินยืมทดรอง)
welfare/index.html      # Dashboard สวัสดิการ (+ OT)
assets/auth.js          # ประตูรหัสผ่าน: Auth.require()/login()/logout()/makeConfig()
assets/data.js          # ชั้นข้อมูล: Google Sheets(gviz CSV) / Excel(SheetJS) / demo
assets/utils.js         # helper: U.* (fmt, เดือนไทย, groupSum ฯลฯ)
assets/app.js           # โค้ด UI ร่วม: App.* (Chart drawBar/drawDoughnut, modal, esc, debounce)
assets/editor.js        # โมดอล "จัดการข้อมูล" (เพิ่ม/แก้ไข/ลบ) ใช้ร่วม oe/+welfare/ → DataEditor.open()
assets/export-img.js    # Export infographic JPG/PDF: ExportImg.jpg() / ExportImg.pdf()
assets/ppt.js           # Export PowerPoint (PptxGenJS โหลด on-demand)
assets/common.css       # ธีมกลาง
test/parse.test.js      # เทสต์ parser (รัน `node --test` ที่ราก repo — ไม่ต้องลง dependency)
test/chart-label.test.js # เทสต์ตัวเลขบนยอดแท่งกราฟ (เงิน = ย่อ K/M · ชั่วโมง = คงทศนิยม)
test/oe-type.test.js    # เทสต์การรวมตัวสะกดประเภท OE (คืนเงินยืมทดรอง) + demo มีรายการคืน
test/auth.test.js       # เทสต์ SHA-256 ที่เขียนเอง + ตรวจรหัสผ่าน (รหัสจริงส่งผ่าน env CPF_PASSCODE)
sample-data/*.csv       # ตัวอย่างข้อมูล RAW_DATA
sw.js                   # Service Worker (PWA) — precache แอปเชลล์ + offline
manifest.webmanifest    # PWA manifest (ติดตั้งบนมือถือได้) · assets/icon.svg = ไอคอน
.github/workflows/deploy-pages.yml  # auto-deploy Pages เมื่อ push main
```

## สถาปัตยกรรมข้อมูล (สำคัญ)
- ลำดับความสำคัญ loadAuto: **ข้อมูลที่แก้ในเครื่อง (localStorage)** → Google Sheets → ตัวอย่าง
  - แก้ผ่านปุ่ม "✏️ จัดการข้อมูล" (editor.js) → เก็บที่ `DataSource.local` keys `cpf_oe_records`/`cpf_welfare_records` source='local'
  - สลับแหล่ง (เชื่อม Sheets / อัปโหลด Excel / ใช้ตัวอย่าง) จะ `DataSource.local.clear()` ให้ override หลุดเสมอ
  - เรียลไทม/หลายคน = ใช้ Google Sheets (แก้ในชีต→รีเฟรช); localStorage = เฉพาะเบราว์เซอร์นั้น
- **แคช Sheets ออฟไลน์:** ดึง Sheets สำเร็จ → เก็บที่ key `*_sheetcache`; เน็ตหลุด `fromSheetsCached()` คืนแคชล่าสุด (source='sheets-cache') ไม่มีแคชค่อยตกไปตัวอย่าง
- **คลิกแก้จากตาราง:** ตารางรายการดิบ 1:1 (OE "เงินยืมทดรอง" `tb-adv`) คลิกแถว → `dash.openManage(focusIndex)` เปิด editor ที่รายการนั้น · **ตารางยอดรวม (aggregate)** — OE `tb-top5` (หมวด), Welfare `tb-med`/`tb-ot`/`tb-type`/`pivot-body` — คลิกแถว → `dash.openManage(-1, term)` เปิด editor **กรองด้วย `term`** (ชื่อหมวด/พนักงาน/ประเภท) เพราะ 1 แถว = หลาย record · กลไก: แถวใส่ `class="ed-rowlink" data-term="..."` + delegated click ที่ tbody · `openManage(focusIndex, search)` ส่งต่อ `search` → `DataEditor.open({search})` เติม `#ed-search`
- **PWA:** sw.js (network-first สำหรับ navigation, SWR สำหรับ asset, ไม่แตะ docs.google.com) — แก้โค้ดแอปแล้วต้องเพิ่ม `CACHE_VERSION` ใน sw.js · ปัจจุบัน `cpf-v34` · navigation fallback ตอนออฟไลน์จะลองเติม `index.html` ให้คำขอแบบโฟลเดอร์ (เช่น `/oe/`) ก่อนตกไปหน้า landing
- โหลดอัตโนมัติ: มี config Google Sheets → ดึงสด, ไม่มี → ข้อมูลตัวอย่าง (demo ใน data.js)
  - demo สวัสดิการ = โครง/ยอดจากข้อมูลจริง (ม.ค.–ก.ค. 2569, 22 คน, 171 records) แต่ **ชื่อพนักงานเป็นนามสมมติทั้งหมด** (PR #52 — repo Public **ห้าม commit ชื่อจริง/ข้อมูลส่วนบุคคล** ทั้งใน demo/sample-data/เทสต์)
- Fallback: อัปโหลด Excel (.xlsx) ผ่านปุ่ม "🔗 เชื่อม → 📁 อัปโหลด Excel"
- **OE RAW_DATA** (long): `เดือน|หมวดหมู่|ประเภท|กลุ่ม|รายละเอียด|จำนวนเงิน|ผู้ยืม`
  - ประเภท = `ค่าใช้จ่าย`/`เงินยืมทดรอง`/**`คืนเงินยืมทดรอง`** · กลุ่ม = `คงที่`/`แปรผัน`
  - **ตัวสะกดประเภทถูกรวมให้เป็นค่ามาตรฐานตั้งแต่ตอน parse** ผ่าน `DataSource.canonOEType()` (ค่ามาตรฐานอยู่ที่ `DataSource.OE_TYPE`) — ชีตจริงผู้ใช้พิมพ์เอง มีทั้ง `คืนเงินยืมทดลอง` / `คืนเงินเยืมทดรอง` (ทดรอง↔ทดลอง, ยืม↔เยืม) · เช็คคำว่า "คืน" ก่อนเสมอ เพราะข้อความคืนมีคำว่า "ยืม" อยู่ด้วย · แปลงทั้งใน `normalize()` และ `local.get()` (ข้อมูลที่ผู้ใช้บันทึกไว้ก่อนหน้าอาจยังเก็บตัวสะกดดิบ)
- **Welfare RAW_DATA** (long): `เดือน|ชื่อพนักงาน|ตำแหน่ง|ประเภทสวัสดิการ|จำนวนเงิน|หมายเหตุ`
  - ประเภท 5 อย่าง: ค่ารักษาพยาบาล/เบี้ยเลี้ยง/ค่าน้ำมัน/ค่าที่พัก/สวัสดิการอื่นๆ
- เดือนรูปแบบ `2569-01` (ระบบ pad เลขเดือนให้เป็น 2 หลักอัตโนมัติ)

### OT (สวัสดิการ) — ฟอร์มแบบกว้าง (wide)
- `normalizeWelfareWide()` ใน data.js อ่านตาราง **1 คน/แถว** (คอลัมน์แยกตามประเภท + OT 7 อัตรา)
- OT กรอกเป็น **"จำนวนชั่วโมง"** (ไม่มีอัตราค่าจ้างเป็นบาท) → รวมทุกอัตราเป็น record `wtype='OT'`
- **OT แยกจากยอดเงินทุกที่** (KPI/กราฟ/pivot/export) แสดงเป็น "ชั่วโมง" หน่วย "ชม." · แสดงจำนวนชั่วโมงด้วย `U.fmtHours()` (ทศนิยม ≤2 ตำแหน่ง) — `U.fmt` ปัดเป็นจำนวนเต็ม ใช้กับเงินเท่านั้น
  - **ในกราฟแท่ง** ใช้ `App.drawBar(..., unit)` — ส่ง `unit='ชม.'` แล้วระบบสลับตัวจัดรูปแบบให้เองทั้งตัวเลขบนแท่ง/tooltip/แกน y (`isHourUnit()` → flag `options.plugins.barValueLabel.hours`) · `App.chartBarImage` สืบทอด flag นี้ต่อ กราฟ OT ในรายงาน export จึงคงทศนิยมด้วย (PR #57)
- ฟอร์ม wide ต้องมีเซลล์ระบุเดือนในชีต — รับทั้งรูปแบบ `25xx-xx` และ**ชื่อเดือนไทย** (เต็ม/ย่อ เช่น "ประจำเดือน มกราคม 2569" / "ม.ค.69") ผ่าน `thaiMonthToCode()`
- ไฟล์ wide ที่**แยกชีตตามเดือน** (ไม่มีแท็บ RAW_DATA): `fromExcel` อ่านรวมทุกชีต concat เป็น records ชุดเดียว
- `normalizeAny()` เลือก parser: welfare ลอง wide ก่อน ไม่ใช่จึงใช้ long

## ระบบล็อกอิน (assets/auth.js + login.html) — PR #62
- **รหัสผ่านร่วมชุดเดียวทั้งทีม** (ผู้ใช้บอกเองว่าคนที่ต้องเข้าคือคนที่เกี่ยวข้องเท่านั้น คนอื่นรับเป็นไฟล์/PNG ที่ส่งออกไป)
- **กันได้แค่ไหน:** กันคนที่บังเอิญเจอลิงก์/เครื่องที่ใช้ร่วมกัน · **ไม่กัน** คนที่เปิดซอร์สแล้วตั้งใจแกะรหัสแบบ offline — เว็บ static ไม่มีเซิร์ฟเวอร์ ทำได้เท่านี้ (ถ้าต้องการของจริงต้องมีตัวกลาง เช่น Cloudflare Access หน้าเว็บ)
- **ที่เก็บ:** ในไฟล์มีแค่ `hash` (SHA-256 หมุนซ้ำ 120,000 รอบ + salt) **ไม่มีตัวรหัสผ่าน** · เปลี่ยนรหัส = เปิดคอนโซล พิมพ์ `Auth.makeConfig('รหัสใหม่')` แล้วเอาบล็อกที่ได้ไปวางแทน `CONFIG` ใน auth.js — เปลี่ยนแล้ว session เก่าหลุดทันที
- **⛔ ห้ามเขียนรหัสผ่านตัวจริงลงไฟล์ใด ๆ ใน repo (รวมเทสต์)** — repo เป็น Public ใส่ลงไปเมื่อไหร่ hash 120,000 รอบก็ไร้ความหมายทันที · เคยพลาดมาแล้วตอนร่าง PR #62 (ไปอยู่ใน `test/auth.test.js`) จับได้ตอน scrutinize แล้วเปลี่ยนรหัสใหม่ทั้งชุด · เทสต์ที่ต้องใช้รหัสจริงให้ส่งผ่าน env: `CPF_PASSCODE='…' node --test` (ไม่ได้ตั้ง = ข้ามเทสต์ข้อนั้น)
- **session token ต้องไม่ใช่ค่าที่อยู่ในไฟล์** — เก็บ token = ค่า stretch ของรหัส (`full`) ซึ่งไม่ได้เผยแพร่ ส่วนไฟล์เก็บ `CONFIG.hash = sha256('cpf-verify|' + full)` ไว้ตรวจ · เคยพลาดเก็บ `CONFIG.hash` เป็น token ตรง ๆ → ใครเปิด `assets/auth.js` (ไฟล์เสิร์ฟให้ทุกคน) ก็คัดลอกไปยัด localStorage แล้วเข้าได้โดยไม่ต้องรู้รหัส (พิสูจน์แล้วว่าทะลุจริง) — ตอนนี้ต้องย้อน SHA-256 ถึงจะปลอมได้
- **ทำไมเขียน SHA-256 เอง ไม่ใช้ `crypto.subtle`:** subtle ใช้ไม่ได้ตอนเปิดไฟล์แบบ `file://` (ไม่ใช่ secure context) ซึ่งเป็นวิธีเปิดเว็บที่โปรเจกต์นี้รองรับ · โค้ดตรงกับ `crypto` ของ node ทุกเคส (มีเทสต์)
- **ตัวกันหน้า:** ทุกหน้าใส่ `<script src="…auth.js"></script><script>Auth.require('…')</script>` ไว้**บนสุดของ `<head>` ก่อน CSS/เนื้อหา** → ยังไม่ล็อกอินจะ `location.replace` ออกก่อนหน้าจะวาด (ไม่เห็นข้อมูลแวบ ๆ) · `Auth.require(base)` — base คือ path ไปรากเว็บ (`''` หน้าแรก, `'../'` ใน oe/ กับ welfare/)
- **session:** localStorage key `cpf_auth` = `{h: hash, exp: เวลาหมดอายุ}` อายุ **8 ชม.** · เก็บ hash ไม่ใช่รหัส · แก้ค่าใน localStorage เองไม่ผ่าน (มีเทสต์ในเบราว์เซอร์)
- **ปุ่มออกจากระบบ:** `#btn-logout` — แดชบอร์ดผูก handler ที่ `bindCommonEvents()` ใน app.js, หน้า landing ผูกเอง · ทั้งสองที่ guard ด้วย `window.Auth` แล้วซ่อนปุ่มถ้า auth.js ยังไม่โหลด (กัน "หน้าใหม่+asset เก่า" ช่วง deploy)
- **`?next=` ต้องกรองด้วย URL parser ไม่ใช่เช็คตัวอักษรเอง** — `new URL(raw, location.href)` แล้วเทียบ `origin` · เช็คแค่ "ขึ้นต้นด้วย `/` และตัวถัดไปไม่ใช่ `/`" ไม่พอ เพราะเบราว์เซอร์แปลง `\` เป็น `/` และตัด tab/newline ทิ้ง → `?next=/\evil.com` กับ `?next=/<tab>/evil.com` เด้งออกนอกเว็บได้จริง (ทดสอบแล้ว)
- **`Auth.login()` คืน `'ok' | 'bad-pass' | 'no-storage'`** — แยก `no-storage` เพราะถ้าเบราว์เซอร์เขียน localStorage ไม่ได้ (โหมดส่วนตัว) รหัสถูกแต่ session ไม่ถูกเก็บ → guard เตะกลับมาหน้า login วนไม่รู้จบโดยไม่มีข้อความบอก
- **guard ซ่อน `documentElement` ก่อนเด้ง** — `location.replace()` ไม่หยุด parser ทันที เบราว์เซอร์ยังโหลดและรัน `data.js`/`app.js` ต่อจนกว่าการเปลี่ยนหน้าจะ commit (วัดแล้วโหลดครบทุกไฟล์) ถ้าไม่ซ่อนไว้ การ "ไม่เห็นข้อมูลแวบ ๆ" จะเป็นแค่การแข่งกับเวลา ไม่ใช่การกันจริง

## คู่มือส่งมอบงาน (handover.html) — PR #63
- **ทำไมมี:** ผู้ใช้อาจถูกโยกย้ายตำแหน่ง ต้องมีคู่มือให้คนที่รับช่วงต่อ · อยู่หลัง login เหมือนหน้าอื่น + มีปุ่ม "พิมพ์ / บันทึกเป็น PDF" (print CSS ซ่อน toolbar, กัน break กลางตาราง) พิมพ์ออกมาได้ ~5 หน้า A4
- **8 หัวข้อ:** ① ระบบประกอบด้วยอะไร ② สิ่งที่ต้องทำเมื่อโยกย้าย ③ วิธีกรอกข้อมูลรายเดือน ④ วิธีใช้แดชบอร์ด ⑤ ปัญหาที่เจอบ่อย ⑥ งานที่ต้องใช้คนดูแลฝั่งเว็บ ⑦ ข้อห้าม 5 ข้อ ⑧ ผู้ติดต่อ
- **จุดที่สำคัญที่สุดในคู่มือ = โอนสิทธิ์เจ้าของ Google Sheet** — ชีตผูกกับบัญชี Gmail ส่วนตัวของผู้ดูแล ถ้าบัญชีถูกปิดโดยยังไม่โอน แดชบอร์ดดึงข้อมูลไม่ได้ทันทีและข้อมูลย้อนหลังอาจเข้าไม่ถึงอีกเลย
- **มีช่องเว้นให้กรอกด้วยปากกา** (ผู้ส่งมอบ/ผู้รับมอบ/วันที่ · เจ้าของบัญชี Google-GitHub · รหัสผ่าน · ผู้ติดต่อ) — **ห้าม hardcode รหัสผ่าน/sheetId ลงไฟล์นี้** เพราะ repo เป็น Public (มีเทสต์ในเบราว์เซอร์เช็คว่าไม่มีทั้งสองอย่างในหน้า)
- **ตารางในหน้านี้ต้องมี `word-break: break-word; overflow-wrap: anywhere` ที่ ≤720px** — ข้อความไทยไม่มีช่องว่างระหว่างคำ เบราว์เซอร์จึงถือเป็น "คำเดียวยาว ๆ" ตัดบรรทัดไม่ได้ ตารางเลยล้นจอมือถือ (วัดแล้วที่ 390px ล้นจริงก่อนแก้)

## สถาปัตยกรรม UI ร่วม (app.js)
- **`App.dashboardSetup(kind, cfg)`** — factory ที่ทั้ง oe/ และ welfare/ เรียกใช้ คืน:
  `{ loadData, onLoaded, setStatus, buildMonthFilter, openConnect, openManage, periodLabel, bindCommonEvents, getLastSource }`
- **`_lastAgg`** — closure ใน render() แต่ละหน้า เก็บ aggregate ล่าสุด export ฟังก์ชันอ่านจากนี้โดยไม่คำนวณซ้ำ
  - OE: `{ exp, adv, totalExp, totalAdv, grand, cats, agg:{byCat, byMonth, fixed} }`
  - Welfare: `{ otRecs, money, otHours, med, allow, totalMed, totalAllow, grand, empCount }`
- **`App.esc(s)`** — escape HTML string กัน XSS ใช้ทุกครั้งที่ต่อ innerHTML จาก user data

## สถาปัตยกรรม Export Infographic (export-img.js)
- `ExportImg.png(prefix, cfg)` / `ExportImg.pdf(prefix, cfg)` — public API รับ cfg object สร้าง DOM → capture → download (`ExportImg.jpg` = alias ของ `png` กันหน้าเก่าใน SW cache เรียกแล้วพัง)
- **ธีมรายงาน = เขียวโมโนโทนตามดีไซน์อ้างอิงที่ผู้ใช้ส่งมา (PR #48):** หัวรายงานกึ่งกลาง + เส้นคู่เขียว · KPI การ์ดมีกล่องไอคอนเขียวอ่อนซ้าย · แผงซ้าย-ขวาหัวเขียว `#2E7D32` จัดกึ่งกลางทั้งคู่ · insights = แถวล่าง วงกลมตัวเลขเขียวเข้ม + ข้อความ (ไม่มีกล่องเหลืองแล้ว) · OT section ยังสีม่วงโดยตั้งใจ (สื่อว่าแยกจากยอดเงิน)
- **กราฟใน export ถูก re-render เป็นธีมเขียว** โดยไม่กระทบกราฟบนจอ: `App.chartSquareImage(chart, size, colors)` (colors = array สี หรือชื่อ palette 'green') + `App.chartBarImage(chart, color, w, h)` — หน้า oe/welfare มี wrapper `donutImg(chart, colors)` / `barImg(chart, color, w, h)` พร้อม fallback `toBase64Image` กัน SW cache mismatch
- **ขนาด/ฟอนต์กราฟ export (PR #49 — แก้ตัวเลขกราฟเล็ก):** กราฟแท่ง default `530×420` = สัดส่วนเดียวกับช่องใน report (265×210) ภาพจึงเต็มช่องไม่โดนย่อทิ้ง · ฟอนต์ขยายเฉพาะ export: ตัวเลขบนแท่ง 17px (ผ่าน `options.plugins.barValueLabel.font` — plugin อ่าน font จาก options ได้), แกน x 14px / แกน y 13px · โดนัท default `460px` legend 16px · กราฟ OT ช่องกว้างใช้ `barImg(chart,'#6A1B9A',1420,360)` ตามสัดส่วนช่องตัวเอง
- **cfg object** มี: `title, subtitle, kpis[], leftPanel, rightPanel, otSection (optional), insights[], footnote`
- **panel** มี: `title, color, miniKpis[], sectionA{title,chartImg}, sectionB{title,chartImg}, sectionC{title,heads,rows,rank?,foot?}` — `rank:true` เพิ่มคอลัมน์ "ลำดับ" อัตโนมัติ, `foot:[label,value]` แถวรวมท้ายตาราง (พื้นเขียวอ่อน)
- **`buildOTSection(ot)`** — section พิเศษสีม่วง ต่อท้ายสองแผงหลัก แสดงตาราง OT Top 3 แยกชั่วโมงตามเดือน
  - `ot = { title, totalHours, months:[{code,label}], rows:[{name,position,total,byMonth:{monthCode:formattedStr}}] }`
  - ถ้า `cfg.otSection = null` section นี้จะไม่แสดง (กรณีไม่มีข้อมูล OT)
- **chartCell**: chart image ใช้ `height:210px; object-fit:contain` (คงสัดส่วน ไม่ยืดบิดเบี้ยว) บนพื้นการ์ดขาว · กริดกราฟสองช่อง `1fr 1fr` (สมมาตร)
- **โดนัทใน export ใช้ `App.chartSquareImage(chart, size, colors)`** — re-render โดนัทลง canvas จัตุรัส (380px) ก่อน export เพื่อให้รูปเต็มช่อง ไม่มีขอบว่าง · กราฟแท่งใช้ `App.chartBarImage(chart, color)` re-render ออฟสกรีนพร้อมสีธีมรายงาน
- **`padToLandscapeA4(canvas)`** — เติมขอบขาวให้ canvas ที่ capture ได้เป็นสัดส่วน A4 แนวนอน (297:210) พอดี ก่อน export (รูปต้นฉบับวางกึ่งกลาง คงขนาดกราฟ/ตัวอักษรเดิม ไม่ยืด) · ใช้ทั้ง jpg() และ pdf() · PDF เหลือหน้าเดียวเต็มพอดี (เลิก slice หลายหน้า) — กันอาการตัวอักษรยืดตอนนำรูปเกือบจัตุรัสไปพิมพ์บนหน้าแนวนอน
- โหลด html2canvas + jspdf จาก CDN on-demand ขณะ export (ต้องมีเน็ต)
- **`collectWelfareData()`** ใน welfare/index.html: อ่าน `_lastAgg` คำนวณ topBaiLiang (เบี้ยเลี้ยง Top 3) + otSection ก่อนส่งให้ ExportImg
- **`collectExportData()`** ใน oe/index.html: อ่าน `_lastAgg` คำนวณข้อมูล OE ก่อนส่งให้ ExportImg

### ตาราง pivot "สวัสดิการรายคน × เดือน" (welfare) — ปุ่มคุมมุมมอง
- มีปุ่มคุมบนหัวตาราง (คุมเฉพาะตารางนี้ ไม่กระทบ KPI/กราฟ/export): `#pivot-month` (ทุกเดือน/เลือกเดือนเจาะจง) + `#pivot-top` (ทั้งหมด/Top 10/Top 20)
- `renderPivot(records)` เก็บ records ไว้ที่ `_pivotSrc` → `fillPivotMonths()` เติม dropdown เดือน → `drawPivot()` วาดตามค่าที่เลือก
- เลือกเดือน = กรอง `_pivotSrc` เป็นเดือนนั้นก่อน `buildPivot` (ยุบเหลือคอลัมน์เดียว) · Top N = `rows.slice(0,N)` · footer "รวมทุกคน" ใช้ยอดจริงทั้งหมดเสมอ (ไม่ใช่เฉพาะแถวที่โชว์) · note แสดง "N/ทั้งหมด คน"

## ข้อตกลงการพัฒนา
- พัฒนาแล้ว push ผ่าน **PR เข้า main เสมอ** (push ตรง main ถูกบล็อก) แล้ว merge
- หลัง merge → GitHub Actions deploy Pages อัตโนมัติ (`https://ttharkesm-admin01.github.io/-AI/`)
- repo เป็น **Public** · Pages Source = **GitHub Actions**
- Claude GitHub App ติดตั้งแล้ว → push ได้โดยไม่ต้องใช้ token
- เทมเพลต Excel สร้างด้วย openpyxl (ส่งให้ผู้ใช้ผ่านแชต ไม่ commit ลง repo)
- **branch สำหรับ Claude:** ใช้ branch ที่ระบบกำหนดให้ในแต่ละ session (force push ได้ถ้า diverged) — branch เก่าทุกอันถูกทับด้วยประวัติสะอาดตอน rewrite history แล้ว (PR #54) ไม่ต้องไปใช้ซ้ำ

## วิธีรัน / ทดสอบ (local)
- **พรีวิวเว็บ:** เปิด `index.html` ตรง ๆ หรือรันเซิร์ฟเวอร์เล็ก ๆ:
  `python3 -m http.server 8000` แล้วเปิด `http://localhost:8000/`
- **ตรวจ syntax JS:** `node -c assets/data.js` (และ utils.js / export-img.js / ppt.js)
- **ทดสอบ parser แบบไม่ต้องเปิดเบราว์เซอร์:** สร้าง shim `global.U.parseNumber`
  แล้ว `require('./assets/data.js')` → เรียก `DataSource.normalizeAny(kind, rows)`
  (rows = array-of-arrays แบบที่ได้จาก CSV/SheetJS) — ใช้เช็คผลการแปลง wide/OT
- ไม่มี test runner / lint อย่างเป็นทางการ — พึ่ง `node -c` + ทดสอบด้วยมือ

## ไลบรารีภายนอก (โหลดผ่าน CDN — ต้องมีเน็ต)
- Chart.js `4.4.1` · SheetJS xlsx `0.18.5` · PptxGenJS `3.12.0` (โหลด on-demand ตอน export)
- html2canvas `1.4.1` · jsPDF `2.5.1` (โหลด on-demand ใน export-img.js)
- ฟอนต์ Google Sarabun · ถ้า CDN ล่ม: กราฟไม่ขึ้น (มี guard กันหน้าพัง) / export ใช้ไม่ได้

## ข้อควรระวังทางเทคนิค (gotchas)
- **อ่าน RAW_DATA ตาม "ตำแหน่งคอลัมน์" ไม่ใช่ชื่อหัว** — ห้ามสลับลำดับคอลัมน์
- แถวที่คอลัมน์แรกไม่ตรง `MONTH_RE` (เช่นหัวตาราง) และแถว `amount <= 0` จะถูกข้าม
- `esc()` กัน XSS — ใช้กับ user data ทุกครั้งที่ต่อ HTML string
- Chart instances เก็บใน `charts{}` ต้อง `.destroy()` ก่อนวาดใหม่ (มีแล้วใน drawBar/drawDoughnut)
- `fromExcel` เลือกแท็บ `RAW_DATA` ก่อน, ไม่มีก็เลือกแท็บที่มีข้อมูลมากสุด (ข้ามแท็บ "คำอธิบาย")
- โค้ด UI ร่วม (Chart/modal/esc/debounce) อยู่ที่ `assets/app.js` (App.*) — oe/welfare เรียกผ่าน wrapper บาง ๆ; แก้ logic ร่วมแก้ที่ app.js ที่เดียว แต่ส่วน render/filter/export ยัง**แยกในแต่ละไฟล์**
- localStorage keys: `cpf_oe_source`, `cpf_welfare_source` (เก็บ sheetId/sheetName)
- **"เดือนใหม่ที่กรอกในชีตไม่ขึ้นบนแดชบอร์ด" = เกือบทุกครั้งเป็นเรื่องแหล่งข้อมูล ไม่ใช่ parser** — ไล่ตามลำดับนี้: ① แถบสถานะเขียน "ข้อมูลตัวอย่าง (Demo)" = หน้านั้นยังไม่ได้ต่อชีต (ช่องชื่อแท็บ default `RAW_DATA` แต่ไฟล์จริงชื่อแท็บ `OE`/`สวัสดิการ`) ② "แก้ไขในเครื่อง" = local override บังอยู่ ต้องกดล้างก่อน ③ "แคชออฟไลน์" = ดึงชีตไม่สำเร็จ กำลังโชว์ของเก่า · **ตัวช่วยดูเร็ว: แถบแหล่งข้อมูลแสดงช่วงเดือนของข้อมูลที่โหลดมาจริง** (เช่น `• 171 รายการ • ม.ค.–ก.ค. 69`) เห็นทันทีว่าเดือนล่าสุดเข้ามาหรือยัง
- **ระวังกับดัก: demo ของ OE กับสวัสดิการต้องอัปเดตพร้อมกัน** — เคยมี OE ถึง ก.ค. แต่สวัสดิการหยุดที่ พ.ค. (PR #56) พอผู้ใช้เปิดทั้งสองหน้าโดยไม่ได้ต่อชีต จึงเห็น OE มีเดือน 7 แต่สวัสดิการไม่มี → เข้าใจผิดว่าโค้ดกินข้อมูลหาย (PR #59)
- **ตารางใน export PNG/PDF: คอลัมน์ที่โตตามข้อมูลต้องไม่ล็อกเป็น `1fr`** — เซลล์เป็น `white-space:nowrap` ตารางจึงหดต่ำกว่า min-content ไม่ได้ พอช่องเล็กกว่านั้นตารางจะ**ล้นออกนอกกรอบแล้วโดน html2canvas ตัดทิ้ง** (เจอที่ OT Top 3: ≥6 เดือนขึ้นไปคอลัมน์เดือนท้าย ๆ กับ "รวม" หายไปเลย — PR #61) · ใช้ `max-content` ให้คอลัมน์กว้างตามเนื้อหา แล้วปล่อยกราฟกินที่เหลือ
- **ตัดข้อความยาวใน export ต้องตัดด้วย JS ไม่ใช่ CSS** — `text-overflow:ellipsis` ใช้กับ `display:table-cell` ไม่ได้ (และ `max-width` บน `<td>` ก็ไม่ถูกบังคับใช้) ที่สำคัญ **html2canvas วาดข้อความเอง จึงไม่รองรับ `text-overflow` เลย** → ใส่ CSS ถูกแค่ไหนก็ยังได้ข้อความตัดกลางคำไม่มี `…` ในรูป · ใช้ `fitText()`/`clamp()` ใน export-img.js (วัดด้วย canvas `measureText` แล้วต่อ `…` เป็นข้อความจริง)
- **เพิ่มหน้าใหม่ต้องใส่ตัวกันรหัสผ่านด้วย** — `<script src="…assets/auth.js"></script><script>Auth.require('…')</script>` บนสุดของ `<head>` ไม่งั้นหน้านั้นเปิดได้โดยไม่ต้องล็อกอิน · และเพิ่มไฟล์ใหม่ลง `CORE` ใน sw.js ด้วย
- **welfare field ชื่อพนักงาน = `r.employee`** (ไม่ใช่ `r.name`) — ระวังเวลาเขียน export handler
- แก้โค้ดแล้วต้องเพิ่ม `CACHE_VERSION` ใน sw.js ทุกครั้ง (ปัจจุบัน `cpf-v34`)
- **เพิ่มฟังก์ชันใหม่ใน U.*/App.* ที่ถูกเรียกจากหน้า HTML → ต้องกัน "หน้าใหม่+asset เก่า" ช่วงรอยต่อ deploy** (SW ตัวเก่ายังเสิร์ฟ utils/app เก่า 1 รีเฟรช) — เคยพัง: `U.momChange is not a function` เด้ง toast "ดึง Google Sheets ไม่สำเร็จ" (PR #51) · pattern: shim ต้นสคริปต์ของหน้า (`if (!U.momChange) U.momChange = function(){return null;}`) หรือ guard ณ จุดเรียก (`App.chartBarImage ? ... : fallback`)
- **ไอคอน UI = inline SVG (Lucide-style) ผ่าน CSS mask** (`common.css` คลาส `.ic` / `.btn[class*="gi-"]::before` + glyph `gi-*`) — ไอคอนรับ `currentColor` อัตโนมัติ · ใช้กับ toolbar/KPI/หัวข้อ/modal/editor · **ปุ่มที่ JS รีเซ็ต `textContent` ให้ไอคอนอยู่ที่ `::before` (ใส่ class `gi-*` ที่ปุ่ม) ห้ามฝัง emoji ในสตริง JS** · เพิ่มไอคอนใหม่ = เพิ่ม `.gi-xxx{--ic:url("data:image/svg+xml,...")}` (stroke='black' ห้ามใช้ `#`hex เลี่ยง encode) · **insight cards ใช้ CSS mask / export KPI+หัว insight ใน export-img.js ต้องเป็น inline `<svg>` ผ่าน `ICONS`+`iconSvg(key,color)` เท่านั้น** (html2canvas เรนเดอร์ CSS mask ไม่ได้) — ไม่มี emoji-as-icon เหลือแล้วทั้งบนจอและใน export (PR #44/#45/#47)

## งานที่ทำเสร็จแล้ว (ประวัติ PR #1–#37)
- แก้ bug: เรียงเดือน, parseNumber รองรับ whitespace, guard Chart.js, KPI สวัสดิการบวกลงตัว
- ลบ "โคราช", ลบ config `auto`, ลบข้อความ OT ตกค้าง
- Modal: ปิดด้วย Esc + focus trap · aria-label ปุ่มปิด
- pivot คำนวณผลรวมในลูปเดียว
- แก้ Export PowerPoint (KPI note ต้องเป็น array ของ {text,options})
- รองรับฟอร์มสวัสดิการ wide + OT (ชั่วโมง) + section OT ในแดชบอร์ด
- เพิ่ม deploy workflow + .nojekyll · เพิ่ม OT ในข้อมูล demo
- เพิ่ม CLAUDE.md (บริบท + หลักการเขียนโค้ด)
- ปรับ UI/UX (a11y): focus-visible, prefers-reduced-motion, aria-live status/toast
- ขัดเงากราฟ/KPI: ตัวเลขบนยอดแท่ง (inline Chart plugin `barValueLabel`), tabular-nums, KPI hover shadow
- ปรับดีไซน์หน้า Landing ตามดีไซน์ใหม่จาก Claude (hero gradient + การ์ด pill tag + stats)
- ฝังข้อมูลสวัสดิการ/OT จริงเป็น demo + parser รองรับชื่อเดือนไทย & ไฟล์ wide หลายชีต
- **PR #32:** `App.dashboardSetup(kind, cfg)` factory ใน app.js — ดึงโค้ด lifecycle ร่วมออกจาก oe/welfare; เพิ่ม `_lastAgg` cache ใน render()
- **PR #33:** ปุ่ม "📋 ส่งออก Excel" ใน oe/ + welfare/ ดาวน์โหลด .xlsx ผ่าน SheetJS; เพิ่ม `U.exportExcel()` + `U.fileDate()` ใน utils.js
- **PR #34:** ปรับปรุง infographic export สวัสดิการ — `buildOTSection()` OT Top 3 แยกรายเดือน, เบี้ยเลี้ยง Top 3 ใน right panel, กราฟ max-height 145→200px
- **PR #35:** แก้กราฟอินโฟกราฟิกเต็มพื้นที่ — `height:auto` → `height:200px` (คงที่) ใน chartCell ทั้ง OE และสวัสดิการ
- **PR #37:** redesign infographic — กราฟใหญ่ขึ้น + นำ OT chart กลับมาในรายงาน · bump SW เป็น `cpf-v8`
- **PR #38:** แก้กราฟ infographic ให้สมมาตร/อ่านออก/ใหญ่พอดี —
  - `object-fit:fill`→`contain` (เลิกยืดภาพ โดนัทไม่เป็นวงรี), กริดกราฟ `1fr 1.6fr`→`1fr 1fr`, สูง 185→210px + พื้นการ์ดขาว · bump SW `cpf-v9`
  - `App.chartSquareImage()` re-render โดนัทลง canvas จัตุรัสตอน export → โดนัทเต็มช่อง ไม่มีขอบว่างซ้าย-ขวา (ใช้กับโดนัททั้ง 4 ตัวใน oe/+welfare) · bump SW `cpf-v10`
- **PR #39:** แก้ปุ่ม Export ค้างที่ "กำลังสร้าง…" — ครอบ `collect()` ใน `Promise.resolve().then()` (throw→rejection→reset ปุ่มเสมอ) + `donutImg()` fallback ไป `toBase64Image` ถ้า `App.chartSquareImage` ยังไม่โหลด (กัน cache mismatch) · bump SW `cpf-v11`
- **PR #40:** export เป็น A4 แนวนอนจริง แก้ตัวอักษรดูยืด — `padToLandscapeA4()` เติมขอบขาวให้รูปเป็นสัดส่วน 1.414 ก่อน export (JPG+PDF) · PDF เหลือหน้าเดียว · ต้นเหตุยืด = รูป welfare เกือบจัตุรัส (0.988) ถูกยืดตอน fit ลงหน้าแนวนอน · bump SW `cpf-v12`
- **PR #41:** UI/UX audit ตาม checklist ui-ux-pro-max-skill (surgical) — landing (index.html) เพิ่ม `prefers-reduced-motion` + `.card:focus-visible` (เดิมขาดเพราะใช้ inline style แยกไม่โหลด common.css) · common.css เพิ่ม transition hover แถวตาราง, `.x-close:hover`, `.app-foot a:hover` underline · bump SW `cpf-v13` · หมายเหตุ: emoji-as-icon ยังคงไว้ตามดีไซน์ CPF เดิม (ไม่เปลี่ยนเป็น SVG)
- **PR #42:** ตาราง pivot สวัสดิการ เพิ่มปุ่มคุมมุมมอง — เลือกเดือน (ทุกเดือน/เจาะจง) + Top N (ทั้งหมด/10/20) คุมเฉพาะตาราง ไม่กระทบ KPI/กราฟ · `_pivotSrc`+`fillPivotMonths()`+`drawPivot()` · `.pivot-ctrl` ใน common.css · bump SW `cpf-v14`
- **PR #44:** เปลี่ยน emoji เป็น inline SVG (Lucide-style) ให้ดูเป็นมืออาชีพ — เพิ่ม icon system ใน common.css (CSS mask, `.ic`/`.btn::before`, glyph `gi-*` รับ currentColor) · แปลง toolbar/KPI/panel head/section head/modal ทั้ง oe+welfare + editor.js (ปุ่มจัดการ/แถว) + ลบ emoji ออกจากสตริง JS textContent (ไอคอนอยู่ที่ ::before) · landing เพิ่ม icon badge การ์ด (inline SVG) · ปรับ `icon.svg` (PWA) คมขึ้น (gradient + แท่งมุมโค้ง + wordmark) · bump SW `cpf-v15`
- **PR #45:** ต่อยอด — แปลง emoji ที่เหลือ (insight cards + export KPI) เป็น SVG · insight บนจอใช้ CSS mask `.ic gi-*` (เพิ่ม glyph `gi-pie/scale/trending/user`) สีไอคอนตาม accent การ์ด · **export KPI ใช้ inline `<svg>` ผ่าน `ICONS` registry + `iconSvg()` ใน export-img.js** (html2canvas เรนเดอร์ CSS mask ไม่ได้ แต่ rasterize inline svg ได้) · `kpiBox` + collect ใช้ `iconKey` · ppt.js ไม่ใช้ icon จึงไม่แตะ · ตอนนี้ไม่มี emoji-as-icon หลงเหลือในส่วนที่ผู้บริหารเห็น · bump SW `cpf-v16`
- **PR #46:** คลิกแถวตารางยอดรวมในแดชบอร์ด → เปิด editor กรองรายการให้ (ตอบ pain "หาเรคคอร์ดที่จะแก้ไม่เจอ") — `open()` รับ `opts.search`, `openManage(focusIndex, search)` ส่งต่อ · ทำ `tb-top5`(OE) + `tb-med/tb-ot/tb-type/pivot-body`(welfare) คลิกได้ (`ed-rowlink`+`data-term`+delegated handler) · เก็บ emoji 💾 ตกค้างใน confirm dialog (UNSAVED_MSG) เป็นข้อความล้วน · bump SW `cpf-v17`
- **PR #47:** ตรวจทั้งโปรเจคด้วยแนวทาง scrutinize แล้วแก้ตามผลตรวจ —
  - ผู้ยืมว่างแสดง "(ไม่ระบุผู้ยืม)" ผ่าน `borrowerPairs()` (KPI/insight/export OE เคยโชว์ค่าว่างเปล่ากับข้อมูลจริงที่ยังไม่เติมผู้ยืม)
  - `MONTH_RE` เก็บเฉพาะส่วน `YYYY-MM` (มี capture group + `(?!\d)`) ตัดข้อความปนท้ายเซลล์เดือน — กันเดือนสกปรกแยกกลุ่มเงียบ ๆ (+เทสต์ใหม่ใน parse.test.js)
  - เพิ่ม `U.fmtHours()` — OT แสดงทศนิยม ≤2 ตำแหน่งทุกจุด (จอ/export JPG-PDF/PPT/editor) เดิม `U.fmt` ปัด 12.23→12
  - sw.js: navigation fallback เติม `index.html` ให้คำขอแบบโฟลเดอร์ — ออฟไลน์เปิดลิงก์ตรง `/oe/` ได้หน้าถูกต้อง
  - landing: แก้ stats ค้าง (12 หมวด/6 เดือน ต.ค.68–มี.ค.69 → 17 หมวดหมู่/ปีงบ 2569) + ลบ CSS `.card .tag` ซ้ำ
  - เก็บ emoji ตกค้าง: ⭐ หัว insight ใน export → SVG star (`iconSvg('star', color)`), ⏰ ใน otSection title, 🔍 placeholder, 💾 ใน toast, 🔗/💡/🔄 ใน renderSheetLink
  - แก้สำนวน insight OE ข้อ 1 ("…เท่า ของยอดรวมทั้งหมด" → "…เท่า" / ไม่มีเงินยืม = ข้อความเฉพาะ) · modal เปิดแล้วโฟกัสช่องแรกใน body แทนปุ่มปิด × · bump SW `cpf-v18`
- **PR #48:** redesign export infographic เป็น **PNG ธีมเขียวโมโนโทน** ตามรูปดีไซน์อ้างอิงที่ผู้ใช้ส่งมา (เอาเฉพาะสไตล์ — เนื้อหา/ชื่อโรงงานยังของเรา) —
  - `ExportImg.png()` แทน `jpg()` (jpg คงเป็น alias) · ปุ่ม/ข้อความ UI เปลี่ยนเป็น PNG ทั้ง oe/welfare
  - เทมเพลต: หัวกึ่งกลาง+เส้นคู่, KPI การ์ดกล่องไอคอน, หัวแผงกึ่งกลาง, ตาราง C มีคอลัมน์ "ลำดับ" + แถวรวมท้าย (`rank`/`foot` ใน sectionC), insights = วงกลมตัวเลขเขียวแถวล่าง (เลิกกล่องเหลือง — ลบ ICONS.star ที่ไม่ใช้แล้ว)
  - กราฟ export re-render ธีมเขียว: `chartSquareImage` รับ `colors`, เพิ่ม `App.chartBarImage(chart, color)` · OE donut คงที่/แปรผัน = เขียวเข้ม/อ่อน `['#1B5E20','#81C784']` · OT ยังม่วง
  - ตาราง C ขวาของ OE เปลี่ยนจาก "สรุปตามผู้ยืม" → "รายการเงินยืมทดรอง" (เดือน — รายละเอียด/ผู้ยืม) ตามดีไซน์อ้างอิง
  - bump SW `cpf-v19`
- **PR #49:** แก้ตัวเลขกราฟใน export PNG เล็กอ่านยาก + เพิ่มรายละเอียดโดนัท — ต้นเหตุ: canvas 760px โดนย่อลงช่อง ~265px (เกือบ 3 เท่า) · กราฟแท่ง export เปลี่ยนเป็น 530×420 (สัดส่วนตรงช่อง เต็มช่องพอดี) + ฟอนต์ตัวเลขบนแท่ง 17px/แกน 14-13px เฉพาะตอน export (`barValueLabel` plugin อ่าน font จาก `options.plugins.barValueLabel.font`) · OT ใช้ 1420×360 ตามช่องกว้างของตัวเอง · **โดนัท export (520px) มี plugin `donutDetail` ภายใน `chartSquareImage`:** ยอดรวมกลางวง ("รวม X บาท" — โดนัท export ทุกตัวเป็นยอดเงิน), % บนชิ้นที่ ≥7% (สีตัวหนังสือเลือกตาม luminance ของชิ้นผ่าน `isLightColor`), legend แบบ `generateLabels` บอก ชื่อ+จำนวนเงิน+(%) ครบทุกชิ้น font 14px · bump SW `cpf-v20`
- **PR #50:** insight เทียบเดือนก่อน (MoM) — เพิ่ม `U.momChange(byMonth)` ใน utils.js (คืน `{from,to,fromV,toV,pct}` หรือ null ถ้า < 2 เดือน / เดือนก่อน ≤ 0) · การ์ด insight ที่ 5 บนจอ (OE จาก `agg.byMonth`, welfare จากยอดเงินไม่รวม OT) + ข้อ 5 ใน export ทั้งสองหน้า — แสดงเฉพาะเมื่อช่วงที่กรองมี ≥ 2 เดือน (เลือกเดือนเดียว = ไม่ขึ้น) · bump SW `cpf-v21`
- **PR #51 (hotfix):** ผู้ใช้เจอ toast "ดึง Google Sheets ไม่สำเร็จ: U.momChange is not a function" หลัง deploy #50 — สาเหตุ: หน้า HTML ใหม่ (network-first) เรียกฟังก์ชันใหม่ แต่ SW เก่ายังเสิร์ฟ utils.js เก่า (SWR ล้าหลัง 1 รีเฟรช) · แก้: shim ต้นสคริปต์ oe/+welfare/ (`momChange`→null = ซ่อนการ์ด MoM, `fmtHours`→`fmt`) ให้ degrade เงียบ ๆ แทน throw · bump SW `cpf-v22`
- **PR #52 (privacy):** แทนชื่อพนักงานจริงทั้งหมดใน demo (`data.js` 127 จุด) + sample-data CSV (4 จุด — มีชื่อจริงหลุด 1 คน) ด้วย**นามสมมติ** mapping 1:1 (โครงข้อมูล/ตำแหน่ง/ยอด/เดือนเท่าเดิมเป๊ะ dashboard ทำงานเหมือนเดิม) — เหตุ: repo Public + Pages เผยชื่อจริงคู่ยอดค่ารักษาพยาบาล (ข้อมูลอ่อนไหว PDPA) · ตรวจแล้วไม่เหลือชื่อ/นามสกุลจริงในไฟล์ปัจจุบันทั้ง repo · ⚠️ **git history เก่ายังมีชื่อจริงอยู่** (ต้อง rewrite history ถ้าจะลบจริง — รอผู้ใช้ตัดสินใจ) · bump SW `cpf-v23`
- **PR #53:** PPT ธีมเขียวโมโนโทน + กราฟเส้นแนวโน้มรายเดือน —
  - ppt.js: แถบ/จุด/เส้น accent เหลือง (amber) → เขียวอ่อน `greenLt` · KPI สไลด์ใช้สีเขียวล้วน · สไลด์เงินยืม/เบี้ยเลี้ยงเลิกสีน้ำเงิน (ใช้เขียว default) · OT ยังม่วง
  - กราฟในสไลด์ใช้ตัว re-render ธีมเขียวเดียวกับ export PNG ผ่าน wrapper `pptDonut(chart, colors)` / `pptBar(chart, color, w, h)` (คืน `{image, ratio}`) ในหน้า oe/welfare
  - เคยเพิ่ม `App.drawLine` + section "แนวโน้มรายเดือน" ทั้งสองหน้า → **ผู้ใช้ขอเอาออก ถอดทิ้งแล้วใน PR #55** (อย่าเพิ่มกลับเว้นแต่ผู้ใช้ขอ)
  - bump SW `cpf-v24`
- **PR #54 (rewrite history — ผู้ใช้ยืนยันแล้ว):** ลบชื่อพนักงานจริงออกจากประวัติ git ทั้งหมด — `git filter-repo --replace-text` แทนชื่อจริง→นามสมมติ (รวมแบบไม่มีคำนำหน้า) ในทุก blob ทุก commit แล้ว force-push `main` · การลบ branch โดนบล็อก (403) จึง **force-push ทับทุก branch (30 อัน) ให้ชี้ commit สะอาดเดียวกับ main** — ตรวจแล้ว `git grep` ทุกนามสกุล/ชื่อเด่นทั่ว `rev-list --all` = 0 · ⚠️ **เหลือ:** GitHub ยังเก็บ commit เก่าไว้ใน `refs/pull/*` ของ PR เดิม (ผู้ใช้ลบเองไม่ได้ — ต้องติดต่อ GitHub Support ให้ purge หรือทำ repo เป็น Private) + fork/clone ที่คนอื่นเคยทำไว้ (ถ้ามี) · ปีงบประมาณ: ผู้ใช้ยืนยัน = ปีปฏิทิน ไม่แก้โค้ด
- **PR #56 (scrutinize + ข้อมูลจริง ม.ค.–ก.ค. 69):** ตรวจทั้งโปรเจกต์แล้วแก้บั๊กที่เจอ + ฝังข้อมูล OE จริง 7 เดือน
  - **บั๊กที่แก้:** ① export OE ตั้งชื่อกราฟผิดเป็น "ตามประเภท" ทั้งที่กราฟคือ **กลุ่ม** คงที่/แปรผัน (ประเภท = ค่าใช้จ่าย/เงินยืมทดรอง) ② insight OE ข้อ 1 พูด "สูงกว่า X เท่า" แม้เงินยืม > ค่าใช้จ่าย (ได้ "สูงกว่า 0.5 เท่า") — แยกทิศ + กันหารศูนย์ ③ **insight สวัสดิการข้อ 3 ใน export ใช้เดือนพีคของ "ค่ารักษา" อย่างเดียว แต่พาดหัวว่า "เดือนจ่ายสวัสดิการสูงสุด"** ขัดกับการ์ดบนจอ → ใช้ยอดรวมทุกประเภท ④ `normalizeWelfareWide` ตัดแถวข้อมูลแรกทิ้งถ้าฟอร์มมีหัวแถวเดียว (+เทสต์ใหม่) ⑤ กริด insight ใน export ล็อกไว้ 4 คอลัมน์ พอมีข้อ MoM เป็นข้อ 5 เลยตกไปอยู่แถวล่างลำพัง → 5 คอลัมน์
  - **เตือนคุณภาพข้อมูล:** รายการที่ไม่ได้กรอก **กลุ่ม** เคยถูกนับเป็น "แปรผัน" เงียบ ๆ — เพิ่มหมายเหตุสีส้มท้ายหัวข้อโดนัท + ใน footnote ของรายงาน (เจอในข้อมูลจริง 140,000 ฿: "ค่าจ้างเหมาขนย้ายขยะภายในโรงงาน" ต้นฉบับเว้นช่องประเภทไว้ — **ผู้ใช้ยืนยันแล้วว่าเป็น "คงที่"** จึงเติมให้ใน demo แล้ว หมายเหตุจะไม่ขึ้นกับข้อมูลชุดนี้อีก แต่ยังทำงานถ้าเจอรายการเว้นกลุ่มในอนาคต)
  - **ข้อมูล demo OE:** เดิมมีเดือนเดียว (เม.ย. 69, 18 records) → ตอนนี้ **ม.ค.–ก.ค. 2569, 123 records** ยอดรวมรายเดือนตรงต้นฉบับทุกคอลัมน์ (รวม 4,275,307) · แถว "เงินยืมทดลอง" ในตารางค่าใช้จ่าย = ยอดรวมเงินยืมทดรอง/เดือน (685,084) ส่วนตารางผู้ยืมด้านล่างระบุได้แค่ 130,000 → ที่เหลือ 555,084 เป็นรายการ "(ไม่ระบุผู้ยืม)" · **ชื่อผู้ยืมเป็นนามสมมติ** (ไฟล์ RAW_DATA ชื่อจริงส่งทางแชต ไม่ commit) · ต้นฉบับมีคลาดเคลื่อนปัดเศษ 1 บาทที่ "ค่ากิจกรรมชุมชน" ก.ค. (24,104 → ใช้ 24,103 จึงตรงทั้งแถวและคอลัมน์)
  - bump SW `cpf-v26`
- **PR #55:** ถอดกราฟเส้น "แนวโน้มรายเดือน" ออกทั้งหมดตามคำขอผู้ใช้ (เดิมเพิ่มใน #53 เฉพาะบนจอ ผู้ใช้ถามหาใน PPT แล้วตัดสินใจเอาออกแทน) — ลบ `#trend-block`/`renderTrend` ทั้ง oe/+welfare/ และ `App.drawLine` ใน app.js · bump SW `cpf-v25`
- **PR #57 (ตรวจทั้งโปรเจกต์ต่อจาก #56 แล้วแก้ตามผลตรวจ):** ตรวจทุกไฟล์แล้วเจอ 4 จุดที่พังจริง แก้ + ยืนยันผลด้วยเบราว์เซอร์จริง (Playwright + chromium ในแซนด์บ็อกซ์)
  - ① **แถว insight ล้นเป็น 2 แถว** — `.insights` ล็อกไว้ `repeat(4,1fr)` แต่จำนวนการ์ดจริงคือ 4–6 ใบ (พื้นฐาน 4 + OT เฉพาะสวัสดิการ + MoM เมื่อช่วงที่กรอง ≥ 2 เดือน) → OE 5 ใบ / สวัสดิการ 6 ใบ ตกไปอยู่แถวล่างลำพัง หน้าแหว่ง · แก้เป็น `repeat(auto-fit, minmax(200px,1fr))` (ยุบคอลัมน์ว่าง เต็มแถวเสมอทุกจำนวนการ์ด) · วัดจริงในเบราว์เซอร์: ก่อนแก้ OE 5 ใบ = 2 แถว / สวัสดิการ 6 ใบ = 2 แถว → หลังแก้เหลือ 1 แถวทั้งคู่ · **หมายเหตุ:** ฝั่ง export แก้ไปแล้วใน #56 (4→5 คอลัมน์) แต่ตกหล่นฝั่งจอ
  - ② **กราฟ OT ปัดชั่วโมงทิ้ง** — `drawBar` ใช้ `U.fmtShort` (ตัวเลขบนแท่ง/แกน y) + `U.fmt` (tooltip) กับทุกกราฟรวมทั้งกราฟชั่วโมง → ก.พ. 69 607.65 ชม. แสดงเป็น "608" และถ้าเกิน 1,000 ชม. จะย่อเป็น "1.2K" · ขัดกฎ "OT ใช้ `U.fmtHours` ทุกจุด" ที่ตั้งไว้ตั้งแต่ #47 · แก้: `isHourUnit(unit)` → flag `options.plugins.barValueLabel.hours` คุมทั้ง 3 จุด และ `App.chartBarImage` สืบทอด flag ต่อ (กราฟ OT ในรายงาน export ก็ถูกต้องด้วย) · ยืนยันด้วยภาพจากเบราว์เซอร์: แท่งแสดง 607.65 / 753.5 แล้ว
  - ③ **editor "ทำซ้ำรายการ" ทำให้บันทึกทับผิดแถว** — `dup` แทรกแถวใหม่ที่ `idx+1` แต่ไม่เลื่อน `state.editIdx` ที่อยู่หลังจุดแทรก → ถ้ากำลังแก้แถวหลังจุดนั้นแล้วกด "บันทึกการแก้ไข" จะเขียนทับคนละรายการ (ข้อมูลเพี้ยนเงียบ ๆ) · แก้: `if (state.editIdx > idx) state.editIdx++;` + เรียก `renderForm()` ให้เลข "#N" บนฟอร์มตรงความจริง
  - ④ **สถิติหน้า landing ค้าง** — การ์ด OE โชว์ "17 หมวดหมู่" แต่ demo หลัง #56 มี **25 หมวด** (KPI ในแดชบอร์ดโชว์ 25 ขัดกันเอง) · แก้เป็น 25 + ใส่คอมเมนต์ HTML เตือนให้อัปเดตคู่กับชุด demo
  - เพิ่ม `test/chart-label.test.js` (3 เทสต์) กันบั๊ก ② ย้อนกลับ · เทสต์ทั้งหมด 10/10 ผ่าน · bump SW `cpf-v27`
- **PR #57 (ต่อ) — เพิ่มหัวข้อ "ยอดคืนเงินยืมทดรอง" ตามที่ผู้ใช้ขอ:** ดูรายละเอียดกติกาที่หัวข้อ "คืนเงินยืมทดรอง" ข้างบน
  - **ต้นเหตุที่ต้องรีบ:** ผู้ใช้กรอกแถวคืนเงินในชีตจริงมาตั้งแต่ ก.พ. 69 แต่สะกดประเภทเป็น `คืนเงินยืมทดลอง`/`คืนเงินเยืมทดรอง` → ไม่ตรงกับ `ค่าใช้จ่าย` หรือ `เงินยืมทดรอง` เลย **ถูก filter ทิ้งเงียบ ๆ ทั้ง 15 รายการ** (ยอดคืนจริงรวม ~233,550 บาท หายไปจากทุกหน้าจอ)
  - **data.js:** `OE_TYPE` + `canonOEType()` แปลงตัวสะกดเป็นค่ามาตรฐานที่ `normalize()` และ `local.get()`
  - **oe/:** ตัวกรองเพิ่มตัวเลือก `คืนเงินยืมทดรอง` · mini-KPI แผงขวาเป็น ยอดยืม/ยอดคืน/คงค้าง · โดนัทเปลี่ยนเป็น "คงค้าง vs คืนแล้ว" · ตารางใหม่ `tb-out` คงค้างตามผู้ยืม (คลิกแถวเปิด editor ได้) · ตารางรายการรวมแถวคืน (ป้าย `.tag-ret` + ยอดติดลบ) · การ์ด insight "คืนเงินยืมแล้ว" · KPI sub บอกคืนแล้ว/คงค้าง
  - **export PNG + PPT:** miniKpi/sectionC/สไลด์เงินยืม สลับเป็นมุมมองคงค้างเมื่อมีรายการคืน · **editor:** เพิ่มตัวเลือกประเภท · **demo:** เพิ่มแถวคืนเงิน 4 รายการ (นามสมมติ) ให้เห็นฟีเจอร์โดยไม่ต้องต่อชีต
  - เพิ่ม `test/oe-type.test.js` (5 เทสต์) · เทสต์ทั้งหมด **15/15 ผ่าน** · ตรวจในเบราว์เซอร์จริงครบทุกตัวกรอง (ทั้งหมด/คืนอย่างเดียว/ยืมอย่างเดียว/ค่าใช้จ่าย/เดือนเดียว) ไม่มี pageerror · bump SW `cpf-v28`
  - ⚠️ **ชีตจริงของผู้ใช้มีชื่อพนักงานจริง** — ห้าม commit ลง repo (demo/sample/เทสต์ใช้นามสมมติเท่านั้น)

- **PR #59:** ตอบคำถาม "ทำไมสวัสดิการเดือน 7 ไม่ขึ้น" + กันปัญหาซ้ำ —
  - **ผลตรวจ:** อ่านชีตจริงผ่าน Google Drive แล้ว แท็บ `สวัสดิการ` **มีเดือน 2569-07 ครบ 23 แถว** (ค่ารักษา 3 + ค่าน้ำมัน 1 + OT 19 คน / 809.5 ชม.) และทดสอบ parser ด้วย `node` แล้วอ่านเดือน 07 ได้ปกติ → **ไม่ใช่บั๊กของโค้ด** แต่เป็นเรื่องแหล่งข้อมูลฝั่งเบราว์เซอร์ (demo/local override/แคช)
  - **demo สวัสดิการ เพิ่มเดือน มิ.ย.–ก.ค. 69** (จากชีตจริง แปลงชื่อเป็นนามสมมติชุดเดิม mapping 1:1) → 127 → **171 records** ยอดตรงต้นฉบับ (มิ.ย. เงิน 6,825 / OT 728 ชม. · ก.ค. เงิน 8,457 / OT 809.5 ชม.) · ตัวเลขหน้า landing (22 คน / 5 ประเภท) ยังถูกต้อง ไม่ต้องแก้
  - **แถบแหล่งข้อมูลบอกช่วงเดือนที่โหลดมา** (`• 171 รายการ • ม.ค.–ก.ค. 69`) ปีเดียวกันตัดปีตัวแรกทิ้ง — คำนวณใน `updateStatus()` ที่ app.js ใช้เฉพาะ `U.*` ที่มีอยู่แล้ว (ไม่ต้องทำ shim กันหน้าใหม่+asset เก่า)
  - **สถานะ "แก้ไขในเครื่อง" เปลี่ยนจากเขียวเป็นส้ม** (`status demo`) + ข้อความเป็น "แก้ไขในเครื่อง — ไม่ได้ดึงจากชีต" เพราะของเดิมเขียวเหมือนต่อชีตสำเร็จ ทำให้ไม่มีใครเอะใจว่าข้อมูลถูกแช่แข็ง
  - ตรวจในเบราว์เซอร์จริง (Playwright): welfare demo = ม.ค.–ก.ค. 69, ตัวกรอง/pivot มีเดือน ก.ค., เลือก ก.ค. แล้ว KPI 8,457 ฿ / OT 809.5 ชม. 19 คน, ไม่มี pageerror · เทสต์ 15/15 ผ่าน · bump SW `cpf-v30`

- **PR #61:** แก้ตาราง "Top 3 OT" ใน export PNG/PDF ล้นออกนอกกรอบจนโดนตัด (ผู้ใช้แจ้ง "กราฟเลยช่องไปแล้ว") + ขยายผลตรวจทั้งรายงาน
  - **ต้นเหตุ:** `buildOTSection` ล็อกช่องตารางไว้ `1.8fr 1fr` (~396px) แต่ความกว้างจริงของตารางโตตามจำนวนเดือน (เซลล์ทุกช่อง nowrap) — 7 เดือน = 481px ล้นออกไป 85px เลยขอบแผงและ 44px เลยขอบหน้า 1200px → html2canvas ตัดทิ้ง **คอลัมน์ ก.ค. กับ "รวม (ชม.)" หายทั้งคู่** · เริ่มพังตั้งแต่ ~6 เดือน และถ้าครบ 12 เดือนจะล้น 305px
  - **แก้:** ≤8 เดือน ใช้ `1fr max-content` (ตารางกว้างพอดีเนื้อหา กราฟกินที่เหลือ) · >8 เดือน วางเป็นสองแถว กราฟเต็มกว้าง (กรอบสูง 250px ไม่งั้นภาพ ratio ~4:1 เหลือขอบขาวข้าง ๆ) แล้วตารางเต็มกว้างใต้กราฟ
  - **เจอเพิ่มระหว่างขยายผล:** ข้อความยาวในตารางรายงานถูกตัดกลางคำ **แบบไม่มี `…`** (เช่น "ค่าใช้จ่ายสำนักงาน (อุปกรณ์/ทำความสะอาด/อะไหล่ซ่…") เพราะ `text-overflow:ellipsis` ไม่มีผลกับ `table-cell` และ html2canvas ไม่รองรับอยู่ดี → เพิ่ม `fitText()` วัดความกว้างด้วย canvas แล้วต่อ `…` เป็นข้อความจริง (คอลัมน์ชื่อในแผง 220px — เดิมตั้ง 150px ไว้แต่ไม่มีผล ช่องจริงกว้าง 225px · ชื่อพนักงานในตาราง OT 130px จาก 100px ให้ชื่อไทยเต็มพอดี)
  - **ตรวจแล้ว:** สแกนทุก element ในรายงานทั้ง OE และสวัสดิการ ไม่มีอะไรล้นกรอบอีกในทุกเคส (1/3/6/7/8/9/10/12 เดือน · ชื่อยาว+ยอด 10 หลัก · ไม่มีกราฟ OT · ไม่มีแถว OT · insight 6 ข้อ) · export จริงผ่าน html2canvas ครบทั้งสองหน้า · ตารางบนจอไม่กระทบ (ตรวจ 390/768/1440px ไม่มี overflow — pivot กว้างเลื่อนในกรอบตัวเองตามเดิม) · เทสต์ 15/15 ผ่าน · bump SW `cpf-v34` (PR #60 ที่ยังเปิดอยู่จองเลข v31 ไว้)

- **PR #62:** เพิ่มหน้า login (รหัสผ่านร่วม) + ลบ sheet ID ออกจาก repo — ดูรายละเอียดกติกาที่หัวข้อ "ระบบล็อกอิน" ข้างบน
  - ล็อกทั้งเว็บ (landing + oe + welfare) · `login.html` ธีมเขียว CPF + ปุ่มออกจากระบบทุกหน้า · ไม่แตะ logic เดิมของแดชบอร์ด/export เลย
  - **ลบ sheetId ของชีตจริงออกจาก CLAUDE.md** (repo เป็น Public + ชีตแชร์ "ทุกคนที่มีลิงก์" → ใครอ่าน repo เจอก็เปิดชีตอ่านชื่อ/ยอดจริงได้) · ⚠️ **ยังค้างในประวัติ git** ต้องย้ายไปชีตใหม่ถึงจะหลุดจริง
  - ⚠️ **ตอนตรวจพบว่าชีตจริงตั้งเป็น `anyone = writer` (ใครมีลิงก์ก็แก้/ลบข้อมูลได้)** ทั้งที่กติกาในไฟล์นี้เขียนไว้ว่าควรเป็น "ผู้อ่าน" → **ผู้ใช้เปลี่ยนเป็น `anyone = reader` แล้ว (16 ก.ย. 69)** ตรวจสิทธิ์ผ่าน Drive API ยืนยันแล้ว และยิง gviz แบบไม่ล็อกอินได้ HTTP 200 ทั้งแท็บ `OE` และ `สวัสดิการ` = เว็บยังทำงานปกติ · ตอนนี้ **เจ้าของคนเดียวที่แก้ชีตได้** (ยังไม่มีใครถูกเชิญเป็นผู้แก้ไข — ถ้าจะให้เพื่อนร่วมงานแก้ ต้องเชิญเป็นรายอีเมล)
  - **ตรวจซ้ำด้วย scrutinize แล้วเจอรูใหญ่ 2 ข้อในร่างแรก แก้ก่อนเมิร์จ:** ① รหัสผ่านตัวจริงถูก commit ใน `test/auth.test.js` (repo Public) ② เก็บ `CONFIG.hash` เป็น session token → คัดลอกจากไฟล์ที่เสิร์ฟสาธารณะไปปลอม session เข้าได้เลย · อีก 3 ข้อรอง: `?next=` เปิดช่อง open redirect ผ่าน `/\` และ tab · เบราว์เซอร์ที่ปิด localStorage วนลูปเงียบ ๆ · guard ไม่ได้ซ่อนหน้าไว้จริง (แข่งกับเวลา) · **รหัสผ่านชุดแรกถือว่าหลุดแล้ว เปลี่ยนใหม่ทั้งชุด**
  - ตรวจในเบราว์เซอร์จริง 16 เคส (เด้งเมื่อไม่ได้ล็อกอิน · รหัสผิด/ถูก · session ข้ามหน้า · หมดอายุ · logout · ปลอม token ด้วย hash จากไฟล์ · ไม่มี pageerror) + 4 payload open redirect + เคส localStorage ถูกปิด + วัดว่าไม่มีเนื้อหาโผล่ระหว่างเด้ง · export PNG ทั้งสองหน้ายังทำงานปกติ · เปิดแบบ `file://` ล็อกอินได้ · เทสต์ 21 ข้อ (ข้ามข้อที่ต้องใช้ `CPF_PASSCODE`) · bump SW `cpf-v34`

- **PR #63:** เพิ่ม `handover.html` คู่มือใช้งาน + ส่งมอบงาน (ผู้ใช้ขอเอง เผื่อโยกย้ายตำแหน่ง) — ดูรายละเอียดที่หัวข้อ "คู่มือส่งมอบงาน" ข้างบน · ลิงก์จากหน้า landing · เพิ่มเข้า `CORE` ใน sw.js · bump SW `cpf-v34` · ตรวจในเบราว์เซอร์ 17 เคส (guard ทำงาน · เนื้อหาครบ · ไม่มีรหัส/sheetId หลุด · ไม่ล้นจอที่ 1200/768/390px · โหมดพิมพ์ซ่อน toolbar) เทสต์ 20/20 ผ่าน

## ข้อมูลจริงของผู้ใช้ + การใช้งานจริง (Production data & setup)
- **ฟอร์มสวัสดิการจริง = wide หลายชีต (ชีตละเดือน)** หัวตาราง **2 แถว**: R1-3 ชื่อเรื่อง+"ประจำเดือน X 2569", R4=ป้ายชื่อ, R5=หน่วย/อัตรา · คอลัมน์: ลำดับ|ชื่อ|ตำแหน่ง|ค่ารักษาพยาบาล|ค่าน้ำมัน|เบี้ยเลี้ยง|ค่าที่พัก|สวัสดิการอื่นๆ|รวม|**OT 7 อัตรา** (วันทำงานปกติ 1/1.25/1.5 + วันหยุด 1/2/2.5/3 เท่า) → `normalizeWelfareWide` อ่านได้ครบ (รวม OT เป็นชั่วโมง) · parser รองรับหัวทั้งแบบ 2 แถว (มีแถวหน่วย/อัตรา) และแบบแถวเดียว — ดูจากว่าแถวถัดจากหัวมีชื่อคนหรือยัง (PR นี้ เดิมหัวแถวเดียวทำพนักงานคนแรกหาย)
- **ฟอร์ม OE จริง ("บริการสำนักงาน") = ตารางไขว้ (หมวด×เดือน) ไม่ใช่ RAW_DATA** มี 2 ตารางซ้อนในชีตเดียว + "เงินยืมทดลอง" (สะกดผิด) เป็นยอดก้อนเดียว/เดือน ไม่มีผู้ยืม → **ต้องแปลง (unpivot) เป็น long ก่อน** ระบบถึงอ่านได้
- **วิธีใช้งานจริงที่เลือก = Google Sheets หลายคน (2-3 คน):** 1 ชีต 2 แท็บ `OE` + `สวัสดิการ` (RAW_DATA long), แชร์ "ทุกคนที่มีลิงก์=ผู้อ่าน" (จำเป็นให้ gviz อ่านได้) + เชิญผู้แก้ไข · เชื่อมแต่ละ dashboard เข้าแท็บของตัวเอง (ช่องชื่อแท็บ default `RAW_DATA` → เปลี่ยนเป็น `OE`/`สวัสดิการ`)
- **สิทธิ์ชีตปัจจุบัน (ยืนยัน 16 ก.ย. 69): `anyone = ผู้อ่าน` + เจ้าของแก้ได้คนเดียว** — ผู้ใช้เลือกแบบนี้เอง ("แค่ให้เจ้าของแก้ไขได้พอ") · **ห้ามแนะนำให้ตั้งเป็น "จำกัด/Restricted"** เพราะ gviz จะอ่านไม่ได้ แดชบอร์ดจะตกไปใช้ข้อมูลตัวอย่างทันที · จะให้ใครแก้เพิ่มต้องเชิญเป็นรายอีเมล (Claude ลดสิทธิ์ลิงก์สาธารณะผ่านเครื่องมือ Drive ไม่ได้ — `share_file` ทำได้แค่เพิ่ม/อัปเกรดให้อีเมลที่ระบุ ผู้ใช้ต้องกดเองในหน้าแชร์)
- **⚠️ ไฟล์ต้องเป็น Google Sheets แท้ ไม่ใช่ .xlsx ที่อัปโหลดไว้ในไดรฟ์** — `fromSheets()` ใช้ endpoint **gviz** (`/gviz/tq?tqx=out:csv`) ซึ่งรองรับเฉพาะ **native Google Sheets** (`mimeType = application/vnd.google-apps.spreadsheet`) · ไฟล์ `.xlsx` ในไดรฟ์เปิดแก้ใน Sheets ได้ (Office editing mode) และ URL หน้าตาเหมือนกันเป๊ะ (`/spreadsheets/d/<id>/edit?gid=…`) แต่ gviz อ่านไม่ได้ → แดชบอร์ดตกไปใช้ข้อมูลตัวอย่างพร้อม toast error
  - **อาการที่ผู้ใช้เจอ:** "กรอกข้อมูลในชีตแล้วแต่เว็บไม่ขึ้น" (ไม่ใช่แค่ยอดคืน — ข้อมูลจริงไม่เข้าเลยทั้งชุด)
  - **วิธีแก้:** เปิดไฟล์ → **ไฟล์ → บันทึกเป็น Google ชีต** → ได้ไฟล์ใหม่ (mimeType เป็น `…google-apps.spreadsheet`) → ตั้งแชร์ "ทุกคนที่มีลิงก์=ผู้อ่าน" → เชื่อมด้วย ID ใหม่ · **ไฟล์ .xlsx เดิมเลิกใช้** (แก้ไฟล์เก่าต่อ ข้อมูลจะไม่เข้าเว็บ)
  - **การ copy ไฟล์ไม่แปลงชนิดไฟล์** — สำเนาของ .xlsx ยังเป็น .xlsx (ตรวจแล้วใน session นี้) ต้อง "บันทึกเป็น Google ชีต" เท่านั้น
  - **เช็คเร็ว:** ดูแถบสถานะบนแดชบอร์ด 🟢 `เชื่อม Google Sheets` = ต่อติด · 🔴 `ต่อชีตไม่ได้ — แสดงข้อมูลตัวอย่าง` = gviz อ่านไม่ได้ (ชนิดไฟล์ผิด/ยังไม่แชร์) · 🟢 `แก้ไขในเครื่อง (เบราว์เซอร์นี้)` = มี local override บังอยู่ ต้องกด "จัดการข้อมูล → ล้างข้อมูลที่แก้ไข" ก่อน ไม่งั้นไม่ไปดึงชีตเลย
  - **⚠️ ห้าม commit sheetId ของชีตจริงลง repo** (repo เป็น Public — ใครอ่านเจอก็เปิดชีตได้ เพราะชีตต้องแชร์ "ทุกคนที่มีลิงก์" ให้ gviz อ่าน) · เคยหลุดอยู่ในไฟล์นี้ ลบออกแล้ว (PR #62) แต่**ยังค้างในประวัติ git** — ถ้าต้องการให้หลุดจริงต้องย้ายไปชีตใหม่แล้วไม่ commit ID ใหม่
  - ดู sheetId ที่ใช้อยู่ได้จากเครื่องที่ต่อชีตไว้แล้ว: DevTools → Application → Local Storage → key `cpf_oe_source` / `cpf_welfare_source` (หรือกดปุ่ม "เชื่อม Google Sheets" จะเห็นลิงก์เดิมในช่อง)
- **ข้อมูล OE จริง ม.ค.–ก.ค. 69 (ล่าสุด)** — ผู้ใช้ส่งตารางไขว้มาใน PR #56, แปลงเป็น RAW_DATA 123 รายการ ฝังเป็น demo แล้ว (นามสมมติ) · ⚠️ **ยอดเงินยืมทดรอง 2 ตัวในต้นฉบับไม่ตรงกัน**: แถว "เงินยืมทดลอง" ในตารางค่าใช้จ่าย = 685,084 แต่ตาราง "เงินยืมทดรองจ่าย" ที่ระบุผู้ยืมได้รวมแค่ 130,000 → ผู้ใช้ต้องเติมผู้ยืมอีก 555,084
- **ข้อมูลจริง ม.ค.–เม.ย./พ.ค. 69 แปลงเป็น RAW_DATA แล้ว** (OE 66 / สวัสดิการ 102 รายการ) ส่งเป็นไฟล์ Excel ผ่านแชต (เทมเพลต/ไฟล์แปลง **ไม่ commit ลง repo** สร้างด้วย openpyxl) · 2 จุดที่ผู้ใช้ต้องเติมเอง: **ผู้ยืม** ของเงินยืมทดรอง (ของเดิมไม่มี) + ตรวจ **กลุ่ม คงที่/แปรผัน** (เดาให้ตามชื่อหมวด)
- **เงินยืมทดรอง:** amount ≤ 0 ถูกตัดทิ้ง — **ห้ามใส่ยอดติดลบเพื่อหักคืน** (แถวจะหาย) ให้ใช้ประเภท `คืนเงินยืมทดรอง` แทน · ผู้ยืมที่เว้นว่างจะแสดงเป็น "(ไม่ระบุผู้ยืม)" (`borrowerPairs()` ใน oe/) ไม่โชว์ค่าว่างเปล่า
- **คืนเงินยืมทดรอง (PR #57 — ผู้ใช้ขอเอง):** เดิมผู้ใช้เคยปฏิเสธฟีเจอร์นี้ แต่ **กลับมาขอแล้ว** และได้กรอกแถวคืนเงินไว้ในชีตจริงอยู่ก่อนแล้ว (ตั้งแต่ ก.พ. 69) — ก่อนหน้านี้แถวพวกนั้นไม่ตรงกับทั้ง `ค่าใช้จ่าย` และ `เงินยืมทดรอง` จึง**ถูกทิ้งเงียบ ๆ ทุก KPI/กราฟ/ตาราง**
  - **คงค้าง = ยืม − คืน** · จับคู่ด้วย **ชื่อผู้ยืม** ไม่ใช่ข้อความรายละเอียด (ในชีตจริงข้อความฝั่งคืนพิมพ์ต่างจากฝั่งยืม บางรายการคนละคนกันด้วย จับคู่ตามข้อความจึงพลาดแน่)
  - **การคืนไม่ใช่ค่าใช้จ่าย** → ไม่รวมใน KPI "รวมทั้งสิ้น" (ยังเป็น ค่าใช้จ่าย + เงินยืม) แสดงเป็น ยอดคืน/คงค้าง แยกต่างหาก
  - มุมมอง "คงค้างตามผู้ยืม" (ตาราง `tb-out` + sectionC ใน export + สไลด์ PPT) **แสดงเมื่อ `totalRet > 0` เท่านั้น** — ไม่มีการคืนเลย ลิสต์รายการเงินยืมรายตัวมีประโยชน์กว่า
  - กรองจนเหลือแต่รายการคืน (ยอดยืม = 0) → คงค้างติดลบ มี note เตือน "ยอดคืนมากกว่ายอดยืมในช่วงที่เลือก" และไม่โชว์ % ที่ไร้ความหมาย

## วิธีพรีวิว/ทดสอบในแซนด์บ็อกซ์ (offline — สำคัญสำหรับ session ใหม่)
- แซนด์บ็อกซ์เคย **ออกเน็ตภายนอกไม่ได้** (Google/CDN/gviz บล็อก — curl ขึ้น 000/403) แต่ **16 ก.ย. 69 ยิง `docs.google.com/gviz` ได้ HTTP 200 แล้ว** (มี agent proxy) — ลองก่อนเสมอ ถ้าไม่ผ่านค่อยใช้วิธี local ข้างล่าง · การเรนเดอร์หน้าเว็บ/ฟอนต์/CDN ยังควรเสิร์ฟจากไฟล์ local เพื่อความแน่นอนและเร็วกว่า
- **พรีวิว infographic/หน้าเว็บ:** `npm i chart.js html2canvas jspdf @fontsource/sarabun` ใน scratchpad → `python3 -m http.server 8000` → Playwright (`/opt/pw-browsers/chromium`) route-intercept เสิร์ฟ chart.umd/html2canvas จากไฟล์ local + `addStyleTag` inject Sarabun @font-face (base64 woff2) ให้ตรง production → temp-expose `ExportImg._buildReportDOM`/`window.__collect` แล้ว screenshot DOM (เบราว์เซอร์ render `object-fit`/`padToLandscapeA4` เองได้ถูก) · revert temp hooks หลังเสร็จ (อย่าลบ fix จริง)
- **ทดสอบ parser:** `node` ตั้ง `global.window=global; global.document={createElement:()=>({})}` → `require('./assets/utils.js'); require('./assets/data.js')` → ป้อน rows (array-of-arrays จาก openpyxl dump) เข้า `window.DataSource.normalizeAny(kind, rows)`

## สิ่งที่ยังไม่ทำ / ไอเดียต่อยอด
- (ทำแล้ว: cache Sheets ใน localStorage — ดูหัวข้อ "แคช Sheets ออฟไลน์" ข้างบน)
- **ที่ผู้ใช้เคยถามแล้วปฏิเสธ (อย่าเสนอซ้ำเว้นแต่ผู้ใช้ขอ):** บอทถ่ายรูป→ลงชีตอัตโนมัติ (Apps Script OCR / Discord / LINE)
  - **Apps Script Web App เป็นตัวกลาง (ผู้ใช้ถามเองแล้วปิดจบ 16 ก.ย. 69):** ถ้าทำ จะได้ปิดชีตสนิท + ตรวจรหัสผ่านฝั่งเซิร์ฟเวอร์ (แก้ข้อจำกัดของเว็บ static ได้หมด) แต่ผู้ใช้เลือก**แค่ลดสิทธิ์ลิงก์เป็นผู้อ่านก็พอ** เพราะต้อง deploy เอง/ดูแลเพิ่ม · เก็บไว้เป็นทางเลือกถ้าวันหน้าต้องการล็อกจริงจัง ไม่ต้องเสนอซ้ำ
  - (เดิม "ฟีเจอร์คืนเงินยืม/ยอดสุทธิ" อยู่ในรายการนี้ → **ผู้ใช้ขอเองแล้ว ทำใน PR #57**)
  - (เดิม "เปลี่ยน emoji เป็น SVG icon" อยู่ในรายการนี้ → **ผู้ใช้ขอเองแล้ว ทำใน PR #44 (UI chrome) + PR #45 (insight/export)** ครบทั้งหมดแล้ว)

## หลักการเขียนโค้ด (Coding principles)
อ้างอิงแนวทางจาก https://github.com/multica-ai/andrej-karpathy-skills/blob/main/CLAUDE.md

- **คิดก่อนเขียน (Think before coding):** ระบุสมมติฐานให้ชัด ถ้าไม่แน่ใจให้ถามก่อน
  อย่าเงียบแล้วเดา — เปิดเผยจุดที่สับสนและ trade-off ออกมา
- **เรียบง่ายไว้ก่อน (Simplicity first):** เขียนโค้ดน้อยที่สุดที่แก้โจทย์ได้
  ไม่ใส่ฟีเจอร์เกินที่ขอ ไม่สร้าง abstraction / error handling ที่ไม่จำเป็น
- **แก้แบบเจาะจง (Surgical changes):** แก้เฉพาะสิ่งที่จำเป็น
  ทุกบรรทัดที่เปลี่ยนต้องโยงตรงกับสิ่งที่ผู้ใช้ขอ
- **ทำตามเป้าหมายที่วัดได้ (Goal-driven):** แปลงงานคลุมเครือเป็นเป้าหมายที่วัดผลได้
  เช่น "เพิ่ม validation" → เขียนเทสต์สำหรับ input ที่ผิดก่อน
- หมายเหตุ: ยอมแลกความเร็วกับความรอบคอบโดยตั้งใจ — แต่ใช้วิจารณญาณกับงานเล็ก ๆ ที่ชัดเจน

## แหล่งอ้างอิงภายนอกที่นำมาปรับใช้ (External references)
- **andrej-karpathy-skills** (https://github.com/multica-ai/andrej-karpathy-skills) —
  ที่มาของ "หลักการเขียนโค้ด" ข้างบน
- **9arm-skills / scrutinize** (https://github.com/thananon/9arm-skills) —
  แนวทางรีวิวโค้ดแบบ outsider 4 เฟส (intent → trace → verify → report + verdict) ใช้ตรวจทั้งโปรเจคใน PR #47
- **ui-ux-pro-max-skill** (https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) —
  นำ *แนวทาง* UI/UX มาปรับใช้กับ dashboard จริง (ไม่ได้ติดตั้ง skill เพราะใหญ่เกินจำเป็น):
  focus-visible ring, prefers-reduced-motion, aria-live, ตัวเลขบนยอดแท่งกราฟ, tabular-nums
- แนวทาง: หยิบ *หลักการ/ไอเดีย* จาก skill ภายนอกมาปรับใช้แบบ surgical — ไม่ติดตั้งทั้งก้อน
  เว้นแต่ผู้ใช้ขอชัดเจน (คงหลัก "เรียบง่ายไว้ก่อน")
