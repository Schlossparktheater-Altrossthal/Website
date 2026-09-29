# Plan: Vorzeitige Termin-Erinnerungen (individuell einstellbar)

Stand: 2026-09-29. Phase 1 umgesetzt, Phase 2–6 offen. Checkliste am Ende wird gepflegt.

## Ziel

1. Jedes Mitglied erhält für jeden sichtbaren, fest angesetzten Termin, an dem es beteiligt ist
   (nicht abgesagt, am Termintag nicht gesperrt), automatisch eine Erinnerung per In-App-Glocke und
   Web-Push.
2. Die Vorlaufzeit ist im eigenen Profil unter „Benachrichtigungen" einstellbar:
   Nie / 1 h / 2 h / 12 h / 1 Tag (Standard) / 2 Tage / 3 Tage / 7 Tage.
3. Bezugszeitpunkt ist die persönliche Zeit der gestaffelten Probe (`personalStart`), sonst der
   Terminbeginn (`start`).
4. Kein Doppelversand: Erinnerungen sind idempotent und laufen über einen Cron-Job.

## Nicht in diesem Plan

- E-Mail-Versand. Die Benachrichtigungs-Pipeline sendet In-App + Web-Push; ein E-Mail-Kanal wäre ein
  eigener, größerer Aufwand.
- Vorlaufzeit je Termin (nur global je Nutzer).
- Tageszusammenfassung (eine Nachricht je Tag statt je Termin) – bleibt optionale spätere Phase.
- Änderungen an der Teilnahme- und Absage-Logik.

## Ist-Stand (Befunde)

| #   | Befund                                                                                             | Stelle                                                                   |
| --- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 1   | `notify()` legt eine Benachrichtigung an und stellt Realtime + Web-Push zu (kein E-Mail).          | `src/lib/notifications/notify.ts:160`, `:117`                            |
| 2   | Benachrichtigungstypen sind zentral registriert; ein unbekannter Typ bricht den Versand ab.        | `src/lib/notifications/types.ts:23`, `:51`                               |
| 3   | Kanalwahl je Kategorie und Ruhezeit je Nutzer sind vorhanden.                                      | `prisma/schema.prisma:1351`, `:1363`                                     |
| 4   | `shouldPush()` pusht nur bei `urgent`, `action` oder aktivem Kategorie-Schalter (Standard: aus).   | `src/lib/notifications/preferences.ts:27`                                |
| 5   | `isInQuietHours()` unterdrückt Push in der Ruhezeit.                                               | `src/lib/notifications/preferences.ts:47`                                |
| 6   | Einstellungs-API mit `requireAuth` und zod-Union (Kategorie / Ruhezeit).                           | `src/app/api/notifications/preferences/route.ts:35`                      |
| 7   | Profil-Bereich „Benachrichtigungen" als Client-Bereich mit Cards.                                  | `src/app/(members)/mitglieder/profil/sections/notifications-section.tsx` |
| 8   | Cron-Stub `/api/cron/rehearsal-reminders` liefert nur `{ status: "disabled" }`.                    | `src/app/api/cron/rehearsal-reminders/route.ts:12`                       |
| 9   | Sauberes Cron-Muster mit Header-Auth und `GET`→`POST`.                                             | `src/app/api/cron/server-analytics/route.ts:6`                           |
| 10  | `EventParticipant` hält Einladung und Antwort je Person (`response`, `personalStart`).             | `prisma/schema.prisma:1073`                                              |
| 11  | `BlockedDay` hält genau einen Eintrag je Person und Tag (`kind` BLOCKED/LIMITED/EMERGENCY).        | `prisma/schema.prisma:1124`                                              |
| 12  | `readDayAvailability()` filtert Sperren auf BLOCKED/LIMITED.                                       | `src/lib/calendar/day-availability.ts:8`                                 |
| 13  | Empfänger eines Termins werden in drei Zweigen aufgelöst: persönlich, Gewerk, „Für alle".          | `src/lib/calendar/my-events.ts:129`, `:169`, `:200`                      |
| 14  | Es gibt kein Tracking für gesendete Erinnerungen.                                                  | –                                                                        |
| 15  | `docs/email-reminders.md` beschreibt ein nie implementiertes SendGrid-Feature und ist irreführend. | `docs/email-reminders.md`                                                |

## Zielbild

### Datenmodell

- `NotificationSettings.reminderLead String?` — Code der Vorlaufzeit
  (`never | 1h | 2h | 12h | 1d | 2d | 3d | 7d`). Ohne Eintrag gilt der Standard `1d`. Der
  Standardwert steht als Konstante in `src/lib/notifications/preferences.ts`, nicht im Schema.
- Neues Modell `EventReminderDispatch` mit `eventId`, `userId`, `lead`, `sentAt` und
  `@@unique([eventId, userId])` sowie Indizes; Relationen mit `onDelete: Cascade`. Zweck:
  Idempotenz (kein Doppelversand und kein Neuversand nach Änderung der Einstellung).
  `NotificationRecipient.pushedAt` reicht dafür nicht (nur Push-Marker, nicht je Erinnerung).
- Neuer Benachrichtigungstyp `EVENT_REMINDER: "event-reminder"` in `NOTIFICATION_TYPES` und
  `NOTIFICATION_TYPE_META` (Default-Kategorie `termine`, `kind: info`, `priority: normal`);
  die Kategorie wird zur Laufzeit je Terminart über `categoryForEventKind()` bestimmt.
- Zentrale Optionsliste `EVENT_REMINDER_LEADS` (Code, Label, Minuten) und
  `DEFAULT_REMINDER_LEAD = "1d"` in `src/lib/notifications/preferences.ts`.

### Versandlogik

Neues Modul `src/lib/notifications/event-reminders.ts` (außerhalb `app/`, damit kein
`"use server"`-Konflikt entsteht) mit einer Funktion `runEventReminderDispatch({ now })`, die eine
Zusammenfassung `{ sent, skipped, failed }` zurückgibt.

- Kandidaten-Ermittlung spiegelt die drei Zweige aus `readMyUpcomingEvents`, aber termin-zentriert:
  1. persönliche Einladungen über `EventParticipant.invited: true`,
  2. Gewerk-Termine über `department.memberships` mit `currentDepartmentMembershipWhere()`,
  3. „Für alle" über `GENERAL_EVENT_WHERE` und `visibleGeneralEventWhere` ohne Zielgruppe.
- Filter: Termin `status: SCHEDULED` (kein TENTATIVE, kein CANCELLED), `start` im Fenster
  `(now, now + 7 Tage]`, Antwort nicht `no`/`emergency`, am Termintag nicht gesperrt (nur BLOCKED
  schließt aus, LIMITED bleibt erlaubt).
- Fälligkeit: `remindAt = (personalStart ?? start) - lead`. Gesendet wird, wenn `now >= remindAt`
  und `now < (personalStart ?? start)` und noch kein `EventReminderDispatch`-Eintrag existiert.
- Versand über `notify()` mit `eventId`, `groupKey = reminder:<eventId>` und `actionUrl` auf die
  Terminseite; je (Termin, Vorlaufzeit) eine Benachrichtigung mit allen fälligen Empfängern.
- Nutzer mit Einstellung `never` werden übersprungen (kein In-App, kein Push).
- Die Ruhezeit wird respektiert: Die Priorität bleibt `normal` (kein `urgent`), der Push wird in der
  Ruhezeit unterdrückt, der Glocken-Eintrag entsteht trotzdem.
- Push-Freigabe: `shouldPush()` wird um den Benachrichtigungstyp erweitert, damit eine Erinnerung
  nicht zusätzlich am Kategorie-Schalter hängt (die Vorlaufzeit-Einstellung ist das Opt-in).

### Cron

- Die Route `src/app/api/cron/rehearsal-reminders/route.ts` wird vom Stub auf echtes Verhalten
  umgestellt; der Pfad bleibt bestehen, damit ein bereits deployter Cron-Job unverändert darauf
  zeigen kann. Auth-Muster aus `server-analytics` übernehmen, `GET` und `POST`, strukturiertes
  Logging über `createLogger`.
- Die Taktung liegt außerhalb dieses Repos (im `k8s-infrastructure`-Projekt): statt täglich um 9:00
  künftig mindestens stündlich, empfohlen alle 15 Minuten (wegen der 1-h- und 2-h-Vorlaufzeiten).
  Die Änderung wird hier dokumentiert, im k8s-Repo umgesetzt.

### Oberflächen (mobil zuerst)

- Neue Card „Erinnerungen" im Profil-Bereich „Benachrichtigungen"
  (`src/app/(members)/mitglieder/profil/sections/notifications-section.tsx`) mit einem `Select`
  („Erinnerung … vorher"); Muster wie
  `src/app/(members)/mitglieder/sperrliste/settings-manager.tsx:270` (Select für vier und mehr
  Optionen). Optionen: Nie, 1 Stunde, 2 Stunden, 12 Stunden, 1 Tag (Standard), 2 Tage, 3 Tage,
  7 Tage.
- Persistenz über `PUT /api/notifications/preferences`: die zod-Union wird um einen Zweig
  `{ reminderLead }` erweitert, `GET` liefert `reminderLead` mit.

## Phasen

1. **Datenmodell und Konstanten** — `NotificationSettings.reminderLead`, `EventReminderDispatch`,
   Migration und `pnpm prisma:generate`; Benachrichtigungstyp `EVENT_REMINDER`; `EVENT_REMINDER_LEADS`
   und `DEFAULT_REMINDER_LEAD`. Ergebnis: Migration läuft durch, Typcheck grün.
2. **Einstellung (API und Profil-UI)** — zod-Union und `GET` erweitern; `Select` im Profil-Bereich
   „Benachrichtigungen". Ergebnis: Auswahl speichern und nach Reload wiederlesen; Screenshots in
   Handy/Tablet/Desktop, hell und dunkel.
3. **Empfänger- und Fälligkeitslogik** — `event-reminders.ts` mit Kandidaten, Sperr-Filter und
   Fälligkeit; Unit-Tests mit Fixtures. Ergebnis: Vitest grün.
4. **Versand und Idempotenz** — `notify()`-Aufruf, Dispatch-Log, Erweiterung von `shouldPush()`.
   Ergebnis: ein zweiter Lauf sendet nichts erneut.
5. **Cron-Route aktivieren** — Stub ersetzen, Auth und Logging. Ergebnis: Aufruf mit und ohne
   `x-cron-secret` verhält sich korrekt; Testabdeckung vorhanden.
6. **Doku und Betrieb** — neuer Plan und Index; `docs/seiten/benachrichtigungen.md`,
   `docs/seiten/profil.md`, `docs/Plan/benachrichtigungen-plan.md` (Phase 6 und Entscheidungen),
   `docs/datenmodell.md` (generiert), `docs/email-reminders.md` korrigieren; k8s-Taktung
   dokumentieren. Ergebnis: `pnpm lint`, `pnpm format:check`, `pnpm test` und `pnpm build` grün.

## Entscheidungen (2026-09-29)

- E1: Kanal In-App + Push. Kein E-Mail-Versand (im Benachrichtigungssystem nicht vorhanden).
- E2: Einstellung global je Nutzer im Profil „Benachrichtigungen", Option „Nie" ausdrücklich dabei.
  Kein Override je Termin.
- E3: Empfänger sind beteiligte Personen ohne Absage (`no`/`emergency`) und ohne Sperre am Termintag.
  Auch wer noch nicht geantwortet hat, wird erinnert.
- E4: Bezugszeit ist `personalStart ?? start`.
- E5: Alle sichtbaren Terminarten (Proben, „Für alle", Gewerk-Termine, sonstige Termine).
- E6: Vorgemerkte Termine (TENTATIVE) lösen keine Erinnerung aus.
- E7: Die Ruhezeit wird respektiert (Push gegebenenfalls unterdrückt; Glocken-Eintrag bleibt).
- E8: „Eingeschränkt" (LIMITED) wird erinnert; nur „gesperrt" (BLOCKED) schließt aus.
- E9: Eine Erinnerung pusht unabhängig vom Kategorie-Schalter Proben/Termine; die Vorlaufzeit ist
  das Opt-in. `shouldPush()` wird dafür um den Benachrichtigungstyp erweitert.
- E10: Der bestehende Cron-Pfad `/api/cron/rehearsal-reminders` wird weiterverwendet, damit ein
  vorhandener Cron-Job unverändert bleibt; nur die Taktung ändert sich.
- E11: Eine Nachricht je Termin. Eine Tageszusammenfassung bleibt optionale spätere Phase.

## Checkliste

- [x] Phase 1 Datenmodell und Konstanten
- [ ] Phase 2 Einstellung (API und Profil-UI)
- [ ] Phase 3 Empfänger- und Fälligkeitslogik
- [ ] Phase 4 Versand und Idempotenz
- [ ] Phase 5 Cron-Route aktivieren
- [ ] Phase 6 Doku und Betrieb
