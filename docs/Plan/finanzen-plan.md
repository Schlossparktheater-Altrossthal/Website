# Plan: Finanzen neu – Auslagen, Budget, Einnahmen, Kassenbuch

Stand: 2026-10-23. Entscheidungen E1–E7 getroffen, Mockup abgenommen, Phase 1–4 umgesetzt, offen Phase 5–8. Ersetzt die im Mai 2026 entfernte Finanzverwaltung
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

## Zielbild (umgesetzt, Stand Phase 4)

Schema in `prisma/schema.prisma` (Migrationen `20261023180000_finance_rebuild`,
`20261023200000_finance_receipts_payout`):

```
FinanceFund       Geldtopf: name, kind bank|cash|other, archivedAt
FinancePeriod     Zeitraum: kind production (showId, Code „S27“) | general („Allgemein 2026“, Code „A26“),
                  nextNumber (Nummernkreis), lockedThrough (festgeschrieben bis Nr.), closedAt
FinanceCategory   name, type income|expense (12 Startkategorien per Migration)
FinanceBudget     periodId, fundId?, departmentId?, categoryId?, plannedCents, notes
FinanceEntry      periodId, number, fundId, transferFundId? (nur transfer), type income|expense|transfer,
                  amountCents (>0), bookingDate, description, counterparty?, categoryId?, departmentId?,
                  objectId?, performanceEventId? (CalendarEvent), source manual|expense_claim|box_office|tickets|donation,
                  donorName?/donorAddress? (Spendenquittung), reversalOfId? (Storno), createdById
ExpenseClaim      periodId, submittedById, amountCents, spentOn, purpose, vendor?, departmentId?, categoryId?,
                  payout cash|bank|paypal|donated, status submitted|approved|rejected|paid,
                  departmentChecked*, reviewed*, rejectReason, fundId?, entryId?
FinanceReceipt    Bytes in der DB (wie Ausstattungsfotos), entryId? | claimId?, ocr Json? (leer)
FinanceLog        Protokoll je Buchung/Auslage (action, data)
```

- Beträge immer positive Cent-Integer, Richtung über `type`. Löschen von Buchungen gibt es nicht.
- **Festschreiben** je Zeitraum bis zu einer Buchungsnummer (`lockedThrough`), danach nur Storno.
- Zahlungsdaten für Erstattungen kommen aus den **bestehenden Profilfeldern** `User.payout*`
  (IBAN, Kontoinhaber, PayPal) – Abweichung vom Entwurf: dort noch **unverschlüsselt** (offen).
- `CashCount` (Kassensturz) ist noch nicht angelegt → Phase 5.

## Code-Überblick

- `src/lib/finance/`: `ledger.ts` (Buchen mit Nummernkreis, Ändern, Storno, Festschreiben, Salden),
  `periods.ts`, `claims.ts` (Auslagen + Benachrichtigungen), `book.ts` (Kassenbuch-Abfragen,
  Kennzahlen `summarize`), `budgets.ts` (Soll/Ist), `access.ts`, `receipts.ts`, `constants.ts`, `paths.ts`.
- `src/lib/format/money.ts` (Cent formatieren/parsen, gemeinsam mit Ausstattung).
- Seiten: `src/app/(members)/mitglieder/finanzen/` (`page.tsx` Tabs Eingang/Kassenbuch/Budgets/Töpfe,
  `auslagen/page.tsx`, `actions.ts`), Beleg-Route `src/app/api/finanzen/belege/[id]`,
  Gewerk-Tab `src/app/(members)/mitglieder/meine-gewerke/budget/department-budget.tsx`.
- Komponenten: `src/components/finance/` (my-claims, claim-inbox, claim-ui, cash-book, budget-manager,
  budget-bar, fund-manager).
- Tests: `src/lib/finance/__tests__/` (ledger, book, budgets). Seiten-Doku: `docs/seiten/finanzen.md`.
- Seeds: `prisma/seed.mjs` (CI-E2E, nur Töpfe), `scripts/demo/seed.ts` (Demo inkl. Buchungen/Auslagen).

## Rollen & Rechte (umgesetzt)

- Auslagen einreichen und eigene sehen: **jedes Mitglied, ohne eigenes Recht**.
- Gewerksleitung/Vertretung: über die Gewerk-Zugehörigkeit (`lib/finance/access.ts`), kein Recht –
  Auslagen des Gewerks prüfen, Budget-Tab sehen.
- `PRIVATE.FINANCE.MANAGE` – Kassenwart: buchen, erstatten, Budgets, Töpfe, Festschreiben, IBANs sehen.
- `PRIVATE.FINANCE.VIEW` – Vorstand/Kassenprüfung: alles lesen.
- Beide Rechte sind **keiner Rolle zugewiesen** (nur Owner/Admin haben sie) – in Prod vor Nutzung
  vergeben.

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
8. **Doku, E2E, Release** (inkl. offene Punkte unten).
9. Später: Belegerkennung (OCR/KI).

## Entscheidungen (2026-10-23)

- E1: Kein Geschäftsjahr – Zeitraum ist die **Produktion**; Nummernkreis je Produktion (über alle Töpfe, z. B. „S27-041“), Abschluss je Produktion und Topf. Buchungen ohne Produktion (laufende Vereinskosten) → Zeitraum „Allgemein“ je Jahr (entschieden 2026-10-23).
- E2: Keine steuerliche Abrechnung, keine Sphären.
- E3: Export CSV + PDF, kein DATEV.
- E4: Erstattung bar oder Überweisung; Spendenquittung vorsehen (Phase 6).
- E5: Kein Kontoauszug-Abgleich (vorerst).
- E6: Mehrere **Geldtöpfe** getrennt führen (`FinanceFund`), Budgets und Berichte je Topf filterbar.
- E7: Belegerkennung später, nur vorbereiten.

## Hinweise für Phase 5 (Einnahmen)

- Kartenverkauf liegt in `src/lib/karten/` (Plan `docs/Plan/kartenbuchung-plan.md`). Abendkasse und
  Kassieren laufen über `applyDoorMutations` in `src/lib/karten/checkin.ts` (Aktionen `sale` und
  `pay`, offline gepuffert); Reservierungen haben `paymentStatus` (`ReservationPaymentStatus`),
  Preise in `TicketCategory.priceCents`. Vorstellungen sind `CalendarEvent` (+ `PerformanceTicketing`).
- Idee: „erwartet“ je Vorstellung aus Verkäufen/kassierten Reservierungen berechnen, im Einlass
  einen Kassensturz erfassen (neues Modell `CashCount`: eventId, countedCents, expectedCents,
  countedById, notes) und daraus eine Einnahme `source box_office` mit `performanceEventId` in den
  Bar-Topf buchen. Vorverkauf im Kartenbüro analog als `source tickets`.
- Vor UI erst Mockup/Screenshots (Einlass-Ansicht ist offline-fähig – Kassensturz muss das auch
  berücksichtigen oder bewusst online-only sein; mit User klären).

## Offene Punkte (außerhalb der Phasen)

- Rechte `PRIVATE.FINANCE.*` in Prod an Rollen vergeben; Geldtöpfe anlegen.
- Baustein „Budget“ je Gewerk in der Blaupause einschalten (sonst kein Budget-Tab).
- IBAN im Profil verschlüsseln (Altbestand `User.payoutIban`, Klartext).
- Dashboard-Kachel „Auslage einreichen“ (UI-Skizze) fehlt noch.
- Sammel-Erstattung (Liste freigegebener Auslagen per Überweisung) fehlt – „Nur freigeben“ existiert.
- Kategorien/Töpfe umbenennen/archivieren: Töpfe ja, Kategorien noch ohne Oberfläche.
- Noch nicht in Prod: alles seit Phase 1 ist auf `main`/Staging, kein Release.
- Staging-Testdaten (`stg-*`-IDs) werden nachts durch den DB-Sync überschrieben; SQL-Vorlage war
  nur lokal (/tmp) – bei Bedarf neu schreiben.

## Checkliste

- [x] Entscheidungen E1–E7
- [x] Mockups
- [x] Phase 1 Datenmodell (2026-10-23): Migration `20261023180000_finance_rebuild`, `src/lib/finance/` (Zeiträume, Nummernkreis, Storno, Festschreiben, Salden), Rechte `PRIVATE.FINANCE.MANAGE`/`.VIEW`, Startkategorien, Demo-Seed
- [x] Phase 2 Auslagen (2026-10-23): Einreichen mobil, Meine Auslagen, Gewerk-Prüfung, Kassenwart-Eingang, Erstatten/Spende → Buchung, Töpfe-Tab; Zahlungsdaten aus dem Profil (vorhandene Felder, PayPal als Weg ergänzt), Belege als Bytes in der DB
- [x] Phase 3 Kassenbuch (2026-10-23): Tab Kassenbuch mit Zeitraum-/Topf-/Art-/Kategorie-/Gewerk-Filter und Suche, Kennzahlen (Stornos verrechnet), Buchen/Bearbeiten/Umbuchen mit Belegen und Spender-Feldern, Storno und Festschreiben im Detail-Sheet
- [x] Phase 4 Budgets (2026-10-23): Tab Budgets (Soll je Zeitraum, optional Gewerk/Kategorie/Topf, Ist = passende Ausgaben minus Stornos, offene Auslagen), Baustein „Budget“ im Gewerk-Portal für Leitung/Vertretung und Finanzrechte (Balken, Zu prüfen, Ausgaben, geschätzte Objektkosten)
- [ ] Phase 5 Einnahmen
- [ ] Phase 6 Berichte/Export
- [ ] Phase 7 Einkauf
- [ ] Phase 8 Doku/E2E/Release
