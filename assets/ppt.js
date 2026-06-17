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

  function band(slide, title, color) {
    slide.addShape('rect', { x: 0, y: 0, w: '100%', h: 0.85, fill: { color: color || C.green } });
    slide.addShape('rect', { x: 0, y: 0.85, w: '100%', h: 0.06, fill: { color: C.amber } });
    slide.addText(title || '', { x: 0.45, y: 0, w: 12.4, h: 0.85, color: C.white, fontFace: F, fontSize: 22, bold: true, valign: 'middle' });
  }
  function footer(slide, deck) {
    slide.addText((deck.org || 'CPF ธารเกษม') + '  •  ' + (deck.period || 'FY2569'),
      { x: 0.45, y: 7.05, w: 12.4, h: 0.35, color: C.grey, fontFace: F, fontSize: 9, align: 'right' });
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
    slide.addTable(data, {
      x: box.x, y: box.y, w: box.w,
      colW: t.widths,
      fontFace: F, fontSize: t.fontSize || 11,
      border: { type: 'solid', color: C.line, pt: 0.5 },
      valign: 'middle', rowH: t.rowH || 0.3, autoPage: false
    });
  }

  function renderSlide(pptx, sd, deck) {
    var slide = pptx.addSlide();

    if (sd.layout === 'title') {
      slide.background = { color: C.greenDark };
      slide.addShape('rect', { x: 0, y: 3.05, w: '100%', h: 0.07, fill: { color: C.amber } });
      slide.addText(deck.org || 'CPF ธารเกษม', { x: 0.5, y: 1.5, w: 12.3, h: 0.6, color: C.greenLt, fontFace: F, fontSize: 22, bold: true, align: 'center' });
      slide.addText(sd.title || '', { x: 0.5, y: 2.1, w: 12.3, h: 1.0, color: C.white, fontFace: F, fontSize: 40, bold: true, align: 'center' });
      slide.addText(sd.subtitle || '', { x: 0.5, y: 3.3, w: 12.3, h: 0.6, color: 'C8E6C9', fontFace: F, fontSize: 18, align: 'center' });
      slide.addText(sd.footer || '', { x: 0.5, y: 6.4, w: 12.3, h: 0.5, color: '9CCC9F', fontFace: F, fontSize: 12, align: 'center' });
      return;
    }

    band(slide, sd.title, sd.color);
    footer(slide, deck);

    if (sd.layout === 'kpi') {
      var items = sd.items || [];
      var n = items.length || 1;
      var mL = 0.45, gap = 0.3, top = 1.5, bh = 2.0;
      var bw = (13.33 - mL * 2 - gap * (n - 1)) / n;
      items.forEach(function (it, i) {
        var x = mL + i * (bw + gap);
        slide.addShape('roundRect', { x: x, y: top, w: bw, h: bh, rectRadius: 0.08, fill: { color: 'F7FAF7' }, line: { color: it.color || C.green, width: 1 } });
        slide.addShape('rect', { x: x, y: top, w: 0.08, h: bh, fill: { color: it.color || C.green } });
        slide.addText(it.label || '', { x: x + 0.2, y: top + 0.18, w: bw - 0.35, h: 0.5, color: C.grey, fontFace: F, fontSize: 12, bold: true });
        slide.addText(String(it.value), { x: x + 0.2, y: top + 0.7, w: bw - 0.35, h: 0.7, color: it.color || C.green, fontFace: F, fontSize: 26, bold: true });
        if (it.sub) slide.addText(it.sub, { x: x + 0.2, y: top + 1.45, w: bw - 0.35, h: 0.4, color: C.grey, fontFace: F, fontSize: 11 });
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
      var fit = fitBox(12.0, 5.0, (sd.image && sd.image.ratio) || 1.6);
      var ix = (13.33 - fit.w) / 2;
      if (sd.image) slide.addImage({ data: sd.image.image, x: ix, y: 1.25, w: fit.w, h: fit.h });
      if (sd.caption) slide.addText(sd.caption, { x: 0.45, y: 6.45, w: 12.4, h: 0.5, color: C.grey, fontFace: F, fontSize: 12, align: 'center' });
      return;
    }

    if (sd.layout === 'imageTable') {
      // ซ้าย: ภาพชาร์ต / ขวา: ตาราง
      if (sd.image) {
        var f2 = fitBox(6.0, 4.8, sd.image.ratio || 1.4);
        slide.addImage({ data: sd.image.image, x: 0.5, y: 1.4 + (4.8 - f2.h) / 2, w: f2.w, h: f2.h });
      }
      if (sd.table) styledTable(slide, sd.table, { x: 6.9, y: 1.4, w: 6.0 });
      return;
    }

    if (sd.layout === 'twoImage') {
      if (sd.left) {
        var fl = fitBox(6.0, 4.6, sd.left.ratio || 1.4);
        slide.addText(sd.leftTitle || '', { x: 0.5, y: 1.15, w: 6.0, h: 0.4, color: C.green, fontFace: F, fontSize: 14, bold: true, align: 'center' });
        slide.addImage({ data: sd.left.image, x: 0.5 + (6.0 - fl.w) / 2, y: 1.6, w: fl.w, h: fl.h });
      }
      if (sd.right) {
        var fr = fitBox(6.0, 4.6, sd.right.ratio || 1.4);
        slide.addText(sd.rightTitle || '', { x: 6.85, y: 1.15, w: 6.0, h: 0.4, color: C.blue, fontFace: F, fontSize: 14, bold: true, align: 'center' });
        slide.addImage({ data: sd.right.image, x: 6.85 + (6.0 - fr.w) / 2, y: 1.6, w: fr.w, h: fr.h });
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
      (deck.slides || []).forEach(function (sd) { renderSlide(pptx, sd, deck); });
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
