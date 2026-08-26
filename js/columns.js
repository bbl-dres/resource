/* =============================================================================
   columns.js — the master-data columns of a project, declared once.

   The same list was written out six times: the Attribute menu, the grid layout,
   the grid header, the grid row, the print sheet and the export. Adding a
   column meant editing all six and keeping their order in step by hand. Here
   each column is one entry, and every consumer reads it.

   A column carries what all six need:
     key      identity, and the field name in an exported row
     label    German source string; every consumer runs it through t()
     flag     which switch turns it on — 'cols' for the column set, 'state' for
              a top-level flag. The menu hides the distinction; the code cannot.
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
    key: 'id', label: 'ID', flag: ['cols', 'id'], sort: 'id', width: '--grid-col-id',
    cls: 'pcell--id', sheet: { w: [52, 62], cls: 'sheet__id' }, xls: { type: 'text', width: 12 },
    text: p => p.number
  },
  {
    key: 'title', label: 'Projekt', flag: null, sort: 'project', width: '--grid-col-title',
    grow: true, cls: 'pcell--title', sheet: { w: [150, 190], flex: true }, xls: { type: 'text', width: 38 },
    text: p => p.title
  },
  {
    key: 'phase', label: 'SIA-Phase', flag: ['cols', 'phase'], sort: 'phase', width: '--grid-col-phase',
    cls: 'pcell--phase', sheet: { w: [88, 112], cls: 'sheet__muted', label: 'SIA-Teilphase' },
    xls: { type: 'text', width: 20 },
    text: p => t(phaseOf(p.phase).label)
  },
  {
    key: 'lead', label: 'Projektleitung', flag: ['cols', 'lead'], sort: 'lead', width: '--grid-col-lead',
    cls: 'pcell--lead', sheet: { w: [86, 108], cls: 'sheet__muted' }, xls: { type: 'text', width: 20 },
    text: leadName
  },
  {
    // The signal reports on the project lead, so it sits beside that column.
    key: 'ampel', label: 'Ampel', flag: ['state', 'ampel'], sort: null, width: '--grid-col-ampel',
    cls: 'pcell--ampel', sheet: { w: [34, 38], cls: 'sheet__mark' }, xls: { type: 'text', width: 14 },
    // A coloured dot carries nothing in a spreadsheet, so it exports as its word.
    text: p => t(ampel(p.leadId, 0).word)
  },
  {
    key: 'portfolio', label: 'Teilportfolio', flag: ['cols', 'portfolio'], sort: 'portfolio',
    width: '--grid-col-portfolio', cls: 'pcell--text', sheet: { w: [76, 96], cls: 'sheet__muted' },
    xls: { type: 'text', width: 18 },
    text: p => t(data.portfoliosById[p.portfolio].label)
  },
  {
    key: 'priority', label: 'Priorität', flag: ['cols', 'priority'], sort: 'priority',
    width: '--grid-col-priority', cls: 'pcell--text', sheet: { w: [50, 62], cls: 'sheet__muted' },
    xls: { type: 'text', width: 12 },
    text: p => t(p.priority)
  },
  {
    key: 'nextMs', label: 'Nächster Meilenstein', flag: ['cols', 'nextMs'], sort: null,
    width: '--grid-col-nextms', cls: 'pcell--text', sheet: { w: [92, 116], cls: 'sheet__muted' },
    xls: { type: 'text', width: 24 },
    text: nextGate
  },
  {
    key: 'credit', label: 'Kredit CHF', flag: ['cols', 'credit'], sort: 'credit',
    width: '--grid-col-credit', cls: 'pcell--credit', numeric: true,
    sheet: { w: [62, 76], cls: 'sheet__num sheet__muted' }, xls: { type: 'num', width: 14 },
    text: p => t(p.creditLabel)
  },
  {
    key: 'target', label: 'Soll-Pensum', flag: ['state', 'target'], sort: 'target',
    width: '--grid-col-target', cls: 'pcell--target', numeric: true,
    sheet: { w: [44, 52], cls: 'sheet__num' }, xls: { type: 'pct', width: 10 }
    // `text` is omitted: the value is a pensum and every consumer formats it
    // in the unit the toolbar has selected.
  },
  {
    // Not master data: a sparkline of the row's own numbers, so it sits after
    // the time axis and no other consumer has a use for it.
    key: 'trend', label: 'Verlauf', flag: ['state', 'trend'], sort: null,
    width: '--grid-col-trend', cls: 'pcell--trend', afterQuarters: true
  }
];

const BY_KEY = Object.fromEntries(COLUMNS.map(c => [c.key, c]));
export const column = key => BY_KEY[key];

/** Is this column switched on right now? A column with no flag is always on. */
export function columnOn(state, col) {
  if (!col.flag) return true;
  const [where, key] = col.flag;
  return where === 'cols' ? !!state.cols[key] : !!state[key];
}

/** The columns currently on, in grid order. */
export const visibleColumns = state =>
  COLUMNS.filter(c => !c.afterQuarters && columnOn(state, c));

/**
 * The Attribute menu. `title` is not offered — a table of projects without the
 * project is not a view anyone wants — so it is the one column with no switch.
 */
export const toggleableColumns = () =>
  COLUMNS.filter(c => c.flag).map(c => ({
    id: c.flag[1],
    label: c.label,
    act: c.flag[0] === 'cols' ? 'toggle-col' : 'toggle-flag'
  }));
