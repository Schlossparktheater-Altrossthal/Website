# Sperrliste & Termine – Umbauplan (2026-09)

## Ausgangslage

Die Sperrliste hatte zwei Reiter mit insgesamt sechs Darstellungen (persönlicher Kalender mit
Mehrfachauswahl, Tabelle, Kalender-Karten, Timeline, mobile Wochenleiste und Tagesliste). Alle
zeigten überwiegend „frei“, mobil wurde die Übersicht rund 24.000 px lang, der persönliche
Kalender war mobil breiter als der Bildschirm, die Timeline brach um, ein Export-Button war tot
und das Detailfenster zu Einträgen öffnete nie. Außerdem lieferte der Server die Gründe aller
Mitglieder an jeden Browser.

## Leitidee

**Nur Ausnahmen zeigen.** Wer nichts eingetragen hat, ist verfügbar und erzeugt keine Zeile.
Orientierung an modernen Kalendern: kompakter Monat mit Punkten, darunter die Agenda des
gewählten Tages (Google/Apple mobil), Verfügbarkeit pro Tag als Balken (Doodle/When2meet),
Zeiträume als Band (Linear/Notion Calendar).

## Tag-Stufen (`src/lib/sperrliste/day-tiers.ts`)

| Stufe      | Tage                                                                      |
| ---------- | ------------------------------------------------------------------------- |
| `core`     | bevorzugte Probentage (Einstellungen, derzeit Fr–So) und Endprobenwoche   |
| `possible` | Ausnahme-Wochentage, Schulferien, Feiertage, Tage mit Termin oder Probe   |
| `off`      | übrige Wochentage – blass, in der Team-Ansicht standardmäßig ausgeblendet |

Die Endprobenwoche kommt aus der aktiven Produktion (`finalRehearsalWeekStart/End`) und wird als
Band dargestellt; Einträge dort gelten als Konflikt und werden beim Eintragen angekündigt.

## Ansichten

1. **Mein Kalender** – Monatsraster (7 Spalten, mobil ohne Scrollen), darunter bzw. rechts die
   Agenda des gewählten Tages: Stufe, Ferien, Termine, eigener Status als Umschalter
   (Frei/Bevorzugt/Eingeschränkt/Gesperrt) mit optionalem Grund. Zeiträume („Urlaub vom … bis …“)
   über einen Dialog. Liste „Meine Einträge“.
2. **Team** – Desktop: eine Matrix Personen × relevante Tage, leere Zellen = frei, Kopfzeile mit
   Verfügbarkeitsbalken und Terminen. Mobil: Tagesliste relevanter Tage mit Balken und nur den
   Namen der Ausnahmen. Filter Schauspiel/Gewerke, Suche, „Alle Tage“.

## Rechte

- Alle mit `PRIVATE.REHEARSAL.BLOCKLIST.VIEW` sehen, **wer** an einem Tag fehlt.
- **Gründe** sieht nur, wer plant (`PRIVATE.REHEARSAL.PLANNING.MANAGE`). Der Server liefert sie
  anderen gar nicht erst aus.
- **Termine anlegen/bearbeiten** ebenfalls mit `PRIVATE.REHEARSAL.PLANNING.MANAGE`.

## Termine der Organisation

Neues Modell `CalendarEvent` (Titel, Art, Beginn, Ende, ganztägig, Ort, Beschreibung, optional
Produktion). `src/lib/calendar/entries.ts` führt Termine und Proben zusammen; genutzt von der
Sperrliste und „Nächste Termine“ im Dashboard. API: `src/app/api/calendar-events`.

## Neue UI-Bausteine (`src/components/ui`)

`availability-status` (StatusDot/StatusBadge, zentrale Farben), `month-grid`, `month-switcher`,
`availability-bar`, `segmented-control`, `date-badge` (aus dem Dashboard herausgelöst).

## Schritte

1. Tag-Stufen-Logik mit Tests
2. UI-Bausteine
3. Termin-Modell, Migration, API, Dashboard-Anbindung
4. Sperrliste: Seite, „Mein Kalender“, „Team“, Termin-Dialog; alte Ansichten und
   `sperrliste-styles.css` entfernen
5. Einstellungen straffen (mobil als Sheet, ohne doppelten Kurzüberblick)
