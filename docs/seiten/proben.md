# Proben

## Zweck

Planung, Anlage und Verwaltung von Proben. Ensemblemitglieder sehen ihre eigenen Termine,
Probenplaner verwalten den Gesamtplan.

## Routen

- `/mitglieder/terminplanung` – Gesamtplanung für Proben und Termine: Ansichten Kalender (Tagesfelder mit Uhrzeit, Szenennummern und Verfügbarkeitsbalken; Tagesblatt mit „Wer kann?“, „Diese Woche eingeladen“ und „Was ist probbar?“ samt „Probe mit N Szenen anlegen“), Liste, Szenen (`?ansicht=szenen`, Szene × Woche bis zur Premiere) und Personen (`?ansicht=personen`, Person × Tag einer Woche), dazu Entwürfe (`docs/Plan/planungshilfen-terminplanung-plan.md`); `/mitglieder/probenplanung` leitet auf `?art=proben` um
- `/mitglieder/terminplanung/[eventId]` – gemeinsamer Editor für Proben und Termine (alte Adresse `/mitglieder/probenplanung/proben/[id]` leitet um). „Gehört zu“ (Produktion oder keiner) ist bei jeder Art wählbar und liefert Szenen und Gewerke für den Ablauf; „Wer ist dabei“ (Alle bzw. Alle der Produktion, oder bestimmte Personen) steuert Sichtbarkeit, Antworten und Erinnerungen. Die Art ist nur Etikett (`docs/Plan/terminplanung-plan.md`, Phase 7). Im Ablauf zeigt „Am … probbar“ jede Szene als vollständig, mit Zweitbesetzung, eingeschränkt oder „fehlt jemand“ (`src/lib/calendar/scene-readiness.ts`); die Teilnehmerliste zeigt „diese Woche schon N× · h“ und warnt, wenn jemand am Vor- oder Folgetag auch eingeladen ist (`src/lib/calendar/week-load.ts`).
- `/mitglieder/termine/[eventId]` – Terminseite für alle Beteiligten (Proben, Termine, Gewerk-Termine): Kopf mit eigener Zeit und Absage, Ablauf als Zeitleiste (parallele Punkte, „nur meine“, Jetzt-Linie), Leute gruppiert. Sehen dürfen Planung, Eingeladene, alle der Produktion bzw. des Gewerks, bei Terminen ohne Produktion und Zielgruppe alle. Daten aus `src/lib/calendar/event-view-server.ts` (`readEventView`), Zeitleiste aus `event-timeline.ts`. Alte Adresse `/mitglieder/proben/[id]` leitet um, ebenso der Editor für Personen ohne Planungsrecht.
- `/mitglieder/termine/[eventId]/probe` – Probenmodus (ab 1 h vor Beginn auf der Terminseite verlinkt, Recht `PRIVATE.REHEARSAL.PROTOCOL.EDIT` oder Planung, beides produktionsbezogen): Probe beginnen/beenden, Ablauf mit „Starten“ und Ergebnis (geschafft/teilweise/nicht), tatsächliche Zeiten, Notiz je Punkt, Reihenfolge ändern, spontane Punkte; Anwesenheit (da, verspätet, früher weg, fehlt, entschuldigt), Dazugekommene und Gäste. Jede Eingabe ist eine Operation (`src/lib/calendar/protocol.ts`), liegt sofort in `localStorage` (`mb-probe-queue:<id>`) und wird per Server Action nachgesendet (`use-protocol-sync.ts`); der Service Worker hält die Seite offline vor (`probe-pages`). Nach dem Speichern meldet `rehearsal_updated` mit `changes.protocol` allen offenen Geräten und Terminseiten, neu zu laden (`useEventLiveRefresh`). Die frühere Nachbereitung im Editor ist entfallen. Reiter „Notizen“: Notiz, Entscheidung oder Aufgabe (zuständig Person, Figur = deren Besetzung, oder Gewerk; optional Frist und Bezug zu einem Punkt). Gewerk-Aufgaben legen zusätzlich eine Karte in der ersten Spalte des Gewerk-Boards an (`EventNote.departmentTaskId`), Zuständige bekommen `rehearsal-task` (Gewerk: Leitung und Stellvertretung). „Probe beenden“ fragt eine Zusammenfassung ab und verschickt das Protokoll (`sendProtocolAction`, Typ `rehearsal-protocol`) an Eingeladene und Anwesende – erst wenn alle Offline-Änderungen übertragen sind.
- Terminseite, Reiter „Protokoll“ (sobald etwas erfasst ist, für alle, die den Termin sehen): Zusammenfassung, eigene Aufgaben zum Abhaken, Anwesenheit, Ablauf mit Ist-Zeiten und Ergebnissen, Entscheidungen, übrige Aufgaben, Notizen (`src/lib/calendar/protocol-view.ts`). `?ansicht=protokoll` öffnet ihn direkt.
- Dashboard: Karte „Meine Aufgaben“ (`readMyTasks`, persönlich und über Figuren; Erledigte eine Woche sichtbar), Abhaken per `setEventTaskDoneAction`. „Meine Termine“ zeigt bei vergangenen Proben die eigene Anwesenheit (✓ da, ◷ verspätet/früher weg, ✗ gefehlt, – entschuldigt) und ein Protokoll-Symbol.
- `/mitglieder/meine-proben` – eigene Termine: Liste oder Kalender, Suche, Absagen (siehe [meine-termine.md](meine-termine.md))

## Permissions

- `PRIVATE.REHEARSAL.PLANNING.MANAGE` – Planung/Bearbeitung
- `PRIVATE.REHEARSAL.OWN.VIEW` – eigene Proben
- `PRIVATE.REHEARSAL.BLOCKLIST.VIEW` – Blocker-Übersicht

## Wichtige Komponenten

- `src/app/(members)/mitglieder/terminplanung/` – Planungsseite (`page-client.tsx`, `scene-plan-view.tsx`, `people-week-view.tsx`), Editor (`event-editor.tsx`), Anlegen (`new-event.tsx`)
- `src/app/(members)/mitglieder/terminplanung/actions/` – Server Actions

## Datenfluss

- Prisma-Modelle: `CalendarEvent` (`kind = REHEARSAL`, `actualStart/actualEnd`), `EventBlock` (`actualStart/actualEnd/actualOrder/unplanned`), `EventParticipant` (`attendance`, `arrivedAt`, `leftAt` – ersetzt `attended`), `EventGuest`, `EventNote` (Typ NOTE/DECISION/TASK), `CalendarEvent.protocolSummary/protocolSentAt`, `EventResponseLog`
- Server Actions in `terminplanung/actions/` bündeln die Mutationslogik.

## Realtime

- Probentermine werden über `useRealtime` live aktualisiert (z. B. `rehearsal_updated`).

## Besonderheiten / Altlasten

- Die Server Actions der Terminplanung liegen in `terminplanung/actions/` (`drafts.ts`, `finder.ts`,
  `rehearsals.ts`); die frühere große Datei `probenplanung/actions.ts` ist entfallen, gemeinsame
  Helfer liegen in `src/lib/probenplanung/actions-helpers.ts`.
- Die Gesamtplanung bietet zwei Ansichten (Kalenderansicht / Wochenend-Fokus) über ein
  `SegmentedControl` (`src/components/ui/segmented-control.tsx`).
- Zeitlogik läuft über `DEFAULT_TIME_ZONE` aus `src/lib/date-time.ts`.

## Terminfinder (`/mitglieder/terminplanung/terminfinder`)

Recht: `PRIVATE.REHEARSAL.PLANNING.MANAGE` (Produktion). Zielgruppe mit dem Baukasten wählen, Zeitraum, Wochentage und Uhrzeit angeben; „Termine finden“ bewertet jeden Tag nach Sperrliste und anderen angesetzten Terminen im Zeitfenster (benötigte Personen zählen mehr als optionale). Ergebnis als Heatmap aller Tage und Liste der besten Tage; „Probe anlegen“ erstellt einen Entwurf mit Datum, Uhrzeit und Zielgruppe. Erreichbar über „Termin finden“ in der Probenplanung.
