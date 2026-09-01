# BBL Resource Planning (Ressourcenplanung)

<p align="center">
  <a href="https://bbl-dres.github.io/resource/">
    <img src="assets/resource-planning-hero.jpg" width="100%" alt="Concept illustration of a building portfolio connected to a quarterly resource plan, project milestones and team capacity"/>
  </a>
</p>

Resource-planning prototype for the [Federal Office for Buildings and Logistics (BBL)](https://www.bbl.admin.ch), connecting project demand, schedules, milestones, project leads, and team capacity.

> [!CAUTION]
> This is an unofficial demonstration prototype with fictional people, projects, and operational data. Edits remain in browser memory, the API view is a reference rather than a live service, and the app is not intended for production use.

## Demo

**Live demo:** https://bbl-dres.github.io/resource/

## Features

- Review the portfolio through overviews, dashboards, change history, and a Gantt-style schedule.
- Edit demand, assign or rebook project leads, and see overload warnings with reasons.
- Filter, group, and sort year, quarter, and month views in percent or FTE.
- Compare demand, capacity, utilisation, free capacity, and person-level workload.
- Export CSV, Excel, and client-side PDF reports and print schedules from A4 through A0.
- Use the responsive interface in German, French, Italian, or English.

## Run locally

The app loads static JSON fixtures, so serve the repository over HTTP:

```bash
python -m http.server 8000
```

Then open <http://localhost:8000/>.

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — code structure, state, rendering, grids, time, exports, and data.
- [Decisions](docs/DECISIONS.md) — standing implementation and design rules.
- [Current code review](docs/CODE-REVIEW-3.md) — remaining technical limitations.
- [Dashboard study](docs/DASHBOARD-STUDY.md) — proposal still under discussion.
- [Data generator](tools/README.md) — deterministic fixture generation and known data limitations.

Earlier retrospectives are retained in [`docs/archive/`](docs/archive/) for historical context.

## License

Original project code is licensed under the [MIT License](LICENSE). Lucide icons are ISC-licensed, and vendored Swagger UI remains under its upstream terms.
