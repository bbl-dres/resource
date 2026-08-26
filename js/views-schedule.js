/* =============================================================================
   views-schedule.js — Tab «Termine»: the bar plan, with a capacity band
   underneath that answers the same question the Übersicht footer does.
   ============================================================================= */

import {
  data, state, t, num, unitSuffix, totals, loadStatus, groupProjects, periods,
  periodValue, windowEdges, columnSet
} from './store.js';

import {
  html, raw, icons, pageHeader, pageActions, toolbar, activeFilterRow,
  timeControls, noResults, legendBlock, legendItem, yearRule, sortableHead, attr,
  tokenPx, pinCls, pinLeft, ampelDot, droppedNote
} from './ui.js';

import { leadLayout } from './columns.js';

/*
 * Below three quarters the axis stops being a plan, so the lead columns give
 * way first — the same floor the pensum grid holds.
 */
const MIN_PERIODS = 3;

/** The frozen block in front of the bars, from the same registry as the table. */
function ganttLayout() {
  const quarterW = tokenPx('--grid-quarter');
  const room = Math.min(tokenPx('--layout-width'), document.documentElement.clientWidth)
    - 2 * tokenPx('--shell-pad-x');
  const lay = leadLayout(columnSet(), {
    room, axis: MIN_PERIODS * quarterW, widthOf: c => tokenPx(c.width)
  });

  /*
   * A wider window first lengthens the project name, up to the width at which
   * the longest one fits — without this a 1920px screen showed every name in
   * full in the table and truncated 29 of them here. Past that ceiling the
   * surplus goes to the bars, which are what this grid is actually saying.
   *
   * The name is set to an exact width rather than a share: with two flexible
   * tracks in one row they split the slack, and the frozen block would no
   * longer be the width the capacity band below it is drawn to.
   */
  const cols = periods().length;
  const head = tokenPx('--grid-col-title-max') - tokenPx('--grid-col-title');
  const extra = Math.max(0, Math.min(head, room - lay.width - cols * quarterW));
  const parts = lay.parts.map((p, i) =>
    (lay.shown[i].grow ? `${tokenPx(lay.shown[i].width) + extra}px` : p));

  return { ...lay, width: lay.width + extra, tpl: [...parts, 'minmax(0, 1fr)'].join(' ') };
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
  const cls = `gantt__axislabel gantt__col--${col.key} ${pinCls(lay.sticky, col.key)}`;
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
      class="gantt__rowlabel gantt__col--${col.key} ${pinCls(lay.sticky, col.key)}"
      style="${pinLeft(lay.sticky, col.key)}">${leadCell(col, p)}</div>`)}
    <div class="gantt__track">
      ${cols.map((col, n) => html`<span class="gantt__gridline ${yearRule(col)}"
        style="grid-column:${n + 1}"></span>`)}
      ${bars.map((b, i) => ganttBar(b, i, bars, cols, p))}
      ${bars.some(b => b.openEnd) && openEndRail(bars.find(b => b.openEnd), cols)}
      ${gates(p, cols)}
    </div>
  </div>`;
}

/** Map a quarter range onto the visible columns; null when it falls outside. */
function span(cols, from, to) {
  const hits = cols
    .map((c, i) => (c.quarters.some(q => q >= from && q < to) ? i : -1))
    .filter(i => i >= 0);
  return hits.length ? { from: hits[0] + 1, to: hits[hits.length - 1] + 2 } : null;
}

function ganttBar(b, i, bars, cols, p) {
  const at = span(cols, b.from, b.to);
  if (!at) return '';
  const startsChain = !bars.some((o, j) => j !== i && o.to === b.from);
  const endsChain = !bars.some((o, j) => j !== i && o.from === b.to);
  const cls = [
    'gantt__bar',
    b.delay ? 'is-delay' : b.unassigned ? 'is-unassigned' : 'is-phase',
    startsChain ? 'is-first' : '',
    endsChain && !b.continues ? 'is-last' : '',
    b.continues ? 'is-open' : ''
  ].join(' ');

  return html`<button type="button" class="${cls}" style="grid-column:${at.from} / ${at.to}"
      data-act="open-phase" data-val="${p.id}:${b.from}"
      title="${t(b.milestone ?? b.label)}" aria-label="${p.title}: ${t(b.label)}">
    <span class="gantt__barlabel">${t(b.label)}</span>
    ${b.continues && html`<span class="gantt__more" aria-hidden="true">${icons.chevronRight(13)}</span>`}
  </button>`;
}

/**
 * A gate sits at the end of the quarter it falls due in. Reading them from the
 * milestone data rather than from a label baked into a bar means every one of
 * the 189 shows up, and each can be opened.
 */
function gates(p, cols) {
  const list = data.milestonesByProject[p.id] ?? [];
  if (!list.length) return '';

  /*
   * Two gates due in the same period land on the same pixel, and the second one
   * is then invisible and unclickable. They fan out to the left instead, so a
   * quarter with MS5 and MS6 in it reads as two marks in sequence.
   */
  const placed = [];
  for (const m of list) {
    const qi = data.quarterIndex[m.forecast ?? m.plan];
    if (qi === undefined) continue;
    const at = cols.findIndex(c => c.quarters.includes(qi));
    if (at < 0) continue;
    placed.push({ m, at });
  }
  placed.sort((a, b) => a.at - b.at || a.m.code.localeCompare(b.m.code));

  const perColumn = placed.reduce((a, g) => ((a[g.at] = (a[g.at] ?? 0) + 1), a), {});
  const seen = {};

  return html`${placed.map(({ m, at }) => {
    const rank = seen[at] = (seen[at] ?? 0) + 1;
    // Earliest of a stack sits leftmost, so the sequence still reads forwards.
    const shift = (perColumn[at] - rank) * 13;
    const cat = data.milestoneCatalog[m.code];
    const state = m.forecast === null ? 'is-open' : m.status === 'late' ? 'is-late' : '';
    const label = `${m.code} ${cat ? t(cat.name) : ''} · ${data.quarters[data.quarterIndex[m.forecast ?? m.plan]].label}`;
    return html`<button type="button" class="gantt__gate ${at === cols.length - 1 ? 'is-last' : ''}"
        style="grid-column:${at + 1}; --gate-shift:${shift}px"
        data-act="open-milestone" data-val="${m.id}"
        title="${label} — ${t(m.statusLabel)}"
        aria-label="${p.title}: ${label} — ${t(m.statusLabel)}">
      <span class="diamond ${state}"></span>
    </button>`;
  })}`;
}

function openEndRail(b, cols) {
  const at = span(cols, b.to, data.quarters.length);
  if (!at) return '';
  const from = at.from;
  const to = cols.length + 1;
  return html`<span class="gantt__rail" style="grid-column:${from} / ${to}" aria-hidden="true"></span>
    <span class="gantt__railcaption" style="grid-column:${from} / ${to}"><span>${b.openEnd}</span></span>`;
}

