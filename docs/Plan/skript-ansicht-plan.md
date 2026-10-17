# Skript: Frei konfigurierbare Ansicht + Szenenkopf (Plan, 2026-10-17)

Ziel: Jede Person stellt sich **eine Ansicht** zusammen, und **Leser und PDF sehen danach gleich aus**
(„was ich sehe, wird gedruckt“). Kernstück ist ein **Szenenkopf**: am Beginn jeder Szene eine
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

Leser **und** PDF rendern den Text, die Hinweise und den Szenenkopf aus genau diesem Objekt. Der
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

Bearbeiten direkt im Szenenkopf (Stift-Symbol) für SCRIPT.MANAGE. Vorschlag: Technik-Felder
zusätzlich für Mitglieder der Gewerke Ton/Licht, Requisiten/Kostüm für deren Gewerke.
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

Änderungen wirken sofort im Leser dahinter (Vorschau), das PDF folgt derselben Ansicht.

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
4. **PDF = Ansicht**: Route nimmt die Ansicht (POST/JSON), `pdf.ts` rendert Szenenkopf-Kasten,
   Hinweis-Layout und Notizen wie der Leser; Abschnitt „Szenen-Steckbriefe“. Tests in `pdf.test.ts`.
5. **Ansichten speichern**: `ScriptView` (Migration aus `ScriptExportPreset`), fertige Ansichten,
   serverseitig gemerkte aktive Ansicht, `?ansicht=`-Link.
6. **Szenen-Infos**: `ScriptSceneInfo` + Bearbeiten im Szenenkopf, Übernahme in neue Fassungen,
   Rechte je Gewerk, nummerierte Licht-/Tonstimmungen zusammengeführt mit erkannten Hinweisen.
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

## Offene Entscheidungen

1. Wer darf Szenen-Infos bearbeiten: nur Skript-Verwaltung oder auch die Gewerke (Ton/Licht,
   Requisite, Kostüm) für „ihre“ Felder?
2. Licht-/Tonszenen: reichen die erkannten Hinweise aus dem PDF (automatisch nummeriert), oder soll
   die Technik eine eigene, manuell gepflegte Liste mit festen Nummern führen?
3. Standard für neue Leser: Szenenkopf kompakt an oder aus?
4. Soll die aktive Ansicht serverseitig gespeichert werden (geräteübergreifend) – ja als Vorschlag.
5. Dürfen geteilte Ansichten nur von der Skript-Verwaltung angelegt werden oder von allen?
