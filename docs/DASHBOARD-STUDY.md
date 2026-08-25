# Dashboard — Fachliche Analyse

Rolle: Portfoliosteuerung Hochbau, öffentliche Bauherrschaft
Stand: 111 Projekte, 46 Personen, 86 Gates, 972 Mio. CHF gebundene Mittel
Auftrag: Vorschlag für Gliederung und Inhalte. **Analyse, keine Umsetzung.**

Wireframe zum Vorschlag:
[docs/wireframes/260826_Dashboard/Dashboard Bereichsleitung.html](wireframes/260826_Dashboard/Dashboard%20Bereichsleitung.html)

---

## 1 · Befund

Das Dashboard zeigt sechs Karten in einer Reihe:

| Karte | Frage | Urteil |
|---|---|---|
| Auslastung nach Quartal | Sind wir überlastet? | **Bleibt** — aber nicht in einem Reiter |
| Anzahl Projekte nach SIA-Phase | Wie verteilt sich das Portfolio? | **Bleibt** — gehört zur Pipeline |
| Auslastung nach Person | Wer ist überlastet? | **Bleibt** — braucht einen eigenen Reiter |
| Bedarf nach Teilportfolio | Wo liegt der Bedarf? | **Bleibt** — gehört zur Kapazität |
| Kredit nach Jahr | Wann fliesst Geld? | **Bleibt** — gehört zu den Mitteln |
| Kredit nach SIA-Phase | Wie weit sind Mittel gebunden? | **Bleibt** — gehört zu den Mitteln |

Alle sechs sind fachlich richtig. Das Problem ist nicht ihr Inhalt, sondern dass
sie ohne Gliederung nebeneinanderliegen, dass zwei tragende Fragen fehlen
(Termintreue, Bindungsgrad des Bedarfs) und dass eine Karte bei der jetzigen
Datenmenge auseinanderfällt.

**Was fehlt:** Termintreue kommt im Dashboard nicht vor. 86 Gates, 24 verspätet,
7 ohne Termin — eine Termintreue von 64 %. Neben der Auslastung ist das die
zweite Steuerungsgrösse einer Bauherrschaft.

**Was nicht mehr trägt:** «Auslastung nach Person» zeichnete sechs Balken. Bei
46 Personen sind es 46, bei 100+ wird die Karte zur Liste, durch die man
scrollt. Eine Liste ist keine Auswertung. Dazu Abschnitt 4.

---

## 2 · Was eine Bereichsleitung entscheidet

Fünf wiederkehrende Entscheidungen, in der Reihenfolge, in der sie anfallen:

1. **Können wir das übernehmen?** — Bedarf gegen Kapazität, über die Zeit und
   nach Bereich.
2. **Wer macht es?** — Auslastung, Überlast, freie Kapazität je Person.
3. **Was kommt auf uns zu?** — welche Projekte rücken wann in die teure Phase 5
   nach.
4. **Halten wir die Termine?** — Termintreue an den Gates, und wo im SIA-Ablauf
   der Verzug entsteht.
5. **Fliessen die Mittel?** — Kredittranchen gegen Jahresbudget. In der
   Bundesverwaltung ist Minderausgabe so erklärungsbedürftig wie Mehrausgabe:
   nicht abgerufene Tranchen verfallen.

Jede dieser fünf Fragen hat eine eigene Betrachtungseinheit — Quartal, Person,
Projekt, Gate, Franken. Das ist die Gliederung.

---

## 3 · Vorschlag: fester Kopf, fünf Reiter

```
┌──────────────────────────────────────────────────────────────┐
│  KPI-Streifen              4 Zahlen, immer sichtbar          │
│  Auslastung nach Quartal   die Ankergrafik, immer sichtbar   │
├──────────────────────────────────────────────────────────────┤
│  Kapazität │ Personen │ Pipeline │ Termine │ Mittel          │
└──────────────────────────────────────────────────────────────┘
```

### Der Kopf bleibt stehen

**«Auslastung nach Quartal» gehört in keinen Reiter.** Sie ist die Zahl, gegen
die jede andere Aussage gelesen wird: 122 % Bedarf in einem Bereich heisst etwas
anderes, wenn das Portfolio bei 106 % steht, als wenn es bei 80 % steht. Deshalb
steht sie über der Reiterleiste, breit und flach, und bleibt in jedem Abschnitt
sichtbar.

Dazu kommt eine Interaktion, die die Gliederung zusammenhält: **ein Klick auf
ein Quartal in der Ankergrafik setzt das Bezugsquartal für den Reiter darunter.**
Die Verteilung im Reiter *Personen*, die Lücke im Reiter *Kapazität* und die
Gate-Last im Reiter *Termine* beziehen sich dann alle auf dasselbe Quartal.

Der KPI-Streifen behält seine vier Zahlen. Eine Anpassung: **«Überfällige Gates»
statt «Gebundene Kredite»** — der Kreditbetrag ist eine Bestandsgrösse ohne
Handlungsauslöser und gehört in den Reiter *Mittel*; die überfälligen Gates sind
ein Alarm.

### Die Reiterleiste ist untergeordnet

Der obere Reiterstreifen wechselt die Ansicht, der untere gliedert eine Ansicht.
Empfehlung: das bestehende `segmented`-Element statt einer zweiten Reiterleiste,
und der Zustand in der URL (`&bi=personen`), damit ein Link auf den Abschnitt
zeigt.

---

## 4 · Reiter «Personen» — warum eigenständig

Die Anfrage, die am häufigsten kommt, verdient mehr als eine Karte. Drei Gründe,
und der dritte ist der eigentliche.

### 4.1 Die Datenmenge

46 Personen heute, realistisch über 100. Ein Balken pro Person ergibt eine Liste,
durch die man scrollt, ohne je einen Überblick zu bekommen. Alles andere im
Dashboard verdichtet — diese eine Karte nicht.

### 4.2 Die Betrachtungseinheit

Jede andere Karte rechnet in Projekten, Quartalen oder Franken. Personen sind
eine eigene Achse mit eigenen Merkmalen — Anstellungsgrad, Rolle, Abwesenheiten —
und mit eigenen Handlungen: umbuchen, zuweisen, Ferien planen. Diese Handlungen
haben in einer Portfoliokarte keinen Platz.

### 4.3 Eine Momentaufnahme führt in die Irre

Das ist der eigentliche Grund. Aus den Daten:

| Frage | Antwort |
|---|---|
| Über 100 % im laufenden Quartal | **18** von 46 |
| Über 100 % in **mindestens einem** der acht Quartale | **34** von 46 |
| Über 100 % in **allen** ersten vier Quartalen | **12** von 46 |
| Personen mit Lastspitze im laufenden Quartal | **15** von 46 |

Die heutige Karte zeigt das laufende Quartal und meldet 18 Fälle. Betroffen sind
34. Für zwei Drittel der Belegschaft liegt die Spitze **nicht** im Quartal, das
die Karte zeigt.

Und weiter: nur 12 Personen sind durchgehend überlastet. Für die übrigen 22 ist
die Überlast **episodisch** — ein Verschiebe-, kein Einstellungsproblem. Das ist
eine völlig andere Managementkonsequenz, und die heutige Karte kann sie nicht
zeigen.

### 4.4 Der Beweis: Q4/2027

Verteilung der Auslastung in drei Quartalen, Anzahl Personen je Band:

| Quartal | < 60 % | 60–79 | 80–94 | 95–100 | 101–120 | > 120 % |
|---|---|---|---|---|---|---|
| Q3/2026 | 0 | 12 | 12 | 4 | 10 | 8 |
| Q1/2027 | 7 | 4 | 6 | 4 | 5 | **20** |
| Q4/2027 | **21** | 5 | 1 | 1 | 3 | **15** |

Das Portfolio steht in Q4/2027 bei **82 %** — rechnerisch entspannt. Tatsächlich
sitzen dort **21 Personen unter 60 %** und gleichzeitig **15 über 120 %**. Die
Kapazität ist da, sie liegt nur auf den falschen Leuten.

Kein Portfolio-Aggregat kann das zeigen. Es ist genau die Art von Befund, für die
sich der eigene Reiter lohnt.

---

## 5 · Reiter «Personen» — Inhalt

### 5.1 Auslastungsverteilung ★★★

Histogramm über die sechs Bänder oben, für das im Kopf gewählte Quartal, mit
Referenz bei 100 %. Farbe folgt der bestehenden `loadStatus`-Rampe, damit ein
Band dieselbe Bedeutung trägt wie eine Zelle im Pensum-Raster.

Beantwortet in einem Bild: ist die Last gleichmässig verteilt, oder gibt es zwei
Lager? Daten vorhanden.

### 5.2 Personen × Quartal als Raster ★★★

Die tragende Ansicht des Reiters, und sie skaliert auf 100+ Zeilen, weil sie
**dasselbe Bauteil ist wie die Übersicht** — nur mit Personen statt Projekten
als Zeilen:

* Zeilen: Personen · Spalten: die gewählten Perioden
* Zelle: Auslastung in % gegen die eigene Anstellung, in der Heat-Rampe
* eingefrorene Kopfspalten: Name, Anstellung, Rolle, Anzahl Projekte
* Zeitachse scrollt, Perioden-Stepper und Jahr/Quartal/Monat gelten
* sortierbar nach Spitzenlast, laufender Last, freier Kapazität, Name
* gruppierbar nach Rolle oder Teilportfolio

Das ist der grösste Umsetzungshebel im ganzen Vorschlag: Raster, Einfrieren,
Sortierung, Gruppierung, Zeitachse, Export und Druck existieren bereits. Und
das Bedienvokabular ist gelernt — wer die Übersicht kennt, kann diese Ansicht
sofort bedienen.

Eine Ergänzung gegenüber der Übersicht: **eine Sparkline oder Min/Max-Spalte je
Person**, damit die Spitze sichtbar ist, ohne zu scrollen — das ist die Antwort
auf 4.3.

### 5.3 Die Ränder ★★

Zwei kurze Listen unter dem Raster: die fünf am stärksten Überlasteten (Pensum,
Anstellung, Anzahl Projekte, ab wann es abfällt) und die fünf mit der meisten
freien Kapazität (freies Pensum, ab welchem Quartal). Jede Zeile führt in die
gefilterte Übersicht.

Das ist die Umbuchungsliste. Sie ist streng genommen nur das Raster nach zwei
Sortierungen — aber nebeneinander gestellt ist sie eine Arbeitsanweisung, und
das rechtfertigt die Wiederholung.

### 5.4 Kapazität nach Rolle ★★

Bedarf gegen Kapazität je Rolle. Eine freie Bauleitung löst keinen Engpass in
der Projektleitung; die Gesamtzahl verdeckt das.

> **Datenlage:** die Mock-Belegschaft ist 43 × Projektleitung, 2 ×
> Projektentwicklung, 1 × Bauleitung. Das ist kein realistischer Rollenmix und
> müsste vor dieser Karte korrigiert werden.

### 5.5 Abwesenheiten ★

Heute stehen Abwesenheiten nur als Portfoliozahl in `capacity.json`
(460 / 225 / 190 / 230 …). Personenbezogen erfasst würden sie erklären, **warum**
ein Quartal eng ist, statt nur **dass** es eng ist. Fehlende Daten.

### 5.6 Was der Filter hier bedeutet

Eine Feinheit, die vor der Umsetzung entschieden sein muss: die Toolbar filtert
**Projekte**. Steht der Filter auf Teilportfolio = Zoll — welche Personen zeigt
der Reiter dann, und mit welcher Last?

Empfehlung: nur Personen mit Arbeit im gesetzten Umfang, aber **zwei Zahlen je
Person** — Last im Umfang und Gesamtlast. Wer wissen will, ob jemand 40 % Zoll
übernehmen kann, muss sehen, dass diese Person insgesamt schon bei 130 % steht.

---

## 6 · Reiter «Kapazität»

### 6.1 Bedarf nach Bindungsgrad ★★★

Die Ankergrafik im Kopf zeigt die Auslastung als eine Zahl je Quartal. Hier steht
dieselbe Zeitreihe aufgeschlüsselt — gestapelte Säulen gegen die Linie
*Kapazität netto*:

```
▓▓ gebunden, nach Baukredit-Freigabe   nicht verschiebbar
▒▒ vor Baukredit-Freigabe              verschiebbar
░░ extern beauftragt                   zugekauft
── Kapazität netto                     Referenzlinie
```

Aus `totals()` vollständig rechenbar. Q1/2027: 4 830 % Bedarf, davon **2 445 %
vor Baukredit-Freigabe** — die Hälfte der Überlast steckt in Projekten, die noch
gar nicht freigegeben sind. Das ist eine Handlungsoption, und heute ist sie
unsichtbar.

### 6.2 Freie Kapazität je Quartal ★★

`net − booked`, als Säulenreihe mit Nulllinie, negativ nach unten. Die Zahl, mit
der man Zusagen macht. Bei uns negativ bis Q3/2027, danach positiv.

### 6.3 Auslastung nach Teilportfolio ★★

Die bestehende Karte, unverändert übernommen — sie beantwortet, wo der Bedarf
liegt. Verwaltung 990 %, Zoll 685 %, Kultur 595 %, Sport 532 %.

### 6.4 Kapazitätslücke nach Teilportfolio ★★

Die Ergänzung dazu: Bedarf minus zugeordnete Kapazität je Bereich. Beantwortet
nicht *wo der Bedarf ist*, sondern *wo er nicht gedeckt ist* — und damit,
zwischen welchen Bereichen umgeschichtet werden kann.

---

## 7 · Reiter «Pipeline»

### 7.1 Phasenfluss über die Zeit ★★★

Gestapelte Flächen: Anzahl Projekte je SIA-Hauptphase über die acht Quartale.
Aus den `bars` jedes Projekts direkt ableitbar — die Phasenkette liegt vor.

```
Phase 5  32  38  46  45  42  34  33  31
Phase 4  14   9   7   3   8  10  12  11
Phase 3  25  31  32  33  30  26  18  12
Phase 2  17  11  11   7   4   2   1   1
```

Die aussagekräftigste Grafik, die aus diesen Daten zu bauen ist. Man sieht die
Welle: Phase 5 wächst von 32 auf 46 Projekte bis Q1/2027 — genau die Quartale,
in denen die Auslastung über 100 % liegt. Und man sieht, dass Phase 2 von 17 auf
1 fällt: **es rückt nichts nach.** Eine Bereichsleitung plant Einstellungen und
Akquisition genau daran.

### 7.2 Anzahl Projekte nach SIA-Phase ★★

Die bestehende Karte, unverändert — die Momentaufnahme zum Fluss aus 7.1.
Heute: P1 4, P2 23, P3 31, P4 13, P5 39, P6 1.

### 7.3 Matrix Teilportfolio × Phase ★★

Sieben Bereiche gegen sechs Hauptphasen, Zellwert Anzahl oder Pensum, als
Heatmap in der Pensum-Rampe. 42 Zellen auf kleinem Raum. Beantwortet: hat ein
Bereich einen Klumpen in einer Phase — etwa alle Zollanlagen gleichzeitig in
Ausschreibung.

### 7.4 Bedarf nach Priorität ★★

Gestapelte Säulen je Quartal nach `hoch / mittel / tief`. Die unbequeme Frage:
verbrauchen wir in den Überlastquartalen Kapazität für Projekte tiefer
Priorität? In Q1/2027 sind es **1 060 % von 4 830 %** — rund ein Fünftel. Das ist
die erste Verschiebung, die man prüft.

---

## 8 · Reiter «Termine»

Neu. Die Daten sind vollständig vorhanden (`plan`, `forecast`, `status` je Gate).

### 8.1 Termintreue je Quartal ★★★

Gestapelte Säulen: fällige Gates je Quartal nach *im Termin / verschoben / ohne
Termin*.

```
im Termin    7   7   8  11   9   5   6   2
verschoben   4   3   7   1   5   1   2   1
ohne Termin  0   4   0   1   0   1   1   0
```

64 % Termintreue über 86 Gates. Für ein Portfolio dieser Grösse ist das schlecht
und muss sichtbar sein.

### 8.2 Verzug nach Sub-Phase ★★★

Wo im Ablauf entsteht der Verzug? Aus den Daten:

| Sub-Phase | Gates verspätet | ⌀ Verzug |
|---|---|---|
| 53 Inbetriebnahme | 10 | 1,2 Quartale |
| 41 Ausschreibung | 6 | 1,3 Quartale |
| 31 Vorprojekt | 4 | 1,5 Quartale |
| 33 Bewilligungsverfahren | 2 | 1,5 Quartale |

Die Häufung liegt am Ende der Kette und in der Ausschreibung — beides Schritte
mit Abhängigkeit von Dritten. Wenn sich das bestätigt, ist die Massnahme
Vorlaufzeit, nicht mehr Personal. Diese Unterscheidung ist bares Geld wert.

### 8.3 Gate-Last je Quartal ★★

Anzahl fälliger Gates je Quartal als schlichte Säulenreihe. Genehmigungsgremien
haben begrenzten Durchsatz; eine Häufung von Baukredit-Gates in einem Quartal
ist ein eigenes Risiko, unabhängig von der Personalkapazität. Billig zu bauen,
in der Praxis überraschend wirksam.

### 8.4 Verzugsverteilung ★

Histogramm: Gates um 0 / 1 / 2+ Quartale verschoben. Trennt «überall ein
bisschen» von «wenige, dafür massiv» — zwei Probleme mit zwei Massnahmen.

---

## 9 · Reiter «Mittel»

### 9.1 Kredit nach Jahr ★★★

Die bestehende Karte, erweitert um die eigentliche Steuerungsfrage: gebundene
Mittel **gegen die Jahrestranche**. Über- und Unterschreitung als abweichende
Säule gegen eine Referenzlinie.

Heute: 2026 289,9 · 2027 298,0 · 2028 163,7 · 2029 ff. 220,2 Mio.

> **Fehlende Daten:** die Jahrestranche. Ein Feld `budgetByYear` in
> `data/meta.json` genügt. Ohne sie bleibt die Karte eine Bestandszahl.

### 9.2 Kredit nach SIA-Phase ★★

Die bestehende Karte, unverändert — wie viel des Portfolios steckt schon in der
Realisierung. P5 469 Mio., P3 260 Mio., P4 145 Mio., P2 92 Mio.

### 9.3 Anteil vor Baukredit-Freigabe ★★

**351 von 972 Mio. — 36 % der gebundenen Mittel sind noch nicht freigegeben.**
Als zwei Segmente je Jahr: freigegeben / vor Freigabe. Das Gegenstück zu 6.1 auf
der Geldseite, und `preCredit` liegt vor.

### 9.4 Kredit nach Teilportfolio ★

Über die sieben Bereiche, neben die Bedarfsverteilung aus 6.3 gelegt. Zeigt, wo
viel Geld auf wenig Personal trifft: Zoll trägt 144 Mio. bei 685 % Bedarf,
Kultur 79 Mio. bei 595 %.

---

## 10 · Was fehlt, um das Beste davon zu bauen

| Fehlt | Ermöglicht |
|---|---|
| **Pensum je Person und Quartal** statt nur je Projekt | Der ganze Reiter *Personen* auf belastbarer Grundlage. Heute trägt die Projektleitung rechnerisch das ganze Projektpensum, und man sieht zwar *dass* jemand überlastet ist, aber nicht *welches Projekt* man kürzen müsste |
| **Realistischer Rollenmix** | Abschnitt 5.4 — heute 43 von 46 Projektleitung |
| **Abwesenheiten je Person** | Abschnitt 5.5 |
| **Jahrestranchen** (`budgetByYear`) | Abschnitt 9.1 |
| **Ist-Kosten** je Projekt | Kostenabweichung, die zweite Hälfte der Finanzsicht |
| **Planstände über die Zeit** (Snapshots) | Prognosegüte: wie oft verschiebt sich ein Gate, bevor es hält |
| **Kalender der Genehmigungsgremien** | Gate-Last gegen tatsächlichen Durchsatz — Abschnitt 8.3 |

Die API-Referenz beschreibt unter `allocations` bereits die Form des ersten und
wichtigsten dieser Felder.

---

## 11 · Gestaltungsregeln

Damit die Erweiterung nicht rückgängig macht, was die Design-Review erreicht hat:

* **Farbe bleibt verdient.** Blau kodiert Grösse, Rot/Gelb/Grün nur den Status
  gegen 100 %. Eine Kategorie bekommt keine eigene Farbe, nur weil sie eine
  Kategorie ist — gestapelte Segmente unterscheiden sich über Helligkeit
  derselben Rampe und über Schraffur, damit sie in Schwarzweiss lesbar bleiben.
* **Keine Torten, keine Tachometer.** Anteile werden gestapelt oder als Balken
  gezeigt; ein Tacho zeigt eine Zahl auf der Fläche von zwölf.
* **Jede Karte nennt ihre Bezugsgrösse.** «112 %» ohne «gegen Kapazität netto»
  ist keine Aussage.
* **Jede Karte führt weiter.** Ein Klick filtert die Übersicht auf das, was die
  Karte zeigt — das gilt heute schon und muss so bleiben.
* **Vier bis fünf Karten je Reiter.** Mehr ist wieder der heutige Zustand, nur
  in fünf Stapeln.
* **Filter gelten reiterübergreifend** und stehen über dem Kopf, nicht in den
  Reitern.

---

## 12 · Empfohlene Reihenfolge

Nach Wirkung je Aufwand:

1. **Reiter «Personen» mit Raster und Verteilung** (5.1, 5.2) — beantwortet die
   häufigste Anfrage, repariert die Karte, die bei 46 Personen nicht mehr trägt,
   und nutzt ein Bauteil, das bereits existiert. Daten vorhanden.
2. **8.1 Termintreue je Quartal** — schliesst die grösste inhaltliche Lücke.
   Daten vorhanden.
3. **6.1 Bedarf nach Bindungsgrad** — macht aus der zentralen Karte eine
   Handlungsoption statt einer Feststellung. Daten vorhanden.
4. **7.1 Phasenfluss über die Zeit** — die stärkste Einzelgrafik im Vorschlag.
   Daten vorhanden.
5. **Kopf und Reitergliederung** — die Ankergrafik nach oben, die fünf
   Abschnitte darunter. Sinnvoll, sobald 1–4 stehen; vorher gliedert sie zu
   wenig Inhalt.
6. **8.2 Verzug nach Sub-Phase**, **7.4 Bedarf nach Priorität** — beide billig,
   beide unbequem, beide nützlich.
7. **9.1 Mittelabfluss gegen Tranche** — sobald die Jahrestranchen erfasst sind.
