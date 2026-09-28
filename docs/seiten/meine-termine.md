# Meine Termine

## Zweck

Persönliche Übersicht über alles, was für die Person angesetzt ist: eigene Proben, Termine der
eigenen Gewerke und „Für alle"-Termine. Kompakt: eine Zeile pro Termin (Zeit, Farbpunkt je Art,
Titel, eine Zusatzzeile, Status rechts), nach Tagen gruppiert. Absage und Details stehen auf der
Terminseite `/mitglieder/termine/[id]`; Absagen sind mit der Sperrliste verzahnt (siehe unten).
Ab `xl` (1280 px) zeigt die Seite rechts neben der Liste die Terminseite als Vorschau
(`?termin=<id>`, sonst der nächste Termin); ↑/↓ blättert. Darunter steht mobil oben die Karte
„Nächster Termin“.

## Routen

- `/mitglieder/meine-proben` – Liste (Standard) oder Kalender; der Zustand steht komplett in der URL:
  - `?ansicht=kalender` – Monatsübersicht statt Liste
  - `?gruppe=required|optional|club` – Filter: Muss ich hin / Optional / Für alle
  - `?q=<text>` – Suche über Titel und Ort
  - `?vergangen=1` – vergangene Termine (letzte 90 Tage, neueste zuerst)
  - `?mehr=<n>` – Obergrenze je Datenquelle (Schrittweite 30, Maximum 300)
  - `?termin=<id>` – Termin in der Desktop-Vorschau

## Permissions

- `PRIVATE.REHEARSAL.OWN.VIEW` – Zugang zur Seite; fehlt sie, zeigt die Seite nur einen Hinweistext.
- `PRIVATE.REHEARSAL.BLOCKLIST.VIEW` – die Sperrliste ist Pflichtbereich für alle Mitglieder; die
  Absage schreibt dort hinein.
- Schreibzugriffe prüfen serverseitig zusätzlich, ob der Termin für die Person sichtbar ist
  (persönliche Einladung oder „Für alle" der eigenen Produktion).

## Wichtige Komponenten

- `src/app/(members)/mitglieder/meine-proben/page.tsx` – Server-Komponente: liest `searchParams`,
  baut alle Links daraus; Werkzeugzeile (Liste/Kalender als Symbole, Filter-Chips mit Anzahl –
  mobil eigene Zeile, Tipps hinter „i“, Suche hinter der Lupe), Karte „Nächster Termin“ (unter
  `xl`), Desktop-Vorschau über `readEventView` und `EventView layout="panel"`.
- `.../my-events-list.tsx` – Tagesgruppen („Heute“, „Morgen“, Datum), Legende der Farbpunkte,
  Leerzustand; `row-keyboard-nav.tsx` für ↑/↓.
- `.../my-event-row.tsx` – kompakte Zeile; Farbpunkt `TONE_DOT` (Probe `bg-info`, Gewerk
  `bg-success`, Termin `bg-primary` wie in der Terminplanung), Status rechts (abgesagt/Notfall,
  gesperrt/eingeschränkt, optional); von Liste und Kalender gemeinsam genutzt.
- `.../my-events-calendar.tsx` – Monatsansicht (`MonthGrid` + `MonthSwitcher`); Tagesdetails am
  Desktop unter dem Raster, mobil im Bottom-Sheet.
- `.../decline-control.tsx` – Absage-Dialog (Notfall- und Normal-Variante) und „Doch dabei".
- `.../actions.ts` – Server Actions mit Sichtbarkeitsprüfung.
- `loading.tsx` – eigene Ladegrenze in Listenform.

## Datenfluss

- `src/lib/calendar/my-events.ts` – `readMyUpcomingEvents(userId, { past, search, limit })` bündelt
  drei Queries (persönliche Einladungen, Gewerk-Termine, „Für alle") und ergänzt pro Termin
  Abschnitt (`resolveEventBucket`), `withinFreeze`, `conflict` (eigene Sperre am Termintag) sowie
  den Ort-Hinweis. `readNextEvent(userId)` liefert den nächsten Termin für das Widget.
- `src/lib/calendar/block-list-link.ts` – Sperrfrist (`readFreezeDays`, `isWithinFreeze`) und die
  Verzahnung mit der Sperrliste (`createBlockForDecline`, `removeBlockForDecline`).
- Prisma: `CalendarEvent`, `EventParticipant`, `BlockedDay` (mit `eventId`), `Department`,
  `DepartmentMembership`.

## Absage und Notfall

| Lage des Termins                      | Absage                | Grund                    | Eintrag in der Sperrliste |
| ------------------------------------- | --------------------- | ------------------------ | ------------------------- |
| außerhalb der Sperrfrist (Standard 7) | normale Absage (`no`) | freiwillig               | `BLOCKED` am Starttag     |
| innerhalb der Sperrfrist              | Notfall (`emergency`) | Pflicht (min. 3 Zeichen) | `EMERGENCY` am Starttag   |

- Der Eintrag entsteht am **Starttag** des Termins (`Europe/Berlin`) und ist mit dem Termin
  verknüpft. Existiert an dem Tag schon ein eigener Eintrag, bleibt er unangetastet und wird nicht
  verknüpft.
- „Doch dabei" nimmt die Absage zurück und entfernt den verknüpften Eintrag – außer am selben Tag
  ist noch ein anderer Termin abgesagt.
- „Für alle"-Termine sind genauso absagbar; der Server prüft die Sichtbarkeit.
- Die Planung wird **genau einmal** benachrichtigt: Meldet die Absage selbst, schweigt der
  Sperrlisten-Eintrag. Bei Terminen ohne zuständige Person (reine „Für alle") bleibt nur der
  Eintrag in der Sperrliste.
- Vergangenes lässt sich nicht mehr absagen.
- Der Zustand „Notfall" ist in der Sperrliste sichtbar, aber dort nicht setzbar – siehe
  [sperrliste.md](sperrliste.md).

## Realtime

Keine eigene Live-Aktualisierung; die Seite liest bei jedem Aufruf neu. Nach Mutationen
revalidiert `actions.ts` zusätzlich `/mitglieder/sperrliste` und die Probendetailseite.

## Tests

- `e2e/termine.spec.ts` (`pnpm e2e:desktop termine`) prüft den URL-Zustand von Ansicht, Suche und
  Vergangenheit sowie beide Absagewege samt Sperrlisten-Eintrag und „Doch dabei".
- `src/lib/calendar/__tests__/my-events.test.ts` deckt die Abschnitte (heute/morgen, Woche,
  Vergangenes, Sonntagsgrenze) ab, `block-list-link.test.ts` die Sperrfrist-Grenze. Welcher Zustand
  beim Absagen gesetzt wird, prüft der E2E-Test über die Oberfläche.

## Besonderheiten / Altlasten

- Die Suche greift auf Titel und Ort, nicht auf „Dabei als" (`reasons` ist JSON).
- Der Kalender zeigt Monate unabhängig von der Liste; ein Monatswechsel lädt keine neuen Daten.
- `readNextEvent` ruft dieselbe Abfrage noch einmal ohne Filter auf (drei zusätzliche Queries) –
  bewusst, damit die Sichtbarkeitslogik an einer Stelle bleibt.
