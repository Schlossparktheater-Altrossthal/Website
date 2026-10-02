# Lager (`/mitglieder/lager`)

Inventar für Technik, Kostüm, Requisite, Bühnenbau und Werkzeug. Plan und Entscheidungen:
`docs/Plan/inventar-plan.md`, Desktop-Tabellen: `docs/Plan/lager-tabelle-plan.md`.

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

## Komponenten

`src/components/inventory/` – u. a. `qr-scanner.tsx` (BarcodeDetector, sonst jsQR),
`scan-workbench.tsx`, `stocktake-counter.tsx` (Offline-Puffer), `label-designer.tsx`,
`asset-form.tsx`, `spreadsheet-grid.tsx` (Tabelle mit Tastatur, Einfügen aus Excel) und
`bulk-capture.tsx` (Sammelerfassung). Logik in `src/lib/inventory/`, Server-Aktionen in
`src/app/(members)/mitglieder/lager/actions/`.

## Testen

`e2e/lager.spec.ts`, `e2e/lager-tabelle.spec.ts`; Demo-Daten mit `pnpm demo:lager` (siehe `docs/e2e-tests.md`).
