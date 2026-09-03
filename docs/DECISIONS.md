# Decisions

Standing rules, one home. Each is one paragraph: the rule, why, and where the
code enforces it.

Harvested from eleven retrospectives written between the wireframe and August
2026. Those files are in `docs/archive/` and describe a data set and a layout
that no longer exist; nothing there should be cited as current. Two of them
contradicted each other for weeks, which is what fifteen unordered records with
no supersession convention produce. Hence this file: **a rule can now only be
contradicted once.**

---

## Build and code

**No bundler, no framework, no dependencies, no virtual DOM.** The whole point of
the prototype is that it runs from a static host with nothing installed. A build
step would have to be justified against that, and so far nothing has needed one.

**Identifiers, comments and commit messages in English; the interface in German.**
Mixing the two inside one file is what makes a codebase unreadable to whoever
inherits it. User-visible strings go through `t()` and live in `data/i18n.json`.

**Comments explain why, not what.** A comment that restates the next line is
deleted on sight. A comment that carries the measurement or the failure the code
exists to prevent is kept even when it is long — that is the part nobody can
reconstruct.

---

## Rendering

**The whole of `#app` is rebuilt on every state change.** No diffing. The two
consequences — CSS `animation` replays, CSS `transition` never fires on a state
change — are accepted, and mean **no animation may carry meaning**. An affordance
that only exists while a transition runs does not exist.

**Anything that must outlive a render lives in `state`, never on a DOM node.**
The list of what the render loop carries across is in `ARCHITECTURE.md` and is
the contract; extend it there rather than in a feature.

**`store.js` imports nothing** and returns facts, not instructions. It may say
“seventeen people are over 100 %”; it may not say which DOM id to scroll to. The
one time it did, the button was a silent no-op for months.

---

## The grids

**A column is declared once, in `columns.js`.** Six consumers read that one
declaration. There is no second list of columns anywhere, and there must not be.

**`id` is the floor of the yield order.** It has no visibility toggle and is
never dropped, at any width. Everything else can go.

**Grid lines mark years, not quarters.** A rule at every column boundary turns
the table into a mesh and hides the boundary that matters. Same rule in both
grids and in the printed report.

**Positions inside a time track are fractional, never rounded to a column.**
Rounding put 212 of 392 bars on top of one another at year scale and drew all 390
milestones on the wrong date. `unitAt` is the single place that answers “where
does this quarter fall”.

**A phase bar is neutral.** Colour on a bar means an exception — delay, no lead —
and nothing else. Phases are not colour-coded; a portfolio of eleven pastel
categories tells the reader nothing they were looking for. Tried again as a
«Farbe: Phase» switch in the September wireframe and dropped in review.

**The bar plan is a view of the Planung grid, not a tab.** The bars and gates
are a band inside the pensum row, drawn by the same code as the printed Gantt
row. A view is a name for a set of layers (`VIEW_PRESETS`); the four switches
stay for everyone else, and touching one turns the view into «Individuell» by
itself. `state.view` and `state.layers` are written together, never apart.

**The band derives its geometry from two numbers.** `--band-h` and
`--values-h`, on `.grid-card`, switched by the classes the view sets. Every
arrangement — figures over a strip, the strip alone at the bar plan's height,
no strip at all — is arithmetic on the pair. An earlier draft wrote each one
out as its own rule, and every new switch multiplied the ones already there.

**Assigning a person is a popover on the cell, and the pick is the commit.** A
single-select list has nothing to confirm; the change is logged like any
other. The list is ordered by free capacity, because capacity is why one name
is right and another is wrong. The rebooking dialog, which moves an amount
over a period, keeps its form and its button.

**The chrome above the grid is measured on a 1366×768 laptop.** One toolbar
row, no breadcrumb bar, no page title, gaps of 20 / 8 / 24px above the first
group heading (16 / 6 / 16 below 1440px). The figures behind each rule are in
the last three sections of `main.css`; change the number, keep the comment.

---

## Numbers

**A project's phase is the ePPM value; its schedule is SIA.** ePPM's phase
list is BBL's own — Vorstudien, 1, 22, 2, 31, 3, 32, 4, 53, 5, 61, 6 — mixing
SIA main and sub-phases, so `project.phase` is one of those and the filter,
the grouping and the column speak it. The SIA chain (`project.subPhase`, the
bars, the gates) is what the schedule is drawn from. The mapping between the
two is one table in `data/phases.json`, in ePPM's own order.

**Bedarf follows the filter; Auslastung does not.** A demand row describes the
projects in scope. Utilisation is always the whole department against its own net
capacity, because a filtered subset has no meaningful denominator. `totals()`
returns `scoped: true` when the two rows describe different populations, and the
view says so.

**A quantity has one owning function and one unit.** Pensum points in,
utilisation points out of `personUtilisation` and nowhere else. Four call sites
each doing their own conversion is how an 80 % lead came to read 138 %.

**A rate over several quarters is their average, not their sum** — `periodValue`.
A year is the average of its quarters.

**Red belongs to over-capacity alone.** “Now” is a position, not a problem; late
is marked with a triangle and black text, not with colour on its own.

**A gate is one plain diamond at its plan date.** Late and undated gates were
drawn red and hollow; a hundred diamonds in three states read as a status board
laid over the schedule, so the mark is now the same for every gate and what
became of the date lives in the tooltip, the dialog and the dashboard. The
plan date sits in the closing weeks of the phase it ends — `dayNearEnd` in the
generator — so a gate is never drawn in the middle of a phase.

---

## Print

**The printed report covers the whole plan** and tiles it across sheets. It does
not follow the window the reader has scrolled to on screen. If that produces 271
A4 pages, the answer is a larger sheet — hence A0 — not a shorter report.

**Page budgets are measured, not derived.** Each paper × orientation × report
combination has a row count established by measuring a rendered sheet. A formula
was tried and was wrong by enough to push rows off the paper.

**The PDF is written by hand** (`js/pdf.js`) because the browser print dialog
cannot be steered: driver paper size and unprintable margins override `@page`.

---

## Tokens and accessibility

**Two token layers.** Primitives feed semantic roles; components use roles. A new
meaning gets a new role rather than borrowing one — a notice about the
application must not wear the colour that means one row's data is wrong.

**Contrast is measured.** 4.5:1 for text, 3:1 for any boundary that carries
meaning, 24 px minimum target height. “Looks fine” has been wrong three times:
the phase-bar border measured 1.38:1, the notice background 1.04:1 against the
page, and a scroll fade 0.055 alpha.

**The bar ground is a true neutral and the heat ramp has a chroma floor.** The
two share a row now, and measured in CIE Lab the old ground sat dE 2.2 from
the first ramp step — a step of the ramp, not a grey beside it. Both moved:
`--color-bar-bg` to `#eeeeee`, the ramp to values at least dE 5.7 from it and
from each other. The measurements are on the tokens.

---

## Notifications

**The bell has no read state.** Every entry is derived from the data each time it
is opened: own load, gates on own projects, changes by others since the last
visit. There is no “mark as read”, because there is nothing to mark — a condition
that has gone away stops being listed on its own.

**A shared link carries no dismissal.** State that says “this reader has seen
this” never goes into the URL.

---

## Open questions

Carried over from `docs/archive/GAP-ANALYSIS.md`; neither is decided.

- **Split allocations.** Rebooking moves the lead of a whole project. A real
  implementation would split the allocation into two person-level rows for the
  overlapping quarters. The prototype does the simple thing and says so.
- **What “Personen über 100 %” counts.** Currently: anyone whose utilisation
  exceeds 100 in the *current* quarter. Whether it should mean “in any quarter of
  the window” changes the number materially on a forty-quarter horizon, and the
  wireframe does not say.
- **Whether the person table follows the active filters.** It currently does not:
  all 44 people render under a scope of zero projects. That is an accident of the
  code rather than a decision.
