# Plan: Termineditor kompakter, Ablauf mit Dauern, parallele Spuren, Probe vorschlagen

Stand: 2026-10-10 – Konzept, nichts umgesetzt

## Ziel

Der Termineditor (`/mitglieder/terminplanung/[eventId]`) soll kompakter und schneller bedienbar
werden. Der **Ablauf** wird zum Herzstück: Programmpunkte mit geplanter Dauer, einfach einfügen und
verschieben, parallele Aufgaben in Spuren. Beim Planen sieht man, wie oft Leute diese Woche schon
da sind und wie oft Szenen geprobt wurden, und kann sich eine Probe vorschlagen lassen, die mit
möglichst wenigen Leuten auskommt und Wartezeiten klein hält. Mobil wie am Desktop.

## Ist-Stand (Befunde 2026-10-10, Staging-Screenshots)

- Kopf als langes Formular: Titel, Art, Datum, Beginn, Ende, Ganztägig, Mehrtägig, Ort,
  Beschreibung, „Gehört zu“ – mobil zwei Bildschirmhöhen vor dem Ablauf.
- Ablauf steht unten, „Noch kein Ablauf“ + „Am … probbar“-Liste getrennt darunter.
- „Wer ist dabei?“ mobil ganz am Ende.
- Zeiten sind feste Start/Ende je Punkt (`SceneScheduleValue.times`, `EventBlockValue.start/end`);
  Szenen liegen im Editor getrennt von den übrigen Programmpunkten (`schedule.times` vs. `blocks`),
  in der DB aber gemeinsam als `EventBlock` (mit `order`).
- Schon berechnet, aber kaum sichtbar: Wochenbelastung (`week-load.ts`, ab 3 Terminen), je Szene
  „×geprobt · zuletzt · ×angesetzt“ (`describeSceneStats`), Probbarkeit (`scene-readiness.ts`),
  persönliche Zeitfenster (`computePersonalWindows`).
- Screenshots zeigen Datum/Zeit im US-Format (04/16/2027, 03:00 PM) – prüfen, ob nur headless-Locale.
- `@dnd-kit/sortable` ist bereits Abhängigkeit.

## Entscheidungen (User 2026-10-10)

1. **Dauer ist Standard.** Uhrzeiten werden der Reihe nach ab Terminbeginn berechnet; feste Uhrzeit
   („fest um 17:00“) ist die Ausnahme pro Punkt.
2. **Spätere Einladung aus der Reihenfolge**: persönliche Zeitfenster ergeben sich aus den eigenen
   Punkten – **außer** es gibt Punkte für alle (Aufwärmen, Auswertungsgespräch, Notizen …); die
   zählen für jeden Eingeladenen und ziehen das Fenster entsprechend auf.
3. **Probe vorschlagen = Liste zum Abhaken, die einen Zeitrahmen füllt** (Empfehlung angenommen?
   → bei Umsetzung bestätigen): Rahmen vorbelegt (Terminzeit minus feste/gemeinsame Punkte), beste
   Szenen vorangehakt, Balken „3:10 von 3:30 h“, live „Leute nötig“ und „längste Wartezeit“,
   „Übernehmen“ sortiert wartezeitarm in den Ablauf.

- Weiter gilt: **nur Hinweise/Vorschläge, keine stille Automatik** ([[planungshilfen-terminplanung]]),
  Rhythmus über Kerntage/Probenwochen (Fr–So = 1 Block), keine festen Tagesfristen.

## Zielbild

### Kopf (kompakt)

- Titel als großes, randloses Feld; darunter **eine Chip-Zeile**: `Probe · Fr 16.4. · 15:00–19:00 ·
Ort offen · In 80 Tagen …`. Tipp öffnet BottomSheet (mobil) bzw. Popover (Desktop) mit den
  Feldern; Ganztägig/Mehrtägig/Beschreibung leben dort.
- Ende optional „aus Ablauf“: ohne festes Ende = Ende des letzten Punkts.
- **Statuszeile**: „12 eingeladen · 2 fehlen · 3 ≥ 3× diese Woche“ – Tipp springt zu Teilnehmern.
- Reihenfolge mobil: Kopf → Ablauf → Wer ist dabei. Desktop: Ablauf links breit, Teilnehmer rechts
  (sticky).

### Ablauf als Zeitleiste

Zeile: `Griff · berechnete Uhrzeit · Farbstreifen · Titel · Dauer-Chip (30′) · ⋮`.

- **Dauer** per Chip mit Stufen (5/10/15/20/30/45/60/90′ + frei), Vorgabe: Szenendauer aus dem
  Stück, sonst 30′.
- **Fest um**: Punkt angeheftet (Pin-Symbol). Davor entsteht Puffer (grau „15′ frei“) oder Warnung
  „10′ zu knapp“.
- **Einfügen zwischen** Zeilen: „+“-Lücke (mobil immer sichtbar dezent, Desktop beim Hover); öffnet
  Schnellanlage an dieser Stelle.
- **Schnellanlage**: ein Feld „Szene, Gewerk oder Text…“ mit Vorschlägen (Szenen nach Dringlichkeit,
  Gewerke, Vorlagen: Aufwärmen 20′, Pause 15′, Durchlauf, Auswertung/Notizen 20′). Enter legt an und
  bleibt im Feld für den nächsten Punkt.
- **Verschieben**: dnd-kit (Touch: langes Drücken wie Kalender-Gesten), Tastatur Alt+↑/↓, im Menü
  „Nach oben/unten“. Folgende Uhrzeiten rücken mit.
- **Für alle**-Schalter je Sonstiges-Punkt (Entscheidung 2).
- Fußzeile: „Ende geplant 19:20 · 20′ über Terminende“ mit „Termin verlängern“.

### Parallele Spuren

- Punkt-Menü „Parallel zu …“ → bekommt Spur + Raum (Bühne, Saal, Werkstatt; Vorschläge aus
  bisherigen Räumen). Eine Spur läuft eigenständig nach Dauern; gemeinsame Punkte danach warten auf
  die längste Spur (Synchronpunkt).
- **Desktop**: Spuren als Spalten auf gemeinsamer Zeitachse.
- **Mobil**: Gruppenkarte „parallel: Bühne | Saal“ mit Spur-Reitern/aufklappbar.
- **Konflikte**: Person in zwei gleichzeitigen Punkten → rote Markierung mit Namen.

### Planungshilfen im Editor

- **Szenenwahl als Liste**: probbar-Status, „3× geprobt, zuletzt vor 12 Tagen“, benötigte Leute;
  sortiert nach Dringlichkeit (Rückstand in Probenwochen, Anzahl Proben, heute komplett besetzt).
- **Personen**: „3. Termin in dieser Probenwoche · 7 h“ an Teilnehmer und in Szenen-Tooltips.
- **Kennzahlen** unter dem Ablauf: Anwesende, Ø Auslastung (Zeit in eigenen Punkten / Zeit vor Ort),
  längste Wartezeit (Name), Knopf **„Reihenfolge optimieren“** (nur Vorschlag mit Vorher/Nachher).

### Probe vorschlagen

Reine Funktionen in `src/lib/calendar/rehearsal-suggest.ts`, nachvollziehbar statt Black Box:

1. **Dringlichkeit** je probbarer Szene: Rückstand (Probenwochen seit zuletzt), wenig geprobt,
   heute vollständig > Zweitbesetzung > eingeschränkt.
2. **Auswahl** gierig bis Rahmen voll: nächste Szene = beste Dringlichkeit pro Minute, mit Bonus
   für Besetzungsüberschneidung mit schon gewählten (→ wenige verschiedene Leute).
3. **Reihenfolge**: Szenen so ordnen, dass die Summe der Wartezeiten (Fenster minus eigene Zeit)
   minimal ist – bei ≤ 8 Szenen exakt (Permutation mit Pruning), sonst Nachbarschaftstausch.
   Feste und „für alle“-Punkte bleiben an ihrer Stelle.

- Begründung je Szene anzeigen („seit 3 Probenwochen nicht“, „gleiche Leute wie Sz. 2“).

## Datenmodell

`EventBlock` ergänzen (eine Migration):

- `durationMinutes Int?` – geplante Dauer (Quelle der Wahrheit für berechnete Zeiten)
- `fixedStart Boolean @default(false)` – angeheftet; dann zählt `startsAt`
- `track Int @default(0)` – Spur; `location` bleibt Raum
- `forEveryone Boolean @default(false)` – zählt für alle Eingeladenen (Fenster)

`startsAt/endsAt` werden beim Speichern aus Dauer/Reihenfolge berechnet und mitgespeichert
(Feed, Meine Termine, Benachrichtigungen bleiben unverändert). Migration: bestehende Punkte mit
Zeiten → `durationMinutes` aus endsAt−startsAt, `fixedStart` false. Im Editor Szenen und übrige
Punkte zu **einer** Liste zusammenführen (`schedule.times`/`rooms` → Blöcke).

## Phasen

1. **Kopf kompakt** – Chip-Zeile + Sheet/Popover, Statuszeile, mobile Reihenfolge, Locale-Check.
2. **Einheitliche Liste + Dauern** – Migration, Szenen/Blöcke zusammenführen, berechnete Zeiten,
   fest um, Puffer/Warnungen, Endzeile.
3. **Anlegen & Verschieben** – Schnellanlage mit Vorlagen, Einfügen zwischen, dnd-kit + Tastatur.
4. **Persönliche Fenster aus Reihenfolge** – inkl. „für alle“-Punkte, Anzeige pro Person.
5. **Parallele Spuren** – Spur/Raum, Synchronpunkte, Desktop-Spalten, mobile Gruppenkarte,
   Konfliktprüfung.
6. **Planungshilfen sichtbar** – Szenenliste mit Dringlichkeit, Wochenbelastung an Personen,
   Kennzahlen Auslastung/Wartezeit.
7. **Probe vorschlagen + Reihenfolge optimieren** – `rehearsal-suggest.ts` mit Unit-Tests, Sheet
   mit Rahmen-Balken.
8. **E2E + Screenshots** (Demo-Daten mit vollem Ablauf, mobil+desktop), Staging-Abnahme, Release.

## Offen

- Entscheidung 3 bei Umsetzung kurz bestätigen.
- Gewerk-Leitung organisiert eigene Punkte (`timesChanged`): bei Dauer-Modell als „fest“ behandeln?
- Probenmodus (`actualStart/actualOrder`) soll Ablauf-Verschiebungen live übernehmen können.
