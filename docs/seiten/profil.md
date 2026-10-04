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
- `PRIVATE.PROFILE.MEASUREMENTS.MANAGE` – Maße & Größen verwalten (Bereich `masse`, Seite
  `/mitglieder/koerpermasse`)
- `PRIVATE.PROFILE.DIETARY.MANAGE` – Allergien/Ernährung verwalten
- `PRIVATE.ADMIN.PHOTOCONSENT.MANAGE` – Fotoerlaubnisse verwalten

## Aufbau

- Bereiche über `?bereich=<id>`; Quelle ist `PROFILE_SECTIONS` in
  `src/app/(members)/mitglieder/profil/profile-sections.ts` mit den IDs `stammdaten`, `zahlungen`,
  `ernaehrung`, `masse`, `freigaben`, `interessen` (Gruppe „Über mich“), `produktion`
  (Gruppe „Produktion“) und `benachrichtigungen` (Gruppe „Einstellungen“). Alte Links
  `onboarding`/`rollen` führen zu `produktion`.
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
aktiven Produktion (Plan: `docs/Plan/fotoerlaubnis-stufen-plan.md`):

- Liegt eine Erlaubnis vor, nur eine **Statuszeile** (Stufe, Status, Hinweis) mit „Ändern",
  „Verlauf" und „Widerrufen". Fehlt etwas (Unterschrift, Ablehnung), heißt der Knopf passend,
  z. B. „Unterschrift nachreichen".
- Das Formular ist `PhotoConsentForm` (`src/components/photo-consent/photo-consent-form.tsx`),
  dasselbe wie im Onboarding und im Rückkehrer-Assistenten: **Stufe** als Radio-Kacheln,
  **Nachweis** über einen Umschalter (Unterschreiben, Foto/PDF hochladen, bei Minderjährigen
  „Später"), optionaler **Hinweis**. Volljährige können die Stufe der Vorproduktion übernehmen,
  unterschreiben aber je Produktion neu.
- Digitale Unterschriften werden nur vektoriell gespeichert (`signaturePayload`, `velocity.v1`).
- Ohne Geburtsdatum erscheint statt des Formulars ein Hinweis mit Link zu den Stammdaten.

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
