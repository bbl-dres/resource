# Design-Review — Rasterlinien in Übersicht und Termine

**Rolle:** Senior Design & UX · **Datum:** 26.08.2026
**Frage:** Sind die Linienstärken der beiden Raster konsistent? Und wo gehören
überhaupt Linien hin?

Nachgemessen wurde, was tatsächlich gezeichnet wird — jede Kante jedes Elements
in beiden Rastern, mit Seite, Stärke und Farbe. Nicht, was im Stylesheet steht.

---

## Was eine Rasterlinie leisten muss

Eine Linie in einer Tabelle hat genau eine Aufgabe: **verhindern, dass das Auge
beim Abtasten die Zeile oder Spalte verliert.** Alles darüber hinaus kostet
Kontrastbudget und konkurriert mit dem Inhalt.

Daraus folgt ein Prüfstein, den ich unten auf beide Raster anwende:

> Eine Linie ist berechtigt, wo der Lesende sonst **projizieren** müsste — also
> von der Kopfzeile in die Fläche hinunter raten. Wo der Wert in seiner eigenen
> Zelle steht, ist nichts zu projizieren.

---

## Bestandsaufnahme

### Befund 1 — Die Spaltengrenze im Pensumraster ist doppelt gezeichnet

```css
.pcell--val {
  border-left:  1px solid var(--color-border-subtle);
  border-right: 1px solid var(--color-border-subtle);
}
```

Rasterzellen liegen Kante an Kante. Der rechte Rand von Zelle *n* und der linke
von Zelle *n+1* liegen also nebeneinander: **die Spaltengrenze ist 2 px breit.**
Im Balkenplan zeichnet `.gantt__gridline` nur `border-left` — dort ist sie 1 px.

Gezählt in einer Ansicht mit 14 Zeilen und 12 Spalten:

| | Übersicht | Termine |
|---|---|---|
| Ränder je Spaltengrenze | **2** (links *und* rechts) | 1 (nur links) |
| effektive Strichstärke | **2 px** | 1 px |

Das ist kein Gestaltungsunterschied, das ist ein Fehler. Beide Raster stehen
nebeneinander in derselben Anwendung.

### Befund 2 — Die Jahresgrenze mischt zwei Farben

`is-yearstart` setzt `border-left` auf `--color-border` (#ced3dd), lässt aber den
`border-right` der Vorgängerzelle auf `--color-border-subtle` (#e3e9f3) stehen.
Die Jahresgrenze ist damit **1 px dunkel + 1 px hell** — eine unsaubere Kante
statt eines Strichs.

### Befund 3 — Die Kopfzeile erfindet Linien, die der Körper nicht hat

Die Stammdatenzellen im Körper (`ID`, `Projekt`, `SIA-Phase`, `Projektleitung`)
haben **keine** senkrechten Ränder. Die Regel

```css
.prow--head .pcell--num { border-left: …; border-right: …; }
```

trifft aber `pcell--num`, und das tragen ausser den Quartalen auch `Kredit CHF`
und `Soll-Pensum`. Ergebnis: die Kopfzeile hat Trenner um zwei Stammdatenspalten,
die im Körper darunter nicht weiterlaufen. Genau der Punkt aus dem Feedback —
und objektiv falsch: **eine Linie, die nach einer Zeile aufhört, behauptet eine
Struktur, die es nicht gibt.**

### Befund 4 — Die Trenner der Summenzeilen sind zu kurz

Gemessen, Zellhöhe gegen Zeilenhöhe:

| Zeile | Zeilenhöhe | Zellhöhe | fehlt |
|---|---|---|---|
| Datenzeile | 39 px | 38 px | 1 px (Zeilentrenner) |
| Kopfzeile | 39 px | 38 px | 1 px |
| **Gruppensumme** | 38 px | **20 px** | **19 px** |
| **Bedarf total** | 34 px | **20 px** | **15 px** |
| Auslastung | 42 px | 40 px | 2 px |

`.pcell--val` trägt `height: var(--row-height)`, die Summenzellen nicht — sie
schrumpfen auf ihre Zeilenbox. Die Zeile ist `align-items: center`, also sitzt
der Strich mittig mit Luft oben und unten. Deshalb wirken die Trenner dort wie
kurze Striche statt wie durchgehende Linien.

### Befund 5 — Drei Linienfarben, aber keine erklärte Ordnung

| Token | Wert | Kontrast | wo verwendet |
|---|---|---|---|
| `--line-subtle` | `#e3e9f3` | 1.18:1 | Spaltengrenze, Zeilentrenner |
| `--line` | `#ced3dd` | 1.45:1 | Jahresgrenze, Trennlinie über Summen |
| `--line-strong` | `#a4a8b0` | 2.30:1 | Unterkante der Kopfzeile |

Die Staffelung ist an sich richtig — die Frage ist nur, ob jede Verwendung sie
verdient. Die drei Stufen sollten drei Ränge bedeuten, nicht drei Gewohnheiten.

---

## Die Gestaltungsfrage: wo gehören Spaltenlinien hin?

Aus dem Feedback: *«ich mochte Trennlinien nur für Jahre, das war sehr klar.»*
Das habe ich gegen den Prüfstein oben getestet, in beiden Rastern.

### Übersicht — Spaltenlinien sind entbehrlich

Jeder Wert steht **in** seiner Spalte, rechtsbündig, in Tabellenziffern, unter
seiner eigenen Beschriftung. Es gibt nichts zu projizieren. Was die senkrechten
Haarlinien stattdessen tun: sie legen ein Gitter über die Heat-Fläche, und die
Heat-Fläche ist das eigentliche Signal dieser Tabelle.

Ohne sie passiert etwas Nützliches: gleiche Werte nebeneinander verschmelzen zu
einem Band. `60 60 70 70 70` liest sich dann als zwei Plateaus statt als fünf
Kästchen — das ist die Aussage, die man aus einem Pensumverlauf ziehen will.

Die Jahresgrenze bleibt als einzige senkrechte Linie und trägt damit wieder
Bedeutung, statt eine von zwölf gleich starken zu sein.

**→ Nur Jahresgrenzen.**

### Termine — Spaltenlinien sind tragend

Hier kippt das Argument. Ein Balken **überspannt** Spalten. Um zu lesen, dass er
im März endet, muss man von der Kopfzeile hinunterprojizieren — genau der Fall,
für den der Prüfstein die Linie vorsieht.

Im Test ohne Gitterlinien war nicht mehr erkennbar, in welchem Monat ein Balken
beginnt oder aufhört; sichtbar blieben nur die Phasengrenzen, und die sind eine
andere Information.

**→ Alle Spaltengrenzen, Jahresgrenze stärker.**

### Nachtrag — der Einwand hat sich in der Ansicht erledigt

Oben stand: die Dichte darf unterschiedlich sein, solange das Vokabular gleich
ist. Am fertigen Bild hat sich das nicht gehalten, und zwar aus zwei Gründen.

**Die Kopfzeile ist in beiden Rastern dasselbe:** eine Reihe Beschriftungen.
Mein Projektions-Argument gilt für die Fläche, nicht für den Kopf. Zwei
Kopfzeilen, die nebeneinander im selben Programm verschieden aussehen, sind eine
Abweichung ohne Grund. → beide nur Jahresgrenzen.

**Und in der Fläche hat sich mein Einwand als überschätzt erwiesen.** Ich hatte
argumentiert, ohne Gitterlinien sei nicht ablesbar, wo ein Balken endet. Am
gerenderten Plan stimmt das nicht: **ein Balken trägt seine eigene Kante**, und
diese Kante *ist* die Phasengrenze — genau die Information, die man sucht. Das
Gitter hat sie nicht getragen, sondern überlagert.

Also: beide Raster, Kopf wie Fläche, nur Jahresgrenzen. Was bleibt, sind die
Kanten der Balken selbst — die gehören zum Objekt, nicht zum Raster.

---

## Empfehlung

**Ein Vokabular, vier Ränge, in beiden Rastern gleich:**

| Rang | Stärke | Farbe | Übersicht | Termine |
|---|---|---|---|---|
| Zeilentrenner | 1 px | `--line-subtle` | ja | ja |
| Spaltengrenze | — | — | **nein** | **nein** |
| Jahresgrenze | 1 px | `--line` | ja | ja |
| Unterkante Kopfzeile | 1 px | `--line-strong` | ja | ja |
| Kante eines Balkens | 1 px | `--color-bar-border` | — | ja |

Die letzte Zeile ist keine Rasterlinie: sie gehört zum Balken, nicht zum Raster.
Genau deshalb kann das Gitter darunter entfallen.

Dazu vier Korrekturen, die keine Geschmacksfrage sind:

1. **Nur ein Rand je Grenze.** `border-left` trägt die Linie, `border-right`
   entfällt — wie im Balkenplan. Das behebt die 2 px und die gemischte Farbe der
   Jahresgrenze in einem Zug.
2. **Kein Trenner in der Stammdaten-Kopfzeile.** Linien nur dort, wo sie im
   Körper weiterlaufen: an der Zeitachse.
3. **Summenzellen auf volle Zeilenhöhe strecken**, damit ihre Trenner Linien
   sind und keine Striche.
4. **Die Jahresgrenze ist die einzige Stelle, die `--line` verdient.** Damit
   bedeutet die mittlere Stufe genau eine Sache.

---

## Umsetzung

Gemacht wie beschrieben. Nachgemessen, gleiche Ansicht wie oben:

| | vorher | nachher |
|---|---|---|
| Ränder je Spaltengrenze, Übersicht | 2 | **1** |
| Strichstärke Übersicht / Termine | 2 px / 1 px | **1 px / 1 px** |
| Farben an der Jahresgrenze | 2 | **1** |
| Trenner in der Stammdaten-Kopfzeile | 2 Spalten | **0** |
| Fehlende Höhe, Gruppensumme | 19 px | **2 px** (die beiden Zeilenränder) |
| Senkrechte Linien je Übersichtszeile, 12 Spalten | 13 | **2** (Jahresgrenzen) |

Im Balkenplan decken sich Kopfzeile und Gitterlinien jetzt exakt — gleiche
Positionen, gleiche Stärke, gleiche Farbe:

```
Kopf   1px 206,211,221 | 1px 206,211,221 | 1px 227,233,243 | 1px 227,233,243
Gitter 1px 206,211,221 | 1px 206,211,221 | 1px 227,233,243 | 1px 227,233,243
X gleich: true
```

Dabei ist ein Sonderfall wieder herausgeflogen, den ich zuerst eingebaut hatte:
`​.gantt__quarters > :first-child { border-left: 0 }`. Er hätte die erste
Kopfzelle ohne Rand gelassen, während die Gitterlinie darunter einen zeichnet —
also genau die Abweichung erzeugt, die dieses Review beheben soll.

Alle Prüfläufe grün: `flow.js`, `audit.js`, `resp.js`, `robust.js`.
