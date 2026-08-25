# Onboarding

## Zweck

Aufnahme neuer Mitglieder über einen mehrstufigen Wizard (Stammdaten, Interessen, Maße,
Fotoerlaubnis) sowie Rückkehrer-Aktualisierung und Talentprofile.

## Routen

- `/mitglieder/onboarding` – Onboarding-Wizard
- `/mitglieder/onboarding/[onboardingId]/talente/[userId]` – Talentprofil

## Permissions

- `PRIVATE.ADMIN.ONBOARDING.ANALYTICS` – Auswertung des Onboardings

## Wichtige Komponenten

- `src/components/onboarding/onboarding-wizard.tsx` – Wizard
- `src/components/onboarding/returnee-update-wizard.tsx` – Rückkehrer
- `src/components/onboarding/signature-pad.tsx` – Unterschrift
- `src/app/dashboard/onboarding/[onboardingId]/` – Auswertungs-Dashboard

## Datenfluss

- Prisma-Modelle rund um das Onboarding (Interessen, Maße, Fotoerlaubnis).
- Statistik über die Server-Analytics-Pipeline.

## Besonderheiten / Altlasten

- Die Signatur-Komponenten nutzen Canvas und dadurch harte Farbwerte (bewusste Ausnahme vom
  Token-System).
- `onboarding-wizard.tsx` enthält eine große Komponente mit vielen Zuständen.
