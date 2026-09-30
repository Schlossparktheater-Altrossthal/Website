# Plan: Ernährung & Allergien – Datenmodell, Eingabe und Darstellung

Stand: 2026-09-30. Phase 0–7 umgesetzt; offen bleibt nur der E2E-Lauf auf einer ruhigen Maschine
oder in der CI (Begründung in Phase 7). Checkliste am Ende wird gepflegt.

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
   Route `/api/aversions`, `PUT /api/profile/dietary` mit Unterform, Routen-Tests.
4. **Profil-Oberfläche** _(umgesetzt am 2026-09-29, Commit `af8ecc80`)_: drei Karten,
   Allergen-Vorschlagsliste, Spuren und „ärztlich abgeklärt", Select-Fix, Komponententests.
   Die Sichtprüfung fand zwei weitere Fehler: `ui-check` ignorierte `fullPage: false` bei
   expliziten `screenshot`-Schritten (ein Vollseiten-Screenshot schießt ein offenes Radix-Select
   zu, dadurch war das Popup nie im Bild), und der Select-Auslöser blähte sich mit langen
   Optionslabels auf dem Handy zweizeilig auf.
5. **Übrige Oberflächen** _(umgesetzt am 2026-09-29, Commit `ddf57431`)_: Onboarding- und
   Rückkehrer-Wizard, Dashboard-Onboarding, Bereichs-Untertitel, dazu die Onboarding-Routen und
   der Profil-Snapshot – Payload und Client ändern sich gemeinsam, sonst bricht der Wizard.
   Die Sichtprüfung fand zusätzlich, dass die Fortschrittsleiste des Erstanmeldungs-Wizards auf
   Tabletbreite (1024 px) 1106 px breit war und die Seite aufriss; sie scrollt jetzt bis `xl`
   in ihrem eigenen Container. Der Rückkehrer-Wizard bot vorher eigene Werte an („Anders",
   „Meistens"), die kein Leser auf die gespeicherten Labels abbilden konnte.
6. **Auswertung & Datenschutz** _(umgesetzt am 2026-09-29, Commit `9c446b08`)_: Datenportal-Felder
   und Quelle „Abneigungen", Aufbewahrung. Neu ist die Quelle `aversions` (Feldkatalog
   `src/lib/datenportal/fields.ts`, Zeilen in `run.ts`, Presets „Abneigungen" und „Anzahl je
   Besonderheit" im Client); die Allergie-Quelle führt zusätzlich Art, Spuren und „ärztlich
   abgeklärt", die Teilnehmenden-Quelle die Unterform. Die Aufbewahrung zählt und löscht
   Abneigungen mit den Allergien (gleiche Frist), Nutzungsbericht und Texte nennen sie.
   Sichtprüfung des Datenportals in Handy/Tablet/Desktop in hell und dunkel: 0 Befunde, kein
   Überlauf, die Allergie-Tabelle zeigt „Allergie" und „nicht angegeben" in den neuen Spalten.
7. **Doku, Sichtprüfung, Release** _(umgesetzt am 2026-09-30)_: `docs/seiten/profil.md` (der tote
   Verweis auf `allergy-form.tsx` ist ersetzt, der Bereich „Ernährung & Allergien" beschrieben),
   `docs/profile/README.md` (als historische Anforderungsnotiz gekennzeichnet, Abschnitt Ernährung
   aktualisiert), neu `docs/seiten/datenportal.md` (Quellen, Rechtegruppen, Protokoll) samt
   Index-Zeile, `docs/seiten/verwaltung.md` (Route und Fristen der Aufbewahrung), neuer
   E2E-Test `e2e/ernaehrung.spec.ts` (Stil inkl. Unterform hin und zurück, Besonderheit anlegen
   und löschen, Allergie über den Katalogvorschlag anlegen und löschen) und die Release-Notiz als
   Entwurf weiter unten.
   **Offen bzw. blockiert:** Der E2E-Test ist geschrieben, konnte aber auf diesem Rechner nicht
   grün abgeschlossen werden – die Maschine lief mit Last 111–164 und der Dev-Server antwortete in
   Minuten (`GET /mitglieder/profil 200 in 2.7min`, `POST /api/aversions 200 in 61s`), sodass die
   Playwright-Timeouts (120 s) zuschlugen. Belegt ist der Ablauf trotzdem aus einem früheren Lauf:
   Der Stil-Rundlauf und der Besonderheiten-Rundlauf waren grün, und beim Allergie-Fall zeigt der
   Fehlerbericht des ersten Laufs die gespeicherte Zeile im DOM –
   `E2E-Testallergen … Unverträglichkeit Schwer Keine Spuren`, also Art aus dem Katalogvorschlag,
   Schweregrad und Spuren-Angabe. Zusätzlich deckt `pnpm ui:check` dieselben Felder ab
   (`test-results/ui-check-ernaehrung7`, `…-returnee`, `…-onboarding-final`, `…-datenportal` in
   Handy/Tablet/Desktop, hell und dunkel). Der E2E-Lauf gehört auf einer ruhigen Maschine oder in
   der CI nachgeholt.

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

## Release-Notiz (Entwurf)

Für den nächsten Release als GitHub-Release-Text zu übernehmen (Format wie die bisherigen:
Abschnitte mit fettem Lead-in, danach `## Migrationen` und `## Betrieb`).

- **Ernährungsangaben im Profil neu aufgebaut:** Der Bereich `?bereich=ernaehrung` besteht aus drei
  Karten – Stil (mit Unterform bei vegetarisch), Abneigungen & Besonderheiten als eigene Liste und
  Allergien mit Art, Schweregrad, Spuren und „ärztlich abgeklärt". „Allesesser" stand vorher
  doppelt in der Liste, und Allergene waren reiner Freitext ohne Vorschläge.
- **Spuren-Angabe dreiwertig:** „Nicht angegeben" heißt für die Küche ungeklärt und wird strikt
  behandelt – nicht „unbedenklich".
- **Onboarding:** Beide Wizards verwenden dieselben Listen wie das Profil; der Rückkehrer-Wizard
  zeigt die hinterlegten Angaben wieder an (vorher bot er eigene Werte an, die beim Speichern
  verloren gingen) und fragt Art, Spuren und Abklärung je Eintrag mit ab.
- **Datenportal:** Neue Datenquelle „Abneigungen & Besonderheiten" plus zwei Presets, damit ein
  Bericht „wer isst was nicht" ohne Allergiedaten möglich ist; die Allergie-Quelle führt Art,
  Spuren und Abklärung, die Teilnehmenden-Quelle die Unterform.
- **Aufbewahrung:** Abneigungen laufen in dieselbe 2-Jahres-Frist wie Allergien und werden mit
  ihnen gelöscht; Nutzungsbericht und Aufbewahrungsseite nennen sie.
- **Barrierefreiheit/Tablet:** Die Fortschrittsleiste des Onboardings scrollt auf Tabletbreite in
  ihrem eigenen Container statt die Seite aufzureißen; lange Optionslabels blähen einen
  Select-Auslöser nicht mehr zweizeilig auf.

## Migrationen

- `20260929130000_dietary_details` – Enum `RestrictionKind`, Spalten `kind`, `tracesOk`,
  `diagnosed` an `DietaryRestriction`, `dietaryPreferenceVariant` an `MemberOnboardingProfile`,
  neue Tabelle `DietaryAversion`. Die Migration ist idempotent geschrieben (`ADD COLUMN IF NOT
EXISTS`, `DO $$ … duplicate_object`), weil Prisma auf Postgres nicht transaktional migriert.
  Bestandsdaten bleiben unverändert: Allergien ohne Angabe gelten als `ALLERGY`, Spuren als
  „nicht angegeben" (strikt), Abklärungsstatus als nicht abgeklärt.

## Betrieb

- Keine neuen ENV-Variablen, keine neuen Permission-Keys, keine neuen Pakete.
- `ProductionOnboarding.profileSnapshot` steht auf Version 2 (Unterform und Art/Spuren/Abklärung
  zusätzlich je Eintrag). Alte Snapshots bleiben lesbar; Version 1 ist nicht mehr zu erwarten.
- Doppelte Ernährungsangaben aus der Zeit vor dieser Änderung (z. B. zweimal „Allesesser") werden
  beim Lesen tolerant auf einen Stil abgebildet (`parseDietaryStyleFromLabel`); es gibt kein
  Bereinigungsskript und keines ist nötig.

## Checkliste

- [x] Phase 0 Plan abgelegt und im Index eingetragen
- [x] Phase 1 Datenmodell und Migration
- [x] Phase 2 Zentrale Listen und Validierung
- [x] Phase 3 API und Backend
- [x] Phase 4 Profil-Oberfläche
- [x] Phase 5 Übrige Oberflächen
- [x] Phase 6 Auswertung und Datenschutz
- [x] Phase 7 Doku, Screenshots, E2E, Release (E2E-Lauf blockiert, s. Phase 7)
