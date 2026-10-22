# Wünsche mit Empfängern – Plan (2026-10-22)

Stand: Schritt 1–6 umgesetzt (2026-10-22); offen Staging-Abnahme, Gerätetest, Release.

## Ausgangslage (Review 2026-10-22)

Drei getrennte Systeme:

| System                                                      | Wer → wen                              | Ziele                                                  |
| ----------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------ |
| Regie-Wünsche (`DirectionWish`)                             | Regieteam → nur Planung                | Freitext + Szenen/Personen/Zeitraum als lose ID-Listen |
| Protokoll-Aufgaben (`EventNote` TASK + `EventNoteAssignee`) | Protokollführung → Person/Figur/Gewerk | immer an einen Termin gebunden                         |
| Gewerk-Karten (`DepartmentTask`)                            | innerhalb des Gewerks                  | Board, Checkliste, Übergabe                            |

Schwächen:

1. Karte eines Gewerks und Protokoll-Zuständigkeit wurden nicht abgeglichen (Regie sah ewig
   „offene Aufgaben“). → Schritt 1, erledigt.
2. Regie kann Wünsche nur an die Planung richten, nicht an Gewerke, Figuren oder Personen.
3. In Wünschen genannte Personen werden nicht benachrichtigt – nur Erwähnung, kein Empfänger.
4. `sceneIds`/`userIds` als `String[]` ohne Fremdschlüssel.
5. Status `open/planned/done/declined` passt nur für die Planung.
6. Altes Modell `Task` ungenutzt (nur in `api/members/[id]/usage` gezählt).
7. Antworten benachrichtigen das ganze Regieteam und die ganze Planung; Wunschtext nicht editierbar.

## Entscheidungen

- **E1** Ein Wunsch hat einen oder mehrere Empfänger: Planung, Gewerk, Figur, Person.
  „Planung“ ist vorausgewählt (heutiges Verhalten bleibt).
- **E2** Je Empfänger eigener Status; der Wunsch ist erledigt, wenn alle Empfänger erledigt
  oder abgelehnt haben.
- **E3** Wunsch an ein Gewerk: annehmen/erledigen darf jedes Mitglied (über die Karte),
  **ablehnen nur die Gewerksleitung** (`DepartmentMembershipRole.lead`), immer mit Grund.
- **E4** Darsteller (Figur/Person) dürfen annehmen, erledigt melden **und ablehnen** (mit Grund).
- **E5** Benachrichtigt werden nur Empfänger, Autor und wer im Verlauf geschrieben hat.

## Schritte

1. **Abgleich Karte ⇔ Protokoll-Aufgabe** (`src/lib/departments/task-sync.ts`): Karte nach
   „erledigt“ (Verschieben, Status-Knopf, Spalten-Status, Spalte löschen) hakt die
   Gewerk-Zuständigkeit ab; Abhaken im Protokoll schiebt die Karte in die erste
   Erledigt- bzw. Zu-tun-Spalte. Gelöschte Karte: Zuständigkeit des Gewerks wird entfernt bzw.
   (wenn allein zuständig) abgehakt (`detachProtocolFromTask`).
2. **Schema**: `DirectionWishTarget` (`wishId`, genau eins von `planning`/`departmentId`/
   `characterId`/`userId`, `status` open/accepted/planned/done/declined, `statusAt`,
   `statusById`, `reason`, `departmentTaskId @unique`). Szenen/Personen-Bezug als
   Verknüpfungstabellen. Migration: bestehende Wünsche → Ziel `planning` mit bisherigem Status.
   `DirectionWish.status` wird abgeleitet (oder als Cache gepflegt). Modell `Task` entfernen.
3. **Gewerk als Ziel**: Karte im Board (erste Spalte, Hinweis „Wunsch der Regie“, Link),
   Abgleich wie Schritt 1 in beide Richtungen; Ablehnen-Knopf nur für Leitung (E3).
4. **Figur/Person als Ziel**: `readMyTasks` um Wünsche erweitern (Dashboard „Meine Aufgaben“),
   Figur über Besetzung auflösen; Annehmen/Erledigt/Ablehnen (E4).
5. **Oberfläche Regie** (Handy zuerst): Feld „An:“ mit Chips (Planung, Gewerke der Produktion,
   Figuren, Personen); Wunschliste zeigt Status je Empfänger; Text nachträglich bearbeitbar.
   Planer-Seite filtert auf Ziel `planning`. Staging-Screenshots mobil + Desktop.
6. **E2E** (`e2e/regie.spec.ts` erweitern): Wunsch an Gewerk → Karte → erledigt → Regie sieht
   Status; Wunsch an Figur → Darsteller lehnt ab → Grund beim Regieteam.

## Umsetzung (2026-10-22)

- Migration `20261022120000_direction_wish_targets`: bestehende Wünsche → Empfänger `planning`
  (Status übernommen), `sceneIds`/`userIds` → `DirectionWishScene`/`DirectionWishPerson`,
  Tabelle `Task` entfernt (in Staging/Prod leer).
- Logik `src/lib/regie/wishes.ts`: `loadWishViewer` + `allowedTargetStatuses` (Rechte je
  Empfänger, Unit-Tests), `setWishTargetStatus`, `syncWishesFromTasks`, `notifyWish` (E5).
- „Gewerksleitung“ = Rolle `lead` oder `deputy` (bzw. Recht SHOW.MANAGE), wie im Board.
- Gewerk-Karte eines Wunsches: „In Arbeit“ ⇒ angenommen, „Erledigt“ ⇒ erledigt, zurück ⇒ offen;
  Löschen nur Leitung (gilt als Ablehnung). Ablehnen über den Wunsch löscht die Karte,
  Wieder-Öffnen legt sie neu an.
- Seiten: Regie `/mitglieder/regie/wuensche` (alle), Planung `/terminplanung/regie-wuensche`
  (nur mit Empfänger Planung), Empfänger `/mitglieder/wuensche` + Dashboard-Karte
  „Wünsche der Regie“.
