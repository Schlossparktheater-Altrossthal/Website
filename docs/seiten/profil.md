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
- `src/components/forms/measurement-form.tsx`, `allergy-form.tsx` – Formulare

## Datenfluss

- Profilbild-Upload läuft über `src/app/api/profile/route.ts` (Validierung + `sharp`-Verarbeitung).
- Signaturen über die Signatur-Komponenten (`src/components/signature`).

## Besonderheiten / Altlasten

- Die Bereiche enthalten noch `set-state-in-effect`-Hinweise (React-Compiler-Warnungen, bewusst
  auf „warn" gestellt).
- Rollenwünsche, Fokus und Team-Notizen sind noch personenbezogen (nicht pro Produktion).
- Profilbild-Bearbeitung nutzt `react-easy-crop`.
