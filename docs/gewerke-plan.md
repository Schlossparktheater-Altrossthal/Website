# Plan: Gewerke- & Rollenplanung

Stand: 2026-09-26. Entwurf, noch nichts umgesetzt. Checkliste am Ende wird gepflegt.

## Ziel

1. Wünsche aus dem Onboarding (Gewerke/Schauspiel) werden von Verantwortlichen **zugewiesen** (Gewerke und Rollen).
2. Eine Person kann in **mehreren** Gewerken und Rollen sein.
3. Jedes Gewerk hat ein **eigenes Portal**: Termine, Aufgaben/Kanban, Verantwortliche, Mitglieder, Dateien.
4. Mobil zuerst, am Desktop gleichwertig bedienbar.
5. Sauber verzahnt mit Produktionen, Sperrliste und Terminplanung.

## Ist-Stand (Befunde)

| #   | Befund                                                                                                                                                                                                                                                                                                              | Stelle                            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| 1   | `Department` ist **global**, nicht pro Produktion. `DepartmentMembership` ebenso. Passt nicht zu „pro Jahr eine Produktion, starker Wechsel“ (siehe produktionen-mitglieder-plan, Befund 8)                                                                                                                         | `schema.prisma`                   |
| 2   | Onboarding-Wünsche (`MemberRolePreference`, pro Produktion, Codes `crew_stage`, `crew_tech`, `crew_costume` … `acting_lead`) und `Department` (Slugs wie `ton`, `requisite`) sind **nicht verknüpft**. Keine Zuordnung Code → Gewerk                                                                                | `role-preferences.ts`, `seed.mjs` |
| 3   | Es gibt **keinen Zuweisungs-Workflow**. Mitglieder werden einzeln in `produktionen/gewerke/[departmentId]` hinzugefügt (807 Zeilen), ohne Wunsch-Übersicht. `requiresJoinApproval` ist im Modell, aber ohne Beitrittsanfrage-Funktion                                                                               | `departments.ts`                  |
| 4   | Rollen (`Character`/`CharacterCasting`) haben eine Besetzungsseite, die nur die Wunsch-Größe (`acting_*`) kennt; Verknüpfung zu Ensemble-Wünschen ist lose                                                                                                                                                          | `produktionen/besetzung`          |
| 5   | „Meine Gewerke“ (`meine-gewerke/page.tsx`) ist ein **Platzhalter** („Die alte Ansicht wurde entfernt“). Detailseite `[slug]` (412 Z.) + `department-card.tsx` (655 Z.) sind Reste der alten Ansicht: Körpermaße, Terminvorschläge, Aufgabenlisten. Zugriff nur für Board oder Leitung, nicht für normale Mitglieder | `meine-gewerke/*`                 |
| 6   | Aufgaben: `DepartmentTask` mit `todo/doing/done`, aber ohne Reihenfolge, Priorität, Labels, Kommentare, Checklisten; kein Kanban. Zuweisung über eigene Join-Tabelle (ok)                                                                                                                                           | `schema.prisma`                   |
| 7   | Termine: `DepartmentEvent` (getrennt von `CalendarEvent`, das die Sperrliste nutzt). Ohne Teilnehmerliste/Zu-/Absage, ohne Bezug zu Sperren. Nur in den ICS-Feed eingebunden (`calendar/feed.ts`)                                                                                                                   | `schema.prisma`, `feed.ts`        |
| 8   | Rechte: nur `PRIVATE.DEPARTMENT.OWN.VIEW` + `DepartmentPermission` (Rechte, die ein Gewerk vergibt). Leitung hat keine Gewerk-internen Rechte (Mitglieder verwalten etc.)                                                                                                                                           | `permissions.ts`                  |
| 9   | Dokumente als `Bytes` in der DB (`DepartmentDocument`), parallel zur `FileLibrary`                                                                                                                                                                                                                                  | `schema.prisma`                   |
| 10  | Szenen-Breakdown (`SceneBreakdownItem`) hängt an `Department`. Gute Basis, um Gewerke-Bedarf aus dem Stück abzuleiten (Requisite pro Szene etc.)                                                                                                                                                                    | `schema.prisma`                   |
| 11  | Sperrliste/Terminplanung kennen nur Personen + `CalendarEvent`. Keine Sicht „Sperren meines Gewerks“                                                                                                                                                                                                                | `sperrliste/*`                    |

## Zielbild

### Datenmodell

Ein Gewerk gehört zu einer Produktion. Die Vorlagen (Ton, Bühne, Kostüm …) bleiben global als **Vorlage**, damit die Saison-Einrichtung schnell geht.

```
DepartmentTemplate (global)   slug, name, color, icon, defaultPreferenceCodes[]   // z. B. Kostüm ← crew_costume
Department (pro Show)         showId, templateId?, name, color, description, requiresJoinApproval, archivedAt
DepartmentMembership          + status (requested | active | left), Rolle lead/deputy/member/guest,
                              source (onboarding-wunsch | selbst | zugewiesen), assignedById, decidedAt
CastAssignment = CharacterCasting (bleibt, Rollen sind schon pro Show)
```

- Mehrfachzugehörigkeit ist durch `@@unique([departmentId, userId])` schon möglich, aber erst pro Show sinnvoll.
- **Wunsch-Mapping**: `defaultPreferenceCodes` an der Vorlage (`crew_costume` → Kostüm). Freie Wünsche (`custom-…`) werden in der Zuweisung als „sonstiger Wunsch“ gezeigt.
- Rollen: `Character` bekommt Zuordnung zu Wunsch-Größe wie bisher; Besetzungsvorschlag nutzt `acting_*`-Wünsche + Verfügbarkeit.

Aufgaben/Kanban (neu, ersetzt `DepartmentTask`):

```
DepartmentBoard (1:1 Department; später mehrere möglich)
BoardColumn      name, order, doneColumn: bool           // Standard: Offen / In Arbeit / Review / Erledigt (anpassbar)
DepartmentTask   + columnId, position, priority, dueAt, labels[], checklist Json, sceneId?/characterId? (Bezug), archivedAt
TaskComment      taskId, authorId, body
```

Termine: `DepartmentEvent` wird auf **`CalendarEvent` mit `departmentId`** zurückgeführt (ein Termin-System). Dazu Teilnehmer (`CalendarEventInvitee`, Status zugesagt/abgesagt), damit Sperrliste und Zusagen zusammenspielen.

### Rechte

- Neue Gewerk-Rollen-Rechte **kontextbezogen** (wie `hasPermission(user, key, { showId })`): `{ departmentId }`.
  - Leitung/Vertretung: Mitglieder verwalten, Termine/Board pflegen, Anfragen entscheiden.
  - Mitglied: Board/Termine sehen und Aufgaben bearbeiten. Gast: nur lesen.
- Globale Verantwortliche (Regie/Board, Recht `PRIVATE.PRODUCTION.SHOW.MANAGE`): Zuweisung über alle Gewerke, Gewerke anlegen.
- Kein neues Rollensystem; die vorhandene Struktur wird nur um den Gewerk-Kontext ergänzt.

### Oberflächen (mobil zuerst)

**A. Zuweisung („Besetzung & Teams“)** – für Verantwortliche, unter Produktion.

- Eine Seite, zwei Reiter: **Gewerke** und **Rollen**.
- Mobil: Personenliste mit Wunsch-Chips (Stärke wie im Onboarding, „Herzensprojekt“ …). Tippen → BottomSheet „Zuweisen zu …“ (Mehrfachauswahl, Leitung/Mitglied).
- Desktop: Zwei Spalten (Wünsche links, Gewerke rechts), Drag&Drop **und** Auswahlmenü (barrierefrei).
- Filter „noch ohne Zuweisung“, „mehr als 2 Gewerke“, Auslastungsanzeige pro Gewerk. Sammelaktion „Alle Wünsche annehmen“ (Vorschlag, mit Prüfstufe).
- Benachrichtigung an Person (Notification) bei Zuweisung; bei `requiresJoinApproval` Anfragen-Liste.

**B. „Meine Teams“** – Einstieg für alle Mitglieder.

- Karten je Gewerk/Rolle: nächster Termin, meine offenen Aufgaben, Leitung als Ansprechperson.
- Dashboard-Karte und Navigationspunkt für jeden, der in ≥1 Gewerk ist (heute nur Leitung/Board).

**C. Gewerk-Portal** `/mitglieder/gewerke/[slug]` mit Tabs (mobil: untere Tab-Leiste, oben scrollbare Chips):

1. **Übersicht** – Beschreibung, Leitung, nächste Termine, meine Aufgaben, Ankündigung.
2. **Board** – Kanban. Mobil: eine Spalte pro Seite (Wischen), Statuswechsel per Sheet; Desktop: Drag&Drop mit Tastatur-Alternative.
3. **Termine** – Liste/Monat, Zu-/Absage, „Wer kann?“-Vorschlag aus Sperrliste (bestehende `findMeetingSuggestions` wiederverwenden).
4. **Team** – Mitglieder, Leitung ernennen, Anfragen, Einladen aus Ensemble.
5. **Dateien** – über `FileLibrary` (Ordner pro Gewerk) statt Bytes in DB.
6. Gewerkeabhängige Extras als Module (Kostüm: Körpermaße; Requisite/Bühne: Szenen-Breakdown).

### Integration

- **Sperrliste**: Filter „mein Gewerk“ im Team-Reiter; Gewerk-Termine tauchen im Kalender als Terminart auf (`CalendarEventKind`); Warnung bei Terminanlage, wenn Mitglieder gesperrt sind.
- **Terminplanung/Proben**: Proben-Szenen ↔ Gewerke (Breakdown): „Welche Gewerke werden zur Probe X benötigt“ → Einladung nur an Betroffene (`RehearsalInvitee` existiert).
- **Produktionswechsel**: Beim Saisonwechsel Gewerke aus Vorlagen bzw. Vorjahr kopieren (Leitung, Board-Spalten, ohne Mitglieder). Ergänzt Saison-Assistent.
- **ICS-Feed** und Dashboard „Nächste Termine“ bekommen Gewerk-Termine über das vereinheitlichte Termin-System.
- **Rechte-Seite** (`permission-workbench`) zeigt Gewerk-Kontexte in „Rechte“ pro Person.

## Phasen

1. **Grundlage (Datenmodell)**: `Department` pro Show + Vorlagen, Migration der Bestandsdaten (Prod: Gewerke der „Unendlichen Geschichte“ zuordnen), Membership-Status, Wunsch-Mapping. Migration testen wie beim Produktionen-Umbau (Staging-Dump).
2. **Zuweisung**: Seite „Besetzung & Teams“ (Gewerke + Rollen), Benachrichtigungen, Anfragen.
3. **Gewerk-Portal Basis** (als generisches Team-Portal, damit Rollen es wiederverwenden): Übersicht, Team, „Meine Teams“, Navigation, Rechte im Gewerk-Kontext.
   3b. **Rollenportal**: Character-Portal auf dem Gerüst, Szenen- und Besetzungsbezug, Zweitbesetzung.
4. **Board**: neues Aufgabenmodell + Kanban mobil/Desktop, Kommentare.
5. **Termine**: Vereinheitlichung mit `CalendarEvent`, Zusagen, Sperrlisten-Bezug, ICS.
6. **Dateien + Module**: FileLibrary-Anbindung, Körpermaße/Breakdown als Module; Alt-Code (`meine-gewerke/*`, `produktionen/gewerke/*`) entfernen.
7. **E2E, Screenshots (mobil/Desktop), Staging, Release.**

Jede Phase einzeln auf Staging testbar; Schema-Änderungen additiv vor Alt-Entfernung (siehe Regel: keine inkompatiblen Änderungen in einem Schritt).

## Entscheidungen (2026-09-26)

- E1: Gewerke **pro Produktion**, Vorlagen global.
- E2: Regie/Board sehen und weisen alles zu; die Gewerk-Leitung kann Anfragen für das eigene Gewerk ebenfalls annehmen.
- E3: **Eigenes Rollenportal** (Schauspielrollen), Grundlage für spätere Szenenplanung. Rolle = `Character` pro Produktion mit Portal: Übersicht, besetzte Person(en) inkl. Zweitbesetzung, Szenen (`SceneCharacter`), Termine/Proben mit Bezug zur Rolle, Notizen/Textbuch-Verweise, Kostüm/Requisite-Bezug (Breakdown). Wird als gemeinsames „Team-Portal“-Gerüst mit den Gewerken gebaut (gleiche Tabs, gleiche Termin-/Rechte-Logik), damit Szenenplanung später beide bedienen kann.
- E4: Kanban mit anpassbaren Spalten, Standard Offen / In Arbeit / Review / Erledigt.
- E5: Dateien über `FileLibrary` (Ordner pro Gewerk/Rolle), Umstellung in Phase 6; bis dahin bleibt `DepartmentDocument`.

## Checkliste

- [x] Phase 1 Datenmodell (2026-09-26: Migration `departments_per_production`, Vorlagen, Status; Alt-Seiten laufen weiter, aber nur mit aktuellen Mitgliedschaften)
- [ ] Phase 2 Zuweisung
- [ ] Phase 3 Portal Basis (gemeinsames Team-Portal-Gerüst für Gewerke und Rollen)
- [ ] Phase 3b Rollenportal (Szenen, Besetzung, Termine)
- [ ] Phase 4 Board
- [ ] Phase 5 Termine
- [ ] Phase 6 Dateien/Module/Aufräumen
- [ ] Phase 7 E2E/Release
