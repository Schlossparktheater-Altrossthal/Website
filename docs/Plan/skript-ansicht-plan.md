# Skript: Frei konfigurierbare Ansicht + Szenenkopf (Plan, 2026-10-17)

Ziel: Jede Person stellt sich **eine Ansicht** zusammen, und **Leser und PDF zeigen danach denselben Inhalt** – aber kein WYSIWYG:
Papier und Bildschirm haben je eine eigene, dafür optimierte Darstellung (User 2026-10-17). Kernstück ist ein **Szenenkopf**: am Beginn jeder Szene eine
kompakte, schöne Übersicht – wer gebraucht wird, welche Ton-/Lichtszenen kommen, Umbau, Requisiten,
Dauer … – deren Inhalt man selbst wählt. Der Szenenspiegel (Auftrittsmatrix) bleibt erhalten.

## Ausgangslage (Stand main da73b859)

- Leser-Einstellungen `Settings` in `src/app/(reader)/mitglieder/skript/shared.tsx`, nur
  `localStorage` je Stück (`skript-leser:<showId>`): Schriftgröße, Regie zeigen/abblenden/aus,
  Hinweise als Zeile/inline, Hinweis-Kategorien aus/folgen, Rollen + abblenden, Notizen, Wachhalten,
  Probenmodus – plus `pdfCover`, `pdfSections`, `pdfSceneColumns`, `pdfMatrixCell`.
- PDF-Export (`pdf-export.tsx` → `/api/skript/[showId]/pdf`) übernimmt einen Teil der Leser-Werte per
  Query-Parameter (`regie`, `ohne`, `abblenden`, `groesse`, `rollen`), hat aber eigene Abschnitte und
  eigene Vorlagen (`ScriptExportPreset`, nur Abschnitte/Spalten/Matrix). Leser-Optionen wie
  `cueLayout`, `showNotes`, `followedCues` kommen im PDF **nicht** an → Leser und PDF laufen auseinander.
- Szenenbeginn im Leser: nur `<h2>{scene.title}</h2>` (`reader.tsx` ~Z. 1328). Im PDF ebenso.
- Daten je Szene vorhanden: Titel, Blöcke, Sprecher/Rollen, Wörter, Seiten, Hinweise mit Kategorie,
  `measuredSeconds`. Statistik je Szene liefert schon `stats.ts` (`ScriptStats.scenes`).
- Nicht vorhanden: Szenen-Infos, die nicht im PDF stehen (Ort, Requisiten, Kostüm, stumme
  Mitwirkende/Ensemble, nummerierte Licht-/Tonstimmungen, Bemerkungen).

## Grundidee: eine „Ansicht“ statt Leser-Einstellungen + PDF-Vorlagen

```ts
type ScriptView = {
  text: { fontSize; directions: "show" | "dim" | "hide"; dimOthers; roleIds; showNotes };
  cues: {
    layout: "below" | "inline" | "margin";
    hidden: CueCategory[];
    followed: CueCategory[];
    numbered: boolean; /* T1, L4 … durchnummeriert */
  };
  sceneHeader: {
    mode: "off" | "compact" | "card"; // eine Zeile Chips | Karte
    items: SceneHeaderItem[]; // Reihenfolge = Anzeige-Reihenfolge
    onlyMyScenes: boolean; // Kopf nur, wo eigene Rollen vorkommen
    collapsed: boolean; // Leser: zugeklappt, Antippen öffnet
  };
  print: {
    cover;
    sections: ScriptPdfSection[];
    sceneColumns;
    matrixCell;
    sceneHeaderOnNewPage: boolean;
    pageBreakPerScene: boolean;
  };
  device: { keepAwake; rehearsal }; // bleibt nur lokal, nicht in Vorlagen
};

type SceneHeaderItem =
  | "roles" // wer gebraucht wird: sprechend · nur in Regie genannt · stumm (manuell)
  | "myPart" // eigene Rollen: Repliken/Wörter, erster Einsatz mit Stichwort
  | "duration" // gemessen, sonst „≈ Sprechzeit“
  | "size" // Seiten, Wörter, Passagen
  | "ton"
  | "licht"
  | "nebel"
  | "effekt"
  | "umbau"
  | "aus"
  | "technik"
  // je Kategorie: Anzahl + Liste (nummeriert, mit Seitenangabe)
  | "location" // Ort/Bild/Tageszeit (manuell)
  | "props" // Requisiten (manuell)
  | "costume" // Kostüm/Maske je Rolle (manuell)
  | "transition" // Wechsel: wer kommt direkt aus der vorigen Szene, wer ist jetzt frei
  | "sceneNote"; // Bemerkung zur Szene (Team) + eigene Szenennotiz
```

Leser **und** PDF entscheiden aus diesem Objekt, **was** gezeigt wird (Rollen, Regie, Hinweis-Kategorien,
Szenenkopf-Bausteine). **Wie** es aussieht, legt jedes Medium selbst fest (Papier: Kasten, Rand,
Seitenumbruch; Bildschirm: Chips, aufklappbar). Medienspezifische Optionen stehen getrennt
(`screen.*`, `print.*`). Der
PDF-Export bekommt die Ansicht als Ganzes (JSON im POST statt einzelner Query-Parameter), damit neue
Optionen nicht jedes Mal doppelt verdrahtet werden müssen.

## Szenenkopf – Gestaltung

- **Kompakt**: eine Zeile unter der Szenenüberschrift, Chips in Gewerksfarbe
  (`SCRIPT_CUE_STYLES`): `👥 7 · Atreju, Bastian, +5 │ ⏱ 6:40 │ Ton 3 │ Licht 5 │ Umbau`.
  Eigene Rollen fett. Antippen klappt die Karte auf.
- **Karte**: Raster mit Überschriften (Wer · Technik · Bühne · Notiz), Technik als nummerierte Liste
  „L4 – Abendrot, S. 12“. Maximal so hoch wie nötig, leere Einträge fallen weg.
- **PDF**: dieselbe Karte als umrandeter Kasten unter der Szenenüberschrift, optional jede Szene auf
  neuer Seite. Zusätzlich als eigener Abschnitt **Szenen-Steckbriefe** (eine Seite je Szene, ohne
  Text) – Aushang hinter der Bühne.
- Mobile zuerst: Kompakt ist Standard auf dem Handy, Karte auf Tablet/PDF. Screenshots mobil +
  Desktop auf Staging vor und nach dem Bau.

## Szenen-Infos, die nicht im Skript stehen

Neues Modell (je Fassung, Übernahme in neue Fassungen per Szenentitel wie `measuredSeconds`):

```prisma
model ScriptSceneInfo {
  sceneId     String @id            // ScriptScene
  location    String?               // Ort / Bild / Tageszeit
  extraRoles  String[]              // stumme Rollen/Ensemble/Statisten (ScriptRole-IDs oder Text)
  props       Json?                 // [{ text, who? }]
  costume     Json?                 // [{ roleId, text }]
  lightStates Json?                 // [{ nr: "L4", text, cueRef? }]  manuell gepflegte Stimmungen
  soundCues   Json?                 // [{ nr: "T2", text, file? }]
  note        String?               // Bemerkung fürs Team
  updatedAt / updatedById
}
```

Bearbeiten direkt im Szenenkopf (Stift-Symbol) **nur für SCRIPT.MANAGE**. Gewerke bearbeiten vorerst
nichts; sie halten ihre Dinge über das vorhandene Notizsystem fest (Phase 8). Der Szenenkopf kann
eigene Notizen der Szene als Baustein „Meine Notizen“ (Anzahl + Sprung) anzeigen.
Erkannte Hinweise aus dem PDF und manuelle Einträge werden zusammengeführt (manuelle Nummer gewinnt,
Hinweis ohne Nummer bekommt automatisch die nächste).

## Ansichten speichern und teilen

- `ScriptExportPreset` → **`ScriptView`** (Migration: vorhandene Vorlagen werden Ansichten, `config`
  um die neuen Felder mit Standardwerten ergänzt). Felder: `showId`, `ownerId`, `name`, `shared`,
  `config` (zod-Schema in `src/lib/skript/view-options.ts`, client-sicher).
- Fertige Ansichten: **Darsteller** (eigene Rollen, Kopf kompakt mit „Mein Teil“ + Wer),
  **Regie** (alles, Karte, Notizen), **Ton/Licht** (Regie abgeblendet, Hinweise im Rand nummeriert,
  Kopf nur Technik), **Souffleuse** (großer Text, Regie aus, Kopf „Wer“), **Requisite/Bühne**
  (Kopf Bühne/Requisiten/Umbau, Text abgeblendet).
- Aktive Ansicht wird pro Person und Stück **serverseitig** gemerkt (Handy und Laptop gleich);
  `localStorage` nur noch als Offline-Zwischenspeicher. Geräteeinstellungen (Wachhalten,
  Probenmodus) bleiben lokal.
- Teilbarer Link `?ansicht=<id>`: Regie schickt der Technik „ihre“ Ansicht.

## Einstellungen-Blatt neu ordnen

Ein Blatt, Gruppen statt langer Liste, oben die Ansicht-Auswahl:

1. **Ansicht**: Auswahl (fertige/geteilte/eigene) · Speichern unter … · Zurücksetzen
2. **Text**: Schriftgröße, Regie, eigene Rollen + andere abblenden, Notizen
3. **Hinweise**: Darstellung (Zeile/inline/Rand), Kategorien sichtbar/folgen, nummerieren
4. **Szenenkopf**: aus/kompakt/Karte, Bausteine an/aus per Schalter, Reihenfolge per Ziehen
   (wie die PDF-Abschnitte), „nur meine Szenen“
5. **Drucken**: Deckblatt, Abschnitte, Szenenspiegel-Inhalt, Seitenumbruch je Szene → Knopf
   „PDF dieser Ansicht“
6. **Gerät**: Wachhalten, Probenmodus

Inhaltliche Änderungen gelten für Leser und PDF; Darstellungsoptionen nur für ihr Medium.

## Szenenspiegel behalten und einbinden

- Bleibt als PDF-Abschnitt „Auftritte (Rolle × Szene)“ und Reiter in der Übersicht.
- Neu: im Leser als Blatt erreichbar (Szenen-Menü → „Szenenspiegel“), Zeile antippen springt zur
  Szene, Rolle antippen setzt sie als eigene Rolle.
- Zellinhalt erweitern: Kreuz/Wörter/Passagen **+ „stumm“** (aus `extraRoles`), damit „wer wird
  gebraucht“ vollständig ist und nicht nur „wer spricht“.

## Phasen

1. **Ansicht-Modell**: `view-options.ts` (Typ, zod, Standardwerte, Migration alter
   localStorage-Settings), `useSettings` → `useView`; Leser liest nur noch daraus. Kein Sichtwechsel.
2. **Szenenkopf im Leser** aus vorhandenen Daten (Wer sprechend/genannt, Mein Teil, Dauer, Umfang,
   Technik je Kategorie, Wechsel). Kompakt + Karte, einklappbar. Screenshots mobil/Desktop.
3. **Einstellungen-Blatt** neu gegliedert inkl. Bausteine/Reihenfolge des Szenenkopfs.
4. **PDF nach Ansicht**: Route nimmt die Ansicht (POST/JSON), `pdf.ts` rendert Szenenkopf-Kasten,
   Hinweis-Layout und Notizen wie der Leser; Abschnitt „Szenen-Steckbriefe“. Tests in `pdf.test.ts`.
5. **Ansichten speichern**: `ScriptView` (Migration aus `ScriptExportPreset`), fertige Ansichten,
   serverseitig gemerkte aktive Ansicht, `?ansicht=`-Link.
6. **Szenen-Infos**: `ScriptSceneInfo` + Bearbeiten im Szenenkopf, Übernahme in neue Fassungen,
   nur Skript-Verwaltung, nummerierte Licht-/Tonstimmungen zusammengeführt mit erkannten Hinweisen.
7. **Szenenspiegel im Leser** + Zellinhalt „stumm“, Sprung zur Szene.
8. **E2E** (Ansicht wählen → Leser + PDF passen zusammen, Szenen-Info bearbeiten), Staging-Abnahme,
   Release.

Phase 1–4 brauchen keine Migration und liefern schon den sichtbaren Kern.

## Weitere Vorschläge

- **„Nächste Szene“-Leiste** im Probenmodus: unten eingeblendet, wer gleich dran ist und welche
  Technik als Nächstes kommt.
- **Eigene Szenen hervorheben** in der Szenenliste (Punkt/Balken), „frei bis Szene 7“ direkt dort.
- **Hinweise im Rand nummeriert** (Tablet/PDF) wie ein klassisches Regie-/Inspizientenbuch.
- **Technik-Ansicht mit Stichwort**: nur Stichwort + Cue, Rest des Texts eingeklappt
  (Inspizienten-Modus) – nutzt den vorhandenen Technik-Fahrplan.
- **Szenenkopf mit Probenstand**: wann zuletzt geprobt, nächste geplante Probe (Terminplanung) –
  erst nach Verknüpfung Skript ↔ Stück.
- **Besetzung statt Rollen** im Szenenkopf (Lisa Müller als Atreju) – ebenfalls nach Verknüpfung
  (Phase 6/7 aus skript-auswertungen-plan.md).
- **Druckvorschau** im Einstellungen-Blatt (erste Seite als Bild), bevor man das ganze PDF lädt.

## Neue Fassungen (Upload) – nichts darf verloren gehen

Grundsatz: Ansichten und Szenen-Infos hängen **am Stück**, nicht an einer Fassung. Alles, was an
einer Fassung hängt, wird bei der Freigabe einer neuen Fassung übernommen und – wo unsicher – im
Prüfschritt zur Bestätigung vorgelegt (wie Rollen heute).

| Was                              | Hängt an                               | Übernahme bei neuer Fassung                                       |
| -------------------------------- | -------------------------------------- | ----------------------------------------------------------------- |
| Ansichten, aktive Ansicht        | Stück + Person                         | unverändert; Rollen-IDs sind stückweit (`ScriptRole`)             |
| Szenen-Infos (Ort, Requisiten …) | **Szenen-Linie** (neu)                 | Zuordnung alte → neue Szene, s. u.                                |
| Feste Licht-/Tonnummern          | Hinweis über Absatz-`lineageId` + Text | Absatz gefunden → Nummer bleibt; Hinweis neu → „neu, ohne Nummer“ |
| Gemessene Szenenzeit             | heute per Titel                        | künftig über Szenen-Linie                                         |
| Notizen/Markierungen             | Absatz-`lineageId` (existiert)         | wie bisher                                                        |

**Szenen-Linie:** `ScriptScene.lineageId` analog zu den Absätzen. Zuordnung: gleicher Titel → sonst
größte Überschneidung der Absatz-`lineageId`s (fängt umbenannte, geteilte, zusammengelegte Szenen).
Mehrdeutiges (Szene geteilt/zusammengelegt/neu/entfallen) zeigt der Prüfschritt als Karte
„Szenen zuordnen“; Infos entfallener Szenen werden nicht gelöscht, sondern als „verwaist“ angezeigt
und können einer Szene zugewiesen werden.

**Feste Technik-Nummern:** Bei neuer Fassung bleiben vorhandene Nummern stehen; neue Hinweise
bekommen Zwischennummern (L4a) statt Umnummerierung – so stimmen Pult und Papier weiter. Entfallene
Hinweise erscheinen im Prüfschritt und im Technik-Fahrplan als „gestrichen“. Umnummerieren nur auf
ausdrücklichen Knopfdruck der Skript-Verwaltung. Der Fassungsvergleich zeigt geänderte Szenen-Infos/Nummern.

**Lesende während eines Uploads:** Entwürfe ändern nichts; erst die Freigabe stellt um. Die aktive
Ansicht wählt automatisch die neueste freigegebene Fassung, Szenenkopf zeigt „seit letzter Fassung
geändert“ (Punkt), wenn Text/Technik der Szene sich geändert hat.

Phase 6 umfasst deshalb: `ScriptScene.lineageId` + Migration (bestehende Fassungen per Titel
verketten), Zuordnung in `review.ts`, Karte im Prüfschritt, Tests mit 17.4. → 15.6.

## Stand 2026-10-17 abends

Phase 1–4 umgesetzt (bb20a619 + Nachbesserung), auf Staging mit Screenshots mobil/Desktop und PDF
geprüft:

- `src/lib/skript/scene-header.ts`: Modell, Bausteine, `buildSceneHeaders` (rein, getestet).
- Leser: `scene-header.tsx` (eine Zeile, Antippen klappt Karte auf), `scene-header-settings.tsx`;
  Einstellungen-Blatt gegliedert in Text · Technische Hinweise · Szenenkopf · Gerät · Drucken/PDF.
- PDF: grauer Kasten unter der Szenenüberschrift, bleibt mit Überschrift auf einer Seite;
  Schalter „Szenenkopf im PDF“.
- Hinweisnummern: Nummeriert das Skript ein Gewerk selbst („TON 1 …“), keine Auto-Nummer daneben.

Abweichungen vom Plan (bewusst, klein gehalten):

- `Settings` bleibt (um `sceneHeader`, `pdfSceneHeader` erweitert) statt neuem `ScriptView`-Typ –
  der Umbau kommt mit Phase 5 (serverseitige Ansichten).
- PDF bleibt GET mit Parametern (`kopf`, `kopfnurmeine`), damit „PDF öffnen“ als Link funktioniert.
- Reihenfolge der Bausteine fest (Wer, Mein Teil, Dauer, Umfang, Technik, Weiter, Notizen).
- „Meine Notizen“ als Szenenkopf-Baustein nur im Leser.

Notizen im PDF (User-Wunsch, 2026-10-17): `src/lib/skript/pdf-notes.ts`, Schalter „Meine Notizen im
PDF“ (`&notizen=1`). Fürs Papier: Markierung farbig unterstrichen, Absatzmarkierung als Randstrich,
Zeichen als Glyphe (Zäsur „||“, Helvetica kennt kein ‖), lauter/leiser/Stimmung als „(Etikett)“,
Notizen mit Nummer „[1]“ im Text und darunter, Zettel als kleine Vektorzeichnung. Nur eigene
Notizen der erzeugenden Person, nie in der Fassung für jemand anderen; verwaiste weggelassen,
verrutschte nur unter dem Absatz.

Phase 5 (2026-10-17): `src/lib/skript/view-options.ts` (Ansicht = Inhalt, `BUILT_IN_VIEWS`
Darsteller/Regie/Ton-Licht/Souffleuse/Requisite-Bühne), gespeicherte Ansichten als
`ScriptExportPreset.config.view` (ohne Migration; ohne `view` = reine PDF-Vorlage), persönlicher
Stand in `ScriptReaderState` (Migration 20261017230000, neuester `savedAt` gewinnt, Geräte-
einstellungen nur lokal), Auswahl oben im Einstellungen-Blatt (`view-picker.tsx`), Link
`?ansicht=<id>` übernimmt eine Ansicht einmal.

## Entscheidungen 2026-10-17

1. Szenen-Infos bearbeitet nur die Skript-Verwaltung; Gewerke nutzen das Notizsystem.
2. Licht/Ton: automatische Nummern als Startwert, Skript-Verwaltung kann festschreiben/ändern.
3. Szenenkopf für neue Leser: kompakt an.
4. Aktive Ansicht serverseitig; Geräteeinstellungen lokal.
5. Geteilte Ansichten nur Skript-Verwaltung (wie bisher), eigene alle.

## Ursprünglich offene Entscheidungen (beantwortet, s. o.)

1. Wer darf Szenen-Infos bearbeiten: nur Skript-Verwaltung oder auch die Gewerke (Ton/Licht,
   Requisite, Kostüm) für „ihre“ Felder?
2. Licht-/Tonszenen: reichen die erkannten Hinweise aus dem PDF (automatisch nummeriert), oder soll
   die Technik eine eigene, manuell gepflegte Liste mit festen Nummern führen?
3. Standard für neue Leser: Szenenkopf kompakt an oder aus?
4. Soll die aktive Ansicht serverseitig gespeichert werden (geräteübergreifend) – ja als Vorschlag.
5. Dürfen geteilte Ansichten nur von der Skript-Verwaltung angelegt werden oder von allen?
