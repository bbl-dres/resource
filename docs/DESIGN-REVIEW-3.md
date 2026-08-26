# Design-Review 3 — Politur

**Rolle:** Senior Design & UX · **Datum:** 26.08.2026
**Umfang:** 2 526 Zeilen CSS und 5 048 Zeilen JavaScript, im Browser gemessen
**Auftrag:** Pixelgenauigkeit, Klarheit, Konsistenz, Kontrast, Abstände,
hartcodierte Werte, Typografie, Icons. Keine Funktion hinzufügen oder entfernen.

Fünf Prüfagenten haben je einen Aspekt abgeklopft — Typografie, Abstände, Farbe,
Icons und Bedienelemente, Dopplungen. Jeder Befund unten ist nachgemessen, bevor
er umgesetzt wurde; drei Meldungen der Agenten haben die Prüfung **nicht**
überstanden und stehen am Schluss.

Vorweg: Die Oberfläche war in gutem Zustand. Der Ertrag dieser Runde liegt nicht
in Schönheitskorrekturen, sondern in **sieben Regeln, die gar nicht mehr feuerten**,
**einem WCAG-Verstoss an jedem Bedienelement** und **zwei Listen, die dasselbe
System unter zwei Namen waren.**

---

## 1 · Der schwerste Fund: Bedienelemente ohne ausreichenden Rand

WCAG 2.1, Kriterium 1.4.11, verlangt für die Umrandung eines Bedienelements
3:1 gegen den Untergrund. Gemessen wurde:

| Element | Untergrund | Kontrast |
|---|---|---|
| `button.btn` | `rgb(238,241,246)` | **2.11 : 1** |
| `button.xsearch` | `rgb(238,241,246)` | **2.11 : 1** |
| `div.segmented` | `rgb(238,241,246)` | **2.11 : 1** |
| `.btn--toggle`, `.btn--square`, `.btn--danger-toggle` | `rgb(238,241,246)` | **2.11 : 1** |

Das Token trug seine eigene Messung im Kommentar — `2.30:1` — gegen Weiss. Die
Knöpfe stehen aber nicht auf Weiss, sondern auf dem Seitengrund, und dort ist es
noch schlechter.

Die Reparatur trennt zwei Aufgaben, die ein Token gemeinsam erledigt hatte:

```css
--line-rule:   #a4a8b0;   /* Strukturlinien — Tabellenkopf, Summen, Druckbogen */
--line-strong: #83878f;   /* 3.18:1 auf dem Seitengrund — Umrandung von Bedienelementen */
```

`#83878f` ist die **hellste** Stufe, die auf beiden Untergründen 3:1 schafft
(3.18 auf dem Seitengrund, 3.60 auf Weiss) — nicht dunkler als nötig. Von den
24 Fundstellen sind 12 Bedienelemente (werden dunkler) und 12 Strukturlinien
(bleiben pixelgenau, wie sie waren). Die Tabellenlinien haben sich damit **nicht**
verändert — nachgemessen: `rgb(164,168,176)` vorher wie nachher.

### Ein zweiter Kontrastfehler, den die Prüfung bisher nicht sah

`.minigrid__q span` im Pensum-Dialog stand auf `--color-text-subtle` — **2.54:1**.
Das ist echter Fliesstext, nicht ein deaktivierter Eintrag. Jetzt
`--color-text-muted`, 5.36:1.

Warum die automatische Prüfung ihn übersah: `audit.js` öffnet keine Dialoge.
Dieselbe Lücke betrifft Filterchips und das aufgeklappte Suchfeld — notiert.

---

## 2 · Regeln, die nicht mehr feuerten

Der Druckzustand war an **sieben von zehn** Selektoren tot:

```css
/* vorher — gleiche Spezifität wie jedes spätere :hover, also verloren */
.btn:active, .iconbtn:active, .dd__item:active, … { background: … }

/* nachher — das zusätzliche :is() trägt eine Klasse mehr */
:is(.btn, .iconbtn, .dd__item, …):active:active { background: … }
```

Nachgemessen mit erzwungenem Pseudozustand:

| Selektor | Ruhe | Hover | Druck |
|---|---|---|---|
| `.btn` | transparent | `rgb(255,255,255)` | `rgb(243,244,246)` |
| `.tabs__tab` | transparent | `rgb(240,244,250)` | `rgb(243,244,246)` |
| `.segmented button` | transparent | `rgb(255,255,255)` | `rgb(243,244,246)` |
| `.pgrouphead__toggle` | transparent | `rgb(240,244,250)` | `rgb(243,244,246)` |

Bei einem vollständigen Neuaufbau des DOM pro Klick ist das die einzige
Rückmeldung, die der Nutzer im Moment des Drucks bekommt.

Ebenfalls tot und entfernt: ein zweiter `.empty`-Block, dessen Deklarationen alle
überschrieben wurden, ein zweiter `.mount`-Block mit widersprüchlichem Inhalt,
`.btn--icon`, `.linkbtn--danger`, `.capband__note`, `.pop__warn.is-over/.is-ok`,
`.narrow-note*` (Rest der früheren Schmal-Meldung) und acht Token, die nirgends
gelesen wurden.

---

## 3 · Pixelgenauigkeit

**Spaltenköpfe standen 4 px neben ihren Zahlen.** `.sorthead` hatte
`gap: var(--space-2)`, und ein Flex-Gap wird auch für ein leeres Kind berechnet —
das Richtungszeichen ist in jeder unsortierten Spalte im Markup, aber leer. Also
sass jeder rechtsbündige Kopf 4 px links seiner Zahlen.

```css
.sorthead { display: flex; align-items: center; }        /* kein Gap */
.sorthead__dir:not(:empty) { margin-left: var(--space-2); }
```

Nachgemessen an den Textkanten, nicht an den Kästen: `[0, 0, 0, 0, 0]`.

**Weitere Messungen:**

| Was | Vorher | Nachher |
|---|---|---|
| Höhen im Zeitregler | 32 / 34 / 34 | 34 / 34 / 34 |
| Gruppenabstand Übersicht ↔ Termine | 28 ↔ 32 | 32 ↔ 32 |
| `.chip__x`, `.xsearch__close` | unter `--target-min` | 24 × 24 |
| Kartenpolster `.entry` gegen `.card`/`.kpi`/`.bi-card` | 24 gegen 20 | 20 überall |
| `.more-link` gegen die Textkante seiner Karte | 8 px daneben | 0 |

Der `.more-link` behält sein Polster als Trefferfläche und holt den Text mit
`margin-left: calc(var(--space-4) * -1)` auf die Kante zurück.

---

## 4 · Typografie

**Laufweite folgt der Grösse, nicht dem Bauteil.** Elf Überschriften teilten sich
eine Zeilenhöhe, aber nur drei trugen eine Laufweitenkorrektur — und ausgerechnet
`.kpi__value` (22 px) stand neben `.modal__title` (22 px, gleiches Gewicht) ohne.

```css
.page-title { letter-spacing: var(--tracking-h2); }        /* 24px */
.modal__title, .kpi__value { letter-spacing: var(--tracking-h3); }  /* 22px */
```

Unter etwa 20 px liegt die Korrektur unter einem Fünftel Pixel je Zeichen und
kostet nur Konsistenz — `.changes__title` (16 px) hat sie deshalb abgegeben.

**Rohe Werte in Token überführt:**

- `letter-spacing: 0.02em` an der Heute-Marke → `--tracking-caption`, mit
  Begründung: 10-px-Text braucht Luft, sonst verschmiert er.
- `line-height: 1.6` am Druckbogen → `--leading-relaxed` (1.55).
- `--sheet-meta: 10.5px` ersatzlos gestrichen. Ein halber Pixel Unterschied zu
  `--sheet-text: 10px` ist auf Papier nicht wahrnehmbar; die Druckrampe ist jetzt
  10 / 11 / 16.

---

## 5 · Icons

Fünf Helfer wurden nie aufgerufen: `arrowUpRight`, `calendar`, `list`, `gantt`,
`users`. Mit ihren Sprite-Einträgen sind das **fünf Netzwerkanfragen weniger beim
Start** — das Sprite ging von 25 auf 20 Symbole. Die SVG-Dateien selbst bleiben
in `assets/icons` liegen; das Manifest ist der Schalter, und die Dateien sind in
diesem Stand noch nicht versioniert.

Die Strichstärkenleiter in `icon()` hatte zwei unerreichbare Sprossen:

```js
const sw = stroke ?? (size <= 12 ? 2.4 : size <= 16 ? 2 : 1.75);
```

Alle Grössen im Einsatz sind 13, 14 und 15 — also immer `2`, was das Sprite ohnehin
schon trägt. Das Inline-`style` war damit wirkungslos. Die Leiter ist weg, die
Übersteuerung `stroke` bleibt für den Fall, dass jemand weit ausserhalb dieser
Spanne zeichnet.

`icons.info(14)` war die einzige Stelle mit einer eigenen Grösse — jetzt der
Standard 15.

---

## 6 · Dopplung: zwei Listen, ein System

`.chg` (Startseite, letzte Änderungen) und `.log` (Verlauf) waren dieselbe Zeile,
zweimal geschrieben — und in drei Punkten auseinandergelaufen:

| | `.chg` | `.log` |
|---|---|---|
| Trennlinie | `--color-border` | `--color-border-subtle` |
| Langer Projektname | umbricht, Zeile wird höher | kürzt mit Auslassung |
| Link in der Zeile | 14 px in einer 13-px-Zeile | 13 px |

Jetzt ein Grundelement mit zwei Spaltensätzen:

```css
.log { display: grid; align-items: center; … }
.log--changes { grid-template-columns: … }   /* 5 Spalten, Startseite */
.log--history { grid-template-columns: … }   /* 6 Spalten, Verlauf    */
```

Die Projektzelle — Link, wenn der Eintrag ein Projekt nennt, sonst Text — stand
wörtlich zweimal da und ist jetzt `changeProject()` in `ui.js`.

Nachgemessen: beide Listen 48 px Zeilenhöhe, `rgb(227,233,243)` Trennlinie,
13-px-Link, beide kürzen.

---

## 7 · Zwei Befunde aus dem laufenden Betrieb

### «Nur Überlast» widersprach der Ampel

Gemeldet während der Runde, und der ernsteste inhaltliche Fund. Bei gesetztem
Filter blieben 84 Zeilen stehen — davon zeigten **29 eine grüne oder gelbe Ampel.**

Die Ursache: zwei Zeiträume für dieselbe Frage.

- Der Filter prüfte **alle acht Quartale** des Datensatzes.
- Die Ampel las **Quartal 0**, also den Stand von heute.

Ein Projekt, dessen Leitung erst in Q1/2027 über 100 % liegt, kam damit durch den
Filter und zeigte dazu ein grünes Licht.

Beide folgen jetzt dem **sichtbaren Zeitraum** — so wie es Summenzeile, Säulen und
Kennzahl in derselben Ansicht ohnehin schon tun. Die Ampel zeigt das schlechteste
Quartal im Fenster und nennt es im Tooltip:

> Vera Mustermann: 106 % der Anstellung in Q1/2027 — Überlast

Und der Filter ist jetzt eine reine Wiederholung der Ampel, kann also nicht noch
einmal auseinanderlaufen:

```js
if (state.overloadOnly && ampel(p.leadId, range).key !== 'over') return false;
```

Nachgemessen:

| Zeitskala | Fenster | Zeilen mit Filter | Ampelverteilung |
|---|---|---|---|
| Quartal | Q3/26 – Q2/28 | 84 | **84 rot** |
| Monat | Q3/26 – Q2/27 | 81 | **81 rot** |

Ohne Filter unterscheidet die Ampel weiterhin: 84 rot, 4 gelb, 20 grün, 3 ohne
Leitung. Auf dem Druckbogen gilt der dort gedruckte Quartalsblock, nicht das
Bildschirmfenster.

### SIA-Phasen waren abgekürzt

Drei von dreizehn Teilphasen standen gekürzt in den Daten:

| vorher | jetzt |
|---|---|
| `11 Strat. Planung` | `11 Strategische Planung` |
| `33 Bewilligungsverf.` | `33 Bewilligungsverfahren` |
| `51 Ausführungsproj.` | `51 Ausführungsprojekt` |

Dazu 13 tote `shortLabel`-Felder, die nirgends gelesen wurden, und 50 eingebettete
Balkenbeschriftungen in `projects.json`.

Die Spalte musste dafür Platz bekommen. Gemessen statt geschätzt:

- Bildschirm, 13 px: `33 Bewilligungsverfahren` braucht 144 px + 8 px Polster →
  `--grid-col-phase: 152px`. Nichts kürzt mehr auf Deutsch.
- Druckbogen, 11 px: 122 px nötig → `sheet.w: [124, 128]`. Blattzahlen unverändert
  (11 / 10 / 5 / 6), kein Überlauf über den Bogenrand.

Französisch und Italienisch kürzen weiter (`33 Procedura di autorizzazione` bräuchte
185 px) — das war vorher schon so und ist der Preis dafür, die Leitsprache nicht
auf Verdacht zu verbreitern.

---

## 7b · Nachtrag: die Zeitachse wird zentriert

Nach der Runde gemeldet: die Zeitachse der Übersicht war rechtsbündig, die des
Balkenplans zentriert.

Die Regel lautet jetzt in beiden Rastern und auf Papier gleich: **die Zeitachse
ist zentriert, die Stammdaten sind es nicht.** Eine Quartalsspalte ist ein Fach,
kein Zahlenblock — die Beschriftung benennt die ganze Spalte, und der Balkenplan
daneben hat seine Achse immer schon zentriert. Kredit CHF und Soll-Pensum bleiben
rechtsbündig, weil dort Ziffern gegeneinander stehen, die fluchten sollen.

Dafür brauchte es eine eigene Klasse: `pcell--num` trug bisher beides. Neu ist
`pcell--period` auf dem Bildschirm und `sheet__period` auf Papier, und nur die
tragen die Zentrierung.

Betroffen und nachgemessen (Abweichung des Textes von der Spaltenmitte, 0 oder
0,5 px Rundung): Spaltenkopf, Wertzelle, Summenzeile «Bedarf total», Band
«Auslastung total» — in der Übersicht, im Personenraster des Dashboards, im
Balkenplan und im Druckbogen. Blattzahlen des Berichts unverändert (11/10/5/6).

Der Befund aus Abschnitt 3 — der Kopf sass 4 px neben seinen Zahlen — bleibt
gültig: er betrifft jetzt die rechtsbündigen Stammdatenspalten.

---

## 8 · Was die Prüfung nicht überstanden hat

Drei Agentenmeldungen habe ich nachgemessen und **verworfen**:

1. **«`heat-null` und `heat-neg` sind tot.»** Sie werden dynamisch als
   `heat-${heatStep(v)}` gebaut. Nicht angefasst.
2. **«`cardWidth()` liegt unter 1024 px um 24 px falsch.»** `--shell-pad-x` ist
   28 px und hat keinen Breakpoint — der Wert war korrekt. Die Kopplung war
   trotzdem falsch (`--space-12` traf nur zufällig zu) und liest jetzt
   `--shell-pad-x`.
3. **«`--heat-3-bg` und `--heat-neg-bg` sind in Graustufen ununterscheidbar.»**
   Stimmt (225 gegen 226), aber es gibt keinen einzigen negativen Bedarfswert in
   den Daten, und Überlast trägt auf Papier zusätzlich das Zeichen ▲. Notiert,
   nicht geändert.

---

## 9 · Offen

- **`audit.js` sieht keine Dialoge, Chips oder das offene Suchfeld.** Genau dort
  sass der 2.54:1-Fehler. Die Prüfung sollte diese Zustände öffnen.
- **Die Methodenseite des Druckbogens ist unübersetzt.** Alle neun Glossarsätze
  laufen durch `t()`, keiner hat einen Eintrag — auf Französisch und Italienisch
  erscheint deutscher Text. Bestehende Lücke, ausserhalb dieser Runde.
- **`--text-lg` und `--leading-relaxed` werden je einmal benutzt.** Als Stufen
  einer benannten Rampe ist das in Ordnung; als Aufräumkandidaten nicht.

---

## Bilanz

| | |
|---|---|
| WCAG-Verstösse behoben | 1.4.11 an 6 Bedienelementtypen, 1.4.3 an 1 Textstelle |
| Regeln, die wieder feuern | 10 Druckzustände |
| Entfernt | 8 Token, 5 Icon-Helfer, 6 CSS-Blöcke, 1 unnötiger Datendurchlauf |
| Netzwerkanfragen beim Start | 5 weniger |
| Zusammengeführt | 2 Listensysteme, 1 Projektzelle, 3 stille Abweichungen |
| Prüfungen | `flow` 48, `audit`, `resp` 4 Breiten, `robust` 17 — alle grün |
