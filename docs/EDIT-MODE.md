# Editiermodus — was änderbar ist, und woran man es sieht

**Datum:** 26.08.2026 · **Umfang:** `css/main.css`, `js/ui.js`, `css/tokens.css`

---

## Der Befund

Im Editiermodus werden **777 von 888** Pensumzellen anklickbar und **111** bleiben
gesperrt — das laufende Quartal, eine ganze Spalte. Dazu werden **111** Namen in
der Leitungsspalte zu Knöpfen.

Angezeigt wurde davon im Ruhezustand: nichts. Eine bearbeitbare und eine gesperrte
Zelle waren **pixelgleich** — beide `background: rgb(255,255,255)`, `border: 0px`,
`box-shadow: none`. Der ganze Unterschied bestand aus `cursor: pointer` und einem
Hover mit `filter: brightness(.93)`.

Drei Lücken folgten daraus:

1. **Der Zeiger ist erst da, wenn man schon drauf ist.** Er beantwortet «kann ich
   diese Zelle?», nie «was kann ich überhaupt?» — und auf einem Tablet gibt es
   ihn nicht.
2. **7 % Aufhellung ist schwächer als der Abstand zweier Blaustufen.** Das Signal
   ging in der Heat-Fläche unter.
3. **Der Banner nannte den Modus, nicht den Umfang.** Die gesperrte Spalte trug
   zwar eine Kopfmarkierung, aber die bedeutet «heute», nicht «gesperrt».

Klickte man doch, kam eine Meldung: «Das laufende Quartal ist für Änderungen
gesperrt.» Eine Bergung nach dem Fehler, keine Ankündigung davor.

---

## Warum kein Grau, und warum keine Entsättigung

Der naheliegende Griff — die bearbeitbaren Zellen grau hinterlegen — scheitert an
zwei Messungen:

- **72 % von ihnen sind schon blau.** 556 der 777 tragen eine Blaustufe; ein
  grauer Grund liegt darunter und wird nie sichtbar. Er erschiene nur auf den
  221 Nullzellen — «grau» hiesse also «hier ist kein Bedarf».
- **Jedes Grau der Palette kollidiert mit `--heat-1-bg` (`#f4f7fc`).** Kanalabstand:
  `--color-surface-frame` 1/0/1, `--color-surface-sunken` 1/3/6,
  `--color-surface-alt` 5/3/1. Alle drei liegen innerhalb einer Blaustufe — die
  Skala bekäme eine Phantomstufe.

Die Umkehrung — nur die **gesperrte** Spalte markieren — ist richtig (Grau heisst
in Verwaltungssoftware seit je «schreibgeschützt»), aber `filter: grayscale(1)`
scheitert an zwei weiteren Messungen:

- **50 der 111 gesperrten Zellen tragen die Überlast-Warnung in Rot.** Ein Filter
  auf der Zelle entsättigt die Schrift mit und nähme 45 % der Spalte ein echtes
  Signal.
- **67 der 111 sind `heat-0` oder `heat-1`** — dort ist das Blau schon fast
  neutral, die Entsättigung also fast unsichtbar. Genau wo sie am meisten
  gebraucht würde, wirkt sie am wenigsten.

---

## Die Lösung

**Eine Schraffur.** Sie legt sich über `background-color` und unter die Schrift,
wirkt daher über jeder Blaustufe gleich und lässt die roten Warnungen unberührt.

```css
--hatch-locked: repeating-linear-gradient(45deg,
  transparent 0 4px, rgba(17, 24, 39, .055) 4px 8px);

.pgrid--edit .pcell--val[data-locked] { background-image: var(--hatch-locked); }
```

Markiert wird die **Ausnahme**, nicht die Regel: 111 Zellen statt 777, in einer
zusammenhängenden Spalte, die sich als Band liest. Der Rest der Tabelle ist per
Ausschluss der Umfang — deshalb braucht es kein Schloss und keinen Stift im
Spaltenkopf.

**Eine gepunktete Linie im Ruhezustand** trägt dieselbe Aussage für alles, was
sich ändern lässt — die 777 offenen Werte und die 111 Namen der Leitungsspalte:

```css
.pgrid--edit .pcell--val:not([data-locked]),
.leadbtn { text-decoration: underline dotted var(--color-border-strong); }
```

Der frühere Einwand gegen «777 Marken» zielte auf Flächen. Eine Textlinie liegt
auf den Ziffern, nicht auf dem Grund — sie berührt die Blaustufen überhaupt nicht
und fällt damit als Einwand weg.

Die gesperrte Spalte ist damit **doppelt kodiert**: sie trägt die Schraffur und
sie trägt als Einzige keinen Unterstrich. Und die Marke für eine geänderte Zelle
(`box-shadow: inset 0 -3px 0`) sitzt an der Zellenkante, der Unterstrich an den
Ziffern — nachgesehen, sie lesen sich als zwei verschiedene Dinge.

**Der Banner nennt den Umfang:**

> ✎ Pensum und Projektleitung änderbar · laufendes Quartal gesperrt ·
> Änderungen werden protokolliert

Das Wort «Bearbeitungsmodus» ist entfallen — die warme Pille und der Stift sagen
das bereits.

Er steht **exakt mittig**, und zwar über drei Plätze statt über absolute
Positionierung:

```html
<nav class="crumbs">
  <span class="crumbs__trail">…Pfad…</span>
  <span class="editbanner">…</span>
  <span class="crumbs__balance"></span>
</nav>
```

Zwei gleich flexible Seiten halten die Mitte, egal was der Pfad sagt. Absolute
Zentrierung konnte das nicht: sie weicht nichts aus, und bei 1024 px lief die
französische Fassung 40 px in die Brotkrume, die italienische verfehlte sie um
4 px. Jetzt kürzt die Brotkrume und hält 8 px Abstand.

Nachgemessen, Versatz zur Mitte in Pixeln:

| | 1600 | 1280 | 1024 | 1024 fr | 1024 it | 880 fr |
|---|---|---|---|---|---|---|
| Versatz | 0 | 0 | 0 | 0 | 0 | 0 |

---

## Animation: warum sie hier nicht trägt

Vier Messungen, alle im Browser:

| Frage | Ergebnis |
|---|---|
| Überlebt eine Zelle einen Re-Render? | **Nein**, sie wird neu erzeugt |
| Läuft eine `animation` über den Render hinweg? | **Nein** — springt von 700 ms auf 0, auf 777 Zellen gleichzeitig |
| Feuert ein `transition` beim Moduswechsel? | **Nein** — 0 laufende Übergänge, der Zielwert steht sofort |
| Feuert ein `transition` beim Hover? | **Ja** — 1 laufender Übergang |

Die App baut `#app` bei jeder Zustandsänderung neu auf. Eine Animation auf den
Zellen liefe damit bei **jedem Tastendruck im Suchfeld** neu an — 777 Zellen im
Gleichtakt. Das ist kein hypothetisches Risiko: dasselbe Verhalten liess früher
das Suchfeld zwischen 134 und 250 px pumpen, weshalb `xsearch-open` und
`toast-in` entfernt wurden.

Ein Übergang beim Einschalten des Modus — die eleganteste Idee — feuert gar
nicht, weil das Element neu ist und CSS auf der ersten Stilauflösung nicht
übergeht.

**In dieser Architektur kann Bewegung nur auf `:hover` und `:focus` leben.**

Unabhängig davon spricht ein Grundsatz dagegen: ein Hinweis auf Änderbarkeit muss
**gleichzeitig und dauerhaft** sichtbar sein — man will das ganze Feld auf einen
Blick sehen. Animation ist zeitlich: sie sagt etwas in einem Moment und hört auf.
Läuft sie in Schleife, ist sie Lärm; läuft sie einmal, ist sie vorbei, bevor man
hinsieht. Deshalb wird sie in echten Produkten für diese Aufgabe praktisch nie
eingesetzt — wohl aber für Übergänge beim Fokussieren und für Fehlerrückmeldung.

---

## Abgesichert

`flow.js` prüft: ausserhalb des Editiermodus ist keine Zelle schraffiert; im
Modus sind es genau so viele wie gesperrte; die Warnfarbe in der gesperrten
Spalte bleibt erhalten; die Leitungsspalte trägt ihre Ruhemarke; der Banner ist da.

Ebenso: jede offene Zelle trägt den Unterstrich, keine gesperrte tut es, und der
Banner steht höchstens 1 px neben der Mitte.

Nachgemessen ausserdem: kein Seitenüberlauf bei 1600 / 1280 / 1024 / 880 / 768 px
in allen vier Sprachen. Keine Schraffur im Personenraster des Dashboards.
