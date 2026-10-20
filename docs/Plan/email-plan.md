# Plan: E-Mail modernisieren (Versand, Vorlagen, Kanal in den Benachrichtigungen)

Stand: 2026-10-20. Phase 1–5 umgesetzt, offen Phase 6 (Secret) und 7. Checkliste am Ende wird gepflegt.

## Ziel

1. Mails kommen **zuverlässig** an: Warteschlange mit Wiederholung, Fehler werden sichtbar.
2. Mails sehen nach Theater aus: **HTML-Layout** mit Knopf, dazu immer eine Textfassung.
3. E-Mail ist ein **dritter Kanal** neben Glocke und Push – jede Person wählt selbst, mit
   Abmeldelink in jeder Mail.
4. Die **Admin-Seite** zeigt zuerst den Zustand (läuft der Versand?), nicht einen Assistenten.
5. SMTP-Zugang bevorzugt aus dem **Secret**; ohne Secret weiter in der Oberfläche einstellbar.

## Ist-Stand (Befunde)

| #   | Befund                                                                                                    | Stelle                                                                                |
| --- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 1   | Nur Text-Mails, jede Stelle baut Anrede/Gruß/Fußzeile selbst                                              | `lib/email/send.ts`, `lib/karten/mails.ts`, `lib/calendar/decline-notifications.ts` … |
| 2   | Kein Puffer: SMTP kurz weg = Mail verloren, niemand merkt es                                              | `createConfiguredMailSender()`                                                        |
| 3   | E-Mail fehlt in den Benachrichtigungs-Einstellungen (`NotificationPreference.email` existiert, unbenutzt) | `profil/sections/notifications-section.tsx`, `lib/notifications/notify.ts`            |
| 4   | Kein Abmeldelink, kein `List-Unsubscribe`                                                                 | –                                                                                     |
| 5   | Admin-Seite: Assistent in 3 Schritten, kein Status, keine Testmail an echte Adresse, kein Verlauf         | `mitglieder/server-einstellungen/*`                                                   |
| 6   | SMTP-Passwort nur in der DB                                                                               | `ServerSettings.mailPassword`                                                         |

## Entscheidungen

- **Konfiguration:** ENV `MAIL_HOST`, `MAIL_PORT`, `MAIL_SECURE`, `MAIL_USERNAME`, `MAIL_PASSWORD`,
  `MAIL_FROM_ADDRESS`, `MAIL_FROM_NAME`, `MAIL_REPLY_TO` (aus Vault per ExternalSecret). Ist
  `MAIL_HOST` gesetzt, gilt der Server-Block aus ENV, die Seite zeigt ihn nur an („aus Secret“).
  Absenderfelder gelten einzeln: ENV vor DB. Ohne ENV bleibt alles wie bisher in der Oberfläche.
- **Testmail geht immer**, auch mit `MAIL_DISABLED` (Staging): sie geht nur an die eigene Adresse
  des Admins und umgeht die Notbremse bewusst.
- **Eigenes kleines HTML-Layout** (Tabellen, Inline-Styles, Escaping) statt React Email: wenige
  Vorlagen, keine weitere Abhängigkeit, Text- und HTML-Fassung aus denselben Bausteinen.
- **Outbox:** Jede Mail wird zuerst in `MailOutbox` gespeichert und sofort versucht. Fehlschlag →
  Wiederholung im bestehenden Cron (`/api/cron/rehearsal-reminders`, alle paar Minuten) mit
  Backoff 5 min, 30 min, 2 h, 6 h; danach `failed`. `MAIL_DISABLED` → Status `blocked`. Inhalte
  werden nach 30 Tagen gelöscht (Datensparsamkeit), die Zeile bleibt für die Statistik.
- **E-Mail-Kanal:** Dringendes (`urgent`) und Aufgaben (`action`) kommen **immer sofort** per Mail
  (wie bei Push). Übrige Hinweise je Bereich: **Zusammenfassung** (Standard), **Sofort** oder
  **Aus**. Zusammenfassung täglich (Standard, 18 Uhr) oder wöchentlich (Montag) oder aus; sie
  enthält nur, was bis dahin **ungelesen** ist. Ruhezeit gilt nicht für Mail.
- **Abmelden:** signierter Link je Person (HMAC mit `NEXTAUTH_SECRET`), Seite
  `/email/abmelden` + RFC 8058 One-Click (`List-Unsubscribe-Post`). Abmelden stellt die
  Zusammenfassung ab; Dringendes/Aufgaben bleiben (Hinweis auf der Seite).
- Transaktionsmails (Karten, Einladungen, Fotoerlaubnis-Erinnerung) laufen über Layout + Outbox,
  aber ohne Abmeldelink – sie sind keine Benachrichtigungen.

## Datenmodell

```prisma
model MailOutbox {
  id          String    @id @default(cuid())
  kind        String    // test | notification | digest | karten | einladung | fotoerlaubnis | system
  toAddress   String
  userId      String?
  subject     String
  text        String?   // nach 30 Tagen null
  html        String?
  headers     Json?
  status      String    @default("pending") // pending | sent | failed | blocked
  attempts    Int       @default(0)
  nextAttemptAt DateTime @default(now())
  lastError   String?
  sentAt      DateTime?
  createdAt   DateTime  @default(now())
}

model NotificationPreference { … emailMode String? } // instant | digest | off; null = digest
model NotificationSettings  { … digest String?; digestSentAt DateTime? } // daily | weekly | off
model NotificationRecipient { … emailedAt DateTime? } // nie doppelt mailen (sofort oder Zusammenfassung)
```

## Phasen

1. **Mail-Kern:** ENV-Konfiguration, `MailOutbox` + `sendMail()`/`queueMail()`, Wiederholung im
   Cron, HTML-Layout. `createConfiguredMailSender()` nutzt intern den neuen Weg (Aufrufer
   unverändert).
2. **Admin-Seite neu:** Statuskarte (Quelle, Server, letzte erfolgreiche Mail, Fehler 7 Tage),
   „Testmail an mich“, Versandverlauf (letzte 50, Filter Fehler), Bearbeiten nur ohne Secret
   (kompaktes Formular statt Assistent, „Automatisch erkennen“ bleibt).
3. **Bestehende Mails ins Layout:** Karten, Absagen, Einladungen/Onboarding, Fotoerlaubnis.
4. **E-Mail-Kanal in `notify()`** + Profil-Einstellungen (je Bereich Sofort/Zusammenfassung/Aus,
   Rhythmus der Zusammenfassung) + Zusammenfassung im Cron.
5. **Abmelden** (Seite + One-Click + Header).
6. **Secret:** Vault-Pfad + ExternalSecret in `Config-Theaterserver` (User im manuellen Modus),
   `.env.example`/README.
7. **Abschluss:** Tests, Screenshots, E2E, Release.

## Checkliste

- [x] Phase 1 Mail-Kern
- [x] Phase 2 Admin-Seite
- [x] Phase 3 Bestehende Mails
- [x] Phase 4 E-Mail-Kanal + Zusammenfassung
- [x] Phase 5 Abmelden
- [ ] Phase 6 Secret
- [ ] Phase 7 Abschluss/Release

## Umsetzungsnotizen

- Absagen an die Planung (`decline-notifications.ts`) liefen früher als eigene Mail; jetzt über
  `notify({ emailInstant: true })` – weiter sofort, aber mit „Aus“ abschaltbar.
- Altbestand-Mails (Karten) laufen über `renderPlainTextMail()`: Textfassung bleibt Wort für Wort,
  HTML erkennt Anrede, Link-Absatz → Knopf, „Feld: Wert“ → Tabelle, „- “ → Liste.
- Testtypen (`test`, `test-emergency`) gehen nie per Mail.
- Abmelden per GET meldet nicht ab (Link-Scanner), erst der Knopf bzw. One-Click-POST.
- Zusammenfassung nimmt nie Hinweise von vor dem Release (Zeitpunkt der Migration `20261020100000_mail_outbox` aus `_prisma_migrations`) – kein Schwall Altlasten beim ersten Lauf.
