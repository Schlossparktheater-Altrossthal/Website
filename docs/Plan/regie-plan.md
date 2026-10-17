# Regie-Zugang & Regie-Dashboard – Plan (2026-10-17)

Stand: Phase 1, 3, 4, 5 umgesetzt (2026-10-17), offen Phase 2, 6, 7.

Ziel: Die Regie (wenig technikaffin, möchte keine persönlichen Daten angeben) bekommt einen
einfachen Zugang und **ein eigenes, auf sie zugeschnittenes Dashboard** statt des normalen Menüs.
Alles ist lesend, mit einer Ausnahme: **Wünsche an die Planung**. Die Regie gibt bei uns
weitgehend den Fahrplan für die Planer vor, deshalb ist dieser Teil der wichtigste.

## Entscheidungen (Nutzer 2026-10-17)

- **Eigener Authentik-Account für die Person**, nicht pro Produktion: Später kann eine Nextcloud
  dazukommen, und dieselbe Regie kann die nächste Produktion wieder übernehmen. Die Regie-Rolle
  wird **pro Produktion** zugeordnet. Endet die Zusammenarbeit, wird der Account deaktiviert.
- **Keine persönlichen Daten nötig:** Pseudonymer Anzeigename, E-Mail höchstens als Theater-Adresse
  (Mailu-Weiterleitung), Profilpflichtfelder für diesen Account nicht erzwingen.
- **Anmeldung ohne Passwort:**
  1. **Passkey** (Fingerabdruck/Gesicht) als Hauptweg, **mehrere Passkeys** pro Account erlaubt
     (Handy + Laptop). Die Abläufe gibt es seit 2026-10-16 (`authentik-mfa-profil`).
  2. **Anmelde-Link per Messenger** als Ersatzweg, wenn kein Passkey da ist: Ein Admin erzeugt in
     Authentik einen Einmal-Link (Wiederherstellungs-/Anmelde-Link, ohne E-Mail) und schickt ihn
     per Messenger. Darüber wird auch der erste Passkey eingerichtet.
  3. Lange Sitzung für diese Accounts („angemeldet bleiben“), damit sie sich selten anmelden muss.
  - Optional später: Magic Link per E-Mail über einen eigenen Flow mit E-Mail-Stufe (Authentik
    2025.4 kann das). Er braucht aber eine E-Mail-Adresse und ist deshalb zurückgestellt.
- **Dashboard statt Menü:** keine Sidebar, keine Bottom-Leiste, nur Karten. Jede Karte zeigt eine
  kurze Zusammenfassung und zwei Aktionen: **Ansehen** (Online-Ansicht, nur lesend) und **PDF**.
- **Handy zuerst** (intuitiv, kompakt, übersichtlich), Laptop gleichwertig: auf dem Handy eine
  Spalte mit großen Schaltflächen, auf dem Laptop ein Raster. PDFs öffnen auf dem Handy direkt.
- **Probenmappe:** ein Button, der die wichtigen Listen als **ein** PDF erzeugt.
- **Keine Kontaktliste.** Keine Listen per Mail (vorerst).
- **Stand-Angabe:** steht in den PDF-Vorlagen bereits; bei neuen Vorlagen und in der Probenmappe
  mit prüfen.
- **Nur lesend**, außer den Wünschen an die Planung.
- **Recht auch für das Gewerk Regieassistenz:** gleiche Sicht, gleiche Wunsch-Funktion.
- Datenschutz: keine Sperrgründe (nur Planer), keine Körpermaße, keine Kontaktdaten. PDFs mit
  INTERN-Hinweis.

## Karten (Reihenfolge = Wichtigkeit)

1. **Wünsche an die Planung**: neuer Wunsch + Liste eigener Wünsche mit Status.
2. **Nächste Proben**: nächste 3 Termine mit Szenen und Anwesenden → PDF Ablaufplan/Terminliste.
3. **Probenmappe**: Sammel-PDF.
4. **Szenen × Personen**: wer in welcher Szene, probbare Szenen → Matrix-PDF.
5. **Verfügbarkeit**: wer wann fehlt, **ohne Gründe** → Sperrliste-PDF (wichtige Tage).
6. **Besetzung**: Rollen → Personen, unbesetzte markiert → Besetzungs-PDF (`production-casting`).
7. **Probenprotokolle**: letzte Proben, offene Notizen.
8. **Ausstattung**: Requisiten/Kostüm je Szene, offene Punkte → `requisiten-ablauf`.
9. **Skript**: aktuelle Fassung → Skript-PDF.

Auf jeder Karte ein kleiner Hinweis **„neu seit letztem Besuch“**.

## Wünsche an die Planung

- Ein Wunsch ist Freitext + optional **Bezug**: Szene(n), Termin, Zeitraum/Datum, Person(en).
  Beispiel: „Szene 4+5 vor dem 12.6. durchlaufen“.
- Status: **offen → eingeplant → erledigt**, oder **abgelehnt mit Grund**. Regieteam und Planung
  antworten im Verlauf des Wunsches (siehe Nachtrag).
- Die Planung bekommt eine Benachrichtigung (Glocke/Push); die Regie bei Statuswechsel.
- In der Terminplanung bzw. beim Anlegen einer Probe: Hinweis **„offene Regie-Wünsche“** mit
  passendem Bezug (Szene/Zeitraum); ein Wunsch lässt sich mit einem Termin verknüpfen
  („eingeplant in Probe am …“).
- Eingabe auf dem Handy in einem Bottom-Sheet: Textfeld zuerst, Bezug optional über Chips.

## Phasen

1. ✅ **Rechte & Rolle:** Produktionsbezogenes Recht „Regie-Dashboard“ (lesen + Wünsche), Zuordnung
   über Gewerk Regie/Regieassistenz in der Produktion. Weiterleitung auf das Dashboard, Menü für
   diese Nutzer ausblenden. Altes Regie-Onboarding (`src/app/onboarding/regie`, Rolle `board`)
   prüfen: anpassen oder ablösen.
2. **Zugang:** Authentik-Account ohne Pflicht-E-Mail, mehrere Passkeys, Admin-Anmeldelink per
   Messenger, lange Sitzung (Blueprint). Anleitung für Admins in `docs/`.
3. ✅ **Dashboard-Gerüst:** eigene Seite, Karten mit Zusammenfassung + Ansehen/PDF, mobil eine
   Spalte, Laptop Raster, „neu seit letztem Besuch“. Vorbild: Dashboard-Karten
   (`mb-ui-vorbilder`).
4. ✅ **Lese-Ansichten:** schlanke Nur-Lese-Ansichten der Karten (bestehende Lader wiederverwenden,
   Sperrgründe/Maße/Kontakte ausfiltern).
5. ✅ **Wünsche an die Planung:** Schema, Eingabe, Status, Antworten, Benachrichtigungen, Hinweis in
   der Terminplanung, Verknüpfung mit Termin.
6. **Probenmappe:** Auswahl per Häkchen (gemerkt), Sammel-PDF aus den vorhandenen Vorlagen mit
   Deckblatt und Stand.
7. **Tests & Abnahme:** Unit (Rechte, Filter), E2E, Staging-Screenshots mobil+desktop, Test mit
   der Regie auf ihrem Handy. Danach Release; in Prod Gewerke Regie/Regieassistenz anlegen.

## Umsetzung Phase 1 (2026-10-17)

- Recht `PRIVATE.PRODUCTION.DIRECTION.DASHBOARD` („Regie-Dashboard“), neue Blaupause **Regie**
  (`regie`, nicht im Onboarding) und Rechte für Leitung/Stellvertretung/Mitglied in **Regie** und
  **Regieassistenz & Orga** (Migration `20261017100000_regie_dashboard`). In bestehenden
  Produktionen muss das Gewerk „Regie“ noch angelegt und die Person zugeordnet werden.
- Produktionen kommen aus den Gewerk-Mitgliedschaften (`src/lib/regie/access.ts`); wer das Recht
  über eine Rolle hat (Admin), sieht alle aktuellen Produktionen. Bei mehreren: Auswahl per Chip.
- `User.directionView` („Nur Regie-Ansicht“, Schalter in Mitgliederverwaltung → Person): ohne
  Seitenleiste/Bottom-Leiste/Menü-Knopf, alles außer Regie, Profil und Benachrichtigungen leitet
  auf `/mitglieder/regie` um (Layout + Client-Wächter).
- Menüpunkt **Proben → Regie** für alle mit dem Recht (z. B. Regieassistenz in normaler Ansicht).
- Altes Regie-Onboarding (`src/app/onboarding/regie`): Es ist die Einladungs-Variante für
  Einladungen mit Rolle `board` ohne `cast` (Leitungsteam), nicht für den Regie-Zugang. Bleibt
  unverändert; der Regie-Account läuft nicht über das Onboarding. Umbenennen in „Leitungsteam“
  wäre später sinnvoll.
- Geprüft: Typecheck, Lint, Unit-Tests (`src/lib/regie/__tests__/access.test.ts`), Migration auf
  frischer DB. Noch nicht geprüft: Staging/Browser (Regie-Ansicht mobil+desktop, Umleitung,
  Schalter) – mit Phase 3 nachholen. `api/dashboard/overview`-Test wackelt im vollen Lauf
  (einzeln grün, unabhängig von Phase 1).

## Umsetzung Phase 3–5 (2026-10-17)

- **Dashboard** `/mitglieder/regie`: Karten Wünsche (hervorgehoben, „Neuer Wunsch“ direkt),
  Nächste Proben, Szenen × Personen, Verfügbarkeit, Besetzung, Probenprotokolle, Ausstattung,
  Skript (nur PDF). Mobil eine Spalte, ab `sm` zwei, ab `lg` drei Spalten. Probenmappe folgt mit
  Phase 6.
- **„neu“** über `DirectionVisit` (`src/lib/regie/visits.ts`): vorheriger Besuch gilt als
  Grenze; Neuladen innerhalb von 30 Minuten behält die Markierungen.
- **Lese-Ansichten** unter `/mitglieder/regie/{proben,szenen,verfuegbarkeit,besetzung,protokolle,
ausstattung,wuensche}`; Lader in `src/lib/regie/data.ts` (eigene, schlanke Abfragen statt der
  Planer-Lader, damit Sperrgründe/Maße/Kontakte den Server nie verlassen).
- **PDFs** serverseitig: `GET /api/regie/<showId>/pdf/<art>` (inline, `?download=1`), Zugriff
  über `getDirectionShows`. Vorlagen wiederverwendet (terminliste, sperrliste-wichtige-tage ohne
  Gründe, production-casting, requisiten-ablauf, skript-fassung), neu `szenen-matrix` (quer,
  max. 24 Szenen je Tabelle).
- **Wünsche** (`DirectionWish`, `DirectionWishMessage`, Migration `20261017120000_regie_wishes`):
  Freitext + Bezug Szenen/Zeitraum/Personen (Bottom-Sheet, Chips), Status offen/eingeplant/
  erledigt/abgelehnt (Grund Pflicht), Verlauf mit Antworten. Planung: Seite
  `/mitglieder/terminplanung/regie-wuensche` (einplanen mit Termin-Verknüpfung, ablehnen,
  erledigt), Hinweis „offene Regie-Wünsche“ in der Terminplanung und „Regie-Wünsche für diesen
  Tag“ im Termin-Editor. Benachrichtigungstyp `direction-wish` an Planung bzw. Regieteam.
  Das Regieteam darf selbst nur „erledigt“/„wieder öffnen“.
- Geprüft: Typecheck, Lint, Unit-Tests (`src/lib/regie/__tests__`), Migration auf frischer DB
  ohne Drift, alle PDFs gegen die Demo-Daten gerendert. Offen: Staging-Screenshots mobil+desktop.

## Entscheidungen Nachtrag (Nutzer 2026-10-17)

- **Probenmappe frei zusammenstellbar:** Vor dem Erzeugen per Häkchen auswählen, welche Listen
  hinein kommen (Vorauswahl: Wochenplan, Szenen × Personen, Verfügbarkeit, Besetzung,
  Requisiten). Die letzte Auswahl wird gemerkt. Reihenfolge fest, Deckblatt mit Stand und Inhalt.
- **Gemeinsamer Eingang „Regieteam“:** Regie und Regieassistenz sehen alle Wünsche des Regieteams.
  Filter **„Meine Wünsche“** zeigt die selbst geschickten; jeder Wunsch zeigt, wer ihn geschickt hat.
- **Antworten auf Wünsche:** Jeder Wunsch hat einen Gesprächsverlauf. Regieteam und Planung können
  antworten, beide Seiten werden benachrichtigt.

## Bewusst nicht

- Kontaktliste, Listen per Mail, Bearbeiten außer Wünschen, Magic Link per E-Mail (vorerst).
