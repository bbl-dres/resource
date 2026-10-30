/* =============================================================================
   views-overview.js — the «Planung» grid: pensum figures per project and
   quarter, with the bar plan drawn as a band inside the same rows.
   ============================================================================= */

import {
  data, state, t, num, fmt, fmtMio, unitSuffix, cellValue, projectDemand, isEdited, roleEdited, personUtilisation,
  totals, loadStatus, heatStep, filteredProjects, groupProjects,
  periods, periodValue, windowEdges, columnSet, coloured, phaseOf, nowIndex,
  roleCatalog, roleOf, roleOn, segAt, holdersAt, staffCandidates
} from './store.js';

import {
  html, raw, icons, pageHeader, pageActions, toolbar, activeFilterRow,
  noResults, droppedNote, attr,
  tokenPx, yearRule, pinCls, pinLeft, sortableHead,
  popoverPosition, personOption, personSearch, highlight
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
/*
 * Measured on the body, not on the root: the stylesheet reserves the page
 * scrollbar's gutter (scrollbar-gutter: stable), and the body is what that
 * gutter narrows. The root reports the full viewport until a real scrollbar
 * appears — which it did on the first render of a fresh load, when the page
 * was still short, so the first grid was 15px wider than every grid after it.
 */
function cardWidth() {
  return Math.min(tokenPx('--layout-width'), document.body.clientWidth)
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
      ${!collapsed && expandLink(g)}
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
    /* Ungrouped, the link that folds every row has no heading to sit in, so
       it takes a line of its own above the one card. */
    return html`<section class="pgroup">${head || html`<div class="pgroup__tools">${expandLink(g)}</div>`}
      ${card(html`${columnHeader(tpl, sticky, cols)}
        <div class="pgrid__rows">${rows}${todayMarker(todayLeft)}</div>
        ${L.values && groupSum(g, tpl, sticky, cols)}`,
        { minWidth, sticky })}
    </section>`;
  });

  /* The totals are sums of the figures, so they go when the figures go. */
  const foot = L.values && html`<div class="prow prow--sum" style="grid-template-columns:${raw(tpl)}">
        ${sumLead(html`${t('Summe Total')}${tot.scoped ? html`<span class="prow__sumnote">${t('Auswahl')}</span>` : ''}
          <button type="button" class="linkbtn" data-act="foot-details">
            ${state.footDetails ? t('Details ausblenden') : t('Details anzeigen')}
          </button>`, list, sticky)}
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
export function card(rows, { minWidth, sticky, cls = '' }) {
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
  return planLegend({ layers: state.layers, coloured: coloured(), legend: data.print.legend, staffing: true });
}

/*
 * «Besetzung aufklappen» for a whole group at once. The label says what the
 * click will do: fold every row open while any is still shut, fold them all
 * shut once every one is open.
 */
function expandLink(g) {
  const all = g.projects.length > 0 && g.projects.every(p => state.openRoles[p.id]);
  const any = g.projects.some(p => state.openRoles[p.id]);
  return html`<button type="button" class="linkbtn pgroup__expand" data-act="toggle-roles-group" data-val="${g.key}">
    <span class="caret ${any ? '' : 'is-collapsed'}" aria-hidden="true">${icons.chevronDown()}</span>
    ${t(all ? 'Besetzung zuklappen' : 'Besetzung aufklappen')}
  </button>`;
}

/** Clicking the active column flips it; the toolbar reads the same state. */
const sortHead = (key, label, opts = {}) => sortableHead({
  ...opts, key, label, act: 'sort-col',
  active: state.sort === key, ascending: state.sortDir === 'asc'
});

/*
 * Most cells print the registry's plain text. These three are the cells the
 * search reads — the fields filteredProjects() matches on, with the kind as
 * the tail of the title, and no other, or a mark would claim a hit the
 * filter never saw — so they draw its hits; two of them are also something
 * the reader can act on. Named here rather than hidden behind a flag on the
 * column.
 */
const CELL_BODY = {
  id: p => highlight(p.number),

  /* Two controls in one cell, each with its own name: the caret folds the
     roles open, the name opens the project. */
  title: p => {
    const open = !!state.openRoles[p.id];
    return html`<button type="button" class="rowcaret" data-act="toggle-roles" data-val="${p.id}"
        aria-expanded="${open}" aria-label="${t('Besetzung ein-/ausklappen')}: ${p.title}">
        <span class="caret ${open ? '' : 'is-collapsed'}" aria-hidden="true">${icons.chevronDown()}</span>
      </button>
      <button type="button" class="prow__title"
        data-act="open-project" data-val="${p.id}" title="${p.title}">${highlight(p.title)}</button>`;
  },

  /*
   * A label now, not a control: the person in this role in the current
   * quarter. Assigning happens on the chip in the folded-open row, where the
   * quarter it takes effect from is the one the chip stands in.
   */
  lead: (p, lead) => (lead ? highlight(lead.name)
    : html`<span class="lead-open">${highlight(t('nicht zugewiesen'))}</span>`),

  /* How many lanes the row folds open to, and how many of them want a person today. */
  roles: p => {
    const n = p.roles.length;
    const open = p.roles.filter(r => { const s = segAt(r, nowIndex()); return s && !s.p; }).length;
    return html`<span title="${n} ${t(n === 1 ? 'Rolle' : 'Rollen')}${open ? ` · ${open} ${t('offen')}` : ''}">${n}</span>`;
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
function groupSum(g, tpl, sticky, cols) {
  if (!g.label) return '';
  const values = data.quarters.map((_, q) => g.projects.reduce((a, p) => a + cellValue(p, q), 0));
  return html`<div class="prow prow--sum prow--groupsum" style="grid-template-columns:${raw(tpl)}">
    ${sumLead(`${t('Summe')} ${g.label} (${g.projects.length})`, g.projects, sticky)}
    ${cols.map(period => html`<span class="pcell pcell--sum ${yearRule(period)}">${fmt(periodValue(values, period))}</span>`)}
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
  if (at < 0) {
    return html`<div style="grid-column:span ${shown.length}" class="prow__sumlabel is-frozen">${label}</div>`;
  }
  const col = shown[at];
  const funded = projects.filter(p => p.credit != null);
  const open = projects.length - funded.length;
  const total = funded.reduce((a, p) => a + p.credit, 0);
  const after = shown.length - at - 1;
  return html`<div style="grid-column:span ${at}" class="prow__sumlabel is-frozen">${label}</div>
    <span class="pcell ${col.cls} ${alignCls(col)} ${pinCls(sticky, col.key)}" style="${pinLeft(sticky, col.key)}"
      title="${t('Summe')} ${t(col.label)} · ${funded.length} ${t('Projekte mit Kredit')}${open ? ` · ${open} ${t('offen')}` : ''}"
      >${funded.length ? fmtMio(total, 2) : '—'}</span>
    ${after > 0 && html`<span class="is-frozen" style="grid-column:span ${after}; ${pinLeft(sticky, shown[at + 1].key)}"></span>`}`;
}

function footRow(label, values, tpl, span, cols) {
  return html`<div class="prow prow--foot" style="grid-template-columns:${raw(tpl)}">
    <div style="grid-column:span ${span}" class="prow__footlabel is-frozen">${label}</div>
    ${cols.map(period => html`<span class="pcell pcell--foot ${yearRule(period)}">${fmt(periodValue(values, period))}</span>`)}
  </div>`;
}

/*
 * A project row, and under it — once it is folded open — one lane per role.
 *
 * Folded, the row is the one it always was: the project's demand per quarter,
 * which is now the sum over its roles. The whole row is the switch, as the
 * wireframe asks: a click anywhere on it folds the roles open or shut, and
 * the controls inside it — the title, a bar, a gate — take their clicks
 * first. The figures stay buttons so the keyboard reaches them, and each
 * says what it does.
 */
function projectRow(p, lay, cols, rowIdx) {
  const { tpl, sticky } = lay;
  const L = state.layers;
  const lead = p.leadId ? data.peopleById[p.leadId] : null;
  const cells = projectDemand(p);
  const open = !!state.openRoles[p.id];

  const row = html`<div class="prow prow--project ${open ? 'is-open' : ''}" style="grid-template-columns:${raw(tpl)}"
      data-row="${rowIdx}" data-act="toggle-roles" data-val="${p.id}">
    ${sticky.shown.map(col => html`<span
        class="pcell ${col.cls} ${alignCls(col)} ${cellState(col, p, lead)} ${pinCls(sticky, col.key)}"
        style="${pinLeft(sticky, col.key)}">${cellBody(col, p, lead)}</span>`)}

    ${cols.map(period => {
      const q = period.quarters[0];
      const v = periodValue(cells, period);
      /* Somebody on the project is over their ceiling in the quarter — in any
         role, not only the lead's. A nought carries no warning: nobody is
         stretched by a quarter the project does not run in. */
      const over = v > 0 && period.quarters.some(x => [...holdersAt(p, x)].some(id => lay.isOver(id, x)));
      /* With the figures switched off the cell is a slot for the band, not a
         control: nothing to read, nothing to open. */
      const label = !L.values || (state.hideZeros && v === 0) ? '' : num(v);
      /* With the band drawn under the figures, the cell names the phase that
         runs in its quarter too — the same fact the bar below it carries. */
      const running = L.phases ? p.bars.find(b => b.from <= q && q < b.to) : null;
      const description = `${p.title} · ${lead ? lead.name : t('nicht zugewiesen')}, ${period.label}: ${num(v)}${unitSuffix()}`
        + (running ? ` · ${t(phaseOf(running.phase).label)}` : '')
        + (over ? ` — ${t('Person über 100 % belegt, Überlast')}` : '')
        + ` · ${t('Besetzung ein-/ausklappen')}`;
      return html`<button type="button"
        class="pcell pcell--val heat-${heatStep(v)} ${over ? 'is-warn' : ''} ${isEdited(p, q) ? 'is-edited' : ''} ${yearRule(period)}"
        data-act="toggle-roles" data-val="${p.id}" data-q="${q}" data-fk="cell:${p.id}:${q}"
        ${attr(!L.values, 'disabled')} aria-expanded="${open}" aria-label="${description}" title="${description}">
        <span class="cellv">${label}</span>
      </button>`;
    })}

    ${(L.phases || L.gates) && phaseBand(p, cols, lay, { compact: L.values, bars: L.phases, gates: L.gates })}
  </div>`;

  return open ? html`${row}${laneRows(p, lay, cols)}` : row;
}

/* -----------------------------------------------------------------------------
   The lanes — one per role, in the catalogue's order, under an open row
   -------------------------------------------------------------------------- */

/*
 * The same four lanes under every project, so the eye finds Bauleitung in the
 * same place on every row. A lane ePPM does not foresee for the project stays,
 * empty and greyed, because a slot in it is how the role is added: the
 * staffing popover creates the role on apply. The lane carries its label in
 * the frozen block, indented under the project name; the «Bearbeitender»
 * column may be switched off and the label still says which lane this is.
 */
function laneRows(p, lay, cols) {
  const { tpl, sticky } = lay;
  const span = sticky.shown.length;
  return roleCatalog().map(role => {
    const r = roleOn(p, role.id);
    const note = r ? t(role.label) : `${t(role.label)}: ${t('im Projekt nicht vorgesehen (ePPM)')}`;
    return html`<div class="prow prow--lane ${r ? '' : 'is-none'}" style="grid-template-columns:${raw(tpl)}">
      <div style="grid-column:span ${span}" class="lane__label lane__label--project is-frozen" title="${note}">
        <span>${t(role.label)}</span>
      </div>
      ${cols.map(period => laneCell(p, role, r, period))}
    </div>`;
  });
}

/*
 * One quarter of one role: a chip with the person and the pensum, in the heat
 * colour of the value — or a dashed chip saying the role is open, or an empty
 * slot that offers to plan it. Every one of them opens the staffing popover
 * for that role and that quarter. The short name goes on the chip; the full
 * name is in the hint and in the popover.
 */
function laneCell(p, role, r, period) {
  const q = period.quarters[0];
  const s = r && segAt(r, q);
  const st = state.staffing;
  const editing = st && st.projectId === p.id && st.role === role.id && st.q === q;
  const base = `pcell pcell--lane ${period.isNow ? 'is-today' : ''} ${yearRule(period)}`;
  const where = `${t(role.label)} · ${p.title} · ${period.label}`;

  if (!s) {
    return html`<span class="${base}">
      <button type="button" class="rchip rchip--empty ${editing ? 'is-editing' : ''}"
        data-act="staff" data-val="${p.id}" data-role="${role.id}" data-q="${q}" data-fk="chip:${p.id}:${role.id}:${q}"
        title="${t('Rolle besetzen')}: ${where}" aria-label="${t('Rolle besetzen')}: ${where}">${icons.plus(13)}</button>
    </span>`;
  }

  const v = periodValue(r.demand, period);
  const person = s.p ? data.peopleById[s.p] : null;
  const label = state.hideZeros && v === 0 ? '' : num(v);
  const description = `${t(role.label)}: ${person ? person.name : t('nicht zugewiesen')} · ${p.title} · ${period.label}: ${num(v)}${unitSuffix()}`;
  return html`<span class="${base}">
    <button type="button"
      class="rchip ${coloured() ? `heat-${heatStep(v)}` : ''} ${person ? '' : 'is-open'} ${s.from === q ? 'is-start' : ''} ${editing ? 'is-editing' : ''} ${roleEdited(p, role.id, q) ? 'is-edited' : ''}"
      data-act="staff" data-val="${p.id}" data-role="${role.id}" data-q="${q}" data-fk="chip:${p.id}:${role.id}:${q}"
      title="${description}" aria-label="${description}">
      <span class="rchip__name">${person ? highlight(person.shortName) : t('offen')}</span><span class="rchip__val">${label}</span>
    </button>
  </span>`;
}

/* -----------------------------------------------------------------------------
   The staffing popover — on the chip, as the editor used to be on the cell
   -------------------------------------------------------------------------- */

/*
 * One popover answers both questions a chip raises: who carries this role
 * from this quarter on, and at what pensum in this quarter. The person list
 * is ordered by free capacity, because capacity is why one name is right and
 * another is wrong, with the current holder first and «Rolle offen lassen»
 * last. A different name is a handover — the pensum stays with the role, and
 * the change asks for a reason, as an overload does. Applied, it is written
 * into the data and logged like every other edit.
 */
const staffWidth = () => tokenPx('--pop-assign-width');
/* The tallest it gets — a handover note and an overload note at once — so
   the flip never clips it. */
const STAFF_HEIGHT = 600;

export function staffPopover() {
  const { projectId, role: roleId, q, anchor, search = '', target } = state.staffing;
  const p = data.projectsById[projectId];
  const role = roleOf(roleId);
  const r = roleOn(p, roleId);
  const s = r && segAt(r, q);
  const current = s && s.p ? data.peopleById[s.p] : null;
  const quarter = data.quarters[q];
  const chosen = target ? data.peopleById[target] : null;
  /* A change of hands from this quarter on a role already planned: to
     somebody else, to nobody, or from nobody to somebody. Planning a role
     afresh is not one, and asks for no reason. */
  const handover = !!s && (s.p ?? null) !== (target ?? null);
  /* What the chosen person would stand at with this pensum on them — asked of
     the one function that converts, with the points they already carry for
     this very role taken off first. */
  const already = chosen && s && s.p === target ? r.demand[q] : 0;
  const util = chosen ? personUtilisation(target, q, state.draft - already) : null;
  const over = util != null && util > 100;
  const needReason = over || handover;
  const query = search.trim().toLowerCase();
  const unit = person => data.organisationsById[person.organisation];
  const rows = staffCandidates(q, current?.id ?? null)
    .filter(({ person }) => !query || `${person.name} ${t(unit(person)?.label ?? '')}`.toLowerCase().includes(query));

  const note = handover
    ? (chosen && current ? `${t('Übergabe')} ${t('ab')} ${quarter.label}: ${current.name} → ${chosen.name}`
      : chosen ? `${t('Zugewiesen an')} ${chosen.name} ${t('ab')} ${quarter.label}`
        : `${t('Übergabe')} ${t('ab')} ${quarter.label}: ${current.name} → ${t('Rolle offen')}`)
    : !s && (chosen || state.draft > 0) ? `${t('Geplant')} ${t('ab')} ${quarter.label}: ${chosen ? chosen.name : t('Rolle offen')}` : '';

  return html`<div class="pop pop--staff" role="dialog" aria-modal="false" aria-label="${t('Rolle besetzen')}"
      style="${popoverPosition(anchor, { width: staffWidth(), height: STAFF_HEIGHT, x: anchor.left })}">
    <div class="pop__kicker">${t(role.label)} · ${quarter.label}</div>
    <div class="pop__who">${p.title}</div>
    <div class="pop__what">${current
      ? `${t('Aktuell')}: ${current.name} · ${t('seit')} ${data.quarters[s.from].label}`
      : s ? t('Aktuell nicht zugewiesen') : t('Noch nicht geplant')}</div>

    <div class="pop__listlabel">${t('Pensum')} ${quarter.label}</div>
    <div class="pop__stepper pop__stepper--labelled">
      <button type="button" class="pop__step" data-act="draft" data-val="-5" aria-label="${t('Pensum verringern')}">${icons.minus(15)}</button>
      <label class="pop__input">
        <span class="sr-only">${t('Pensum')} ${quarter.label}</span>
        <input type="number" min="0" max="200" step="5" value="${state.draft}" data-act="draft-input" data-fk="draft"
               inputmode="numeric">
        <span class="pop__unit">%</span>
      </label>
      <button type="button" class="pop__step" data-act="draft" data-val="5" aria-label="${t('Pensum erhöhen')}">${icons.plus(15)}</button>
    </div>

    <div class="pop__listlabel">${t('Person')} ${t('ab')} ${quarter.label}</div>
    ${personSearch({ act: 'staff-search', fk: 'staff-search', value: search, listId: 'staff-list' })}
    ${rows.length ? '' : html`<p class="rebook__empty">${t('Keine Person gefunden.')}</p>`}
    <ul class="rebook__list assign__list staff__list" id="staff-list" role="listbox" aria-label="${t('Person wählen')}">
      ${rows.map(({ person, free }) => personOption({
        id: person.id, name: person.name, act: 'staff-target', selected: person.id === target,
        meta: person.id === current?.id
          ? `${t('aktuell')} · ${t(unit(person)?.short ?? '')}`
          : `${t(unit(person)?.short ?? '')} · ${t('frei')} ${quarter.short}: ${free}`,
        metaTitle: `${t(unit(person)?.label ?? '')} · ${t('frei')} ${quarter.label}: ${free} ${t('Punkte')}`
      }))}
      ${personOption({
        id: '', act: 'staff-target', selected: !target,
        name: html`<span class="assign__none">${t('Rolle offen lassen')}</span>`
      })}
    </ul>

    ${note && html`<p class="pop__warn ${handover ? 'is-none' : 'is-plan'}">${note}</p>`}
    ${over && html`<p class="pop__warn is-over">${chosen.name}: ${util} % ${t('der Projektkapazität')} · ${t('Überlast')}</p>`}

    <label class="pop__reason">
      <span class="pop__reasonlabel">${t('Begründung')}
        <span>${over ? t('— Pflicht bei Überlast') : handover ? t('— Pflicht bei Übergabe') : t('— optional')}</span></span>
      <textarea rows="2" data-act="reason" data-fk="reason"
        placeholder="${t('Bauleitung Etappe 2 vorgezogen, Freigabe Abteilungsleitung liegt vor.')}">${state.reason}</textarea>
    </label>

    <div class="pop__actions">
      <button type="button" class="btn btn--primary" data-act="staff-apply" ${attr(needReason && !state.reason.trim(), 'disabled')}>${t('Übernehmen')}</button>
      <button type="button" class="btn" data-act="cancel-staff">${t('Abbrechen')}</button>
    </div>
  </div>`;
}
