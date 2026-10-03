# Server-Einstellungen & Analytics

## Zweck

Administrative Server-Konfiguration (SMTP für Systemmails) und Auswertung der
Server-Metriken (HTTP, Sessions, Seiten-Performance).

## Routen

- `/mitglieder/server-einstellungen` – SMTP- und Server-Konfiguration
- `/mitglieder/server-analytics` – Statistik mit Bereichen `?ansicht=` (Standard Übersicht,
  `mitglieder`, `ladezeiten`, `fehler`, `system`) und Zeitraum `?zeitraum=7|30|90` (Standard 30)

## Permissions

- `PRIVATE.ADMIN.SERVER.SETTINGS` – Server-Einstellungen
- `PRIVATE.ADMIN.SERVER.ANALYTICS` – Analytics

## Wichtige Komponenten

- `src/app/(members)/mitglieder/server-einstellungen/page.tsx`
- `src/app/(members)/mitglieder/server-analytics/page.tsx` – Kopf, Zeitraum, `SectionNav`, lädt nur
  den aktiven Bereich
- `statistics-overview.tsx` (Kennzahlen, Tagesverlauf, Seiten-Tabelle, Geräte),
  `statistics-members.tsx` (namentlich: zuletzt aktiv, Besuche, Zeit; nicht dagewesene Konten),
  `performance-section.tsx` (Ladezeiten), `statistics-errors.tsx`, `system-section.tsx`
  (Serverressourcen + Warn-/Fehlermeldungen des Loggers mit Status-Pflege)

## Datenfluss

- Server-Einstellungen über `src/lib/server-settings.ts` (`resolveServerSettings`,
  `toClientServerSettings`).
- Statistik über `src/lib/analytics/statistics.ts` (`loadMemberStatistics`), Auswertung in
  `usage-summary.ts` (Besuch = Nutzung ohne Pause über 30 Minuten) und `performance-samples.ts`.
- Ladezeiten misst `src/components/analytics/performance-reporter.tsx` im Browser (Erstaufruf mit
  Web Vitals, Seitenwechsel bis kein `[data-route-loading]` mehr sichtbar ist, Serverzeit und
  Anzahl der RSC-Anfragen aus der Resource-Timing-API) und schickt sie an
  `/api/analytics/performance`. Neue `loading.tsx` brauchen `data-route-loading` am Wurzelelement.
- Fehler: Server über `onRequestError` (`src/instrumentation.ts`), Browser über
  `/api/analytics/errors` (höchstens fünf verschiedene je Seitenaufruf). Beide Endpunkte speichern
  nur für angemeldete Nutzer und verwerfen Headless-Browser.

## Besonderheiten / Altlasten

- Die Analytics-Aggregation läuft über die API-Route `/api/cron/server-analytics`
  (Header `x-cron-secret`) oder manuell via `pnpm tsx scripts/cron/*`.
- Die HTTP-/Uptime-Pipeline (`AnalyticsHttpRequest`, Heartbeats, `/api/cron/server-analytics`)
  hat nie Daten bekommen: die früher genutzten Hooks `onRequest`/`onResponse` gibt
  es in Next.js nicht (2026-10 entfernt). Verfügbarkeit überwacht Grafana.
- Server-seitige Analytics-Module (`src/lib/server-analytics-data.js`, `src/lib/server-analytics-settings.js`)
  sind bewusst handgepflegtes JavaScript mit begleitender `.d.ts`-Datei. Der Realtime-Server hat keine
  Build-Stufe und kann `.ts` nicht laden – daher keine TS-Migration dieser Module.
