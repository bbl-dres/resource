/* =============================================================================
   pdf.js — a small PDF writer, and a translator from a rendered sheet to a page.

   Why this exists: the browser's print dialog cannot be steered from the page.
   A printer driver imposes its own paper size and its own unprintable margin,
   so an A3 sheet arrives scaled and letterboxed onto A4 — and no driver offers
   A0 at all. Chrome's own PDF writer honours @page exactly, but the user has to
   find it in the dialog and set four things correctly first.

   What it deliberately does NOT do: lay anything out. The sheets are already in
   the document at their true size, so every position here is read back from the
   layout engine. There is one layout, and this walks it.

   Scope is the sheets and nothing else — the handful of things they draw:
   filled boxes, hairlines, text runs, and four shapes the stylesheet makes out
   of a box (disc, ring, diamond, triangle).
   ============================================================================= */

/* PDF measures in points, the document in CSS pixels. */
const PT = 72 / 96;

/* -----------------------------------------------------------------------------
   Text encoding
   -------------------------------------------------------------------------- */

/*
 * WinAnsi covers every character the sheets use except «▲», which is drawn as a
 * path instead. Anything else unexpected becomes «?» rather than corrupting the
 * stream — a wrong glyph is a smaller failure than an unreadable file.
 */
const WIN_ANSI = {
  0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84, 0x2026: 0x85,
  0x2020: 0x86, 0x2021: 0x87, 0x02C6: 0x88, 0x2030: 0x89, 0x0160: 0x8A,
  0x2039: 0x8B, 0x0152: 0x8C, 0x017D: 0x8E, 0x2018: 0x91, 0x2019: 0x92,
  0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
  0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B, 0x0153: 0x9C,
  0x017E: 0x9E, 0x0178: 0x9F
};

const winAnsiByte = (code) => {
  if (code < 0x80) return code;
  if (code >= 0xA0 && code <= 0xFF) return code;
  return WIN_ANSI[code] ?? 0x3F;                       // '?'
};

/** A PDF string literal: WinAnsi bytes, with the three reserved ones escaped. */
function pdfString(text) {
  let out = '(';
  for (const ch of text) {
    const b = winAnsiByte(ch.codePointAt(0));
    const c = String.fromCharCode(b);
    out += (c === '(' || c === ')' || c === '\\') ? '\\' + c : c;
  }
  return out + ')';
}

/* -----------------------------------------------------------------------------
   Glyph widths — Helvetica and Helvetica-Bold, in 1/1000 em
   -------------------------------------------------------------------------- */

/*
 * Needed only to fit a run to the width the browser measured for it. The screen
 * font is Segoe UI or the platform's own; Helvetica sets a little differently,
 * and without a correction a project name would run into the column beside it.
 * Each run is scaled horizontally to the width the layout gave it, so the paper
 * cannot disagree with the preview about where a column starts.
 */
const ASCII_REGULAR = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584
];
const ASCII_BOLD = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
  975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556,
  333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611,
  611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584
];

/* An accented letter is set on the width of the letter it is built from. */
const ACCENT_BASE = {
  0xE4: 'a', 0xF6: 'o', 0xFC: 'u', 0xE9: 'e', 0xE8: 'e', 0xE0: 'a', 0xE7: 'c',
  0xC4: 'A', 0xD6: 'O', 0xDC: 'U', 0xC9: 'E', 0xDF: 's',
  0xAB: 'w', 0xBB: 'w', 0xB7: '.', 0x96: '-', 0x97: 'm', 0x85: 'm', 0x92: "'"
};

function glyphWidth(byte, bold) {
  const table = bold ? ASCII_BOLD : ASCII_REGULAR;
  if (byte >= 32 && byte <= 126) return table[byte - 32];
  const base = ACCENT_BASE[byte];
  if (base) return table[base.charCodeAt(0) - 32];
  return table[0];
}

/** How wide a run sets in Helvetica at `size`, in CSS pixels. */
function textWidth(text, size, bold) {
  let em = 0;
  for (const ch of text) em += glyphWidth(winAnsiByte(ch.codePointAt(0)), bold);
  return em / 1000 * size;
}

/* -----------------------------------------------------------------------------
   The document
   -------------------------------------------------------------------------- */

export function createPdf() {
  const objects = [''];                     // 1-based; index 0 is the free head
  const pages = [];

  const add = (body) => { objects.push(body); return objects.length - 1; };

  return {
    /** One page, its size in CSS pixels, and its content stream. */
    addPage(width, height, stream) {
      pages.push({ w: width * PT, h: height * PT, stream });
    },

    /** The finished file, as bytes. */
    build() {
      const fontRegular = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica '
        + '/Encoding /WinAnsiEncoding >>');
      const fontBold = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold '
        + '/Encoding /WinAnsiEncoding >>');
      const resources = `<< /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >> >>`;

      const pagesId = objects.length + pages.length * 2;
      const kids = [];
      for (const page of pages) {
        const content = add(`<< /Length ${page.stream.length} >>\nstream\n${page.stream}\nendstream`);
        kids.push(add(`<< /Type /Page /Parent ${pagesId + 1} 0 R `
          + `/MediaBox [0 0 ${round(page.w)} ${round(page.h)}] `
          + `/Resources ${resources} /Contents ${content} 0 R >>`));
      }
      const tree = add(`<< /Type /Pages /Kids [${kids.map(k => `${k} 0 R`).join(' ')}] `
        + `/Count ${kids.length} >>`);
      const catalog = add(`<< /Type /Catalog /Pages ${tree} 0 R >>`);

      let out = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
      const offsets = [0];
      for (let i = 1; i < objects.length; i++) {
        offsets[i] = out.length;
        out += `${i} 0 obj\n${objects[i]}\nendobj\n`;
      }
      const xref = out.length;
      out += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
      for (let i = 1; i < objects.length; i++) {
        out += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
      }
      out += `trailer\n<< /Size ${objects.length} /Root ${catalog} 0 R >>\n`
        + `startxref\n${xref}\n%%EOF\n`;

      const bytes = new Uint8Array(out.length);
      for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xFF;
      return bytes;
    }
  };
}

const round = (n) => Math.round(n * 100) / 100;

/* -----------------------------------------------------------------------------
   The content stream of one page
   -------------------------------------------------------------------------- */

/**
 * Collects drawing operators for one sheet. `height` is the sheet's height in
 * CSS pixels, needed because PDF counts y upwards from the bottom of the page.
 */
export function pageStream(height) {
  const ops = [];
  const y = (top) => round((height - top) * PT);
  const x = (left) => round(left * PT);

  return {
    fill(left, top, w, h, colour) {
      if (!colour || w <= 0 || h <= 0) return;
      ops.push(`${colour} rg`, `${x(left)} ${y(top + h)} ${round(w * PT)} ${round(h * PT)} re f`);
    },

    line(x1, y1, x2, y2, colour, width) {
      if (!colour || width <= 0) return;
      ops.push(`${colour} RG`, `${round(width * PT)} w`,
        `${x(x1)} ${y(y1)} m ${x(x2)} ${y(y2)} l S`);
    },

    /** A run of text, scaled horizontally to the width the layout gave it. */
    text(left, baseline, run, { size, bold, colour, width }) {
      if (!run.trim()) return;
      const natural = textWidth(run, size, bold);
      const scale = natural > 0 && width > 0 ? Math.min(100, width / natural * 100) : 100;
      ops.push('BT', `${colour} rg`, `/${bold ? 'F2' : 'F1'} ${round(size * PT)} Tf`,
        `${round(scale)} Tz`, `${x(left)} ${y(baseline)} Td`, `${pdfString(run)} Tj`, 'ET');
    },

    /** A closed path from points given in document coordinates. */
    shape(points, fill, stroke, width) {
      if (!points.length) return;
      const path = points.map(([px, py], i) => `${x(px)} ${y(py)} ${i ? 'l' : 'm'}`).join(' ');
      if (fill) ops.push(`${fill} rg`);
      if (stroke) ops.push(`${stroke} RG`, `${round((width || 1) * PT)} w`);
      ops.push(path, 'h', fill && stroke ? 'B' : fill ? 'f' : 'S');
    },

    /** A circle, as four Bézier arcs. */
    circle(cx, cy, r, fill, stroke, width) {
      const k = r * 0.5523;
      const px = (v) => x(v), py = (v) => y(v);
      if (fill) ops.push(`${fill} rg`);
      if (stroke) ops.push(`${stroke} RG`, `${round((width || 1) * PT)} w`);
      ops.push(
        `${px(cx - r)} ${py(cy)} m`,
        `${px(cx - r)} ${py(cy - k)} ${px(cx - k)} ${py(cy - r)} ${px(cx)} ${py(cy - r)} c`,
        `${px(cx + k)} ${py(cy - r)} ${px(cx + r)} ${py(cy - k)} ${px(cx + r)} ${py(cy)} c`,
        `${px(cx + r)} ${py(cy + k)} ${px(cx + k)} ${py(cy + r)} ${px(cx)} ${py(cy + r)} c`,
        `${px(cx - k)} ${py(cy + r)} ${px(cx - r)} ${py(cy + k)} ${px(cx - r)} ${py(cy)} c`,
        fill && stroke ? 'B' : fill ? 'f' : 'S');
    },

    /** Clip everything that follows to a box, until `restore()`. */
    clip(left, top, w, h) {
      ops.push('q', `${x(left)} ${y(top + h)} ${round(w * PT)} ${round(h * PT)} re W n`);
    },
    restore() { ops.push('Q'); },

    toString() { return ops.join('\n'); }
  };
}

/* -----------------------------------------------------------------------------
   From a rendered sheet to a page
   -------------------------------------------------------------------------- */

/** `rgb(r, g, b)` or `rgba(...)` as a PDF colour, or null when transparent. */
function colourOf(value) {
  const n = (value.match(/[\d.]+/g) ?? []).map(Number);
  if (n.length < 3) return null;
  if (n.length > 3 && n[3] === 0) return null;
  return n.slice(0, 3).map(v => round(v / 255)).join(' ');
}

/*
 * The one character the sheets use that WinAnsi has no room for. It marks an
 * overloaded lead, so it carries meaning and cannot simply be dropped — it is
 * drawn as the triangle it is.
 */
const UP_TRIANGLE = '\u25B2';

/** Where the baseline of a line box sits, measured from its top. */
function baselineIn(rect, size) {
  return rect.top + (rect.height - size) / 2 + size * 0.8;
}

/**
 * The lines a text node occupies. One range for the whole node in the common
 * case; a scan only where it actually wrapped, which on these sheets is the
 * method page and nothing else.
 */
function linesOf(node) {
  const range = document.createRange();
  range.selectNodeContents(node);
  const rects = range.getClientRects();
  if (rects.length <= 1) {
    const r = range.getBoundingClientRect();
    return r.width ? [{ text: node.nodeValue, rect: r }] : [];
  }

  const text = node.nodeValue;
  const out = [];
  let start = 0, top = null;
  for (let i = 1; i <= text.length; i++) {
    range.setStart(node, i - 1);
    range.setEnd(node, i);
    const r = range.getBoundingClientRect();
    if (!r.width && !r.height) continue;
    if (top === null) top = r.top;
    else if (Math.abs(r.top - top) > 1) {
      range.setStart(node, start);
      range.setEnd(node, i - 1);
      out.push({ text: text.slice(start, i - 1), rect: range.getBoundingClientRect() });
      start = i - 1;
      top = r.top;
    }
  }
  range.setStart(node, start);
  range.setEnd(node, text.length);
  const last = range.getBoundingClientRect();
  if (last.width) out.push({ text: text.slice(start), rect: last });
  return out;
}

/** The rotation a transform applies, in radians; 0 when there is none. */
function rotationOf(transform) {
  const m = transform.match(/matrix\(([^)]+)\)/);
  if (!m) return 0;
  const [a, b] = m[1].split(',').map(Number);
  return Math.atan2(b, a);
}

function drawElement(el, page, origin) {
  const cs = getComputedStyle(el);
  if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return;

  const r = el.getBoundingClientRect();
  const left = r.left - origin.left;
  const top = r.top - origin.top;
  const bg = colourOf(cs.backgroundColor);
  const border = colourOf(cs.borderTopColor);
  const angle = rotationOf(cs.transform);
  const radius = parseFloat(cs.borderTopLeftRadius) || 0;

  /* A box the stylesheet has turned into a mark: disc, ring or diamond. */
  const isMark = (bg || border) && r.width <= 20 && r.height <= 20
    && (angle !== 0 || radius >= Math.min(el.offsetWidth, el.offsetHeight) / 2);

  if (isMark) {
    const cx = left + r.width / 2;
    const cy = top + r.height / 2;
    const w = el.offsetWidth / 2;
    const h = el.offsetHeight / 2;
    const stroke = parseFloat(cs.borderTopWidth) || 0;
    if (angle !== 0) {
      const corners = [[-w, -h], [w, -h], [w, h], [-w, h]].map(([px, py]) => [
        cx + px * Math.cos(angle) - py * Math.sin(angle),
        cy + px * Math.sin(angle) + py * Math.cos(angle)
      ]);
      page.shape(corners, bg, stroke ? border : null, stroke);
    } else {
      page.circle(cx, cy, Math.min(w, h), bg, stroke ? border : null, stroke);
    }
  } else {
    if (bg) page.fill(left, top, r.width, r.height, bg);

    /* Each side that carries a rule. A hairline is a line, not a filled box. */
    const sides = [
      ['Top', left, top, left + r.width, top],
      ['Right', left + r.width, top, left + r.width, top + r.height],
      ['Bottom', left, top + r.height, left + r.width, top + r.height],
      ['Left', left, top, left, top + r.height]
    ];
    for (const [side, x1, y1, x2, y2] of sides) {
      const w = parseFloat(cs[`border${side}Width`]) || 0;
      if (!w || cs[`border${side}Style`] === 'none') continue;
      page.line(x1, y1, x2, y2, colourOf(cs[`border${side}Color`]), w);
    }
  }

  /* Text belonging to this element, line by line. */
  const size = parseFloat(cs.fontSize);
  const bold = Number(cs.fontWeight) >= 600;
  const colour = colourOf(cs.color) ?? '0 0 0';
  for (const node of el.childNodes) {
    if (node.nodeType !== Node.TEXT_NODE || !node.nodeValue.trim()) continue;
    for (const line of linesOf(node)) {
      const lx = line.rect.left - origin.left;
      const ly = baselineIn({ top: line.rect.top - origin.top, height: line.rect.height }, size);
      let run = line.text;
      if (run.includes(UP_TRIANGLE)) {
        /* Draw the mark, then set the rest of the run after it. */
        const s = size * 0.62;
        const base = ly - s * 0.15;
        page.shape([[lx, base], [lx + s, base], [lx + s / 2, base - s * 0.86]], colour, null, 0);
        run = run.replace(UP_TRIANGLE, ' ');
      }
      page.text(lx, ly, run, { size, bold, colour, width: line.rect.width });
    }
  }

  for (const kid of el.children) drawElement(kid, page, origin);
}

/** Every sheet in the preview, as one PDF file. */
export function sheetsToPdf(sheets) {
  const doc = createPdf();
  for (const sheet of sheets) {
    const box = sheet.getBoundingClientRect();
    const page = pageStream(box.height);
    drawElement(sheet, page, box);
    doc.addPage(box.width, box.height, page.toString());
  }
  return doc.build();
}
