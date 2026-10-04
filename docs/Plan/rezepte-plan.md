# Plan: Globale Rezeptdatenbank

Stand: 2026-10-04. Datenmodell und Logik von Phase 1, 2 und 4 umgesetzt (ohne Oberfläche); offen Oberflächen, Suche, Release. Setzt [`docs/Plan/lebensmittel-standard-plan.md`](lebensmittel-standard-plan.md) (Phase 1–4) voraus;
wird von [`docs/Plan/verpflegung-plan.md`](verpflegung-plan.md) genutzt.

**Planfamilie:** [Lebensmittel-Standard](lebensmittel-standard-plan.md) · **Rezepte** · [Phasen & Vorstellungen](produktionsphasen-vorstellungen-plan.md) · [Verpflegung](verpflegung-plan.md) · [Einkauf & Belege](einkauf-belege-plan.md) · [Dienstplan](dienstplan-plan.md) · [Index](README.md)

## Ziel

1. Alle Mitglieder können Rezepte anlegen, suchen, bewerten und kommentieren (produktionsübergreifend).
2. Import von Rezeptseiten über schema.org/Recipe (JSON-LD).
3. Allergene, Spuren, Ernährungsformen und Nährwerte werden aus den Zutaten **berechnet**.
4. Zutatenzuordnung automatisch, Nacharbeit nur bei Unklarheit.

## Zielbild

```
Recipe            id, title, description, servings, steps Json, tags[], sourceUrl?, imageId?, createdById, createdAt
RecipeIngredient  recipeId, rawText, amount?, unit?, foodItemId?, taxonCodes[] (berechnet), status (matched|unclear)
RecipeRating      recipeId, userId, stars, @@unique
RecipeComment     recipeId, userId, body
```

- Zutatenzeile → Parser (Menge/Einheit/Name) → `TaxonAlias`/Suche im BLS → Treffer; unsicher =
  `unclear`, Rezept bleibt nutzbar, zeigt aber „Allergene unvollständig“.
- Berechnete Werte werden zwischengespeichert und bei Änderung neu berechnet.
- Suche: Name, Tag, „passt für …“ (Ernährungsform), „ohne …“ (Taxon), Bewertung.
- Skalierung auf Portionen; Einheiten-Umrechnung (g, ml, Stück mit Standardgewicht aus BLS).
- Import: Texte/Bilder nur mit Quellenlink, Bilder nicht kopieren (Urheberrecht).

## Phasen

1. Datenmodell, Anlegen/Bearbeiten, Zutaten-Parser mit Tests.
2. Berechnung Allergene/Nährwerte, Anzeige pro Portion.
3. Suche, Filter, Bewertung, Kommentare.
4. JSON-LD-Import mit Zuordnungsdialog.
5. Doku, E2E, Release.

## Umsetzung (2026-10-04)

- `src/lib/food/recipes/`: `ingredient-line.ts` (Zutatenzeile → Menge/Einheit/Name/Notiz),
  `compute.ts` (Allergene, Spuren, Ernährungsformen, Nährwerte je Portion, Abdeckung),
  `json-ld.ts` (schema.org/Recipe), `safe-fetch.ts` (keine internen Adressen, jede Weiterleitung
  geprüft), `service.ts` (anlegen/ändern mit automatischer Zuordnung, neu auswerten, bewerten,
  kommentieren).
- **Zuordnung Zutat → Lebensmittel:** zuerst eine frühere manuelle Zuordnung gleichen Namens, dann
  Taxon und passendes BLS-Lebensmittel. Ein Lebensmittel wird nur gewählt, wenn alle seine Taxa
  mit der Zutat verwandt sind – sonst bliebe z. B. „Joghurt“ → laktosefreier Joghurt oder
  „Eier“ → Eier-Teigwaren (Gluten). Namensnähe nach deutscher Wortbildung (Grundwort am Ende).
- **Testlauf (30 typische Zutaten):** 26 mit Lebensmittel und Nährwerten, 4 nur mit Taxon
  (rote Linsen, Spaghetti, Sojasoße, Kurkuma – im BLS anders benannt). Schwächen: Zubereitungsform
  nicht immer roh („Paprika gedünstet“); Korrektur von Hand wird gelernt.
- **Restrisiko Import:** DNS-Rebinding zwischen Prüfung und Abruf ist nicht ausgeschlossen
  (nur angemeldete Mitglieder können importieren).

## Entscheidungen (2026-10-04)

- E1: Alle Mitglieder dürfen Rezepte anlegen.

## Checkliste

- [x] Phase 1 Datenmodell/Parser (Oberfläche offen)
- [x] Phase 2 Berechnung (`src/lib/food/recipes/compute.ts`, Ergebnis in `Recipe.computed`)
- [ ] Phase 3 Suche/Bewertung/Kommentare
- [ ] Phase 4 Import (Logik fertig: `json-ld.ts` + `safe-fetch.ts`; Zuordnungsdialog offen)
- [ ] Phase 5 Doku/E2E/Release
