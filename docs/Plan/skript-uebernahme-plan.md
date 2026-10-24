# Plan: Skript ↔ Stück – Rollen und Szenen übernehmen, zuordnen, zusammenführen

Stand: 2026-10-24 – Phase 1–4 umgesetzt (siehe Checkliste). Konkretisiert Phase 11 aus `skript-plan.md` („Übernahme-Assistent“) und den
offenen Punkt „Sammelrollen einer Gruppe zuordnen“ aus `szenenspiegel-plan.md`.

## Ziel

1. Rollen und Szenen aus einer freigegebenen Fassung lassen sich ins Stück übernehmen
   (`Character`, `Scene`, `SceneCharacter`) – mit Vorschau, ohne dass das Stück vom Skript abhängt.
2. Zuordnungen bleiben **jederzeit änderbar**: Skript-Rolle einer anderen Stück-Rolle zuordnen,
   Rollen zusammenführen oder trennen, Szenen neu zuordnen.
3. Eine **neue Fassung** zerstört nichts: Bekanntes wird still wiedererkannt, nur Neues und
   Geändertes wird gefragt.
4. **Gruppenrollen** („Alle“, „Chor“, „Beide“, „Demonstranten“) werden als Gruppe verstanden –
   wer dazugehört, ist einstellbar und darf je Szene abweichen.

## Ist-Stand (Befunde)

| #   | Befund                                                                                                                                                                                                                          | Stelle                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| B1  | `ScriptRole` gehört zum **Stück**, nicht zur Fassung, und hat `aliases` – Rollen-Identität über Fassungen ist also schon da.                                                                                                    | `schema.prisma` `ScriptRole`   |
| B2  | `ScriptScene` gehört zur **Fassung** und hat keine stabile ID. Nur der Titel verbindet Fassungen (z. B. `measuredSeconds`). Bei 80 Tagen wurden Szenen neu nummeriert (20.A/B → 17/18) – Titelvergleich reicht dann nicht.      | `ScriptScene`                  |
| B3  | Skript ↔ Besetzung läuft heute **nur über Namensgleichheit** (`Character.name/shortName` gegen `ScriptRole.name/aliases`). Heißt die Stück-Rolle „Phileas Fogg“ und das Skript „FOGG“, findet der Leser die eigene Rolle nicht. | `src/lib/skript/reader.ts:190` |
| B4  | `ScriptSyncLink` steht im Plan, ist aber **nicht angelegt**.                                                                                                                                                                    | `skript-plan.md`               |
| B5  | Gruppen werden nur per Regex am Namen erkannt (`alle                                                                                                                                                                            | beide                          | chor | …`). Wirkung: Spiegel/Besetzung zählen sie nicht als Person. Lernmodus und „Meine Rolle“ wissen nicht, wer bei „Alle“ mitspricht. | `src/lib/skript/casting.ts:22` |
| B6  | Gemeinsame Repliken „Atreju/Bastian“ werden in mehrere Rollen zerlegt (`ScriptBlockRole`). „Fogg und der Kapitän“ erzeugt aber eine Scheinrolle „der Kapitän“.                                                                  | `roles.ts` `splitSpeakerRoles` |
| B7  | Zusammenführen geht nur im Prüfschritt vor der Freigabe. Danach gibt es kein Zusammenführen/Trennen; verwaiste Rollen wurden auf Staging per SQL gelöscht.                                                                      | `review.ts`                    |
| B8  | `Character` hängt an vielem: Besetzung, Auftritte, Requisiten (`ObjectCharacter`), Anforderungen, Regie-Wünsche, Aufgaben. Zusammenführen im Stück muss all das umhängen.                                                       | `Character`-Relationen         |
| B9  | `SceneCharacter` weiß nicht, ob ein Auftritt von Hand oder aus dem Skript kommt – ohne das kann eine neue Fassung Auftritte nie sauber entfernen.                                                                               | `SceneCharacter`               |

## Zielbild

### Grundidee: drei Ebenen, zwei Zuordnungstabellen

```
Sprechername im PDF ──(Alias, Prüfschritt)──▶ ScriptRole ──(ScriptRoleLink)──▶ Character
Szene einer Fassung ──(sceneKey, Vererbung)──▶ ScriptSceneKey ──(ScriptSceneLink)──▶ Scene
```

- **Alias** (gibt es schon): „KAPITÄN“, „Kapitän“, „Kaptän“ → eine Skript-Rolle.
- **Link** (neu): Skript-Rolle → Stück-Rolle. Ersetzt die Namensgleichheit aus B3. Namen dienen nur
  noch als Vorschlag.
- Jede Ebene ist für sich änderbar. Eine neue Fassung durchläuft nur die erste Ebene; die zweite
  bleibt stehen.

### Datenmodell (Entwurf)

```prisma
enum ScriptRoleKind { person group ignore }      // ignore = „Stimme aus dem Off“, „Band“, Fehlerkennung

model ScriptRole {                                 // erweitert
  …
  kind          ScriptRoleKind @default(person)    // Vorbelegung über isEnsembleRole(), änderbar
  groupMode     ScriptGroupMode?                   // nur bei group, siehe unten
  mergedIntoId  String?                            // zusammengeführt → zeigt auf die bleibende Rolle
  links         ScriptRoleLink[]
  groupMembers  ScriptGroupMember[]
}

model ScriptRoleLink {                             // Skript-Rolle → Stück-Rolle(n)
  scriptRoleId, characterId, createdById, createdAt
  @@id([scriptRoleId, characterId])
}

enum ScriptGroupMode {
  cast        // alle Besetzten der Produktion (Standard für „Alle“, E-U1)
  present     // alle, die in der Szene auftreten
  fixed       // feste Liste von Rollen (Standard für „Chor“, „Demonstranten“)
  character   // die Gruppe ist selbst eine Stück-Rolle mit mehreren Besetzten („Ensemble“)
}

model ScriptGroupMember {                          // wer gehört dazu – global oder je Szene/Absatz
  id, groupRoleId,
  memberRoleId                                     // ScriptRole (person)
  sceneKey      String?                            // null = gilt überall
  lineageId     String?                            // einzelner Absatz („Alle“ hier nur Frauen)
  mode          include | exclude
}

model ScriptSceneKey {                             // stabile Szene über Fassungen
  id, showId, label                                // letzter Titel, nur Anzeige
}
// ScriptScene bekommt sceneKeyId; neue Fassung erbt ihn von der Szene der Vorfassung,
// in der die Mehrheit ihrer Absätze (lineageId) stand – Titel nur als Rückfall.

model ScriptSceneLink { sceneKeyId, sceneId, … }  // ScriptSceneKey → Scene (meist 1:1, auch n:1)

model SceneCharacter {                             // erweitert
  …
  source  manual | script @default(manual)         // B9
}
```

`ScriptSyncLink` aus dem Ursprungsplan entfällt zugunsten der beiden Link-Tabellen.

### Gruppenrollen

Auflösung für einen Absatz einer Gruppenrolle – erste Regel, die greift:

1. Ausnahme am **Absatz** (`lineageId`): „hier sprechen nur Aouda und Passepartout“.
2. Ausnahme in der **Szene** (`sceneKey`): „Alle“ in Szene 5 = Passagiere ohne Fix.
3. **Grundregel der Gruppe**:
   - `cast` (Standard für „Alle“) – alle Personen-Rollen mit Besetzung in der Produktion.
     „Nicht wirklich alle“ wird über die Ausnahmen 1 und 2 gelöst (z. B. „ohne Fogg“).
   - `present` – alle Personen-Rollen, die in dieser Szene sprechen oder in Regie genannt sind
     (wie der Spiegel es heute schon ermittelt), plus explizit hinzugefügte.
   - `fixed` – die gespeicherte Liste.
   - `character` – wer die verknüpfte Stück-Rolle besetzt (z. B. 8 Leute „Ensemble“).

Wirkung:

- **Leser / „Meine Rolle“ / Lernmodus**: Ich gehöre zu „Alle“ in einem Absatz, wenn eine meiner
  Rollen nach der Auflösung Mitglied ist → Absatz wird hervorgehoben, im Lernmodus abgefragt
  (Kennzeichnung „gemeinsam“). Einstellung „Gruppenpassagen lernen“, Standard an (E-U2).
- **Spiegel / Besetzung**: Gruppen zählen weiter nicht als Person; bei `fixed` und `character`
  zählen ihre Mitglieder als anwesend.
- **Übernahme ins Stück**: Gruppe wird wahlweise (a) nicht übernommen, (b) als eigene Stück-Rolle
  („Ensemble“) übernommen, oder (c) als Auftritte ihrer aufgelösten Mitglieder.
- **Mitlesen**: Folgen von „Alle“ bedeutet: den aufgelösten Mitgliedern.
- Erfasst wird das im Prüfschritt nur grob (Art „Gruppe“ + Grundregel); die Feinheiten im
  Reiter „Rollen“ (unten) – nicht beim Import, damit der Import schnell bleibt.

### Rollen nachträglich bearbeiten (Reiter „Rollen“ im Skript-Bereich)

Für `SCRIPT.MANAGE`, gilt für alle Fassungen des Stücks (ändert nur Zuordnung, nie Text – E5 bleibt):

- **Zusammenführen**: „Kapitän“ + „der Kapitän“ → eine Rolle. `ScriptBlockRole`, Aliase,
  Lernkarten, Links und Gruppenmitgliedschaften wandern; die alte Rolle bleibt als `mergedIntoId`
  stehen, damit eine spätere Fassung den alten Namen sofort wiedererkennt. **Rückgängig** möglich,
  solange nichts darauf aufgebaut wurde (Protokoll mit Urheber + Zeit, E8).
- **Trennen**: Eine Skript-Rolle steht für zwei Figuren („Polizist“ in Szene 3 ≠ Szene 12).
  Auswahl nach Szenen oder Absätzen → neue Rolle; künftige Fassungen fragen bei diesem Namen nach
  („Polizist in Szene 14 – welcher?“), Vorschlag aus der Szene.
- **Umbenennen**, **Art ändern** (Person/Gruppe/ignorieren), **Gruppe pflegen** (siehe oben).
- **Scheinrollen** aus gemeinsamen Repliken („der Kapitän“ aus „Fogg und der Kapitän“) über
  „Zusammenführen“ oder Fix in `fixes.ts`; im Prüfschritt als Verdacht anzeigen, wenn eine Rolle
  nur in Sammel-Sprechern vorkommt.
- **Verknüpfen**: je Rolle „gehört im Stück zu …“ (eine oder mehrere Stück-Rollen, oder keine).

### Rollen im Stück zusammenführen

Eigene Funktion in der Stück-Verwaltung (nicht nur fürs Skript nützlich): Rolle A in Rolle B
überführen hängt Besetzung, Auftritte (Duplikate zusammenfassen), Requisiten, Anforderungen,
Wünsche, Aufgaben und Skript-Links um; vorher Übersicht „was wird umgehängt“. Löschen der leeren
Rolle A ist ein bewusster zweiter Schritt.

### Übernahme-Assistent „Ins Stück übernehmen“

Aus einer freigegebenen Fassung, drei Schritte, jeder mit Vorschau „neu / geändert / bleibt“:

1. **Szenen**: Skript-Szene ↔ Stück-Szene (Vorschlag über `ScriptSceneLink`, sonst Titel/Nummer),
   neu anlegen, ignorieren. Übernehmbar: Titel, Reihenfolge, Akt/Teil, Dauer (gemessen > geschätzt).
   Felder, die im Stück von Hand geändert wurden, werden nicht überschrieben, sondern nur angeboten.
2. **Rollen**: Skript-Rolle ↔ Stück-Rolle (Link, sonst Name/Alias/Ähnlichkeit), neu anlegen,
   ignorieren, Gruppe nach Regel oben. Mehrere Skript-Rollen auf eine Stück-Rolle ist erlaubt
   (Doppelbesetzung aus dem Spiegel: Bündel → eine Person, nicht eine Rolle).
3. **Auftritte**: aus Repliken + Regie-Nennungen. Neu → `source = script`. Ein Auftritt
   `source = script`, den die neue Fassung nicht mehr hat, wird **zum Entfernen vorgeschlagen**
   (abgewählt vorbelegt); `manual` wird nie angefasst. Stumme Auftritte bleiben so erhalten.

Bei jeder neuen Fassung bietet der Skript-Reiter „Änderungen fürs Stück: 2 neue Szenen, 1 neue
Rolle, 6 Auftritte“ an – nie automatisch.

### Neue Fassung – was passiert

| Fall                                        | Verhalten                                                                              |
| ------------------------------------------- | -------------------------------------------------------------------------------------- |
| Name bekannt (Name, Alias, zusammengeführt) | still zugeordnet, Link bleibt                                                          |
| Name ähnlich (Tippfehler)                   | Prüfschritt: „Gleiche Rolle wie …“ (gibt es schon)                                     |
| Name ist eine getrennte Rolle               | Prüfschritt fragt je Szene, Vorschlag aus voriger Fassung                              |
| Name neu                                    | neue Skript-Rolle, Art per Regex vorbelegt, Hinweis „noch nicht im Stück“              |
| Rolle kommt nicht mehr vor                  | bleibt bestehen (ältere Fassungen, Lernkarten), Anzeige „in dieser Fassung nicht mehr“ |
| Autor führt Rollen zusammen (A + B → C)     | siehe „Autor ändert Rollen“: Vorschlag „C ersetzt A und B“                             |
| Autor teilt eine Rolle (A → A1 + A2)        | Vorschlag „A1 und A2 kommen aus A“                                                     |
| Szene umnummeriert/umbenannt                | `sceneKey` über Absatz-Mehrheit vererbt → Link bleibt                                  |
| Szene geteilt/zusammengelegt                | Mehrheit gewinnt, die andere Hälfte gilt als neu → Assistent fragt                     |
| Gruppen-Ausnahme an gestrichenem Absatz     | Liste „Ausnahmen ohne Platz“ (wie bei Notizen)                                         |

### Autor ändert Rollen in einer neuen Fassung

Typisch: aus „Polizist 1“ und „Polizist 2“ wird „Polizist“, aus „Diener“ wird „Passepartout“,
oder eine Rolle wird aufgeteilt. Erkennung über die `lineageId`s: Die Absätze der neuen Rolle C
stammen (überwiegend) von den Absätzen der alten Rollen A und B, und A/B kommen in der neuen
Fassung nicht mehr vor. Der Prüfschritt zeigt das als eigene Karte:

- **„C ersetzt A und B“** (Zusammenlegung) – Optionen:
  - _Zusammenführen_: A und B gehen in C auf (`mergedIntoId`), Links, Lernkarten und Gruppen
    wandern mit. Im Stück wird angeboten, die Stück-Rollen ebenfalls zusammenzuführen
    (Funktion „Rollen im Stück zusammenführen“); die Besetzung beider bleibt dabei erhalten
    – C hat dann zwei Besetzte, die man im Stück aufräumen kann.
  - _Nur neu verknüpfen_: A und B bleiben für ältere Fassungen, C bekommt deren Stück-Links.
  - _Neue Rolle_: C ist wirklich neu.
- **„A wurde zu A1 und A2“** (Aufteilung) – Vorschlag: A1/A2 erben Links und Besetzung von A;
  im Stück optional neue Rollen anlegen. Wer A spielt, wird gefragt bzw. die Planung entscheidet.
- **Umbenennung** (1 → 1) wird still als Alias übernommen, wenn mindestens ~80 % der Absätze
  übereinstimmen; sonst Rückfrage.

Doppelbesetzung (eine Person spielt mehrere Rollen) bleibt wie heute über die Besetzung gelöst –
kein eigener Mechanismus im Skript (E-U5).

## Phasen

1. **Rollen-Links statt Namensgleichheit** – `ScriptRoleLink`, Vorbelegung aus heutiger
   Namenslogik (Migration füllt bestehende Treffer), Leser/Lernmodus/Mitlesen lesen Links.
   Behebt B3 sofort.
2. **Reiter „Rollen“** – Umbenennen, Zusammenführen (+ Rückgängig), Art, Verknüpfen.
3. **Gruppen** – `kind`, `groupMode`, `ScriptGroupMember`, Auflösung in einer reinen Funktion
   (`groups.ts`, Vitest), Anbindung Leser/Lernmodus/Spiegel.
4. **Stabile Szenen** – `ScriptSceneKey`, Vererbung beim Freigeben, Rückfüllung für bestehende
   Fassungen; `measuredSeconds` darüber statt über den Titel.
5. **Trennen** von Rollen + Rückfrage in späteren Fassungen; Erkennung „Autor ändert Rollen“ im
   Prüfschritt (Zusammenlegung, Aufteilung, Umbenennung über `lineageId`).
6. **Stück: Rollen zusammenführen.**
7. **Übernahme-Assistent** Szenen → Rollen → Auftritte, `SceneCharacter.source`.
8. **„Änderungen fürs Stück“** bei neuer Fassung; E2E (80 Tage: neue Fassung mit Umnummerierung).

## Entscheidungen (2026-10-24)

- E-U1: „Alle“ = alle Besetzten der Produktion; Ausnahmen je Szene/Absatz.
- E-U2: Gruppenpassagen im Lernmodus einstellbar, Standard an.
- E-U3: Der Assistent schlägt vor, angehakt sind nur Felder, die im Stück seit der letzten
  Übernahme nicht von Hand geändert wurden (Stand der letzten Übernahme wird gespeichert).
  Von Hand geänderte Felder: nicht angehakt, mit „im Stück geändert: …“. Nichts wird ohne Klick
  überschrieben.
- E-U4: Offizielle Zuordnungen pflegt nur `SCRIPT.MANAGE`. Darstellende können für sich
  „hier nicht dabei / dabei“ setzen – wirkt nur auf ihre eigene Ansicht und ihr Lernen und
  erscheint bei der Regie als Hinweis zum Übernehmen.
- E-U5: Doppelbesetzung bleibt in der Besetzung (Person ↔ mehrere Rollen); der Plan kümmert sich
  um Zusammenlegungen/Aufteilungen durch den Autor.

## Checkliste

- [x] Phase 1 Rollen-Links (`ScriptRoleLink`, `ScriptRole.linkedAt`; ohne Link gilt weiter die
      Namensgleichheit, `src/lib/skript/role-links.ts`, Leser/Lernmodus/Vergleich/PDF)
- [x] Phase 2 Reiter „Rollen“ (`?ansicht=skript&bereich=rollen`, `skript-roles.tsx`,
      `src/lib/skript/role-admin.ts`): Umbenennen (alter Name wird Schreibweise), Art,
      Verknüpfen, Zusammenführen mit Protokoll `ScriptRoleMerge` und Rückgängig (Rolle kommt mit
      gleicher ID zurück; Lernkarten, die es für die Zielrolle schon gab, bleiben verloren)
- [x] Phase 3 Gruppen (`kind`, `groupMode` cast/present/fixed, `ScriptGroupRule` je Grundliste/
      Szene/Absatz; `ReaderBlock.memberRoleIds`; Lernmodus-Schalter „Gruppenpassagen mitlernen“;
      Spiegel nutzt die gepflegte Art). Besetzte ohne eigene Sprechrolle bekommen „Alle“ (cast)
      direkt; Ausnahmen wirken für sie nicht.
- [x] Phase 4 Stabile Szenen (`ScriptScene.sceneKey`, Rückfüllung über Titel, Freigabe vererbt
      über Absatz-Mehrheit, `src/lib/skript/scene-keys.ts`). `measuredSeconds` läuft noch über
      den Titel.
- [ ] Phase 5 Trennen + Erkennung „Autor ändert Rollen“
- [x] Phase 6 Stück: Rollen zusammenführen (Rollen-Panel „Zusammenführen“, `src/lib/produktionen/character-merge.ts`;
      Vorschau der umgehängten Daten, danach wird die leere Rolle gelöscht – nicht umkehrbar)
- [x] Phase 7 Übernahme-Assistent (`?ansicht=skript&bereich=uebernahme`, `src/lib/skript/takeover*.ts`):
      Szenen über `ScriptSceneLink` (mit Stand der letzten Übernahme für E-U3), Rollen über
      `ScriptRoleLink`, Auftritte mit `SceneCharacter.source`; Schalter „Gruppen als Auftritt zählen“.
      Braucht `SCRIPT.MANAGE` und `SHOW.MANAGE`. Neue Szenen landen im letzten Akt.
- [ ] Phase 8 „Änderungen fürs Stück“ + E2E

DB-Tests: `src/lib/skript/__tests__/role-admin.db.manual.ts`, `takeover.db.manual.ts`
(nicht in CI; Wegwerf-DB, `npx tsx`).
