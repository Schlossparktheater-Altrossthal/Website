# Plan: Lager 3 – Kategorien, Merkmal-Ausnahmen, Maße, Tags, Codes mit Unternummer

Stand: 2026-10-05. Phase 1–7 umgesetzt (main), lokal getestet (Unit, Integration, E2E). Auf Staging geprüft (6d9bf763).
Offen: Prod-Release. Baut auf
`docs/Plan/lager-typen-projekte-plan.md` auf (dessen Prod-Release ist ebenfalls offen – beide
können zusammen ausgeliefert werden).

## Anlass (Feedback)

1. Das Kategoriensystem wird als umständlich empfunden.
2. Geerbte Merkmale lassen sich in einer Unterkategorie nicht abwählen.
3. Die Kategorie-Auswahl beim Anlegen eines Typs ist unpraktisch.
4. Maße sollen als `L×B×H` in **einem** Feld eingegeben werden, aber filter- und suchbar sein.
5. Gleiche Sorten (z. B. 20 baugleiche Scheinwerfer) sollen Unternummern bekommen.
6. Querliegende Eigenschaften (Epoche, Farbe, „DMX“) passen nicht in einen Baum → Tags.

## Ist-Zustand (Screenshots Staging 2026-10-05)

- Erfassen › Neuer Artikeltyp: **Bereich** und **Kategorie** sind zwei getrennte `Select`s.
  Die Kategorie-Liste ist flach und alphabetisch nach Pfad („Cases, Instrumente, Kabel, Licht,
  Licht › Dimmer …“), in Technik 24 Einträge – mobil muss man lange scrollen, Suche gibt es
  nicht, Neuanlage nur über die Einstellungen.
- Einstellungen › Kategorien & Merkmale: Baum mit „n Merkmale“ je Knoten; geerbte Merkmale
  sieht man erst beim Aufklappen einer Kategorie nicht als solche, Ausnahmen gibt es nicht.
- Codes: `T-0001` fortlaufend je Bereich und **Exemplar** (`InventoryArea.nextNumber`,
  `formatInventoryCode`). Noch keine Etiketten gedruckt.
- Merkmaltypen: text, number, select, boolean (`src/lib/inventory/specs.ts`). Ein Schlüssel,
  den eine Unterkategorie neu definiert, ersetzt den geerbten bereits heute.

## Entscheidungen (2026-10-05)

- E1: **Vererbung bleibt** der Kern (Merkmal einmal bei „Licht“ anlegen, alle darunter haben
  es). Neu: **Ausnahmen** je Kategorie – ausblenden, Pflicht, Auswahlwerte überschreiben.
- E2: **Kategorie = „was es ist“**, genau eine je Typ. **Höchstens 5 Ebenen**, geprüft beim
  Anlegen und Verschieben.
- E3: **Tags nur am Typ.** Exemplar-Eigenheiten haben eigene Felder (Besitz/Leihgabe, Zustand,
  Mängel, Zusatz, Notiz). Tags am Exemplar wären später ohne Umbau ergänzbar.
- E4: **Codes `Bereich-Typ-Exemplar` ohne führende Nullen**, z. B. `T-42-3`; Mengenartikel
  `T-42`. Keine Obergrenze. Nummern werden nie wiederverwendet.
- E5: **Keine Datenübernahme** – Lagerdaten werden mit dem Lager-2-Release ohnehin geleert;
  Staging-Daten dürfen verworfen werden. Nur die Kategorie-Vorlagen (Seed) werden angepasst.

## Phase 1 – Datenmodell

- `InventoryCategoryFieldOverride (categoryId, fieldDefId, hidden Boolean, required Boolean?,
options String[]?, unit String?)`, `@@unique([categoryId, fieldDefId])`, Cascade.
- `InventoryTag (id, name, color?, createdAt)` mit `@@unique([name])` (case-insensitiv über
  `lower(name)`-Index) und m:n `InventoryProductTag (productId, tagId)`.
- Codes: `InventoryProduct.number Int` (je Bereich eindeutig, `@@unique([areaId, number])`),
  `InventoryProduct.nextUnitNumber Int @default(1)`, `InventoryAsset.unitNumber Int?`.
  `InventoryAsset.code` bleibt als gespeicherter Text (Suche, Etikett), zusätzlich Sortierung
  nach `(areaId, product.number, unitNumber)`.
- `InventoryFieldType` um `dimensions`, `measure`, `multiselect`, `date` erweitern
  (`measure` = Zahl mit umrechenbarer Einheit: Länge, Gewicht, Leistung).
- Migration leert Lagertabellen (wie Lager 2), danach Seed der Bereiche/Kategorien.

## Phase 2 – Codes mit Unternummer

- `allocateProductNumber(areaId)` (atomar über `nextNumber` am Bereich, jetzt pro Typ),
  `allocateUnitCode(productId)` über `nextUnitNumber`.
- `formatInventoryCode(prefix, productNumber, unitNumber?)` → `T-42-3` / `T-42`.
- `parseInventoryCode` tolerant: Groß/Klein, führende Nullen, fehlende Striche
  (`t042-03`, `T42-3`). Scanner, Suche, `/i/<code>` mit Login nutzen den Parser.
- Typwechsel eines Exemplars **gesperrt**, sobald `labelPrintedAt` gesetzt ist; davor wird der
  Code neu vergeben (Hinweis im Dialog).
- Etiketten-Vorlagen auf variable Codelänge prüfen (`label-templates.ts`, `label-pdf.ts`).

## Phase 3 – Merkmal-Ausnahmen

- `effectiveFields()` in `specs.ts`: nach Bereich → Pfad die Overrides anwenden (ausgeblendet
  gilt auch für Unterkategorien, bis eine tiefere Kategorie es wieder einblendet).
- Validierung der Specs nutzt die wirksamen Felder; ausgeblendete Werte werden beim Speichern
  verworfen.
- Katalog-Editor (`catalog-editor.tsx`): je Kategorie Liste „Eigene Merkmale“ + „Geerbt von
  _Licht_“ (ausgegraut, Herkunft), Schalter **„hier nicht verwenden“**, Menü „Pflicht /
  Auswahlwerte anpassen“. Im Baum Anzeige „2 eigene · 3 geerbt · 1 ausgeblendet“.
- Ebenen-Grenze 5 im Editor (Hinzufügen-Knopf ab Ebene 5 aus, Server prüft ebenfalls).

## Phase 4 – Kategorie-Auswahl neu

- Neue Komponente `CategoryPicker`, ersetzt **Bereich- und Kategorie-Select** in
  `product-fields.tsx`: die Kategorie bestimmt den Bereich (E2/F4 aus Lager 2). Bereich nur
  noch als Filter-Chip oben im Picker, vorbelegt mit dem zuletzt genutzten.
- Desktop: Combobox mit Suche über den ganzen Pfad („par“ → „Licht › Scheinwerfer › PAR“),
  Treffer mit hervorgehobenem Teil, lange Pfade in der Mitte gekürzt („Licht › … › PAR“).
- Mobil: Bottom-Sheet (Muster Sperrliste-Tag-Sheet, `DialogContent` mobil) mit Suchfeld oben
  und Drill-down durch die Ebenen, „Zurück“-Brotkrumen; Auswahl einer Ober­kategorie erlaubt.
- Oben „Zuletzt verwendet“ (localStorage, je Person) und **Vorschlag aus dem Namen**: Typen
  mit ähnlichem Namen (trigram/`ILIKE` auf Wortanfänge) → deren häufigste Kategorie.
- Mit `PRIVATE.INVENTORY.CATALOG`: „+ ‚Fresnel‘ unter _Scheinwerfer_ anlegen“ direkt aus der
  Suche.
- Gleicher Picker in Filtern (`asset-filters.tsx`) und Sammelerfassung (`bulk-capture.tsx`).

## Phase 5 – Feste Datentypen

- `dimensions`: ein Eingabefeld, Parser akzeptiert `120x80x40`, `120 × 80 × 40 cm`,
  `1,2m x 80 x 40`, `120*80*40mm`; Standard-Einheit je Merkmal (cm). Gespeichert in `specs`
  als `{ l, w, h }` in **mm** plus Anzeige wie eingegeben normalisiert („120 × 80 × 40 cm“).
  Live-Vorschau unter dem Feld („L 120 · B 80 · H 40 cm“), Fehler bei unklarer Eingabe.
- `measure`: Zahl + Einheit aus einer Familie (Länge mm/cm/m, Gewicht g/kg, Leistung W/kW),
  gespeichert in Basiseinheit, angezeigt in der Merkmal-Einheit.
- `multiselect`, `date` einfach.
- Filter (`asset-filters.tsx`, Bestand-Tabelle): je Achse Bereich von–bis; Sonderfilter
  **„passt in A × B × C“** (beide Seiten sortiert vergleichen, Drehen erlaubt); Gewicht/Länge
  ≤/≥. Umsetzung als JSONB-Ausdrücke in Prisma `$queryRaw` bzw. Filter im Speicher – bei der
  Datenmenge (< 10 000 Typen) ausreichend, optional GIN-Index auf `specs`.
- Freitextsuche findet Maße auch als „120x80“.
- Parser/Umrechnung serverunabhängig in `specs.ts` mit Unit-Tests.

## Phase 6 – Tags

- Eingabe `TagInput` im Typ-Formular: Chips, Vorschläge beim Tippen, neuer Tag per Enter
  (jeder mit `PRIVATE.INVENTORY.USE` darf anlegen; Umbenennen/Zusammenführen/Löschen mit
  `CATALOG` in den Einstellungen).
- Anzeige als Chips in Typ-Ansicht, Liste und Tabelle; Filter „Tags (alle/irgendeiner)“.
- Öffentliche Scan-Seite zeigt keine Tags.

## Phase 7 – Seed, Tests, Release

- Kategorie-Vorlagen überarbeiten: Querliegendes (Farbe, Epoche, LED) aus dem Baum in
  Beispiel-Tags; Maße als `dimensions` bei Cases, Bühnenbau, Requisite.
- `pnpm demo:lager` anpassen (Unternummern, Tags, Maße).
- Unit-Tests: Code-Parser, Maß-Parser, Einheiten, wirksame Felder mit Ausnahmen, Ebenen-Grenze.
- E2E (`lager.spec.ts`, `lager-tabelle.spec.ts`): Picker mobil+desktop, Ausnahme setzen,
  Maße filtern, Tags, Code `T-1-1`.
- Screenshots mobil+desktop auf Staging (Picker-Sheet, Katalog-Editor, Typ-Formular).
- Release zusammen mit Lager 2 (Migration leert Lagerdaten – gewollt).

## Umsetzung und Abweichungen (2026-10-05)

- Migrationen `20261005120000_inventory_codes_tags_overrides` (Schema, Codes neu vergeben statt
  Daten leeren – Typ-/Exemplarnummern in Anlagereihenfolge, Lagerorte `L-7`) und
  `20261005120100_inventory_catalog_templates` (Leistung → Messwert, Epoche/Farbe in Kostüm →
  Tags, Maße in Bühnenbau/Requisite, Gewicht in Technik). Getrennt, weil neue Enum-Werte erst
  nach dem Commit nutzbar sind.
- Ausnahmen beziehen sich auf den Merkmalschlüssel (je Bereich eindeutig) und können
  **ausblenden** und **Pflicht ändern**. Auswahlwerte/Einheit überschreiben ist nicht umgesetzt –
  dafür lieber ein eigenes Merkmal in der Unterkategorie.
- Typwechsel eines Exemplars gibt es in der App nicht – die geplante Sperre nach dem
  Etikettendruck ist damit hinfällig. Der Bereich eines Typs bleibt wie bisher fest.
- Kategorie-Auswahl ist am Desktop wie mobil dasselbe Panel (Dialog bzw. Bottom-Sheet) mit Suche,
  Bereichs-Chips, Durchklicken, „Zuletzt verwendet“ (localStorage) und Vorschlag aus dem Namen
  (erstes Wort zählt doppelt). In Filtern dient sie als Kategorie-Filter.
- Filter in der Bestandsübersicht: Button „Filter“ (Kategorie, Tags, Merkmale von–bis/Auswahl/
  Ja-Nein, „passt in“) und aktive Filter als Chips; Parameter `kategorie`, `tag`, `m.<schlüssel>`,
  `passt`. Datum- und Maß-Merkmale haben keinen eigenen Bereichsfilter, Maße laufen über „passt in“.
- Tags: jeder mit Lagerzugriff legt beim Speichern an; ungenutzte Tags verschwinden automatisch.
  Umbenennen/Zusammenführen in den Einstellungen ist **nicht** umgesetzt (bisher kein Bedarf).
  Die Freitextsuche findet Typen auch über Tags.
- Korrektur-Migration `20261005120200_inventory_template_duplicates`: Vorlagen-Merkmal entfällt,
  wenn es im Bereich schon eines mit derselben Bezeichnung gibt (Staging hatte „Gewicht“).
- Nicht umgesetzt: Tags-Spalte in der Sammelerfassung (Tabelle), Freitextsuche nach Maßen.

## Checkliste

- [x] Phase 1 Datenmodell
- [x] Phase 2 Codes mit Unternummer
- [x] Phase 3 Merkmal-Ausnahmen
- [x] Phase 4 Kategorie-Auswahl
- [x] Phase 5 Maße/Einheiten
- [x] Phase 6 Tags
- [x] Phase 7 Seed, Tests
- [x] Staging: Migrationen, E2E (lager*, lager-kategorien) grün, Screenshots mobil/Desktop
- [ ] Prod-Release (zusammen mit Lager 2)
