# Code-Review — Ressourcenplanung BBL

Reviewer: senior developer pass over the whole prototype
Datum: 25.08.2026 · Stand nach der Design-Review-Runde

Der Review betrachtet Korrektheit, Struktur, Duplikate, totes Material und
Robustheit. Jede Empfehlung ist umgesetzt; am Ende steht, was bewusst nicht
gemacht wurde.

---

## 1 · Ausgangslage

| | |
|---|---|
| JavaScript | 10 Module, 3 749 Zeilen |
| CSS | 2 Dateien, 1 991 Zeilen (1 639 + 352) |
| Daten | 11 JSON-Dateien |
| Build | keiner — ES-Module direkt im Browser |
| Tests | Playwright-Harness: 48 Interaktions-Checks, A11y-Audit, Responsive-Check |

Der Aufbau trägt: reine View-Funktionen, ein Store, Event-Delegation über
`data-act`, Zustand in der URL. Die Befunde unten sind keine Architekturfehler,
sondern Stellen, an denen die Umsetzung hinter der Absicht zurückblieb.

---

## 2 · Korrektheit

### 2.1 Jahresgrenzen waren auf Spaltenindizes festgenagelt — behoben

`views-overview.js` zog den Trennstrich zwischen zwei Jahren so:

```js
function qBorder(i) {
  return (i === 0 || i === 2 || i === 6) ? 'is-yearstart' : '';
}
```

Die Zahlen 0, 2 und 6 stimmen genau für ein Fenster: acht Quartale ab Q3/2026,
ungeblättert. Sobald der Massstab auf **Jahr** oder **Monat** wechselt oder das
Fenster über die Pfeile weitergeschoben wird, sitzen die Striche falsch.
Gemessen vor der Korrektur:

| Ansicht | Strich gesetzt bei | richtig wäre |
|---|---|---|
| Monat | Jul, Sep, Jan | Jan |
| Quartal, 3 Schritte weiter | Q2/27, Q4/27 | Q1/28 |
| Jahr | 2026, 2028 | jede Spalte |

Der Gantt in `views-schedule.js` rechnete es korrekt aus (`bandStart`), also
existierten zwei Implementierungen derselben Regel — eine richtige und eine
falsche.

**Umgesetzt:** Die Regel gehört zur Periode, nicht zur Spaltenposition.
`periods()` stempelt jetzt `year` und `yearStart` auf jedes Element:

```js
function markYears(cols) {
  let previous = null;
  return cols.map(col => {
    const year = data.quarters[col.quarters[0]].year;
    const yearStart = previous === null || year !== previous;
    previous = year;
    return { ...col, year, yearStart };
  });
}
```

Beide Ansichten lesen dieselbe Eigenschaft. `qBorder()` und `bandOf`/`bandStart`
sind entfallen.

### 2.2 `sortHead()` hatte fünf Stellungsparameter — behoben

```js
function sortHead(key, label, cls = '', style = '', title = '')
```

Zwei optionale Strings in der Mitte. Ein Aufruf mit vier Argumenten schob den
`style` in den `title` — genau dieser Fehler hat beim Einfrieren der
Stammdaten-Spalten dazu geführt, dass die Kopfzeile mitscrollte, während die
Datenzeilen stehen blieben. Der Fehler war stumm: kein Werfen, kein Log, nur
falsches Layout.

**Umgesetzt:** benannte Optionen.

```js
function sortHead(key, label, { cls = '', style = '', title = '' } = {})
```

Dazu ein Helfer, der Klasse und Versatz einer eingefrorenen Spalte zusammen
liefert, sodass beide nicht mehr getrennt durchgereicht werden:

```js
const pin = (s, k, extra = '') => ({ cls: pinCls(s, k, extra), style: pinLeft(s, k) });
```

### 2.3 Booleans in ARIA-Attributen — an der Wurzel behoben

`stringify()` bildet `false` auf `''` ab, damit das übliche
`${bedingung && html\`…\`}` nichts rendert. In einem ARIA-Slot ist das aber
falsch: `aria-expanded=""` heisst nicht «zugeklappt», es ist ungültig.

Die bisherige Antwort war ein Helfer, `aria(v)`, den man an rund zwanzig Stellen
nicht vergessen durfte. Vergessen war unsichtbar.

**Umgesetzt:** `html` erkennt den Slot und lässt einen Boolean dort ausschreiben.

```js
const ARIA_SLOT = /\saria-[a-z]+="$/;
// …
out += (typeof v === 'boolean' && ARIA_SLOT.test(strings[i]) ? String(v) : stringify(v))
```

`aria()` ist entfallen, alle Aufrufstellen übergeben den Boolean direkt. Der
Audit prüft weiterhin auf leere ARIA-Zustände — aktuell null.

---

## 3 · Duplikate

### 3.1 Zwei Bedienelemente für dieselbe Sache — bereinigt

«Meine Projekte» lag als Chip im Projektleitung-Menü; die neue Checkbox
«Mir zugewiesen» in der Toolbar tut dasselbe über dieselbe Aktion
(`my-projects`). Zwei Wege zum selben Zustand, einer davon zwei Klicks tief
versteckt. Der Chip und seine 14 CSS-Zeilen sind entfernt.

### 3.2 `periods()` wurde pro Zeile neu gebaut — behoben

Im Übersicht-Raster rief jede Projektzeile, jede Fusszeile und der Spaltenkopf
`periods()` selbst auf: rund zwanzig Aufbauten pro Render, jeder mit
Array-Allokation. Bei elf Zeilen unkritisch, aber es gab keine Garantie, dass
alle Zeilen dieselbe Zeitachse sehen — genau die Klasse Fehler aus 2.1.

**Umgesetzt:** `pensumGrid()` berechnet die Liste einmal und reicht sie durch,
wie `tpl` und `sticky` es schon wurden.

---

## 4 · Struktur

### 4.1 `views-overview.js` machte drei Dinge — aufgeteilt

854 Zeilen: Einstiegsseite, Pensum-Raster **und** vier Dialoge. Die Dialoge
teilen sich eine eigene Hülle (Scrim, `role="dialog"`, ein Schliessen-Knopf) und
haben mit dem Raster nichts zu tun — eine saubere Naht.

`js/views-modals.js` (258 Zeilen) enthält jetzt `renderModal`, `projectModal`,
`assignModal`, `rebookModal` und `shareModal`. `views-overview.js` steht bei
596 Zeilen. Damit sind es zehn JS-Dateien statt neun; die Vorgabe «wenige
Module» ist gewahrt, und beide Dateien haben wieder je einen Zweck.

### 4.2 `data/api.json` war zu 90 % überholt — ersetzt

Seit die API-Dokumentation echtes Swagger UI über `data/openapi.json` ist, waren
`version`, `spec`, `groups` und `panels` aus `api.json` tot. Genutzt wurde nur
noch `print` — die Konfiguration des Drucklayouts, unter dem falschen Namen.

Die Datei heisst jetzt `data/print.json` und enthält nur noch das, was gilt.
5 707 → 1 350 Bytes.

---

## 5 · Totes Material

Statisch geprüft gegen JS, CSS und `index.html`, mit Rücksicht auf dynamisch
gebaute Klassen (`heat-${n}`, `is-${key}`, `xsearch--${variant}`).

| | vorher | entfernt | nachher |
|---|---|---|---|
| Design-Tokens | 270 | 39 | 231 |
| CSS-Regeln | — | 10 | — |
| `css/tokens.css` | 400 Zeilen | | 352 |

Die grösste Einzelposition ist die **SIA-Phasen-Farbfamilie** (`--phase-1-bg`
… `--phase-6-dot` samt Violett- und Cyan-Primitiven). Sie verlor ihre letzte
Verwendung, als der farbige Punkt aus der Phasenspalte flog und der Gantt auf
einen neutralen Balken zurückging. Eine Palette stehen zu lassen, die eine
bewusst getroffene Entscheidung rückgängig zu machen einlädt, ist schlechter
als sie zu löschen — sie ist weg.

Nicht gelöscht: sechs ungenutzte Stufen in ansonsten benutzten Farbrampen
(`--grey-500`, `--steel-250`, …). Eine Rampe ist eine Palette; eine Lücke darin
verwirrt mehr als der ungenutzte Eintrag.

Ebenfalls stehen geblieben sind die Swagger-Überschreibungen in `main.css`.
Sie sehen wie überflüssiges Styling aus, sind aber Kontrastkorrekturen: das
PATCH-Badge von Swagger UI liegt im Original bei 1,6 : 1. Ein Kommentar sagt
das jetzt an Ort und Stelle.

---

## 6 · Robustheit — geprüft, in Ordnung

* **Bootstrap.** `load()` und `loadIcons()` laufen unter `try`; schlägt etwas
  fehl, ersetzt eine lesbare Fehlerseite den Spinner und nennt den häufigsten
  Grund (`file://` statt Webserver). Kein hängender Ladezustand.
* **Fehlendes Icon.** `loadIcons()` fängt pro Datei; `icon()` gibt `''` zurück,
  wenn ein Symbol fehlt. Ein fehlendes SVG nimmt die App nicht mit.
* **Escaping.** Alles läuft durch `html`; `raw()` wird nur für Icon-Markup,
  selbst gebaute Attributfragmente und aus Zahlen gebaute Grid-Templates
  benutzt. Keine Interpolation von Fremddaten an `raw()`.
* **Fokus über Neuaufbau.** `captureFocus`/`restoreFocus` arbeiten über
  `data-fk` und `CSS.escape`, inklusive Cursorposition.
* **Render-Kosten.** 50 Neuaufbauten in 373 ms, also ~7,5 ms — bei vollem
  `innerHTML`-Austausch und 11 Zeilen deutlich unter einem Frame.

---

## 7 · Neu: CSV- und Excel-Export

Vorher meldeten beide Menüpunkte «im Prototyp nicht hinterlegt». Jetzt schreibt
`js/export.js` beides aus derselben Tabelle, die genau der Bildschirmansicht
folgt: gleiche Spalten, Filter, Gruppierung, Sortierung und Zeitachse.

* **CSV** — Semikolon, Komma als Dezimalzeichen, UTF-8-BOM. So öffnet Excel in
  einer de-CH-Umgebung die Datei ohne Import-Dialog und ohne Mojibake.
* **XLSX** — eine echte Arbeitsmappe, kein HTML mit `.xls`-Endung. Ein `.xlsx`
  ist ein ZIP aus XML-Teilen; die Einträge werden **stored** abgelegt, was ein
  gültiges ZIP ergibt und eine Deflate-Bibliothek erspart. Enthalten sind
  Zahlenformate (Mio. CHF, %), fette Kopfzeile, Spaltenbreiten und ein
  eingefrorener Bereich, der dieselben Spalten hält wie der Bildschirm.

Geprüft: `zipfile.testzip()` ohne Befund, alle XML-Teile parsen, `openpyxl`
öffnet die Mappe, Fixierung landet auf `G5`, und die Werte stimmen mit der
Ansicht überein (Auslastung 112 / 110 / 105 / 97 / 90 / 69 / 45 / 31).

---

## 8 · Prüfstand nach allen Änderungen

```
flow.js    48 Checks              failures: 0     Konsole sauber
audit.js   Kontrast unter AA      0
           ohne zugänglichen Namen 0
           Ziel unter 24 px        0
resp.js    1440 / 1280 / 1024 / 768 px   horizontaler Überlauf: 0 px
```

Die 19 Treffer unter «Text unter 11 px» stammen ausschliesslich aus dem
Drucklayout, wo 10 pt auf A4 beabsichtigt sind.

Am Harness selbst wurde eine Schwäche behoben: die Namensberechnung kannte nur
`aria-label`, Textinhalt und `title` und übersah damit ein umschliessendes
`<label>` — die neue Checkbox galt fälschlich als unbenannt, obwohl der
Accessibility-Baum des Browsers sie korrekt als «Mir zugewiesen» führt.

---

## 9 · Bewusst nicht gemacht

* **Kein Framework, kein Build.** Die Vorgabe ist Vanilla ohne Bundler, und der
  Umfang trägt sie problemlos.
* **Kein virtuelles DOM, kein Diffing.** Bei 7,5 ms pro Render wäre das
  Komplexität ohne Gegenwert.
* **Keine weiteren Dateiteilungen.** `store.js` (614 Zeilen) ist lang, aber es
  ist eine Kette abgeleiteter Grössen — auseinandergezogen wäre sie schwerer
  zu lesen, nicht leichter.
* **`state.search` schreibt weiterhin direkt.** Der Umweg über `setState` pro
  Tastendruck würde bei jedem Zeichen neu rendern; die URL zieht 180 ms später
  nach. Der Kommentar an der Stelle sagt es.
