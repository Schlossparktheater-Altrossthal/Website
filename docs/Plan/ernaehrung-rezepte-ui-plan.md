# Plan: Oberfläche Ernährung, Allergene & Rezepte

Stand: 2026-10-05. Phase 1–5 umgesetzt und auf Staging sichtgeprüft (mobil/Desktop, hell/dunkel); offen Phase 6 (E2E, Release, Prod-Import und Migration). Baut auf
[`docs/Plan/lebensmittel-standard-plan.md`](lebensmittel-standard-plan.md) und
[`docs/Plan/rezepte-plan.md`](rezepte-plan.md) auf (Datenschicht fertig).

**Planfamilie:** [Lebensmittel-Standard](lebensmittel-standard-plan.md) ·
[Rezepte](rezepte-plan.md) · [Verpflegung](verpflegung-plan.md) · [Index](README.md)

## Ziel

1. Allergien werden über eine Suche in der Taxonomie gewählt; Freitext bleibt möglich und wird als
   „ungeklärt“ sichtbar.
2. Bestehende Sammel-Einträge („Erdnüsse, rote Beete“) werden aufgeteilt.
3. Rezeptdatenbank: Liste, Detail, Anlegen/Bearbeiten, Import per Link, Bewertung, Kommentare.
4. Quellenangabe für Open Food Facts (ODbL) und BLS (CC BY) überall, wo Daten angezeigt werden.

## Ist-Stand (Screenshots Staging 2026-10-05, mobil + Desktop)

| #   | Befund                                                                                                                                          | Stelle                           |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| 1   | Untertitel „Damit die Verpflegung … für alle passt.“ steht doppelt (Bereich und Karte „Ernährungsstil“)                                         | `sections/nutrition-section.tsx` |
| 2   | Navigation meldet „Fehlt: Ernährungsstil“, das Feld zeigt aber „Allesesser“ und eine Speicherleiste „Ungespeicherte Änderungen“ ohne Änderung   | Profil, Bereich Ernährung        |
| 3   | Mobil liegt die Bottom-Leiste über der Karte „Allergien“; der Knopf „+ Allergie“ ist verdeckt                                                   | Profil mobil                     |
| 4   | Allergie-Vorschlagsliste kennt nur ~25 Katalogeinträge; Freitext wird nicht als ungeklärt angezeigt                                             | Allergie-Dialog                  |
| 5   | Echte Daten (13 Einträge): 7 Sammeleinträge in einem Feld, 2 Einträge „Keine“/„Nichts“, Tippfehler („Intolleranz“), „Fructose“ statt „Fruktose“ | Bericht `link-restrictions`      |
| 6   | Es gibt keine Rezeptseite und keinen Navigationseintrag                                                                                         | `members-navigation.ts`          |

## Zielbild

### Allergie-Dialog (Profil, Onboarding, Rückkehrer)

- Ein Suchfeld „Was verträgst du nicht?“ durchsucht die Taxonomie (`TaxonIndex.search`, Allergene
  zuerst, dann Zutaten). Jeder Treffer zeigt den Oberbegriff („Haselnuss · Schalenfrüchte“).
- Bei Oberbegriffen ein Hinweis: „Gilt für alle Schalenfrüchte – nur bestimmte? Dann einzeln
  wählen.“
- Freitext bleibt: „‚Drachenfrucht‘ als eigenen Eintrag speichern“. Ungeklärte Einträge tragen in
  der Liste ein Badge „wird geprüft“ (warning).
- Komma/Semikolon im Text: Vorschlag „3 Einträge anlegen?“ statt eines Sammeleintrags.
- Rest des Dialogs wie bisher (Art, Schweregrad, Spuren, ärztlich abgeklärt, Notfallhilfe).
- Neue API `GET /api/food/taxa?q=` (nur angemeldet), liefert Code, Name, Oberbegriff, Art.

### Pflegeliste für ungeklärte Angaben (Verwaltung)

- Liste aller Einträge ohne Code, gruppiert nach Text, mit Vorschlägen aus `linkRestrictionText`.
- Aktion „zuordnen“ setzt den Code für alle gleichen Texte und legt einen bestätigten Alias an –
  danach erkennt das System den Text automatisch.
- Recht: neues `PRIVATE.FOOD.TAXONOMY.MANAGE` (Gesundheitsdaten, Protokoll wie Datenportal).

### Rezepte `/mitglieder/rezepte`

- **Liste** (Seiten-Muster aus `docs/design-system.md`): Suche, Filter-Chips „vegan“,
  „vegetarisch“, „ohne …“ (Allergen-Auswahl), Sortierung Bewertung/Neu. Zeilen wie „Nächste
  Termine“: Titel, Portionen, Allergen-Kürzel, Sterne, Chevron.
- **Detail:** Kopf mit Portionen-Umschalter (skaliert Mengen), Zutatenliste (ungeklärte Zutaten
  mit Badge), Schritte, Karten „Allergene & Ernährungsformen“ und „Nährwerte je Portion“ (mit
  Abdeckung „für 7 von 10 Zutaten“), Bewertung, Kommentare, Quelle.
- **Anlegen/Bearbeiten:** Zutaten als Textzeilen (eine je Zeile, Einfügen ganzer Listen möglich);
  nach dem Speichern zeigt jede Zeile ihre Zuordnung, ein Tipp öffnet die Lebensmittelsuche
  (manuelle Zuordnung wird gelernt).
- **Import:** „Von Webseite importieren“ → Link → Vorschau → speichern. Bilder werden nicht
  übernommen.
- Mobil: Liste einspaltig, Detail als Seite; Desktop: Detail zweispaltig (Zutaten links,
  Schritte rechts).

### Quellenangabe

- Fußzeile in Rezeptdetail, Allergie-Dialog und Pflegeliste: „Lebensmitteldaten: Open Food Facts
  (ODbL), Bundeslebensmittelschlüssel 4.0 (Max Rubner-Institut, CC BY 4.0)“.

## Phasen

1. Profil-Befunde 1–3 beheben (kleiner UI-Fix).
2. Taxa-API + Allergie-Dialog mit Taxonomie-Suche, Sammeleintrag-Aufteilung, Badge „wird geprüft“.
3. Pflegeliste ungeklärter Angaben + Recht + bestätigte Aliase.
4. Rezeptliste + Detail (lesen, bewerten, kommentieren).
5. Anlegen/Bearbeiten + manuelle Zuordnung + Import.
6. Quellenangabe, Doku `docs/seiten/`, E2E, Screenshots, Release.

## Entscheidungen (2026-10-05)

- E1: Rezepte stehen in einer eigenen Navigationsgruppe „Verpflegung“.
- E2: Alle Mitglieder dürfen alle Rezepte bearbeiten (Wiki) – mit Änderungshistorie
  (`RecipeRevision`: Stand vor jeder Änderung, wer, wann; Wiederherstellen möglich).
- E3: Ungeklärte Angaben pflegt, wer das Recht `PRIVATE.FOOD.TAXONOMY.MANAGE` hat – vergeben
  z. B. über das Gewerk, das die Essensplanung macht (`DepartmentPermission`), sonst Vorstand/Admin.
- E4: Migration wie vorgeschlagen: Sammeltexte aufteilen, Fructose-Einträge auf
  Fruktose-Malabsorption, „Keine“/„Nichts“ löschen. Ablauf über eine geprüfte Zuordnungsdatei mit
  Probelauf (`pnpm food:import migrate-restrictions`).

## Checkliste

- [x] Phase 1 Profil-Befunde
- [x] Phase 2 Allergie-Dialog
- [x] Phase 3 Pflegeliste (`/mitglieder/verpflegung/zuordnung`)
- [x] Phase 4 Rezeptliste + Detail
- [x] Phase 5 Anlegen/Import + Verlauf (`RecipeRevision`)
- [ ] Phase 6 Quellen ✓, Doku ✓ (`docs/seiten/verpflegung.md`), E2E, Release, Prod-Import, Migration
