/* =============================================================================
   views-analysis.js — Tab «Dashboard» (explorative BI grid) and
   Tab «Verlauf» (the immutable change log).
   ============================================================================= */

import {
  data, state, t, fmtMio, totals, loadStatus, cellValue,
  personLoad, personUtilisation, filteredProjects,
  periods, heatStep, personRows, sortPersonRows
} from './store.js';

import {
  html, raw, icons, pageHeader, pageActions, toolbar, activeFilterRow,
  columnChart, barList, kpiStrip, segmented,
  tokenPx, tone, yearRule, pinCls, pinLeft, sortableHead
} from './ui.js';

/* =============================================================================
   Dashboard
   ========================================================================== */

/* The KPI strip and the filters hold for both sections, so they stay above them. */
const BI_SECTIONS = [
  { value: 'general', label: 'Allgemein' },
  { value: 'people', label: 'Personen' }
];

export function renderDashboard() {
  const section = BI_SECTIONS.some(s => s.value === state.bi) ? state.bi : 'general';

  return html`
    ${pageHeader({
      crumbs: ['Bauprojekte', 'Dashboard'],
      title: 'Ressourcenplanung',
      actions: pageActions()
    })}
    <div class="wrap"><div class="content">
      ${toolbar()}
      ${activeFilterRow()}
      ${kpiStrip()}
      <div class="bibar">${segmented(BI_SECTIONS, section, 'bi')}</div>
      ${section === 'people' ? personSection() : html`<div class="bi-grid">
        ${utilisationCard()}
        ${phaseCountCard()}
        ${portfolioCard()}
        ${creditPhaseCard()}
        ${creditYearCard()}
      </div>`}
    </div></div>`;
}

/* =============================================================================
   «Personen» — the same grid the Übersicht uses, with people as the rows
   ========================================================================== */

/**
 * Person utilisation runs to 245 %, where the project ramp tops out at 120 —
 * reused unchanged it put 64 % of the table into its two darkest steps and
 * flattened 120 % and 245 % into one blue. Same five tokens, own thresholds.
 */
const personHeat = v => (v === 0 ? 0 : v <= 80 ? 1 : v <= 100 ? 2 : v <= 150 ? 3 : 4);

/** The frozen columns of the person table, in order, with their width token. */
const PERSON_COLS = [
  { key: 'name', token: '--person-col-name', grow: true },
  { key: 'role', token: '--person-col-role' },
  { key: 'employment', token: '--person-col-employment' },
  { key: 'projects', token: '--person-col-projects' },
  { key: 'peak', token: '--person-col-peak' }
];

function personLayout(cols) {
  const parts = [];
  const sticky = {};
  let offset = 0;
  for (const c of PERSON_COLS) {
    const w = tokenPx(c.token);
    sticky[c.key] = offset;
    offset += w;
    parts.push(c.grow ? `minmax(${w}px, 1fr)` : `${w}px`);
  }
  sticky.width = offset;
  sticky.last = PERSON_COLS.at(-1).key;

  const quarterW = tokenPx('--grid-quarter');
  parts.push(`repeat(${cols.length}, minmax(${quarterW}px, 1fr))`);
  return { tpl: parts.join(' '), minWidth: offset + quarterW * cols.length, sticky };
}

/** A sortable header cell for the person table. */
const personHead = (key, label, sticky, cls = '') => sortableHead({
  key, label, act: 'sort-person', cls: pinCls(sticky, key, cls),
  style: pinLeft(sticky, key),
  active: state.pSort === key, ascending: state.pDir === 'asc'
});

function personSection() {
  const cols = periods();
  const { tpl, minWidth, sticky } = personLayout(cols);
  const rows = sortPersonRows(personRows());
  // The one figure this table alone can give: how many people are over their
  // own contract, quarter by quarter.
  const overPerCol = cols.map((_, i) => rows.filter(r => r.leads && r.values[i] > 100).length);

  /* The frozen lead cells differ only in their class and their content. */
  const leadCell = (key, cls, body) => html`<span class="pcell ${cls} ${pinCls(sticky, key)}"
      style="${pinLeft(sticky, key)}">${body}</span>`;

  return html`<section class="grid-card">
    <div class="scrollbox">
    <div class="pgrid" data-scroll>
      <div class="pgrid__track" style="min-width:${minWidth}px; --sticky-w:${sticky.width}px">
        <div class="pblock">
          <div class="prow prow--head" style="grid-template-columns:${raw(tpl)}">
            ${personHead('name', t('Person'), sticky)}
            ${personHead('role', t('Rolle'), sticky)}
            ${personHead('employment', t('Anst.'), sticky, 'pcell--num')}
            ${personHead('projects', t('Proj.'), sticky, 'pcell--num')}
            ${personHead('peak', t('Spitze'), sticky, 'pcell--num')}
            ${cols.map((col, i) => personHead(`q${i}`, col.short,
              sticky, `pcell--num ${col.isNow ? 'is-today' : ''} ${yearRule(col)}`))}
          </div>

          ${rows.map(r => html`<div class="prow" style="grid-template-columns:${raw(tpl)}">
            ${leadCell('name', 'pcell--title', html`<button type="button" class="prow__title"
                data-act="filter-lead" data-val="${r.person.id}"
                title="${t('Übersicht auf diese Person filtern')}">${r.person.name}</button>`)}
            ${leadCell('role', 'pcell--phase', t(r.person.role))}
            ${leadCell('employment', 'pcell--target', `${r.person.employment} %`)}
            ${leadCell('projects', 'pcell--target', r.leads || '—')}
            ${leadCell('peak', `pcell--target ${r.peak > 100 ? 'is-over' : ''}`,
              r.peak === null ? '—' : `${r.peak} %`)}
            ${cols.map((col, i) => {
              const v = r.values[i];
              const label = r.leads ? `${v} %` : '—';
              return html`<span class="pcell pcell--val ${r.leads ? `heat-${personHeat(v)}` : ''}
                  ${r.leads && v > 100 ? 'is-warn' : ''} ${yearRule(col)}"
                  title="${r.person.name}, ${col.label}: ${label} ${t('der Anstellung')}">${label}</span>`;
            })}
          </div>`)}
        </div>

        <div class="pblock pblock--foot">
          <div class="prow prow--load" style="grid-template-columns:${raw(tpl)}">
            <div style="grid-column:span 5" class="prow__sumlabel is-frozen">
              ${t('Personen über 100 %')}
              <span class="prow__sumnote">${data.people.length} ${t('Personen')} · ${
                data.people.reduce((a, p) => a + p.employment, 0)} % ${t('Anstellung')}</span>
            </div>
            ${overPerCol.map((v, i) => html`<span class="pcell pcell--load is-${v > 0 ? 'danger' : 'neutral'}
                ${yearRule(cols[i])}">
              <span class="pcell__pct">${v}</span>
            </span>`)}
          </div>
        </div>
      </div>
    </div>
    </div>
  </section>`;
}

/** Card shell with the kebab export menu the mockup puts on every card. */
function biCard(id, title, subtitle, body, { full = false, wide = false } = {}) {
  const open = state.menu === `card:${id}`;
  const menu = data.dashboard.cardMenu;
  return html`<section class="bi-card ${full ? 'bi-card--full' : ''} ${wide ? 'bi-card--wide' : ''}" id="card-${id}">
    <header class="bi-card__head">
      <div>
        <h2 class="bi-card__title">${t(title)}</h2>
        <p class="bi-card__sub">${subtitle}</p>
      </div>
      <div class="dd bi-card__tools">
        <button type="button" class="iconbtn ${open ? 'is-open' : ''}" data-act="menu" data-val="card:${id}"
                aria-expanded="${open}" aria-haspopup="menu"
                aria-label="${t('Karte exportieren oder teilen')}">${icons.kebab(15)}</button>
        ${open && html`<div class="dd__panel dd__panel--right" role="menu" style="width:212px">
          ${menu.items.map(label => html`<button type="button" class="dd__item" role="menuitem"
            data-act="export" data-val="${id}">${t(label)}</button>`)}
        </div>`}
      </div>
    </header>
    ${body}
  </section>`;
}

function utilisationCard() {
  const tot = totals();
  const util = data.quarters.map((q, i) => ({
    value: tot.utilisation[i],
    label: `${tot.utilisation[i]} %`,
    axis: `${q.short}/${String(q.year).slice(2)}`,
    tone: tone(tot.utilisation[i]),
    title: `${q.label} — ${t(loadStatus(tot.utilisation[i]).label)}`
  }));

  const maxFree = Math.max(1, ...tot.free.map(v => Math.max(v, 0)));
  const free = data.quarters.map((q, i) => {
    const v = tot.free[i];
    return {
      value: v > 0 ? v : null,
      label: v > 0 ? `${v} %` : '—',
      axis: `${q.short}/${String(q.year).slice(2)}`,
      tone: v > 0 ? 'ok' : 'defizit',
      title: v > 0 ? `${q.label}: ${v} % ${t('frei')}` : `${q.label}: ${Math.abs(v)} % ${t('Defizit')}`
    };
  });

  const from = data.quarters[0].label;
  const to = data.quarters[data.quarters.length - 1].label;

  return biCard('auslastung', 'Auslastung nach Quartal',
    `${t('Bedarf gegen Kapazität netto')}, ${from} – ${to}`,
    html`${columnChart(util, { height: 190, refAt: 100, refLabel: `${t('Kapazität')} 100 %` })}
      <div class="bi-card__section">
        <h3 class="bi-card__subtitle">${t('Freie Kapazität nach Quartal')}</h3>
        <p class="bi-card__sub">${t('Kapazität netto minus gebuchtem Bedarf')}</p>
        ${columnChart(free, { height: 120, max: maxFree, refAt: 0 })}
      </div>`,
    { full: true });
}

function phaseCountCard() {
  const list = filteredProjects();
  const rows = data.phases.main.map(m => {
    const n = list.filter(p => p.phase[0] === m.id).length;
    return { label: t(m.label), value: n, valueLabel: String(n) };
  });
  return biCard('phasen', 'Anzahl Projekte nach SIA-Phase',
    `${list.length} ${t('Projekte im gesetzten Umfang')}`,
    barList(rows, { max: Math.max(1, ...rows.map(r => r.value)) }));
}

/* Replaced by the «Personen» section — kept for reference during the rebuild. */
// eslint-disable-next-line no-unused-vars
function personCard() {
  const q0 = data.quarters[0];
  const rows = data.people.map(p => {
    const load = personLoad(p.id, 0);
    const util = personUtilisation(p.id, 0);
    const over = util > 100;
    return {
      label: p.name,
      value: load,
      valueLabel: `${load} % ${t('von')} ${p.employment} %`,
      tone: over ? 'danger' : 'accent',
      note: over ? t('über der Anstellung') : `${p.employment - load} % ${t('frei')}`,
      noteTone: over ? 'danger' : null
    };
  });
  return biCard('people', 'Auslastung nach Person',
    `${q0.label} · ${t('Balken gegen die eigene Anstellung')}`,
    barList(rows, { max: Math.max(...rows.map(r => r.value)) * 1.1 }));
}

function portfolioCard() {
  const list = filteredProjects();
  const rows = data.meta.portfolios
    .map(pf => {
      const v = list.filter(p => p.portfolio === pf.id).reduce((a, p) => a + cellValue(p, 0), 0);
      return { label: t(pf.label), value: v, valueLabel: `${v} %` };
    })
    .filter(r => r.value > 0)
    .sort((a, b) => b.value - a.value);
  return biCard('portfolio', 'Bedarf nach Teilportfolio',
    `${data.quarters[0].label} · ${t('Pensum in %')}`,
    barList(rows, { gap: 10 }), { wide: true });
}

function creditYearCard() {
  const cfg = data.dashboard.creditByYear;
  const rows = cfg.rows.map(r => ({
    label: r.label, value: r.value, valueLabel: r.valueLabel, note: t(r.note)
  }));
  return biCard('kreditjahr', cfg.title, t(cfg.subtitle), barList(rows));
}

function creditPhaseCard() {
  const list = filteredProjects();
  const total = list.reduce((a, p) => a + (p.credit ?? 0), 0);
  const rows = data.phases.main
    .map(m => {
      const v = list.filter(p => p.phase[0] === m.id).reduce((a, p) => a + (p.credit ?? 0), 0);
      return { label: t(m.label), value: v, valueLabel: fmtMio(v) };
    })
    .sort((a, b) => b.value - a.value);
  return biCard('kreditphase', 'Kredit nach SIA-Phase',
    `${t('Gesamt')} ${fmtMio(total)} CHF · ${t('gebundene Mittel')}`,
    barList(rows, { gap: 10 }), { wide: true });
}

/* =============================================================================
   Verlauf — the change log
   ========================================================================== */

export function renderHistory() {
  const rows = visibleChanges();

  return html`
    ${pageHeader({
      crumbs: ['Bauprojekte', 'Verlauf'],
      title: 'Ressourcenplanung',
      actions: pageActions()
    })}
    <div class="wrap"><div class="content">
      ${toolbar({ attributes: false })}
      ${activeFilterRow()}

      <section class="table-card">
        <div class="log log--head">
          <span>${t('Datum')}</span><span>${t('Person')}</span><span>${t('Projekt')}</span>
          <span>${t('Feld')}</span><span>${t('Änderung')}</span><span>${t('Wert')}</span>
        </div>
        ${rows.length ? rows.map((c, i) => html`<div class="log ${i % 2 === 1 ? 'is-zebra' : ''}">
          <span class="log__date">${c.dateLabel}</span>
          <span>${c.actor}</span>
          <span class="log__project">${c.projectId
            ? html`<button type="button" class="linkbtn" data-act="open-project" data-val="${c.projectId}">${c.projectLabel}</button>`
            : c.projectLabel}</span>
          <span><span class="fieldtag">${t(c.field)}</span></span>
          <span class="log__change">${t(c.change)}</span>
          <span class="log__value">${t(c.value)}</span>
        </div>`) : html`<div class="log log--empty">${t('Keine Einträge im gesetzten Umfang.')}</div>`}
        <div class="log__foot">
          <span>1 – ${rows.length} ${t('von')} ${rows.length} ${t('Einträgen')}</span>
        </div>
      </section>
    </div></div>`;
}

/**
 * The log follows the same filters as every other tab. Entries that are not
 * tied to a project (absences, for example) always stay visible.
 */
function visibleChanges() {
  const ids = new Set(filteredProjects().map(p => p.id));
  const q = state.search.trim().toLowerCase();
  return data.changes.filter(c => {
    if (c.projectId && !ids.has(c.projectId)) return false;
    if (q) {
      const hay = `${c.projectLabel} ${c.actor} ${c.field} ${c.change} ${c.value}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}
