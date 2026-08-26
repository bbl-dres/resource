/* =============================================================================
   views-docs.js — the two standalone screens that sit outside the tab bar:
   the API reference and the PDF print layout.

   Both use the shell without the KPI strip and without tabs, exactly as the
   mockup draws them.
   ============================================================================= */

import {
  data, state, t, num, unitSuffix, cellValue, projectDemand, ampel, phaseOf, quarterPeriods,
  personUtilisation, totals, loadStatus, heatStep, filteredProjects, activeFilters,
  groupProjects
} from './store.js';

import {
  html, raw, attr, icons, pageHeader, exportMenu, toolbar, activeFilterRow, noResults,
  dropdown, menuRadio,
  scopeLine, AMPEL_STATES, legendBlock, legendItem, yearRule
} from './ui.js';
import { visibleColumns } from './columns.js';
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
const PAPERS = [
  { id: 'a4', label: 'A4' },
  { id: 'a3', label: 'A3' }
];

const ORIENTATIONS = [
  { id: 'portrait', label: 'Hoch' },
  { id: 'landscape', label: 'Quer' }
];

/* quarters per sheet, and the row budget per report, measured against the page */
const FORMATS = {
  'a4-portrait':  { quarters: 4, rows: { demand: 31, schedule: 28 } },
  'a4-landscape': { quarters: 8, rows: { demand: 18, schedule: 16 } },
  'a3-portrait':  { quarters: 8, rows: { demand: 46, schedule: 42 } },
  'a3-landscape': { quarters: 12, rows: { demand: 31, schedule: 28 } }
};

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
  return html`
    ${pageHeader({
      crumbs: ['Bauprojekte', 'Export'],
      title: 'PDF-Export — Drucklayout',
      chrome: false,
      actions: html`<button type="button" class="btn" data-act="tab" data-val="overview">${t('Abbrechen')}</button>
        <button type="button" class="btn btn--primary" data-act="print">${icons.download(15)}${t('Drucken')}</button>`
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
      ${filteredProjects().length
        ? html`<div class="mount">${printSheets(sheet, report)}</div>`
        : noResults('Bauprojekte')}
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
 * What a row costs in the page budget. A group heading carries a gap and a
 * repeated column head; on the bar plan that head is shorter, so it costs less.
 */
const ROW_COST = { group: 2.9, sum: 1, project: 1 };
const SCHEDULE_COST = { ...ROW_COST, group: 1.9, sum: 0 };
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
  for (let from = 0; from < data.quarters.length; from += sheet.quarters) {
    blocks.push(data.quarters.slice(from, from + sheet.quarters).map((_, i) => from + i));
  }
  // Every row is now one line high, so the page budget is a plain row count and
  // switching attributes on can no longer push a sheet past the paper.
  const pages = paginate(sheetRows(), perSheet,
    report.id === 'schedule' ? SCHEDULE_COST : ROW_COST);
  const total = blocks.length * pages.length + 1;   // + the method sheet

  let page = 0;
  const sheets = blocks.flatMap(block => pages.map((rows, i) => {
    page++;
    return printSheet(sheet, report, { rows, all, block, page, total, last: i === pages.length - 1 });
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
  ['Bedarf total',
   'Summe der Projektpensen je Quartal über den gesetzten Umfang. Steht ein Filter, zählt nur die Auswahl.'],
  ['Kapazität netto',
   'Kapazität brutto abzüglich Abwesenheiten. Brutto ist die Summe der Anstellungsgrade der Abteilung.'],
  ['Auslastung',
   'Bedarf des Gesamtportfolios abzüglich extern beauftragter Leistung, geteilt durch Kapazität netto. Die Zahl beschreibt immer die ganze Abteilung — auch wenn ein Filter gesetzt ist, denn Kapazität lässt sich nicht filtern.'],
  ['Ampel',
   'Höchste Auslastung der Projektleitung gegen die eigene Anstellung im dargestellten Zeitraum. Die Form trägt die Aussage, damit sie auch auf einer Fotokopie lesbar bleibt.'],
  ['Blaustufen',
   'Sie kodieren die Grösse eines Pensums, nicht seinen Status. Rot und das Dreieck ▲ kennzeichnen Überlast.']
];

const GLOSSARY = [
  ['Pensum', 'Arbeitsanteil in Prozent einer Vollzeitstelle. 100 % entspricht einer Person Vollzeit.'],
  ['Bedarf', 'Geplantes Pensum eines Projekts in einem Quartal.'],
  ['Extern beauftragt', 'Leistung, die nicht die eigene Abteilung erbringt; sie mindert den Bedarf an eigener Kapazität.'],
  ['Baukredit-Freigabe', 'Gate MS4. Davor ist ein Projekt planerisch, aber nicht finanziell gebunden — «vor Baukredit-Freigabe» weist diesen Anteil aus.'],
  ['SIA 112', 'Phasenmodell des Bauwesens: 1 Strategische Planung, 2 Vorstudien, 3 Projektierung, 4 Ausschreibung, 5 Realisierung, 6 Bewirtschaftung.'],
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
  return visibleColumns(state).map(c => ({
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
    case 'ampel': {
      const a = ampel(p.leadId, range);
      return html`<span class="ampel ampel--${a.key}" title="${a.title}"></span>`;
    }
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
function scheduleTable(rows, block, tot, last) {
  const cols = quarterPeriods(block[0], block.length);
  return html`<div class="sheet__gantt gantt" style="--gantt-cols:${cols.length}">
    ${rows.some(r => r.kind === 'group') ? '' : ganttAxisHead(cols)}
    ${rows.map(row => {
      if (row.kind === 'sum') return '';          // a bar plan has nothing to add up
      if (row.kind === 'group') {
        return html`<div class="sheet__grouphead">
          <span>${t(row.label)}</span>
          <span class="sheet__groupcount">${row.count} ${t('Projekte')}${
            row.continued ? ` · ${t('Fortsetzung')}` : ''}</span>
        </div>${ganttAxisHead(cols)}`;
      }
      return ganttRow(row.p, cols);
    })}
    ${last ? capacityRow(cols, tot) : continuation(0)}
  </div>`;
}

/** The axis, repeated above every group exactly as the column head is. */
const ganttAxisHead = (cols) => html`<header class="gantt__axis">
  <div class="gantt__axislabel">ID</div>
  <div class="gantt__axislabel">${t('Projekt')}</div>
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
    items: state.ampel
      ? AMPEL_STATES.filter(a => a.key !== 'none')
        .map(a => legendItem(html`<span class="ampel ampel--${a.key}"></span>`, a.label))
      : null
  },
  {
    label: 'Markierung',
    items: html`<span class="legend__item">${t(cfg.legend.marker)}</span>
      ${legendItem(html`<span class="legend__swatch is-nolead"></span>`, cfg.legend.noLead)}`
  },
  { label: 'Auslastung', items: html`${t(cfg.legend.thresholds).replace(/^Auslastung:\s*/, '')}` }
], 'legend--sheet');

/** The column header, repeated wherever the reader needs it again. */
/** True where a quarter opens a year, the way markYears() does it on screen. */
const yearBreak = (quarters, i) => (i === 0 || quarters[i].year !== quarters[i - 1].year ? 'is-yearstart' : '');

function columnHead(lead, quarters) {
  return html`<div class="sheet__row sheet__row--head">
    ${lead.map(c => html`<span class="${c.cls ?? ''}">${c.label}</span>`)}
    ${quarters.map((q, i) => html`<span class="sheet__num ${yearBreak(quarters, i)}">${q.short}/${String(q.year).slice(2)}</span>`)}
  </div>`;
}

function printSheet(sheet, report, { rows, all, block, page, total, last }) {
  const cfg = data.print;
  const quarters = block.map(q => data.quarters[q]);
  const tot = totals(all);
  const chips = activeFilters();
  const schedule = report.id === 'schedule';
  const lead = sheetColumns(sheet);

  // The bar plan needs only the two identifying columns; the rest of the width
  // is the time axis, which it draws itself.
  const cols = schedule
    ? `var(--grid-col-id) minmax(0, 1fr)`
    : lead.map(c => (c.flex ? `minmax(${c.w}px, 1fr)` : `minmax(0, ${c.w}px)`))
      .join(' ') + ` repeat(${block.length}, ${sheet.orientation === 'portrait' ? 54 : 50}px)`;

  const span = lead.length;
  const numbers = (values, cls = '') => block.map((q, i) =>
    html`<span class="sheet__num ${cls} ${yearBreak(quarters, i)}">${num(values[q])}</span>`);

  return html`<article class="sheet sheet--${sheet.paper} sheet--${sheet.orientation}" style="--sheet-cols:${raw(cols)}">
    <header class="sheet__head">
      <div class="sheet__sender">
        <img src="assets/swiss-logo-flag.svg" alt="" width="24" height="26">
        <div>${cfg.sender.map((line, i) => html`<span class="${i === 2 ? 'is-muted' : ''}">${t(line)}</span>`)}</div>
      </div>
      <div class="sheet__titles">
        <div class="sheet__title">${t('Ressourcenplanung')} — ${t(report.label)}</div>
        <div class="sheet__sub">${t(report.sub)}${schedule ? '' : ` · ${state.unit === 'fte' ? t('Pensum in FTE') : t('Pensum in %')}`}
          · ${quarters[0].label} – ${quarters[quarters.length - 1].label}</div>
      </div>
      <div class="sheet__meta">
        <span>${t('Umfang')}: ${scopeLine(all.length)}</span>
        <span>${t('Filter')}: ${chips.length ? chips.map(c => t(c.label)).join(', ') : t('keine')}
          · ${t('Einheit')}: ${state.unit === 'fte' ? 'FTE' : 'Pensum in %'}</span>
        <span>${t(cfg.classification)}</span>
      </div>
    </header>

    <div class="sheet__table">
      ${schedule ? scheduleTable(rows, block, tot, last)
        : html`${rows.some(r => r.kind === 'group') ? '' : columnHead(lead, quarters)}

      ${rows.map(row => {
        if (row.kind === 'group') {
          // A page can hold several groups, so each carries its own head.
          return html`<div class="sheet__row sheet__row--group">
            <span style="grid-column:span ${block.length + lead.length}">${t(row.label)}
              <span class="sheet__groupcount">${row.count} ${t('Projekte')}${
                row.continued ? ` · ${t('Fortsetzung')}` : ''}</span></span>
          </div>${columnHead(lead, quarters)}`;
        }
        if (row.kind === 'sum') {
          const values = block.map(q => row.projects.reduce((a, p) => a + projectDemand(p)[q], 0));
          return html`<div class="sheet__row sheet__row--groupsum">
            <span style="grid-column:span ${span}">${t('Summe')} ${t(row.label)}</span>
            ${values.map((v, i) => html`<span class="sheet__num ${yearBreak(quarters, i)}">${num(v)}</span>`)}
          </div>`;
        }

        const p = row.p;
        const cells = projectDemand(p);
        const who = p.leadId ? data.peopleById[p.leadId] : null;   // only for the overload marker
        return html`<div class="sheet__row ${p.leadId ? '' : 'is-unassigned'}">
          ${lead.map(c => html`<span class="${c.key === 'title' ? 'sheet__project' : `sheet__lead ${c.cls ?? ''}`}"
            >${sheetCell(c, p, { from: block[0], to: block.at(-1) })}</span>`)}
          ${block.map((q, i) => {
            const over = who && personUtilisation(p.leadId, q) > 100;
            return html`<span class="sheet__cell heat-${heatStep(cells[q])} ${yearBreak(quarters, i)}">${over && cells[q] > 0 ? '▲ ' : ''}${cells[q] ? num(cells[q]) : '–'}</span>`;
          })}
        </div>`;
      })}

      ${last ? html`<div class="sheet__row sheet__row--sum">
        <span style="grid-column:span ${span}">${t('Bedarf total')}</span>${numbers(tot.demand)}
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
        ${block.map((q, i) => html`<span class="sheet__num is-${loadStatus(tot.utilisation[q]).key} ${yearBreak(quarters, i)}">${tot.utilisation[q]} %</span>`)}
      </div>` : continuation(block.length + 5)}`}
    </div>

    ${schedule ? ganttLegend('legend--sheet') : demandLegend(cfg)}

    <footer class="sheet__foot">
      <span>${t('Erstellt am')} ${cfg.createdAt} ${t('durch')} ${cfg.createdBy} · ${t('Datenstand ePPM')}: ${cfg.syncedAt}</span>
      <span>${cfg.documentId}</span>
      <span>${t('Blatt')} ${page} ${t('von')} ${total}</span>
    </footer>
  </article>`;
}
