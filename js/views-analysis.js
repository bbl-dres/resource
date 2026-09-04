/* =============================================================================
   views-analysis.js — Tab «Dashboard» (explorative BI grid) and
   Tab «Verlauf» (the immutable change log).
   ============================================================================= */

import {
  data, state, t, fmtMio, totals, loadStatus, cellValue,
  filteredProjects, visibleChanges,
  periods, periodValue, personRows, sortPersonRows, groupPeople, pageOf, chartTone, nowIndex, compareDe
} from './store.js';
import { card } from './views-overview.js';

import {
  html, raw, icons, pageHeader, pageActions, toolbar, activeFilterRow,
  columnCharts, barList, kpiStrip, segmented,
  tokenPx, yearRule, pinCls, pinLeft, sortableHead, attr, dropdown, menuRadio, menuGroupLabel, divider, changeProject,
  highlight
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
      actions: pageActions()
    })}
    <div class="wrap"><div class="content">
      ${toolbar(section === 'people' ? { time: true, groups: PEOPLE_GROUPS } : {})}
      ${activeFilterRow()}
      ${kpiStrip()}
      <div class="bibar">${segmented(BI_SECTIONS, section, 'bi')}</div>
      ${section === 'people' ? personSection() : html`<div class="bi-grid">
        ${utilisationCard()}
        ${phaseCountCard()}
        ${organisationCountCard()}
        ${portfolioCard()}
        ${organisationFteCard()}
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

/*
 * The alignment classes are the same ones columns.js hands the two planning
 * grids — a figure is flush right, a period column is centred, in every table.
 * This one is built by hand rather than from the registry, and so it simply
 * never applied them: the headers sat 8px from their right edge while the
 * numbers under them stood 35 to 53px away, and the quarter headers were flush
 * right over centred values.
 */

/** What a person can be grouped by — see groupPeople(). */
const PEOPLE_GROUPS = ['none', 'organisation'];

/** The frozen columns of the person table, in order, with their width token. */
const PERSON_COLS = [
  { key: 'name', token: '--person-col-name', grow: true },
  /* The same short form and width as the planning grid's column. */
  { key: 'organisation', token: '--grid-col-organisation' },
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

  /* The same floor and ceiling as the planning grid, so the two tables share
     a column width — and, past the ceiling, the name takes the slack. */
  const quarterW = tokenPx('--grid-period');
  parts.push(`repeat(${cols.length}, minmax(${quarterW}px, ${tokenPx('--grid-period-max')}px))`);
  return { tpl: parts.join(' '), minWidth: offset + quarterW * cols.length, sticky };
}

/** A sortable header cell for the person table. */
const personHead = (key, label, sticky, cls = '', title = '') => sortableHead({
  key, label, act: 'sort-person', cls: pinCls(sticky, key, cls),
  style: pinLeft(sticky, key), title,
  active: state.pSort === key, ascending: state.pDir === 'asc'
});

function personSection() {
  const cols = periods();
  const { tpl, minWidth, sticky } = personLayout(cols);
  const rows = sortPersonRows(personRows());
  const groups = groupPeople(rows);
  const span = PERSON_COLS.length;
  /*
   * A total adds up what is booked, not the percentages: a row's figure is a
   * share of that person's own contract, and a sum of shares of different
   * contracts says nothing. In FTE, which is what the booked pensum of a whole
   * office reads as.
   */
  const sumOf = list => cols.map(col => list.reduce((a, r) => a + periodValue(r.load, col), 0));

  /* The frozen lead cells differ only in their class and their content. */
  const leadCell = (key, cls, body, title = '') => html`<span class="pcell ${cls} ${pinCls(sticky, key)}"
      style="${pinLeft(sticky, key)}" title="${title}">${body}</span>`;

  const head = html`<div class="prow prow--head" style="grid-template-columns:${raw(tpl)}">
    ${personHead('name', t('Person'), sticky)}
    ${personHead('organisation', t('Organisation'), sticky)}
    ${personHead('employment', t('Anstellung'), sticky, 'pcell--num align-end')}
    ${personHead('projects', t('Projekte'), sticky, 'pcell--num align-end')}
    ${personHead('peak', t('Spitze'), sticky, 'pcell--num align-end', t('Höchste Auslastung im sichtbaren Zeitraum'))}
    ${cols.map((col, i) => personHead(`q${i}`, col.short,
      sticky, `pcell--num pcell--period align-center ${col.isNow ? 'is-today' : ''} ${yearRule(col)}`,
      /* The heading is a short form; the hint says the whole quarter, as on Planung. */
      col.isNow ? `${t('Heute')}, ${data.meta.todayLabel} — ${t('laufendes Quartal')}` : col.label))}
  </div>`;

  const personRow = r => {
    const org = data.organisationsById[r.person.organisation];
    return html`<div class="prow" style="grid-template-columns:${raw(tpl)}">
      ${leadCell('name', 'pcell--title', html`<button type="button" class="prow__title"
          data-act="filter-lead" data-val="${r.person.id}"
          title="${t('Übersicht auf diese Person filtern')}">${r.person.name}</button>`)}
      ${leadCell('organisation', 'pcell--phase', org ? t(org.short) : '—', org ? t(org.label) : '')}
      ${leadCell('employment', 'pcell--target align-end', `${r.person.employment} %`)}
      ${leadCell('projects', 'pcell--target align-end', r.leads || '—')}
      ${leadCell('peak', `pcell--target align-end ${r.peak > 100 ? 'is-over' : ''}`,
        r.peak === null ? '—' : `${r.peak} %`)}
      ${cols.map((col, i) => {
        const v = r.values[i];
        const label = r.leads ? `${v} %` : '—';
        return html`<span class="pcell pcell--val ${r.leads ? `heat-${personHeat(v)}` : ''}
            ${r.leads && v > 100 ? 'is-warn' : ''} ${yearRule(col)}"
            title="${r.person.name}, ${col.label}: ${label} ${t('der Anstellung')}">${label}</span>`;
      })}
    </div>`;
  };

  const sumRow = (label, note, list, cls = '') => html`<div class="prow prow--sum ${cls}"
      style="grid-template-columns:${raw(tpl)}">
    <div style="grid-column:span ${span}" class="prow__sumlabel is-frozen">
      ${label}${note && html`<span class="prow__sumnote">${note}</span>`}
    </div>
    ${sumOf(list).map((v, i) => html`<span class="pcell pcell--sum ${yearRule(cols[i])}">${fte(v)}</span>`)}
  </div>`;

  /* Built like the planning grid's groups: a heading on the page ground, the
     rows in a card under it, and the group's own sum closing the card. */
  const body = groups.map(g => {
    const collapsed = g.label ? state.collapsedGroups[g.key] : false;
    const heading = g.label && html`<h2 class="pgrouphead">
      <button type="button" class="pgrouphead__toggle"
              data-act="toggle-group" data-val="${g.key}" aria-expanded="${!collapsed}">
        <span class="caret ${collapsed ? 'is-collapsed' : ''}" aria-hidden="true">${icons.chevronDown()}</span>
        <span class="pgrouphead__name">${g.label}</span>
        <span class="count-pill">${g.rows.length}</span>
      </button>
    </h2>`;
    if (collapsed) return html`<section class="pgroup">${heading}</section>`;
    return html`<section class="pgroup">${heading}
      ${card(html`${head}${g.rows.map(personRow)}
        ${g.label && sumRow(`${t('Summe')} ${g.label} (${g.rows.length})`, '', g.rows, 'prow--groupsum')}`,
        { minWidth, sticky })}
    </section>`;
  });

  const foot = sumRow(t('Summe Total'), `${rows.length} ${t('Personen')} · ${t('Pensum in FTE')}`, rows);

  /*
   * The same cards as the planning grid — the groups and, under them, the
   * total — each wrapping its own scroller, so the frame stays put while the
   * quarters move and the fades sit on the frozen edge. The switches say the
   * table has no band: without them the figures kept a band's worth of room
   * under every number.
   */
  return html`<section class="grid-card is-bars-off is-gates-off">
    ${body}
    ${card(foot, { minWidth, sticky, cls: 'pblock--foot' })}
  </section>`;
}

/** Card shell with the kebab export menu the mockup puts on every card. */
/*
 * What a card's menu offers, and what each row does. The labels used to come
 * from dashboard.json and every row dispatched the card id as an export
 * format, so «Als CSV exportieren» and «Link teilen» both produced an Excel
 * file.
 */
const CARD_MENU = [
  { label: 'Als CSV exportieren', act: 'export', val: 'csv' },
  { label: 'Als Excel exportieren', act: 'export', val: 'xlsx' },
  { label: 'Link teilen', act: 'share' }
];

/*
 * How a card's bars are ordered: by category or by value, up or down. The
 * category is the label, compared the German way — except where the category
 * has an order of its own and a row says so with a `key`: the phase chain,
 * which the alphabet would open with «22» and close with «Vorstudien».
 */
const ordered = (id, rows) => {
  const { by = 'label', dir = 'asc' } = state.cardSort[id] ?? {};
  const cmp = by === 'value'
    ? (a, b) => a.value - b.value
    : (a, b) => (a.key !== undefined && b.key !== undefined ? a.key - b.key : compareDe(a.label, b.label));
  const sign = dir === 'asc' ? 1 : -1;
  /* «(nicht zugewiesen)» is not a category: sorted by category it closes the
     list whichever way the list runs. Sorted by value it takes its place. */
  const tail = by === 'label' ? rows.filter(r => r.tail) : [];
  const body = by === 'label' ? rows.filter(r => !r.tail) : rows;
  return body.sort((a, b) => cmp(a, b) * sign).concat(tail);
};

function biCard(id, title, subtitle, body, { full = false, sort = true } = {}) {
  const open = state.menu === `card:${id}`;
  const { by = 'label', dir = 'asc' } = state.cardSort[id] ?? {};
  return html`<section class="bi-card ${full ? 'bi-card--full' : ''}" id="card-${id}">
    <header class="bi-card__head">
      <div>
        <h2 class="bi-card__title">${t(title)}</h2>
        <p class="bi-card__sub">${subtitle}</p>
      </div>
      <div class="dd bi-card__tools">
        <button type="button" class="iconbtn ${open ? 'is-open' : ''}" data-act="menu" data-val="card:${id}"
                aria-expanded="${open}" aria-haspopup="menu"
                aria-label="${t('Karte sortieren, exportieren oder teilen')}">${icons.kebab(15)}</button>
        ${open && html`<div class="dd__panel dd__panel--right" role="menu" style="width:212px">
          ${sort && html`${menuGroupLabel(t('Sortieren nach'))}
            ${menuRadio(t('Kategorie'), by === 'label', 'card-sort', `${id}:by:label`)}
            ${menuRadio(t('Wert'), by === 'value', 'card-sort', `${id}:by:value`)}
            ${divider()}
            ${menuRadio(t('Aufsteigend'), dir === 'asc', 'card-sort', `${id}:dir:asc`)}
            ${menuRadio(t('Absteigend'), dir === 'desc', 'card-sort', `${id}:dir:desc`)}
            ${divider()}`}
          ${CARD_MENU.map(item => html`<button type="button" class="dd__item" role="menuitem"
            data-act="${item.act}" ${attr(item.val, `data-val="${item.val}"`)}>${t(item.label)}</button>`)}
        </div>`}
      </div>
    </header>
    ${body}
  </section>`;
}

function utilisationCard() {
  const tot = totals();
  const axis = q => `${q.short}/${String(q.year).slice(2)}`;
  const util = data.quarters.map((q, i) => ({
    value: tot.utilisation[i],
    label: `${tot.utilisation[i]} %`,
    axis: axis(q),
    tone: chartTone(tot.utilisation[i]),
    title: `${q.label} — ${t(loadStatus(tot.utilisation[i]).label)}`
  }));

  const maxFree = Math.max(1, ...tot.free.map(v => Math.max(v, 0)));
  const free = data.quarters.map((q, i) => {
    const v = tot.free[i];
    return {
      value: v > 0 ? v : null,
      label: v > 0 ? `${v} %` : '—',
      axis: axis(q),
      tone: v > 0 ? 'ok' : 'deficit',
      title: v > 0 ? `${q.label}: ${v} % ${t('frei')}` : `${q.label}: ${Math.abs(v)} % ${t('Defizit')}`
    };
  });

  const from = data.quarters[0].label;
  const to = data.quarters[data.quarters.length - 1].label;

  /* Two charts, one scroller: the ratio and the remainder read against the
     same quarters, so they scroll as one. */
  return biCard('auslastung', 'Auslastung nach Quartal',
    `${t('Pensum gegen Kapazität netto')}, ${from} – ${to}`,
    columnCharts([
      { rows: util, height: 190, refAt: 100, refLabel: `${t('Kapazität')} 100 %` },
      { rows: free, height: 120, max: maxFree, refAt: 0,
        title: 'Freie Kapazität nach Quartal', sub: 'Kapazität netto minus gebuchtem Pensum' }
    ]),
    { full: true, sort: false });
}

function phaseCountCard() {
  const list = filteredProjects();
  const rows = data.phases.eppm.map((e, key) => {
    const n = list.filter(p => p.phase === e.id).length;
    return { key, label: t(e.label), value: n, valueLabel: String(n) };
  });
  return biCard('phasen', 'Anzahl Projekte nach Phase (ePPM)',
    `${list.length} ${t('Projekte im gesetzten Umfang')}`,
    barList(ordered('phasen', rows), { max: Math.max(1, ...rows.map(r => r.value)) }));
}

function organisationCountCard() {
  const list = filteredProjects();
  const rows = data.meta.organisations.map(o => {
    const n = list.filter(p => p.organisation === o.id).length;
    return { label: t(o.label), value: n, valueLabel: String(n) };
  });
  /* A project without an assignee belongs to no unit; the bars still have to
     add up to the number in the subtitle. */
  const open = list.filter(p => !p.organisation).length;
  if (open) rows.push({ label: `(${t('nicht zugewiesen')})`, value: open, valueLabel: String(open), tail: true });
  return biCard('organisationen', 'Anzahl Projekte nach Organisation',
    `${list.length} ${t('Projekte im gesetzten Umfang')}`,
    barList(ordered('organisationen', rows), { max: Math.max(1, ...rows.map(r => r.value)) }));
}

/** A pensum in FTE, the Swiss way round: 1,25. */
const fte = v => (v / 100).toFixed(2).replace('.', ',');

function portfolioCard() {
  const list = filteredProjects();
  const now = nowIndex();
  const rows = data.meta.portfolios
    .map(pf => {
      const v = list.filter(p => p.portfolio === pf.id).reduce((a, p) => a + cellValue(p, now), 0);
      return { label: t(pf.label), value: v, valueLabel: `${fte(v)} FTE` };
    })
    .filter(r => r.value > 0);
  return biCard('portfolio', 'FTE nach Teilportfolio',
    `${data.quarters[now].label} · ${t('Pensum in FTE')}`,
    barList(ordered('portfolio', rows)));
}

/** The same pensum, cut by who carries it rather than by whom it is for. */
function organisationFteCard() {
  const list = filteredProjects();
  const now = nowIndex();
  const pensumOf = pick => list.filter(pick).reduce((a, p) => a + cellValue(p, now), 0);
  const rows = data.meta.organisations
    .map(o => ({ label: t(o.label), value: pensumOf(p => p.organisation === o.id) }))
    .concat({ label: `(${t('nicht zugewiesen')})`, value: pensumOf(p => !p.organisation), tail: true })
    .filter(r => r.value > 0)
    .map(r => ({ ...r, valueLabel: `${fte(r.value)} FTE` }));
  return biCard('organisation-fte', 'FTE nach Organisation',
    `${data.quarters[now].label} · ${t('Pensum in FTE')}`,
    barList(ordered('organisation-fte', rows)));
}

function creditYearCard() {
  const cfg = data.dashboard.creditByYear;
  const rows = cfg.rows.map(r => ({
    label: r.label, value: r.value, valueLabel: r.valueLabel
  }));
  return biCard('kreditjahr', cfg.title, t(cfg.subtitle), barList(ordered('kreditjahr', rows)));
}

function creditPhaseCard() {
  const list = filteredProjects();
  const total = list.reduce((a, p) => a + (p.credit ?? 0), 0);
  const rows = data.phases.eppm
    .map((e, key) => {
      const v = list.filter(p => p.phase === e.id).reduce((a, p) => a + (p.credit ?? 0), 0);
      return { key, label: t(e.label), value: v, valueLabel: fmtMio(v) };
    })
    /* In the order of the chain, like the count card above it: the reader
       follows the money through the phases, not down a ranking. */
    .filter(r => r.value > 0);
  return biCard('kreditphase', 'Kredit nach Phase (ePPM)',
    `${t('Gesamt')} ${fmtMio(total)} CHF · ${t('gebundene Mittel')}`,
    barList(ordered('kreditphase', rows)));
}

/* =============================================================================
   Verlauf — the change log
   ========================================================================== */

export function renderHistory() {
  const page = pageOf(visibleChanges());

  return html`
    ${pageHeader({
      actions: pageActions()
    })}
    <div class="wrap"><div class="content">
      ${toolbar()}
      ${activeFilterRow()}

      <section class="table-card">
        <div class="log log--history log--head">
          <span>${t('Datum')}</span><span>${t('Person')}</span><span>${t('Projekt')}</span>
          <span>${t('Feld')}</span><span>${t('Änderung')}</span><span>${t('Wert')}</span>
        </div>
        ${page.rows.length ? page.rows.map((c, i) => html`<div class="log log--history ${i % 2 === 1 ? 'is-zebra' : ''}">
          <span class="log__date">${c.dateLabel}</span>
          <span>${highlight(c.actor)}</span>
          <span class="log__project">${changeProject(c)}</span>
          <span><span class="fieldtag">${highlight(t(c.field))}</span></span>
          <span class="log__change">${highlight(t(c.change))}</span>
          <span class="log__value">${highlight(t(c.value))}</span>
        </div>`) : html`<div class="log log--history log--empty">${t('Keine Einträge im gesetzten Umfang.')}</div>`}
        ${logFoot(page)}
      </section>
    </div></div>`;
}

/**
 * How much of the log is on screen, and the way to the rest. The size menu and
 * the arrows sit together because they answer the same question.
 */
function logFoot({ page, pages, from, rows, total }) {
  return html`<div class="log__foot">
    <span>${total ? `${from + 1} – ${from + rows.length}` : '0'} ${t('von')} ${total} ${t('Einträgen')}</span>
    <div class="log__pager">
      ${dropdown({
        id: 'pagesize', label: `${state.pageSize} ${t('pro Seite')}`, width: 170, align: 'right',
        body: () => html`${['25', '50', '100'].map(n =>
          menuRadio(`${n} ${t('pro Seite')}`, state.pageSize === n, 'page-size', n))}`
      })}
      <button type="button" class="btn btn--square" data-act="page" data-val="-1"
              ${attr(page <= 1, 'disabled')} aria-label="${t('Vorherige Seite')}">${icons.chevronLeft()}</button>
      <span class="log__pageno">${t('Seite')} ${page} ${t('von')} ${pages}</span>
      <button type="button" class="btn btn--square" data-act="page" data-val="1"
              ${attr(page >= pages, 'disabled')} aria-label="${t('Nächste Seite')}">${icons.chevronRight()}</button>
    </div>
  </div>`;
}

/**
 * The log follows the same filters as every other tab. Entries that are not
 * tied to a project (absences, for example) always stay visible.
 */
