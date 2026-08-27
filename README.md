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
> **Unofficial prototype for demonstration purposes only.** All people, projects and operational data are fictional. The application is not intended for production use.

Resource-planning prototype for the [Federal Office for Buildings and Logistics (BBL)](https://www.bbl.admin.ch). It connects construction-project demand, schedules, milestones, project leads and team capacity in one portfolio view.

## Demo

**Live app:** https://bbl-dres.github.io/resource/

<p align="center">
  <img src="assets/preview1.jpg" width="49%" alt="Monthly project schedule with phase bars and milestone markers"/>
  <img src="assets/preview2.jpg" width="49%" alt="Monthly resource-planning overview with project demand and utilisation"/>
</p>

## Highlights

- Portfolio overview, Gantt-style schedule, dashboards, change history and a read-only API reference.
- In-place demand editing, project-lead assignment and rebooking, with overload warnings and reasons.
- Filtering, grouping and sorting across year, quarter and month views in percent or FTE.
- Live calculation of demand, capacity, utilisation, free capacity and person-level workload.
- CSV, Excel and client-side PDF export; printable Overview and Schedule reports from A4 through A0.
- Responsive keyboard-accessible interface in German, French, Italian and English.

## Technical overview

- Static single-page application using vanilla JavaScript ES modules, HTML and layered CSS.
- No framework, package installation or build step; Swagger UI and Lucide assets are vendored locally.
- Fictional JSON fixtures for 111 projects, 44 people, 40 quarters (Q3/2026 – Q2/2036), 390 milestones and 249 history entries. Seven of the eleven files in `data/` are generated — see [`tools/README.md`](tools/README.md).
- Hash-based view state, escaped HTML templates and derived portfolio figures in `js/store.js`.
- OpenAPI 3.1 target contract with 20 paths and 42 operations; no live API is connected.

## How it works

A short map of the codebase — module layers, the escaping layer, what must
survive a re-render, the column registry, the time window, and why the PDF
writer exists — is in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). Read that
first; it is four pages and it is the orientation this repository lacked for a
long time.

## Run locally

The app loads its JSON with `fetch()`, so serve the repository over HTTP instead of opening `index.html` directly:

```bash
python -m http.server 8000
# or
npx serve .
```

Then open <http://localhost:8000/>.

### Regenerate the data

`data/` is not hand-maintained. Seven of its eleven files come out of one
deterministic generator:

```bash
node tools/generate-portfolio.js
```

It prints what it made — projects, roster, the demand and capacity curves,
utilisation per quarter, milestone counts — so a run can be judged without
opening the app. See [`tools/README.md`](tools/README.md) for what it models and
what is deliberately wrong in the fixtures.

## Prototype limits

- Changes are stored only in browser memory and disappear on reload.
- The fixture model assigns each project to one lead; it does not yet support split person-level allocations.
- The planning horizon runs ten years, but a grid never shows all of it: a fixed number of columns per scale — 12 years, 16 quarters or 24 months — with the arrows stepping the window and the grid panning for the rest. The dense portfolio grids are designed primarily for laptop and desktop use.
- **No test suite is committed.** The Playwright checks cited throughout `docs/` — behaviour, contrast, responsive, malformed input, print overflow — run from an external harness that is not part of this repository, so the figures quoted in those documents cannot currently be reproduced by a reader.

## Documentation

Four documents, and that is deliberate:

| | |
|---|---|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | How it is put together. Start here. |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | The standing rules, one paragraph each, with the reason. |
| [`docs/CODE-REVIEW-3.md`](docs/CODE-REVIEW-3.md) | The most recent whole-repository review, and what is still open. |
| [`docs/DASHBOARD-STUDY.md`](docs/DASHBOARD-STUDY.md) | The one proposal still under discussion. |

Fourteen earlier retrospectives are in [`docs/archive/`](docs/archive/). They were
written against an eight-quarter data set and a layout that no longer exists, two
of them contradicted each other, and none should be cited as current — their
standing rules were harvested into `DECISIONS.md`.

## License

Original project code is licensed under the [MIT License](LICENSE). Lucide icons are ISC-licensed; vendored Swagger UI remains subject to its upstream terms.
