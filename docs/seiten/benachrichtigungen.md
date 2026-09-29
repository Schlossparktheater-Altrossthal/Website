# Benachrichtigungen

## Zweck

Glocke im Kopf und eigene Seite für alles, was Mitglieder und Planung erfahren müssen. Oben
steht, was zu tun ist, darunter Neues, dann Früheres. Plan und Hintergründe:
`docs/Plan/benachrichtigungen-plan.md`.

## Routen

- `/mitglieder/benachrichtigungen` – alle Benachrichtigungen (nur Anmeldung, keine eigene Permission)
- `GET /api/notifications` – Posteingang (`section`, `category`, `archived`, `q`, `cursor`, `limit`)
- `POST /api/notifications/state` – `read`/`unread`/`done`/`undone`/`archive`/`unarchive` für
  `ids`, `groupKeys` oder `all`
- `POST /api/notifications/test` – Testbenachrichtigung (Mitgliederverwaltung)

## Aufbau

- **Glocke** (`src/components/notification-bell.tsx`): Badge mit offenen Bündeln (rot bei
  dringend). Desktop: Popover (26rem), mobil: Bottom-Sheet (85dvh). Kategorie-Chips nur für
  Bereiche mit Offenem, je Abschnitt höchstens 8 Einträge, „Alle anzeigen“ zur Seite. Neue
  Hinweise gelten beim **Schließen** als gelesen, Aufgaben erst mit „Erledigt“. Einmaliger,
  ausblendbarer Hinweis zum Erlauben von Geräte-Benachrichtigungen (`device-notifications`).
- **Seite**: `SegmentedControl` Offen/Alle/Archiv, Suche, alle Kategorien, „Mehr laden“.
- **Zeile** (`src/components/notifications/notification-row.tsx`): Kategorie-Icon, Titel,
  erste Textzeile, relative Zeit. Klick öffnet `actionUrl`. Bündel (`groupKey`, z. B. alle
  Absagen einer Probe) lassen sich aufklappen. Desktop: Knöpfe beim Überfahren, Pfeiltasten
  springen zwischen Einträgen; mobil nach links wischen (erledigen bzw. archivieren, mit
  „Rückgängig“). Gewerke-Anfragen lassen sich direkt annehmen/ablehnen
  (`decideJoinRequestAction`, nur offene Anfragen).
- Daten: `src/components/notifications/use-inbox.ts` (Laden, optimistische Änderungen,
  Realtime/Fokus lädt neu), Logik in `src/lib/notifications/`.

## Offen

- Einstellungen je Kategorie (Plan Phase 6).
- Versand der Termin-Erinnerungen (Phasen 3–5 in `docs/Plan/termin-erinnerungen-plan.md`).
  Die Vorlaufzeit ist im Profil bereits einstellbar (`NotificationSettings.reminderLead`,
  Standard 1 Tag, Option „Nie“), wirkt aber erst mit dem Cron in Phase 5.

## Web Push

- `GET/POST/DELETE /api/push/subscription` (öffentlicher Schlüssel, Geräte, Abo), `POST /api/push/test`.
- Versand in `dispatchNotification` → `src/lib/notifications/push.ts`; ohne `VAPID_*` passiert nichts.
- Aktivieren über den Hinweis in der Glocke (`usePushSubscription`). iOS nur als installierte App.

## PWA

- Manifest `src/app/manifest.ts` (`/manifest.webmanifest`), Start `/mitglieder`, Icons aus
  `src/lib/pwa/app-icons.tsx` (`/pwa-icons/192|512|maskable-512`, `/apple-icon`).
- Ein Service Worker `public/service-worker.js` (Registrierung in `src/lib/pwa/register-sw.ts`):
  Offline-Sync, Assets, `offline.html` bei fehlender Verbindung, Klick auf Benachrichtigungen.
- `usePwaInstall()` liefert Installationsstatus; `InstallAppNotice` im Dashboard.
