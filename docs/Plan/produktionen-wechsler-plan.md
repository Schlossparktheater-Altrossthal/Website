# Produktionen-Wechsler und -Verwaltung

Stand: 2026-10-18 · Abgestimmt mit dem User.

## Ausgangslage

- „Aktiv“ war doppelt belegt: **Status** der Produktion (für alle) und die **angezeigte
  Produktion** (pro Person, Cookie `active-production`). Im Verwalten-Fenster standen deshalb
  „Aktiv“, „Ausgewählt“ und „Als aktiv setzen“ nebeneinander.
- Der Umschalter oben in der Seitenleiste schaltete nicht um, sondern zeigte nur eine Infokarte
  mit „Zur Produktion“ (= Menüpunkt „Überblick“) und „Produktionen verwalten“.
- Das Verwalten-Fenster (`production-manage-sheet.tsx`) hatte pro Zeile Status-Dropdown,
  „Status setzen“, „Als aktiv setzen“ und „Bearbeiten“; mobil kein Blatt von unten.

## Entscheidungen

- Mehrere Produktionen dürfen gleichzeitig laufen.
- Beim Wechsel geht es auf die **gleichwertige Seite** der anderen Produktion. Die ID der alten
  Produktion in der Adresse wird ersetzt; Datensätze der alten Produktion (Probe, Szene …) führen
  auf die übergeordnete Seite (`src/lib/produktionen/switch-target.ts`). Fehlt dort die
  Berechtigung, zeigt die Seite selbst ihren Hinweis.
- Begriffe: „angezeigt“ statt „aktiv“ für die Auswahl; Status **Planung · Läuft ·
  Abgeschlossen · Archiviert**.

## Schritte

1. **Wechsler + Begriffe** – erledigt 2026-10-18
   - `ProductionSwitcher` (Desktop Popover, mobil `BottomSheet`): gruppiert nach Läuft /
     In Planung / Vergangen, Häkchen, ein Tipp wechselt (`switchProductionAction`).
   - Mitglieder sehen nur Produktionen mit aktueller Mitgliedschaft; bei nur einer kein Menü.
   - Produktionsleitung: „Neue Produktion“ (`?verwalten=1&neu=1`) und „Alle Produktionen verwalten“.
   - „Zur Produktion“ entfernt; `ProductionStatusPill` für farbige Status.
2. **Verwaltungsseite** `/mitglieder/produktionen/verwalten` statt Seitenfenster
   - Listenzeilen im Dashboard-Stil (Jahr-Kachel, Titel, Premiere, Status, Chevron),
     Archivierte eingeklappt.
   - Bearbeiten im einheitlichen Dialog (mobil Bottom-Sheet), Status als `SegmentedControl`,
     sofort gespeichert; „Status setzen“ entfällt.
   - Neue Produktion als kurzer Assistent (Jahr, Titel, Premiere), danach direkt angezeigt.
   - Altes Seitenfenster und `?verwalten=1` entfernen (Weiterleitung auf die neue Seite).
3. **Hinweisleiste + Abnahme**
   - Zeigt jemand nicht die neueste laufende Produktion: dezente Leiste „Du siehst … · zur
     aktuellen wechseln“.
   - E2E für Wechsel (gleiche Seite, ID-Ersatz, Rückfall), Screenshots mobil + desktop.
