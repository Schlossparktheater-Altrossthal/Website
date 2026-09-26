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

## Jahreswechsel-Rollen

- Direkt unter der Einladungsverwaltung lassen sich die beim Jahreswechsel geschützten Rollen
  konfigurieren (`SeasonResetSettingsPanel`).
- `owner` ist immer geschützt; `admin` ist standardmäßig geschützt.

## Besonderheiten

- Das Badge „Authentik“ neben dem Namen zeigt, dass das Mitglied mit seinem Theater-Konto in
  Authentik verknüpft ist (siehe [login.md](login.md)).

- E-Mail-Validierung und Fehlerbehandlung wurden in P1 gehärtet (generische Fehlermeldungen,
  `EMAIL_REGEX`).
- Berechtigungs-Keys werden in `DEFAULT_PERMISSION_DEFINITIONS` (`src/lib/permissions.ts`)
  registriert.
