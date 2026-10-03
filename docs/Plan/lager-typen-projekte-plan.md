# Plan: Lager 2 – Artikeltypen, Kategorien mit Feldern, Projekte

Stand: 2026-10-03. Konzept abgestimmt, nichts umgesetzt. Baut auf `docs/Plan/inventar-plan.md` auf.

## Anlass (Feedback)

1. Erfassen-Dialog ist riesig und unübersichtlich, mobil und erst recht am Desktop.
2. Viele gleiche Geräte (z. B. 20 Scheinwerfer gleicher Bauart) mit verschiedenen Lagerorten,
   einzelne defekt – heute ist jedes Objekt ein eigener Datensatz mit eigenen Specs.
3. Projekte anlegen: Event, Kunde, Aufbau/Veranstaltung/Abbau, Ort, Projektleitung.
4. Feinere Typen: „Endstufe“, „Kondensatormikrofon“ mit passenden Feldern.
5. Codes/URLs sind fortlaufend (`/i/T-0042`) und damit von außen durchprobierbar.

Ursache von 1, 2 und 4: Es fehlt die Ebene **Artikeltyp**. Zusatzfelder sind fest im Code
(`AREA_ATTRIBUTE_FIELDS`).

## Entscheidungen (2026-10-03)

- F1: **Keine Migration nötig** – es gibt noch keine relevanten Lagerdaten. Schema wird neu
  geschnitten, bestehende Lagertabellen dürfen verworfen werden.
- F2: **Trennung Typ / Exemplar.** Specs, Fotos, Hersteller, Modell, Kategorie, Prüfpflicht am
  Typ; Ort, Seriennummer, Status, Zustand, Mängel, Prüfungen, Verlauf am Exemplar.
- F3: **Kategorien als Baum je Bereich** mit in der DB definierten Feldern, die an
  Unterkategorien vererbt werden. Werte als JSON am Typ, validiert gegen die Definition.
- F4: **Typen gehören genau einem Bereich** (über ihre Kategorie). Begründung: Code-Präfix,
  Etiketten und Zuständigkeit bleiben eindeutig; Projekte und Ausgaben mischen ohnehin Typen
  aller Bereiche. Bereichsübergreifendes (Strom-/Datenkabel) bekommt eine Kategorie in Technik.
- F5: **Kein Preissystem** (keine Preise, Angebote, Rechnungen, Lieferscheine). Anschaffungs-
  wert am Exemplar bleibt als internes Feld.
- F6: **Eigene Produktionen sind auch Projekte** (optional mit `Show` verknüpft) – ein einziger
  Weg für Reservierung und Ausgabe.
- F7: Kategorien und Felder pflegt, wer das neue Recht **`PRIVATE.INVENTORY.CATALOG`** hat
  (Vergabe wie gewohnt über Rollen/Gewerke).
- F8: **Nicht erratbare Adressen.** Jedes Exemplar, jeder Lagerort, Typ und jedes Projekt hat
  eine zufällige `publicId` (12 Zeichen, Base58, aus `crypto.getRandomValues`, ≈ 70 Bit).
  - QR-Codes enthalten `/i/<publicId>`; alle URLs (intern wie öffentlich) nutzen `publicId`.
  - Der lesbare Code `T-0042` bleibt auf dem Etikett zum Ablesen/Ansagen und für die Suche,
    löst aber **nur mit Login** auf. `/i/T-0042` ohne Login → 404.
  - Scanner akzeptiert beides (QR-URL und eingetippten Code).
  - Öffentliche Seite zusätzlich mit Rate-Limit; Inhalte wie bisher (E4) ohne Preise/Personen.

## Datenmodell (Entwurf)

```
InventoryArea           wie bisher (Präfix, nextNumber, inspectionDefault)
InventoryCategory       id, areaId, parentId?, name, sortOrder          (Baum)
InventoryFieldDef       id, categoryId, key, label, type(text|number|select|boolean),
                        unit?, options Json?, required, sortOrder
InventoryProduct        id, publicId, areaId, categoryId, name, manufacturer?, model?,
                        description?, specs Json, tracking(unit|quantity), unit?,
                        minQuantity?, inspectionRequired, inspectionIntervalMonths?,
                        publicNote?
InventoryProductPhoto   Fotos/Dokumente am Typ
InventoryAsset          id, publicId, code (T-0042), productId, kind(item|container),
                        status, condition, serialNumber?, locationId?, containerId?,
                        acquisitionCost?, purchaseDate?, supplier?, ownership?,
                        internalNote?, lastInspectionAt?, nextInspectionAt?, lastSeenAt?
InventoryStock          Mengen-Typen: productId + locationId|containerId + quantity
Defect/Inspection/Event/Photo  am Exemplar (wie bisher)

InventoryContact        id, name, contactPerson?, email?, phone?, note?
InventoryProject        id, publicId, title, contactId?, venue?, leadUserId?, showId?,
                        status(request|confirmed|done|cancelled), note?
InventoryProjectPhase   projectId, kind(setup|event|teardown|other), label?, startsAt, endsAt
InventoryProjectLine    projectId, productId, quantity, note?        (Bedarf auf Typ-Ebene)
InventoryCheckout       → gehört zu einem Projekt (oder frei für Person); Zeilen = Exemplare
                        bzw. Mengen, Scan prüft gegen Projektpositionen
```

- Feldwerte: `specs` als JSONB mit GIN-Index; Zod-Schema wird zur Laufzeit aus den
  `InventoryFieldDef` des Kategorie-Pfads gebaut.
- Belegungszeitraum eines Projekts = frühester Phasenbeginn bis spätestes Phasenende.
- Verfügbarkeit je Typ und Zeitraum = Exemplare mit Status `available|checked_out` (nicht
  `repair|locked|missing|retired`) minus Positionen überlappender bestätigter Projekte.
  Überbuchung → gelbe Warnung, keine Sperre.

## Oberfläche

- Bestand gruppiert nach Typ: „Source Four 750 · 20 gesamt · 17 verfügbar · 2 Reparatur ·
  1 ausgegeben“; Typ-Detailseite mit Exemplaren nach Ort und Status.
- Erfassen als Wizard: (1) Typ suchen/wählen oder neu (Kategorie → nur deren Felder),
  (2) Anzahl, Ort, Zustand → n Exemplare mit fortlaufenden Codes, (3) optional Seriennummern
  scannen/tabellarisch, Etiketten drucken. Mobil Bottom-Sheet in Schritten, Desktop eigene
  Seite zweispaltig. Sammeltabelle bekommt Typ-Spalte.
- Katalogverwaltung (Recht CATALOG): Kategorienbaum, Felder, vorbefüllte Vorlagen für Ton,
  Licht, Video, Kostüm.
- Projekte: Liste/Zeitleiste, Detail mit Phasen, Bedarf + Verfügbarkeitsampel, Packliste,
  Ausgabe/Rücknahme per Scan.
- Vor dem UI-Konzept: Staging-Screenshots des jetzigen Erfassen-Dialogs mobil + desktop.

## Phasen

1. Schema neu (Typ/Exemplar, Kategorienbaum, Felddefinitionen, publicId), Lagerdaten verwerfen,
   Demo-Seed `pnpm demo:lager` anpassen.
2. publicId durchziehen: Routen, `/i/<publicId>`, Etiketten-QR, Scanner, Rate-Limit.
3. Bestand nach Typ + Typ-Detailseite; Exemplar-Seite verschlanken.
4. Erfassen-Wizard + Sammeltabelle anpassen.
5. Katalogverwaltung + Recht `PRIVATE.INVENTORY.CATALOG` + Vorlagen.
6. Projekte: Kontakte, Phasen, Bedarf, Verfügbarkeit, Show-Verknüpfung.
7. Ausgabe/Packliste an Projekte koppeln.
8. Sets/Bausätze (Funkstrecke = Sender + Empfänger + Antenne) auf Typ-Ebene.
9. E2E (`e2e/lager*.spec.ts`), Staging-Screenshots, Release.

## Checkliste

- [ ] Phase 1 – Schema
- [ ] Phase 2 – publicId
- [ ] Phase 3 – Bestand nach Typ
- [ ] Phase 4 – Erfassen-Wizard
- [ ] Phase 5 – Katalogverwaltung
- [ ] Phase 6 – Projekte
- [ ] Phase 7 – Ausgabe/Packliste
- [ ] Phase 8 – Sets
- [ ] Phase 9 – E2E/Release
