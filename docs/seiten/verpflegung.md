# Verpflegung (Rezepte, Allergie-Zuordnung)

## Zweck

Gemeinsame Rezeptsammlung mit automatisch berechneten Allergenen, Ernährungsformen und
Nährwerten sowie die Pflege von Allergie-Angaben, die das System nicht sicher erkennt.
Grundlage: `docs/Plan/lebensmittel-standard-plan.md`, `docs/Plan/rezepte-plan.md`,
`docs/Plan/ernaehrung-rezepte-ui-plan.md`.

## Routen

- `/mitglieder/rezepte` – Liste mit Suche, Filter vegetarisch/vegan, „ohne Allergen“
- `/mitglieder/rezepte/neu` – Anlegen, Import per Link (schema.org/Recipe)
- `/mitglieder/rezepte/[id]` – Detail: Portionen-Umschalter, Zutaten mit Zuordnung, Allergene,
  Ernährungsformen, Nährwerte je Portion, Bewertung, Kommentare
- `/mitglieder/rezepte/[id]/bearbeiten` – Bearbeiten (Wiki: alle Mitglieder)
- `/mitglieder/rezepte/[id]/verlauf` – frühere Stände, Wiederherstellen
- `/mitglieder/verpflegung/zuordnung` – ungeklärte Allergie-Angaben zuordnen, aufteilen, löschen

## Permissions

- Rezepte: jedes angemeldete Mitglied (Navigation über `PRIVATE.PROFILE.OWN.VIEW`).
- `PRIVATE.FOOD.TAXONOMY.MANAGE` – Allergie-Zuordnung (Gesundheitsdaten, Art. 9 DSGVO). Standard:
  Vorstand; sonst über das Gewerk vergeben, das die Essensplanung macht. Die Liste zeigt nur
  Texte und Anzahlen, keine Namen; jede Änderung wird protokolliert (`createLogger("food.pending")`).

## Komponenten

- `src/components/food/recipes/` – `recipe-list`, `recipe-form`, `recipe-ingredients`
  (Portionen, Zuordnung von Hand), `recipe-feedback` (Sterne, Kommentare),
  `restore-revision-button`
- `src/components/food/taxon-picker.tsx`, `food-data-attribution.tsx` (Quellenangabe, Pflicht)
- `src/components/forms/allergen-field.tsx` – Allergie-Eingabe mit Taxonomie-Suche
  (`/api/food/taxa`)

## Daten

- Logik in `src/lib/food/` (Taxonomie, Prüffunktion `checkFood`, BLS/OFF-Adapter, Rezepte).
- Rezeptänderungen sichern den vorherigen Stand als `RecipeRevision`.
- Von Hand gesetzte Zutatenzuordnungen (`MANUAL`) werden für gleichnamige Zutaten gelernt,
  bestätigte Allergie-Zuordnungen als `FoodTaxonAlias`.
- Demo-Daten: `pnpm demo:rezepte [--email …]`, entfernen mit `--remove`.
