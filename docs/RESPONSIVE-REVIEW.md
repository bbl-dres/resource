# Responsive-Review — vom Telefon bis zum Sitzungsschirm

**Rolle:** Senior Design & UX · **Datum:** 26.08.2026
**Gerätemix laut Auftrag:** die meisten auf einem kleinen Laptop, einige am
grossen Desktop, in Sitzungen auf 4K-Schirm oder Beamer, wenige auf Smartphone
oder iPad.

Gemessen wurde über zehn Gerätegrössen und fünf Tabs im Browser — kein Befund
unten ist geschätzt.

Vorweg das Ergebnis: **kein einziger horizontaler Seitenüberlauf, auf keinem
Gerät.** Die Grundlage stimmte. Die drei Funde betrafen etwas anderes — ein
Menü, das aus dem Fenster lief, ein Telefon, das eine ganze Bildschirmhöhe
Bedienung vor die erste Zahl stellte, und grosse Schirme, auf denen mehr Breite
die Sache **schlechter** machte.

---

## 1 · Menüs liefen auf dem Telefon aus dem Fenster

Bei 390 px hing das Attribute-Menü **176 px links ausserhalb** des Fensters, die
Glocke 16 px. Beides sind rechts verankerte Panels an einem Auslöser weit links.

Eine Klemmung gab es bereits, sie war nur wirkungslos:

```js
// vorher
if (box.left < 12) panel.style.marginLeft = `${12 - box.left}px`;
```

`margin-left` ist bei einem rechts verankerten, absolut positionierten Kasten nur
ein halber Hebel — die Marge geht in dieselbe Gleichung ein wie `right`. Eine
Korrektur von 376 px verschob den Kasten um 188 px, und das Menü hing weiter
draussen.

Jetzt wird in Fensterkoordinaten geklemmt und das Ergebnis als `left` gegen den
eigenen Bezugsrahmen gesetzt:

```js
const want = Math.min(Math.max(box.left, MENU_EDGE),
                      window.innerWidth - MENU_EDGE - width);
panel.style.left = `${Math.round(want - origin)}px`;
panel.style.right = 'auto';
```

Nachgemessen: **48 Menü-Öffnungen** über vier Tabs und vier Breiten
(1600 / 768 / 596 / 390 px) — alle im Fenster, keine einzige ausserhalb.

---

## 2 · Auf dem Telefon kam die Bedienung vor den Daten

Die neun Bedienelemente der Toolbar brachen in **sechs Reihen** um. Gemessen auf
einem iPhone 14:

| | vorher | nachher |
|---|---|---|
| Toolbar-Höhe | 202 px | **34 px** |
| erste Datenzeile bei | 799 px | **583 px** |
| das sind … der Fensterhöhe | **95 %** | **69 %** |

Bei 95 % scrollte man eine volle Bildschirmhöhe, bevor eine Zahl auftauchte. Auf
dem ersten Bildschirm stand keine einzige Datenzeile; jetzt stehen fünf.

Die Lösung ist keine neue Ansicht, sondern **eine Reihe statt sechs**: unterhalb
700 px scrollt die Toolbar seitwärts statt umzubrechen. Jedes Bedienelement
bleibt erreichbar, keines verschwindet.

```css
@media (max-width: 700px) {
  .toolbar {
    flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none;
    margin-inline: calc(-1 * var(--space-8)); padding-inline: var(--space-8);
  }
  .toolbar > * { flex: 0 0 auto; }
}
```

Der negative Aussenabstand lässt die Reihe bis an den Bildschirmrand laufen, so
wie es sich anfühlen soll. Die Kopfaktionen (Bearbeiten · Exportieren · Teilen)
haben dieselbe Behandlung bekommen — sie standen in zwei Reihen und kosteten
weitere 48 px.

---

## 3 · Auf grossen Schirmen machte mehr Breite es schlechter

Der erste Befund war der erwartete: bei 1920 px blieben **480 px ungenutzt**, bei
2560 px **1120 px**, auf 4K **2400 px**. Der Inhalt hing bei 1440 px fest.

Der zweite Befund war der überraschende. Hebt man die Kappung einfach an,
passiert Folgendes:

| Kappung | Titel gekürzt | Titelspalte | Quartalsspalte |
|---|---|---|---|
| 1440 px | 29 von 111 | 285 px | 72 px |
| 1700 px | **29 von 111** | **285 px** | 105 px |
| 2000 px | **29 von 111** | **285 px** | 142 px |
| 2400 px | **29 von 111** | **285 px** | **192 px** |

**Der Projektname wurde keinen Pixel breiter.** Acht dehnbare Quartalsgleise
standen gegen ein dehnbares Titelgleis, also gingen 8/9 jedes zusätzlichen Pixels
an die Zahlen — bis eine zweistellige Zahl in einer 192 px breiten Spalte stand,
während 29 Projektnamen weiter abgeschnitten waren.

Die Reparatur ist eine Decke, kein grösserer Anteil:

```css
--grid-quarter-max:  96px;   /* darüber verlängert eine breitere Ansicht den
                                Projektnamen, nicht den Platz um eine Zahl */
```

Damit lohnt sich die grössere Kappung erst:

| | Inhalt | ungenutzt | Titel gekürzt | Quartal |
|---|---|---|---|---|
| 1280 px | 1224 px | 0 | 29/111 | 72 px |
| 1440 px | 1384 px | 0 | 29/111 | 72 px |
| **1920 px** | **1800 px** | **120 px** | **0/111** | **96 px** |
| 2560 px | 1800 px | 760 px | 0/111 | 96 px |

Die Kappung ist **nach Tab verschieden**: eine Tabelle will Breite, Fliesstext
will ein Mass. Die Startseite und die API-Referenz bleiben bei 1440 px.

```css
:root[data-tab="overview"],
:root[data-tab="schedule"],
:root[data-tab="history"] { --layout-width: var(--layout-width-grid); }
```

### Ein Fehler, den ich mir dabei eingebaut habe

Das `data-tab` setzte ich zuerst **nach** dem Rendern. Die Raster messen diese
Breite aber, während sie ihre Spaltenschablone bauen — die erste Darstellung
eines Tabs richtete sich also nach der Breite des vorherigen. Sichtbar wurde es
als 141 px breite Quartalsspalte in Termine, wo 96 px stehen sollten. Das
Attribut wird jetzt vor dem Rendern gesetzt.

### Und die beiden Raster mussten nachziehen

Bei 1920 px zeigte die Übersicht jeden Projektnamen vollständig, während Termine
weiterhin 29 von 111 kürzte — gleicher Schirm, gleiche Daten, zwei Antworten.
Der Balkenplan verlängert den Namen jetzt ebenfalls, bis zu
`--grid-col-title-max: 460px`; darüber geht der Überschuss an die Balken, denn
die sind dort der Inhalt.

| Breite | Übersicht gekürzt | Termine gekürzt | Titel Ü / T | Quartal Ü / T |
|---|---|---|---|---|
| 1280 | 29/111 | 0/111 | 285 / 460 | 72 / 88 |
| 1920 | **0/111** | **0/111** | 456 / 460 | 96 / 153 |
| 3840 | 0/111 | 0/111 | 456 / 460 | 96 / 153 |

Das Auslastungsband sitzt an jeder Breite exakt unter der Zeitachse (Versatz 0),
und die gemeldete Breite des eingefrorenen Blocks stimmt mit der tatsächlichen
überein — beides nachgemessen, weil genau das beim Umbau zweimal auseinanderlief.

---

## 4 · Sitzungszimmer: Zoom, nicht Breite

Ein 4K-Schirm im Sitzungszimmer und ein 4K-Monitor auf dem Schreibtisch haben
**dieselben Pixelmasse und entgegengesetzte Bedürfnisse**: aus vier Metern will
man grössere Schrift, aus sechzig Zentimetern mehr Inhalt. CSS kann die beiden
nicht unterscheiden — Betrachtungsabstand ist keine Medienabfrage.

Die App darf die Schrift deshalb nicht automatisch mitskalieren; das würde den
Schreibtischfall zerstören. Was im Sitzungszimmer wirkt, ist der Browser-Zoom,
und der funktioniert, weil Zoom nichts anderes ist als ein schmaleres
CSS-Fenster:

| Zoom auf 3840 px | CSS-Fenster | Inhalt | Überlauf |
|---|---|---|---|
| 100 % | 3840 px | 1800 px | 0 |
| 150 % | 2560 px | 1800 px | 0 |
| 200 % | 1920 px | **1800 px** | 0 |
| 300 % | 1280 px | 1224 px | 0 |

**Bei 200 % Zoom füllt der Inhalt den Schirm und ist doppelt so gross** — genau
der Sitzungsfall. Dass das trägt, ist kein Zufall: es ist dieselbe Arbeit wie die
Anpassung an schmale Fenster. Wer die App für ein Telefon robust macht, hat sie
für den Beamer gleich mitgemacht.

---

## 5 · Zwei Befunde, die keine waren

- **«Kontrollkästchen 16 × 16 px».** Es sitzt in einem `<label>` von 130 × 34 px;
  das Label ist die Trefferfläche. Meine Sonde mass das falsche Element.
- **«API-Link 16 × 24 px».** 16 px Lücke zu seinem Nachbarn, also greift die
  Abstandsausnahme von WCAG 2.5.8 — der 24-px-Kreis passt. Kein Verstoss.

Die Tab-Leiste meldete 17 px «Überlauf» auf dem iPhone. Das ist ihre Scrollweite,
kein Beschnitt: sie hat seit je `overflow-x: auto`, und der Kommentar daneben
nennt sogar den Grund («Below 411px the fourth tab was simply unreachable»).

---

## 6 · Warum die Zeitachse in Termine nicht immer schiebbar ist

Gemeldet als «Übersicht lässt sich mit der mittleren Maustaste schieben, Termine
nicht». Der Mechanismus ist in beiden Rastern **identisch**: ein Element mit
`overflow-x: auto` und `data-scroll`. Kein Handler fängt den Mittelklick ab;
`pointerdown` greift nur bei offenem Menü und unterdrückt nichts.

Die Ursache ist die Fensterbreite, nicht das Eingabegerät. Ab wann es überhaupt
etwas zu schieben gibt:

| Zeitskala | Übersicht | Termine |
|---|---|---|
| Jahr | nie | nie |
| Quartal | ab ≤ 1366 px | ab ≤ 900 px |
| Monat | ab ≤ 1600 px | ab ≤ 1100 px |

Der eingefrorene Block ist in der Übersicht 805 px breit (sechs Spalten), in
Termine 360 px (zwei). Mit 445 px mehr für die Balken passt Termine dort, wo die
Tabelle überläuft. **Auf einem 1280-px-Laptop bei Monatsansicht braucht die
Übersicht 1669 px und schiebt; Termine braucht 1224 px und passt** — mit jedem
Eingabegerät.

Bei 900 px schieben beide, und dort ist `.gantt__scroll` der nächstgelegene
Scrollbehälter unter dem Zeiger, genau wie `.pgrid` es in der Tabelle ist.

**Nicht geändert.** Was passt, lässt sich nicht schieben; Überlauf zu erzwingen,
nur damit eine Geste verfügbar ist, wäre künstlich. Wer in Termine mehr Spalten
zuschaltet, verschiebt die Schwelle nach oben — seit die Attribute dort wirken.

---

## 7 · Was ich bewusst nicht angefasst habe

- **Die Meldung «5 Spalten ausgeblendet» auf dem Telefon.** Bei 390 px ist das
  kein Ausnahmezustand, sondern der Normalfall, und die Aufzählung kostet zwei
  Zeilen. Sie ist trotzdem wahr — ob sie dort verschwinden soll, ist Ihre
  Entscheidung, keine technische.
- **Bearbeiten auf dem Telefon.** Der Schalter ist erreichbar, aber ein
  Portfolio mit 111 Projekten plant niemand am Telefon. Entfernen wäre ein
  Funktionsentscheid, kein Designentscheid.
- **iPad, zwei Toolbar-Reihen.** Bei 768 und 1024 px bricht sie in zwei Reihen
  (76 px). Die erste Datenzeile liegt bei 50 % (hoch) und 67 % (quer) — das ist
  benutzbar, und die scrollende Reihe unter 700 px ist für Daumen gedacht, nicht
  für einen 1024er Schirm.

---

## Bilanz

| | |
|---|---|
| Horizontaler Seitenüberlauf | 0 auf allen zehn Geräten |
| Menüs ausserhalb des Fensters | 3 → **0** (48 Öffnungen geprüft) |
| Telefon, erste Datenzeile | 799 px → **583 px** |
| 1920 px, ungenutzte Breite | 480 px → **120 px** |
| 1920 px, gekürzte Projektnamen | 29 von 111 → **0** |
| Eigene Fehler beim Umbau gefunden | 2 (Reihenfolge von `data-tab`, zwei dehnbare Gleise) |
