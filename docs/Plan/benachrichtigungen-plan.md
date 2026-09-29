# Plan: Benachrichtigungen neu (Glocke, PWA, Web Push)

Stand: 2026-09-27. Phase 1–6 umgesetzt, offen Phase 7 (Release). Checkliste am Ende wird gepflegt.

> **Nachtrag 2026-09-29:** Vorzeitige Termin-Erinnerungen mit eigener Vorlaufzeit sind ergänzt –
> eigener Plan: `docs/Plan/termin-erinnerungen-plan.md`. Betroffen sind
> `NotificationSettings.reminderLead`, der Typ `event-reminder`, das Protokoll
> `EventReminderDispatch` und `shouldPush()` (Erinnerungen kommen unabhängig vom Bereichs-Schalter
> durch, weil die Vorlaufzeit das Opt-in ist).

## Ziel

1. Mitglieder können den Mitgliederbereich als **App installieren** (PWA, Android/Desktop/iOS).
2. **Push-Benachrichtigungen** kommen auch an, wenn kein Tab offen ist.
3. Die **Glocke** zeigt zuerst, was zu tun ist, statt einer ungeordneten Liste – vor allem für Organisatoren.
4. Ein UI für **Handy und Desktop**, plus eine eigene Seite für alle Benachrichtigungen.
5. Jede Person steuert selbst, **was über welchen Kanal** kommt.

## Ist-Stand (Befunde)

| #   | Befund                                                                                                                                                                               | Stelle                                                                                                                                                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Kein echtes Web Push: Browser-Benachrichtigungen nur, solange ein Tab offen ist (Socket `notification_created` → `showNotification`)                                                 | `notification-bell.tsx`, `useBrowserNotifications.ts`                                                                                                              |
| 2   | Zwei Service Worker auf demselben Bereich `/`: `service-worker.js` (Workbox, Offline-Scanner) und `notification-sw.js`; sie verdrängen sich gegenseitig                              | `lib/pwa/register-sw.ts`, `useBrowserNotifications.ts`                                                                                                             |
| 3   | Manifest gehört zur Scanner-App (`name: Sommertheater Scan`, `start_url: /scan`), nur ein Logo-PNG als Icon für alle Größen, keine Apple-Web-App-Metadaten                           | `public/manifest.json`, `app/layout.tsx`                                                                                                                           |
| 4   | Erzeugung verstreut: sieben Stellen rufen `prisma.notification.create` direkt auf; nur drei senden zusätzlich ein Realtime-Event (Gewerke, Besetzung, Aufgaben landen nur in der DB) | `terminplanung/actions/*`, `meine-gewerke/*`, `produktionen/actions/assignments.ts`, `lib/calendar/decline-notifications.ts`, `lib/photo-consent-notifications.ts` |
| 5   | Typen nicht zentral: `types.ts` kennt nur 3 Proben-Typen, sonst freie Strings (`department-request`, `photo-consent`, `calendar-event`, `test` …)                                    | `lib/notifications/types.ts`                                                                                                                                       |
| 6   | Kein Link-Ziel außer bei Proben (`eventId`); `actionUrl` existiert nur im Realtime-Event, nicht in der DB                                                                            | `schema.prisma` (`Notification`)                                                                                                                                   |
| 7   | Beim Öffnen der Glocke wird alles als gelesen markiert → Handlungsbedarf geht verloren                                                                                               | `notification-bell.tsx`                                                                                                                                            |
| 8   | Flache Liste der letzten 25, eine Karte pro Absage; bei Organisatoren entsteht eine Wand aus Karten                                                                                  | `api/notifications/route.ts`, `decline-notifications.ts`                                                                                                           |
| 9   | Keine Aktionen im Eintrag (z. B. Gewerke-Anfrage annehmen), Hinweis „Browser-Benachrichtigungen aktivieren“ dauerhaft in der Liste                                                   | `notification-bell.tsx`                                                                                                                                            |
| 10  | Panel 20rem auf Desktop, Dialog auf Handy; keine eigene Seite                                                                                                                        | `notification-bell.tsx`                                                                                                                                            |
| 11  | Keine Einstellungen pro Kategorie/Kanal (nur Mail-Erinnerungen separat)                                                                                                              | –                                                                                                                                                                  |

## Entscheidungen

Leitlinie: **wenige Kategorien, ein zentraler Versandweg, Handlungsbedarf vor Info.**

- **Ein Service Worker** (`service-worker.js`, Workbox) übernimmt Offline, `push` und `notificationclick`. `notification-sw.js` entfällt; alte Registrierungen werden beim ersten Laden abgemeldet.
- **Eine App** für den Mitgliederbereich: `start_url: /mitglieder`, Scanner als `shortcut` im Manifest.
- **Web Push per VAPID** mit der Bibliothek `web-push`, ohne Fremddienst (kein Firebase). Schlüssel in Vault.
- **Zentrale Funktion `notify()`** in `lib/notifications/notify.ts`: DB-Eintrag + Realtime + Push + (optional) Mail. Keine direkten `prisma.notification.create` mehr außerhalb.
- **Kategorien** (fest, klein): `proben`, `termine`, `gewerke`, `produktion`, `system`. Jeder Typ gehört genau zu einer Kategorie.
- **Zwei Arten**: `action` (braucht Reaktion, bleibt offen bis erledigt) und `info` (verschwindet nach Lesen aus „Neu“).
- **Prioritäten**: `normal` und `urgent` (kurzfristige Absage, Notfall). Nur `urgent` durchbricht Ruhezeiten.
- **Bündeln per `groupKey`** (z. B. `decline:<eventId>`): „3 Absagen für Probe Sa 14:00“ statt drei Karten.
- **Gelesen ≠ erledigt**: Öffnen der Glocke markiert Infos als gelesen, Aktions-Einträge bleiben bis `doneAt`.
- **Standard-Einstellungen**: In-App immer an; Push an für `urgent` und `action`, sonst aus; Mail wie bisher. Bewusst verworfen: Einstellungen pro Typ (zu fein) und Tageszusammenfassung (erst später, wenn Bedarf).
- **iOS**: Push nur als installierte App (ab iOS 16.4); wir zeigen dort eine kurze Anleitung statt eines Push-Buttons.

## Datenmodell

```prisma
model Notification {
  // bestehend: id, title, body, type, createdAt, eventId
  category  String   @default("system")   // proben | termine | gewerke | produktion | system
  kind      String   @default("info")     // info | action
  priority  String   @default("normal")   // normal | urgent
  actionUrl String?
  groupKey  String?
  showId    String?
  actorId   String?                        // wer hat's ausgelöst (Avatar)
  data      Json?                          // z. B. { requestId } für Inline-Aktionen

  @@index([groupKey])
}

model NotificationRecipient {
  // bestehend: id, notificationId, userId, readAt
  doneAt     DateTime?
  archivedAt DateTime?
  pushedAt   DateTime?

  @@index([userId, archivedAt, doneAt])
}

model PushSubscription {
  id         String   @id @default(cuid())
  userId     String
  endpoint   String   @unique
  p256dh     String
  auth       String
  userAgent  String?
  label      String?                       // „iPhone“, „Chrome Laptop“
  createdAt  DateTime @default(now())
  lastUsedAt DateTime?
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model NotificationPreference {
  userId   String
  category String
  inApp    Boolean @default(true)
  push     Boolean @default(false)
  email    Boolean @default(false)
  user     User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([userId, category])
}
```

Ruhezeit (`quietFrom`, `quietTo`) als zwei Felder am `User` oder in einer kleinen Tabelle – Entscheidung in Phase 5.

Migration: bestehende Einträge bekommen `category`/`kind` per SQL aus `type` abgeleitet; `actionUrl` für Proben aus `eventId`.

## UI-Konzept

### Glocke (Popover Desktop / Bottom-Sheet Handy)

```
┌ Benachrichtigungen ─────────────── ⚙ ┐
│ [Alle] [Proben] [Gewerke] [Produktion]│  ← Chips, nur mit Inhalt
│                                        │
│ ZU ERLEDIGEN (2)                       │
│ ● 👤 Anna möchte ins Gewerk Kostüm      │
│      vor 2 Std.   [Ablehnen] [Annehmen]│
│ ● ⚠ 3 Absagen · Probe Sa 14:00          │
│      Szene 4 betroffen      [Ansehen ›]│
│                                        │
│ NEU                                    │
│ ● 📅 Probe Di verschoben auf 19:00      │
│ ○ 🧵 Neue Aufgabe: Saum kürzen          │
│                                        │
│            Alle anzeigen ›             │
└────────────────────────────────────────┘
```

- Badge an der Glocke zählt **offene Aktionen + ungelesene Infos**; `urgent` färbt das Badge rot.
- Eine Zeile pro Eintrag: Kategorie-Icon bzw. Avatar, Titel, ein Satz Kontext, relative Zeit, Punkt für ungelesen. Ganze Zeile klickbar (`actionUrl`).
- Gebündelte Einträge aufklappbar (Namen, Gründe).
- Inline-Aktionen nur für klar definierte Typen (Gewerke-Anfrage, Foto-Einwilligung, Probe zu-/absagen); Ergebnis setzt `doneAt`.
- Handy: Wischen nach links = erledigen/archivieren. Desktop: Knöpfe beim Hover, Tastatur (↑/↓, Enter, `e` = erledigen).
- Höchstens ca. 8 Einträge je Abschnitt, dann „Alle anzeigen“.
- Kein Push-Hinweis mehr in der Liste; stattdessen einmaliger, wegklickbarer Hinweis (`UserNoticeDismissal`) und das Zahnrad.
- Größen: Desktop Popover ca. 26rem, max. 70vh; Handy Bottom-Sheet 85vh (vorhandenes Sheet-Muster aus Terminplanung wiederverwenden).

### Seite `/mitglieder/benachrichtigungen`

- Gleiche Abschnitte, dazu Filter (Kategorie, Produktion, ungelesen), Suche, Archiv, „Alle als gelesen“.
- Ziel für Push-Klicks ohne eigenen Link und für „Alle anzeigen“.

### Einstellungen `/mitglieder/profil` → „Benachrichtigungen“

- Matrix Kategorie × In-App / Push / Mail (In-App nicht abschaltbar für `action`).
- Liste der Geräte mit Push-Abo (Name, zuletzt genutzt, entfernen), „Dieses Gerät aktivieren“, Test-Push (bestehende `member-test-notification-card` umbauen).
- Ruhezeit.
- Installationshinweis je Plattform (Android/Desktop: Button über `beforeinstallprompt`; iOS: Teilen → „Zum Home-Bildschirm“).

## Phasen

### Phase 1 – Fundament: Typen und zentraler Versand

- `lib/notifications/types.ts`: Registry aller Typen mit `category`, `kind`, Standard-`priority`, Icon, Link-Builder.
- Migration `Notification`/`NotificationRecipient` (neue Felder, Ableitung für Altbestand).
- `notify({ type, recipients, title, body, actionUrl, groupKey, data, … })`: DB + Realtime (`sendNotification`), Push-Hook als No-op vorbereitet.
- Alle sieben Erzeuger auf `notify()` umstellen; Gewerke/Besetzung/Aufgaben bekommen damit auch Realtime.
- Tests: Registry vollständig, `notify()` legt Empfänger korrekt an, keine direkten `notification.create` mehr (Lint/grep-Test).

### Phase 2 – API

- `GET /api/notifications?section=action|new|all&category=&cursor=` mit Gruppierung nach `groupKey`, Zählern je Abschnitt/Kategorie, Paging.
- `POST /api/notifications/read|done|archive` (IDs oder `groupKey`).
- Inline-Aktionen über bestehende Server-Actions, die am Ende `doneAt` setzen.
- Aufräumen: archivierte Einträge nach 90 Tagen löschen (bestehender Cleanup-Endpunkt / CronJob).

### Phase 3 – Neues Glocken-UI und Seite

- `notification-bell.tsx` zerlegen: `NotificationBell` (Button + Badge), `NotificationPanel` (Popover/Sheet), `NotificationRow`, `NotificationGroup`, gemeinsamer Hook `useNotifications` (Laden, Realtime, optimistische Updates).
- Seite `/mitglieder/benachrichtigungen` mit denselben Bausteinen.
- Seitensteuerung/Navigation ergänzen (`proxy.ts` beachten).
- E2E: Organisator mit vielen Absagen (Bündelung), Gewerke-Anfrage inline annehmen, Handy-Sheet, Screenshots (`pnpm e2e:screenshots`).

### Phase 4 – PWA

- Neues `manifest.webmanifest` über `app/manifest.ts`: Name „Sommertheater Mitglieder“, `id`/`start_url` `/mitglieder`, `scope` `/`, Theme-Farben aus tweakcn-Theme, `shortcuts` (Scanner, Termine, Benachrichtigungen).
- Icons: 192, 512, 512 maskable, `apple-touch-icon` 180, Favicons; aus dem Logo erzeugt, mit Rand für maskable.
- `layout.tsx`: `appleWebApp` (capable, title, statusBarStyle), `viewport-fit=cover`, Safe-Area-Abstände in Header/Bottom-Sheets prüfen.
- Service Worker zusammenlegen: `notificationclick` aus `notification-sw.js` in `service-worker.js`; `useBrowserNotifications` nutzt nur noch `navigator.serviceWorker.ready`; alte `notification-sw.js`-Registrierung aktiv abmelden, Datei als leerer Selbst-Abmelder eine Version behalten.
- Offline: App-Shell + Offline-Seite für `/mitglieder`, Scanner-Offline unverändert; keine personenbezogenen API-Antworten cachen.
- Installationshinweis (`beforeinstallprompt` ist in `PwaProvider` schon abgefangen) auf Profil/Dashboard statt Toast; nur für eingeloggte Mitglieder.
- Prüfen: Lighthouse PWA-Checks, Android Chrome, Desktop Chrome/Edge, iOS Safari (Home-Bildschirm), Update-Toast bei neuem SW.

### Phase 5 – Web Push

- VAPID-Schlüssel erzeugen, in Vault (Staging/Prod getrennt), als `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT` ins Deployment (k8s-Manifeste im Config-Repo).
- `PushSubscription` + `NotificationPreference` (Migration).
- `POST/DELETE /api/push/subscribe`, `GET /api/push/public-key`.
- Service Worker: `push`-Handler (Titel, Text, Icon, Badge, `tag` = `groupKey` damit Bündel sich ersetzen, `data.url`), `pushsubscriptionchange` → neu registrieren.
- `notify()`: pro Empfänger Einstellungen + Ruhezeit prüfen, `web-push` senden, 404/410 → Abo löschen, `pushedAt` setzen. Versand asynchron (nicht die Server-Action blockieren).
- Doppelte Anzeige vermeiden: bei offenem, sichtbarem Tab reicht Toast; SW zeigt Push nur, wenn kein sichtbarer Client (`clients.matchAll`).
- Badging API (`navigator.setAppBadge`) mit Zähler der offenen Einträge.
- NetworkPolicy: ausgehend HTTPS zu Push-Diensten (FCM, Mozilla, Apple `*.push.apple.com`) erlauben.

### Phase 6 – Einstellungen

- Profilbereich „Benachrichtigungen“ (Matrix, Geräte, Test-Push, Ruhezeit, Installationshinweis).
- Einmaliger Hinweis nach Login „Push aktivieren?“ (nur bei unterstützten Geräten, wegklickbar).

### Phase 7 – E2E und Release

- E2E auf Staging (Test-Login), Push im Headless-Chromium über gemockte Subscription testen, iOS manuell.
- Release-Notes, Prod-Migration prüfen, VAPID-Secret Prod.

## Risiken

- **iOS**: Push nur als installierte App; Nutzer müssen das aktiv tun → gute Anleitung nötig.
- **SW-Umstellung**: falscher Scope/alte Registrierung kann Scanner-Offline brechen → auf Staging mit Scanner testen.
- **Push-Spam**: Standard eher zurückhaltend, Bündelung über `tag`.
- **Datenschutz**: Push-Inhalte laufen über Google/Apple/Mozilla; Text knapp halten (keine Absagegründe im Push, nur „Neue Absage für Probe Sa“).

## Checkliste

- [x] Phase 1 – Typen-Registry, Migration, `notify()`, Erzeuger umgestellt (zusätzlicher Typ `casting`; Alt-Aktionen, die gelesen sind, gelten als erledigt)
- [x] Phase 2 – API (Abschnitte, Gruppen, read/done/archive, Cleanup): `GET /api/notifications` (section, category, archived, cursor, limit → items, groups, counts, nextCursor; altes Feld `notifications` bleibt bis Phase 3), ein Endpunkt `POST /api/notifications/state` statt drei, Logik in `lib/notifications/inbox.ts`; Gewerke-Anfragen und Fotoerlaubnisse werden beim Bearbeiten für alle erledigt; Archiv-Löschung nach 90 Tagen beim Laden (kein CronJob)
- [x] Phase 3 – Glocken-UI + Seite + E2E/Screenshots (Zähler je Bündel statt je Eintrag; Neues gilt beim Schließen der Glocke als gelesen; Suche `q`; alte Endpunkte `/read` und `/cleanup` entfernt; Gewerke-Anfragen per `decideJoinRequestAction` nur, solange offen; Einstellungs-Zahnrad folgt mit Phase 6)
- [x] Phase 4 – PWA (Manifest, Icons, ein SW, Offline-Shell, Install-Hinweis): `app/manifest.ts`, Icons per `next/og` aus dem Logo (`/pwa-icons/*`, `apple-icon`, keine Binärdateien), `notification-click` in `service-worker.js`, `notification-sw.js` lädt nur noch diesen, statische `offline.html` statt App-Shell-Cache, Installationshinweis im Dashboard (pro Gerät ausblendbar, iOS mit Anleitung). Scanner-Manifest entfällt (Scanner-Seite gibt es nicht mehr). Nebenbei: SW brach ohne Workbox-Dateien mit ReferenceError ab (CI-Log).
- [x] Phase 5 – Web Push (VAPID/Vault, Subscriptions, Versand, NetworkPolicy): Code fertig – `PushSubscription`, `NotificationPreference` (Standard: Push nur für Dringendes und Aufgaben), `lib/notifications/push.ts` (abgelaufene Abos 404/410 werden gelöscht, `pushedAt`, App-Badge), `/api/push/subscription` + `/api/push/test`, `push`/`pushsubscriptionchange` im SW, Aktivieren über den Hinweis in der Glocke. Push-Texte ohne Absagegründe/Fotoerlaubnis-Details. NetworkPolicy nicht nötig (Website-Namespaces ohne Policies). VAPID in Vault, ExternalSecret `theater-website-push` (Config-Theaterserver 8826f74), auf Android getestet. Nebenbei behoben: Realtime-Events gingen an `/realtime/realtime/events` (404), Live-Meldungen kamen nie an (7206ed1e).
- [x] Phase 6 – Einstellungen: Profil-Bereich `?bereich=benachrichtigungen` (dieses Gerät ein/aus + Test, Push je Bereich, Ruhezeit, Geräteliste), Zahnrad in der Glocke. Regel vereinfacht: Aufgaben und Dringendes immer, Schalter nur für übrige Hinweise; Ruhezeit hält alles außer Dringendem zurück. E-Mail je Bereich bewusst nicht angeboten (Spalte vorhanden, kein Versand dahinter).
- [ ] Phase 7 – E2E, Release
