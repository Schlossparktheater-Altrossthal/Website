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
- Der normale Login ohne gültigen Link bleibt für deaktivierte Konten gesperrt. Beim Login über
  Authentik trägt die Login-Seite den Token vorher in ein kurzlebiges Cookie ein (siehe
  [login.md](login.md)).
- `POST /api/onboarding/update` legt bei Abschluss die `ProductionMembership` für die
  zugehörige Produktion an (über das mitgesendete Einladungs-Token). Seit 2026-09 fragt der
  Rückkehrer-Wizard auch die Interessen ab (optionales Feld `interests`, gespeichert über
  `src/lib/profil/interests.ts`).

## Ernährung & Allergien

- Beide Wizards nutzen dieselben Listen wie das Profil: `src/data/dietary-preferences.ts`
  (Stil, Unterform nur bei vegetarisch, Strengegrad) und `src/data/allergens.ts`
  (Vorschlagsliste, Art des Eintrags). Der Erstanmeldungs-Wizard bietet die Unterform und die
  Art/Spuren/Angabe „ärztlich abgeklärt" je Eintrag an, der Rückkehrer-Wizard ebenso.
- Der Schweregrad kommt aus `src/data/allergy-styles.ts` (`ALLERGY_LEVEL_OPTIONS`: Leicht, Mittel,
  Schwer, Lebensbedrohlich). Die früheren eigenen Wörter des Rückkehrer-Wizards („Stark",
  „Kritisch") sind entfallen.
- `POST /api/onboarding/update` erhält den Stil strukturiert:
  `dietaryPreference: { style, variant, customLabel, strictness }`. Die alten Felder
  (`dietaryPreference` als Label-String, `dietaryPreferenceStrictness`) werden weiterhin
  angenommen und auf dieselben Labels abgebildet – das Profil speichert Labels, nicht Codes.
  Jeder Allergie-Eintrag trägt zusätzlich `kind`, `tracesOk` und `diagnosed`.
- `POST /api/onboarding/complete` prüft den Stil mit demselben Schema; `none` und `custom` aus
  älteren Clients werden vor der Prüfung übersetzt.
- Der Profil-Snapshot (`buildProfileSnapshot`) steht auf Version 2 und enthält neben Stil und
  Strengegrad auch die Unterform sowie je Allergie Art, Spuren und Abklärung.

## Rollen- und Gewerkewünsche

- Onboarding, Rückkehrer-Wizard und Profil nutzen dieselbe kompakte Zeile
  `role-preference-level-picker.tsx` mit stufenlosem Radix-Regler (`src/components/ui/slider.tsx`).
  Ganz links = kein Interesse; angezeigt wird ein Wort (Vielleicht … Unbedingt), keine Prozentzahl,
  weil Prozente wie ein gemeinsames 100-%-Budget wirkten.
- Der frühere `<input type="range">` war auf Handys schwer zu greifen (16 px hoch, die Seite
  scrollte stattdessen). Der Radix-Regler reagiert auf die ganze Spur und sperrt beim Ziehen das
  Scrollen nicht. Bei Touch bewegt nur der Griff den Wert; über die Spur scrollt die Seite (`touch-pan-y`, implizites Pointer-Capture wird freigegeben).

## Besonderheiten / Altlasten

- Die Signatur-Komponenten nutzen Canvas und dadurch harte Farbwerte (bewusste Ausnahme vom
  Token-System).
- `onboarding-wizard.tsx` enthält eine große Komponente mit vielen Zuständen.

## Schule / Ausbildung (BSZ-Standorte)

- Onboarding, Rückkehrer-Wizard und Profil („Über dich“) nutzen `education-fields.tsx`. Bei
  „Schule“ wird direkt gefragt: BSZ Altroßthal, BSZ Canalettostraße oder andere Schule.
- Das Berufliche Schulzentrum für Agrarwirtschaft und Ernährung Dresden hat zwei Standorte:
  Altroßthal 1 (grüne Berufe) und Canalettostraße 8 (Ernährungsberufe). Gespeichert wird
  `educationCategory = school_bsz` mit kanonischem `educationSchoolName`
  („… – Standort Altroßthal“ bzw. „… – Standort Canalettostraße“); Logik in
  `src/lib/education/schools.ts` (erkennt auch alte Freitexte wie „BSZ Canaletto“).
- Die alten Felder `background`/`backgroundClass` werden beim Speichern mitgeschrieben, weil
  Onboarding-Dashboard und Auswertungen sie noch lesen.
- Vorschläge (Klassen je Standort, andere Schulen, Berufe, Hochschulen) liefert
  `GET /api/onboarding/education-suggestions` – nur mit Anmeldung oder gültigem Onboarding-Link (`?token=`), nur Häufigkeiten, Freitexte erst ab
  zwei Nennungen.
