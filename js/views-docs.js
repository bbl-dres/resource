/* =============================================================================
   views-docs.js — the two standalone screens that sit outside the tab bar:
   the API reference and the PDF print layout.

   Both use the shell without the KPI strip and without tabs, exactly as the
   mockup draws them.
   ============================================================================= */

import {
  data, state, t, num, unitSuffix, cellValue, projectDemand,
  personUtilisation, totals, loadStatus, heatStep, filteredProjects, activeFilters,
  groupProjects
} from './store.js';

import {
  html, raw, icons, pageHeader, exportMenu, toolbar, activeFilterRow, phaseOf, scopeLine
} from './ui.js';

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
 * `rows` is how many the paper actually holds, not a guess. A4 hoch is 1131 px
 * tall at this scale less 56 px of padding, and the fixed furniture — letter
 * head 74, column header 24, legend 64, footer 24, plus 22 of table margin —
 * leaves about 840 px. At a 27 px row that is 31. A4 quer: 778 − 60 − 167 = 551, so 19.
 * A group heading costs 1.6 rows, because it carries a gap above it.
 */
const SHEETS = [
  { id: 'hoch', label: 'A4 hoch', caption: 'Übersicht als PDF, A4 hoch', quarters: 4, rows: 31 },
  { id: 'quer', label: 'A4 quer', caption: 'Acht Quartale auf einem Blatt', quarters: 8, rows: 19 }
];

export function renderExport() {
  const sheet = SHEETS.find(s => s.id === state.sheet) ?? SHEETS[0];
  return html`
    ${pageHeader({
      crumbs: ['Bauprojekte', 'Export'],
      title: 'PDF-Export — Drucklayout',
      chrome: false,
      actions: html`<button type="button" class="btn" data-act="tab" data-val="uebersicht">${t('Abbrechen')}</button>
        <button type="button" class="btn btn--primary" data-act="print">${icons.download(15)}${t('Drucken')}</button>`
    })}
    <div class="wrap"><div class="content">
      ${toolbar({ attributes: false })}
      ${activeFilterRow()}
      <div class="sheetbar">
        <div class="segmented">
          ${SHEETS.map(s => html`<button type="button" class="${s.id === sheet.id ? 'is-on' : ''}"
            aria-pressed="${s.id === sheet.id}" data-act="sheet" data-val="${s.id}">${t(s.label)}</button>`)}
        </div>
      </div>
      <div class="mount">${printSheets(sheet)}</div>
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
const ROW_COST = { group: 1.6, sum: 1, project: 1 };
const costOf = page => page.reduce((a, r) => a + ROW_COST[r.kind], 0);

function paginate(rows, perPage) {
  const pages = [];
  let page = [];
  let group = null;

  for (const row of rows) {
    if (row.kind === 'group') group = row;
    const cost = costOf(page);
    // A heading on the last line of a page belongs to the next one.
    const orphan = row.kind === 'group' && cost + ROW_COST.group > perPage;
    if (cost + ROW_COST[row.kind] > perPage || orphan) {
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

function printSheets(sheet) {
  const all = filteredProjects();
  const perSheet = sheet.rows;
  const blocks = [];
  for (let from = 0; from < data.quarters.length; from += sheet.quarters) {
    blocks.push(data.quarters.slice(from, from + sheet.quarters).map((_, i) => from + i));
  }
  const pages = paginate(sheetRows(), perSheet);
  const total = blocks.length * pages.length;

  let page = 0;
  return blocks.flatMap(block => pages.map((rows, i) => {
    page++;
    return printSheet(sheet, { rows, all, block, page, total, last: i === pages.length - 1 });
  }));
}

function printSheet(sheet, { rows, all, block, page, total, last }) {
  const cfg = data.print;
  const quarters = block.map(q => data.quarters[q]);
  const tot = totals(all);
  const chips = activeFilters();

  const cols = sheet.id === 'hoch'
    ? `64px minmax(0, 200px) 96px 92px 62px repeat(${block.length}, 54px)`
    : `78px minmax(0, 244px) 120px 112px 76px repeat(${block.length}, 50px)`;

  const span = 5;
  const numbers = (values, cls = '') => block.map(q =>
    html`<span class="sheet__num ${cls}">${num(values[q])}</span>`);

  return html`<article class="sheet sheet--${sheet.id}" style="--sheet-cols:${raw(cols)}">
    <header class="sheet__head">
      <div class="sheet__sender">
        <img src="assets/swiss-logo-flag.svg" alt="" width="24" height="26">
        <div>${cfg.sender.map((line, i) => html`<span class="${i === 2 ? 'is-muted' : ''}">${line}</span>`)}</div>
      </div>
      <div class="sheet__titles">
        <div class="sheet__title">${t(cfg.title)}</div>
        <div class="sheet__sub">${t('Pensum je Projekt und Quartal')} · ${state.unit === 'fte' ? t('Pensum in FTE') : t('Pensum in %')}
          · ${quarters[0].label} – ${quarters[quarters.length - 1].label}</div>
      </div>
      <div class="sheet__meta">
        <span>${t('Umfang')}: ${scopeLine(all.length)}</span>
        <span>${t('Filter')}: ${chips.length ? chips.map(c => t(c.label)).join(', ') : t('keine')}
          · ${t('Einheit')}: ${state.unit === 'fte' ? 'FTE' : 'Pensum in %'}</span>
        <span>${cfg.classification}</span>
      </div>
    </header>

    <div class="sheet__table">
      <div class="sheet__row sheet__row--head">
        <span class="sheet__id">ID</span>
        <span>${t('Projekt')}</span>
        <span>${t('SIA-Teilphase')}</span>
        <span>${t('Projektleitung')}</span>
        <span class="sheet__num">${t('Kredit CHF')}</span>
        ${quarters.map(q => html`<span class="sheet__num">${q.short}/${String(q.year).slice(2)}</span>`)}
      </div>

      ${rows.map(row => {
        if (row.kind === 'group') {
          return html`<div class="sheet__row sheet__row--group">
            <span style="grid-column:span ${block.length + 5}">${t(row.label)}
              <span class="sheet__groupcount">${row.count} ${t('Projekte')}${
                row.continued ? ` · ${t('Fortsetzung')}` : ''}</span></span>
          </div>`;
        }
        if (row.kind === 'sum') {
          const values = block.map(q => row.projects.reduce((a, p) => a + projectDemand(p)[q], 0));
          return html`<div class="sheet__row sheet__row--groupsum">
            <span style="grid-column:span ${span}">${t('Summe')} ${t(row.label)}</span>
            ${values.map(v => html`<span class="sheet__num">${num(v)}</span>`)}
          </div>`;
        }

        const p = row.p;
        const cells = projectDemand(p);
        const lead = p.leadId ? data.peopleById[p.leadId] : null;
        return html`<div class="sheet__row ${p.leadId ? '' : 'is-unassigned'}">
          <span class="sheet__id">${p.number}</span>
          <span class="sheet__project">${p.title}</span>
          <span class="sheet__muted">${phaseOf(p.phase).label}</span>
          <span class="sheet__muted">${lead ? lead.name : t('nicht zugewiesen')}</span>
          <span class="sheet__num sheet__muted">${p.creditLabel}</span>
          ${block.map(q => {
            const over = lead && personUtilisation(p.leadId, q) > 100;
            return html`<span class="sheet__cell heat-${heatStep(cells[q])}">${over && cells[q] > 0 ? '▲ ' : ''}${cells[q] ? num(cells[q]) : '–'}</span>`;
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
        ${block.map(q => html`<span class="sheet__num is-${loadStatus(tot.utilisation[q]).key}">${tot.utilisation[q]} %</span>`)}
      </div>` : html`<div class="sheet__row sheet__row--more">
        <span style="grid-column:span ${block.length + 5}">${t('Fortsetzung auf dem nächsten Blatt')}</span>
      </div>`}
    </div>

    <div class="sheet__legend">
      <span class="sheet__legendlabel">${t(cfg.legend.label)}</span>
      ${cfg.legend.steps.map(s => html`<span class="sheet__swatchitem">
        <span class="sheet__swatch heat-${s.step}"></span>${s.label}</span>`)}
      <span>${cfg.legend.marker}</span>
      <span class="sheet__swatchitem"><span class="sheet__swatch is-nolead"></span>${t(cfg.legend.noLead)}</span>
      <span>${t(cfg.legend.thresholds)}</span>
    </div>

    <footer class="sheet__foot">
      <span>${t('Erstellt am')} ${cfg.createdAt} ${t('durch')} ${cfg.createdBy} · ${t('Datenstand ePPM')}: ${cfg.syncedAt}</span>
      <span>${cfg.documentId}</span>
      <span>${t('Blatt')} ${page} ${t('von')} ${total}</span>
    </footer>
  </article>`;
}
