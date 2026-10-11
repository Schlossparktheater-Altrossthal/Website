# Plan: Kartenbuchung – Reservierung, Kartenbüro, Freikarten, Einlass

Stand: 2026-10-11. Phase 1–7 umgesetzt und lokal (Demo-Daten) durchgespielt, offen Phase 8 (E2E, Staging, Release).

## Ziel

Zuschauer reservieren über die Website Karten für eine Vorstellung (Anzahl je Kategorie), bestätigen
per Mail und erhalten erst dann ihr Ticket. Die Sekretärin nimmt Telefonreservierungen in einem
schnellen Arbeitsablauf an, ohne vollwertiges Konto. Mitwirkende melden ihre Freikarten an. Am
Vorstellungsabend gibt es einen Einlass mit QR-Scan, Namenssuche und Zähler, auch bei schlechtem
Netz. Bezahlung ist vorbereitet (Preise, Zahlstatus), läuft aber vorerst an der Abendkasse.

## Ist-Stand

| #   | Befund                                                                                    | Stelle                                  |
| --- | ----------------------------------------------------------------------------------------- | --------------------------------------- |
| 1   | Vorstellungen sind Termine `CalendarEvent` mit `kind = PERFORMANCE` an der `Show`         | `prisma/schema.prisma`                  |
| 2   | Mitwirkende einer Produktion: `ProductionMembership`                                      | `prisma/schema.prisma`                  |
| 3   | Altes `Ticket`/`TicketScanEvent` mit losem `eventId`, ohne Oberfläche                     | `src/lib/tickets`, `api/ticket/checkin` |
| 4   | Mailversand nur Text über `createConfiguredMailSender`                                    | `src/lib/email/send.ts`                 |
| 5   | QR-Scanner im Lager (Vollbild, mobil)                                                     | `src/components/inventory`              |
| 6   | Website (Drupal) hat keine Buchung; Webform passt nicht (Kapazität, Bestätigung, Einlass) | Theme                                   |

## Entscheidungen (2026-10-11)

- K1: Das System lebt im **Mitgliederbereich**; öffentliche Buchung unter dem Pfad **`/karten`**
  (kein Login). Drupal zeigt Vorstellungen mit Restplätzen und verlinkt dorthin.
- K2: **Freie Platzwahl**, keine Saalpläne. Kapazität je Vorstellung.
- K3: **Kategorien sind pro Produktion bearbeitbar** (Name, Hinweis, Preis, „braucht Platz“ – z. B.
  Kleinkind auf dem Schoß zählt nicht).
- K4: Eine Buchung = **ein Name** (Bestellende) + Anzahl je Kategorie + **ein QR-Code** für alle
  Karten. Kein Name pro Einzelkarte.
- K5: Online-Buchungen sind **vorläufig**, bis der Link in der Mail bestätigt ist; sie halten die
  Plätze nur befristet (Standard 2 h) und verfallen dann. Der Bestätigungslink öffnet eine Seite mit
  Knopf (POST) – Mail-Scanner, die Links vorab aufrufen, bestätigen so nicht versehentlich.
- K6: Jede Mail enthält den **Link zum Ändern/Stornieren** (Token, kein Konto).
- K7: Bezahlung: Preis je Kategorie und `paymentStatus` (offen/bezahlt/frei) werden gespeichert,
  Zahlung vorerst an der Abendkasse.
- K8: **Kartenbüro-Zugang** ohne Konto: persönlicher Link per Mail (Token, nur Hash in der DB),
  befristet und sperrbar; setzt ein httpOnly-Cookie. Sieht nur die Kartenverwaltung, optional den
  Einlass. Mitglieder mit Recht nutzen dieselbe Oberfläche im Mitgliederbereich.
- K9: Telefonbuchungen gelten **sofort als bestätigt**; Ticket per Mail nur, wenn Adresse angegeben.
- K10: **Freikarten**: Kontingent pro Produktion (Standard 2), pro Person überschreibbar; Anmeldung
  auf Namen für eine Vorstellung, zählt gegen die Kapazität; optionale Anmeldefrist.
- K11: **Abendkasse** verkauft ohne Namen – nur ein Zähler (Buchung mit Quelle `box_office`, sofort
  eingelassen). Kontingente pro Vorstellung: online-Grenze und Reserve für die Abendkasse.
- K12: **Einlass**: QR-Scan oder Namenssuche, teilweises Einchecken (3 von 5), Live-Zähler
  anwesend/erwartet/frei; Gästeliste wird lokal vorgehalten, Check-ins werden bei Netzausfall
  gepuffert und idempotent nachgereicht. Das alte `Ticket`-Modell wird nicht genutzt.
- K13: Gastdaten werden nach der Saison automatisch gelöscht (Standard 90 Tage nach der letzten
  Vorstellung); Statistik bleibt anonym erhalten.

## Datenmodell

```
TicketingSettings     showId @unique, enabled, holdMinutes=120, maxSeatsPerBooking=10,
                      freeTicketsPerMember=2, freeTicketDeadline?, infoText?, retentionDays=90
TicketCategory        showId, name, description?, priceCents, needsSeat=true, sortOrder,
                      isActive, onlineBookable=true
PerformanceTicketing  eventId @unique (CalendarEvent PERFORMANCE), capacity, onlineLimit?,
                      boxOfficeReserve=0, salesOpen=true, salesEndAt?
Reservation           code @unique (kurz, lesbar), tokenHash @unique (Mail-Link),
                      eventId, showId, source (online|phone|free_ticket|box_office),
                      status (pending|confirmed|cancelled|expired),
                      name, email?, phone?, note?, internalNote?,
                      seats (Summe needsSeat), totalCents, paymentStatus (open|paid|free),
                      holdUntil?, confirmedAt?, cancelledAt?, cancelReason?,
                      checkedInCount=0, memberId? (Freikarte), createdByUserId?,
                      createdByAccessId?, reminderSentAt?, anonymizedAt?
ReservationItem       reservationId, categoryId?, label (Momentaufnahme), quantity,
                      unitPriceCents, needsSeat
ReservationCheckIn    reservationId, delta (±n), clientMutationId @unique, deviceLabel?,
                      byUserId?, byAccessId?, occurredAt
FreeTicketAllowance   showId, userId, quantity          @@unique([showId, userId])
BoxOfficeAccess       showId?, name, email, tokenHash @unique, canCheckIn, expiresAt,
                      revokedAt?, lastUsedAt?, createdById
WaitlistEntry         eventId, name, email, seats, status (waiting|notified|done), notifiedAt?
```

Belegte Plätze = Summe `seats` aller Buchungen `confirmed` oder `pending` mit `holdUntil > now`.
Buchen läuft in einer Transaktion mit Zeilensperre auf `PerformanceTicketing` (`FOR UPDATE`), damit
zwei gleichzeitige Buchungen die Kapazität nicht überschreiten.

## Rechte

- `PRIVATE.TICKETS.MANAGE` – Einstellungen, Kategorien, Vorstellungen, Kartenbüro-Zugänge,
  alle Buchungen.
- `PRIVATE.TICKETS.OFFICE` – Kartenbüro: Buchungen anlegen, ändern, stornieren.
- `PRIVATE.TICKETS.CHECKIN` – Einlass und Abendkasse.
- Freikarten: alle aktiven Mitwirkenden der Produktion (kein eigenes Recht).

## Oberflächen

- **Öffentlich `/karten`**: Produktion mit Vorstellungen (Datum, Restplätze, „ausverkauft“ →
  Warteliste), Formular mit Stepper je Kategorie, Name, Mail, Telefon optional, Hinweis,
  Datenschutz-Haken. Danach „Bitte bestätige per Mail“.
- **`/karten/r/[token]`**: Bestätigen-Knopf, danach Ticket mit QR-Code (druckbar), Ändern
  (Anzahl verringern, Vorstellung wechseln) und Stornieren.
- **Kartenbüro `/mitglieder/karten` bzw. `/kartenbuero`**: ein Bildschirm, tastaturbedienbar –
  Vorstellung wählen (Restplätze sichtbar), Schnellerfassung (Name → Anzahlen → Telefon → Enter),
  Liste mit Suche nach Name/Telefon/Code, Zeile aufklappen zum Ändern/Stornieren/als bezahlt
  markieren/Ticket erneut senden.
- **Einstellungen `/mitglieder/karten/einstellungen`**: Kategorien, Kapazitäten je Vorstellung,
  Freikarten-Kontingent, Kartenbüro-Zugänge (Link per Mail senden, sperren).
- **Freikarten `/mitglieder/freikarten`**: eigenes Kontingent, Anmeldungen auf Namen.
- **Einlass `/mitglieder/karten/einlass` bzw. `/kartenbuero/einlass`**: Zähler oben, Scan-Knopf
  (Vollbild-Scanner), Suchfeld, Liste; Treffer → „x von n einlassen“; Abendkasse: Stepper je
  Kategorie → „verkauft“.

## Mails

1. Reservierung eingegangen → Bestätigungslink (gültig `holdMinutes`).
2. Bestätigt / Telefonbuchung → Ticket-Link, Code, Vorstellung, Anzahlen, Preis, Hinweis Abendkasse.
3. Geändert / storniert.
4. Erinnerung am Vortag.
5. Vorstellung abgesagt → Umbuchungsangebot (Link).
6. Warteliste: Platz frei.

## Phasen

- [x] Phase 1: Datenmodell, Rechte, Kapazitätslogik mit Tests, Einstellungen (Kategorien,
      Vorstellungen, Kontingente).
- [x] Phase 2: Öffentliche Buchung `/karten`, Bestätigung per Mail, Ticketseite mit QR,
      Ändern/Stornieren, Verfall unbestätigter Buchungen.
- [x] Phase 3: Kartenbüro (Mitglieder-Oberfläche + Zugangslinks für Externe), Schnellerfassung.
- [x] Phase 4: Freikarten für Mitwirkende.
- [x] Phase 5: Einlass (QR, Suche, teilweise, Zähler, Abendkasse, Offline-Puffer).
- [x] Phase 6: Drupal-Anbindung (öffentliche API mit Restplätzen, Block/Link auf der Website).
- [x] Phase 7: Absage + Umbuchung, Warteliste, Erinnerung, automatische Löschung.
- [ ] Phase 8: E2E, Staging-Abnahme, Release.

## Umsetzung (2026-10-11)

- Logik: `src/lib/karten/` (booking, access, checkin, maintenance, mails, queries).
- Seiten: `/karten`, `/karten/[showId]`, `/karten/r/[token]`, `/mitglieder/karten` (+ `/einlass`,
  `/einstellungen`), `/mitglieder/freikarten`, `/kartenbuero` (+ `/einlass`, `/zugang/[token]`).
- APIs: `/api/karten/einlass` (Liste + Offline-Sync), `/api/public/karten` (für Drupal).
- Cron: läuft im bestehenden Termin-Cron (`/api/cron/rehearsal-reminders`) mit.
- Drupal: SDC-Komponente `ticket-booking` („Kartenreservierung“) im Theme, z. B. auf `/vorstellungen`.
- Rechte nach dem Release vergeben: `PRIVATE.TICKETS.*` (Kategorie „Kartenverkauf“).
