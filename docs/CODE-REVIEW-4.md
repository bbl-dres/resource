# Code review 4 — after the Planung merge

**Scope.** Everything the merge touched and everything it sits on: `js/` (all
twelve modules), `css/`, `tools/generate-portfolio.js`, the generated data.
State at the start of the review: the working tree after the Planung merge,
the ePPM chain, the print views and the milestone simplification.

**Method.** Three independent review lanes, one per layer — state and
dispatch (`store.js`, `app.js`); views and shared UI; generator, export, PDF
writer and stylesheets — each asked for bugs, race conditions, robustness,
performance, dead code and duplication, with a file, a line, quoted evidence
and a fix. 78 raw findings. Every finding acted on below was verified against
the source before it was changed, and every change was verified afterwards in
the served application: the modules parse, all five pages boot, and a
scripted run exercised history, URL reset and validation, the picker, the
band, the menu and the editor. Headless capture freezes CSS transitions and
`performance.now()`, so nothing below quotes a render time.

**Outcome.** 41 findings implemented, 9 deferred with reasons, 28 not acted
on (cosmetic, already correct, or covered by another change). The
implemented set is listed by severity; the deferred set at the end.

---

## 1. Bugs

| # | Where | What was wrong | What changed |
|---|---|---|---|
| B1 | `app.js` tab change | `setState` replaced the current history entry with the new hash, then a listener pushed the same hash again. The previous tab's address was gone; Back landed on an identical hash and did nothing. Back/Forward themselves pushed entries too, truncating the Forward stack. | `writeUrl({ push })`: `setState` compares the tab before and after and pushes only on a change; silent (URL-driven) updates never write. The listener is gone. |
| B2 | `store.readUrl` | Only keys present in the hash were applied, so a hash that had lost a key — Back after a filter, a hand-edited address — kept the old filter, sort, view or offset while the address bar said otherwise. | `readUrl` returns a value for every URL-carried key: the hash's or the default. |
| B3 | `store.readUrl` | `isSortKey` used `in`, which walks the prototype: `#?sort=toString` passed and the first render threw. Same pattern on `P_SORTS`. | `Object.hasOwn` in both places. |
| B4 | `store.readUrl` | Filter ids were not checked against the data: `#?lead=nobody` filtered the grid to nothing under "Aktive Filter: keine", with no chip to remove. | Each list is intersected with the data's ids. |
| B5 | `store.readUrl`, `app.js` `period` | `from=` was accepted unclamped, so an offset past the end left «Zurück» enabled with a first click that only found the edge. | Clamped to the horizon on read; the step starts from the clamped offset. |
| B6 | `store.load` | `data.projectsByLead` was indexed once at boot. The picker and the rebooking move a lead, so unsaved edits were attributed to the former lead and the person table went on counting the old project. | The index is derived per change of state (`projectsOf`); the two actions call `touch()`. |
| B7 | `views-analysis.js` card menu | Every row of a dashboard card's menu dispatched the card id as an export format, so «Als CSV exportieren» and «Link teilen» both produced an Excel file. | A local table of `{ label, act, val }`; the labels no longer come from `dashboard.json`. |
| B8 | `views-overview.js` Auslastung row | The tooltip paired the period's average with the absolute figures of its first quarter, so a year column mixed the year with its Q1. | All three figures are the period's average. |
| B9 | `views-docs.js` capacity row | The bar-plan sheet printed the first quarter's utilisation for a period; the pensum sheet printed the average. The row also had no column template, so it did not line up once a second lead column was on. | `periodValue`, and the row carries the layout's template and span. |
| B10 | `tools/generate-portfolio.js` credit by year | The buckets looked for SIA phases `52`/`51`, which the ePPM chain no longer has, so every project fell into "2029 und später". | The bucket reads phase `5`. The dashboard shows 2026: 371.9 Mio., 2027: 108.1, 2028: 44.1, later: 405.6. |
| B11 | `tools/generate-portfolio.js` change log | The weekday was tested on the local date and the stamp written from the UTC one, so east of Greenwich every entry landed a day early — 36 of them on a Sunday — and the file depended on the machine's time zone. | UTC throughout. The histogram is now Monday to Friday, with one hand-written Saturday from the seed. |
| B12 | `pdf.js` | Every page's `/Parent` pointed at the Catalog rather than the Pages tree. Viewers render it; validators flag it. | `/Parent` is the tree. |
| B13 | `app.js` `moveOption` | Roaming started from the first option that was focused *or* selected in DOM order, so ArrowDown could jump back above the focus. `roam` from outside the list with ArrowUp landed on the second-to-last item. | Focus first, selection as entry point; from outside, ArrowDown enters at the top and ArrowUp at the bottom. |
| B14 | `app.js` `modalReturn` | The return-focus key was overwritten while the picker was open, so after a pick focus dropped to `<body>`. | The guard includes `picking`. |
| B15 | `app.js` `flash` | The exit timer was anonymous, so a toast arriving during the previous one's fade was wiped 160 ms later. | Both timers tracked; the exit checks it is still its own toast. |
| B16 | `store.kpis` | «Personen über 100 %» counted by pensum points but sorted and captioned by utilisation; for a part-time lead the two disagree. | Counted, sorted and captioned by utilisation, as the Ampel and the bell count it. |
| B17 | i18n | Three strings skipped `t()`: a person's role in both pickers, the next milestone's name and status in the project dialog, the unit on the sheet's meta line. | Translated. `aufsteigend`/`absteigend` added for the sort headers. |

## 2. Risks and robustness

| # | Where | Change |
|---|---|---|
| R1 | `columns.js`, `store.js` | Lead, portfolio and organisation lookups guard against an unknown id with a stand-in instead of throwing inside the render. |
| R2 | `views-modals.renderModal` | A builder that finds nothing (a deleted gate) returns nothing; the shell no longer renders an empty dialog whose label points nowhere. |
| R3 | `ui.tokenPx` | A misspelled token throws instead of caching `NaN` into a grid template for the life of the page. |
| R4 | `app.js` `export-pdf` | A failed import or writer error is reported with the same toast the spreadsheet export uses, instead of an unhandled rejection. |
| R5 | `app.js` `share-copy` | «Kopiert» only when the clipboard accepted; a refusal leaves the link selected and says nothing it cannot vouch for. |
| R6 | `app.js` popovers | The editor and the picker re-read their anchor off the cell about to be replaced, so a resize or a column toggle no longer leaves them floating where the cell used to be. |
| R7 | `views-overview.js` editor | The "would be over 100 %" test asks `personUtilisation(id, q, delta)` instead of converting pensum to utilisation by hand — the duplication `DECISIONS.md` forbids. |
| R8 | five sites | "Now" is `nowIndex()` from `meta.todayQuarter`, no longer the literal `0` that happened to be right because the horizon starts today. |
| R9 | `store.sortKey` | A period column sorts by the average it displays; at year scale it used to sort by its first quarter. |
| R10 | `pdf.js` | Eleven more accented Latin-1 letters measure at their base letter's width instead of a space's. |
| R11 | `tools/generate-portfolio.js` | A seed gate whose generated counterpart falls outside the window is reported on the console rather than dropped in silence (two of eleven today). |

## 3. Accessibility

| # | Change |
|---|---|
| A1 | Under the figures a phase bar is a `<span aria-hidden>`; it used to be an unreachable `<button tabindex="-1">` announced ~500 times a grid. |
| A2 | Menu roaming skips disabled items (`:not(:disabled)`), so ArrowDown no longer stalls on a greyed switch. |
| A3 | A sortable header's name carries the direction («, aufsteigend») while it is the sorted column; the arrow alone was `aria-hidden`. |
| A4 | `segmented()` takes an accessible name. |
| A5 | Both person lists share one control: a combobox search wired to an id'd listbox, the empty state outside the list, `is-on` for the selection in both. |

## 4. Performance

| # | Change |
|---|---|
| P1 | `setState` counts changes; `filteredProjects()`, `periods()` and the per-lead index are memoised on the counter. `filteredProjects()` was filtered and collator-sorted four to six times per render; `allPeriods()` was rebuilt at least four times per render plus once per group card, parsing `new Date` 120 times at month scale. `touch()` covers the two writes that bypass `setState`. |
| P2 | Dropdown bodies are thunks, built only while the menu is open. Every closed menu was rendered and discarded on every render; the lead menu alone drew forty rows per keystroke. |
| P3 | The over-capacity test per cell asks a per-person cache (one pass of 40 quarters per lead) instead of `personUtilisation → personLoad → loadDelta` per cell — about 5,300 calls per render before. |
| P4 | `totals()` filters the pre-credit projects once instead of inside the 40-quarter map. |

## 5. Complexity and duplication

| # | Change |
|---|---|
| C1 | `ui.popoverPosition()` replaces two copies of the anchor/flip arithmetic (editor, picker). |
| C2 | `ui.personOption()` / `ui.personSearch()` replace the row and search markup written twice (picker, rebooking dialog). |
| C3 | `views-schedule.planLegend()` replaces three legend builders (grid, pensum sheet, bar-plan sheet) that rebuilt the same groups and filtered the bar groups by their German label. |
| C4 | `store.compareDe` replaces the second `Intl.Collator`. |
| C5 | `store.OVERLAYS_CLOSED` replaces nine hand-spelled closing patches with differing subsets; a dialog can no longer open over a live popover. |
| C6 | `flash(message, patch)` lets an action commit and report in one render; `pick` and `rebook-apply` rendered twice, once with the old lead. |
| C7 | `ganttRow` hoists its placement out of an inline IIFE and finds the open-ended bar once. |
| C8 | Removed: `milestoneStats`, `suppressUrl`, the `afterQuarters` flag, the `t(b.milestone)` title, the `column` import, `stageOf`, `dayIn`, `QUARTER_END`, `OPEN` re-created per loop, `unitSuffix`/`ampel` imports in the sheet, the unused third argument of `sheetCell`, a hard-coded span of 5 (now `span`). |
| C9 | Stylesheet: 15 rules with no producer removed (`.gantt__overlay`, `.gantt__today*`, `.gantt__card`, `.gantt__scroll`, `.gantt__group`, `.gantt__body`, `.sheet__mark`, `.modal__foot-left`, `.btn--danger`, `.btn--toggle`, a stale `.timebar` selector); the bar-plan column rule names `organisation`/`credit` instead of the removed `priority`/`nextMs`; one overridden `box-shadow` dropped. 18 tokens defined but never referenced removed from `tokens.css`. |

## 6. Deferred, with reasons

| # | Finding | Why not now |
|---|---|---|
| D1 | Timer-driven renders (toast exit, search debounce, resize, share reset) can land between `pointerdown` and `click` and swallow the click. | Real but rare; the fix is a pointer-down latch around every timer render, which touches the render loop's contract. Worth its own change with a test. |
| D2 | The spreadsheet export writes percent points whatever `state.unit` says, while claiming to export what is on screen. | A product decision: convert, or state the unit and drop the claim. |
| D3 | The PDF writer never clips to `overflow: hidden`, so ellipsised names may print in full. | Consequence inferred, not observed; needs a rendered PDF to confirm. |
| D4 | `hideZeros`, the column set, `footDetails`, `pSort`/`pDir` and `collapsedGroups` never reach the URL. | Known gap since review 3; `zoom` now written. Deciding what a shared link should carry is a design question. |
| D5 | Two file-naming conventions (PDF vs CSV/XLSX). | Cosmetic; one helper once the export unit question is settled. |
| D6 | `menuPanel()` is bypassed by three hand-rolled panels. | Cosmetic. |
| D7 | Stale comments in `views-docs.js` (formats, row counts) and the generator's header. | Partly reworded; the rest is prose. |
| D8 | Several exports have no importer (`unitAt`, `placeBars`, `VOCAB`, …). | Kept: they are the module's stated API and cost nothing. |
| D9 | The `data/` files are written with CRLF by the generator while the working tree is LF. | Repository convention (`core.autocrlf`), not code. |

## 7. What was verified

Served with `python -m http.server`, driven headless. A script imported the
store and checked, in one page: a tab change pushes and Back returns
(`tabAfterBack=overview`); a bare hash resets a filter (22 rows → 111);
`lead=nobody`, `sort=toString`, `from=999` fall back (`[]`, `project`, 24);
a pick moves the lead and the old index no longer holds the project; in the
combined view the band has 463 bar spans and 246 gate buttons and no bar
buttons; the editor opens and keeps its position across a re-render; the
Termine view greys two switches in the menu. All five pages boot with their
content; the print layout renders 41 and 61 sheets for the two views tried.
