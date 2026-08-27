# Onboarding

## Zweck

Aufnahme neuer Mitglieder über einen mehrstufigen Wizard (Stammdaten, Interessen, Maße,
Fotoerlaubnis) sowie Rückkehrer-Aktualisierung und Talentprofile.

## Routen

- `/onboarding/[token]` – Onboarding-Wizard (neue Mitglieder)
- `/onboarding/[token]/update` – Rückkehrer-Aktualisierung (erfordert Login)
- `/mitglieder/onboarding` – Onboarding-Statistik
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

## Jahreswechsel & Produktions-Link

- Der Produktions-Onboarding-Link ist ein `MemberInvite` mit gesetzter `showId` und wird über
  die Einladungsverwaltung der Mitgliederverwaltung erstellt.
- „Ich habe bereits einen Account" führt zur Anmeldung (E-Mail + Passwort); ein deaktiviertes,
  vorhandenes Konto wird dabei reaktiviert (`deactivatedAt = null`) und anschließend über den
  Rückkehrer-Wizard aktualisiert.
- Der normale Login ohne gültigen Link sowie der Magic-Link bleiben für deaktivierte Konten
  gesperrt.
- `POST /api/onboarding/update` legt bei Abschluss die `ProductionMembership` für die
  zugehörige Produktion an (über das mitgesendete Einladungs-Token).

## Besonderheiten / Altlasten

- Die Signatur-Komponenten nutzen Canvas und dadurch harte Farbwerte (bewusste Ausnahme vom
  Token-System).
- `onboarding-wizard.tsx` enthält eine große Komponente mit vielen Zuständen.
