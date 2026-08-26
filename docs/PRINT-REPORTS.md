# Zwei Druckberichte statt einem

**Rolle:** Domain Expert · **Datum:** 26.08.2026
**Auftrag:** Was zeigt der Tab «Übersicht» eigentlich? Und: zwei PDF-Berichte —
einer für den Bedarf, einer für die Termine, nach derselben Logik.

---

## Zur Benennung des Tabs

Untersucht, nicht umgesetzt — auf Zuruf bleibt es bei «Übersicht».

Fachlich zeigt der Tab **geplantes Pensum je Projekt und Quartal**. Jede Zelle
ist ein Bedarf; die Auslastung ist die Ableitung daraus und steht in der
Fussleiste. Die Fussleiste heisst schon heute «Bedarf total», das Blatt trägt
den Untertitel «Pensum je Projekt und Quartal». Ein Name wie **Bedarf** hätte
also die Daten benannt, und das Paar wäre lesbar geworden: *Bedarf* (wie viel)
neben *Termine* (wann). «Übersicht» ist ein Behälterwort.

Dagegen steht ein handfestes Argument: **das Mockup schreibt «Übersicht»** — 19
Fundstellen, darunter der Blatttitel. Eine Umbenennung wäre eine Abweichung von
der Vorlage.

Entscheid: bleibt. Die beiden Berichte heissen dafür wie die Tabs, die sie
drucken — so entsteht kein drittes Vokabular.

---

## Die beiden Berichte

| | Übersicht | Termine |
|---|---|---|
| Zeile | Zahlenreihe je Quartal | Balken über dieselben Quartale |
| Untertitel | Pensum je Projekt und Quartal | Phasen und Meilensteine je Projekt |
| Gruppenabschluss | Summenzeile | keine — ein Balkenplan summiert nichts |
| Blattabschluss | Bedarf total, Kapazität, Auslastung | Auslastung |
| Legende | Pensumstufen, Ampel, Markierung | Balken, Meilenstein, Auslastung |

Geteilt wird alles andere: Briefkopf, Umfangzeile, Filterzeile, Gruppierung mit
sich wiederholender Kopfzeile, Seitenumbruch, Blattzählung und das
Methodenblatt am Schluss.

### Umsetzung

Der Rahmen blieb, wo er war; nur die Tabelle verzweigt:

```js
const REPORTS = [
  { id: 'demand',   label: 'Übersicht', sub: 'Pensum je Projekt und Quartal' },
  { id: 'schedule', label: 'Termine',   sub: 'Phasen und Meilensteine je Projekt' }
];
```

Die Zeilen des Balkenplans kommen **unverändert aus der Bildschirmansicht**
(`ganttRow`), damit gedruckter und angezeigter Plan nicht auseinanderlaufen
können; nur die Breite der Leitspalten und die Zeilenhöhe sind Papierwerte.
`quarterPeriods()` im Store liefert dafür die Spalten eines beliebigen
Quartalsblocks — die Blätter arbeiten in Blöcken, nicht im gescrollten Fenster.

Das Seitenbudget hängt am Format, nicht am Bericht — siehe unten.

---

## Ein Fund nebenbei: die Blattmasse griffen seit Wochen nicht

Beim Einmessen fiel auf, dass die Blätter gar keine A4-Geometrie mehr hatten:

```
demand/portrait   min-height: auto · padding: 0 · Breite 1298 px
```

Die Klassen im Stylesheet hiessen noch `.sheet--hoch` / `.sheet--quer`, die
Kennungen im Code seit der Vokabular-Umstellung aber `portrait` / `landscape`.
Die Regel traf also nichts. Das Blatt war so hoch, wie sein Inhalt es machte —
und deshalb konnte auch kein Überlauf auffallen.

Nach der Korrektur waren beide Budgets zu gross und mussten neu eingemessen
werden. Gemessen über 16 Kombinationen aus Bericht × Format × Gruppierung:

| | vorher | nachher |
|---|---|---|
| Blattmass hoch | 1298 × 1011 px, ungebunden | **800 × 1131 px** |
| Blattmass quer | 1298 × 719 px, ungebunden | **1100 × 778 px** |
| grösster Überlauf | 63 px (Zahlen), 1413 px (Balken) | **keiner** |
| engster Rest unter der Tabelle | — | 14 px in allen vier Kombinationen |

Die 14 px sind in allen vier Fällen gleich: die Budgets sitzen auf dem Papier
auf, ohne es zu überschreiten.

---

## Was sonst noch dazugehörte

**Das Exportmenü** sagte viermal «exportieren» — einmal auf dem Knopf, dreimal
darunter. Es nennt jetzt, was herauskommt, und in welcher Form:

```
Daten          CSV
               Excel
Drucklayout    Übersicht
               Termine
```

Die Gruppenüberschrift sagt bereits, worum es geht; eine Beschreibung je Zeile
daneben wäre eine dritte Ebene für vier Einträge.

**Die globale Suche im Seitenkopf ist entfallen.** Ein Suchfeld im Kopf
verspricht eine Ergebnisseite über alle Portfolios; die gibt es nicht, und das
Feld schrieb in dieselbe Abfrage wie das Feld in der Werkzeugleiste. Zwei
Eingänge, ein Ziel, eine irreführende Zusage. Geblieben ist das Feld dort, wo
die Auswahl auch wirkt. Damit fiel die Variantenlogik weg: `searchOpen` ist ein
Schalter statt zweier, und acht Regeln im Stylesheet sind verschwunden.

---

## Papierformat und Ausrichtung sind zwei Fragen

Der eine Regler «A4 hoch / A4 quer» mischte zwei Achsen: die ISO-Grösse und die
Drehung. Getrennt hat das nur Sinn, wenn es mehr als eine Grösse gibt — und A3
quer ist für einen Balkenplan an der Wand ein echtes Format, kein Vorrat.

Jetzt: ein Aufklappmenü für die Grösse, ein Schalter für die Drehung, beide
nebeneinander rechts im Blattbalken. Vier Kombinationen, jede mit eigenem
Seitenbudget:

| Format | Quartale je Blatt | Zeilen Übersicht / Termine |
|---|---|---|
| A4 hoch | 4 | 31 / 28 |
| A4 quer | 8 | 18 / 16 |
| A3 hoch | 8 | 46 / 42 |
| A3 quer | 12 | 31 / 28 |

A3 quer ist genau so hoch wie A4 hoch, also fasst es dieselbe Zeilenzahl — die
zusätzliche Breite geht in die Zeitachse. A2 und A0 wären eine Zeile Geometrie
und ein eingemessenes Budget mehr.

**Ein zweites Kostenmodell** kam dabei heraus: eine Gruppenüberschrift kostet auf
dem Balkenplan weniger als auf dem Zahlenblatt, weil ihre wiederholte Kopfzeile
niedriger ist. Mit `SCHEDULE_COST.group = 1.9` statt 2.9 fiel die tote Fläche auf
vollen Blättern deutlich:

| | vorher | nachher |
|---|---|---|
| Termine A4 hoch | 703 px | **391 px** |
| Termine A4 quer | 268 px | **126 px** |
| Termine A3 hoch | 579 px | **262 px** |

---

## Prüfung

- 16 Kombinationen aus Bericht × Format × Gruppierung: **kein Blattüberlauf**.
- Beide Berichte rendern fehlerfrei, ebenso alle acht Ansichten der Anwendung.
- `flow.js`, `audit.js`, `resp.js`, `robust.js` grün. Zwei Prüfungen im
  Testgerüst waren auf die alten Menü- und Suchnamen verdrahtet und wurden
  mitgezogen; die Suchprüfung testet jetzt zusätzlich, dass der Seitenkopf
  **kein** Suchfeld mehr trägt.
