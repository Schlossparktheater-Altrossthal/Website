# Plan: Globale Rezeptdatenbank

Stand: 2026-10-04. Konzept. Setzt `docs/Plan/lebensmittel-standard-plan.md` (Phase 1–4) voraus;
wird von `docs/Plan/verpflegung-plan.md` genutzt.

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

## Entscheidungen (2026-10-04)

- E1: Alle Mitglieder dürfen Rezepte anlegen.

## Checkliste

- [ ] Phase 1 Datenmodell/Parser
- [ ] Phase 2 Berechnung
- [ ] Phase 3 Suche/Bewertung/Kommentare
- [ ] Phase 4 Import
- [ ] Phase 5 Doku/E2E/Release
