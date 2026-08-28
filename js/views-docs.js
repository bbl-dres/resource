/* =============================================================================
   views-docs.js — the two standalone screens that sit outside the tab bar:
   the API reference and the PDF print layout.

   Both use the shell without the KPI strip and without tabs, exactly as the
   mockup draws them.
   ============================================================================= */

import {
  data, state, t, num, unitSuffix, cellValue, projectDemand, ampel, printPeriods, columnSet,
  periodValue,
  totals, loadStatus, heatStep, filteredProjects, activeFilters,
  groupProjects
} from './store.js';

import {
  html, raw, attr, icons, pageHeader, toolbar, activeFilterRow, noResults,
  dropdown, menuRadio,
  scopeLine, AMPEL_STATES, legendBlock, legendItem, yearRule, ampelDot
} from './ui.js';
import { visibleColumns, leadLayout } from './columns.js';
import { ganttRow, ganttLegend } from './views-schedule.js';

/* =============================================================================
   API documentation
   ========================================================================== */

export function renderApi() {
  return html`
    ${pageHeader({
      crumbs: ['Bauprojekte', 'API'],
      title: 'API-Dokumentation',
      chrome: false,
      actions: html`<a class="btn" href="." data-act="home">
        ${icons.chevronLeft(15)}${t('Zurück')}</a>`
    })}
    <div class="wrap"><div class="content">
      <div id="swagger" data-swagger></div>
    </div></div>`;
}

/**
 * Swagger UI is a real widget, not markup: it mounts itself into the container
 * after the view has rendered. app.js calls this once the DOM is in place.
 */
export function mountSwagger() {
  const host = document.querySelector('[data-swagger]');
  if (!host || host.dataset.mounted) return;
  host.dataset.mounted = '1';

  loadSwagger()
    .then(() => window.SwaggerUIBundle({
      url: 'data/openapi.json',
      domNode: host,
      // The spec is the documentation; the operation list is the navigation.
      docExpansion: 'list',
      defaultModelsExpandDepth: 0,
      displayRequestDuration: false,
      // Nothing is served behind this prototype, so "Try it out" would only lie.
      supportedSubmitMethods: [],
      presets: [window.SwaggerUIBundle.presets.apis],
      layout: 'BaseLayout'
    }))
    .catch(error => {
      host.innerHTML = '';
      host.append(Object.assign(document.createElement('p'), {
        className: 'empty',
        textContent: `${t('Die API-Dokumentation konnte nicht geladen werden.')} ${error.message}`
      }));
    });
}

/** Load the vendored dist once, on first visit to the API tab. */
let swaggerReady = null;
function loadSwagger() {
  if (swaggerReady) return swaggerReady;
  const base = 'assets/vendor/swagger-ui/';
  swaggerReady = new Promise((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = base + 'swagger-ui.css';
    document.head.append(css);

    const js = document.createElement('script');
    js.src = base + 'swagger-ui-bundle.js';
    js.onload = resolve;
    js.onerror = () => reject(new Error('swagger-ui-bundle.js'));
    document.head.append(js);
  });
  return swaggerReady;
}

/* =============================================================================
   PDF print layout — «Drucklayout»
   ========================================================================== */

/*
 * `rows` is a budget in row-heights, not a row count: a group heading costs
 * more than a project (see ROW_COST). The numbers are measured, not guessed —
 * with the sheet rendered, the space left under the table is 65 px at the
 * tightest, so neither format can spill onto the paper's margin.
 */
/*
 * Two questions, not one: which sheet of paper, and which way round. The row
 * budgets follow the height, and the number of quarters follows the width —
 * that is the whole difference between a format and its neighbour.
 */
/* Up to A0: the large sheets are for a workshop wall, not for a desk. */
const PAPERS = ['a4', 'a3', 'a2', 'a1', 'a0'].map(id => ({ id, label: id.toUpperCase() }));

const ORIENTATIONS = [
  { id: 'portrait', label: 'Hoch' },
  { id: 'landscape', label: 'Quer' }
];

/*
 * The preview scale. «Anpassen» is the default because an A0 sheet is 3179px
 * wide and no screen shows one at its own size; the fixed steps are for reading
 * the small print, and the preview pans once a sheet is wider than the pane.
 */
/*
 * The report prints the plan at the same three grains the screen offers. Four
 * and a half years by month is 54 columns, which is what the large papers are
 * for.
 */
const SCALES = [
  { id: 'year', label: 'Jahr' },
  { id: 'quarter', label: 'Quartal' },
  { id: 'month', label: 'Monat' }
];

const ZOOMS = [
  { id: 'fit', label: 'Anpassen' },
  { id: '50', label: '50 %' },
  { id: '100', label: '100 %' },
  { id: '200', label: '200 %' },
  { id: '400', label: '400 %' }
];
const zoomLabel = () => (ZOOMS.find(z => z.id === state.zoom) ?? ZOOMS[0]).label;

/** What the downloaded file is called: the report, the paper, the way round. */
const fileName = (report, sheet) => (
  `Ressourcenplanung-${t(report.label)}-${sheet.paper.toUpperCase()}`
  + `-${t(sheet.orientation === 'landscape' ? 'Quer' : 'Hoch')}`
).replace(/[^\p{L}\p{N}.-]+/gu, '-') + '.pdf';   // \w drops the Umlaut

/*
 * Quarters per sheet, and the row budget per report, measured against the page.
 *
 * The budgets are not derived from the paper ladder. The ladder is √2, but the
 * letterhead, the legend and the footer are the same size on every format, so
 * the usable height grows faster than the sheet does.
 */
const FORMATS = {
  'a4-portrait':  { quarters: 4,  rows: { demand: 31, schedule: 28 } },
  'a4-landscape': { quarters: 8,  rows: { demand: 18, schedule: 16 } },
  'a3-portrait':  { quarters: 8,  rows: { demand: 46, schedule: 42 } },
  'a3-landscape': { quarters: 12, rows: { demand: 31, schedule: 28 } },
  'a2-portrait':  { quarters: 12, rows: { demand: 67,  schedule: 61 } },
  'a2-landscape': { quarters: 16, rows: { demand: 46,  schedule: 42 } },
  'a1-portrait':  { quarters: 16, rows: { demand: 96,  schedule: 88 } },
  'a1-landscape': { quarters: 20, rows: { demand: 67,  schedule: 61 } },
  'a0-portrait':  { quarters: 20, rows: { demand: 138, schedule: 126 } },
  'a0-landscape': { quarters: 24, rows: { demand: 96,  schedule: 88 } }
};

/*
 * One printed time column of the demand table, in px. Measured on a rendered
 * sheet; the table keeps this width and lets a wider sheet become margin.
 */
const sheetQuarter = (sheet) => (sheet.orientation === 'portrait' ? 54 : 50);

/*
 * The bar plan does not do that — its track is 1fr and fills the paper, which is
 * the point of a bar plan. So its column is whatever is left over, and the
 * label rule has to be told: a bar chooses its text against the width it has,
 * and told 54 where it had 132 it printed a number where the name fitted.
 *
 * The ISO series in px at 96 dpi, short edge, a4 through a0 — landscape simply
 * reads one step further along, because the long edge of one size is the short
 * edge of the next. Verified against all ten rendered combinations: the widths
 * this yields reproduce the measured column to the pixel in nine of ten and to
 * one pixel in the tenth.
 */
const PAPER_PX = [794, 1123, 1587, 2245, 3179, 4494];
const PAPER_ORDER = ['a4', 'a3', 'a2', 'a1', 'a0'];
const SHEET_PAD = 65;     // the sheet's own inset, both sides together

function ganttColumn(sheet, leadWidth, cols) {
  const step = PAPER_ORDER.indexOf(sheet.paper) + (sheet.orientation === 'landscape' ? 1 : 0);
  const paper = PAPER_PX[step] ?? PAPER_PX.at(-1);
  return cols ? Math.max(1, (paper - SHEET_PAD - leadWidth) / cols) : 0;
}

/*
 * Two reports off the same press. They share the letterhead, the scope line,
 * the pagination and the closing method sheet; they differ in what a row is —
 * a run of numbers, or a bar over the same quarters.
 */
const REPORTS = [
  { id: 'demand', label: 'Übersicht', sub: 'Pensum je Projekt und Quartal' },
  { id: 'schedule', label: 'Termine', sub: 'Phasen und Meilensteine je Projekt' }
];

export function renderExport() {
  const report = REPORTS.find(r => r.id === state.report) ?? REPORTS[0];
  const sheet = format();
  /* Nothing in scope means nothing to write: the button used to stay enabled
     over an empty report, where the click was a silent no-op. */
  const empty = !filteredProjects().length;
  return html`
    ${pageHeader({
      crumbs: ['Bauprojekte', 'Export'],
      title: 'PDF-Export — Drucklayout',
      chrome: false,
      actions: html`<button type="button" class="btn" data-act="tab" data-val="overview">${t('Abbrechen')}</button>
        <button type="button" class="btn" data-act="print">${t('Drucken')}</button>
        <button type="button" class="btn btn--primary" data-act="export-pdf"
          ${attr(state.exporting || empty, 'disabled')}
          data-val="${fileName(report, sheet)}">${icons.download(15)}${t(
            state.exporting ? 'PDF wird erstellt …' : 'PDF herunterladen')}</button>`
    })}
    <div class="wrap"><div class="content">
      ${toolbar({ exclude: ['trend'] })}
      ${activeFilterRow()}
      <div class="sheetbar">
        <div class="segmented">
          ${REPORTS.map(r => html`<button type="button" class="${r.id === report.id ? 'is-on' : ''}"
            aria-pressed="${r.id === report.id}" data-act="report" data-val="${r.id}">${t(r.label)}</button>`)}
        </div>
        <div class="sheetbar__paper">
          <div class="segmented">
            ${SCALES.map(s => html`<button type="button" class="${s.id === state.scale ? 'is-on' : ''}"
              aria-pressed="${s.id === state.scale}" data-act="scale" data-val="${s.id}">${t(s.label)}</button>`)}
          </div>
          ${dropdown({
            id: 'zoom', label: `${t('Ansicht')}: ${zoomLabel()}`, width: 180,
            body: html`${ZOOMS.map(z => menuRadio(t(z.label), state.zoom === z.id, 'zoom', z.id))}`
          })}
          ${dropdown({
            id: 'paper', label: `${t('Format')}: ${state.paper.toUpperCase()}`, width: 180,
            body: html`${PAPERS.map(p => menuRadio(p.label, state.paper === p.id, 'paper', p.id))}`
          })}
          <div class="segmented">
            ${ORIENTATIONS.map(o => html`<button type="button" class="${o.id === state.sheet ? 'is-on' : ''}"
              aria-pressed="${o.id === state.sheet}" data-act="sheet" data-val="${o.id}">${t(o.label)}</button>`)}
          </div>
        </div>
      </div>
      ${empty
        ? noResults('Bauprojekte')
        : html`<div class="mount">${printSheets(sheet, report)}</div>`}
    </div></div>`;
}

/*
 * A report prints everything. Portrait holds four quarters and 24 rows, so a
 * portfolio of this size needs a stack: every quarter block, and within each
 * block every page of rows. The totals close each block, the way a real
 * summary sheet does — not each page, which would invite reading a page total
 * as a portfolio total.
 */
/**
 * The sheet is a stream of rows, not a list of projects: the grouping from the
 * toolbar puts a heading before each group and a sum after it — the per-group
 * figures the grid leaves out because they belong on paper.
 */
function sheetRows() {
  const rows = [];
  for (const group of groupProjects()) {
    if (group.label) rows.push({ kind: 'group', label: group.label, count: group.projects.length });
    group.projects.forEach(p => rows.push({ kind: 'project', p }));
    if (group.label) rows.push({ kind: 'sum', label: group.label, projects: group.projects });
  }
  return rows;
}

/**
 * Break the stream into pages. A heading never ends a page, and a group that
 * runs over one carries its heading to the top of the next.
 */
/*
 * What a row costs in the page budget, in multiples of a project row.
 *
 * Measured against the rendered sheet, not estimated. A group heading brings a
 * repeated column head with it, so it is charged for both: on the pensum sheet
 * 1.41 + 0.89, on the bar plan 1.02 + 0.92. The bar plan's figure was right all
 * along; the pensum sheet was charging 2.9 for something costing 2.3, which is
 * why an A0 poster broke into two pages with 111 projects that fit on one.
 */
/* The width at which the longest project name sets in full at sheet size. */
const SHEET_TITLE_MAX = 320;

const ROW_COST = { group: 2.3, sum: 0.85, project: 1 };
const SCHEDULE_COST = { ...ROW_COST, group: 1.95, sum: 0 };
const rowCost = (row, cost = ROW_COST) => row.cost ?? cost[row.kind];
const costOf = (page, cost) => page.reduce((a, r) => a + rowCost(r, cost), 0);

function paginate(rows, perPage, costs = ROW_COST) {
  const pages = [];
  let page = [];
  let group = null;

  for (const row of rows) {
    if (row.kind === 'group') group = row;
    const cost = costOf(page, costs);
    // A heading on the last line of a page belongs to the next one.
    const orphan = row.kind === 'group' && cost + costs.group > perPage;
    if (cost + rowCost(row, costs) > perPage || orphan) {
      pages.push(page);
      page = group && row.kind === 'project' ? [{ ...group, continued: true }] : [];
    }
    page.push(row);
  }
  if (page.length) pages.push(page);

  /*
   * A sum belongs to rows the reader can see. If a break left one at the top of
   * a page on its own, pull the last row of the previous page along with it.
   */
  for (let i = 1; i < pages.length; i++) {
    while (pages[i][0]?.kind === 'sum' && pages[i - 1].length > 1) {
      pages[i].unshift(pages[i - 1].pop());
      if (pages[i][0].kind !== 'sum') break;
    }
  }
  return pages.length ? pages : [[]];
}

/** The chosen sheet of paper, the way round it is, and what fits on it. */
function format() {
  const key = `${state.paper}-${state.sheet}`;
  return { id: key, paper: state.paper, orientation: state.sheet, ...FORMATS[key] };
}

function printSheets(sheet, report) {
  const all = filteredProjects();
  const perSheet = sheet.rows[report.id];
  const blocks = [];
  const columns = printPeriods();
  for (let from = 0; from < columns.length; from += sheet.quarters) {
    blocks.push(columns.slice(from, from + sheet.quarters));
  }
  // Every row is now one line high, so the page budget is a plain row count and
  // switching attributes on can no longer push a sheet past the paper.
  const pages = paginate(sheetRows(), perSheet,
    report.id === 'schedule' ? SCHEDULE_COST : ROW_COST);
  const total = blocks.length * pages.length + 1;   // + the method sheet

  /*
   * The same for every sheet in the run, so they are worked out once rather
   * than per sheet. At month scale grouped by lead that was 270 calls where 30
   * were needed, and totals() walks the whole filtered portfolio each time.
   */
  const tot = totals(all);
  const chips = activeFilters();
  const lead = sheetColumns(sheet);

  let page = 0;
  const sheets = blocks.flatMap(block => pages.map((rows, i) => {
    page++;
    return printSheet(sheet, report, {
      rows, all, block, page, total, last: i === pages.length - 1, tot, chips, lead
    });
  }));
  sheets.push(methodSheet(sheet, { page: total, total }));
  return sheets;
}

/*
 * A report that leaves the building has to be readable without the application
 * next to it: how each figure is derived, and what the words mean.
 */
const METHOD = [
  ['Pensum ist eine Rate, kein Vorrat',
   'Ein Jahr zeigt den Durchschnitt seiner Quartale, ein Monat den Wert seines Quartals — nie eine Summe. 80 % über vier Quartale bleiben 80 %.'],
  ['Summe Total',
   'Summe der Projektpensen je Quartal über den gesetzten Umfang. Steht ein Filter, zählt nur die Auswahl.'],
  ['Kapazität netto',
   'Kapazität brutto abzüglich Abwesenheiten. Brutto ist die Summe der Anstellungsgrade der Abteilung.'],
  ['Auslastung',
   'Bedarf des Gesamtportfolios abzüglich extern beauftragter Leistung, geteilt durch Kapazität netto. Die Zahl beschreibt immer die ganze Abteilung — auch wenn ein Filter gesetzt ist, denn Kapazität lässt sich nicht filtern.'],
  ['Ampel',
   'Höchste Auslastung des Bearbeitenden gegen die eigene Anstellung im dargestellten Zeitraum. Die Form trägt die Aussage, damit sie auch auf einer Fotokopie lesbar bleibt.'],
  ['Blaustufen',
   'Sie kodieren die Grösse eines Pensums, nicht seinen Status. Rot kennzeichnet Überlast.']
];

const GLOSSARY = [
  ['Pensum', 'Arbeitsanteil in Prozent einer Vollzeitstelle. 100 % entspricht einer Person Vollzeit.'],
  ['Bedarf', 'Geplantes Pensum eines Projekts in einem Quartal.'],
  ['Extern beauftragt', 'Leistung, die nicht die eigene Abteilung erbringt; sie mindert den Bedarf an eigener Kapazität.'],
  ['Baukredit-Freigabe', 'Gate MS4. Davor ist ein Projekt planerisch, aber nicht finanziell gebunden — «vor Baukredit-Freigabe» weist diesen Anteil aus.'],
  ['Phase (ePPM)', 'Phasenmodell des Bauwesens nach SIA 112, wie ePPM es führt: 1 Strategische Planung, 2 Vorstudien, 3 Projektierung, 4 Ausschreibung, 5 Realisierung, 6 Bewirtschaftung.'],
  ['Meilenstein / Gate', 'Entscheidpunkt zwischen zwei Phasen, mit Plan- und Prognosetermin.'],
  ['Teilportfolio', 'Gebäudekategorie des BBL, etwa Verwaltung, Zoll oder Bauten im Ausland.'],
  ['Soll-Pensum', 'Vereinbartes Pensum im laufenden Quartal, zum Vergleich mit dem geplanten Bedarf.'],
  ['Überlast · knapp · ok · frei', 'Auslastung über 100 · 95 – 100 · 80 – 94 · darunter.']
];

function methodSheet(sheet, { page, total }) {
  const cfg = data.print;
  return html`<article class="sheet sheet--${sheet.paper} sheet--${sheet.orientation} sheet--method">
    <header class="sheet__head">
      <div class="sheet__sender">
        <img src="assets/swiss-logo-flag.svg" alt="" width="24" height="26">
        <div>${cfg.sender.map((line, i) => html`<span class="${i === 2 ? 'is-muted' : ''}">${t(line)}</span>`)}</div>
      </div>
      <div class="sheet__titles">
        <div class="sheet__title">${t('Methodik und Begriffe')}</div>
        <div class="sheet__sub">${t('Wie die Zahlen dieses Berichts entstehen')}</div>
      </div>
      <div class="sheet__meta">
        <span>${t('Datenstand ePPM')}: ${cfg.syncedAt}</span>
        <span>${t(cfg.classification)}</span>
      </div>
    </header>

    <div class="sheet__prose">
      <section>
        <h3>${t('Methodik')}</h3>
        <dl>${METHOD.map(([term, text]) => html`<dt>${t(term)}</dt><dd>${t(text)}</dd>`)}</dl>
      </section>
      <section>
        <h3>${t('Begriffe')}</h3>
        <dl>${GLOSSARY.map(([term, text]) => html`<dt>${t(term)}</dt><dd>${t(text)}</dd>`)}</dl>
      </section>
    </div>

    <p class="sheet__disclaimer">${t(data.meta.prototypeNotice)}</p>

    <footer class="sheet__foot">
      <span>${t('Erstellt am')} ${cfg.createdAt} ${t('durch')} ${cfg.createdBy}</span>
      <span>${cfg.documentId}</span>
      <span>${t('Blatt')} ${page} ${t('von')} ${total}</span>
    </footer>
  </article>`;
}

/*
 * The same attributes the grid offers, on paper. Widths are ceilings rather
 * than fixed tracks — minmax(0, n) lets the grid give space back when several
 * attributes are on at once, so the sheet never grows past the page.
 */
function sheetColumns(sheet) {
  const wide = sheet.orientation === 'landscape';
  return visibleColumns(columnSet()).map(c => ({
    key: c.key,
    // The sheet has room for the longer name where the grid header does not.
    label: c.key === 'target'
      ? `${t('Soll')} ${data.quarters[0].short}`
      : t(c.sheet.label ?? c.label),
    w: c.sheet.w[wide ? 1 : 0],
    cls: c.sheet.cls,
    flex: c.sheet.flex,
    text: c.text ?? (() => '')
  }));
}

/**
 * One project's value for a lead column, already formatted for paper. Most
 * columns are the registry's plain text; only these three draw something.
 */
function sheetCell(col, p, range) {
  switch (col.key) {
    case 'ampel': return ampelDot(p, range);
    case 'target': return `${num(p.target)}${unitSuffix()}`;
    default: return col.text(p) || '—';
  }
}

/** Said at the foot of every sheet whose table carries on. */
const continuation = (span) => html`<div class="sheet__row sheet__row--more">
  <span ${attr(span > 0, `style="grid-column:span ${span}"`)}>${t('Fortsetzung auf dem nächsten Blatt')}</span>
</div>`;

/**
 * The bar plan on paper. Rows come from the schedule view unchanged, so the
 * printed plan and the screen plan cannot drift apart; only the width of the
 * lead columns differs, and that is a stylesheet matter.
 */
function scheduleTable(rows, block, tot, last, sheet) {
  const cols = block;
  // Paper widths, not screen ones — the same numbers the printed table uses.
  const wide = sheet.orientation === 'landscape';
  const lay = leadLayout(columnSet(), {
    room: Infinity, axis: 0, widthOf: c => c.sheet.w[wide ? 1 : 0]
  });
  lay.tpl = [...lay.parts, 'minmax(0, 1fr)'].join(' ');
  /*
   * The bar labels are chosen against the width a bar actually has, so the sheet
   * has to say how wide one of its columns is. Without it every bar on paper
   * came out blank while the same row on screen was fully labelled.
   */
  lay.colWidth = ganttColumn(sheet, lay.width, cols.length);
  return html`<div class="sheet__gantt gantt"
      style="--gantt-cols:${cols.length};--gantt-lead:${lay.width}px">
    ${rows.some(r => r.kind === 'group') ? '' : ganttAxisHead(cols, lay)}
    ${rows.map(row => {
      if (row.kind === 'sum') return '';          // a bar plan has nothing to add up
      if (row.kind === 'group') {
        return html`<div class="sheet__grouphead">
          <span>${t(row.label)}</span>
          <span class="sheet__groupcount">${row.count} ${t('Projekte')}${
            row.continued ? ` · ${t('Fortsetzung')}` : ''}</span>
        </div>${ganttAxisHead(cols, lay)}`;
      }
      return ganttRow(row.p, cols, lay);
    })}
    ${last ? capacityRow(cols, tot) : continuation(0)}
  </div>`;
}

/** The axis, repeated above every group exactly as the column head is. */
const ganttAxisHead = (cols, lay) => html`<header class="gantt__axis"
    style="grid-template-columns:${raw(lay.tpl)}">
  ${lay.shown.map(c => html`<div class="gantt__axislabel">${t(c.sheet.label ?? c.label)}</div>`)}
  <div class="gantt__quarters">
    ${cols.map(col => html`<div class="${col.isNow ? 'is-today' : ''} ${yearRule(col)}">${col.short}</div>`)}
  </div>
</header>`;

/** The plan closes on the same figure the screen shows beneath it. */
const capacityRow = (cols, tot) => html`<div class="gantt__row gantt__row--load">
  <div class="gantt__rowlabel" style="grid-column: span 2">${t('Auslastung')}</div>
  <div class="gantt__track gantt__track--load">
    ${cols.map((col, n) => {
      const pct = tot.utilisation[col.quarters[0]];
      return html`<span class="capband__cell is-${loadStatus(pct).key} ${yearRule(col)}"
        style="grid-column:${n + 1}">${pct} %</span>`;
    })}
  </div>
</div>`;

/** What the numbers on the pensum sheet mean. */
const demandLegend = (cfg) => legendBlock([
  {
    label: 'Pensum',
    items: cfg.legend.steps.map(s => legendItem(html`<span class="legend__swatch heat-${s.step}"></span>`, s.label))
  },
  {
    label: 'Ampel',
    items: columnSet().ampel
      ? AMPEL_STATES.filter(a => a.key !== 'none')
        .map(a => legendItem(html`<span class="ampel ampel--${a.key}"></span>`, a.label))
      : null
  },
  {
    label: 'Markierung',
    items: legendItem(html`<span class="legend__swatch is-nolead"></span>`, cfg.legend.noLead)
  },
  { label: 'Auslastung', items: html`${t(cfg.legend.thresholds).replace(/^Auslastung:\s*/, '')}` }
], 'legend--sheet');

/** The column header, repeated wherever the reader needs it again. */
/** True where a quarter opens a year, the way markYears() does it on screen. */

function columnHead(lead, columns) {
  return html`<div class="sheet__row sheet__row--head">
    ${lead.map(c => html`<span class="${c.cls ?? ''}">${c.label}</span>`)}
    ${columns.map(col => html`<span class="sheet__num sheet__period ${yearRule(col)}">${col.short}</span>`)}
  </div>`;
}

function printSheet(sheet, report, { rows, all, block, page, total, last, tot, chips, lead }) {
  const cfg = data.print;
  const schedule = report.id === 'schedule';

  /*
   * Every column has a ceiling, and the table is only as wide as its columns
   * need. Left to stretch, the project name took every spare pixel: on an A0
   * poster it ran past 3000px while the figures beside it stayed at 50.
   *
   * The name is the one column that grows, and only to the width at which the
   * longest one sets in full. Letting the quarters grow too put them first —
   * eight tracks against one take eight ninths of any surplus — and a sheet
   * ended up with wide columns of two-digit numbers beside truncated names.
   * A sheet wider than the table keeps the difference as margin.
   */
  const quarter = sheetQuarter(sheet);
  const cols = schedule
    ? `var(--grid-col-id) minmax(0, 1fr)`
    : lead.map(c => (c.flex ? `minmax(${c.w}px, ${SHEET_TITLE_MAX}px)` : `minmax(0, ${c.w}px)`))
      .join(' ') + ` repeat(${block.length}, ${quarter}px)`;

  const span = lead.length;
  const numbers = (values, cls = '') => block.map(col =>
    html`<span class="sheet__num sheet__period ${cls} ${yearRule(col)}">${num(periodValue(values, col))}</span>`);

  return html`<article class="sheet sheet--${sheet.paper} sheet--${sheet.orientation}" style="--sheet-cols:${raw(cols)}">
    <header class="sheet__head">
      <div class="sheet__sender">
        <img src="assets/swiss-logo-flag.svg" alt="" width="24" height="26">
        <div>${cfg.sender.map((line, i) => html`<span class="${i === 2 ? 'is-muted' : ''}">${t(line)}</span>`)}</div>
      </div>
      <div class="sheet__titles">
        <div class="sheet__title">${t('Ressourcenplanung')} — ${t(report.label)}</div>
        <div class="sheet__sub">${t(report.sub)}${schedule ? '' : ` · ${state.unit === 'fte' ? t('Pensum in FTE') : t('Pensum in %')}`}
          · ${block[0].label} – ${block[block.length - 1].label}</div>
      </div>
      <div class="sheet__meta">
        <span>${t('Umfang')}: ${scopeLine(all.length)}</span>
        <span>${t('Filter')}: ${chips.length ? chips.map(c => t(c.label)).join(', ') : t('keine')}
          · ${t('Einheit')}: ${state.unit === 'fte' ? 'FTE' : 'Pensum in %'}</span>
        <span>${t(cfg.classification)}</span>
      </div>
    </header>

    <div class="sheet__table">
      ${schedule ? scheduleTable(rows, block, tot, last, sheet)
        : html`${rows.some(r => r.kind === 'group') ? '' : columnHead(lead, block)}

      ${rows.map(row => {
        if (row.kind === 'group') {
          // A page can hold several groups, so each carries its own head.
          return html`<div class="sheet__row sheet__row--group">
            <span style="grid-column:span ${block.length + lead.length}">${t(row.label)}
              <span class="sheet__groupcount">${row.count} ${t('Projekte')}${
                row.continued ? ` · ${t('Fortsetzung')}` : ''}</span></span>
          </div>${columnHead(lead, block)}`;
        }
        if (row.kind === 'sum') {
          /* cellValue, not projectDemand: the two agree, but projectDemand
             rebuilds the project's whole forty-quarter array on each of the
             forty iterations. The identical row on screen is already written
             this way (views-overview.js). */
          const values = data.quarters.map((_, q) =>
            row.projects.reduce((a, p) => a + cellValue(p, q), 0));
          return html`<div class="sheet__row sheet__row--groupsum">
            <span style="grid-column:span ${span}">${t('Summe')} ${t(row.label)}</span>
            ${block.map(col => html`<span class="sheet__num sheet__period ${yearRule(col)}">${num(periodValue(values, col))}</span>`)}
          </div>`;
        }

        const p = row.p;
        const cells = projectDemand(p);
        return html`<div class="sheet__row ${p.leadId ? '' : 'is-unassigned'}">
          ${lead.map(c => html`<span class="${c.key === 'title' ? 'sheet__project' : `sheet__lead ${c.cls ?? ''}`}"
            >${sheetCell(c, p, {
              from: block[0].quarters[0], to: block.at(-1).quarters.at(-1)
            })}</span>`)}
          ${block.map((col) => {
            const q = col.quarters[0];
            const v = periodValue(cells, col);
            return html`<span class="sheet__cell heat-${heatStep(v)} ${yearRule(col)}"><span class="cellv">${v ? num(v) : '–'}</span></span>`;
          })}
        </div>`;
      })}

      ${last ? html`<div class="sheet__row sheet__row--sum">
        <span style="grid-column:span ${span}">${t('Summe Total')}</span>${numbers(tot.demand)}
      </div>
      <div class="sheet__row sheet__row--foot">
        <span style="grid-column:span ${span}">${t('davon vor Baukredit-Freigabe')}</span>${numbers(tot.preCredit)}
      </div>
      <div class="sheet__row sheet__row--foot">
        <span style="grid-column:span ${span}">${t('davon extern beauftragt')}</span>${numbers(tot.external)}
      </div>
      <div class="sheet__row sheet__row--foot">
        <span style="grid-column:span ${span}">${t('Kapazität netto')}</span>${numbers(tot.net)}
      </div>
      <div class="sheet__row sheet__row--load">
        <span style="grid-column:span ${span}">${t('Auslastung')}</span>
        ${block.map(col => {
          const pct = periodValue(tot.utilisation, col);
          return html`<span class="sheet__num sheet__period is-${loadStatus(pct).key} ${yearRule(col)}">${pct} %</span>`;
        })}
      </div>` : continuation(block.length + 5)}`}
    </div>

    ${schedule ? ganttLegend('legend--sheet') : demandLegend(cfg)}

    <p class="sheet__disclaimer">${t(data.meta.prototypeNotice)}</p>

    <footer class="sheet__foot">
      <span>${t('Erstellt am')} ${cfg.createdAt} ${t('durch')} ${cfg.createdBy} · ${t('Datenstand ePPM')}: ${cfg.syncedAt}</span>
      <span>${cfg.documentId}</span>
      <span>${t('Blatt')} ${page} ${t('von')} ${total}</span>
    </footer>
  </article>`;
}
