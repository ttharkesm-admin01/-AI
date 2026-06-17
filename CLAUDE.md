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
assets/ppt.js           # Export PowerPoint (PptxGenJS โหลด on-demand)
assets/common.css       # ธีมกลาง
sample-data/*.csv       # ตัวอย่างข้อมูล RAW_DATA
.github/workflows/deploy-pages.yml  # auto-deploy Pages เมื่อ push main
```

## สถาปัตยกรรมข้อมูล (สำคัญ)
- โหลดอัตโนมัติ: มี config Google Sheets → ดึงสด, ไม่มี → ข้อมูลตัวอย่าง (demo ใน data.js)
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
- ฟอร์ม wide ต้องมีเซลล์ระบุเดือน (รูปแบบ `25xx-xx`) อยู่ในชีต
- `normalizeAny()` เลือก parser: welfare ลอง wide ก่อน ไม่ใช่จึงใช้ long

## ข้อตกลงการพัฒนา
- พัฒนาแล้ว push ผ่าน **PR เข้า main เสมอ** (push ตรง main ถูกบล็อก) แล้ว merge
- หลัง merge → GitHub Actions deploy Pages อัตโนมัติ (`https://ttharkesm-admin01.github.io/-AI/`)
- repo เป็น **Public** · Pages Source = **GitHub Actions**
- Claude GitHub App ติดตั้งแล้ว → push ได้โดยไม่ต้องใช้ token
- เทมเพลต Excel สร้างด้วย openpyxl (ส่งให้ผู้ใช้ผ่านแชต ไม่ commit ลง repo)

## งานที่ทำเสร็จแล้ว (ประวัติ PR #1–#9)
- แก้ bug: เรียงเดือน, parseNumber รองรับ whitespace, guard Chart.js, KPI สวัสดิการบวกลงตัว
- ลบ "โคราช", ลบ config `auto`, ลบข้อความ OT ตกค้าง
- Modal: ปิดด้วย Esc + focus trap · aria-label ปุ่มปิด
- pivot คำนวณผลรวมในลูปเดียว
- แก้ Export PowerPoint (KPI note ต้องเป็น array ของ {text,options})
- รองรับฟอร์มสวัสดิการ wide + OT (ชั่วโมง) + section OT ในแดชบอร์ด
- เพิ่ม deploy workflow + .nojekyll · เพิ่ม OT ในข้อมูล demo

## สิ่งที่ยังไม่ทำ / ไอเดียต่อยอด
- รวมโค้ดซ้ำระหว่าง oe/ กับ welfare/ เป็น assets/app.js (ตอนนี้ duplicate ~80%)
- cache ข้อมูล Sheets ใน localStorage สำหรับใช้ออฟไลน์
