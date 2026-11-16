# Roles — planning several people per project

What the September wireframe asked for, what the November feedback round
changed, and what is built now. The data is in `DATAMODEL.md`, the code map
in `ARCHITECTURE.md`.

## The request

A project used to carry one person and one pensum. The users asked to plan
the people a project actually needs — Bearbeitender, Stellvertretung,
Bauleitung, Fachplanung — each with their own pensum, quarter by quarter, and
to hand a role over to somebody else at a quarter boundary without losing the
plan. The wireframe is `docs/wireframes/260910_Planung-kombiniert.html`.

The first build drew four fixed role lanes under a folded-open project, a
chip per quarter carrying the person's short name and the pensum, and a
popover on the chip with a stepper, a list of people, a reason and two
buttons.

## What the feedback round changed

The users tried that build and asked for less of it. Six points, all built:

1. **No «Gruppieren nach».** Six ways to cut the table were five too many.
   The projects stand in fixed groups by project size — Kleinprojekte,
   Grossprojekte, and the ones whose credit is still open. The line between
   small and large is still a setting behind the gear.
2. **A person per row, a number per cell.** The role stays where it was,
   under the project's name. The person moved off the chips into the
   «Bearbeitende» column, one row per role and person, so a cell is a plain
   number.
3. **No pensum popover.** A cell is typed into like a spreadsheet's: click,
   type, Tab or Enter. Nothing opens, nothing is confirmed, no reason is
   asked for.
4. **A click on a project row only folds it.** The project's name is text;
   the summary dialog no longer opens from the grid.
5. **The same on Personen.** A click on a person folds the row open; the
   person dialog is gone.
6. **A column for the caret, and the role beside its person.** The caret
   that folds a row has a narrow column of its own in front of everything,
   on both tabs, whichever columns are switched on. The number is called
   «Projekt-ID» and stands before «Projekt», so that «Projekt» — under which
   an open project lists its roles — is the neighbour of «Bearbeitende».

## What is built

**The Planung grid.** A project row shows the sum over its rows and is the
switch. Folded open it shows the four roles, always in the same order:

| under «Projekt» | under «Bearbeitende» | per quarter |
| --- | --- | --- |
| the role | the person, as a list to choose from | the pensum, as a field |

- A role two people hold in turn is two rows.
- A role with pensum and nobody to carry it says «nicht zugewiesen», in the
  warning hue.
- A role the project does not have is one empty, greyed row. Choosing a
  person or typing a figure plans it.
- «Weitere Person» — the plus beside a role's name, on its last row — adds an
  empty row to a role that already has somebody. That is how a handover is
  entered: empty the one row from a quarter on, fill the other.
- A folded row's «Bearbeitende» cell names the lead — whoever holds
  «Bearbeitender» now — and counts the others: «Sonja Beispiel +2».

**Editing.** Tab moves along the row, Enter and the arrows move down and up,
Escape puts the old figure back. Leaving a cell writes it. A column that
spans several quarters — a year, at year scale — shows their average, and a
figure typed into it is the pensum of each of them. In FTE the cells take
«0,4». Choosing another person in a row's list gives the whole row to them;
«nicht zugewiesen» takes the person off, and a row with neither person nor
pensum disappears. Every change is logged in Verlauf under the role's name.

**Personen.** A person's row folds open to one row per role they hold — the
role under the person's name, then the Projekt-ID, the project and when —
with their pensum per quarter. Read-only: the figures are set on Planung.

**Everything around it.** The «Bearbeitende» filter and «Mir zugewiesen» find
a person in any role on a project; «nicht zugewiesen» is a role that is open
now. The search finds every name on the project. Export and print carry the
same groups, the same column order and «Projekt-ID»; the caret's column is
the screen's alone.

## What went, and what that costs

- **The reason for an overload or a handover.** The popover asked for one and
  logged it. A cell has nowhere to ask. Verlauf still records who changed
  what, from what to what — not why.
- **The overload warning at the moment of editing.** The popover said what a
  person would stand at before the figure was applied. Now the figure is
  written and the Personen tab shows the result; the cell's hint says when
  the person is over 100 %.
- **The list of people ordered by free capacity.** The row's list is the
  roster in alphabetical order.
- **A person's contract and own project share.** They were edited in the
  person dialog, and nowhere else. The unit's share is still a setting.
- **The «Rollen» column.** The count beside the lead's name says how many
  more people are on the project.
- **Grouping by lead, organisation, phase or portfolio.** Each is a filter or
  a column sort away; none of them is a heading any more.

The project dialog itself is still there, reached from the bell, from
Verlauf, from a bar or a gate in the Termine view, and from a project's name
in an open Personen row.

## Trying it

Serve the repository (`python -m http.server 8000`), open the Planung tab and
click a project. Project 8868 (Beispielried, Rebbergweg 25) has an open
Bearbeitender and a Bauleitung that changes hands. Edits last until the page
is reloaded — signing out and in loads the fixtures afresh.
