/* =============================================================================
   export.js — the Übersicht as a file. CSV for anything that reads text, XLSX
   for Excel, both built from the same table so the two always agree.

   The table is whatever is on screen: the same columns, the same filters, the
   same grouping and sort, the same time scale. An export that quietly differs
   from the view it was taken from is worse than no export at all.
   ============================================================================= */

import {
  data, state, t, projectDemand, groupProjects, filteredProjects, columnSet,
  totals, periods, periodValue, loadStatus, activeFilters
} from './store.js';

import { scopeLine } from './ui.js';
import { visibleColumns } from './columns.js';

/* -----------------------------------------------------------------------------
   The table
   -------------------------------------------------------------------------- */

/** 'text' left-aligns, 'num' is a real number, 'pct' a number in percent points. */
function columns(cols) {
  const list = visibleColumns(columnSet()).map(c => ({
    key: c.key,
    // Two columns say something different on a spreadsheet than on screen:
    // the credit is a bare number in millions, and the target names its quarter.
    label: c.key === 'credit' ? `${t('Kredit')} ${t('Mio. CHF')}`
      : c.key === 'target' ? `${t('Soll')} ${data.quarters[0].short}`
        : t(c.label),
    type: c.xls.type,
    width: c.xls.width
  }));
  cols.forEach(period => list.push({ key: period.id, label: period.label, type: 'pct', width: 10 }));
  return list;
}

function projectCells(p, cols) {
  const demand = projectDemand(p);
  const row = {};
  for (const c of visibleColumns(columnSet())) row[c.key] = c.text ? c.text(p) : null;
  // Numbers must reach the workbook as numbers, not as the words the grid shows.
  row.id = p.number.replace('…', '');
  row.credit = p.credit ?? null;
  row.target = p.target;
  cols.forEach(period => { row[period.id] = periodValue(demand, period); });
  return row;
}

/**
 * Everything a writer needs, and nothing about how it is written.
 */
export function buildTable() {
  const cols = periods();
  const list = filteredProjects();
  const tot = totals(list);
  const filters = activeFilters();

  return {
    name: t('Ressourcenplanung'),
    subtitle: [
      `${data.meta.org.name} · ${data.meta.org.unit}`,
      data.meta.asOf,
      scopeLine(list.length),
      filters.length ? `${t('Filter')}: ${filters.map(f => f.label).join(', ')}` : t('ohne Filter')
    ].join(' · '),
    columns: columns(cols),
    groups: groupProjects(list).map(g => ({
      label: g.label,
      rows: g.projects.map(p => projectCells(p, cols))
    })),
    footer: [
      { label: t('Bedarf total'), values: cols.map(c => periodValue(tot.demand, c)) },
      { label: t('davon vor Baukredit-Freigabe'), values: cols.map(c => periodValue(tot.preCredit, c)) },
      { label: t('davon extern beauftragt'), values: cols.map(c => periodValue(tot.external, c)) },
      { label: t('Kapazität netto, nach Abwesenheiten'), values: cols.map(c => periodValue(tot.net, c)) },
      { label: t('Auslastung'), values: cols.map(c => periodValue(tot.utilisation, c)) }
    ],
    legend: cols.map(c => `${c.label}: ${t(loadStatus(periodValue(tot.utilisation, c)).label)}`).join(' · ')
  };
}

/** A file name that sorts by date and says which slice it holds. */
function fileName(ext) {
  const stamp = data.meta.today.replace(/-/g, '');
  const scope = state.scale;
  return `ressourcenplanung_${scope}_${stamp}.${ext}`;
}

function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoking straight away cancels the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return name;
}

/* -----------------------------------------------------------------------------
   CSV
   -------------------------------------------------------------------------- */

/*
 * Semicolons and a comma decimal mark: what Excel expects from a de-CH locale.
 * The BOM is what makes it open with the umlauts intact rather than as mojibake.
 */
const SEP = ';';

/*
 * A cell a spreadsheet will not run. Quoting does not defuse a formula —
 * Excel and Calc both evaluate a quoted cell that opens with = + - or @ — so
 * such a text cell is prefixed with a tab, which they strip on display.
 * Numbers take the other branch untouched, so a negative value stays negative.
 */
const RISKY = /^[=+\-@\t\r]/;
const csvCell = (value, type) => {
  if (value === null || value === undefined) return '';
  let text = type === 'text' ? String(value) : String(value).replace('.', ',');
  if (type === 'text' && RISKY.test(text)) text = '\t' + text;
  return /[";\r\n\t]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export function exportCsv() {
  const table = buildTable();
  const lines = [];
  const pad = table.columns.length - 1;

  lines.push(csvCell(table.name, 'text') + SEP.repeat(pad));
  lines.push(csvCell(table.subtitle, 'text') + SEP.repeat(pad));
  lines.push('');
  lines.push(table.columns.map(c => csvCell(c.label, 'text')).join(SEP));

  table.groups.forEach(group => {
    if (group.label) lines.push(csvCell(group.label, 'text') + SEP.repeat(pad));
    group.rows.forEach(row => {
      lines.push(table.columns.map(c => csvCell(row[c.key], c.type)).join(SEP));
    });
  });

  lines.push('');
  const lead = table.columns.length - periods().length;
  table.footer.forEach(row => {
    lines.push([csvCell(row.label, 'text'), ...Array(lead - 1).fill(''),
      ...row.values.map(v => csvCell(v, 'pct'))].join(SEP));
  });

  const blob = new Blob(['﻿' + lines.join('\r\n') + '\r\n'],
    { type: 'text/csv;charset=utf-8' });
  return download(blob, fileName('csv'));
}

/* -----------------------------------------------------------------------------
   XLSX
   -------------------------------------------------------------------------- */

/*
 * A real workbook, not an HTML table with a spreadsheet extension — Excel opens
 * one of those with a security warning, and this prototype is meant to show
 * what shipping looks like. An .xlsx is a ZIP of XML parts; entries are stored
 * uncompressed, which is a valid ZIP and saves pulling in a deflate library.
 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** ZIP wants MS-DOS date and time fields, so today's date goes in as one. */
function dosStamp(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return { date: ((y - 1980) << 9) | (m << 5) | d, time: (12 << 11) | (0 << 5) };
}

function zip(files, iso) {
  const enc = new TextEncoder();
  const { date, time } = dosStamp(iso);
  const chunks = [];
  const central = [];
  let offset = 0;

  const buf = (size) => {
    const b = new Uint8Array(size);
    return { b, v: new DataView(b.buffer) };
  };

  files.forEach(file => {
    const nameBytes = enc.encode(file.name);
    const body = enc.encode(file.body);
    const sum = crc32(body);

    const { b: local, v } = buf(30 + nameBytes.length);
    v.setUint32(0, 0x04034b50, true);
    v.setUint16(4, 20, true);          // version needed
    v.setUint16(6, 0x0800, true);      // UTF-8 names
    v.setUint16(8, 0, true);           // stored
    v.setUint16(10, time, true);
    v.setUint16(12, date, true);
    v.setUint32(14, sum, true);
    v.setUint32(18, body.length, true);
    v.setUint32(22, body.length, true);
    v.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);

    chunks.push(local, body);

    const { b: dir, v: dv } = buf(46 + nameBytes.length);
    dv.setUint32(0, 0x02014b50, true);
    dv.setUint16(4, 20, true);
    dv.setUint16(6, 20, true);
    dv.setUint16(8, 0x0800, true);
    dv.setUint16(10, 0, true);
    dv.setUint16(12, time, true);
    dv.setUint16(14, date, true);
    dv.setUint32(16, sum, true);
    dv.setUint32(20, body.length, true);
    dv.setUint32(24, body.length, true);
    dv.setUint16(28, nameBytes.length, true);
    dv.setUint32(42, offset, true);
    dir.set(nameBytes, 46);
    central.push(dir);

    offset += local.length + body.length;
  });

  const dirSize = central.reduce((a, c) => a + c.length, 0);
  const { b: end, v: ev } = buf(22);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, dirSize, true);
  ev.setUint32(16, offset, true);

  return new Blob([...chunks, ...central, end],
    { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

const xmlText = s => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* Element escaping leaves the quote alone, which is fine until the value is
   used in an attribute — as the worksheet name is. */
const xmlAttr = s => xmlText(s).replace(/"/g, '&quot;');

/* Excel's own rule for a worksheet name: 31 characters, and none of : \\ / ? * [ ] */
const sheetName = s =>
  String(s).replace(/[:\\/?*\[\]]/g, ' ').trim().slice(0, 31) || 'Export';

const colName = (n) => {
  let name = '';
  for (let i = n; i > 0; i = Math.floor((i - 1) / 26)) {
    name = String.fromCharCode(65 + ((i - 1) % 26)) + name;
  }
  return name;
};

/* Style ids, in the order they are declared in styles.xml below. */
const S = { plain: 0, title: 1, subtitle: 2, head: 3, group: 4, mio: 5, pct: 6, foot: 7, footPct: 8 };

function cell(col, rowNum, value, style, kind) {
  const ref = `${colName(col)}${rowNum}`;
  const s = style ? ` s="${style}"` : '';
  if (value === null || value === undefined || value === '') return `<c r="${ref}"${s}/>`;
  /* A numeric cell must hold a number. A credit arriving as "1'250'000"
     would otherwise go straight into <v>, and Excel refuses the workbook;
     anything that is not finite falls through to the escaped text branch. */
  if (kind === 'n' && Number.isFinite(Number(value))) {
    return `<c r="${ref}"${s}><v>${Number(value)}</v></c>`;
  }
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${xmlText(value)}</t></is></c>`;
}

function sheetXml(table) {
  const cols = table.columns;
  const rows = [];
  let n = 0;
  const push = (cells) => { rows.push(`<row r="${++n}">${cells.join('')}</row>`); };

  push([cell(1, n + 1, table.name, S.title)]);
  push([cell(1, n + 1, table.subtitle, S.subtitle)]);
  push([]);

  const headRow = n + 1;
  push(cols.map((c, i) => cell(i + 1, headRow, c.label, S.head)));

  table.groups.forEach(group => {
    if (group.label) {
      const r = n + 1;
      push([cell(1, r, group.label, S.group),
        ...cols.slice(1).map((_, i) => cell(i + 2, r, '', S.group))]);
    }
    group.rows.forEach(row => {
      const r = n + 1;
      push(cols.map((c, i) => {
        const v = row[c.key];
        if (c.type === 'text') return cell(i + 1, r, v, 0);
        if (v === null || v === undefined) return cell(i + 1, r, '', 0);
        return cell(i + 1, r, v, c.type === 'num' ? S.mio : S.pct, 'n');
      }));
    });
  });

  push([]);
  const lead = cols.length - periods().length;
  table.footer.forEach(row => {
    const r = n + 1;
    push([
      cell(1, r, row.label, S.foot),
      ...Array.from({ length: lead - 1 }, (_, i) => cell(i + 2, r, '', S.foot)),
      ...row.values.map((v, i) => cell(lead + i + 1, r, v, S.footPct, 'n'))
    ]);
  });

  const widths = cols.map((c, i) =>
    `<col min="${i + 1}" max="${i + 1}" width="${c.width}" customWidth="1"/>`).join('');

  // The lead columns and the header stay in view, exactly as they do on screen.
  const pane = `<pane xSplit="${lead}" ySplit="${headRow}" topLeftCell="${colName(lead + 1)}${headRow + 1}"`
    + ` activePane="bottomRight" state="frozen"/>`;

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetViews><sheetView workbookViewId="0" showGridLines="0">${pane}</sheetView></sheetViews>
<cols>${widths}</cols>
<sheetData>${rows.join('')}</sheetData>
</worksheet>`;
}

function stylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="2">
  <numFmt numFmtId="164" formatCode="#,##0.00&quot; Mio.&quot;"/>
  <numFmt numFmtId="165" formatCode="0&quot; %&quot;"/>
</numFmts>
<fonts count="5">
  <font><sz val="10"/><name val="Calibri"/></font>
  <font><b/><sz val="16"/><name val="Calibri"/></font>
  <font><sz val="9"/><color rgb="FF636B7A"/><name val="Calibri"/></font>
  <font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
  <font><b/><sz val="10"/><name val="Calibri"/></font>
</fonts>
<fills count="4">
  <fill><patternFill patternType="none"/></fill>
  <fill><patternFill patternType="gray125"/></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FF1D3557"/><bgColor indexed="64"/></patternFill></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FFEFF3F9"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="2">
  <border><left/><right/><top/><bottom/><diagonal/></border>
  <border><left/><right/><top style="thin"><color rgb="FFCED3DD"/></top><bottom/><diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="9">
  <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
  <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
  <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
  <xf numFmtId="0" fontId="3" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"
      applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
  <xf numFmtId="0" fontId="4" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
  <xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
  <xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
  <xf numFmtId="0" fontId="4" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"/>
  <xf numFmtId="165" fontId="4" fillId="0" borderId="1" xfId="0" applyNumberFormat="1"
      applyFont="1" applyBorder="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
}

export function exportXlsx() {
  const table = buildTable();
  const sheet = t('Übersicht');

  const files = [
    {
      name: '[Content_Types].xml',
      body: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`
    },
    {
      name: '_rels/.rels',
      body: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`
    },
    {
      name: 'xl/workbook.xml',
      body: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="${xmlAttr(sheetName(sheet))}" sheetId="1" r:id="rId1"/></sheets>
</workbook>`
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      body: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`
    },
    { name: 'xl/styles.xml', body: stylesXml() },
    { name: 'xl/worksheets/sheet1.xml', body: sheetXml(table) }
  ];

  return download(zip(files, data.meta.today), fileName('xlsx'));
}
