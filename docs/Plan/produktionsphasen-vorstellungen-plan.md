# Plan: Produktionsphasen & Vorstellungen

Stand: 2026-10-04. Konzept. Grundlage für [`docs/Plan/verpflegung-plan.md`](verpflegung-plan.md),
[`docs/Plan/dienstplan-plan.md`](dienstplan-plan.md) und [`docs/Plan/einkauf-belege-plan.md`](einkauf-belege-plan.md).

**Planfamilie:** [Lebensmittel-Standard](lebensmittel-standard-plan.md) · [Rezepte](rezepte-plan.md) · **Phasen & Vorstellungen** · [Verpflegung](verpflegung-plan.md) · [Einkauf & Belege](einkauf-belege-plan.md) · [Dienstplan](dienstplan-plan.md) · [Index](README.md)

## Ziel

1. Endprobenwoche (und weitere Phasen) als eigener Datensatz statt `Show.finalRehearsalWeekStart/End`.
2. Vorstellungen als eigener Datensatz statt `Show.dates` (JSON).
3. Vorstellungsabend: Zuschauerzähler (offline, mehrere Geräte), Spenden je Vorstellung,
   Kassensturz mit Vier-Augen-Bestätigung, Vorstellungsbericht.
4. Vorbereitet für Reservierungen/Tickets (eigener Plan später).

## Ist-Stand

- `Ticket.eventId` ist ein loser String; `TicketScanEvent` + `SyncEvent`/`SyncMutation` bieten
  Offline-Sync mit Server-Sequenz – Basis für den Zähler.
- `FinanceEntry.kind = donation` vorhanden, aber ohne Vorstellungsbezug.

## Zielbild

```
ProductionPhase    id, showId, kind (final_rehearsal_week|…), startsAt, endsAt, title
Performance        id, showId, startsAt, venue, capacity, status
Ticket             + performanceId (Relation)
SyncEvent          scope performance_count, delta ±1, deviceId     // Zähler = Summe, kein Wert
FinanceEntry       + performanceId?
CashCount          performanceId, denominations Json, totalCents, countedById, confirmedById
PerformanceReport  performanceId, audience (aus Zähler/Scans), donationsCents, boxOfficeCents, incidents
```

## Phasen

1. Modelle + Migration aus `finalRehearsalWeek*` und `Show.dates`, Leser umstellen.
2. Oberfläche Produktion: Reiter Endprobenwoche/Vorstellungen.
3. Zuschauerzähler (offline, live).
4. Spenden je Vorstellung, Kassensturz (setzt Cent-Beträge aus [`docs/Plan/einkauf-belege-plan.md`](einkauf-belege-plan.md) Phase 1 voraus).
5. Vorstellungsbericht.
6. Doku, E2E, Release.

## Checkliste

- [ ] Phase 1 Modelle/Migration
- [ ] Phase 2 Oberfläche
- [ ] Phase 3 Zähler
- [ ] Phase 4 Spenden/Kassensturz
- [ ] Phase 5 Bericht
- [ ] Phase 6 Doku/E2E/Release
