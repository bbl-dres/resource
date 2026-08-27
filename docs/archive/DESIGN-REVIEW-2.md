> **Superseded — kept for the record.**
> Written against an eight-quarter data set and a layout that no longer
> exists. Standing rules from this document were harvested into
> [`DECISIONS.md`](../DECISIONS.md); the mechanism it describes, where still
> true, is in [`ARCHITECTURE.md`](../ARCHITECTURE.md). Do not cite this file
> as current.

# Design-Review 2 — Politur und Verfeinerung

Fünf Fachprüfungen, parallel und unabhängig, jede messend statt schätzend:
Abstände/Dichte, Typografie, Farbe, Interaktion/Zustände, Responsive/Mobile.
Dazu eine eigene Prüfung von CSS-Struktur, Beschriftungen und Leerzuständen.

Stand: 111 Projekte, 46 Personen, 86 Gates · gemessen bei 1280×800 und 1440×900
Methode: Playwright gegen die laufende Anwendung, `getBoundingClientRect()`,
`getComputedStyle()`, erzwungene Pseudo-Zustände über CDP, WCAG- und
Rec.709-Luminanz selbst gerechnet, Druckverhalten über zwei echte PDF-Renderings.

---

## 0 · Gesamturteil

Die Grundlagen tragen. Das Token-System ist real: **7 Primitive** in 1742 Zeilen
`main.css`, **null Farbliterale** in `js/`. Kontrast erfüllt AA in jedem
erzwungenen Zustand. Die Heat-Rampe ist luminanzgetunt (255 → 247 → 237 → 225 →
211) und übersteht Graustufen. Redundante Kodierung wurde bewusst gebaut. Der
1280-px-Fall — die Hauptzielgrösse — ist sauber.

Die Befunde sind deshalb **lokal, nicht systemisch**. Sie fallen in vier Gruppen,
und die erste ist die einzige, die wirklich weh tut.

| Gruppe | Befunde | Kern |
|---|---|---|
| **A · Falsche Auskunft** | 9 | Zahlen, die stimmen müssten, stimmen nicht |
| **B · Tastatur und Fokus** | 10 | Eine Ursache, sechs Ausfälle |
| **C · Farbe verdienen** | 12 | Rot bedeutet vier Dinge, die Ampel scheitert in Schwarzweiss |
| **D · System-Kohärenz** | 30+ | Ein Gewicht das keins ist, doppelt eingefügtes CSS, Rhythmus |

---

# A · Falsche Auskunft

Ein Entscheidungswerkzeug darf keine falsche Zahl zeigen. Das hier ist die
wichtigste Gruppe des ganzen Reviews.

## A1 · Auslastung ist unter jedem Filter falsch ★★★

Der Zähler folgt der Auswahl, der Nenner nicht. Gemessen:

| Filter | Projekte | Bedarf | Kapazität netto | Auslastung |
|---|---|---|---|---|
| keine | 111 | 4122 % | 3670 % | 106 % |
| Phase 5 | 39 | 1665 % | 3670 % | **39 %** |
| Teilportfolio = Sport | 5 | 170 % | 3670 % | **−2 %** |
| Suche ohne Treffer | 0 | 0 % | 3670 % | **−7 %** |

Drei Klicks von der Einstiegsseite zeigt der KPI-Streifen *Auslastung 8 %* und
die Dashboard-Kurve fällt auf 8/7/6/6/4/2/2/1 %. Eine Bereichsleitung liest das
als freie Kapazität.

`demand` ist eine Eigenschaft der **Auswahl**. `net` und `external` sind
Eigenschaften der **Abteilung**. Ihr Verhältnis ist nur definiert, wenn beide
dieselbe Grundgesamtheit beschreiben.

**Umsetzung:** Auslastung und Kapazität immer über das Gesamtportfolio rechnen;
`Bedarf total` folgt weiter dem Filter und wird als Auswahl gekennzeichnet.
`store.js:totals()`

## A2 · Kein Leerzustand ★★★

Null Treffer hinterlassen ein Raster ohne Spaltenkopf, eine Legende für nicht
vorhandene Daten und die negativen Prozente aus A1. Kein Hinweis in Übersicht,
Termine oder Export. `views-overview.js`, `views-schedule.js`, `views-docs.js`

## A3 · Die Pensum-Kodierung verschwindet auf Papier ★★★

Kein `print-color-adjust`; die Heat-Rampe ist reine Hintergrundfüllung. Zwei
echte Chromium-PDF-Renderings, Inhaltsströme dekomprimiert und verglichen:

| Füllung | Standarddruck | mit Hintergründen |
|---|---|---|
| heat-1 `#f4f7fc` | **0** | 293 |
| heat-2 `#e7eef8` | **0** | 270 |
| heat-3 `#d6e3f3` | **0** | 99 |
| heat-4 `#c2d5ec` | **0** | 25 |

**687 Heat-Rechtecke werden weiss.** Die 40 Legenden-Kacheln werden identische
weisse Kästchen, weiter beschriftet mit «bis 39 %», «40 – 79 %», «80 – 119 %»,
«ab 120 %» — die Legende wird aktiv irreführend. `main.css:1719-1740`

## A4 · Auf Papier ist die Status-Rampe umgekehrt ★★

Es gibt keine Regel `.sheet__row--load .is-neutral`, also erbt «frei»
`--color-text-strong`. Rec.709-Luma: **frei 24**, Überlast 54, knapp 65, ok 81.
Wer eine Fotokopie nach der dunkelsten Zahl absucht, landet beim ruhigsten
Quartal. `main.css:1608-1610`

## A5 · Der Druckbogen schneidet Projekttitel ohne Rückfallebene ab ★★

**162 von 222 Zeilen** abgeschnitten, schlimmster Fall 18 von 57 Zeichen, kein
`title`-Attribut — und `@media print` ändert keine Schriftgrösse, also
verschwindet es endgültig auf Papier. Die Bildschirmspalte hat einen Tooltip.
`main.css:1583-1586`

## A6 · Verlauf und Letzte Änderungen kappen ihre letzte Spalte lautlos ★★★

`.log` braucht **1046 px**; die letzte Spalte `.log__value` ist bei **1062 px**
festgenagelt: Überhang **54 px bei 1024**, **310 px bei 768**. Seitenüberlauf
bleibt 0 — es gibt keinen Scrollbalken und keinen Hinweis. Das Änderungsprotokoll
verliert genau den geänderten **Wert**. `.chg` dasselbe ab 940 px.
`main.css:704-710`, `.log`-Regel, Reflow erst bei 760

## A7 · Der Gantt wird zwischen 900 und 994 px beschnitten ★★★

`min-width` sitzt auf dem Scroller statt auf dessen Inhalt, also wächst
`.gantt__scroll` über `.gantt__card` hinaus und `overflow:hidden` frisst den
Rest. Bei 900 px: **96 px verdeckt**, `scrollLeft` bleibt **0**. Q2/28 ist ganz
weg. Die Kapazitätsleiste darunter *scrollt* korrekt — Balken und Kapazität
geraten also gegeneinander. `main.css:1224` — `.gantt__card > *` muss
`.gantt__scroll > *` sein, genau wie `.capband__row` es bereits richtig macht.

## A8 · Der linke Rand des Druckbogens ist unter 800 px unerreichbar ★★

`.mount` ist `align-items:center` mit `overflow-x:auto`; Überlauf landet auf
**beiden** Seiten, und `scrollLeft` kann nicht negativ werden. Bei 375 px liegt
der Bogen bei **−212 px**: ID- und Projektspalte sind fort, der Briefkopf zeigt
nur «…ik BBL». `main.css:1549`

## A9 · `.bi-card--wide` zerstört das einspaltige Dashboard ★★★

Bei ≤1024 px setzt `.bi-grid` auf eine Spalte, `.bi-card--wide` sagt aber
weiter `span 2` — das Raster erzeugt eine implizite zweite Spalte. Gemessen bei
1024: `grid-template-columns: 662.125px 309.875px`. «Auslastung nach Quartal»
misst **40 px** bei 375 und 430 px — ein unlesbarer Schmierstreifen, und genau
die Grafik, für die jemand das Telefon herausholt. `main.css:1383`

---

# B · Tastatur und Fokus

Zehn Befunde, **eine Ursache**: der vollständige Neuaufbau von `#app` verliert
den Fokus, weil `restoreFocus` nur Elemente mit `data-fk` wiederfindet — und
nur 9 Knoten im ganzen Code haben eins.

## B1 · Fokus fällt nach fast jeder Aktion auf `<body>` ★★★

9 von 10 gemessenen Steuerelementen: Reiter, Bearbeiten-Schalter, Sortierkopf,
Gruppen-Umschalter, Perioden-Stepper, `more-link`, `segmented`, `foot-details`
— alle → `body`. Jedes folgende Tab beginnt wieder beim Sprunglink.
**Behebung:** `captureFocus` synthetisiert einen Schlüssel aus
`${act}:${val}:${q}`, wenn kein `data-fk` da ist. Repariert B2, B3 und B4 mit.
`app.js:80-97`

## B2 · Menüs sind per Tastatur nicht bedienbar ★★★

`actions.menu` ruft `setState(...)` — synchroner Neuaufbau — **bevor**
`el.matches(':focus-visible')` geprüft wird. Danach ist `el` abgehängt, die
Prüfung also immer falsch. Pfeiltasten tot, Tab springt an den Seitenanfang,
Menü bleibt offen. `app.js:143-156`

## B3 · `aria-modal="true"` ohne Fokusfalle ★★★

Sechs Tabs aus einem offenen Dialog landen auf Markenlink, Kopfsuche,
Sprachmenü — alles hinter dem Scrim. Escape gibt den Fokus an `body`, nicht an
den Auslöser. `views-modals.js:21-23`, `app.js:56, 91-97`

## B4 · Das Bearbeiten-Popover ist 1107 Tabs vom Auslöser entfernt ★★★

Es rendert als letztes Kind von `.pgrid__track`, hinter allen 888 Zellen. Die
Zelle ist Tabstopp #43, das Popover #1150 von 1159. `views-overview.js:404`

## B5 · Fokusringe werden unsichtbar beschnitten ★★★

`overflow:hidden` frisst die 5 px Ringbox: `.prow__title` **5 px in beiden
Achsen** — der Ring ist vollständig weg. `.sorthead` 5 px, `.segmented button`
4 px, `.pgrouphead__toggle` 8 px. WCAG 2.4.7 fällt beim meistgenutzten
Steuerelement des Rasters durch. `main.css:837, 444, 743`

## B6 · Der Fokusring unterschreitet 3:1 genau dort, wo am meisten getabbt wird ★★

`--blue-500` gegen die Gründe, auf die `outline-offset: 2px` ihn malt:
weiss 3.68 ✓, Seitengrund 3.25 ✓, aber **heat-3 2.83 ✗, heat-4 2.46 ✗,
Danger-Füllung 2.79 ✗**. `audit.js` sieht das nicht — es prüft Text gegen
Hintergrund, nie Kontur gegen Nachbarfläche. `tokens.css:300`

## B7 · Ein Trackpad-Stups zerstört Popover und getippte Begründung ★★★

Ein einzelnes `wheel(0, 120)` löscht `state.editing`. Der Text überlebt in
`state.reason`, ist aber unerreichbar; erneutes Öffnen setzt zurück.
Horizontales Scrollen tut das *nicht* — die Regel ist nicht einmal konsistent.
`app.js:507-512`

## B8 · Menüpanels laufen links aus dem Bild ★★★

`positionMenu()` korrigiert nur rechts. Attribute-Menü bei 640 px:
**L = −174**, 174 px eines 296-px-Menüs unerreichbar. `app.js:77-78`

## B9 · Kein Steuerelement hat einen Druckzustand ★★

`:active` kommt in 2094 Zeilen CSS **null Mal** vor. Alle 25 Komponenten sind
unter Druck identisch mit Hover.

## B10 · Deaktivierter Primärknopf bei 1.97:1 ★★

`opacity: .45` komponiert zu `#9db9f6` unter weisser Schrift = **1.97:1**.
WCAG nimmt inaktive Elemente aus, aber unlesbar ist unlesbar. `main.css:363`

---

# C · Farbe verdienen

## C1 · Jede KPI-Notiz ist rot, ob Alarm oder nicht ★★★

*Von drei der fünf Prüfungen unabhängig gefunden.* `main.css:340` deklariert
`.kpi__note` erneut mit `--color-danger-fg` bei gleicher Spezifität, ohne
`.kpi.is-alert` — die Zeile ist Teil eines doppelt eingefügten Blocks
(334-339 ist wörtliche Kopie von 326-331). Gemessen: alle vier Notizen
`rgb(153,27,27)` Gewicht 600, auch «Gebundene Kredite CHF» und «Nicht
zugewiesener Bedarf», die kein `is-alert` tragen.

## C2 · Die Ampel scheitert in Schwarzweiss ★★★

«im Rahmen» und «knapp» sind derselbe Punkt. Füllung: ok Luma **231.4** vs
knapp **228.2** → **1.028:1**. Ring: 126.6 vs 131.7 → **1.034:1**. Beide sind
10-px-Kreise; nur `over` verdient eine Raute. Reines Farbsignal.

Ursache ist eine Token-Lücke: alle sechs `--ampel-*` existieren nur als
`var(…, Fallback)` und sind **nirgends deklariert** — die Ampel ist die einzige
Statuskomponente, die nie an die luminanzgetunte Rampe angeschlossen wurde.
`main.css:915-925`

## C3 · Rot trägt vier Bedeutungen; das lauteste Rot ist «heute» ★★

`--color-danger-solid` kodiert Überlast, *heute*, ungelesene Meldungen und
verspätete Meilensteine. Auf dem Gantt: Heute-Linie ≈ **10 700 px²** plus
Badges ≈ **4 900 px²** — mehr zusammenhängendes Rot als jedes echte
Überlastsignal auf dieser Ansicht. `main.css:1251, 1259, 134, 1342`

## C4 · Die Dashboard-Kurve fällt in Graustufen auf zwei Töne ★★

Balkenfüllungen nach Luma: Überlast **183.5** → Defizit 223.7 → knapp 228.2 →
frei 230.9 → ok **231.4**. Die letzten vier liegen in **7.7 Luma** — Verhältnisse
1.059, 1.006, 1.022. Fünf Zustände, zwei Töne. Gleichzeitig ist das Dashboard
mit **10.63 % Rot** die farbigste Ansicht der App. Die Höhe kodiert bereits
alles. `main.css:1440-1449`

## C5 · Signale, die keine sind ★★

- Alle 6 sichtbaren `.attention__row` tragen dieselbe rote Leiste — innerhalb
  der Karte konstant, also informationslos (`is-warn`-Zeilen werden hinten
  angehängt und erscheinen nie). `views-overview.js:169-177`
- `.entry__arrow` — reine Navigation — ist auf drei von vier Karten rot.
- Kartentöne sind Literale (`tone: 'danger'` ×3, `'info'` ×1), nicht abgeleitet:
  «0 überfällig» bliebe rot. `views-overview.js:64,70,76,82`
- «ohne Projektleitung» ist an sechs Stellen bernstein und auf der
  Einstiegsseite blau.

## C6 · Die Heat-Rampe sättigt in der Personen-Tabelle ★★

Eine für Projektpensum (0–120) kalibrierte Rampe trägt jetzt
Personenauslastung (0–245). Über 368 Zellen: **64.4 % in den obersten zwei
Stufen**, heat-4 spannt **120 % bis 245 %** in einem flachen `#c2d5ec`. Die
Ansicht ist mit **30.27 % Blau** die farbigste der App.

## C7 · Token-Lecks ★★

- **`--violet-600` ist nirgends definiert** → `.gantt__more` rendert farblos,
  17 Instanzen. `main.css:1323`
- `--milestone-planned` ebenso nicht definiert. `main.css:1340`
- `.dd__bulk { color: var(--color-border-strong) }` — Randrolle als Textfarbe,
  **2.38:1**. `main.css:513`
- `.colchart__col.is-knapp` nutzt `--amber-200` als einziger seiner vier
  Geschwister. `main.css:1445`
- Sechs tote Primitive.

## C8 · Swagger leckt Limette, Türkis und ein zweites Blau ★

Die API-Ansicht ist **23.88 %** chromatisch, Türkis allein **4.70 %** gegen
einen Rauschboden von 0.38–0.66 % anderswo. `#89bf04`, `#61affe`, `#50e3c2`,
`#49cc90` — Farbfamilien, die in dieser Sprache nichts bedeuten.
`main.css:1513-1524`

## C9 · Zwei latente Fälle

`--heat-null-bg` vs `--heat-0-bg` = **1.035:1** und nicht monoton (kein Wert ist
*dunkler* als eine echte Null); im Druckbogen zeigen beide `–`, weil `0` falsy
ist. `--heat-neg-bg` vs `--heat-3-bg` = **1.008:1**. Beide Datenlagen kommen
heute nicht vor.

---

# D · System-Kohärenz

## D1 · `--font-medium: 500` ist kein Gewicht ★★★

Segoe UI — die Plattform der BBL — liefert kein Medium, also löst CSS 500 nach
Semibold auf. Gemessen bei 13 px, «Bewilligungsverfahren 100 % Ressourcenplanung»:
w400 **280.406 px**, w500 **287.563 px**, w600 **287.563 px**, w700 **300.906 px**.
Bitmap-Differenz 400↔500 = 2090 Pixel, 400↔600 = **dieselben 2090**. Das System
deklariert vier Gewichte und rendert drei, über **874 Instanzen**.

Sichtbare Opfer: aktiver vs. inaktiver Reiter, `.btn` vs `.btn--primary`,
`.kpi__label` vs `.kpi__note`. `tokens.css:233-236`

## D2 · Im Pensum-Raster bedeutet Gewicht 700 zwei Dinge ★★★

Gemessen in einer Zeile: Datenzelle 13px/500, Überlastzelle 13px/**700**,
Summenzeile 13px/600, Auslastungszeile 13px/**700**. Also rendert **«Bedarf
total» im selben Schnitt wie eine gewöhnliche Datenzelle**, während 700
gleichzeitig *Status* und *Hierarchie* kodiert. Der Kommentar bei
`main.css:891-894` macht Gewicht ausdrücklich zum Graustufen-Signal für
Überlast — dann darf nichts anderes in dieser Tabelle 700 sein.

## D3 · Doppelt eingefügtes CSS, ein zerstörter Selektor ★★★

*Von vier der fünf Prüfungen gefunden.* `main.css:1391-1425`: 17 Zeilen wörtlich
zweimal vorhanden. Zeile 1391 lautet
`.bi-card__section /* Kommentar */` direkt vor `.chartlink {` — der Kommentar
fällt weg und die Regel kompiliert als Nachfahrenselektor
**`.bi-card__section .chartlink`**. Dazu strandet `.colchart { margin-top }`.

**Ursache (meine):** zwei Patches nutzten `.replace()` auf nicht eindeutigen
Ankern (`.colchart {`, `.kpi__note`), also wurde jeder Block zweimal eingefügt.
C1 ist derselbe Fehler.

## D4 · Dichte: 56–70 % des Laptops sind verbraucht, bevor Daten kommen ★★

| Ansicht | Chrome vor der ersten Datenzeile | Anteil von 800 px | sichtbare Zeilen |
|---|---|---|---|
| Personen | **560 px** | 70 % | 6 |
| Termine | 466 px | 58 % | 6 |
| Übersicht | **450 px** | 56 % | 8 |

Ohne Umbau rückgewinnbar: ~46 px = **eine volle Datenzeile**.

## D5 · Die drei Steuerzeilen haben denselben Abstand wie zum Inhalt ★★

`.content` hat flache 16 px, also messen Toolbar→Filter, Filter→Zeitleiste und
Zeitleiste→Raster alle **16.0**. Vier gleichrangige Blöcke, keine Gruppierung.
Die Filterzeile allein kostet **52 px** für eine Bildunterschrift.

## D6 · Weitere Rhythmus-Brüche ★

- Dieselbe Grafik, drei Abstände zur Kartenüberschrift: **26 / 14 / 8 px**.
- Kartentexte staffeln sich um 2–4 px: `.kpi__label` **46.0**, `.bi-card__title`
  direkt darunter **48.0** — durch `@1380`-Überschreibungen auf `--space-9`.
- `.pgroup + .pgroup` **28 px** gegen Gantt-Gruppen **32 px**, gleiche Beziehung.
- `.page-header` stapelt Padding **und** Margin = 26 px, eine Ebene tiefer 18.
- `.chg` 46 px hoch (Literal) vs `.log` 48 px (Token), Spaltenreihenfolge
  gespiegelt — die zwei Ansichten können nie fluchten.
- `.content--landing` 20 px gegen 16 px überall sonst.
- `.grid-card { gap }` ist tot: genau ein Kind.

## D7 · Skalen mit toten Sprossen ★

- `--space-9` (18 px) als *Gap* genau einmal benutzt — und bei ≤1380 überschrieben,
  rendert auf dem Ziellaptop also nie.
- Vier Schriftsprossen liegen in 3 px (15/16/17/18) und tragen **7 von 121**
  Deklarationen; der eine Schritt 12↔13 px trägt **77 von 121**.
  `--text-card: 17px` hat genau einen Abnehmer, 1 px von `--text-sub`.
- Drei von vier `--leading-*` sind praktisch tot; **keine Überschrift** verlässt
  die 1.5-Fliesstextdurchschuss: h1 24px/**36px**.
- Icon-Grössen laufen über **sechs** Werte, dasselbe Icon in dreien
  (`close` bei 12, 13 und 14 px).
- Der Druckbogen steigt ganz aus: 30+ rohe Literale, Fliesstext bei
  **10.5 px** — fraktional, die einzigen Literal-Schriftgrössen im Stylesheet.

## D8 · Überschriften ohne System ★

Jede `h2` ist anders gross: `.card__title` 16px, `.changes__title` 22px als
Geschwister. `.pgrouphead` fällt auf **19.5 px** durch, weil die Regel
`font-weight: inherit` setzt, aber nie `font-size` — die UA-Regel `1.5em`
greift. `h3.bi-card__subtitle` ist mit 13px/600 nicht von einer Listenzeile zu
unterscheiden.

## D9 · Spaltenbreiten gegen die echten Daten ★★

`.prow__title` misst 212 px, der längste Titel 349 px → **99 von 111 Zeilen
abgeschnitten**, im Median 10 Zeichen, und es ist immer die *Massnahme*, die
fällt. Daneben: **ID 100 px für 35 px Inhalt** (die Daten liefern `…0051`),
Lead +16 px, Phase +8 px Reserve — alle drei schneiden **0 von 111** ab.
Simuliert: Titel auf 285 px → **~30 von 111**. `views-overview.js:263-266`

## D10 · Kopfzeile mit hartem 494-px-Boden ★★★

`.brand` (267 px) und `.shell-header__actions` (191 px) sind beide
`flex: 0 0 auto`. Bei 430 px scrollt **jede** Ansicht 64 px horizontal, bei
375 px 119 px. `scrollWidth` bleibt von 493 bis 320 px auf 494 festgenagelt.
Einzige Ursache jedes Seiten-Horizontalscrolls der App. `main.css:96, 118`

## D11 · Weitere Responsive-Brüche ★

- `.tabs` läuft ab **411 px** über, «Verlauf» unerreichbar (kein Scroll).
- `.page-header__actions` überhängt ab ~400 px um 25 px.
- Querformat 740×360: **279 px von 360** sind Chrome, der «zu schmal»-Hinweis
  liegt vollständig unter der Falz.
- Jedes Dropdown öffnet im Querformat unter der Falz — `Math.max(160, …)`
  gewinnt gegen einen negativen Platzwert.
- `#swagger` überzieht bei ≤1024 um **4 px** (Pull 20, Padding 16).
- Der 900-px-Block ändert genau **eine** Deklaration und widerspricht der
  JS-Schwelle bei 899.
- Der «zu schmal»-Hinweis nennt zwei Auswege; **das Dashboard rendert bei
  375 px vollständig** und wird nicht genannt. Termine lässt Toolbar und
  Zeitleiste über dem Hinweis stehen, Übersicht nicht.

## D12 · Affordanz-Widersprüche ★★

- Pensum-Zelle im Lesemodus: `cursor: default` **und** Hover-Reaktion **und**
  ein aktiver Klick. Drei Signale, drei Antworten. Der Hover ist mit
  **1.06–1.12:1** unter der Wahrnehmungsschwelle.
- Personen-Tabelle: `<span>` mit `cursor: pointer` und Hover, **ohne jede
  Aktion**, auf jeder Zelle.
- `.entry` ist klickbar und liegt flach; `.kpi` ist inert und trägt
  `--shadow-raised`. Erhöht = interaktiv ist genau invertiert.
- `.prow__title` öffnet in der Übersicht ein Projekt und **überschreibt** in der
  Personen-Tabelle den Lead-Filter — gleiche Klasse, gleiches Aussehen.

## D13 · Die einzige unumkehrbare Aktion sieht neutral aus ★★

«Zuweisung aufheben» nimmt einem Projekt die Leitung, ohne Rückfrage, ohne
Rückweg — und ist zeichengleich mit «Abbrechen» daneben. Gleichzeitig trägt das
vollständig umkehrbare «Alle Filter zurücksetzen» Rot. `views-modals.js:69`

## D14 · Markup-Duplikate ★

Vier identische Modal-Köpfe, die sich nur in Kicker und Titel unterscheiden;
fünf handgebaute Seitenkopf-Aktionsblöcke. Reiner Refactor.

## D15 · Kleinigkeiten mit Wirkung ★

- `.changes__title span` erbt `letter-spacing: -0.017em` von einer 22-px-Regel
  auf 13-px-Fliesstext.
- Vier Zahlenspalten stehen ausserhalb der `tabular-nums`-Regel
  (`.log__value`, `.sorthead__label`, Gantt-Jahre) — auf Segoe UI folgenlos,
  auf macOS nicht.
- `scrollIntoView({behavior:'smooth'})` ignoriert `prefers-reduced-motion`.
- Der Toast hat einen Auftritt über 160 ms und verschwindet in einem Frame.
- `.dd__item.is-checked` überschreibt seinen eigenen `:hover` — das eine
  Element, das man gleich abwählen will, reagiert nicht.

---

## Was ausdrücklich gut ist

Nicht anfassen:

- **Der 28-px-Rand ist perfekt.** Titel, Reiter, Toolbar, Filterzeile und jedes
  `.content`-Kind messen `left = 28.0` in **allen acht Ansichten**. Null Drift.
- **Kontrast erfüllt AA in jedem erzwungenen Zustand** — `.btn` 10.31,
  `.linkbtn` 6.25 → 14.91, `.tabs__tab` 17.74, Kopfsteuerung auf Navy 7.97–11.88.
- **Ein einziges Fokus-Token** global statt pro Komponente — deshalb ist B5 eine
  Zwei-Zeilen-Reparatur.
- **Die Heat-Rampe ist echt luminanzgetunt** und übersteht Graustufen.
- **Kein `text-transform` im ganzen Code** — für deutsche Komposita genau richtig.
- **Tabellenkopf-Konvention stimmt**: 12px/600 über 13px/400, kleiner und
  schwerer oben. Lehrbuch.
- **`prefers-reduced-motion` wird für jede CSS-Bewegung geehrt**, zwei Dauern
  (.12s Zustand, .16s Auftritt), sonst nichts.
- **Der deaktivierte «Übernehmen» sagt danebenstehend, warum** — besser als die
  meisten Produktivsysteme.
- **Der Druck ist bildschirmunabhängig**: PDFs aus 1280 px und 375 px sind
  byte-identisch.
- **Keine WCAG-2.2-Zielgrössenverletzung** bei 430 und 375 px.

---

## Umsetzung — was gemacht wurde

Alle vier Gruppen sind umgesetzt. Nichts wurde hinzugefügt oder entfernt; jede
Änderung ist eine Reparatur oder ein Refactor.

### A · Falsche Auskunft — vollständig

| | vorher | nachher |
|---|---|---|
| Auslastung, Filter Sport | **−2 %** | 106 % |
| Auslastung, ohne Treffer | **−7 %** | 106 % |
| Leerzustand | Raster ohne Kopf, Legende ohne Daten | Hinweis + «Alle Filter zurücksetzen» |
| Heat-Rechtecke im Druck | **687 → weiss** | vollständig, `print-color-adjust: exact` |
| «frei» im Druck | Luma 24 — dunkler als Überlast | Luma 84, Rampe monoton |
| Titel im Druckbogen | **162 von 222 beschnitten** | **0 von 222**, zweizeilig, gleiche Blattzahl |
| Verlauf, letzte Spalte bei 1024 | 54 px verdeckt | im Bild |
| Gantt bei 900 px | 96 px verdeckt, `scrollLeft` 0 | scrollt 96 px |
| Druckbogen bei 375 px | linke Kante bei −212 px | bei 0 |
| Dashboard-Karten bei 375 px | zwei bei **40 px** | alle 343 px |

`totals()` trennt jetzt die beiden Grundgesamtheiten und meldet `scoped`; die
Fusszeile schreibt «Auswahl» und «Gesamtportfolio» dazu, sobald sie
auseinanderfallen.

### B · Tastatur und Fokus — vollständig

`captureFocus`/`restoreFocus` erkennen jedes Steuerelement an seinen
Dispatch-Attributen statt an den neun `data-fk`. Damit:

- Fokus überlebt jede Aktion (vorher 9 von 10 auf `<body>`).
- Menüs nehmen die Tastatur: `:focus-visible` wird **vor** `setState` gelesen.
- Dialoge nehmen den Fokus, halten ihn (Tab-Falle) und geben ihn dem Auslöser
  zurück.
- Das Bearbeiten-Popover rendert auf oberster Ebene, bekommt beim Öffnen den
  Fokus und gibt ihn beim Schliessen an **genau die Zelle** zurück.
- Fokusringe zeichnen in beschneidenden Behältern nach innen (`outline-offset:
  -3px`), der Ring ist `--blue-700`: **2.46 → 4.48:1** auf der dunkelsten Stufe.
- Scrollen verwirft eine begonnene Eingabe nicht mehr.
- Menüpanels weichen beiden Rändern aus und klappen im Querformat nach oben.
- `:active` für elf Komponentenklassen; deaktivierter Primärknopf **1.97 →
  4.6:1** über explizite Tokens statt `opacity`.

### C · Farbe verdienen — vollständig

- KPI-Notizen tragen Rot nur noch bei `is-alert`.
- **Die Ampel unterscheidet sich in der Form**: Scheibe / Ring (3 px) / Raute /
  Umriss. Die sechs `--ampel-*`-Tokens sind deklariert und an die getunte
  Statusrampe gehängt.
- «Heute» ist Chrome (`--color-brand`), nicht Gefahr — ~15 600 px² Rot weg.
- Die Dashboard-Kurve trägt eine neutrale Füllung; nur Überlast bleibt rot.
- Der Navigationspfeil auf den Einstiegskarten ist neutral; Kartentöne werden
  aus der Kennzahl abgeleitet, «ohne Projektleitung» ist bernstein wie überall.
- Handlungsbedarf verwebt beide Arten, damit die Leiste unterscheidet.
- Die Personen-Tabelle hat eigene Schwellen: **64 % → 42 %** in den obersten
  zwei Stufen.
- `--violet-600` und `--milestone-planned` waren nirgends definiert — jetzt
  echte Tokens; `.dd__bulk` 2.38 → 5.4:1.

### D · System-Kohärenz — vollständig

- **`--font-medium` ist entfernt.** Drei Gewichte, weil drei rendern. Im Raster
  bedeutet 700 nur noch Überlast; die Summenzeile steht auf 600 und ist
  wieder als Summenzeile zu sehen.
- Überschriften erben Grösse und Gewicht — `.pgrouphead` fällt nicht mehr auf
  19.5 px durch. Überschriften haben eigenen Durchschuss (h1 36 → 31.2 px).
- `--text-card` und `--space-9` sind zurückgezogen.
- **Dichte**: Übersicht 450 → **418 px**, Termine 466 → 434, Personen 560 →
  538 — rund eine zusätzliche Datenzeile.
- Doppelt eingefügtes CSS entfernt, `.bi-card__section .chartlink` repariert.
- **Spaltenbreiten gegen echte Daten**: Titel 220 → 285, ID 100 → 62 →
  **99 → 29 von 111** beschnitten, bei 13 px mehr Scrollweg.
- Kopfzeile schrumpft: Seitenüberlauf bei 375 px **119 → 0 px**, auf jeder
  Ansicht.
- Reiterleiste scrollt, Querformat-Block, `#swagger` 4-px-Überzug weg, die API
  läuft auf der App-Typoskala.
- Affordanz: erhöht = interaktiv (die Einstiegskarte liegt jetzt oben, die
  KPI-Karte darunter); Hand-Cursor und Hover nur noch auf editierbaren Zellen.
- «Zuweisung aufheben» ist abgesetzt und als Gefahr markiert; «Alle Filter
  zurücksetzen» gibt sein Rot ab.
- Der «zu schmal»-Hinweis nennt das Dashboard; Termine verbirgt seine
  Steuerleisten wie die Übersicht.
- Refactor: **ein** Dialogkopf statt vier, **eine** `pageActions()` statt fünf,
  Icon-Grössen von sechs Werten auf **zwei** (13 am Text, 15 im Bedienelement).

### Prüfstand danach

```
flow.js   48 Checks            failures: 0        Konsole sauber
audit.js  Kontrast unter AA    0
          ohne Namen           0
          Ziel unter 24 px     0
          Text unter 11 px     22 → 8   (Rest: Druckbogen-Chrome, gewollt)
resp.js   1440 / 1280 / 1024 / 900 / 768 / 640 / 430 / 375 px
          horizontaler Seitenüberlauf: 0 px auf jeder Ansicht
```

### Bewusst nicht gemacht

- **Kein Roving-Tabindex im Raster.** 888 Tabstopps sind für Tastaturnutzende
  viel, aber eine Pfeiltastennavigation ist neues Verhalten, kein Refactor —
  und der Fokus überlebt jetzt, was den Weg dorthin überhaupt erst gangbar
  macht. Vorgemerkt.
- **`.prow__title` bedeutet in der Personen-Tabelle weiter «filtern».** Die
  saubere Lösung ist eine Personen-Detailansicht — eine Funktion, keine
  Verfeinerung.
- **Zwei latente Farbfälle** (`--heat-null` gegen `--heat-0`, `--heat-neg`
  gegen `--heat-3`) bleiben offen: beide Datenlagen kommen heute nicht vor,
  und eine Rampe für Werte zu ändern, die es nicht gibt, ist raten.
