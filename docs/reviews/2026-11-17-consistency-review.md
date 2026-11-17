# Consistency review — tabs, switches and the link

**Date:** 17.11.2026 · **Role:** senior developer · **Baseline:** the tree after
the [code review of 16.11.](2026-11-16-code-review.md) and the feedback round
that followed it.

**Brief:** bugs, errors and inconsistencies — does every tab, every switch and
every URL parameter behave the same way wherever it appears: on Planung,
Personen, Dashboard, Verlauf, in the print layout and in the files.

**Trigger:** two observations from use. The quarter cells carried a `%` on
Personen and none on Planung; and `#?tab=overview&lead=sonja` filtered Planung
while `#?tab=people&lead=sonja` showed all fifty people.

## How it was done

The state has 24 parameters that reach the link and six places that draw from
it. Rather than read for inconsistencies, the review measured them: a
headless browser opened every tab once as a baseline and then once per
parameter — 5 tabs × 20 parameters — and compared a digest of the page (its
text, the values of its fields, the number of coloured cells and bars) with
the baseline, together with sample cells of the first row, the first role row
and the sum row. A parameter that left a tab unchanged although the tab
offers the control for it is a dead switch; one that changed a tab that has
no control for it is a hidden dependency. Both lists were then traced in the
code, fixed, and the run repeated. The files (CSV, Excel, PDF) were read in
the code and exercised with the existing export scenario.

## Result

| | Found | Fixed | By design, now written down | Open |
|---|---|---|---|---|
| Dead switches (offered, no effect) | 4 | 4 | – | – |
| Hidden dependencies (effect, no control) | 2 | 2 | – | – |
| Screen and paper disagree | 3 | 3 | – | – |
| The link | 2 | 2 | – | – |
| Wording and plurals | 3 | 3 | – | – |
| Deliberate differences | 5 | – | 5 | – |
| Questions for the product owner | 4 | – | – | 4 |

`node tools/check.mjs` passes with 16 new checks for the rules below.

## The rules the fixes follow

The fixes are applications of five rules. They are the part worth keeping in
mind when the next switch is added.

1. **A control is offered on a tab exactly when it changes that tab.** No
   menu that does nothing to the page under it, and nothing on the page that
   depends on a control which is only on another tab.
2. **A quarter cell is a bare number in the unit of its table.** The unit is
   said once — in the sum row, in every cell's hint, in a sheet's subtitle. A
   figure that is *not* in the table's unit keeps its sign.
3. **A parameter is in the link wherever it is not at its default** — on
   every tab, not only on the tab it belongs to.
4. **Screen and paper use the same words for the same thing**, from the same
   function.
5. **A file names every filter its rows went through**, whichever tab it was
   asked for on.

## What changes what — after the fixes

`●` changes the view · `–` does not apply and is not offered there ·
`○` deliberately ignored (see «By design»).

| Parameter | Planung | Personen | Dashboard | Verlauf | Print layout, PDF | CSV, Excel |
|---|---|---|---|---|---|---|
| `lead` Bearbeitende | ● | ● names the people | ● | ● | ● | ● |
| `lead=none` nicht zugewiesen | ● | – | ● | ● | ● | ● |
| `org` Organisation | ● the project's | ● the person's own | ● | ● | ● | ● |
| `phase`, `portfolio` | ● | – | ● | ● | ● | ● |
| `q` search | ● | ● name, organisation, projects | ● | ● | ● | ● |
| `scale` Zeitskala | ● | ● | – | – | ● | ● |
| `from` window | ● | ● | – | – | ○ whole plan | ● the window |
| `unit` Pensum % / FTE | ● | ● role rows | – | – | ● | ○ always points |
| `view`, `layers` | ● | – | – | – | ● | – |
| `colour` | ● | ● | – | – | ● | – |
| `zeros` | ● | ● | – | – | ● | – |
| `cols` / `barcols` | ● | – | – | – | ● | ● |
| `sort`, `dir` | ● | – | – | – | ● | ● |
| `psort`, `pdir` | – | ● | – | – | – | – |
| `csort` | – | – | ● | – | – | – |
| `page`, `pageSize` | – | – | – | ● | – | – |
| `paper`, `sheet`, `zoom` | – | – | – | – | ● | – |

## 1 · Dead switches

**1.1 Personen ignored every filter.** The toolbar offered all four menus,
the search and «Mir zugewiesen»; `personRows()` listed `data.people`
unfiltered. *Fixed:* the table answers to the filters that mean something for
a person — «Bearbeitende» names the people themselves, «Organisation» is the
person's own (the column beside the name shows it), and the search finds a
person by name, by organisation or by a project they hold a role on, with
the hit marked. A phase and a sub-portfolio are properties of a project: on
Personen their menus and chips are not shown, as decided in the feedback.
They stay in the state and in the link and are back on the next tab.
«nicht zugewiesen» — a role nobody holds — is likewise something a project
has, and is not offered in the menu there. The registry in `store.js`
carries this as one flag per filter (`people`), read by `filtersHere()`,
`selectedHere()` and `idsHere()`; the toolbar, the chips, the badge on the
menu button and «Alle» all go through them.

**1.2 The count beside the chips said «111 Bauprojekte» on Personen.**
*Fixed:* «50 Personen», «3 von 50 Personen» (`peopleLine()`), and a table
filtered to nobody shows the empty state with its own sentence instead of an
empty card.

**1.3 «Nullwerte ausblenden» did nothing on paper.** The print layout offers
the Ansicht menu with the switch live; the sheet printed a dash for every
nought regardless. *Fixed:* a hidden nought is blank on the sheet, and so in
the PDF, which is drawn from it. A nought that is not hidden stays a dash —
that is paper's way of writing it.

**1.4 The unit stayed live in the bar plan.** In «Termine» no figure is
drawn; «Pensum einfärben» and «Nullwerte ausblenden» were greyed and the
unit beside them was not, and set nothing. *Fixed:* `segmented()` takes
`disabled`, and the three switches under «Pensumwerte» grey out together,
driven by one predicate (`figuresShown()`).

## 2 · Hidden dependencies

**2.1 The time scale and the unit set on Planung applied on Personen, where
they could be seen and not changed.** Somebody who had switched Planung to
years found Personen in years, with no control on the page to say why or to
change it back. *Fixed:* Personen carries the Ansicht menu with the part
that changes a table of people — «Zeitskala» and «Pensumwerte». It has no
named view, no layers and no columns to choose, so those groups are not in
it.

**2.2 «Pensum einfärben» and «Nullwerte ausblenden» did not reach
Personen.** With the menu there they have to work there. *Fixed:* the
person table takes the same `is-uncoloured` class as the planning grid and
hides a nought in a person's row where Planung hides one in a project's.
`coloured()` no longer depends on the «Pensumwerte» layer on a tab that has
no layers: opened from the bar plan, Personen used to be one view switch
away from losing its colours for no visible reason.

## 3 · Screen and paper

**3.1 The quarter cells carried a unit on one tab.** A project's row on
Planung is a bare number, a person's row on Personen read «106 %». *Fixed
(rule 2):* bare on both; the hint still says «106 % der Projektkapazität».
One exception, and it is the rule applied rather than broken: with the table
set to FTE, the role rows under a person are FTE and the person's own row is
still a share of their capacity, so there it keeps the sign that tells it
from the figures under it.

**3.2 A group's sum had two names.** On screen «Summe (11 Bauprojekte)», as
asked for in the feedback; on the sheet still «Summe Kleinprojekte bis
3 Mio. CHF». *Fixed:* `sumLabel()` in `ui.js`, used by both.

**3.3 The bar plan on paper named a unit.** Its meta line read «Einheit:
Pensum in %» over a sheet without a single figure. *Fixed:* the unit is
printed where there are figures.

## 4 · The link

**4.1 A tab's own state was lost on Back, Forward and reload.** The person
table's sort, the order of the dashboard cards, the page of the log, the
paper size, orientation and zoom were written into the link on their own tab
only, while `readUrl()` sets whatever a hash leaves out back to its default.
A click from tab to tab keeps the state in memory, so the sort survived
Personen → Planung → Personen; the same walk with Back and Forward, or a
reload on Planung, lost it. *Fixed (rule 3):* `writeUrl()` writes every
parameter that is not at its default, on every tab. At the defaults the link
is still `#?tab=overview` and nothing else.

**4.2 `sheet=portrait` was always written on the print tab,** the one
parameter that appeared at its default. *Fixed* with 4.1.

## 5 · Wording

- **«1 Projekte»** in a group heading on paper, pensum sheet and bar plan
  alike. *Fixed:* `projectCount()` — «1 Bauprojekt», «11 Bauprojekte» — which
  is also the word the screen uses.
- **«1 Personen»** in the note of the person table's total. *Fixed.*
- **A file's filter line.** Making the chips tab-aware (1.1) would have left
  a file taken on Personen saying «Filter: Sonja Beispiel» over rows that
  had also gone through a phase filter. Caught in this review before it
  shipped: `activeFilters({ projects: true })` (rule 5).

## By design — now written down

These came out of the matrix as differences and are deliberate. They were
decisions already; what was missing is one place that says so.

- **The print layout ignores the window (`from`).** A report prints the
  whole plan and tiles it across sheets (`planning horizon ÷ quarters per
  sheet`), so it starts where the plan starts. That is why the print tab has
  no «Zurück / Zu heute / Weiter».
- **CSV and Excel carry the window on screen.** `export.js` states its
  contract in its first lines: the file is the view — the same columns,
  filters, sort, scale and quarters. See open question 3.
- **CSV and Excel are always in pensum points.** The CSV is whole numbers
  for the reason given in `export.js` (no decimal mark survives every
  locale); the workbook formats them `0 " %"`, so the unit is in every cell.
  The unit switch changes how a figure is *written on screen and paper*, not
  what is exported.
- **Dashboard and Verlauf have no Ansicht menu.** Their figures have fixed
  units (FTE, Mio. CHF, %) and no window; nothing in that menu applies.
- **Not in the link:** the language (a shared link opens in the reader's
  own), which rows are folded open, and which groups are collapsed.

## Open questions

1. **«Exportieren» and «Drucken» on Personen, Dashboard and Verlauf produce
   the project plan**, not the table on the page. It is the same file from
   every tab, filtered by whatever the filters select among projects. That
   is consistent in itself and at odds with `export.js`'s own «the file is
   the view». Either the two buttons belong on Planung only, or Personen
   gets a file of its own (people as rows — the table already exists as
   data in `personRows()`). Not done here: it is a feature, not a fix.
2. **What a person's row says.** It is a utilisation — booked pensum over
   the person's project capacity — while the rows under it are the pensum
   itself, so «106» stands over 15 + 50 + 10 + 10. That predates this
   review and is unchanged. An alternative that would make the table add up
   like a spreadsheet: the row shows the booked sum (85, or 0,85 FTE) and
   the colour and the warning carry the utilisation.
3. **Should a data file carry the whole plan?** The print does, the files
   do not (see above). A reader who wants ten years in Excel has to step
   the window and export three times.
4. **«nicht zugewiesen» on Personen.** Left out there because an open role
   belongs to a project. On a table of people it could mean something of
   its own — the people who hold no role at all. No such person exists in
   the fixtures.

## The check

`tools/check.mjs` gained a block for the rules above:

- Personen: «Bearbeitende» names the person; phase, sub-portfolio and
  «nicht zugewiesen» carry no chip there and stay in the link;
  «Organisation» is the person's own; the search finds a name and returns
  nobody for a word nothing carries; no filter, everybody.
- A file of projects names all four filters from any tab.
- The figures count as shown on Personen whatever the view; the bar plan on
  Planung has none to colour.
- A tab's own state survives the link on each of the five tabs, and at the
  defaults the link is `#?tab=overview`.

## Files

| File | What changed |
|---|---|
| `js/store.js` | `people` flag in the filter registry, `filtersHere / selectedHere / idsHere`, `figuresShown`, `personRows()` filtered, `activeFilters({ projects })`, `writeUrl()` on one rule |
| `js/ui.js` | toolbar and menus per tab, Ansicht menu for Personen, `segmented({ disabled })`, `peopleLine`, `projectCount`, `sumLabel`, empty state for people |
| `js/views-analysis.js` | bare figures, hidden noughts, colour switch, search marks, person count, Ansicht on Personen |
| `js/views-docs.js` | hidden noughts on paper, group counts, sum label, no unit on the bar plan |
| `js/views-overview.js`, `js/export.js`, `js/app.js` | the shared label; the file's filter line; «Alle» per tab |
| `css/main.css` | a greyed segmented control |
| `data/i18n.json` | two entries for the people's empty state |
| `tools/check.mjs` | 16 checks |
