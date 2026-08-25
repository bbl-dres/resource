/* =============================================================================
   views-schedule.js — Tab «Termine» with its three views:
   Gantt (phase bars with a capacity band), Liste (one row per milestone)
   and Kalender (months as columns).
   ============================================================================= */

import {
  data, state, t, totals, loadStatus, filteredProjects, groupProjects, milestones
} from './store.js';

import {
  html, raw, icons, pageHeader, editToggle, exportMenu, toolbar, activeFilterRow,
  timeControls, tooNarrow,
  aria
} from './ui.js';

const VIEWS = [
  { id: 'gantt', label: 'Gantt' },
  { id: 'liste', label: 'Liste' },
  { id: 'kalender', label: 'Kalender' }
];

const MONTHS_DE = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];


export function renderTermine() {
  const view = VIEWS.some(v => v.id === state.view) ? state.view : 'gantt';
  // The list stacks down to a phone; the bar plan and the calendar do not.
  const blocked = state.narrow && view !== 'liste';
  const body = blocked
    ? tooNarrow(view === 'kalender' ? 'Der Kalender' : 'Der Balkenplan')
    : view === 'liste' ? listView() : view === 'kalender' ? calendarView() : ganttView();

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
      ${timeControls({ views: VIEWS })}
      ${body}
    </div></div>`;
}

/* =============================================================================
   Gantt
   ========================================================================== */

/**
 * Where today sits along the whole eight-quarter track, as a 0–1 fraction.
 * The columns flex, so the marker is placed proportionally rather than in px.
 */
function todayFraction() {
  const today = new Date(data.meta.today + 'T00:00:00');
  const qStart = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1);
  const qEnd = new Date(qStart.getFullYear(), qStart.getMonth() + 3, 1);
  const withinQuarter = (today - qStart) / (qEnd - qStart);
  const index = data.quarterIndex[data.meta.todayQuarter] ?? 0;
  return (index + withinQuarter) / data.quarters.length;
}

function ganttView() {
  const groups = groupProjects();
  const tot = totals();
  const f = todayFraction().toFixed(4);
  const todayLeft = `calc(var(--gantt-lead) + (100% - var(--gantt-lead)) * ${f})`;

  return html`<div class="gantt">
    ${groups.map(g => {
      const collapsed = g.label ? state.collapsedGroups[`g:${g.key}`] : false;
      return html`<section class="gantt__group">
        ${g.label && html`<header class="gantt__grouphead">
          <button type="button" class="gantt__grouptoggle" data-act="toggle-group" data-val="g:${g.key}"
                  aria-expanded="${aria(!collapsed)}" aria-label="${t('Gruppe')} ${g.label} ${t('ein- oder ausklappen')}">
            <span class="caret ${collapsed ? 'is-collapsed' : ''}" aria-hidden="true">${icons.chevronDown()}</span>
            <h2 class="gantt__groupname">${g.label}</h2>
          </button>
          <span class="count-pill" aria-label="${g.projects.length} ${t('Projekte')}">${g.projects.length}</span>
        </header>`}
        ${!collapsed && html`<div class="gantt__card">
          ${ganttAxis()}
          <div class="gantt__body">
            <div class="gantt__today" style="left:${raw(todayLeft)}" aria-hidden="true"></div>
            <div class="gantt__todaybadge" style="left:${raw(todayLeft)}">${t('Heute')} ${data.meta.todayLabel}</div>
            ${g.projects.map(ganttRow)}
          </div>
        </div>`}
      </section>`;
    })}

    <section class="capband">
      <div class="capband__row">
        <div class="capband__label">
          <div class="capband__title">${t('Auslastung')}</div>
          <div class="capband__sub">${t('gegen Kapazität netto, nach Abwesenheiten')}</div>
        </div>
        <div class="capband__cells">
          ${tot.utilisation.map((pct, q) => {
            const st = loadStatus(pct);
            return html`<div class="capband__cell is-${st.key} ${yearBoundary(q) ? 'is-yearstart' : ''}"
                title="${data.quarters[q].label}: ${tot.booked[q]} % ${t('gebucht auf')} ${tot.net[q]} % ${t('netto')}">
              <span class="capband__value">${pct} %</span>
              <span class="capband__state">${t(st.label)}</span>
            </div>`;
          })}
        </div>
      </div>
    </section>
  </div>`;
}

const yearBoundary = q => q === 0 || q === 2 || q === 6;

function ganttAxis() {
  const years = [];
  let i = 0;
  while (i < data.quarters.length) {
    const year = data.quarters[i].year;
    let n = 0;
    while (i + n < data.quarters.length && data.quarters[i + n].year === year) n++;
    years.push(html`<div class="gantt__year" style="grid-column:span ${n}">${year}</div>`);
    i += n;
  }
  return html`<header class="gantt__axis">
    <div class="gantt__axislabel">${t('Projekt')}</div>
    <div class="gantt__axiscols">
      <div class="gantt__years">${years}</div>
      <div class="gantt__quarters">
        ${data.quarters.map((q, n) => html`<div class="${n === 0 ? 'is-today' : ''} ${yearBoundary(n) ? 'is-yearstart' : ''}"
          title="${q.label}">${q.short}</div>`)}
      </div>
    </div>
  </header>`;
}

function ganttRow(p) {
  const bars = p.bars ?? [];
  const delayed = bars.some(b => b.delay);
  const rail = p.unassigned ? 'is-unassigned' : delayed ? 'is-delayed' : '';

  return html`<div class="gantt__row ${rail}">
    <div class="gantt__rowlabel">
      <button type="button" class="gantt__rowtitle" data-act="open-project" data-val="${p.id}">${p.title}</button>
      <span class="gantt__rowid">${p.number}</span>
    </div>
    <div class="gantt__track">
      ${data.quarters.map((_, n) => html`<span class="gantt__gridline ${yearBoundary(n) ? 'is-yearstart' : ''}"
        style="grid-column:${n + 1}"></span>`)}
      ${bars.map((b, i) => ganttBar(b, i, bars))}
      ${bars.some(b => b.openEnd) && openEndRail(bars.find(b => b.openEnd))}
    </div>
  </div>`;
}

function ganttBar(b, i, bars) {
  const startsChain = !bars.some((o, j) => j !== i && o.to === b.from);
  const endsChain = !bars.some((o, j) => j !== i && o.from === b.to);
  const cls = [
    'gantt__bar',
    b.delay ? 'is-delay' : b.unassigned ? 'is-unassigned' : 'is-phase',
    startsChain ? 'is-first' : '',
    endsChain && !b.continues ? 'is-last' : '',
    b.continues ? 'is-open' : ''
  ].join(' ');

  return html`<div class="${cls}" style="grid-column:${b.from + 1} / ${b.to + 1}"
      title="${b.milestone ?? b.label}">
    <span class="gantt__barlabel">${b.label}</span>
    ${b.milestone && html`<span class="diamond ${b.delay ? 'is-late' : b.milestoneOpen ? 'is-open' : ''}"
      role="img" aria-label="${b.milestone}" title="${b.milestone}"></span>`}
    ${b.continues && html`<span class="gantt__more" aria-hidden="true">${icons.chevronRight(13)}</span>`}
  </div>`;
}

function openEndRail(b) {
  const from = b.to + 1;
  const to = data.quarters.length + 1;
  return html`<span class="gantt__rail" style="grid-column:${from} / ${to}" aria-hidden="true"></span>
    <span class="gantt__railcaption" style="grid-column:${from} / ${to}"><span>${b.openEnd}</span></span>`;
}

/* =============================================================================
   Liste — one row per milestone, grouped by planned quarter
   ========================================================================== */

const STATUS_RANK = { late: 0, pending: 1, ok: 2 };

function listView() {
  const list = milestones();
  if (!list.length) return emptyState(t('Keine Meilensteine im gesetzten Umfang.'));

  const byQuarter = new Map();
  list.forEach(m => {
    if (!byQuarter.has(m.plan)) byQuarter.set(m.plan, []);
    byQuarter.get(m.plan).push(m);
  });

  return html`<div class="mslist-view">
    ${[...byQuarter.entries()].map(([qid, rows]) => {
      const q = data.quarters[data.quarterIndex[qid]];
      const collapsed = state.collapsedGroups[`ms:${qid}`];
      rows.sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || a.code.localeCompare(b.code));
      return html`<section class="msgroup">
        <header class="msgroup__head">
          <button type="button" class="msgroup__toggle" data-act="toggle-group" data-val="ms:${qid}"
                  aria-expanded="${aria(!collapsed)}">
            <span class="caret ${collapsed ? 'is-collapsed' : ''}" aria-hidden="true">${icons.chevronDown()}</span>
            <h2 class="msgroup__name">${q.short} / ${q.year}</h2>
          </button>
          <span class="count-pill">${rows.length}</span>
        </header>
        ${!collapsed && html`<div class="table-card">
          <div class="msrow msrow--head">
            <span>${t('Meilenstein')}</span><span>${t('Projekt')}</span><span>${t('Teilphase')}</span>
            <span>${t('Projektleitung')}</span><span>${t('Plan')}</span><span>${t('Prognose')}</span><span>${t('Status')}</span>
          </div>
          ${rows.map(m => html`<div class="msrow is-${m.status}">
            <span class="msrow__ms"><strong>${m.code}</strong><span>${m.name}</span></span>
            <span class="msrow__project">
              <button type="button" class="linkbtn" data-act="open-project" data-val="${m.projectId}">${m.project.location}</button>
              <span class="msrow__meta">${m.project.kind} · ${m.project.number}</span>
            </span>
            <span class="msrow__phase">${m.subPhase}</span>
            <span>${m.lead ? m.lead.name : t('nicht zugewiesen')}</span>
            <span class="msrow__date">${shortQ(m.plan)}</span>
            <span class="msrow__date">${m.forecast ? shortQ(m.forecast) : t('offen')}</span>
            <span class="msrow__status">${m.status !== 'ok' ? icons.warn(12) : ''}${m.statusLabel.replace('▲ ', '')}</span>
          </div>`)}
        </div>`}
      </section>`;
    })}
  </div>`;
}

const shortQ = qid => `Q${qid.slice(5)}/${qid.slice(2, 4)}`;

/* =============================================================================
   Kalender — twelve months as columns, no row grid
   ========================================================================== */

function calendarView() {
  const list = milestones();
  const start = new Date(data.meta.today + 'T00:00:00');
  start.setDate(1);

  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    return {
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: MONTHS_DE[d.getMonth()],
      year: d.getFullYear(),
      isToday: i === 0,
      cards: []
    };
  });
  const byKey = Object.fromEntries(months.map(m => [m.key, m]));

  list.forEach(m => {
    const planKey = m.planDate.slice(0, 7);
    const fcKey = m.forecastDate ? m.forecastDate.slice(0, 7) : null;
    const moved = fcKey && fcKey !== planKey;

    if (byKey[planKey]) {
      byKey[planKey].cards.push({
        ms: m,
        date: m.planDate,
        tone: moved ? 'late' : m.status === 'pending' ? 'pending' : 'ok',
        suffix: moved ? t('verschoben') : m.status === 'pending' ? t('Auftrag hängig') : null
      });
    }
    if (moved && byKey[fcKey]) {
      byKey[fcKey].cards.push({
        ms: m, date: m.forecastDate, tone: 'late', suffix: t('neuer Termin')
      });
    }
  });

  // Year band: group consecutive months by calendar year.
  const bands = [];
  months.forEach((m, i) => {
    const last = bands[bands.length - 1];
    if (last && last.year === m.year) last.span++;
    else bands.push({ year: m.year, span: 1, first: i });
  });

  return html`<section class="cal">
    <div class="cal__years">
      ${bands.map(b => html`<div class="cal__year ${b.first > 0 ? 'is-boundary' : ''}"
        style="grid-column:span ${b.span}">${b.year}</div>`)}
    </div>
    <div class="cal__months">
      ${months.map(m => html`<div class="cal__month ${m.isToday ? 'is-today' : ''}">
        <span class="cal__monthname">${m.label}</span>
        ${m.isToday && html`<span class="cal__monthsub">${t('heute')}</span>`}
      </div>`)}
    </div>
    <div class="cal__body">
      ${months.map(m => html`<div class="cal__cell ${m.isToday ? 'is-today' : ''}">
        ${m.cards.length
          ? m.cards.map(c => calendarCard(c))
          : html`<span class="cal__empty" aria-hidden="true">—</span>`}
      </div>`)}
    </div>
  </section>`;
}

function calendarCard({ ms, date, tone, suffix }) {
  return html`<button type="button" class="mscard is-${tone}" data-act="open-project" data-val="${ms.projectId}">
    <span class="mscard__line">
      <span class="diamond ${tone === 'late' ? 'is-late' : tone === 'pending' ? 'is-open' : ''}" aria-hidden="true"></span>
      <span class="mscard__title">${ms.code} ${ms.name}</span>
    </span>
    <span class="mscard__project">${ms.project.location}</span>
    <span class="mscard__date ${suffix ? 'has-suffix' : ''}">${deDate(date)}${suffix ? ` · ${suffix}` : ''}</span>
  </button>`;
}

function deDate(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

function emptyState(text) {
  return html`<div class="empty">
    ${icons.info(18)}
    <p>${text}</p>
    <button type="button" class="linkbtn" data-act="filters-reset">${t('Alle Filter zurücksetzen')}</button>
  </div>`;
}
