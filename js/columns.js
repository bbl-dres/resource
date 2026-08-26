/* =============================================================================
   columns.js — the master-data columns of a project, declared once.

   The same list was written out six times: the Attribute menu, the grid layout,
   the grid header, the grid row, the print sheet and the export. Adding a
   column meant editing all six and keeping their order in step by hand. Here
   each column is one entry, and every consumer reads it.

   A column carries what all six need:
     key      identity, and the field name in an exported row
     label    German source string; every consumer runs it through t()
     flag     the switch that turns it on, or null for a column that is always
              there. Only `id` is always there: a row has to be identifiable.
     align    'end' for a figure, 'center' for a mark; text reads from the left
              and needs no entry. Both grids read it, so a column cannot sit one
              way in the table and another in the bar plan.
     sort     the SORT_KEYS entry a header click selects, if it sorts at all
     width    the design token holding its width in the grid
     sheet    { w: [portrait, landscape], cls } for the printed sheet
     xls      { type, width } for the spreadsheet
     text     the plain value, used by the sheet, the CSV and the workbook
   ============================================================================= */

import { data, t, ampel, phaseOf } from './store.js';

/** The project lead's name, or the words that stand in for an empty one. */
const leadName = p => (p.leadId ? data.peopleById[p.leadId].name : t('nicht zugewiesen'));

/** The first gate ahead of this project, as code and quarter. */
const nextGate = (p) => {
  const ms = data.milestonesByProject[p.id]?.[0];
  return ms ? `${ms.code} · ${data.quarters[data.quarterIndex[ms.plan]].label}` : '';
};

export const COLUMNS = [
  {
    // The one column with no switch: hide everything else and a row is still
    // a row, hide this and it is an anonymous strip of numbers.
    key: 'id', label: 'ID', flag: null, sort: 'id', width: '--grid-col-id',
    cls: 'pcell--id', sheet: { w: [52, 62], cls: 'sheet__id' }, xls: { type: 'text', width: 12 },
    text: p => p.number
  },
  {
    key: 'title', label: 'Projekt', flag: 'title', sort: 'project', width: '--grid-col-title',
    grow: true, cls: 'pcell--title', sheet: { w: [150, 190], flex: true }, xls: { type: 'text', width: 38 },
    text: p => p.title
  },
  {
    key: 'phase', label: 'SIA-Phase', flag: 'phase', sort: 'phase', width: '--grid-col-phase',
    cls: 'pcell--phase', sheet: { w: [124, 128], cls: 'sheet__muted', label: 'SIA-Teilphase' },
    xls: { type: 'text', width: 20 },
    text: p => t(phaseOf(p.phase).label)
  },
  {
    key: 'lead', label: 'Projektleitung', flag: 'lead', sort: 'lead', width: '--grid-col-lead',
    cls: 'pcell--lead', sheet: { w: [86, 108], cls: 'sheet__muted' }, xls: { type: 'text', width: 20 },
    text: leadName
  },
  {
    // The signal reports on the project lead, so it sits beside that column.
    key: 'ampel', label: 'Ampel', flag: 'ampel', sort: null, width: '--grid-col-ampel',
    align: 'center',
    cls: 'pcell--ampel', sheet: { w: [34, 38], cls: 'sheet__mark' }, xls: { type: 'text', width: 14 },
    // A coloured dot carries nothing in a spreadsheet, so it exports as its word.
    text: p => t(ampel(p.leadId).word)
  },
  {
    key: 'portfolio', label: 'Teilportfolio', flag: 'portfolio', sort: 'portfolio',
    width: '--grid-col-portfolio', cls: 'pcell--text', sheet: { w: [76, 96], cls: 'sheet__muted' },
    xls: { type: 'text', width: 18 },
    text: p => t(data.portfoliosById[p.portfolio].label)
  },
  {
    key: 'priority', label: 'Priorität', flag: 'priority', sort: 'priority',
    width: '--grid-col-priority', cls: 'pcell--text', sheet: { w: [50, 62], cls: 'sheet__muted' },
    xls: { type: 'text', width: 12 },
    text: p => t(p.priority)
  },
  {
    key: 'nextMs', label: 'Nächster Meilenstein', flag: 'nextMs', sort: null,
    width: '--grid-col-nextms', cls: 'pcell--text', sheet: { w: [92, 116], cls: 'sheet__muted' },
    xls: { type: 'text', width: 24 },
    text: nextGate
  },
  {
    key: 'credit', label: 'Kredit CHF', flag: 'credit', sort: 'credit',
    width: '--grid-col-credit', cls: 'pcell--credit', numeric: true, align: 'end',
    sheet: { w: [62, 76], cls: 'sheet__num sheet__muted' }, xls: { type: 'num', width: 14 },
    text: p => t(p.creditLabel)
  },
  {
    key: 'target', label: 'Soll-Pensum', flag: 'target', sort: 'target',
    width: '--grid-col-target', cls: 'pcell--target', numeric: true, align: 'end',
    sheet: { w: [44, 52], cls: 'sheet__num' }, xls: { type: 'pct', width: 10 }
    // `text` is omitted: the value is a pensum and every consumer formats it
    // in the unit the toolbar has selected.
  },
  {
    // Not master data: a sparkline of the row's own numbers, so it sits after
    // the time axis and no other consumer has a use for it.
    key: 'trend', label: 'Verlauf', flag: 'trend', sort: null,
    width: '--grid-col-trend', cls: 'pcell--trend', afterQuarters: true
  }
];

const BY_KEY = Object.fromEntries(COLUMNS.map(c => [c.key, c]));
export const column = key => BY_KEY[key];

/*
 * Which column gives way first when the window is too narrow, least
 * load-bearing to most. `id` is not in the list — it is the floor, and on a
 * phone the list runs to its end and leaves exactly that.
 */
const YIELD_ORDER = ['nextMs', 'priority', 'portfolio', 'target', 'credit',
                     'phase', 'ampel', 'lead', 'title'];

/**
 * The columns that fit. `room` is the width available to the card and
 * `axis` what the time axis needs at a minimum; anything that does not fit is
 * dropped in yield order and returned so the view can say what it hid.
 */
export function fittingColumns(set, { room, axis, widthOf }) {
  const shown = visibleColumns(set);
  const hidden = [];
  const lead = () => shown.reduce((a, c) => a + widthOf(c), 0);

  for (const key of YIELD_ORDER) {
    if (lead() + axis <= room) break;
    const i = shown.findIndex(c => c.key === key);
    if (i < 0) continue;
    hidden.push(shown[i]);
    shown.splice(i, 1);
  }
  return { shown, hidden };
}

/**
 * The frozen block both grids put in front of the time axis: the template parts
 * for its columns, where each one is pinned, and what had to give.
 *
 * Both tabs freeze the same columns in the same order for the same reason, so
 * they compute it from one place — a project sits in the same spot whichever
 * tab you are reading.
 */
export function leadLayout(set, fit) {
  const { shown, hidden } = fittingColumns(set, fit);
  /*
   * Only one track in a row may take the slack. The pensum grid gives it to the
   * project title; the bar plan gives it to the bars, so there the title is
   * fixed — with two flexible tracks the title ate half the free width and the
   * capacity band, which measures the frozen block, no longer lined up under it.
   */
  const grow = fit.grow === true;
  const parts = [];
  const sticky = {};
  let offset = 0;

  for (const col of shown) {
    const w = col.grow && fit.titleW ? fit.titleW : fit.widthOf(col);
    sticky[col.key] = offset;
    offset += w;
    parts.push(grow && col.grow ? `minmax(${w}px, 1fr)` : `${w}px`);
  }
  sticky.width = offset;
  sticky.last = shown.at(-1)?.key ?? null;
  sticky.shown = shown;
  return { parts, sticky, shown, hidden, width: offset };
}

/*
 * The columns the project name is reckoned against: the pensum grid's own
 * defaults. Not what is switched on right now, so toggling an attribute never
 * moves the name either.
 */
const TITLE_REFERENCE = ['id', 'phase', 'lead', 'ampel', 'credit'];

/*
 * And against a fixed number of quarter columns, not however many the current
 * time scale happens to show. Reckoned against the visible count, the year view
 * — five columns instead of eighteen — left so much over that the project name
 * grew from 285 to 460px, and it changed width on every scale change.
 */
const REFERENCE_COLUMNS = 8;

/**
 * How wide the project name is — the same answer for both grids.
 *
 * It cannot be whatever each grid happens to have room for. The bar plan
 * carries two lead columns and the table six, so at 1280px the same project
 * name was 285px wide in one tab and 460px in the other, and it jumped 175px
 * on every switch. Both ask this instead.
 */
export function titleWidth({ room, px }) {
  const fixed = TITLE_REFERENCE.reduce((a, key) => a + px(column(key).width), 0);
  const spare = room - fixed - REFERENCE_COLUMNS * px('--grid-quarter');
  return Math.round(Math.max(px('--grid-col-title'),
    Math.min(px('--grid-col-title-max'), spare)));
}

/** The class that carries a column's alignment into either grid. */
export const alignCls = (col) => (col.align ? `align-${col.align}` : '');

/** Is this column switched on? A column with no flag is always on. */
export const columnOn = (set, col) => !col.flag || !!set[col.flag];

/** The columns currently on, in grid order. */
export const visibleColumns = set =>
  COLUMNS.filter(c => !c.afterQuarters && columnOn(set, c));

/** The Attribute menu: every column that has a switch. */
export const toggleableColumns = () =>
  COLUMNS.filter(c => c.flag).map(c => ({ id: c.flag, label: c.label }));
