# Inventar-/Lagerverwaltung – Plan

Stand: 2026-10-02. Ersetzt das alte `InventoryItem` (nur Modell + Offline-Sync, keine UI).

## Entscheidungen

- Bestand wird **neu erfasst**, kein Excel-Import (alte Liste veraltet).
- Labeldruck zunächst nur **A4-Etikettenbögen** (PDF via `pdfkit`), Etikettendrucker später.
- Bereiche: **Technik, Kostüm, Requisite, Bühnenbau, Werkzeug** (erweiterbar).
- Scan ohne Login zeigt öffentliche Infos (Name, Foto, Bereich, Status/Sperre, Prüfstatus, Hinweise, Kontakt) –
  **nie** Preise, Wert, Kaufdatum, interne Notizen.
- **Elektroprüfung (DGUV V3)** kommt rein.
- Offline-Sync (Dexie, ereignisbasiert) bleibt als Basis für Lager ohne WLAN.

## Datenmodell (Entwurf)

- `InventoryArea` – Bereich mit Code-Präfix (`T`, `K`, `R`, `B`, `W`), Verantwortliche über Gewerke.
- `InventoryLocation` – Baum (Lager → Raum/Regal → Fach). Kisten/Cases sind **Objekte** mit Label (`C-…`),
  die selbst einen Ort haben; Inhalt wandert beim Umlagern mit.
- `InventoryItem` – `kind`: `unique` (Einzelstück, eigener Ort/Zustand) | `bulk` (Mengenartikel).
  Code unveränderlich (`T-0042`), QR = URL `/i/<code>`. Bereichsspezifische Felder als JSON
  (Kostüm: Größe, Epoche, Farbe, Material). Öffentliche vs. interne Felder klar getrennt.
- `InventoryStock` – Menge eines Bulk-Artikels pro Ort/Kiste, optional Mindestbestand.
- `InventoryDefect` – Foto, Beschreibung, Schwere (`cosmetic` | `limited` | `locked`), Status
  (`open` → `repair` → `done`). `locked` sperrt das Objekt.
- `InventoryEvent` – Verlauf (append-only): eingelagert, umgelagert, ausgegeben, zurück, Mangel, Prüfung, Inventur-Scan.
- `InventoryCheckout` – Ausgabe an Produktion / Termin / Person / extern, Packliste, Rücknahme.
- `InventoryInspection` – Prüfintervall, letzte/nächste Prüfung, Ergebnis, Protokoll-Datei.
- `InventoryStocktake` + Zuständigkeiten pro Ort – Inventur-Sitzung, Scans als Events, Abgleich am Ende.
- Später: `InventorySet` (Bausätze).

## Phasen

1. Datenmodell + Migration (altes `InventoryItem` ablösen, Sync-Scope anpassen), Rechte pro Bereich.
2. Liste/Suche, Detailseite, Anlegen mit Foto (mobil schnell), öffentliche Scan-Seite `/i/<code>`.
3. Labeldruck A4 (Avery-Raster wählbar, Serien-/Auswahldruck, „alle ohne Label“).
4. Scanner + Lager-Workflow: Dauerscan mit vorgewählter Aktion (Einlagern/Umlagern), Mangel melden.
5. Ausgabe/Rücknahme, Packliste je Produktion, „Was fehlt noch?“.
6. Inventur: parallel, offline, Live-Fortschritt via Realtime, Abgleich (fehlt / falscher Ort / unbekannt).
7. Elektroprüfung: Intervalle, Fälligkeits-Benachrichtigung, Protokolle, Ampel auf Scan-Seite und Label.
8. Mindestbestand, Sets, Kostüm-Größen ↔ Körpermaße, Wertexport für Versicherung.

## Offen

- UI-Konzept erst nach Staging-Screenshots (Muster: Dashboard, Sperrliste-BottomSheet).
- Konkretes Etikettenformat (Avery-Nummer) – sobald Bögen gekauft sind.
- Wer Prüfungen eintragen darf (Elektrofachkraft/befähigte Person).
