

Inhaltsverzeichnis

- [1. Projektkontext & Ausgangslage](#_projektkontext_ausgangslage)
- [2. Ziele & Erfolgskriterien](#_ziele_erfolgskriterien)
- [3. Stakeholder & Personas](#_stakeholder_personas)
  - [3.1. Interne Stakeholder](#_interne_stakeholder)
  - [3.2. Externe Stakeholder](#_externe_stakeholder)
- [4. Funktionale Anforderungen](#_funktionale_anforderungen)
  - [4.1. Mitgliederbereich](#_mitgliederbereich)
  - [4.2. Öffentliche Website](#_öffentliche_website)
  - [4.3. Organisations-Module](#_organisations_module)
- [5. Anwendungsbeschreibung & Workflows
  (Mitglieder/Planung)](#_anwendungsbeschreibung_workflows_mitgliederplanung)
  - [5.1. Schauspieler\*innen-Sicht: Verfügbarkeiten, Zusagen,
    Kalender](#_schauspielerinnen_sicht_verfügbarkeiten_zusagen_kalender)
  - [5.2. Planungs-Sicht: Serien, Status,
    Calltimes](#_planungs_sicht_serien_status_calltimes)
  - [5.3. Szenen, Besetzung und
    Probierbarkeit](#_szenen_besetzung_und_probierbarkeit)
  - [5.4. Nachbereitung, Statistik und
    Belastung](#_nachbereitung_statistik_und_belastung)
- [6. Nicht-funktionale
  Anforderungen](#_nicht_funktionale_anforderungen)
- [7. Informations- & Datenmodell](#_informations_datenmodell)
  - [7.1. Ist-Zustand](#_ist_zustand)
  - [7.2. Erweiterungen (Vorschlag)](#_erweiterungen_vorschlag)
  - [7.3. Flexible Maße & Größen
    (Kostüm)](#_flexible_maße_größen_kostüm)
  - [7.4. Probenkalender &
    Szenenplanung](#_probenkalender_szenenplanung)
- [8. An Dramatify orientierte
  Erweiterungen](#_an_dramatify_orientierte_erweiterungen)
  - [8.1. Datenmodell-Ergänzungen (Breakdown, Set/Ort, Call
    Sheet)](#_datenmodell_ergänzungen_breakdown_setort_call_sheet)
  - [8.2. Zentrale Workflows
    (Dramatify‑ähnlich)](#_zentrale_workflows_dramatifyähnlich)
  - [8.3. API-Erweiterungen](#_api_erweiterungen)
  - [8.4. UI/UX-Ergänzungen](#_uiux_ergänzungen)
  - [8.5. Benennungen/Migration (sinnvolle
    Bereinigung)](#_benennungenmigration_sinnvolle_bereinigung)
- [9. API- & Integrationsdesign](#_api_integrationsdesign)
- [10. UI/UX-Konzepte](#_uiux_konzepte)
  - [10.1. Designsystem & Bibliotheken](#_designsystem_bibliotheken)
  - [10.2. Color Map (Status, Attendance,
    Abteilungen)](#_color_map_status_attendance_abteilungen)
    - [10.2.1. Visuelle Vorschau](#_visuelle_vorschau)
  - [10.3. Brandfarben & Theme](#_brandfarben_theme)
  - [10.4. Komponenten & Patterns](#_komponenten_patterns)
  - [10.5. Accessibility &
    Internationalisierung](#_accessibility_internationalisierung)
  - [10.6. Print/PDF (Callsheet)](#_printpdf_callsheet)
- [11. Roadmap & Umsetzungsschritte](#_roadmap_umsetzungsschritte)
  - [11.1. Sprint 1 – Attendance-Flow
    Grundlagen](#_sprint_1_attendance_flow_grundlagen)
  - [11.2. Sprint 2 – Calltimes &
    Finalisierung](#_sprint_2_calltimes_finalisierung)
  - [11.3. Sprint 3 – Szenen &
    Probierbarkeit](#_sprint_3_szenen_probierbarkeit)
  - [11.4. Sprint 4 – Nachbereitung &
    Statistik](#_sprint_4_nachbereitung_statistik)
  - [11.5. Sprint 5 – Exhaustion &
    Planungswarnungen](#_sprint_5_exhaustion_planungswarnungen)
  - [11.6. Sprint 6 – Abteilungen, Breakdown & Callsheet
    (optional)](#_sprint_6_abteilungen_breakdown_callsheet_optional)
  - [11.7. Laufend – Qualität & Betrieb](#_laufend_qualität_betrieb)
- [12. Offene Fragen & Risiken](#_offene_fragen_risiken)
- [13. Referenzen](#_referenzen)

## 1. Projektkontext & Ausgangslage

- Die Codebasis setzt auf **Next.js mit dem App-Router**, serverseitig
  gerenderten Komponenten und einem UI-Layer mit
  Tailwind-/Shadcn-Komponenten (vgl. u.a. `src/app/page.tsx`,
  `src/components/hero.tsx`).

- Der **Mitgliederbereich** liegt unter `src/app/(members)/mitglieder`
  und bietet bereits Authentifizierung via NextAuth, eine Übersicht zur
  nächsten Probe sowie ein Kalender-Modul für Probenzusagen.

- Persistente Daten werden über **Prisma** und eine PostgreSQL-Datenbank
  verwaltet (`prisma/schema.prisma`). Neben Nutzern, Proben und
  Anwesenheiten existieren bereits Modelle für Verfügbarkeiten,
  Aufgaben, Finanzen und Inventar.

- Das öffentliche Frontend fokussiert derzeit auf eine stimmungsvolle
  Landingpage mit Hero-Sektion und Teaser-Texten, jedoch ohne
  funktionale Features wie Countdown oder Reservierung.

## 2. Ziele & Erfolgskriterien

- Vollständige Abbildung der organisatorischen Prozesse (Probenplanung,
  Bühnenbau, Kostüm- und Catering-Logistik) innerhalb des
  Mitgliederbereichs.

- Steigerung der Datenqualität durch strukturierte Profile (Maße,
  Allergien, Rolleninformationen) und automatisierte Follow-ups.

- Zeitnahe Kommunikation über Benachrichtigungen und Kalenderfunktionen,
  inklusive intelligenter Sichtbarkeitsregeln je Rolle.

- Öffentliche Website mit klarer Dramaturgie bis zur
  Stückveröffentlichung: Countdown, monatliche Hinweise,
  Reservierungs-Flow.

- Nachweisbare Einhaltung von Datenschutzanforderungen
  (Datensparsamkeit, Zugriffskontrolle, Protokollierung von Änderungen).

## 3. Stakeholder & Personas

### 3.1. Interne Stakeholder

| Stakeholder                       | Interessen                                                                     | Spezifische Anforderungen                                                                            |
|-----------------------------------|--------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------|
| Schauspieler\*innen & Ensemble    | Lückenlose Planungssicherheit trotz wechselnder Verfügbarkeiten                | Persönlicher Kalender für Blocker & Zusagen, Rollen- und Szenentracking, transparente Probenhistorie |
| Technik (Licht, Ton, Multimedia)  | Frühzeitige Abstimmung, wer wann anwesend ist und welches Setup gebraucht wird | Dienst- & Einsatzpläne, technische Checklisten pro Probe, Notizen zu Szenenanforderungen             |
| Bühnenbau & Requisiten            | Aufgaben und Materialien priorisieren, Engpässe vermeiden                      | Aufgabenmanagement mit Materiallisten, Inventarstatus, Freigaben für Aus- und Rückgaben              |
| Kostümteam                        | Kostüme, Änderungen, Budget im Blick behalten                                  | Maße, Änderungen, Wasch-/Reparaturpläne, Ausleih-Tracking, Budgetzuordnung                           |
| Organisation & Produktionsleitung | Gesamtkoordination, Finanzen, Sponsor\*innenpflege, Kommunikation              | Übergreifende Dashboards, Rechteverwaltung, Budget- & Sponsorenreporting, Schnittstellen zu PR       |
| ↳ Catering (Sub)                  | Allergien, Essenspläne, Helfer\*innenplanung                                   | Einsehbare Präferenzen & Allergielisten, Wochenpläne, Einkaufslisten                                 |
| ↳ Presse & PR (Sub)               | Öffentlichkeitsarbeit, Storytelling                                            | Redaktionskalender, Content-Freigaben, Zugriff auf Medienassets                                      |
| ↳ Sponsoring & Förderverein (Sub) | Sichtbarkeit, Vertragspflege                                                   | Sponsor\*innen-Module mit Logoplatzierungen, Reporting, Vertrags- und Rechnungsablage                |

### 3.2. Externe Stakeholder

| Stakeholder                                            | Interessen                                                            | Spezifische Anforderungen                                           |
|--------------------------------------------------------|-----------------------------------------------------------------------|---------------------------------------------------------------------|
| Publikum                                               | Informationen zu Aufführungen, Ticketzugang, das „Mysterium“-Erlebnis | Termine, Countdown, Reservierung & Follow-up-Kommunikation          |
| Sponsoren & Förderverein                               | Sichtbarkeit und Ergebnisberichte                                     | Eigener Info-Bereich, Reporting-Dashboards, Branding-Optionen       |
| Schule/Institution                                     | Reibungslose Organisation, Reputation                                 | Veranstaltungsübersichten, Sicherheits- und Dokumentationsnachweise |
| Lieferanten & Partner (Technikverleih, Druckerei etc.) | Klare Anforderungen, rechtzeitige Abstimmung                          | Auftrags- & Lieferkalender, Ansprechpartner\*innen, Dateiuploads    |

## 4. Funktionale Anforderungen

### 4.1. Mitgliederbereich

1.  **Profil & Stammdaten**

    <div class="ulist">

    - Erfassung von Körpermaßen (Körpergröße, Konfektionsgrößen,
      Schuhgröße) mit Änderungsverlauf.

    - Verwaltung von Allergien/Essenspräferenzen (Freitext +
      strukturierte Tags) mit Sichtbarkeit für Catering-Team.

    - Rollen- und Verantwortungsbereiche direkt im Profil anzeigen (aus
      `User.role` + zusätzliche Felder).

    </div>

2.  **Probenorganisation**

    <div class="ulist">

    - Sichtbarkeitslogik: Schauspieler\*innen sehen maximal 4 Wochen im
      Voraus, andere Rollen alle Termine.

    - Anzeige "letzte Änderung" je Probe (Feld `updatedAt` existiert
      bereits) im UI.

    - Persönlicher Blocker-Kalender: Schauspieler\*innen markieren
      Nicht-Verfügbarkeiten per Drag & Drop, automatisch abgeglichen mit
      vorgeschlagenen Probeterminen.

    - Zusage-Status mit Historie: jede Zu-/Absage erzeugt eine Logzeile
      inkl. Zeitpunkt, Nutzer\*in und optionalem Kommentar; "Keine
      Reaktion" zählt als "geplant".

    - Planungsstatus je Probe: Entwurf (Template), Vorschlag (noch
      anpassbar), Final (veröffentlicht) mit eigener Farbe im Kalender.

    - Ankunftsplanung: Probenplaner\*innen sehen, wer durch
      Blocker/Absagen eingeschränkt ist und können individuelle
      Calltimes festlegen.

    - Szenenbasierter Fokus: Proben werden mit Szenen-Templates
      verknüpft, sodass automatisch sichtbar ist, welche Szenen trotz
      Absagen geprobt werden können.

    - Nachbereitung & Statistik: Protokollierung, welche Szenen mit
      welchen Personen tatsächlich geprobt wurden, inklusive Dauer zur
      Berechnung von Szenen- und Personen-Statistiken.

    - Belastungsmetriken: automatische Hinweise, wenn Personen mehr als
      X Stunden in einem Zeitraum (z. B. Wochenende) eingeplant sind;
      Integration in die Planungsansicht.

    - "Emergency Button" zur kurzfristigen Absage inkl. Grund (Trigger
      für Notification & Statuswechsel).

    - Automatische Erinnerungs-Mails oder Dashboard-Banner für Personen
      ohne Zu-/Absage 48h vor Probe.

    - Übersicht "Nächste Probe" ergänzt um Rollenbedarf
      (`requiredRoles`) und Begründung.

    </div>

3.  **Bühnenbau & Material**

    <div class="ulist">

    - Verwaltung von Bühnenbau-Plänen inkl. Versionierung, Dateiuploads
      und Zuständigkeiten.

    - Aufgabenlisten nach Bereich (Bühnenbau, Technik, Kostüm) inkl.
      Status & Fälligkeitsdaten (`Task`-Modell nutzbar).

    </div>

4.  **Kommunikation & Benachrichtigungen**

    <div class="ulist">

    - E-Mail- und ggf. Slack/Matrix-Benachrichtigungen für neue Termine,
      Planänderungen, Notfallmeldungen.

    - Dashboard-Karte "Zuletzt passiert" mit letzten 5 relevanten
      Aktivitäten (Termine, ToDos, Dokumente).

    </div>

5.  **Verfügbarkeiten & Essensplanung**

    <div class="ulist">

    - Bestehende Verfügbarkeits-Templates (`AvailabilityTemplate`) im UI
      editierbar machen.

    - Essensplan-Modul: wöchentliche Planung, Zuweisung wer kocht,
      Sichtbarkeit für alle Mitglieder.

    </div>

### 4.2. Öffentliche Website

- **Countdown zum Reveal**: dynamischer Timer basierend auf
  `Show.revealedAt`.

- **Reservierungssystem**: Formular mit Terminauswahl (aus
  `Show.dates`), Name, Kontakt, Ticketanzahl; Speicherung als neue
  Entität (z. B. `Reservation`).

- **Hinweise/Tipps**: Monatliche Inhalte bis zur Premiere, redaktionell
  pflegbar (z. B. `PublicHint`-Modell mit Veröffentlichungsdatum und
  Target-Monat).

- **Mystery-Route**: Nutzung der bestehenden `Clue`-Struktur zur
  gestaffelten Veröffentlichung von Rätseln.

### 4.3. Organisations-Module

- **Archiv**: Upload & Kategorisierung von Dokumenten, Fotos,
  Protokollen; differenzierte Berechtigungen.

- **Finanzen**: Erweiterung des `FinanceEntry`-Modells mit
  Budgetzuordnung, Genehmigungsstatus, Exportfunktionen.

- **Dienstplan**: Erstellung eines Schichtplans pro Vorstellung mit
  Zuordnung der Mitglieder; Integration mit Verfügbarkeiten.

- **ToDo-Listen**: Rollenbasierte Filter, Kommentarfunktion, Verlauf.

## 5. Anwendungsbeschreibung & Workflows (Mitglieder/Planung)

### 5.1. Schauspieler\*innen-Sicht: Verfügbarkeiten, Zusagen, Kalender

Ziel: Ein zentraler Kalender zeigt alle potenziellen Proben sowie
persönliche Blocker. Der Standard ist „geplant“ (eingerechnet), bis man
sich aktiv austrägt.

- Verfügbarkeiten/Blocker:

- Personen markieren Nicht-Verfügbarkeiten über Tages-/Zeitfenster
  (siehe `AvailabilityDay`, `AvailabilityTemplate`).

- Wiederkehrende Muster (z. B. Mo–Fr abends nicht) werden über Templates
  gepflegt.

- Proben im Kalender:

- Alle offenen/geplanten Proben werden angezeigt, eigene Einplanung ist
  standardmäßig „geplant“.

- Proben, in die man (noch) eingeplant ist, werden visuell
  hervorgehoben.

- Zusage/Absage-Flow:

- Aktive Bestätigung möglich („Zusage“), ebenso Absage oder Tentative.

- „Keine Reaktion“ zählt als „geplant“ (für die Planungsgrundlage).

- Jede Statusänderung wird geloggt (Zeitpunkt, Person, vorher/nachher,
  optional Kommentar).

Akzeptanzkriterien: - Blocker in der Zukunft blenden Konflikte farblich
im Kalender ein. - Zusagen zeigen einen Haken/Badge; Absagen entfernen
Hervorhebung. - Historie je Probe/Person ist nachvollziehbar.

### 5.2. Planungs-Sicht: Serien, Status, Calltimes

Ziel: Proben effizient aus Vorlagen/Serien anlegen, finalisieren und
individuelle Ankunftszeiten planen.

- Serien/Vorlagen:

- Wochentagsbasierte Templates (z. B. jeden Fr/Sa/So) erzeugen
  Vorschläge.

- Lifecycle: Entwurf/Vorschlag → Final (veröffentlicht) → ggf.
  Abgesagt/Abgeschlossen.

- Finalisierung:

- Beim Finalisieren werden Benachrichtigungen und
  Kalender-Hervorhebungen ausgelöst.

- Individuelle Calltimes:

- Für finale Proben können Calltimes je Person/Team zugewiesen werden
  (z. B. „Crew 17:30, Cast 18:00“ oder individuell pro Person).

Akzeptanzkriterien: - Serie erzeugt die korrekten Slots mit Ort/Zeit und
Status „Entwurf/Vorschlag“. - Finalisierung ändert sichtbar den Status
und informiert betroffene Personen. - Calltimes sind pro Person
einsehbar und im Kalender/Tooltip sichtbar.

### 5.3. Szenen, Besetzung und Probierbarkeit

Ziel: Optionale Szenen-/Rollenstruktur erlaubt, je nach An- und
Abwesenheiten, sinnvolle Szenen zu identifizieren.

- Szenenmodell:

- Szenen gehören zu einer Show, enthalten Titel, Reihenfolge/Schätzung
  und beteiligte Figuren.

- Figuren (`Character`) werden Menschen zugeordnet (`CharacterCasting`,
  mit Primary/Understudy optional).

- Probierbarkeit:

- Für eine geplante Probe kann gefiltert werden, welche Szenen mit der
  aktuellen Anwesenheit sinnvoll probierbar sind (alle notwendigen
  Figuren verfügbar oder sinnvolle Teilproben).

Akzeptanzkriterien: - Liste „heute probierbar“ reflektiert Abwesenheiten
korrekt. - Teilproben können markiert werden (z. B. Fokus ohne komplette
Besetzung).

### 5.4. Nachbereitung, Statistik und Belastung

Ziel: Transparenz, was tatsächlich geprobt wurde, und faire Verteilung
der Belastung.

- Nachbereitung:

- Pro Probe werden die tatsächlich geprobten Szenen inkl. Dauer und
  Anwesenden festgehalten.

- Notizen/Highlights zur Probe sind dokumentierbar.

- Statistik:

- Pro Szene: summierte Probenminuten, letzte Probe, Abdeckung pro Figur.

- Pro Person: summierte Probenminuten/Frequenz im Zeitfenster.

- Exhaustion-Metrik:

- Warnhinweise, wenn eine Person in einem Wochenende (Fr–So) übermäßig
  oft/zu lange eingeplant ist.

Akzeptanzkriterien: - Statistik aktualisiert sich nach Nachbereitung;
Dashboard/Tooltip zeigt Kennzahlen. - Planungsansicht warnt bei
Überschreitung definierter Richtwerte (konfigurierbar).

## 6. Nicht-funktionale Anforderungen

- **Sicherheit**: Rollenbasierte Zugriffskontrolle (RBAC) erweitert;
  sensible Daten verschlüsselt speichern (z. B. Allergien optional
  verschlüsseln).

- **Performance**: Caching von häufig genutzten Listen (Proben,
  Hinweise), Optimierung von Datenbankabfragen (Pagination, Indexe).

- **Robustheit**: Graceful Fallbacks bei API-Fehlern, Retry-Strategien
  für Benachrichtigungen.

- **Usability & Accessibility**: Responsives Design, Tastaturnavigation,
  ARIA-Attribute für interaktive Komponenten.

- **Compliance**: DSGVO-konformes Opt-in für Benachrichtigungen,
  Löschkonzepte für personenbezogene Daten.

## 7. Informations- & Datenmodell

### 7.1. Ist-Zustand

- `User`: zentrale Entität mit Rollen, Beziehungen zu Accounts,
  Sessions, Anwesenheiten, Aufgaben.

- `Rehearsal` & `RehearsalTemplate`: Planung & Automatisierung von
  Proben inkl. Priorität, Status, `updatedAt`-Timestamp.

- `AvailabilityDay` / `AvailabilityTemplate`: feingranulare
  Verfügbarkeiten.

- `Show`, `Clue`, `Guess`: Mystery- & Spiel-Mechanik für das öffentliche
  Rätsel.

- `FinanceEntry`, `Task`, `InventoryItem`, `Announcement`:
  organisatorische Module.

### 7.2. Erweiterungen (Vorschlag)

``` highlight
model MemberProfile {
  id                String   @id @default(cuid())
  userId            String   @unique
  notes             String?
  allergies         AllergyEntry[]
  dietaryPreference DietaryPreference?
  updatedBy         String?
  updatedAt         DateTime @updatedAt
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)
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

- Ergänzende Indizes: `@@index([showId, date])` für Reservierungen,
  `@@index([userId, updatedAt])` für Profile.

- Historisierung: optional separate `ProfileChangeLog`-Tabelle zur
  Nachverfolgung von Änderungen.

### 7.3. Flexible Maße & Größen (Kostüm)

Problem: Starre Felder wie `heightCm`, `clothingTop`, `clothingBottom`,
`shoeSizeEu` sind unflexibel und schwer erweiterbar.

Lösung: Freiform‑Maße mit Historie plus generische Größen‑Einträge.
Dadurch lassen sich zusätzliche Maße (z. B. Hals, Oberarm, Schulter,
Rückenlänge, Kopf), Systeme (EU/US/UK) und Kategorien
(Schuhe/Hüte/Handschuhe) ohne Migrationsdruck abbilden.

``` highlight
enum MeasurementUnit { mm cm inch }
enum SizeSystem { EU DE US UK FR IT INT }
enum SizeCategory { top bottom dress suit shirt pants jeans bra shoe hat glove belt ring other }

model MemberMeasurement {
  id        String          @id @default(cuid())
  userId    String
  key       String          // z. B. "chest", "waist", "hips", "inseam", "neck", "head"
  value     Float
  unit      MeasurementUnit @default(cm)
  takenAt   DateTime        @default(now())
  takenBy   String?
  note      String?
  user      User            @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model MemberSize {
  id        String       @id @default(cuid())
  userId    String
  category  SizeCategory
  system    SizeSystem   @default(EU)
  value     String       // frei: "M", "38", "75B", "42-44"
  note      String?
  updatedAt DateTime     @default(now()) @updatedAt
  user      User         @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

Anwendung: - Standardisieren per UI: Vorschlagsliste/Autocomplete für
übliche Keys (chest/waist/hips/inseam/neck/sleeve/shoulder/head/etc.). -
Historie: Jüngster `takenAt`-Eintrag gilt als „aktuell“; ältere bleiben
nachvollziehbar. - Systeme: `MemberSize` erlaubt parallele Einträge für
EU/US/UK, auch nach Kategorie. - Validierung: Einfache Einheitenprüfung;
optional Limits per UI (z. B. 30–250 cm) statt im Schema.

### 7.4. Probenkalender & Szenenplanung

``` highlight
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

model Character {
  id        String  @id @default(cuid())
  showId    String
  name      String
  shortName String?
  notes     String?
  isLead    Boolean @default(false)
  show      Show    @relation(fields: [showId], references: [id], onDelete: Cascade)
}

model Scene {
  id           String   @id @default(cuid())
  showId       String
  order        Int
  title        String
  estimatedMin Int?
  description  String?
  characters   SceneCharacter[]
  show         Show     @relation(fields: [showId], references: [id], onDelete: Cascade)
}

model SceneCharacter {
  id          String   @id @default(cuid())
  sceneId     String
  characterId String
  required    Boolean  @default(true)
  scene       Scene     @relation(fields: [sceneId], references: [id], onDelete: Cascade)
  character   Character @relation(fields: [characterId], references: [id])
}

model CharacterCasting {
  id          String   @id @default(cuid())
  characterId String
  userId      String
  isPrimary   Boolean  @default(true)
  character   Character @relation(fields: [characterId], references: [id])
  user        User      @relation(fields: [userId], references: [id])
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

- Verknüpfung zu bestehenden `AvailabilityDay`-Einträgen bleibt
  bestehen; `AvailabilityException` ergänzt kurzfristige Blocker.

- `MemberLoadSnapshot` dient als Ausgangspunkt für Exhaustion-Metriken
  (z. B. Warnungen bei mehr als zwei Einsätzen pro Wochenende).

- Zusätzliche Indizes: `@@index([rehearsalId, sceneId])` auf
  `RehearsalScenePlan`, `@@index([userId, windowStart])` auf
  `MemberLoadSnapshot`.

- `RehearsalTemplateScene` erlaubt Szenen-Defaults pro Template,
  `RehearsalCalltime` sichert individuelle Calltimes mit optionaler
  Rollenbindung.

## 8. An Dramatify orientierte Erweiterungen

Ziel: Feature-Parität für Theaterproben/-aufführungen mit klarer
Szenenauflösung, Call Sheets, Breakdown und Abteilungs-Sichten (Kostüm,
Requisite, Technik, Maske), ohne unnötige Komplexität.

### 8.1. Datenmodell-Ergänzungen (Breakdown, Set/Ort, Call Sheet)

``` highlight
enum BreakdownType { // Abteilungsbedarfe pro Szene
  prop
  costume
  makeup
  hair
  set
  light
  sound
  fx
  music
  document
}

model SceneBreakdownItem {
  id          String        @id @default(cuid())
  sceneId     String
  kind        BreakdownType
  title       String
  description String?
  quantity    Int?          @default(1)
  refUrl      String?
  scene       Scene         @relation(fields: [sceneId], references: [id], onDelete: Cascade)
}

model SetLocation { // Bühne/Set/Ort (für Dramatify-ähnliche Planung)
  id        String   @id @default(cuid())
  showId    String
  name      String
  area      String?  // z. B. "Hauptbühne", "Seitenbühne"
  notes     String?
  show      Show     @relation(fields: [showId], references: [id], onDelete: Cascade)
  scenes    Scene[]
}

// Szene um Attribute wie Ort, Tageszeit, INT/EXT ergänzen
enum Daytime { morning, day, afternoon, evening, night }
enum InteriorExterior { interior, exterior }

// UPDATE HINWEIS: Scene erhält weitere optionale Felder
// (Kein breaking Change, Felder sind optional)

// In der echten Migration: "Scene" um folgende Felder erweitern:
// setLocationId String?  @db.VarChar
// daytime       Daytime?
// intExt        InteriorExterior?
// pageLength    Float?   // Seitenlänge (Skriptnäherung)

model Callsheet { // Tages-/Probenzettel
  id          String   @id @default(cuid())
  showId      String
  rehearsalId String?  // optional: an Probe gekoppelt
  date        DateTime
  location    String?
  notes       String?
  scenes      CallsheetScene[]
  createdAt   DateTime @default(now())
  show        Show     @relation(fields: [showId], references: [id])
  rehearsal   RehearsalSlot? @relation(fields: [rehearsalId], references: [id])
}

model CallsheetScene {
  id           String   @id @default(cuid())
  callsheetId  String
  sceneId      String
  order        Int
  specialNotes String?
  callsheet    Callsheet @relation(fields: [callsheetId], references: [id], onDelete: Cascade)
  scene        Scene     @relation(fields: [sceneId], references: [id])
}

model ContinuityNote { // Kontinuität je Szene/Probe
  id          String   @id @default(cuid())
  sceneId     String
  rehearsalId String?
  note        String
  createdAt   DateTime @default(now())
  scene       Scene         @relation(fields: [sceneId], references: [id], onDelete: Cascade)
  rehearsal   RehearsalSlot @relation(fields: [rehearsalId], references: [id])
}
```

Hinweise: - Trennung von RBAC-`Role` und Bühnen-`Character` verhindert
Kollisionen mit `SceneRole` (besser: `SceneCharacter`). -
`SceneBreakdownItem` bildet Dramatify‑ähnliche Abteilungslisten pro
Szene ab. - `Callsheet` ermöglicht formales Call Sheet (auch aus Probe
generierbar). - Optionale Felder auf `Scene` (Ort/Tageszeit/INT‑EXT)
verbessern Planung und Filtern.

### 8.2. Zentrale Workflows (Dramatify‑ähnlich)

- Szenenverwaltung: Import/Anlage von Szenen, Zuordnung von Figuren
  (`SceneCharacter`), Set/Ort, Tageszeit, Aufwand.

- Breakdown: Pro Szene Items für Kostüm/Requisite/Technik/Maske pflegen;
  Abteilungsansichten und Export/Checklisten.

- Call Sheet: Aus Probenplan oder ad‑hoc erstellt; enthält Datum, Ort,
  Szenenreihenfolge, individuelle Calltimes (bestehend), Notizen,
  Anhänge.

- Kontinuität: Notizen aus Proben dokumentieren (`ContinuityNote`) und
  mit Szenen verknüpfen.

- Abteilungs-Sichten: Filter „meine Abteilung“ (z. B. Kostüm) über
  Szenen, Proben, Call Sheets hinweg.

### 8.3. API-Erweiterungen

| Endpoint                  | Methode | Beschreibung                                       | Auth                           |
|---------------------------|---------|----------------------------------------------------|--------------------------------|
| /api/characters           | CRUD    | Figuren/Rollen je Show                             | Regie/Produktion               |
| /api/scenes/:id/breakdown | GET/PUT | Breakdown-Items je Szene lesen/aktualisieren       | Kostüm/Requisite/Technik/Regie |
| /api/callsheets           | CRUD    | Call Sheets erstellen, Szenen zuordnen, PDF-Export | Produktion/Regie               |
| /api/scenes/search        | GET     | Filter nach Ort/Tageszeit/Abteilung/Belegung       | Produktion/Regie               |

### 8.4. UI/UX-Ergänzungen

- Szenenliste mit Chips: Ort, Tageszeit, INT/EXT, Dauer, beteiligte
  Figuren.

- Szenendetail: Tabs „Figuren“, „Breakdown“, „Kontinuität“, „Anhänge“.

- Abteilungsmodus: Checklisten-UI und Status (offen/erledigt/nachfragen)
  pro Breakdown-Item.

- Call Sheet Generator: aus Probe/Selektion; Vorschau und Export
  (PDF/Print Styles).

- Filter/Reports: Welche Szenen sind mit aktuellen Zusagen probebereit?
  Was fehlt pro Abteilung?

### 8.5. Benennungen/Migration (sinnvolle Bereinigung)

- `SceneRole` → `SceneCharacter` umbenennen; neues `Character`-Modell
  statt RBAC‑`Role`.

- `RoleAssignment` nach Einsatzzweck splitten: `CrewAssignment`
  (Abteilung/Team) vs. `CharacterCasting` (Figur ↔ Nutzer\*in).

- `Scene` um optionale Felder erweitern (Ort/Tageszeit/INT‑EXT), keine
  Breaking Changes nötig.

## 9. API- & Integrationsdesign

| Endpoint                       | Methode         | Beschreibung                                                     | Auth                                    |
|--------------------------------|-----------------|------------------------------------------------------------------|-----------------------------------------|
| /api/profile                   | GET/PUT         | Profilinformationen lesen/aktualisieren (inkl. Maße, Allergien)  | Mitglieder                              |
| /api/profile/allergies         | POST/DELETE     | Allergie-Einträge anlegen/löschen                                | Mitglieder (Eigene Daten)               |
| /api/availability-exceptions   | GET/POST/DELETE | Blocker-Fenster im persönlichen Kalender pflegen                 | Mitglieder (Eigene Daten)               |
| /api/rehearsals/slots          | GET/POST        | Probenentwürfe erstellen, Duplikate aus Templates anlegen        | Produktionsleitung                      |
| /api/rehearsals/:id            | PATCH           | Statusübergänge (Entwurf → Vorschlag → Final), Ort/Zeit anpassen | Produktionsleitung                      |
| /api/rehearsals/:id/responses  | POST            | Zu-/Absagen oder "Tentative" melden, optional mit Kommentar      | Rollen `cast`, `tech`                   |
| /api/rehearsals/:id/calltime   | PUT             | Individuelle Calltimes speichern                                 | Produktionsleitung, Stage Management    |
| /api/rehearsals/:id/scenes     | PUT             | Szenenplan aktualisieren (geplante Reihenfolge, Fokus)           | Regie, Produktionsleitung               |
| /api/rehearsals/:id/statistics | POST            | Nachbereitung: tatsächliche Dauer, Anwesende, Notizen erfassen   | Regie, Stage Management                 |
| /api/rehearsals/load           | GET             | Aggregierte Belastungsmetriken für Planungswarnungen abrufen     | Produktionsleitung                      |
| /api/rehearsals/:id/emergency  | POST            | Notfall-Absage inklusive Nachricht, triggert Notifications       | Rollen `cast`, `tech`, `board`, `admin` |
| /api/notifications             | POST            | Generische Benachrichtigungen versenden (E-Mail/Slack)           | Admin/Board                             |
| /api/stage-plan                | CRUD            | Bühnenbau-Pläne verwalten, Dateiupload (S3/Blob)                 | Tech/Bühnenbau                          |
| /api/reservations              | POST/GET        | Reservierungen erfassen, Liste für Organisation                  | Öffentlich (POST), Board (GET)          |
| /api/hints                     | GET             | Öffentliche Hinweise gefiltert nach Datum                        | Öffentlich                              |

Integrationen:

- **E-Mail** via vorhandener NextAuth-Provider; für Notifications
  separate Queue (z. B. Resend, nodemailer) einplanen.

- **Kalender-Export** (iCal) für Proben & Dienstpläne als
  Langfrist-Ziel.

## 10. UI/UX-Konzepte

- **Mitglieder-Navigation**: Erweiterung des `MembersNav` um "Profil",
  "Bühnenbau", "Essensplan", "Benachrichtigungen"; Rollenspezifische
  Sichtbarkeit.

- **Profilseite**: Mehrteilige Form mit Tabs (Stammdaten, Maße,
  Allergien, Rollen). Inline-Validierung, Änderungs-Historie.

- **Probenkalender**: Farbcode für Lifecycle-Status
  (Entwurf/Vorschlag/Final), Drag-&-Drop für Blocker, Tooltip mit
  Calltimes, Szenenfokus und Zusagestatus.

- **Probenübersicht**: Badges für Änderungszeitpunkte, Hinweis-Panel für
  fehlende Rückmeldungen, "Emergency"-Button prominent aber geschützt
  (Confirm-Dialog), Nachbereitungs-Drawer zur Dokumentation geprobter
  Szenen.

- **Szenenplanung**: Board-Ansicht zur Zuordnung von Rollen zu Szenen
  inkl. Filter nach anwesenden Personen, Statistik-Panel mit Probezeit
  je Szene/Person.

- **Belastungsmonitor**: Heatmap oder Balken im Dashboard, der pro
  Person/Team die geplanten Einsätze pro Woche/Wochenende und den
  Exhaustion-Score visualisiert.

- **Bühnenbauplan**: Kartenansicht mit Versionen, Download-Links,
  Verantwortlichen. Möglichkeit zur Kommentierung (evtl. via
  Task-Comments).

- **Öffentliche Seite**: Hero bleibt, darunter Countdown (Auto-Update
  per client component), Abschnitt "Reservieren" mit Formular (Modal
  oder separate Seite), monatliche Tipps als Timeline.

### 10.1. Designsystem & Bibliotheken

- UI-Stack: Tailwind CSS (vorhanden) + shadcn/ui (Buttons, Dialog,
  Drawer, Tabs, Table, Toast, Dropdown, Badge, Tooltip)

- Formulare: react-hook-form + zod (Schema-Validierung, Fehlermeldungen
  konsistent)

- Datum/Zeit: date-fns (de-Locale), `@internationalized/date` optional
  für komplexere Kalenderlogik

- Drag & Drop: `@dnd-kit/core` (leichtgewichtig, aktiv gepflegt)

- Icons: `lucide-react` (kompatibel zu shadcn/ui)

- Daten-Fetching: Server Actions wo möglich; klientenseitig `swr` für
  einfache GETs (Revalidate on focus), ansonsten direkte Route-Handler

- Diagramme: Recharts für Balken/Linien + einfache Heatmap; bei
  Spezialfällen visx

- Kalender: FullCalendar React (dayGrid/timeGrid, gute Interaktion,
  Ressourcen- und Mehrtagesansichten). Alternative: react-big-calendar
  (leichter, weniger Features)

- PDF/Print: `react-to-print` + Print‑Styles; optional serverseitig
  `puppeteer` für stabile Callsheet‑PDFs

- E‑Mail: Resend oder nodemailer (Queue/Outbox für Retries)

### 10.2. Color Map (Status, Attendance, Abteilungen)

- Rehearsal Lifecycle

- draft: slate-300 border-slate-400 text-slate-700

- proposed: sky-200 border-sky-400 text-sky-800

- confirmed/final: emerald-200 border-emerald-500 text-emerald-800

- completed: teal-200 border-teal-500 text-teal-800

- cancelled: rose-200 border-rose-500 text-rose-800

- Attendance

- planned (default): neutral badge (z. B. zinc-200) + outline

- yes: green (emerald-500) + Icon „Check“

- maybe: amber-500 + Icon „HelpCircle“

- no: red (rose-500) + Icon „X“

- Abteilungen (Kostüm/Requisite/Technik/Licht/Ton/FX)

- costume: fuchsia-500, prop: amber-600, tech: cyan-600, light:
  yellow-500, sound: indigo-500, fx: purple-600

- Exhaustion (Heatmap)

- 0–1 Einsätze: green-200 → green-400

- 2 Einsätze: amber-300 → amber-500

- ≥3 Einsätze: rose-400 → rose-600

Hinweise - Farbcodierung immer mit zweitem Merkmal kombinieren (Icon,
Badge‑Label), Kontrast AA beachten. - Dark‑Mode: gleiche Hues, aber
dunklere Tints/Foregrounds (Tailwind `dark:` Variants).

#### 10.2.1. Visuelle Vorschau

Rehearsal Lifecycle

| Status          | Farbe                   | Swatch                                                                                             |
|-----------------|-------------------------|----------------------------------------------------------------------------------------------------|
| draft           | slate-300/slate-400     | ![](swatches/slate-300.svg)                                                                           |
| proposed        | sky-200/sky-400         | ![](swatches/sky-200.svg) |
| confirmed/final | emerald-200/emerald-500 | ![](swatches/emerald-200.svg)                                                                         |
| completed       | teal-200/teal-500       | ![](swatches/teal-200.svg)                                                                            |
| cancelled       | rose-200/rose-500       | ![](swatches/rose-200.svg)                                                                            |

Attendance

| Status  | Farbe       | Swatch                                                                         |
|---------|-------------|--------------------------------------------------------------------------------|
| planned | zinc-200    | ![](swatches/zinc-200.svg)                                                        |
| yes     | emerald-500 | ![](swatches/emerald-500.svg)                                                     |
| maybe   | amber-500   | ![](swatches/amber-500.svg)                                                       |
| no      | rose-500    | ![](swatches/rose-500.svg)                                                        |

Abteilungen

| Bereich | Farbe       | Swatch                                                                         |
|---------|-------------|--------------------------------------------------------------------------------|
| costume | fuchsia-500 | ![](swatches/fuchsia-500.svg)                                                     |
| prop    | amber-600   | ![](swatches/amber-600.svg)                                                       |
| tech    | cyan-600    | ![](swatches/cyan-600.svg)                                                        |
| light   | yellow-500  | ![](swatches/yellow-500.svg)                                                      |
| sound   | indigo-500  | ![](swatches/indigo-500.svg)                                                      |
| fx      | purple-600  | ![](swatches/purple-600.svg)                                                      |

Exhaustion Heatmap (Beispiel‑Skala)

|                |                                                                                                        |
|----------------|--------------------------------------------------------------------------------------------------------|
| Einsätze Fr–So | Swatch                                                                                                 |
| 0–1            | ![](swatches/green-200.svg) ![](swatches/green-400.svg)                                                                               |
| 2              | ![](swatches/amber-300.svg) ![](swatches/amber-500.svg)                                                                               |
| ≥3             | ![](swatches/rose-400.svg) ![](swatches/rose-600.svg)                                                                                |

### 10.3. Brandfarben & Theme

Ziel: Einheitliche Markenfarben als semantische Tokens, nutzbar in
Tailwind/shadcn und konsistent in Light/Dark.

Vorschlag (anpassbar): - primary: Violet (Bühne/Spotlight) - secondary:
Amber (Warm/Glanzeffekt) - accent: Teal (Interaktionen/Highlights) -
neutral: Slate (Text/Flächen) - success/warn/danger/info:
Emerald/Amber/Rose/Sky (Tailwind‑kompatible Hues)

Light Theme

<table>
  <thead>
    <tr>
      <th>Token</th>
      <th>Hex</th>
      <th>Swatch</th>
    </tr>
  </thead>
  <tbody>
    <tr><td>primary</td><td>#7C3AED</td><td><img src="swatches/purple-600.svg" width="12" height="12" /></td></tr>
    <tr><td>secondary</td><td>#F59E0B</td><td><img src="swatches/amber-500.svg" width="12" height="12" /></td></tr>
    <tr><td>accent</td><td>#14B8A6</td><td><img src="swatches/teal-500.svg" width="12" height="12" /></td></tr>
    <tr><td>background</td><td>#FFFFFF</td><td><img src="swatches/white.svg" width="12" height="12" /></td></tr>
    <tr><td>foreground</td><td>#0F172A</td><td><img src="swatches/slate-900.svg" width="12" height="12" /></td></tr>
    <tr><td>muted</td><td>#E5E7EB</td><td><img src="swatches/zinc-200.svg" width="12" height="12" /></td></tr>
    <tr><td>border</td><td>#E5E7EB</td><td><img src="swatches/zinc-200.svg" width="12" height="12" /></td></tr>
    <tr><td>ring</td><td>#7C3AED</td><td><img src="swatches/purple-600.svg" width="12" height="12" /></td></tr>
    <tr><td>success</td><td>#10B981</td><td><img src="swatches/emerald-500.svg" width="12" height="12" /></td></tr>
    <tr><td>warning</td><td>#F59E0B</td><td><img src="swatches/amber-500.svg" width="12" height="12" /></td></tr>
    <tr><td>danger</td><td>#EF4444</td><td><img src="swatches/red-500.svg" width="12" height="12" /></td></tr>
    <tr><td>info</td><td>#38BDF8</td><td><img src="swatches/sky-400.svg" width="12" height="12" /></td></tr>
  </tbody>
  </table>

Dark Theme

<table>
  <thead>
    <tr>
      <th>Token</th>
      <th>Hex</th>
      <th>Swatch</th>
    </tr>
  </thead>
  <tbody>
    <tr><td>primary</td><td>#8B5CF6</td><td><img src="swatches/purple-500.svg" width="12" height="12" /></td></tr>
    <tr><td>secondary</td><td>#FBBF24</td><td><img src="swatches/amber-400.svg" width="12" height="12" /></td></tr>
    <tr><td>accent</td><td>#2DD4BF</td><td><img src="swatches/teal-400.svg" width="12" height="12" /></td></tr>
    <tr><td>background</td><td>#0B0F16</td><td><img src="swatches/background-dark.svg" width="12" height="12" /></td></tr>
    <tr><td>foreground</td><td>#E2E8F0</td><td><img src="swatches/slate-200.svg" width="12" height="12" /></td></tr>
    <tr><td>muted</td><td>#1F2937</td><td><img src="swatches/slate-800.svg" width="12" height="12" /></td></tr>
    <tr><td>border</td><td>#334155</td><td><img src="swatches/slate-700.svg" width="12" height="12" /></td></tr>
    <tr><td>ring</td><td>#8B5CF6</td><td><img src="swatches/purple-500.svg" width="12" height="12" /></td></tr>
    <tr><td>success</td><td>#10B981</td><td><img src="swatches/emerald-500.svg" width="12" height="12" /></td></tr>
    <tr><td>warning</td><td>#F59E0B</td><td><img src="swatches/amber-500.svg" width="12" height="12" /></td></tr>
    <tr><td>danger</td><td>#F87171</td><td><img src="swatches/red-400.svg" width="12" height="12" /></td></tr>
    <tr><td>info</td><td>#38BDF8</td><td><img src="swatches/sky-400.svg" width="12" height="12" /></td></tr>
  </tbody>
</table>

CSS‑Variablen (Beispiel)

``` highlight
:root {
  --color-primary: #7C3AED;
  --color-secondary: #F59E0B;
  --color-accent: #14B8A6;
  --color-background: #FFFFFF;
  --color-foreground: #0F172A;
  --color-muted: #E5E7EB;
  --color-border: #E5E7EB;
  --color-ring: #7C3AED;
  --color-success: #10B981;
  --color-warning: #F59E0B;
  --color-danger: #EF4444;
  --color-info: #38BDF8;
}
.dark {
  --color-primary: #8B5CF6;
  --color-secondary: #FBBF24;
  --color-accent: #2DD4BF;
  --color-background: #0B0F16;
  --color-foreground: #E2E8F0;
  --color-muted: #1F2937;
  --color-border: #334155;
  --color-ring: #8B5CF6;
  --color-success: #10B981;
  --color-warning: #F59E0B;
  --color-danger: #F87171;
  --color-info: #38BDF8;
}
```

Tailwind‑Anbindung (Optional, shadcn‑Style mit CSS‑Variablen)

``` highlight
// tailwind.config.ts (Ausschnitt)
export default {
  theme: {
    extend: {
      colors: {
        primary: 'var(--color-primary)',
        secondary: 'var(--color-secondary)',
        accent: 'var(--color-accent)',
        background: 'var(--color-background)',
        foreground: 'var(--color-foreground)',
        muted: 'var(--color-muted)',
        border: 'var(--color-border)',
        ring: 'var(--color-ring)',
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        danger: 'var(--color-danger)',
        info: 'var(--color-info)'
      }
    }
  }
}
```

### 10.4. Komponenten & Patterns

- Datenlisten: shadcn DataTable (Sort, Filter, Pagination),
  Zeilen‑Actions als Dropdown

- Detailseiten: Tabs (z. B. Szenen: Figuren \| Breakdown \| Kontinuität
  \| Anhänge)

- Kalenderkarten: Tooltip mit Calltimes, Status, eigener Zusagestatus

- Dialoge: Confirm für „Emergency/Absage“, Drawer für Calltimes‑Edit

- Toaster: Statusfeedback bei Zusage/Absage/Planungsaktionen

### 10.5. Accessibility & Internationalisierung

- Tastaturnavigation und ARIA für interaktive Widgets (Drag‑Handle,
  Dialog, Tabs)

- Form‑Errors mit `aria-describedby` binden; Fokusmanagement in
  Dialogen/Drawern

- de‑Locale für Datum/Zeit, 24h‑Format, Wochentag (Mo–So)

- i18n optional: `next-intl`/`next-i18next` bei zukünftigem
  Mehrsprachbedarf

### 10.6. Print/PDF (Callsheet)

- Print‑Styles: A4‑optimiert, Kopf/Fuß mit Datum/Version, Seitenumbrüche
  via CSS

- Export: `react-to-print`; optional serverseitiger Export via
  `puppeteer` für Archiv/Sharing

## 11. Roadmap & Umsetzungsschritte

### 11.1. Sprint 1 – Attendance-Flow Grundlagen

- [ ] Prisma: `RehearsalAttendanceLog` (rehearsalId, userId, previous,
  next, comment, changedAt, changedBy)

- [ ] API: `PUT /api/rehearsals/[id]/attendance` schreibt Log +
  aktuellen Status

- [ ] UI: Zusage/Absage/Maybe mit optionalem Kommentar

- [ ] Kalender: Standard „geplant“ visualisieren (ohne Reaktion =
  eingeplant)

- [ ] Seed/Service: robuste Default-Logik (implizit oder
  Initial-Records)

- [ ] Tests: Attendance-Update, Log-Erzeugung, Rechte

Akzeptanzkriterien - \[ \] „Keine Reaktion“ wird als „geplant“
berücksichtigt - \[ \] Jede Statusänderung erzeugt einen Logeintrag - \[
\] Kalender hebt eigene geplante/zugesagte Proben sichtbar hervor

### 11.2. Sprint 2 – Calltimes & Finalisierung

- [ ] Prisma:
  `RehearsalCalltime(rehearsalId, userId?, roleId?, callAt, note)`

- [ ] API: `PUT /api/rehearsals/[id]/calltimes` (Upsert Liste) +
  Rückgabe in Rehearsal-GET

- [ ] UI: Calltimes anzeigen und für Planer\*innen editieren
  (Table/Drawer)

- [ ] Finalisierung: Statuswechsel „Final“ löst Benachrichtigungen aus

- [ ] Tests: Validierung, Rechte (nur Produktion/Regie editieren)

Akzeptanzkriterien - \[ \] Final markierte Proben zeigen Calltimes für
jede betroffene Person - \[ \] Änderungen an Calltimes sind
nachvollziehbar und rollen-gesichert

### 11.3. Sprint 3 – Szenen & Probierbarkeit

- [ ] Prisma: `Character`, `Scene`, `SceneCharacter`, `CharacterCasting`

- [ ] API: `CRUD /api/characters`, `CRUD /api/scenes`

- [ ] API: `GET /api/rehearsals/[id]/scenes/probierbar` (basierend auf
  Anwesenheiten)

- [ ] UI: Szenenliste mit Chips (Figuren, Dauer), Filter „heute
  probierbar“

- [ ] Seed: Beispiel-Szenen/Figuren für aktuelle Show

Akzeptanzkriterien - \[ \] Probierbare Szenen reflektieren Abwesenheiten
korrekt - \[ \] Mehrfachbesetzungen/Understudy werden berücksichtigt

### 11.4. Sprint 4 – Nachbereitung & Statistik

- [ ] Prisma: `RehearsalScenePlan`, `RehearsalSceneStatistic`,
  `RehearsalStatisticAttendee`

- [ ] API: `PUT /api/rehearsals/[id]/scenes` (Plan) \|
  `POST /api/rehearsals/[id]/statistics` (Ist)

- [ ] UI: Nachbereitungs-Form (Dauer, Anwesende, Notizen) +
  Statistik-Panel

- [ ] Reports: Minuten je Szene/Person, letzte Probe

Akzeptanzkriterien - \[ \] Statistik aktualisiert sich nach
Nachbereitung - \[ \] Planungssicht zeigt kumulierte Minuten und letzte
Probe je Szene/Person

### 11.5. Sprint 5 – Exhaustion & Planungswarnungen

- [ ] Endpoint: `GET /api/rehearsals/load?window=weekend` (Fr–So) je
  Person

- [ ] Heuristik: Grenzwerte und einfache Fatigue-Scores

- [ ] UI: Warnungen/Badges im Planungsview + Filter

- [ ] Optional: `MemberLoadSnapshot` Job zur Voraggregation

Akzeptanzkriterien - \[ \] Überlastungen werden im Wochenende
verlässlich erkannt und angezeigt

### 11.6. Sprint 6 – Abteilungen, Breakdown & Callsheet (optional)

- [ ] Prisma: `SceneBreakdownItem`, `SetLocation`, `Callsheet`,
  `CallsheetScene`

- [ ] API: Breakdown je Szene, Callsheet-CRUD + Publish

- [ ] UI: Abteilungsmodus (Kostüm/Requisite/Technik) mit Checklisten

- [ ] Export: Callsheet Print/PDF Styles

Akzeptanzkriterien - \[ \] Abteilungs-Checklisten sind filterbar und
änderbar mit Status - \[ \] Call Sheet kann erstellt, veröffentlicht und
gedruckt werden

### 11.7. Laufend – Qualität & Betrieb

- [ ] Benachrichtigungen (Mail, optional Slack), Idempotenz/Retries

- [ ] Access-Scopes für PII (Maße/Allergien), Audit-Logs

- [ ] Caching/Revalidierung für Listenansichten, Indizes prüfen

- [ ] Monitoring/Tracing (Sentry), strukturierte Logs

## 12. Offene Fragen & Risiken

- Datenschutz: Müssen Allergien/Körperdaten besonders geschützt
  (verschlüsselt) und mit Einwilligung versehen werden?

- Hosting & Dateiuploads: Existiert eine Infrastruktur für sichere
  Speicherung (S3, Cloudflare R2) oder muss sie aufgebaut werden?

- Benachrichtigungskanäle: Gibt es präferierte Tools (E-Mail, Messenger)
  und Limits? Wer pflegt SMTP-Credentials?

- Reservierungssystem: Werden Zahlungen integriert oder nur
  Reservierungen ohne Payment?

- Change Management: Wie werden Änderungen an Proben kommuniziert, und
  wer genehmigt Notfallabsagen?

## 13. Referenzen

- Mitglieder-Dashboard: `src/app/(members)/mitglieder/page.tsx`

- Probenkalender & Zusagen:
  `src/app/(members)/mitglieder/proben/page.tsx`

- Authentifizierung & RBAC: `src/lib/auth.ts`, `src/lib/rbac.ts`

- Datenmodell-Ausgangsbasis: `prisma/schema.prisma`
