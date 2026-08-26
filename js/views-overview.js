/* =============================================================================
   views-overview.js — the landing page and the «Übersicht» pensum grid.
   ============================================================================= */

import {
  data, state, t, num, fmt, unitSuffix, fmtMio,
  cellValue, projectDemand, isEdited, personLoad, personUtilisation,
  totals, loadStatus, heatStep, ampel, filteredProjects, groupProjects,
  activeFilters, milestones, milestoneStats, kpis, periods, periodValue, phaseOf, windowEdges, columnSet,
  chartTone
} from './store.js';

import {
  html, raw, icons, pageHeader, pageActions, toolbar, activeFilterRow,
  timeControls, columnChart, noResults, ampelLegend, ampelDot, droppedNote,
  legendBlock, legendItem, attr,
  tokenPx, yearRule, pinCls, pinLeft, sortableHead, changeProject
} from './ui.js';

import { leadLayout, column, titleWidth, alignCls } from './columns.js';

/* -----------------------------------------------------------------------------
   Shared helpers
   -------------------------------------------------------------------------- */

const shortName = p => {
  const rest = p.location.split(',').slice(1).join(',').trim();
  return rest || p.location;
};

function utilisationChartRows() {
  const tot = totals();
  return data.quarters.map((q, i) => ({
    value: tot.utilisation[i],
    label: String(tot.utilisation[i]),
    axis: `${q.short}/${String(q.year).slice(2)}`,
    tone: chartTone(tot.utilisation[i]),
    title: `${q.label}: ${tot.utilisation[i]} % — ${loadStatus(tot.utilisation[i]).label}`
  }));
}

/* =============================================================================
   Landing page — «Einstieg»
   ========================================================================== */

export function renderLanding() {
  const tot = totals();
  const ms = milestoneStats();
  const grossCap = data.people.reduce((a, p) => a + p.employment, 0);
  const overPeople = data.people.filter(p => personLoad(p.id, 0) > 100);
  const unassigned = data.projects.filter(p => !p.leadId);
  const firstThree = data.quarters.slice(0, 3)
    .map((q, i) => `${tot.utilisation[i]} % ${q.label}`).join(' · ');

  const cards = [
    {
      title: 'Auslastung', sub: firstThree,
      metric: tot.utilisation.filter(v => v > 100).length, metricLabel: 'Quartale in Überlast',
      tone: 'danger', tab: 'overview'
    },
    {
      title: 'Personen', count: data.people.length,
      sub: `${tot.net[0]} % Kapazität netto · ${grossCap} % brutto`,
      metric: overPeople.length, metricLabel: 'über 100 % belegt',
      tone: 'danger', tab: 'dashboard'
    },
    {
      title: 'Meilensteine', count: ms.total,
      sub: `${ms.onTime} im Termin · ${ms.open} ohne Termin`,
      metric: ms.late, metricLabel: 'überfällig',
      tone: 'danger', tab: 'schedule'
    },
    {
      title: 'Projekte', count: data.projects.length,
      sub: `${tot.demand[0]} % Bedarf · ${tot.preCredit[0]} % vor Baukredit-Freigabe`,
      metric: unassigned.length, metricLabel: 'ohne Projektleitung',
      tone: 'warn', tab: 'overview'
    }
  ];

  return html`
    ${pageHeader({
      crumbs: ['Bauprojekte'],
      title: 'Ressourcenplanung',
      chrome: false,
      actions: pageActions({ extra: html`<button type="button" class="btn btn--primary"
        data-act="tab" data-val="overview">${t('Zur Planung')}</button>` })
    })}

    <div class="wrap"><div class="content content--landing">
      <div class="entry-grid">
        ${cards.map(c => html`<button type="button" class="entry entry--${c.metric ? c.tone : 'neutral'}" data-act="tab" data-val="${c.tab}">
          <span class="entry__head">
            <span class="entry__title">${t(c.title)}${
              c.count ? html`<span class="count-pill">${c.count}</span>` : ''}</span>
            <span class="entry__sub">${c.sub}</span>
          </span>
          <span class="entry__foot">
            <span class="entry__metric"><strong>${c.metric}</strong> ${t(c.metricLabel)}</span>
            <span class="entry__arrow" aria-hidden="true">${icons.arrowRight()}</span>
          </span>
        </button>`)}
      </div>

      <div class="card-grid">
        ${nextMilestonesCard()}
        ${attentionCard(overPeople, unassigned)}
        ${utilisationCard()}
      </div>

      ${recentChangesBlock()}
    </div></div>`;
}

/* A card says how much there is before it says how much of it you can see. */
const CARD_ROWS = 6;

function nextMilestonesCard() {
  const all = milestones();
  const list = state.showAll.milestones ? all : all.slice(0, CARD_ROWS);
  return html`<section class="card card--span4">
    <header class="card__head">
      <h2 class="card__title">${t('Nächste Meilensteine')}<span class="count-pill">${all.length}</span></h2>
      <p class="card__sub">12 Monate · chronologisch · ${t('öffnet Meilensteine')}</p>
    </header>
    <ul class="mslist">
      ${list.map(m => html`<li class="mslist__row is-${m.status}">
        <button type="button" class="mslist__btn" data-act="open-schedule" data-val="${m.projectId}">
          <span class="mslist__q">${data.quarters[m.planIdx].label}</span>
          <span>
            <span class="mslist__title">${m.code} ${m.short} · ${m.project.location}</span>
            <span class="mslist__meta">${m.lead ? m.lead.name : t('nicht zugewiesen')} · ${
              m.impact ?? (m.status === 'ok' ? t('Termin gehalten') : m.statusLabel.replace('▲ ', ''))
            }</span>
          </span>
        </button>
      </li>`)}
    </ul>
    ${moreLink('milestones', all.length)}
  </section>`;
}

/** «Alle N anzeigen», or nothing when the card is already showing them all. */
function moreLink(key, total) {
  if (total <= CARD_ROWS) return '';
  const open = state.showAll[key];
  return html`<button type="button" class="more-link" data-act="show-all" data-val="${key}">
    ${open ? t('Weniger anzeigen') : `${t('Alle')} ${total} ${t('anzeigen')}`}
  </button>`;
}

function attentionCard(overPeople, unassigned) {
  const rows = overPeople
    .map(p => ({
      severity: 'danger',
      name: p.name,
      context: (data.projectsByLead[p.id] ?? []).map(shortName).join(' · '),
      value: `${personLoad(p.id, 0)} %`,
      act: 'filter-lead', val: p.id
    }));

  unassigned.forEach(p => {
    const start = projectDemand(p).findIndex(v => v > 0);
    rows.push({
      severity: 'warn',
      name: shortName(p),
      context: `${t('keine Projektleitung')} · ${t('ab')} ${data.quarters[start]?.label ?? '—'}`,
      value: `${Math.max(...projectDemand(p))} %`,
      act: 'filter-lead', val: 'none'
    });
  });

  /*
   * Both kinds belong in the visible few. Appended one after the other, every
   * row the reader saw was an overload and the severity rail said nothing; the
   * open demand — the other half of what this card exists for — never surfaced.
   * Each kind is ordered by size, then woven so both show early.
   */
  const over = rows.filter(r => r.severity === 'danger').sort((a, b) => parseInt(b.value) - parseInt(a.value));
  const open = rows.filter(r => r.severity === 'warn').sort((a, b) => parseInt(b.value) - parseInt(a.value));
  const every = Math.min(3, Math.max(1, Math.ceil(over.length / Math.max(1, open.length))));
  rows.length = 0;
  while (over.length || open.length) {
    for (let i = 0; i < every && over.length; i++) rows.push(over.shift());
    if (open.length) rows.push(open.shift());
  }

  const list = state.showAll.attention ? rows : rows.slice(0, CARD_ROWS);

  return html`<section class="card card--span4">
    <header class="card__head">
      <h2 class="card__title">${t('Handlungsbedarf')}<span class="count-pill">${rows.length}</span></h2>
      <p class="card__sub">${data.quarters[0].label} · ${t('öffnet die Übersicht, auf die Person gefiltert')}</p>
    </header>
    <ul class="mslist mslist--metric">
      ${list.map(r => html`<li class="mslist__row is-${r.severity}">
        <button type="button" class="mslist__btn" data-act="${r.act}" data-val="${r.val}">
          <span class="mslist__q">${r.value}</span>
          <span>
            <span class="mslist__title">${r.name}</span>
            <span class="mslist__meta">${r.context}</span>
          </span>
        </button>
      </li>`)}
    </ul>
    ${moreLink('attention', rows.length)}
  </section>`;
}

function utilisationCard() {
  return html`<section class="card card--span4">
    <header class="card__head">
      <h2 class="card__title">${t('Auslastung nach Quartal')}</h2>
      <p class="card__sub">${t('Bedarf gegen Kapazität netto')} · ${t('öffnet die Übersicht')}</p>
    </header>
    <button type="button" class="chartlink" data-act="tab" data-val="overview"
            aria-label="${t('Auslastung nach Quartal')} — ${t('öffnet die Übersicht')}">
      ${columnChart(utilisationChartRows(), { height: 150, refAt: 100, refLabel: '100 %' })}
    </button>
  </section>`;
}

function recentChangesBlock() {
  const rows = data.changes.filter(c => c.onLanding).slice(0, 5);
  return html`<section class="changes">
    <h2 class="changes__title">${t('Letzte Änderungen')}
      <span>· ${t('seit letztem Besuch')}, ${data.meta.lastVisit}</span></h2>
    <div class="table-card">
      <div class="log log--changes log--head">
        <span>${t('Projekt')}</span><span>${t('Feld')}</span><span>${t('Person')}</span>
        <span>${t('Änderung')}</span><span>${t('Geändert')}</span>
      </div>
      ${rows.map((c, i) => html`<div class="log log--changes ${i % 2 === 1 ? 'is-zebra' : ''}">
        <span class="log__project">${changeProject(c)}</span>
        <span>${t(c.field)}</span>
        <span>${c.landingActor ?? c.actor}</span>
        <span class="log__change">${c.summary ?? c.change}</span>
        <span class="log__date">${c.dateLabel}</span>
      </div>`)}
    </div>
    <button type="button" class="more-link" data-act="tab" data-val="history">
      ${t('Alle Änderungen anzeigen')}
    </button>
  </section>`;
}

/* =============================================================================
   Tab «Übersicht» — the pensum grid
   ========================================================================== */

export function renderOverview() {
  return html`
    ${pageHeader({
      crumbs: ['Bauprojekte', 'Übersicht'],
      title: 'Ressourcenplanung',
      actions: pageActions({ edit: true })
    })}
    <div class="wrap"><div class="content">
      ${toolbar()}
      ${activeFilterRow()}
      ${timeControls({})}
      ${filteredProjects().length ? pensumGrid() : noResults('Bauprojekte')}
    </div></div>`;
}

/** The column template, rebuilt whenever a column is toggled. */
/** Fixed widths in px, mirroring the layout tokens in tokens.css. */
/*
 * Widths measured against the data, not guessed: the ID column held 100px for
 * 35px of content while 99 of 111 titles were clipped — and it is always the
 * Massnahme at the end that goes.
 */
/**
 * One description of the column layout for the whole grid.
 *
 * The template and the frozen-column offsets have to agree to the pixel, so
 * they may not be two lists of numbers: both come from the width token each
 * column names. `minWidth` matters too — every row is its own grid, and they
 * only line up when all of them are exactly as wide as the scroll track.
 *
 * The master data of a project stays put while the time axis moves, so every
 * lead column is frozen and each needs the running offset of the ones before.
 */
/*
 * Three periods is the least that still reads as a time axis; below that the
 * view is a list with a number, not a plan.
 */
const MIN_PERIODS = 3;

function gridLayout() {
  const quarterW = tokenPx('--grid-quarter');
  const cols = periods().length;
  const room = cardWidth();
  const { parts, sticky, shown, hidden, width: offset } = leadLayout(columnSet(), {
    room,
    axis: MIN_PERIODS * quarterW,
    widthOf: c => tokenPx(c.width),
    titleW: titleWidth({ room, quarters: cols, px: tokenPx })
  });
  /*
   * A ceiling, not a free share. With eight flexible quarter tracks against one
   * flexible title track the quarters took 8/9 of every extra pixel: at 2400px
   * they reached 192px around a two-digit number while 29 of 111 project names
   * still truncated at 285px. Capped, the surplus goes to the name instead and
   * none of them truncates.
   */
  parts.push(`repeat(${cols}, minmax(${quarterW}px, ${tokenPx('--grid-quarter-max')}px))`);
  let minWidth = offset + quarterW * cols;

  if (columnSet().trend) {
    const w = tokenPx(column('trend').width);
    parts.push(`${w}px`);
    minWidth += w;
  }
  return { tpl: parts.join(' '), minWidth, sticky, shown, hidden };
}

/** How much width the card actually has, before it is in the DOM to measure. */
function cardWidth() {
  return Math.min(tokenPx('--layout-width'), document.documentElement.clientWidth)
    - 2 * tokenPx('--shell-pad-x');
}

function pensumGrid() {
  const groups = groupProjects();
  const list = filteredProjects();
  const tot = totals(list);
  const { tpl, minWidth, sticky, hidden } = gridLayout();
  const span = sticky.shown.length;
  // One period list for the whole grid: every row must agree on the time axis.
  const cols = periods();
  const q0 = data.quarters[0];

  // Visual row index, so the edit popover can be positioned by calc().
  let rowIdx = 0;
  const body = groups.map(g => {
    const collapsed = g.label ? state.collapsedGroups[g.key] : false;

    // The header sits on the page ground above its card, exactly as the
    // Termine tab does it. It sticks to the left so it survives a scroll.
    const head = g.label && html`<h2 class="pgrouphead">
      <button type="button" class="pgrouphead__toggle"
              data-act="toggle-group" data-val="${g.key}" aria-expanded="${!collapsed}">
        <span class="caret ${collapsed ? 'is-collapsed' : ''}" aria-hidden="true">${icons.chevronDown()}</span>
        <span class="pgrouphead__name">${g.label}</span>
        <span class="count-pill">${g.projects.length}</span>
      </button>
    </h2>`;

    if (collapsed) return html`<section class="pgroup">${head}</section>`;

    const rows = g.projects.map(p => {
      const row = projectRow(p, tpl, sticky, cols, rowIdx);
      rowIdx++;
      return row;
    });
    // Each card repeats the column header, the same way a Gantt group card
    // repeats its axis — a group has to be readable on its own. It closes with
    // its own sum for the same reason, and because the printed report already
    // does exactly that.
    return html`<section class="pgroup">${head}
      ${card(html`${columnHeader(tpl, sticky, cols)}${rows}${groupSum(g, tpl, span, cols)}`,
        { minWidth, sticky })}
    </section>`;
  });

  const foot = html`<div class="prow prow--sum" style="grid-template-columns:${raw(tpl)}">
        <div style="grid-column:span ${span}" class="prow__sumlabel is-frozen">
          ${t('Bedarf total')}${tot.scoped ? html`<span class="prow__sumnote">${t('Auswahl')}</span>` : ''}
          <button type="button" class="linkbtn" data-act="foot-details">
            ${state.footDetails ? t('Details ausblenden') : t('Details anzeigen')}
          </button>
        </div>
        ${cols.map(period => html`<span class="pcell pcell--sum ${yearRule(period)}">${fmt(periodValue(tot.demand, period))}</span>`)}
        ${columnSet().trend && html`<span></span>`}
      </div>

      ${state.footDetails && html`
        ${footRow(t('davon vor Baukredit-Freigabe'), tot.preCredit, tpl, span, cols)}
        ${footRow(t('davon extern beauftragt'), tot.external, tpl, span, cols)}
        ${footRow(t('Kapazität netto, nach Abwesenheiten'), tot.net, tpl, span, cols)}`}

      <div class="prow prow--load" style="grid-template-columns:${raw(tpl)}">
        <div style="grid-column:span ${span}" class="prow__sumlabel is-frozen">${t('Auslastung')}${
          tot.scoped ? html`<span class="prow__sumnote">${t('Gesamtportfolio')}</span>` : ''}</div>
        ${cols.map(period => {
          const q = period.quarters[0];
          const pct = periodValue(tot.utilisation, period);
          const st = loadStatus(pct);
          return html`<span class="pcell pcell--load is-${st.key} ${yearRule(period)}"
              title="${period.label}: ${pct} % — ${t(st.label)} · ${tot.booked[q]} % ${t('gebucht auf')} ${tot.net[q]} % ${t('netto')}">
            <span class="pcell__pct">${pct} %</span>
          </span>`;
        })}
        ${columnSet().trend && html`<span></span>`}
      </div>`;

  return html`${droppedNote(hidden)}
    <section class="grid-card">
      ${body}
      ${card(foot, { minWidth, sticky, cls: 'pblock--foot' })}
    </section>
    ${heatLegend()}`;
}

/**
 * A group card. The card is the outer box and the scroller sits inside it, so
 * its edge, radius and shadow belong to the page and stay put while the time
 * axis moves underneath. Built the other way round, the frame travelled with
 * the content and left the window.
 */
function card(rows, { minWidth, sticky, cls = '' }) {
  const edge = windowEdges();
  return html`<div class="pblock scrollbox ${cls}" style="--sticky-w:${sticky.width}px"
      ${attr(edge.before, 'data-before')} ${attr(edge.after, 'data-after')}>
    <div class="pgrid ${state.edit ? 'pgrid--edit' : ''}" data-scroll>
      <div class="pgrid__track" style="min-width:${minWidth}px">${rows}</div>
    </div>
  </div>`;
}

/** The same swatch legend the print sheet carries, so both read alike. */
export function heatLegend() {
  const l = data.print.legend;
  return legendBlock([
    {
      label: 'Pensum',
      items: l.steps.map(s => legendItem(html`<span class="legend__swatch heat-${s.step}"></span>`, s.label))
    },
    { label: 'Ampel', items: columnSet().ampel ? ampelLegend() : null },
    {
      label: 'Markierung',
      items: html`${legendItem(html`<span class="markglyph">▲</span>`, 'Projektleitung über 100 % im Quartal')}
        ${legendItem(html`<span class="legend__swatch is-nolead"></span>`, l.noLead)}`
    },
    { label: 'Auslastung', items: html`${t(l.thresholds).replace(/^Auslastung:\s*/, '')}` }
  ]);
}

/** Clicking the active column flips it; the toolbar reads the same state. */
const sortHead = (key, label, opts = {}) => sortableHead({
  ...opts, key, label, act: 'sort-col',
  active: state.sort === key, ascending: state.sortDir === 'asc'
});

/*
 * Most cells print the registry's plain text. These four draw something the
 * reader can act on or read as a shape, so they are named here rather than
 * hidden behind a flag on the column.
 */
const CELL_BODY = {
  title: p => html`<button type="button" class="prow__title"
      data-act="open-project" data-val="${p.id}" title="${p.title}">${p.title}</button>`,

  lead: (p, lead) => {
    const name = lead ? lead.name : html`<span class="lead-open">${t('nicht zugewiesen')}</span>`;
    return state.edit
      ? html`<button type="button" class="leadbtn" data-act="assign" data-val="${p.id}"
          title="${t('Projektleitung zuweisen')}">${name}</button>`
      : name;
  },

  ampel: p => ampelDot(p),

  target: p => html`${num(p.target)}${unitSuffix()}`
};

const cellBody = (col, p, lead) =>
  (CELL_BODY[col.key] ? CELL_BODY[col.key](p, lead) : (col.text(p) || '—'));

/** The two cells that also carry a state class. */
function cellState(col, p, lead) {
  if (col.key === 'lead') return lead ? '' : 'is-none';
  if (col.key === 'target' && cellValue(p, 0) > p.target) return 'is-over';
  return '';
}

/** The class and offset a pinned column needs, as sortHead's options. */
const pin = (s, k, extra = '') => ({ cls: pinCls(s, k, extra), style: pinLeft(s, k) });

/** What a column is called in the grid header, where two names are shorter. */
function headLabel(col) {
  if (col.key === 'target') return `${t('Soll')} ${data.quarters[0].short}`;
  return t(col.label);
}

/** The column names, repeated at the top of every group card. */
function columnHeader(tpl, sticky, cols) {
  return html`
    <div class="prow prow--head" style="grid-template-columns:${raw(tpl)}">
      ${sticky.shown.map(col => {
        const extra = `${col.numeric ? 'pcell--num' : ''} ${alignCls(col)}`.trim();
        // Without a sort key the header is a label, not a control.
        if (!col.sort) {
          return html`<span class="pcell--text ${col.key === 'ampel' ? 'pcell--ampelhead' : ''} ${pinCls(sticky, col.key, extra)}"
              style="${pinLeft(sticky, col.key)}"
              title="${col.key === 'ampel' ? t('Höchste Auslastung der Projektleitung im sichtbaren Zeitraum') : ''}"
            >${headLabel(col)}</span>`;
        }
        return sortHead(col.sort, headLabel(col), pin(sticky, col.key, extra));
      })}
      ${cols.map(period => sortHead(`q${period.quarters[0]}`, period.short, {
        cls: `pcell--num pcell--period ${period.isNow ? 'is-today' : ''} ${yearRule(period)}`,
        title: period.isNow
          ? `${t('Heute')}, ${data.meta.todayLabel} — ${t('laufendes Quartal, gesperrt')}`
          : period.label
      }))}
      ${columnSet().trend && html`<span class="pcell--text">${t('Verlauf')}</span>`}
    </div>`;
}


/**
 * A group closes with its own demand. Without it the only total in the table
 * is the one at the very bottom, which answers a question about the whole
 * selection when the reader is looking at one person or one portfolio.
 */
function groupSum(g, tpl, span, cols) {
  if (!g.label) return '';
  const values = data.quarters.map((_, q) => g.projects.reduce((a, p) => a + cellValue(p, q), 0));
  return html`<div class="prow prow--sum prow--groupsum" style="grid-template-columns:${raw(tpl)}">
    <div style="grid-column:span ${span}" class="prow__sumlabel is-frozen">${t('Summe')} ${g.label}</div>
    ${cols.map(period => html`<span class="pcell pcell--sum ${yearRule(period)}">${fmt(periodValue(values, period))}</span>`)}
    ${columnSet().trend && html`<span></span>`}
  </div>`;
}

function footRow(label, values, tpl, span, cols) {
  return html`<div class="prow prow--foot" style="grid-template-columns:${raw(tpl)}">
    <div style="grid-column:span ${span}" class="prow__footlabel is-frozen">${label}</div>
    ${cols.map(period => html`<span class="pcell pcell--foot ${yearRule(period)}">${fmt(periodValue(values, period))}</span>`)}
    ${columnSet().trend && html`<span></span>`}
  </div>`;
}

function projectRow(p, tpl, sticky, cols, rowIdx) {
  const lead = p.leadId ? data.peopleById[p.leadId] : null;
  const cells = projectDemand(p);

  return html`<div class="prow" style="grid-template-columns:${raw(tpl)}"
      data-row="${rowIdx}">
    ${sticky.shown.map(col => html`<span
        class="pcell ${col.cls} ${alignCls(col)} ${cellState(col, p, lead)} ${pinCls(sticky, col.key)}"
        style="${pinLeft(sticky, col.key)}">${cellBody(col, p, lead)}</span>`)}

    ${cols.map(period => {
      const q = period.quarters[0];
      const v = periodValue(cells, period);
      // The lead being stretched says nothing about a quarter this project does
      // not run in, and a red nought is noise rather than a warning.
      const over = lead && v > 0 && period.quarters.some(x => personUtilisation(p.leadId, x) > 100);
      const locked = period.quarters.includes(0);
      const editing = state.editing && state.editing.projectId === p.id && state.editing.q === q;
      const label = state.hideZeros && v === 0 ? '' : num(v);
      const description = `${p.title} · ${lead ? lead.name : t('nicht zugewiesen')}, ${period.label}: ${num(v)}${unitSuffix()}`
        + (over ? ` — ${t('Person über 100 % belegt, Überlast')}` : '')
        + (locked ? ` — ${t('laufendes Quartal, gesperrt')}` : '');
      return html`<button type="button"
        class="pcell pcell--val heat-${heatStep(v)} ${over ? 'is-warn' : ''} ${editing ? 'is-editing' : ''} ${isEdited(p, q) ? 'is-edited' : ''} ${yearRule(period)}"
        data-act="cell" data-val="${p.id}" data-q="${q}" data-fk="cell:${p.id}:${q}"
        aria-label="${description}" title="${description}" ${attr(!state.edit || locked, 'data-locked="1"')}>
        <span class="cellv">${over && v > 0 ? html`<span class="warnmark" aria-hidden="true">▲</span>` : ''}${label}</span>
      </button>`;
    })}

    ${columnSet().trend && html`<span class="pcell pcell--trend">
      ${cols.map(period => {
        const v = periodValue(cells, period);
        return html`<span class="spark ${v ? '' : 'is-empty'}"
          style="height:${v ? Math.max(8, Math.round(v / 120 * 100)) : 0}%"></span>`;
      })}
    </span>`}
  </div>`;
}

/* -----------------------------------------------------------------------------
   Edit popover — anchored to the cell by grid arithmetic
   -------------------------------------------------------------------------- */

const POP_WIDTH = 308;
/* The tallest the popover gets — the case with no lead, where the notice wraps
   to three lines. Sized for the worst case so the flip never clips it. */
const POP_HEIGHT = 400;

export function editPopover() {
  const { projectId, q, anchor } = state.editing;
  const p = data.projectsById[projectId];
  const lead = p.leadId ? data.peopleById[p.leadId] : null;
  const base = cellValue(p, q);
  const delta = state.draft - base;
  const newLoad = lead ? Math.round(personLoad(p.leadId, q) + delta / lead.employment * 100) : null;
  const newUtil = lead ? Math.round(newLoad / lead.employment * 100) : null;
  const over = newUtil != null && newUtil > 100;


  // The popover is anchored to the cell in viewport space so no scroll
  // container can clip it, and flips above the row when space runs out.
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const left = Math.min(Math.max(8, anchor.right - POP_WIDTH), vw - POP_WIDTH - 8);
  const below = anchor.bottom + 6;
  const flip = below + POP_HEIGHT > vh - 8 && anchor.top - POP_HEIGHT - 6 > 8;
  const top = flip ? anchor.top - POP_HEIGHT - 6 : Math.min(below, Math.max(8, vh - POP_HEIGHT - 8));

  return html`<div class="pop" role="dialog" aria-modal="false" aria-label="${t('Pensum bearbeiten')}"
      style="left:${Math.round(left)}px; top:${Math.round(top)}px">
    <div class="pop__kicker">${t('Pensum bearbeiten')}</div>
    <div class="pop__who">${p.title}</div>
    <div class="pop__what">${lead ? `${lead.name} · ${lead.role}` : t('nicht zugewiesen')} · ${data.quarters[q].label}</div>

    <div class="pop__stepper">
      <button type="button" class="pop__step" data-act="draft" data-val="-5" aria-label="${t('Pensum verringern')}">${icons.minus(15)}</button>
      <label class="pop__input">
        <span class="sr-only">${t('Pensum')}</span>
        <input type="number" min="0" max="200" step="5" value="${state.draft}" data-act="draft-input" data-fk="draft"
               inputmode="numeric">
        <span class="pop__unit">${state.unit === 'fte' ? 'FTE' : '%'}</span>
      </label>
      <button type="button" class="pop__step" data-act="draft" data-val="5" aria-label="${t('Pensum erhöhen')}">${icons.plus(15)}</button>
    </div>

    ${lead === null && html`<p class="pop__warn is-none">${t(
      'Keine Projektleitung zugewiesen — das Pensum kann noch auf keine Person gebucht werden.')}</p>`}

    <label class="pop__reason">
      <span class="pop__reasonlabel">${t('Begründung')}
        <span>${over ? t('— Pflicht bei Überlast') : t('— optional')}</span></span>
      <textarea rows="2" data-act="reason" data-fk="reason"
        placeholder="${t('Bauleitung Etappe 2 vorgezogen, Freigabe Abteilungsleitung liegt vor.')}">${state.reason}</textarea>
    </label>

    <div class="pop__rebook">
      <button type="button" class="linkbtn" data-act="rebook">${t('An andere Person umbuchen')}</button>
    </div>

    <div class="pop__actions">
      <button type="button" class="btn btn--primary" data-act="apply" ${attr(over && !state.reason.trim(), 'disabled')}>${t('Übernehmen')}</button>
      <button type="button" class="btn" data-act="cancel-edit">${t('Abbrechen')}</button>
    </div>
  </div>`;
}

/* -----------------------------------------------------------------------------
   Modals — project detail and rebooking
   -------------------------------------------------------------------------- */
