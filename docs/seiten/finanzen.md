# Finanzen

## Zweck

Auslagen der Mitglieder einreichen, durch das Gewerk prüfen und vom Kassenwart erstatten
lassen; Kassenbuch je Produktion („Allgemein“ je Jahr für laufende Vereinskosten) mit
getrennten Geldtöpfen. Plan und Entscheidungen: `docs/Plan/finanzen-plan.md`.

## Routen

- `/mitglieder/finanzen/auslagen` – Meine Auslagen (alle Mitglieder); Gewerksleitung und
  Vertretung sehen oben „Zu prüfen“ mit den Auslagen ihres Gewerks.
- `/mitglieder/finanzen` – Kassenwart/Prüfer: Tabs `Eingang` und `Töpfe` (`?tab=toepfe`).
  Ohne Finanzrecht Weiterleitung auf Meine Auslagen.
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

Kassenbuch, Umbuchung, Budgets, Einnahmen aus Kartenverkauf/Abendkasse, Berichte/Export
(Phasen 3–6 im Plan). IBAN im Profil ist noch unverschlüsselt (Altbestand).
