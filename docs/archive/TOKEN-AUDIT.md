> **Superseded — kept for the record.**
> Written against an eight-quarter data set and a layout that no longer
> exists. Standing rules from this document were harvested into
> [`DECISIONS.md`](../DECISIONS.md); the mechanism it describes, where still
> true, is in [`ARCHITECTURE.md`](../ARCHITECTURE.md). Do not cite this file
> as current.

# Token-Audit — hartcodierte Werte und die Radius-Skala

**Rolle:** Senior Design Engineer · **Datum:** 26.08.2026
**Umfang:** `css/tokens.css`, `css/main.css` (1 940 Zeilen), die Rasterbreiten in `js/views-overview.js`

Die Frage war einfach: *Wo steht ein Wert direkt im Stylesheet, der als Token
gehörte?* Die Antwort ist nicht durchgehend «überall». Vier Systeme waren bereits
sauber, zwei fehlten ganz, und an einer Stelle stand dieselbe Zahl in zwei
Dateien — das war der einzige Fund mit echtem Fehlerpotenzial.

---

## Ausgangslage, gemessen

| System | Zustand vorher |
|---|---|
| Farben (App) | **sauber** — 0 rohe Werte ausserhalb `tokens.css` |
| `z-index` | **sauber** — 0 rohe Werte |
| `font-weight` | **sauber** — 0 rohe Werte |
| `letter-spacing`, `line-height` (App) | **sauber** — über `--tracking-*` / `--leading-*` |
| Schatten | 14 von 26 benannt, 12 inline |
| **Bewegung** | **0 Tokens** — 4 Dauern, 4 Easings, 13 Verwendungen |
| **Druckbogen** | **0 Tokens** — 9 rohe Schriftgrössen, `#fff`, ein roher Schatten |
| Radius | 9 Tokens, 16 Verwendungsmuster, 2 rohe px |
| Rasterbreiten | **doppelt geführt** — Token *und* JS-Literal |

---

## A · Bewegung hatte kein System

`.12s` (8×), `.15s`, `.16s` (3×), `.7s`, dazu `ease`, `ease-out`, `ease-in`,
`linear` — alle direkt im Stylesheet. Bewegung ist eine Systemeigenschaft: sie
gehört an einen Hebel, schon weil `prefers-reduced-motion` genau einen braucht.

Die `.15s` am Skip-Link war eine Abweichung ohne Grund und ist mit `.16s`
zusammengefallen. Zwei Dauern tragen die ganze App:

```css
--dur-fast:  .12s;   /* ein Bedienelement antwortet: Hover, Druck, Schalter */
--dur:       .16s;   /* etwas kommt oder geht: Toast, Suche, Banner        */
--dur-spin:  .7s;    /* der Boot-Spinner, die einzige Dauerbewegung        */
```

13 Verwendungen umgestellt.

---

## B · Der Druckbogen war ein zweites, unbenanntes Design

Rund 200 Zeilen Papierlayout mit eigener Skala, komplett als nackte Zahlen:
`10px`, `10.5px`, `11px`, `16px`, `#fff`, `0 8px 24px rgba(0,0,0,.14)`.

Absolute Grössen sind hier **richtig** — eine Seite ist ein festes physisches
Ding und skaliert nicht mit dem Viewport. Falsch war nur, dass die Skala keinen
Namen hatte und damit nicht prüfbar war. Jetzt:

```css
--sheet-text:   10px;    --sheet-meta:  10.5px;
--sheet-lead:   11px;    --sheet-title: 16px;
--color-paper:  var(--white);
--shadow-sheet: 0 8px 24px rgba(0, 0, 0, 0.14);
```

9 Schriftgrössen, 2× `#fff` und der Blattschatten umgestellt.

---

## C · Die WCAG-Zielgrösse stand 10× als Zahl da

`min-height: 24px` — das ist kein Mass, das jemand gewählt hat, sondern die
Untergrenze aus WCAG 2.2 «Target Size (Minimum)». Als `--target-min` benannt,
damit erkennbar bleibt, dass es eine Regel ist und keine Geschmacksfrage.

---

## D · Die Rasterbreiten standen doppelt — der einzige echte Defekt

```js
pin('id', c.id, 'var(--grid-col-id)', COL_W.id);   //  Template ← Token
                                                   //  Sticky-Offset ← JS-Zahl
```

Das Raster-Template las die Breite aus dem Token, die Offsets der eingefrorenen
Spalten aus einer JS-Konstante. **Beide müssen auf den Pixel übereinstimmen**,
sonst laufen Kopfzeile und Zellen auseinander — genau der Fehler, der in diesem
Projekt schon einmal auftrat. Fünf Breiten standen so an zwei Orten, fünf
weitere nur in JS.

Jetzt sind alle elf in `tokens.css` und werden einmal beim ersten Rendern
gelesen:

```js
const COL_KEYS = ['ampel', 'id', 'title', 'phase', 'lead', 'portfolio',
  'priority', 'nextMs', 'credit', 'target', 'quarter', 'trend'];
let widths = null;
function colWidths() {
  if (widths) return widths;
  const css = getComputedStyle(document.documentElement);
  ...
}
```

Nachgemessen: Kopfzeile und Datenzeile decken sich über 14 Spalten auf 0 px —
vor und nach horizontalem Scrollen.

---

## E · Die HTTP-Methodenfarben von Swagger

Neun rohe Hexwerte re-tönen ein Fremd-Widget. Sie gehören bewusst **nicht** zur
App-Palette, sind aber eine Kontrastentscheidung (die Originalfarben stellten
weissen Text auf 1.6:1). Benannt mit dem gemessenen Kontrast im Kommentar,
damit die Entscheidung prüfbar bleibt statt begründungslos dazustehen.

---

## F · Radius: neun Tokens für vier Rollen

Der Auslöser war eine Beobachtung: *«manche Elemente haben eine einzelne
gerundete Ecke»*. Beides stimmte — es gab ein Skalenproblem **und** einen Bug.

**Das Skalenproblem.** Neun Tokens, aber die Verteilung zeigte nur vier Rollen:

| Token | Verwendungen | Rolle |
|---|---|---|
| `--radius` 6px | 23 | Bedienelemente |
| `--radius-pill` | 14 | rund von Natur aus |
| `--radius-lg` 8px | 13 | Flächen |
| `--radius-sm` 3px | 5 | Marken in Bedienelementen |
| `--radius-md` 4px | **2** | `.legend` *und* ein Gantt-Balken |
| `--radius-menu` 5px | **1** | `.dd__item` |
| `--radius-xl` 10px | **1** | `.pop` |
| `--radius-2xl` 12px | **1** | `.modal` |
| `--radius-xs` 1px | 1 | Ampel-Spitze |

Die drei Überlagerungsflächen — Menü 8, Popover 10, Dialog 12 — waren der Kern
des Eindrucks: dieselbe Art Ding, drei Radien. `--radius-md` teilte sich eine
Legende mit einem Balken, was Zufall ist und kein System. Und `--radius-menu`
war ein eigenes Token für genau ein Element bei einem Wert, den es sonst
nirgends gab.

Vier Rollen bleiben, fünf Tokens:

```css
--radius-xs:   2px;    /* Haarlinie — Fokusring, Sparkline, Ampel-Spitze */
--radius-sm:   3px;    /* Marke in einem Bedienelement — Häkchen, Balken */
--radius:      6px;    /* Bedienelemente — Knöpfe, Felder, Tabs, Menü    */
--radius-lg:   8px;    /* Flächen — Karten, Panels, Popover, Dialoge     */
--radius-pill: 9999px; /* rund von Natur aus — Avatar, Badge, Schalter   */
```

Vier Tokens zurückgezogen, die beiden rohen px (`1px`, `2px`) aufgenommen.
Die halben Radien der Gantt-Balken bleiben — die tragen Bedeutung
(links offen = die Phase läuft von früher her weiter).

**Der Bug.** Die untere rechte Ecke der Projekttabelle war quadratisch: die
farbige Heat-Zelle malte über die Rundung der Zeile. Die linken Spalten sind
sticky und dürfen keinen Radius bekommen — sie würden ihn beim Scrollen mitten
in die Zeile tragen. Die rechte Kante ist nicht sticky, also bekommt genau die
Eckzelle den Radius:

```css
.pblock > .prow:first-child > :last-child { border-top-right-radius: var(--radius-lg); }
.pblock > .prow:last-child  > :last-child { border-bottom-right-radius: var(--radius-lg); }
```

---

## G · Was bewusst eine nackte Zahl bleibt

Nicht jede Zahl ist ein Token-Kandidat. Diese bleiben, mit Begründung:

| Wert | Ort | Warum |
|---|---|---|
| `width/height: 6px` | `.xsearch__dot`, `.lead-open::before` | Eigengeometrie eines Punktes, kein Abstand |
| `11px` | `.legend__swatch`, `.diamond` | Kantenlänge einer Marke |
| `1px` | Trenner, `gap` in `.dd__panel` | eine Haarlinie ist keine Abstandsstufe |
| `padding: 3px` | `.pgrid` | der Ausblutungsrand für den Fokusring, nicht Abstand — jetzt kommentiert |
| `line-height: 1.45 / 1.6` | Druckprosa | Papierwerte ohne Entsprechung in der Bildschirmskala |

Angeglichen wurden dagegen die Werte, die *zwischen* zwei Stufen der Skala
sassen (`5px` → `--space-3`) und der Schalterknopf, dessen `left: 17px` jetzt
aus der Schaltergeometrie gerechnet wird statt danebenzustehen:

```css
.switch.is-on .switch__knob { left: calc(var(--switch-width) - var(--switch-knob) - 2px); }
```

---

## Ergebnis

| | vorher | nachher |
|---|---|---|
| Rohe Farben in `main.css` | 12 | **0** |
| Rohe Dauern / Easings | 13 | **0** |
| Rohe Schriftgrössen | 9 | **0** |
| Radius-Tokens | 9 | **5** |
| Rohe Radius-Werte | 2 | **0** |
| Doppelt geführte Rasterbreiten | 5 | **0** |

Alle drei Prüfläufe grün: `flow.js` 48 Prüfungen ohne Fehler, `audit.js` 0
Kontrastverletzungen / 0 fehlende Namen / 0 zu kleine Ziele, `resp.js` 0 px
horizontaler Überlauf auf allen Breiten.
