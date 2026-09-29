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

## Erinnerungen an Termine

- Vorlaufzeit je Nutzer im Profil (`NotificationSettings.reminderLead`): nie, 1 h, 2 h, 12 h,
  1 Tag (Standard), 2, 3 oder 7 Tage. Plan: `docs/Plan/termin-erinnerungen-plan.md`.
- Erinnert wird, wer beteiligt ist (nicht abgesagt, kein Notfall) und am Termintag nicht gesperrt
  ist – auch wer noch nicht geantwortet hat. „Eingeschränkt“ schließt nicht aus.
- Bezugszeit ist die persönliche Zeit einer gestaffelten Probe, sonst der Terminbeginn; ganztägige
  Termine nennen keine Uhrzeit. Vorgemerkte Termine (TENTATIVE) erinnern nicht.
- `GET/POST /api/cron/rehearsal-reminders` mit Header `x-cron-secret` (`CRON_SECRET`); der CronJob
  ruft alle 15 Minuten auf. Läufe sind idempotent: `EventReminderDispatch` protokolliert je Termin
  und Person, deshalb kommt keine Erinnerung doppelt.
- Der Push folgt der Ruhezeit, die Glocke bekommt den Eintrag trotzdem. Erinnerungen pushen
  unabhängig vom Push-Schalter des Bereichs – die Vorlaufzeit ist das Opt-in.

## Offen

- Einstellungen je Kategorie (Plan Phase 6).

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
