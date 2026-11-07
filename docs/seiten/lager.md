# Lager (`/mitglieder/lager`)

Inventar für Technik, Kostüm, Requisite, Bühnenbau und Werkzeug. Plan und Entscheidungen:
`docs/Plan/inventar-plan.md`, Desktop-Tabellen: `docs/Plan/lager-tabelle-plan.md`, Katalog und
Merkmale: `docs/Plan/lager-kategorien-plan.md`, `docs/Plan/lager-merkmal-typen-plan.md`.

## Routen

| Route                                        | Inhalt                                                                                                                                                                                                   |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/mitglieder/lager`                          | Bestand: Scannen/Erfassen, Kennzahlen, Suche, Filter (`?q`, `?bereich`, `?ort`, `?ansicht`); Desktop auch als Tabelle (`?darstellung=tabelle`, `?sortierung=`) mit Inline-Bearbeitung und Sammelaktionen |
| `/mitglieder/lager/neu`                      | Erfassen (`?bereich`, `?ort`, `?kiste` belegen vor)                                                                                                                                                      |
| `/mitglieder/lager/neu/tabelle`              | Sammelerfassung als Tabelle (ab `lg`, Entwürfe im Browserspeicher)                                                                                                                                       |
| `/mitglieder/lager/objekt/[code]`            | Detail mit Schnellaktionen, Mängeln, Prüfungen, Verlauf                                                                                                                                                  |
| `/mitglieder/lager/objekt/[code]/bearbeiten` | Bearbeiten                                                                                                                                                                                               |
| `/mitglieder/lager/scannen`                  | Scanner (`?modus=info                                                                                                                                                                                    | einlagern | ausgeben | zurueck | pruefen`, `?ziel`, `?ausgabe`) |
| `/mitglieder/lager/ausgaben[/id]`            | Ausgaben und Packliste                                                                                                                                                                                   |
| `/mitglieder/lager/inventur[/id]`            | Inventur zählen (`?ansicht=abgleich` für den Abgleich)                                                                                                                                                   |
| `/mitglieder/lager/pruefungen`               | Elektroprüfungen (DGUV V3)                                                                                                                                                                               |
| `/mitglieder/lager/orte[/code]`              | Lagerorte als Baum                                                                                                                                                                                       |
| `/mitglieder/lager/etiketten`                | Etiketten für A4-Bögen (`?codes=`, `?quelle=orte`)                                                                                                                                                       |
| `/mitglieder/lager/einstellungen`            | Bereiche und Kategorien (nur Verwaltung)                                                                                                                                                                 |
| `/i/[code]`                                  | Öffentliche Scan-Seite, Ziel der QR-Codes                                                                                                                                                                |

APIs: `/api/lager/photos/[id]`, `/api/lager/labels` (PDF), `/api/lager/inspections/[id]/document`,
`/api/lager/export` (CSV, nur Verwaltung).

## Rechte

- `PRIVATE.INVENTORY.USE` – Lager nutzen: suchen, scannen, erfassen, bearbeiten, umlagern, ausgeben,
  Mängel, Prüfungen, Inventur mitzählen, Etiketten.
- `PRIVATE.INVENTORY.MANAGE` – zusätzlich Bereiche, Orte, Preise, Ausmustern, CSV, Inventur
  starten und abschließen. Bekommt die monatliche Prüf-Erinnerung und Mangel-Meldungen.

## Merkmale (Specs)

Merkmale hängen am Bereich und am Kategorienpfad (werden vererbt, Ausnahmen je Kategorie) und
stehen als JSON in `InventoryProduct.specs`. Gepflegt werden sie unter
`/mitglieder/lager/einstellungen`; Typen und Parser liegen in `src/lib/inventory/specs.ts`.

| Typ                     | Inhalt                            | Wert in `specs`                                              |
| ----------------------- | --------------------------------- | ------------------------------------------------------------ |
| `text`, `note`          | Text, ein- bzw. mehrzeilig        | `string`                                                     |
| `number`                | Zahl ohne Umrechnung              | `number`                                                     |
| `measure`               | Zahl mit umrechenbarer Einheit    | `number` (Basiseinheit)                                      |
| `range`                 | Zahlbereich von–bis               | `{ from, to }` (eine Seite darf `null`)                      |
| `scale`                 | Bewertung 1–5                     | `number`                                                     |
| `dimensions`            | Maße L × B × H                    | `{ l, w, h, min, mid, max }` (mm)                            |
| `select`, `multiselect` | feste Auswahl, einfach/mehrfach   | `string` bzw. `string[]`                                     |
| `combo`                 | Auswahl mit Freitext              | `string`                                                     |
| `boolean`               | Ja/Nein                           | `true`                                                       |
| `date`, `daterange`     | Datum bzw. Zeitraum von–bis (ISO) | `string` bzw. `{ from, to }`                                 |
| `color`                 | Farbe                             | `#rrggbb`                                                    |
| `url`                   | Link                              | `string`                                                     |
| `file`                  | Datei-Anhang                      | `{ id, name, mime, size }` (Bytes in `InventoryProductFile`) |

Im Bestand filtert `m.<schlüssel>` je Merkmal (Zahl/Messwert/Bewertung von–bis, Bereich
überlappend, Auswahl/Text gleich bzw. enthält, Ja/Nein); Maße laufen über `passt`, Dateien und
Zeiträume sind nicht filterbar. In der Sammelerfassung stehen die Merkmale als Textspalten,
Bereich/Zeitraum als `von~bis`. Datei-Merkmale werden am angelegten Typ hochgeladen
(`/api/lager/products/[publicId]/spec-files/[schlüssel]`, Download/Entfernen über
`/api/lager/spec-files/[id]`).

## Komponenten

`src/components/inventory/` – u. a. `qr-scanner.tsx` (BarcodeDetector, sonst jsQR),
`scan-workbench.tsx`, `stocktake-counter.tsx` (Offline-Puffer), `label-designer.tsx`,
`product-form.tsx`/`exemplar-form.tsx` (Produkt bzw. Exemplar anlegen/bearbeiten),
`spreadsheet-grid.tsx` (Tabelle mit Tastatur, Einfügen aus Excel) und
`bulk-capture.tsx` (Sammelerfassung). Logik in `src/lib/inventory/`, Server-Aktionen in
`src/app/(members)/mitglieder/lager/actions/`.

## Testen

`e2e/lager.spec.ts`, `e2e/lager-tabelle.spec.ts`; Demo-Daten mit `pnpm demo:lager` (siehe `docs/e2e-tests.md`).
