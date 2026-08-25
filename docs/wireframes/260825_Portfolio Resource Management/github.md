repo: bbl-dres/ict-portfolio
branch: main

## Last sync

date: 2026-08-25T11:13:43Z

### Updated in this project

- Reused the repository design tokens (`css/tokens.css`) — navy #12213E shell, blue #2563EB accent, neutral scale, spacing, radii, focus ring — across four new resource-planning views.
- Read `docs/DATAMODEL.md` and `data/users.json` for entity and role vocabulary (phase, priority, responsible, comments).
- Copied `assets/swiss-logo-flag.svg` into the project for the app shell header.
- Added four main-view sketches for construction resource planning: pensum grid, project list + demand panel, capacity cockpit, and a SIA-phase milestone spine. New screens, not part of the repository.

## Screen map

| Screen | Built from |
|---|---|
| Ressourcenplanung Bereichsleitung.dc.html — app shell (header, search, language menu, login, tabs) | `css/tokens.css`, `assets/swiss-logo-flag.svg`, README view list |
| … 1a Pensum-Raster (Projekte × Quartale) | user-uploaded Excel screenshots; `docs/DATAMODEL.md` |
| … 1b Projekte — Liste & Bedarf | `docs/DATAMODEL.md` (comments, phases), user-uploaded project detail screenshot |
| … 1c Kapazitäts-Cockpit | `data/users.json` (people, roles), `css/tokens.css` semantic colours |
| … 1d Meilensteine & Phasen (SIA 112 spine) | user-uploaded SIA 112 phase table and SAP EPPM phase-chain screenshot |
