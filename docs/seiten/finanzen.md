# Finanzen

## Zweck

Auslagen der Mitglieder einreichen, durch das Gewerk prüfen und vom Kassenwart erstatten
lassen; Kassenbuch je Produktion („Allgemein“ je Jahr für laufende Vereinskosten) mit
getrennten Geldtöpfen. Plan und Entscheidungen: `docs/Plan/finanzen-plan.md`.

## Routen

- `/mitglieder/finanzen/auslagen` – Meine Auslagen (alle Mitglieder); Gewerksleitung und
  Vertretung sehen oben „Zu prüfen“ mit den Auslagen ihres Gewerks.
- `/mitglieder/finanzen` – Kassenwart/Prüfer: Tabs `Eingang`, `Kassenbuch` (`?tab=kassenbuch`,
  Filter `zeitraum`, `topf`, `art`, `kategorie`, `gewerk`, `q`), `Einnahmen` (`?tab=einnahmen&zeitraum=`), `Budgets`
  (`?tab=budgets&zeitraum=`), `Berichte` (`?tab=berichte&zeitraum=&topf=`) und `Töpfe` (`?tab=toepfe`).
  Ohne Finanzrecht Weiterleitung auf Meine Auslagen.
- `/api/finanzen/export?zeitraum=&topf=&format=pdf|csv|zip` – Kassenbericht (PDF-Vorlage
  `kassenbericht`), Kassenbuch als CSV (Semikolon, UTF-8 mit BOM), Belege als ZIP; nur mit Finanzrecht.
- `/api/finanzen/belege/<id>` – Beleg (Foto/PDF) für Einreicher, Gewerksleitung, Kassenwart, Prüfer.

## Ablauf Auslage

1. Einreichen (Bottom-Sheet): Belegfoto(s)/PDF (Fotos im Browser verkleinert, max. 5), Betrag,
   Zweck, Produktion oder Allgemein, Gewerk, Datum, optional Händler/Kategorie, Erstattung
   Bar/Überweisung/PayPal/Spenden. Zahlungsdaten kommen aus dem Profil (`?bereich=zahlungen`).
2. Mit Gewerk: Leitung/Vertretung bestätigt („Passt ✓“) oder lehnt mit Grund ab. Reicht die
   Leitung selbst ein oder hat das Gewerk keine, entfällt der Schritt.
3. Kassenwart: „Erstatten + buchen“ (Topf, Buchungsdatum) erzeugt eine Ausgabe im Kassenbuch;
   bei „Spenden“ zusätzlich die Spende als Einnahme. „Nur freigeben“ für spätere Sammel-Erstattung.
4. Benachrichtigungstyp `expense-claim` an Gewerk → Kassenwart → einreichende Person.

## Kassenbuch

- Zeitraum-Auswahl: aktive Produktion (Standard) und „Allgemein“ des Jahres werden bei Bedarf
  angelegt (`loadPeriodOptions`). Nummern laufen je Zeitraum über alle Töpfe (`S27-041`).
- Kennzahlen: Einnahmen/Ausgaben ohne Umbuchungen, Stornos mindern die ursprüngliche Richtung;
  mit Topf-Filter enthält der Saldo die Umbuchungen (`summarize` in `lib/finance/book.ts`).
- Buchen/Bearbeiten im Bottom-Sheet (Ausgabe, Einnahme, Umbuchung), Belege anhängen,
  Spender + Anschrift bei Kategorie „Spenden“ (für spätere Zuwendungsbestätigung).
- Detail-Sheet: Bearbeiten (nur nicht festgeschrieben, keine Stornos), Stornieren (Gegenbuchung
  mit neuer Nummer), „Bis hier festschreiben“ (nur vorwärts, nicht rückgängig).

## Einnahmen je Vorstellung

- Tab `Einnahmen` listet die Vorstellungen der Produktion des Zeitraums (`lib/finance/income.ts`).
  Aus der Kartenbuchung: Abendkasse verkauft (`source box_office`), an der Tür kassiert
  (Einlass-Aktion „pay“, erkannt an der `ReservationCheckIn`-Zeile „Zahlung“), vorab bezahlt,
  noch offen. Daneben, was im Kassenbuch mit `performanceEventId` steht (Stornos verrechnet).
- **Kassensturz** (`CashCount`): gezählt gegen erwartet (Abendkasse + an der Tür kassiert),
  bucht den gezählten Betrag als Einnahme „Abendkasse“ (`source box_office`), Differenz im
  Protokoll und als Hinweis auf der Karte. Mehrere Kassenstürze je Vorstellung möglich
  (z. B. zweite Kasse), Fehler per Storno im Kassenbuch.
- **Vorverkauf buchen**: noch nicht gebuchte vorab bezahlte Karten als Einnahme „Kartenverkauf“
  (`source tickets`). **Spende**: mit oder ohne Spender (Spendenkasse), Kategorie „Spenden“.
- Bewusst online im Finanzbereich, nicht im (offline-fähigen) Einlass.

## Berichte

- Tab `Berichte`: Kennzahlen, Summen nach Kategorie und Gewerk, Downloads. Der PDF-Kassenbericht
  enthält Übersicht, Töpfe (Zu-/Abfluss inkl. Umbuchungen), Kategorien, Gewerke, Spendenliste
  (Grundlage für Zuwendungsbestätigungen) und das Kassenbuch mit Stornos (`lib/finance/report.ts`).

## Budgets

- Budget = Soll je Zeitraum, optional eingeschränkt auf Gewerk, Kategorie und Topf (leer = alle).
  Ist = passende Ausgaben minus Stornos; offene Auslagen (eingereicht/freigegeben) separat, ohne
  zugeordneten Topf zählen sie für jedes Topf-Budget (`lib/finance/budgets.ts`).
- Gewerk-Portal: Baustein `budget` (Blaupause) zeigt den Tab „Budget“ für Leitung, Vertretung und
  Finanzrechte – Balken, Auslagen zum Prüfen, Ausgaben des Gewerks, geschätzte Objektkosten
  (`ProductionObject.costCents`, nur zur Planung).

## Permissions

- keine – Auslagen einreichen und eigene sehen (jedes Mitglied)
- `PRIVATE.FINANCE.VIEW` – alles lesen (Vorstand, Kassenprüfung)
- `PRIVATE.FINANCE.MANAGE` – Kassenwart: erstatten, buchen, Töpfe pflegen, IBANs sehen
- Gewerksleitung/Vertretung über die Gewerk-Zugehörigkeit (`lib/finance/access.ts`)

## Daten & Logik

- `src/lib/finance/`: `ledger.ts` (Buchen mit Nummernkreis, Ändern bis Festschreiben, Storno,
  Salden je Topf), `periods.ts` (Zeitraum je Produktion `S27`, Allgemein `A26`),
  `claims.ts` (Auslagen), `access.ts`, `receipts.ts`.
- Beträge immer positive Cent-Integer, Richtung über `type` (income/expense/transfer).
- Belege als Bytes in `FinanceReceipt` (wie Ausstattungsfotos).

## Offene Baustellen

Einnahmen aus Kartenverkauf/Abendkasse, Berichte/Export
(Phasen 5–6 im Plan). IBAN im Profil ist noch unverschlüsselt (Altbestand).
