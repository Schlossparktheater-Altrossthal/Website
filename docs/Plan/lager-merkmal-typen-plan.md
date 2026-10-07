# Plan: Lager – Merkmalstyp „Bereich“ (von–bis) und weitere Typen

Stand: 2026-10-07. Umgesetzt (Phase 1, Phase 2 außer „Anhang/Datei“, Doku und Tests). Auf Staging
noch nicht geprüft; Release offen. Checkliste am Ende wird gepflegt.
Baut auf `docs/Plan/lager-kategorien-plan.md` auf – dort sind in Phase 5 „Feste Datentypen“
`measure`, `dimensions`, `multiselect` und `date` bereits umgesetzt.

## Anlass (Feedback)

1. Merkmale im Lager kennen unter anderem „Zahl“ und „Auswahl“.
2. Für Werte mit Spielraum fehlt ein Typ „von–bis“ (z. B. Zoom 4–16, Leistung 500–750 W).
3. Zusätzlich gefragt: welche weiteren Merkmalstypen sinnvoll wären.

## Ist-Stand (Befunde)

| #   | Befund                                                                                                                                                                                               | Stelle                                                                             |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 1   | Merkmalstypen stehen als feste String-Union im Code; das Prisma-Enum ist die zweite Quelle. Heute acht Werte: `text`, `number`, `measure`, `dimensions`, `select`, `multiselect`, `boolean`, `date`. | `src/lib/inventory/specs.ts:7`, `prisma/schema.prisma` (`enum InventoryFieldType`) |
| 2   | `date`, `multiselect`, `dimensions`, `measure` sind bereits umgesetzt (Lager 3, Phase 5) – es fehlt nur „von–bis“.                                                                                   | `src/lib/inventory/specs.ts:62`, `docs/Plan/lager-kategorien-plan.md` (Phase 5)    |
| 3   | Merkmalswerte liegen als freies JSON; Objektwerte sind schon möglich (`DimensionsValue`). „Bereich“ braucht damit keine neue Spalte.                                                                 | `src/lib/inventory/specs.ts:52`, `src/lib/inventory/specs.ts:411` (`readSpecs`)    |
| 4   | Neue Enum-Werte kommen per `ALTER TYPE … ADD VALUE` in einer **eigenen** Migration („neue Enum-Werte erst nach dem Commit nutzbar“).                                                                 | `prisma/migrations/20261005120000_inventory_codes_tags_overrides/migration.sql:13` |
| 5   | „von–bis“ gibt es bisher nur als **Filter** für Zahl/Messwert (Transport `from~to`), nicht als Merkmalstyp.                                                                                          | `src/components/inventory/asset-filters.tsx:346`                                   |
| 6   | Je Typ ein eigenes Eingabefeld in `SpecField` (Schalter, Datum, Maß, Mehrfach-Chips, Auswahl, Text).                                                                                                 | `src/components/inventory/product-fields.tsx:298`                                  |
| 7   | Der Katalog-Editor zeigt „Einheit“ nur bei `measure`/`dimensions` und „Beispiel“ nur bei einzelnen Typen.                                                                                            | `src/components/inventory/catalog-editor.tsx:577`, `…:613`                         |
| 8   | Der Server prüft den Typ über `z.enum(FIELD_TYPES)`.                                                                                                                                                 | `src/app/(members)/mitglieder/lager/actions/catalog.ts:153`                        |
| 9   | Die Sammelerfassung speichert Merkmale als Text (`Record<string, string>`), ein „von–bis“-Wert passt als `from~to` hinein.                                                                           | `src/lib/inventory/bulk-grid.ts:524`                                               |

## Zielbild

### Datenmodell

- Neuer Wert `range` im Enum `InventoryFieldType` (`src/lib/inventory/specs.ts` + Prisma-Schema).
- `RangeValue = { from: number | null; to: number | null }`; **einseitig** erlaubt (nur „ab“
  oder nur „bis“), die fehlende Seite ist `null`.
- `SpecValue` um `RangeValue` erweitern; dazu `parseRange`, Prüfer `isRange` und `formatRange`
  analog zu `parseDimensions`/`dimensionsValue`/`formatDimensions`.
- Einheit in v1 nur als **Beschriftung** (wie bei `number`, keine Umrechnung). Eine
  `measure`-artige Variante mit umrechenbarer Einheit bleibt als spätere Option offen.

### Oberflächen (mobil zuerst)

- **Katalog-Editor:** „Bereich (von–bis)“ erscheint automatisch im Typ-Dropdown; Einheitenfeld
  wie bei „Zahl“; Beispiel-Platzhalter „z. B. 4–16“.
- **Typ-Formular (`SpecField`):** zwei Felder „von“ und „bis“ mit „–“ dazwischen (Muster wie im
  Filter), Transport im Formularstate als `from~to`.
- **Anzeige:** „4 – 16 W“; bei einseitig „ab 4 W“ beziehungsweise „bis 16 W“.
- **Filter:** ein Merkmal vom Typ Bereich filtert „überlappt [a, b]“ (Entscheidung E3).

## Entscheidungen (2026-10-05)

- E1: Der Wert wird als Objekt `{ min, max }` gespeichert, nicht als Text – dadurch später
  filter- und sortierbar (wie `dimensions`).
- E2: Die Einheit ist in v1 nur eine Beschriftung (keine Umrechnung). Das hält den Typ einfach;
  umrechenbare Einheiten gibt es bereits über `measure`.
- E3: Im Formular wird der Wert als `from~to` transportiert (gleiche Konvention wie Filter und
  Sammelerfassung). Einseitige Angaben sind erlaubt.
- E4: Weitere Typen (Phase 2) entstehen nur bei konkretem Bedarf, nicht auf Vorrat.

## Phasen

### Phase 1 – Merkmalstyp „Bereich“ (von–bis)

- `src/lib/inventory/specs.ts`: `FIELD_TYPES` und `FIELD_TYPE_LABELS` um `range` erweitern,
  `RangeValue` definieren, `SpecValue` ergänzen, `isRange`/`parseRange`/`formatRange` anlegen,
  `case "range"` in `parseSpecs`, außerdem `readSpecs`, `formatSpecValue` und `specToInput`.
- Migration `prisma/migrations/<neu>_inventory_field_range/migration.sql` mit
  `ALTER TYPE "InventoryFieldType" ADD VALUE 'range';` als eigene Datei; danach
  `pnpm prisma:generate`.
- `src/components/inventory/catalog-editor.tsx`: Einheitenfeld auch bei `range` zeigen.
- `src/components/inventory/product-fields.tsx`: `SpecField`-Zweig mit zwei Eingaben (von/bis).
- `src/components/inventory/asset-filters.tsx`: `range`-Zweig (Überlappung `[a, b]`).
- Unit-Tests in `src/lib/inventory/__tests__/specs.test.ts` (Parsen, einseitig, `min > max`,
  Formatierung).

### Phase 2 – Weitere Typen (Backlog, nur bei Bedarf)

Nach Nutzen fürs Lager sortiert; jeder Typ läuft durch dieselben Stellen wie Phase 1:

- **Link/URL** – Datenblatt oder Herstellerseite.
- **Zustand/Bewertung (Skala 1–5)** – Zustandsnote statt Freitext.
- **Mehrzeiliger Text/Notiz** – heute einzeilig und auf 200 Zeichen gekürzt.
- **Farbe (Farbwert mit Vorschau)** – Gewand, Schminke, Material.
- **Anhang/Datei** – Datenblatt als PDF.
- **Auswahl mit Freitext** – Vorschläge plus eigener Wert.
- **Datums-Zeitraum** – von–bis Datum als Gegenstück zu „Bereich“.

### Phase 3 – Doku, Tests, Release

- `docs/seiten/lager.md` um die Merkmalstypen ergänzen.
- Prüfstufen nach `AGENTS.md`: `lint`, `format:check`, `test`, `build`, Screenshots mobil/Desktop.
- Abnahme auf Staging, Release zusammen mit Lager 2 und 3.

## Umsetzung und Abweichungen (2026-10-07)

- **`range`** ist als Objekt `{ from, to }` umgesetzt (nicht `{ min, max }` – E1 korrigiert).
  Passt zur Konvention „von–bis“ und erlaubt einseitige Werte direkt. Akzeptiert beim Lesen auch
  den Text `4~16` (Formular, Filter, Sammelerfassung).
- **Zusätzliche Typen** umgesetzt: `scale` (1–5), `color`, `url`, `note`, `combo`, `daterange`.
  `measure`, `dimensions`, `multiselect` und `date` gab es bereits (Lager 3).
- **Migration** `prisma/migrations/20261007120000_inventory_spec_types/migration.sql` hängt die
  neuen Enum-Werte per `ALTER TYPE … ADD VALUE` an – als eigene Migration, weil neue Enum-Werte
  erst nach dem Commit nutzbar sind.
- **Filter:** `range` filtert Überlappung über die Grenzen `from`/`to`. Einseitig gespeicherte
  Bereiche werden über die jeweils vorhandene Grenze erfasst; das offene Gegenstück bleibt dabei
  unberücksichtigt (bei der Datenmenge unkritisch). `daterange` ist bewusst nicht filterbar (wie
  `date`); `scale` filtert wie eine Zahl von–bis.
- **Anzeige:** neues `SpecValueDisplay` zeigt `color` als Farbfeld, `url` als Verweis; dafür liefert
  `describeSpecs` jetzt auch den `type`. Eingebunden in Typ-, Objekt- und öffentlicher Scan-Seite.
- **Katalog-Editor:** „Auswahlwerte“ auch bei `combo` (als Vorschläge), Einheit auch bei `range`;
  Beispiel-Platzhalter über `hasPlaceholder` gesteuert.
- **Nicht umgesetzt** (bewusste Abgrenzung auf Wunsch): Typ „Anhang/Datei“.
- **Prüfstufen:** `lint` (nur die vorbestehende `treeitem`-Warnung), `typecheck`, `test` – die 6
  Fehler in `nutrition-section.test.tsx` sind vorbestehend und ohne Bezug zum Lager. `build` lief
  (siehe Commit).

## Checkliste

- [x] Phase 1 Typ „Bereich“ (von–bis)
- [x] Phase 2 weitere Typen – Link, Bewertung, mehrzeiliger Text, Farbe, Auswahl mit Freitext,
      Datums-Zeitraum (Anhang/Datei bewusst offen)
- [x] Phase 3 Doku (`docs/seiten/lager.md`) und Unit-Tests
- [ ] Screenshots mobil/Desktop, Staging-Abnahme und Release zusammen mit Lager 2 und 3
