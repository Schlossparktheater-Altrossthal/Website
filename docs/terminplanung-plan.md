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

Leitlinie: **so einfach wie möglich, Kontrolle bleibt bei der Planung.** Bewusst verworfen wurden feinere Status, eine Stufe „zur Info“, ein Zweitbesetzungs-Schalter pro Regel und fein granulare Feed-Schalter (Review 2026-09-26: nutzt kaum jemand, macht UI und Modell schwerer).

- **Ein Terminmodell**: `CalendarEvent` wird Kern, Proben sind `kind = REHEARSAL`; `Rehearsal` wird migriert.
- **Drei Status**: Entwurf, Angesetzt, Abgesagt. „Besetzung folgt“ = angesetzter Termin ohne (vollständige) Teilnehmer; „durchgeführt“ ergibt sich aus dem Datum.
- **Zwei Verbindlichkeiten**: benötigt / optional.
- **Volle Kontrolle über die Teilnehmer**: Regeln (Szene, Rolle, Gewerk …) schlagen Teilnehmer vor; jede Person kann einzeln ausgenommen, hinzugefügt oder umgestuft werden.
- **Zweitbesetzungen** kommen automatisch als optional dazu und sind wie alle einzeln ausnehmbar.
- **Keine stillen Änderungen**: Ändert sich Besetzung/Gewerk nach dem Ansetzen, zieht das System nicht selbst nach, sondern zeigt der Planung „2 Änderungen übernehmen?“. Entwürfe rechnen live.
- **Uhrzeit pro Szene ist optional**: pro Termin „gemeinsam“ oder „gestaffelt“; bei gestaffelt bekommt jede Person ihr persönliches Zeitfenster.
- **Absagen benachrichtigen die Planung** (siehe Benachrichtigungen).
- **Feed**: „Nur meine Termine“ (Standard) oder „Alles aus meinen Produktionen“, plus eigene Sperren.

## Zielbild

### Datenmodell

```prisma
enum CalendarEventKind { REHEARSAL PERFORMANCE MEETING WORK_DAY SOCIAL OTHER }
enum EventStatus { DRAFT SCHEDULED CANCELLED }
enum EventScheduleMode { TOGETHER STAGGERED }
enum AudienceRuleType {
  ORGANIZATION_ALL PRODUCTION_ALL ALL_CAST ALL_CREW
  DEPARTMENT DEPARTMENT_LEADS CHARACTER SCENE USER
}
enum ParticipationLevel { REQUIRED OPTIONAL }
enum ParticipantOverride { INCLUDED EXCLUDED }
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
  id       String             @id @default(cuid())
  eventId  String
  type     AudienceRuleType
  targetId String?            // departmentId / characterId / sceneId / userId
  level    ParticipationLevel @default(REQUIRED)
}

/// Aufgelöste Teilnehmer (gespeichert, damit Feed/Zusagen/Abfragen einfach bleiben).
model EventParticipant {
  eventId       String
  userId        String
  level         ParticipationLevel
  reasons       Json                 // ["Bastian (Sz. 3, 5)", "Zweitb. Atréju", "Gewerk Technik"]
  override      ParticipantOverride? // Handentscheidung der Planung, übersteht Neuberechnung
  personalStart DateTime?            // bei STAGGERED: früheste eigene Szene
  personalEnd   DateTime?            // bei STAGGERED: späteste eigene Szene
  response      EventResponseStatus? // ersetzt RehearsalAttendance + CalendarEventResponse
  responseNote  String?              // Pflicht bei Absage von REQUIRED
  respondedAt   DateTime?
  attended      Boolean?
  @@id([eventId, userId])
}

model EventScene {
  eventId  String
  sceneId  String
  order    Int
  startsAt DateTime?                 // nur bei STAGGERED
  endsAt   DateTime?
  outcome  SceneRehearsalOutcome?    // Nachbereitung
  note     String?
  @@id([eventId, sceneId])
}

model CalendarFeed {                // erweitert
  scope              FeedScope @default(MINE)   // MINE | PRODUCTIONS
  includeBlockedDays Boolean   @default(false)
}
```

Auflösung: Regeln → Kandidaten mit Gründen (höchste Verbindlichkeit gewinnt; Zweitbesetzung aus Rollen-/Szenen-Regeln als `OPTIONAL`) → Overrides anwenden (`EXCLUDED` fliegt raus, `INCLUDED` bleibt). Nach dem Ansetzen werden Abweichungen zwischen Regeln und gespeicherter Liste nur angezeigt und auf Klick übernommen (Neue werden eingeladen, Weggefallene informiert).

Szenen-Statistik wird aus `EventScene.outcome` + Anwesenheit berechnet (Anzahl, Minuten, zuletzt geprobt) – keine eigene Tabelle.

Wegfall/Umzug: `RehearsalInvitee`, `RehearsalAttendance`, `requiredRoles`, `RehearsalProposal` + Generator entfallen; `RehearsalTemplate` → Serie/Vorlage mit `showId` + Regeln; `FinalRehearsalDuty` → Termin mit einem Teilnehmer; `RehearsalAttendanceLog` → auf `EventParticipant`.

### Benachrichtigungen

- **Absage** (oder Wechsel auf „vielleicht“) einer Person mit `REQUIRED`: sofort an Ersteller und alle mit Planungsrecht für den Termin (Produktion bzw. Gewerk-Leitung) – In-App + Mail, mit Begründung.
- Bei Szenenproben mit Kontext: „Szene 3 ist unvollständig – Bastian fehlt (Zweitbesetzung Lena kann laut Sperrliste)“.
- Kurzfristige Absagen (< 48 h, Wert in `SperrlisteSettings`) hervorgehoben.
- `OPTIONAL`-Absagen nur gesammelt beim Termin, keine Mail.
- Teilnehmer: Einladung beim Ansetzen bzw. beim Hinzufügen, Änderung von Zeit/Ort/eigenen Szenen, Absage des Termins, Erinnerung vor Antwortfrist.

### Planungswerkzeuge

1. **Terminfinder**: Zielgruppe (gleicher Baukasten) + Zeitraum + Dauer + Wochentage/Zeitfenster → Tagesliste/Heatmap, sortiert nach Eignung (REQUIRED schwerer als OPTIONAL; Sperrlisten-Stufen; vorhandene Termine). Klick legt den Termin mit Zielgruppe an. Auch für Gewerk-Leitungen (nur eigene Mitglieder).
2. **Szenen-Übersicht**: pro Szene Probenzähler, zuletzt geprobt, Minuten; in der Szenenauswahl des Editors direkt sichtbar, dazu pro Szene, ob die Besetzung am gewählten Tag da ist.
3. **Konfliktprüfung** im Editor: Benötigte mit Sperre oder Parallel-Termin, unvollständige Szenen.

Zurückgestellt: Szenen-Planer als Matrix mit automatischen Vorschlägen – erst bauen, wenn nach Phase 4 noch Bedarf besteht.

### UI

- Navigation: „Terminplanung“ + „Probenplanung“ → **Planung** (pro Produktion) mit Bereichen **Kalender · Szenen · Terminfinder · Vorlagen**. „Meine Proben“ → **Meine Termine**.
- **Editor** als ein Formular (`ModalFormDialog` bzw. Seitenpanel) mit einklappbaren Abschnitten, einfache Termine bleiben kurz:
  - Was & Wann (Link „Termin finden →“)
  - Wer – Zielgruppen-Baukasten mit aufgelöster Liste
  - Szenen (nur bei Proben) – Auswahl mit Probenzähler, Schalter „Uhrzeit pro Szene“
  - Unten: Konflikthinweise, Antwortfrist, Buttons „Als Entwurf speichern“ / „Ansetzen & einladen“

```
Wer ist dabei?                       23 Personen · 19 können · 3 eingeschränkt · 1 blockiert
[+ Produktion] [+ Alle Schauspieler] [+ Gewerk ▾] [+ Rolle ▾] [+ Szene ▾] [+ Person ▾]
 ● Rollen aus Szene 3, 5 (11)   benötigt ▾   ✕
 ● Gewerk Technik (6)           optional ▾   ✕

 Teilnehmer                                   Sperrliste   Grund
 [✓] Max Kaiser        benötigt ▾             ● kann       Bastian (Sz. 3, 5)
 [ ] Ben Schmidt       ausgenommen            ● blockiert  Atréju (Sz. 3)      ← einzeln abgewählt
 [✓] Lena Vogt         optional ▾             ● kann       Zweitb. Atréju
```

- Gestaffelt: Szenenliste mit Uhrzeiten, Vorschau „Max: 18:00–19:30 (Sz. 3, 5)“.
- Angesetzter Termin mit Abweichungen: Hinweisbox „Besetzung geändert – 2 Änderungen übernehmen?“ mit Vorschau.
- **Meine Termine**: Filter-Chips _Muss ich hin · Optional · Verein_; auf jeder Karte der Grund und bei gestaffelten Proben die persönliche Zeit; offene Zusagen oben; Zusage direkt auf der Karte, bei Absage eines Pflichttermins Begründung.
- **Nach der Probe**: Szenen abhaken (geschafft/teilweise/nicht), Anwesenheit.
- **Kalender-Abo**: Auswahl „Nur meine Termine“ / „Alles aus meinen Produktionen“ + Schalter „eigene Sperren“; persönliche Zeit bei gestaffelten Proben; Szenen in der Beschreibung.

### Rechte

- Planungsrecht (scoped auf `showId`, Key nach Schema `PRIVATE.…` in `DEFAULT_PERMISSION_DEFINITIONS`): Produktion/Regie – alle Regeln.
- Gewerk-Termine: Gewerk-Leitung – Regeln nur innerhalb des eigenen Gewerks und dessen Mitglieder, Terminfinder für diese.

## Phasen

1. Datenmodell + Migration `Rehearsal` → `CalendarEvent`, Zusagen zusammenführen; UI funktional unverändert.
2. Zielgruppen-Baukasten mit Ausnahmen, Verbindlichkeit, Gründe, Abweichungs-Hinweis; „Meine Termine“; Feed-Auswahl.
3. Konfliktprüfung + Absage-Benachrichtigung an die Planung; Altlasten entfernen.
4. Szenen an Proben (gemeinsam/gestaffelt), persönliche Zeiten, Nachbereitung, Szenen-Übersicht.
5. Terminfinder (auch Gewerke); E2E + Release.

## Checkliste

- [ ] Phase 1
- [ ] Phase 2
- [ ] Phase 3
- [ ] Phase 4
- [ ] Phase 5
