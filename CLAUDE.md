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
- **คลิกแก้จากตาราง:** ตารางรายการดิบ 1:1 (OE "เงินยืมทดรอง" `tb-adv`) คลิกแถว → `dash.openManage(focusIndex)` เปิด editor ที่รายการนั้น · **ตารางยอดรวม (aggregate)** — OE `tb-top5` (หมวด), Welfare `tb-med`/`tb-ot`/`tb-type`/`pivot-body` — คลิกแถว → `dash.openManage(-1, term)` เปิด editor **กรองด้วย `term`** (ชื่อหมวด/พนักงาน/ประเภท) เพราะ 1 แถว = หลาย record · กลไก: แถวใส่ `class="ed-rowlink" data-term="..."` + delegated click ที่ tbody · `openManage(focusIndex, search)` ส่งต่อ `search` → `DataEditor.open({search})` เติม `#ed-search`
- **PWA:** sw.js (network-first สำหรับ navigation, SWR สำหรับ asset, ไม่แตะ docs.google.com) — แก้โค้ดแอปแล้วต้องเพิ่ม `CACHE_VERSION` ใน sw.js · ปัจจุบัน `cpf-v20` · navigation fallback ตอนออฟไลน์จะลองเติม `index.html` ให้คำขอแบบโฟลเดอร์ (เช่น `/oe/`) ก่อนตกไปหน้า landing
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
- **OT แยกจากยอดเงินทุกที่** (KPI/กราฟ/pivot/export) แสดงเป็น "ชั่วโมง" หน่วย "ชม." · แสดงจำนวนชั่วโมงด้วย `U.fmtHours()` (ทศนิยม ≤2 ตำแหน่ง) — `U.fmt` ปัดเป็นจำนวนเต็ม ใช้กับเงินเท่านั้น
- ฟอร์ม wide ต้องมีเซลล์ระบุเดือนในชีต — รับทั้งรูปแบบ `25xx-xx` และ**ชื่อเดือนไทย** (เต็ม/ย่อ เช่น "ประจำเดือน มกราคม 2569" / "ม.ค.69") ผ่าน `thaiMonthToCode()`
- ไฟล์ wide ที่**แยกชีตตามเดือน** (ไม่มีแท็บ RAW_DATA): `fromExcel` อ่านรวมทุกชีต concat เป็น records ชุดเดียว
- `normalizeAny()` เลือก parser: welfare ลอง wide ก่อน ไม่ใช่จึงใช้ long

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
- แก้โค้ดแล้วต้องเพิ่ม `CACHE_VERSION` ใน sw.js ทุกครั้ง (ปัจจุบัน `cpf-v20`)
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

## ข้อมูลจริงของผู้ใช้ + การใช้งานจริง (Production data & setup)
- **ฟอร์มสวัสดิการจริง = wide หลายชีต (ชีตละเดือน)** หัวตาราง **2 แถว**: R1-3 ชื่อเรื่อง+"ประจำเดือน X 2569", R4=ป้ายชื่อ, R5=หน่วย/อัตรา · คอลัมน์: ลำดับ|ชื่อ|ตำแหน่ง|ค่ารักษาพยาบาล|ค่าน้ำมัน|เบี้ยเลี้ยง|ค่าที่พัก|สวัสดิการอื่นๆ|รวม|**OT 7 อัตรา** (วันทำงานปกติ 1/1.25/1.5 + วันหยุด 1/2/2.5/3 เท่า) → `normalizeWelfareWide` อ่านได้ครบ (รวม OT เป็นชั่วโมง) · ⚠️ parser ถือว่าหัวมี 2 แถวเสมอ (data เริ่ม headIdx+2) — ฟอร์มต้องมีแถวหน่วยใต้ป้ายชื่อ ไม่งั้นแถวข้อมูลแรกหาย
- **ฟอร์ม OE จริง ("บริการสำนักงาน") = ตารางไขว้ (หมวด×เดือน) ไม่ใช่ RAW_DATA** มี 2 ตารางซ้อนในชีตเดียว + "เงินยืมทดลอง" (สะกดผิด) เป็นยอดก้อนเดียว/เดือน ไม่มีผู้ยืม → **ต้องแปลง (unpivot) เป็น long ก่อน** ระบบถึงอ่านได้
- **วิธีใช้งานจริงที่เลือก = Google Sheets หลายคน (2-3 คน):** 1 ชีต 2 แท็บ `OE` + `สวัสดิการ` (RAW_DATA long), แชร์ "ทุกคนที่มีลิงก์=ผู้อ่าน" (จำเป็นให้ gviz อ่านได้) + เชิญผู้แก้ไข · เชื่อมแต่ละ dashboard เข้าแท็บของตัวเอง (ช่องชื่อแท็บ default `RAW_DATA` → เปลี่ยนเป็น `OE`/`สวัสดิการ`) · ผู้ใช้ต่อชีตจริงแล้วใช้งานได้ (sheetId `1o3GBHFUArpP7l-tGXtykPqRsngW4HCf-`)
- **ข้อมูลจริง ม.ค.–เม.ย./พ.ค. 69 แปลงเป็น RAW_DATA แล้ว** (OE 66 / สวัสดิการ 102 รายการ) ส่งเป็นไฟล์ Excel ผ่านแชต (เทมเพลต/ไฟล์แปลง **ไม่ commit ลง repo** สร้างด้วย openpyxl) · 2 จุดที่ผู้ใช้ต้องเติมเอง: **ผู้ยืม** ของเงินยืมทดรอง (ของเดิมไม่มี) + ตรวจ **กลุ่ม คงที่/แปรผัน** (เดาให้ตามชื่อหมวด)
- **เงินยืมทดรอง:** amount ≤ 0 ถูกตัดทิ้ง (ใส่ติดลบเพื่อหักคืน = หาย) · ฟีเจอร์ "คืนเงินยืม/ยอดสุทธิ" **ผู้ใช้ปฏิเสธ ไม่ทำ** · ผู้ยืมที่เว้นว่างจะแสดงเป็น "(ไม่ระบุผู้ยืม)" (`borrowerPairs()` ใน oe/) ไม่โชว์ค่าว่างเปล่า

## วิธีพรีวิว/ทดสอบในแซนด์บ็อกซ์ (offline — สำคัญสำหรับ session ใหม่)
- แซนด์บ็อกซ์ **ออกเน็ตภายนอกไม่ได้** (Google/CDN/gviz บล็อก — curl ขึ้น 000/403) → ทดสอบของจริงด้วย local เท่านั้น
- **พรีวิว infographic/หน้าเว็บ:** `npm i chart.js html2canvas jspdf @fontsource/sarabun` ใน scratchpad → `python3 -m http.server 8000` → Playwright (`/opt/pw-browsers/chromium`) route-intercept เสิร์ฟ chart.umd/html2canvas จากไฟล์ local + `addStyleTag` inject Sarabun @font-face (base64 woff2) ให้ตรง production → temp-expose `ExportImg._buildReportDOM`/`window.__collect` แล้ว screenshot DOM (เบราว์เซอร์ render `object-fit`/`padToLandscapeA4` เองได้ถูก) · revert temp hooks หลังเสร็จ (อย่าลบ fix จริง)
- **ทดสอบ parser:** `node` ตั้ง `global.window=global; global.document={createElement:()=>({})}` → `require('./assets/utils.js'); require('./assets/data.js')` → ป้อน rows (array-of-arrays จาก openpyxl dump) เข้า `window.DataSource.normalizeAny(kind, rows)`

## สิ่งที่ยังไม่ทำ / ไอเดียต่อยอด
- cache ข้อมูล Sheets ใน localStorage สำหรับใช้ออฟไลน์
- **ที่ผู้ใช้เคยถามแล้วปฏิเสธ (อย่าเสนอซ้ำเว้นแต่ผู้ใช้ขอ):** ฟีเจอร์คืนเงินยืม/ยอดสุทธิ · บอทถ่ายรูป→ลงชีตอัตโนมัติ (Apps Script OCR / Discord / LINE)
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
