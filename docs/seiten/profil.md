# Profil

## Zweck

Eigenes Mitgliederprofil inkl. Stammdaten, Körpermaßen, Allergien/Ernährung und
Fotoerlaubnis-Signaturen.

## Routen

- `/mitglieder/profil` – eigenes Profil
- `/mitglieder/koerpermasse` – Körpermaße
- `/mitglieder/fotoerlaubnisse` – Fotoerlaubnisse

## Permissions

- `PRIVATE.PROFILE.OWN.VIEW` – eigenes Profil
- `PRIVATE.PROFILE.MEASUREMENTS.MANAGE` – Körpermaße verwalten
- `PRIVATE.PROFILE.SIZES.MANAGE` – Größen verwalten
- `PRIVATE.PROFILE.DIETARY.MANAGE` – Allergien/Ernährung verwalten
- `PRIVATE.ADMIN.PHOTOCONSENT.MANAGE` – Fotoerlaubnisse verwalten

## Aufbau

- Bereiche über `?bereich=<id>` (`stammdaten`, `zahlungen`, `ernaehrung`, `freigaben`,
  `interessen`, `produktion`; alte Links `onboarding`/`rollen` führen zu `produktion`).
- Mobil (< `lg`): Profilkopf + gruppierte Bereichsliste mit „Fehlt: …“-Hinweisen; Tippen öffnet
  den Bereich, „‹ Profil“ bzw. Browser-Zurück führt zur Liste.
- Desktop (≥ `lg`): Bereichsliste als linke Navigation, Inhalt rechts (ohne `bereich` →
  „Persönliche Daten“).
- Alle Formulare nutzen `FormSaveBar`: haftet bei ungespeicherten Änderungen unten am Bildschirm.
- Die Checkliste (`buildProfileChecklist`) liefert pro offenem Punkt `targetSection` und
  `actionLabel`; Dashboard und Profil berechnen sie gleich (`loadProfileChecklist`).

## Wichtige Komponenten

- `src/app/(members)/mitglieder/profil/profile-client.tsx` – Zustand, Bereichs-Umschaltung
- `src/app/(members)/mitglieder/profil/profile-sections.ts` – Bereiche, Texte, `?bereich=`-Auflösung
- `src/app/(members)/mitglieder/profil/profile-section-nav.tsx`, `profile-header.tsx`
- `src/app/(members)/mitglieder/profil/sections/*` – einzelne Bereiche
  (`production-section.tsx` bündelt Onboarding-Angaben und Rollenwünsche)
- `src/app/(members)/mitglieder/profil/avatar-crop-dialog.tsx` – Profilbild-Zuschnitt
- `src/components/members/photo-consent-card.tsx` – Fotoerlaubnis
- `src/components/forms/measurement-form.tsx` – Körpermaße
- `src/components/forms/allergen-field.tsx` – Allergen-Feld mit Vorschlägen aus dem Katalog
- `src/app/(members)/mitglieder/profil/sections/nutrition-section.tsx` – Ernährung, Abneigungen
  und Allergien

## Ernährung & Allergien (`?bereich=ernaehrung`)

Drei Karten statt eines Formulars (Plan: `docs/Plan/ernaehrung-allergien-plan.md`, umgesetzt
2026-09-29):

1. **Ernährungsstil** – Stil, Unterform (nur bei vegetarisch: mit Ei und Milch / nur Milch / nur
   Ei), Bezeichnung (nur bei „Individueller Stil"), „Wie streng?". Speichern über `FormSaveBar`.
2. **Abneigungen & Besonderheiten** – eigenständige Liste (`DietaryAversion`) mit Besonderheit und
   optionaler Notiz, Dialog zum Anlegen/Bearbeiten, `ConfirmDialog` zum Löschen, Leerzustand
   „Keine Besonderheiten hinterlegt."
3. **Allergien & Unverträglichkeiten** – je Eintrag Art (Allergie/Unverträglichkeit/Sonstiges),
   Schweregrad, Spuren, „ärztlich abgeklärt", Symptome, Notfallhilfe und Notiz. Das Allergen-Feld
   schlägt aus dem Katalog vor, Freitext bleibt zulässig; eine Auswahl belegt die Art vor.

## Fotoerlaubnis (`?bereich=freigaben`)

`PhotoConsentCard` (`src/components/members/photo-consent-card.tsx`) zeigt die Fotoerlaubnis der
aktiven Produktion (Plan: `docs/Plan/fotoerlaubnis-plan.md`):

- **Verwendungszwecke** als Mehrfachauswahl aus dem Katalog der Produktion
  (`PhotoConsentPurpose`); „gar nicht" ist exklusiv und schließt alle anderen aus.
- **Ablehnung** („gar nicht") ist ein eigener Zustand (`noPhotos`), sofort wirksam, ohne Nachweis.
- **Nachweis**: Minderjährige laden die elterliche Einwilligung als Kamera-Foto oder Datei hoch;
  Volljährige laden hoch oder unterschreiben direkt.
- **Drucken** erzeugt aus denselben Zwecken ein unterschreibbares Formular (Browser-Druck).
- **Verlauf**: jede Einreichung wird als `PhotoConsentVersion` archiviert und bleibt einsehbar.
  Zwei Versionen lassen sich nebeneinander vergleichen (angekreuzte Zwecke und Ausschlüsse,
  geänderte Punkte hervorgehoben).
- **Widerruf**: eine erteilte oder „gar nicht"-Erlaubnis lässt sich widerrufen; `revokedAt` wird
  gesetzt und erscheint als „Widerrufen am …" in Kopf und Verlauf. „Erneut einreichen" legt eine
  neue Einreichung an.
- **Einklappen**: die Karte lässt sich über „Einklappen" auf die Kopfzeile reduzieren.
- Nach einer Freigabe lässt sich mit neuer Unterschrift bzw. neuem Dokument ändern; dabei entsteht
  eine neue Version und der Eintrag geht erneut in Prüfung.

- Spuren hat drei Zustände: „Nicht angegeben", „Spuren sind unproblematisch", „Spuren sind
  gefährlich". „Nicht angegeben" heißt für die Küche **ungeklärt, strikt behandeln** – nicht
  „unbedenklich".
- Die Auswahllisten liegen zentral in `src/data/dietary-preferences.ts` (Stil, Unterform,
  Strengegrad samt toleranter Parser für die gespeicherten Labels), `src/data/allergens.ts`
  (Katalog, Art) und `src/data/allergy-styles.ts` (Schweregrad, Spuren). Profil, beide
  Onboarding-Wizards und das Dashboard nutzen dieselben Quellen.
- Gespeichert werden deutsche Labels, keine Codes (`MemberOnboardingProfile.dietaryPreference`,
  `…Variant`, `…Strictness`, Entscheidung E1 im Plan). Achtung bei Anzeige und Auswertung:
  `resolveDietaryStyleLabel` und `parseDietaryStyleFromLabel` sind das Paar zum Schreiben/Lesen.
- Eigene Ernährungsdaten hängen an `requireAuth()`, nicht an einem Permission-Key; die
  Auswertung bleibt `PRIVATE.DATA.PORTAL.HEALTH` (Entscheidung E11).
- Änderungen an der Oberfläche bitte in Handy/Tablet/Desktop, hell und dunkel, per Screenshot
  prüfen: `pnpm e2e:screenshots -- --role admin --viewport all --scheme all "/mitglieder/profil?bereich=ernaehrung"`.

## Datenfluss

- Profilbild-Upload läuft über `src/app/api/profile/route.ts` (Validierung + `sharp`-Verarbeitung).
- Signaturen über die Signatur-Komponenten (`src/components/signature`).
- Ernährung: `PUT /api/profile/dietary` (Stil, Unterform, Strengegrad), `POST/DELETE
/api/allergies` (Art, Schweregrad, Spuren, Abklärung) und `POST/DELETE /api/aversions` für die
  Besonderheiten; alle drei validieren mit `src/lib/profil/dietary-validation.ts`.

## Besonderheiten / Altlasten

- Die Bereiche enthalten noch `set-state-in-effect`-Hinweise (React-Compiler-Warnungen, bewusst
  auf „warn" gestellt).
- Rollenwünsche, Fokus und Team-Notizen sind produktionsbezogen (aktive Produktion aus der
  Seitenleiste, `readProductionPreferences`, Migration `production_scoped_preferences`).
- Profilbild-Bearbeitung nutzt `react-easy-crop`.

## Benachrichtigungen (`?bereich=benachrichtigungen`)

Push auf diesem Gerät ein-/ausschalten und testen, Push je Bereich (Aufgaben und Dringendes kommen immer), Vorlaufzeit für Termin-Erinnerungen, Ruhezeit, angemeldete Geräte entfernen. Details: [benachrichtigungen.md](benachrichtigungen.md).
