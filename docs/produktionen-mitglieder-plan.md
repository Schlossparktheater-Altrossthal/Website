# Plan: Produktionsbezogene Mitglieder, Onboarding & Fotoerlaubnis

Stand: 2026-09-23. Arbeitsdokument, um die Umsetzung auch in späteren Sessions fortsetzen zu können.
Fortschritt wird in der Checkliste am Ende gepflegt.

## Ausgangslage

Pro Jahr meist eine Produktion, starker Mitgliederwechsel zwischen Produktionen. Fotoerlaubnis und
Onboarding müssen pro Produktion erteilt bzw. durchlaufen werden, Produktionen sollen inaktiv werden können.
Bisher existiert genau eine Produktion: **„Die unendliche Geschichte“** – alle Bestandsdaten gehören zu ihr.

### Befunde im aktuellen Code

| #   | Problem                                                                                                                                                                                                                                                | Stelle                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| 1   | „Aktive Produktion“ ist nur ein Browser-Cookie (`active-production`), kein DB-Zustand                                                                                                                                                                  | `src/lib/active-production.ts`, `produktionen/actions/production.ts` |
| 2   | Cookie-Wechsel (`setActive…`, `clearActive…`, `createProduction…` mit `setActive`) ruft `performSeasonChangeDeactivation()` auf → deaktiviert **alle** Nutzer ohne geschützte Rolle, unabhängig von Produktionszugehörigkeit, und invalidiert Sessions | `src/lib/season-reset/deactivation.ts`                               |
| 3   | `PhotoConsent.userId @unique` → eine Fotoerlaubnis pro Person für immer; Rückkehrer-Update setzt `status` nicht auf `pending` zurück                                                                                                                   | `prisma/schema.prisma`, `api/onboarding/update/route.ts:273`         |
| 4   | `MemberOnboardingProfile.userId @unique` + ein `showId` → Onboarding wird überschrieben, keine Historie; `MemberRolePreference` ohne Produktionsbezug                                                                                                  | Schema                                                               |
| 5   | `Show` ohne Status/Archivierung; Löschen kaskadiert Proben, Besetzung, Mitgliedschaften, Einladungen                                                                                                                                                   | Schema                                                               |
| 6   | (Korrigiert) Authentik-Login mit Einladungslink reaktivierte deaktivierte Rückkehrer bereits – aber sofort beim Login, vor dem Onboarding; Passwort-Reset war für Deaktivierte gesperrt                                                                | `src/auth.ts`, `api/auth/password-email`                             |
| 7   | Normales Onboarding mit bekannter E-Mail endet erst beim Absenden mit 409 „Konto existiert bereits“ – Eingaben verloren                                                                                                                                | `api/onboarding/complete/route.ts:360`                               |
| 8   | Drei Rollensysteme (`User.role`, `UserRole`, `AppRole`), alle global; `DepartmentMembership` global statt pro Produktion                                                                                                                               | Schema                                                               |
| 9   | `GalleryItem` hängt an `year` statt `showId`; `Show.dates` als JSON-String; `ProductionMembership` ohne Status/Funktion                                                                                                                                | Schema                                                               |

## Zielbild

- Eine Produktion hat einen **Lebenszyklus** (`planning → active → finished → archived`), gespeichert in der DB.
- **Aktiv als Mitglied** = mindestens eine `ProductionMembership` mit `status=active` in einer Produktion mit
  `status=active` (bzw. `planning`, siehe Entscheidung E2). `User.deactivatedAt` nur noch für echte Sperren.
- Onboarding, Fotoerlaubnis, Rollenwünsche, Gewerkzugehörigkeit sind **pro Produktion**.
- Das Profil (Stammdaten, Allergien, Ernährung, Maße, Ausbildung, Interessen) ist der **aktuelle Stand** und
  wird beim nächsten Onboarding vorausgefüllt; jedes Onboarding speichert einen Snapshot der bestätigten Angaben.
- Das Cookie bleibt nur als **persönliche Ansichtsauswahl** und hat keine Seiteneffekte.

### Ziel-Datenmodell (Skizze)

```prisma
enum ProductionStatus { planning active finished archived }
enum MembershipStatus { invited onboarding active left }

model Show {
  // bestehende Felder …
  status     ProductionStatus @default(planning)
  archivedAt DateTime?
  onboardingConfig Json?          // Fragen/Dokumente pro Produktion, WhatsApp-Link aus meta hierher
}

model ProductionMembership {
  // bestehend: id, showId, userId, joinedAt, leftAt
  status       MembershipStatus @default(invited)
  function     String?          // Darsteller:in, Technik, Regie …
  onboarding   ProductionOnboarding?
}

model ProductionOnboarding {
  id             String   @id @default(cuid())
  userId         String
  showId         String
  membershipId   String?  @unique
  inviteId       String?
  redemptionId   String?  @unique
  focus          OnboardingFocus
  answers        Json?     // produktionsspezifische Fragen
  profileSnapshot Json?    // bestätigte Profildaten zum Zeitpunkt des Onboardings
  startedAt      DateTime @default(now())
  completedAt    DateTime?
  @@unique([userId, showId])
}

model PhotoConsent {
  // bestehende Felder …
  showId     String
  revokedAt  DateTime?
  @@unique([userId, showId])   // ersetzt userId @unique
}

model MemberRolePreference { showId String  @@unique([userId, showId, code]) }
model DepartmentMembership { showId String? @@unique([departmentId, userId, showId]) }
model GalleryItem          { showId String? }
```

`Show`-Relationen, die heute `onDelete: Cascade` haben, bleiben technisch so, aber Löschen wird in der UI
nur für Produktionen ohne Mitglieder/Proben erlaubt; sonst nur Archivieren.

## Rückkehrer (Leute, die schon ein Konto hatten)

### Einstieg über den Einladungslink

1. Erste Frage: **„Warst du schon mal dabei?“**
   - **Ja** → Login über Authentik, Einladungstoken wird im `callbackUrl`/State mitgegeben.
     Der `signIn`-Callback erlaubt Login trotz `deactivatedAt`, **wenn** ein gültiger Einladungstoken vorliegt,
     beschränkt die Session aber auf den Onboarding-Flow. Reaktivierung erst bei Abschluss des Onboardings.
   - **Nein** → normales Onboarding; E-Mail wird **beim Eintippen** geprüft
     (Rate-limitiertes Endpoint, Antwort ohne Account-Enumeration-Details über das Nötige hinaus):
     „Diese Adresse kennen wir – melde dich an, dann ist vieles vorausgefüllt.“
   - **Passwort vergessen** → Authentik-Recovery-Flow, Rücksprung in denselben Einladungslink.
2. Die 409-Sackgasse in `onboarding/complete` wird durch Weiterleitung in den Rückkehrer-Flow ersetzt
   (Eingaben zwischenspeichern in `MemberInviteRedemption.payload`).

### Vorausfüllen vs. neu abfragen

| Vorausgefüllt, nur bestätigen                             | Pro Produktion immer neu                                      |
| --------------------------------------------------------- | ------------------------------------------------------------- |
| Name, Geburtsdatum, Kontakt                               | Fotoerlaubnis (+ Elternformular bei <18, Alter neu berechnen) |
| Allergien/Unverträglichkeiten – je Eintrag „stimmt noch?“ | Rollen-/Gewerkwünsche                                         |
| Ernährungsweise + Strenge                                 | Verfügbarkeit / Sperrtermine                                  |
| Größen & Maße                                             | produktionsspezifische Fragen (`onboardingConfig`)            |
| Ausbildung, Interessen                                    |                                                               |

### Verwaltung

- Ensemble-Ansicht: **„Aus früheren Produktionen einladen“** – Mehrfachauswahl Ehemaliger → persönlicher Link per Mail (Mailu).
- **Dubletten zusammenführen** (zwei Konten derselben Person): Relationen umhängen, Authentik-Konto abgleichen.
- **Aufbewahrung**: Ehemalige ohne Mitgliedschaft seit X Jahren zur Anonymisierung vorschlagen;
  Gesundheitsdaten (Allergien) und Fotodokumente früher (Frist klären, E4).

## Migration auf „Die unendliche Geschichte“

Nach der Regel „Schema und inkompatibler Code nie in einem Deploy“ in Phasen:

**Phase A – additiv (ein Deploy)**

1. Neue Enums/Spalten/Tabellen anlegen, alle neuen Pflichtspalten zunächst nullable.
2. Datenmigration (SQL in der Migration):
   - `Show` „Die unendliche Geschichte“ → `status = active` (per Titel ermitteln; Migration bricht ab, wenn nicht genau eine Show existiert).
   - `PhotoConsent.showId` = diese Show (Status bleibt erhalten).
   - `MemberOnboardingProfile` → `ProductionOnboarding` (inkl. `inviteId`, `redemptionId`, `completedAt = user.onboardingCompletedAt`).
   - `MemberRolePreference.showId`, `DepartmentMembership.showId` = diese Show.
   - Nicht deaktivierte Nutzer ohne `ProductionMembership` → Membership anlegen; alle Memberships `status = active` bzw. `left`, wenn `leftAt` gesetzt.
   - `GalleryItem.showId` über `year` zuordnen.
   - WhatsApp-Link aus `Show.meta.onboarding` nach `onboardingConfig` kopieren.
3. Vorher auf Staging mit frischem Prod-Dump testen (siehe Staging-DB-Sync; `pg_dump --clean`-Falle beachten).

**Phase B – Code umstellen (ein oder mehrere Deploys)**

- Lese-/Schreibpfade auf neue Tabellen, alte Felder nur noch lesen als Fallback.

**Phase C – aufräumen (eigener Deploy)**

- Spalten `NOT NULL` setzen, alte `@unique([userId])` entfernen, `MemberOnboardingProfile` auf reine Profildaten reduzieren oder entfernen, `SeasonResetSettings` entfernen.

## Umsetzungsschritte

### Schritt 1 – Deaktivierung vom Cookie entkoppeln (Sofortfix)

- `performSeasonChangeDeactivation()`-Aufrufe aus `setActiveProductionAction`, `clearActiveProductionAction`, `createProductionAction` entfernen.
- Neue explizite Action **„Saison abschließen“** (Permission `PRIVATE.PRODUCTION.SHOW.MANAGE`) mit Vorschau:
  Liste der betroffenen Mitglieder, Bestätigungsdialog. Vorerst weiter mit geschützten Rollen; berücksichtigt
  zusätzlich: wer in einer anderen, nicht beendeten Produktion Mitglied ist, bleibt aktiv.
- Tests in `src/lib/season-reset/__tests__` anpassen.

### Schritt 2 – Produktionsstatus + Migration Phase A

- `ProductionStatus`, `Show.status/archivedAt`, `MembershipStatus`, Datenmigration wie oben.
- `getActiveProduction` nutzt DB-Status; Cookie nur als Ansichtsauswahl unter aktiven/geplanten Produktionen.
- „Saison abschließen“ wird zu „Produktion beenden“ (`status = finished`, Memberships → `left`) und Zugriff ergibt sich aus Memberships.

### Schritt 3 – Fotoerlaubnis & Onboarding pro Produktion

- `PhotoConsent` pro Show, API-Routen (`api/photo-consents*`, `api/onboarding/*`) umstellen.
- Neues Dokument → Status zurück auf `pending`. Widerruf (`revokedAt`) ermöglichen.
- `ProductionOnboarding` schreiben; Profil als aktueller Stand, Snapshot pro Onboarding.

### Schritt 4 – Rückkehrer-Flow

- Einstiegsfrage, Authentik-Login mit Token, `signIn`-Callback-Ausnahme, E-Mail-Check beim Tippen,
  409 ersetzen, Vorausfüllen inkl. Allergie-Bestätigung, Alters-Neuberechnung.

### Schritt 5 – Verwaltungsoberflächen

- Produktionsliste mit Status, Archivieren, geschütztes Löschen.
- Ensemble pro Produktion (hinzufügen, `left` setzen, Funktion, Ehemalige einladen).
- Onboarding-Status pro Produktion + Erinnerungsmail.
- Fotoerlaubnis-Matrix pro Produktion + Export „nicht fotografieren“.
- Konfigurierbares Onboarding (`onboardingConfig`).
- Produktionshistorie im Mitgliederprofil.
- Dubletten zusammenführen, Aufbewahrung/Anonymisierung.

## Offene Entscheidungen

- **E1 (entschieden 2026-09-23):** Rollen wie `cast`/`tech` gelten pro Produktion → `ProductionMembership.roles`. Vergabe nur durch Admins; globale Rollen nur noch für Vorstand/Finanzen/Admin.
- **E2 (entschieden 2026-09-23):** Wer für eine Produktion ongeboardet ist, hat Zugriff – auch wenn sie noch `planning` ist und der Titel sich noch ändert.
- **E3:** Behalten Ehemalige einen eingeschränkten Lesezugriff (z. B. Galerie ihrer Produktion)?
- **E4:** Aufbewahrungsfristen für Gesundheitsdaten, Fotodokumente, Onboarding-Antworten.

## Hinweise

- Vor jedem Commit: `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm build` (siehe `AGENTS.md`).
- Neue Permission-Keys in `DEFAULT_PERMISSION_DEFINITIONS` registrieren.
- Authentik-Gruppensync (`requestServiceGroupSync`) bei Statusänderungen weiter auslösen.

## Fortschritt

- [x] Schritt 1 – Deaktivierung entkoppeln, „Saison abschließen“ mit Vorschau (Mitgliederverwaltung, `api/season-reset/deactivation`)
- [x] Schritt 2 – Produktionsstatus + Migration Phase A (`20260923120000_add_production_status`: `Show.status/statusChangedAt/archivedAt`, `ProductionMembership.status/roles/function`; „Die unendliche Geschichte“ → `active`, alle aktiven Nutzer als Mitglieder, `cast`/`tech` in `roles` kopiert. Status-Auswahl in der Produktionsübersicht; Beenden/Archivieren schließt Mitgliedschaften; „Saison abschließen“ lässt Mitglieder laufender Produktionen aus.)
  - Erledigt in 5a: `ProductionMembership.roles` ist Quelle der Wahrheit, `UserRole` cast/tech wird abgeleitet.
- [x] Schritt 3 – Fotoerlaubnis & Onboarding pro Produktion (Phase B)
  - [x] 3a Fotoerlaubnis pro Produktion (`20260923140000_photo_consent_per_production`, `@@unique([userId, showId])`, `revokedAt`; Bestand → „Die unendliche Geschichte“; Helper `src/lib/photo-consent-scope.ts`; Admin-Filter nach Produktion; Rückkehrer-Update setzt Status auf `pending`)
  - [x] 3b Onboarding pro Produktion (`20260923160000_add_production_onboarding`: `ProductionOnboarding` mit Fokus, Einladung, `completedAt`, `isReturning`, `profileSnapshot`; Bestandsprofile → „Die unendliche Geschichte“. Dashboard und Onboarding-Auswertung lesen pro Produktion, Rückkehrer erscheinen jetzt in der neuen Produktion.)
  - Offen: `MemberRolePreference` bleibt „aktueller Wunsch“; Historie nur über den Snapshot. `MemberOnboardingProfile.showId` ist veraltet (Entfernen in Phase C). Mitglieder können sich im Profil selbst eine Produktion für den WhatsApp-Link wählen (`api/profile/onboarding/show`) – gibt keinen Zugriff, sollte aber in Schritt 4/5 durch die Mitgliedschaft ersetzt werden.
  - Offen: Widerruf (`revokedAt`) hat noch keine UI
- [x] Schritt 4 – Rückkehrer-Flow: Login deaktivierter Rückkehrer nur mit gültigem Einladungslink, Konto bleibt bis zum Abschluss des Rückkehrer-Onboardings gesperrt (`src/lib/onboarding/returnee.ts`, `returneeOnboarding`-Flag im Credentials-Login); Reaktivierung + Authentik-Gruppensync in `api/onboarding/update`; E-Mail-Prüfung beim Eintippen (`api/onboarding/email-check`, nur mit offener Einladungssitzung, rate-limitiert), 409 führt zurück zum Anmelde-Hinweis; „Passwort vergessen“ für deaktivierte Rückkehrer mit Einladungslink; Pflicht-Bestätigung übernommener Ernährungs-/Allergieangaben.
  - Offen: Nach dem Setzen des Passworts in Authentik führt kein automatischer Rücksprung zum Einladungslink; Eingaben aus einem abgebrochenen Neu-Onboarding (409) werden nicht übernommen, der Rückkehrer-Wizard füllt aus dem alten Profil vor.
- [ ] Schritt 5 – Verwaltungsoberflächen
  - [x] 5a Ensemble pro Produktion + Rollen (`/mitglieder/produktionen/[showId]/ensemble`): aufnehmen (ongeboardet → aktiv, sonst eingeladen), Ensemble/Technik + Funktion pro Mitgliedschaft, Mitgliedschaft beenden; Status von Onboarding und Fotoerlaubnis je Person. Globale Rollen `cast`/`tech` werden per `syncProductionRoles` aus den laufenden Mitgliedschaften abgeleitet (ohne `withAutoCast`; mit Prod-Dump geprüft: 0 Änderungen im Bestand). Der Rollen-Editor der Mitgliederverwaltung schreibt Ensemble/Technik in die Mitgliedschaft der ausgewählten Produktion.
  - [x] 5b Ehemalige einladen: Auswahl auf der Ensemble-Seite → persönliche Einladung (einmal nutzbar, 30 Tage), Mitgliedschaft „eingeladen“, Mail über die SMTP-Server-Einstellungen (`src/lib/email/send.ts`); ohne SMTP/E-Mail werden die Links zum Weitergeben angezeigt. Rückkehrer-Onboarding zählt die Einladungsnutzung jetzt mit (vorher nie → „einmal nutzbar“ griff nicht).
    - Offen: Persönliche Links sind nicht an das Konto gebunden (wer den Link hat, kann ihn einmal nutzen).
  - [x] 5c Erinnerungen & Fotoliste (Ensemble-Seite): Onboarding-Erinnerung schickt Eingeladenen einen neuen persönlichen Link (Tokens sind nur gehasht gespeichert); Fotoerlaubnis-Erinnerung an aktive Mitglieder ohne bzw. mit abgelehnter Erlaubnis (Link aufs Profil, braucht SMTP); CSV-Fotoliste für Fotograf:innen (`api/photo-consents/export`, auch in der Fotoerlaubnis-Verwaltung): erlaubt / eingeschränkt (Ausschlüsse) / nicht fotografieren (fehlend, ausstehend, abgelehnt), Minderjährige markiert, CSV-Injection entschärft.
    - Offen: Erinnerungen werden nicht protokolliert (kein Schutz vor Mehrfachversand außer Bestätigungsdialog).
  - [ ] 5d Produktionshistorie im Profil, Dubletten zusammenführen, Aufbewahrung
- [ ] Phase C – Aufräum-Migration
