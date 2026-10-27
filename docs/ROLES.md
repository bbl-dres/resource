# Roles — planning several people per project

What the September wireframe asked for, what is built, and what was left out.
For the feedback round with the users; the rules it settled are in
`DECISIONS.md`, the data in `DATAMODEL.md`.

## The request

A project used to carry one person and one pensum. The users asked to plan
the people a project actually needs — Bearbeitender, Stellvertretung,
Bauleitung, Fachplanung — each with their own pensum, quarter by quarter, and
to hand a role over to somebody else at a quarter boundary without losing the
plan. The wireframe is `docs/wireframes/260910_Planung-kombiniert.html`,
eleven screens: the current state (0a), a first iteration with role rows and
role columns (1a–1f), a redesign from scratch (2a, 2b), and the concept
brought back into the prototype's own design (3a, 3b).

## What is built

**3b — fixed role lanes.** The Planung tab is the one the users know. The
project row shows the sum over its roles and is the switch: a click anywhere
on it — the caret, a figure, the empty space — folds it open to four lanes in
a fixed order, Bearbeitender, Stv. Bearbeitender, Bauleitung, Fachplanung,
the same under every project. Each quarter of a lane is a chip: the person's
short name and the pensum, in the heat colour of the value. A dashed amber
chip is a role that is planned and open. A lane ePPM does not foresee for the
project is there but greyed. «Besetzung aufklappen» beside a group heading
folds the whole group. The «Rollen» column counts the lanes; the
«Bearbeitender» column is now a label, the person in that role in the current
quarter.

**Staffing on the chip.** A chip opens a popover for that role and that
quarter: the pensum of the quarter with the stepper the cell editor had, and
the person from that quarter on, listed by free capacity with the current
holder first and «Rolle offen lassen» last. A different name is a handover —
the previous holder's segment ends the quarter before, the pensum stays with
the role — and asks for a reason, as an overload does. A slot in an empty
lane plans the role afresh, creating it on the project. Everything is logged
in Verlauf under the role's name, one entry per half.

**Project dialog (1c).** «Bearbeitender» became «Besetzung»: how many roles
and people this quarter, who holds what, and the changes ahead. A new section
«Rollen und Besetzung» draws one band per role over the whole window, with
the person on each segment.

**Personen tab (1e).** A person's row folds open to one lane per role they
hold — role, project, when — with the role's pensum in the quarters they
carry it and a blank where somebody else does. «Projekte» became «Rollen».
A person's load is the sum of their roles, so the utilisation figures move
with every staffing change.

**Everything around it.** The «Bearbeitende» filter and «Mir zugewiesen»
find a person in any role on a project; «nicht zugewiesen» is a role that is
open now. The search finds every name on the project. The bell lists the
projects the reader has any role on. Export, print, the dashboard and the
history read the same roles through the same derived figures.

## What is not built, and why

- **3a — chips inside the project cell.** The alternative the wireframe
  shows beside 3b: the folded-open row keeps its one line per project and
  stacks the role chips inside each cell. Not built; 3b maps one role to one
  row, which is what the grid is made of, and the wireframe's own note calls
  it the MVP. Worth asking the users which of the two reads better.
- **1f — the handover dialog.** The wireframe re-purposed the rebooking
  dialog as a form with a preview of the role's band. A handover is a change
  of person on the chip of the quarter it starts from instead, so one
  control covers assigning, handing over and leaving open. The dialog can
  come back if the users want the preview.
- **1d — «Rolle hinzufügen» as a second popover.** Adding a role is a slot
  in its lane; the lane is always there.
- **Overload marks on the chips.** The wireframe's 3b leaves them out; the
  folded project row keeps its warning, and the popover says what the chosen
  person would stand at.
- **One role shared by two people in the same quarter.** The model holds one
  holder per role and quarter. Not asked for.
- **Pensum over several quarters at once.** The stepper sets one quarter, as
  the cell editor always did.

## Trying it

Serve the repository (`python -m http.server 8000`), open the Planung tab,
filter to a Teilportfolio and click «Besetzung aufklappen». Project 4888
(Beispielau, Kasernenstrasse 93) has an open Bearbeitender; several projects
change hands during 2027. Edits last until the page is reloaded — signing
out and in loads the fixtures afresh.
