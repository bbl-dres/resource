# Design-Review — Planung (kombiniert)

**Wireframe:** `docs/wireframes/260829_Planung-kombiniert.html`
**Method:** 12 independent reviewers — five stakeholder seats (senior UX, ePPM domain expert,
individual Bearbeitender, team leader, department management) and seven craft lenses (contrast,
spacing, typography, consistency, clarity, control placement, user flow) — each working from 34
state screenshots, computed contrast/size measurements, and the source.
Every finding was then put to three adversarial judges (evidence / scope / trade-off) and had to
carry two of three votes to survive.

**Funnel:** 94 raw findings → 51 clusters → **37 survived**, 14 rejected. 168 agents.

---

## Read this first — three recommendations contradict your own decisions

The reviewers did not know the history of this file. Three of their top recommendations undo
something you asked for earlier, so they are **not implemented**; they are decisions for you.

| Reviewers recommend | You decided | Status |
|---|---|---|
| Draw the per-person overload flag on value cells (`.pcell--val.is-warn`) | *"Remove the `class='warnmark'`"*, remove the "Nur Überlast" filter, hide the Ampel column by default | **Not implemented.** See "Überlast" below. |
| Turn `Phasenbalken` on at boot | *"to not overwhelm users — let's hide the Phasenbalken by default as well"* | **Not implemented.** |
| Raise the phase-band label from 10px to 11px | *"Schriftgrösse = 10 when in bottom position"*, settled explicitly | **Not implemented.** |

### The Überlast question is the real one

This is the review's largest finding, and it is a genuine consequence of a deliberate choice.
Verified against the file:

- `js/views-overview.js:327` puts `is-warn` on a value cell when the assignee is over 100 % in
  that quarter. **164 of 389 cells carry it.**
- The class is announced — every such cell's `title` and `aria-label` end
  `— Person über 100 % belegt, Überlast`.
- **There is no `.pcell--val.is-warn` rule in `css/main.css`.** Rules exist for
  `.pcell--load.is-warn`, `.capband__cell.is-warn` and `.facts dd.is-warn`, but not for grid cells.
  This is true at `HEAD` too — removing the ▲ marker left the class orphaned.

So a screen-reader user is told which cells are overloaded and a sighted user is not. That
inversion is worth deciding about on purpose. If you want it back, the honest form is **not** the
old ▲ — a 3px inset rule on the cell's leading edge keeps the fill free for the pensum/phase
encoding, survives `Farbe: Keine`, and prints. One line of CSS. Say the word.

---

## Independent verification of the concrete claims

I re-tested the mechanical claims in a browser rather than taking them on trust:

| # | Claim | Result |
|---|---|---|
| 1 | `Mir zugewiesen` does not tick | **Confirmed** — checked state `false` before and after a click |
| 2 | 42 milestone gates have `title` but are unhittable | **Confirmed** — `pointer-events: none` on band *and* gate; hit test returns `button.pcell` |
| 3 | Phase bars carry no `title` | **Confirmed** — 89 bars, 0 titles (the long label lives on the child `.wf-bar__label`, not the bar) |
| 4 | Cell tooltips state the wrong unit | **Confirmed** — root is `data-wf-unit="pct"`, cell prints `40`, title says `0,40 FTE` |
| 5 | Two tooltips still say `gesperrt` | **Confirmed** — 2 hits, `"laufendes Quartal, gesperrt"`, stale since the current quarter was made editable |
| 6 | `dropped-note` element missing | **Confirmed** — CSS and composing JS exist, 0 elements |
| 7 | Option-bar reopen glyph duplicates the `Gruppieren nach` glyph | **Confirmed** — both render `#i-layout-grid` |
| 8 | Two controls both labelled `Heute`, on one row | **Confirmed** — 845px apart, same row |
| 9 | Pensum legend swatches read as empty outlines (1.05:1) | **Not confirmed** — swatches carry a visible `rgb(164,168,176)` border; the cited ratio could not be reproduced |

---

# Review — Planung (kombiniert), Wireframe 260829

**Scope.** One merged `Planung` tab combining the old `Übersicht` pensum heatmap and the old `Termine` bar plan. Reviewed against 34 screenshots, computed contrast/size measurements, and the source (`docs/wireframes/260829_Planung-kombiniert.html`, ~465 KB).

**Method.** 51 candidate findings from five domain seats and six craft lenses. Each was put through adversarial verification against the actual artefacts. 37 survived, 14 were rejected as factually wrong, out of scope, or self-defeating. Severities below are the verifiers' consensus, not the raisers' claims — several were downgraded, one was raised.

---

## 1. Verdict

**This is a good wireframe, and the merge works.** The strongest quality is that the merge is *free*: `--wf-band-h` carves the 14px phase band out of the existing 39px row rather than adding a second line, so `04-values-bars.png` shows pensum figures and an ePPM bar plan at the same density as the old heatmap. Row pitch is 39px with bars off and 39px with bars on. That is the whole argument for merging two tabs, and it is delivered.

The craft underneath is also unusually careful. Contrast never becomes a problem — the lowest genuine ratio in `measurements.json` is 4.74:1 and grid figures run 12.5–17.7:1. The colour work is reasoned in the source, not guessed: the bar ground was moved to a true neutral `#eeeeee` specifically because it was measuring dE 2.2 from `heat-1` and reading as a low pensum value. The type scale refuses weight 500 because Segoe UI has no Medium. Bar labels are measured at runtime by `fits()` rather than from a width table, because "bar widths are percentages of a stretching axis." This is a wireframe made by someone who checked.

**The central problem is that the merged tab does not answer the question its name promises.** `Ressourcenplanung` cannot tell you, anywhere in its grid, whether a person is over capacity. The data is there — `DATA.people[].load` / `.employment` for all 16 quarters — and 164 of 389 value cells already carry `class="… is-warn"` with `title="… Person über 100 % belegt, Überlast"`. There is no CSS rule for `.pcell--val.is-warn` anywhere in the file. The signal is computed, attached to the DOM, announced to screen readers, and drawn as nothing. Fixing that one gap resolves the largest finding in this review and dissolves the review's most contested argument at the same time.

The second problem is smaller and cheaper: the merge is invisible at boot. `Phasenbalken`, `Meilensteine` and `Heute` all ship off, and the frozen `Phase (ePPM)` column ships off too, so `01-boot-full.png` is the old `Übersicht` heatmap. A stakeholder who never ticks a box never learns the Gantt is in there.

---

## 2. Was funktioniert

Specific, verified, and **not to be touched**:

- **The band costs zero row height.** `--wf-band-h: 14px` is taken out of the value cell by `padding-bottom`, not added to the row. Measured pitch is 39px in `01-boot-full.png` and 39px in `04-values-bars.png`. The source records that the two-line alternative cost 63 % of the row — 8 projects visible instead of 13.
- **The bars-only reading is the best single state in the file.** `07-bars-only.png`: `Pensumwerte` off and the bars swap `data-lab-short` for `data-lab-long`, printing `32 Bauprojekt`, `33 Bewilligungsverfahren`, `41 Ausschreibung` in full, measured per bar. No legend needed to read it.
- **The ePPM model is correct and complete.** Sub-phases 11 / 21+22 / 31+32+33 / 41 / 51+52+53 / 61+62+63 grouped under `1 Strategie … 6 Bewirtschaftung`, gates placed on phase boundaries rather than floating inside a phase, and the milestone set (MS3 Vorprojekt genehmigt … MS7 Übergabe Bewirtschaftung) is the right set with the right vocabulary. A BBL planner reads this without a key.
- **The Auslastung arithmetic is honest.** `Q3/2026: 112 % — Überlast · 4150 % gebucht auf 3705 % netto` divides booked demand by *net* capacity, not headcount. Netto (after Ferien, Ausbildung, Linienaufgaben) is the correct denominator and the tooltip exposes both terms.
- **`Blau (Grösse)` as the default Farbskala is the right call**, and the source says why: "die Zahl ist ein Bedarf, keine Bewertung." A per-project pensum is a demand figure; a magnitude ramp is the honest encoding for it. Keep it as the default.
- **The edit popover is finished work.** `28-edit-popover.png`: project / person / role / quarter restated as a header, ±5 stepper flanking a large numeric field with `%` inside it, `Begründung — Pflicht bei Überlast` stating the governance rule at the point of entry, `An andere Person umbuchen` as the escape hatch, Übernehmen disabled until something changes.
- **The person picker asks the right question at the right moment.** `29-person-picker.png` sorts candidates by utilisation *ascending* — "most room first" — with an Ampel dot and role per row, and states the outgoing person's load (`Aktuell: Olivia Musterli · 140 %`) in the same breath.
- **Filter state is fully externalised.** Named chips with per-chip ×, `Alle Filter zurücksetzen`, a count pill on `Teilportfolio`, and `22 von 111 Bauprojekten` — all visible without opening a menu. Most enterprise grids hide this behind a badge.
- **Vertical hairlines only at year boundaries.** Equal pensum values merge into one continuous band across quarters, which is the actual shape of the data. Fifteen quarter rules would have laid a second grid over the heatmap. Do not add them.
- **The `Summe · Auswahl` / `Auslastung · Gesamtportfolio` split is conceptually right.** Two different populations, each labelled, with a `prow__sumnote` divider that exists specifically because the two rows once read as one running total. The concept is correct; only its typographic rank is wrong (see M8).
- **The legend follows the fill.** `[data-wf-colour="pensum"] [data-wf-legend="phase"] { display: none }` means the key never explains a colour that is not on screen. Correct mechanism — it just needs one more trigger condition (M4).
- **`Farbe: Keine` (`13-colour-none.png`) is a complete, high-contrast fallback**, not a degraded state. A reader who can use none of the colour encodings still gets the whole table, the bars, and the sub-phase numbers.
- **The responsive column-yield ladder** drops whole columns by declared priority rather than squeezing them to illegibility, and restores them on resize. `YIELD = ['portfolio','credit','phase','lead','title']` with `MIN_PERIODS = 3` and ID as an undroppable floor. `33-tablet-768.png` shows it firing correctly.
- **Overlay hygiene:** one `closeOverlays()` owner for menu, popover and picker; dismissal on Escape, outside click and scroll; and the wireframe's own review controls live outside `#app` so they can never be mistaken for product chrome.

---

## 3. Findings

Format: **claim → evidence → why it matters → fix → effort → vote.** Vote is the adversarial-verification result plus the severity spread across verifiers.

### BLOCKER

#### B1 — Per-person load is computed everywhere in the data and rendered nowhere in the grid

- **Claim.** A person's quarterly utilisation exists for all 16 quarters in `DATA.people[].load` / `.employment`; 164 of 389 value cells already carry `is-warn` meaning "Person über 100 % belegt"; and none of it is visible. There is no `.pcell--val.is-warn` rule, no per-person row, no per-person column. The only place the number surfaces is the reassignment popover.
- **Evidence.** Source `:4928` — `oliviamusterli` employment 100, `load[0]=140`; `ursinamuster` load `[110,115,115,155,155,155,…]`. `01-boot-full.png` row 5637 (Ursina Muster) reads 65·65·65·75·75 while she is at 155 %. `29-person-picker.png` states `Aktuell: Olivia Musterli · 140 %` while her row 7062 behind it shows a calm blue 40. Verified counts: `pcell--val` = 389; the only `is-warn` CSS rules are `.pcell--load.is-warn` (:1625), `.facts dd` (:1819), `.capband__cell` (:2172), `.sheet__row--load` (:2576). `capband` occurs **zero** times in markup — dead CSS from another view. `utilOf()` at :5351 is `load[q]/employment*100` and is called at exactly two sites, both inside the person picker.
- **Why it matters, and for whom.** Reading the grid the way it is designed to be read produces the wrong answer confidently. `17-scale-ampel.png` paints Olivia Musterli's row **green** at 40·55·55·30 while she runs 140/155/155/130 %. `16-scale-warnung.png` — the scale a stakeholder would reach for when asking "who is overloaded" — leaves her entirely calm blue. Meanwhile `28-edit-popover.png` makes a Begründung **mandatory on Überlast** and never shows the number that triggered it. The page gates an action on a state it refuses to display. The Ressourcenplaner and the Teamleiter both lose; the Bearbeitender with `Mir zugewiesen` on sees only the department's 112 %, which looks like an answer and is not one.
- **Fix.** Draw the flag the file already computes, on a channel that is not the fill so it survives `Farbe=Phase`, `Farbe=Keine` and all three Farbskalen:
  ```css
  .pgrid .prow > .pcell--val.is-warn { box-shadow: inset 3px 0 0 var(--color-danger-solid); }
  ```
  Note the load: 164 of 389 cells (42 %) carry the class, so a per-cell rule is dense. The better shape may be to put a single Ampel dot before the name in the frozen `Bearbeitender` column — 22 marks instead of 164, reusing the dot the person picker already draws, on the person rather than on an innocent 25 % cell. Add one legend item so the mark is decodable. Then, separately, put `Auslastung <Person>` on the per-group footer row under `Gruppieren nach: Bearbeitender`, reusing the existing `.pcell--load` band styling.
  Do **not** implement the raiser's "Überlast line is 80 for an 80 % Bearbeitender" caveat — `utilOf` already normalises, so 100 is correct.
- **Effort.** Small for the mark; medium for the per-person rows.
- **Vote.** 3/3 survive. Severity spread: major / major / blocker. I am calling it a blocker because the tool is named Ressourcenplanung and its grid cannot answer the resource question, and because one of its offered colour scales answers it *wrongly*. Two of three verifiers would have said major; the split is worth knowing.

---

### MAJOR

#### M1 — Default `Farbskala: Blau (Grösse)` cannot show overload, and the alternative that can is hidden *(contested — see §4)*

- **Claim.** In `Blau`, a 110 % cell and a 30 % cell differ by 1.21:1 in background luminance. The band boundary sits at 120 %, and `pcell--val heat-4` occurs **0 times** in the file — the darkest step never paints, so the ramp actually on screen is three steps inside 1.21:1. The scale that separates the top band lives only in the hidden design option bar.
- **Evidence.** `measurements.json`: `cellv "30"` on `rgb(238,248,255)`, `"110"` on `rgb(206,228,253)` — computed 1.209:1. Source line 4 `data-heat-scale="blau"`; `:5240` `v<40?heat-1:v<80?heat-2:v<120?heat-3:heat-4`. `15-scale-blau.png` vs `16-scale-warnung.png`: rows 1940 and 1611 run 110 across all twelve visible quarters and are indistinguishable in Blau. Farbskala appears only in `26-optionbar.png`, and `data-wf-options="off"` hides that bar at boot.
- **Why it matters.** Finding who is over capacity is why the tab is opened. In the default state you must read 16 numbers per row across 22 rows. **But** the counter-argument from the Teamleiter is real: 80 %/120 % are person-capacity thresholds applied to a quantity that is not capacity — one project's claim on one person.
- **Fix.** Keep `Blau` as the default. **Do not** flip to `Warnung`: verification showed all three scales share the same 40/80/120 band edges (`[data-heat-scale="warnung"]` overrides only the hex, not the breaks), so `Warnung` paints row 0044's healthy 80 % the same amber as row 1940's 110 % — wrong on both rows the contest is about. The correct fix is B1. Once `.pcell--val.is-warn` is drawn, the reason to promote Farbskala into the time bar disappears. Optionally drop the `ab 120 %` legend swatch, which advertises a state no cell occupies.
- **Effort.** Small (subsumed by B1).
- **Vote.** 3/3 survive, all three verifiers at major. Raised by 4 seats; contested by the Teamleiter.

#### M2 — Six of seven toolbar dropdowns are inert but look identical to the one that works

- **Claim.** `Sortierung`, `Gruppieren nach` and all four filter buttons carry the same pill, chevron and `aria-haspopup="menu"` as `Spalten & Einheit`, but only `Spalten & Einheit` opens anything.
- **Evidence.** Source `:5038` — `app.querySelector('button[data-act="menu"][data-val="attr"]')`, singular. The delegated handler ends in `e.preventDefault()` for everything else. `27-attr-menu.png` is the only toolbar shot with a panel. **`30-group-menu.png` and `31-filter-menu.png` were captured as "the menu, open" and show no menu at all — the screenshot harness itself fell for the affordance.** That is the strongest available evidence.
- **Why it matters.** This page was mailed out to collect feedback on a tab merge that rests on grouping. "Kann ich nach Bearbeitender und nach Organisation gruppieren?" cannot be answered from the wireframe, and half the room will spend its feedback budget reporting that the filters are broken. Worse: `<input type="checkbox" data-act="my-projects">` is caught by the same `preventDefault`, so it **will not even tick**, sitting 86px from four identical-looking checkboxes that all do. That reads as a bug, not as unbuilt scenery.
- **Fix.** (a) Fix the checkbox first — remove its `data-act` so it ticks natively, or mark it `disabled`. One line. (b) Ship one real static panel for `Gruppieren nach` only, cloning `#wf-attr-panel` into the already-present empty `.dd[data-menu="group"]` host: Teilportfolio / Bearbeitender / Organisation / Phase (ePPM) / Keine, current choice marked. (c) For the rest, change the delegated fallback from a silent `preventDefault()` to a small anchored note — "In diesem Prototyp nicht schaltbar" — which covers all ten dead surfaces including the two chip ×, `Alle Filter zurücksetzen`, Exportieren and Teilen. Do **not** strip the chevrons or grey the filter buttons: their labels are the only place the page names the filter dimensions.
- **Effort.** Small.
- **Vote.** 3/3 survive, all three at major. Raised by 4 seats.

#### M3 — The merge is invisible at boot: every Termine layer ships off and the ePPM phase appears nowhere

- **Claim.** `data-wf-phases` / `gates` / `today` are all `"off"` at boot, and `cols.phase = false`, so the merged tab renders exactly the old `Übersicht` heatmap — and the single attribute that explains a project's resource profile appears in neither the column nor the band.
- **Evidence.** Source line 3–4 and `:4936`. `01-boot-full.png` and `03-values-only.png`. Critically: `:2970` sets `--wf-band-h: 0px` when phases *and* gates are both off, so at the shipped default the band lane has zero height. The source comment at `:4932` justifies hiding the Phase column by pointing at the band — "the band under the numbers already says «31»" — and the defaults on line 3 switch that band off. **A design rationale voided by the same file's defaults.**
- **Why it matters.** A first-time user forms the model "this is the pensum table" and never discovers the Termine half; the merge then costs complexity and delivers nothing at the default. And a planner reading row 1940 at a flat 110 % across 16 quarters cannot tell whether that is `52 Ausführung` (a full-time Bauherren-PL, normal) or `31 Vorprojekt` (absurd).
- **Fix.** Set `data-wf-phases="on"` on line 4. Verified free — the band is carved from the row, not added to it. Leave `Meilensteine` and `Heute` off. State the invariant in the file: never ship the band *and* the Phase column both off. Also gate the `Meilenstein — Gate auf Plantermin` legend group on `data-wf-gates`, since at boot it explains a diamond that is drawn nowhere. Do **not** collapse the four checkboxes into a segmented `Ansicht:` control — that destroys states the wireframe deliberately renders (`07`, `08`, `09`, `10`) and `Heute` is a time reference, not a Termine layer.
- **Effort.** Trivial for the default; the control redesign is rejected.
- **Vote.** 3/3 survive, all three at major.

#### M4 — The `Phase (ePPM)` key is hidden by the colour switch, so the bar codes have no key

- **Claim.** `[data-wf-colour="pensum"] [data-wf-legend="phase"] { display:none }` binds the phase legend to `Farbe`, but the codes it decodes are drawn by `Phasenbalken`. With bars on and `Farbe=Pensum` — the composite reading the merge exists for — the bars print `22/31/32/33/41/51/52` and the only key is suppressed.
- **Evidence.** Source `:3325-3327`. `04-values-bars.png` shows the bare codes; `25-legend.png` in that state lists only Pensum, Meilenstein, Bearbeitender and Auslastung. `.wf-bar` carries **no** `title` (unlike `.wf-gate`, which has 19), so there is no hover fallback. Verified: the `data-lab-long` string `"41 Ausschreibung"` is already sitting on every bar element.
- **Why it matters.** A planner sees `41` and cannot learn it means Ausschreibung without switching `Farbe` to Phase, which repaints the whole grid and destroys the pensum reading. The merge's promise is reading load and schedule together.
- **Fix.** Two moves. (1) `el.title = el.dataset.labLong` inside the existing `setText()` loop — the string is already in the DOM, this matches the pattern `.wf-gate` already uses, and it is the only fix that also covers the short bars whose label `fits()` blanks entirely. (2) Narrow the hide selector to `[data-wf-colour="pensum"][data-wf-phases="off"]` so the key appears when bars are drawn. Note the raiser's claimed "mirror error" does not exist: with `Farbe=Phase` and bars off, the *cells* are tinted by sub-phase (`14-colour-phase-nobars.png`), so showing the key there is correct. Do **not** default the `Phase (ePPM)` column on — it costs 152px of frozen width and shows only the project's *current* phase, decoding at most one of the six codes in a row.
- **Effort.** Trivial.
- **Vote.** 3/3 survive. Spread: minor / major / major.

#### M5 — The Auslastung row averages away the overload it exists to expose

- **Claim.** A single aggregate ratio per quarter is compatible with an evenly loaded department and with one where half the staff are at double capacity.
- **Evidence.** Source `:4775-4820` renders 112, 107, 105, 102, 103, 98, 99, 97, 102, 94, 91, 90, 91, 82, 77, 80 %. Recomputed from `DATA.people` (44 people): in Q3/2026 where the row says 112 %, **21 of 44** are booked above their own contract, worst at 206 % (Aline Mustermann, 165 % on an 80 % contract). In Q3/2028 the worst is 255 %. In Q2/2030, where the row says 80 % and `25-legend.png` calls that `ok`, **13 of 44** are still over contract.
- **Why it matters.** A department head reads 112 % → 77 % as "tight now, easing after 2028" and does not hire. Recomputed excess above contract runs 520 % in Q3/2026 and 490 % in Q2/2030 — flat — while idle capacity nearly triples. The fall from 112 % to 80 % is produced almost entirely by growing slack on the under-booked half. An FTE budget decision would be made on a number that is true and useless.
- **Fix.** Add one row under Auslastung, as a **volume pair** rather than a headcount: `Überlast / freie Kapazität · Gesamtportfolio`, per quarter `5,2 / 3,6 FTE` … `4,9 / 10,2 FTE`. A count row (`21 / 44` → `13 / 44`) reproduces the same flattery — it looks like a 38 % improvement that the volume denies. Give the new row its own `prow__sumnote` naming its denominator, because the existing Auslastung row divides by *net* capacity while `overloaded()` divides by gross contract — do not silently stack two bases. And wire the existing dead `Details anzeigen` button (`data-act="foot-details"` has no handler) to a per-person breakdown.
- **Effort.** Medium.
- **Vote.** 3/3 survive, all three at major. Raised by 1 seat (Department management) but verified exactly on the data.

#### M6 — All seven milestone types draw the same diamond, and their names are unreachable

- **Claim.** Seven semantically distinct gates render as identical 11px diamonds whose identity lives only in a `title` that `.wf-band { pointer-events: none }` suppresses. No `tabindex`, no `role`, no `aria-label` — unreachable by hover, keyboard and screen reader alike. The legend names them with one term: `Gate auf Plantermin`.
- **Evidence.** Source `:2988`, `:3033-3041`; 42 gates across seven types, all `<div class="wf-gate" title="MS4 · Baukredit bewilligt">`. Grep confirms `pointer-events` is never restored on `.wf-gate`, and the strings `Baukredit bewilligt`, `Übergabe Bewirtschaftung` etc. appear nowhere else in the file. `08-bars-gates-only.png`: the `--wf-gate-clear` reservation truncates bar labels to `3..`, `5..`, `33 Bewilligun...` to make room for marks that say nothing. `09-gates-only.png` is the worst case — bare diamonds with no bar to infer from.
- **Why it matters.** MS4 `Baukredit bewilligt` is the point past which money may be spent and the event that unlocks the resource ramp. On this page it is the same mark as MS7 handover, and it costs three readable phase names to be so. Turning `Meilensteine` on is a **net loss of information**.
- **Fix.** Four cheap moves, none requiring 42 tab stops. (1) `.wf-gate { pointer-events: auto }` plus `role="img" aria-label="MS4 · Baukredit bewilligt, Q4 27"` — announced in reading order, not inserted into the tab sequence. Note the cost: the gate becomes an ~11px dead zone over an editable pensum cell. (2) Differentiate by fill using vocabulary that already exists but is unused in the grid: `.diamond.is-open` (hollow, `:2137`) for ordinary gates, solid for MS4 — the one gate every seat scans for. (3) Put the ladder in the legend as a **gate-to-phase mapping**, not a bare list: `◆ MS4 Baukredit bewilligt — Ende 33 Bewilligungsverfahren · ◇ MS3 (Ende 31) · MS5 (Ende 41) · MS6 (Ende 52) · MS7 (Ende 53)`. Now any diamond resolves from the bar it sits on, at zero row width. (4) With no text beside the marks, cut `--wf-gate-clear` from `-17px` to ~`-13px` and the truncated labels come back. Drop the 11px→9px proposal — 0.78px of overhang is invisible.
- **Effort.** Small.
- **Vote.** 3/3 survive, all three at major.

#### M7 — The four-year horizon is unreachable: `Jahr` is inert, the pager is disabled, the scrollbar is suppressed on purpose

- **Claim.** 16 quarters span a track behind a ~608px frozen block, so roughly 28 % of the horizon is off-screen at 1500px and two thirds at 1024 — while the scrollbar is deliberately hidden, `‹` and `Heute` carry `disabled`, `›` has no handler, and `Jahr` has no handler either.
- **Evidence.** Source `:805-811`: `[data-scroll] { scrollbar-width: none }` with the comment *"No scrollbar. Stepping the window with the arrows beside «Heute» is the way through time."* `:3638` `Jahr|Quartal data-act="scale"` unbound; `:3642-3644` nav buttons disabled/unbound. `01-boot-full.png` cuts mid-column at `Q2 2` with the values 75 and 110 sliced. `32-tablet-1024.png`: 5 of 16 quarters.
- **Why it matters.** A reviewer on a desktop mouse cannot see the second half of the horizon they are being asked to plan against. The management reading is the year — is 2029 heavier than 2027 — and scrolling right loses 2026, so the first year and the last can never be compared. That is the comparison that distinguishes a spike from a trend. The page deletes its own scrollbar and names the arrows as the replacement, then ships the arrows dead.
- **Fix.** (1) Un-hide the scrollbar on `.pgrid` now — one line, and the justification for hiding it is currently void. (2) Bind `data-act="period"` to `scrollLeft ± 4 × colWidth`; `alignScrollers` and `syncScrollFades` already propagate to the other cards, and drive the `disabled` state from position rather than hard-coding it. (3) Print the window between the arrows — `Q3 26 – Q2 30` — the readout every sibling control group has and this one lacks. (4) Bind `Jahr`, but keep `Quartal` the boot default: phase bars are positioned on exact quarter fractions and the cell editor edits a quarter, so a year default makes `Phasenbalken` and `Meilensteine` unreadable. A year cell must state what it aggregates. Correct two errors in the raiser's framing before circulating: the frozen block is 608px (not 1028 — that value is pre-JS), and the horizon ends Q2/2030, not 2029.
- **Effort.** Medium.
- **Vote.** 3/3 survive, all three at major.

#### M8 — `Summe Total · Auswahl` and `Auslastung · Gesamtportfolio` are stacked, look identical, and count populations five times apart

- **Claim.** Two adjacent footer rows of identical typographic weight report on the 22 filtered projects and on all 111 respectively; the Auslastung row does not move when the filter moves; and the only marker of the switch is a 12px grey side-note.
- **Evidence.** Source `:4762-4780`. `measurements.json`: both labels are 13px/600 (`prow__sumlabel` at 16.54 and 13.69 contrast), while `span.prow__sumnote` is 12px/400 at 5.0 — the two words carrying the entire population distinction are the smallest, faintest text in the block. The page boots `data-wf-unit="pct"`, so the default a stakeholder actually receives is **`1'035 %` stacked directly above `112 %`** — same glyph, two denominators. `resum()` rebuilds `.prow--sum` from rendered rows and explicitly excludes `.prow--load`.
- **Why it matters.** A planner filtered to `Bildung und Forschung` reads `112 % — Überlast` as that portfolio's overload and escalates the wrong thing. The number actually wanted — utilisation of the people in the current selection — is produced nowhere while the layout implies it is. The author already anticipated this: the comment at `:2202` says the note exists because *"«Bedarf total · Auswahl» sitting above «Auslastung · Gesamtportfolio» read as one running total."* The mitigation is simply too weak.
- **Fix.** Promote the population to label rank, at 13px/600, and adopt the convention the page already uses two rows earlier (`Summe Bildung und Forschung (12)`): `Summe Bedarf · Auswahl (22 von 111)` and `Auslastung — ganze Abteilung, unabhängig vom Filter`. Say "unabhängig vom Filter" in plain words — `Gesamtportfolio` names a population, but a reader who has just filtered needs to be told the row ignores what they did. Move the existing `Details anzeigen` link onto the Auslastung row, which is the row with a hidden denominator. Do **not** add an `Auslastung der Auswahl` row without first defining it — see §4.
- **Effort.** Small.
- **Vote.** 3/3 survive. Spread: major / major / minor.

#### M9 — `700 %` adds percentages belonging to twelve different people

- **Claim.** Group and total sum rows add pensum percentages across different people's capacities and print the result as a single percentage. The alternative rendering is already stored on the same cell.
- **Evidence.** `01-boot-full.png` row `Summe Bildung und Forschung (12)`: 700 %, 730 %, 705 %, 755 % … over eleven distinct Bearbeitende (Katja Muster holds two of the twelve rows — correct the "twelve different people" phrasing before circulating). Source `:4242` stores both `data-wf-pct="700 %"` and `data-wf-fte="7,00 FTE"`, and the default hides the second.
- **Why it matters.** `700 %` invites a stakeholder to read a seven-fold overload where the correct reading is a demand of 7,0 Vollzeitäquivalenten — and it sits directly above an Auslastung row where `%` genuinely means a ratio. `25-legend.png` compounds it: the Pensum bands top out at `ab 120 %`, and the footer prints `1'035 %`, ninefold off the only scale the page gives the reader.
- **Fix.** Cheapest and safest: rename the demand rows from `Summe …` to `Bedarf …` (`Bedarf Bildung und Forschung (12)`, `Bedarf total · Auswahl` — the wording the source's own CSS comment already uses), and add a legend entry `Bedarf — Summe der Pensen (700 % = 7,0 FTE)`. This puts the distinction where a reader looks to find out what a row is, keeps every column additive in both units, and does not fork the unit toggle. If stakeholders confirm the misread persists, the escalation is to make FTE the boot default (`data-wf-unit="fte"` on line 4, one attribute) rather than to decouple units per row type — decoupling would leave cells reading `40, 65, 110` under a total reading `7,00 FTE`, destroying the one property a total row exists to have.
- **Effort.** Trivial.
- **Vote.** 2/3 survive. Spread: major / major / minor.

#### M10 — Thirteen phase tints in a 39px cell, seven pairs closer than dE 4.2 — and with bars off the colour is the only carrier

- **Claim.** The palette asks a cell tint to carry thirteen sub-phases. Within families: 31/32 dE 3.75, 51/52 3.64, 61/62 3.55. Under deuteranopia, **32/41 is dE 0.23–0.33 — identical**; 31/51 is 0.9; 21/51 is 1.0. The legend resolves only six groups, as unlabelled swatch clusters.
- **Evidence.** Source `:3247-3260` `PHASE_TINTS`, legend markup `:4815`. `12-colour-phase.png` (bar codes are the only sub-phase evidence) and `14-colour-phase-nobars.png` (teal, pale blue, lavender and mauve cells with no bar, no code, nothing to key them). Additionally verified: value cells carry `data-wf-phase` but their `title`/`aria-label` never name the phase, so there is no hover or screen-reader path in the bars-off state.
- **Why it matters.** `3 Projektierung` and `4 Ausschreibung` are the same colour for a deuteranope — and that is the transition the load spike hangs on. The file states its own rule at `:3226`: *"every neighbouring pair at least dE 6 apart under a deuteranope simulation,"* and rejects an earlier Ampel candidate at dE 3.4 as *"no distinction at all."* This palette misses that bar by an order of magnitude. BBL is bound by P028/eCH-0059, so a primary encoding that collapses for deuteranopes is compliance, not preference.
- **Fix.** Do **not** collapse to six family tints — the within-family boundaries in `14-colour-phase-nobars.png` land exactly on the pensum steps and are how the colour explains the numbers. Instead: (1) push the *families* apart — target ≥ dE 6 deuteranopic between adjacent families, spending lightness on the family axis and hue on the sub-step, which is the inverse of what the palette does now; the must-fix is 32/41. (2) Put the codes on the legend swatches: `3 Projektierung: 31 32 33`. (3) Append the phase to the cell `title`/`aria-label` — the string exists on every cell — which gives a per-quarter naming path in exactly the bars-off state, at zero screen cost. This is the highest-value line in the whole fix.
- **Effort.** Medium.
- **Vote.** 2/2 survive, both at major.

#### M11 — The edit popover hides the one number that decides whether Übernehmen is allowed

- **Claim.** `overloaded()` reads the person's load against their contract in order to arm a mandatory Begründung and disable Übernehmen — and the popover displays neither number.
- **Evidence.** `28-edit-popover.png`: `Olivia Musterli · Projektleitung · Q3/2026`, stepper, `Begründung — Pflicht bei Überlast`, nothing else. Source `:5195-5199` `overloaded()`, `:5202-5208` `paintPop()`. `DATA`: `oliviamusterli` employment 100, `load[0]` 140. **The popover opens on `pr195` at Q3/2026, where `over` is already true at the untouched value 40** — so the first cell a stakeholder clicks yields a greyed-out primary button with no error text. The same figure is already displayed two clicks away in `29-person-picker.png`.
- **Why it matters.** This is the exact moment of action. The planner meets a disabled button whose only clue is a four-word label change from `— optional` to `— Pflicht bei Überlast`. They then write a justification blind, or rebook to someone who is at 155 %. And in an emailed wireframe, a dead primary button on the first cell reads as "broken" and costs you the feedback.
- **Fix.** Fill the gap between stepper and Begründung with one always-visible line, reusing the footer's own wording and bands: `Auslastung Q3/2026: 140 % (Pensum 100 %)`, becoming `… 140 % → 155 % (Pensum 100 %)` once draft ≠ base. Show the arrow only after a change so the opening state does not fake a move. Drive it from `paintPop()` — factor `overloaded()` into a `loadAt()` returning `{before, after}` so the number read and the number gating cannot diverge. Two details: bump `H` in `openPop()` from 400 to ~424 or the taller popover overflows on low rows; and omit the line when `leadId === null` (pr126). Separately, raise as a **question**, not a fix: should reducing 40 → 20 on a person still at 120 % require a written Begründung? Right now it does, which punishes the remedy.
- **Effort.** Trivial.
- **Vote.** 3/3 survive, all three at major.

---

### MINOR

#### m1 — Cell tooltips and aria-labels are stuck in FTE while the page displays Pensum %
Root carries `data-wf-unit="pct"`, but all 389 value cells carry `title`/`aria-label` hard-coded to FTE (`… Q3/2026: 0,40 FTE`) on a cell that prints `40`. `applyUnit()` (`:5013`) rewrites only `.cellv` textContent. A screen-reader user hears a number 100× the one on screen; a hovering user gets a contradiction. **Fix:** rebuild the attributes in the same loop, or state both once: `Q3/2026: 40 % (0,40 FTE)`. Also extend the legend's `Pensum` dt with a denominator gloss — but write it correctly: `% einer Vollzeitstelle (100 % = 1,00 FTE)`, **not** "% der Kapazität des Bearbeitenden," because `DATA.people` contains 80 % and 60 % contracts and the two denominators must not be fused. **Effort:** trivial. **Vote:** 2/3; spread minor/minor/major. *(The raiser's broader claim — that nothing on screen names the unit — is false: the `Summe` row prints `%` in the same columns, the legend prints the bands, and the edit popover prints `40 %`.)*

#### m2 — The design questions the review exists to ask are behind an unlabelled corner icon, and some do nothing when found
The option bar holds sub-settings of two time-bar controls, is hidden by default, and its reopen button is a bare 36px `#i-layout-grid` — the same sprite that means `Gruppieren nach` in the toolbar. Its only name, `Entwurfsregler`, is aria-only. At 768px the button overlaps the `Summe` row. And because `Phasenbalken` is off by default, six of the nine buttons inside (`Hintergrund`, `Position`) are inert while looking selected — `.wf-opt.is-disabled` exists at `:3400` and is applied nowhere; `syncDependents()` is an empty stub. **Fix:** swap the glyph to a sliders icon; add a heading inside the bar — `Entwurfsvarianten — nur für dieses Review, nicht Teil des Vorschlags`; wire the dead `.is-disabled` class from `data-wf-phases`. Do **not** open the bar by default: `body { padding-bottom: 104px }` would tax the grid ~11 % of height on every screen for every reader, and it would put the six inert buttons in front of everyone. **Effort:** small. **Vote:** 2/3; spread major/minor/minor.

#### m3 — In the combined view the phase bars collapse to bare two-digit codes at 10px
With `Pensumwerte` and `Phasenbalken` both on, each row carries percentages at 13px over ePPM codes at 10px. `--text-xs` is 11px and is the floor every other label respects; `--tracking-caption` is documented at `:318` for "10px badges" and is never applied to `.wf-bar`. The stylesheet's own comment at `:3049` already prescribes *"16px, enough for the 11px name the Gantt uses"* — the tokens ship 14px/10px. **Fix:** `--wf-band-h: 16px`, `--wf-lab-size: var(--text-xs)`, plus `letter-spacing: var(--tracking-caption)` on the label so the codes scan as codes. Row arithmetic holds (38px content box, ~19px for the figure). Do **not** replace the four checkboxes with a segmented control. Do **not** lighten the label to `--color-text-muted` — it currently sits at ~13:1 on the band and lightening would cancel the size gain. **Effort:** trivial. **Vote:** 3/3; spread minor/major/minor. *(One evidence claim in the original was wrong: the single 10px entry in `measurements.json` is `hdr-notify__badge`, not the phase label — the capture ran with bars off.)*

#### m4 — `Heute` names three different things in one bar, and the one that is a verb is disabled
`06-all-on.png` has all three co-visible: a greyed scroll-to-today nav button at x≈251, a live visibility checkbox at x≈1181, and the badge that checkbox draws at x≈677. At 768px the button and the checkbox sit ~50px apart on consecutive wrapped rows. **Fix:** rename the *nav button* to `Zu heute` — the free move, since `24-timebar.png` shows ~430px of empty space to its right, whereas adding `-Linie` to the checkbox forces the `Farbe:` control to wrap at 768. Optionally do both. Keep the badge as `Heute`. Do not make the fix conditional on enabling the nav button — that belongs to M7, and `data-act="period"` has no handler at all. **Effort:** trivial. **Vote:** 3/3, all three minor.

#### m5 — The Auslastung row is far below the fold and never sticks
`chromeAboveGrid` 355 + 22 rows + headers + sums puts `.prow--load` at roughly y≈1500 in a 950px window — none of the 34 screenshots contains it. Grep confirms the only two `position: sticky` rules in the file are the *horizontal* frozen columns; nothing is pinned vertically, including the quarter headers. **Fix:** pin `.pblock--foot` (not `.prow--load` — `.pgrid` is `overflow-x: auto`, so its overflow-y computes to auto and a bottom-stuck child is a no-op). Pin only the Auslastung row's height, reserve `scroll-padding-bottom`, and check the option-bar reopen button's z-index. Separately and more cheaply: the footer card contains **no `prow--head`**, so once you reach the Auslastung row there are no quarter labels on screen at all — `112 %` cannot be attributed to a quarter without counting columns. Repeat a compact quarter strip in the footer card. **Effort:** small. **Vote:** 3/3; spread major/minor/minor.

#### m6 — At 390px the row identity disappears and the note written to explain it never renders
Below ~634px `applyColumns()` drops `Projekt`, `Bearbeitender` and `Kredit CHF`, leaving each row identified only by a four-digit ID — confirmed in `34-phone-390.png` (rows 7062 / 5637 / 1940 / 7770 …). And the `n Spalten ausgeblendet, das Fenster ist zu schmal: …` message the JS carefully composes at `:4990` **is never shown**: `grep -c 'class="dropped-note'` returns 0. The element exists in CSS (`:1309`, `:1314`) and in the JS query, and nowhere in markup. This fires at 768px too, where `Kredit CHF` vanishes silently. **Fix:** add one `<p class="dropped-note">` — put it once, in the filterbar row beside `22 von 111 Bauprojekten`, since the note describes the window, not a group (there are 13 `.pgrouphead` blocks). The column-priority question is contested; see §4. **Effort:** trivial for the note. **Vote:** 3/3; spread major/minor/minor.

#### m7 — 355px of chrome before the first project row, from bands that are half empty
Eight stacked bands consume 355px — 37 % of a 950px window — and two are largely empty at 1500px: the filterbar is blank from x≈626 to x≈1340, the time bar from x≈327 to x≈762. At 1024 the toolbar wraps and the first data row lands at y≈466, leaving 8 of the 12 rows in the first group. **Fix, corrected:** the desktop case is not the problem — `01-boot-full.png` shows all 12 rows *and* the group `Summe` row above the fold. The regression is the 700–1100px band, where `flex-wrap: wrap` turns two bands into four. The author already solved this one breakpoint lower: extend the existing `@media (max-width: 700px)` sideways-scroll rule up to 1100px, recovering ~92px in the only viewport that needs it. Do **not** fold the filter chips into the toolbar (`flex-wrap: nowrap`, no slack, labels already ellipsize) or move the group heading into the column-header row (it would displace the sort controls). **Effort:** small. **Vote:** 3/3, all three minor.

#### m8 — `Mir zugewiesen` is a filter that wears none of the filter vocabulary
It narrows the row set exactly as the four filter pills do — it is a shortcut for one value of the `Bearbeitender` filter to its left — but it contributes no chip to `Aktive Filter:` and is not visibly covered by `Alle Filter zurücksetzen`. **Fix:** the parity requirement, stated for all filters: every active filter appears as a removable chip and is cleared by the reset link, including this one as `Nur meine Projekte ×`. Do **not** restyle or relocate the control — the checkbox affordance is deliberate (the source comment reads *"A filter you switch on, not a mode you enter"*), and the checked state (semibold, 15.67:1) is the clearest state indicator in the toolbar. The "weakest-looking control" evidence was a misreading: the 13px/400 measurement is the *unchecked* state of the same rule that makes `Pensumwerte` 13px/600. **Effort:** trivial. **Vote:** 2/3; spread polish/minor/minor.

#### m9 — The legend gives swatches only to the scale that means "size"
`Pensum bis 39 · 40–79 · 80–119 · ab 120` gets four near-identical pale-blue swatches; `Auslastung Überlast über 100 · knapp 95–100 · ok 80–94 · frei darunter` — the only colours on the page that carry status — gets none, and nothing says which scale measures what. **Fix:** add the four `Auslastung` chips using the fills `.pcell--load` already ships (`is-danger`, `is-warn`, `is-ok`, `is-neutral`), and name the denominators on the two `dt`s: `Pensum je Projekt (% einer Vollzeitstelle)` and `Auslastung (gebucht ÷ netto)`. Do **not** re-cut the Pensum bands to match Auslastung's 80/95/100 — verified against the data, that would collapse 279 of 389 cells into a single flat tint and duplicate the `Warnung ab 80 %` scale the option bar already offers. **Effort:** trivial. **Vote:** 2/3; spread major/minor/minor.

#### m10 — Auslastung ok-green and Überlast-red collapse into one band for red-green colour blindness
`ok #dcfbe7` and `Überlast #f5dada` measure dE2000 **3.44** under a deuteranope simulation (against 28.98 for normal vision) and 1.193:1 in luminance for everyone. Verified: three bands survive the simulation, not one — amber separates strongly — but the two the row exists to distinguish do not. **Fix, better than a hex change:** the file already specifies the answer and never wired it. The comment at `:1609` says *"700 is reserved for over-capacity, which marks itself with a triangle rather than with weight or hue,"* and `i-triangle-alert` sits in the sprite at `:3511` referenced **zero times**. Put that glyph on `.pcell--load.is-danger`. That works in greyscale, in print, and for every CVD type, which a lightness tweak alone does not. If a hex change is also wanted, `#efc4c4` keeps `#991b1b` at 5.29:1 and lifts deuteranope separation to 7.5; scope it to `--color-danger-bg`, not `--red-100`, so `--heat-neg-bg` is untouched. **Effort:** trivial. **Vote:** 2/2; spread minor/major.

#### m11 — Even on its own terms the `Blau` ramp spends only 1.30:1 across the whole grid
Every value cell renders as one of `#ffffff`, `#eef8ff`, `#dfefff`, `#cee4fd`; adjacent steps are 1.077 / 1.088 / 1.111, and `heat-4` never paints. 69 % of cells (244 of 389) sit in `heat-1`/`heat-2`, separated by dE2000 4.3 — that is the boundary that actually disappears. **Fix, and the framing matters:** the source records the ramp passing at "5.7 6.0 6.5 6.8," which reproduces exactly in **CIE76**; under CIEDE2000 the same pairs are 5.1 / 4.3 / 4.1 / 4.1, so three of four steps fall below the design's own dE-5 floor. Restate the audit rule in dE2000, then spend the reclaimed headroom on the 40 % boundary rather than uniformly — `#111827` on the darkest step is currently 11.84:1, far above the 9:1 the file requires. Also widen the legend swatches to ~28×11 butted chips; at 12px isolated squares, a 1.08:1 step is undecodable regardless of tuning. Caveat: `[data-heat-scale="warnung"]` inherits `heat-1`/`heat-2` from `:root`, so give it explicit overrides or the calm end of `Warnung` darkens too. **Effort:** medium (colour work, not code). **Vote:** 3/3, all three minor.

#### m12 — Group subtotal rows: encode them properly, or let them be switched off *(contested — see §4)*
The group sum row is the only row in the grid with no visual encoding: twelve flat grey four-digit numbers where every other row is tinted, so "which Teilportfolio is heavy, and when" requires subtracting 700 from 850 in your head, sixteen times. And the only control that hides those rows is `Pensumwerte`, which also hides the numbers and disables editing (`:3079-3081`). **Fix:** (a) add `Summenzeilen` to `Spalten & Einheit`, next to `Nullwerte ausblenden`, independent of `Pensumwerte` — the coupling is the clear defect and should be fixed regardless; (b) if the row should answer "when is the peak," mark it **within the row** (semibold on the row max, hairline on the row min, or a min→max micro-bar) rather than tinting it on a shared blue scale — a second blue ramp with a different denominator in the same column makes one colour mean two things, and on a 0..max scale the 700→850 swing compresses to nothing. Do **not** couple the toggle to `Mir zugewiesen` or auto-clear `Gruppieren nach`. **Effort:** small. **Vote:** 2/3, all three minor.

#### m13 — Control groups are neither labelled nor separated
`.toolbar__sep` is 1px at 1.33:1 on the bar ground, inside a uniform 8px gap: a group boundary measures 17px against 8px. In the time bar it is worse — because `.toolbar__check` adds 8px of padding per side, the boundary between the four visibility checkboxes and `Farbe:` measures **25px against an intra-group 23px**. The separator there does literally nothing. **Fix:** wrap the toolbar's three intended groups in `.toolbar__group` (the pattern `.timebar__group` already uses) with 4px inside / 12px between — this *frees* ~22px rather than spending it, and makes the 1100px wrap break between groups instead of through them. In the time bar, spacing cannot do the job: add `Anzeigen:` as a `.wf-viewlabel` before the four checkboxes, the deliberate sibling of `Farbe:`. **Effort:** trivial. **Vote:** 3/3, all three minor.

#### m14 — When the time bar wraps, `‹ Heute ›` is thrown ~700px from the `Jahr|Quartal` control it belongs with
`justify-content: space-between` with `flex-wrap: wrap` drives the two halves of one function to opposite ends as soon as the third group wraps below ~1060px. `32-tablet-1024.png`: `Jahr|Quartal` at x=16–148, `‹ Heute ›` at x=857–1007, and the wrapped checkbox row starts at x≈296 while every other bar on the page starts flush at x=16. **Fix:** wrap `.timebar__group` and `.timebar__nav` in one container with `gap: var(--space-8)`, then delete `.wf-viewgroup { margin-left: auto }` and the `margin-left: 0` override in the 700px block. With two children, `space-between` right-aligns the view group at desktop and a lone wrapped item packs flush left. Net: one div in, two rules out, no breakpoint to tune. **Effort:** trivial. **Vote:** 3/3, all three minor.

#### m15 — Nothing indicates a pensum cell is clickable
Editability is signalled only by `cursor: pointer` and a 7 % hover darkening on cells that are already near-white. `02-boot-grid.png` reads as a printed report. **Fix, in order of value per pixel:** (1) append `· Klicken zum Bearbeiten` to the `title` every cell already carries — zero pixels, fires exactly when the user is hovering and wondering; (2) make the cell hover speak the page's own language — `.prow__title:hover` and `.leadbtn:hover` both go link-blue *and* underline, while the pensum cell gets a bare brightness filter; give the cell's `.cellv` the same treatment. Do **not** add a dotted bottom border: `.pcell--val.is-edited` already uses a bottom inset to mean "this value was changed," and `padding-bottom: var(--wf-band-h)` reserves that edge for the phase band. **Effort:** trivial. **Vote:** 2/2; spread major/minor.

#### m16 — The person picker ranks and colours candidates by Q3/2026 whatever quarter you are fixing
`utilOf(id, q)` returns `load[q||0]/employment` and every call site passes 0, so the figure, the traffic-light dot and the "most room first" sort always describe Q3/2026 — the one quarter the grid itself marks `laufendes Quartal, gesperrt` — and no quarter is named anywhere in the popover. **Fix, corrected:** do not thread "the clicked cell's quarter" through — there is no cell entry point; `openPicker` is reached only from the `.leadbtn` in the frozen column, and `An andere Person umbuchen` is an inert stub. Because `leadId` is one value across all 16 quarters, a single-quarter figure may be the wrong summary altogether. Minimum: name the quarter (`Aktuell: Olivia Musterli · Auslastung Q3/2026: 140 %`) and add a list caption (`Freie Kapazität — Auslastung Q3/2026`), mirroring the sibling edit popover which already writes `… · Q3/2026`. Then ask stakeholders whether the ranking key should be the current quarter, the first unlocked quarter, or the peak over the project's window. **Effort:** small. **Vote:** 3/3; spread major/minor/minor.

#### m17 — The grid calls the current quarter `gesperrt` and then lets you edit it
The only statement that the running quarter is locked is a `title` on the column header (`:3703`, `:4290`), and the interface contradicts it: every Q3 26 cell is an editable `<button data-act="cell" data-q="0">`, `apply()` writes the value and re-sums, and `28-edit-popover.png` — the canonical demo of the edit flow — is itself an edit of Q3/2026. Grep confirms `gesperrt` appears exactly twice in 465 KB, both in that tooltip; there is no lock machinery anywhere. **Fix:** delete the word. Every other signal in the file, including a CSS comment reading *"now is a position, not a problem,"* says the quarter is editable. If BBL confirms otherwise, that is a much larger change than this ticket. **Effort:** trivial. **Vote:** 3/3, all three minor.

#### m18 — The unit switch and `Nullwerte ausblenden` live in a column-picker menu two bars from the control they depend on
`Pensum % | FTE` and `Nullwerte ausblenden` are sub-settings of the `Pensumwerte` checkbox, but they sit inside `Spalten & Einheit` alongside five frozen columns — and both become silently inert when `Pensumwerte` is off while still rendering as enabled. **Fix:** keep them where they are and name the three blocks inside the panel (`Einheit` / `Spalten` / `Werte`), widening the trigger to `Spalten & Werte`. Then apply the dependency with the attribute already on the root: `[data-wf-values="off"] .dd__segmented, [data-wf-values="off"] [data-act="toggle-flag"] { opacity:.45; pointer-events:none }` plus a one-line hint. Do **not** move them into the time bar — that row already wraps at 1024 and is clipped at 390. Do **not** rename the trigger to plain `Spalten`: `Einheit` is currently the only signpost the unit has. **Effort:** trivial. **Vote:** 3/3, all three minor.

#### m19 — `Ohne` and `Transparent` are the same option in the default state
Full-image diff of `18-fill-transparent.png` against `19-fill-ohne.png`: max channel difference 14/255, only 10.3 % of pixels differ at all. Verified more broadly: `Grau` sits 17/255 from both, so **three** of the four light variants are indistinguishable in the default `Farbe=Pensum` / `Blau` state. **Fix:** the root cause is that `Transparent` is `rgb(255 255 255 / .72)` — at 72 % white it cannot separate from an opaque white bar over a near-white ramp. Drop the alpha to ~0.45 so it does what its name and its source comment promise ("lightens the cell through the bar, so a phase tint still reads underneath"), which also separates it from `Grau`. One value. Do **not** delete `Ohne` on the "worst on 0 % cells" argument — `heat-0-bg` is white, so `Transparent` composites to exactly the same white there. **Effort:** trivial. **Vote:** 2/3; spread minor/major/polish.

---

### POLISH

#### p1 — The legend keys symbols the default view does not draw
Only two of five legend groups carry `data-wf-legend`, so `Meilenstein ◆ Gate auf Plantermin` prints in the default state while `Meilensteine` is off and no diamond is drawn. The `Bearbeitender` group is worse: `--pattern-no-lead` is painted in exactly one place in the whole document — the legend swatch that claims to explain it. **Fix:** gate the Meilenstein group on `data-wf-gates` (the pattern `.wf-gate` already uses at `:3041`) and the Bearbeitender group on `data-wf-phases`. Leave `Auslastung` always visible and comment the exception. **Vote:** 2/2, both minor. *(The finding's second half — that a 32px group gap would read better than 20px — is taste and should be dropped; the bold `dt` labels already carry the boundary.)*

#### p2 — The legend's `nicht zugewiesen` swatch is not the mark the grid draws
The legend keys a diagonally striped amber/cream square. The grid's actual mark on project 5540 is `.lead-open::before`, a 6px hollow amber ring before an italic label. `is-unassigned` occurs three times in the file, all in CSS, zero times in markup. **Fix:** either draw the ring in the swatch (`6px, border-radius:50%, 1.5px --color-warn-solid, no fill`) and italicise the label, or delete the group entirely — the grid's mark is the literal German words `nicht zugewiesen` in a column headed `Bearbeitender`, which needs no key. Deleting also sweeps the now-orphaned `--pattern-no-lead`, `--rail-warn` and three dead `.is-unassigned` rules. **Vote:** 3/3, all three polish.

#### p3 — Legend swatches look like unchecked checkboxes and cannot be compared to each other
The four `Pensum` swatches are 11px bordered squares with pale fills — the same shape and size range as the page's real 16px checkboxes — and the `bis 39 %` swatch is 1.05:1 against the legend ground, reading as an empty outline. Root cause: the key is painted on the page ground (`#eef1f6`), not on the white the tints actually sit on in cells. **Fix:** wrap the four in the existing `.wf-swatchset` (which already strips inner borders and carries one outer outline — the `Phase` group uses it), give the strip a white background, and move the range labels underneath. Do **not** strip borders on `is-nolead`/`is-delay`: those borders are the encoding. **Vote:** 3/3; spread minor/minor/polish.

#### p4 — Search is the only unlabelled control among eight labelled ones, and its scope lives in a tooltip
A wordless 34px magnifier at the far left, with `title="Projekt, ID oder Person"` — invisible on touch (`32`, `33`, `34`) and absent from `aria-label`, which says only `Suchfeld öffnen`. **Fix:** when the field opens, give it `placeholder="Projekt, ID oder Person"` — the string is already in the `title`, it costs no toolbar width, and it works where hover does not. Change the accessible name to `Suchen nach Projekt, ID oder Person`. Do **not** render it expanded at desktop: the toolbar has ~20px of slack at 1500px and labels already ellipsize; a 250px field would truncate `Gruppieren nach: Teilportfolio`. **Vote:** 2/3; spread polish/polish/minor.

#### p5 — Grid figures may not be set with tabular figures *(verify before acting)*
`font-variant-numeric: tabular-nums` is declared nine times in the file and the `.pcell` modifiers do not restate it. **However, one verifier found `.pcell` itself in the selector list at `:600`, under the comment "Numbers are tabular everywhere — a system rule, not an option."** If that holds, the finding is void; `font-variant-numeric` inherits, so `.cellv` would be covered too. **Action: check `:599-602` before doing anything.** If `.pcell` is genuinely absent, add the one declaration there — noting that `.gantt__col--id` (`:2037`) has it while `.pcell--id` does not, an internal inconsistency worth closing. Do **not** right-align `.pcell--val` to match `Kredit CHF`: the quarter headings are centred, the cells are full-bleed heat tiles, and centring is what makes a three-digit outlier overhang its column. **Vote:** 2/3; spread minor/polish. Lowest confidence in the review.

#### p6 — The phase band sits equidistant between its own row's figures and the next row's
Measured in `04-values-bars.png`: 7px of clear space above the band, 8px plus a 1px rule below, so the band's ownership is weakly signalled. **The cheaper and better fix is contrast, not space:** the band's own borders are `#636b7a` while the row rule 1px below is `#e3e9f3` (1.24:1 on white). The boundary that already assigns the band correctly is invisible next to a line ten times stronger. Promote the row rule to `--color-border` while the band lane exists. If spacing is still wanted afterwards, express it as a third token inside the file's own arithmetic (`--wf-band-gap`, zeroed under `[data-wf-values="off"]`) rather than two hardcoded offsets — a bare `.wf-band { bottom: 6px }` would move the bar only 3px, break the centred bars-only reading in `07`/`08`/`09`, and desynchronise the edit-state gradient. **Vote:** 3/3; spread polish/minor/minor.

---

## 4. Umstritten

Four questions the review could not settle. Both sides stated fairly.

### U1 — Does a threshold belong on a project cell at all? *(M1 vs B1)*

**Four seats say:** the shipped default cannot show overload. In `Blau`, 110 % and 30 % differ by 1.21:1, the top band never paints, and the scale that separates them is behind a hidden bar. Ship `Warnung ab 80 %` as the default.

**The Teamleiter says:** `Blau` must stay the only scale for project cells, because 80 %/120 % are person-capacity thresholds applied to a quantity that is not capacity — one project's claim on one person. `17-scale-ampel.png` paints Katja Muster fully green while the flag says otherwise, and `Warnung` mixes "blue = how big" with "amber = how bad" on one screen.

**Verification found both partly right and the proposed fix wrong.** All three Farbskalen share the same 40/80/120 band edges — only the hex changes — so `Warnung` paints row 0044's healthy 80 % the same amber as row 1940's 110 %. It does not separate them. Meanwhile the person-level flag both camps agree is meaningful is *already computed per cell* (`is-warn` on 164 cells, with `title="Person über 100 % belegt, Überlast"`) and simply never drawn.

**My recommendation:** nobody has to win. Keep `Blau` as the default so blue keeps meaning "how big," and draw `.pcell--val.is-warn` on a separate channel (edge bar or glyph, not fill) so status stays a property of the person. That satisfies the four seats' need and the Teamleiter's semantics simultaneously, and it flags Katja Muster's 40 % cells — which neither `Warnung` nor `Ampel` does. Leave `Farbskala` in the option bar; once the flag is drawn, promoting it stops mattering.

### U2 — Should group subtotal rows be encoded, or switchable off? *(m12)*

**Department management:** the group sum is the only unencoded row in the grid; tint it on a scale shared across groups and default it to FTE, so "which Teilportfolio is heavy, and when" is a glance rather than sixteen subtractions.

**The individual project lead:** for someone scoped to their own six rows those subtotals are a partition nobody needs — `700 %` across twelve people means nothing to them — and the only control that removes them also removes the numbers.

**My recommendation:** the two are not exclusive, but the encoding half needs a different instrument. Ship the `Summenzeilen` toggle (the `Pensumwerte` coupling is a defect either way), and if the peak question matters, mark it *within* the row rather than tinting on a second blue ramp — the legend has already spent blue on a fixed four-band meaning that `Farbskala` can reassign. Do not auto-clear grouping from `Mir zugewiesen`.

### U3 — What is the last identity column standing at phone width? *(m6)*

**Two seats:** `Projekt` must never yield — a truncated name is worth more than a four-digit ID.
**One seat:** `Bearbeitender` should outlive `Projekt` — a grid of project names without assignees answers nobody's question about who is over.

**Verification killed both as stated.** The frozen block is `position: sticky`, so keeping `id + title` at 390px produces a 362px frozen pane in a 334px viewport: the quarter cells sit permanently underneath it and the reader sees a project name and **not one number**, on a page whose entire purpose is the pensum figure. `DATA.leadW.title` is a fixed 300 with no shrink path.

**My recommendation:** neither reorder is implementable without first making `title` compressible (a ~140px floor with ellipsis) *and* dropping `MIN_PERIODS` from 3 to 1 below ~500px. That is a real piece of work. The cheap, uncontested action is to render the missing `dropped-note` so the loss is at least stated — at 768px as well as 390px. Then ask stakeholders whether the phone case deserves a stacked card layout rather than a table at all.

### U4 — Should the Auslastung row ever follow the filter? *(M8, M5)*

The source records this as a `DECISIONS.md` rule: the capacity rows describe the whole department against its own net capacity whatever the filter shows, *"and the reason a filtered subset has no denominator of its own."*

That reasoning is sound — filtering selects *projects*, capacity belongs to *people*, and those people carry work outside the filter. Any `Auslastung der Auswahl` is either systematically low (filtered numerator over full capacity, which would tell a department head that people at 112 % are "frei") or circular. **My recommendation: do not add that row.** Instead make the existing row say out loud that it ignores the filter (M8), and ask stakeholders the question directly: *"Wenn Sie auf ein Teilportfolio filtern — welche Auslastung möchten Sie sehen?"* That is what a wireframe is for.

---

## 5. Bewusst nicht empfohlen

Fourteen findings were considered and rejected. The notable ones, and why — this matters as much as the list above, because several are the obvious things a reader would otherwise raise.

- **"The page boots pre-filtered to 22 of 111; 89 projects are unreachable."** `DATA.projects` contains exactly 22 entries. The 89 were never authored — they are not being withheld. `22 von 111` is scene-setting copy. And the boot filter is doing real work: it is the only state where the chips, the reset link, the count, the group headers and the group `Summe` rows are all visible and mutually consistent. Booting unfiltered would hide the filter vocabulary from every reviewer.
- **"`syncDependents()` is an empty function, so dependent controls never sync."** The load-bearing example was wrong: `Farbe=Phase` with bars off does *not* leave "13 tints with no key" — `:3325-3327` swaps the phase legend in with the colour switch, and `25-legend.png` shows the Pensum branch of exactly that mechanism. The empty body is also a documented deletion, not a stub. The one true residue (the `Hintergrund` row is inert when `Phasenbalken` is off) survives as m2.
- **"On tablet the frozen block takes 59–64 % of the width because the lead columns have no shrink rule."** The finding quoted a dead inline `grid-template-columns` attribute that `applyColumns()` overwrites on every resize. The measured 494px at 768px *is the auto-drop's output* — `Kredit CHF` is visibly absent from `33-tablet-768.png`. The mechanism it asked for is already built.
- **"The phase-bar border falls to 2.26:1."** Computed against `--color-bar-border` (`#76879f`), which `.wf-bar` overrides at `:3468` to `--color-border-emphasis` (`#636b7a`). Pixel-sampling `15-scale-blau.png` returns `(99,107,122)` on every bar edge and zero `#76879f` pixels in the grid. Every real combination clears 3:1. The finding's own "after" figures matched the current state.
- **"The `Heute` badge clips the first row's Q3 26 figure."** Measured: the pill's dark body ends at y=213 and the `40` glyphs occupy y=213–221, pixel-identical to the shot without the badge. It touches the cap line and clips nothing. The proposed fix (`translate(-50%,-100%)`) would put the badge through the `Q3 26` column label — the collision the source comment records having already fixed once.
- **"Re-planning a year means 24 popovers — add apply-to-following-quarters."** The mechanism claim is true and the flat runs in `01-boot-full.png` make it sympathetic. Rejected as a requirements question rather than a defect: the wireframe faithfully depicts single-cell editing, the recipients are the exact people who would feel the pain, and the proposed default (fill to the end of the phase bar) derives an endpoint from a layer that is off by default. Put it to stakeholders instead.
- **"A project holds one Bearbeitender yet demands 110 % — the shortfall never surfaces."** Contradicted: every over-100 cell carries `Person über 100 % belegt, Überlast` in `title` and `aria-label`, the legend publishes the bands, and the popover gates on it. The naming half was also wrong — `Projektleitung` / `Projektentwicklung` / `Bauleitung` are three distinct role values, not three names for `Bearbeitender`. The remaining question (should a project decompose into per-person sub-rows) is a different product.
- **"Clipped phase bars are drawn with closed, rounded caps."** Verified true and rather good — 17 of 21 bars end at exactly 100 % while 4 end genuinely inside the window, both with the same finished cap. Rejected only on vote count (1 of 1 verifier), not on merit. **Worth re-raising**: an open-edge segment is nearly free, because `.wf-bar` already defaults to `border-left: 0` and `border-radius: 0`.
- **"The legend sits two screens below the colours it explains."** Measured at ~620px below the fold at the default filter, not two screens, and the proposed fix (a `Legende` button in the time bar) would park the key in a strip that also scrolls away — and the time bar has no room at 1024. The source also records rejecting a single `Legende` heading on purpose.
- **"Four type sizes in the chrome band, tracking nothing" / "Three count badges, three sizes" / "The tab and the group heading are set identically" / "Three footer tiers at one size."** All four measured correctly and all four were rejected on the same ground: the scale is documented with a role comment per step (`--text-btn: 14px /* button labels */`, `--text-sm: 12px /* secondary text, table header */`), every cited case obeys it, and the proposed changes were 1px steps below perceptual threshold that would each have added a size or removed a role. Taste, against a rule the file keeps consistently.

---

## 6. Priorisierte Massnahmenliste

**Do first — these five change what the tab can answer, and four of the five are one-liners.**

1. **Draw `.pcell--val.is-warn`** (B1). The class is on 164 cells with the right accessible text and no CSS rule. This is the single highest-value change in the review and it dissolves the biggest argument (U1).
2. **`data-wf-phases="on"` on line 4** (M3). One attribute; verified free in row height; makes the merge visible at boot.
3. **`el.title = el.dataset.labLong` on `.wf-bar`**, plus narrow the phase-legend hide selector (M4). Makes every phase code decodable in every state.
4. **`.wf-gate { pointer-events: auto }` + `role="img" aria-label`, and expand the Meilenstein legend to the gate↔phase mapping** (M6). Turns a decorative toggle into a working one.
5. **Fix the `my-projects` checkbox** (M2) — it currently swallows its own click and reads as a broken page.

**Do next — cheap, uncontested, visible.**

6. Un-hide the grid scrollbar and bind `‹ › Heute` (M7).
7. Rebuild `title`/`aria-label` inside `applyUnit()` (m1).
8. Add the missing `<p class="dropped-note">` (m6).
9. Delete `gesperrt` from the two tooltips (m17).
10. Add the four `Auslastung` swatches and the two denominator glosses to the legend (m9).
11. Rename the nav button to `Zu heute` (m4); swap the option-bar glyph off `#i-layout-grid` and add the `Entwurfsvarianten` heading (m2).
12. Wire the dead `.wf-opt.is-disabled` from `data-wf-phases` (m2); grey the unit switch and `Nullwerte ausblenden` when `Pensumwerte` is off (m18).
13. `--wf-band-h: 16px` / `--wf-lab-size: 11px` / add `--tracking-caption` (m3).
14. Wrap `.timebar__group` + `.timebar__nav` (m14); promote the row rule under the band (p6).
15. Fix the `nicht zugewiesen` swatch or delete the group (p2); butt the Pensum swatches into a white-grounded strip (p3); gate the Meilenstein legend group (p1).
16. Drop `Transparent`'s alpha to ~0.45 (m19). Put `i-triangle-alert` on `.pcell--load.is-danger` (m10).

**Then — needs a decision or real work.**

17. Promote the footer population labels to 13px/600 and say "unabhängig vom Filter" (M8); rename `Summe` → `Bedarf` (M9).
18. Add the `Überlast / freie Kapazität` volume row and wire `Details anzeigen` (M5).
19. Retune the phase-tint families for ≥ dE 6 deuteranopic separation, restate the Blau audit in dE2000, spend the headroom on the 40 % boundary (M10, m11).
20. Ship one static `Gruppieren nach` panel and a "nicht schaltbar" note for the other nine dead surfaces (M2).
21. Pin `.pblock--foot` and repeat the quarter header in the footer card (m5); extend the sideways-scroll toolbar rule to 1100px (m7).
22. Build the per-person `Auslastung <Person>` group row under `Gruppieren nach: Bearbeitender` (B1, part two).

**Ask, do not build.** U1 (threshold semantics), U2 (subtotal encoding), U3 (phone identity), U4 (filtered Auslastung), plus: should the Begründung still be mandatory when an edit *reduces* an overload (M11)? Should `Jahr` become the boot default for the management seat (M7)? Should the edit popover support apply-to-following-quarters (rejected as a requirements question, but the flat runs in `01-boot-full.png` make it worth putting on the table)?

---

*37 findings verified against 34 screenshots, `measurements.json`, and the source. 14 rejected. Severities are the verifiers' consensus; where they split, the split is stated in the finding.*


---

## Appendix — action lists as returned by the review

### Implemented in this pass
See the "Independent verification" table above; items 1–8 confirmed there were implemented,
plus the legend Auslastung swatches and the time-control grouping.

### Deferred to you
1. **Does a capacity threshold belong on a project cell at all?** — Four seats want the default Farbskala changed because Blau cannot show overload (110 % and 30 % differ by 1.21:1, and the darkest step never paints). The team leader argues the opposite: 80 %/120 % are person-capacity thresholds applied to one project's claim on one person, so Ampel paints an overloaded Katja Muster green and Warnung mixes 'how big' with 'how bad' on one screen. Verification showed the proposed fix does not work — all three scales share the same 40/80/120 band edges, so Warnung paints a healthy 80 % the same amber as an impossible 110 %. My recommendation is to keep Blau and draw the person-level `is-warn` flag on a separate channel, which satisfies both readings. Do you accept that, or do you want a status scale on project cells after all?
2. **Should the Auslastung row ever follow the filter, and should there be a second capacity row?** — The source records a DECISIONS.md rule that the capacity rows describe the whole department whatever the filter shows, because a filtered subset has no denominator of its own. That reasoning holds — filtering selects projects, capacity belongs to people, and those people carry work outside the filter. But `Summe Total · Auswahl` (1'035 %) sits directly above `Auslastung · Gesamtportfolio` (112 %) in the same unit with two denominators five times apart, and the only marker is a 12px grey side-note. Two questions: (1) do you want the row relabelled to say 'unabhängig vom Filter' in plain words, or do you want it to follow the filter after all? (2) The single ratio hides the distribution — in Q3/2026 where the row says 112 %, 21 of 44 people are over their own contract, and in Q2/2030 where it says 80 % ('ok'), 13 still are. Do you want a second row, and should it be a headcount (21/44) or a volume pair (5,2 / 3,6 FTE)? The volume version is the honest one: the count falls 21→13 and flatters the plan, while the overload volume stays flat at ~5 FTE.
3. **Should Summe rows read Bedarf in FTE rather than percent?** — `Summe Bildung und Forschung (12) → 700 %` adds pensum percentages belonging to eleven different people and prints one percentage, directly above a row where % genuinely means a ratio — and the legend's Pensum bands top out at 'ab 120 %' while the footer prints 1'035 %. Both renderings are already stored on every cell (`data-wf-pct` and `data-wf-fte`). Three options: (a) rename the rows `Bedarf …` and add a legend gloss (cheapest, keeps every column additive in both units); (b) make FTE the boot default with one attribute; (c) decouple the unit per row type so Summe rows always read FTE. I recommend (a), and (c) is the one to avoid — it would leave cells reading 40, 65, 110 under a total reading '7,00 FTE', destroying the one property a total row exists to have.
4. **Should the merged tab boot with the Termine layers on, and should the four checkboxes stay independent?** — Phasenbalken, Meilensteine and Heute all ship off and the frozen Phase (ePPM) column ships off too, so the first screen of the merged tab is exactly the old Übersicht heatmap. I recommend turning Phasenbalken on (verified free in row height) and leaving the other two off. Separately, one seat proposed replacing the four checkboxes with a named `Ansicht: Pensum + Termine | nur Pensum | nur Termine` control. I recommend against it — it destroys states the wireframe deliberately renders (bars-only, gates-only, everything-off) and Heute is a time reference rather than a Termine layer — but the discoverability concern behind it is real. Do you want the layers named as a group instead (a single `Ebenen:` or `Anzeigen:` caption)?
5. **What should the last identity column be at phone width, and is a table the right shape there at all?** — Below ~634px the yield ladder drops Projekt, Bearbeitender and Kredit CHF, leaving each row identified only by a four-digit ID (34-phone-390.png). Two seats want Projekt to never yield; one wants Bearbeitender to outlive it. Verification killed both as stated: the frozen block is position:sticky, so keeping ID + Projekt at 390px produces a 362px frozen pane in a 334px viewport — every quarter cell sits permanently underneath it and the reader gets a project name and not one number. Making either reorder work needs a compressible title column (~140px floor with ellipsis) plus dropping MIN_PERIODS from 3 to 1. That is real work. The alternative is to stop being a table below ~700px and render stacked cards. Which do you want to pay for — and is a phone read in scope at all?
6. **Should the four-year horizon be reachable, and should Jahr become the management default?** — Sixteen quarters sit behind a ~608px frozen block, so roughly a quarter of the horizon is off-screen at 1500px and two thirds at 1024 — while the scrollbar is deliberately hidden with a source comment naming the arrows as the replacement, and the arrows are shipped disabled and unbound, as is Jahr. Un-hiding the scrollbar and binding the pager is uncontested. The open question is Jahr: it would put the whole horizon on one screen and make 'is 2029 heavier than 2027' answerable, which is the management reading — but phase bars are positioned on exact quarter fractions and the cell editor edits a quarter, so a year default would make Phasenbalken and Meilensteine unreadable for the operational seats. And a year cell has to state what it aggregates: a sum reads 700 %+ and is nonsense, a mean hides the 40→110 swings the heatmap exists to surface. Should Jahr be built, and if so what does a year cell show?
7. **Should group subtotal rows be tinted, and should they be switchable independently of Pensumwerte?** — Department management: the group sum row is the only row in the grid with no visual encoding, so 'which Teilportfolio is heavy, and when' means subtracting 700 from 850 in your head, sixteen times. The individual project lead: for someone scoped to their own rows those subtotals are a partition nobody needs, and the only control that hides them (Pensumwerte) also hides the numbers and disables editing. The coupling is a clear defect and I would fix it either way by adding `Summenzeilen` to Spalten & Einheit. The encoding half needs your call: I recommend against a second blue ramp (the legend has already spent blue on a fixed four-band meaning that Farbskala can reassign, and on a 0..max scale the 700→850 swing compresses to nothing) and in favour of marking the row's own max and min. Do you agree?
8. **Should a Begründung still be mandatory when an edit reduces an overload?** — `overloaded()` gates the mandatory Begründung and disables Übernehmen purely on whether the person ends up over 100 %. So reducing a booking from 40 to 20 on someone at 140 % still demands a written justification — the wireframe punishes the corrective action. The source says the gate arms 'exactly where the application arms it', so this may be a faithful mirror of a real business rule rather than a wireframe defect. Is 'any booking that leaves a person over 100 % carries a documented reason' the actual BBL rule, or should the gate fire only when an edit raises the load?
9. **Should the edit popover support applying a value to following quarters?** — Rejected during verification as a requirements question rather than a defect, but worth putting to you because the data makes it vivid: 01-boot-full.png shows row 1940 at a flat 110 across all sixteen quarters, row 1611 the same, row 1320 at 70x8 then 90x4. Under the current single-cell model, entering row 1940 is sixteen open/type/confirm cycles to type one number sixteen times. The counter-arguments are real — the mandatory Begründung is evaluated per quarter against that quarter's load, so one justification spread across a range would cover quarters whose overload facts differ, and a pre-filled range endpoint would have to be derived from the phase bar, which is off by default. Do project leads want a range fill, and if so what should the default range be?

### Gaps named by the completeness critic
- **[blocker]** The grid cannot be operated from a keyboard: ~440 tab stops, no arrow keys, no skip link — A keyboard-only user must press Tab roughly 440 times to cross one filtered view of the grid, has no arrow-key movement between cells, no skip link to jump the grid, and — because .pgrid sets no scroll-padding — a cell reached by Tab is scrolled flush to the container's left edge and hidden underneath the sticky identity columns.
- **[major]** Closing the edit or assign popover drops focus to <body> — every edit restarts at the top of the page — After Übernehmen, Abbrechen or Escape in the pensum popover (28-edit-popover.png) focus is not returned to the cell, so the next Tab starts from the top of the document.
- **[major]** Printed or PDF'd, the Planung tab loses its colour, two thirds of its quarters, and any record of its filter — Ctrl+P on the Planung tab produces sheets whose pensum tints are dropped by the browser (the print-color-adjust fix was never extended past `.sheet`), whose quarter axis is clipped after the ~5 visible columns because .pgrid stays a scroll container on paper, and which carry no line saying «22 von 111 Bauprojekten» or which Farbskala produced the colours, because the filterbar and time bar are display:none in print.
- **[major]** 68 more controls are drawn as live and bound to nothing — including every project title and every quarter header — Beyond the six toolbar dropdowns already reported, 22 link-styled project titles, 44 sortable column headers (including all 16 quarter headers), the 2 group-collapse chevrons and «Details anzeigen» are all inert — no handler matches them.
- **[major]** «An andere Person umbuchen» — the only exit from a blocked overload edit — is preventDefault and nothing else — When the popover blocks Übernehmen because the person is over 100 % and demands a Begründung, the one alternative it offers on screen — rebooking the work to someone else — does nothing at all when clicked.
- **[minor]** The mandatory Begründung field is prefilled-looking: its placeholder is a complete, plausible sentence — The Begründung textarea shows a finished German sentence with a full stop as its placeholder, so at a glance the mandatory justification appears already answered, and it vanishes the moment the field is focused.
- **[minor]** Every one of the 352 cells carries a 90-character native tooltip identical to its aria-label — Hovering anywhere in the heat map raises a native ~90-character tooltip that covers two to three neighbouring cells after about a second, and it repeats on every cell the pointer crosses; the same text is already the cell's aria-label, so it adds nothing for assistive technology.
- **[minor]** The floating «Entwurfsregler» button sits on top of grid data at every width below 1500px — In the default state the 36px option-bar button is fixed over the bottom-right of the viewport with no reserved padding, so it permanently occludes one grid cell — at 768px the cell it covers belongs to the group sum row.