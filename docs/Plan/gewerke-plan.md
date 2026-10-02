# Plan: Gewerke- & Rollenplanung

Stand: 2026-10-01. Phase 1–6 umgesetzt, offen Phase 7 (E2E und Release); Fortsetzung Phase 8–13 (Blaupausen, Bausteine, Szenenbedarf, Budget) geplant. Checkliste am Ende
wird gepflegt.

## Ziel

1. Wünsche aus dem Onboarding (Gewerke/Schauspiel) werden von Verantwortlichen **zugewiesen** (Gewerke und Rollen).
2. Eine Person kann in **mehreren** Gewerken und Rollen sein.
3. Jedes Gewerk hat ein **eigenes Portal**: Termine, Aufgaben/Kanban, Verantwortliche, Mitglieder, Dateien.
4. Mobil zuerst, am Desktop gleichwertig bedienbar.
5. Sauber verzahnt mit Produktionen, Sperrliste und Terminplanung.

## Ist-Stand (Befunde)

| #   | Befund                                                                                                                                                                                                                                                                                                              | Stelle                            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| 1   | `Department` ist **global**, nicht pro Produktion. `DepartmentMembership` ebenso. Passt nicht zu „pro Jahr eine Produktion, starker Wechsel“ (siehe `docs/Plan/produktionen-mitglieder-plan.md`, Befund 8)                                                                                                          | `schema.prisma`                   |
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
- [x] Phase 2 Zuweisung (2026-09-26: Seite `produktionen/zuweisung`, Anfragen über „Meine Gewerke“ bei Beitrittsprüfung; Rollen-Zuweisung als Reiter)
- [x] Phase 3 Portal Basis (2026-09-26: „Meine Teams“ + Portal Übersicht/Aufgaben/Team, Daten `src/lib/departments/portal.ts`; alte Komponenten department-card/event-planner ungenutzt → Phase 6 entfernen) (gemeinsames Team-Portal-Gerüst für Gewerke und Rollen)
- [x] Phase 3b Rollenportal (Szenen, Besetzung, Proben, Ausstattung, Notizen)
- [x] Phase 4 Board (2026-09-27: `DepartmentBoardColumn` mit Status-Bedeutung, Position/Priorität/Kommentare, Migration `department_board`; Desktop Drag & Drop, mobil Spalten-Umschalter + Bottom-Sheet; Spalten verwalten Leitung/Vertretung/Regie)
- [x] Phase 5 Termine (CalendarEvent mit departmentId, Zu-/Absagen, Sperrlisten-Hinweis, ICS/Dashboard)
- [x] Phase 6 Dateien/Aufräumen (Dateien über `DepartmentDocument` statt FileLibrary, Gewerke-Einstellungen, Beitritt/Anfrage, Altseiten entfernt)
- [ ] Phase 7 E2E/Release

---

## Fortsetzung (2026-10-01): Blaupausen, Bausteine, Szenenbedarf, Budget

Phase 8–13 setzen auf Phase 1–7 auf. Zusammenhang mit der Produktionsplanung:
`docs/Plan/projektplanung-plan.md` (Meilensteine, neue Produktionsseite, gemeinsames UI-Konzept).

### Ziel (Fortsetzung)

1. **Globale Gewerks-Blaupausen** (`DepartmentTemplate`) bekommen eine eigene Verwaltung.
2. **Rechte pro Blaupause**; ein Gewerk **erbt** sie und speichert nur Abweichungen.
3. **Bausteine pro Blaupause**: Board, Termine, Dateien, Szenenbedarf, Budget, Körpermaße. Das Portal zeigt genau diese Tabs.
4. **Jedes Gewerk hat eine Blaupause.** Gibt es keine passende, wird sie beim Anlegen miterstellt.
5. **Weitere Gewerke** einer Produktion werden aus Blaupausen hinzugefügt; im Onboarding sind Blaupausen auswählbar.
6. **Szenenbedarf**: Alle mit Recht fordern pro Szene an; das Gewerk macht daraus **Objekte**, die als Karten auf dem Board laufen.
7. **Budget pro Gewerk**, an die vorhandenen Finanzen angebunden.

### Befunde (2026-10-01)

| #   | Befund                                                                                                                                               | Stelle                            |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| 12  | `Department.templateId` ist optional; Gewerke ohne Vorlage sind möglich („Gewerk anlegen“ in „Meine Teams“)                                          | `schema.prisma`, `meine-gewerke`  |
| 13  | `DepartmentPermission` hängt am einzelnen Gewerk, nicht an der Vorlage; keine Vererbung                                                              | `schema.prisma`                   |
| 14  | Keine Verwaltungsseite für Vorlagen; Pflege nur über Seed/DB                                                                                         | –                                 |
| 15  | Körpermaße und Breakdown sind fest eingebaut, nicht pro Gewerk zu- oder abschaltbar                                                                  | `koerpermasse`, `roles-scenes.ts` |
| 16  | `SceneBreakdownItem` hängt an genau einer Szene; ein Objekt in mehreren Szenen (Schwert in Szene 3 und 7) wird doppelt geführt. Kein Bezug zum Board | `schema.prisma`                   |
| 17  | `FinanceBudget` kennt nur `showId` + freie `category`, keinen Gewerksbezug                                                                           | `schema.prisma`                   |
| 18  | „Meine Teams“-Kacheln zeigen „Kein Termin · 0 offen“: Platz ohne Aussage; besser Fortschritt + nächste Frist                                         | Screenshot Staging 2026-10-01     |

### Datenmodell (Fortsetzung)

```
DepartmentTemplate      + modules String[]            // board|events|files|requirements|budget|measurements
                        + icon, archivedAt
TemplatePermission      templateId, permissionId, role (lead|deputy|member|guest)   // Standardrechte
DepartmentPermission    + mode (grant|revoke)         // nur Abweichung vom Template
Department              templateId Pflicht (nach Migration), + modulesOverride String[]? (selten)

ProductionObject        showId, departmentId (zuständig), title, description, imageId?, cost?, archivedAt
ObjectScene             objectId, sceneId, note?      // n:m – ein Objekt, mehrere Szenen
SceneRequirement        showId, sceneId, departmentId, text, imageId?, requestedById,
                        status (open|assigned|declined), declineReason?, objectId?, decidedById?, decidedAt?
DepartmentTask          + objectId? (Karte zu einem Objekt), + milestoneId? (projektplanung-plan)
TaskChecklistItem       taskId, text, doneAt?, position
FinanceBudget           + departmentId?               // Gewerksbudget
FinanceEntry            (vorhanden) + objectId?       // Kosten eines Objekts
```

- Wirksame Rechte eines Gewerks = Template-Rechte + `grant` − `revoke`. Änderung an der Blaupause wirkt sofort auf alle Gewerke.
- `SceneBreakdownItem` wird nach `ProductionObject` + `ObjectScene` migriert und danach entfernt (additiv zuerst, Entfernen in eigenem Schritt).

### Szenenbedarf – Ablauf

1. **Anfordern**: In der Szene „+ Bedarf“ → Gewerk wählen (nur Gewerke mit Baustein `requirements`), Text, optional Foto. Recht `PRIVATE.PRODUCTION.REQUIREMENT.CREATE`, standardmäßig alle Produktionsmitglieder.
2. **Eingang**: Die Anforderung erscheint im Board des Gewerks in der festen ersten Spalte **„Eingang“**. Im Sheet: **Neues Objekt · Zu vorhandenem Objekt · Ablehnen (Grund)**.
3. **Objekt = Karte**: Jedes Objekt hat genau eine Karte im zuständigen Gewerk. Fertigungsschritte als Checkliste. Arbeiten mehrere Gewerke daran (Kaschur baut, Requisite verwaltet), bekommt das Objekt eine verknüpfte Zweitkarte im anderen Board.
4. **Status zurück**: Szene zeigt pro Bedarf offen / in Arbeit / fertig / abgelehnt; die anfordernde Person bekommt eine Benachrichtigung.
5. **Frist abgeleitet**: früheste Probe mit einer der Szenen oder Meilenstein (z. B. „Requisiten komplett“) – kein Datum tippen.

Das gilt gleich für Kostüm (pro Rolle/Szene), Ton (Einspieler), Licht (Stimmungen).

### Onboarding über Blaupausen (2026-10-02)

Heute stehen die Gewerke-Wünsche fest in `src/lib/onboarding/role-preferences.ts` (9 `crew_*`-Codes), genutzt von Onboarding-Wizard, Rückkehrer-Wizard, Ranking, Analytics, Profil und Zuweisung. Die Verknüpfung zum Gewerk läuft nur indirekt über `DepartmentTemplate.preferenceCodes`.

- **Schauspiel bleibt fest**: `acting_*` sind Rollengrößen, kein Gewerk, und bleiben in `role-preferences.ts`.
- **Gewerke-Optionen kommen aus der Produktion**: Angeboten werden die Gewerke der Produktion, für die das Onboarding läuft, mit Name/Icon/Farbe/Beschreibung ihrer Blaupause. Nur Blaupausen mit `onboardingVisible` erscheinen.
- **Wunsch-Code pro Blaupause** (umgesetzt statt `templateId` am Wunsch, weil Alt-Codes nicht 1:1 passen: `crew_tech` gehört zu Licht **und** Ton): Gehört ein Alt-Code eindeutig zu genau einer Blaupause, bleibt er (`crew_costume` → Kostüm, Auswertungen über Jahre vergleichbar); sonst `tpl:<slug>` (`tpl:licht`, `tpl:ton`). Wünsche passen zu einem Gewerk über `preferenceCodes` ∪ `tpl:<slug>`.
- **Keine Datenmigration der Wünsche**: Alte Wünsche bleiben gespeichert und werden über `matchCodes` vorbelegt (Rückkehrer, Profil: `crew_tech` füllt Licht und Ton). `crew_*` bleiben als feste Wünsche, solange keine Blaupause der Produktion sie abdeckt (z. B. `crew_direction`).
- **Eine Quelle für alle**: `listCrewWishOptions(showId)` in `src/lib/onboarding/crew-options.ts` für Onboarding-, Regie- und Rückkehrer-Wizard und Profil; Titel für Auswertungen, Zuweisung und Mitgliederverwaltung über `loadTemplateWishTitles()`.
- **Wunsch → Gewerk**: In der Zuweisung führt „Wunsch annehmen“ direkt zur Mitgliedschaft im Gewerk der Produktion mit dieser Blaupause (`source = onboarding-wunsch`). Hat die Produktion das Gewerk nicht, Hinweis „Gewerk fehlt – aus Blaupause anlegen“. Zuordnung über `tpl:`-Codes umgesetzt; Hinweis „Gewerk fehlt“ noch offen (selten, da Optionen aus den Gewerken der Produktion kommen).
- **Blaupausen-Editor**, Abschnitt „Onboarding“: Schalter „im Onboarding anbieten“, kurzer Beschreibungstext (was macht man hier, Zeitaufwand), Liste der zugeordneten Alt-Codes (nur lesend, für die Migration).
- **UI**: vor der Umsetzung Staging-Screenshots des Wizards (mobil + Desktop) ansehen; Darstellung der Optionen folgt dem bestehenden Wizard (Chips/Karten mit Stärke).

Datenmodell-Ergänzung:

```
DepartmentTemplate      + onboardingVisible Boolean @default(true), + onboardingDescription String?
```

### Rechte (Fortsetzung)

- `PRIVATE.DEPARTMENT.TEMPLATE.MANAGE`: Blaupausen verwalten (Board/Regie).
- `PRIVATE.PRODUCTION.REQUIREMENT.CREATE`: Bedarf anfordern.
- Gewerk-Leitung/Vertretung: Eingang entscheiden, Objekte pflegen, Budget sehen. Budget bearbeiten nur mit Finanzrecht.
- Rechte-Seite zeigt pro Gewerk geerbte Rechte grau („von Blaupause“), Abweichungen markiert.

### Oberflächen (Fortsetzung)

Gemeinsame UI-Regeln: `docs/Plan/projektplanung-plan.md`, Abschnitt „UI-Konzept“.

- **Blaupausen-Verwaltung** (Einstellungen): Desktop Liste links / Editor rechts, mobil Liste → Sheet. Editor-Abschnitte: Allgemein (Name, Farbe, Icon) · Bausteine (Schalter) · Rechte (Checkliste je Rolle) · Onboarding-Wünsche.
- **Gewerk anlegen** (in der Produktion): Sheet „Aus Blaupause“ (Liste) oder „Neue Blaupause“ (Name + Bausteine, dann gleich ins Gewerk).
- **Portal-Tabs aus Bausteinen**: `Nächstes · Board · Bedarf · Termine · Budget · Maße · Dateien · Team`; mobil höchstens 4 sichtbar, Rest unter „Mehr“.
- **Board**: Spalte „Eingang“ vorne, nur sichtbar mit Baustein `requirements`. Objektkarte: Titel, Fristabzeichen, Chips `Sz. 3 · 7`, `☑ 2/5`, Meilenstein.
- **Szene** (Stück): Abschnitt „Bedarf“ mit Zeilen je Gewerk und Status-Punkt; „+ Bedarf“ öffnet Sheet.
- **Budget-Tab**: ein Balken Ausgaben/Budget, darunter Liste der Ausgaben und Objekte mit Kosten.
- **„Meine Teams“-Kacheln**: Fortschritt (erledigte Karten), nächste Frist mit Ampel, offene Anforderungen statt „0 offen / Kein Termin“.

### Phasen (Fortsetzung)

8. **Blaupausen-Grundlage**: `modules`, `TemplatePermission`, `DepartmentPermission.mode`, Rechte-Auflösung mit Vererbung (Tests!). **Manuelle Migration**: bestehende Gewerke ohne Vorlage einer Blaupause zuordnen bzw. Blaupause erzeugen; Rechte je Gewerk in Template + Abweichungen zerlegen. Test auf Staging-Dump.
9. **Blaupausen-Verwaltung + Gewerk anlegen**: Seite in den Einstellungen, Anlegen nur noch aus Blaupause. Danach `templateId` Pflicht (eigener Schritt).
   9b. **Onboarding über Blaupausen** (siehe Abschnitt oben): Wunsch-Code je Blaupause, gemeinsame Optionsquelle für alle Wizards/Profil/Zuweisung, Titel in Auswertungen. Editor-Schalter mit Phase 9.
10. **Portal aus Bausteinen**: Tabs dynamisch, Körpermaße als Baustein, „Mehr“-Menü mobil, „Meine Teams“-Kacheln neu.
11. **Szenenbedarf**: Modelle, Anfordern in der Szene, Eingang-Spalte, Objekt-Karten, Checklisten, Benachrichtigungen; Migration `SceneBreakdownItem` → Objekte.
12. **Budget**: `FinanceBudget.departmentId`, Budget-Tab, Objektkosten.
13. **E2E, Screenshots mobil/Desktop, Staging, Release**; danach `SceneBreakdownItem` entfernen.

### Entscheidungen (2026-10-01)

- E6: Rechte hängen an der Blaupause, Gewerke erben und speichern nur Abweichungen.
- E7: Kein Gewerk ohne Blaupause; fehlt eine, wird sie beim Anlegen erstellt.
- E8: Anfordern dürfen alle mit Recht (Standard: alle in der Produktion); das Gewerk entscheidet im Eingang.
- E9: Objekt statt Breakdown-Eintrag: ein Objekt, mehrere Szenen, genau eine Karte im zuständigen Gewerk.
- E10: Budget ist ein Baustein und nutzt die vorhandenen Finanzmodelle.
- E11 (2026-10-02): Schauspiel-Wünsche (`acting_*`) bleiben feste Codes; Gewerks-Wünsche zeigen auf Blaupausen.
- E12 (2026-10-02): Das Onboarding bietet die Gewerke der jeweiligen Produktion an (über ihre Blaupause), nicht alle globalen Blaupausen; Schalter „im Onboarding anbieten“ pro Blaupause.
- E13 (2026-10-02, bei Umsetzung angepasst): Keine Migration der Wünsche; Wunsch-Code je Blaupause (eindeutiger Alt-Code oder `tpl:<slug>`), alte Wünsche gelten über `preferenceCodes` weiter.

### Checkliste (Fortsetzung)

- [x] Phase 8 Blaupausen-Grundlage + Migration (2026-10-02: `modules`, `icon`, `archivedAt`, `TemplatePermission` je Rolle, `DepartmentPermission.mode`; Vererbung in `permission-inheritance.ts` mit Unit- und Integrationstests. Migration abweichend vom Plan: bestehende Gewerk-Rechte bleiben als `grant` statt in Blaupause zerlegt zu werden – Wirkung bleibt exakt gleich; Gewerke ohne Blaupause bekommen eine. `modulesOverride` nicht gebaut)
- [x] Phase 9 Blaupausen-Verwaltung, Gewerk anlegen (2026-10-02: Seite `/mitglieder/blaupausen`, Recht `PRIVATE.DEPARTMENT.TEMPLATE.MANAGE`, Anlegen nur aus Blaupause, `templateId` Pflicht in eigener Migration. Offen: UI für `grant`/`revoke`-Abweichungen einzelner Gewerke, bisher nur per API)
- [x] Phase 9b Onboarding über Blaupausen (2026-10-02: Migration `department_template_onboarding`, Optionen aus Gewerken der Produktion; Schalter/Text im Blaupausen-Editor seit Phase 9)
- [ ] Phase 10 Portal aus Bausteinen
- [ ] Phase 11 Szenenbedarf
- [ ] Phase 12 Budget
- [ ] Phase 13 E2E/Release
