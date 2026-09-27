# Benachrichtigungen

## Zweck

Glocke im Kopf und eigene Seite für alles, was Mitglieder und Planung erfahren müssen. Oben
steht, was zu tun ist, darunter Neues, dann Früheres. Plan und Hintergründe:
`docs/benachrichtigungen-plan.md`.

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

Web Push, PWA und Einstellungen je Kategorie (Plan Phase 4–6).
