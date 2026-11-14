# Gruppen im Skript – Plan (2026-11-14)

Anlass: Im Skript steht „Alle“, gemeint ist aber oft nur ein Teil des Ensembles. Die Technik dafür
gibt es seit v1.21.0 (`ScriptGroupRule`, siehe `skript-uebernahme-plan.md`, Abschnitt Gruppenrollen).
Sie wurde aber nicht gefunden.

## Ist-Stand

| Was                                                                              | Wo                                                      | Problem                                                                                                            |
| -------------------------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Gruppenrolle („Alle“, „Demonstranten“ …) mit Grundregel `cast`/`present`/`fixed` | Stück → Skript → Rollen → Gruppen → „Gruppe bearbeiten“ | Liste steht unter allen Personen (in „80 Tage“ unter 33 Personen); wer im Leser „Alle“ sieht, kommt dort nicht hin |
| Ausnahmen je Szene und Absatz                                                    | im selben Dialog, Szenen aufklappen                     | Absätze nur als Textanfang, ohne Zusammenhang im Skript                                                            |
| Auflösung im Leser/Lernmodus                                                     | `ReaderBlock.memberRoleIds`                             | wird im Leser nicht angezeigt – man sieht nicht, wer gemeint ist                                                   |
| Wiederverwendbare Personengruppen                                                | –                                                       | fehlt: jede Gruppe und jede Ausnahme wird Rolle für Rolle angeklickt                                               |

Screenshot Desktop (Staging, 2026-11-14): Gruppen-Abschnitt erst ganz unten auf der Seite.

## Ziel

1. Im Skript sehen und ändern, wer bei einer Gruppenpassage gemeint ist.
2. Benannte Gruppen („Jugendliche“, „Händler“, „Passagiere“) einmal anlegen und überall auswählen.
3. Gruppen auf der Rollen-Seite sofort finden.

## Datenmodell

Neue Tabelle für benannte Gruppen je Produktion (Stück), unabhängig vom Skript-Text:

```prisma
model ScriptRoleSet {
  id        String   @id @default(cuid())
  showId    String
  name      String           // „Jugendliche“
  color     String?
  order     Int      @default(0)
  members   ScriptRoleSetMember[]   // Skript-Personenrollen
  @@unique([showId, name])
}
```

`ScriptGroupRule` bekommt alternativ zu `memberRoleId` ein `memberSetId` (genau eins von beiden
gesetzt). Eine Ausnahme „hier nur Jugendliche“ bleibt damit eine Regel und folgt späteren
Änderungen an der Gruppe. Auflösung (Absatz vor Szene vor Grundregel) bleibt unverändert, Sets
werden beim Auflösen zu ihren Rollen expandiert. Keine Datenmigration nötig.

Eine Skript-Gruppenrolle kann zusätzlich als Grundregel ein Set haben (`fixed` + Set-Regel) –
z. B. „Der Chor der Händler“ = Set „Händler“.

Offen (E1): Sets auf Skript-Rollen oder auf Stück-Rollen (`Character`)? Vorschlag Skript-Rollen,
weil die Auflösung dort schon passiert; Stück-Rollen kommen über `ScriptRoleLink` mit.

## Phasen

1. **Gruppen oben auf der Rollen-Seite**: Abschnitt „Gruppen“ vor „Personen“, mit Kurzinfo
   „spricht: 12 Rollen, 3 Ausnahmen“. Neuer Abschnitt „Personengruppen“ (Sets) mit Anlegen,
   Umbenennen, Mitglieder wählen (Mehrfachauswahl mit Suche, mobil Bottom-Sheet).
2. **Sets in Regeln**: Im Dialog „Gruppe bearbeiten“ oben Sets als Chips, darunter einzelne
   Rollen. Server-Action + Auflösung + Unit-Tests (`role-links.test.ts`).
3. **Leser – Anzeigen**: Bei Gruppenpassagen kleine Zeile unter dem Sprecher
   „Alle · Fogg, Aouda, Passepartout +4“, antippbar → Liste. Gilt auch im PDF als Option.
   Eigene Rolle betroffen → wie bisher hervorgehoben.
4. **Leser – Bearbeiten** (nur `SCRIPT.MANAGE`): Antippen öffnet Bottom-Sheet
   „Wer spricht hier?“ mit Umfang _nur dieser Absatz_ / _ganze Szene_ / _überall (Grundregel)_,
   Sets + Rollen ankreuzen, Speichern = `saveScriptGroupRulesAction`. Hinweis bei bestehender
   Ausnahme und „Zurücksetzen“.
5. **Hinweis auf offene Gruppen**: In Rollen-Übersicht und Leser-Menü ein Zähler „3 Gruppenpassagen
   noch auf Standard“, damit die Regie sie gezielt durchgeht (Sprung von Passage zu Passage).
6. **E2E + Screenshots** mobil/desktop, Lernmodus prüft, dass Gruppenpassagen nur bei Mitgliedern
   erscheinen.

## Entscheidungen (2026-11-14)

- E1: Personengruppen an Skript-Rollen.
- E2: Ändern im Leser nur mit `SCRIPT.MANAGE`.
- E3: „spricht mit …“ sehen alle.
- Neu: Hauptproblem ist, dass „Alle“-Passagen im Leser/Lernmodus Leuten angezeigt werden, die
  nicht gemeint sind. Neue Gruppen starten deshalb mit „wer in der Szene ist“ statt „alle
  Besetzten“ (ersetzt E-U1 aus `skript-uebernahme-plan.md`). Bestehende Gruppen bleiben, wie sie
  sind – „Alle Besetzten“ bei Bedarf von Hand umstellen.
- Umsetzung abweichend vom Entwurf oben: eigene Tabelle `ScriptGroupSetRule` statt `memberSetId`
  an `ScriptGroupRule` – Zusammenführen/Rückgängig bleiben unverändert, Personengruppen werden beim
  Laden zu Einzelregeln (`expandSetRules`).

## Stand

- [x] Phase 1–4 auf main (Personengruppen, Gruppen oben, „spricht mit …“, „Wer spricht hier?“)
- [ ] Phase 5 Zähler „noch auf Standard“
- [ ] Phase 6 E2E

## Entscheidungen offen (erledigt, siehe oben)

- E1: Sets an Skript-Rollen (Vorschlag) oder Stück-Rollen.
- E2: Dürfen auch Gewerksleitung/Regieassistenz Gruppen im Leser ändern, oder nur `SCRIPT.MANAGE`?
- E3: Anzeige „wer spricht“ im Leser für alle Mitglieder oder nur für Planende? (Vorschlag: alle.)
