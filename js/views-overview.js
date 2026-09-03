/* =============================================================================
   views-overview.js — the «Planung» grid: pensum figures per project and
   quarter, with the bar plan drawn as a band inside the same rows.
   ============================================================================= */

import {
  data, state, t, num, fmt, unitSuffix, cellValue, projectDemand, isEdited, personUtilisation,
  totals, loadStatus, heatStep, ampel, filteredProjects, groupProjects,
  periods, periodValue, windowEdges, columnSet, coloured, nowIndex, compareDe
} from './store.js';

import {
  html, raw, icons, pageHeader, pageActions, toolbar, activeFilterRow,
  noResults, droppedNote, attr,
  tokenPx, yearRule, pinCls, pinLeft, sortableHead,
  popoverPosition, personOption, personSearch
} from './ui.js';

import { leadLayout, titleWidth, alignCls } from './columns.js';
import { phaseBand, todayFraction, planLegend } from './views-schedule.js';

/* =============================================================================
   Tab «Planung» — the pensum grid, and the bar plan inside it
   ========================================================================== */

export function renderOverview() {
  return html`
    ${pageHeader({ actions: pageActions() })}
    <div class="wrap"><div class="content">
      ${toolbar({ time: true, view: true })}
      ${activeFilterRow()}
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
  const quarterW = tokenPx('--grid-period');
  const cols = periods().length;
  const room = cardWidth();
  const { parts, sticky, shown, hidden, width: offset } = leadLayout(columnSet(), {
    room,
    axis: MIN_PERIODS * quarterW,
    widthOf: c => tokenPx(c.width),
    titleW: titleWidth({ room, px: tokenPx })
  });
  /*
   * A ceiling, not a free share. With eight flexible quarter tracks against one
   * flexible title track the quarters took 8/9 of every extra pixel: at 2400px
   * they reached 192px around a two-digit number while 29 of 111 project names
   * still truncated at 285px. Capped, the surplus goes to the name instead and
   * none of them truncates.
   */
  parts.push(`repeat(${cols}, minmax(${quarterW}px, ${tokenPx('--grid-period-max')}px))`);
  const minWidth = offset + quarterW * cols;
  /*
   * How wide a quarter is on screen, for the band's labels. The columns
   * stretch between their floor and ceiling, and the bar plan's label rule
   * measures against the width they actually take — a conservative reading,
   * because the title column takes the slack once the ceiling is reached.
   */
  const colWidth = cols
    ? Math.min(tokenPx('--grid-period-max'), Math.max(quarterW, (room - offset) / cols))
    : 0;
  return { tpl: parts.join(' '), minWidth, sticky, shown, hidden, colWidth };
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
  const lay = gridLayout();
  const { tpl, minWidth, sticky, hidden } = lay;
  const span = sticky.shown.length;
  /*
   * Whether a lead is over their contract in a quarter, asked once per person
   * and read per cell. Asked per cell it was some 5,300 utilisation calls a
   * render, each walking the person's projects, on every keystroke in the
   * editor's number field.
   */
  const overCache = new Map();
  lay.isOver = (personId, q) => {
    if (!overCache.has(personId)) {
      overCache.set(personId, data.quarters.map((_, x) => personUtilisation(personId, x) > 100));
    }
    return overCache.get(personId)[q];
  };
  // One period list for the whole grid: every row must agree on the time axis.
  const cols = periods();
  const L = state.layers;
  // A share of the time axis, not of the card: the marker lives in an overlay
  // that starts where the frozen block ends, so it can never run underneath it.
  const f = L.today ? todayFraction(cols) : null;
  const todayLeft = f === null ? null : `${(f * 100).toFixed(2)}%`;

  // Visual row index, so the edit popover can be positioned by calc().
  let rowIdx = 0;
  const body = groups.map(g => {
    const collapsed = g.label ? state.collapsedGroups[g.key] : false;

    // The header sits on the page ground above its card. It sticks to the
    // left so it survives a scroll.
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
      const row = projectRow(p, lay, cols, rowIdx);
      rowIdx++;
      return row;
    });
    // Each card repeats the column header — a group has to be readable on its
    // own. It closes with its own sum for the same reason, and because the
    // printed report already does exactly that. The project rows are wrapped
    // once, so the today marker has something to span that is not the header
    // or the totals.
    return html`<section class="pgroup">${head}
      ${card(html`${columnHeader(tpl, sticky, cols)}
        <div class="pgrid__rows">${rows}${todayMarker(todayLeft)}</div>
        ${L.values && groupSum(g, tpl, span, cols)}`,
        { minWidth, sticky })}
    </section>`;
  });

  /* The totals are sums of the figures, so they go when the figures go. */
  const foot = L.values && html`<div class="prow prow--sum" style="grid-template-columns:${raw(tpl)}">
        <div style="grid-column:span ${span}" class="prow__sumlabel is-frozen">
          ${t('Summe Total')}${tot.scoped ? html`<span class="prow__sumnote">${t('Auswahl')}</span>` : ''}
          <button type="button" class="linkbtn" data-act="foot-details">
            ${state.footDetails ? t('Details ausblenden') : t('Details anzeigen')}
          </button>
        </div>
        ${cols.map(period => html`<span class="pcell pcell--sum ${yearRule(period)}">${fmt(periodValue(tot.demand, period))}</span>`)}
      </div>

      ${state.footDetails && html`
        ${footRow(t('davon vor Baukredit-Freigabe'), tot.preCredit, tpl, span, cols)}
        ${footRow(t('davon extern beauftragt'), tot.external, tpl, span, cols)}
        ${footRow(t('Kapazität netto, nach Abwesenheiten'), tot.net, tpl, span, cols)}`}

      <div class="prow prow--load" style="grid-template-columns:${raw(tpl)}">
        <div style="grid-column:span ${span}" class="prow__sumlabel is-frozen">${t('Auslastung')}${
          tot.scoped ? html`<span class="prow__sumnote">${t('Gesamtportfolio')}</span>` : ''}</div>
        ${cols.map(period => {
          /* All three figures are the period's average: a year column used to
             pair its average with the absolute figures of its first quarter. */
          const pct = periodValue(tot.utilisation, period);
          const st = loadStatus(pct);
          return html`<span class="pcell pcell--load is-${st.key} ${yearRule(period)}"
              title="${period.label}: ${pct} % — ${t(st.label)} · ${periodValue(tot.booked, period)} % ${t('gebucht auf')} ${periodValue(tot.net, period)} % ${t('netto')}">
            <span class="pcell__pct">${pct} %</span>
          </span>`;
        })}
      </div>`;

  /*
   * What the view has switched off, as classes the stylesheet reads. Two
   * numbers derive from them — the band's height and the figures' share of
   * the row — and everything else is arithmetic on the pair, so there is no
   * combination of switches left to write out by hand.
   */
  const mode = [
    L.values ? '' : 'is-values-off',
    L.phases ? '' : 'is-bars-off',
    L.gates ? '' : 'is-gates-off',
    coloured() ? '' : 'is-uncoloured'
  ].join(' ');

  return html`${droppedNote(hidden)}
    <section class="grid-card ${mode}">
      ${body}
      ${foot && card(foot, { minWidth, sticky, cls: 'pblock--foot' })}
    </section>
    ${heatLegend()}`;
}

/*
 * «Heute», the bar plan's marker. It spans the project rows and nothing else:
 * the axis header names the quarters and the totals are sums under them, and a
 * rule saying «now» has nothing to add to either. Drawn over the whole track it
 * struck through the quarter heading.
 */
function todayMarker(left) {
  if (!left) return '';
  return html`<div class="ptoday" aria-hidden="true">
    <div class="ptoday__line" style="left:${left}"></div>
    <div class="ptoday__badge" style="left:${left}"
         title="${t('Heute')}, ${data.meta.todayLabel}">${t('Heute')}</div>
  </div>`;
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
    <div class="pgrid pgrid--editable" data-scroll>
      <div class="pgrid__track" style="min-width:${minWidth}px">${rows}</div>
    </div>
  </div>`;
}

/** The legend explains what is on screen, so it says whatever the view says. */
function heatLegend() {
  return planLegend({ layers: state.layers, coloured: coloured(), legend: data.print.legend });
}

/** Clicking the active column flips it; the toolbar reads the same state. */
const sortHead = (key, label, opts = {}) => sortableHead({
  ...opts, key, label, act: 'sort-col',
  active: state.sort === key, ascending: state.sortDir === 'asc'
});

/*
 * Most cells print the registry's plain text. These two draw something the
 * reader can act on, so they are named here rather than hidden behind a flag
 * on the column.
 */
const CELL_BODY = {
  title: p => html`<button type="button" class="prow__title"
      data-act="open-project" data-val="${p.id}" title="${p.title}">${p.title}</button>`,

  lead: (p, lead) => {
    const name = lead ? lead.name : html`<span class="lead-open">${t('nicht zugewiesen')}</span>`;
    return html`<button type="button" class="leadbtn" data-act="assign" data-val="${p.id}"
      title="${t('Bearbeitenden zuweisen')}">${name}</button>`;
  }
};

const cellBody = (col, p, lead) => {
  if (CELL_BODY[col.key]) return CELL_BODY[col.key](p, lead);
  if (col.short) return html`<span title="${col.text(p)}">${col.short(p)}</span>`;
  return col.text(p) || '—';
};

/** The one cell that also carries a state class. */
function cellState(col, p, lead) {
  if (col.key === 'lead') return lead ? '' : 'is-none';
  return '';
}

/** The class and offset a pinned column needs, as sortHead's options. */
const pin = (s, k, extra = '') => ({ cls: pinCls(s, k, extra), style: pinLeft(s, k) });

/* A period column sorts by what it shows: one quarter, or the span it averages. */
const periodSortKey = period => (period.quarters.length > 1
  ? `q${period.quarters[0]}-${period.quarters.at(-1)}`
  : `q${period.quarters[0]}`);

/** The column names, repeated at the top of every group card. */
function columnHeader(tpl, sticky, cols) {
  return html`
    <div class="prow prow--head" style="grid-template-columns:${raw(tpl)}">
      ${sticky.shown.map(col => {
        const extra = `${col.numeric ? 'pcell--num' : ''} ${alignCls(col)}`.trim();
        // Without a sort key the header is a label, not a control.
        if (!col.sort) {
          return html`<span class="pcell--text ${pinCls(sticky, col.key, extra)}"
              style="${pinLeft(sticky, col.key)}">${t(col.label)}</span>`;
        }
        return sortHead(col.sort, t(col.label), pin(sticky, col.key, extra));
      })}
      ${cols.map(period => sortHead(periodSortKey(period), period.short, {
        cls: `pcell--num pcell--period ${period.isNow ? 'is-today' : ''} ${yearRule(period)}`,
        title: period.isNow
          ? `${t('Heute')}, ${data.meta.todayLabel} — ${t('laufendes Quartal')}`
          : period.label
      }))}
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
    <div style="grid-column:span ${span}" class="prow__sumlabel is-frozen">${t('Summe')} ${g.label} (${g.projects.length})</div>
    ${cols.map(period => html`<span class="pcell pcell--sum ${yearRule(period)}">${fmt(periodValue(values, period))}</span>`)}
  </div>`;
}

function footRow(label, values, tpl, span, cols) {
  return html`<div class="prow prow--foot" style="grid-template-columns:${raw(tpl)}">
    <div style="grid-column:span ${span}" class="prow__footlabel is-frozen">${label}</div>
    ${cols.map(period => html`<span class="pcell pcell--foot ${yearRule(period)}">${fmt(periodValue(values, period))}</span>`)}
  </div>`;
}

function projectRow(p, lay, cols, rowIdx) {
  const { tpl, sticky } = lay;
  const L = state.layers;
  const lead = p.leadId ? data.peopleById[p.leadId] : null;
  const cells = projectDemand(p);
  const picking = state.picking && state.picking.projectId === p.id;

  return html`<div class="prow" style="grid-template-columns:${raw(tpl)}"
      data-row="${rowIdx}">
    ${sticky.shown.map(col => html`<span
        class="pcell ${col.cls} ${alignCls(col)} ${cellState(col, p, lead)} ${pinCls(sticky, col.key)} ${picking && col.key === 'lead' ? 'is-editing' : ''}"
        style="${pinLeft(sticky, col.key)}">${cellBody(col, p, lead)}</span>`)}

    ${cols.map(period => {
      const q = period.quarters[0];
      const v = periodValue(cells, period);
      // The lead being stretched says nothing about a quarter this project does
      // not run in, and a red nought is noise rather than a warning.
      const over = lead && v > 0 && period.quarters.some(x => lay.isOver(p.leadId, x));
      const editing = state.editing && state.editing.projectId === p.id && state.editing.q === q;
      /* With the figures switched off the cell is a slot for the band, not a
         control: nothing to read, nothing to edit. */
      const label = !L.values || (state.hideZeros && v === 0) ? '' : num(v);
      const description = `${p.title} · ${lead ? lead.name : t('nicht zugewiesen')}, ${period.label}: ${num(v)}${unitSuffix()}`
        + (over ? ` — ${t('Person über 100 % belegt, Überlast')}` : '');
      return html`<button type="button"
        class="pcell pcell--val heat-${heatStep(v)} ${over ? 'is-warn' : ''} ${editing ? 'is-editing' : ''} ${isEdited(p, q) ? 'is-edited' : ''} ${yearRule(period)}"
        data-act="cell" data-val="${p.id}" data-q="${q}" data-fk="cell:${p.id}:${q}"
        ${attr(!L.values, 'disabled')} aria-label="${description}" title="${description}">
        <span class="cellv">${label}</span>
      </button>`;
    })}

    ${(L.phases || L.gates) && phaseBand(p, cols, lay, { compact: L.values, bars: L.phases, gates: L.gates })}
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
  /* The person's utilisation with this edit applied — asked of the one
     function that converts pensum to utilisation, not worked out here. */
  const delta = state.draft - cellValue(p, q);
  const newUtil = lead ? personUtilisation(p.leadId, q, delta) : null;
  const over = newUtil != null && newUtil > 100;

  return html`<div class="pop" role="dialog" aria-modal="false" aria-label="${t('Pensum bearbeiten')}"
      style="${popoverPosition(anchor, { width: POP_WIDTH, height: POP_HEIGHT, x: anchor.right - POP_WIDTH })}">
    <div class="pop__kicker">${t('Pensum bearbeiten')}</div>
    <div class="pop__who">${p.title}</div>
    <div class="pop__what">${lead ? `${lead.name} · ${t(lead.role)}` : t('nicht zugewiesen')} · ${data.quarters[q].label}</div>

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
      'Kein Bearbeitender zugewiesen — das Pensum kann noch auf keine Person gebucht werden.')}</p>`}

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
   The Bearbeitender picker — a popover on the cell, like the pensum editor
   -------------------------------------------------------------------------- */

/*
 * The application used to open a 760px modal over the whole plan, list the
 * roster in its stored order, and ask for two clicks: pick, then «Zuweisen».
 * Three things follow from the merged view instead.
 *
 * It is a popover on the cell — the plan stays visible behind the decision, and
 * one pattern covers both edits rather than two. The pick is the commit: a
 * single-select list has nothing to confirm, and the change is logged like any
 * other. And it is ordered by the number the choice actually turns on —
 * capacity is why one name is right and another is wrong, so the people with
 * room come first and the light beside each says the same thing without
 * arithmetic.
 */
const PICK_WIDTH = 336;
const PICK_HEIGHT = 380;

export function assignPicker() {
  const { projectId, anchor, search = '' } = state.picking;
  const p = data.projectsById[projectId];
  const current = p.leadId ? data.peopleById[p.leadId] : null;
  const now = nowIndex();
  const q = search.trim().toLowerCase();
  const rows = data.people
    .map(person => ({ person, a: ampel(person.id, { from: now, to: now }) }))
    .filter(r => !q || `${r.person.name} ${r.person.role}`.toLowerCase().includes(q))
    .sort((x, y) => x.a.pct - y.a.pct || compareDe(x.person.name, y.person.name));

  return html`<div class="pop pop--assign" role="dialog" aria-modal="false" aria-label="${t('Bearbeitenden zuweisen')}"
      style="${popoverPosition(anchor, { width: PICK_WIDTH, height: PICK_HEIGHT, x: anchor.left })}">
    <div class="pop__kicker">${t('Bearbeitender')}</div>
    <div class="pop__who">${p.title}</div>
    <div class="pop__what">${current
      ? `${t('Aktuell')}: ${current.name} · ${personUtilisation(current.id, now)} %`
      : t('Aktuell nicht zugewiesen')}</div>
    ${personSearch({ act: 'pick-search', fk: 'pick-search', value: search, listId: 'pick-list' })}
    ${rows.length ? '' : html`<p class="rebook__empty">${t('Keine Person gefunden.')}</p>`}
    <ul class="rebook__list assign__list" id="pick-list" role="listbox" aria-label="${t('Person wählen')}">
      ${rows.map(r => personOption({
        id: r.person.id, name: r.person.name, mark: r.a.key, act: 'pick',
        meta: `${t(r.person.role)} · ${r.a.pct} %`, selected: r.person.id === p.leadId
      }))}
      ${personOption({
        id: '', mark: 'none', act: 'pick', selected: !p.leadId,
        name: html`<span class="assign__none">${t('Niemand zuweisen')}</span>`
      })}
    </ul>
  </div>`;
}
