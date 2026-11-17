# Code review — November 2026

**Date:** 16.11.2026 · **Role:** senior developer · **Baseline:** the tree after
the feedback round (roles as rows, direct editing, fixed groups — see
[`ROLES.md`](../ROLES.md)).

**Scope:** all twelve modules in `js/` (about 7,400 lines), `css/main.css` as
far as the modules reach into it, `index.html`, `tools/generate-portfolio.js`
and the fixtures in `data/`.

**Brief:** bugs and errors first; then anything that makes the code simpler,
sturdier or easier to change — in particular similar code that can become one
function.

## How it was done

Three readers. The core — `store.js`, `app.js`, the Planung and Personen
views, the dialogs, the column registry — was read by the author of the
feedback changes. `ui.js`, the print layout and the bar plan were read
independently by a second reviewer, and the export, the PDF writer and the
generator by a third, each without the first reader's conclusions. The third
ran the exports for real — in headless Edge, the files parsed in Node and
opened in Excel, the PDF pages rendered beside a screenshot of the same
sheet — and ran the generator only in a scratch copy.

Nothing in this document is here on a reviewer's word alone. Every finding
was traced in the code by a second pair of eyes, and where it shows on screen
it was reproduced in a headless browser before it was fixed and checked again
after. Where a finding rests on a measurement — the pagination, the row
heights on paper — the measurement is given, and whose it is.

## Result

The codebase is in good order: small modules in an acyclic graph, one state
object, derived figures in one place, and comments that give reasons. What the
review found is mostly at the seams — focus after a re-render, the print
layout, strings that never met the translation file — and in what two rounds
of removed features had left behind.

| | Found | Fixed | Left open |
| --- | --- | --- | --- |
| Bugs | 37 | 37 | — |
| Leftovers of removed features | 15 groups | 13 | 2 |
| Duplication | 13 | 11 | 2 |
| Robustness | 12 | 8 | 4 |
| Product and documentation questions | 10 | — | 10 |

Sections 1 to 5 cover the app's own modules; section 7 covers the three
writers — CSV, Excel, PDF — and the generator, which were read last.

One thing was added that the repository did not have: a check it can run on
itself, [`tools/check.mjs`](../../tools/check.mjs). It is described at the
end; it found its first two missing translations on its first run.

---

## 1 · Bugs

All fixed. «New» marks a bug in code written during the feedback round; the
others were in the tree before it.

### Keyboard and focus

The app replaces the whole page on every change of state and finds the
focused control again by a key. Four controls could not be found again, and
three could not be reached at all.

| # | Where | What happened | Fix |
| --- | --- | --- | --- |
| B1 | `index.html`, `app.js` `hashchange` | The skip link «Zum Inhalt springen» sets the hash to `#main`. Read as an address of the app it has no parameters, so every one fell back to its default: Tab, Enter on a filtered Personen tab landed on an unfiltered Planung tab. | A hash that does not start with `#?` is not the app's; the state's own address is written back. |
| B4 | `ui.js` `rowCaret` | The caret and the row around it dispatch the same action with the same value. Found by those, the row came first — a `div`, which cannot take focus — so folding a row by keyboard dropped focus to `<body>`. | The caret carries a focus key of its own. |
| B5 | `app.js` `restoreFocus` | «Zu heute», «Weiter» at the end of the plan and the pager on its last page disable themselves with the press that reaches the edge; a disabled button cannot take focus back. | Focus goes to the next enabled button of the same group. |
| B6 | `ui.js` `sortableHead` | Each group card repeats the column header, so each sort button exists three times. Focus returned to the first card whichever card was used. | The sort button's focus key names its group. |
| B7 | `ui.js` `segmented`, `bulkLinks` | Time scale, unit and «Alle · Keine» were plain buttons inside a menu. The arrow keys roam menu items only and Tab closes a menu: the time scale could not be changed from the keyboard at all. | They are menu items (`menuitemradio`, `menuitem`) and the groups have names. |
| B14 | `app.js` `captureScroll` | The person filter lists fifty names in a 214px box. Ticking one re-rendered the menu at the top of the list, every time. | A menu that stays open across a render keeps its scroll position. |
| B18 | `views-overview.js` `laneCell` — new | At month scale three columns show one quarter. Named by the quarter, all three were one cell: Tab from the first month landed on the first month. | A cell is named by its column. |

### Print layout

| # | Where | What happened | Fix |
| --- | --- | --- | --- |
| B2 | `views-docs.js` `paginate` | The paginator broke first and repaired afterwards, and the repair missed two cases the default portfolio hits. On A4 landscape the heading «(Kredit offen)» closed a sheet with no row under it; in other selections a sheet opened on a bare project row and a sum, without heading or column head. The second reviewer replayed the paginator in Node over 4,271 selections on A4 portrait: 108 stranded headings, 258 headless sheets. | Rewritten to look ahead: a row goes onto a page only if what must stand under it still fits. No repair pass. The same replay gives 0 defects in 102,570 selections across all ten formats and three reports; eighteen rendered combinations — three reports, A4, A3 and A0, both ways round — were checked in the browser: every sheet opens on a heading and its column head, none ends on one, none runs into its legend. |
| B17 | `main.css` `.sheet__gantt` | In the Termine report the attribute columns kept the screen's 38px line height. Switching one on — «Bearbeitende» is enough — made every row 39px where the page budget counts 26: an A4 landscape sheet measured 852–864px against 794px of paper. | The columns take the sheet's type size and line height. Measured after: 26px rows, 794px sheets. |
| B8 | `views-schedule.js` `ganttRow` | The printed bar plan drew bars and gates whatever the «Ebenen» switches said; with the milestones off on screen, the sheet printed them, legend entry included. | One function places the marks for the band and for the bar-plan row, and takes the layers (see D5). |
| B11 | `views-docs.js` `sheetColumns` | The sheet's column list dropped the registry's `short` form, so a 70px «Organisation» column printed three different units as the same clipped name. | `short` is carried over. |
| B16 | `views-docs.js` `ganttAxisHead` | «Kredit CHF» stood left-aligned over right-aligned figures in the printed bar plan. | The heading takes the column's alignment. |
| B12 | `views-docs.js` `GLOSSARY` | The method sheet defined «Pensum» twice, differently. | The second entry is «Projektpensum». |
| B10 | `views-schedule.js` `planLegend` | The legend explained two hatchings — «Verzug» and «ohne Bearbeitenden» on a bar — on every screen and sheet. No bar in the data has either state (0 of 331). | The legend asks the data; see O2 for the code behind those states. |
| B9 | `views-schedule.js` `planLegend` | The legend strips its own heading from the thresholds sentence with a German pattern, after translating: in English it read «Utilisation Utilisation: over capacity …». | The pattern strips whatever stands before the colon. |

### Translations

| # | Where | What happened | Fix |
| --- | --- | --- | --- |
| B15 | `views-docs.js`, `ui.js`, `data/` | Some thirty German strings reached `t()` with no entry in `i18n.json` — most of the method sheet, the print toolbar («Hoch», «Quer», «Anpassen», «Format»), the search placeholder, «Sprache», three of four milestone states, the unit's name. They stayed German in every language. | Entries added in EN, FR, IT. The check now finds strings handed over by name as well as literals. |
| B20 | `store.js` `activeFilters` | A filter chip's label was built in German and translated by each caller. A phase's chip, «Phase 31 Vorprojekt», is a string no entry can match and stayed German everywhere; the spreadsheet export did not translate at all. | `activeFilters()` returns labels in the reader's language; the callers print them. |

### Everything else

| # | Where | What happened | Fix |
| --- | --- | --- | --- |
| B3 | `views-docs.js` `mountSwagger` | The «already mounted» flag sat on the node the next render replaces. Any render on the API tab — a menu opening, a resize — rebuilt Swagger UI from the spec and folded shut what the reader had opened. A failed load was cached and could not be retried. | The mounted node is kept and put back in place of the fresh one; a failure is not kept. |
| B19 | `ui.js` `tokenPx`, `app.js` | Layout tokens are cached on first read and the cache was cleared on a change of time scale, which no token depends on. One token does change — the shell's inset, at the 1440px breakpoint — so a window resized across it kept laying the grid out against the old inset. | The cache is cleared on resize. The `data-scale` attribute nothing read is gone. |
| B13 | `views-docs.js` `renderApi` | «Zurück» on the API page dispatched the brand link's reset and cleared every filter. | It goes back to the Planung tab. |
| B21 | `app.js` `signin` | A failed reload of the fixtures on signing in was an unhandled rejection behind a button that did nothing. | Caught and said. |
| B22 | `app.js` `commitPerson` — new | The underline that marks a cell edited this session is keyed by row. When a row was given to another person the marks stayed under the old key and showed on the next empty row of that role. | The marks move with the row. |
| B23 | `icons.js` `loadIcons` | The comment promises a missing icon never takes the app down. The manifest was fetched outside any guard, so a missing `icons.json` failed the boot, and a 404 page was registered as an empty icon. | Both fetches check the status; a failed manifest leaves the app without icons, not without itself. |

---

## 2 · Leftovers of removed features

Two rounds of feedback removed the grouping menu, the pensum popover, the
person dialog and the «Rollen» column. All "unused" claims were checked with a
repository-wide search.

| # | What | Where |
| --- | --- | --- |
| L1 | The popover's and the person dialog's styles: sections «Edit popover», «the cell being edited», «the Bearbeitender picker», `.rebook*`, `.personedit*`, `.rchip*`, `.btn__prefix` — about 300 lines | `main.css` |
| L2 | `ampel()`, `milestones()`, `personDraft()`, `staffCandidates()`, `groupPeople()` and the `now` field of `personRows()` — no caller | `store.js` |
| L3 | The actions `sort` and `sort-dir` (the sort menu went long ago), `open-person`, `person-save`, `group`, and the state key `picking`, which was written and never declared | `app.js` |
| L4 | `popoverPosition()`, `personOption()`, `personSearch()`, `columnChart()` | `ui.js` |
| L5 | Seven icons fetched at every boot and never drawn | `icons.json`, `ui.js` |
| L6 | Options nobody passes: `dropdown({ cls, title })` and its `data-menu` attribute, `exclude` threaded through three functions, `icon()`'s `stroke` and `cls` | `ui.js`, `icons.js` |
| L7 | Twenty-seven entries nothing reads | `i18n.json` |
| L8 | Guards for a grouping without headings (`if (group.label)`), an unused `const q`, `--gantt-lead` set twice and read nowhere, a `row.cost` no row has | `views-docs.js`, `main.css` |
| L9 | Comments describing what is gone: the editor under a bar, «grouped by lead», a dismissible notice, a second search field, «the group trigger» | several |
| L10 | Links to `DECISIONS.md`, `CONTRAST-REVIEW.md`, `CODE-REVIEW-3.md`, `PLANUNG-MERGE.md`, `DASHBOARD-STUDY.md` — none of which exists | `README.md`, `ARCHITECTURE.md`, `DATAMODEL.md` |
| L11 | A paragraph «Known gap: `writeUrl` omits several keys and the history layer double-pushes». Both were checked: every URL-carried key is written and read back (the check now asserts it), and a push fires no `hashchange`. | `ARCHITECTURE.md` |

Left: **L12** — optional parameters with no caller on six small helpers in
`ui.js` (`pageActions({ extra })`, `chip({ removable })`, `pillSwitch(on, tone)`,
`meta` on the three menu items). Harmless, and removing them touches every
call site for no behaviour.

---

## 3 · Duplication merged

| # | Was | Is |
| --- | --- | --- |
| D1 | The four list filters — phase, person, portfolio, organisation — were enumerated in **seven** places in three files: URL validation, URL read, URL write, the chips, their removal, the reset, and «Alle». A fifth filter meant finding all seven. | `FILTERS` in `store.js`, one entry per filter: kind, state key, URL parameter, ids, name. Everything reads it; the four toggle actions are generated from it. |
| D2 | Three toolbar menus written out in full, differing in four words. | `filterMenu(kind, …)` and `bulkLinks()` in `ui.js`. |
| D3 | «Pensum points as FTE» formatted in four places, two of them without thousands grouping. | `fmtFte()` in `store.js`. |
| D4 | `logChange()` and `logSetting()`, the same eight lines apart from the project. | `logEntry()`, with the two as one-line callers. |
| D5 | Bars and gates placed on a time axis twice — for the band under a pensum row and for a bar-plan row — and only one of the copies honoured the layer switches (B8). | `trackMarks()` in `views-schedule.js`. |
| D6 | A registry column's plain cell rendered in the planning grid and in the bar plan, disagreeing about the dash for an empty value. | `plainCell()` in `ui.js`. |
| D7 | The sheet's sender block and its foot, each written twice. | `sheetSender()`, `sheetFoot()`. |
| D8 | The caret and its cell, written out in both folding tables. | `caretCell()`, `rowCaret()` in `ui.js`. |
| D9 | The list of paper sizes, spelled three times. | `VOCAB.paper`. |

Left: **D10** — three menus in `ui.js` (language, account, export) build
their panel by hand where `menuPanel()` exists, and the account menu uses
`.dd__sep` where `divider()` emits `.dd__divider`. Cosmetic; a change there
wants a look at each menu in the browser.

---

## 4 · Robustness

| # | What | State |
| --- | --- | --- |
| R1 | «Now» was index 0 in four places — the heading that marks the current quarter, «Zu heute», the today line, the person table — although `nowIndex()` exists and the data model says no view may count on the window opening today. | Fixed: `nowIndex()` and a new `todayOffset()`. |
| R2 | A cell half typed into was lost by any render that happened meanwhile — a toast fading, a window resized. | Fixed with the editing itself: the typed text is carried across the render like the caret is. |
| R3 | Nothing verified the fixtures or the model. A generator change that broke an invariant showed up, if at all, as a wrong number on screen. | Fixed: `tools/check.mjs`, and the generator now refuses to write rows that do not add up to the demand. |
| R4 | The bulk action and the chips named a filter two ways in the markup (`phases` and `phase`). | Fixed: one name. |
| R5 | Icons: see B23. | Fixed. |
| R6 | `VIEWS`, `LAYERS`, `SCALES`, `ORIENTATIONS`, `ZOOMS` in `ui.js` and `views-docs.js` repeat the ids of `VOCAB` beside their labels. A value added to one list is silently missing from the other. | Open. Wants `VOCAB` derived from the labelled lists, which moves them into `store.js`. |
| R7 | The pixel constants the bar labels are measured with (`BAR_PADDING`, `GATE_CLEAR`, the fan-out step 13) mirror the screen stylesheet only; the sheet overrides the sizes, so labels on paper are judged conservatively. | Open. No wrong output found. |
| R8 | `raw()` into `style` attributes for grid templates, which `ARCHITECTURE.md` advises against. | Open. Every value is a number from the registry or a token; not exploitable. |

---

## 5 · Open questions

None of these is a defect in the code. Each needs a decision from whoever
owns the product.

- **O1 — No reason, and no warning, when a pensum puts a person over their
  ceiling.** The popover asked for a reason on overload and on handover and
  said what the person would stand at. The cell asks nothing. Verlauf records
  what changed, not why. If the reason matters to the office, it needs a
  place that is not a popover — a note field on the row, or a prompt only
  when the figure crosses 100 %.
- **O2 — Delayed and open-ended bars are code without data.** `bar.delay`,
  `bar.openEnd` and `bar.unassigned` are drawn, styled and explained in a
  dialog, and the generator writes none of them. Either the fixtures show a
  delay again, or about 60 lines in `views-schedule.js`, `views-modals.js`
  and `main.css` can go.
- **O3 — A typed pensum is any whole number from 0 to 200.** The fixtures
  are steps of five and the stepper moved in fives; the cell takes 7, and
  clamps 250 to 200 without saying so.
- **O4 — A person's contract and own project share cannot be edited any
  more.** The person dialog was the only place. The unit's share is still a
  setting.
- **O5 — The skip link, the page title and the boot message are German in
  every language.** They are static text in `index.html`, outside the app's
  translation.
- **O6 — What the check cannot see.** `tools/check.mjs` runs without a
  browser, so it does not render. The pagination, focus and layout findings
  above were verified with a throwaway harness driving headless Edge; it is
  not in the repository. Committing a small one — twenty assertions on the
  rendered page — would have caught B1, B2, B4–B7 and B17.

---

## Since the review

Three further rounds of feedback came after this document was written, and
they overtake some of it. The findings stand as a record; this is what no
longer applies.

- **Roles and people are read-only.** Who holds a role is master data from
  SAP ePPM; the grid lets the pensum be typed and nothing else. The person
  list, «Weitere Person», `commitPerson()`, `addLane()`, `reassignLane()` and
  `pruneLanes()` are gone, and with them B22 and the part of the check that
  exercised those writes — it now asserts that the store has none.
- **No mark on a changed cell.** The underline B22 was about is gone
  altogether.
- **«Bearbeitende» is a count** on a project row, on screen and on paper,
  which settles B37 another way. The column sorts by it.
- **The project dialog is four facts and «In SAP ePPM öffnen»**, reached
  from the project's name again. The band per role, the forty quarters and
  the log are gone from it. A person's name opens a dialog of the same size,
  with «Im Admin-Verzeichnis öffnen»; it shows the contract and the project
  share and edits neither, so O4 stands.
- **Personen** lost «Rollen» and «Spitze», gained a «Projekte» count that
  heads the project names of an open row, lists a role and a project name
  per row and nothing else, and opens in the order of the names. Its pensum
  cells are the same fields as on Planung — one renderer, `laneCell()`, and
  one write, `commitCell()`, for both tabs.
- **The first column says what folds out:** «Projekt / Rolle» on Planung,
  «Person / Rolle» on Personen.
- **«Alle aufklappen»** replaced «Besetzung aufklappen».
- **The verification harness.** Late in the work it turned out that a
  headless browser left running by an earlier run was being picked up again,
  with its cache. The keyboard, focus, print, export and PDF scenarios were
  run again against a fresh instance with the cache off; none of those
  results changed. O6 stands, with that
  lesson attached: a committed harness has to start its own browser.

## 6 · The check

```
node tools/check.mjs
```

Node 22.7 or later, no dependencies, about a second. It loads `store.js` the
way the app does, with `fetch` answered from disk, and asserts:

- **the fixtures** — every row's role and person exist, a role and a person
  appear once per project, every per-quarter array has one entry per quarter,
  pensa are whole steps of five, gates and log entries point at real
  projects, a gate that is held has one date, the log is newest first and
  every entry in it changes something;
- **the derived figures** — a project's demand is the sum over its rows, a
  person's load the sum of theirs, the lead is who holds the first role now,
  the three groups hold every project exactly once;
- **the write** — a typed figure moves the project's sum and the person's
  load, an emptied row stays, and the store has no function that adds a row,
  removes one or changes its person;
- **the filters** — a person is found on every project they hold any role
  on, for all fifty people;
- **the URL** — a state written to the hash reads back the same; unknown
  values fall back; a link from before the fixed groups still opens;
- **the source** — every German string that reaches `t()` has an entry, every
  label in the data has one, every `data-act` in the markup has a handler.

On its first run it found «Format» and «Sprache» without a translation. The
strings of B15 came from the second reviewer's script, which looked for
labels handed to `t()` by name; the check does the same now.

---

## 7 · Export, PDF writer and generator

The three writers are structurally sound: the ZIP directory and every CRC are
right, the workbook opens in Excel without repair, the PDF's cross-reference
table and page boxes are correct, and every character the sheets print can be
encoded. The generator is deterministic — run twice in a scratch copy it
reproduced all seven files byte for byte. What was wrong is below; the
numbering continues from the sections above.

### The PDF writer

It walks the rendered preview and redraws it. Four things the preview shows
it did not draw, on every report.

| # | Where | What happened | Fix |
| --- | --- | --- | --- |
| B24 | `pdf.js` `drawElement` | A text node is whatever stood between two tags in the template, line breaks and indentation included. The browser collapses that; the writer counted every space as a glyph, found the run far wider than its box and squeezed it to fit. On the default A4 report 180 of 11,227 runs set below 90 % of their width — the group headings at 64 to 78 %, with a hole where the indentation was. | The run is collapsed as CSS collapses it. Measured after: 0 runs below 90 %. |
| B25 | `pdf.js` `drawElement` | `overflow: hidden` and `text-overflow: ellipsis` were ignored — the page stream had `clip()` and nobody called it. With all six columns on, 4,870 runs overran their cell by up to 130px and the columns printed over one another; in the bar plan 1,110 project names were cut mid-letter by the next cell's fill. | What the box clips on screen it clips on paper, and a name the screen ends in an ellipsis ends in one. |
| B26 | `pdf.js` `drawElement` | The amber rail that marks a row without a lead is an inset `box-shadow`, and shadows were not read: 80 rows of the default report lost their mark while the legend went on explaining it. | An inset rail is drawn. Counted after: 80. |
| B27 | `pdf.js` | Italics set upright — «Fortsetzung auf dem nächsten Blatt», the notice at the foot. | The two oblique faces of the standard fonts. |
| B28 | `main.css`, `pdf.js` `sheetsToPdf` | The page is as large as the sheet was rendered. With six columns on A4 portrait «Projekt-ID» and a group's credit sum wrapped, and 20 of 51 pages came out 850pt tall on 842pt paper. | The head cells and the figures stay on one line; the writer warns in the console when a sheet is not an ISO page. Measured after: 51 of 51 at 595 × 842. |
| B37 | `columns.js` | On paper the 112px «Bearbeitende» column cut «Dario Beispielmann +2» at its end, and the end is the count. | The printed sheets set the lead's short name wherever a count follows. Superseded the same day: the column shows the number of people and nothing else, on screen and on paper. |

### CSV and Excel

| # | Where | What happened | Fix |
| --- | --- | --- | --- |
| B29 | `export.js` `csvCell` | The CSV wrote the credit with a decimal comma «for de-CH». Windows set to German (Switzerland) uses a point, so 97 of 99 credits arrived in Excel as text. | The file carries no decimal at all: the credit goes out in whole francs under «Kredit CHF», and every other figure was a whole number already. The workbook keeps millions. |
| B30 | `export.js` `buildTable` | Under a filter the foot mixes the selection with the whole portfolio, and the file did not say which is which — a search matching nothing exported «Summe Total 0» above «Auslastung 112». | The labels carry «(Auswahl)» and «(Gesamtportfolio)», as the grid's do. |
| B31 | `export.js` `xmlText` | Characters XML 1.0 forbids went into the workbook. A search containing one — it arrives raw from the hash — and Excel refused the file. | Stripped. |
| B32 | `export.js` `csvCell` | The defence against a cell a spreadsheet would run was chosen by the column's type, not the value's: a string in a numeric column went out bare. | Only a real number goes out bare. |

### The generator and its data

Fixed in the generator and regenerated. `meta.json`, `people.json` and
`capacity.json` are byte for byte what they were; `projects.json` differs by
one flag; the figures the generator prints about its run are unchanged.

| # | Where | What happened | Fix |
| --- | --- | --- | --- |
| B33 | `creditByYear` | A funded project with no build phase in the window was filed under «2029 und später». Fifteen of the 23 projects in that row — 142.8 of 210.2 Mio. — were finished buildings already in operation. | They have a row of their own, «vor 2026»; the card keeps the rows in the order of the years. |
| B34 | milestones | A gate's plan date and forecast date were two independent draws, also where the gate is held: 215 of 226 gates marked «Termin gehalten» showed a forecast on another day, 110 of them earlier than the plan. Gates overlaid from the seed kept the random delay reason of the gate they replaced. | A held gate has one date; only a late gate carries a reason. The draws stay where they were, so nothing after them moved. |
| B35 | change log | Verlauf prints the file's order, and the file was not in date order — row 9 was 29.07., row 10 20.08. Seven entries read «5 % → 5 %». | Sorted newest first; a step that the floor would cancel goes the other way. |
| B36 | `bars[].continues` | The flag for a chain that runs on behind the window was set only where the last bar itself crossed the edge. One project's build ended exactly on it and was drawn as the end of the chain. | Set whenever the chain goes on. |

### Also done here

- **Robustness.** The generator's one self-check ran after every file had
  been written, so a failing run left on disk what it was refusing; files are
  now written after the check (R9). A shape with neither fill nor stroke, or
  a circle of no radius, wrote an empty path into the PDF — up to a hundred a
  report (R10). The CSV's byte-order mark was an invisible literal in the
  source; it is `\uFEFF` now (R11).
- **Duplication.** Two download helpers with opposite rules for releasing
  the object URL — ten seconds for the spreadsheet, none for the much larger
  PDF — are one (D11). Both writers recomputed how many columns stand before
  the time axis from live state; the table carries it (D12).
- **Leftovers.** A `legend` no writer read, with its import; an ellipsis
  stripped from project numbers that never carry one (L13). Statements in
  `tools/README.md`, `DATAMODEL.md` and `ARCHITECTURE.md` that the data
  contradicts: what the generator reads from `data/`, a landing page that
  does not exist, the counts of late and undated gates, a field left out of
  the bar's description (L14).

### Left

- **L15 — dead branches.** The PDF writer's ▲ branch cannot be reached: no
  text node on any sheet contains the character. The generator's header and
  eight comments describe an earlier version of itself, and `delete
  person.baseLoad` and the hire curve's first four entries do nothing. Four
  fields are written and read by nothing: `changes[].onLanding`,
  `projects[].priority`, `capacity.quarters` and `labels`,
  `dashboard.cardMenu`. Left because each touches the generator's draws or
  its seed, and wants a run of its own.
- **D13 — in the generator.** `peakWith` and `peakOf` are one calculation
  over two tables, and «round to five» is written out eight times. Merging
  them should not move the random stream; it was not run, so it was not done.
- **R12 — approximations in the PDF writer.** An en dash is measured as a
  hyphen and « » as a `w`, which skews the fit of a run by a pixel or two.
  `colourOf` reads any alpha above nought as opaque. On a sheet with six
  columns on A4 portrait some 360 runs still set below 90 % — the columns
  are narrower there than what stands in them.

### Open questions from this part

- **O7 — Excel drops the leading zeros of a Projekt-ID in the CSV.** 19 of
  111: «0792» becomes 792. The workbook keeps them, so the two files
  disagree. The cure — `="0792"` — is Excel's own syntax and spoils the file
  for everything else. Either the CSV is declared not for Excel, or it goes.
- **O8 — What the PDF still does not carry.** The federal logo on every
  sheet, the hatching of two legend swatches, and the chevron on a bar that
  runs on are images, and the writer has no branch for images. The logo
  needs embedding as an image object; not built.
- **O9 — `openapi.json` describes another model.** Its `Allocation.role` is
  a job title, not one of the four roles; its person is required, so an open
  role cannot be said; `Project.lead` is stored where the data derives it;
  `Project.location` is the sub-portfolio where the data's is an address.
  `DATAMODEL.md` now says so. The spec needs a revision of its own once the
  roles have settled.
- **O10 — The seed's stories have drifted.** Two hand-written log entries
  quote quarters the generator has since moved, their actor «Max Muster» is
  nobody on the roster, and one is dated a Saturday. On a handover the
  generator can also draw a project's own lead as its Stellvertretung — by
  reading; no instance in the data.
