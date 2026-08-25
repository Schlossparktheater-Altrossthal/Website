# Dashboard

## Zweck

Einstiegsseite des Mitgliederbereichs. Zeigt nach dem Login eine Übersicht (Verbindungsstatus,
Schnellzugriffe, aktuelle Hinweise) und dient als Landepunkt für Mitglieder.

## Routen

- `/mitglieder/dashboard`

## Permissions

- `PRIVATE.DASHBOARD.OVERVIEW.VIEW`

## Wichtige Komponenten

- `src/components/members-dashboard.tsx` – Hauptkomponente der Übersicht
- `src/components/members/page-header.tsx` – Seitenkopf

## Datenfluss

- Lädt die Übersichtsdaten serverseitig bzw. über einen Client-Fetch.
- Verbindungsstatus kommt aus dem Realtime-Hook (`useRealtime`).

## Realtime

- Zeigt den Live-Verbindungsstatus des Socket.io-Clients an.

## Besonderheiten

- Nutzt das `PageHeader`-Pattern aus `src/components/members/page-header.tsx` (nicht das
  inaktive Pattern aus `src/design-system/patterns`).
