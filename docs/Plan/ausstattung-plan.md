# Plan: Ausstattung – Requisiten, Kostüm, Bühnenbild

Stand: 2026-10-09. Konzept, nichts umgesetzt. Ersetzt Phase 11 aus `docs/Plan/gewerke-plan.md`
(Szenenbedarf) und nimmt die Objektkosten aus Phase 12 mit.

## Ziel

1. Ausstattung wird **einmal** als Objekt geführt und hängt an beliebig vielen Szenen (und Rollen).
2. **Planung und Regie** fordern in der Szene an, ausführlich (Text, Fotos); das Gewerk entscheidet.
3. Jedes Objekt ist eine **Karte im Board** des zuständigen Gewerks, mit Checkliste und abgeleiteter Frist.
4. **Eigene Verwaltungsseiten** für Requisiten, Kostüm und Bühnenbild, je als Baustein der Blaupause.
5. **Kostüme sind zusammenstellbar**: Kostüm = Zusammenstellung aus Teilen; Teile sind wiederverwendbar.
6. Herkunft **Fundus** ist mit dem Lager verbunden (Reservierung über das Lager-Projekt der Produktion).

## Ist-Stand (Befunde)

| #   | Befund                                                                                                   | Stelle                                   |
| --- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| 1   | Ausstattung = `SceneBreakdownItem`: ein Titel (einzeilig, 160 Zeichen), eine Szene, ein Gewerk, Status   | `schema.prisma`, `stueck/panels.tsx:615` |
| 2   | `description` existiert in der DB, hat aber kein Eingabefeld; `note` (300) ebenfalls nicht               | `actions/roles-scenes.ts:402`            |
| 3   | Ein Objekt in mehreren Szenen wird mehrfach geführt; Kostüm über zehn Szenen = zehn Einträge             | Befund 16 in `gewerke-plan.md`           |
| 4   | Status ändert jeder mit Stück-Zugriff in der Szene; das Gewerk bekommt weder Karte noch Benachrichtigung | `stueck/panels.tsx`                      |
| 5   | Gewerke sehen Ausstattung nur lesend auf der Rollenseite                                                 | `meine-gewerke/rolle/[id]`               |
| 6   | Keine Verbindung zu Lager, Fotos, Kosten, Board                                                          | –                                        |
| 7   | Blaupausen `buehnenbild` und `requisite` getrennt, in der Praxis ein Team (Bühnenbild/Requisitenbau)     | `prisma/seed`                            |

## Zielbild

### Grundsätze

- **Ein Objekt, eine Karte.** Keine verknüpften Zweitkarten: Bau und Verwaltung macht dasselbe Team
  (Bühnenbild/Requisitenbau). Die Art (Requisite/Bühnenbild) ist eine Eigenschaft des Objekts, nicht des Gewerks.
- **Zuständiges Gewerk** wird aus der Art vorgeschlagen (Blaupause mit passendem Baustein), ist aber änderbar.
  Hat eine Produktion nur ein Team für Bühne + Requisite, bekommt es beide Bausteine.
- **Status nur durch das Gewerk.** Die Szene zeigt ihn an.

### Datenmodell

```
enum ObjectKind          prop | set_piece | costume | costume_part     // später sound, light
enum ObjectSource        undecided | stock | build | buy | borrow
enum ObjectStatus        idea | in_progress | ready | in_use | returned

ProductionObject         showId, departmentId (zuständig), kind, title,
                         description (Markdown, bis 5000), source, status,
                         dimensions?, material?, costCents?, note?,
                         inventoryProductId? / inventoryAssetId?   // bei source=stock
                         archivedAt?, createdById
ProductionObjectPhoto    objectId, fileId, caption?, kind (reference|actual), position
ObjectScene              objectId, sceneId, note?, position?        // „Hand links“, „bleibt stehen“
ObjectCharacter          objectId, characterId                      // Requisite einer Rolle, Kostüm einer Rolle

CostumeComposition       costumeId → costume_part[]                 // Kostüm = Objekt kind=costume
  (CostumePart)          costumeObjectId, partObjectId, position    // ein Teil in mehreren Kostümen möglich
CostumeAssignment        costumeId, characterId, castId?, sceneFrom/sceneIds
                         // Doppelbesetzung: gleiche Rolle, je Besetzung eigenes Kostüm möglich

SceneRequirement         showId, sceneId, departmentId?, kind?, characterId?,
                         text (bis 2000), requestedById, status (open|assigned|declined),
                         declineReason?, objectId?, decidedById?, decidedAt?
SceneRequirementPhoto    requirementId, fileId

DepartmentTask           + objectId? @unique                        // genau eine Karte je Objekt
TaskChecklistItem        taskId, text, doneAt?, position
FinanceEntry             + objectId?                                // Ausgaben eines Objekts
```

- Kosten: `costCents` ist die Schätzung; tatsächliche Ausgaben kommen aus `FinanceEntry.objectId`.
- Fundus: `source = stock` verknüpft Lager-Typ oder -Exemplar und legt eine Zeile im
  `InventoryProject` der Produktion an (gibt es keins, wird es angelegt). Verfügbarkeit/Konflikte
  zeigt das Lager wie bisher.
- `SceneBreakdownItem` wird migriert (je Eintrag ein Objekt; gleiche Titel im selben Gewerk
  werden **nicht** automatisch zusammengelegt, sondern in einer Zusammenführen-Ansicht vorgeschlagen)
  und in einem eigenen Schritt entfernt.

### Rechte

- `PRIVATE.PRODUCTION.REQUIREMENT.CREATE`: Bedarf anfordern. Standard: **Regie und Produktionsplanung**
  (Inhaber von `PRIVATE.PRODUCTION.PLAN`). Weitere Personen lassen sich pro Produktion freischalten.
  (Weicht ab von E8 in `gewerke-plan.md`: dort „alle in der Produktion“.)
- Gewerk-Leitung/Vertretung/Mitglieder: Eingang entscheiden, Objekte pflegen.
- Lesen: alle mit Zugriff aufs Stück (Szene, Rollenseite). Schauspielende sehen auf ihrer Rollenseite
  ihre Requisiten und Kostüme (ohne Kosten).
- Kosten sehen: Gewerk-Leitung/Vertretung und Finanzrecht.

### Ablauf Anfordern

1. Szene → „+ Bedarf“ (Sheet): Art (Requisite/Kostüm/Bühnenbild/Sonstiges) → schlägt Gewerk vor,
   optional Rolle, **mehrzeiliger Text**, Fotos/Skizze.
2. Eingang: feste erste Board-Spalte „Eingang“. Optionen: **Neues Objekt · Vorhandenem Objekt
   zuordnen** (Suche, häufig: „Schwert ist schon in Szene 3“) **· Ablehnen (Grund)** · Rückfrage (Kommentar).
3. Objekt → Karte im Board; Frist = früheste Probe einer verknüpften Szene, sonst Meilenstein
   („Requisiten komplett“), überschreibbar.
4. Rückmeldung: anfordernde Person bekommt Benachrichtigung bei Entscheidung und bei „fertig“.

Das Gewerk kann Objekte auch **direkt** anlegen (eigene Ideen), ohne Anforderung.

### Oberflächen (mobil zuerst)

Vor dem Entwurf: Staging-Screenshots von Stück-Seite, Gewerk-Portal, Board, Lager (mobil + Desktop).

- **Szene**: Abschnitt „Ausstattung“ gruppiert nach Art, je Zeile Titel, Status-Punkt, Rolle;
  offene Anforderungen darüber. Antippen → Objekt-Sheet (lesend, für das Gewerk bearbeitbar).
- **Objekt-Sheet/-Seite**: Fotos (Referenz/Ist), Beschreibung, Szenen-Chips, Rollen, Herkunft
  (bei Fundus: Lager-Exemplar mit Code, Lagerort), Checkliste, Kosten, Verlauf.
- **Requisiten** (Baustein `props`):
  - Liste mit Filter Szene/Status/Herkunft/Rolle.
  - **Ablaufliste**: pro Szene, was wo liegt (Position aus `ObjectScene.note`), druckbar.
  - **Vorstellungs-Check**: Abhaken auf dem Handy vor der Vorstellung, zurücksetzbar.
- **Kostüm** (Baustein `costumes`):
  - **Kostümplot**: Matrix Rolle × Szene, Zelle = Kostüm (Farbe/Kürzel); Doppelbesetzung als Unterzeile.
    Mobil: pro Rolle eine Liste der Szenen mit Kostüm.
  - **Umzugswarnungen**: Kostümwechsel zwischen direkt aufeinanderfolgenden Szenen derselben Person.
  - **Teile**: Liste aller Teile, „in Kostüm A, C“; Kostüm zusammenstellen per Teile-Picker
    (auch direkt aus dem Lager). Maße der Besetzung neben dem Kostüm (Baustein `measurements`).
- **Bühnenbild** (Baustein `set`):
  - **Bilder**: Aufbauten je Szene, Elemente mit Fotos.
  - **Umbauliste**: zwischen zwei Szenen: raus / rein / bleibt, verantwortliche Person.
  - Bau-Fortschritt über Checklisten der Karten.
- **Rollenseite** (`meine-gewerke/rolle/[id]`): Reiter „Ausstattung“ zeigt Kostüme (mit Teilen) und
  Requisiten der Rolle aus den neuen Objekten.

## Phasen

1. **Grundmodell**: `ProductionObject`, Fotos, `ObjectScene`, `ObjectCharacter`, Task-Verknüpfung,
   Checkliste; Bausteine `props`/`costumes`/`set` in Blaupausen. Migration `SceneBreakdownItem` →
   Objekte (additiv, Staging-Dump testen). Szene zeigt neue Objekte.
2. **Anfordern + Eingang**: `SceneRequirement`, Recht, Sheet in der Szene, Spalte „Eingang“,
   Entscheiden, Benachrichtigungen, Frist-Ableitung.
3. **Requisiten-Seite**: Liste, Objekt-Seite, Ablaufliste, Vorstellungs-Check, Zusammenführen-Ansicht
   für migrierte Doppel.
4. **Kostüm**: Teile/Zusammenstellung, Zuordnung zu Rolle/Besetzung, Kostümplot, Umzugswarnungen,
   Rollenseite.
5. **Bühnenbild**: Bilder je Szene, Umbauliste.
6. **Lager + Kosten**: Herkunft Fundus mit Reservierung im Lager-Projekt, `FinanceEntry.objectId`,
   Kosten im Objekt und Summe je Gewerk (Rest des Budget-Bausteins bleibt Phase 12 im Gewerke-Plan).
7. **E2E, Screenshots mobil/Desktop, Staging, Release**; danach `SceneBreakdownItem` entfernen.

## Entscheidungen (2026-10-09)

- A1: Kostüme sind **zusammenstellbar** aus Teilen; ein Teil kann in mehreren Kostümen vorkommen.
- A2: Keine eigene Kaschur. Bühnenbild/Requisitenbau baut und verwaltet → **eine Karte je Objekt**,
  keine Zweitkarten (ändert Schritt 3 im Ablauf von `gewerke-plan.md`).
- A3: Anfordern standardmäßig nur **Regie und Planung**, weitere per Freischaltung (ändert E8).
- A4: Status ändert nur das zuständige Gewerk.

## Offene Fragen

- Blaupausen `buehnenbild` und `requisite` zusammenlegen, oder getrennt lassen und bei Bedarf
  ein Team mit beiden Bausteinen? (Vorschlag: getrennt lassen, Bausteine frei kombinierbar.)
- Gehört Maske/Frisur in den Kostümplot (eigene Art `makeup`)?
- Brauchen Teile aus dem Fundus eine Rückgabe-Prüfung nach der Spielzeit (Status `returned`)?

## Checkliste

- [ ] Phase 1 Grundmodell + Migration
- [ ] Phase 2 Anfordern + Eingang
- [ ] Phase 3 Requisiten
- [ ] Phase 4 Kostüm
- [ ] Phase 5 Bühnenbild
- [ ] Phase 6 Lager + Kosten
- [ ] Phase 7 E2E/Release, `SceneBreakdownItem` entfernen
