# Plan: Endprobenwoche, Vorstellungen, Verpflegung, Einkauf & Dienstplan

Stand: 2026-10-04. **Abgelöst** – aufgeteilt in sechs Einzelpläne:
[Lebensmittel-Standard](lebensmittel-standard-plan.md) ·
[Rezepte](rezepte-plan.md) ·
[Phasen & Vorstellungen](produktionsphasen-vorstellungen-plan.md) ·
[Verpflegung](verpflegung-plan.md) ·
[Einkauf & Belege](einkauf-belege-plan.md) ·
[Dienstplan](dienstplan-plan.md).
Der Inhalt unten ist der ursprüngliche Gesamtentwurf und wird nicht mehr gepflegt.

## Ziel

1. Eine Produktion hat **Phasen** (vor allem die Endprobenwoche) und **Vorstellungen** als echte
   Datensätze, nicht nur als JSON.
2. Allergene, Unverträglichkeiten und Ernährungsformen folgen einem **festen Standard** (Codes),
   nicht Freitext. Nährwerte kommen aus einer **extern gepflegten Datenbank**.
3. Eine **globale Rezeptdatenbank**: anlegen, suchen, bewerten, kommentieren, von Rezeptseiten
   importieren. Allergene und Nährwerte werden aus den Zutaten **berechnet**, nie von Hand gesetzt.
4. **Essensplanung** der Endprobenwoche gehört einem Gewerk (Verpflegung/Küche), mit mehreren
   Optionen pro Mahlzeit und automatischer Prüfung: Jede anwesende Person hat mindestens eine
   Option, die sie essen darf.
5. **Einkaufsliste/Beschaffung** als allgemeiner Baustein (nicht nur Essen: Material, Requisite,
   Getränke), mit Belegen, die in die Finanzplanung fließen.
6. **Dienstplan** (Küche, Abwasch, Einlass, Abendkasse, Garderobe …) für Endprobenwoche und
   Vorstellungen.
7. Vorbereitung für **Reservierungen/Tickets**, **Spenden pro Vorstellung**, einen
   **synchronisierten Zuschauerzähler**, **Vorstellungsbericht**, **Kassensturz**,
   **Notfallkarte**.

## Ist-Stand (Befunde)

| #   | Befund                                                                                                                                                                                    | Stelle                                   |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| 1   | `Show.finalRehearsalWeekStart/End` existieren als zwei Datumsfelder; Vorstellungen stehen in `Show.dates` (JSON)                                                                          | `prisma/schema.prisma` (`Show`)          |
| 2   | `FinalRehearsalDuty` (Datum, Zeit, eine Person) existiert im Schema, wird in `src/` aber nirgends benutzt – Ausgangspunkt für den Dienstplan                                              | `schema.prisma`                          |
| 3   | `DietaryRestriction.allergen` ist `String`; der Katalog aus `docs/Plan/ernaehrung-allergien-plan.md` (`src/data/allergens.ts`) ist nur Vorschlag, Freitext bleibt erlaubt → nicht prüfbar | `schema.prisma`, `src/data/allergens.ts` |
| 4   | Ernährungsstil und Strengegrad sind deutsche Labels in `String?` (Entscheidung E1 im Ernährungsplan)                                                                                      | `MemberOnboardingProfile`                |
| 5   | `Ticket.eventId` ist ein loser String ohne Relation; kein Kontingent, keine Reservierung                                                                                                  | `schema.prisma` (`Ticket`)               |
| 6   | `SyncEvent`/`SyncMutation` (Server-Sequenz, Client-Mutationen, `dedupeKey`, `provisional`) existieren schon für Ticket-Scans – passende Basis für den Zuschauerzähler                     | `schema.prisma`                          |
| 7   | `FinanceEntry` kennt `kind: donation`, Belege (`FinanceAttachment`), Freigabe; Beträge sind `Float`                                                                                       | `schema.prisma`                          |
| 8   | `FinanceBudget` hängt an `showId` + freier `category`; Gewerksbudget ist in `docs/Plan/gewerke-plan.md` Phase 12 geplant                                                                  | `schema.prisma`, `gewerke-plan.md`       |
| 9   | Gewerke haben Bausteine (`DepartmentTemplate.modules`) – Verpflegung und Einkauf können neue Bausteine werden                                                                             | `docs/Plan/gewerke-plan.md`              |

## Standards und externe Quellen

| Zweck                       | Quelle                                                                                             | Lizenz / Folge                                                                                                                                                              |
| --------------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Allergene (Pflicht)         | 14 Hauptallergene nach LMIV (VO (EU) 1169/2011, Anhang II)                                         | Rechtsnorm, fest im Code als Enum/Seed                                                                                                                                      |
| Codes für Allergene/Zutaten | Open-Food-Facts-Taxonomien (`en:gluten`, `en:milk` …)                                              | ODbL: Share-Alike bei öffentlich genutzter Datenbank. Daher nur **Codes als Schlüssel** übernehmen und OFF-Daten in einer getrennten Cache-Tabelle halten, nicht vermischen |
| Nährwerte (Grundzutaten)    | **Bundeslebensmittelschlüssel BLS 4.0** (Max Rubner-Institut, ~7.140 Lebensmittel, 138 Nährstoffe) | CC BY 4.0, kostenlos seit 2025-12-16; Namensnennung in der App                                                                                                              |
| Fertigprodukte (Barcode)    | Open Food Facts API                                                                                | ODbL, wie oben; passt zum Lager-Scanner                                                                                                                                     |
| Rezept-Import               | schema.org/Recipe (JSON-LD) auf Rezeptseiten                                                       | Nur Struktur übernehmen, Texte/Bilder urheberrechtlich prüfen (Quelle verlinken)                                                                                            |

Der BLS ist ein Excel-Download, keine API. Er wird per Skript importiert und versioniert
(`NutritionSource.version`), Updates laufen als Re-Import.

## Zielbild

### Datenmodell (Entwurf)

```
ProductionPhase    id, showId, kind (final_rehearsal_week|…), startsAt, endsAt   // ersetzt finalRehearsalWeek*
Performance        id, showId, startsAt, venue, capacity, status, notes          // ersetzt Show.dates
Ticket             + performanceId (Relation), + status reserved, + holderEmail
AudienceCountEvent über SyncEvent (scope performance), delta +1/−1, deviceId

Allergen           code (LMIV + Zusätze), offTag?, label                         // Stammdaten, Seed
DietStyle          code (vegan, vegetarian, …), excludes Allergen/Kategorien     // Stammdaten
DietaryRestriction allergenCode → Allergen (Pflicht), Freitext nur in note
FoodItem           id, source (bls|off|custom), sourceId, name, nutrients Json, allergenCodes[], dietFlags
Recipe             id, title, servings, steps, sourceUrl, createdById, + RecipeRating, RecipeComment
RecipeIngredient   recipeId, foodItemId (Pflicht), amount, unit, rawText
MealPlan           id, phaseId, departmentId
Meal               id, mealPlanId, date, slot (fruehstueck|mittag|abend|snack)
MealOption         id, mealId, recipeId, plannedServings
MealAttendance     mealId, userId, status (ja|nein|auto)                         // Default aus Terminplanung

PurchaseList       id, showId?, departmentId?, phaseId?, title, status           // allgemein
PurchaseItem       id, listId, foodItemId? | inventoryTypeId? | freeText, qty, unit, estPriceCents,
                   source (meal|manual|inventory), assigneeId, boughtAt
FinanceEntry       + purchaseListId?, + performanceId?, amount → amountCents Int
FinanceBudget      + departmentId?, + phaseId?

Shift              id, showId, phaseId?|performanceId?, role, startsAt, endsAt, slots
ShiftAssignment    shiftId, userId, status                                       // ersetzt FinalRehearsalDuty
PerformanceReport  performanceId, audienceCount, donationsCents, boxOfficeCents, incidents
```

### Regeln

- **Allergene eines Rezepts** = Vereinigung der Allergene seiner Zutaten. Keine manuelle Pflege.
- **Abdeckung**: Für jede Mahlzeit gilt, dass jede Person mit `MealAttendance = ja` mindestens eine
  Option ohne Konflikt hat. Konflikt = Allergen der Person in der Option (bei `tracesOk = null`
  oder `false` auch „kann Spuren enthalten“) oder Ernährungsstil verletzt. Sonst rote Warnung mit
  Grund und Anzahl, ohne Namen.
- **Nährwerte** pro Portion und pro Tag aus BLS-Werten × Menge; fehlende Werte werden als
  „unvollständig“ markiert, nicht als 0.
- **Einkaufsliste** wird aus den MealOptions erzeugt (Portionen × Zutaten, nach Zutat/Einheit
  summiert) und kann manuell um Nicht-Lebensmittel ergänzt werden.
- **Geld** als Cent-Integer.

### Datenschutz (Art. 9 DSGVO)

- Das Küchen-Gewerk sieht **Aggregate** („3× glutenfrei, 1× Erdnuss lebensbedrohlich“).
- Namen nur bei `SEVERE`/`LETHAL` und nur für Leitung der Endprobenwoche/Küchenleitung, mit
  eigenem Recht und Protokoll (wie Datenportal).
- **Notfallkarte**: Name, Allergie, Notfallbehandlung, offline in der PWA, nur für diese Rechte.

### Oberflächen (mobil zuerst)

- Produktion: Reiter „Endprobenwoche“ (Tage, Dienste, Essen) und „Vorstellungen“ (Liste, Bericht,
  Zähler, Reservierungen).
- Gewerk-Bausteine `meals` und `purchasing` im Portal.
- Rezepte global unter `/mitglieder/rezepte`: Suche nach Name/Tag/„ohne Allergen X“, Detail mit
  Allergenen + Nährwerten, Import-Dialog mit Zuordnung jeder Zutatenzeile.
- Einkaufsliste: abhaken mobil, „Beleg hochladen“ erzeugt `FinanceEntry` (Entwurf) mit Anhang.
- Zuschauerzähler: großer +/−-Knopf, offline, Gesamtzahl live über alle Geräte.
- Dienstplan: Schichten mit freien Plätzen, Eintragen selbst oder Zuweisung, Kalender-Abo.

## Phasen

0. **Plan ablegen**: diese Datei + Index-Zeile.
1. **Allergen-/Ernährungs-Standard**: `Allergen`/`DietStyle` als Stammdaten, `allergenCode`
   Pflicht, Stil als Code. Migration: Freitexte per Wörterbuch zuordnen, Rest als Liste;
   Betroffene per Benachrichtigung um Bestätigung bitten. Onboarding/Profil anpassen.
2. **Phasen & Vorstellungen**: `ProductionPhase`, `Performance`, Migration aus
   `finalRehearsalWeek*` und `Show.dates`, `Ticket.performanceId`.
3. **Geld auf Cent**: `amountCents`, `plannedAmountCents`, Migration, Leser/Schreiber.
4. **Lebensmittel-Stammdaten**: BLS-4.0-Import-Skript, `FoodItem`, Allergen-Zuordnung je
   BLS-Lebensmittel (BLS liefert keine Allergene → Zuordnung über Lebensmittelgruppe + manuelle
   Prüfliste), OFF-Barcode-Abfrage mit getrenntem Cache, Quellenangabe.
5. **Rezeptdatenbank**: Rezepte, Zutaten, berechnete Allergene/Nährwerte, Suche, Bewertung,
   Kommentare.
6. **Rezept-Import**: JSON-LD-Parser, Zutatenzeilen-Parser (Menge/Einheit/Name), Zuordnungsdialog.
7. **Dienstplan**: `Shift`/`ShiftAssignment`, `FinalRehearsalDuty` ablösen, ICS-Feed.
8. **Essensplanung**: MealPlan, Optionen, Anwesenheit aus Terminplanung, Abdeckungsprüfung,
   Aggregat-Ansicht, Notfallkarte.
9. **Einkauf & Belege**: PurchaseList/Item allgemein, Erzeugung aus Essensplan, Beleg-Upload →
   FinanceEntry, Budget Soll/Ist (verzahnt mit `gewerke-plan.md` Phase 12).
10. **Vorstellungsabend**: Zuschauerzähler (SyncEvent), Spenden je Vorstellung, Kassensturz mit
    Vier-Augen-Bestätigung, Vorstellungsbericht.
11. **Reservierungen/Tickets** (eigener Plan, wenn es so weit ist).
12. **E2E, Sichtprüfung, Release**.

## Offene Entscheidungen

- E1: Allergen-Freitext ganz verbieten oder nur als `OTHER` mit Pflicht-Prüfung durch Admin?
  Vorschlag: Code Pflicht, Exoten über „Sonstiges“ + Notiz, Abdeckungsprüfung behandelt
  „Sonstiges“ als manuell zu prüfen.
- E2: Wer darf Rezepte global anlegen – alle Mitglieder oder nur mit Recht? Vorschlag: alle,
  Zutaten-Zuordnung ist Pflicht.
- E3: Wie viel Zutatenzuordnung zu BLS ist zumutbar? Vorschlag: Vorschlagsliste mit
  Fuzzy-Suche + gemerkte Zuordnungen (`rawText → foodItemId`).
- E4: Ist die Anwesenheit beim Essen Standard „ja“ an Probentagen oder aktive Anmeldung?
- E5: Name des Gewerks/Bausteins („Verpflegung“?).

## Checkliste

- [x] Phase 0 Plan ablegen
- [ ] Phase 1 Allergen-/Ernährungs-Standard
- [ ] Phase 2 Phasen & Vorstellungen
- [ ] Phase 3 Geld auf Cent
- [ ] Phase 4 Lebensmittel-Stammdaten (BLS/OFF)
- [ ] Phase 5 Rezeptdatenbank
- [ ] Phase 6 Rezept-Import
- [ ] Phase 7 Dienstplan
- [ ] Phase 8 Essensplanung
- [ ] Phase 9 Einkauf & Belege
- [ ] Phase 10 Vorstellungsabend
- [ ] Phase 11 Reservierungen/Tickets
- [ ] Phase 12 E2E/Release
