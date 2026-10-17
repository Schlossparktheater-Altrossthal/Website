# Skript: Deckblatt, Pläne und Auswertungen (Plan, 2026-10-17)

Ziel: Leser und PDF-Export werden ein Baukasten. Aus einer Fassung entstehen neben dem Skript selbst
Pläne (Szenen, Auftritte, Umzüge, Requisiten, Technik) und Auswertungen (Wörter/Passagen je Rolle
und Szene). Alles ist einzeln an- und abwählbar und als Vorlage speicherbar.

## Ausgangslage

- PDF: `src/lib/skript/pdf.ts` (pdfkit, Vorlage `skript-fassung`), Route `/api/skript/[showId]/pdf`.
  Optionen: Rollen, Regie zeigen/abblenden/aus, Hinweise ausblenden, andere abblenden, Schriftgröße,
  Deckblatt an/aus. Deckblatt: Titel, Fassung, Stand, „Fassung für <Rollen>“, Szenenverzeichnis.
- Daten im Skript: Szenen (`ScriptScene`), Absätze mit `kind`, Sprecher, `wordCount`, Rollen
  (`ScriptBlockRole`), Hinweise als Teile mit `category` (ton, licht, nebel, effekt, umbau, aus, technik).
- **Lücke:** Die Skriptwelt (`ScriptRole`, `ScriptScene`) ist nicht mit dem Stück verknüpft
  (`Character`, `CharacterCasting`, `Scene`, `ProductionObject`/Kostüme/Requisiten). Der in
  skript-plan.md vorgesehene Übernahme-Assistent mit `ScriptSyncLink` ist noch nicht gebaut.
  Ohne diese Verknüpfung gibt es keine Schauspielernamen, keine Requisiten und keine Kostümwechsel.
- Regie: Personen im Gewerk „Regie“ der Produktion. Autor/Vorlage: nirgends gespeichert.

## Was rein aus dem Skript geht (ohne Verknüpfung)

| Auswertung                                                                | Quelle                               |
| ------------------------------------------------------------------------- | ------------------------------------ |
| Wörter, Passagen (Repliken), Anteil in %, längste Replik je Rolle         | `wordCount`, `ScriptBlockRole`       |
| Szene: Länge in Wörtern/Passagen/Seiten, geschätzte Spielzeit             | `wordCount`, `page`                  |
| Szene: wer spricht, wer ist nur erwähnt/in Regie genannt                  | Sprecher, Rollennamen in Regieteilen |
| Szene: Ton-/Licht-/Nebel-/Effekt-/Umbau-Hinweise mit Text, Anzahl         | Teile `kind: "cue"`                  |
| Auftrittsmatrix Rolle × Szene (Kreuz bzw. Wortzahl in der Zelle)          | Blöcke je Szene                      |
| Pausen je Rolle: „nach Szene 4 frei bis Szene 7“                          | Matrix                               |
| Schnelle Wechsel: Rolle spricht am Ende von Szene n und am Anfang von n+1 | Blockreihenfolge                     |
| Stichwortliste: letzte Worte vor jeder eigenen Replik („Cue-Script“)      | Vorgängerblock                       |
| Technik-Fahrplan (Ton/Licht/Effekte durchnummeriert mit Stichwort davor)  | Hinweise + Vorgänger                 |
| Rollen ohne Text / nur Regie                                              | Rollen ohne Repliken                 |

## Was die Verknüpfung mit dem Stück braucht

| Auswertung                                                                         | zusätzlich nötig                          |
| ---------------------------------------------------------------------------------- | ----------------------------------------- |
| Deckblatt „Fassung für Lisa Müller (Atreju)“                                       | ScriptRole ↔ Character ↔ CharacterCasting |
| Besetzungsliste Rolle → Darsteller, Zweitbesetzung                                 | dto.                                      |
| Requisitenplan je Szene (wer bringt was, wo liegt es)                              | ScriptScene ↔ Scene, ObjectScene          |
| Kostüm-/Umzugsplan je Darsteller (Kostüm A → B zwischen Szene x und y, Zeitpuffer) | Kostüme je Szene + Character              |
| Bühnenbild/Umbauplan je Szenenwechsel                                              | Umbau-Hinweise + `set_piece`-Objekte      |
| Szenenkarte mit Ort/Tageszeit/Dauer aus dem Stück                                  | Scene-Felder                              |

## Vorschläge über das Gewünschte hinaus

1. **Cue-Script / Stichwortheft** je Rolle: nur eigene Repliken mit letzter Zeile davor – ideal zum Lernen.
2. **Technik-Fahrplan** für Ton/Licht: nummerierte Cues mit Stichwort, Seite, Szene – direkt fürs Pult.
3. **Pausen- und Wechselplan** je Darsteller: wann frei, wo knapp (für Umzug und Maske).
4. **Szenen-Steckbrief** als eine Seite pro Szene (Rollen, Wörter, Technik, Requisiten, Notizen) –
   als Aushang hinter der Bühne oder als Probenvorbereitung.
5. **Fassungsvergleich in Zahlen**: welche Rolle hat wie viel Text gewonnen/verloren (compare.ts).
6. **Lernstand je Rolle** (Lernmodus) – nur für die eigene Person, nicht im Team-PDF.
7. **Persönliche Notizen mit drucken** (an/aus) – Markierungen und Zeichen aus Phase 8.
8. **Wasserzeichen** „Fassung für <Name>“ auf jeder Seite (Weitergabe nachvollziehbar).
9. **Vorlagen speichern**: „Regiebuch“, „Darsteller“, „Technik“, „Requisite“ als Knopf statt Haken-Orgie.
10. **CSV/Excel-Export** der Tabellen (Rollenstatistik, Matrix) für die Planung.

## Baukasten-Modell

Ein Export = Deckblatt + Liste von **Abschnitten** in wählbarer Reihenfolge:

```ts
type ScriptExportSection =
  | { type: "script" /* bisherige Optionen */ }
  | { type: "cast" } // Besetzung
  | { type: "roleStats"; sort: "words" | "passages" | "order"; columns: RoleStatColumn[] }
  | { type: "sceneSummary"; columns: SceneColumn[]; layout: "table" | "pages" }
  | { type: "matrix"; cell: "mark" | "words" | "passages" }
  | { type: "cueList"; categories: CueCategory[] } // Technik-Fahrplan
  | { type: "cueScript"; roleIds: string[] } // Stichwortheft
  | { type: "props" }
  | { type: "costumeChanges" }
  | { type: "setChanges" };

type SceneColumn =
  | "roles"
  | "words"
  | "passages"
  | "pages"
  | "duration"
  | "ton"
  | "licht"
  | "nebel"
  | "effekt"
  | "umbau"
  | "props"
  | "costumes"
  | "notes";
```

- Berechnung getrennt vom Zeichnen: `src/lib/skript/stats.ts` (rein, testbar, auch im Leser nutzbar).
- Jeder Abschnitt ist eine kleine Render-Funktion auf den Layout-Helfern der PDF-Engine
  (`src/lib/pdf`, Tabellen wie beim Ablaufplan).
- Optionen als JSON-Parameter statt immer mehr Query-Parametern; alte Parameter bleiben gültig.
- Vorlagen: `ScriptExportPreset { id, showId, ownerId?, name, config Json }` – persönlich oder fürs Stück.

## Deckblatt

- Titel, Untertitel/Vorlage: **„nach <Werk> von <Autor>“**, Bearbeitung/Fassung von …
- **Regie** (Gewerk Regie, Reihenfolge wie dort), optional Regieassistenz.
- Personalisiert: **Rolle(n) und/oder Name** der Person – Schalter „Rolle“, „Name“, „beides“.
  Standard beim eigenen Export: beides; beim Export für andere wählt man die Person aus.
- Fassung, Stand, Entwurf-Hinweis, Szenenverzeichnis wie bisher; Inhaltsverzeichnis der Abschnitte.
- Speicherort Autor/Vorlage: neue Felder an `Show` (`author`, `basedOn`, `adaptation`) im
  Produktionsformular, damit auch Website/Programmheft sie nutzen können. Pro Fassung überschreibbar
  ist nicht nötig.

## Phasen

1. **Deckblatt** – Show-Felder Autor/Vorlage/Bearbeitung (Migration + Formular), Regie aus Gewerk,
   personalisiert mit Rolle/Name (Name zunächst die angemeldete Person bzw. frei wählbar aus
   Mitgliedern der Produktion). Wasserzeichen optional.
2. **Statistik-Kern** `stats.ts` + Unit-Tests: je Rolle (Wörter, Passagen, Anteil, längste Replik,
   Szenen), je Szene (Wörter, Passagen, Seiten, Dauer-Schätzung, Rollen, Cues je Kategorie), Matrix,
   Pausen, schnelle Wechsel.
3. **Abschnitte im PDF**: Rollenstatistik, Szenenübersicht (Tabelle oder Seite pro Szene mit frei
   wählbaren Spalten), Auftrittsmatrix, Technik-Fahrplan, Stichwortheft.
4. **Export-Dialog im Leser** umbauen: Vorlagen oben („Mein Text“, „Regiebuch“, „Technik“,
   „Übersichten“), darunter Abschnitte an/aus + sortieren, Vorschau-Zähler (Seiten ca.).
   Vorlagen speichern (Migration `ScriptExportPreset`).
5. **Auswertungen im Leser** (ohne PDF): Seite „Übersicht“ mit denselben Tabellen, sortierbar,
   CSV-Download.
6. **Verknüpfung Skript ↔ Stück** (Übernahme-Assistent light): Rollen → Character, Szenen → Scene
   zuordnen (Vorschlag per Namensähnlichkeit, bestätigen). Erst danach: Darstellername auf dem
   Deckblatt automatisch, Besetzungsliste.
7. **Requisiten-, Kostüm-/Umzugs-, Umbaupläne** aus Ausstattung (`ObjectScene`, Kostüme je
   Character) + Umbau-Hinweisen; Umzugsplan mit Puffer in Szenen/Minuten und Warnung bei knappen
   Wechseln.
8. **Extras**: Fassungsvergleich in Zahlen, persönliche Notizen mitdrucken, E2E + Release.

Phasen 1–5 hängen nur am Skript und sind sofort machbar; 6–7 bauen aufeinander auf.

## Entscheidungen (2026-10-17)

- E1: Autor, Fassung und Regie liest der **Parser aus dem Vorspann**, gespeichert **pro Produktion**
  (`Show.scriptCredits`). Die erste Fassung füllt die Liste, später fragt der Prüfschritt nur nach,
  wenn neue Namen auftauchen („Ergänzen“). Ohne Regie-Angabe: Mitglieder des Gewerks Regie.
- E2: **Jeder für jeden** – alle Leser dürfen PDFs für jedes Mitglied der Produktion erzeugen.
- E3: Dauer geschätzt (Wörter/Minute) und **als Schätzung markiert**; gibt es eine gemessene Zeit
  (später: Stoppuhr bei Durchläufen, Feld an `ScriptScene`), gilt diese.
- E4: Gemeinsame Repliken zählen **voll für jede Rolle**.
- E5: Szenenübersicht als **Tabelle**.
- E6: **Keine Verknüpfung mit dem Stück** vorerst. Das Skript bleibt in sich geschlossen; die
  Person für ein PDF wird gewählt, ihre Rollen kommen per Namensabgleich mit der Besetzung (wie
  bisher `ownRoleIds`). Später ein eigener Verknüpfungsassistent (Szenen, Rollen übernehmen/verknüpfen);
  Phase 6/7 warten darauf. Requisiten/Umzüge vorerst nur aus Skript-Hinweisen.

## Stand

- Phase 1 (Deckblatt) umgesetzt 2026-10-17: `src/lib/skript/credits.ts` (+ Tests), Migration
  `20261017160000_script_credits`, Karte „Mitwirkende“ im Prüfschritt, PDF `?fuer=<userId>&zeigen=both|role|name`,
  Auswahl „Fassung für“ im Leser, Fußzeile „für <Name>“.
- Nachlesen aus dem Original-PDF für ältere Fassungen (Knopf in der Karte „Mitwirkende“), 0cbb1387.
- Phase 2 Statistik `src/lib/skript/stats.ts` (+ Tests): Rollen, Szenen (Dauer geschätzt/gemessen),
  Hinweise nummeriert mit Stichwort, Pausen, Stichwortheft.
- Phase 3 Abschnitte `src/lib/skript/pdf-sections.ts`, client-sichere Optionen in `export-options.ts`;
  PDF `&teile=roleStats,sceneTable,matrix,cueList,cueScript,script&spalten=…&matrix=mark|words|passages`,
  Inhaltsverzeichnis auf dem Deckblatt.
- Phase 4 Export im Leser `pdf-export.tsx`: Vorlagen (Mein Text, Stichwortheft, Regiebuch, Technik,
  Übersichten), Abschnitte an/aus + sortieren, Szenenspalten, Matrix-Inhalt (gespeichert im Browser).
  Eigene Vorlagen: `ScriptExportPreset` (Migration 20261017200000), `src/lib/skript/presets.ts`,
  Aktionen `preset-actions.ts`; eigene für alle Leser, „für alle im Stück“ nur mit SCRIPT.MANAGE.
- Phase 5 Übersichten `/mitglieder/skript/[fassung]/uebersicht`: Rollen (sortierbar, Balken),
  Szenen (Spalten wie im PDF), Auftritte, Technik (Filter je Gewerk); CSV je Reiter
  (`stats-csv.ts`, Semikolon + BOM für Excel). Spalten/Matrix-Inhalt teilen sich die Einstellung mit dem PDF.
- Gemessene Szenenzeiten: `ScriptScene.measuredSeconds` (Migration 20261017220000), Eintragen in
  der Übersicht (Reiter Szenen, nur SCRIPT.MANAGE, Eingabe `12:30`/`12`), neue Fassungen und
  bearbeitete Kopien übernehmen sie bei gleichem Szenentitel. Spalte heißt „Dauer“; „ca.“ = geschätzt.
