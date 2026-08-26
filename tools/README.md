# tools

## `generate-portfolio.js`

Builds the demonstration portfolio in `data/`. Node, no dependencies:

```
node tools/generate-portfolio.js
```

It prints what it made — projects, roster, the demand and capacity curves,
utilisation per quarter, milestone counts — so a run can be judged without
opening the app.

### Repeatable

The generator reads its **seed** from `tools/seed/` and never from `data/`. That
matters: it used to read `data/projects.json`, append a hundred generated
projects and write the result back, so a second run produced two hundred and
eleven projects out of a hundred and eleven. The header claimed determinism; the
file was not reproducible.

`tools/seed/` holds the hand-written core the wireframe tells its story with —
eleven projects, six named people, their gates, and the nine change-log entries
the landing page shows. Those keep their identity (address, lead, credit,
priority) but their timelines are generated like every other, or they would be
the only projects in the portfolio still finishing inside a year.

The roster had the same fault as the projects and it was harder to see:
`makeTeam` read `data/people.json` and only ever *added* to it, so a team that
had once grown could not shrink again. A smaller portfolio kept the larger team
and the peak quietly slid from 112 % to 95 % — the one number the story rests
on, wrong for a reason nothing in the output pointed at.

Randomness comes from one seeded generator (`mulberry32`, seed `0x5bb1e1d`), so
the same input gives the same output. Changing anything that draws from it —
a weight, a duration, the order of two calls — reshuffles everything after it.

### The window

`QUARTERS = 40`, starting Q3/2026, so the plan runs to Q2/2036. The calendar, the
absence pattern and the hiring curve are all derived from that one number;
`meta.json`'s quarter list is written by the generator, so the app and the data
cannot disagree about how long the horizon is.

Ten years, because that is how long the thing being planned takes. At eighteen
quarters forty-two of a hundred and eleven projects simply ran off the edge, and
the load curve fell away in 2030 because the paper stopped, not because the work
did — which is the one thing a plan must never look like.

The app does not show all forty at once. It shows a fixed **twelve columns** at
whatever scale is set — twelve years, three years or one — and the arrows step
that window while the grid pans. Seeing the whole plan at once is what the A0
report is for.

### The shape of a project

Every project has the whole chain, `11` through `53`: Strategische Planung to the
handover. What differs is how long each phase takes and when the first one began.

Phase 6 is not in it. Betrieb, Überwachung and Erhaltung are what happens to the
building afterwards, for as long as it stands — not project work, and not this
office's. The chain ends at MS7 Übergabe Bewirtschaftung. Including it had put
the average project at twenty-six years and left an open-ended bar running off
every window.

`LAST_START = 2`: nothing begins after Q1/2027. A project two years out is not in
this tool, it is a line in a Botschaft — no Auftrag, no lead, no pensum. So the
portfolio drains: 112 % today, falling through the ten years as projects are
handed over and nothing new arrives to replace them. That taper is a finding,
not a gap in the data.

### How long a project takes

`DURATION` gives each SIA sub-phase a range in quarters, before the project's own
pace is applied:

| Teilphase | Quartale | woher |
|---|---|---|
| 11 Strategische Planung | 2–4 | |
| 21 Machbarkeit | 3–5 | |
| 22 Auswahlverfahren | 3–5 | an open design competition runs about twelve months, and the award follows it |
| 31 Vorprojekt | 2–4 | |
| 32 Bauprojekt | 3–6 | |
| 33 Bewilligungsverfahren | 2–6 | a building permit averaged 140–160 days in 2023 and passes a year in the cities; an objection stretches it much further |
| 41 Ausschreibung | 2–4 | |
| 51 Ausführungsprojekt | 2–4 | |
| 52 Ausführung | 6–16 | a Teilsanierung inside two years, a Gesamtsanierung of a building that stays in use, four or more |
| 53 Inbetriebnahme | 1–2 | |

`paceOf(size)` multiplies all of them. Money is half of it — a three-million
Instandsetzung is decided and built while a thirty-million Gesamtsanierung is
still in its permit procedure. The other half is a separate draw for everything
money does not explain: a listed façade, a site that stays in operation through
the work, an objection that goes to court. End to end a project runs roughly six
to fourteen years.

The chain always runs to the end, however far past the window that is. Stopping
at the edge meant a project beginning in 2029 was generated with two phases and
no end — the plan claimed it was finished when it had only run out of paper.
What lies beyond is dropped when the bars are written, and the last bar still
inside is marked as continuing.

Build the chain once and **shift** it; do not draw it twice. `chain()` rolls new
durations on every call, so measuring a chain and then rebuilding it placed a
twenty-quarter project as though it were thirty — far enough off the near edge
that one project came out with no bars at all.

### What is deliberately wrong

A demonstration portfolio has to show the problems the tool exists for:

- **Gates with no forecast at all.** Not late — undated. This is what actually
  stalls a project for years, and it clusters where the decision is not the
  office's to make: on the Bedürfnis and on the Baukredit.
- **Late gates**, each with a reason drawn from `REASONS`.
- **Projects with no lead**, because that case has to stay visible.
- **People over their contract**, because the peak is what the tool is for.

The team is not guessed at: the roster is solved for, so that the portfolio at
full stretch runs at `PEAK_UTILISATION`.

### Dates, not quarters

A gate falls on a day. `dayIn(qi)` picks one inside the quarter, weighted
towards its closing weeks, because that is when boards sit and credits are
released. The view draws each diamond at its date rather than at the end of the
quarter it falls in — which at year scale had been throwing a gate up to three
quarters forward, into the middle of a bar's name.

### What it writes

`data/meta.json` (the quarter list only), `projects.json`, `people.json`,
`capacity.json`, `milestones.json`, `dashboard.json`, `changes.json`.

Everything else in `data/` is hand-written and untouched: `i18n.json`,
`phases.json`, `print.json`, `openapi.json`.

### After a run

The app reads the files directly, so a reload is enough. Worth checking:

- the utilisation line the generator prints — a peak somewhere above 100 with
  room around it, not a flat wall
- `docs/` for the review that covers whatever you changed
- the harness, if you have it: the flow suite asserts the horizon rather than a
  fixed number of quarters, so it survives a wider window
