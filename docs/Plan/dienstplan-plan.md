# Plan: Baustein Dienstplan

Stand: 2026-10-04. Konzept. Setzt `docs/Plan/produktionsphasen-vorstellungen-plan.md` (Phase 1) voraus.

## Ziel

1. Schichten für Endprobenwoche und Vorstellungen (Küche, Abwasch, Einlass, Abendkasse, Garderobe …).
2. Freie Plätze, selbst eintragen oder zuweisen, Tausch anfragen.
3. Abgleich mit Sperrliste, Kalender-Abo, Push-Erinnerung.
4. Gewerk-Baustein `shifts` – Schichten können einem Gewerk gehören (z. B. Küchendienst).

## Ist-Stand

- `FinalRehearsalDuty` (Datum, Zeit, eine Person) existiert im Schema, wird in `src/` nicht benutzt → ablösen.

## Zielbild

```
Shift            id, showId, phaseId? | performanceId?, departmentId?, role, startsAt, endsAt, slots, notes
ShiftAssignment  shiftId, userId, status (zugesagt|getauscht|abgesagt)
```

## Phasen

1. Modelle, `FinalRehearsalDuty` entfernen.
2. Planansicht (Tage × Schichten), Eintragen/Zuweisen, Sperren-Hinweis.
3. Tausch, ICS, Erinnerungen.
4. Doku, E2E, Release.

## Checkliste

- [ ] Phase 1 Modelle
- [ ] Phase 2 Planansicht
- [ ] Phase 3 Tausch/ICS/Erinnerung
- [ ] Phase 4 Doku/E2E/Release
