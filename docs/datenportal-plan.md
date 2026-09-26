# Datenportal (Report-Builder) – Plan

Stand: 2026-09-26. Status: Phase 1 (MVP) implementiert, lokal committet, noch nicht auf Staging getestet.

Entscheidungen 2026-09-26: Rechte nur für leitende Personen über die Rechteverwaltung, produktionsbezogen
(`PRODUCTION_SCOPED_PERMISSION_KEYS`); Audit-Log 12 Monate (`DATA_PORTAL_AUDIT_RETENTION_MONTHS`, Löschung bei jedem Schreiben).
Abweichung vom Entwurf: Filter/Sortierung laufen im Speicher über die je Produktion geladenen Zeilen (wenige hundert),
statt einen Prisma-Compiler zu bauen. Rechteprüfung und Feld-Whitelist bleiben serverseitig (`src/lib/datenportal/`).
Recht `MANAGE_REPORTS` entfällt bis Phase 3.

## Ziel

Leitende Personen erstellen im Mitgliederbereich Auswertungen wie „Teilnehmer in Produktion X mit Allergien“
oder „Schüler in Produktion X von Schule Y“. Ergebnisse lassen sich direkt auf der Seite als **Tabelle und
Chart** ansehen sowie als **CSV/XLSX** exportieren.

## Entscheidungen

- Zugriff über die bestehende Rechteverwaltung (`src/lib/permissions.ts`), Rechte werden nur an leitende
  Personen vergeben. Keine Sonderlogik nach Rolle im Code.
- Kein freier SQL-Zugriff. Feld-Registry als Whitelist, Abfragen über Prisma.
- Ausgabe: Web-Tabelle, Web-Chart (recharts, bereits vorhanden), CSV, XLSX. PDF optional später (pdfkit vorhanden).
- Neue Abhängigkeit: `exceljs` (nur für XLSX).

## Rechte

| Key                                  | Zweck                                                               |
| ------------------------------------ | ------------------------------------------------------------------- |
| `PRIVATE.DATA.PORTAL.VIEW`           | Datenportal öffnen, Basisfelder (Name, Produktion, Rolle, Funktion) |
| `PRIVATE.DATA.PORTAL.EXPORT`         | CSV/XLSX-Export                                                     |
| `PRIVATE.DATA.PORTAL.EDUCATION`      | Felder Schule/Klasse/Ausbildung, Geburtsdatum/Alter                 |
| `PRIVATE.DATA.PORTAL.HEALTH`         | Allergien, Ernährung (besondere Datenkategorie, DSGVO Art. 9)       |
| `PRIVATE.DATA.PORTAL.MANAGE_REPORTS` | Gespeicherte Ansichten für andere freigeben                         |

Jedes Feld der Registry trägt seinen Rechte-Key. Nicht erlaubte Felder werden serverseitig weder geladen noch
in der UI angeboten (Filter auf ein gesperrtes Feld wird abgelehnt, sonst ließe sich über Filter auf Werte schließen).

## Architektur

```
src/lib/datenportal/
  fields.ts        Registry: key, Label, Typ, Operatoren, Rechte-Key, Prisma-Select, Wert-Mapper
  sources.ts       Datenquellen (Personen je Produktion, Allergien, Fotoerlaubnisse, Größen)
  query-schema.ts  Zod: { source, filters[], columns[], sort, groupBy?, aggregate? }
  compile.ts       Konfiguration -> Prisma-Query (nur Registry-Felder, Rechte geprüft)
  export.ts        Zeilen -> CSV / XLSX (Formel-Injektion escapen: Werte mit = + - @ voranstellen ')
src/app/api/datenportal/query/route.ts    POST, liefert Zeilen + Spaltenmeta (Limit, Paginierung)
src/app/api/datenportal/export/route.ts   POST, streamt Datei, schreibt Audit-Log
src/app/(members)/mitglieder/datenportal/ Seite: Quelle, Filter, Spalten, Tabelle/Chart-Umschalter
```

- Server Components als Standard; der Builder selbst ist ein Client-Component.
- Design-Tokens statt fester Farben (siehe AGENTS.md). Charts nutzen die Theme-Variablen (`--chart-*`).
- Chart-Typen zum Start: Balken (Anzahl je Gruppe), Kreis/Donut. Gruppierung z. B. nach Schule, Allergen, Rolle, Klasse.

## Datenmodell (neu)

- `SavedReport` : id, name, ownerId, config Json, sharedWith (Rollen/AppRoles), createdAt, updatedAt.
- `DataPortalAuditLog`: id, userId, action (query/export), source, configHash, rowCount, createdAt.
  Kein Speichern der Ergebniswerte, nur Metadaten. Aufbewahrung über `retention.ts`.

## Presets (Startumfang)

1. Teilnehmerliste einer Produktion (Name, Rolle, Funktion, Status)
2. Allergien & Unverträglichkeiten einer Produktion (Allergen, Stufe, Symptome, Notfallbehandlung)
3. Schüler nach Schule/Klasse in Produktion X
4. Fotoerlaubnisse einer Produktion (Status)
5. Anzahl Teilnehmer je Schule (Chart)

## Datenschutz

- Standardmäßig ausgeschlossen: `anonymizedAt` gesetzt, `deactivatedAt` gesetzt (per Filter für Berechtigte zuschaltbar, nie anonymisierte).
- Audit-Log für jede Abfrage mit Gesundheits- oder Schulfeldern und jeden Export.
- Exportdialog mit Hinweistext (Zweckbindung, Löschung nach Gebrauch). Keine serverseitig abgelegten Dateien.
- Schule/Allergen sind Freitext: Filter „enthält“ (case-insensitive) plus Autocomplete aus vorhandenen Werten.
- Aktueller Profilstand als Standard; `ProductionOnboarding.profileSnapshot` optional für vergangene Produktionen.

## Phasen

1. **MVP:** Rechte, Registry (20–30 Felder), Query-API, Filter-UI, Tabelle, CSV, Presets 1–4. Tests für Compiler und Rechteprüfung.
2. **Charts & XLSX:** Gruppierung/Aggregation, recharts-Ansicht, XLSX-Export, Preset 5.
3. **Gespeicherte Ansichten:** `SavedReport`, Teilen, Audit-Log-Einsicht.
4. Optional: PDF-Druckansicht, normalisierte Schulliste.

Jede Phase zuerst auf Staging, Prod-Release erst nach Test (Vorgehen wie bei den übrigen Umbauten).

## Offene Punkte

- Sollen leitende Personen nur Produktionen sehen, in denen sie selbst Mitglied/Leitung sind? (Vorschlag: ja, Produktionsscope über `ProductionMembership`, Admins alle.)
- Aufbewahrungsdauer des Audit-Logs.
