# Review — Scrollen und Schatten in Übersicht und Termine

**Rolle:** Senior Developer · **Datum:** 26.08.2026
**Auslöser:** Beim Scrollen der Zeitachse ans rechte Ende verschwindet der Schatten
der Karte auf der linken Seite.

Drei gemeldete Beobachtungen, eine gemeinsame Ursache. Die beiden Ansichten sind
**gegensätzlich verschachtelt**, und die Übersicht hat es falsch herum.

---

## Was wir erreichen wollen

Drei Dinge, in dieser Reihenfolge:

1. **Eine Gruppe ist eine Karte auf der Seite.** Sie hat eine Kante, einen Radius
   und einen Schatten. Dieser Rahmen gehört zur Seite, nicht zum gescrollten
   Inhalt — er darf sich beim Scrollen nicht bewegen.
2. **In der Karte scrollt die Zeitachse, die Stammdaten bleiben stehen.**
3. **Alle Gruppen zeigen dasselbe Zeitfenster.** Zwei Karten mit verschiedenen
   Monaten nebeneinander sind keine Tabelle mehr.

---

## Befund 1 — Der Rahmen liegt im Scroller statt darum

```
Übersicht                              Termine
─────────────────────────────          ─────────────────────────────
.grid-card                             .gantt__group
  .scrollbox                             h2.pgrouphead
    .pgrid          ← Scroller           .gantt__card    ← Karte, steht still
      .pgrid__track                        .gantt__scroll  ← Scroller
        h2.pgrouphead  (sticky)              .gantt__axis
        .pblock     ← Karte, scrollt mit     .gantt__body
        h2.pgrouphead
        .pblock
        …
```

Die Karte der Übersicht liegt **im** Scroller. Gemessen bei 1500 px Fenster:

| Element | links | rechts | Abstand zum `.wrap` links / rechts |
|---|---|---|---|
| `.toolbar` | 58 | 1442 | 28 / 28 |
| `.grid-card` | 58 | 1442 | 28 / 28 |
| **`.pblock`** | 58 | **1703** | 28 / **−233** |

`.pblock` ist das Element, das Radius und Schatten trägt — und es ist 233 px
breiter als der Inhaltsbereich. Daraus folgt alles Gemeldete:

- **Die rechte Kante der Karte war nie zu sehen.** Radius und Schatten rechts
  liegen dauerhaft ausserhalb des Fensters.
- **Beim Scrollen wandert auch die linke Kante hinaus.** Das ist der gemeldete
  Fehler: der Schatten verschwindet links, weil er zu einer Box gehört, die
  mitscrollt.
- Was der Betrachter für die Karte hält, ist in Wahrheit `.grid-card` — und die
  hat weder Radius noch Schatten.

### Der Folgeaufwand dieser Verschachtelung

Der Kommentar im Stylesheet nennt ihn selbst:

> *In der Übersicht liegt die Überschrift im Scroll-Track, und eine klebende Box
> kann nur innerhalb ihrer eigenen Breite gleiten — eine Überschrift über die
> volle Breite hätte keinen Weg und würde mit den Quartalen wegscrollen. Also
> nimmt die Überschrift selbst keine Breite ein und der Knopf darin spannt über
> den Scrollport, dessen Breite der Scroll-Handler als `--port-w` veröffentlicht.*

Das ganze Gebilde — klebende Überschrift, Nullbreiten-Trick, eine aus JavaScript
veröffentlichte CSS-Variable — existiert **nur**, weil die Überschrift im
Scroller liegt. In Termine steht sie daneben und braucht nichts davon.

Dazu kam beim letzten Umbau `--scroll-x`: der Schattenstreifen der eingefrorenen
Spalte muss die Bewegung der Karte ausgleichen. Auch das entfällt, sobald die
Karte stillsteht — der Gantt-Streifen kommt schon heute ohne aus.

**Vier Dinge, die nur der falschen Verschachtelung geschuldet sind:**
`--port-w`, `--scroll-x`, die klebende Überschrift, und zwei verschiedene
CSS-Regeln für denselben Schatten.

---

## Befund 2 — Termine hat 46 unabhängige Scroller

Termine hat die richtige Verschachtelung, aber daraus folgt: **jede Gruppenkarte
scrollt für sich.** Gemessen mit 46 Gruppen, eine Karte um 130 px gescrollt:

```
Scrollposition der ersten fünf Karten: [130, 0, 0, 0, 0]
```

Karte 1 zeigt September bis August, Karte 2 zeigt Juli bis Juni — dieselbe
Tabelle, zwei Zeitfenster. Das gilt auch für das Auslastungsband darunter, das
dieselbe Zeitachse führt und ebenfalls stehen bleibt.

Bisher fiel es nicht auf, weil der Balkenplan bis vor Kurzem nie seitlich
scrollte. Seit er es tut, ist es ein echter Fehler.

Die Übersicht hat dieses Problem nicht — ein Track für alle Gruppen. Das ist der
*eine* Vorteil ihrer Verschachtelung, und er ist der Grund, warum sie so gebaut
wurde. Er lässt sich aber auch anders haben.

---

## Befund 3 — Der rechte Abstand stimmt bereits

Vermutet wurde, das Raster ignoriere das rechte Padding von `.wrap`. Über acht
Fensterbreiten nachgemessen — Box-Kante und tatsächlich gemalter Pixel:

| Fenster | Toolbar rechts | Karte rechts | gemalt bis | `.wrap` rechts |
|---|---|---|---|---|
| 1200 | 1172 | 1172 | 1173 | 1200 |
| 1440 | 1412 | 1412 | 1413 | 1440 |
| 1700 | 1542 | 1542 | 1543 | 1570 |
| 1920 | 1652 | 1652 | 1653 | 1680 |

Der Abstand ist bei jeder Breite exakt 28 px, also genau das Padding. **Es gibt
keinen Überstand.**

Was den Eindruck erzeugt, ist Befund 1: rechts endet die Tabelle mit einem
weichen Verlauf mitten in einer Spalte, weil die Karte dort gar nicht aufhört —
sie läuft 233 px weiter und wird vom Scrollport abgeschnitten. Jedes
Nachbarelement endet mit einer sauberen Kante, die Tabelle löst sich auf. Sobald
die Karte den Scroller umschliesst, fällt ihre rechte Kante mitsamt Radius und
Schatten genau auf das Padding.

---

## Befund 4 — Panning und Verlauf im Gantt funktionieren bereits

Nachgemessen bei 1150 px, Monatsskala:

```
{ room: 130, overflowX: "auto", has-more: true, mask: ja, capRoom: 130, capMask: ja }
```

`.gantt__scroll` ist ein nativer Scroller, also funktioniert das Schieben mit
mittlerer Maustaste und Trackpad ohne Zutun. Der Verlauf rechts (`--fade-right`)
liegt ebenfalls an, sobald es etwas zu scrollen gibt — Karte und Auslastungsband
tragen beide `has-more`.

Was fehlte, war nicht der Verlauf, sondern der Anlass: der Balkenplan hatte ein
kleineres Spaltenminimum als die Übersicht und passte fast immer ins Fenster.
Seit beide `--grid-quarter` verwenden, scrollt er unter denselben Bedingungen.

---

## Empfehlung

**Die Übersicht übernimmt die Verschachtelung von Termine, und die Scroller
werden im Gleichschritt gehalten.**

```
.grid-card
  .pgroup
    h2.pgrouphead              ← neben der Karte, nicht darin
    .pblock.scrollbox          ← die Karte: Radius, Schatten, overflow:hidden
      .pgrid[data-scroll]      ← der Scroller
        .pgrid__track          ← min-width, damit die Zeilen fluchten
  .pblock--foot.scrollbox
    .pgrid[data-scroll] …
```

Was daraus folgt:

| | vorher | nachher |
|---|---|---|
| Kartenrahmen beim Scrollen | wandert hinaus | steht |
| rechte Kartenkante | nie sichtbar | auf dem Padding |
| Gruppenüberschrift | sticky + Nullbreiten-Trick | gewöhnliche Überschrift |
| `--port-w` (aus JS) | nötig | entfällt |
| `--scroll-x` (aus JS) | nötig | entfällt |
| Schattenregel | zwei verschiedene | eine gemeinsame |
| Zeitfenster über Gruppen | gemeinsam (ein Track) | gemeinsam (Gleichlauf) |

Der einzige Zugewinn an Code ist der Gleichlauf. Er ersetzt zwei aus JavaScript
veröffentlichte CSS-Variablen und behebt zugleich Befund 2 in Termine — und das
Auslastungsband läuft dann mit dem Balkenplan mit, was es heute nicht tut.

**Warum nicht anders gelöst:**

- *Rahmen stehen lassen, einen Scroller behalten.* Der Rahmen müsste je Gruppe
  von etwas Unbeweglichem gezeichnet werden, das die vertikale Ausdehnung der
  Gruppe kennt. In CSS nicht ausdrückbar.
- *Radius und Schatten auf `.pgrid` legen.* Dann gäbe es eine Karte um das ganze
  Raster statt eine je Gruppe — die Lücken zwischen den Gruppen wären weiss.
  Das ist ein anderes Design.
- *Einen Scheinrahmen mit `--scroll-x` mitführen.* Möglich, aber der Radius säße
  an der Fensterkante, während die abgerundeten Ecken der Zeilen am Inhaltsende
  liegen. Zwei Rundungen, die nicht zusammenpassen.

---

## Umsetzung

Gemacht wie beschrieben. Geprüft:

- Kartenkante links und rechts bleibt beim Scrollen stehen, Abstand 28 px auf
  beiden Seiten, über alle geprüften Fensterbreiten.
- Alle Scroller einer Ansicht zeigen nach jedem Scrollen dieselbe Position —
  in beiden Tabs, inklusive Auslastungsband.
- `--port-w` und `--scroll-x` sind aus Code und Stylesheet verschwunden.
- Der Schatten der eingefrorenen Spalte kommt aus einer Regel für beide Tabs.
- `flow.js`, `audit.js`, `resp.js`, `robust.js` grün.
