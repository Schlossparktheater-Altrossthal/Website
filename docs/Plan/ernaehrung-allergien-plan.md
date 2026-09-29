# Plan: Ernährung & Allergien – Datenmodell, Eingabe und Darstellung

Stand: 2026-09-29. Entwurf, noch keine Phase umgesetzt. Checkliste am Ende wird gepflegt.

## Ziel

1. Die Auswahlliste der Ernährungsstile passt zur Verpflegung: kuratierte Liste, keine
   Doppeleinträge, Unterform bei vegetarisch, „Individueller Stil" mit Freitext bleibt erhalten.
2. Besonderheiten und Präferenzen („keine Pilze", „bevorzugt vegetarische Alternativen") werden
   erfassbar – als eigene Liste „Abneigungen & Besonderheiten".
3. Allergene werden aus einem Vorschlagskatalog gewählt (14 kennzeichnungspflichtige Allergene
   plus häufige Intoleranzen), Freitext bleibt möglich.
4. Jede Allergie trägt Art (Allergie/Intoleranz/Sonstiges), „Spuren" und „ärztlich abgeklärt".
5. Das aufgeklappte Select im Bereich „Ernährung & Allergien" sitzt richtig (Triggerbreite, kein
   Überdecken der Folgkarte) – auf Handy, Tablet und Desktop.
6. Das offene v0.1-Finding (`POST /api/allergies` ohne Validierung) ist geschlossen.
7. Onboarding-Wizard, Rückkehrer-Wizard und Dashboard-Onboarding nutzen dieselbe Liste und
   dieselben Felder wie das Profil.

## Ist-Stand (Befunde)

| #   | Befund                                                                                                                                                      | Stelle                                                                                                           |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 1   | „Allesesser" steht doppelt in der Auswahlliste (`none` und `omnivore`) – sichtbar im aufgeklappten Select.                                                  | `src/data/dietary-preferences.ts`                                                                                |
| 2   | Stil und Strengegrad liegen als deutsche Labels in `String?`-Spalten, nicht als Code.                                                                       | `prisma/schema.prisma` (`MemberOnboardingProfile`)                                                               |
| 3   | Kein Feld für Besonderheiten oder Abneigungen. Freitext gibt es nur als Ersatz für den Stil (`custom`, ersetzt die Stilangabe) oder als `note` je Allergie. | `sections/nutrition-section.tsx`                                                                                 |
| 4   | Allergene sind reiner Freitext ohne Katalog, nur ein Beispiel im Placeholder.                                                                               | `prisma/schema.prisma` (`DietaryRestriction`), `sections/nutrition-section.tsx`                                  |
| 5   | Ein Allergie-Eintrag kennt nur `allergen`, `level`, `symptoms`, `treatment`, `note` – keine Art, keine Spuren-Angabe, keine Bestätigung.                    | `prisma/schema.prisma` (`DietaryRestriction`)                                                                    |
| 6   | `POST /api/allergies` hat keine zod-Validierung und normalisiert nicht: „Erdnüsse" und „erdnüsse" erzeugen trotz Unique-Constraint zwei Zeilen.             | `src/app/api/allergies/route.ts`                                                                                 |
| 7   | `SelectContent` bindet die Popup-Breite nicht an den Trigger; neun Einträge erscheinen in einem schmalen Popup, das die Karte darunter überdeckt.           | `src/components/ui/select.tsx`                                                                                   |
| 8   | Die Optionslisten sind viermal dupliziert (Datenmodul, Onboarding-Complete, Onboarding-Wizard, Dashboard-Onboarding).                                       | `src/data/dietary-preferences.ts`, `api/onboarding/complete`, `onboarding-wizard.tsx`, `dashboard/onboarding/**` |
| 9   | Eigene Profildaten laufen bewusst über `requireAuth()` (wie Interessen und Profilangaben), nicht über einen Permission-Key.                                 | `src/app/api/profile/interests/route.ts`, `src/app/api/profile/dietary/route.ts`                                 |
| 10  | `cmdk` ist nicht installiert, `@radix-ui/react-popover` schon – eine Vorschlagsliste ist ohne neues Paket baubar.                                           | `package.json`                                                                                                   |
| 11  | `docs/seiten/profil.md` verweist auf `src/components/forms/allergy-form.tsx`; die Datei existiert nicht (der Ordner enthält nur `measurement-form.tsx`).    | `docs/seiten/profil.md`                                                                                          |
| 12  | Kein Test für `sections/nutrition-section.tsx`, keine E2E-Abdeckung für Ernährung/Allergien.                                                                | `src/app/(members)/mitglieder/profil/__tests__/`, `e2e/`                                                         |
| 13  | Der lokale Dev-Server läuft auf Port 3000 – die Prüfung ist lokal möglich.                                                                                  | `.env`, `PORT=3000`                                                                                              |

## Zielbild

### Datenmodell

- Neues Enum `RestrictionKind` mit `ALLERGY`, `INTOLERANCE`, `OTHER`.
- `DietaryRestriction` bekommt `kind` (Default `ALLERGY`), `tracesOk` (nullable) und `diagnosed`
  (Default `false`).
- Neues Modell `DietaryAversion` mit `id`, `userId`, `label`, `note`, `isActive`, `updatedAt` und
  `@@unique([userId, label])`, Relation `User.dietaryAversions`.
- `MemberOnboardingProfile` bekommt `dietaryPreferenceVariant String?` für die vegetarische
  Unterform. Stil und Strengegrad bleiben Labels (Entscheidung E1).
- `ProductionOnboarding.profileSnapshot` (JSON) nimmt die neuen Angaben auf; keine
  Schemaänderung, aber Leser und Schreiber werden angepasst.
- `scripts/gen-datamodel-doc.py`: `DietaryAversion` in die Gruppe „Persönliche Mitgliedsdaten"
  aufnehmen, `docs/datenmodell.md` neu erzeugen und mit Prettier ausrichten.

### Rechte

- Keine neuen Permission-Keys. Eigene Ernährungsdaten bleiben wie Interessen und Profilangaben
  hinter `requireAuth()`.
- Auswertung bleibt an `PRIVATE.DATA.PORTAL.HEALTH` gebunden; die neuen Felder erben die Gruppe
  `health`.

### Zentrale Listen (eine Quelle)

- Stil: Allesesser, Flexitarisch, Vegetarisch, Vegan, Pescetarisch, Halal, Koscher,
  Individueller Stil. `none` entfällt, der Altwert wird weiter gelesen.
- Unterform nur bei vegetarisch: „Mit Ei und Milch (Standard)", „Nur Milch, kein Ei",
  „Nur Ei, keine Milch".
- Strengegrad unverändert (strikt / flexibel / situationsabhängig), nur bei Stil ungleich
  Allesesser sichtbar.
- Allergen-Katalog: Gluten, Krebstiere, Eier, Fisch, Erdnüsse, Soja, Milch/Laktose,
  Schalenfrüchte, Sellerie, Senf, Sesam, Sulfite, Lupinen, Weichtiere – dazu Laktose-,
  Fruktose- und Histamin-Intoleranz, Zöliakie sowie Kategorien wie Kreuzallergie, Medikamente
  und Latex.

### Oberflächen (mobil zuerst)

Bereich `?bereich=ernaehrung` mit drei Karten statt zwei:

1. „Ernährungsstil": Stil, Unterform (nur vegetarisch), Bezeichnung (nur individueller Stil),
   „Wie streng?"; Speichern über `FormSaveBar`.
2. „Abneigungen & Besonderheiten": Liste plus „Besonderheit" öffnet einen Dialog mit Text und
   optionaler Notiz; Bearbeiten und Löschen mit `ConfirmDialog`; Leerzustand „Keine
   Besonderheiten hinterlegt."
3. „Allergien & Unverträglichkeiten": Liste mit zwei Badges je Eintrag (Art, Schweregrad) und
   Detailzeile; Dialog mit Vorschlagsfeld Allergen, Art, Schweregrad, Spuren, „ärztlich
   abgeklärt", Symptome, Notfallhilfe, Notiz.

- Das Allergen-Feld ist eine Vorschlagsliste aus Input und Popover (vorhandenes
  `@radix-ui/react-popover`, kein neues Paket). Auswahl aus dem Katalog belegt die Art vor,
  Freitext bleibt zulässig.
- Spuren hat drei Werte: „Nicht angegeben", „Spuren sind unproblematisch", „Keine Spuren".
  „Nicht angegeben" wird in der Anzeige als „ungeklärt, strikt behandeln" gelesen.
- Der Layout-Fix für Select-Popups liegt global in `src/components/ui/select.tsx` (Popup auf
  Triggerbreite, verfügbare Höhe als `max-h`) und wird deshalb app-weit sichtgeprüft.

### Integration

- Onboarding-Wizard, Rückkehrer-Wizard und Dashboard-Onboarding verwenden dieselben Listen und
  Felder; der Rückkehrer-Wizard bestätigt die neuen Angaben je Eintrag.
- Datenportal: neue Datenquelle „Abneigungen" und zusätzliche Felder in der Allergie-Quelle.
- Aufbewahrung: `dietaryAversions` werden wie Allergien gezählt und mit aufgeräumt.

## Phasen

0. **Plan ablegen**: diese Datei plus Index-Zeile in `docs/Plan/README.md`, committen.
1. **Datenmodell & Migration**: Enum, Spalten, Tabelle, `dietaryPreferenceVariant`, Migration von
   Hand schreiben, `pnpm prisma:generate`, `docs/datenmodell.md`.
2. **Zentrale Listen & Validierung**: `src/data/dietary-preferences.ts`, neu
   `src/data/allergens.ts`, neu `src/lib/profil/dietary-validation.ts`, Unit-Tests.
3. **API & Backend**: Validierung und case-insensitiver Upsert in `POST /api/allergies`, neue
   Route `/api/aversions`, `PUT /api/profile/dietary` mit Unterform, Onboarding-Routen und
   Snapshot, Routen-Tests.
4. **Profil-Oberfläche**: drei Karten, Allergen-Vorschlagsliste, Spuren und „ärztlich
   abgeklärt", Select-Fix, Komponententests.
5. **Übrige Oberflächen**: Onboarding- und Rückkehrer-Wizard, Dashboard-Onboarding,
   Bereichs-Untertitel.
6. **Auswertung & Datenschutz**: Datenportal-Felder und Quelle „Abneigungen", Aufbewahrung.
7. **Doku, Sichtprüfung, Release**: `docs/seiten/profil.md` (inklusive des toten Verweises auf
   `allergy-form.tsx`), `docs/profile/README.md`, Screenshots in Handy/Tablet/Desktop in hell und
   dunkel, E2E-Abdeckung, atomare Commits je Phase.

## Entscheidungen (2026-09-29)

- E1: Stil und Strengegrad bleiben als deutsche Labels gespeichert; die Liste wird zentralisiert
  und beim Lesen tolerant gemappt. Kein Enum-Umbau der Bestandsdaten.
- E2: Kuratierte Stil-Liste statt Import der 29 Formen der Referenzseite.
- E3: Unterform nur bei vegetarisch. Alles Feinere (Rohkost, Low-Carb, keine Pilze) gehört in
  „Abneigungen & Besonderheiten", sonst wird die Maske dreistufig.
- E4: „Allesesser" nur noch einmal; `none` entfällt, der Altwert wird weiter gelesen.
- E5: „Individueller Stil" mit Freitext bleibt erhalten.
- E6: Besonderheiten als eigene Liste (`DietaryAversion`), nicht als Allergie-Eintrag mit
  niedrigem Schweregrad.
- E7: Allergen-Katalog ist Vorschlag, Freitext bleibt zulässig.
- E8: Pro Allergie zusätzlich Art, Spuren und „ärztlich abgeklärt".
- E9: Spuren ist dreiwertig und nullable. „Nicht angegeben" wird als „ungeklärt, strikt
  behandeln" gelesen, statt „Spuren sind ok" anzunehmen.
- E10: Abneigungen bekommen eine eigene Datenquelle im Datenportal, damit ein Bericht „wer isst
  was nicht" ohne Allergiedaten möglich ist.
- E11: Kein neues Permission – eigene Ernährungsdaten bleiben hinter `requireAuth()`;
  Auswertung bleibt `PRIVATE.DATA.PORTAL.HEALTH`.
- E12: Select-Fix global statt Sonderlösung nur im Profil.
- E13: Kein neues Paket; die Vorschlagsliste entsteht aus dem vorhandenen Popover.

Nicht enthalten: Verschlüsselung der Allergiedaten, Änderung der Aufbewahrungsfrist,
produktionsbezogene Ernährungsangaben (die Snapshot-Logik bleibt), die exotischen Formen der
Referenzseite, eine Pflichtauswahl aus dem Katalog.

## Checkliste

- [ ] Phase 0 Plan abgelegt und im Index eingetragen
- [ ] Phase 1 Datenmodell und Migration
- [ ] Phase 2 Zentrale Listen und Validierung
- [ ] Phase 3 API und Backend
- [ ] Phase 4 Profil-Oberfläche
- [ ] Phase 5 Übrige Oberflächen
- [ ] Phase 6 Auswertung und Datenschutz
- [ ] Phase 7 Doku, Screenshots, E2E, Release
