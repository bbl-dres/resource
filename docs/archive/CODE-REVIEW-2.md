> **Superseded — kept for the record.**
> Written against an eight-quarter data set and a layout that no longer
> exists. Standing rules from this document were harvested into
> [`DECISIONS.md`](../DECISIONS.md); the mechanism it describes, where still
> true, is in [`ARCHITECTURE.md`](../ARCHITECTURE.md). Do not cite this file
> as current.

# Code-Review — Wartbarkeit, Robustheit, Leistung, Sicherheit

**Rolle:** Senior Developer · **Datum:** 26.08.2026
**Umfang:** 4 606 Zeilen JavaScript in 10 Modulen, plus `data/`, gemessen im Browser

Die Vorgabe war klar: Bezeichner und Kommentare nur auf Englisch, Komplexität
durch wiederverwendbare Module senken, robuster werden, Leistung und Sicherheit
prüfen. Was folgt, ist nach Belegen sortiert — jeder Befund ist gemessen, nicht
vermutet.

Vorweg das Ergebnis in einer Zeile: **die Codebasis war gesund.** Es gab genau
einen Absturz, genau einen stillen Renderfehler und keine Sicherheitslücke. Der
grösste Fund war struktureller Art — eine Liste, die sechsmal dastand.

---

## Der Hauptfund: eine Spaltenliste, sechsmal geschrieben

Dieselben zehn Projektspalten, in derselben Reihenfolge, standen an sechs
Stellen:

| Ort | Was dort dupliziert war |
|---|---|
| `ui.js` → `COLUMNS` | Beschriftung und Schalter für das Attribute-Menü |
| `views-overview.js` → `gridLayout()` | Breite und Einfrier-Reihenfolge |
| `views-overview.js` → `columnHeader()` | Kopfzelle je Spalte |
| `views-overview.js` → `projectRow()` | Datenzelle je Spalte |
| `views-docs.js` → `sheetColumns()` / `sheetCell()` | Papierbreite, Klasse, Wert |
| `export.js` → `columns()` / `projectCells()` | Spaltentyp, Breite, Wert |

**Eine Spalte hinzuzufügen hiess: sechs Dateien anfassen und ihre Reihenfolge
von Hand synchron halten.** Vergisst man eine, verschiebt sich die Tabelle gegen
ihren eigenen Kopf oder der Export fehlt eine Spalte — beides ohne Fehlermeldung.

Neu ist [`js/columns.js`](../../js/columns.js): jede Spalte einmal, mit allem, was
die sechs Verbraucher brauchen.

```js
{
  key: 'credit', label: 'Kredit CHF', flag: ['cols', 'credit'], sort: 'credit',
  width: '--grid-col-credit', cls: 'pcell--credit', numeric: true,
  sheet: { w: [62, 76], cls: 'sheet__num sheet__muted' }, xls: { type: 'num', width: 14 },
  text: p => t(p.creditLabel)
}
```

`gridLayout()` ist von 40 auf 26 Zeilen geschrumpft und liest jetzt die Breite
aus dem Token, das die Spalte benennt. `projectRow()` ist von neun fast
identischen `<span>`-Blöcken auf eine Schleife zusammengefallen; die vier
Zellen, die etwas *zeichnen* statt zu drucken, stehen benannt in `CELL_BODY`.
Der Druckbogen und der Export leiten ihre Listen ab.

---

## Doppelte Helfer mit auseinanderlaufender Bedeutung

`pinCls` war zweimal definiert — und die beiden Fassungen taten **nicht
dasselbe**:

```js
// views-overview.js — nur eingefrorene Spalten bekommen die Klasse
`${extra} ${s[k] === undefined ? '' : `is-frozen ${k === s.last ? 'is-frozen-last' : ''}`}`

// views-analysis.js — jede Spalte bekommt sie
`${extra} is-frozen ${k === s.last ? 'is-frozen-last' : ''}`
```

Zwei Namen, ein Begriff, unterschiedliches Verhalten: die Art Falle, in die man
beim nächsten Umbau tritt. Ebenso doppelt: `tone()` / `toneFor()` (Wort für Wort
identisch) und `yearRule`, das in einer Datei stand und in zwei anderen sechsmal
ausgeschrieben war.

Sie leben jetzt einmal in `ui.js`: `tokenPx`, `tone`, `yearRule`, `pinCls`,
`pinLeft`, `sortableHead`, `safeHref`.

Dabei fiel auch `personLayout()` — dieselbe Sticky-Spalten-Arithmetik wie
`gridLayout()`, mit **Breiten als JS-Literale** statt als Tokens. Die fünf
Breiten sind jetzt `--person-col-*` und werden über `tokenPx` gelesen, wie im
Projektraster.

Und ein Konstrukt, das kein Review überleben sollte:

```js
const pin = key => raw(`${pinCls(sticky, key)}" style="left:${sticky[key]}px`);
```

Das bricht mitten im `class`-Attribut aus, um ein zweites zu öffnen. Es
funktionierte, war aber ein Zeichenketten-Trick durch die einzige Stelle, an der
die Escaping-Schicht bewusst abgeschaltet wird. Ersetzt durch eine Zelle mit
zwei ordentlichen Attributen.

---

## Vokabular: Deutsch und Englisch standen nebeneinander

Kein Bezeichner war deutsch, aber die **Zustandswerte** waren gemischt — und
zwar innerhalb derselben URL:

```
#?tab=dashboard&bi=allgemein&scale=quartal&sort=credit&group=lead&teilportfolio=zoll
      englisch      deutsch      deutsch    englisch  englisch   deutsch
```

`sort=projekt` stand neben `sort=credit`, `group=lead` neben `scale=quartal`.
Das ist keine Sprachwahl, das ist eine fehlende Entscheidung.

Alle Zustandswerte und URL-Parameter sind jetzt englisch — die deutschen
Beschriftungen kommen ohnehin aus `t()`, nicht aus dem Schlüssel:

| vorher | nachher |
|---|---|
| `tab=uebersicht / termine / verlauf` | `overview / schedule / history` |
| `scale=jahr / quartal / monat` | `year / quarter / month` |
| `sheet=hoch / quer` | `portrait / landscape` |
| `bi=allgemein / personen` | `general / people` |
| `sort=projekt` | `sort=project` |
| `von=`, `teilportfolio=`, `ueberlast=` | `from=`, `portfolio=`, `overload=` |

Dazu die CSS-Zustandsklassen, die dieselben Wörter tragen: `.is-ueberlast` →
`.is-overload`, `.is-knapp` → `.is-tight`, `.is-frei` → `.is-free`,
`.is-defizit` → `.is-deficit`.

**In Kommentaren steht kein deutscher Satz mehr** (geprüft: 0 Zeilen mit zwei
oder mehr deutschen Funktionswörtern). Was bleibt, sind in Guillemets gesetzte
Bildschirmnamen — «Übersicht», «Personen» — und die Fachbegriffe *Pensum*,
*Teilportfolio*, *Ampel*. Die bleiben bewusst: ein Entwickler, der die Stelle
zum Label sucht, greppt nach dem Wort, das auf dem Schirm steht.

---

## Robustheit: die URL war die einzige ungeprüfte Eingabe

17 von Hand veränderte Hashes durch die App geschickt, jeweils in einem frischen
Tab (der erste Anlauf hatte einen Zustandsübertrag und log deshalb falsch):

| Fall | vorher | nachher |
|---|---|---|
| `group=colour` | **Absturz** — `Cannot read properties of undefined (reading 'label')` | ok |
| `scale=weekly` | stiller Rückfall, URL log weiter | verworfen |
| `lang=xx`, `sort=bogus`, `sheet=a3`, `bi=nothing` | stiller Rückfall | verworfen |
| `von=-50`, `von=abc`, `von=999` | ok | ok |
| `q=<img src=x onerror=alert(1)>` | ok — escaped | ok |

Der Absturz lag in `ui.js`: `GROUPS.find(g => g.id === state.group).label` ohne
Absicherung. Ein `?.` hätte diese eine Zeile geheilt; der Fehler war aber nicht
die fehlende Prüfung, sondern dass ein unbekannter Wert überhaupt so weit kam.

Die Reparatur sitzt deshalb an der Grenze. `store.js` erklärt jetzt das
zulässige Vokabular, und `readUrl()` lässt nichts anderes durch:

```js
export const VOCAB = {
  tab:     ['start', 'overview', 'schedule', 'dashboard', 'history', 'api', 'export'],
  sheet:   ['portrait', 'landscape'],
  lang:    ['de', 'en', 'fr', 'it'],
  scale:   ['year', 'quarter', 'month'],
  …
};
```

Ein unbekannter Wert wird verworfen, nicht weitergereicht — der Vorgabewert, auf
den zurückgefallen wird, ist immer zeichenbar. **17 von 17 Fällen sauber.**

Dazu drei kleinere Absicherungen, alle an Stellen, wo ein Datenfehler eine ganze
Ansicht mitgenommen hätte: `phaseOf()` gibt für einen unbekannten SIA-Code einen
Platzhalter statt `undefined` zurück (fünf Aufrufstellen lasen direkt `.label`),
`ampel()` prüft die Person statt nur die ID, und die Gruppenbeschriftung
verträgt eine Personen-ID, die es nicht gibt.

---

## Ein stiller Renderfehler

```html
<span class="spark" style="height:…%" class="${v ? '' : 'is-empty'}"></span>
```

Zwei `class`-Attribute am selben Element: der Parser behält das erste und
verwirft das zweite. Nachgemessen: **888 Sparklines, davon 0 mit `is-empty`** —
obwohl viele auf `height:0%` stehen. Sichtbar war nichts, weil das Stylesheet
zufällig einen zweiten Weg dorthin hat (`.spark[style*="height:0%"]`). Der Code
sagte trotzdem etwas anderes als er tat.

---

## Leistung: gemessen, nicht vermutet

Der Verdacht war, dass `loadDelta()` — ein Scan über alle 111 Projekte, aufgerufen
pro Zelle — der Engpass ist. **Er war es nicht:**

| Messung | Wert |
|---|---|
| `personUtilisation` × 888 | 0,4 ms |
| Markup bauen | 5,6 ms |
| `innerHTML` parsen | 5,7 ms |
| abgeleitete Zahlen (`groupProjects` + `totals` + `periods`) | 0,2 ms |
| **voller Re-Render, Übersicht** | **46 ms** |

Von 46 ms sind rund 11 ms unser Code; der Rest ist der Browser, der 5 429 Knoten
neu aufbaut. Das ist die Architektur, nicht ein Fehler darin — und der Grund,
warum die Suche entprellt statt pro Tastendruck gerendert wird. Der
Dateikopf von `app.js` behauptete noch «with eleven rows that is well under a
frame»; er nennt jetzt die gemessenen Zahlen.

Trotzdem umgestellt, weil es sowohl schneller als auch lesbarer ist — ein Index
liest sich besser als ein Scan:

- `data.milestonesByProject`, `data.projectsByLead`, `data.milestoneCatalog`
  werden in `load()` einmal gebaut. Sie ersetzen **sieben** lineare Suchen, die
  in Zeilenschleifen sassen (bis zu 111 × 189 Durchläufe je Render).
- `loadDelta()` geht nur noch über die Projekte *dieser* Person.
- Ein `Intl.Collator` statt `localeCompare` pro Vergleich — das baute bei jedem
  der ~700 Vergleiche einen neuen Kollator.

Nachher: 41 ms Median (vorher 46 ms). Der Unterschied liegt im Rauschen, was
die Messung oben bestätigt — der Aufwand liegt nicht dort.

---

## Sicherheit

Geprüft und **sauber**:

- **Escaping.** `esc()` deckt `& < > " '` ab. Jede Interpolation in `html\`\``
  läuft hindurch, ausser sie ist bereits `Html`. Der XSS-Versuch über die
  Suchfeld-URL kommt als Text an.
- **Alle 16 `raw()`-Aufrufe** — die einzige Umgehung — nehmen intern gerechnete
  Werte: Rastervorlagen, Sticky-Offsets, Icon-SVG, eine Prozentangabe. Kein
  einziger reicht Eingaben durch. (Der eine, der es *fast* tat, ist oben unter
  «doppelte Helfer» beschrieben und ist weg.)
- **Swagger UI ist lokal eingebunden**, nicht von einem CDN. Kein externer Code.
- `target="_blank"` trägt `rel="noopener noreferrer"`.
- `CSS.escape` an den Stellen, wo ein Wert in einen Selektor geht.

Zwei Härtungen ergänzt:

1. **`safeHref()`.** Die Fusszeilen-Links kommen aus `data/meta.json`. Escaping
   hält Markup aus einem `href` heraus, sagt aber nichts über das Schema — ein
   `javascript:` in einer Datendatei würde laufen. Jetzt passieren nur `http(s):`
   und `mailto:`. Das ist die einzige Stelle, an der ein JSON-Wert zu einer
   Navigation wird.
2. `actions['scroll-to']` baute einen Selektor aus `data-val` ohne `CSS.escape`.
   Der Wert stammt aus eigenem Markup, aber die Ausnahme hatte keinen Grund.

---

## Kleinere Vereinfachungen

- **Der `input`-Handler** in `app.js` war eine Kette aus neun `else if`. Fünf
  davon schrieben nur ein Feld des offenen Dialogs. Sie sind jetzt eine Tabelle
  aus Feldname und Umwandlung; vier echte Sonderfälle bleiben ausgeschrieben.
- **`moveOption` und `moveMenuFocus`** waren derselbe Algorithmus (Index finden,
  schrittweise umlaufen, fokussieren). Jetzt einer, `roam()`.
- **Die Modal-Weiche** war eine sechsfach verschachtelte Ternäre mit
  uneinheitlicher Einrückung. Jetzt eine Tabelle `MODALS`.
- **`phaseOf()`** stand in `ui.js`, ist aber ein reiner Datenzugriff
  (`data.phases.sub[code]`) und gehört in `store.js`. Verschoben; nebenbei
  löste das den Zirkelimport, den `columns.js` sonst gebraucht hätte.
- **Zwei veraltete Kommentare** korrigiert: der Blattkapazitäts-Block in
  `views-docs.js` nannte noch 31/19 Zeilen und «1.6 rows» je Gruppenkopf
  (aktuell 34/21 und 2.9), der Kopf von `app.js` sprach von elf Zeilen.

---

## Was ich bewusst gelassen habe

- **Die Vollneurendering-Architektur.** 46 ms sind über dem Bildwiederholtakt,
  aber die Views bleiben dadurch reine Funktionen des Zustands, und genau das
  hat diesen Umbau überhaupt erst gefahrlos gemacht. Ein differenzieller
  Renderer wäre ein anderes Projekt.
- **Zwei Statusskalen.** `loadStatus()` liefert `danger|warn|ok|neutral`,
  `tone()` liefert `overload|tight|ok|free`. Beide beschreiben Auslastung, aber
  sie speisen verschiedene CSS-Familien. Zusammenzuführen hiesse, die Tokens
  anzufassen — ein eigener Schritt, kein Nebenprodukt dieses Reviews.
- **Kommentardichte.** Automatisch geprüft, ob Kommentare nur die Zeile darunter
  wiederholen: **ein** Kandidat in 4 600 Zeilen, und der sagt mehr als die
  Signatur. Hier war nichts aufzuräumen.
- **Deutsche Fachbegriffe und Bildschirmnamen** in Kommentaren — siehe oben.

---

## Umfang und Prüfung

| | vorher | nachher |
|---|---|---|
| JS-Zeilen | 4 606 | 4 765 |
| Module | 10 | 11 (`columns.js`) |
| Spaltenlisten | 6 | **1** |
| doppelte Helfer (`pinCls`, `tone`, `yearRule`) | 3× doppelt | **0** |
| Abstürze bei manipulierter URL | 1 von 17 | **0 von 17** |
| rohe Werte statt Tokens (Personenspalten) | 6 | **0** |

Die 159 Zeilen mehr sind fast vollständig `columns.js` — überwiegend
Deklaration und ein Kopfkommentar, der erklärt, warum es die Datei gibt. Die
fünf Verbraucher sind alle kleiner geworden: `views-overview.js` −32,
`views-docs.js` −14, `export.js` −10, `views-analysis.js` −10.

Alle Prüfläufe grün:

```
flow.js    48 Prüfungen, 0 Fehler, Konsole sauber
audit.js   0 Kontrastverletzungen · 0 fehlende Namen · 0 zu kleine Ziele
resp.js    0 px horizontaler Überlauf auf allen Breiten
robust.js  17 von 17 URL-Fällen sauber
```

Zwei Prüfungen im Testgerüst waren auf das alte Vokabular verdrahtet und wurden
mitgezogen; eine dritte prüfte eine feste Operationszahl und prüft jetzt auf das
Vorhandensein der CRUD-Verben.
