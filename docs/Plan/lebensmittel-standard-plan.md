# Plan: Lebensmittel-Standard – Allergene, Ernährungsformen, Lebensmittel, Nährwerte

Stand: 2026-10-04. Phase 1, 2, 4, 5 umgesetzt (Daten und Logik ohne Oberfläche), Teil von Phase 3 (automatische Verknüpfung beim Speichern); offen Oberfläche, Migration, Release. Grundlage für [`docs/Plan/rezepte-plan.md`](rezepte-plan.md) und
[`docs/Plan/verpflegung-plan.md`](verpflegung-plan.md). Checkliste am Ende wird gepflegt.

**Planfamilie:** **Lebensmittel-Standard** · [Rezepte](rezepte-plan.md) · [Phasen & Vorstellungen](produktionsphasen-vorstellungen-plan.md) · [Verpflegung](verpflegung-plan.md) · [Einkauf & Belege](einkauf-belege-plan.md) · [Dienstplan](dienstplan-plan.md) · [Index](README.md)

## Ziel

1. Personen-Angaben (Allergien, Unverträglichkeiten, Ernährungsform) und Lebensmittel nutzen
   **dieselben Codes**. Konflikte werden automatisch erkannt, ohne Handpflege.
2. Die Codes folgen **externen Standards**; eigene Daten sind nur Adapter und Ergänzungen.
3. Nährwerte kommen aus dem **BLS 4.0**, Fertigprodukte aus **Open Food Facts**.
4. Freitext bleibt möglich, wird aber automatisch auf Codes abgebildet oder als „ungeklärt“
   markiert und später nachgezogen.
5. Die bestehenden Daten werden einmalig migriert (eine Instanz, mit KI-Unterstützung).

## Warum die 14 LMIV-Allergene nicht reichen

Die 14 Hauptallergene (VO (EU) 1169/2011, Anhang II) sind die **Kennzeichnungspflicht**, nicht die
Menge aller Probleme. Randfälle, die wir sonst später treffen:

| Bereich                     | Randfall                                                                                                                                                                                                                                   |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Unterarten                  | Schalenfrüchte = Mandel, Haselnuss, Walnuss, Cashew, Pekan, Paranuss, Pistazie, Macadamia; Gluten = Weizen, Roggen, Gerste, Hafer, Dinkel, Kamut; Fisch/Krebstiere/Weichtiere nach Art. Wer nur auf Haselnuss reagiert, darf Mandeln essen |
| Allergie vs. Intoleranz     | Milcheiweißallergie ≠ Laktoseintoleranz (laktosefreie Milch ok); Zöliakie ≠ Weizenallergie ≠ Glutensensitivität                                                                                                                            |
| Nicht in LMIV               | Kiwi, Steinobst/Rosengewächse (Kreuzallergie Birke), Hülsenfrüchte (Erbse, Kichererbse, Linse), Buchweizen, Mais, Nachtschatten, Alpha-Gal (rotes Fleisch), Kokos, Kräuter/Gewürze                                                         |
| Stoffwechsel/Intoleranzen   | Fructose, Sorbit, Histamin, FODMAP, Phenylketonurie (Aspartam), Salicylate                                                                                                                                                                 |
| Medizinisch, keine Allergie | Diabetes, Schluckbeschwerden (Konsistenz), salzarm                                                                                                                                                                                         |
| Ernährungsform/Religion     | vegan, vegetarisch (+Unterform), pescetarisch, halal, koscher, kein Schwein, kein Rind, **kein Alkohol (auch beim Kochen)**                                                                                                                |
| Spuren                      | „kann Spuren enthalten“ ist freiwillig gekennzeichnet → bei `tracesOk = null/false` als Risiko werten                                                                                                                                      |
| Grenzwerte                  | Sulfite erst ab 10 mg/kg kennzeichnungspflichtig; glutenfrei = < 20 mg/kg                                                                                                                                                                  |

**Folgerung:** kein flaches Enum, sondern eine **hierarchische Taxonomie** (Elternknoten
„Schalenfrüchte“ → Kinder „Haselnuss“ …). Eine Person verweist auf einen beliebigen Knoten, ein
Lebensmittel auf die genauesten Knoten; die Prüfung läuft über die Vorfahren-Hülle. Damit sind
„alle Nüsse“ und „nur Haselnuss“ dasselbe Modell.

## Quellen

| Zweck                    | Quelle                                                                               | Lizenz / Folge                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| Pflicht-Allergene        | LMIV Anhang II                                                                       | Flag `lmiv: true` auf den 14 Knoten                                                        |
| Taxonomie (Codes, Baum)  | Open-Food-Facts-Taxonomien `allergens`, `ingredients`, `labels` (`en:hazelnut` …)    | ODbL (Share-Alike) → nur **Codes** als Schlüssel, OFF-Rohdaten in getrennter Cache-Tabelle |
| Nährwerte, Grundzutaten  | BLS 4.0 (Max Rubner-Institut), ~7.140 Lebensmittel, 138 Nährstoffe                   | CC BY 4.0, Namensnennung; Excel-Import, versioniert                                        |
| Fertigprodukte (Barcode) | Open Food Facts API (Allergene, Spuren, Nährwerte, Labels)                           | ODbL, Cache getrennt                                                                       |
| Ernährungsformen         | OFF-Labels (`en:vegan`, `en:halal` …) + eigene Regeln (welche Knoten ausgeschlossen) | eigene Regeln sind klein und im Code                                                       |

## Zielbild

```
FoodTaxon          code (OFF-Code oder eigenes "x:…"), parentCodes[], label_de, kind (allergen|ingredient|diet), lmiv Bool
DietRule           dietCode → ausgeschlossene FoodTaxon-Codes (vegan schließt en:milk, en:egg, … aus)
DietaryRestriction + taxonCode? (null = ungeklärt), Freitext bleibt in allergen/note
MemberDiet         dietCode (+ Unterform, Strenge)                         // statt Label-Strings
FoodItem           id, source (bls|off|custom), sourceId, name, nutrients Json, taxonCodes[], tracesCodes[]
TaxonAlias         text (normalisiert) → taxonCode                          // lernt aus Zuordnungen
NutritionSourceVersion source, version, importedAt
```

- **Adapter** je Quelle (`bls`, `off`), jeder liefert `FoodItem` + `taxonCodes`. BLS liefert keine
  Allergene → Ableitung über BLS-Lebensmittelgruppe + Namensabgleich mit der Taxonomie, Rest als
  Prüfliste. Weitere Quellen (z. B. USDA) = neuer Adapter.
- **Freitext-Auflösung**: Normalisieren → `TaxonAlias` → OFF-Taxonomie-Synonyme → sonst
  `taxonCode = null` mit Hinweis „ungeklärt“. Eine einmal bestätigte Zuordnung wird Alias für alle.
- **Prüffunktion** `conflicts(person, foodItem|recipe)` als eine reine Funktion mit Tests – alle
  späteren Pläne nutzen nur sie.
- Ungeklärte Angaben gelten in der Prüfung als **„manuell prüfen“**, nie als unbedenklich.

## Migration (einmalig, Prod)

Mit KI-Unterstützung: Export aller `DietaryRestriction.allergen`/`DietaryAversion.label`/Stile →
Zuordnungsvorschlag als Tabelle → Sichtung durch den User → Skript schreibt `taxonCode` und Aliase.
Vorher Dump, Probelauf in lokaler Vorschau/Staging.

## Phasen

1. Taxonomie: OFF-Taxonomie importieren (Allergene, Zutaten-Teilbaum, Labels), deutsche Labels,
   LMIV-Flags, eigene Knoten für Fehlendes (Alpha-Gal, FODMAP …).
2. Datenmodell + Prüffunktion mit Tests (Randfälle aus der Tabelle oben als Testfälle).
3. Profil/Onboarding: Eingabe als Suche im Baum + Freitext, Anzeige „ungeklärt“.
4. BLS-Adapter (Import-Skript, Gruppen-Ableitung, Prüfliste).
5. OFF-Adapter (Barcode, Cache, Lizenzhinweis).
6. Migration Bestandsdaten (siehe oben).
7. Doku, E2E, Release.

## Umsetzung (2026-10-04)

- **Code:** `src/lib/food/` – `taxonomy/` (OFF-Parser, eigene Ergänzungen, `TaxonIndex`),
  `conflicts.ts` (die eine Prüffunktion), `bls/` und `off/` (Adapter), `items.ts`,
  `restriction-link.ts`/`restriction-store.ts`. Import: `pnpm food:import` (siehe
  `docs/development.md`, Abschnitt „Lebensmittel-Daten importieren“).
- **Modelle:** `FoodTaxon`, `FoodTaxonAlias`, `FoodItem`, `FoodNutrient`, `FoodDataImport`,
  `DietaryRestriction.taxonCode` (Migration `20261004120000_food_standard_recipes`).
- **Erkenntnisse aus den echten Daten:**
  - OFF führt Hafer ohne Gluten und Milchprodukte ohne Laktose; Tierarten (Schwein, Rind) hängen
    an `en:animal` ohne vegan/vegetarisch → Korrekturen in `custom.ts`.
  - Die OFF-Allergenliste führt Einzelzutaten („Haselnüsse“, „Pistazie“) als Synonym von
    „Schalenfrüchte“ → bei Synonymen gewinnt die genauere Zutat.
  - „laktosefrei“/„glutenfrei“ heben Auslöser nur für die eigene Zutat auf (Rezepte prüfen je
    Zutat).
  - BLS liefert gemessene Laktose, Fruktose, Sorbit, Alkohol → werden als Auslöser genutzt.
- **Stand BLS-Zuordnung:** 7.140 Lebensmittel, davon 962 sicher, 6.144 teilweise (meist Gerichte,
  Prüfung meldet dort „prüfen“), 34 ungeklärt.
- **Bekannte Lücken:** Histamin, Fruktose und Nachtschatten nur über eine Auswahl von
  Lebensmitteln; FODMAP, Phenylalanin, Kreuzallergien, Zusatzstoffe sind „manuell prüfen“.
- **Noch offen für Staging/Prod:** Import per `kubectl exec` oder Job (BLS-ZIP muss ins Pod),
  danach `link-restrictions` (Bericht), Migration der ungeklärten Freitexte gemeinsam mit dem User.
- **Quellenangabe in der Oberfläche** (CC BY/ODbL) ist Pflicht, sobald Daten angezeigt werden.

## Entscheidungen (2026-10-04)

- E1: Freitext bleibt, wird aber so weit wie möglich automatisch verknüpft (Alias-Lernen);
  Datenpflege so gering wie möglich.
- E2: Externe Codes vor eigenen; eigene nur mit Präfix `x:`.

## Checkliste

- [x] Phase 1 Taxonomie (OFF-Import + `custom.ts`)
- [x] Phase 2 Datenmodell + Prüffunktion (`src/lib/food/conflicts.ts`)
- [ ] Phase 3 Profil/Onboarding (Teil: `taxonCode` wird beim Speichern automatisch gesetzt; Suche im Baum in der Oberfläche offen)
- [x] Phase 4 BLS-Adapter
- [x] Phase 5 OFF-Adapter (Barcode → `FoodItem`, Cache 30 Tage; Oberfläche offen)
- [ ] Phase 6 Migration
- [ ] Phase 7 Doku/E2E/Release
