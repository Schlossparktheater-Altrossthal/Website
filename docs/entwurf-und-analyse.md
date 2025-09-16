# Entwurfs- und Analysephase

## 1. Projektkontext & Ausgangslage
- Die Codebasis setzt auf **Next.js mit dem App-Router**, serverseitig gerenderten Komponenten und einem UI-Layer mit Tailwind-/Shadcn-Komponenten (vgl. u.a. `src/app/page.tsx`, `src/components/hero.tsx`).
- Der **Mitgliederbereich** liegt unter `src/app/(members)/mitglieder` und bietet bereits Authentifizierung via NextAuth, eine Übersicht zur nächsten Probe sowie ein Kalender-Modul für Probenzusagen.
- Persistente Daten werden über **Prisma** und eine PostgreSQL-Datenbank verwaltet (`prisma/schema.prisma`). Neben Nutzern, Proben und Anwesenheiten existieren bereits Modelle für Verfügbarkeiten, Aufgaben, Finanzen und Inventar.
- Das öffentliche Frontend fokussiert derzeit auf eine stimmungsvolle Landingpage mit Hero-Sektion und Teaser-Texten, jedoch ohne funktionale Features wie Countdown oder Reservierung.

## 2. Ziele & Erfolgskriterien
- Vollständige Abbildung der organisatorischen Prozesse (Probenplanung, Bühnenbau, Kostüm- und Catering-Logistik) innerhalb des Mitgliederbereichs.
- Steigerung der Datenqualität durch strukturierte Profile (Maße, Allergien, Rolleninformationen) und automatisierte Follow-ups.
- Zeitnahe Kommunikation über Benachrichtigungen und Kalenderfunktionen, inklusive intelligenter Sichtbarkeitsregeln je Rolle.
- Öffentliche Website mit klarer Dramaturgie bis zur Stückveröffentlichung: Countdown, monatliche Hinweise, Reservierungs-Flow.
- Nachweisbare Einhaltung von Datenschutzanforderungen (Datensparsamkeit, Zugriffskontrolle, Protokollierung von Änderungen).

## 3. Stakeholder & Personas

### 3.1 Interne Stakeholder
| Stakeholder | Interessen | Spezifische Anforderungen |
| --- | --- | --- |
| Schauspieler*innen & Ensemble | Lückenlose Planungssicherheit trotz wechselnder Verfügbarkeiten | Persönlicher Kalender für Blocker & Zusagen, Rollen- und Szenentracking, transparente Probenhistorie |
| Technik (Licht, Ton, Multimedia) | Frühzeitige Abstimmung, wer wann anwesend ist und welches Setup gebraucht wird | Dienst- & Einsatzpläne, technische Checklisten pro Probe, Notizen zu Szenenanforderungen |
| Bühnenbau & Requisiten | Aufgaben und Materialien priorisieren, Engpässe vermeiden | Aufgabenmanagement mit Materiallisten, Inventarstatus, Freigaben für Aus- und Rückgaben |
| Kostümteam | Kostüme, Änderungen, Budget im Blick behalten | Maße, Änderungen, Wasch-/Reparaturpläne, Ausleih-Tracking, Budgetzuordnung |
| Organisation & Produktionsleitung | Gesamtkoordination, Finanzen, Sponsor*innenpflege, Kommunikation | Übergreifende Dashboards, Rechteverwaltung, Budget- & Sponsorenreporting, Schnittstellen zu PR |
| ↳ Catering (Sub) | Allergien, Essenspläne, Helfer*innenplanung | Einsehbare Präferenzen & Allergielisten, Wochenpläne, Einkaufslisten |
| ↳ Presse & PR (Sub) | Öffentlichkeitsarbeit, Storytelling | Redaktionskalender, Content-Freigaben, Zugriff auf Medienassets |
| ↳ Sponsoring & Förderverein (Sub) | Sichtbarkeit, Vertragspflege | Sponsor*innen-Module mit Logoplatzierungen, Reporting, Vertrags- und Rechnungsablage |

### 3.2 Externe Stakeholder
| Stakeholder | Interessen | Spezifische Anforderungen |
| --- | --- | --- |
| Publikum | Informationen zu Aufführungen, Ticketzugang, das „Mysterium“-Erlebnis | Termine, Countdown, Reservierung & Follow-up-Kommunikation |
| Sponsoren & Förderverein | Sichtbarkeit und Ergebnisberichte | Eigener Info-Bereich, Reporting-Dashboards, Branding-Optionen |
| Schule/Institution | Reibungslose Organisation, Reputation | Veranstaltungsübersichten, Sicherheits- und Dokumentationsnachweise |
| Lieferanten & Partner (Technikverleih, Druckerei etc.) | Klare Anforderungen, rechtzeitige Abstimmung | Auftrags- & Lieferkalender, Ansprechpartner*innen, Dateiuploads |

## 4. Funktionale Anforderungen
### 4.1 Mitgliederbereich
1. **Profil & Stammdaten**
   - Erfassung von Körpermaßen (Körpergröße, Konfektionsgrößen, Schuhgröße) mit Änderungsverlauf.
   - Verwaltung von Allergien/Essenspräferenzen (Freitext + strukturierte Tags) mit Sichtbarkeit für Catering-Team.
   - Rollen- und Verantwortungsbereiche direkt im Profil anzeigen (aus `User.role` + zusätzliche Felder).
2. **Probenorganisation**
   - Sichtbarkeitslogik: Schauspieler*innen sehen maximal 4 Wochen im Voraus, andere Rollen alle Termine.
   - Anzeige "letzte Änderung" je Probe (Feld `updatedAt` existiert bereits) im UI.
   - Persönlicher Blocker-Kalender: Schauspieler*innen markieren Nicht-Verfügbarkeiten per Drag & Drop, automatisch abgeglichen mit vorgeschlagenen Probeterminen.
   - Zusage-Status mit Historie: jede Zu-/Absage erzeugt eine Logzeile inkl. Zeitpunkt, Nutzer*in und optionalem Kommentar; "Keine Reaktion" zählt als "geplant".
   - Planungsstatus je Probe: Entwurf (Template), Vorschlag (noch anpassbar), Final (veröffentlicht) mit eigener Farbe im Kalender.
   - Ankunftsplanung: Probenplaner*innen sehen, wer durch Blocker/Absagen eingeschränkt ist und können individuelle Calltimes festlegen.
   - Szenenbasierter Fokus: Proben werden mit Szenen-Templates verknüpft, sodass automatisch sichtbar ist, welche Szenen trotz Absagen geprobt werden können.
   - Nachbereitung & Statistik: Protokollierung, welche Szenen mit welchen Personen tatsächlich geprobt wurden, inklusive Dauer zur Berechnung von Szenen- und Personen-Statistiken.
   - Belastungsmetriken: automatische Hinweise, wenn Personen mehr als X Stunden in einem Zeitraum (z. B. Wochenende) eingeplant sind; Integration in die Planungsansicht.
   - "Emergency Button" zur kurzfristigen Absage inkl. Grund (Trigger für Notification & Statuswechsel).
   - Automatische Erinnerungs-Mails oder Dashboard-Banner für Personen ohne Zu-/Absage 48h vor Probe.
   - Übersicht "Nächste Probe" ergänzt um Rollenbedarf (`requiredRoles`) und Begründung.
3. **Bühnenbau & Material**
   - Verwaltung von Bühnenbau-Plänen inkl. Versionierung, Dateiuploads und Zuständigkeiten.
   - Aufgabenlisten nach Bereich (Bühnenbau, Technik, Kostüm) inkl. Status & Fälligkeitsdaten (`Task`-Modell nutzbar).
4. **Kommunikation & Benachrichtigungen**
   - E-Mail- und ggf. Slack/Matrix-Benachrichtigungen für neue Termine, Planänderungen, Notfallmeldungen.
   - Dashboard-Karte "Zuletzt passiert" mit letzten 5 relevanten Aktivitäten (Termine, ToDos, Dokumente).
5. **Verfügbarkeiten & Essensplanung**
   - Bestehende Verfügbarkeits-Templates (`AvailabilityTemplate`) im UI editierbar machen.
   - Essensplan-Modul: wöchentliche Planung, Zuweisung wer kocht, Sichtbarkeit für alle Mitglieder.

### 4.2 Öffentliche Website
- **Countdown zum Reveal**: dynamischer Timer basierend auf `Show.revealedAt`.
- **Reservierungssystem**: Formular mit Terminauswahl (aus `Show.dates`), Name, Kontakt, Ticketanzahl; Speicherung als neue Entität (z. B. `Reservation`).
- **Hinweise/Tipps**: Monatliche Inhalte bis zur Premiere, redaktionell pflegbar (z. B. `PublicHint`-Modell mit Veröffentlichungsdatum und Target-Monat).
- **Mystery-Route**: Nutzung der bestehenden `Clue`-Struktur zur gestaffelten Veröffentlichung von Rätseln.

### 4.3 Organisations-Module
- **Archiv**: Upload & Kategorisierung von Dokumenten, Fotos, Protokollen; differenzierte Berechtigungen.
- **Finanzen**: Erweiterung des `FinanceEntry`-Modells mit Budgetzuordnung, Genehmigungsstatus, Exportfunktionen.
- **Dienstplan**: Erstellung eines Schichtplans pro Vorstellung mit Zuordnung der Mitglieder; Integration mit Verfügbarkeiten.
- **ToDo-Listen**: Rollenbasierte Filter, Kommentarfunktion, Verlauf.

## 5. Nicht-funktionale Anforderungen
- **Sicherheit**: Rollenbasierte Zugriffskontrolle (RBAC) erweitert; sensible Daten verschlüsselt speichern (z. B. Allergien optional verschlüsseln).
- **Performance**: Caching von häufig genutzten Listen (Proben, Hinweise), Optimierung von Datenbankabfragen (Pagination, Indexe).
- **Robustheit**: Graceful Fallbacks bei API-Fehlern, Retry-Strategien für Benachrichtigungen.
- **Usability & Accessibility**: Responsives Design, Tastaturnavigation, ARIA-Attribute für interaktive Komponenten.
- **Compliance**: DSGVO-konformes Opt-in für Benachrichtigungen, Löschkonzepte für personenbezogene Daten.

## 6. Informations- & Datenmodell
### 6.1 Ist-Zustand
- `User`: zentrale Entität mit Rollen, Beziehungen zu Accounts, Sessions, Anwesenheiten, Aufgaben.
- `Rehearsal` & `RehearsalTemplate`: Planung & Automatisierung von Proben inkl. Priorität, Status, `updatedAt`-Timestamp.
- `AvailabilityDay` / `AvailabilityTemplate`: feingranulare Verfügbarkeiten.
- `Show`, `Clue`, `Guess`: Mystery- & Spiel-Mechanik für das öffentliche Rätsel.
- `FinanceEntry`, `Task`, `InventoryItem`, `Announcement`: organisatorische Module.

### 6.2 Erweiterungen (Vorschlag)

#### Profile & Öffentlichkeit
```prisma
model MemberProfile {
  id               String   @id @default(cuid())
  userId           String   @unique
  heightCm         Int?
  clothingTop      String?
  clothingBottom   String?
  shoeSizeEu       Decimal?
  notes            String?
  allergies        AllergyEntry[]
  dietaryPreference DietaryPreference?
  updatedBy        String?
  updatedAt        DateTime @updatedAt
  user             User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model AllergyEntry {
  id          String   @id @default(cuid())
  profileId   String
  label       String
  severity    String?
  notes       String?
  profile     MemberProfile @relation(fields: [profileId], references: [id], onDelete: Cascade)
}

model Reservation {
  id        String   @id @default(cuid())
  showId    String
  date      DateTime
  name      String
  email     String
  tickets   Int
  status    ReservationStatus @default(requested)
  createdAt DateTime @default(now())
  show      Show     @relation(fields: [showId], references: [id])
}

enum ReservationStatus {
  requested
  confirmed
  waitlisted
  cancelled
}

model StagePlan {
  id          String   @id @default(cuid())
  showId      String?
  title       String
  version     Int
  description String?
  fileUrl     String?
  visibility  Role[]
  createdBy   String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  show        Show?    @relation(fields: [showId], references: [id])
}
```
- Ergänzende Indizes: `@@index([showId, date])` für Reservierungen, `@@index([userId, updatedAt])` für Profile.
- Historisierung: optional separate `ProfileChangeLog`-Tabelle zur Nachverfolgung von Änderungen.

#### Probenkalender & Szenenplanung
```prisma
enum RehearsalLifecycleState {
  draft
  proposed
  confirmed
  completed
  cancelled
}

enum AttendanceStatus {
  planned
  confirmed
  declined
  tentative
}

model RehearsalTemplate {
  id              String   @id @default(cuid())
  title           String
  defaultLocation String?
  defaultDuration Int
  recurrenceRule  String? // z. B. iCal RRULE für "jeden Fr/So"
  scenes          RehearsalTemplateScene[]
}

model RehearsalTemplateScene {
  id          String   @id @default(cuid())
  templateId  String
  sceneId     String?
  title       String
  estimatedMin Int?
  notes       String?
  template    RehearsalTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)
  scene       Scene?            @relation(fields: [sceneId], references: [id])
}

model RehearsalSlot {
  id           String   @id @default(cuid())
  templateId   String?
  start        DateTime
  end          DateTime
  lifecycle    RehearsalLifecycleState @default(draft)
  location     String?
  notes        String?
  callTimePlan RehearsalCalltime[]
  participants RehearsalParticipant[]
  scenes       RehearsalScenePlan[]
  template     RehearsalTemplate? @relation(fields: [templateId], references: [id])
}

model RehearsalCalltime {
  id           String   @id @default(cuid())
  rehearsalId  String
  userId       String?
  roleId       String?
  callAt       DateTime
  note         String?
  rehearsal    RehearsalSlot @relation(fields: [rehearsalId], references: [id], onDelete: Cascade)
  user         User?         @relation(fields: [userId], references: [id])
  role         Role?         @relation(fields: [roleId], references: [id])
}

model RehearsalParticipant {
  id             String   @id @default(cuid())
  rehearsalId    String
  userId         String
  status         AttendanceStatus @default(planned)
  respondedAt    DateTime?
  responseSource String? // self, admin, import
  note           String?
  rehearsal      RehearsalSlot @relation(fields: [rehearsalId], references: [id], onDelete: Cascade)
  user           User          @relation(fields: [userId], references: [id])
  logs           RehearsalResponseLog[]
}

model RehearsalResponseLog {
  id            String   @id @default(cuid())
  participantId String
  previous      AttendanceStatus?
  next          AttendanceStatus
  changedAt     DateTime @default(now())
  changedBy     String
  comment       String?
  participant   RehearsalParticipant @relation(fields: [participantId], references: [id], onDelete: Cascade)
}

model AvailabilityException {
  id        String   @id @default(cuid())
  userId    String
  start     DateTime
  end       DateTime
  type      AvailabilityType @default(unavailable)
  reason    String?
  createdAt DateTime @default(now())
  createdBy String
  user      User     @relation(fields: [userId], references: [id])
}

enum AvailabilityType {
  unavailable
  available
  preferred
}

model Scene {
  id          String   @id @default(cuid())
  showId      String
  order       Int
  title       String
  estimatedMin Int?
  description String?
  roles       SceneRole[]
  show        Show     @relation(fields: [showId], references: [id], onDelete: Cascade)
}

model SceneRole {
  id        String   @id @default(cuid())
  sceneId   String
  roleId    String
  isPrimary Boolean @default(true)
  scene     Scene   @relation(fields: [sceneId], references: [id], onDelete: Cascade)
  role      Role    @relation(fields: [roleId], references: [id])
}

model RoleAssignment {
  id     String @id @default(cuid())
  roleId String
  userId String
  role   Role   @relation(fields: [roleId], references: [id])
  user   User   @relation(fields: [userId], references: [id])
}

model RehearsalScenePlan {
  id             String   @id @default(cuid())
  rehearsalId    String
  sceneId        String
  plannedOrder   Int
  plannedFocus   String?
  actualDuration Int?
  completedAt    DateTime?
  rehearsal      RehearsalSlot @relation(fields: [rehearsalId], references: [id], onDelete: Cascade)
  scene          Scene         @relation(fields: [sceneId], references: [id])
  stats          RehearsalSceneStatistic?
}

model RehearsalSceneStatistic {
  id             String   @id @default(cuid())
  rehearsalSceneId String @unique
  attendees      RehearsalStatisticAttendee[]
  fatigueScore   Float?
  notes          String?
  rehearsalScene RehearsalScenePlan @relation(fields: [rehearsalSceneId], references: [id], onDelete: Cascade)
}

model RehearsalStatisticAttendee {
  id          String   @id @default(cuid())
  statisticId String
  userId      String
  minutes     Int
  statistic   RehearsalSceneStatistic @relation(fields: [statisticId], references: [id], onDelete: Cascade)
  user        User                     @relation(fields: [userId], references: [id])
}

model MemberLoadSnapshot {
  id        String   @id @default(cuid())
  userId    String
  windowStart DateTime
  windowEnd   DateTime
  rehearsals  Int
  minutes     Int
  fatigueScore Float
  generatedAt DateTime @default(now())
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```
- Verknüpfung zu bestehenden `AvailabilityDay`-Einträgen bleibt bestehen; `AvailabilityException` ergänzt kurzfristige Blocker.
- `MemberLoadSnapshot` dient als Ausgangspunkt für Exhaustion-Metriken (z. B. Warnungen bei mehr als zwei Einsätzen pro Wochenende).
- Zusätzliche Indizes: `@@index([rehearsalId, sceneId])` auf `RehearsalScenePlan`, `@@index([userId, windowStart])` auf `MemberLoadSnapshot`.
- `RehearsalTemplateScene` erlaubt Szenen-Defaults pro Template, `RehearsalCalltime` sichert individuelle Calltimes mit optionaler Rollenbindung.

## 7. API- & Integrationsdesign
| Endpoint | Methode | Beschreibung | Auth |
| --- | --- | --- | --- |
| `/api/profile` | GET/PUT | Profilinformationen lesen/aktualisieren (inkl. Maße, Allergien) | Mitglieder |
| `/api/profile/allergies` | POST/DELETE | Allergie-Einträge anlegen/löschen | Mitglieder (Eigene Daten) |
| `/api/availability-exceptions` | GET/POST/DELETE | Blocker-Fenster im persönlichen Kalender pflegen | Mitglieder (Eigene Daten) |
| `/api/rehearsals/slots` | GET/POST | Probenentwürfe erstellen, Duplikate aus Templates anlegen | Produktionsleitung |
| `/api/rehearsals/:id` | PATCH | Statusübergänge (Entwurf → Vorschlag → Final), Ort/Zeit anpassen | Produktionsleitung |
| `/api/rehearsals/:id/responses` | POST | Zu-/Absagen oder "Tentative" melden, optional mit Kommentar | Rollen `cast`, `tech` |
| `/api/rehearsals/:id/calltime` | PUT | Individuelle Calltimes speichern | Produktionsleitung, Stage Management |
| `/api/rehearsals/:id/scenes` | PUT | Szenenplan aktualisieren (geplante Reihenfolge, Fokus) | Regie, Produktionsleitung |
| `/api/rehearsals/:id/statistics` | POST | Nachbereitung: tatsächliche Dauer, Anwesende, Notizen erfassen | Regie, Stage Management |
| `/api/rehearsals/load` | GET | Aggregierte Belastungsmetriken für Planungswarnungen abrufen | Produktionsleitung |
| `/api/rehearsals/:id/emergency` | POST | Notfall-Absage inklusive Nachricht, triggert Notifications | Rollen `cast`, `tech`, `board`, `admin` |
| `/api/notifications` | POST | Generische Benachrichtigungen versenden (E-Mail/Slack) | Admin/Board |
| `/api/stage-plan` | CRUD | Bühnenbau-Pläne verwalten, Dateiupload (S3/Blob) | Tech/Bühnenbau |
| `/api/reservations` | POST/GET | Reservierungen erfassen, Liste für Organisation | Öffentlich (POST), Board (GET) |
| `/api/hints` | GET | Öffentliche Hinweise gefiltert nach Datum | Öffentlich |

Integrationen:
- **E-Mail** via vorhandener NextAuth-Provider; für Notifications separate Queue (z. B. Resend, nodemailer) einplanen.
- **Kalender-Export** (iCal) für Proben & Dienstpläne als Langfrist-Ziel.

## 8. UI/UX-Konzepte
- **Mitglieder-Navigation**: Erweiterung des `MembersNav` um "Profil", "Bühnenbau", "Essensplan", "Benachrichtigungen"; Rollenspezifische Sichtbarkeit.
- **Profilseite**: Mehrteilige Form mit Tabs (Stammdaten, Maße, Allergien, Rollen). Inline-Validierung, Änderungs-Historie.
- **Probenkalender**: Farbcode für Lifecycle-Status (Entwurf/Vorschlag/Final), Drag-&-Drop für Blocker, Tooltip mit Calltimes, Szenenfokus und Zusagestatus.
- **Probenübersicht**: Badges für Änderungszeitpunkte, Hinweis-Panel für fehlende Rückmeldungen, "Emergency"-Button prominent aber geschützt (Confirm-Dialog), Nachbereitungs-Drawer zur Dokumentation geprobter Szenen.
- **Szenenplanung**: Board-Ansicht zur Zuordnung von Rollen zu Szenen inkl. Filter nach anwesenden Personen, Statistik-Panel mit Probezeit je Szene/Person.
- **Belastungsmonitor**: Heatmap oder Balken im Dashboard, der pro Person/Team die geplanten Einsätze pro Woche/Wochenende und den Exhaustion-Score visualisiert.
- **Bühnenbauplan**: Kartenansicht mit Versionen, Download-Links, Verantwortlichen. Möglichkeit zur Kommentierung (evtl. via Task-Comments).
- **Öffentliche Seite**: Hero bleibt, darunter Countdown (Auto-Update per client component), Abschnitt "Reservieren" mit Formular (Modal oder separate Seite), monatliche Tipps als Timeline.

## 9. Roadmap & Umsetzungsschritte
1. **Grundlagen (Sprint 1)**
   - Datenmodell-Erweiterungen (Profile, Allergien, Reservierungen, StagePlan, neue Rehearsal-/Scene-Tabellen).
   - Migrationen & Seed-Anpassungen, erste API-Skelette mit Auth-Gates.
   - Einführung von `MemberLoadSnapshot`-Jobs für Exhaustion-Berechnung.
2. **Mitglieder-Erweiterungen (Sprint 2)**
   - Profil-UI & Formulare.
   - Verfügbarkeitskalender (Blocker, Drag-&-Drop), Zusage-Flow inkl. Logging.
   - Kalender-Visualisierung mit Lifecycle-Farbcodes und Calltimes.
3. **Szenen- & Statistik-Fokus (Sprint 3)**
   - Szenen- und Rollenverwaltung, Board-UI für Probenplanung.
   - Nachbereitungs-Workflow für Rehearsal-Logs, automatische Statistik-Updates.
   - Exhaustion-Warnungen im Dashboard integrieren.
4. **Organisation & Kommunikation (Sprint 4)**
   - Benachrichtigungssystem (Mail + optional Slack).
   - Bühne/Essensplan-Module inkl. Aufgabenintegration.
   - Archiv/Dateiablage (ggf. mit Upload-Lösung).
5. **Öffentliche Features (Sprint 5)**
   - Countdown, Hinweise, Mystery-Verbesserungen.
   - Reservierungssystem mit Bestätigungs-Mail & Admin-Übersicht.
6. **Feinschliff & Qualität (laufend)**
   - Accessibility-Checks, Performance-Optimierungen, Monitoring (z. B. Sentry).

## 10. Offene Fragen & Risiken
- Datenschutz: Müssen Allergien/Körperdaten besonders geschützt (verschlüsselt) und mit Einwilligung versehen werden?
- Hosting & Dateiuploads: Existiert eine Infrastruktur für sichere Speicherung (S3, Cloudflare R2) oder muss sie aufgebaut werden?
- Benachrichtigungskanäle: Gibt es präferierte Tools (E-Mail, Messenger) und Limits? Wer pflegt SMTP-Credentials?
- Reservierungssystem: Werden Zahlungen integriert oder nur Reservierungen ohne Payment?
- Change Management: Wie werden Änderungen an Proben kommuniziert, und wer genehmigt Notfallabsagen?

## 11. Referenzen
- Mitglieder-Dashboard: `src/app/(members)/mitglieder/page.tsx`
- Probenkalender & Zusagen: `src/app/(members)/mitglieder/proben/page.tsx`
- Authentifizierung & RBAC: `src/lib/auth.ts`, `src/lib/rbac.ts`
- Datenmodell-Ausgangsbasis: `prisma/schema.prisma`
