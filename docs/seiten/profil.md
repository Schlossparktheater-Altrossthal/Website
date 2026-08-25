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

## Wichtige Komponenten

- `src/app/(members)/mitglieder/profil/profile-client.tsx` – Hauptkomponente (sehr groß)
- `src/app/(members)/mitglieder/profil/avatar-crop-dialog.tsx` – Profilbild-Zuschnitt
- `src/components/members/photo-consent-card.tsx` – Fotoerlaubnis
- `src/components/forms/measurement-form.tsx`, `allergy-form.tsx` – Formulare

## Datenfluss

- Profilbild-Upload läuft über `src/app/api/profile/route.ts` (Validierung + `sharp`-Verarbeitung).
- Signaturen über die Signatur-Komponenten (`src/components/signature`).

## Besonderheiten / Altlasten

- `profile-client.tsx` ist mit 3000+ Zeilen die größte Komponente und hat die meisten
  `set-state-in-effect`-Hinweise (React-Compiler-Warnungen, bewusst auf „warn" gestellt).
- Profilbild-Bearbeitung nutzt `react-easy-crop`.
