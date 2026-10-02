# Plan: Lager & Inventar (Technik, Kostüm, Requisite, Bühnenbau, Werkzeug)

Stand: 2026-10-02. Phase 1–7 und Teile von Phase 8 umgesetzt (auf main), offen: Sets, Kostümgrößen ↔ Körpermaße, Release. Checkliste am Ende wird gepflegt.

## Ziel

Alles, was dem Verein gehört, wird mit einem QR-Etikett erfasst und lässt sich im Lager schnell
und mit dem Handy verwalten: finden, ein- und umlagern, ausgeben und zurücknehmen, Mängel
melden, Elektroprüfungen eintragen und Inventur machen – auch zu mehreren gleichzeitig. Wer ein
Etikett ohne Login scannt, sieht trotzdem, was das ist und ob es benutzt werden darf.

## Ist-Stand (Befunde)

| #   | Befund                                                                                  | Stelle                            |
| --- | --------------------------------------------------------------------------------------- | --------------------------------- |
| 1   | Altes Modell `InventoryItem` (Freitext-Ort, feste Technik-Kategorien), keine Oberfläche | `prisma/schema.prisma`            |
| 2   | Offline-Sync-Scope `inventory` mit Dexie-Tabelle und Realtime-Event, ohne Nutzer        | `src/lib/offline`, `src/lib/sync` |
| 3   | `qrcode` und `pdfkit` bereits vorhanden                                                 | `package.json`                    |

## Entscheidungen (2026-10-02)

- E1: Bestand wird **neu erfasst**, kein Excel-Import. Das alte Inventar hatte keine nützlichen
  Daten und wird samt Offline-Sync-Scope entfernt (keine Altlasten).
- E2: Etiketten zunächst auf **A4-Bögen** (PDF). Vorlagen für gängige Formate plus eigenes Raster.
- E3: Bereiche Technik (T), Kostüm (K), Requisite (R), Bühnenbau (B), Werkzeug (W); `L` ist für
  Lagerorte reserviert. Bereiche und Kategorien sind pflegbar.
- E4: Scan ohne Login zeigt eine **öffentliche Seite** `/i/<code>`: Name, Foto, Bereich, Status,
  Sperre, Prüfstatus, öffentlicher Hinweis – nie Preise, Kaufdaten, Notizen oder Personen.
  Mitglieder mit Lagerzugriff werden direkt auf die Lageransicht weitergeleitet.
- E5: **Elektroprüfung (DGUV V3)** ist Teil des Lagers. Eintragen darf jede Person mit
  Lagerzugriff. „Nicht bestanden“ sperrt das Objekt automatisch.
- E6: Zwei Rechte: `PRIVATE.INVENTORY.USE` (alles Tägliche inkl. Erfassen, Prüfen, Inventur
  mitzählen) und `PRIVATE.INVENTORY.MANAGE` (Bereiche, Orte, Preise, Ausmustern, Inventur
  starten/abschließen). Vergabe über Rollen oder Gewerke in der Rechteverwaltung.
- E7: Lagerbetrieb bekommt eigene Komponenten (Scanner, Scan-Werkbank, Etiketten-Designer), weil
  die Abläufe (Dauerscan, eine Hand, Handschuhe) andere Anforderungen haben als Formularseiten.
- E8: Inventur ohne den alten Offline-Sync: Scans landen zuerst im Gerätespeicher und werden mit
  einer eindeutigen `clientScanId` gesendet – offline und bei Wiederholung zählt nichts doppelt.

## Datenmodell

- `InventoryArea` (Präfix, Zähler, Prüfpflicht-Standard), `InventoryCategory`
- `InventoryLocation` – Baum mit eigenem Code `L-0001`
- `InventoryAsset` – `kind`: Einzelstück / Mengenartikel / Kiste; unveränderlicher Code; Ort oder
  Kiste; Status (im Lager, ausgegeben, Reparatur, gesperrt, vermisst, ausgemustert) wird aus Mängeln
  und Ausgaben abgeleitet; bereichsspezifische Felder in `attributes`
- `InventoryStock` – Bestand eines Mengenartikels je Ort/Kiste
- `InventoryPhoto`, `InventoryDefect`, `InventoryInspection` (mit Protokoll), `InventoryEvent` (Verlauf)
- `InventoryCheckout` + `InventoryCheckoutLine` – Ausgaben mit Packliste
- `InventoryStocktake` + `InventoryStocktakeScan` – Inventur

## UI-Konzept

- Bereichs-Navigation (höchstens sechs Einträge): Bestand, Scannen, Ausgaben, Inventur, Prüfungen,
  Orte. Etiketten, CSV und Bereiche als Schaltflächen im Bestand.
- Startseite: große Kacheln „Scannen“ und „Erfassen“, Kennzahlen (Mängel, Prüfungen, Ausgegeben,
  ohne Etikett), Hinweise (laufende Inventur, Mindestbestand), Liste mit Suche und Filtern.
- Erfassen: Foto, Bereich, Art, Name, Ort zuerst; Rest aufklappbar; „Speichern & weiter“ behält
  Bereich, Art und Ort für Serienerfassung und bietet Etiketten für die Runde an.
- Detail: Schnellaktionen Umlagern/Bestand, Mangel, Prüfung, Foto; Menü für Seltenes.
- Scanner: Modi Info, Einlagern (Ziel scannen, dann Objekte), Ausgeben, Zurück, Prüftag;
  Ton und Vibration, Taschenlampe, Eingabezeile für Hand-Scanner.
- Mobil BottomSheet, Desktop Dialog (`ResponsivePanel`).

## Phasen

1. Datenmodell, Migration, Rechte, Domänenlogik
2. Bestand, Erfassen, Detail, Orte, Bereiche, öffentliche Scan-Seite
3. Etikettendruck A4 (Vorlagen, eigenes Raster, Startfeld, Probedruck)
4. Scanner und Lager-Workflow
5. Ausgaben mit Packliste, „Fehlt noch“, Rücknahme per Scan
6. Inventur parallel und offline, Live-Fortschritt je Zone, Abgleich
7. Elektroprüfung: Übersicht, Sammel-Eintrag, Prüftag-Scan, Monatserinnerung
8. Mindestbestand, CSV-Export (Wertliste), Sets, Kostümgrößen ↔ Körpermaße
9. Altlast entfernen (altes Inventar und Offline-Sync-Scope)
10. E2E, Staging-Abnahme, Release

## Offen

- Sets/Bausätze (Funkstrecke = Sender + Empfänger + Antenne)
- Kostüm-Vorschläge passend zu Körpermaßen
- Etikettendrucker (Brother QL o. Ä.), sobald vorhanden

## Checkliste

- [x] Phase 1 Datenmodell, Rechte, Domänenlogik
- [x] Phase 2 Seiten und öffentliche Scan-Seite
- [x] Phase 3 Etiketten
- [x] Phase 4 Scanner
- [x] Phase 5 Ausgaben
- [x] Phase 6 Inventur
- [x] Phase 7 Elektroprüfung
- [ ] Phase 8 – Mindestbestand und CSV erledigt, Sets und Kostümgrößen offen
- [x] Phase 9 Altlast entfernt
- [ ] Phase 10 – E2E (`e2e/lager.spec.ts`) lokal grün, Staging-Abnahme und Release offen
