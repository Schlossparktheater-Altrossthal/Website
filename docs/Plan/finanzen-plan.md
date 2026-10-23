# Plan: Finanzen neu – Auslagen, Budget, Einnahmen, Kassenbuch

Stand: 2026-10-23. Entscheidungen E1–E7 getroffen, Mockup abgenommen, Phase 1 läuft. Ersetzt die im Mai 2026 entfernte Finanzverwaltung
(`8bf1c77c`) – Konzept und UI damals unbrauchbar, deshalb Neuentwurf statt Wiederherstellung.
Bündelt [`docs/Plan/einkauf-belege-plan.md`](einkauf-belege-plan.md) (Phase 1 + 3 + 4),
[`docs/Plan/gewerke-plan.md`](gewerke-plan.md) Phase 12 (Budget) und die Spenden aus
[`docs/Plan/produktionsphasen-vorstellungen-plan.md`](produktionsphasen-vorstellungen-plan.md).

## Ziel

1. **Auslage einreichen in 30 Sekunden** (Handy): Foto vom Beleg, Betrag, Gewerk – fertig.
2. **Kassenwart** prüft, erstattet, bucht – eine Eingangsliste statt Formularwüste.
3. **Gewerksleitung** sieht ihr Budget: ein Balken, darunter Ausgaben und offene Auslagen.
4. **Einnahmen** (Kartenverkauf, Abendkasse, Spenden, Förderungen) laufen automatisch bzw. mit wenig Tipparbeit ein.
5. **Kassenbuch je Geldtopf**, fortlaufend nummeriert je Produktion, festgeschriebene Buchungen nur per Storno änderbar, Export CSV/PDF für Förderverein/Kassenprüfung.
6. **Mehrere Geldtöpfe** (z. B. Förderverein, Schule, Barkasse) getrennt geführt, Umbuchungen zwischen Töpfen.

Träger ist der Förderverein (siehe Datenschutz-Plan) – Kassenbuch und Kassenprüfung richten sich nach ihm.

## Was damals schiefging (nicht wiederholen)

- Ein 700-Zeilen-Formular für alles (Einnahme, Ausgabe, Rechnung, Spende) → stattdessen **getrennte, kurze Abläufe** je Fall.
- Status `draft/pending/approved/paid/cancelled` für jeden Eintrag, auch für eine Kartenbuchung → Status nur dort, wo es einen Freigabeweg gibt (Auslagen, Rechnungen).
- Beträge als `Float` → **Cent-Integer**.
- Kategorie als Freitext → feste **Kategorien** (Kontenrahmen light) + Gewerk + Produktion.
- Finanzseite als eigene Insel → Einstieg dort, wo man arbeitet: Gewerk-Portal (Budget-Tab), Dashboard („Auslage einreichen“), Kartenbüro.

## Zielbild

```
FinanceFund       id, name, description?, kind bank|cash|other, archived            // Geldtopf
FinanceCategory   id, name, type income|expense, sortOrder, archived      // z. B. Material, Kostüm, Verpflegung, Karten, Spenden, Förderung
FinanceBudget     id, showId, departmentId?, categoryId?, plannedCents Int, notes
FinanceEntry      id, fundId, number Int (fortlaufend je Produktion, über alle Töpfe), showId, type income|expense|transfer, amountCents Int, transferFundId?,
                  bookingDate, categoryId, departmentId?, budgetId?, performanceId?,
                  counterparty?, description, source manual|expense_claim|tickets|box_office|donation,
                  sourceRef?, lockedAt?, reversalOfId?, createdById
FinanceReceipt    id, entryId? | claimId?, file (Belege-Speicher), mime, size, ocr Json?
ExpenseClaim      id, submittedById, amountCents, date, vendor?, departmentId, showId, purpose,
                  status submitted|approved|rejected|paid, payout bank|cash|donated, fundId?, reviewedById?, paidAt?, entryId?
CashCount         id, performanceId, countedCents, expectedCents, countedById, notes   // Abendkasse
```

- Bestehende Tabellen (`FinanceEntry` usw.) werden migriert oder – falls in Prod leer – ersetzt (vorher Prod-DB prüfen).
- Erstattung bar oder per Überweisung; IBAN freiwillig im Profil, verschlüsselt, nur Kassenwart sieht sie.
- Spendenquittung vorbereitet: Auslage „spenden“ (`payout donated`) und Spenden erzeugen später eine Zuwendungsbestätigung (PDF); Felder Spendername/-anschrift vorsehen.
- Belegerkennung nur vorbereitet: `FinanceReceipt.ocr` bleibt leer, Formular so bauen, dass Vorschläge später eingesetzt werden können.
- Keine Steuer-Sphären, kein DATEV, kein Kontoauszug-Import.
- **Festschreiben**: Buchungen eines Monats/Jahres werden gesperrt (`lockedAt`); Korrektur nur per Storno-Buchung (`reversalOfId`). Löschen gibt es nicht.

## Rollen & Rechte

- `FINANCE.CLAIM.SUBMIT` – alle Mitglieder einer Produktion (Auslagen einreichen, eigene sehen).
- `FINANCE.DEPARTMENT.VIEW` – Gewerksleitung/Vertretung: Budget + Ausgaben des eigenen Gewerks, Auslagen vorprüfen („sachlich richtig“).
- `FINANCE.MANAGE` – Kassenwart: alles buchen, erstatten, Budgets, Festschreiben, Export.
- `FINANCE.VIEW` – Vorstand/Kassenprüfung: alles lesen, Export.

## UI-Skizze

- **Auslage einreichen** (Dashboard-Kachel + Gewerk-Portal): Kamera/Datei → Betrag, Datum, Gewerk vorausgefüllt → Zweck → Senden. Optional OCR-Vorschlag für Betrag/Datum/Händler.
- **Meine Auslagen** (Profil): Liste mit Status-Chips, Push/E-Mail bei Erstattung.
- **Kassenwart-Eingang** `/mitglieder/finanzen`: Tabs `Eingang · Kassenbuch · Budgets · Berichte`. Eingang = Karten mit Belegvorschau, Wischen/Buttons „Erstatten“, „Ablehnen (Grund)“. Sammel-Erstattung als SEPA-Liste (Überweisungsliste/pain.001 optional).
- **Budget-Tab im Gewerk** (Gewerke Phase 12): Balken Ausgaben + offene Auslagen / Budget, Liste darunter.
- **Produktion-Übersicht**: Einnahmen vs. Ausgaben je Produktion, nach Kategorie/Gewerk.
- **Abendkasse**: im Einlass Kassensturz je Vorstellung (gezählt vs. erwartet aus Kartenbuchung) → Einnahmebuchung.

Mockup: `docs/Plan/mockups/finanzen-mockup.html` (2026-10-23). Vor UI-Umsetzung HTML-Mockups mobil + desktop (Vorbilder: Dashboard, Sperrliste-BottomSheet).

## Phasen

1. **Datenmodell neu**: Cent-Integer, Kategorien, Geldtöpfe, Nummernkreis je Produktion, Festschreiben/Storno, Rechte. Prod-Altdaten geprüft 2026-10-23: nur 1 Testbuchung („kljwf“, 10 €) + 4 Logs, 0 Budgets → alte Tabellen ersetzen statt migrieren.
2. **Auslagen**: Einreichen mobil, Belege-Upload, Meine Auslagen, Vorprüfung Gewerk, Kassenwart-Eingang, Erstattung → Buchung.
3. **Kassenbuch**: Liste, manuelle Buchung (Rechnung, Förderung, Spende), Umbuchung zwischen Töpfen, Filter, Festschreiben, Storno.
4. **Budgets**: je Produktion/Gewerk/Kategorie, Budget-Tab im Gewerk-Portal, Objektkosten aus Szenenbedarf.
5. **Einnahmen automatisch**: Kartenbuchung/Freikarten (Online-Zahlung gibt es nicht → Abendkasse/Kartenbüro), Kassensturz je Vorstellung, Spenden mit Vorstellungsbezug.
6. **Berichte & Export**: Produktionsabschluss/Kassenbericht je Topf als PDF (MB-PDF-Engine), CSV, Belege als ZIP, Zuwendungsbestätigung vorbereiten.
7. **Einkauf**: Einkaufslisten aus `einkauf-belege-plan.md` Phase 2 an die Finanzen anbinden.
8. Später: Belegerkennung (OCR/KI).
9. Doku, E2E, Release.

## Entscheidungen (2026-10-23)

- E1: Kein Geschäftsjahr – Zeitraum ist die **Produktion**; Nummernkreis je Produktion (über alle Töpfe, z. B. „S27-041“), Abschluss je Produktion und Topf. Buchungen ohne Produktion (laufende Vereinskosten) → Zeitraum „Allgemein“ je Jahr (entschieden 2026-10-23).
- E2: Keine steuerliche Abrechnung, keine Sphären.
- E3: Export CSV + PDF, kein DATEV.
- E4: Erstattung bar oder Überweisung; Spendenquittung vorsehen (Phase 6).
- E5: Kein Kontoauszug-Abgleich (vorerst).
- E6: Mehrere **Geldtöpfe** getrennt führen (`FinanceFund`), Budgets und Berichte je Topf filterbar.
- E7: Belegerkennung später, nur vorbereiten.

## Checkliste

- [x] Entscheidungen E1–E7
- [x] Mockups
- [ ] Phase 1 Datenmodell
- [ ] Phase 2 Auslagen
- [ ] Phase 3 Kassenbuch
- [ ] Phase 4 Budgets
- [ ] Phase 5 Einnahmen
- [ ] Phase 6 Berichte/Export
- [ ] Phase 7 Einkauf
- [ ] Phase 8 Doku/E2E/Release
