/* =============================================================================
   views-overview.js — the «Planung» grid: pensum figures per project and
   quarter, with the bar plan drawn as a band inside the same rows.
   ============================================================================= */

import {
  data, state, t, num, fmt, fmtMio, unitSuffix, cellValue, projectDemand, isEdited, laneEdited, personUtilisation,
  totals, loadStatus, heatStep, filteredProjects, groupProjects,
  periods, periodValue, windowEdges, columnSet, coloured, phaseOf,
  roleCatalog, lanesOf, holderKey, peopleOn, holdersAt, activeSpan
} from './store.js';

import {
  html, raw, icons, pageHeader, pageActions, toolbar, activeFilterRow,
  noResults, droppedNote, attr,
  tokenPx, yearRule, pinCls, pinLeft, sortableHead, highlight, caretCell, rowCaret
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
    titleW: titleWidth({ room, px: tokenPx }),
    /* The caret's own track, in front of the columns — see caretCell(). */
    lead: tokenPx('--grid-col-caret')
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
    const head = html`<h2 class="pgrouphead">
      <button type="button" class="pgrouphead__toggle"
              data-act="toggle-group" data-val="${g.key}" aria-expanded="${!collapsed}">
        <span class="caret ${collapsed ? 'is-collapsed' : ''}" aria-hidden="true">${icons.chevronDown()}</span>
        <span class="pgrouphead__name">${g.label}</span>
        <span class="count-pill">${g.projects.length}</span>
      </button>
      ${!collapsed && expandLink(g)}
    </h2>`;

    if (collapsed) return html`<section class="pgroup">${head}</section>`;

    const rows = g.projects.map(p => projectRow(p, lay, cols));
    // Each card repeats the column header — a group has to be readable on its
    // own. It closes with its own sum for the same reason, and because the
    // printed report already does exactly that. The project rows are wrapped
    // once, so the today marker has something to span that is not the header
    // or the totals.
    return html`<section class="pgroup">${head}
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
  const all = g.projects.length > 0 && g.projects.every(p => state.openProjects[p.id]);
  const any = g.projects.some(p => state.openProjects[p.id]);
  return html`<button type="button" class="linkbtn pgroup__expand" data-act="toggle-projects-group" data-val="${g.key}">
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
 * filter never saw — so they draw its hits. Named here rather than hidden
 * behind a flag on the column.
 */
const CELL_BODY = {
  id: p => highlight(p.number),

  /*
   * The name is text, not a control. A click on a project row does one thing
   * — it folds the row open or shut — and the name used to be the exception,
   * opening a summary dialog the users did not want in their way.
   */
  title: p => html`<span class="prow__title" title="${p.title}">${highlight(p.title)}</span>`,

  /*
   * One name and a count: the lead — whoever holds «Bearbeitender» now — and
   * how many more are on the project. The rows under a folded-open project
   * name every one of them in this same column; the hint lists them without
   * the click.
   */
  lead: (p, lead) => {
    const others = peopleOn(p).filter(id => id !== p.leadId).map(id => data.peopleById[id]?.name).filter(Boolean);
    const first = lead ? lead.name : t('nicht zugewiesen');
    return html`<span class="leadcell" title="${[first, ...others].join(', ')}">
      <span class="leadcell__name ${lead ? '' : 'lead-open'}">${highlight(first)}</span>${
      others.length > 0 && html`<span class="leadcell__more">+${others.length}</span>`}</span>`;
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
      ${caretCell()}
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
 * selection when the reader is looking at the small projects alone.
 */
function groupSum(g, tpl, sticky, cols) {
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
  /* The label starts at the card's edge, over the caret's track. */
  if (at < 0) {
    return html`<div style="grid-column:span ${shown.length + 1}" class="prow__sumlabel is-frozen">${label}</div>`;
  }
  const col = shown[at];
  const funded = projects.filter(p => p.credit != null);
  const open = projects.length - funded.length;
  const total = funded.reduce((a, p) => a + p.credit, 0);
  const after = shown.length - at - 1;
  return html`<div style="grid-column:span ${at + 1}" class="prow__sumlabel is-frozen">${label}</div>
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
 * A project row, and under it — once it is folded open — its Bearbeitende,
 * role by role.
 *
 * Folded, the row is the one it always was: the project's demand per quarter,
 * which is the sum over the rows under it. The whole row is the switch: a
 * click anywhere on it — the caret, the name, a figure, the empty space —
 * folds it open or shut and does nothing else. Only a bar or a gate of the
 * band takes its own click first. The caret stands in a track of its own in
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

  const row = html`<div class="prow prow--project ${open ? 'is-open' : ''}" style="grid-template-columns:${raw(tpl)}"
      data-act="toggle-project" data-val="${p.id}">
    ${caretCell(rowCaret({
      act: 'toggle-project', val: p.id, open, label: `${t('Besetzung ein-/ausklappen')}: ${p.title}`
    }))}
    ${sticky.shown.map(col => html`<span
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
        + (over ? ` — ${t('Person über 100 % belegt, Überlast')}` : '')
        + ` · ${t('Besetzung ein-/ausklappen')}`;
      return html`<button type="button"
        class="pcell pcell--val heat-${heatStep(v)} ${over ? 'is-warn' : ''} ${isEdited(p, q) ? 'is-edited' : ''} ${yearRule(period)}"
        data-act="toggle-project" data-val="${p.id}" data-q="${q}" data-fk="cell:${p.id}:${q}"
        ${attr(!L.values, 'disabled')} aria-expanded="${open}" aria-label="${description}" title="${description}">
        <span class="cellv">${label}</span>
      </button>`;
    })}

    ${(L.phases || L.gates) && phaseBand(p, cols, lay, { compact: L.values, bars: L.phases, gates: L.gates })}
  </div>`;

  return open ? html`${row}${laneRows(p, lay, cols)}` : row;
}

/* -----------------------------------------------------------------------------
   The rows under an open project — a role, a person, and a number per quarter
   -------------------------------------------------------------------------- */

/*
 * The same four roles under every project, in the catalogue's order, so the
 * eye finds Bauleitung in the same place on every project. A row reads like
 * a line of a spreadsheet: the role under the project's name, the person
 * beside it under «Bearbeitende» — the two columns are neighbours for that
 * reason — and a plain number in every quarter — the cell is the
 * field, there is nothing to open. The person's short name used to ride on
 * every chip of the lane; with one person per row it stands once.
 *
 * A role two people hold in turn is two rows. A role the project does not
 * have yet is one empty row, greyed: choosing a person or typing a figure
 * plans it. «Weitere Person» on a role's last row asks for another empty row
 * — the way a handover is entered, the one row emptied from a quarter on and
 * the other filled.
 */
function laneRows(p, lay, cols) {
  return roleCatalog().map(role => {
    const rows = lanesOf(p, role.id);
    /* An empty row stands in for the row nobody holds: the role's only row
       while it has none, an extra one when it was asked for. */
    const blank = !rows.some(a => !a.person) && (!rows.length || !!state.extraRows[`${p.id}:${role.id}`]);
    const more = rows.length > 0 && !blank && rows.every(a => a.person);
    return html`${rows.map((a, i) => laneRow(p, role, a, lay, cols, { more: more && i === rows.length - 1 }))}${
      blank && laneRow(p, role, null, lay, cols, { planned: rows.length > 0 })}`;
  });
}

/**
 * One row. `a` is the project's entry, or null for an empty row — which goes
 * by the key of the row nobody holds, because that is the entry a figure
 * typed into it creates, and the cell being typed in must still be there
 * after it has.
 */
function laneRow(p, role, a, lay, cols, { more = false, planned = true } = {}) {
  const { tpl, sticky } = lay;
  const holder = a ? holderKey(a) : 'none';
  const person = a?.person ? data.peopleById[a.person] : null;
  const who = person ? person.name : t('nicht zugewiesen');
  const shown = new Set(sticky.shown.map(c => c.key));
  const when = a ? activeSpan(a) : '';
  const hint = `${t(role.label)} · ${who} · ${p.title}${when ? ` · ${when}` : ''}`
    + (planned ? '' : ` · ${t('im Projekt nicht vorgesehen (ePPM)')}`);

  /*
   * The person, as the list it is chosen from. It is drawn with the one
   * name it shows; app.js fills in the rest of the roster when it is first
   * pointed at or focused, or every open row would carry fifty options.
   */
  const picker = html`<select class="lanepick ${person ? '' : a ? 'is-open' : 'is-blank'}"
      data-act="lane-person" data-val="${p.id}" data-role="${role.id}" data-holder="${holder}"
      data-fk="lanep:${p.id}:${role.id}:${holder}"
      aria-label="${t(role.label)} · ${p.title}: ${t('Person wählen')}">
    <option value="">${a ? t('nicht zugewiesen') : t('Person wählen')}</option>
    ${person && html`<option value="${person.id}" selected>${person.name}</option>`}
  </select>`;

  const roleLabel = html`<span class="lane__role">${t(role.label)}</span>${more && html`<button type="button"
      class="lane__more" data-act="lane-more" data-val="${p.id}" data-role="${role.id}"
      title="${t('Weitere Person')}: ${t(role.label)}" aria-label="${t('Weitere Person')}: ${t(role.label)} · ${p.title}"
      >${icons.plus(13)}</button>`}`;

  /* The role goes under the project's name and the person under
     «Bearbeitende». Where one of the two columns is off, the other carries
     what is left — the role's short form in front of the list, or the list
     beside the role. */
  const cell = col => {
    if (col.key === 'title') return shown.has('lead') ? roleLabel : html`${roleLabel}${picker}`;
    if (col.key === 'lead') {
      return shown.has('title') ? picker : html`<span class="lane__role lane__role--short">${t(role.short)}</span>${picker}`;
    }
    if (col.key === 'id' && !shown.has('title') && !shown.has('lead')) return t(role.short);
    return '';
  };

  return html`<div class="prow prow--lane ${planned ? '' : 'is-unplanned'}" style="grid-template-columns:${raw(tpl)}">
    ${caretCell()}
    ${sticky.shown.map(col => html`<span class="pcell lane__cell lane__cell--${col.key} ${pinCls(sticky, col.key)}"
        style="${pinLeft(sticky, col.key)}" title="${hint}">${cell(col)}</span>`)}
    ${cols.map(period => laneCell(p, role, a, holder, who, period, lay))}
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
 */
function laneCell(p, role, a, holder, who, period, lay) {
  const from = period.quarters[0];
  const to = period.quarters.at(-1) + 1;
  const v = a ? periodValue(a.demand, period) : 0;
  const key = `${role.id}:${holder}`;
  const over = !!a?.person && v > 0 && period.quarters.some(x => lay.isOver(a.person, x));
  const edited = period.quarters.some(x => laneEdited(p, key, x));
  const tone = v > 0 ? (a.person ? `heat-${heatStep(v)}` : 'is-open') : 'is-zero';
  const description = `${t(role.label)} · ${who} · ${p.title}, ${period.label}`;
  return html`<label class="pcell pcell--val pcell--lanev ${tone} ${edited ? 'is-edited' : ''} ${yearRule(period)}"
      title="${description}${over ? ` — ${t('Person über 100 % belegt, Überlast')}` : ''}">
    <input type="text" inputmode="decimal" autocomplete="off" class="lanev__in" value="${v > 0 ? num(v) : ''}"
      data-act="lane-input" data-val="${p.id}" data-role="${role.id}" data-holder="${holder}"
      data-q="${from}" data-to="${to}" data-col="${period.id}" data-fk="lane:${p.id}:${key}:${period.id}"
      aria-label="${description}: ${t('Pensum')}${unitSuffix()}">
  </label>`;
}
