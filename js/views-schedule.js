/* =============================================================================
   views-schedule.js — Tab «Termine»: the bar plan, with a capacity band
   underneath that answers the same question the Übersicht footer does.
   ============================================================================= */

import {
  data, state, t, num, unitSuffix, totals, loadStatus, groupProjects, periods, phaseOf,
  periodValue, windowEdges, columnSet
} from './store.js';

import {
  html, raw, icons, pageHeader, pageActions, toolbar, activeFilterRow,
  timeControls, noResults, legendBlock, legendItem, yearRule, sortableHead, attr,
  tokenPx, pinCls, pinLeft, ampelDot, droppedNote, textWidth
} from './ui.js';

import { leadLayout, titleWidth, alignCls } from './columns.js';

/*
 * Below three quarters the axis stops being a plan, so the lead columns give
 * way first — the same floor the pensum grid holds.
 */
const MIN_PERIODS = 3;

/** The frozen block in front of the bars, from the same registry as the table. */
function ganttLayout() {
  const quarterW = tokenPx('--grid-period');
  const room = Math.min(tokenPx('--layout-width'), document.documentElement.clientWidth)
    - 2 * tokenPx('--shell-pad-x');
  const cols = periods().length;
  const lay = leadLayout(columnSet(), {
    room, axis: MIN_PERIODS * quarterW, widthOf: c => tokenPx(c.width),
    titleW: titleWidth({ room, px: tokenPx })
  });

  /*
   * The bar track stops at the same ceiling the pensum grid's cells stop at, so
   * a quarter is the same width in both tabs and neither stretches to fill the
   * card. Left to take the whole remainder, a five-column year view drew bars
   * across 180px quarters while the table beside it held them at 96.
   *
   * Fixed widths otherwise: with two flexible tracks in one row they split the
   * slack, and the frozen block would no longer be the width the capacity band
   * below it is drawn to.
   */
  /*
   * A floor as well as a ceiling, exactly as the pensum grid's columns have. The
   * track was `minmax(0, …)`, which let it shrink to whatever was left over — so
   * it always fitted, nothing ever overflowed, and the timeline could not be
   * panned at all. The pensum grid never lost that because its columns have
   * always had a minimum width.
   */
  const floor = cols * quarterW;
  const ceiling = cols * tokenPx('--grid-period-max');
  const track = Math.min(ceiling, Math.max(floor, room - lay.width));
  return {
    ...lay,
    colWidth: cols ? track / cols : 0,
    tpl: [...lay.parts, `minmax(${floor}px, ${ceiling}px)`].join(' ')
  };
}


/* A sparkline draws over the quarter cells, which this grid has not got. */
const MENU = { exclude: ['trend'] };

export function renderSchedule() {
  const body = groupProjects().some(g => g.projects.length) ? ganttView()
    : noResults('Bauprojekte');

  return html`
    ${pageHeader({
      crumbs: ['Bauprojekte', 'Termine'],
      title: 'Ressourcenplanung',
      actions: pageActions({ edit: true })
    })}
    <div class="wrap"><div class="content">
      ${toolbar(MENU)}
      ${activeFilterRow()}
      ${timeControls()}
      ${body}
    </div></div>`;
}

/* =============================================================================
   Gantt
   ========================================================================== */

/**
 * Where today sits along the visible track, as a 0–1 fraction — or null once
 * the window has been stepped past it. The columns flex, so the marker is
 * placed proportionally rather than in pixels.
 */
/**
 * Where today falls on the visible axis, as a share of its whole width.
 *
 * Today is first placed on the quarter axis as a fractional index — quarter 0
 * plus how far into it the date sits — and then looked up against the slice
 * each column covers. Matching on `quarters` instead put the marker in the
 * first of the three month columns that share a quarter, so at month scale the
 * line stood in July while the heading marked August.
 */
function todayFraction(cols) {
  const today = new Date(data.meta.today + 'T00:00:00');
  const qStart = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1);
  const qEnd = new Date(qStart.getFullYear(), qStart.getMonth() + 3, 1);
  const q = data.quarterIndex[data.meta.todayQuarter] ?? 0;
  const at = q + (today - qStart) / (qEnd - qStart);

  const i = cols.findIndex(c => at >= c.from && at < c.to);
  if (i < 0) return null;                        // the window has moved past today
  const col = cols[i];
  return (i + (at - col.from) / (col.to - col.from)) / cols.length;
}

function ganttView() {
  const groups = groupProjects();
  const tot = totals();
  const cols = periods();
  const lay = ganttLayout();
  const edge = windowEdges(cols);
  const f = todayFraction(cols);
  // A share of the time axis, not of the card: the marker lives in an overlay
  // that starts where the frozen column ends, so it can never run underneath it.
  const todayLeft = f === null ? null : `${(f * 100).toFixed(2)}%`;

  return html`<div class="gantt" style="--gantt-cols:${cols.length};--gantt-lead:${lay.width}px">
    ${droppedNote(lay.hidden)}
    ${groups.map(g => {
      const collapsed = g.label ? state.collapsedGroups[`g:${g.key}`] : false;
      return html`<section class="gantt__group">
        ${g.label && html`<h2 class="pgrouphead">
          <button type="button" class="pgrouphead__toggle" data-act="toggle-group" data-val="g:${g.key}"
                  aria-expanded="${!collapsed}">
            <span class="caret ${collapsed ? 'is-collapsed' : ''}" aria-hidden="true">${icons.chevronDown()}</span>
            <span class="pgrouphead__name">${g.label}</span>
            <span class="count-pill">${g.projects.length}</span>
          </button>
        </h2>`}
        ${!collapsed && html`<div class="gantt__card scrollbox"
          ${attr(edge.before, 'data-before')} ${attr(edge.after, 'data-after')}>
          <div class="gantt__scroll" data-scroll>
          ${ganttAxis(cols, lay)}
          <div class="gantt__body">
            ${todayLeft && html`<div class="gantt__overlay" aria-hidden="true">
              <div class="gantt__today" style="left:${raw(todayLeft)}"></div>
              <div class="gantt__todaybadge" style="left:${raw(todayLeft)}"
                   title="${t('Heute')}, ${data.meta.todayLabel}">${t('Heute')}</div>
            </div>`}
            ${g.projects.map(p => ganttRow(p, cols, lay))}
          </div>
          </div>
        </div>`}
      </section>`;
    })}

    <section class="capband scrollbox" style="--gantt-cols:${cols.length};--gantt-lead:${lay.width}px"
      ${attr(edge.before, 'data-before')} ${attr(edge.after, 'data-after')}>
      <div class="capband__scroll" data-scroll>
      <div class="capband__row">
        <div class="capband__label">
          <div class="capband__title">${t('Auslastung')}</div>
        </div>
        <div class="capband__cells">
          ${cols.map(col => {
            const pct = periodValue(tot.utilisation, col);
            const q = col.quarters[0];
            const st = loadStatus(pct);
            return html`<div class="capband__cell is-${st.key} ${yearRule(col)}"
                title="${col.label}: ${pct} % — ${t(st.label)} · ${tot.booked[q]} % ${t('gebucht auf')} ${tot.net[q]} % ${t('netto')}">
              <span class="capband__value">${pct} %</span>
            </div>`;
          })}
        </div>
      </div>
      </div>
    </section>

  </div>
  ${ganttLegend()}`;
}

/**
 * The bar plan spends colour only on exceptions, so the legend only has to
 * name those — plus the utilisation bands, which lost their words when the
 * capacity band was reduced to figures.
 */
export function ganttLegend(cls = '') {
  const l = data.print.legend;
  return legendBlock([
    {
      label: 'Balken',
      items: html`${legendItem(html`<span class="legend__swatch is-delay"></span>`, 'Verzug')}
        ${legendItem(html`<span class="legend__swatch is-nolead"></span>`, 'ohne Projektleitung')}`
    },
    {
      label: 'Meilenstein',
      items: html`${legendItem(html`<span class="diamond"></span>`, 'im Termin')}
        ${legendItem(html`<span class="diamond is-late"></span>`, 'verschoben')}
        ${legendItem(html`<span class="diamond is-open"></span>`, 'Termin offen')}`
    },
    { label: 'Auslastung', items: html`${t(l.thresholds).replace(/^Auslastung:\s*/, '')}` }
  ], cls);
}

/**
 * A lead-column header. Clicking it sorts, exactly as in the pensum grid — both
 * read the same two pieces of state, so the two tabs cannot disagree. A column
 * with no sort key is a label, not a control.
 */
function leadHead(col, lay) {
  const cls = `gantt__axislabel gantt__col--${col.key} ${alignCls(col)} ${pinCls(lay.sticky, col.key)}`;
  if (!col.sort) {
    return html`<span class="${cls}" style="${pinLeft(lay.sticky, col.key)}">${t(col.label)}</span>`;
  }
  return sortableHead({
    key: col.sort, label: t(col.label), act: 'sort-col', cls,
    style: pinLeft(lay.sticky, col.key),
    active: state.sort === col.sort, ascending: state.sortDir === 'asc'
  });
}

function ganttAxis(cols, lay) {
  return html`<header class="gantt__axis" style="grid-template-columns:${raw(lay.tpl)}">
    ${lay.shown.map(col => leadHead(col, lay))}
    <div class="gantt__quarters">
      ${cols.map(col => html`<div class="${col.isNow ? 'is-today' : ''} ${yearRule(col)}"
        title="${col.label}">${col.short}</div>`)}
    </div>
  </header>`;
}

/** What a lead column shows in the bar plan. Three draw; the rest is text. */
function leadCell(col, p) {
  if (col.key === 'title') {
    return html`<button type="button" class="gantt__rowtitle" data-act="open-project"
        data-val="${p.id}" title="${p.title}">${p.title}</button>`;
  }
  if (col.key === 'ampel') return ampelDot(p);
  if (col.key === 'target') return html`${num(p.target)}${unitSuffix()}`;
  return col.text ? col.text(p) : '';
}

export function ganttRow(p, cols, lay) {
  const bars = p.bars ?? [];
  const delayed = bars.some(b => b.delay);
  const rail = p.unassigned ? 'is-unassigned' : delayed ? 'is-delayed' : '';

  return html`<div class="gantt__row ${rail}" style="grid-template-columns:${raw(lay.tpl)}">
    ${lay.shown.map(col => html`<div
      class="gantt__rowlabel gantt__col--${col.key} ${alignCls(col)} ${pinCls(lay.sticky, col.key)}"
      style="${pinLeft(lay.sticky, col.key)}">${leadCell(col, p)}</div>`)}
    <div class="gantt__track">
      ${cols.map((col, n) => html`<span class="gantt__gridline ${yearRule(col)}"
        style="grid-column:${n + 1}"></span>`)}
      ${(() => {
        const marks = gatePlaces(p, cols);
        const placed = placeBars(bars, cols);
        return html`${placed.map((at) => ganttBar(at, placed, cols, p, lay, marks))}
          ${gates(marks, cols, p)}`;
      })()}
      ${bars.some(b => b.openEnd) && openEndRail(bars.find(b => b.openEnd), cols)}
    </div>
  </div>`;
}

/**
 * Where a quarter falls on the track, measured in columns — 2.5 being halfway
 * through the third column. Fractional quarters are the point: a gate falls on
 * a day, not at the end of the quarter it happens to sit in.
 *
 * Read from the period's own `from`/`to`, the way todayFraction already does.
 * Matching on its `quarters` list instead looks equivalent and is not: a month
 * column carries `quarters: [5]` but spans a third of quarter 5, so the test
 * `q <= 5` rejected every fractional q and pushed it into the next column. Every
 * one of 390 gates was drawn late — by up to 2.97 columns at month scale, which
 * is a gate skipping all three months of its own quarter.
 */
function unitAt(cols, q) {
  for (let i = 0; i < cols.length; i++) {
    const c = cols[i];
    if (q < c.from) return i;
    if (q < c.to) return i + (q - c.from) / (c.to - c.from);
  }
  return cols.length;
}

/*
 * Every bar of a row, placed on the track and clipped to it.
 *
 * Bars used to be laid out by whole columns. That is exact while a column is a
 * quarter, but at year scale a phase boundary usually falls inside a column,
 * and both phases claimed it: 212 of 392 bars were drawn one on top of the
 * other, a full column wide. What showed was whichever happened to be painted
 * last, which is why the divider between two phases seemed to come and go.
 */
function placeBars(bars, cols) {
  return bars
    .map((b) => ({
      b,
      from: Math.max(0, unitAt(cols, b.from)),
      to: Math.min(cols.length, unitAt(cols, b.to))
    }))
    .filter((at) => at.to > at.from);
}

const EPSILON = 1e-6;
const abuts = (a, b) => Math.abs(a - b) < EPSILON;

/*
 * What a bar says. The full name where it fits, the sub-phase number where it
 * does not, and nothing at all where even that would be cut.
 *
 * Decided here rather than in the data. Written into the file against a quarter
 * count, the same 394 of 496 bars carried a name at every scale and every
 * window width — at year scale 119 of those were cut off mid-word and 105 ran
 * underneath a milestone diamond.
 */
const BAR_PADDING = 16;      // --space-4 on each side
const GATE_CLEAR = 17;       // half a diamond, and air enough to read past it
const CHEVRON = 19;          // the mark on a bar that runs off the window: a
                             // 13px icon and the --space-3 gap before it
const EDGE = 1e-3;           // a gate on a boundary belongs to neither bar

/*
 * Where a gate is actually drawn, in pixels along the track — its date, less
 * whatever the fan-out moved it by.
 */
const gateX = (g, w) => g.at * w - (g.shift ?? 0);

/*
 * The clear run a label has inside its bar, as a start and an end in pixels.
 *
 * A gate standing inside the bar cuts the run short. A gate on the bar's own
 * boundary — the ordinary case, one marking the end of the phase it closes —
 * does not, but it is a diamond centred on that boundary, so half of it lies in
 * this bar and the label has to begin after it. That last case was almost all
 * of what still collided: not names running too long, but names starting too
 * early, four pixels under the diamond that opened them.
 */
function barRun(b, at, lay, gates) {
  const w = lay.colWidth || 0;
  const x0 = at.from * w;
  const x1 = at.to * w - (b.continues ? CHEVRON : 0);
  const half = BAR_PADDING / 2;

  let from = x0 + half;
  let to = x1 - half;
  for (const g of gates) {
    const x = gateX(g, w);
    if (x <= x0 - GATE_CLEAR || x >= x1 + GATE_CLEAR) continue;
    if (x <= x0 + EDGE) from = Math.max(from, x + GATE_CLEAR);
    else if (x < x1) { to = Math.min(to, x - GATE_CLEAR); break; }
    else to = Math.min(to, x - GATE_CLEAR);
  }

  /*
   * Round the start the same way the padding is written, and keep a pixel back.
   * Measuring against a fractional width the element cannot have left two bars
   * a shade too narrow for the name they had already been given, and the browser
   * finished the sentence with an ellipsis.
   */
  from = Math.round(from);
  return { from, to, room: to - from - 1 };
}

/*
 * What a bar says, in three steps down: the phase and its name, the number
 * alone, or nothing at all. Decided against the run the bar actually has on
 * screen, so it answers the same way at every scale and every window width, and
 * a bar never carries a word cut in half or a name running under a milestone.
 *
 * The full name stays in the tooltip and in the accessible name either way.
 */
function barText(b, run) {
  const name = t(phaseOf(b.phase).label);
  if (textWidth(name) <= run.room) return name;
  return textWidth(b.phase) <= run.room ? b.phase : '';
}

function ganttBar(at, placed, cols, p, lay, gates) {
  const b = at.b;
  /*
   * A bar draws its own left edge unless the phase before it ends exactly
   * there, in which case that phase's right edge already is the divider.
   * Judged on what is drawn, not on the data: where the previous phase lies
   * outside the window there is nothing to lean on, and the bar needs its own.
   */
  const startsChain = !placed.some((o) => o !== at && abuts(o.to, at.from));
  const endsChain = !placed.some((o) => o !== at && abuts(o.from, at.to));
  const cls = [
    'gantt__bar',
    b.delay ? 'is-delay' : b.unassigned ? 'is-unassigned' : 'is-phase',
    startsChain ? 'is-first' : '',
    endsChain && !b.continues ? 'is-last' : '',
    b.continues ? 'is-open' : ''
  ].join(' ');

  const left = (at.from / cols.length) * 100;
  const width = ((at.to - at.from) / cols.length) * 100;
  const run = barRun(b, at, lay, gates);
  /*
   * Only where a label will actually be drawn. On a bar too narrow to carry
   * even its number, the clearance is 16.5px of padding on a 23.5px box —
   * more than the box holds, so it grew instead and overlapped the phase
   * beside it, which is the one thing these bars must never do.
   */
  const inset = run.room > 0
    ? Math.max(0, run.from - at.from * (lay.colWidth || 0))
    : 0;
  const full = t(phaseOf(b.phase).label);
  return html`<button type="button" class="${cls}"
      style="left:${left}%;width:${width}%;padding-left:${inset}px"
      data-act="open-phase" data-val="${p.id}:${b.from}"
      title="${t(b.milestone) || full}" aria-label="${p.title}: ${full}">
    <span class="gantt__barlabel">${barText(b, run)}</span>
    ${b.continues && html`<span class="gantt__more" aria-hidden="true">${icons.chevronRight(13)}</span>`}
  </button>`;
}

/** How far through its quarter a date falls, from 0 at the first day to 1. */
function quarterFraction(iso, qi) {
  const q = data.quarters[qi];
  if (!q || !iso) return 1;
  const first = Date.UTC(q.year, (Number(q.short.slice(1)) - 1) * 3, 1);
  const next = Date.UTC(q.year, Number(q.short.slice(1)) * 3, 1);
  const [y, m, d] = iso.split('-').map(Number);
  const on = Date.UTC(y, m - 1, d);
  return Math.min(1, Math.max(0, (on - first) / (next - first)));
}

/*
 * Every gate of a row, placed on the track in the units the bars use — and to
 * its date, not to the end of the quarter it happens to fall in. A gate is a
 * day: a Baukredit is released on one, and the plan should show where.
 *
 * It used to be placed by column, at that column's right edge. A quarter is a
 * column at quarter scale, so nothing showed; at year scale a gate due in Q2
 * slid three quarters forward, to the end of the year, and came down in the
 * middle of a bar's name — which was most of what the labels collided with.
 *
 * Anything outside the window is dropped rather than pinned to its edge. The
 * window is a slice of a ten-year plan, so most of a project's gates lie beyond
 * it; drawn at the last column they stacked up there as diamonds claiming dates
 * they do not have — 136 of them at quarter scale, 252 at month, visible as soon
 * as the track was scrolled to its end.
 */
function gatePlaces(p, cols) {
  const out = [];
  for (const m of data.milestonesByProject[p.id] ?? []) {
    const qi = data.quarterIndex[m.forecast ?? m.plan];
    if (qi === undefined) continue;
    const at = unitAt(cols, qi + quarterFraction(m.forecastDate ?? m.planDate, qi));
    if (at <= 0 || at >= cols.length) continue;
    out.push({ m, at });
  }
  out.sort((a, b) => a.at - b.at || a.m.code.localeCompare(b.m.code));

  /*
   * Two gates due at the same moment land on the same pixel, and the second is
   * then invisible and unclickable. They fan out to the left, so a pair reads
   * as two marks in sequence — and the label rule reads the same offsets, or it
   * would clear the diamond it can see and run under the one beside it.
   */
  const perPlace = out.reduce((a, g) => ((a[g.at] = (a[g.at] ?? 0) + 1), a), {});
  const seen = {};
  for (const g of out) {
    const rank = (seen[g.at] = (seen[g.at] ?? 0) + 1);
    // Earliest of a stack sits leftmost, so the sequence still reads forwards.
    g.shift = (perPlace[g.at] - rank) * 13;
  }
  return out;
}

function gates(placed, cols, p) {
  if (!placed.length) return '';

  return html`${placed.map(({ m, at, shift }) => {
    const cat = data.milestoneCatalog[m.code];
    const state = m.forecast === null ? 'is-open' : m.status === 'late' ? 'is-late' : '';
    const label = `${m.code} ${cat ? t(cat.name) : ''} · ${data.quarters[data.quarterIndex[m.forecast ?? m.plan]].label}`;
    return html`<button type="button" class="gantt__gate"
        style="left:${(at / cols.length) * 100}%; --gate-shift:${shift}px"
        data-act="open-milestone" data-val="${m.id}"
        title="${label} — ${t(m.statusLabel)}"
        aria-label="${p.title}: ${label} — ${t(m.statusLabel)}">
      <span class="diamond ${state}"></span>
    </button>`;
  })}`;
}

function openEndRail(b, cols) {
  const from = Math.max(0, unitAt(cols, b.to));
  if (from >= cols.length) return '';
  const left = (from / cols.length) * 100;
  const width = 100 - left;
  const at = `left:${left}%;width:${width}%`;
  return html`<span class="gantt__rail" style="${at}" aria-hidden="true"></span>
    <span class="gantt__railcaption" style="${at}"><span>${b.openEnd}</span></span>`;
}

