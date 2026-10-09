# Plan: Übergabe im Gewerk – Verlauf, Stand, „Seit deinem letzten Besuch“

Stand: 2026-10-09. Phase 1–4 umgesetzt (lokal mit Demo-Daten geprüft), offen Phase 5.

## Ziel

Wer zu einer anderen Zeit ins Gewerk kommt (z. B. Requisite), sieht mit einem Blick, was der „Vormann“
gemacht hat, wo es weitergeht und worauf zu achten ist. Bedienung mit wenigen Tipps, mobil zuerst.
Gilt für alle Gewerke, nicht nur Requisite.

## Ist-Stand

| #   | Befund                                                               | Stelle                               |
| --- | -------------------------------------------------------------------- | ------------------------------------ |
| 1   | Kein Verlauf: Status-/Herkunftsänderungen werden nicht protokolliert | `DepartmentTask`, `ProductionObject` |
| 2   | Checkliste speichert `doneAt`, aber nicht wer                        | `TaskChecklistItem`                  |
| 3   | „Nächster Schritt“/„Achtung“ gehen in Kommentaren unter              | `DepartmentTaskComment`              |
| 4   | Keine Sicht auf Änderungen seit dem letzten Besuch                   | Gewerk-Portal                        |
| 5   | Keine gewerkweiten Hinweise (Werkstatt, Trocknungszeiten, Schlüssel) | –                                    |

## Datenmodell

```
TaskActivity            taskId, objectId?, actorId?, type, data Json, createdAt
                        // type: status | column | checklist_done | checklist_undone | source
                        //       | photo | comment | next_step | caution | claim | created
TaskChecklistItem       + doneById?
DepartmentTask          + nextStep?, nextStepById?, nextStepAt?
                        + caution?, cautionById?, cautionAt?
                        + claimedById?, claimedAt?           // „Ich bin dran“
DepartmentNotice        departmentId, body, pinned, authorId, createdAt,
                        resolvedAt?, resolvedById?            // angepinnte Hinweise
DepartmentHandover      departmentId, authorId, summary Json (automatisch), note?, createdAt
DepartmentVisit         departmentId, userId, lastSeenAt      @@unique([departmentId, userId])
Department              + handoverPush (none | leads | all)   // Default: leads
                        + noticeEditors (all | leads)         // Default: all
                        + cautionEditors (all | leads)        // Default: all
```

Aktivitäten werden in den bestehenden Server-Actions mitgeschrieben (ein Helfer `logTaskActivity`),
nicht per DB-Trigger. Kommentare bleiben in `DepartmentTaskComment` und werden im Verlauf eingemischt.

## Entscheidungen (2026-10-09)

- U1: Push bei Übergabe **stellt das Gewerk ein** (keine / Leitung / alle).
- U2: „Neu“ wird **pro Person seit dem letzten Besuch** berechnet (`DepartmentVisit`).
- U4: Verlauf, Hinweise und Übergaben hängen am Gewerk (pro Produktion) und werden **mit dem Gewerk
  archiviert** (`Department.archivedAt`), kein eigenes Aufräumen.
- U5: „Ich bin dran“ wird nach **12 h automatisch freigegeben** (beim Lesen ausgewertet, kein Cron).
- U3: Hinweise und Achtung setzen/erledigen: **alle im Gewerk**, pro Gewerk auf Leitung einschränkbar.

## Oberflächen

Vor dem Entwurf: Staging-Screenshots von Board, Karte und Gewerk-Portal (mobil + Desktop).

- **Karte**: oben „Nächster Schritt“ und „⚠ Achtung“ als direkt editierbare Felder mit
  „von Anna, Di 18:40“; „Ich bin dran“ (ein Tipp, Name + Zeit, erneut tippen gibt frei).
  Reiter/Abschnitt „Verlauf“ als Zeitleiste.
- **Board-Kachel**: gelbes ⚠ bei Achtung, Avatar bei „Ich bin dran“, Punkt „neu“ bei Änderungen
  seit dem letzten Besuch.
- **Gewerk-Startseite**:
  1. Angepinnte Hinweise (erledigen mit einem Tipp).
  2. Letzte Übergabe(n) seit dem Besuch.
  3. „Seit deinem letzten Besuch“: Änderungen gruppiert nach Karte, mit Nächstem Schritt und Achtung.
     Der Besuch wird beim Verlassen bzw. nach Ansicht aktualisiert, nicht schon beim Laden.
- **„Feierabend / Übergabe“**: Bottom-Sheet, vorausgefüllt mit eigenen Aktivitäten seit Sitzungsbeginn
  (heute), optional ein Satz, „Speichern“. Push gemäß Gewerk-Einstellung.
- **Gewerk-Einstellungen**: Push bei Übergabe, wer Hinweise/Achtung pflegen darf.

## Phasen

1. **Verlauf**: `TaskActivity`, `doneById`, Mitschreiben in allen Karten-/Objekt-Actions, Zeitleiste in der Karte.
2. **Stand auf der Karte**: Nächster Schritt, Achtung, „Ich bin dran“, Anzeige in der Kachel.
3. **Gewerk-Startseite**: `DepartmentVisit`, „Seit deinem letzten Besuch“, `DepartmentNotice`, Einstellungen.
4. **Übergabe**: `DepartmentHandover`, Sheet, Push nach Einstellung, Benachrichtigung in der Glocke.
5. **E2E, Screenshots mobil/Desktop, Staging, Release.**

## Checkliste

- [x] Phase 1 Verlauf (`TaskActivity`, `doneById`; mitgeschrieben bei Anlegen, Spalte, Status, Checkliste, Kommentar, Foto, Herkunft, Notizen, „dran“)
- [x] Phase 2 Stand auf der Karte (auch auf der Objektseite; leere Notizen als „+“-Chip, Antippen = ändern)
- [x] Phase 3 Gewerk-Startseite (Besuch = 30 min Pause; erster Besuch zeigt die letzte Woche; Einstellungen für Leitung/Vertretung; ein Schalter `noteEditors` für Hinweise und Achtung)
- [x] Phase 4 Übergabe (Zusammenfassung seit Tagesbeginn bzw. letzter eigener Übergabe; gibt eigene „dran“-Karten frei; Benachrichtigungstyp `department-handover`)
- [ ] Phase 5 E2E/Release
