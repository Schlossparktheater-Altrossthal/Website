# Plan: Baustein Verpflegung (Essensplanung)

Stand: 2026-10-04. Konzept. Setzt `docs/Plan/lebensmittel-standard-plan.md`,
`docs/Plan/rezepte-plan.md` und `docs/Plan/produktionsphasen-vorstellungen-plan.md` (Phase 1)
voraus; erzeugt Einkaufslisten über `docs/Plan/einkauf-belege-plan.md`.

## Ziel

1. Neuer Gewerk-Baustein `meals` (`src/lib/departments/modules.ts`); jedes selbst angelegte Gewerk
   kann ihn aktivieren.
2. Essensplan je Produktionsphase: Mahlzeiten mit mehreren Optionen (Rezepte).
3. **Aktive Anmeldung** je Mahlzeit (oder je Tag), mit Wahl der Option.
4. Automatische Abdeckungsprüfung über die Prüffunktion aus dem Lebensmittel-Standard.
5. Nährwerte pro Mahlzeit/Tag; Mengen für die Einkaufsliste.
6. Datenschutz: Küche sieht Summen; Namen nur bei schweren Allergien und mit Recht; Notfallkarte offline.

## Zielbild

```
MealPlan        id, phaseId, departmentId
Meal            id, mealPlanId, date, slot (fruehstueck|mittag|abend|snack), signupDeadline
MealOption      id, mealId, recipeId?, label, plannedServings
MealSignup      mealId, userId, optionId?, status (ja|nein), guests?
```

- Prüfung: je angemeldeter Person „mindestens eine passende Option“, sonst Warnung mit Grund
  (Taxon), „ungeklärt“ gilt als manuell prüfen.
- Portionen = Anmeldungen je Option (+ Puffer) → Einkaufsliste.
- Anmeldung mobil im Dashboard und per Push-Erinnerung vor der Frist.
- Neues Recht für namentliche Gesundheitsdaten (Art. 9 DSGVO) mit Protokoll wie Datenportal.

## Phasen

1. Baustein + Modelle, Planansicht (Woche × Mahlzeit).
2. Anmeldung (Mitglieder), Frist, Erinnerung.
3. Abdeckungsprüfung, Aggregat-Ansicht, Notfallkarte.
4. Nährwerte, Übergabe an Einkaufsliste.
5. Doku, E2E, Release.

## Entscheidungen (2026-10-04)

- E1: Aktive Anmeldung statt automatischer Teilnahme.
- E2: Kein festes Gewerk, nur der Baustein ist entscheidend.

## Checkliste

- [ ] Phase 1 Baustein/Modelle
- [ ] Phase 2 Anmeldung
- [ ] Phase 3 Prüfung/Datenschutz
- [ ] Phase 4 Nährwerte/Einkauf
- [ ] Phase 5 Doku/E2E/Release
