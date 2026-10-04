# Datenportal

## Zweck

Selbst gebaute Auswertungen über die Teilnehmenden einer Produktion: Quelle wählen, filtern,
Spalten festlegen, gruppieren und als Datei exportieren – ohne Entwickler und ohne SQL. Alles
läuft nur lesend und nur innerhalb einer Produktion.

## Routen

- `/mitglieder/datenportal` – Report-Builder (Auswahl, Ergebnis, Diagramm, Export)

## Permissions

- `PRIVATE.DATA.PORTAL.VIEW` – Portal öffnen und Basisfelder (Name, Rolle, Funktion, Status …)
- `PRIVATE.DATA.PORTAL.EXPORT` – Excel/CSV/PDF exportieren
- `PRIVATE.DATA.PORTAL.EDUCATION` – Gruppe „Schule & Alter" (Alter, Geburtsdatum, Schule, Klasse)
- `PRIVATE.DATA.PORTAL.HEALTH` – Gruppe „Gesundheit" (Allergien, Unverträglichkeiten, Abneigungen,
  Ernährungsweise)

Die Rechte sind produktionsbezogen und greifen nur bei Mitgliedschaft in der jeweiligen Produktion
(`resolvePortalAccess` in `src/lib/datenportal/access.ts`).

## Datenquellen

| Quelle                        | Zeilen                | Felder                                                                                                                                                                                       |
| ----------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Teilnehmende einer Produktion | eine Zeile je Person  | Name, E-Mail, Rollen, Funktion, Status, Beigetreten am, Fotoerlaubnis · Alter, Geburtsdatum, Geschlecht, Bildungsstand, Schule, Klasse · Hat Allergie, Allergien, Ernährungsweise, Unterform |
| Allergien                     | eine Zeile je Eintrag | Name, Rollen, Allergen, **Art**, Schweregrad, **Spuren**, **Ärztlich abgeklärt**, Symptome, Notfallbehandlung, Notiz                                                                         |
| Abneigungen & Besonderheiten  | eine Zeile je Eintrag | Name, Rollen, Besonderheit, Notiz                                                                                                                                                            |

- Die Quelle „Abneigungen" ist bewusst eigenständig: Ein Bericht „wer isst was nicht" braucht damit
  keine Allergiedaten (Entscheidung E10 in `docs/Plan/ernaehrung-allergien-plan.md`).
- **Art** unterscheidet Allergie, Unverträglichkeit und Sonstiges; **Spuren** liest den
  dreiwertigen Zustand als Text („unproblematisch", „gefährlich", „nicht angegeben"); „nicht
  angegeben" heißt für die Küche ungeklärt und wird strikt behandelt.
- Die Felder stehen ausschließlich in `src/lib/datenportal/fields.ts` (`SOURCE_FIELDS`). Was dort
  nicht gelistet ist, lässt sich weder abfragen noch exportieren – die Rechteprüfung filtert
  zusätzlich über die Gruppe des Feldes.
- Neue Quellen müssen in `DATA_SOURCES` ergänzt werden; die Seite baut die Auswahl selbst daraus
  auf, `dataPortalQuerySchema` prüft sie mit.

## Aufbau

- **Presets** (Teilnehmerliste, Allergien, Abneigungen, Anzahl je Besonderheit, Schüler:innen nach
  Schule, Anzahl je Schule, Allergene im Überblick, Fotoerlaubnisse) setzen Quelle, Spalten und
  Filter in einem Schritt; sie werden nur angeboten, wenn die Quelle für die Person freigeschaltet
  ist (`data-portal-client.tsx`).
- Filteroperatoren richten sich nach dem Feldtyp (`OPERATORS_BY_TYPE`), Gruppierung zeigt die
  Anzahl je Wert als Balken- oder Kreisdiagramm, Sortierung und Spaltenauswahl sind frei.
- „Ausgetretene und deaktivierte Personen einbeziehen" ist standardmäßig aus; anonymisierte Konten
  fallen immer heraus.
- Die Antwort der JSON-Ansicht ist auf 5.000 Zeilen begrenzt und meldet `truncated: true`, wenn
  mehr Zeilen vorliegen; Exporte (CSV/Excel/PDF) sind nicht begrenzt.

## Datenfluss

- Seite: `src/app/(members)/mitglieder/datenportal/page.tsx` und `…/datenportal/data-portal-client.tsx`
- Logik: `src/lib/datenportal/` – `fields.ts` (Katalog, Schema), `access.ts` (Rechte, Protokoll),
  `run.ts` (Zeilen laden, filtern, sortieren, gruppieren), `execute.ts` (Abfrage + Spaltenmeta),
  `csv.ts`/`xlsx.ts` (Export), `src/lib/pdf/engine.ts` (PDF)
- API: `POST /api/datenportal` mit `format: json | csv | xlsx | pdf`; bei `json` 403 ohne
  Ansichtsrecht, bei Datei-Formaten zusätzlich ohne Exportrecht.
- Protokoll: `DataPortalAuditLog` hält Nutzer, Produktion, Aktion, Quelle, Felder und Zeilenzahl
  (keine Ergebniswerte) und räumt beim Schreiben alles Ältere als 12 Monate weg
  (`DATA_PORTAL_AUDIT_RETENTION_MONTHS`).
- Aufbewahrung der Quelldaten: `src/lib/retention.ts` (Ernährung, Allergien und Abneigungen zwei
  Jahre nach Ende der letzten Produktion), siehe [verwaltung.md](verwaltung.md).

## Besonderheiten / Altlasten

- Filter und Sortierung laufen im Speicher über die Zeilen einer Produktion (wenige Hundert), nicht
  über einen Prisma-Compiler. Deshalb wird pro Abfrage die volle Menge geladen; bei deutlich
  größeren Produktionen wäre ein Datenbank-Filter nötig.
- Auch bei leeren Spalten bleibt das Format stabil: `formatValue` in `csv.ts` rendert Datum,
  Wahrheitswerte („ja"/"nein") und Zahlen einheitlich; Zellen werden für Tabellenkalkulation
  maskiert (`=SUM(A1)` bleibt Text).
- Plan und Entscheidungen: `docs/Plan/datenportal-plan.md`.
