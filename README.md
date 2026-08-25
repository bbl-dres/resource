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
| Termine | `#?tab=termine&view=gantt` | Three views of the same milestones: **Gantt** (phase bars plus a capacity band), **Liste** (one row per milestone), **Kalender** (twelve months as columns). |
| Dashboard | `#?tab=dashboard` | Aggregates over phase, person, location and budget. |
| Verlauf | `#?tab=verlauf` | The immutable change log for app-owned fields. |
| API | `#?tab=api` | The REST reference — five endpoint groups, the nested-JSONB project shape and the eIAM auth note. Reached from the **API** link in the footer. |
| Drucklayout | `#?tab=export` | The PDF export: A4 portrait and A4 landscape sheets with letterhead, fixed legend and document ID. Reached from **Exportieren → Als PDF exportieren**. |

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
- **Menus that behave like menus.** The project-lead menu filters as you type, offers
  *Meine Projekte*, floats selected entries to the top and scrolls at 214px. Arrow keys roam,
  `Escape` closes and hands focus back to the trigger, and panels stay inside the window.
- **Frozen grid columns.** Signal, ID and project stay put while the quarters scroll under them.
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
  views-overview.js   landing page, pensum grid, edit popover, project and rebook modals
  views-schedule.js   Termine: Gantt, Liste, Kalender
  views-analysis.js   Dashboard and Verlauf
  views-docs.js       API reference and the PDF print layout
data/                 static mock data, see below
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

Two helpers exist because of how the escaping works, and both are worth knowing about:

- `aria(value)` renders `"true"` / `"false"` — a bare boolean interpolates to an empty
  string so that `` cond && html`…` `` renders nothing.
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
| `meta.json` | Organisation, current user, today's date, the eight quarters, locations |
| `people.json` | Six people: contracted percentage and booked load per quarter |
| `capacity.json` | Gross capacity, absences and externally contracted work per quarter |
| `projects.json` | Eleven projects: phase, lead, budget, demand per quarter, target, Gantt bars |
| `milestones.json` | Eleven gates with planned and forecast dates and status |
| `changes.json` | The change log |
| `phases.json` | SIA 112 main phases and sub-phases |
| `dashboard.json` | The one dashboard series that is not derivable (budget by year) |
| `i18n.json` | The DE → EN dictionary |
| `api.json` | The REST endpoints, the JSONB example, and the print letterhead and legend |

**Nothing that can be computed is stored.** Demand totals, net capacity, utilisation,
free capacity, per-person load, budget roll-ups, milestone counts and every KPI are
derived in `store.js` from the files above. That is what makes an edit propagate.

The figures reproduce the wireframe exactly:

```
demand       572  595  630  580  510  400  250  170  %
net capacity 480  510  535  530  500  530  535  530  %
utilisation  112  110  105   97   90   69   45   31  %
```

as do the pre-budget-approval share (277 %), the committed budget (130,9 Mio.),
its split by SIA phase, the project count per phase, and the milestone counts
(11 gates, 8 on schedule, 1 without a date, 2 late).

---

A full comparison against the mockup — what was missing, what deviates and what was fixed —
is in [docs/GAP-ANALYSIS.md](docs/GAP-ANALYSIS.md).

## Deliberate deviations from the wireframe

Worth reviewing — each is a one-line change if you disagree:

1. **Coloured phase bars in the Gantt.** The wireframe draws every bar in the same
   neutral steel; the prototype tints them with the SIA phase palette that the design
   already defines for the phase dots. It makes the phase chain readable at a glance.
   To revert, drop `is-phase ${phaseClass(b.phase)}` in `js/views-schedule.js`.
2. **Grouping is applied, not decorative.** The wireframe's toolbar reads
   "Gruppieren nach: Projektleitung" while the grid renders flat. Here grouping really
   groups, and the default is **Teilportfolio** on every tab.
3. **Teilportfolio split.** The wireframe's dashboard shows Inland 312 % and Sport 35 %;
   those numbers do not tie to any assignment of the eleven projects. The prototype
   derives the card from the data and lands on 310 % and 37 %.
4. **Change-log pagination.** The wireframe shows "1 – 25 von 214 Einträgen". The
   prototype has nine real entries and says so.
5. **Design annotations removed.** The wireframe's "Wofür / Stärke / Grenze" notes are
   review commentary and are not part of the application.

## Known limits

- **Fewer quarters first.** The wireframe's degradation order is *fewer quarters → hide
  attributes → freeze the left half*. The prototype freezes the left half and scrolls, but does
  not yet drop to six quarters on a narrow laptop.
- **Below 900 px** the planning views show a reading path instead, as the wireframe
  prescribes. The landing page, the milestone list and the change log stay usable.
- **`Personen über 100 %`** counts a raw load above 100, which is what the wireframe
  shows (Sonja, Lars, Alina). The traffic light next to each row measures load against
  the person's *contracted* percentage instead, so Paula at 90 % of 80 % also lights up.
  The wireframe is inconsistent here; both readings are reproduced faithfully and the
  question is open.
- **Rebooking** moves the whole project lead rather than splitting the allocation into
  two person-level rows. The data model does not carry per-person allocations yet — the API
  reference shows the `allocations` shape a real implementation would use.
- Export, sharing, the time-scale switch (Jahr / Monat) and the period stepper are
  inert and say so.

## Licence

MIT, see [LICENSE](LICENSE). Lucide icons are ISC-licensed.
