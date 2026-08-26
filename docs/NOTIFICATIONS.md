# Die Glocke — was sie zeigt und warum

**Datum:** 26.08.2026 · **Umfang:** `store.js → notifications()`, `ui.js → notifyBell()`

---

## Der Ausgangspunkt

Der Knopf im Kopfbereich zeigte eine „3" und einen fest hinterlegten Satz aus
`meta.json`:

> „3 Benachrichtigungen: MS4 verschoben · neue Überlast Sonja Beispiel ·
> offener Bedarf ab Q1/2027"

Gegen den erzeugten Datensatz gemessen stimmte davon **kein einziger Teil**:

| Behauptung | Datenlage |
|---|---|
| MS4 verschoben | Sonja führt 3 Projekte, alle 3 Meilensteine auf Termin |
| *neue* Überlast | sie liegt seit Q3/2026 bei 225 %, nichts daran ist neu |
| offener Bedarf ab Q1/2027 | die Lücke beginnt bei Q3/2026; Q1/2027 ist die Spitze |

Der Satz stammte aus dem Mockup und war gegen die seither generierten Daten
gelaufen. Ein Klick tat nichts.

---

## Der Zuschnitt: persönlich

Die naheliegende Antwort — „alles, was auffällig ist" — trägt nicht. Gemessen
über die ganze Abteilung:

- **59** Meilensteine nicht auf Termin
- **35** Personen über 100 %
- **3** Projekte ohne Leitung

Eine Glocke mit „94" ist eine Zahl, keine Nachricht. Was aus 94 drei macht, ist
die angemeldete Person. Für eine Projektleitung sind drei Fragen relevant:

1. **Bin ich selbst über meiner Anstellung?**
2. **Hat sich ein Gate auf einem meiner Projekte verschoben?**
3. **Hat jemand anders eines meiner Projekte verändert, während ich weg war?**

Für Sonja Beispiel ergibt das:

| Frage | Befund | Marke |
|---|---|---|
| eigene Auslastung | 225 % ab Q3/2026, Überlast in 7 Quartalen | ◆ Raute, rot |
| Gates auf eigenen Projekten | keines verschoben — Kategorie entfällt | ▲ Ring |
| fremde Änderungen an meinen Projekten | 2, beide von Lars Muster am 21.08.2026 | ○ Umriss |

**Die Badge-Zahl ist die Länge dieser Liste.** Sie steht nicht mehr neben den
Daten, sondern fällt aus ihnen — sie kann nicht noch einmal auseinanderlaufen.
Dass wieder eine 3 herauskommt, ist Zufall und ein guter Test.

Die zweite Meldung ist bemerkenswert: „Lars Muster · Begründung: Überlast
Q3/2026 freigegeben". Jemand hat Sonjas Überlast bewilligt, ohne dass sie es
mitbekommen hätte. Genau dafür ist eine Glocke da.

---

## Die Regel: jede Zeile führt irgendwohin

Eine Meldung, auf die man nicht handeln kann, ist Lärm. Jede Zeile ist ein
Knopf mit einem vorhandenen Ziel — es musste keine neue Aktion gebaut werden:

| Meldung | Aktion | Ergebnis |
|---|---|---|
| eigene Auslastung | `filter-lead` | Übersicht, gefiltert auf mich |
| Gate verschoben | `open-milestone` | der Meilenstein-Dialog |
| fremde Änderung | `open-project` | der Projekt-Dialog |
| Fusszeile | `tab` | Verlauf |

Alle drei schliessen das Menü bereits selbst.

---

## Kein Gelesen-Zustand

Bewusst keiner. Die Badge zeigt immer die aktuelle Lage; nichts wird gespeichert.
Ein Gelesen-Zustand wäre ein zweiter Wahrheitsträger neben den Daten — und die
Glocke stünde dann auf 0, während die Überlast weiterbesteht. Für einen Prototyp
ohne Backend ist der abgeleitete Zustand ausserdem der einzige, der einen
Neuladevorgang übersteht.

---

## Form statt Farbe

Die Marke links ist die vorhandene Ampel: Raute für Überlast, Ring für einen
verschobenen Termin, Umriss für eine fremde Änderung. Dieselbe Formensprache wie
in der Übersichtstabelle, aus demselben Grund — auf einer Fotokopie oder bei
Farbfehlsichtigkeit trägt die Form, nicht der Ton.

---

## Umsetzung

Das Panel benutzt die bestehenden Dropdown-Bausteine (`menuPanel`, `.dd__item`),
also auch deren Hover-, Fokus- und Druckzustände, das Schliessen mit Escape, den
Klick daneben und die Pfeiltasten. Neu ist nur der Zeileninhalt.

Zwei Stolpersteine beim Bauen, beide Spezifität:

- `.dd__item > span:first-child:not(.dd__tickbox)` setzt `flex: 1` — das streckte
  die Ampelraute zu einem Strich. `.notify__mark` steht jetzt mit in der
  Ausnahme, so wie `.dd__tickbox` schon aus demselben Grund darin stand.
- `.dd__item { align-items: center }` steht später in der Datei als `.notify` und
  gewann bei gleichem Gewicht. Die Regel heisst jetzt `.dd__item.notify`.

`meta.notifications` und `meta.notificationsTitle` sind aus `data/meta.json`
entfernt.

---

## Abgesichert

`flow.js` prüft, dass die Badge-Zahl der Zeilenzahl entspricht, dass keine Zeile
ins Leere führt, und dass die erste Zeile tatsächlich in der Übersicht landet.

Nachgemessen ausserdem: alle vier Sprachen, Tastaturbedienung (Enter öffnet,
Fokus springt in die erste Zeile, Escape schliesst und gibt den Fokus zurück),
und die Panelbreite bei 420 px Fenster — 348 px, kein Seitenüberlauf.

**Eine bestehende Lücke bleibt:** die Freitexte in `changes.json`
(„Bauleitung Etappe 2 vorgezogen") sind unübersetzt und erscheinen in allen
Sprachen deutsch. Das gilt genauso für den Verlauf-Tab und wäre eine eigene
Aufgabe über 249 Einträge.
