# Server-Einstellungen & Analytics

## Zweck

Administrative Server-Konfiguration (SMTP für Systemmails) und Auswertung der
Server-Metriken (HTTP, Sessions, Seiten-Performance).

## Routen

- `/mitglieder/server-einstellungen` – SMTP- und Server-Konfiguration
- `/mitglieder/server-analytics` – Analytics-Dashboard

## Permissions

- `PRIVATE.ADMIN.SERVER.SETTINGS` – Server-Einstellungen
- `PRIVATE.ADMIN.SERVER.ANALYTICS` – Analytics

## Wichtige Komponenten

- `src/app/(members)/mitglieder/server-einstellungen/page.tsx`
- `src/app/(members)/mitglieder/server-analytics/server-analytics-content.tsx`

## Datenfluss

- Server-Einstellungen über `src/lib/server-settings.ts` (`resolveServerSettings`,
  `toClientServerSettings`).
- Analytics über aggregierte Tabellen und die Pipeline in `src/lib/analytics`.

## Besonderheiten / Altlasten

- Die Analytics-Aggregation läuft über die API-Route `/api/cron/server-analytics`
  (Header `x-cron-secret`) oder manuell via `pnpm tsx scripts/cron/*`.
- `server-analytics-content.tsx` enthält Animations-/Interpolationslogik (`interpolateValue`).
- Server-seitige Analytics-Module (`src/lib/server-analytics-data.js`, `src/lib/server-analytics-settings.js`)
  sind bewusst handgepflegtes JavaScript mit begleitender `.d.ts`-Datei. Der Realtime-Server hat keine
  Build-Stufe und kann `.ts` nicht laden – daher keine TS-Migration dieser Module.
