# Contrast and readability review

Users said some greys were too light. This review measured every rendered text
style on every tab, changed the two quiet text tiers and a handful of stragglers,
and measured again. Everything below is from the rendered page, not from the
stylesheet.

## Method

A Playwright script walks every visible text node on eight screens — Planung in
its three views, the dashboard in both sections, Verlauf, the print preview
and the API reference — at 1366 px. For each node it reads the computed text
colour, composites the effective background through any translucent ancestors,
and computes the WCAG 2 contrast ratio against the AA threshold for that size
and weight (4.5:1, or 3:1 for large text). Styles are grouped by element,
colour pair, size and weight, so a figure that appears 5 000 times counts once.
The script is `tools`-independent and lives in the session scratchpad; the
numbers here are its output.

Before: 309 text styles, one below AA, and the most common quiet style at
5.4:1. After: 309 styles, none below AA, and nothing that reads as a word under
6.7:1.

## Findings

### 1. The muted tier was AA and still too light — fixed

`--color-text-muted` was `grey-550` (#636b7a): 5.4:1 on white, 4.7:1 on the
page ground, 5.0:1 on the frame. It passes AA, which is why no audit had flagged
it, and it is the grey the users meant. It carried the ID column, every zero
value in the grid, the KPI notes, card subtitles, the filter line, sum notes,
legend items, dialog kickers and the print sheet's quiet text — about 5 800
text nodes on the Planung tab alone, mostly at 12 px.

| Where | Before | After |
| --- | --- | --- |
| Muted on white (IDs, zeros, notes, subtitles) | 5.36:1 | 7.56:1 |
| Muted on the page ground (filter line, legend) | 4.74:1 | 6.68:1 |
| Muted on the frame (sum notes, totals) | 5.00:1 | 7.05:1 |
| Muted on the lightest heat step | 4.98:1 | 7.02:1 |

The token now points at `grey-600` (#4b5563).

### 2. The secondary tier moved with it — fixed

Muted at `grey-600` would have equalled `--color-text-secondary`, and the two
tiers carry different jobs: secondary is the table heading, the organisation
short form, the credit column, the chart axis and the chart values; muted is
the note under them. A new `grey-650` (#414b5a) keeps the step.

| Where | Before | After |
| --- | --- | --- |
| Secondary on white (column headings, credit, chart axis) | 7.56:1 | 8.83:1 |
| Secondary on the page ground | 6.68:1 | 7.80:1 |
| Secondary on the bar fill (chart values) | 6.87:1 | 7.61:1 |

The ladder is now: strong 17.4:1, body 14.7:1, text 10.3:1, secondary 8.8:1,
muted 7.6:1, disabled 4.8:1 — every step distinct, every step a word.

### 3. Disabled menu entries were shapes, not words — fixed

A switch that cannot apply right now — «Heute» on paper, «Pensum einfärben»
with the figures off — used `--color-text-subtle` (`grey-400`, 2.5:1). WCAG
exempts disabled controls, but the reader still has to read the entry to learn
what it would do. A new `--color-text-disabled` (`grey-500`, #6b7280, 4.8:1)
greys it and keeps it legible. `--color-text-subtle` stays for glyphs that are
not text.

### 4. Placeholders were the browser's grey — fixed

No rule set the placeholder colour, so «Person suchen» and «Projekt, ID oder
Person» took the browser default, a grey lighter than anything else on the
page. Placeholders now use the muted tier at full opacity.

### 5. The one AA failure was Swagger's — fixed

Inline code in the API introduction — `sync_state`, `ETag` — rendered in
Swagger's own violet on its own grey at 4.49:1. It now uses the body text
colour on the sunken surface, the way code reads everywhere else on the page.

### 6. Button heights differed between the header and the toolbar — fixed

Not a contrast finding, but noticed in the same pass: the actions in the tab
line (Exportieren, Drucken, Teilen) were 38 px tall and the toolbar's controls
directly under them 34 px, by an explicit rule. That was a deliberate weight
difference from when the actions sat in the page header; with the two rows 20
px apart it read as an inconsistency. Every `.btn` is 34 px now, and the
toolbar and sheet bar no longer carry an override.

### 7. Left as they are

- **White on the accent** (`blue-600`, 5.17:1): the primary button, the avatar
  and the notification badge. AA at every size used; darkening the accent to
  `blue-700` would move the chart bars and links with it. Not a grey, and not
  what the users pointed at.
- **The method badges in the API reference** (GET, POST, PUT): white on the
  method colours, 5.3:1 to 5.4:1 at the lowest. AA, semibold, and a fixed
  vocabulary the reader recognises by shape.
- **Hairlines and card edges**: 1.2:1 to 1.5:1, decorative, and separating
  rows that are also separated by their fills. The structural rules — table
  head, totals, control outlines — sit at 2.4:1 to 3.2:1 as before.
- **The heat ramp**: dark text on the four blue steps runs from 11.8:1 to
  13.6:1. The zero step uses the muted tier and moved with it.

## What changed

- `css/tokens.css`: `grey-500`, `grey-650` added; `--color-text-secondary`,
  `--color-text-muted` moved one step darker; `--color-text-disabled` added.
  `grey-550` remains for borders.
- `css/main.css`: disabled menu entries use the disabled tier; `::placeholder`
  set; Swagger inline code recoloured; `.btn` at one height.
- No markup changed, so nothing in the views had to move.
