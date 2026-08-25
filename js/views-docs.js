/* =============================================================================
   views-docs.js — the two standalone screens that sit outside the tab bar:
   the API reference and the PDF print layout.

   Both use the shell without the KPI strip and without tabs, exactly as the
   mockup draws them.
   ============================================================================= */

import {
  data, state, t, num, unitSuffix, cellValue, projectDemand,
  personUtilisation, totals, loadStatus, heatStep, filteredProjects, activeFilters
} from './store.js';

import { html, raw, icons, pageHeader, exportMenu, phaseOf } from './ui.js';

/* =============================================================================
   API documentation
   ========================================================================== */

export function renderApi() {
  const api = data.api;
  return html`
    ${pageHeader({
      crumbs: ['Bauprojekte', 'API'],
      title: 'API-Dokumentation',
      chrome: false,
      actions: html`<button type="button" class="btn" data-act="noop">${t(api.spec)}</button>
        <span class="version-tag">${api.version}</span>`
    })}
    <div class="wrap"><div class="content">
      <div class="api-grid">
        <div class="api-col">
          ${api.groups.map(g => html`<section class="api-card">
            <header class="api-card__head">
              <h2 class="api-card__title">${t(g.title)}</h2>
              <p class="api-card__intro">${g.intro}</p>
            </header>
            ${g.endpoints.map(e => html`<div class="api-row">
              <span class="method method--${e.method.toLowerCase()}">${e.method}</span>
              <code class="api-row__path">${e.path}</code>
              <span class="api-row__desc">${e.description}</span>
            </div>`)}
          </section>`)}
        </div>

        <aside class="api-col api-col--side">
          ${api.panels.map(p => html`<section class="api-panel">
            <h2 class="api-card__title">${t(p.title)}</h2>
            ${p.lead && html`<p class="api-panel__lead">${p.lead}</p>`}
            <pre class="code"><code>${p.code}</code></pre>
            ${p.note && html`<p class="api-panel__note">${p.note}</p>`}
          </section>`)}
        </aside>
      </div>
    </div></div>`;
}

/* =============================================================================
   PDF print layout — «Drucklayout»
   ========================================================================== */

const SHEETS = [
  { id: 'hoch', label: 'A4 hoch', caption: 'Übersicht als PDF, A4 hoch', quarters: 4 },
  { id: 'quer', label: 'A4 quer', caption: 'Acht Quartale auf einem Blatt', quarters: 8 }
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
      <div class="sheetbar">
        <div class="segmented">
          ${SHEETS.map(s => html`<button type="button" class="${s.id === sheet.id ? 'is-on' : ''}"
            aria-pressed="${s.id === sheet.id}" data-act="sheet" data-val="${s.id}">${t(s.label)}</button>`)}
        </div>
      </div>
      <div class="mount">${printSheet(sheet)}</div>
    </div></div>`;
}

function printSheet(sheet) {
  const cfg = data.api.print;
  const all = filteredProjects();
  // How many rows the paper actually holds at a 26px row height.
  const perSheet = sheet.id === 'hoch' ? 24 : 14;
  const rows = all.slice(0, perSheet);
  const rest = all.length - rows.length;
  const quarters = data.quarters.slice(0, sheet.quarters);
  const tot = totals(all);
  const chips = activeFilters();
  // Portrait fits four quarters, so a longer period needs further sheets.
  const quarterSheets = Math.ceil(data.quarters.length / sheet.quarters);
  const pages = Math.max(1, Math.ceil(all.length / perSheet)) * quarterSheets;

  const cols = sheet.id === 'hoch'
    ? `64px minmax(0, 200px) 96px 92px 62px repeat(${sheet.quarters}, 54px)`
    : `78px minmax(0, 244px) 120px 112px 76px repeat(${sheet.quarters}, 50px)`;

  const span = 5;
  const numbers = (values, cls = '') => quarters.map((_, q) =>
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
          · ${quarters[0].label} – ${quarters[quarters.length - 1].label}${sheet.id === 'hoch' ? ' · Blatt 1' : ''}</div>
      </div>
      <div class="sheet__meta">
        <span>${t('Umfang')}: ${all.length} ${t('von')} ${data.meta.scope.total} ${t('Bauprojekten')}</span>
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

      ${rows.map(p => {
        const cells = projectDemand(p);
        const lead = p.leadId ? data.peopleById[p.leadId] : null;
        return html`<div class="sheet__row ${p.unassigned ? 'is-unassigned' : ''}">
          <span class="sheet__id">${p.number}</span>
          <span class="sheet__project">${p.title}</span>
          <span class="sheet__muted">${phaseOf(p.phase).label}</span>
          <span class="sheet__muted">${lead ? lead.name : t('nicht zugewiesen')}</span>
          <span class="sheet__num sheet__muted">${p.creditLabel}</span>
          ${quarters.map((_, q) => {
            const over = lead && personUtilisation(p.leadId, q) > 100;
            return html`<span class="sheet__cell heat-${heatStep(cells[q])}">${over && cells[q] > 0 ? '▲ ' : ''}${cells[q] ? num(cells[q]) : '–'}</span>`;
          })}
        </div>`;
      })}

      ${(rest > 0 || quarterSheets > 1) && html`<div class="sheet__row sheet__row--more">
        <span style="grid-column:span ${quarters.length + 5}">
          ${rest > 0 ? `… ${rest} ${t('weitere Zeilen auf dem nächsten Blatt')}` : ''}
          ${rest > 0 && quarterSheets > 1 ? ' · ' : ''}
          ${quarterSheets > 1 ? `${t('Quartale')} ${data.quarters[sheet.quarters].label} – ${data.quarters[data.quarters.length - 1].label} ${t('auf einem eigenen Blatt')}` : ''}
        </span>
      </div>`}

      <div class="sheet__row sheet__row--sum">
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
        ${quarters.map((_, q) => html`<span class="sheet__num is-${loadStatus(tot.utilisation[q]).key}">${tot.utilisation[q]} %</span>`)}
      </div>
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
      <span>${t('Blatt')} 1 ${t('von')} ${pages}</span>
    </footer>
  </article>`;
}
