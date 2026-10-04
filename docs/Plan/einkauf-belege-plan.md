# Plan: Baustein Einkauf & Belege

Stand: 2026-10-04. Konzept. Allgemeiner Einkauf (nicht nur Essen). Bekommt Positionen aus
`docs/Plan/verpflegung-plan.md`, verzahnt mit dem Budget aus `docs/Plan/gewerke-plan.md` (Phase 12)
und dem Lager (`docs/Plan/lager-typen-projekte-plan.md`).

## Ziel

1. Gewerk-Baustein `purchasing`: Einkaufslisten pro Gewerk/Produktion/Phase.
2. Positionen aus Lebensmitteln, Lager-Typen oder Freitext; Quellen Essensplan, Szenenbedarf, manuell.
3. Abhaken mobil, Zuständige, geschätzte Preise.
4. Beleg hochladen → `FinanceEntry` (Entwurf) mit Anhang, Auslagen-Erstattung (`memberPaidBy`).
5. Budget Soll/Ist je Gewerk/Phase.
6. Geldbeträge als Cent-Integer.

## Zielbild

```
PurchaseList   id, showId?, departmentId?, phaseId?, title, status
PurchaseItem   id, listId, foodItemId? | inventoryTypeId? | text, qty, unit, estPriceCents, source, assigneeId?, boughtAt?
FinanceEntry   amount → amountCents Int, + purchaseListId?
FinanceBudget  plannedAmount → plannedAmountCents, + departmentId?, + phaseId?
```

- Später: Beleg-Erkennung (OCR/KI) für Betrag, Datum, Händler; gekaufte Lager-Artikel direkt einbuchen.

## Phasen

1. Cent-Umstellung `FinanceEntry`/`FinanceBudget` mit Migration (vor allen Geld-Funktionen).
2. Baustein + Modelle, Liste mobil.
3. Beleg-Upload → FinanceEntry, Erstattung.
4. Budget Soll/Ist.
5. Doku, E2E, Release.

## Checkliste

- [ ] Phase 1 Cent-Umstellung
- [ ] Phase 2 Baustein/Liste
- [ ] Phase 3 Belege
- [ ] Phase 4 Budget
- [ ] Phase 5 Doku/E2E/Release
