# Code review 3

Whole-repository review, 27 August 2026. Eleven expert lenses over ~6,400 lines
of JavaScript, 2,900 lines of CSS and the fifteen documents that were in `docs/`,
each finding then put to a reviewer whose brief was to refute it. Numbers below
are measured, not estimated; where a figure appears without a measurement it is
marked as such.

Earlier rounds: `docs/archive/CODE-REVIEW.md`, `docs/archive/CODE-REVIEW-2.md`.

---

## What held

Worth recording, because two rounds of work paid for it:

- **The escaping layer.** A full-payload sweep of every label in `data/` through
  `html` found no injection. One deliberate hole existed and is now closed — see
  below.
- **The URL boundary.** 27 hostile hashes were rejected without a throw.
- **The module graph.** Acyclic and correctly layered; `store.js` imports nothing.
- **`columns.js`.** The registry genuinely collapsed six duplicated column lists
  into one declaration. It is the piece of this codebase most worth copying.

## The three causes

Fifty findings came down to three.

### 1. A quantity with no owning function

A person's load was derived four times by three different rules, and the unit was
written down nowhere.

`person.baseLoad` is in **pensum points**. `loadDelta` converted its delta to
utilisation points before adding it, and `personUtilisation` then divided by the
contract a second time. For the nine part-time leads every edited figure was
wrong: an 80 % lead taking on 20 more points read **138 %** where 131 % was
right — over the threshold, which armed the mandatory-reason gate on a cell that
was not over capacity.

`personRows` bypassed the accessor entirely and read `baseLoad` raw, so
Dashboard → Personen and the Übersicht ampel reported **170 %** and **220 %** for
the same person in the same session.

*Fixed.* One unit in, one division out, in `personUtilisation` and nowhere else.
Both figures now agree; the 80 % case reads 105 / 131.

### 2. An unwritten survival contract for the re-render

`#app` is rebuilt into `innerHTML` on every state change. Focus and vertical
scroll were carried across it. Nothing else was, and each feature discovered that
separately:

| | measured |
|---|---|
| Horizontal scroll | 500 → 0 on every render, in all four scrollers and the mobile toolbar |
| The PDF button | `el.disabled` set on a node the next render replaces |
| The PDF writer | sheets collected *before* an `await`; a render inside that window handed it detached nodes — 12,371 bytes, 0 text operators, page box `[0 0 0 0]` |
| Open dropdowns | closed on `pointerdown`, detaching the element under the finger, so the browser produced no `click` at all and the first click on any of nine controls did nothing |

*Fixed*, all four. Horizontal scroll is now carried and deliberately dropped when
the scale or the window offset changes, because then the axis is a different
axis. The list of what must survive a render is written down in
`ARCHITECTURE.md`; that, rather than the four fixes, is the durable part.

### 3. Gate placement rounded where it should not

Every one of 390 milestone diamonds was drawn on the wrong date, by up to **2.97
columns** at month scale — a gate skipping all three months of its own quarter.
`unitAt` matched on a period's `quarters` list where its sibling `todayFraction`
already read `from`/`to`; a month column carries `quarters: [5]` but spans a
third of quarter 5, so the test `q <= 5` rejected every fractional position.

Separately, gates outside the visible window were pinned to its right edge rather
than dropped: 136 of them at quarter scale, 252 at month, stacked there claiming
dates they do not have.

*Fixed.* Placement error is now 0 at all three scales, measured over all 390.
A short bar whose padding exceeded its own width was found in the same pass and
fixed with it.

---

## Everything else that was fixed

| | |
|---|---|
| Export render | Two loop invariants: `projectDemand` rebuilt a 40-element array on each of 40 iterations, and `totals()`/`activeFilters()`/`sheetColumns()` ran once per sheet where once per run was needed. **657 → 526 ms** at month/lead, **275 → 163 ms** at quarter/portfolio. Equivalence proved over 4,440 value pairs. |
| The pager | `state.page` was clamped on read but not on write. Nine clicks on a four-page log left it at 10, and the next six “previous” clicks were dead. Now clamped at the write and stepped from where the reader actually is. |
| The `N weitere` control | Pointed at `#card-people`, an element deleted with the person card it belonged to. Silent no-op. Now switches to the Personen section. |
| Pensum edits | The popover demanded a justification and the banner promised a record; `apply()` threw the reason away and logged nothing. Now logged like every other edit. |
| Empty export scope | The download button stayed enabled over a report with no sheets. Now disabled. |
| CSV formula injection | Quoting does not defuse a leading `= + - @`. Text cells that open with one are now tab-prefixed. |
| XLSX | Element escaping was used in an attribute (the worksheet name); a non-numeric value went straight into `<v>`, which makes Excel refuse the workbook. Both fixed, and the sheet name is normalised to Excel's rules. |
| `raw()` in an attribute | One of eighteen calls passed a data value into an attribute fragment. Removed rather than escaped. |
| Filter chips | No width ceiling: a 400-character search token pushed the document 1,149 px sideways. Now clipped. |
| Dead code | `personCard` and its lint pragma for a linter this project does not have, the `scroll-to` action, `quarterPeriods`, `yearBreak`, eleven unused imports, and a `.replace(' Mio.', ' Mio.')` whose pattern and replacement were identical. |
| `visibleChanges` | Moved from the view into the store — it filters data, and the pager needs its length before the view is built. |

---

## Deliberately not done

The reviewers proposed these and they were declined. Recorded so the argument is
not had twice.

- **Splitting a `summaries.js` out of `store.js`.** Moves 155 lines across a new
  module boundary and removes no defect.
- **Lifting `VOCAB` to `{id, label}` so menus derive from it.** Would move German
  UI strings into `store.js`, which is layer 0 with no imports. The inverse of
  the rule that caused finding 1.
- **Merging the three grid renderers**, the five sum-row implementations, the two
  legends, the two person pickers. A row is a run of numbers, a bar track, and a
  sheet laid out in millimetres. The shared part is already `columns.js`; what
  remains differs in more than three parameters.
- **The CSS sweeps** — 12 unreachable tokens, 11 raw border widths, 16 dead
  selectors. All verified, none observable.
- **Reducing the printed sheet count.** 271 A4 pages is nobody's print job, but
  covering the whole plan at every quarter block is a recorded decision; the
  answer to a ten-year plan on paper is A0, not a shorter report.

## Still open

- **Step 8, one writer for the URL and one owner for history.** `writeUrl`
  enumerates its keys by hand and omits `zoom`, `cols`, `pSort` and `pDir`, so
  “share this view” does not carry a column choice. Worse, `setState` calls
  `writeUrl` — which `replaceState`s the target URL over the entry being left —
  before the listeners, and a subscriber then `pushState`s the same URL: three
  tab clicks produce `history.length` 11 → 14, and every second Back press is
  dead. Measured, not fixed: it is a rewrite of the history layer rather than a
  patch, and it wants its own pass.
- **The `%` in every cell.** `4415 %` is the widest thing the sum row carries and
  the reason the month column was widened; the printed report already writes the
  number bare and names the unit once in its subtitle. Bringing the screen into
  line with the paper would save 14.5 px per cell in `%` and 24.1 px in FTE —
  more than any abbreviation — and is the only option that also fixes FTE, where
  `100,00 FTE` still overflows.
- **Swiss number grouping.** The app groups with an apostrophe, which is cantonal
  practice. The Bundeskanzlei Schreibweisungen Rn 512 prescribe a fixed space and
  call the apostrophe obsolete, and Rn 513 leaves four-digit numbers ungrouped
  unless the same table carries five-digit ones. Kept deliberately; the comment
  at `js/store.js` now records the conflict instead of misciting the source.
- **`unitSuffix()` returns a normal space** before `%`. Rn 554 requires a fixed
  space, and gives this exact wrapping as the reason. Not changed, because
  U+202F and U+2009 are not encodable by the PDF writer and would print as `?`.

## How this was checked

Every fix above was measured before and after in a Playwright harness that is
**not committed** — see the note in `README.md`. The suites are `flow.js` (60
behavioural checks), `smoke.js`, `audit.js` (contrast, accessible names, target
sizes), `resp.js`, `robust.js` (17 malformed-input cases), `overflow.js` (ten
paper × orientation × report combinations) and `barlabel.js`. All pass at the
time of writing.
