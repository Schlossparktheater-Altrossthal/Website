# Plan: Terminplanung mit Zielgruppen, Szenen und Terminfinder

Stand: 2026-09-26. Entwurf, noch nichts umgesetzt. Checkliste am Ende wird gepflegt.

## Ziel

1. Termine gezielt an **Zielgruppen** richten: ganze Produktion, alle Schauspieler, Gewerke (einzelne/alle), Rollen, Rollen ausgewählter Szenen, Einzelpersonen – kombinierbar, mit Ausnahmen.
2. **Planen vor Besetzen**: Ein Termin kann lange vorher feststehen, wer genau kommt, wird später festgelegt.
3. **Szenen** an Proben hängen, optional mit Uhrzeit pro Szene; sehen, was wie oft geprobt wurde.
4. Die **Sperrliste aktiv nutzen**: Terminfinder und Konfliktprüfung statt nur Anzeige.
5. Jede Person bekommt nur die Termine, die sie betreffen – in „Meine Termine“ und im **Kalender-Feed**.
6. Die Planung erfährt sofort von **Absagen**.

## Ist-Stand (Befunde)

| #   | Befund                                                                                                                                                                           | Stelle                                                                        |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1   | Drei Terminsysteme: `Rehearsal` (Probenplanung), `CalendarEvent` (Terminplanung), `CalendarEvent` mit `departmentId` (Gewerk-Portal) – je eigener Editor und Logik               | `schema.prisma`, `probenplanung/*`, `terminplanung/*`, `meine-gewerke/events` |
| 2   | Zielgruppe nur „alle“ oder abgehakte Personenliste (`RehearsalInvitee`); Liste ist ein Schnappschuss, Umbesetzungen werden nicht nachgezogen                                     | `actions-helpers.ts` (`defaultInviteeIds`)                                    |
| 3   | Zwei Zusage-Modelle: `RehearsalAttendance` (yes/no/maybe/emergency) und `CalendarEventResponse` (yes/maybe/no)                                                                   | `schema.prisma`                                                               |
| 4   | Proben kennen keine Szenen; keine Auswertung „wie oft geprobt“                                                                                                                   | –                                                                             |
| 5   | Kein Zustand „Termin steht, Besetzung folgt“ (`DRAFT` ist unsichtbar, `PLANNED` lädt sofort ein)                                                                                 | `RehearsalStatus`                                                             |
| 6   | Sperrliste nur als Anzeige in der Terminplanung; kein Terminfinder, keine Konfliktwarnung                                                                                        | `terminplanung/page-client.tsx`                                               |
| 7   | Feed liefert alle Termine aller eigenen Produktionen; einziger Schalter `includeBlockedDays`                                                                                     | `lib/calendar/feed.ts`                                                        |
| 8   | Altlasten: `requiredRoles` (JSON), `RehearsalTemplate` ohne Produktion, `RehearsalProposal` + Generator (nur `cast`/`tech`, feste Wochenend-Slots), `FinalRehearsalDuty` separat | `proposal-generator.ts`                                                       |
| 9   | Absagen erreichen die Planung nicht aktiv                                                                                                                                        | `meine-proben/actions.ts`                                                     |

## Entscheidungen

- **Volle Kontrolle über die Teilnehmer**: Regeln (Szene, Rolle, Gewerk …) schlagen Teilnehmer vor; jede Person in der aufgelösten Liste kann einzeln **ausgenommen** oder in der Verbindlichkeit geändert werden. Manuelle Änderungen überstehen jede Neuberechnung.
- **Zweitbesetzungen**: pro Rollen-/Szenen-Regel wählbar „benötigt / optional / nicht einladen“ (Vorgabe: optional). Unabhängig davon einzeln ausnehmbar.
- **Uhrzeit pro Szene ist optional**: pro Termin Modus „gemeinsam“ (alle zur Terminzeit) oder „gestaffelt“ (Uhrzeiten pro Szene, jede Person bekommt ihr persönliches Zeitfenster).
- **Absagen benachrichtigen die Planung** (siehe Abschnitt Benachrichtigungen).
- **Ein Terminmodell**: `CalendarEvent` wird Kern, Proben sind `kind = REHEARSAL`; `Rehearsal` wird migriert.

## Zielbild

### Lebenszyklus

`DRAFT` (nur Planung sieht ihn) → `RESERVED` („Probe – Besetzung folgt“, für Produktion sichtbar, im Feed als vorgemerkt/transparent) → `SCHEDULED` (Teilnehmer stehen, Einladung geht raus, Zusagen offen) → `DONE` (Szenen abhaken, Anwesenheit) · `CANCELLED`

### Datenmodell

```prisma
enum CalendarEventKind { REHEARSAL PERFORMANCE MEETING WORK_DAY SOCIAL OTHER }
enum EventStatus { DRAFT RESERVED SCHEDULED DONE CANCELLED }
enum EventScheduleMode { TOGETHER STAGGERED }
enum AudienceRuleType {
  ORGANIZATION_ALL PRODUCTION_ALL ALL_CAST ALL_CREW
  DEPARTMENT DEPARTMENT_LEADS CHARACTER SCENE USER
}
enum ParticipationLevel { REQUIRED OPTIONAL INFO }
enum SecondCastMode { REQUIRED OPTIONAL NONE }
enum SceneRehearsalOutcome { DONE PARTIAL SKIPPED }

model CalendarEvent {               // erweitert
  status           EventStatus       @default(DRAFT)
  scheduleMode     EventScheduleMode @default(TOGETHER)
  departmentId     String?           // Eigentümer (Gewerk-Termin), nicht mehr Sichtbarkeit
  seriesId         String?           // Serien / Vorlagen
  responseDeadline DateTime?
  audienceRules    EventAudienceRule[]
  participants     EventParticipant[]
  scenes           EventScene[]
}

model EventAudienceRule {
  id         String             @id @default(cuid())
  eventId    String
  type       AudienceRuleType
  targetId   String?            // departmentId / characterId / sceneId / userId
  level      ParticipationLevel @default(REQUIRED)
  secondCast SecondCastMode     @default(OPTIONAL)  // nur CHARACTER / SCENE / ALL_CAST
}

/// Aufgelöste Teilnehmer; bei Änderungen an Besetzung/Gewerk/Regeln neu berechnet.
model EventParticipant {
  eventId      String
  userId       String
  level        ParticipationLevel
  reasons      Json                 // ["Bastian (Sz. 3, 5)", "Gewerk Technik"]
  /// Manuelle Entscheidung der Planung, übersteht Neuberechnung:
  /// null = aus Regeln, INCLUDED = von Hand dazu, EXCLUDED = ausgenommen
  override     ParticipantOverride?
  levelOverride ParticipationLevel?
  personalStart DateTime?           // bei STAGGERED: früheste eigene Szene
  personalEnd   DateTime?           // bei STAGGERED: späteste eigene Szene
  response     EventResponseStatus? // ersetzt RehearsalAttendance + CalendarEventResponse
  responseNote String?              // Pflicht bei Absage von REQUIRED
  respondedAt  DateTime?
  attended     Boolean?
  @@id([eventId, userId])
}

model EventScene {
  eventId        String
  sceneId        String
  order          Int
  startsAt       DateTime?          // nur bei STAGGERED
  endsAt         DateTime?
  outcome        SceneRehearsalOutcome?
  note           String?
  @@id([eventId, sceneId])
}

model CalendarFeed {                // erweitert
  includeOptional     Boolean @default(true)
  includeInfo         Boolean @default(false)
  includeOrganization Boolean @default(true)
  includeReserved     Boolean @default(true)
  includeBlockedDays  Boolean @default(false)
}
```

Auflösung: Regeln → Kandidaten (mit Gründen, höchste Verbindlichkeit gewinnt) → Overrides anwenden (`EXCLUDED` fliegt raus, `INCLUDED` bleibt). Neu hinzukommende Personen (z. B. nach Umbesetzung) werden bei `SCHEDULED` eingeladen und in der Planung als „neu“ markiert; Weggefallene werden informiert.

Szenen-Statistik wird aus `EventScene.outcome` + Anwesenheit berechnet (Anzahl, Minuten, zuletzt geprobt, Anteil der Besetzung anwesend) – keine eigene Tabelle.

Wegfall/Umzug: `RehearsalInvitee`, `RehearsalAttendance`, `requiredRoles`, `RehearsalProposal` + Generator entfallen; `RehearsalTemplate` → Serie/Vorlage mit `showId` + Regeln; `FinalRehearsalDuty` → Termin mit einem Teilnehmer; `RehearsalAttendanceLog` → auf `EventParticipant`.

### Benachrichtigungen

- **Absage** (oder Wechsel auf „vielleicht“) einer Person mit `REQUIRED`: sofort an Ersteller:in und alle mit Planungsrecht für den Termin (Produktion bzw. Gewerk-Leitung) – In-App + Mail, mit Begründung.
- Bei Szenenproben mit Kontext: „Szene 3 ist unvollständig – Bastian fehlt (Zweitbesetzung Lena kann laut Sperrliste)“.
- Kurzfristige Absagen (< 48 h, Wert in `SperrlisteSettings`) hervorgehoben.
- `OPTIONAL`-Absagen nur gesammelt in der Terminübersicht, keine Mail.
- Teilnehmer: Einladung bei `SCHEDULED`, Änderung von Zeit/Ort/eigenen Szenen, Absage des Termins, Erinnerung vor Antwortfrist.

### Planungswerkzeuge

1. **Terminfinder**: Zielgruppe (gleicher Baukasten) + Zeitraum + Dauer + Wochentage/Zeitfenster → Tages-Heatmap, sortiert nach Eignung (REQUIRED schwerer als OPTIONAL; Sperrlisten-Stufen; vorhandene Termine). Klick legt den Termin mit Zielgruppe an. Auch für Gewerk-Leitungen (nur eigene Mitglieder).
2. **Szenen-Planer**: Matrix Szenen × kommende reservierte Proben; Zelle = Besetzung komplett/teilweise/nicht verfügbar; Spalte mit Probenzähler und „zuletzt geprobt“; Vorschläge für selten geprobte Szenen; Szene auf Termin ziehen.
3. **Konfliktprüfung** im Editor: Benötigte mit Sperre oder Parallel-Termin, unvollständige Szenen.

### UI

- Navigation: „Terminplanung“ + „Probenplanung“ → **Planung** (pro Produktion) mit Tabs **Kalender · Szenen · Terminfinder · Vorlagen**. „Meine Proben“ → **Meine Termine**.
- **Editor** als Seitenpanel in vier Schritten:
  1. Was & Wann (oder „Termin finden →“)
  2. Wer – Zielgruppen-Baukasten
  3. Szenen (nur Proben) – Auswahl mit Probenzähler, Schalter „Uhrzeit pro Szene“
  4. Prüfen – Konflikte, „nur reservieren“ / „ansetzen & einladen“, Antwortfrist

```
Wer ist dabei?                       23 Personen · 19 können · 3 eingeschränkt · 1 blockiert
[+ Produktion] [+ Alle Schauspieler] [+ Gewerk ▾] [+ Rolle ▾] [+ Szene ▾] [+ Person ▾]
 ● Rollen aus Szene 3, 5 (11)   benötigt ▾   Zweitbesetzung: optional ▾   ✕
 ● Gewerk Technik (6)           optional ▾                                ✕
 ● Anna Müller                  benötigt ▾                                ✕

 Teilnehmer                                   Sperrliste   Grund
 [✓] Max Kaiser        benötigt ▾             ● kann       Bastian (Sz. 3, 5)
 [ ] Ben Schmidt       ausgenommen            ● blockiert  Atréju (Sz. 3)      ← einzeln abgewählt
 [✓] Lena Vogt         optional ▾             ● kann       Zweitb. Bastian
```

- Gestaffelt: Szenenliste mit Uhrzeiten, Vorschau „Max: 18:00–19:30 (Sz. 3, 5)“.
- **Meine Termine**: Filter-Chips _Muss ich hin · Optional · Info · Verein_; auf jeder Karte der Grund und bei gestaffelten Proben die persönliche Zeit; offene Zusagen oben; Zusage direkt auf der Karte, bei Absage eines Pflichttermins Begründung.
- **Nach der Probe**: Szenen abhaken (geschafft/teilweise/nicht), Anwesenheit.
- **Feed-Einstellungen** in „Kalender-Abo“: Schalter wie in `CalendarFeed`; persönliche Zeit bei gestaffelten Proben; Szenen in der Beschreibung.

### Rechte

- `calendar.plan` (scoped auf `showId`): Produktion/Regie – alle Regeln.
- `department.events.manage`: Gewerk-Leitung – Regeln nur innerhalb des eigenen Gewerks und dessen Mitglieder, Terminfinder für diese.

## Phasen

1. Datenmodell + Migration `Rehearsal` → `CalendarEvent`, Zusagen zusammenführen; UI funktional unverändert.
2. Zielgruppen-Baukasten mit Ausnahmen/Zweitbesetzung, Verbindlichkeit, Gründe; „Meine Termine“; Feed-Filter.
3. Status `RESERVED`, Konfliktprüfung, Absage-Benachrichtigung an die Planung.
4. Szenen an Proben (gemeinsam/gestaffelt), persönliche Zeiten, Nachbereitung, Szenen-Statistik.
5. Terminfinder (auch Gewerke).
6. Szenen-Planer mit Vorschlägen; Altlasten entfernen.
7. E2E + Release.

## Checkliste

- [ ] Phase 1
- [ ] Phase 2
- [ ] Phase 3
- [ ] Phase 4
- [ ] Phase 5
- [ ] Phase 6
- [ ] Phase 7
