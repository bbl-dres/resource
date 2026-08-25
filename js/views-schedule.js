/* =============================================================================
   views-schedule.js — Tab «Termine»: the bar plan, with a capacity band
   underneath that answers the same question the Übersicht footer does.
   ============================================================================= */

import {
  data, state, t, totals, loadStatus, groupProjects, periods, periodValue
} from './store.js';

import {
  html, raw, icons, pageHeader, editToggle, exportMenu, toolbar, activeFilterRow,
  timeControls, tooNarrow,
} from './ui.js';


export function renderTermine() {
  const body = state.narrow ? tooNarrow('Der Balkenplan') : ganttView();

  return html`
    ${pageHeader({
      crumbs: ['Bauprojekte', 'Termine'],
      title: 'Ressourcenplanung',
      actions: html`${editToggle()}${exportMenu()}
        <button type="button" class="btn" data-act="share">${icons.share(14)}${t('Teilen')}</button>`
    })}
    <div class="wrap"><div class="content">
      ${toolbar()}
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
function todayFraction(cols) {
  const today = new Date(data.meta.today + 'T00:00:00');
  const qStart = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1);
  const qEnd = new Date(qStart.getFullYear(), qStart.getMonth() + 3, 1);
  const withinQuarter = (today - qStart) / (qEnd - qStart);
  const q = data.quarterIndex[data.meta.todayQuarter] ?? 0;

  const at = cols.findIndex(c => c.quarters.includes(q));
  if (at < 0) return null;                       // the window has moved past today
  const col = cols[at];
  const within = (q + withinQuarter - col.quarters[0]) / col.quarters.length;
  return (at + within) / cols.length;
}

function ganttView() {
  const groups = groupProjects();
  const tot = totals();
  const cols = periods();
  // A column only has to hold its own label: "2026" and "Q3/26" need room,
  // "Jul" does not. A single minimum made twelve months overflow the card.
  const minCol = { jahr: 96, quartal: 88, monat: 50 }[state.scale] ?? 88;
  const f = todayFraction(cols);
  const todayLeft = f === null ? null
    : `calc(var(--gantt-lead) + (100% - var(--gantt-lead)) * ${f.toFixed(4)})`;

  return html`<div class="gantt" style="--gantt-cols:${cols.length}; --gantt-quarter-min:${minCol}px">
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
        ${!collapsed && html`<div class="gantt__card scrollbox">
          <div class="gantt__scroll" data-scroll>
          ${ganttAxis(cols)}
          <div class="gantt__body">
            ${todayLeft && html`<div class="gantt__today" style="left:${raw(todayLeft)}" aria-hidden="true"></div>
              <div class="gantt__todaybadge" style="left:${raw(todayLeft)}"
                   title="${t('Heute')}, ${data.meta.todayLabel}">${t('Heute')}</div>`}
            ${g.projects.map(p => ganttRow(p, cols))}
          </div>
          </div>
        </div>`}
      </section>`;
    })}

    <section class="capband scrollbox" style="--gantt-cols:${cols.length}; --gantt-quarter-min:${minCol}px">
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
            return html`<div class="capband__cell is-${st.key} ${col.yearStart ? 'is-yearstart' : ''}"
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
function ganttLegend() {
  const l = data.print.legend;
  return html`<div class="heatlegend">
    <span class="heatlegend__label">${t('Legende')}</span>
    <span class="heatlegend__item"><span class="heatlegend__swatch is-delay"></span>${t('Verzug')}</span>
    <span class="heatlegend__item"><span class="heatlegend__swatch is-nolead"></span>${t('ohne Projektleitung')}</span>
    <span class="heatlegend__item"><span class="diamond"></span>${t('Meilenstein')}</span>
    <span class="heatlegend__item"><span class="diamond is-late"></span>${t('verschoben')}</span>
    <span class="heatlegend__item"><span class="diamond is-open"></span>${t('Termin offen')}</span>
    <span class="heatlegend__item">${t(l.thresholds)}</span>
  </div>`;
}

function ganttAxis(cols) {
  // At year scale the columns already are the years, so a band would repeat them.
  const bands = [];
  if (state.scale !== 'jahr') {
    cols.forEach((col, i) => {
      if (col.yearStart) bands.push({ label: col.year, span: 1 });
      else bands[bands.length - 1].span++;
    });
  }
  return html`<header class="gantt__axis">
    <div class="gantt__axislabel">${t('Projekt')}</div>
    <div class="gantt__axiscols">
      ${bands.length ? html`<div class="gantt__years">
        ${bands.map(b => html`<div class="gantt__year" style="grid-column:span ${b.span}">${b.label}</div>`)}
      </div>` : ''}
      <div class="gantt__quarters">
        ${cols.map(col => html`<div class="${col.isNow ? 'is-today' : ''} ${col.yearStart ? 'is-yearstart' : ''}"
          title="${col.label}">${col.short}</div>`)}
      </div>
    </div>
  </header>`;
}

function ganttRow(p, cols) {
  const bars = p.bars ?? [];
  const delayed = bars.some(b => b.delay);
  const rail = p.unassigned ? 'is-unassigned' : delayed ? 'is-delayed' : '';

  return html`<div class="gantt__row ${rail}">
    <div class="gantt__rowlabel">
      <span class="gantt__rowid">${p.number}</span>
      <button type="button" class="gantt__rowtitle" data-act="open-project" data-val="${p.id}"
              title="${p.title}">${p.title}</button>
    </div>
    <div class="gantt__track">
      ${cols.map((col, n) => html`<span class="gantt__gridline ${col.yearStart ? 'is-yearstart' : ''}"
        style="grid-column:${n + 1}"></span>`)}
      ${bars.map((b, i) => ganttBar(b, i, bars, cols))}
      ${bars.some(b => b.openEnd) && openEndRail(bars.find(b => b.openEnd), cols)}
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

function ganttBar(b, i, bars, cols) {
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

  return html`<div class="${cls}" style="grid-column:${at.from} / ${at.to}"
      title="${b.milestone ?? b.label}">
    <span class="gantt__barlabel">${b.label}</span>
    ${b.milestone && html`<span class="diamond ${b.delay ? 'is-late' : b.milestoneOpen ? 'is-open' : ''}"
      role="img" aria-label="${b.milestone}" title="${b.milestone}"></span>`}
    ${b.continues && html`<span class="gantt__more" aria-hidden="true">${icons.chevronRight(13)}</span>`}
  </div>`;
}

function openEndRail(b, cols) {
  const at = span(cols, b.to, data.quarters.length);
  if (!at) return '';
  const from = at.from;
  const to = cols.length + 1;
  return html`<span class="gantt__rail" style="grid-column:${from} / ${to}" aria-hidden="true"></span>
    <span class="gantt__railcaption" style="grid-column:${from} / ${to}"><span>${b.openEnd}</span></span>`;
}

