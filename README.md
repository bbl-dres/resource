# Ressourcenplanung — Prototyp

A working prototype of the resource-planning application sketched in
[docs/wireframes/260825_Portfolio Resource Management](docs/wireframes/260825_Portfolio%20Resource%20Management).

No build step, no dependencies: vanilla ES modules, two stylesheets, static JSON.
It is designed to be served straight from GitHub Pages.

> All content is fictional and for demonstration only.

---

## Running it

The app reads its data with `fetch`, which browsers block on `file://`.
Serve the folder over HTTP:

```bash
python -m http.server 8000
# or
npx serve .
```

Then open <http://localhost:8000>.

On GitHub Pages, enable Pages for the repository root — `index.html`, `css/`, `js/`,
`data/` and `assets/` are all that is needed. A `.nojekyll` file keeps Pages from
running the content through Jekyll.

---

## What is here

| Screen | Route | What it does |
|---|---|---|
| Einstieg (landing) | `#?tab=start` | What is due today: KPI entries, next milestones, who is overbooked, utilisation by quarter, recent changes. Every card leads into a tab. |
| Übersicht | `#?tab=uebersicht` | The pensum grid: projects × eight quarters, with a capacity footer. Switch on **Bearbeiten** to edit a cell. |
| Termine | `#?tab=termine` | The bar plan: phase bars, milestone diamonds and a today line, with the same capacity band the Übersicht carries in its footer. Same time scale and period stepper as the Übersicht. |
| Dashboard | `#?tab=dashboard&bi=…` | The KPI strip, then two sections: **Allgemein** (utilisation and free capacity over time, project count by phase, demand by portfolio, committed credit by year and by phase) and **Personen** (utilisation per person and quarter as a grid, sortable, with a peak column and a per-quarter count of people over their contract). |
| Verlauf | `#?tab=verlauf` | The immutable change log for app-owned fields. |
| API | `#?tab=api` | Swagger UI over `data/openapi.json` — a real OpenAPI 3.1 document, 13 operations in five groups, with a response example per endpoint. Reached from the **API** link in the footer. |
| Drucklayout | `#?tab=export` | The PDF export, every page of it: A4 portrait carries four quarters and 24 rows per sheet, landscape all eight quarters and 14 rows. 111 projects come out as 10 portrait sheets or 8 landscape ones, each with letterhead, legend, document ID and «Blatt x von y»; the totals close each quarter block. The **Attribute** menu applies here too: any of the ten grid columns can be added to the sheet, and the pagination re-measures itself so a title that wraps to two lines never pushes a sheet past the page. Reached from **Exportieren → Als PDF exportieren**. |

### Interactions that actually work

- **Editing.** Turn on *Bearbeiten*, click a pensum cell, adjust with the stepper or type a value.
  The popover shows what the change does to the lead's utilisation, and a **reason is required**
  when the change pushes someone over their contracted percentage. The current quarter is locked.
- **Live recalculation.** Applying an edit moves the demand total, the utilisation row, the
  capacity band, the KPI strip and every dashboard aggregate — nothing is hard-coded.
- **Umbuchen.** From the edit popover: von / Pensum / Dauer, a person picker that filters as you
  type and answers to the arrow keys, and a reason that is mandatory for every rebooking.
  One entry lands in the change log carrying both sides.
- **Filtering.** Phase, project lead, location, free-text search and *Nur Überlast*, with removable
  chips. Filters survive a tab switch and are written to the URL.
- **Grouping and sorting**, column and unit toggles (`%` ↔ FTE), *Soll-Pensum* and *Verlauf* columns.
- **Expandable search** in the header and in the toolbar: click the icon, the field grows in place.
  The two open independently and share the query.
- **Menus that behave like menus.** The project-lead menu filters as you type, floats selected
  entries to the top and scrolls at 214px. Arrow keys roam, `Escape` closes and hands focus back
  to the trigger, and panels stay inside the window. *Mir zugewiesen* sits in the toolbar itself.
- **A person's utilisation over time.** The Dashboard's *Personen* section reuses the pensum grid
  with people as the rows: contract, project count, peak, and one column per period. A peak column
  because a single quarter misleads — 21 people are over 100 % today, 35 at some point in the window.
- **Frozen master data.** Every lead column — ID, project, phase, lead, Ampel, budget — holds its
  place while only the time axis scrolls under it. There is no scrollbar: the arrows beside
  *Heute* step the window, and the rows fade out at the right edge where the axis continues.
- **Time scale.** Jahr / Quartal / Monat with a period stepper. A pensum is a rate, so a year is
  the average of its quarters and a month carries its quarter's figure — never a sum.
- **Assigning a lead.** In edit mode the Projektleitung cell opens a searchable picker; every
  assignment lands in the change log.
- **Sortable columns.** Clicking a header sorts by it; clicking the active one flips the
  direction. The sort dropdown and the headers read the same state.
- **Teilen** opens a dialog with the shareable URL for the current view.
- **CSV and Excel export.** Both write the grid exactly as it stands on screen — same columns,
  filters, grouping, sorting and time scale. The CSV is semicolon-separated with a UTF-8 BOM so
  Excel opens it natively in a de-CH locale; the `.xlsx` is a real workbook with number formats,
  column widths and the same frozen pane, written without a library.
- **CSV and Excel export.** Both write the grid exactly as it stands on screen — same columns,
  filters, grouping, sorting and time scale. The CSV is semicolon-separated with a UTF-8 BOM so
  Excel opens it natively in a de-CH locale; the `.xlsx` is a real workbook with number formats,
  column widths and the same frozen pane, written without a library.
- **DE / EN.** The language menu translates the interface live. FR and IT are listed as pending,
  exactly as the wireframe specifies.
- **URL state.** Tab, view, filters, grouping, sorting, unit and search live in the hash, so any
  view is shareable and the back button behaves.

---

## Layout of the repository

```
index.html            the shell — links the stylesheets and boots js/app.js
css/
  tokens.css          design tokens: colours, type, spacing, radii, layout metrics
  main.css            all component styles, referencing the semantic tokens only
js/
  app.js              bootstrap, hash routing, delegated event dispatch, rendering
  store.js            data loading, application state, URL sync, all derived figures
  ui.js               html`` templating, icons, and the shared shell components
  icons.js            loads the Lucide SVGs into one in-document sprite
  views-overview.js   landing page, pensum grid, edit popover
  views-modals.js     the four dialogs: project, assign, rebook, share
  views-schedule.js   Termine: the bar plan and its capacity band
  views-analysis.js   Dashboard and Verlauf
  views-docs.js       Swagger UI mount and the PDF print layout
  export.js           the CSV and XLSX writers
data/                 static mock data, see below
tools/
  generate-portfolio.js   regenerates data/ at portfolio scale (node tools/generate-portfolio.js)
assets/
  swiss-logo-flag.svg
  icons/              Lucide icons (ISC) + icons.json manifest
```

### How rendering works

Views are pure functions that return HTML through a tagged template literal.
`html\`\`` escapes every interpolation unless it is already markup, so data can never
break out into the page. Interaction happens through `data-act` attributes that
`app.js` dispatches, which keeps the views free of event wiring.

State changes re-render `#app` wholesale. With eleven rows that is far below a frame,
and focus, caret position and scroll offset are restored afterwards, so typing and
tabbing survive a re-render.

Two rules follow from how the escaping works:

- A boolean renders to the empty string, so that `` cond && html`…` `` renders nothing. The one
  exception is an ARIA slot, where `html` spells the boolean out — `aria-expanded=""` is not
  "collapsed", it is invalid.
- `attr(cond, 'disabled')` emits a raw attribute fragment; interpolating that string
  directly would escape it and the attribute would silently never apply.

### Adding an icon

Drop the Lucide SVG into `assets/icons/` and add its name to `assets/icons/icons.json`.
`js/icons.js` fetches the manifest at boot and folds every file into one `<symbol>` sprite.

---

## The data

Everything lives in `data/` as plain JSON.

| File | Contents |
|---|---|
| `meta.json` | Organisation, current user, today's date, the eight quarters, the portfolios |
| `people.json` | 46 people: contracted percentage and booked load per quarter |
| `capacity.json` | Gross capacity, absences and externally contracted work per quarter |
| `projects.json` | 111 projects: phase, lead, budget, demand per quarter, target, Gantt bars |
| `milestones.json` | 86 gates with planned and forecast dates and status |
| `changes.json` | The change log — 9 hand-written entries plus 240 generated over the ten weeks before today |
| `phases.json` | SIA 112 main phases and sub-phases |
| `dashboard.json` | The one dashboard series that is not derivable (budget by year) |
| `i18n.json` | The DE → EN dictionary |
| `print.json` | The print letterhead, legend and document metadata |
| `openapi.json` | The OpenAPI 3.1 document Swagger UI renders |

**Nothing that can be computed is stored.** Demand totals, net capacity, utilisation,
free capacity, per-person load, budget roll-ups, milestone counts and every KPI are
derived in `store.js` from the files above. That is what makes an edit propagate.

### Portfolio scale

The wireframe's eleven projects are all still here, unchanged, and a hundred more
are generated around them so the views can be judged at the size a real portfolio
would have. What depends on the projects is derived rather than invented:

- a person's booked load is the sum of the projects they lead, so an edit moves it;
- the team is sized so that the portfolio runs at 112 % at its busiest quarter;
- gross capacity is flat apart from one planned hire, because a team does not grow
  to meet a falling demand curve — the utilisation curve falls out of that.

```
demand       4122  4405  4830  4690  4155  3565  3145  2730  %
net capacity 3670  3905  4065  4025  3800  4025  4065  4025  %
utilisation   106   106   111   109   102    82    72    63  %
```

111 projects · 46 people · 4 130 % contracted · 972 Mio. CHF committed ·
86 gates (55 on schedule, 24 late, 7 without a date) · 3 projects without a lead.

Because these are derived, the wireframe's own headline figures (572 % demand,
112 % utilisation, 130,9 Mio.) now describe only the eleven original projects, not
the portfolio. Filter to them and they come back.

---

Three review documents sit alongside this one:

- [docs/GAP-ANALYSIS.md](docs/GAP-ANALYSIS.md) — a full comparison against the mockup: what was
  missing, what deviates and what was fixed.
- [docs/DESIGN-REVIEW.md](docs/DESIGN-REVIEW.md) — a measured design and accessibility audit:
  contrast, greyscale legibility, density on a small laptop, target sizes, ARIA.
- [docs/CODE-REVIEW.md](docs/CODE-REVIEW.md) — correctness, structure, duplication and dead
  code, with the fixes applied.
- [docs/DESIGN-REVIEW-2.md](docs/DESIGN-REVIEW-2.md) — a second, measured design pass across
  spacing, typography, colour, interaction and responsive behaviour, with the fixes applied.
- [docs/DASHBOARD-STUDY.md](docs/DASHBOARD-STUDY.md) — what the dashboard should become, and why.

## Deliberate deviations from the wireframe

Worth reviewing — each is a one-line change if you disagree:

1. **Grouping is applied, not decorative.** The wireframe's toolbar reads
   "Gruppieren nach: Projektleitung" while the grid renders flat. Here grouping really
   groups, and the default is **Teilportfolio** on every tab.
2. **Teilportfolio taxonomy.** The wireframe has five areas, of which *Inland* holds
   more than half — which is a default, not a grouping. The prototype uses the BBL's
   own building categories instead: Verwaltung, Zoll, Justiz und Polizei, Bildung und
   Forschung, Bauten im Ausland, Kultur und Denkmäler, Sport. Seven areas, the largest
   holding a quarter of the portfolio. The dashboard card is derived from the data
   rather than asserted, so its figures follow.
3. **Change-log pagination.** The wireframe shows "1 – 25 von 214 Einträgen". The
   prototype has nine real entries and says so.
4. **Design annotations removed.** The wireframe's "Wofür / Stärke / Grenze" notes are
   review commentary and are not part of the application.

## Known limits

- **Fewer quarters first.** The wireframe's degradation order is *fewer quarters → hide
  attributes → freeze the left half*. The prototype freezes the left half and scrolls, but does
  not yet drop to six quarters on a narrow laptop.
- **Below 900 px** the planning views show a reading path instead, as the wireframe
  prescribes. The landing page, the milestone list and the change log stay usable.
- **`Personen über 100 %`** counts a raw load above 100. The traffic light next to each
  row measures load against the person's *contracted* percentage instead, so somebody at
  90 % of an 80 % contract also lights up. The wireframe is inconsistent here; both
  readings are reproduced faithfully and the question is open.
- **One lead is far above the rest.** Sonja Beispiel carries the wireframe's three
  largest projects, which at portfolio scale puts her at 225 % against a median of 90 %.
  That is what the data says rather than a generation artefact, and it is exactly the
  case the view exists to surface.
- **Rebooking** moves the whole project lead rather than splitting the allocation into
  two person-level rows. The data model does not carry per-person allocations yet — the API
  reference shows the `allocations` shape a real implementation would use.
- **The Gantt's own list and calendar views are gone.** They showed the same milestones
  without adding a reading the bar plan does not already give.

## Licence

MIT, see [LICENSE](LICENSE). Lucide icons are ISC-licensed.
