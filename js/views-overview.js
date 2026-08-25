/* =============================================================================
   views-overview.js — the landing page and the «Übersicht» pensum grid.
   ============================================================================= */

import {
  data, state, t, num, fmt, unitSuffix, fmtMio,
  cellValue, projectDemand, isEdited, personLoad, personUtilisation,
  totals, loadStatus, heatStep, ampel, filteredProjects, groupProjects,
  activeFilters, milestones, milestoneStats, kpis
} from './store.js';

import {
  html, raw, icons, pageHeader, editToggle, exportMenu, toolbar, activeFilterRow,
  timeControls, columnChart, tooNarrow, phaseOf,
  aria, attr
} from './ui.js';

/* -----------------------------------------------------------------------------
   Shared helpers
   -------------------------------------------------------------------------- */

const shortName = p => {
  const rest = p.location.split(',').slice(1).join(',').trim();
  return rest || p.location;
};

/** Tone for a utilisation percentage — same four words in every view. */
function tone(pct) {
  if (pct >= 100) return 'ueberlast';
  if (pct >= 95) return 'knapp';
  if (pct >= 85) return 'ok';
  return 'frei';
}

function utilisationChartRows() {
  const tot = totals();
  return data.quarters.map((q, i) => ({
    value: tot.utilisation[i],
    label: String(tot.utilisation[i]),
    axis: `${q.short}/${String(q.year).slice(2)}`,
    tone: tone(tot.utilisation[i]),
    title: `${q.label}: ${tot.utilisation[i]} % — ${loadStatus(tot.utilisation[i]).label}`
  }));
}

/* =============================================================================
   Landing page — «Einstieg»
   ========================================================================== */

export function renderLanding() {
  const tot = totals();
  const k = kpis();
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
      tone: 'danger', tab: 'uebersicht'
    },
    {
      title: 'Personen',
      sub: `${data.people.length} Personen · ${tot.net[0]} % Kapazität netto · ${grossCap} % brutto`,
      metric: overPeople.length, metricLabel: 'über 100 % belegt',
      tone: 'danger', tab: 'dashboard'
    },
    {
      title: 'Meilensteine',
      sub: `${ms.total} Gates · ${ms.onTime} im Termin · ${ms.open} ohne Termin`,
      metric: ms.late, metricLabel: 'überfällig',
      tone: 'danger', tab: 'termine'
    },
    {
      title: 'Projekte',
      sub: `${data.projects.length} Projekte · ${tot.demand[0]} % Bedarf · ${tot.preCredit[0]} % vor Baukredit-Freigabe`,
      metric: unassigned.length, metricLabel: 'ohne Projektleitung',
      tone: 'info', tab: 'uebersicht'
    }
  ];

  return html`
    ${pageHeader({
      crumbs: ['Bauprojekte'],
      title: 'Ressourcenplanung',
      chrome: false,
      actions: html`${exportMenu()}
        <button type="button" class="btn" data-act="share">${icons.share(14)}${t('Teilen')}</button>
        <button type="button" class="btn btn--primary" data-act="tab" data-val="uebersicht">${t('Zur Planung')}</button>`
    })}

    <div class="wrap"><div class="content content--landing">
      <div class="entry-grid">
        ${cards.map(c => html`<button type="button" class="entry entry--${c.tone}" data-act="tab" data-val="${c.tab}">
          <span class="entry__head">
            <span class="entry__title">${t(c.title)}</span>
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

function nextMilestonesCard() {
  const list = milestones().slice(0, 6);
  return html`<section class="card card--span4">
    <header class="card__head">
      <h2 class="card__title">${t('Nächste Meilensteine')}</h2>
      <p class="card__sub">12 Monate · chronologisch · ${t('öffnet Meilensteine')}</p>
    </header>
    <ul class="mslist">
      ${list.map(m => html`<li class="mslist__row is-${m.status}">
        <button type="button" class="mslist__btn" data-act="open-termine" data-val="${m.projectId}">
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
  </section>`;
}

function attentionCard(overPeople, unassigned) {
  const rows = overPeople
    .map(p => ({
      severity: 'danger',
      name: p.name,
      context: data.projects.filter(x => x.leadId === p.id).map(shortName).join(' · '),
      value: `${personLoad(p.id, 0)} %`,
      act: 'filter-lead', val: p.id
    }))
    .sort((a, b) => parseInt(b.value) - parseInt(a.value));

  unassigned.forEach(p => {
    const start = projectDemand(p).findIndex(v => v > 0);
    rows.push({
      severity: 'warn',
      name: shortName(p),
      context: `${t('keine Projektleitung')} · ${t('ab')} ${data.quarters[start]?.label ?? '—'}`,
      value: `${Math.max(...projectDemand(p))} % ${t('offen')}`,
      act: 'filter-lead', val: 'none'
    });
  });

  return html`<section class="card card--span4">
    <header class="card__head">
      <h2 class="card__title">${t('Handlungsbedarf')}</h2>
      <p class="card__sub">${data.quarters[0].label} · ${t('öffnet die Übersicht, auf die Person gefiltert')}</p>
    </header>
    <div class="attention">
      ${rows.map(r => html`<button type="button" class="attention__row is-${r.severity}"
          data-act="${r.act}" data-val="${r.val}">
        <span class="attention__main">
          <span class="attention__name">${r.name}</span>
          <span class="attention__ctx">${r.context}</span>
        </span>
        <span class="attention__value">${r.value}</span>
      </button>`)}
    </div>
  </section>`;
}

function utilisationCard() {
  return html`<section class="card card--span4">
    <header class="card__head">
      <h2 class="card__title">${t('Auslastung nach Quartal')}</h2>
      <p class="card__sub">${t('Bedarf gegen Kapazität netto')} · ${t('öffnet die Übersicht')}</p>
    </header>
    ${columnChart(utilisationChartRows(), { height: 150, refAt: 100, refLabel: '100 %' })}
  </section>`;
}

function recentChangesBlock() {
  const rows = data.changes.filter(c => c.onLanding).slice(0, 5);
  return html`<section class="changes">
    <h2 class="changes__title">${t('Letzte Änderungen')}
      <span>· ${t('seit letztem Besuch')}, ${data.meta.lastVisit}</span></h2>
    <div class="table-card">
      <div class="chg chg--head">
        <span>${t('Projekt')}</span><span>${t('Feld')}</span><span>${t('Person')}</span>
        <span>${t('Änderung')}</span><span>${t('Geändert')}</span>
      </div>
      ${rows.map((c, i) => html`<div class="chg ${i % 2 === 1 ? 'is-zebra' : ''}">
        <span class="chg__project">${c.projectId
          ? html`<button type="button" class="linkbtn" data-act="open-project" data-val="${c.projectId}">${c.projectLabel}</button>`
          : c.projectLabel}</span>
        <span>${t(c.field)}</span>
        <span>${c.landingActor ?? c.actor}</span>
        <span class="chg__change">${c.summary ?? c.change}</span>
        <span class="chg__date">${c.dateLabel}</span>
      </div>`)}
    </div>
    <div class="changes__more">
      <button type="button" class="linkbtn" data-act="tab" data-val="verlauf">${t('Alle Änderungen anzeigen')}</button>
    </div>
  </section>`;
}

/* =============================================================================
   Tab «Übersicht» — the pensum grid
   ========================================================================== */

export function renderUebersicht() {
  return html`
    ${pageHeader({
      crumbs: ['Bauprojekte', 'Übersicht'],
      title: 'Ressourcenplanung',
      actions: html`${editToggle()}${exportMenu()}
        <button type="button" class="btn" data-act="share">${icons.share(14)}${t('Teilen')}</button>`
    })}
    <div class="wrap"><div class="content">
      ${state.narrow ? tooNarrow('Das Pensum-Raster') : html`
        ${state.edit && html`<p class="editbanner">${icons.pencil(14)}
          ${t('Bearbeitungsmodus aktiv — Änderungen werden protokolliert')}</p>`}
        ${toolbar()}
        ${activeFilterRow()}
        ${timeControls({})}
        ${pensumGrid()}`}
    </div></div>`;
}

/** The column template, rebuilt whenever a column is toggled. */
/** Fixed widths in px, mirroring the layout tokens in tokens.css. */
const COL_W = {
  ampel: 62, id: 100, title: 220, phase: 128, lead: 132,
  portfolio: 110, priority: 90, nextMs: 150, credit: 112,
  target: 76, quarter: 72, trend: 130
};

/**
 * One description of the column layout for the whole grid.
 *
 * `minWidth` matters: every row is its own grid, so they only line up when they
 * are all exactly as wide as the scroll track. Letting each row size itself to
 * its own content is what pulled the header out of step with the cells.
 */
function gridLayout() {
  const c = state.cols;
  const parts = [];
  let minWidth = 0;
  const add = (track, px) => { parts.push(track); minWidth += px; };

  if (c.id) add('var(--grid-col-id)', COL_W.id);
  add(`minmax(${COL_W.title}px, 1fr)`, COL_W.title);       // Projekt
  if (c.phase) add('var(--grid-col-phase)', COL_W.phase);
  if (c.lead) add('var(--grid-col-lead)', COL_W.lead);
  // The signal reports on the project lead, so it sits beside that column.
  if (state.ampel) add('var(--grid-col-ampel)', COL_W.ampel);
  if (c.portfolio) add(`${COL_W.portfolio}px`, COL_W.portfolio);
  if (c.priority) add(`${COL_W.priority}px`, COL_W.priority);
  if (c.nextMs) add(`${COL_W.nextMs}px`, COL_W.nextMs);
  if (c.credit) add('var(--grid-col-budget)', COL_W.credit);
  if (state.target) add('var(--grid-col-target)', COL_W.target);
  add('repeat(8, var(--grid-quarter))', COL_W.quarter * 8);
  if (state.trend) add('var(--grid-col-trend)', COL_W.trend);

  // The identifying columns stay put while the quarters scroll under them.
  const sticky = { id: 0 };
  sticky.title = c.id ? COL_W.id : 0;
  sticky.width = sticky.title + COL_W.title;

  return { tpl: parts.join(' '), minWidth, sticky };
}

/** How many columns sit left of the first quarter — used by the spanning rows. */
function leadColumnCount() {
  const c = state.cols;
  return 1 + (state.ampel ? 1 : 0) + (c.id ? 1 : 0) + (c.phase ? 1 : 0) + (c.lead ? 1 : 0)
    + (c.portfolio ? 1 : 0) + (c.priority ? 1 : 0) + (c.nextMs ? 1 : 0)
    + (c.credit ? 1 : 0) + (state.target ? 1 : 0);
}

function pensumGrid() {
  const groups = groupProjects();
  const list = filteredProjects();
  const tot = totals(list);
  const span = leadColumnCount();
  const { tpl, minWidth, sticky } = gridLayout();
  const q0 = data.quarters[0];

  // Visual row index, so the edit popover can be positioned by calc().
  let rowIdx = 0;
  const body = groups.map(g => {
    const collapsed = g.label ? state.collapsedGroups[g.key] : false;

    // The header sits on the page ground above its card, exactly as the
    // Termine tab does it. It sticks to the left so it survives a scroll.
    const head = g.label && html`<header class="pgrouphead">
      <button type="button" class="pgrouphead__toggle"
              data-act="toggle-group" data-val="${g.key}" aria-expanded="${aria(!collapsed)}"
              aria-label="${t('Gruppe')} ${g.label} ${t('ein- oder ausklappen')}">
        <span class="caret ${collapsed ? 'is-collapsed' : ''}" aria-hidden="true">${icons.chevronDown()}</span>
        <h2 class="pgrouphead__name">${g.label}</h2>
      </button>
      <span class="count-pill">${g.projects.length}</span>
    </header>`;

    if (collapsed) return html`<section class="pgroup">${head}</section>`;

    const rows = g.projects.map(p => {
      const row = projectRow(p, tpl, sticky, rowIdx);
      rowIdx++;
      return row;
    });
    // Each card repeats the column header, the same way a Gantt group card
    // repeats its axis — a group has to be readable on its own.
    return html`<section class="pgroup">${head}
      <div class="pblock">${columnHeader(tpl, sticky)}${rows}</div>
    </section>`;
  });

  return html`<section class="grid-card">
    <div class="pgrid">
     <div class="pgrid__track" style="min-width:${minWidth}px; --sticky-w:${sticky.width}px">

      ${body}

      <div class="pblock pblock--foot">
      <div class="prow prow--sum" style="grid-template-columns:${raw(tpl)}">
        <div style="grid-column:span ${span}" class="prow__sumlabel is-frozen">
          ${t('Bedarf total')}
          <button type="button" class="linkbtn" data-act="foot-details">
            ${state.footDetails ? t('Details ausblenden') : t('Details anzeigen')}
          </button>
        </div>
        ${tot.demand.map((v, q) => html`<span class="pcell pcell--sum ${qBorder(q)}">${fmt(v)}</span>`)}
        ${state.trend && html`<span></span>`}
      </div>

      ${state.footDetails && html`
        ${footRow(t('davon vor Baukredit-Freigabe'), tot.preCredit, tpl, span)}
        ${footRow(t('davon extern beauftragt'), tot.external, tpl, span)}
        ${footRow(t('Kapazität netto, nach Abwesenheiten'), tot.net, tpl, span)}`}

      <div class="prow prow--load" style="grid-template-columns:${raw(tpl)}">
        <div style="grid-column:span ${span}" class="prow__sumlabel is-frozen">${t('Auslastung')}</div>
        ${tot.utilisation.map((pct, q) => {
          const st = loadStatus(pct);
          return html`<span class="pcell pcell--load is-${st.key} ${qBorder(q)}"
              title="${data.quarters[q].label}: ${tot.booked[q]} % ${t('gebucht auf')} ${tot.net[q]} % ${t('netto')}">
            <span class="pcell__pct">${pct} %</span><span class="pcell__status">${t(st.label)}</span>
          </span>`;
        })}
        ${state.trend && html`<span></span>`}
      </div>
      </div>

      ${state.editing && editPopover()}
    </div>

    ${heatLegend()}
  </section>`;
}

/** The same swatch legend the print sheet carries, so both read alike. */
export function heatLegend() {
  const l = data.api.print.legend;
  return html`<div class="heatlegend">
    <span class="heatlegend__label">${t(l.label)}</span>
    ${l.steps.map(s => html`<span class="heatlegend__item">
      <span class="heatlegend__swatch heat-${s.step}"></span>${s.label}</span>`)}
    <span class="heatlegend__item">${icons.warn(11)}${t('Projektleitung über 100 % im Quartal')}</span>
    <span class="heatlegend__item"><span class="heatlegend__swatch is-nolead"></span>${t(l.noLead)}</span>
    <span class="heatlegend__item">${t(l.thresholds)}</span>
  </div>`;
}

function qBorder(i) {
  return (i === 0 || i === 2 || i === 6) ? 'is-yearstart' : '';
}

/**
 * A column header that sorts. Clicking the active column flips the direction,
 * and the toolbar dropdown reads the same two pieces of state.
 */
function sortHead(key, label, cls = '', style = '', title = '') {
  const active = state.sort === key;
  return html`<span class="pcell--text ${cls} ${active ? 'is-sorted' : ''}" style="${style}">
    <button type="button" class="sorthead" data-act="sort-col" data-val="${key}"
            title="${title || `${t('Sortieren nach')} ${typeof label === 'string' ? label : key}`}"
            aria-label="${t('Sortieren nach')} ${typeof label === 'string' ? label : key}">
      <span class="sorthead__label">${label}</span>
      <span class="sorthead__dir" aria-hidden="true">${active ? (state.sortDir === 'asc' ? '↑' : '↓') : ''}</span>
    </button>
  </span>`;
}

/** The year band and the column names, repeated at the top of every group card. */
function columnHeader(tpl, sticky) {
  const q0 = data.quarters[0];
  return html`
    <div class="prow prow--head" style="grid-template-columns:${raw(tpl)}">
      ${state.cols.id && sortHead('id', 'ID', 'is-frozen', `left:${sticky.id}px`)}
      ${sortHead('projekt', t('Projekt'), 'is-frozen is-frozen-last', `left:${sticky.title}px`)}
      ${state.cols.phase && sortHead('phase', t('SIA-Phase'))}
      ${state.cols.lead && sortHead('lead', t('Projektleitung'))}
      ${state.ampel && html`<span class="pcell--text pcell--ampelhead"
        title="${t('Auslastung der Projektleitung im laufenden Quartal')}">${t('Ampel')}</span>`}
      ${state.cols.portfolio && sortHead('portfolio', t('Teilportfolio'))}
      ${state.cols.priority && sortHead('priority', t('Priorität'))}
      ${state.cols.nextMs && html`<span class="pcell--text">${t('Nächster Meilenstein')}</span>`}
      ${state.cols.credit && sortHead('credit', t('Kredit CHF'), 'pcell--num')}
      ${state.target && sortHead('target', `${t('Soll')} ${data.quarters[0].short}`, 'pcell--num')}
      ${data.quarters.map((q, i) => sortHead(`q${i}`,
        `${q.short}/${String(q.year).slice(2)}`,
        `pcell--num ${i === 0 ? 'is-today' : ''} ${qBorder(i)}`, '',
        i === 0 ? `${t('Heute')}, ${data.meta.todayLabel} — ${t('laufendes Quartal, gesperrt')}` : q.label))}
      ${state.trend && html`<span class="pcell--text">${t('Verlauf')}</span>`}
    </div>`;
}


function footRow(label, values, tpl, span) {
  return html`<div class="prow prow--foot" style="grid-template-columns:${raw(tpl)}">
    <div style="grid-column:span ${span}" class="prow__footlabel is-frozen">${label}</div>
    ${values.map((v, q) => html`<span class="pcell pcell--foot ${qBorder(q)}">${fmt(v)}</span>`)}
    ${state.trend && html`<span></span>`}
  </div>`;
}

function projectRow(p, tpl, sticky, rowIdx) {
  const lead = p.leadId ? data.peopleById[p.leadId] : null;
  const cells = projectDemand(p);
  const a = ampel(p.leadId, 0);
  const phase = phaseOf(p.phase);
  const nextMs = data.milestones.items.find(m => m.projectId === p.id);
  const targetOver = state.target && cells[0] > p.target;

  return html`<div class="prow" style="grid-template-columns:${raw(tpl)}"
      data-row="${rowIdx}">
    ${state.cols.id && html`<span class="pcell pcell--id is-frozen" style="left:${sticky.id}px">${p.number}</span>`}
    <span class="pcell pcell--title is-frozen is-frozen-last" style="left:${sticky.title}px">
      <button type="button" class="prow__title" data-act="open-project" data-val="${p.id}" title="${p.title}">${p.title}</button>
    </span>
    ${state.cols.phase && html`<span class="pcell pcell--phase">
      ${phase.label}
    </span>`}
    ${state.cols.lead && html`<span class="pcell pcell--lead ${!lead ? 'is-none' : ''}">${lead ? lead.name : html`<span class="lead-open">${t('nicht zugewiesen')}</span>`}</span>`}
    ${state.ampel && html`<span class="pcell pcell--ampel">
      <span class="ampel ampel--${a.key}" role="img" aria-label="${a.title}" title="${a.title}"></span>
    </span>`}
    ${state.cols.portfolio && html`<span class="pcell pcell--text">${t(data.portfoliosById[p.portfolio].label)}</span>`}
    ${state.cols.priority && html`<span class="pcell pcell--text">${t(p.priority)}</span>`}
    ${state.cols.nextMs && html`<span class="pcell pcell--text">${nextMs ? `${nextMs.code} · ${data.quarters[data.quarterIndex[nextMs.plan]].label}` : '—'}</span>`}
    ${state.cols.credit && html`<span class="pcell pcell--credit">${p.creditLabel}</span>`}
    ${state.target && html`<span class="pcell pcell--target ${targetOver ? 'is-over' : ''}">${num(p.target)}${unitSuffix()}</span>`}

    ${cells.map((v, q) => {
      const over = lead ? personUtilisation(p.leadId, q) > 100 : false;
      const locked = q === 0;
      const editing = state.editing && state.editing.projectId === p.id && state.editing.q === q;
      const label = state.hideZeros && v === 0 ? '' : num(v);
      const description = `${p.title} · ${lead ? lead.name : t('nicht zugewiesen')}, ${data.quarters[q].label}: ${num(v)}${unitSuffix()}`
        + (over ? ` — ${t('Person über 100 % belegt, Überlast')}` : '')
        + (locked ? ` — ${t('laufendes Quartal, gesperrt')}` : '');
      return html`<button type="button"
        class="pcell pcell--val heat-${heatStep(v)} ${over ? 'is-warn' : ''} ${editing ? 'is-editing' : ''} ${isEdited(p, q) ? 'is-edited' : ''} ${qBorder(q)}"
        data-act="cell" data-val="${p.id}" data-q="${q}" data-fk="cell:${p.id}:${q}"
        aria-label="${description}" title="${description}" ${attr(!state.edit || locked, 'data-locked="1"')}>
        ${label}
      </button>`;
    })}

    ${state.trend && html`<span class="pcell pcell--trend">
      ${cells.map(v => html`<span class="spark" style="height:${v ? Math.max(8, Math.round(v / 120 * 100)) : 0}%"
        class="${v ? '' : 'is-empty'}"></span>`)}
    </span>`}
  </div>`;
}

/* -----------------------------------------------------------------------------
   Edit popover — anchored to the cell by grid arithmetic
   -------------------------------------------------------------------------- */

const POP_WIDTH = 308;
const POP_HEIGHT = 340;

function editPopover() {
  const { projectId, q, anchor } = state.editing;
  const p = data.projectsById[projectId];
  const lead = p.leadId ? data.peopleById[p.leadId] : null;
  const base = cellValue(p, q);
  const delta = state.draft - base;
  const newLoad = lead ? Math.round(personLoad(p.leadId, q) + delta / lead.employment * 100) : null;
  const newUtil = lead ? Math.round(newLoad / lead.employment * 100) : null;
  const over = newUtil != null && newUtil > 100;

  const warn = lead === null
    ? t('Keine Projektleitung zugewiesen — das Pensum kann noch auf keine Person gebucht werden.')
    : over
      ? `${lead.name} ${t('wäre damit bei')} ${newUtil} % — ${newUtil - 100} % ${t('über der Anstellung.')}`
      : `${lead.name} ${t('wäre damit bei')} ${newUtil} % — ${t('innerhalb der Anstellung.')}`;

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

    <p class="pop__warn ${over ? 'is-over' : lead ? 'is-ok' : 'is-none'}">${warn}</p>

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

export function renderModal() {
  if (!state.modal) return '';
  const body = state.modal.type === 'project' ? projectModal(state.modal)
    : state.modal.type === 'share' ? shareModal(state.modal)
      : rebookModal(state.modal);
  return html`<div class="scrim" data-act="close-modal">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" data-stop>${body}</div>
  </div>`;
}

/**
 * The URL already carries tab, view, filters, grouping, unit and search, so the
 * share dialog only has to show it and make it easy to take.
 */
function shareModal({ copied }) {
  const chips = activeFilters();
  return html`
    <header class="modal__head">
      <div>
        <p class="modal__kicker">${t('Teilen')}</p>
        <h2 class="modal__title" id="modal-title">${t('Diese Ansicht teilen')}</h2>
      </div>
      <button type="button" class="modal__close" data-act="close-modal" aria-label="${t('Schliessen')}">${icons.close(14)}</button>
    </header>

    <p class="modal__lead">${t('Der Link enthält Ansicht, Filter, Gruppierung, Sortierung und Einheit — wer ihn öffnet, sieht genau diesen Stand.')}</p>

    <div class="share">
      <label class="share__field">
        <span class="sr-only">${t('Link')}</span>
        <input type="text" readonly value="${location.href}" data-fk="share-url"
               data-act="share-select" aria-label="${t('Link')}">
      </label>
      <button type="button" class="btn btn--primary" data-act="share-copy">
        ${copied ? icons.check(14) : icons.externalLink(14)}${copied ? t('Kopiert') : t('Link kopieren')}
      </button>
    </div>

    <dl class="share__state">
      <div><dt>${t('Ansicht')}</dt><dd>${t(tabLabel())}</dd></div>
      <div><dt>${t('Aktive Filter')}</dt><dd>${chips.length ? chips.map(c => t(c.label)).join(', ') : t('keine')}</dd></div>
      <div><dt>${t('Einheit')}</dt><dd>${state.unit === 'fte' ? 'FTE' : t('Pensum in %')}</dd></div>
    </dl>

    <footer class="modal__foot">
      <button type="button" class="btn btn--primary" data-act="close-modal">${t('Schliessen')}</button>
    </footer>`;
}

const TAB_LABELS = {
  start: 'Einstieg', uebersicht: 'Übersicht', termine: 'Termine',
  dashboard: 'Dashboard', verlauf: 'Verlauf', api: 'API-Dokumentation', export: 'Drucklayout'
};
const tabLabel = () => TAB_LABELS[state.tab] ?? state.tab;

function projectModal({ projectId }) {
  const p = data.projectsById[projectId];
  const lead = p.leadId ? data.peopleById[p.leadId] : null;
  const cells = projectDemand(p);
  const phase = phaseOf(p.phase);
  const q0 = data.quarters[0];
  const nextMs = data.milestones.items
    .filter(m => m.projectId === p.id)
    .sort((a, b) => a.planDate.localeCompare(b.planDate))[0];
  const nextName = nextMs && data.milestones.catalog.find(c => c.code === nextMs.code)?.name;
  const log = data.changes.filter(c => c.projectId === p.id);
  const util = lead ? personUtilisation(lead.id, 0) : null;

  // The wireframe is explicit: five facts, always the same, in this order.
  const facts = [
    {
      term: 'SIA-Phase',
      value: phase.label,
      sub: `${t('Hauptphase')} ${phase.main}`
    },
    {
      term: 'Projektleitung',
      value: lead ? lead.name : t('— nicht zugewiesen'),
      sub: lead ? `${t('Auslastung')} ${q0.short}: ${util > 100 ? '▲ ' : ''}${util} %` : t('Bedarf offen'),
      tone: lead ? (util > 100 ? 'danger' : null) : 'warn'
    },
    {
      term: `${t('Pensum')} ${q0.label}`,
      value: fmt(cells[0]),
      sub: `${t('Soll')} ${fmt(p.target)} · ${cells[0] > p.target ? t('über Soll') : t('im Soll')}`,
      tone: cells[0] > p.target ? 'danger' : null
    },
    {
      term: 'Kredit CHF',
      value: p.creditLabel,
      sub: p.preCredit ? t('Freigabe steht aus') : t('Kredit freigegeben')
    },
    {
      term: 'Nächster Meilenstein',
      value: nextMs ? `${nextMs.code} · ${deDate(nextMs.planDate)}` : '—',
      sub: nextMs ? `${nextName} · ${nextMs.statusLabel.replace('▲ ', '')}` : t('kein Gate im Zeitraum'),
      tone: nextMs && nextMs.status !== 'ok' ? 'danger' : null
    }
  ];

  return html`
    <header class="modal__head">
      <div>
        <p class="modal__kicker">${p.number} · ${t(data.portfoliosById[p.portfolio].label)} · ${p.location.split(',')[0]}</p>
        <h2 class="modal__title" id="modal-title">${p.title}</h2>
      </div>
      <button type="button" class="modal__close" data-act="close-modal" aria-label="${t('Schliessen')}">${icons.close(14)}</button>
    </header>

    <dl class="facts">
      ${facts.map(f => html`<div class="facts__row">
        <dt>${t(f.term)}</dt>
        <dd class="${f.tone ? 'is-' + f.tone : ''}">${f.value}<span class="facts__sub">${f.sub}</span></dd>
      </div>`)}
    </dl>

    <section class="modal__section">
      <h3>${t('Pensum je Quartal')}</h3>
      <div class="minigrid">
        ${data.quarters.map((q, i) => html`<div class="minigrid__col">
          <span class="minigrid__q">${q.short}<span>/${String(q.year).slice(2)}</span></span>
          <span class="minigrid__v heat-${heatStep(cells[i])}">${num(cells[i])}</span>
        </div>`)}
      </div>
    </section>

    ${log.length ? html`<section class="modal__section">
      <h3>${t('Letzte Änderungen')}</h3>
      <ul class="modal__log">
        ${log.map(c => html`<li><span>${c.dateLabel}</span><span>${t(c.field)}</span><span>${c.change}</span><span>${c.value}</span></li>`)}
      </ul>
    </section>` : ''}

    <footer class="modal__foot">
      <button type="button" class="btn" data-act="open-termine" data-val="${p.id}">${t('In Termine öffnen')}</button>
      <button type="button" class="btn btn--primary" data-act="noop">${t('Im ePPM öffnen')}</button>
    </footer>`;
}

function deDate(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

function rebookModal({ projectId, q, amount, targetId, quarters = 2, search = '', reason = '' }) {
  const p = data.projectsById[projectId];
  const from = p.leadId ? data.peopleById[p.leadId] : null;
  const quarter = data.quarters[q];
  const query = search.trim().toLowerCase();
  const candidates = data.people
    .filter(x => x.id !== p.leadId)
    .filter(x => !query || x.name.toLowerCase().includes(query));
  const target = targetId ? data.peopleById[targetId] : null;
  const ready = target && amount > 0 && reason.trim();

  return html`
    <header class="modal__head">
      <div>
        <p class="modal__kicker">${t('Pensum umbuchen')}</p>
        <h2 class="modal__title" id="modal-title">${p.title}</h2>
        <p class="modal__meta-line">${t('Rolle Projektleitung')} · ${t('ab')} ${quarter.label}, ${quarters} ${t('Quartale')}</p>
      </div>
      <button type="button" class="modal__close" data-act="close-modal" aria-label="${t('Schliessen')}">${icons.close(14)}</button>
    </header>

    <p class="modal__lead">${t('Ein Vorgang statt zwei Transaktionen: von, an, Betrag und Zeitraum ergeben einen Verlaufseintrag mit beiden Seiten.')}</p>

    <div class="rebook">
      <div class="rebook__field">
        <span class="rebook__label">${t('Von')}</span>
        <span class="rebook__readonly">${from ? from.name : t('nicht zugewiesen')}</span>
      </div>
      <div class="rebook__field rebook__field--amount">
        <label class="rebook__label" for="rebook-amount">${t('Pensum')}</label>
        <span class="rebook__amount">
          <input id="rebook-amount" type="number" min="0" max="${cellValue(p, q)}" step="5"
                 value="${amount}" data-act="rebook-amount" data-fk="rebook-amount">
          <span>%</span>
        </span>
      </div>
      <div class="rebook__field rebook__field--quarters">
        <label class="rebook__label" for="rebook-quarters">${t('Dauer')}</label>
        <span class="rebook__amount">
          <input id="rebook-quarters" type="number" min="1" max="${data.quarters.length - q}" step="1"
                 value="${quarters}" data-act="rebook-quarters" data-fk="rebook-quarters">
          <span>${t('Quartale')}</span>
        </span>
      </div>
    </div>

    <div class="rebook__to">
      <span class="rebook__label">${t('An')}</span>
      <label class="dd__searchfield">
        ${icons.search(14)}
        <input type="search" role="combobox" aria-expanded="true" aria-controls="rebook-list"
               data-act="rebook-search" data-fk="rebook-search" value="${search}"
               placeholder="${t('Person suchen — Name oder Kürzel')}" aria-label="${t('Person suchen')}" autocomplete="off">
      </label>
      <ul class="rebook__list" id="rebook-list" role="listbox" aria-label="${t('Person wählen')}">
        ${candidates.length ? candidates.map(c => html`<li role="option" tabindex="-1"
            aria-selected="${aria(c.id === targetId)}" class="${c.id === targetId ? 'is-on' : ''}"
            data-act="rebook-target" data-val="${c.id}">
          <span>${c.name}</span><span class="rebook__role">${c.role}</span>
        </li>`) : html`<li class="rebook__empty">${t('Keine Person gefunden.')}</li>`}
      </ul>
    </div>

    <label class="pop__reason rebook__reason">
      <span class="pop__reasonlabel">${t('Begründung')}
        <span>${t('— Pflicht bei jeder Umbuchung')}</span></span>
      <textarea rows="2" data-act="rebook-reason" data-fk="rebook-reason"
        placeholder="${t('Entlastung Projektleitung gemäss Beschluss Abteilungssitzung 24.08.2026.')}">${reason}</textarea>
    </label>

    <footer class="modal__foot">
      <button type="button" class="btn" data-act="close-modal">${t('Abbrechen')}</button>
      <button type="button" class="btn btn--primary" data-act="rebook-apply" ${attr(!ready, 'disabled')}>${t('Umbuchen')}</button>
    </footer>`;
}
