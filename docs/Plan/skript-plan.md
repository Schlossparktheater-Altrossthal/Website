# Plan: Skript – Regie-PDF einlesen, Fassungen vergleichen, kommentieren

Stand: 2026-10-13. Phase 1 (Parser-Bibliothek `src/lib/skript/`) umgesetzt, Ergebnis deckt sich mit dem Prototyp; als Nächstes Phase 2. Checkliste am Ende wird gepflegt.

## Ziel

1. Skripte der Regie (PDF, je Stück anders formatiert) werden in eine **einheitliche Struktur**
   gebracht: Szene → Absatz (Replik oder Anweisung) → Teile (gesprochener Text, Regieanweisung,
   technischer Hinweis mit Gewerk).
2. **Neue Fassungen** werden gegen die vorige verglichen – auf Replik-Ebene, nicht zeilenweise.
3. **Kommentare** hängen an Repliken und bleiben über neue Fassungen erhalten.
4. **Bearbeiten** im Mitgliederbereich, **saubere PDF-Ausgabe** (z. B. eigene Rolle hervorgehoben,
   Technikfassung nur mit Hinweisen).
5. Das Skript ist **eigenständig** (eigene Rollen und Szenen, keine Fremdschlüssel auf
   `Character`/`Scene`). Ein **Übernahme-Assistent** schreibt bei Bedarf Szenen, Rollen und
   Auftritte gezielt und mit Vorschau ins Stück.

## Ist-Stand (Befunde)

| #   | Befund                                                                                                                                                                       | Stelle                                        |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| B1  | Prototyp (Python/PyMuPDF) liest „Die unendliche Geschichte“ 17.4./15.6.26: 25 Szenen, ~460 Absätze, 34 Rollen; Vergleich 95 geändert / 21 neu / 13 entfernt / 327 gleich     | `~/workspace/skriptparser-prototyp` (lokal)   |
| B2  | Struktur steckt in der Schrift: **fett + „:“** = Rolle (Doppelpunkt auch außerhalb des Fetten, auch mitten in der Zeile), _kursiv_ = Regie, fett in Großbuchstaben = Szene   | Prototyp `split_speaker`                      |
| B3  | Markierungen sind **gefüllte Rechtecke hinter dem Text**, keine PDF-Annotationen: gelb = Ton, cyan = Licht (bestätigt 2026-10-13), grün = Nebel, magenta = Effekt            | Prototyp `extract_lines`                      |
| B4  | Rote Schrift = Umbau/Choreo, graue Schrift = Off-Stimme (vermutet); Seitenzahl unten rechts                                                                                  | Prototyp                                      |
| B5  | Rollen in vielen Schreibweisen (`ATRÉJU`/`Atreju`, `Felsenbeisser`/`ß`, `KINDL. KAISERIN`) – Normalisierung + Abkürzungen + Levenshtein/Jaro-Winkler für Tippfehler          | Prototyp `normalize_roles`, `check_roles`     |
| B6  | Unmarkierte Hinweise im Text („TON 2b: Luftzug …“) nur heuristisch erkennbar → als „bitte prüfen“ markieren                                                                  | Prototyp `split_inline_cues`                  |
| B7  | Stück, Rollen, Szenen, Akte, Gewerke existieren schon                                                                                                                        | `prisma/schema.prisma` `Show/Character/Scene` |
| B8  | S3-Ablage (RustFS) und PDF-Ausgabe (pdfkit) existieren                                                                                                                       | `src/lib/storage/s3.ts`, `src/lib/pdf/`       |
| B9  | Repo ist MIT → **kein MuPDF** (AGPL); Parser in TypeScript mit `pdfjs-dist` (Apache-2.0). Farben/Rechtecke über die Operatorliste, Schrift über `getTextContent` + Fontnamen | –                                             |
| B10 | Keine Binärdateien und keine urheberrechtlich geschützten Texte ins Repo → Testdaten als kleine, selbst erzeugte PDFs (pdfkit im Test) oder JSON-Zeilen-Fixtures             | `AGENTS.md`                                   |

## Zielbild

### Pipeline (drei Ebenen)

1. **Extraktion** (`src/lib/skript/extract.ts`): PDF → Zeilen aus Spans mit `bold`, `italic`,
   Textfarbe, Markierungsfarbe, Position, Seite. Kopf-/Fußzeilen und Seitenzahlen werden über
   Position + Wiederholung entfernt.
2. **Profil + Parser** (`src/lib/skript/profiles/*.ts`, `parse.ts`): ein Profil beschreibt, wie ein
   Skript formatiert ist (Sprechererkennung, Szenen-Regex, Farbe → Gewerk, Stichwörter für
   unmarkierte Hinweise). **Autoerkennung**: jedes Profil bewertet die ersten Seiten, das beste
   gewinnt; Profil-Einstellungen sind pro Stück überschreibbar (z. B. Farbbedeutung).
3. **Abgleich** (`roles.ts`, `diff.ts`): Rollen normalisieren und zuordnen, Fassungen per
   Sequenz-Alignment (Needleman-Wunsch, Ähnlichkeit je Absatz, gleiche Rolle) vergleichen.

Die Pipeline ist reine Logik ohne DB und vollständig mit Vitest testbar.

### Datenmodell

```prisma
model ScriptVersion {            // eine Fassung („Stand 15.6.26“)
  id, showId, label, versionDate?, sourceKey (S3, Original-PDF), sourceName,
  profileId, profileOverrides Json?, status (draft | released), basedOnId?,
  importReport Json   // Warnungen: unbekannte Rollen, unsichere Hinweise, unzugeordnete Zeilen
  createdById, createdAt
}
model ScriptScene {              // Szene in einer Fassung
  id, versionId, sequence, title
}
model ScriptRole {               // Rolle im Skript, unabhängig von Character
  id, showId, name, aliases String[] (normalisierte Schreibweisen, einmal bestätigt)
}
model ScriptBlock {              // Absatz
  id, versionId, scriptSceneId, sequence,
  lineageId       // stabil über Fassungen: neue Fassung erbt die ID des zugeordneten Absatzes
  kind (speech | direction), speakerRaw?, parts Json  // [{kind,text,category?,auto?}]
  page Int?, wordCount Int
  roles ScriptBlockRole[]   // gemeinsame Repliken „Atreju/Bastian“ → mehrere Rollen
}
model ScriptSyncLink {           // nur vom Übernahme-Assistenten geschrieben, lose Verknüpfung
  id, showId, kind (scene | role), scriptKey (Szenentitel normalisiert | ScriptRole.id),
  targetId (Scene.id | Character.id), syncedAt
}
model ScriptComment {            // an lineageId, optional mit Textstelle (Offset/Zitat)
  id, showId, lineageId, versionId (wo geschrieben), quote?, body, visibility (private | team),
  authorId, resolvedAt?, createdAt
}
```

`lineageId` ist der Kern: Kommentare, Markierungen und spätere eigene Bearbeitungen hängen daran
und wandern beim Import einer neuen Fassung automatisch mit. Absätze ohne Gegenstück verlieren
nichts – ihre Kommentare erscheinen als „Absatz entfallen“.

### Rechte

- `PRIVATE.PRODUCTION.SCRIPT.MANAGE` (produktionsbezogen): importieren, freigeben, bearbeiten,
  Rollen zuordnen – Regie, Regieassistenz, Board.
- `PRIVATE.PRODUCTION.SCRIPT.READ` (produktionsbezogen): freigegebene Fassungen lesen,
  kommentieren, PDF laden – Ensemble und Gewerke der Produktion.
- Entwürfe sehen nur Verwalter. Das Original-PDF liegt nur in S3, nicht öffentlich.

### Oberflächen (mobil zuerst)

- **Stück → neuer Reiter „Skript“** (`/mitglieder/produktionen/stueck?ansicht=skript`).
- **Import-Assistent** (Verwalter): PDF hochladen → erkanntes Profil + Vorschau → **Prüfschritt**:
  Schreibweisen zu Skript-Rollen zusammenfassen (Vorschlag aus bestätigten Aliasen und
  Ähnlichkeit), unsichere Hinweise bestätigen → Entwurf speichern → Vergleich zur letzten Fassung
  ansehen → freigeben (Benachrichtigung an die Produktion).
- **Übernahme-Assistent „Ins Stück übernehmen“** (Verwalter, freigegebene Fassung): Schritt 1
  Szenen ↔ `Scene` (zuordnen, neu anlegen, ignorieren), Schritt 2 Rollen ↔ `Character`, Schritt 3
  Auftritte (`SceneCharacter`) aus den Repliken → Vorschau „wird angelegt / geändert / bleibt“ →
  übernehmen. Nichts wird gelöscht; bei einer späteren Fassung schlägt er nur die Unterschiede vor
  (über `ScriptSyncLink`).
- **Lesen**: saubere Fassung mit Szenen-Navigation, „Meine Rolle hervorheben“ (aus Besetzung
  vorbelegt), Hinweise je Gewerk ein-/ausblendbar, Kommentare am Rand (mobil Bottom-Sheet).
- **Vergleich**: Fassung A ↔ B, nur Änderungen, Zähler je Szene, „nur meine Rolle“.
- **Rollen-Übersicht**: Repliken, Wörter, Szenen je Rolle (ergänzt den Auftrittsplan).
- **PDF**: Lesefassung, Rollenfassung (eigene Repliken hervorgehoben), Technikfassung (Hinweise
  eines Gewerks hervorgehoben, nummeriert).

## Integration

- **Keine feste Kopplung**: Skript und Stück-Daten bleiben getrennt; das Stück kann auch ohne
  Skript gepflegt werden und umgekehrt. Der einzige Weg vom Skript ins Stück ist der
  Übernahme-Assistent.
- **Auftritte**: aus dem Skript ergibt sich, welche Rolle in welcher Szene spricht → Vorschlag im
  Assistenten („stumme“ Auftritte erkennt das Skript nicht, sie bleiben unangetastet).
- **Gewerke**: Hinweise (Ton/Licht/Nebel/Effekt/Umbau) sind Kandidaten für eine Cue-Liste je
  Gewerk; spätere Phase, an `docs/Plan/gewerke-plan.md` andocken.
- **Probenplanung**: Wortzahl je Rolle und Szene als Hilfe bei probbaren Szenen
  (`docs/Plan/planungshilfen-terminplanung-plan.md`).

## Phasen

1. **Parser-Bibliothek in TypeScript** – `src/lib/skript/` (extract, profile, parse, roles, diff)
   mit `pdfjs-dist`; Vitest mit synthetischen PDFs (pdfkit: fett/kursiv/farbige Rechtecke,
   Seitenzahl unten rechts, Sprecher mitten in der Zeile) und Fixtures; Ergebnis gegen den
   Python-Prototyp abgleichen (lokal, nicht im Repo).
2. **Datenmodell + Import-Entwurf** – Migration, Rechte registrieren, Upload nach S3, Server
   Action „importieren“ → Entwurf mit Import-Bericht.
3. **Prüfschritt + Freigabe** – Schreibweisen zu Skript-Rollen zusammenfassen, Aliase speichern, unsichere Hinweise,
   `lineageId`-Übernahme aus der Vorfassung, Freigabe.
4. **Leseansicht** – Reiter „Skript“, Rolle hervorheben, Gewerk-Filter, Rollen-Übersicht.
5. **Fassungsvergleich** – Ansicht A ↔ B mit Wort-Diff und Szenenzählern.
6. **Kommentare** – an Absatz/Textstelle, privat oder fürs Team, wandern über Fassungen.
7. **PDF-Ausgabe** – Lese-, Rollen-, Technikfassung über `src/lib/pdf`.
8. **Bearbeiten** – Absatz korrigieren (Rolle, Text, Teil als Hinweis/Regie umdeuten) im Entwurf;
   freigegebene Fassung bleibt unverändert, Korrektur = neue Fassung „bearbeitet“.
9. **Übernahme-Assistent** – Szenen, Rollen, Auftritte mit Vorschau ins Stück; später Cue-Listen
   je Gewerk.
10. **E2E + Release.**

## Entscheidungen (2026-10-13)

- E1: Parser in TypeScript (`pdfjs-dist`) im Next-Server, kein Python-Dienst; MuPDF scheidet
  wegen AGPL aus.
- E2: Formatprofile statt eines Parsers je Stück; neue Formate = neues Profil oder
  Profil-Überschreibung pro Stück.
- E3: Gelb = Ton, Cyan = Licht bestätigt; Grün/Magenta/Rot/Grau als Vorbelegung, pro Stück
  änderbar.
- E4: Unsichere Erkennungen werden nie still übernommen, sondern im Prüfschritt angezeigt.
- E5: Fassungen sind unveränderlich nach Freigabe; Kommentare hängen an `lineageId`.
- E6: Skript ist eigenständig, keine Fremdschlüssel auf `Scene`/`Character`; Übernahme ins Stück
  nur über einen Assistenten mit Vorschau, der nie löscht.

Offen:

- O1: Dürfen alle Produktionsmitglieder das ganze Skript lesen oder nur Besetzte/Gewerke?
  (Vorschlag: alle mit `SCRIPT.READ`, Standard für Ensemble und Gewerke.)
- O2: Sollen Kommentare standardmäßig privat oder fürs Team sichtbar sein? (Vorschlag: privat.)
- O3: Word-Dateien (.docx) als zweite Quelle – lohnt sich, wenn die Regie sie liefern kann.

## Checkliste

- [x] Phase 1 Parser-Bibliothek
- [ ] Phase 2 Datenmodell + Import-Entwurf
- [ ] Phase 3 Prüfschritt + Freigabe
- [ ] Phase 4 Leseansicht
- [ ] Phase 5 Fassungsvergleich
- [ ] Phase 6 Kommentare
- [ ] Phase 7 PDF-Ausgabe
- [ ] Phase 8 Bearbeiten
- [ ] Phase 9 Übernahme-Assistent
- [ ] Phase 10 E2E + Release
