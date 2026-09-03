# Planung — merging «Übersicht» and «Termine»

Findings and implementation plan for bringing the application up to the
wireframe `docs/wireframes/260903_Planung-kombiniert.html`. Written before the
work, kept as the record of what was decided and why; the checklist at the end
says what landed.

## 1. What the wireframe is

One tab, «Planung», in place of «Übersicht» (the pensum heat map) and «Termine»
(the bar plan). The phase bars and milestone gates are drawn as a 14px band at
the foot of every pensum row, so the row keeps its 38px height and the merge
costs no density. Three named views and a fourth for everyone else:

| View | Pensumwerte | Phasenbalken | Meilensteine | Heute |
|---|---|---|---|---|
| Pensum | on | off | off | off |
| Pensum + Termine | on | on | on | off |
| Termine | off | on | on | on |
| Individuell | whatever the four switches say | | | |

With the figures off the band takes the whole row at the bar plan's own height
and the bars carry their names, so «Termine» is the old bar plan rendered by
the pensum grid. Colouring by pensum is a switch of its own («Pensum
einfärben»), forced off while there are no figures.

The chrome around the grid was reduced at the same time, measured on a
1366×768 laptop, where the first data row used to start 355px down a window
with about 630px to give:

- The breadcrumb bar and the page title are gone. The tabs share one line
  with «Exportieren» and «Teilen»; the data timestamp moves to the footer.
- The toolbar loses the sort dropdown (the column headers sort) and the
  «Attribute» menu. The time bar is gone: its arrows and «Zu heute» sit at
  the right end of the toolbar, and the scale moves into the menu.
- One «Ansicht» menu at the right end of the toolbar holds the view, the
  layer switches (only while «Individuell» is chosen), the unit, the
  colouring, the zero toggle, the columns and the time scale.
- «Gruppieren nach:» keeps its prefix for screen readers and drops it
  visually below 1400px, where the row no longer holds it.
- Below 1440px the shell padding, tab height, control gaps and group
  headings tighten by a step; the toolbar may break into two lines below
  1250px. Above the grid the gaps run 20 / 8 / 24px (16 / 6 / 16 on the
  small laptop): tabs to toolbar, toolbar to filter readout, readout to the
  first group heading.
- Assigning a person is a popover on the Bearbeitender cell, sorted by free
  capacity, where the pick is the commit and «Niemand zuweisen» clears. The
  760px modal goes.
- The phase-column default is off: the band already names the sub-phase.

Two things in the wireframe do **not** ship. The option bar at the foot of the
window (bar fill, label position, heat scale) is a drafting instrument and its
chosen answers are baked in: grey bars, band at the bottom, blue ramp. And the
«Phase» colouring was dropped during review.

## 2. What the application has

Read against `js/` and `css/` at commit e645290.

- **The CSS in the wireframe is the application's own.** Lines 12–2865 of
  the wireframe are `tokens.css` + `main.css` byte for byte (blank lines
  aside). Every visual change is therefore in the wireframe-only sections
  after line 2865, and can be ported as they stand, minus the option bar.
- **Two grids, one registry.** `views-overview.js` draws the pensum grid and
  `views-schedule.js` the bar plan; both take their frozen block from
  `columns.js` and their time axis from `store.periods()`. The bar plan
  already has everything the band needs — `placeBars`, `gatePlaces`,
  `unitAt`, `barRun`, `barText`, `todayFraction` — as module-private
  functions. They are exported and reused, not copied.
- **Two column sets.** `state.cols.overview` and `state.cols.schedule`; the
  export tab reads the schedule set when it prints the bar plan. That stays:
  the printed «Termine» report still has its own columns.
- **The page header** (`ui.pageHeader`) renders a breadcrumb bar with the
  timestamp, a title row with actions, and the tab bar. Five views use it;
  the export and API pages pass `chrome: false` and keep their own title.
- **The toolbar** (`ui.toolbar`) is shared by the grid tabs, the dashboard,
  the history and the export page. Options: `attributes`, `exclude`.
- **The time bar** (`ui.timeControls`) exists only on the two grid tabs.
- **Assigning** is `assignModal` in `views-modals.js` with three actions in
  `app.js`; the rebooking modal stays as it is.
- **The URL** carries `tab`, `scale`, `unit`, `sort`, `group`, the filters
  and the paging; `VOCAB` closes every value. `tab=schedule` is a shareable
  address today and must keep resolving.
- **`data/i18n.json`** is hand-written and alphabetically keyed; every new
  label needs an entry or it is German in every language.
- **Print** (`views-docs.js`) imports `ganttRow` and `ganttLegend` from the
  schedule module and is otherwise untouched by this change.

## 3. Decisions

1. **`tab=schedule` becomes «Planung» in the Termine view.** `readUrl` maps
   it; `VOCAB.tab` drops the value so nothing else can reach it. Links inside
   the app («In Termine öffnen») do the same.
2. **A view is a name for a set of layers, kept in state as both.**
   `state.view` and `state.layers` are written together; a layer switch
   rewrites `view` from what the layers now say (`viewOf`). The URL carries
   `view=`, and `layers=` only for «Individuell». `colour=none` when the
   colouring is off.
3. **The band derives its geometry from two numbers**, `--band-h` and
   `--values-h`, scoped on the grid card rather than the root, and switched
   by classes the view sets: `is-values-off`, `is-bars-off`, `is-gates-off`,
   `is-uncoloured`. No arrangement is written out twice.
4. **The today marker needs no script.** The project rows of a card are
   wrapped once, and the marker is an overlay on that wrapper, so it spans
   the rows and nothing else. The wireframe measured head and foot in JS
   because its rows were not wrapped.
5. **Bar labels are decided at render time** with `barRun`/`barText`, as the
   bar plan does, against a column width the grid layout now states. Under a
   figure the ceiling is the sub-phase number at 10px; with the row to
   itself the full rule applies at 11px.
6. **The heat ramp gains a chroma floor and the bar ground becomes a true
   neutral**, from the wireframe's colour-difference measurements. These
   are token changes and apply wherever the ramp is drawn, including the
   dashboard's person table and the printed sheet.
7. **The picker is a popover, like the pensum editor.** `state.picking`
   mirrors `state.editing`; one action commits or clears. The rebook modal
   is not touched.
8. **The option bar does not ship.** Its defaults are the values.
9. **Dead code goes with the tab.** `renderSchedule`, the capacity band and
   the time bar are removed; `views-schedule.js` keeps the row, the legend
   and the placement helpers for print and for the band.

## 4. Plan

Ordered so the application renders after every step.

| # | Step | Files |
|---|---|---|
| 1 | State: view, layers, colour; URL; presets; column default | `store.js` |
| 2 | Shell: tabs, tab line, footer timestamp, toolbar with time controls and the Ansicht menu; drop time bar | `ui.js` |
| 3 | Band: export placement helpers, add `phaseBand()` and `todayFraction` for the grid; remove the tab | `views-schedule.js` |
| 4 | Grid: band per row, today overlay per card, layers, colouring, legend, layout column width | `views-overview.js` |
| 5 | Picker popover; remove the assign modal | `views-overview.js`, `views-modals.js` |
| 6 | Dispatch: view and layer actions, picker actions and keys, `open-schedule`, tab routing | `app.js` |
| 7 | Styles: tokens, tab line, band, today, editing ring, picker, small laptop, one-row toolbar, rhythm; remove crumb bar, time bar, capacity band | `tokens.css`, `main.css` |
| 8 | Labels in four languages | `data/i18n.json` |
| 9 | Documentation: architecture map, standing rules, this checklist | `docs/` |
| 10 | Verification: screenshots of the served app against the wireframe at 1366 and 1280, every view, menu, editor, picker | scratch |

## 5. Checklist

- [x] 1 store — `view`, `layers`, `colour`, `picking`; `VIEW_PRESETS`, `viewOf`,
      `viewPatch`, `layerPatch`, `coloured`; URL read and write; `tab=schedule`
      mapped; phase column default off
- [x] 2 shell — tabs Planung / Dashboard / Verlauf; `pageHeader` as a tab line;
      timestamp in the footer; toolbar with time steps and the Ansicht menu;
      a «Spalten» menu for the export page; time bar removed
- [x] 3 band helpers — `phaseBand`, `todayFraction` and the placement helpers
      exported; `renderSchedule`, the capacity band and the axis removed
- [x] 4 grid — band per row, today overlay per card, layer classes, totals
      only with figures, legend by layers, column width for labels
- [x] 5 picker — `assignPicker` popover; assign modal removed
- [x] 6 dispatch — `view`, `toggle-layer`, `colour`, `assign`, `pick`,
      `pick-search`; picker in the focus trap, the listbox keys, outside click
      and scroll; `open-schedule` opens the Termine view
- [x] 7 styles — tokens (ramp, bar ground, band height); tab line, band, today,
      editing ring, picker, one-row toolbar, prefix, small laptop, rhythm;
      breadcrumb, time bar and capacity band rules removed
- [x] 8 i18n — 17 terms added in three languages
- [x] 9 docs — `ARCHITECTURE.md`, `DECISIONS.md`, `README.md`, this file
- [x] 10 verified — served from `python -m http.server`, rendered headless at
      1366×768 and 1280×720: boot, Pensum + Termine, Termine with the today
      line, Individuell with layers from the URL, the Ansicht menu, the editor
      ring, the picker, and the dashboard, history, export and API pages

## 6. What was verified, and how

Headless Edge against the served application, one screenshot per state, read
against the wireframe at the same width. Not automated: the Playwright harness
the older documents cite is not in the repository. Two things were checked by
reading the DOM rather than the pixels, because a headless capture freezes CSS
transitions: the switch states in the menu and the root attributes.

Known differences from the wireframe, all deliberate:

- The grouping defaults to «Keine», as the application always has; the
  wireframe's fixture was grouped by Teilportfolio.
- The Ansicht menu lists every column the registry has, not the five the
  wireframe's fixture carried, and offers the month scale.
- The option bar is not there.
