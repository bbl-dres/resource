# Dashboard — Fachliche Analyse

Rolle: Portfoliosteuerung Hochbau, öffentliche Bauherrschaft
Stand: 111 Projekte, 46 Personen, 86 Gates, 972 Mio. CHF gebundene Mittel
Auftrag: Vorschlag für Gliederung und Inhalte. **Analyse, keine Umsetzung.**

---

## 1 · Befund zum heutigen Zustand

Das Dashboard zeigt sechs Karten in einer Reihe:

| Karte | Frage, die sie beantwortet |
|---|---|
| Auslastung nach Quartal | Sind wir überlastet? |
| Anzahl Projekte nach SIA-Phase | Wie verteilt sich das Portfolio? |
| Auslastung nach Person | Wer ist überlastet? |
| Bedarf nach Teilportfolio | Wo liegt der Bedarf? |
| Kredit nach Jahr | Wann fliesst Geld? |
| Kredit nach SIA-Phase | Wie weit sind die Mittel gebunden? |

Drei Beobachtungen:

**Die Karten stehen nebeneinander, nicht in einem Argument.** Kapazität, Termine
und Mittel sind drei verschiedene Fragen mit drei verschiedenen Adressaten und
drei verschiedenen Handlungshorizonten. Nebeneinander gelegt konkurrieren sie
um dieselbe Aufmerksamkeit, statt sich zu ergänzen.

**Eine Karte skaliert nicht mehr.** «Auslastung nach Person» zeichnete sechs
Balken. Bei 46 Personen sind es 46, und die Karte wird zur Liste, durch die man
scrollt. Eine Liste ist keine Auswertung.

**Termintreue fehlt ganz.** 86 Gates, 24 davon verspätet, 7 ohne Termin — das ist
neben der Auslastung die zweite Steuerungsgrösse einer Bauherrschaft, und sie
kommt im Dashboard nicht vor. Sie steht nur als Zahl auf der Einstiegsseite.

Ein zweiter Reiterstreifen ist deshalb die richtige Antwort — aber nicht als
Ablage für vorhandene Karten, sondern als Gliederung nach der Frage, die
jemand mitbringt.

---

## 2 · Was eine Bereichsleitung tatsächlich entscheidet

Vier wiederkehrende Entscheidungen, in der Reihenfolge, in der sie anfallen:

1. **Können wir das übernehmen?** — Bedarf gegen verfügbare Kapazität, über die
   Zeit, nach Bereich und nach Person.
2. **Was kommt auf uns zu?** — Pipeline: welche Projekte rücken wann in die
   teure Phase 5 nach, und mit welchem Pensum.
3. **Halten wir die Termine?** — Termintreue an den Gates, und wo im SIA-Ablauf
   der Verzug entsteht.
4. **Fliessen die Mittel?** — Kredittranchen gegen Jahresbudget. In der
   Bundesverwaltung ist Minderausgabe so erklärungsbedürftig wie Mehrausgabe:
   nicht abgerufene Tranchen verfallen.

Diese vier Fragen sind die vorgeschlagenen Reiter.

---

## 3 · Vorschlag: vier Reiter

    KPI-Streifen  ← bleibt oben, reitertunabhängig
    ────────────────────────────────────────────
    Kapazität │ Pipeline │ Termine │ Mittel

Der zweite Streifen muss dem ersten optisch **untergeordnet** sein — der obere
wechselt die Ansicht, der untere gliedert eine Ansicht. Empfehlung: das
bestehende `segmented`-Element statt einer zweiten Reiterleiste, links unter dem
KPI-Streifen, und der Zustand in der URL (`&bi=kapazitaet`), damit ein Link auf
den Abschnitt zeigt.

Der KPI-Streifen bleibt darüber und behält die vier Zahlen, die unabhängig vom
gewählten Abschnitt gelten. Vorschlag zur Anpassung: **«Überfällige Gates»**
statt «Gebundene Kredite» — der Kreditbetrag ist eine Bestandsgrösse ohne
Handlungsauslöser und gehört in den Reiter *Mittel*, die überfälligen Gates
sind ein Alarm.

---

## 4 · Reiter «Kapazität»

Die wichtigste Änderung im ganzen Dashboard steht hier an erster Stelle.

### 4.1 Bedarf gegen Kapazität, nach Bindungsgrad ★★★

Heute zeigt die Karte eine Säule Auslastung je Quartal. Sie beantwortet «sind wir
über 100 %», aber nicht die eigentliche Frage: **welcher Teil des Bedarfs ist
überhaupt verschiebbar?**

Vorschlag: gestapelte Säulen je Quartal, gegen eine Linie *Kapazität netto*.

    ▓▓ gebunden (nach Baukredit-Freigabe)   — nicht verschiebbar
    ▒▒ vor Baukredit-Freigabe               — verschiebbar
    ░░ extern beauftragt                    — zugekauft
    ── Kapazität netto                      — Referenzlinie

Aus den Daten heute rechenbar (`totals()` liefert `demand`, `preCredit`,
`external`, `net`). Beispiel Q1/2027: 4 830 % Bedarf, davon 2 445 % vor
Baukredit-Freigabe — **die Hälfte der Überlast liegt in Projekten, die noch gar
nicht freigegeben sind.** Das ist eine Handlungsoption, und heute ist sie
unsichtbar.

### 4.2 Auslastungsverteilung statt Personenliste ★★★

46 Balken sind keine Auswertung. Vorschlag: zwei Elemente nebeneinander.

**Links — Histogramm der Auslastung** (Anzahl Personen je 20-%-Band, Referenz
bei 100 %). Beantwortet: ist die Last gleichmässig verteilt oder gibt es zwei
Lager? Aktuell: Median 90 %, 18 von 46 über 100 %, Spanne 65 – 225 %.

**Rechts — die Ränder namentlich.** Die fünf am stärksten überlasteten und die
fünf am wenigsten ausgelasteten Personen, je mit Pensum, Anzahl Projekten und
Klick auf die gefilterte Übersicht. Das ist die Umbuchungsliste.

Die Mitte des Feldes braucht keine Namen. Die Ränder sind die Arbeit.

### 4.3 Freie Kapazität je Quartal ★★

Die Umkehrung von 4.1, und die Zahl, mit der man Zusagen macht: `net − booked`.
Bei uns negativ bis Q3/2027, danach positiv. Als kleine Säulenreihe mit
Nulllinie — negativ nach unten. Zeigt in einem Bild, ab wann Neues geht.

### 4.4 Kapazitätslücke nach Teilportfolio ★★

Bedarf minus zugeordnete Kapazität je Bereich, laufendes Quartal. Beantwortet,
**wo** die Lücke sitzt, und damit, zwischen welchen Bereichen umgeschichtet
werden könnte. Braucht keine neuen Daten.

---

## 5 · Reiter «Pipeline»

Heute liefert das Dashboard zwei statische Verteilungen (Anzahl je Phase, Bedarf
je Bereich). Beides sind Momentaufnahmen. Die steuerungsrelevante Frage ist die
Bewegung.

### 5.1 Phasenfluss über die Zeit ★★★

Gestapelte Flächen: Anzahl Projekte je SIA-Hauptphase über die acht Quartale.
Aus den `bars` jedes Projekts direkt ableitbar — die Phasenkette ist schon da.

Das ist die aussagekräftigste Grafik, die aus diesen Daten überhaupt zu bauen
ist: man sieht die Welle, mit der Projekte in Phase 5 Realisierung nachrücken,
also den Zeitpunkt, an dem der Pensumsbedarf strukturell steigt. Eine
Bereichsleitung plant Einstellungen genau daran.

### 5.2 Trichter Phase → Bedarf → Kredit ★★

Drei Spalten pro SIA-Hauptphase: Anzahl Projekte, Pensum, gebundene Mittel.
Zeigt, dass die Phasen sehr unterschiedlich «schwer» sind — Phase 2 ist zahlreich
und billig, Phase 5 ist wenig und teuer. Ersetzt die heutigen Karten
*Anzahl nach Phase* und *Kredit nach Phase* durch eine, die beide vergleicht.

### 5.3 Matrix Teilportfolio × Phase ★★

Sieben Bereiche gegen sechs Hauptphasen, Zellwert = Anzahl oder Pensum, als
Heatmap in derselben Blau-Rampe wie das Pensum-Raster. 42 Zellen auf kleinem
Raum. Beantwortet: welcher Bereich hat einen Klumpen in einer Phase — etwa alle
Asylzentren gleichzeitig in Ausschreibung.

### 5.4 Bedarf nach Priorität ★★

Gestapelte Säulen je Quartal nach `hoch / mittel / tief`. Die Frage dahinter ist
unbequem und deshalb wichtig: **verbrauchen wir in den Überlastquartalen
Kapazität für Projekte tiefer Priorität?** Wenn ja, ist das die erste
Verschiebung, die man macht.

### 5.5 Projekte ohne Projektleitung ★

Kein Diagramm, eine Kennzahl mit Liste: Anzahl, offener Bedarf, ab wann. Heute
3 Projekte. Gehört als Callout in den Reiter, nicht als Karte.

---

## 6 · Reiter «Termine»

Neu. Heute nicht vorhanden, obwohl die Daten vollständig da sind
(`plan`, `forecast`, `status` je Gate).

### 6.1 Termintreue je Quartal ★★★

Gestapelte Säulen: Gates mit Fälligkeit im Quartal, aufgeteilt in
*im Termin / verschoben / ohne Termin*. Die eine Grafik, an der man sieht, ob die
Planung trägt. Aktuell: 55 im Termin, 24 verschoben, 7 ohne Termin — eine
Termintreue von 64 %, was für ein Portfolio dieser Grösse schlecht ist und
sichtbar sein muss.

### 6.2 Verzug nach SIA-Phase ★★★

Wo im Ablauf entsteht der Verzug? Balken je Sub-Phase mit dem durchschnittlichen
Verzug in Quartalen. Erfahrungsgemäss konzentriert er sich auf
**33 Bewilligungsverfahren** und **41 Ausschreibung** — Schritte, die von
Dritten abhängen. Wenn die Daten das bestätigen, ist das ein Argument für
Vorlauf­zeiten, nicht für mehr Personal.

### 6.3 Gate-Last je Quartal ★★

Anzahl fälliger Gates je Quartal, als schlichte Säulenreihe. Genehmigungs­gremien
haben einen begrenzten Durchsatz; eine Häufung von Baukredit-Gates in einem
Quartal ist ein eigenes Risiko, unabhängig von der Personalkapazität. Diese
Grafik ist billig zu bauen und in der Praxis überraschend wirksam.

### 6.4 Verzugsverteilung ★

Histogramm: wie viele Gates um 0 / 1 / 2+ Quartale verschoben. Trennt
«überall ein bisschen» von «wenige, dafür massiv» — zwei völlig verschiedene
Probleme mit verschiedenen Massnahmen.

---

## 7 · Reiter «Mittel»

### 7.1 Mittelabfluss gegen Jahrestranche ★★★

Die heutige Karte *Kredit nach Jahr* zeigt, wann Geld gebunden ist. Die
Steuerungsfrage ist eine andere: **gebundene Mittel gegen das, was das Budget
für dieses Jahr vorsieht.** Über- und Unterschreitung als abweichende Säule
gegen eine Referenzlinie.

> Fehlende Daten: die Jahrestranche selbst. Ein Feld `budgetByYear` in
> `data/meta.json` genügt. Ohne sie bleibt die Karte eine Bestandszahl.

### 7.2 Gebundene Mittel nach Bindungsgrad ★★

Der Anteil vor Baukredit-Freigabe ist der Teil, der noch nicht sicher ist. Als
zwei Segmente je Jahr: freigegeben / vor Freigabe. `preCredit` liegt vor.

### 7.3 Mittel nach Teilportfolio ★★

Die Verteilung über die sieben Bereiche, gegen die Bedarfsverteilung aus 4.4
gelegt. Zeigt, wo viel Geld auf wenig Personal trifft und umgekehrt.

### 7.4 Kredit nach SIA-Phase ★

Die bestehende Karte, unverändert übernehmen — sie beantwortet, wie viel des
Portfolios schon in der Realisierung gebunden ist.

---

## 8 · Was fehlt, um das Beste davon zu bauen

Ehrlich benannt, weil die Hälfte der stärksten Auswertungen daran hängt:

| Fehlt | Ermöglicht |
|---|---|
| **Pensum je Person und Quartal** statt nur je Projekt | Kapazität nach Rolle und Qualifikation; heute trägt die Projektleitung rechnerisch das ganze Projektpensum |
| **Jahrestranchen** (`budgetByYear`) | Mittelabfluss gegen Budget — Abschnitt 7.1 |
| **Ist-Kosten** je Projekt | Kostenabweichung, die zweite Hälfte der Finanzsicht |
| **Planstände über die Zeit** (Snapshots) | Prognosegüte: wie oft verschiebt sich ein Gate, bevor es hält |
| **Risiko-/Komplexitätsklasse** je Projekt | Gewichtete Priorisierung statt hoch/mittel/tief |
| **Kalender der Genehmigungsgremien** | Gate-Last gegen tatsächlichen Durchsatz — Abschnitt 6.3 |

Die API-Referenz beschreibt unter `allocations` bereits die Form, die das erste
und wichtigste dieser Felder hätte.

---

## 9 · Gestaltungsregeln für diesen Reiter

Damit die Erweiterung nicht rückgängig macht, was die Design-Review erreicht hat:

* **Farbe bleibt verdient.** Blau kodiert Grösse, Rot/Gelb/Grün nur den Status
  gegen 100 %. Eine Kategorie bekommt keine eigene Farbe, nur weil sie eine
  Kategorie ist — gestapelte Segmente unterscheiden sich über Helligkeit
  derselben Rampe und über Schraffur, damit sie auch in Schwarzweiss lesbar
  bleiben.
* **Keine Torten, keine Tachometer.** Anteile werden gestapelt oder als Balken
  gezeigt; ein Tacho zeigt eine Zahl auf der Fläche von zwölf.
* **Jede Karte nennt ihre Bezugsgrösse.** «112 %» ohne «gegen Kapazität netto»
  ist keine Aussage.
* **Jede Karte führt weiter.** Ein Klick filtert die Übersicht auf das, was die
  Karte zeigt — das ist heute schon so und muss so bleiben.
* **Vier bis fünf Karten je Reiter.** Mehr ist wieder der heutige Zustand, nur
  in vier Stapeln.
* **Filter gelten reiterübergreifend.** Der Toolbar-Filter bleibt über dem
  KPI-Streifen und wirkt auf alle Abschnitte.

---

## 10 · Empfohlene Reihenfolge

Nach Wirkung je Aufwand:

1. **4.1 Bedarf nach Bindungsgrad** — ändert die zentrale Karte von einer
   Feststellung in eine Handlungsoption. Daten vorhanden.
2. **6.1 Termintreue je Quartal** — schliesst die grösste inhaltliche Lücke.
   Daten vorhanden.
3. **4.2 Auslastungsverteilung** — repariert die Karte, die bei 46 Personen
   nicht mehr funktioniert. Daten vorhanden.
4. **5.1 Phasenfluss über die Zeit** — die stärkste Grafik im Vorschlag.
   Daten vorhanden (`bars`).
5. **Reitergliederung selbst** — sinnvoll, sobald 1–4 stehen; vorher gliedert
   sie zu wenig Inhalt.
6. **6.2 Verzug nach Phase**, **5.4 Bedarf nach Priorität** — beide billig,
   beide unbequem, beide nützlich.
7. **7.1 Mittelabfluss** — sobald die Jahrestranchen erfasst sind.
