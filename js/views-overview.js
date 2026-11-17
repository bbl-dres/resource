/* =============================================================================
   views-overview.js — the «Planung» grid: pensum figures per project and
   quarter, with the bar plan drawn as a band inside the same rows.
   ============================================================================= */

import {
  data, state, t, num, fmt, fmtMio, unitSuffix, cellValue, projectDemand, personUtilisation,
  totals, loadStatus, heatStep, filteredProjects, groupProjects,
  periods, periodValue, windowEdges, columnSet, coloured, phaseOf, nowIndex,
  roleOf, holderKey, peopleOn, holdersAt, activeSpan
} from './store.js';

import {
  html, raw, icons, pageHeader, pageActions, toolbar, activeFilterRow,
  noResults, droppedNote, attr,
  tokenPx, yearRule, pinCls, pinLeft, sortableHead, highlight, caretCell, rowCaret, plainCell, sumLabel, projectCount
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
export const MIN_PERIODS = 3;

function gridLayout() {
  const quarterW = tokenPx('--grid-period');
  const cols = periods().length;
  const room = cardWidth();
  const fit = {
    room,
    axis: MIN_PERIODS * quarterW,
    widthOf: c => tokenPx(c.width),
    titleW: titleWidth({ room, px: tokenPx }),
    /* The caret's own track, in front of the columns — see caretCell(). */
    lead: tokenPx('--grid-col-caret')
  };
  let layout = leadLayout(columnSet(), fit);
  /*
   * A phone. With every other column gone the name alone, at the floor it
   * has on a laptop, still fills the window: 38 + 285 of 343px, and a time
   * axis 20px wide. There it gives way too, down to a width that still
   * names the place, so that two quarters stand beside it. The whole name
   * is in the row's hint and in the dialog the name opens.
   */
  const narrow = layout.shown.length === 1 && layout.shown[0].key === 'title' && layout.width + fit.axis > room;
  if (narrow) {
    layout = leadLayout(columnSet(), {
      ...fit, titleW: Math.max(tokenPx('--grid-col-title-min'), room - fit.lead - 2 * quarterW)
    });
  }
  const { parts, sticky, shown, hidden, width: offset } = layout;
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
  return { tpl: parts.join(' '), minWidth, sticky, shown, hidden, colWidth, narrow };
}

/** How much width the card actually has, before it is in the DOM to measure. */
/*
 * Measured on the body, not on the root: the stylesheet reserves the page
 * scrollbar's gutter (scrollbar-gutter: stable), and the body is what that
 * gutter narrows. The root reports the full viewport until a real scrollbar
 * appears — which it did on the first render of a fresh load, when the page
 * was still short, so the first grid was 15px wider than every grid after it.
 */
export function cardWidth() {
  return Math.min(tokenPx('--layout-width'), document.body.clientWidth)
    - 2 * tokenPx('--shell-pad-x');
}

function pensumGrid() {
  const groups = groupProjects();
  const list = filteredProjects();
  const tot = totals(list);
  const lay = gridLayout();
  const { tpl, minWidth, sticky, hidden } = lay;
  /* A label across the frozen block: the caret's track and every column. */
  const span = sticky.shown.length + 1;
  /*
   * Whether a person is over their ceiling in a quarter, asked once per
   * person and read per cell. Asked per cell it was some 5,300 utilisation
   * calls a render, each walking the person's projects.
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

  const body = groups.map(g => {
    const collapsed = !!state.collapsedGroups[g.key];

    // The header sits on the page ground above its card. It sticks to the
    // left so it survives a scroll.
    const head = html`<div class="pgrouphead">
      <h2 class="pgrouphead__h"><button type="button" class="pgrouphead__toggle"
              data-act="toggle-group" data-val="${g.key}" aria-expanded="${!collapsed}">
        <span class="caret ${collapsed ? 'is-collapsed' : ''}" aria-hidden="true">${icons.chevronDown()}</span>
        <span class="pgrouphead__name">${g.label}</span>
        <span class="count-pill" aria-label="${projectCount(g.projects.length)}">${g.projects.length}</span>
      </button></h2>
      ${!collapsed && expandLink(g)}
    </div>`;

    if (collapsed) return html`<section class="pgroup">${head}</section>`;

    const rows = g.projects.map(p => projectRow(p, lay, cols));
    // Each card repeats the column header — a group has to be readable on its
    // own. It closes with its own sum for the same reason, and because the
    // printed report already does exactly that. The project rows are wrapped
    // once, so the today marker has something to span that is not the header
    // or the totals.
    return html`<section class="pgroup">${head}
      ${card(html`${columnHeader(tpl, sticky, cols, g.key)}
        <div class="pgrid__rows" role="rowgroup">${rows}${todayMarker(todayLeft)}</div>
        ${L.values && groupSum(g, tpl, sticky, cols)}`,
        { minWidth, sticky, label: g.label })}
    </section>`;
  });

  /* The totals are sums of the figures, so they go when the figures go. */
  const foot = L.values && html`<div role="row" class="prow prow--sum" style="grid-template-columns:${raw(tpl)}">
        ${sumLead(html`${t('Summe Total')}${tot.scoped ? html`<span class="prow__sumnote">${t('Auswahl')}</span>` : ''}
          <button type="button" class="linkbtn" data-act="foot-details">
            ${state.footDetails ? t('Details ausblenden') : t('Details anzeigen')}
          </button>`, list, sticky)}
        ${cols.map(period => html`<span role="cell" class="pcell pcell--sum ${yearRule(period)}">${fmt(periodValue(tot.demand, period))}</span>`)}
      </div>

      ${state.footDetails && html`
        ${footRow(t('davon vor Baukredit-Freigabe'), tot.preCredit, tpl, span, cols)}
        ${footRow(t('davon extern beauftragt'), tot.external, tpl, span, cols)}
        ${footRow(t('Kapazität netto, nach Abwesenheiten'), tot.net, tpl, span, cols)}`}

      <div role="row" class="prow prow--load" style="grid-template-columns:${raw(tpl)}">
        <div role="rowheader" aria-colspan="${span}" style="grid-column:span ${span}" class="prow__sumlabel is-frozen">${t('Auslastung')}${
          tot.scoped ? html`<span class="prow__sumnote">${t('Gesamtportfolio')}</span>` : ''}</div>
        ${cols.map(period => {
          /* All three figures are the period's average: a year column used to
             pair its average with the absolute figures of its first quarter. */
          const pct = periodValue(tot.utilisation, period);
          const st = loadStatus(pct);
          return html`<span role="cell" class="pcell pcell--load is-${st.key} ${yearRule(period)}"
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
      ${foot && card(foot, { minWidth, sticky, cls: 'pblock--foot', label: t('Summe Total') })}
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
export function card(rows, { minWidth, sticky, cls = '', label = '' }) {
  const edge = windowEdges();
  return html`<div class="pblock scrollbox ${cls}" style="--sticky-w:${sticky.width}px"
      ${attr(edge.before, 'data-before')} ${attr(edge.after, 'data-after')}>
    <div class="pgrid pgrid--editable" data-scroll>
      <div class="pgrid__track" role="table" aria-label="${label}" style="min-width:${minWidth}px">${rows}</div>
    </div>
  </div>`;
}

/** The legend explains what is on screen, so it says whatever the view says. */
function heatLegend() {
  return planLegend({ layers: state.layers, coloured: coloured(), legend: data.print.legend, staffing: true });
}

/*
 * «Alle aufklappen» for a whole group at once — it was «Besetzung
 * aufklappen», and the users did not know what a Besetzung was; «alle» says
 * what the link is about without a word for it. The label says what the
 * click will do: fold every row open while any is still shut, fold them all
 * shut once every one is open.
 */
function expandLink(g) {
  const all = g.projects.length > 0 && g.projects.every(p => state.openProjects[p.id]);
  const any = g.projects.some(p => state.openProjects[p.id]);
  return html`<button type="button" class="linkbtn pgroup__expand" data-act="toggle-projects-group" data-val="${g.key}">
    <span class="caret ${any ? '' : 'is-collapsed'}" aria-hidden="true">${icons.chevronDown()}</span>
    ${t(all ? 'Alle zuklappen' : 'Alle aufklappen')}
  </button>`;
}

/** Clicking the active column flips it; the toolbar reads the same state. */
const sortHead = (key, label, opts = {}) => sortableHead({
  ...opts, key, label, act: 'sort-col',
  active: state.sort === key, ascending: state.sortDir === 'asc'
});

/*
 * Most cells print the registry's plain text. The number and the name are the
 * cells the search reads and can show a hit in — the kind is the tail of the
 * title — so they draw its marks; a name on the project that matched shows
 * in the rows under it. «Bearbeitende» has a hint of its own.
 */
const CELL_BODY = {
  id: p => highlight(p.number),

  /*
   * The name is a link: it opens the project's dialog — four facts and the
   * way to SAP ePPM. Everywhere else a click on the row folds it. For a
   * while the name was plain text, after the users had found the large
   * dialog it opened in their way; they asked for the link back, onto a
   * small one.
   */
  title: p => html`<button type="button" class="prow__title" data-act="open-project" data-val="${p.id}"
    title="${p.title}">${highlight(p.title)}</button>`,

  /*
   * The number of people on the project, and nothing else — the users asked
   * for the count alone where the cell named the lead and counted the rest.
   * Who they are is in the rows under the project; the hint lists them
   * without the click, and says how many roles are open now.
   */
  lead: p => {
    const names = peopleOn(p).map(id => data.peopleById[id]?.name).filter(Boolean);
    const open = p.assignees.filter(a => !a.person && a.demand[nowIndex()] > 0).length;
    const hint = (names.length ? names.join(', ') : t('nicht zugewiesen'))
      + (open ? ` · ${open} ${t(open === 1 ? 'Rolle' : 'Rollen')} ${t('offen')}` : '');
    return html`<span title="${hint}">${names.length}</span>`;
  }
};

const cellBody = (col, p, lead) => (CELL_BODY[col.key] ? CELL_BODY[col.key](p, lead) : plainCell(col, p));

/** The one cell that also carries a state class: nobody on the project. */
function cellState(col, p) {
  if (col.key === 'lead') return p.assignees.some(a => a.person) ? '' : 'is-none';
  return '';
}

/** The class and offset a pinned column needs, as sortHead's options. */
const pin = (s, k, extra = '') => ({ cls: pinCls(s, k, extra), style: pinLeft(s, k) });

/* A period column sorts by what it shows: one quarter, or the span it averages. */
const periodSortKey = period => (period.quarters.length > 1
  ? `q${period.quarters[0]}-${period.quarters.at(-1)}`
  : `q${period.quarters[0]}`);

/*
 * The column names, repeated at the top of every group card — so each sort
 * button exists once per group, and carries the group in its focus key:
 * found by action and column alone, focus came back on the first card's
 * header whichever card had been clicked.
 */
function columnHeader(tpl, sticky, cols, group) {
  return html`
    <div role="row" class="prow prow--head" style="grid-template-columns:${raw(tpl)}">
      ${caretCell()}
      ${sticky.shown.map(col => {
        const extra = `${col.numeric ? 'pcell--num' : ''} ${alignCls(col)}`.trim();
        // Without a sort key the header is a label, not a control.
        if (!col.sort) {
          return html`<span role="columnheader" class="pcell--text ${pinCls(sticky, col.key, extra)}"
              style="${pinLeft(sticky, col.key)}">${t(col.gridLabel ?? col.label)}</span>`;
        }
        return sortHead(col.sort, t(col.gridLabel ?? col.label), { ...pin(sticky, col.key, extra), fk: `sort:${group}:${col.sort}` });
      })}
      ${cols.map(period => sortHead(periodSortKey(period), period.short, {
        fk: `sort:${group}:${periodSortKey(period)}`,
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
 * selection when the reader is looking at the small projects alone.
 */
function groupSum(g, tpl, sticky, cols) {
  /* «Summe (11 Bauprojekte)». The group's name is not repeated — it stands in
     the heading of the card this row closes — and the count says what it
     counts: «(11)» after «3 Mio. CHF» read as one more amount. */
  const count = g.projects.length;
  const values = data.quarters.map((_, q) => g.projects.reduce((a, p) => a + cellValue(p, q), 0));
  return html`<div role="row" class="prow prow--sum prow--groupsum" style="grid-template-columns:${raw(tpl)}">
    ${sumLead(sumLabel(count), g.projects, sticky)}
    ${cols.map(period => html`<span role="cell" class="pcell pcell--sum ${yearRule(period)}">${fmt(periodValue(values, period))}</span>`)}
  </div>`;
}

/**
 * The frozen part of a sum row: its label and, where the credit column is on,
 * the credits of the same projects under that column. The pensum was the only
 * thing a sum row added up; the users asked what a group is worth as well, and
 * the figure belongs under the column that lists it.
 *
 * A project whose credit is still open adds nothing, and the hint says how
 * many of those the sum leaves out.
 */
function sumLead(label, projects, sticky) {
  const shown = sticky.shown;
  const at = shown.findIndex(c => c.key === 'credit');
  /* The label starts at the card's edge, over the caret's track. */
  if (at < 0) {
    return html`<div role="rowheader" aria-colspan="${shown.length + 1}" style="grid-column:span ${shown.length + 1}" class="prow__sumlabel is-frozen">${label}</div>`;
  }
  const col = shown[at];
  const funded = projects.filter(p => p.credit != null);
  const open = projects.length - funded.length;
  const total = funded.reduce((a, p) => a + p.credit, 0);
  const after = shown.length - at - 1;
  return html`<div role="rowheader" aria-colspan="${at + 1}" style="grid-column:span ${at + 1}" class="prow__sumlabel is-frozen">${label}</div>
    <span role="cell" class="pcell ${col.cls} ${alignCls(col)} ${pinCls(sticky, col.key)}" style="${pinLeft(sticky, col.key)}"
      title="${t('Summe')} ${t(col.label)} · ${funded.length} ${t('Projekte mit Kredit')}${open ? ` · ${open} ${t('offen')}` : ''}"
      >${funded.length ? fmtMio(total, 2) : '—'}</span>
    ${after > 0 && html`<span class="is-frozen" style="grid-column:span ${after}; ${pinLeft(sticky, shown[at + 1].key)}"></span>`}`;
}

function footRow(label, values, tpl, span, cols) {
  return html`<div role="row" class="prow prow--foot" style="grid-template-columns:${raw(tpl)}">
    <div role="rowheader" aria-colspan="${span}" style="grid-column:span ${span}" class="prow__footlabel is-frozen">${label}</div>
    ${cols.map(period => html`<span role="cell" class="pcell pcell--foot ${yearRule(period)}">${fmt(periodValue(values, period))}</span>`)}
  </div>`;
}

/*
 * A project row, and under it — once it is folded open — its Bearbeitende,
 * role by role.
 *
 * Folded, the row is the one it always was: the project's demand per quarter,
 * which is the sum over the rows under it. The whole row is the switch: a
 * click anywhere on it — the caret, a figure, the empty space — folds it open
 * or shut. Three things in it take their own click first: the project's
 * name, which opens its dialog, and a bar or a gate of the band. The caret stands in a track of its own in
 * front of the columns, so it is the first thing in the row whichever
 * columns are on; it and the figures are buttons, so the keyboard reaches
 * the switch too.
 */
function projectRow(p, lay, cols) {
  const { tpl, sticky } = lay;
  const L = state.layers;
  const lead = p.leadId ? data.peopleById[p.leadId] : null;
  const cells = projectDemand(p);
  const open = !!state.openProjects[p.id];

  const row = html`<div role="row" class="prow prow--project ${open ? 'is-open' : ''}" style="grid-template-columns:${raw(tpl)}"
      data-act="toggle-project" data-val="${p.id}">
    ${caretCell(rowCaret({
      act: 'toggle-project', val: p.id, open, label: `${t('Rollen ein-/ausklappen')}: ${p.title}`
    }))}
    ${sticky.shown.map(col => html`<span role="${col.key === 'title' ? 'rowheader' : 'cell'}"
        class="pcell ${col.cls} ${alignCls(col)} ${cellState(col, p, lead)} ${pinCls(sticky, col.key)}"
        style="${pinLeft(sticky, col.key)}">${cellBody(col, p, lead)}</span>`)}

    ${cols.map(period => {
      const q = period.quarters[0];
      const v = periodValue(cells, period);
      /* Somebody on the project is over their ceiling in the quarter. A
         nought carries no warning: nobody is stretched by a quarter the
         project does not run in. */
      const over = v > 0 && period.quarters.some(x => [...holdersAt(p, x)].some(id => lay.isOver(id, x)));
      /* With the figures switched off the cell is a slot for the band, not a
         control: nothing to read, nothing to open. */
      const label = !L.values || (state.hideZeros && v === 0) ? '' : num(v);
      /* With the band drawn under the figures, the cell names the phase that
         runs in its quarter too — the same fact the bar below it carries. */
      const running = L.phases ? p.bars.find(b => b.from <= q && q < b.to) : null;
      const description = `${p.title} · ${lead ? lead.name : t('nicht zugewiesen')}, ${period.label}: ${num(v)}${unitSuffix()}`
        + (running ? ` · ${t(phaseOf(running.phase).label)}` : '')
        + (over ? ` — ${t('Person über 100 % belegt, Überlast')}` : '');
      /*
       * A cell, not a button. Each of the sixteen was one — 1,776 of them on
       * the page, every one folding the row exactly as the caret in front of
       * it does — so the table was 2,090 tab stops long and a row took
       * eighteen presses to cross. The row still folds on a click anywhere in
       * it; from the keyboard the caret does it. Read out, the cell is its
       * number under the heading of its quarter, with the overload said in
       * words, because nothing on screen draws it. With the figures switched
       * off it is a slot for the band and says nothing.
       */
      return html`<span role="cell" ${attr(!L.values, 'aria-hidden="true"')}
        class="pcell pcell--val heat-${heatStep(v)} ${over ? 'is-warn' : ''} ${yearRule(period)}"
        title="${L.values ? description : ''}">
        <span class="cellv">${label}</span>${L.values && over && html`<span class="sr-only">, ${t('Überlast')}</span>`}
      </span>`;
    })}

    ${(L.phases || L.gates) && phaseBand(p, cols, lay, { compact: L.values, bars: L.phases, gates: L.gates, cell: true })}
  </div>`;

  return open ? html`${row}${laneRows(p, lay, cols)}` : row;
}

/* -----------------------------------------------------------------------------
   The rows under an open project — a role, a person, and a number per quarter
   -------------------------------------------------------------------------- */

/*
 * One row per role and person the project has, in the catalogue's order of
 * the roles. A row reads like a line of a spreadsheet: the role under the
 * project's name, the person beside it under «Bearbeitende» — the two
 * columns are neighbours for that reason — and a number in every quarter.
 *
 * Only the numbers are fields. Which roles a project has and who holds them
 * is master data: it is kept in SAP ePPM and read here, not edited. The grid
 * used to let a person be chosen in the row and a role be added under it;
 * both went, because a change made here would not have been one in the
 * system the data comes from. What this tool adds to that data is the
 * pensum per quarter, and that is what a row lets the reader type.
 *
 * A role two people hold in turn is two rows. A role with nobody on it says
 * «nicht zugewiesen», in the warning hue, and its pensum can be planned all
 * the same.
 */
function laneRows(p, lay, cols) {
  return p.assignees.map(a => laneRow(p, roleOf(a.role), a, lay, cols));
}

function laneRow(p, role, a, lay, cols) {
  const { tpl, sticky } = lay;
  const person = a.person ? data.peopleById[a.person] : null;
  const who = person ? person.name : t('nicht zugewiesen');
  const shown = new Set(sticky.shown.map(c => c.key));
  const when = activeSpan(a);
  const hint = `${t(role.label)} · ${who} · ${p.title}${when ? ` · ${when}` : ''}`;

  const roleLabel = html`<span class="lane__role">${t(role.label)}</span>`;
  /* A name the search matched shows its hit here: the folded row only counts. */
  const name = html`<span class="lane__person ${person ? '' : 'is-open'}">${highlight(who)}</span>`;

  /* The role goes under the project's name and the person under
     «Bearbeitende». Where one of the two columns is off, the other carries
     what is left — the role's short form in front of the name, or the name
     beside the role. */
  const cell = col => {
    if (col.key === 'title') {
      if (shown.has('lead')) return roleLabel;
      /* On a phone the name's column is too short for a role written out. */
      return lay.narrow ? html`<span class="lane__role lane__role--short">${t(role.short)}</span>${name}` : html`${roleLabel}${name}`;
    }
    if (col.key === 'lead') {
      return shown.has('title') ? name : html`<span class="lane__role lane__role--short">${t(role.short)}</span>${name}`;
    }
    if (col.key === 'id' && !shown.has('title') && !shown.has('lead')) return t(role.short);
    return '';
  };

  return html`<div role="row" class="prow prow--lane" style="grid-template-columns:${raw(tpl)}">
    ${caretCell()}
    ${sticky.shown.map(col => html`<span role="cell" class="pcell lane__cell lane__cell--${col.key} ${pinCls(sticky, col.key)}"
        style="${pinLeft(sticky, col.key)}" title="${hint}">${cell(col)}</span>`)}
    ${cols.map(period => laneCell(p, role, a, period, lay.isOver))}
  </div>`;
}

/*
 * One quarter of one row: a field with the number in it, on the heat colour
 * of its value. Blank where the person carries nothing. Typing replaces the
 * figure and leaving the cell writes it — see commitCell() in app.js. A
 * column that spans several quarters shows their average, and a figure typed
 * into it is the pensum of each of them.
 *
 * The cell is found again after a render by its column, not by its quarters:
 * at month scale three columns show the same quarter, and named by the
 * quarter all three were one cell — Tab from the first landed on the first.
 *
 * The same cell on both tabs. A pensum belongs to a project, a role and a
 * person, and it does not matter from which side the row was reached: under
 * its project on Planung, or under its person on Personen, where most people
 * look their own figures up — and so set them. `isOver` is Planung's lookup
 * of who is over their ceiling when; Personen shows that in the row above.
 */
export function laneCell(p, role, a, period, isOver = () => false) {
  const from = period.quarters[0];
  const to = period.quarters.at(-1) + 1;
  const v = periodValue(a.demand, period);
  const key = `${role.id}:${holderKey(a)}`;
  const who = a.person ? data.peopleById[a.person]?.name ?? a.person : t('nicht zugewiesen');
  const over = !!a.person && v > 0 && period.quarters.some(x => isOver(a.person, x));
  const tone = v > 0 ? (a.person ? `heat-${heatStep(v)}` : 'is-open') : 'is-zero';
  const description = `${t(role.label)} · ${who} · ${p.title}, ${period.label}`;
  return html`<span role="cell" class="pcell pcell--val pcell--lanev ${tone} ${yearRule(period)}"
      title="${description}${over ? ` — ${t('Person über 100 % belegt, Überlast')}` : ''}">
    <input type="text" inputmode="decimal" autocomplete="off" class="lanev__in" value="${v > 0 ? num(v) : ''}"
      data-act="lane-input" data-val="${p.id}" data-role="${role.id}" data-holder="${holderKey(a)}"
      data-q="${from}" data-to="${to}" data-col="${period.id}" data-fk="lane:${p.id}:${key}:${period.id}"
      aria-label="${description}: ${t('Pensum')}${unitSuffix()}${over ? ` — ${t('Person über 100 % belegt, Überlast')}` : ''}">
  </span>`;
}
