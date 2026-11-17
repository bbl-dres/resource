/* =============================================================================
   views-analysis.js — Tab «Personen» (the load each person carries), Tab
   «Dashboard» (explorative BI grid) and Tab «Verlauf» (the immutable change
   log).
   ============================================================================= */

import {
  data, state, t, fmtMio, fmtFte, totals, loadStatus, cellValue, coloured,
  filteredProjects, visibleChanges,
  periods, periodValue, personRows, sortPersonRows, pageOf, chartTone, nowIndex, compareDe,
  projectShare, projectCapacity, personHeatStep, assignmentsOf, roleOf, activeSpan
} from './store.js';
import { card, laneCell, cardWidth, MIN_PERIODS } from './views-overview.js';

import {
  html, raw, icons, pageHeader, pageActions, toolbar, activeFilterRow, peopleLine, noResults,
  columnCharts, barList, kpiStrip,
  tokenPx, yearRule, pinCls, pinLeft, sortableHead, attr, dropdown, menuRadio, menuGroupLabel, divider, changeProject,
  highlight, caretCell, rowCaret, droppedNote
} from './ui.js';

/* =============================================================================
   Dashboard
   ========================================================================== */

export function renderDashboard() {
  return html`
    ${pageHeader({
      actions: pageActions()
    })}
    <div class="wrap"><div class="content">
      ${toolbar()}
      ${activeFilterRow()}
      ${kpiStrip()}
      <div class="bi-grid">
        ${utilisationCard()}
        ${phaseCountCard()}
        ${organisationCountCard()}
        ${portfolioCard()}
        ${organisationFteCard()}
        ${creditPhaseCard()}
        ${creditYearCard()}
      </div>
    </div></div>`;
}

/* =============================================================================
   «Personen» — the same grid the Planung tab uses, with people as the rows
   ========================================================================== */

/*
 * A tab of its own, beside Planung. It was the second section of the
 * dashboard, behind a switch under the KPI strip; the question it answers —
 * who carries how much, and on what — is asked often enough for a tab.
 */
export function renderPeople() {
  const rows = sortPersonRows(personRows());
  return html`
    ${pageHeader({
      actions: pageActions()
    })}
    <div class="wrap"><div class="content">
      ${toolbar({ time: true, view: true })}
      ${activeFilterRow({ count: peopleLine(rows.length) })}
      ${rows.length ? personSection(rows) : noResults('Personen')}
    </div></div>`;
}

/*
 * The alignment classes are the same ones columns.js hands the two planning
 * grids — a figure is flush right, a period column is centred, in every table.
 * This one is built by hand rather than from the registry, and so it simply
 * never applied them: the headers sat 8px from their right edge while the
 * numbers under them stood 35 to 53px away, and the quarter headers were flush
 * right over centred values.
 */

/** The frozen columns of the person table, in order, with their width token. */
const PERSON_COLS = [
  /* The caret's own track, as on Planung — see caretCell() in ui.js. */
  { key: 'caret', token: '--grid-col-caret' },
  { key: 'name', token: '--person-col-name', grow: true },
  /* How many projects the person is on — and the heading the project names
     of an open row stand under, as «Bearbeitende» is for the names on
     Planung. Narrow: on a person's row it holds a number, and the names in
     the rows below run on across the columns after it, which are empty there. */
  { key: 'projects', token: '--person-col-projects', label: 'Projekte' },
  /* The same short form and width as the planning grid's column. */
  { key: 'organisation', token: '--grid-col-organisation', label: 'Organisation' },
  { key: 'employment', token: '--person-col-employment', label: 'Anstellung' },
  /* How much of that contract may go to projects — the ceiling the figures
     to the right are measured against. */
  { key: 'share', token: '--person-col-share', label: 'Projektanteil' }
  /* «Rollen» and «Spitze» stood here, a count and a maximum. The users asked
     for both to go: the roles are the rows a person folds open to, and the
     highest figure is in the quarters beside it, coloured. */
];

/*
 * Which of them gives way first when the window is too narrow, as
 * YIELD_ORDER in columns.js does for the planning grid. The caret and the
 * name are the floor. All five are frozen, and together they are 526px
 * wide: on a tablet held upright that left two quarters, and on a phone
 * the frozen block was wider than the window — the quarters were in the
 * page and could not be scrolled into view.
 */
const PERSON_YIELD = ['share', 'employment', 'organisation', 'projects'];

function personLayout(cols) {
  const quarterW = tokenPx('--grid-period');
  const room = cardWidth();
  const shown = [...PERSON_COLS];
  const hidden = [];
  const width = () => shown.reduce((a, c) => a + tokenPx(c.token), 0);
  for (const key of PERSON_YIELD) {
    if (width() + MIN_PERIODS * quarterW <= room) break;
    hidden.push(...shown.splice(shown.findIndex(c => c.key === key), 1));
  }

  const parts = [];
  const sticky = {};
  let offset = 0;
  for (const c of shown) {
    const w = tokenPx(c.token);
    sticky[c.key] = offset;
    offset += w;
    parts.push(c.grow ? `minmax(${w}px, 1fr)` : `${w}px`);
  }
  sticky.width = offset;
  sticky.last = shown.at(-1).key;

  /* The same floor and ceiling as the planning grid, so the two tables share
     a column width — and, past the ceiling, the name takes the slack. */
  parts.push(`repeat(${cols.length}, minmax(${quarterW}px, ${tokenPx('--grid-period-max')}px))`);
  return { tpl: parts.join(' '), minWidth: offset + quarterW * cols.length, sticky, shown, hidden };
}

/** A sortable header cell for the person table. */
const personHead = (key, label, sticky, cls = '', title = '') => sortableHead({
  key, label, act: 'sort-person', cls: pinCls(sticky, key, cls),
  style: pinLeft(sticky, key), title,
  active: state.pSort === key, ascending: state.pDir === 'asc'
});

function personSection(rows) {
  const cols = periods();
  const { tpl, minWidth, sticky, shown, hidden } = personLayout(cols);
  const span = shown.length;
  const has = key => shown.some(c => c.key === key);
  /*
   * A total adds up what is booked, not the percentages: a row's figure is a
   * share of that person's own contract, and a sum of shares of different
   * contracts says nothing. In FTE, which is what the booked pensum of a whole
   * office reads as.
   */
  const sumOf = list => cols.map(col => list.reduce((a, r) => a + periodValue(r.load, col), 0));

  /* The frozen lead cells differ only in their class and their content. */
  const leadCell = (key, cls, body, title = '') => html`<span role="${key === 'name' ? 'rowheader' : 'cell'}" class="pcell ${cls} ${pinCls(sticky, key)}"
      style="${pinLeft(sticky, key)}" title="${title}">${body}</span>`;

  const head = html`<div role="row" class="prow prow--head" style="grid-template-columns:${raw(tpl)}">
    ${caretCell()}
    ${personHead('name', t('Person / Rolle'), sticky)}
    ${has('projects') && personHead('projects', t('Projekte'), sticky)}
    ${has('organisation') && personHead('organisation', t('Organisation'), sticky)}
    ${has('employment') && personHead('employment', t('Anstellung'), sticky, 'pcell--num align-end')}
    ${has('share') && personHead('share', t('Projektanteil'), sticky, 'pcell--num align-end',
      t('Anteil der Anstellung, der für Projekte eingesetzt werden darf'))}
    ${cols.map((col, i) => personHead(`q${i}`, col.short,
      sticky, `pcell--num pcell--period align-center ${col.isNow ? 'is-today' : ''} ${yearRule(col)}`,
      /* The heading is a short form; the hint says the whole quarter, as on Planung. */
      col.isNow ? `${t('Heute')}, ${data.meta.todayLabel} — ${t('laufendes Quartal')}` : col.label))}
  </div>`;

  /*
   * A person's row folds open to the roles they hold, one row each: the role
   * under the person's name, the project's name under «Projekte», and the
   * pensum they carry there quarter by quarter, blank where they carry none.
   * The person's own name is a link, to a small dialog about them, as a
   * project's is on Planung; a click anywhere else on their row folds it.
   * The rows under a project on Planung, read from the other side — and
   * written from it too: the cells are the same fields, because this is
   * where somebody looks their own figures up.
   *
   * The name and nothing beside it. The row used to carry the Projekt-ID in
   * front and «bis Q3/2026» behind, and the users found it too dense to
   * read; both are in the hint, and the quarters say when. The name is the
   * same link it is on Planung, to the project's dialog.
   */
  const rest = shown.length - 2;
  /*
   * Where columns had to go, the project's name has lost the room it ran
   * across — three and a half columns of it. The row is one cell then, from
   * the name's column to the edge of the frozen block: the role in its
   * short form, and the project after it.
   */
  const compact = hidden.length > 0;
  const personLanes = r => assignmentsOf(r.person.id).map(({ project: p, lane }) => {
    const role = roleOf(lane.role);
    const label = t(role.label);
    const when = activeSpan(lane);
    const hint = `${label} · ${p.number} ${p.title}${when ? ` · ${when}` : ''}`;
    const project = html`<button type="button" class="linkbtn lane__project" data-act="open-project"
        data-val="${p.id}">${highlight(p.title)}</button>`;
    return html`<div role="row" class="prow prow--lane" style="grid-template-columns:${raw(tpl)}">
      ${caretCell()}
      ${compact
        ? html`<div role="cell" aria-colspan="${shown.length - 1}" style="grid-column:span ${shown.length - 1}; ${pinLeft(sticky, 'name')}" class="lane__label is-frozen" title="${hint}">
            <span class="lane__role lane__role--short">${t(role.short)}</span>${project}
          </div>`
        : html`<span role="cell" class="pcell lane__cell ${pinCls(sticky, 'name')}" style="${pinLeft(sticky, 'name')}" title="${hint}">
            <span class="lane__role">${label}</span>
          </span>
          <div role="cell" aria-colspan="${rest}" style="grid-column:span ${rest}; ${pinLeft(sticky, PERSON_COLS[2].key)}" class="lane__label is-frozen" title="${hint}">
            ${project}
          </div>`}
      ${cols.map(col => laneCell(p, role, lane, col))}
    </div>`;
  });

  const personRow = r => {
    const org = data.organisationsById[r.person.organisation];
    const share = projectShare(r.person);
    const open = !!state.openPeople[r.person.id];
    /* The ceiling in pensum points, which is what a sum of pensa is held against. */
    const capacity = String(Math.round(projectCapacity(r.person) * 10) / 10).replace('.', ',');
    const row = html`<div role="row" class="prow prow--project ${open ? 'is-open' : ''}" style="grid-template-columns:${raw(tpl)}"
        data-act="toggle-person" data-val="${r.person.id}">
      ${caretCell(rowCaret({
        act: 'toggle-person', val: r.person.id, open, label: `${t('Rollen ein-/ausklappen')}: ${r.person.name}`
      }))}
      ${leadCell('name', 'pcell--title', html`<button type="button" class="prow__title" data-act="open-person"
          data-val="${r.person.id}" title="${r.person.name}">${highlight(r.person.name)}</button>`)}
      ${has('projects') && leadCell('projects', 'pcell--lead', r.projects || '—')}
      ${has('organisation') && leadCell('organisation', 'pcell--phase', org ? t(org.short) : '—', org ? t(org.label) : '')}
      ${has('employment') && leadCell('employment', 'pcell--target align-end', `${r.person.employment} %`)}
      ${has('share') && leadCell('share', 'pcell--target align-end', `${share} %`,
        `${t('Für Projekte verfügbar')}: ${capacity} % (${share} % ${t('von')} ${r.person.employment} % ${t('Anstellung')})`)}
      ${cols.map((col, i) => {
        const v = r.values[i];
        /* The figure alone, as in a project's row on Planung: a quarter cell is a
           number in both grids, and its unit is said in the hint, not two
           thousand times over. A nought is hidden where Planung hides one. The
           one figure that keeps its sign is this row in a table set to FTE: it
           is a share of the person's capacity whatever a pensum is written in,
           and the sign is what tells it from the FTE in the rows under it. */
        const label = r.roles ? `${v} %` : '—';
        const shown = !r.roles ? '—' : state.hideZeros && v === 0 ? '' : state.unit === 'fte' ? label : v;
        return html`<span role="cell" class="pcell pcell--val ${r.roles ? `heat-${personHeatStep(v)}` : ''}
            ${r.roles && v > 100 ? 'is-warn' : ''} ${yearRule(col)}"
            title="${r.person.name}, ${col.label}: ${label} ${t('der Projektkapazität')}">${shown}</span>`;
      })}
    </div>`;
    return open ? html`${row}${personLanes(r)}` : row;
  };

  const sumRow = (label, note, list) => html`<div role="row" class="prow prow--sum"
      style="grid-template-columns:${raw(tpl)}">
    <div role="rowheader" aria-colspan="${span}" style="grid-column:span ${span}" class="prow__sumlabel is-frozen">
      ${label}${note && html`<span class="prow__sumnote">${note}</span>`}
    </div>
    ${sumOf(list).map((v, i) => html`<span role="cell" class="pcell pcell--sum ${yearRule(cols[i])}">${fmtFte(v)}</span>`)}
  </div>`;

  /* One table: people have no size to stand in groups by. It opens in the
     order of the names; a click on a quarter's heading puts the most loaded
     first. */
  const body = html`<section class="pgroup">
    ${card(html`${head}${rows.map(personRow)}`, { minWidth, sticky, label: t('Personen') })}
  </section>`;

  const foot = sumRow(t('Summe Total'), `${rows.length} ${t(rows.length === 1 ? 'Person' : 'Personen')} · ${t('Pensum in FTE')}`, rows);

  /*
   * The same cards as the planning grid — the table and, under it, the
   * total — each wrapping its own scroller, so the frame stays put while the
   * quarters move and the fades sit on the frozen edge. The switches say the
   * table has no band: without them the figures kept a band's worth of room
   * under every number.
   */
  return html`${droppedNote(hidden)}<section class="grid-card is-bars-off is-gates-off ${coloured() ? '' : 'is-uncoloured'}">
    ${body}
    ${card(foot, { minWidth, sticky, cls: 'pblock--foot', label: t('Summe Total') })}
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
        ${open && html`<div class="dd__panel dd__panel--right" role="menu">
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

function portfolioCard() {
  const list = filteredProjects();
  const now = nowIndex();
  const rows = data.meta.portfolios
    .map(pf => {
      const v = list.filter(p => p.portfolio === pf.id).reduce((a, p) => a + cellValue(p, now), 0);
      return { label: t(pf.label), value: v, valueLabel: `${fmtFte(v)} FTE` };
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
    .map(r => ({ ...r, valueLabel: `${fmtFte(r.value)} FTE` }));
  return biCard('organisation-fte', 'FTE nach Organisation',
    `${data.quarters[now].label} · ${t('Pensum in FTE')}`,
    barList(ordered('organisation-fte', rows)));
}

function creditYearCard() {
  const cfg = data.dashboard.creditByYear;
  const rows = cfg.rows.map((r, key) => ({
    /* The years have an order of their own; the alphabet put «vor 2026» last. */
    key, label: r.label, value: r.value, valueLabel: r.valueLabel
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
        <div role="table" aria-label="${t('Verlauf')}">
        <div role="row" class="log log--history log--head">
          <span role="columnheader">${t('Datum')}</span><span role="columnheader">${t('Person')}</span><span role="columnheader">${t('Projekt')}</span>
          <span role="columnheader">${t('Feld')}</span><span role="columnheader">${t('Änderung')}</span><span role="columnheader">${t('Wert')}</span>
        </div>
        ${page.rows.length ? page.rows.map((c, i) => html`<div role="row" class="log log--history ${i % 2 === 1 ? 'is-zebra' : ''}">
          <span role="cell" class="log__date">${c.dateLabel}</span>
          <span role="cell">${highlight(c.actor)}</span>
          <span role="cell" class="log__project">${changeProject(c)}</span>
          <span role="cell"><span class="fieldtag">${highlight(t(c.field))}</span></span>
          <span role="cell" class="log__change">${highlight(t(c.change))}</span>
          <span role="cell" class="log__value">${highlight(t(c.value))}</span>
        </div>`) : html`<div role="row" class="log log--history log--empty"><span role="cell">${t('Keine Einträge im gesetzten Umfang.')}</span></div>`}
        </div>
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
        id: 'pagesize', label: `${state.pageSize} ${t('pro Seite')}`, size: 'sm', align: 'right',
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
