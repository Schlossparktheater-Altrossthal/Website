# Dashboard

## Zweck

Einstiegsseite des Mitgliederbereichs: Begrüßung mit aktueller Produktion, ausblendbarer
Team-Chat-Hinweis, kleine Kennzahlen (Tage bis Endproben, Proben diese Woche, online,
Mitglieder der aktiven Produktion), eigene nächste Termine, „Profil vervollständigen“ mit
direkten Links in die Profilbereiche, Schnellzugriff und wer gerade online ist. Mobil
einspaltig.

## Routen

- `/mitglieder` – Dashboard (Einstiegsseite des Mitgliederbereichs)
- `/mitglieder/dashboard` – Redirect auf `/mitglieder`

## Permissions

- `PRIVATE.DASHBOARD.OVERVIEW.VIEW`

## Wichtige Komponenten

- `src/components/members-dashboard.tsx` – Hauptkomponente der Übersicht
- `src/components/members/page-header.tsx` – Seitenkopf

## Datenfluss

- Client-Fetch auf `GET /api/dashboard/overview`: `upcomingEvents` (Proben ohne Entwürfe +
  Termine eigener Gewerke), `profileCompletion.openItems`, `activeProduction.whatsapp`
  (Link, besucht, ausgeblendet).
- Ausgeblendete Hinweise speichert `POST /api/notices/dismiss` in `UserNoticeDismissal`
  (Schlüssel z. B. `whatsapp:<showId>`).
- Verbindungsstatus kommt aus dem Realtime-Hook (`useRealtime`).

## Realtime

- Zeigt den Live-Verbindungsstatus des Socket.io-Clients an.

## Besonderheiten

- Nutzt das `PageHeader`-Pattern aus `src/components/members/page-header.tsx`.
- Die Kennzahl „Tage bis Endproben“ hängt an der aktiven Produktion und bleibt sichtbar,
  solange diese existiert: Ohne `finalRehearsalWeekStart` zeigt sie `–` mit dem Hinweis
  „Noch kein Termin gesetzt“ (neutral) und verlinkt für `PRIVATE.PRODUCTION.SHOW.MANAGE`
  direkt auf `/mitglieder/produktionen/<showId>#endprobenwoche`. Ist die Endprobenwoche
  vorbei, entfällt die Kachel wieder. Mit Datum nennt sie nur noch den Wert – den Hinweis
  „ab <Datum>“ gibt es seit 2026-09-26 nicht mehr.
- Die Kennzahl „Mitglieder“ zählt die Mitgliedschaften der aktiven Produktion
  (`ProductionMembership` mit `currentMembershipWhere()`), nicht alle Konten des Vereins.
  Ohne aktive Produktion zeigt sie `–` mit dem Hinweis „Keine aktive Produktion“.
