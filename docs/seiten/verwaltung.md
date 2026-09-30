# Verwaltung

## Zweck

Administrative Verwaltung: Mitglieder anlegen/bearbeiten/deaktivieren, Rollen zuweisen und
Berechtigungen konfigurieren.

## Routen

- `/mitglieder/mitgliederverwaltung` – Mitgliederliste
- `/mitglieder/mitgliederverwaltung/[userId]` – einzelnes Mitglied
- `/mitglieder/mitgliederverwaltung/aufbewahrung` – Aufbewahrung & Löschfristen
- `/mitglieder/rollenverwaltung` – Rollen
- `/mitglieder/rechte` – Berechtigungen (Permission-Workbench)
- `/mitglieder/fotoerlaubnisse` – Fotoerlaubnisse prüfen und Zwecke pflegen

## Permissions

- `PRIVATE.ADMIN.MEMBERS.MANAGE` – Mitglieder verwalten
- `PRIVATE.ADMIN.INVITES.MANAGE` – Einladungen
- `PRIVATE.ADMIN.PERMISSIONS.MANAGE` – Berechtigungen

## Aufbau

- `/mitglieder/mitgliederverwaltung`: vier Bereiche über `SectionNav` mit Zustand in der URL
  (`?tab=`): Mitglieder, Einladungen, Saisonwechsel, Datenpflege. Ab vier Einträgen zeigt die
  Leiste auf Mobil ein Auswahlfeld statt der Pills.
- `/mitglieder/mitgliederverwaltung/[userId]`: Bereiche Profil, Rechte, Aktivität.
- Aktionen je Mitglied über das „⋯“ in der Mitgliederliste: Profil öffnen, Rollen & Daten
  bearbeiten, Aus Produktion entfernen, Deaktivieren/Reaktivieren, Löschen. „Aus Produktion
  entfernen“ ist nur mit Mitgliedschaft in der aktiven Produktion aktiv und fragt vorher nach:
  Die Mitgliedschaft wird **beendet**, nicht gelöscht (`status: "left"` + `leftAt`, siehe
  `leaveProductionMembership` in `src/lib/produktionen/memberships.ts`). Die abgeleiteten
  Ensemble-/Technik-Rollen und die Authentik-Service-Groups werden nachgezogen, Gewerke und
  Kalender-Einladungen bleiben unberührt. Danach zeigt die Produktionsspalte „—“ und die
  Person lässt sich über die Ensemble-Seite erneut aufnehmen („Ehemalige“).

## Wichtige Komponenten

- `src/app/(members)/mitglieder/mitgliederverwaltung/` – Mitgliederseiten
- `src/components/members/member-invite-manager.tsx` – Einladungen
- `src/components/members/season-reset-settings-panel.tsx` – geschützte Rollen beim Jahreswechsel
- `src/components/members/role-manager.tsx` – Rollen
- `src/components/members/permissions/` – Berechtigungs-Workbench

## Datenfluss

- Prisma-Modelle: `User`, `UserRole`, `AppRole`, `SeasonResetSettings`.
- API: `src/app/api/members/*` (Anlegen, Bearbeiten, Rollen, Status) und
  `src/app/api/season-reset/settings` (geschützte Rollen).
- `DELETE /api/members/[id]/production` beendet die Mitgliedschaft in der aktiven Produktion
  (verlangt `PRIVATE.ADMIN.MEMBERS.MANAGE`, antwortet `{ ok: true, production: null }` bzw.
  `{ error }` mit 400/403/404/500).

## Aufbewahrung & Löschfristen (`/mitglieder/mitgliederverwaltung/aufbewahrung`)

Manuelle Vorschau und Löschung nach Fristen ab dem Ende der letzten Produktion einer Person
(`src/lib/retention.ts`, Entscheidung vom 2026-09-24):

- **Ernährung, Allergien und Abneigungen** – 2 Jahre. Das Löschen entfernt die
  `DietaryRestriction`- und `DietaryAversion`-Zeilen der Person, setzt Stil, Unterform und
  Strengegrad im Onboarding-Profil auf `null` und leert die Kopien in
  `ProductionOnboarding.profileSnapshot` und `MemberInviteRedemption.payload`.
- **Fotoerlaubnisse** – 5 Jahre nach Ende der jeweiligen Produktion, samt hochgeladenen Dokumenten.
- **Konten** – 6 Jahre; deaktivierte Konten ohne Vorstands-, Finanz-, Admin- oder Owner-Rolle
  werden anonymisiert (`User.anonymizedAt`).

Nichts wird automatisch gelöscht: Die Seite listet die Kandidaten, die Löschung löst eine
berechtigte Person je Gruppe aus (Protokoll über `createLogger`). Wer in einer geplanten oder
aktiven Produktion ist, wird nie vorgeschlagen. Wie viele Daten zu einer Person gespeichert sind,
zeigt der Nutzungsbericht in der Mitglieder-Detailseite (`/api/members/[id]/usage`); die Posten
„Ernährungshinweise" und „Abneigungen & Besonderheiten" stehen dort getrennt.

## Jahreswechsel-Rollen

- Direkt unter der Einladungsverwaltung lassen sich die beim Jahreswechsel geschützten Rollen
  konfigurieren (`SeasonResetSettingsPanel`).
- `owner` ist immer geschützt; `admin` ist standardmäßig geschützt.

## Rollen löschen

- Pflichtrollen sind Mitglied, Admin und Owner (`MANDATORY_ROLES` in `src/lib/roles.ts`). Sie
  lassen sich weder umbenennen noch löschen.
- Alle anderen Rollen sind in der Rechte-Matrix löschbar – auch die eingebauten Vorstand,
  Ensemble, Technik und Finanzen (Menü im Spaltenkopf, mobil über das „⋯“ neben dem Rollen-Select).
  Das Löschen entfernt Rolle, Rechte und Rollenzuweisungen; die Personen behalten den
  Rollen-Eintrag in der Mitgliederverwaltung, haben danach aber keine Rechte mehr daraus.
- `ensureSystemRoles()` legt nur noch die Pflichtrollen nach. Gelöschte Rollen bleiben gelöscht
  und entstehen bei Bedarf über „Neue Rolle“ neu (dann als eigene Rolle ohne feste Systemrolle).
- Standardzuweisungen (Körpermaße für Mitglied/Ensemble/Technik/Vorstand/Finanzen, Profildaten
  für Vorstand) greifen nur, solange die jeweilige Rolle existiert.

## Besonderheiten

- Das Badge „Authentik“ neben dem Namen zeigt, dass das Mitglied mit seinem Theater-Konto in
  Authentik verknüpft ist (siehe [login.md](login.md)).

- E-Mail-Validierung und Fehlerbehandlung wurden in P1 gehärtet (generische Fehlermeldungen,
  `EMAIL_REGEX`).
- Berechtigungs-Keys werden in `DEFAULT_PERMISSION_DEFINITIONS` (`src/lib/permissions.ts`)
  registriert.

## Fotoerlaubnisse (`/mitglieder/fotoerlaubnisse`)

Zwei Bereiche über `SectionNav` (`?bereich=`), Plan: `docs/Plan/fotoerlaubnis-plan.md`:

- **Einwilligungen**: Liste je Produktion mit Suche, Status-Filter und CSV-Export. Offene
  Einreichungen lassen sich freigeben, ablehnen (Begründung im Dialog) oder zurücksetzen. Ein
  Zurücksetzen entfernt den eingereichten Nachweis, damit neu eingereicht werden kann; der
  Verlauf bleibt erhalten. Der Status `noPhotos` steht für „gar nicht". Die Karten sind kompakt
  und klappen die Details (Zeiten, Dokument, Ausschlüsse) auf Wunsch aus. Die Fotoliste (CSV)
  enthält die angekreuzten Verwendungszwecke in der Spalte „Angekreuzt".
- **Zwecke**: der Katalog der abgefragten Verwendungszwecke je Produktion
  (`PhotoConsentPurpose`) – anlegen, bearbeiten, deaktivieren. Deaktivieren erhält bestehende
  Auswahlen.

Daten: `PhotoConsent`, `PhotoConsentChoice`, `PhotoConsentVersion`, `PhotoConsentPurpose`.
API: `src/app/api/photo-consents/*` (`admin`, `purposes`, `export`, `parental-template`).
