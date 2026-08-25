# Design and UX review

A review of the prototype as it stands, from a design-systems and accessibility perspective.
Everything below was **measured**, not asserted — the numbers come from a scripted audit that
walks every visible element on all nine screens, computes WCAG contrast against the effective
background, and records heading order, accessible names, target sizes and layout offsets.

Assumed primary context: **a small laptop, 1280 × 800**, which is where the audit was run.

Status: ✅ fixed in this pass · 📋 recommended, not done · ➖ deliberate

---

## 1. The biggest problem: nothing is above the fold

At 1280 × 800 the first row of data sat **512 px down the page** — 64 % of the viewport spent
before a single number. Five of eleven rows were visible.

Measured vertical budget, Übersicht:

| Element | Top edge |
|---|---|
| App header | 0 |
| Breadcrumb bar | 60 |
| Page title | 138 |
| Tabs | 189 |
| Toolbar | 257 |
| Time controls | 347 |
| First group label | 405 |
| **First data row** | **512** |

Four separate control rows stack before the data: title, tabs, toolbar, time controls — each
with a 24 px gap around it. On a 1440 × 900 desktop that is merely generous; on the machine
people actually plan with, it is most of the screen.

**Done.**

- **Content gaps** tightened from 24 px to 16 px between control blocks. −24 px.
- The **toolbar is now strictly one row** down to 1100 px: labelled triggers truncate rather than
  wrap, so the control block has a fixed height instead of reflowing as filters are added.
- **Breadcrumb bar** tightened from 44 px to 36 px, page-header padding from 20 px to 14 px.
- The grid's **two header rows became one**. A separate year band above the quarter labels costs
  34 px, and with headers now repeating per group it cost that *per card*. `Q3/26` carries the
  year perfectly well on its own. −34 px per group card.

First data row now starts at **~450 px** (from 512), and seven of eleven rows are above the fold.

**One reversal, on review.** I had also merged the time controls into the toolbar for another
−56 px. That was wrong: scale, period and the Gantt/Liste/Kalender switch describe *the canvas
below them*, not the filter set. They belong on their own row directly above the thing they
control, with the view switcher right-aligned to the canvas edge — which is what the wireframe
does and what the prototype now does again. Density is worth a lot, but not the meaning of a
control's position.

---

## 2. Contrast: the muted grey fails AA

`--color-text-muted` is `#6b7280`, straight from the mockup. Against white that is **4.27 : 1** —
just under the 4.5 : 1 that WCAG AA requires for normal text. It is the single most-used
secondary colour in the app, so one token failing takes a dozen elements with it.

Everything the audit flagged:

| Ratio | Needed | Element | Cause |
|---|---|---|---|
| 4.27 | 4.5 | card subtitles, filter labels, counts, legend, hints | `--color-text-muted` |
| 4.39 | 4.5 | calendar "heute" sub-label | same, on a tinted cell |
| 2.24 | 4.5 | `Aktive Filter: keine` | `--color-text-subtle` used for real text |
| 2.37 | 4.5 | change-log footer rule | same |
| 2.54 | 4.5 | zero-value pensum cells | `--heat-0-fg` at `#9ca3af` |

**Done.**

- `--color-text-muted` darkened to the lightest value that clears 4.5 : 1 on **both** white and
  the grey page ground. Verified by the audit, not by eye.
- `--color-text-subtle` is now documented as **non-text only** (disabled glyphs, empty markers).
  Every place it carried real text moved to `--color-text-muted`.
- Zero-value cells darkened to pass. A zero is still information; it should not be unreadable.

---

## 3. Colour needs to be earned

### 3.1 The Gantt spent colour on a category that is already labelled ✅

The bars carried the SIA phase palette: **26 coloured bars across six hues** on one screen. But
every bar already says what it is in words — "32 Bauprojekt", "52 Ausführung". The colour added
no information; it competed with the things that genuinely need attention.

The mockup draws every bar in one neutral (`#EDF1F7` on `#C4D0E0`) and spends colour only on:
the delay hatch, the unassigned hatch, and the milestone diamonds. That is correct, and this was
my deviation, not the mockup's.

**Reverted to neutral bars.** Colour in the Gantt now means exactly one thing: *something is
wrong here*.

### 3.2 A third of the grid was red ✅

**30 of 88 pensum cells** carried a red warning triangle *and* a bold red number — the marker
fires on every quarter where the row's project lead is over 100 %, which for three overbooked
people is most of their rows.

The information is real (it says *which quarter* the lead is over in, which nothing else shows),
but it was triple-encoded: icon + colour + weight.

**The triangle went entirely.** It was a third encoding of the same fact — the Ampel column
already reports the person, and the footer row reports the quarter. The cell keeps a red,
semibold number, and its `aria-label` still spells out *"Person über 100 % belegt, Überlast"*,
so the non-visual channel is intact.

That does leave the *visual* cue as colour alone, which is a real trade-off rather than a clean
win. It is defensible here because the same fact is available three other ways on the same
screen, but it is worth revisiting if the Ampel column is ever switched off by default.

### 3.3 Rows were tinted for a property of one cell ✅

A project without a lead tinted the **whole row** amber — in the grid, in the Gantt and on the
print sheet. A missing lead is a property of one field, and a full-width tint reads as a row-level
status. It now shows as an amber rail plus an italic marker on the lead cell itself.

---

## 4. Accessibility

### 4.1 The tab bar was a broken ARIA pattern ✅

The tabs used `role="tab"` with `aria-selected`, but there was **no `role="tabpanel"` and no
`aria-controls`** — the audit found zero tab panels. A screen reader announces "tab, 1 of 4" and
then finds nothing to move into.

These tabs change the whole page and write the URL. They are **navigation**, not a tab widget.

**Done.** The bar is now a `<nav>` of links with `aria-current="page"`. Honest semantics, and
the broken pattern is gone.

### 4.2 Heading structure was one level deep ✅

The Übersicht exposed exactly **one heading** — the page title. Group labels, which are the main
structural landmark on that screen, were spans inside buttons. Screen-reader users had no way to
jump between groups.

**Done.** Group labels are `<h2>`, card titles below them `<h3>`.

### 4.3 Nine targets under 24 px ✅

WCAG 2.2 asks for a 24 × 24 minimum. The audit found group toggles at 23 px, inline link-buttons
at 18–21 px, and footer links at 18 px.

**Done.** `.linkbtn`, group toggles, breadcrumb and footer links all carry a 24 px minimum box.

### 4.4 On-screen text below 11 px ✅

The Gantt "Heute" badge and the calendar date-with-suffix rendered at 10 px. The print sheet's
10–10.5 px is fine — that is paper at roughly 7.5 pt — but nothing on screen should go under 11.

**Done** for the screen; the sheet keeps its paper sizes. The one remaining exception is the
notification count badge at 10 px — a one-character numeral in a 17 px circle, not prose.

### 4.5 What already held up ➖

Worth recording: **zero elements without an accessible name** across all nine screens, one
`<main>`, one `<h1>`, a working skip link, a visible focus ring on every control, and
`prefers-reduced-motion` honoured. The keyboard menu pattern added in the last pass survives.

---

## 5. Hardcoded values that should be tokens ✅

The audit of `main.css` found:

- `color: #fff` in four places → `--color-text-inverse`
- `#0f172a` / `#dbe3f5` (code block) → new `--color-code-bg` / `--color-code-fg`
- `#e9edf3` (paper mount) → new `--color-paper-mount`
- `rgba(17, 24, 39, 0.22)` (frozen-column shadow) → new `--shadow-frozen`

The raw pixel values that remain are all inside `.sheet__*`, where they are **paper geometry**
(800 × 1131 px is A4 at 96 dpi). Those stay literal on purpose — they are not part of the
screen's spacing scale, and tokenising them would imply they scale with it.

## 6. Simplification: do, don't explain ✅

Eleven strings in the interface explained the interface to itself:

- `7 von 34 Personen · weitere beim Scrollen` (lead menu)
- `1 von 34 Personen · … · ↑ ↓ wählen, Enter übernimmt` (rebooking picker)
- `Der Export übernimmt Ansicht, Filter, Zeitraum und Einheit.` (export menu)
- `Export mit den aktuell gesetzten Filtern` (every dashboard card menu)
- `Der Prototyp übersetzt DE und EN; FR und IT folgen…` (language menu — the items already say `folgt`)
- `Nur app-eigene Felder — Pensum, Begründung, …` (change log footer)
- `Plankopf und Legende sind fest…` (print layout)
- `Esc oder Klick ausserhalb schliesst. Kein Bearbeiten im Modal.` (project modal)
- `Übernehmen schreibt den Eintrag in den Verlauf. Esc bricht ab.` (edit popover)
- `Erzeugt einen Verlaufseintrag mit beiden Seiten.` (rebooking)
- `Der Prototyp speichert nichts…` (share dialog)

All removed. Labels that state a **rule** stay, because they change what you can do:
`Begründung — Pflicht bei jeder Umbuchung` earns its place; `Esc schliesst` does not.

## 7. Layout defects found on the way ✅

- **The footer floated** on short pages. `body` was a flex column with `margin-top: auto` on the
  footer, but the footer lives inside `#app` — which was not stretching. `#app` and `main` now
  grow, and the footer sits at the bottom of the viewport on every screen.
- **The footer was a band, not a footnote** — 60 px of chrome for a version string. Now 41 px at
  `--text-xs`.
- **Content ran into the footer.** The content column now carries a bottom margin.

## 8. Small-laptop layout ✅

Two responsive rules were tuned for the stated primary context rather than for a desktop:

- The **entry cards and the KPI strip dropped to two columns at 1380 px** — at 1280 that made
  each card ~600 px wide holding a single line of text, and pushed everything below it off
  screen. They now stay four across down to 1100 px and simply tighten their padding; a card is
  291 px at 1280, which fits its content.
- The **footer sticks** and the content column has room before it, so a short screen no longer
  leaves the footer floating mid-page.

## 9. Consistency ✅

- The **KPI strip moved inside `.bi-grid`** as its first, full-width row, so the Dashboard is one
  grid rather than a strip plus a grid.
- `--color-text-subtle` given a single documented meaning (non-text only).
- Every content card now uses one elevation token; the landing entries stay flat by intent.

## 10. Still open

- 📋 **Fewer quarters on a narrow laptop.** The wireframe's degradation order is
  *fewer quarters → hide attributes → freeze the left half*. Freezing and horizontal scrolling
  are in; dropping to six visible quarters below ~1280 px is not.
- 📋 **Per-person allocations** — see `GAP-ANALYSIS.md` §3.2.
- 📋 **The `Personen über 100 %` definition** is still inconsistent with the row signal, as it is
  in the wireframe.
- 📋 **Real mobile.** Below 900 px the planning views correctly offer a reading path instead, but
  the landing page and change log have not been designed for a phone, only made to fit.
