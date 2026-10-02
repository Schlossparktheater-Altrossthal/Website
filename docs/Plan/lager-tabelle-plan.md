# Plan: Tabellen-Workflow im Lager (Desktop)

Stand: 2026-10-02. Konzept, nichts umgesetzt.

## Ziel

Am Desktop große Mengen Objekte schnell erfassen und pflegen – wie in einer Tabellenkalkulation,
nur mit den Regeln des Lagers (Bereiche, Codes, Orte, Prüfpflicht). Mobil bleibt alles wie es ist.

## Befunde (Screenshots Staging, Desktop 1440 px)

| #   | Befund                                                                                           |
| --- | ------------------------------------------------------------------------------------------------ |
| 1   | Erfassen ist das mobile Formular in breit: großes Foto-Feld, ein Objekt pro Durchgang, ~6 Klicks |
| 2   | Bestand ist eine Kartenliste (eine Zeile ≈ 64 px), keine Spalten, keine Sortierung               |
| 3   | Keine Sammelbearbeitung (Ort, Kategorie, Zustand für viele Objekte gleichzeitig)                 |
| 4   | Codes werden erst beim Speichern vergeben – passt gut zu einer Entwurfstabelle                   |
| 5   | TanStack Table ist bereits vorhanden (`src/components/ui/data-table.tsx`)                        |

## Bewertung

Ja, sinnvoll. Bei der Ersterfassung (E1: alles wird neu erfasst) sind es hunderte Objekte;
dort ist eine Tabelle mit Tastatur deutlich schneller als ein Formular. Wichtig ist, sie als
**zusätzlichen Desktop-Modus** zu bauen, nicht als Ersatz: Foto und Etikett bleiben Handy-Arbeit.

## Entscheidungen (Vorschlag, offen)

- T1: Zwei Ansichten im Bestand am Desktop: **Liste** (wie heute) und **Tabelle**; Umschalter
  merkt sich die Wahl (localStorage). Mobil nur Liste.
- T2: Neue Seite **„Sammelerfassung“** (`/mitglieder/lager/neu/tabelle`), erreichbar über
  „Erfassen“ ▸ „Viele auf einmal“ (nur ab `lg`).
- T3: Erfassen pro Runde **in einem Bereich** (Bereich oben fest gewählt). Dadurch sind die
  Spalten eindeutig (Kostüm: Größe/Epoche/Farbe, Technik: Hersteller/Modell/Seriennr.).
- T4: Zeilen sind **Entwürfe im Browser** (localStorage, überlebt Reload), Speichern legt alle
  gültigen Zeilen in einem Rutsch an; Codes erst dann. Fehlerhafte Zeilen bleiben rot stehen.
- T5: Fotos nicht in der Tabelle; danach per Handy („ohne Foto“-Filter + Scannen ▸ Foto).
- T6: Preise/Anschaffung nur als Spalten, wenn `MANAGE`.
- T7: Kein CSV-Import (E1 bleibt), aber **Einfügen aus der Zwischenablage** (mehrere Zeilen aus
  Excel/LibreOffice) – kostet wenig, hilft enorm bei vorhandenen Listen.

## UI-Konzept

### Sammelerfassung

```
[Bereich: T Technik ▾]  Vorgaben: Kategorie [–▾] Ort [L-0003 ▾] Zustand [Gut▾]   12 Entwürfe · 2 Fehler  [Alle speichern]
┌──┬───────────────────────┬──────────┬─────────┬────────┬──────┬───────────────┬────────┬───┐
│ #│ Name *                │ Kategorie│ Art     │ Menge  │Zust. │ Ort           │ Herst. │ … │
├──┼───────────────────────┼──────────┼─────────┼────────┼──────┼───────────────┼────────┼───┤
│ 1│ PAR 64 LED            │ Licht    │ Einzel  │        │ Gut  │ L-0003 Regal A│ Eurolite│   │
│ 2│ Kabel Schuko 5 m      │ Kabel    │ Menge   │ 24 Stk │ Gut  │ L-0003        │        │   │
│ 3│ ▌                     │ (Vorgabe)│         │        │      │ (Vorgabe)     │        │   │
└──┴───────────────────────┴──────────┴─────────┴────────┴──────┴───────────────┴────────┴───┘
 Spalten ▾ (sichtbar: …)                                     Tipp: Enter = neue Zeile, Strg+D = von oben übernehmen
```

- Kompakte Zeilen (32 px), Kopf und erste Spalte bleiben beim Scrollen stehen.
- Neue Zeile übernimmt die **Vorgaben** (Kategorie, Ort, Zustand, Art, Prüfpflicht).
- Tastatur: Tab/Shift+Tab, Pfeiltasten, Enter = nächste Zeile (am Ende neue), Strg+D = Wert
  von oben, Entf = Zelle leeren, Strg+Enter = alle speichern, „×n“ = Zeile n-mal duplizieren
  (z. B. 20 gleiche Scheinwerfer → 20 Einzelstücke mit eigenem Code).
- Auswahlzellen (Kategorie, Ort, Zustand) als Combobox mit Tippsuche; Ort auch per Code-Eingabe
  („L-0003“) oder Hand-Scanner.
- Spaltenauswahl pro Bereich (gemerkt): Standard Name, Kategorie, Art, Menge, Zustand, Ort +
  2–3 Bereichsfelder; Rest zuschaltbar.
- Validierung live pro Zelle (Pflichtfeld, Zahl, Kategorie passt zum Bereich); Fehler-Zähler
  oben, Klick springt zur ersten Fehlerzeile.
- Nach dem Speichern: gespeicherte Zeilen werden grau mit Code (T-0042 …) und Link; Leiste
  „18 angelegt – [Etiketten drucken] [Weiter erfassen] [Entwürfe leeren]“.

### Bestand als Tabelle

- Spalten: Code, Name, Bereich, Kategorie, Ort/Kiste, Menge, Zustand, Status, Prüfung fällig,
  Etikett; sortierbar, Filter wie heute oben.
- **Inline-Bearbeitung** einfacher Felder (Name, Kategorie, Zustand, Bereichsfelder), speichert
  pro Zelle beim Verlassen (optimistisch, Toast nur bei Fehler).
- **Mehrfachauswahl** (Checkbox, Shift-Klick) mit Aktionsleiste: Umlagern, Kategorie/Zustand
  setzen, Etiketten drucken, Prüfung eintragen, CSV, Ausmustern (MANAGE).
- Ort und Menge nicht inline, sondern über die bestehenden Dialoge (Verlauf/Events korrekt).
- Pagination serverseitig (100 je Seite) oder virtuelles Scrollen.

## Technik

- `bulkCreateAssetsAction(rows)` in `actions/assets.ts`: gemeinsame Logik aus
  `createAssetAction` in eine Funktion `createAssetInTx(tx, input, …)` ziehen; Rückgabe pro
  Zeile `{ index, ok, code | error }`. Eine Transaktion je Zeile (ein Fehler blockiert nicht
  alle), max. 200 Zeilen je Aufruf, Codes über `allocateAssetCode`.
- `bulkUpdateAssetsAction(ids, patch)` für Sammelbearbeitung; Umlagern nutzt `placeAsset`
  in Schleife, Events je Objekt.
- `updateAssetFieldAction(id, field, value)` für Inline-Bearbeitung (Whitelist der Felder).
- Grid-Komponente `src/components/inventory/asset-grid.tsx` auf TanStack Table, eigene
  Zellen-Editoren (Text, Zahl, Select/Combobox, Ort). Kein neues schweres Grid-Paket.
- Entwürfe: `useDraftRows(areaId)` mit localStorage (try/catch), Schema via zod wie `assetSchema`.
- Einfügen: `onPaste` auf der Tabelle, TSV parsen, ab aktiver Zelle auffüllen, neue Zeilen anlegen.

## Phasen

1. Server: `createAssetInTx` extrahieren, `bulkCreateAssetsAction` + Tests (Codes fortlaufend,
   Teilfehler, Rechte, Mengenartikel mit Bestand)
2. Grid-Grundgerüst: Zellen-Editoren, Tastaturnavigation, kompakte Darstellung
3. Sammelerfassung-Seite: Bereich + Vorgaben, Entwürfe, Validierung, Speichern, Ergebnisleiste
   mit Etiketten
4. Komfort: Strg+D, Duplizieren ×n, Einfügen aus Zwischenablage, Spaltenauswahl
5. Bestand-Tabelle: Ansicht-Umschalter, Spalten, Sortierung, Pagination
6. Inline-Bearbeitung + Mehrfachauswahl mit Sammelaktionen
7. E2E (`e2e/lager-tabelle.spec.ts`), Screenshots, Staging-Abnahme

## Offen

- Sollen Kisten-Inhalte in der Sammelerfassung direkt „in Kiste X“ angelegt werden (Ort-Spalte
  akzeptiert dann auch Kisten-Codes)? Vorschlag: ja.
- Gemischte Bereiche in einer Runde? Vorschlag: nein (T3), Bereichswechsel = neue Runde.

## Checkliste

- [ ] Phase 1 Server
- [ ] Phase 2 Grid
- [ ] Phase 3 Sammelerfassung
- [ ] Phase 4 Komfort
- [ ] Phase 5 Bestand-Tabelle
- [ ] Phase 6 Inline + Sammelaktionen
- [ ] Phase 7 E2E/Abnahme
