# Skript-Notizen überarbeiten

Stand: 2026-10-15. Schritt 1–6 umgesetzt, Ziehen ergänzt; ab Schritt 3 lokal entwickeln (siehe unten).

## Ausgangslage

- Färbung ließ sich nicht entfernen: Markierungen des ganzen Absatzes waren nicht antippbar,
  Antippen bot nur neue Farben an. Teil-Markierungen: Antippen → Blatt → Löschen → Rückfrage.
- Notiz anlegen dauerte zu lange: viele Schritte und nach jeder Aktion `router.refresh()` – der
  Server lud das ganze Skript neu, React zeichnete den ganzen Leser neu.
- Freihand liegt frei über dem Text (x relativ zur Breite, y in em). Bei anderer Schriftgröße,
  Breite oder Fassung fließt der Text um, der Strich bleibt – grundsätzlich nicht lösbar.
- Auf dem Handy öffnet Gedrückthalten die System-Textauswahl („In Google suchen“).

## Grundsatz

**Notizen hängen an Textstellen, nicht an Positionen.** Die App zeichnet sie selbst, also fließen
sie mit dem Text und wandern in neue Fassungen mit. Alles geht mit einfachem Antippen; Gesten sind
nur Abkürzungen.

| Papier                      | Im Leser                                                                     | Anker            |
| --------------------------- | ---------------------------------------------------------------------------- | ---------------- |
| Pause `/` `//`, Atmer `'`   | Zeichen zwischen Wörtern                                                     | Zeichenposition  |
| Betonung (unterstrichen)    | Unterstreichung einfach/doppelt                                              | Bereich          |
| Bogen, Tempo, lauter/leiser | Bogen bzw. Symbol über dem Bereich                                           | Bereich          |
| Stimmung (leise, wütend …)  | klein kursiv am Satz, eigene Begriffe, zuletzt benutzte vorne                | Bereich          |
| Markieren                   | Farbe                                                                        | Bereich / Absatz |
| Randnotiz                   | Text im Rand (Tablet) bzw. unter dem Satz (Handy), wie Technik-Hinweise      | Absatz / Satz    |
| Skizze, Gang, Pfeil         | **Notizzettel**: feste Zeichenfläche (4:3), Symbol im Text, Vorschau im Rand | Stelle           |

## Schritte

1. [x] **Entfernen + Schnelligkeit** – Notizen im Client-Speicher (`[fassung]/use-annotations.ts`),
       sofort sichtbar, Speichern im Hintergrund, kein `router.refresh()`; Aktion liefert die neue Notiz
       (`createReaderAnnotation`). Antippen einer Markierung (auch ganzer Absatz) → Leiste mit Farben,
       Notiz, Entfernen. Löschen ohne Rückfrage, „Rückgängig“ im Hinweis.
2. [x] **Notizmodus** – Knopf „Notieren“ (Marker) in der Kopfleiste. Systemauswahl aus
       (`select-none`, `-webkit-touch-callout: none`, kein Kontextmenü). Wörter als `data-w`-Spans,
       Antippen wählt das Wort, zweites Wort erweitert, ◀ ▶ ein Wort weniger/mehr, „Satz“, Rollenname
       antippen = ganzer Absatz. Farbe antippen = markieren, gleiche Farbe nochmal = entfernen.
       Leiste bleibt offen, Rückgängig-Knopf. Logik: `src/lib/skript/note-logic.ts`.
       Zusätzlich Ziehen (2026-10-15): Maus/Stift ziehen direkt über Wörter, am Handy Anfasser an
       beiden Enden der Auswahl (`selection-handles.tsx`, `touch-action: none`); Halten+Ziehen per
       Finger nur als Bonus (`use-word-drag.ts`) – Chrome bricht die Berührung nach dem Halten oft
       mit `pointercancel` ab.
3. [x] **Zeichen im Text** – Pause, Atmer, Betonung, Bogen, Tempo, Stimmung als neue Arten
       (`ScriptAnnotation.kind`), Knöpfe mit Symbol + Wort, „?“-Zeichenerklärung.
       Umgesetzt 2026-10-15: `kind = sign` + Spalte `sign` (Migration 20261015090000),
       `SCRIPT_SIGNS` in `annotation-types.ts`, Werkzeugleiste `note-toolbox.tsx`. Stellen-Zeichen
       (Pause, Lang, Atmer, Zäsur) antippen = hinter das gewählte Wort, oder aus der Leiste in den
       Text ziehen (Vorschau über dem Finger, Einfügemarke). Bereichs-Zeichen auf die Auswahl:
       Betonung (nochmal = stark, nochmal = weg), Bogen, lauter/leiser/schneller/langsamer
       (deutsche Wörter statt cresc./accel.), Stimmung mit Vorschlägen + eigenen Begriffen.
       Stellen-Zeichen merken sich den Text davor (`pointContext`) und wandern so in neue Fassungen.
4. [x] **Randnotiz** – Textfeld direkt unter dem Satz statt Bottom-Sheet (Diktieren über die
       Tastatur), Darstellung wie Technik-Hinweise (`CUE_MARGIN_*`).
       Umgesetzt 2026-10-15: `InlineNoteEditor` (annotations.tsx) direkt unter dem Absatz – Enter
       speichert, Umschalt+Enter neue Zeile, Esc bricht ab, leeres Feld beim Ändern = löschen.
       Leiste unten ist währenddessen ausgeblendet (sonst über der Tastatur). Anzeige: Handy/Tablet
       als Randnotiz unter dem Absatz, ab xl in der Randspalte. Bottom-Sheet nur noch für
       Markierungen/Stimmungen. Im Notizmodus wählt Antippen im Text immer das Wort, Notizen
       öffnet man über ihre Karte. Gemessen (Produktions-Build lokal): Notiz sichtbar nach ~155 ms.
5. [x] **Bessere Anker** – Wortlaut + etwas Text davor/danach speichern (W3C TextQuoteSelector),
       Übernahme über `diff.ts`: wandert still mit, solange die markierten Wörter da sind; Rückfrage
       nur, wenn sie selbst geändert oder gestrichen wurden.
       Umgesetzt 2026-10-15: Spalten `prefix`/`suffix` (Migration 20261015120000), `locateRange` in
       `note-logic.ts` (Vorkommen mit passendstem Umfeld, auch in anderem Teil), Stellen-Zeichen
       zusätzlich über den Text danach. Absatz-Notizen fragen erst unter 85 % Wort-Ähnlichkeit
       nach (`similarity` aus `diff.ts`); Diff-Abbildung der Positionen war nicht nötig.
6. [x] **Notizzettel** – Freihand nur noch auf eigener Fläche, an einer Stelle verankert;
       bisherige Freihand-Striche werden zu Zetteln am jeweiligen Absatz.
       Umgesetzt 2026-10-15: `kind = ink` mit `{ canvas: true, strokes }` (Koordinaten als Anteil
       der Zettelbreite, 4:3), Anker wie Stellen-Zeichen. Alte Zeichnungen rechnet `readSketch`
       beim Lesen um (mittig, maßstabsgetreu, ohne Datenmigration). `sketch.tsx`: Vollbild-Editor
       (kein Bottom-Sheet – Wischen würde es schließen), Stift mit Druck/Neigung, Finger bis ein
       Stift erkannt ist, Radierer über Abstand zur Linie, Titel; Symbol ✎ im Text, Vorschau unter
       dem Absatz bzw. im Rand. Stiftmodus über dem Text (`ink.tsx`) entfernt.
       Falle: Geschwister-Komponenten mit gleichem `key` („neu“) – React entfernte den Editor nicht.
7. [ ] **Offline + Probe** – Warteschlange ohne Netz, Einstieg aus dem Probenablauf direkt in die
       Szene mit eingeschaltetem Notizmodus.

## Offene Punkte

- Zeichenliste mit dem Ensemble abstimmen (Tempo/Lautstärke-Zeichen?).
- Gerätetest Android/iPhone: kein Systemmenü im Notizmodus, Tippziele groß genug.

## Lokale Entwicklung

Schneller als über Staging: Datenbank `skript_dev` im Container `mb-test-pg` (nur 127.0.0.1),
Demo-Seed plus Skript aus Staging (Tabellen `Script*` per `pg_dump --data-only`, `showId` auf
`demo-show-sommernachtstraum`). Die Demo-Stammdaten ordnen `PRIVATE.PRODUCTION.SCRIPT.*` keiner
Rolle zu – lokal nachtragen (READ → `member`, MANAGE → Rollen mit Produktions-Verwaltung).
Start: `DEMO_MODE=true NEXTAUTH_URL=http://localhost:3200 next dev -p 3200 -H localhost`,
Anmeldung über den Rollen-Knopf „Regie“ (erst nach dem Laden klicken, sonst `MissingCSRF`).
