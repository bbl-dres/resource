# Gap analysis — prototype against the visual mockup

**Reference:** `docs/wireframes/260825_Portfolio Resource Management/Ressourcenplanung Bereichsleitung.dc.html`
(4034 lines, the single source of truth — the PNGs in `review/` are from an earlier iteration and were disregarded).

**Prototype:** this repository, as of the review that produced this document.

The mockup contains **nine artboards**. The prototype implemented seven of them.
This document records what is missing, what deviates, and what was done about it.

Status legend: ✅ implemented in this pass · 📋 recommended, not done · ➖ deliberate, left as is

---

## 1. Missing screens

### 1.1 API-Dokumentation (artboard `1k`) — was entirely absent ✅

The mockup carries a full API reference screen: navy shell, breadcrumb `Bauprojekte › API`,
title `API-Dokumentation`, two header actions (`OpenAPI 3.1 laden`, `v1`), then a two-column
body — a `1fr / 420px` grid of endpoint groups on the left and reference panels on the right.

Five endpoint groups, thirteen endpoints, each row a `78px 340px 1fr` grid of
method badge / path / description. Method badges are colour-coded:

| Method | Fill | Text |
|---|---|---|
| `GET` | `#DCFCE7` | `#166534` |
| `POST` | `#DBEAFE` | `#1E40AF` |
| `PATCH` | `#FEF3C7` | `#78350F` |

The right column holds two cards: a nested-JSONB project example and an authentication
note, both with a `#0F172A` code block.

**Why it matters.** The API screen is where the ePPM boundary becomes concrete — which
fields the app owns and which it mirrors. It is the answer to the single question the
wireframe says new users actually have.

**Done.** Implemented as a route (`#?tab=api`), rendered from `data/api.json`, reachable
from the **API** link in the footer. Endpoint paths and descriptions are transcribed verbatim.

### 1.2 PDF-Export Drucklayout (artboards `1l` / `1l-2`) — was entirely absent ✅

Two paper sheets on a `#E9EDF3` mount:

- **A4 portrait**, 800 × 1131 px, four quarters per sheet, `Blatt 1 von 3`
- **A4 landscape**, 1100 × 778 px, all eight quarters, `Blatt 1 von 2`

Both carry the same three fixed elements:

1. **Plankopf** — sender block (Swiss coat of arms, `Schweizerische Bundesverwaltung` /
   `Bundesamt für Bauten und Logistik BBL` / `Bereich Bauten`), centred document title and
   subtitle, and a right-hand meta block with scope, filters, unit and classification.
2. **Fixed legend** — the four heat steps, the `▲` marker, the no-lead swatch and the
   utilisation thresholds spelled out. The wireframe is explicit about the reason:
   *"Was auf dem Bildschirm im Hover steht, muss hier behauptet sein — deshalb die feste Legende."*
3. **Footer** — creation timestamp and person, ePPM sync timestamp, document ID
   (`RP-2026-0825-01`) and sheet number. This is what makes the export citable in a meeting.

**Why it matters.** The wireframe treats the PDF as the *quotable* artefact: the Bereichsleitung
meeting refers to a document ID and a timestamp, not to a screen. Skipping it removed the one
output the organisation actually files.

**Done.** Implemented as a route (`#?tab=export`) reachable from **Exportieren → Als PDF
exportieren**, exactly as the mockup links it. Both sheets render from live data and respect
the current filters and unit, and an `@page` print stylesheet makes browser printing produce
the same layout.

---

## 2. Dropdowns

The mockup has nine distinct menus. The prototype had all nine, but several were simplified.

### 2.1 Projektleitung menu was missing three of its four affordances ✅

The mockup's 312px lead menu contains, in order:

| Element | Was it there? |
|---|---|
| Group label `Mehrfachauswahl · Ausgewählte oben` | yes |
| **Person search field** (`Person suchen`) | **no** |
| **`Meine Projekte` quick chip** (dark, active state) | **no** |
| `Alle · Keine` bulk row | yes |
| Scrollable list, `max-height:214px` | **no** — the list grew unbounded |
| **Selected entries sorted to the top** | **no** |
| Footnote `7 von 34 Personen · weitere beim Scrollen` | yes |

With six people the omissions are invisible. With the 34 the footnote refers to — let alone a
real directory — the menu becomes unusable without search and without selected-on-top.

**Done.** All four added. The search filters as you type, `Meine Projekte` selects the signed-in
user's own projects, selected entries float to the top, and the list scrolls at 214px.

### 2.2 No keyboard support ✅

The mockup's Umbuchen dialog states the intended contract outright:
*"↑ ↓ wählen, Enter übernimmt"*. Neither that dialog nor any toolbar menu supported it.
Opening a menu left focus on the trigger; `Escape` closed the menu but dropped focus to
`<body>` because the whole view re-renders.

**Done.** Menus now implement the standard menu-button pattern:

- `ArrowDown` / `ArrowUp` move through items and wrap; `Home` / `End` jump to the ends
- `Enter` / `Space` activate; `Escape` closes **and returns focus to the trigger**
- `Tab` closes the menu rather than tabbing into a detached tree
- opening with the keyboard moves focus to the first item
- typing in the person search filters without losing the caret

### 2.3 Panels could overflow the viewport ✅

Left-anchored panels (`Phase`, `Projektleitung`, `Teilportfolio`) are 276–312px wide and were
positioned purely by `left:0`. Near the right edge of a narrow window they ran off-screen, and a
tall panel could extend past the bottom with no way to reach the lower items.

**Done.** Panels clamp horizontally to the viewport and cap their height at the available space,
scrolling inside.

### 2.4 `Als PDF exportieren` led nowhere ✅

In the mockup this item is an `<a href="#1l">` — it is the entry point to the print layout.
The prototype fired a "not implemented" toast.

**Done.** It routes to the print layout.

### 2.5 Sort button label ➖

The mockup renders `Sortierung: Projekt` with a separate muted `A–Z` hint span; the prototype
concatenated both into one label. **Fixed** — the hint is now its own muted span, matching the
mockup and making the value scannable.

### 2.6 Checkbox vs. tick metaphor ➖

The mockup renders the multi-select `Phase` and `Teilportfolio` menus as `role="menuitemradio"`
with a blue `✓` and a `#EFF6FF` row highlight, while `Projektleitung` uses proper 16px checkboxes
with `role="menuitemcheckbox"`. That is an inconsistency in the mockup: the same interaction
(multi-select) is drawn two different ways.

**Kept as is.** The prototype uses checkboxes for all three. One metaphor for one behaviour;
the radio-plus-tick rendering would misrepresent multi-select to a screen reader.

---

## 3. Edit popover, Umbuchen, project modal

### 3.1 Edit popover ✅

| Mockup | Prototype before | Now |
|---|---|---|
| Meta line `Sonja Beispiel · Projektleitung · Q4/2026` | person + quarter, no role | role added |
| Footnote `Übernehmen schreibt den Eintrag in den Verlauf. Esc bricht ab.` | absent | added |
| `Enter` applies, `Esc` cancels | Esc only | Enter added |
| Reason mandatory above 100 % | ✔ already correct | unchanged |
| Current quarter locked | ✔ already correct | unchanged |

The wireframe also asks for a header pill while editing —
`Bearbeitungsmodus aktiv — Änderungen werden protokolliert` — which was missing. **Added.**

### 3.2 Umbuchen ✅ / 📋

The mockup's dialog is `Von → Pensum → An → Begründung`, where **An** is a searchable
combobox over a listbox with a `5 von 34 Personen` footer, and the reason is
*mandatory for every rebooking* (not only on overload). A period is stated in the meta line:
`ab Q1/2027, 2 Quartale`.

The prototype had a plain `<select>`, no reason field and no period.

**Done.** The picker is now a search-and-listbox combobox with full keyboard support, the reason
is mandatory, and the period (start quarter and number of quarters) is stated and editable.

**One deliberate reversal.** The prototype showed the target person's utilisation before and
after. The wireframe explicitly rejects that: *"Ob das Ziel Kapazität hat, zeigt das Raster; der
Dialog behauptet keine Berechnung, die weder definiert noch von Nutzenden verlangt ist."*
The projection is removed; the dialog now states only what it actually knows.

**📋 Still open — the allocation model.** The mockup and the API both model
`allocations: [{ person, role, quarter, pensum_pct }]`, i.e. several people can carry a project in
one quarter. The prototype's `projects.json` has a single `leadId` and one demand figure per
quarter, so "rebooking" still moves the whole project lead. Making Umbuchen literal requires
adding per-person allocations to the data model — the same change that would enable the
mockup's expandable project rows and its `＋ Person zuweisen` row. Recommended as the next
substantial step; out of scope here because it touches every derived figure.

### 3.3 Project modal ✅

The mockup is deliberately small: a 480px dialog, **five facts in a fixed order**, each with a
sub-line, one primary action `Im ePPM öffnen`, and the footnote
*"Esc oder Klick ausserhalb schliesst. Kein Bearbeiten im Modal."*
Its rationale says so plainly: *"Fünf Fakten, immer dieselben, in derselben Reihenfolge."*

The prototype had grown a 760px modal with a six-item meta grid, a quarter strip, a milestone
list and a change log — more information, but no longer the cheap glance the wireframe designed.

**Done.** The five facts now lead, in the mockup's order and with its sub-lines
(SIA-Phase, Projektleitung, Pensum, Kredit, Nächster Meilenstein), `Im ePPM öffnen` is the
primary action, and the footnote is present. The quarter strip and history are kept but demoted
below the facts, since they are what makes an *interactive* prototype worth clicking through.

---

## 4. Defects found while reviewing

Not gaps against the mockup — things that were simply broken or inconsistent.

### 4.1 The pensum grid came apart when columns were added ✅

Every row in the grid is its own CSS grid, and the scroll container sized each one
independently (`min-width: max-content` per row). As soon as the track grew wider than the
window — extra attribute columns, or a 1280px laptop — rows resolved to *different* widths,
so the header no longer stood over its own cells and the left edge showed a partial column.

**Fixed** by giving the grid one scroll track with a measured `min-width`, computed from the
visible columns, and making every row exactly as wide as that track. A regression test now
asserts that all rows resolve to a single width with every optional column switched on.

The same pass implemented the wireframe's third degradation step: **the identifying columns
(signal, ID, project) now freeze** while the quarters scroll under them, with a shadow that
appears only once the track is actually scrolled.

### 4.2 Every Gantt group card had a horizontal scrollbar ✅

The Gantt used fixed `128px` quarter columns, so `360 + 8 × 128 = 1384px` sat inside a card
whose content box was 1382px after its borders — a two-pixel overflow produced a scrollbar on
every group. Quarter columns are now `minmax(0, 1fr)` with an explicit minimum, so they fill the
card and scroll only when the window genuinely cannot hold eight quarters. The *Heute* marker
moved from pixel arithmetic to a proportional offset so it stays correct at any width.

### 4.3 The two search fields shared one open state ✅

Clicking the toolbar search also expanded the header search, because both read a single
`searchOpen` boolean. They now open and close independently. The query stays shared — it is the
same filter — and a dot marks a collapsed field that still holds one.

### 4.4 Inconsistencies across tabs ✅

- The overload filter read `Nur Überlast` on three tabs and `Nur überfällige` on Termine.
  It is now the same button everywhere; the overdue axis was dropped rather than kept as a
  second, tab-specific control.
- Default grouping is now **Teilportfolio** on every tab, so switching tabs does not reshuffle
  the rows.
- Grouped rows in the Übersicht ran together in one block while the Termine tab spaced its
  groups apart. The Übersicht now uses the same group header treatment and the same spacing.
- `Bauprojekte` in the breadcrumb was inert; it now returns to the entry page, and carries a
  real `href` to the application root so middle-click works.

## 5. Carried over from the first pass

These were already recorded in the README and remain accurate:

- **Coloured Gantt bars** instead of the mockup's uniform steel — uses the phase palette the
  design already defines. ➖ kept, one line to revert.
- **Grouping actually groups**, default `Keine`. ➖ kept.
- **Teilportfolio split** derives to 310 % / 37 % where the mockup asserts 312 % / 35 %; the
  mockup's numbers do not tie to any assignment of the eleven projects. ➖ kept.
- **Change-log count** reflects the nine real entries rather than the mockup's `von 214`. ➖ kept.
- **Design annotations** (`Wofür / Stärke / Grenze`) removed as review commentary. ➖ kept.

## 6. Still open

- 📋 **Sticky grid columns.** Below ~1280px the pensum grid scrolls horizontally but the left
  text columns do not freeze. The wireframe's degradation order is
  *fewer quarters → hide attributes → freeze the left half*; only the first and last steps exist.
- 📋 **Per-person allocations** — see §3.2.
- 📋 **`Personen über 100 %`** counts raw load, while the row traffic light measures load against
  the contracted percentage. The wireframe is inconsistent; both readings are reproduced and the
  question is unresolved.
- 📋 **Time scale** (`Jahr` / `Monat`) and the period stepper are inert.
- 📋 **The signed-in user.** The mockup's avatar reads `MB` but never says who that is, while its
  lead menu offers `Meine Projekte` — which only means something if the viewer leads projects.
  The prototype signs in as **Sonja Beispiel (SB)**, one of the six, so the quick filter works.
  `Max Muster` remains the separate administrative actor in the change log, as in the mockup.
