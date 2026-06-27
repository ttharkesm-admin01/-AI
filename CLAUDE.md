# CLAUDE.md — บันทึกบริบทโปรเจกต์ (อ่านก่อนเริ่มงาน)

> ไฟล์นี้สรุปสถานะ/ข้อตกลงของโปรเจกต์ไว้ให้ session ใหม่เข้าใจได้ทันที

## ภาพรวม
Dashboard สรุป **ค่าใช้จ่าย OE** และ **สวัสดิการพนักงาน** ของ **โรงงานผลิตอาหารสัตว์ธารเกษม (CPF)** ปีงบประมาณ พ.ศ. 2569
- เว็บ static ล้วน (HTML/CSS/JS) ไม่มี build step — เปิดไฟล์ได้ตรง ๆ
- ภาษาไทยทั้งหมด · ปีเป็น **พ.ศ.** · ฟอนต์ Sarabun · ธีมเขียว CPF
- **ห้ามใส่คำว่า "โคราช"** ในชื่อโรงงาน (เคยลบออกแล้ว)

## โครงสร้างไฟล์
```
index.html              # หน้า landing เลือกแดชบอร์ด
oe/index.html           # Dashboard OE (ค่าใช้จ่าย + เงินยืมทดรอง)
welfare/index.html      # Dashboard สวัสดิการ (+ OT)
assets/data.js          # ชั้นข้อมูล: Google Sheets(gviz CSV) / Excel(SheetJS) / demo
assets/utils.js         # helper: U.* (fmt, เดือนไทย, groupSum ฯลฯ)
assets/app.js           # โค้ด UI ร่วม: App.* (Chart drawBar/drawDoughnut, modal, esc, debounce)
assets/editor.js        # โมดอล "จัดการข้อมูล" (เพิ่ม/แก้ไข/ลบ) ใช้ร่วม oe/+welfare/ → DataEditor.open()
assets/export-img.js    # Export infographic JPG/PDF: ExportImg.jpg() / ExportImg.pdf()
assets/ppt.js           # Export PowerPoint (PptxGenJS โหลด on-demand)
assets/common.css       # ธีมกลาง
test/parse.test.js      # เทสต์ parser (รัน `node --test` — ไม่ต้องลง dependency)
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
- **คลิกแก้จากตาราง:** ตารางรายการดิบ (OE "เงินยืมทดรอง" `tb-adv`) คลิกแถว → `DataEditor.open({focusIndex})` เปิด editor ที่รายการนั้น (เฉพาะตาราง 1:1 ไม่ใช่ยอดรวม)
- **PWA:** sw.js (network-first สำหรับ navigation, SWR สำหรับ asset, ไม่แตะ docs.google.com) — แก้โค้ดแอปแล้วต้องเพิ่ม `CACHE_VERSION` ใน sw.js · ปัจจุบัน `cpf-v8`
- โหลดอัตโนมัติ: มี config Google Sheets → ดึงสด, ไม่มี → ข้อมูลตัวอย่าง (demo ใน data.js)
  - demo สวัสดิการ = **ข้อมูลจริงฝังในตัว** (ม.ค.–พ.ค. 2569, 22 คน, 127 records) แปลงจากไฟล์ฟอร์ม wide
- Fallback: อัปโหลด Excel (.xlsx) ผ่านปุ่ม "🔗 เชื่อม → 📁 อัปโหลด Excel"
- **OE RAW_DATA** (long): `เดือน|หมวดหมู่|ประเภท|กลุ่ม|รายละเอียด|จำนวนเงิน|ผู้ยืม`
  - ประเภท = `ค่าใช้จ่าย`/`เงินยืมทดรอง` · กลุ่ม = `คงที่`/`แปรผัน`
- **Welfare RAW_DATA** (long): `เดือน|ชื่อพนักงาน|ตำแหน่ง|ประเภทสวัสดิการ|จำนวนเงิน|หมายเหตุ`
  - ประเภท 5 อย่าง: ค่ารักษาพยาบาล/เบี้ยเลี้ยง/ค่าน้ำมัน/ค่าที่พัก/สวัสดิการอื่นๆ
- เดือนรูปแบบ `2569-01` (ระบบ pad เลขเดือนให้เป็น 2 หลักอัตโนมัติ)

### OT (สวัสดิการ) — ฟอร์มแบบกว้าง (wide)
- `normalizeWelfareWide()` ใน data.js อ่านตาราง **1 คน/แถว** (คอลัมน์แยกตามประเภท + OT 7 อัตรา)
- OT กรอกเป็น **"จำนวนชั่วโมง"** (ไม่มีอัตราค่าจ้างเป็นบาท) → รวมทุกอัตราเป็น record `wtype='OT'`
- **OT แยกจากยอดเงินทุกที่** (KPI/กราฟ/pivot/export) แสดงเป็น "ชั่วโมง" หน่วย "ชม."
- ฟอร์ม wide ต้องมีเซลล์ระบุเดือนในชีต — รับทั้งรูปแบบ `25xx-xx` และ**ชื่อเดือนไทย** (เต็ม/ย่อ เช่น "ประจำเดือน มกราคม 2569" / "ม.ค.69") ผ่าน `thaiMonthToCode()`
- ไฟล์ wide ที่**แยกชีตตามเดือน** (ไม่มีแท็บ RAW_DATA): `fromExcel` อ่านรวมทุกชีต concat เป็น records ชุดเดียว
- `normalizeAny()` เลือก parser: welfare ลอง wide ก่อน ไม่ใช่จึงใช้ long

## สถาปัตยกรรม UI ร่วม (app.js)
- **`App.dashboardSetup(kind, cfg)`** — factory ที่ทั้ง oe/ และ welfare/ เรียกใช้ คืน:
  `{ loadData, onLoaded, setStatus, buildMonthFilter, openConnect, openManage, periodLabel, bindCommonEvents, getLastSource }`
- **`_lastAgg`** — closure ใน render() แต่ละหน้า เก็บ aggregate ล่าสุด export ฟังก์ชันอ่านจากนี้โดยไม่คำนวณซ้ำ
  - OE: `{ filtered, byMonth, fixed, variable, expTotal, advances, advTotal }`
  - Welfare: `{ otRecs, money, otHours, med, allow, totalMed, totalAllow, grand, empCount }`
- **`App.esc(s)`** — escape HTML string กัน XSS ใช้ทุกครั้งที่ต่อ innerHTML จาก user data

## สถาปัตยกรรม Export Infographic (export-img.js)
- `ExportImg.jpg(prefix, cfg)` / `ExportImg.pdf(prefix, cfg)` — public API รับ cfg object สร้าง DOM → capture → download
- **cfg object** มี: `title, subtitle, kpis[], leftPanel, rightPanel, otSection (optional), insights[], footnote`
- **panel** มี: `title, color, miniKpis[], sectionA{title,chartImg}, sectionB{title,chartImg}, sectionC{title,heads,rows}`
- **`buildOTSection(ot)`** — section พิเศษสีม่วง ต่อท้ายสองแผงหลัก แสดงตาราง OT Top 3 แยกชั่วโมงตามเดือน
  - `ot = { title, totalHours, months:[{code,label}], rows:[{name,position,total,byMonth:{monthCode:formattedStr}}] }`
  - ถ้า `cfg.otSection = null` section นี้จะไม่แสดง (กรณีไม่มีข้อมูล OT)
- **chartCell**: chart image ใช้ `height:200px; object-fit:contain` (คงที่ — กราฟเต็มช่องไม่มีพื้นว่าง)
- โหลด html2canvas + jspdf จาก CDN on-demand ขณะ export (ต้องมีเน็ต)
- **`collectWelfareData()`** ใน welfare/index.html: อ่าน `_lastAgg` คำนวณ topBaiLiang (เบี้ยเลี้ยง Top 3) + otSection ก่อนส่งให้ ExportImg
- **`collectExportData()`** ใน oe/index.html: อ่าน `_lastAgg` คำนวณข้อมูล OE ก่อนส่งให้ ExportImg

## ข้อตกลงการพัฒนา
- พัฒนาแล้ว push ผ่าน **PR เข้า main เสมอ** (push ตรง main ถูกบล็อก) แล้ว merge
- หลัง merge → GitHub Actions deploy Pages อัตโนมัติ (`https://ttharkesm-admin01.github.io/-AI/`)
- repo เป็น **Public** · Pages Source = **GitHub Actions**
- Claude GitHub App ติดตั้งแล้ว → push ได้โดยไม่ต้องใช้ token
- เทมเพลต Excel สร้างด้วย openpyxl (ส่งให้ผู้ใช้ผ่านแชต ไม่ commit ลง repo)
- **branch สำหรับ Claude:** `claude/project-context-memory-z3glr6` — ใช้ branch นี้ทุกครั้ง (force push ได้ถ้า diverged)

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
- **welfare field ชื่อพนักงาน = `r.employee`** (ไม่ใช่ `r.name`) — ระวังเวลาเขียน export handler
- แก้โค้ดแล้วต้องเพิ่ม `CACHE_VERSION` ใน sw.js ทุกครั้ง (ปัจจุบัน `cpf-v8`)

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

## สิ่งที่ยังไม่ทำ / ไอเดียต่อยอด
- cache ข้อมูล Sheets ใน localStorage สำหรับใช้ออฟไลน์

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
- **ui-ux-pro-max-skill** (https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) —
  นำ *แนวทาง* UI/UX มาปรับใช้กับ dashboard จริง (ไม่ได้ติดตั้ง skill เพราะใหญ่เกินจำเป็น):
  focus-visible ring, prefers-reduced-motion, aria-live, ตัวเลขบนยอดแท่งกราฟ, tabular-nums
- แนวทาง: หยิบ *หลักการ/ไอเดีย* จาก skill ภายนอกมาปรับใช้แบบ surgical — ไม่ติดตั้งทั้งก้อน
  เว้นแต่ผู้ใช้ขอชัดเจน (คงหลัก "เรียบง่ายไว้ก่อน")
