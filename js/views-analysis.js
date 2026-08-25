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
  html, raw, icons, pageHeader, exportMenu, toolbar, activeFilterRow,
  columnChart, barList, kpiStrip, segmented,
} from './ui.js';

/* =============================================================================
   Dashboard
   ========================================================================== */

/* The KPI strip and the filters hold for both sections, so they stay above them. */
const BI_SECTIONS = [
  { value: 'allgemein', label: 'Allgemein' },
  { value: 'personen', label: 'Personen' }
];

export function renderDashboard() {
  const section = BI_SECTIONS.some(s => s.value === state.bi) ? state.bi : 'allgemein';

  return html`
    ${pageHeader({
      crumbs: ['Bauprojekte', 'Dashboard'],
      title: 'Ressourcenplanung',
      actions: html`${exportMenu()}
        <button type="button" class="btn" data-act="share">${icons.share(14)}${t('Teilen')}</button>`
    })}
    <div class="wrap"><div class="content">
      ${toolbar()}
      ${activeFilterRow()}
      ${kpiStrip()}
      <div class="bibar">${segmented(BI_SECTIONS, section, 'bi')}</div>
      ${section === 'personen' ? personSection() : html`<div class="bi-grid">
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

/** Fixed widths in px, so every row can be told exactly how wide the track is. */
const P_COL = { name: 150, role: 130, employment: 70, projects: 60, peak: 76, quarter: 72 };

function personLayout(cols) {
  const lead = [
    ['name', `minmax(${P_COL.name}px, 1fr)`], ['role', `${P_COL.role}px`],
    ['employment', `${P_COL.employment}px`], ['projects', `${P_COL.projects}px`],
    ['peak', `${P_COL.peak}px`]
  ];
  const sticky = {};
  let offset = 0;
  for (const [key] of lead) { sticky[key] = offset; offset += P_COL[key]; }
  sticky.width = offset;
  sticky.last = 'peak';

  return {
    tpl: `${lead.map(([, track]) => track).join(' ')} repeat(${cols.length}, minmax(var(--grid-quarter), 1fr))`,
    minWidth: offset + P_COL.quarter * cols.length,
    sticky
  };
}

const pinCls = (s, k, extra = '') =>
  `${extra} is-frozen ${k === s.last ? 'is-frozen-last' : ''}`.trim();

/** A sortable header cell for the person table. */
function personHead(key, label, sticky, cls = '') {
  const active = state.pSort === key;
  const frozen = sticky[key] !== undefined;
  return html`<span class="pcell--text ${cls} ${frozen ? pinCls(sticky, key) : ''} ${active ? 'is-sorted' : ''}"
      style="${frozen ? `left:${sticky[key]}px` : ''}">
    <button type="button" class="sorthead" data-act="sort-person" data-val="${key}"
            aria-label="${t('Sortieren nach')} ${label}">
      <span class="sorthead__label">${label}</span>
      <span class="sorthead__dir" aria-hidden="true">${active ? (state.pDir === 'asc' ? '↑' : '↓') : ''}</span>
    </button>
  </span>`;
}

function personSection() {
  const cols = periods();
  const { tpl, minWidth, sticky } = personLayout(cols);
  const rows = sortPersonRows(personRows());
  // The one figure this table alone can give: how many people are over their
  // own contract, quarter by quarter.
  const overPerCol = cols.map((_, i) => rows.filter(r => r.leads && r.values[i] > 100).length);

  const pin = key => raw(`${pinCls(sticky, key)}" style="left:${sticky[key]}px`);

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
              sticky, `pcell--num ${col.isNow ? 'is-today' : ''} ${col.yearStart ? 'is-yearstart' : ''}`))}
          </div>

          ${rows.map(r => html`<div class="prow" style="grid-template-columns:${raw(tpl)}">
            <span class="pcell pcell--title ${pin('name')}">
              <button type="button" class="prow__title" data-act="filter-lead" data-val="${r.person.id}"
                      title="${t('Übersicht auf diese Person filtern')}">${r.person.name}</button>
            </span>
            <span class="pcell pcell--phase ${pin('role')}">${t(r.person.role)}</span>
            <span class="pcell pcell--target ${pin('employment')}">${r.person.employment} %</span>
            <span class="pcell pcell--target ${pin('projects')}">${r.leads || '—'}</span>
            <span class="pcell pcell--target ${r.peak > 100 ? 'is-over' : ''} ${pin('peak')}">${
              r.peak === null ? '—' : `${r.peak} %`}</span>
            ${cols.map((col, i) => {
              const v = r.values[i];
              const label = r.leads ? `${v} %` : '—';
              return html`<span class="pcell pcell--val ${r.leads ? `heat-${heatStep(v)}` : ''}
                  ${r.leads && v > 100 ? 'is-warn' : ''} ${col.yearStart ? 'is-yearstart' : ''}"
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
                ${cols[i].yearStart ? 'is-yearstart' : ''}">
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

function toneFor(pct) {
  if (pct >= 100) return 'ueberlast';
  if (pct >= 95) return 'knapp';
  if (pct >= 85) return 'ok';
  return 'frei';
}

function utilisationCard() {
  const tot = totals();
  const util = data.quarters.map((q, i) => ({
    value: tot.utilisation[i],
    label: `${tot.utilisation[i]} %`,
    axis: `${q.short}/${String(q.year).slice(2)}`,
    tone: toneFor(tot.utilisation[i]),
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
  return biCard('personen', 'Auslastung nach Person',
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
  return biCard('teilportfolio', 'Bedarf nach Teilportfolio',
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

export function renderVerlauf() {
  const rows = visibleChanges();

  return html`
    ${pageHeader({
      crumbs: ['Bauprojekte', 'Verlauf'],
      title: 'Ressourcenplanung',
      actions: html`${exportMenu()}
        <button type="button" class="btn" data-act="share">${icons.share(14)}${t('Teilen')}</button>`
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
          <span class="log__change">${c.change}</span>
          <span class="log__value">${c.value}</span>
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
