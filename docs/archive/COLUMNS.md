> **Superseded — kept for the record.**
> Written against an eight-quarter data set and a layout that no longer
> exists. Standing rules from this document were harvested into
> [`DECISIONS.md`](../DECISIONS.md); the mechanism it describes, where still
> true, is in [`ARCHITECTURE.md`](../ARCHITECTURE.md). Do not cite this file
> as current.

# Spalten — ein Menü, zwei Sätze, ein Raster-Mechanismus

**Datum:** 26.08.2026 · **Umfang:** `js/columns.js`, `js/store.js`, `js/views-schedule.js`,
`js/views-overview.js`, `js/views-docs.js`, `js/app.js`, `js/ui.js`, `css/main.css`

---

## Der Befund

Drei Dinge waren verheddert.

**1 · Der Attribute-Knopf stand in Termine, aber das Raster las die Registry
nicht.** ID und Projekt waren dort fest verdrahtet; jeder Spaltenschalter im
Menü war in diesem Tab wirkungslos. Der Knopf versprach etwas, das er nicht
halten konnte.

**2 · `id` trug einen Schalter, `title` nicht.** Genau verkehrt herum: eine Zeile
ohne ihre Nummer ist immer noch eine Zeile, eine Tabelle ohne das Projekt ist
keine Ansicht.

**3 · Ein Satz Schalter bediente alle Tabs.** «Ampel an in Übersicht, aus in
Termine» liess sich gar nicht ausdrücken.

Dazu lag ein Schalter je nachdem in `state.cols` oder als `state.x` obenauf, und
jeder Verbraucher musste wissen, welches von beidem — ein Wart, den der
Kommentar in `columns.js` schon benannt hatte.

---

## Was jetzt gilt

### Ein Schaltmechanismus

`flag` ist ein Schlüsselname statt eines Paars, und alle Schalter liegen im
selben Satz. `ampel`, `target` und `trend` sind mitgezogen — sie waren die
Ausnahme, die den Sonderweg nötig machte.

```js
{ key: 'title', label: 'Projekt', flag: 'title', … }
{ key: 'id',    label: 'ID',      flag: null,    … }   // der einzige ohne Schalter
```

### Zwei Sätze, einer je Raster

```js
const COLUMN_DEFAULTS = {
  overview: { title, phase, lead, ampel, credit },     // + id, immer
  schedule: { title }                                  // + id, immer
};
```

Das ergibt die gewünschten Vorgaben: **Übersicht** ID · Projekt · SIA-Phase ·
Projektleitung · Ampel · Kredit CHF, **Termine** ID · Projekt.

`columnSet()` liefert den Satz, den die Ansicht vor dem Leser antreibt. Der
Export-Tab hat kein eigenes Raster — er druckt eines der beiden und folgt
deshalb dem gewählten Bericht.

Nachgemessen: ein Zuschalten in Übersicht lässt Termine unberührt und umgekehrt.

### Termine liest dieselbe Registry

Der eingefrorene Block war in beiden Tabs derselbe Zuschnitt, zweimal
geschrieben. Neu ist `leadLayout()` in `columns.js`: Rasterschablone, Pinn-Positionen
und was weichen musste, an einer Stelle. Beide Tabs frieren dieselben Spalten in
derselben Reihenfolge ein — ein Projekt sitzt an derselben Stelle, egal welchen
Tab man liest.

Der Balkenplan zeichnet damit jede Spalte, die das Menü anbietet. «Verlauf»
bleibt dort ausgenommen: eine Sparkline zeichnet über Quartalszellen, die dieses
Raster nicht hat.

### ID ist der Boden

`id` ist aus der Nachgeberliste heraus, `title` ans Ende gestellt:

```js
const YIELD_ORDER = ['nextMs', 'priority', 'portfolio', 'target', 'credit',
                     'phase', 'ampel', 'lead', 'title'];
```

Damit läuft die Liste auf einem Telefon bis zu ihrem Ende und lässt genau ID
stehen — ohne eigenen Breakpunkt, aus derselben Regel, die auch am Laptop
greift. Gemessen:

| Breite | Übersicht | Termine |
|---|---|---|
| 1280 | ID · Projekt · SIA-Phase · Projektleitung · Ampel · Kredit CHF | ID · Projekt |
| 1024 | ID · Projekt · SIA-Phase · Projektleitung · Ampel | ID · Projekt |
| 768 | ID · Projekt · Projektleitung | ID · Projekt |
| 480 | **ID** | **ID** |
| 390 | **ID** | **ID** |

Kein Seitenüberlauf bei irgendeiner dieser Breiten.

---

## Zwei Fehler, die beim Bauen auffielen

**Zwei dehnbare Gleise in einer Zeile.** Im Balkenplan nahmen Titelspalte und
Balkenspur den freien Platz je zur Hälfte. `--gantt-lead` meldete 693 px,
tatsächlich war der Block 896 px breit — das Auslastungsband und die
Heute-Marke hätten 203 px daneben gelegen. Nur ein Gleis darf dehnen: im
Pensumraster der Projekttitel, im Balkenplan die Balken.

**Ein Polster, zwei Werte.** Der Balkenplan gab seinen Zellen 12 px auf beiden
Seiten, das Pensumraster 8 px rechts. Beide lesen dieselben Breiten-Token, also
verlor eine 152-px-Spalte im einen Tab 8 px und «33 Bewilligungsverfahren»
kürzte dort, während es im anderen passte. Jetzt gilt dasselbe Polster.

Ausserdem entfernt: `--grid-pane-left` samt seinem letzten Leser — die Breite des
eingefrorenen Blocks entsteht jetzt aus den gewählten Spalten und wird je
Render gesetzt.

---

## Abgesichert

`flow.js` prüft vier Dinge: dass jedes Raster von seinem eigenen Satz startet,
dass ID keinen Schalter hat und Projekt einen, dass die beiden Sätze sich nicht
gegenseitig überschreiben, und dass bei 390 px in beiden Tabs genau ID
stehenbleibt — ohne Überlauf.

Nachgemessen ausserdem: Projekt lässt sich in beiden Rastern ausblenden; sind
alle Schalter aus, bleibt ID und die 120 Zeilen zeichnen weiter; beide
Druckberichte behalten ihre Blattzahlen (11 / 10 / 5 / 6) ohne Überlauf über den
Bogenrand.
