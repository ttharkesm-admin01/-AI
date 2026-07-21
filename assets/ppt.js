/* ============================================================
   ppt.js — ตัวช่วย Export PowerPoint (PptxGenJS)
   - โหลดไลบรารีแบบ on-demand (ตอนกดปุ่ม)
   - รับ "deck spec" แล้วสร้างสไลด์ตาม layout
   - ฟอนต์ Sarabun, ธีมเขียว CPF
   ============================================================ */
(function (global) {
  'use strict';

  var F = 'Sarabun';
  var C = {
    greenDark: '1B5E20', green: '2E7D32', greenLt: '43A047', pale: 'E8F5E9',
    blue: '1565C0', blueDark: '0D47A1', bluePale: 'E3F2FD',
    amber: 'F9A825', ink: '1F2937', grey: '6B7280', line: 'E5E7EB', white: 'FFFFFF'
  };
  var PPT_SRC = 'https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js';

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('โหลดไลบรารี PowerPoint ไม่สำเร็จ — ตรวจสอบอินเทอร์เน็ต')); };
      document.head.appendChild(s);
    });
  }
  function ensureLib() {
    if (global.PptxGenJS) return Promise.resolve();
    return loadScript(PPT_SRC);
  }

  function fitBox(maxW, maxH, ratio) {
    ratio = ratio || 1.6;
    var w = maxW, h = w / ratio;
    if (h > maxH) { h = maxH; w = h * ratio; }
    return { w: w, h: h };
  }

  /** แปลง Chart.js instance -> {image, ratio} */
  function chartImage(chart) {
    if (!chart) return null;
    try {
      return { image: chart.toBase64Image('image/png', 1), ratio: (chart.width || 600) / (chart.height || 320) };
    } catch (e) { return null; }
  }

  var BAR_SHADOW = { type: 'outer', color: '000000', opacity: 0.25, blur: 5, offset: 2, angle: 90 };
  var CARD_SHADOW = { type: 'outer', color: '94A3B8', opacity: 0.4, blur: 6, offset: 2, angle: 90 };

  function band(slide, title, color) {
    slide.addShape('rect', { x: 0, y: 0, w: '100%', h: 0.85, fill: { color: color || C.green }, shadow: BAR_SHADOW });
    slide.addShape('rect', { x: 0, y: 0.85, w: '100%', h: 0.06, fill: { color: C.greenLt } });
    // จุดสีเล็ก ๆ หน้าหัวข้อ ให้ดูมีดีไซน์ (เขียวอ่อน — ธีมเขียวโมโนโทนเข้าชุดรายงาน PNG)
    slide.addShape('roundRect', { x: 0.45, y: 0.30, w: 0.25, h: 0.25, rectRadius: 0.05, fill: { color: C.greenLt } });
    slide.addText(title || '', { x: 0.85, y: 0, w: 12.0, h: 0.85, color: C.white, fontFace: F, fontSize: 22, bold: true, valign: 'middle' });
  }
  function footer(slide, deck, page, total) {
    slide.addShape('line', { x: 0.45, y: 7.0, w: 12.43, h: 0, line: { color: C.line, width: 0.75 } });
    slide.addText((deck.org || 'CPF ธารเกษม') + '  •  ' + (deck.period || 'FY2569'),
      { x: 0.45, y: 7.05, w: 9.0, h: 0.35, color: C.grey, fontFace: F, fontSize: 9, align: 'left' });
    if (page) slide.addText('หน้า ' + page + (total ? ' / ' + total : ''),
      { x: 9.5, y: 7.05, w: 3.38, h: 0.35, color: C.grey, fontFace: F, fontSize: 9, align: 'right' });
  }

  function styledTable(slide, t, box) {
    var headColor = t.headColor || C.green;
    var head = (t.head || []).map(function (h, i) {
      return { text: String(h), options: { fill: headColor, color: C.white, bold: true, align: (t.align && t.align[i]) || 'left' } };
    });
    var body = (t.rows || []).map(function (row, ri) {
      return row.map(function (cell, ci) {
        return {
          text: String(cell), options: {
            align: (t.align && t.align[ci]) || 'left',
            color: C.ink, fill: ri % 2 ? 'F7FAF7' : C.white
          }
        };
      });
    });
    var data = [head].concat(body);
    // เกลี่ยความสูงแถวให้เติมพื้นที่ (ตารางแถวน้อยจะไม่ลอยอยู่บนสุด)
    var nrows = data.length;
    var rowH = t.rowH || Math.max(0.3, Math.min(0.5, 4.9 / nrows));
    slide.addTable(data, {
      x: box.x, y: box.y, w: box.w,
      colW: t.widths,
      fontFace: F, fontSize: t.fontSize || 11,
      border: { type: 'solid', color: C.line, pt: 0.5 },
      valign: 'middle', rowH: rowH, autoPage: false
    });
  }

  function renderSlide(pptx, sd, deck, page, total) {
    var slide = pptx.addSlide();

    if (sd.layout === 'title') {
      slide.background = { color: C.greenDark };
      // แถบตกแต่งบน/ล่าง
      slide.addShape('rect', { x: 0, y: 0, w: '100%', h: 0.25, fill: { color: C.green } });
      slide.addShape('rect', { x: 0, y: 7.25, w: '100%', h: 0.25, fill: { color: C.green } });
      // โลโก้ CPF
      slide.addShape('roundRect', { x: 6.06, y: 1.15, w: 1.2, h: 1.2, rectRadius: 0.18, fill: { color: C.green }, line: { color: C.greenLt, width: 1.5 } });
      slide.addText('CPF', { x: 6.06, y: 1.15, w: 1.2, h: 1.2, color: C.white, fontFace: F, fontSize: 26, bold: true, align: 'center', valign: 'middle' });
      slide.addText(deck.org || 'CPF ธารเกษม', { x: 0.5, y: 2.55, w: 12.3, h: 0.5, color: C.greenLt, fontFace: F, fontSize: 20, bold: true, align: 'center' });
      slide.addText(sd.title || '', { x: 0.5, y: 3.05, w: 12.3, h: 1.0, color: C.white, fontFace: F, fontSize: 40, bold: true, align: 'center' });
      slide.addShape('rect', { x: 5.67, y: 4.15, w: 2.0, h: 0.06, fill: { color: C.greenLt } });
      slide.addText(sd.subtitle || '', { x: 0.5, y: 4.35, w: 12.3, h: 0.6, color: 'C8E6C9', fontFace: F, fontSize: 18, align: 'center' });
      slide.addText(sd.footer || '', { x: 0.5, y: 6.5, w: 12.3, h: 0.5, color: '9CCC9F', fontFace: F, fontSize: 12, align: 'center' });
      return;
    }

    band(slide, sd.title, sd.color);
    footer(slide, deck, page, total);

    if (sd.layout === 'kpi') {
      var items = sd.items || [];
      var n = items.length || 1;
      var mL = 0.45, gap = 0.3, top = 1.5, bh = 2.0;
      var bw = (13.33 - mL * 2 - gap * (n - 1)) / n;
      items.forEach(function (it, i) {
        var x = mL + i * (bw + gap);
        var clr = it.color || C.green;
        slide.addShape('roundRect', { x: x, y: top, w: bw, h: bh, rectRadius: 0.08, fill: { color: C.white }, line: { color: C.line, width: 0.75 }, shadow: CARD_SHADOW });
        // แถบสีด้านบนการ์ด
        slide.addShape('roundRect', { x: x, y: top, w: bw, h: 0.16, rectRadius: 0.04, fill: { color: clr } });
        slide.addText(String(it.label || '').toUpperCase(), { x: x + 0.22, y: top + 0.34, w: bw - 0.4, h: 0.5, color: C.grey, fontFace: F, fontSize: 12, bold: true });
        slide.addText(String(it.value), { x: x + 0.22, y: top + 0.82, w: bw - 0.4, h: 0.7, color: clr, fontFace: F, fontSize: 28, bold: true });
        if (it.sub) slide.addText(it.sub, { x: x + 0.22, y: top + 1.55, w: bw - 0.4, h: 0.4, color: C.grey, fontFace: F, fontSize: 11 });
      });
      if (sd.note) {
        // pptxgenjs ต้องการ array ของ object {text, options} — แปลงจาก array ของ string ก่อน
        var noteText = Array.isArray(sd.note)
          ? sd.note.map(function (t) { return { text: String(t), options: {} }; })
          : String(sd.note);
        slide.addText(noteText, { x: mL, y: 4.0, w: 12.4, h: 2.6, color: C.ink, fontFace: F, fontSize: 14, bullet: { code: '2022' }, lineSpacingMultiple: 1.3, valign: 'top' });
      }
      return;
    }

    if (sd.layout === 'image') {
      // การ์ดพื้นหลังเต็มพื้นที่ + กราฟจัดกึ่งกลาง (ที่ว่างดูตั้งใจออกแบบ)
      var aw = 12.43, ah = 5.4, atop = 1.2;
      slide.addShape('roundRect', { x: 0.45, y: atop, w: aw, h: ah, rectRadius: 0.06, fill: { color: 'F7FAF7' }, line: { color: C.line, width: 0.75 } });
      var fit = fitBox(aw - 0.7, ah - 0.6, (sd.image && sd.image.ratio) || 1.6);
      var ix = (13.33 - fit.w) / 2, iy = atop + (ah - fit.h) / 2;
      if (sd.image) slide.addImage({ data: sd.image.image, x: ix, y: iy, w: fit.w, h: fit.h });
      if (sd.caption) slide.addText(sd.caption, { x: 0.45, y: 6.55, w: 12.43, h: 0.4, color: C.grey, fontFace: F, fontSize: 12, align: 'center' });
      return;
    }

    if (sd.layout === 'imageTable') {
      // ซ้าย: การ์ดกราฟ (จัดกึ่งกลาง) / ขวา: ตาราง
      var iw = 6.05, ih = 5.4, ix0 = 0.45, iy0 = 1.2;
      slide.addShape('roundRect', { x: ix0, y: iy0, w: iw, h: ih, rectRadius: 0.06, fill: { color: 'F7FAF7' }, line: { color: C.line, width: 0.75 } });
      if (sd.image) {
        var f2 = fitBox(iw - 0.5, ih - 0.5, sd.image.ratio || 1.4);
        slide.addImage({ data: sd.image.image, x: ix0 + (iw - f2.w) / 2, y: iy0 + (ih - f2.h) / 2, w: f2.w, h: f2.h });
      }
      if (sd.table) styledTable(slide, sd.table, { x: 6.85, y: 1.2, w: 6.03 });
      return;
    }

    if (sd.layout === 'twoImage') {
      var cw = 6.05, ch = 4.5, cy = 1.55;
      if (sd.left) {
        slide.addText(sd.leftTitle || '', { x: 0.45, y: 1.1, w: cw, h: 0.4, color: C.green, fontFace: F, fontSize: 14, bold: true, align: 'center' });
        slide.addShape('roundRect', { x: 0.45, y: cy, w: cw, h: ch, rectRadius: 0.06, fill: { color: 'F7FAF7' }, line: { color: C.line, width: 0.75 } });
        var fl = fitBox(cw - 0.5, ch - 0.5, sd.left.ratio || 1.4);
        slide.addImage({ data: sd.left.image, x: 0.45 + (cw - fl.w) / 2, y: cy + (ch - fl.h) / 2, w: fl.w, h: fl.h });
      }
      if (sd.right) {
        slide.addText(sd.rightTitle || '', { x: 6.83, y: 1.1, w: cw, h: 0.4, color: C.blue, fontFace: F, fontSize: 14, bold: true, align: 'center' });
        slide.addShape('roundRect', { x: 6.83, y: cy, w: cw, h: ch, rectRadius: 0.06, fill: { color: 'F7FAF7' }, line: { color: C.line, width: 0.75 } });
        var fr = fitBox(cw - 0.5, ch - 0.5, sd.right.ratio || 1.4);
        slide.addImage({ data: sd.right.image, x: 6.83 + (cw - fr.w) / 2, y: cy + (ch - fr.h) / 2, w: fr.w, h: fr.h });
      }
      return;
    }

    if (sd.layout === 'table') {
      styledTable(slide, sd.table, { x: 0.45, y: 1.3, w: 12.43 });
      if (sd.note) slide.addText(sd.note, { x: 0.45, y: 6.4, w: 12.4, h: 0.5, color: C.grey, fontFace: F, fontSize: 11 });
      return;
    }

    if (sd.layout === 'bullets') {
      slide.addText((sd.bullets || []).map(function (b) { return { text: b, options: {} }; }),
        { x: 0.6, y: 1.4, w: 12.1, h: 5.0, color: C.ink, fontFace: F, fontSize: 16, bullet: { code: '2022', indent: 18 }, lineSpacingMultiple: 1.4, valign: 'top' });
      return;
    }
  }

  function exportDeck(deck) {
    return ensureLib().then(function () {
      var pptx = new PptxGenJS();
      pptx.defineLayout({ name: 'CPFWIDE', width: 13.33, height: 7.5 });
      pptx.layout = 'CPFWIDE';
      pptx.author = 'CPF ธารเกษม Dashboard';
      pptx.company = 'CPF';
      pptx.subject = deck.title || 'Dashboard';
      pptx.title = deck.title || 'CPF Dashboard';
      var total = (deck.slides || []).length;
      (deck.slides || []).forEach(function (sd, i) { renderSlide(pptx, sd, deck, i + 1, total); });
      return pptx.writeFile({ fileName: deck.fileName || 'CPF_Dashboard.pptx' });
    });
  }

  global.PPT = {
    ensureLib: ensureLib,
    chartImage: chartImage,
    export: exportDeck,
    colors: C
  };
})(window);
