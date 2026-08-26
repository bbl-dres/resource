# BBL Resource Planning (Ressourcenplanung)

<p align="center">
  <a href="https://bbl-dres.github.io/resource/">
    <img src="assets/resource-planning-hero.jpg" width="100%" alt="Concept illustration of a building portfolio connected to a quarterly resource plan, project milestones and team capacity"/>
  </a>
</p>

[![Demo on GitHub Pages](https://img.shields.io/badge/demo-GitHub%20Pages-2ea44f?logo=github&logoColor=white)](https://bbl-dres.github.io/resource/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Status: prototype](https://img.shields.io/badge/status-prototype-orange.svg)
![Build: none](https://img.shields.io/badge/build-none-brightgreen.svg)

> [!CAUTION]
> **This is an unofficial prototype for demonstration purposes only.**
> All people, projects and operational data are fictional. Changes exist only in the current browser session, the API screen documents a target contract rather than a live service, and the application is not intended for production use.

A German-first resource-planning prototype for the [Federal Office for Buildings and Logistics (BBL)](https://www.bbl.admin.ch). It connects construction-project demand, schedules, milestones, project leads and team capacity in one portfolio view.

## Demo

**Live app:** https://bbl-dres.github.io/resource/

No installation is required for the hosted demo. The repository itself is a static site and can be served by any basic HTTP server.

## Scope

### Screens

| Screen | Route | Purpose |
|---|---|---|
| Start | `#?tab=start` | Due items, upcoming milestones, overloads, utilisation and recent changes |
| Overview | `#?tab=overview` | Project demand across eight quarters, with capacity and utilisation totals |
| Schedule | `#?tab=schedule` | Phase bars, milestone diamonds, a today marker and the shared capacity band |
| Dashboard | `#?tab=dashboard` | Portfolio KPIs, utilisation, free capacity, phase and credit analysis, and a person-by-period view |
| History | `#?tab=history` | Paginated change history for prototype-owned fields |
| API | `#?tab=api` | Read-only Swagger UI for the OpenAPI 3.1 target contract |
| Print layout | `#?tab=export` | Preview, direct PDF download and browser printing for the Overview and Schedule reports |

### Core interactions

- Edit future-quarter demand in place; the current quarter is locked, and a reason is required when a change creates overload.
- Assign a project lead or use the rebooking flow with a searchable, keyboard-accessible person picker.
- Filter by SIA phase, project lead, sub-portfolio, overload status or text; group and sort the remaining projects.
- Switch between year, quarter and month scales and between percent and FTE units. Rates are averaged across years and repeated across months rather than summed.
- Recalculate portfolio demand, capacity, utilisation, overload signals and dependent dashboard views from the active state.
- Export the visible scope to semicolon-separated CSV or a native `.xlsx` workbook, and download the rendered reports as PDF.
- Share hash-based views and switch the interface between German, French, Italian and English.

### Print and data export

The print layout produces two reports from the same filtered portfolio:

- **Overview** — project demand by quarter, group totals, capacity and utilisation.
- **Schedule** — project phases and milestones over the same quarter axis.

Both reports support A4, A3, A2, A1 and A0 in portrait or landscape orientation. The screen preview offers Fit, 50%, 100%, 200% and 400% zoom. A small local writer translates the rendered sheets into a directly downloadable PDF at their physical page sizes; browser printing remains available with a matching runtime `@page` rule.

## Technical overview

- Static single-page application built with vanilla JavaScript ES modules, HTML and layered CSS.
- No package installation, runtime framework or build step; Swagger UI and Lucide assets are vendored locally.
- Ten JSON fixtures load at startup. The OpenAPI document and Swagger UI load only when the API screen is opened.
- `js/store.js` owns application state, URL serialization and derived portfolio figures.
- Views are pure rendering functions. The `html\`\`` tagged template escapes interpolated values, while delegated `data-act` handlers in `js/app.js` own interaction.
- Rendering replaces `#app` as a whole and restores focus, caret and scroll state afterwards.
- Layout tokens, semantic color roles and print geometry are centralized in `css/tokens.css` and `css/main.css`.
- Planning grids progressively drop optional frozen columns and expose a horizontally scrollable time axis on narrower screens.

## Run locally

The app loads JSON with `fetch()`, so opening `index.html` through `file://` will not work. From the repository root, run one of:

```bash
# Python
python -m http.server 8000

# Node.js
npx serve .

# PHP
php -S localhost:8000
```

Then open <http://localhost:8000/>.

## Project structure

```text
index.html                 Application shell; boots js/app.js
css/
  tokens.css               Primitive and semantic design tokens
  main.css                 Components, responsive layout and print styles
js/
  app.js                   Bootstrap, rendering and delegated interaction
  store.js                 Data loading, state, URL sync and derived figures
  ui.js                    Escaped HTML template and shared UI components
  columns.js               Shared project-column definitions
  icons.js                 In-document Lucide SVG sprite
  views-overview.js        Landing page, demand grid and edit popover
  views-schedule.js        Gantt-style schedule and capacity band
  views-analysis.js        Dashboard and history
  views-modals.js          Project, milestone, assignment and rebooking dialogs
  views-docs.js            Swagger UI and printable reports
  export.js                CSV and XLSX writers
  pdf.js                   Client-side PDF writer for rendered sheets
data/                      Static fictional fixtures and OpenAPI document
assets/                    Hero, brand mark, icons and vendored Swagger UI
docs/                      Dated design, domain and code-review records
tools/generate-portfolio.js  Portfolio-scale fixture generator
```

## Data snapshot

| File | Checked-in contents |
|---|---|
| `meta.json` | Organisation, fictional user, eight-quarter axis and seven sub-portfolios |
| `projects.json` | 111 projects with demand, target, credit, lead and schedule bars |
| `people.json` | 46 people with contracted percentage and eight-quarter base load |
| `capacity.json` | Gross capacity, absences and externally contracted work |
| `milestones.json` | 189 project gates: 130 on schedule, 51 late and 8 without a forecast |
| `changes.json` | 249 fictional history entries |
| `phases.json` | SIA 112 main phases and sub-phases used by the prototype |
| `dashboard.json` | The budget-by-year series that is not derived from projects |
| `i18n.json` | 307 German source terms with DE, FR, IT and EN variants |
| `print.json` | Print letterhead, legend and document metadata |
| `openapi.json` | OpenAPI 3.1 target contract with 20 paths and 42 operations |

Most portfolio totals, net capacity, utilisation, free capacity, milestone counts and filter results are derived at runtime in `store.js`. The checked-in demo represents 111 projects, 46 people, 4,130% contracted capacity, CHF 971.77 million committed credit and three projects without a lead.

## Verification

There is currently no committed test runner, browser harness or CI workflow. The dated review documents mention internal `flow.js`, `audit.js`, `resp.js` and `robust.js` probes, but those scripts are not part of this repository and their results are not reproducible from the checkout.

A minimal syntax pass requires only Node.js:

```powershell
Get-ChildItem js -Filter *.js | ForEach-Object { node --check $_.FullName }
```

After changes, serve the app and exercise all seven routes, responsive widths, exports and the browser print preview manually.

## Documentation

The files in [`docs/`](docs/) are dated review and decision records. They explain why the prototype looks and behaves as it does, but older findings can lag the current implementation.

- [Gap analysis](docs/GAP-ANALYSIS.md)
- [Latest code review](docs/CODE-REVIEW-2.md)
- [Latest design review](docs/DESIGN-REVIEW-3.md)
- [Responsive review](docs/RESPONSIVE-REVIEW.md)
- [Print reports](docs/PRINT-REPORTS.md)
- [Edit mode](docs/EDIT-MODE.md)
- [Column model](docs/COLUMNS.md)
- [Notification model](docs/NOTIFICATIONS.md)

## Deployment

The repository is ready for static hosting. GitHub Pages can publish the root of `main`; `index.html`, `css/`, `js/`, `data/` and `assets/` are the runtime files, and `.nojekyll` prevents Jekyll processing. No build artifact is produced.

## Known limitations

- **No persistence or live backend.** Edits, assignments and history additions are in memory and disappear on reload. Swagger submit methods are disabled because `openapi.json` is documentation only.
- **One lead per project.** The fixture model assigns the entire project demand to one `leadId`. Rebooking changes that lead; it does not split allocations between several people or periods as the target API model would.
- **Fixed planning horizon.** The fixtures cover eight quarters. Year and month views are projections of that horizon, not independently stored plans.
- **Responsive density.** Narrow layouts hide lower-priority frozen columns and scroll the time axis. The full portfolio is designed primarily for laptop and desktop planning.
- **Large-format output.** A2–A0 previews use measured row budgets and standards-based page sizes. Direct PDFs preserve those sizes, but physical output still depends on the receiving PDF viewer and printer-driver support.
- **No reproducible regression suite.** Accessibility, browser behavior, URL robustness and print pagination currently require manual verification.
- **Fixture generator is not incremental.** Do not rerun `tools/generate-portfolio.js` against the already expanded checked-in data; it appends another generated portfolio and duplicate generated change IDs. Use it only from a known seed dataset until it is made idempotent.

## Standards and attribution

- Project phase labels follow the SIA 112 taxonomy represented in `data/phases.json`.
- The target API is described with OpenAPI 3.1 and RFC 9457 problem details, including `ETag`/`If-Match` concurrency and idempotency keys for creates.
- Interface icons come from `lucide-static` 1.34.0 under the ISC licence.
- Swagger UI is vendored under `assets/vendor/swagger-ui/`; retain its upstream notices when redistributing those files.

## License

Original project code is licensed under the [MIT License](LICENSE). Third-party assets remain subject to their own upstream terms.
