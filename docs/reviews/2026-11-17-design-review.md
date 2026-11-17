# Design review — tokens, shared styles, screens of every size, accessibility

**Date:** 17.11.2026 · **Role:** senior design and UX reviewer · **Baseline:**
the tree after the [code review of 16.11.](2026-11-16-code-review.md). The
[consistency review](2026-11-17-consistency-review.md) of the same day ran
alongside and is not repeated here.

**Brief:** design consistency — the token system, hard-coded styles, similar
styles that can become one; responsive behaviour and mobile support;
accessibility. Mainly a refactoring: nothing is added or removed unless a
finding leaves no other way.

**Who looks at it, and on what:**

| Audience | Screen | What was measured |
|---|---|---|
| Most users | small laptops | 1097×617 (a 1366×768 panel at Windows' 125 %), 1280×720, 1366×768, 1536×864 |
| Some users | large screens | 1920×1080, 2560×1440 |
| Team managers in meetings | TVs and projectors | 1920×1080, 3840×2160 |
| Some users | tablets and phones | 768×1024, 1024×768, 320×568, 360×740, 390×844, 844×390 |

## How it was done

Four instruments, each producing numbers rather than impressions.

1. **A static audit of the stylesheet against the token file** — every
   declaration of `css/main.css` classified: raw colours, primitives used
   past the semantic layer, tokens nobody reads, literal sizes that have a
   token of the same value, rule bodies that occur twice.
2. **A layout snapshot.** 27 states of the app (every tab, open menus and
   dialogs, the print layouts) at 1440px and 12 of them at 1100 and 390px —
   51 in all — recorded as every element's box and 49 computed properties.
   The refactoring of the stylesheet was only allowed to change nothing: it
   was run against the code as it stood before, and compared.
3. **A viewport matrix.** Every tab at thirteen window sizes: does the page
   scroll sideways, are the tabs there, how tall is the toolbar, how wide
   are the frozen columns and how many quarters are left beside them, where
   does the first row begin and how many rows are above the fold.
4. **An accessibility audit against WCAG 2.2 AA**, done by a second reviewer
   without the first one's conclusions, in a headless browser: the
   accessibility tree of every tab, a walk through every tab stop, the
   contrast of every text colour pair and every graphical mark, target
   sizes, reflow at 320px, text spacing, reduced motion and forced colours.
   Its 28 findings were each reproduced on the working tree before anything
   was changed.

## Result

| | Found | Fixed | Left, with the reason |
|---|---|---|---|
| Tokens: literals, dead entries, layer breaks | 11 groups | 10 | 1 |
| Shared styles and components | 11 | 11 | – |
| Responsive | 11 | 10 | 1 |
| Accessibility, blockers | 5 | 5 | – |
| Accessibility, major | 13 | 11 | 2 |
| Accessibility, minor | 10 | 5 | 5 |

The stylesheet refactoring changed no pixel: **51 of 51 snapshots identical**
before and after, boxes and computed styles. Everything that does change
something on screen is listed below as such. `node tools/check.mjs` passes.

---

## 1 · The token system

The system was in better shape than most: two layers, no raw colour anywhere
in `main.css`, a comment on nearly every decision. What the audit found is
drift at the edges.

| Finding | Before | After |
|---|---|---|
| Raw colours in `main.css` | 0 | 0 |
| Primitives used past the semantic layer | 3 (`--alpha-white-25`, `--fill-chip`, `--blue-100`) | 0 — three semantic tokens named for what they do |
| Tokens defined and never read | 12 | 0 |
| Spacing literals that had a token of the same value | 36 of 48 | 0 |
| Border-width literals that had a token | 9 of 10 | 0 |
| Hex colours inside tokens that repeat a primitive | 4 (the two hatch patterns) | 0 |
| Semantic tokens built on a primitive where a semantic one exists | 3 (`--rail-danger`, `--rail-warn`, `--ring-cell-edit`) | 0 |
| Sizes used in several places without a name | 16px mark ×4, 30px row ×5, 11px diamond ×2, 3px ring ×4, 2px underline ×5 | named: `--mark-size`, `--row-height-sub`, `--diamond-size`, `--focus-ring-width`, `--underline-offset`, `--rail-width` |
| Two page widths, one of them overridden on every tab | `--layout-width` 1440, `--layout-width-grid` 1800 | one: `--layout-width` |
| Section numbers in `tokens.css` | 16 twice, two unnumbered | 1 – 20 |
| Comments describing a token that no longer exists | 3 | 0 |

**Removed as dead:** `--steel-500`, `--red-200`, `--red-700`, `--green-50`,
`--green-200`, `--grey-400`, `--color-text-subtle`,
`--color-danger-fg-strong`, `--color-warn-border`, `--color-neutral-solid`,
`--text-lg`, `--leading-compact`, `--control-height-xl`,
`--control-height-2xl`, `--z-modal`, `--layout-width-grid`.

**Left as literals, deliberately** (1 group):

- *1, 3 and 5px in spacing* (12 declarations). They are optical corrections
  between two steps of the 2px scale — a badge's inner padding, a tick's
  offset. A `--space-0-5` would give them a name without giving them a rule.
- *One-off sizes* (37 distinct): a 6px dot, a 9px swatch on paper, a 214px
  list height. Each is the measure of one thing and already says so in the
  comment beside it. A token used once is a second place to look, not a
  system.
- *Line heights on the printed sheet* (`24px`, `1.45`). They decide how many
  rows fit a page; snapping them to the screen's scale would move the
  pagination, which the 16.11. review measured sheet by sheet.

**Noted, not changed — the type scale.** Nine sizes between 10 and 24px, four
of them one pixel apart (13, 14, 15, 16), named partly by size (`--text-sm`)
and partly by job (`--text-btn`, `--text-tab`). In use they form 57 distinct
combinations of size, weight and colour. It works and it is consistent in
use; the names are not. Renaming is 150 mechanical replacements with no
visible effect — worth doing when the scale is next touched, not on its own.

## 2 · Styles and components that were the same thing twice

**A block of shared patterns** at the head of `main.css`, each said once and
joined by a selector list:

| Pattern | Was | Now |
|---|---|---|
| One line ending in an ellipsis | 19 copies of three declarations | 1 rule, 27 selectors |
| A card (surface, radius, soft shadow) | 5 copies: KPI tile, dashboard card, grid card, table card, sign-out card | 1 |
| A name that opens a dialog (text until pointed at, a link then) | 3 | 1 |
| The second line under a figure or a title; a panel's small print | 2 + 2 | 2 |
| The buttons at the end of a header | 2 | 1 |

A selector list rather than a utility class: the templates stay as they are,
and the stylesheet already groups selectors where rows and columns share a
rule. The trade is locality — a component's truncation is now stated in the
pattern block, not in the component — and the block's comment says so.

**Menu widths: twelve became four.** 170, 180, 190, 212, 216, 244, 260, 276,
284, 296, 312 and 348px, each fitted to its own longest label, passed as
numbers from nine call sites and as inline styles from four. Now
`--menu-width-sm / (default) / -lg / -xl` — 200, 248, 296, 348 — chosen by
what the menu holds, as `size:` on `dropdown()` and `menuPanel()`. Every menu
took the next step up; none got narrower. *Visible change: menus are up to
30px wider.*

**Control heights: five became three.** 26 / 32 / 34 stay. 36px was one
dialog's field and its button, 28px one icon button; they are 34 and 32 now.
*Visible: the share dialog's row is 2px lower, the card menu's button 4px
larger.*

**Smaller ones.** Two menu dividers with 2px difference in margin are one
(`divider()`, with `role="separator"`). The count badge is one size, 18px —
the bell's was 17. The underline of a sorted heading stood 3px off its text
and every other link 2px. The row caret is `--target-min` (24px), not 22.

**In the scripts:** `projectCount()` and `sumLabel()` (one wording for a
count and a group's sum, on screen and on paper), `peopleLine()`,
`tabTitle()`, `segmented({ disabled })`, and the toolbar's right-hand half as
one element (`.toolbar__end`), which is what lets the stylesheet drop three
breakpoints — see below.

## 3 · Screens of every size

### What each audience gets

| Window | Tab | Before | After |
|---|---|---|---|
| **1097×617** — small laptop at 125 % | Planung | toolbar 2 rows (80px), first row at 357px, **6** rows above the fold | 1 row (34px), first row at 279px, **8** rows |
| | Personen | first row at 325px, 7 rows | 247px, **9** rows |
| 1280×720, 1366×768 | all | toolbar 1 row, 11 – 13 rows | unchanged |
| **1920×1080** — large screen, meeting-room wall | Planung | 14 of 16 quarters, the last two behind a sideways scroll | **16 of 16** |
| 2560×1440 | all | 1744px used, 401px empty either side | 1848px, 349px |
| **768×1024** — tablet, upright | all | «Verlauf» cut off in the tab line | all four tabs |
| | Personen | 2 quarters beside 526px of frozen columns | **4** |
| **390×844** — phone | all | page 397px wide in a 375px window; **all four tabs invisible** | no sideways scroll; tabs on a line of their own |
| | Planung | a column of project **IDs** and 3 quarters; no name, no way to the project's dialog | the **name** and 2 quarters |
| | Personen | **no quarter visible**, at any scroll position | name and 2 quarters |
| 320×568 — the WCAG reflow width | all | page 397px (427 on the print tab) | 305px, no sideways scroll |

### Findings

**R1 · The tab line gave the tabs what the actions left** — nothing, on a
phone (blocker). Tabs (375px) and page actions (349px) share a line; below
740px the actions kept their width. *Fixed:* at 820px and below the line
stacks, tabs first.

**R2 · Personen froze 526px whatever the window** (blocker). All five lead
columns are frozen and the table never dropped one. On a phone the frozen
block was wider than the window, and what is frozen cannot be scrolled away.
*Fixed:* `personLayout()` drops columns when fewer than three periods would
be left — Projektanteil, Anstellung, Organisation, Projekte, in that order —
and says so in the same note Planung uses. Where columns are gone a role's
row is one cell: the role's short form and the project.

**R3 · Planung's last column standing was the ID.** `YIELD_ORDER` ended with
the name, so a phone showed four-digit numbers. *Fixed:* the name is the
floor, and on a phone it narrows to `--grid-col-title-min` (132px at least)
so two quarters stand beside it.

**R4 · The toolbar broke at window widths that were estimates.** Three
breakpoints (1100, 1250, 1300px) for «German labels», «one filter with a
count» and «search field open», and a fourth for the phone that the second
one silently overrode — the phone never got the scrolling strip its rule
describes. With fewer filters on Personen and longer labels in French none
of the three numbers was right for every case. *Fixed:* the right-hand half
is one flex item and the row wraps when it runs out of room. That is where
the two extra rows at 1097×617 come from: the row fits there, and used to
be broken regardless.

**R5 · The page stopped at 1800px, two quarters short of the plan** on the
screen a meeting room is most likely to have. *Fixed:* `--layout-width` is
1904px — the frozen block at its widest (694) plus sixteen quarters at
their floor (16 × 72), inside the page's padding.

**R6 · Seven breakpoints, four of them 50px apart in pairs.** 1440, 1300,
1250, 1100, 1024, 760, 700. *Fixed:* four, each named in the stylesheet for
what changes there, and one height:

| | |
|---|---|
| ≤ 1440 | the small laptop — every band gives back what it did not need |
| ≤ 1024 | a tablet on its side — page padding, one card per row |
| ≤ 820 | a tablet held upright — the tab line stacks |
| ≤ 760 | a phone — one column of everything |
| ≤ 460 high, landscape | a phone on its side — the header shrinks |

Everything else adapts to its content: the toolbar wraps, the grids drop
columns.

**R7 – R10 · Smaller.** The paper controls on the print tab and the log's
pager pushed a phone's page 37 and 8px wide (they wrap now). The KPI strip's
two-column rule sat at its own breakpoint. A dead `flex-wrap` rule repeated
another.

**R11 · Left: the wall of a meeting room.** At 1920×1080 the plan now fits,
at 13px type. Read from four metres that is too small, and the app has no
presentation scale — its sizes are pixels, so it does not follow the root
font size. What works today, and was measured: the browser's own zoom. At
150 % a 1920 screen is the 1280×720 layout (11 rows, 8 quarters), at 175 %
the 1097×617 one. A «Präsentation» switch that scales the tokens would be a
feature, and is a question for the product owner.

## 4 · Accessibility — WCAG 2.2 AA

All 57 text colour pairs pass (the lowest is 4.83:1). The failures were
structure, focus and non-text contrast.

### Blockers

| | Criterion | Finding | Now |
|---|---|---|---|
| A1 | 1.3.1 | **The grids were no tables.** No table, row, header or cell role on any tab; a screen reader got 20 unrelated buttons and a run of numbers without a quarter. | `role="table"` per card with the group as its name; rows, column headers with `aria-sort`, row headers, cells. The change log likewise. |
| A12 | 2.4.11 | **Focus under the frozen columns.** Tabbing along a row left the focused cell entirely beneath the frozen block; a figure could be typed into a field nobody could see. | `scroll-padding-inline-start` on the scroller, as wide as the frozen block. |
| A20 | 1.4.10 | Tabs invisible, page scrolls sideways at 320px — and, measured here, at 390px too. | R1. |
| A21 | 1.4.10 | No quarters on Personen at 640px and below. | R2. |
| A25 | 1.4.11, 2.4.7 | **Forced colours:** no rule at all. The cell being edited, a switch that is on, a ticked box, milestones and chart bars all lost their state. | A `forced-colors` block giving each an outline or a system colour. |

### Major

| | Criterion | Finding | Now |
|---|---|---|---|
| A14 | 2.1.1 (usability) | **2,090 tab stops on Planung**, 1,776 of them quarter cells that each fold the row exactly as the caret in front of it does. A row took 18 presses to cross. | A project's quarter is a cell, not a button: **314 stops** (868 instead of 2,644 with the band on). The row still folds on a click anywhere; the caret does it from the keyboard. |
| A22 | 1.4.10 | Planung at 640px and below kept the ID and dropped the name, and with it the way into the project's dialog. | R3. |
| A6 | 4.1.2 | In «Termine» the 1,776 cells stayed in the tree as disabled buttons with full names, though nothing is drawn. | Hidden from the tree there. |
| A2 | 1.3.1 | Verlauf is a div table. | Table roles. |
| A3 | 2.4.2, 2.4.6 | Every tab was titled «Personalplanung — BBL»; four tabs had no `h1`; a group's heading was named «… 11 Alle aufklappen». | The title names the tab; each page has an `h1`; the link stands beside the heading, not in it. |
| A7 | 4.1.3 | The only live region was a toast created with its text already in it — which is not announced. The result count and a saved figure said nothing. | One persistent region outside `#app`: toasts, the count when a filter moves it, a figure when it is saved. |
| A13 | 2.4.3 | Focus fell to `<body>` after removing a chip, resetting the filters, choosing a language, a page size, a zoom. | It goes to the menu's own button, to what is left of the same kind, or to the content. |
| A15 | 1.4.11 | The focus ring measured 2.39:1 on the navy header and 2.65:1 inside a chosen segment. | White there (16:1). |
| A19 | 2.5.8 | Milestones 20×20, the bars of the band 14px tall, «Alle · Keine» 18px tall. | 24px each (the bar by an invisible margin). |
| A26 | 3.3.1, 3.3.3 | A cell swallowed bad input in silence: «abc» vanished, «500» was saved as 200, «12,5» as 13. | It says what it did and what is allowed — and the cell shows what was saved. |
| A28 | 3.1.2 | Title, skip link and footer stayed German under `lang="fr"`; no `lang` on the language names. | Title and skip link are translated; each language item carries its `lang`. |
| A8 | 4.1.2 | Menus without a name; a search box and plain text inside `role="menu"`. | Every menu is named. *Left:* the person filter is still a menu with a search field in it — the right pattern is a dialog with a list, which is a redesign of that control. |
| A9 | 1.3.1 | A person over 100 % is marked on no cell; the state is in the hint only. | *Left, by design:* the overload was taken off the cells on purpose (see the comment on the KPI strip in `store.js`). It is now said in words to a screen reader and in the field's name; whether sighted readers should see it is the product owner's call. |

### Minor

Fixed: sort state as `aria-sort` (A10); the language button's name includes
what it shows (A11, in part); search fields show a focus ring (A17); the
100 % line, legend swatch borders and the open-role swatch reach 3:1 (A18);
the toolbar at 320px no longer falls to a rule that another overrode (A23).

Left: `<main>` begins with the tab line, so the skip link lands 16 stops
before the grid (A4, A16) — moving the tabs out of `<main>` changes the page
shell; the dashboard's columns have no text alternative of their own (A5);
the account dialog's name leaves out its kicker and the page behind a
dialog is not inert (rest of A11); the settings dialog's error is not tied
to its field (A27). With text spacing raised nothing clips, but 38 project
names end in an ellipsis that did not before (A24) — the whole name is in
the hint and in the dialog. And arrow keys do not move between a row's
cells (part of A14).

### Not verified

Real screen readers (NVDA, JAWS, VoiceOver), real Windows contrast themes,
Firefox and Safari, touch devices in the hand, the tagging of the generated
PDF. Everything above was measured in Chromium, with forced colours and
narrow windows emulated.

---

## What changes on screen

For whoever compares before and after — everything else is pixel-identical
at 1440, 1100 and 390px:

- Menus are one of four widths, up to 30px wider than before.
- The share dialog's field is 34px tall, not 36; the dashboard's card menu
  button 32px, not 28; the row caret 24px, not 22; the bell's badge 18px.
- A sorted heading's underline sits 1px closer.
- On a window that fits it, the toolbar is one row where it used to be two.
- Above 1800px the page is up to 104px wider.
- Phones and upright tablets: see section 3.
- The focus ring is white on the header and in a chosen segment.
- Legend swatches and the 100 % line of a chart are a step darker.
- A figure that is rejected or adjusted says so in a toast.

## Open questions

1. **A presentation scale for meeting rooms** (R11) — browser zoom works; a
   switch would be a feature.
2. **Should overload be visible on a cell?** (A9)
3. **The person filter as a dialog** rather than a menu (A8).
4. **Rename the type scale** to one scheme (section 1).
5. **Arrow keys within a row** and a real `treegrid` (A14) — the step after
   table semantics, if keyboard editing matters as much as it seems to.

## Verification

- `node tools/check.mjs` — passes.
- Stylesheet refactoring: 51 snapshots, 0 differences.
- Viewport matrix, run again on the final state: no tab scrolls sideways
  and all four tabs are visible at each of the thirteen sizes.
- Table structure: every row of every table has only cells for children;
  tab stops counted per tab.
- Keyboard and focus, print (18 paper formats), PDF, CSV and Excel: the
  scenarios of the 16.11. review, run again after the last change — same
  results, same sheet counts.

## Files

| File | What changed |
|---|---|
| `css/tokens.css` | 16 dead tokens out, 17 named ones in, sections renumbered, one page width |
| `css/main.css` | pattern block; literals to tokens; 7 breakpoints to 4; tab line, toolbar; focus rings; forced colours |
| `js/ui.js` | menu sizes, `divider()`, toolbar's end group, `tabTitle()`, names for menus, column headers with `aria-sort` |
| `js/views-overview.js`, `js/views-analysis.js` | table roles; a project's quarter as a cell; Personen's columns fit the window; phone layout of the name column |
| `js/views-schedule.js` | the band as a cell of its row |
| `js/columns.js` | the name is the floor, not the ID |
| `js/app.js` | live region, focus fallback, feedback on a rejected or adjusted figure, title and skip link per language |
| `index.html` | the live region |
| `data/i18n.json` | six entries |
