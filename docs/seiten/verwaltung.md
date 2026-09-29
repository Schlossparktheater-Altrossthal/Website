# Verwaltung

## Zweck

Administrative Verwaltung: Mitglieder anlegen/bearbeiten/deaktivieren, Rollen zuweisen und
Berechtigungen konfigurieren.

## Routen

- `/mitglieder/mitgliederverwaltung` – Mitgliederliste
- `/mitglieder/mitgliederverwaltung/[userId]` – einzelnes Mitglied
- `/mitglieder/rollenverwaltung` – Rollen
- `/mitglieder/rechte` – Berechtigungen (Permission-Workbench)

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
