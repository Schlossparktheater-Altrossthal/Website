# Mystery-Tipps (intern)

## Zweck

Verwaltung der eingereichten Mystery-Tipps durch die Mitglieder (Sichtung, Freigabe,
Auswertung).

## Routen

- `/mitglieder/mystery/tipps`

## Permissions

- Zugriff im Mitgliederbereich; Sichtung über die entsprechenden Mystery-Berechtigungen.

## Wichtige Komponenten

- `src/app/(members)/mitglieder/mystery/tipps/page.tsx`
- `src/components/members/mystery/mystery-submission-review-manager.tsx`

## Datenfluss

- Einreichungen über `src/lib/mystery-submissions.ts`.

## Besonderheiten

- Das öffentliche Pendant ist das Mystery-Rätsel (siehe `oeffentlich-mystery.md`).
