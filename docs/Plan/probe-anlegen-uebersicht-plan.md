# Plan: Probe anlegen – Besetzung, Zugehörigkeit, nur besetzte Szenen

Stand: 2026-10-16 – Phase 1–4 umgesetzt (main); Entscheidungen: „nicht besetzt“ ab einer unbesetzten Rolle, Gruppen Besetzung/Gewerk/Weitere

## Ziel

Beim Anlegen einer Probe auf einen Blick sehen: **welche Szenen wirklich probbar sind**, **wer
dafür gebraucht wird** und **wo jede Person hingehört** (Rolle, Gewerk). Kompakt, mobil wie Desktop.

## Ist-Stand (Screenshots Staging 2026-10-16, Probeneditor)

- **Szenen ohne Personen gelten als „vollständig“.** `computeSceneReadiness`
  (`src/lib/calendar/scene-readiness.ts`) überspringt unbesetzte Rollen; eine Szene, deren Rollen
  niemand spielt, ist grün. Staging: „Sz. 1.1 Der Club · vollständig · 0 Leute nötig“ – im
  Vorschlag vorangehakt, im Schnellfeld ganz oben.
- **„Probe vorschlagen“** (`agenda/rehearsal-suggest-panel.tsx`) zeigt je Szene nur Dauer und
  „n× geprobt“ – nicht, welche Rollen/Personen drinstecken oder wer fehlt (`describeReadiness`
  gibt es, wird dort nicht genutzt).
- **Schnellfeld** zeigt „vollständig · noch nie geprobt · 5'“, ebenfalls ohne Personen.
- **Teilnehmerliste** (`audience-builder.tsx`) ist flach, eine Person ≈ 2–4 Zeilen; die
  Zugehörigkeit steckt in einem abgeschnittenen Grundtext („Spielt X (Sz. 1, 3) · Gewerk Y“).
  Bei 30+ Personen unübersichtlich, Gruppen (Rolle, Gewerk) nicht erkennbar.
- „Probbar“-Zeile neben dem Knopf zählt dieselben Scheinszenen mit.
- **Tagesblatt** (Tag antippen; `DayPanel` in `terminplanung/page-client.tsx`, mobil BottomSheet,
  Desktop rechte Spalte) – der eigentliche Einstieg zum Anlegen:
  - „Können nicht“: Namens-Chips mit Grund, aber **ohne Zugehörigkeit** – man sieht nicht, dass
    Peter = Theseus ist oder wer zu welchem Gewerk gehört. Lange Gründe sprengen die Chips.
  - „Diese Woche eingeladen (18)“: nur Vorname + Zähler, ungruppiert, nimmt viel Platz.
  - „Was ist probbar?“: eine große Kachel (≈ 50 px) pro Szene, bei „vollständig“ ohne jede
    Info (wer, Dauer, zuletzt geprobt); Staging zeigt „Der Club“ als vollständig, obwohl niemand
    besetzt ist. Bei 30 Szenen endlos lang, mobil weit unter der Falz.
  - Reihenfolge: Verfügbarkeit vor Szenen, obwohl man zum Anlegen zuerst die Szenen braucht.

## Zielbild

### 1. Neuer Zustand „nicht besetzt“

`computeSceneReadiness` bekommt `unbesetzt`: Szene hat eine Rolle (außer Cameo) ohne Besetzung.
Solche Szenen

- erscheinen **nicht** in „Probe vorschlagen“, Schnellfeld und „probbar“-Zähler,
- stehen nur eingeklappt am Listenende: „3 Szenen noch nicht besetzt ▸“ (aufklappbar, Rollen
  genannt, damit man die Besetzung nachholen kann – Link zur Besetzung),
- bleiben in Szenen-Plan-Ansicht sichtbar, grau mit „nicht besetzt“.

Szenen ohne eingetragene Rollen (`characterIds` leer) zählen ebenfalls als „nicht besetzt“.

### 1b. Tagesblatt neu ordnen (kompakt)

```
Fr, 23. Okt · Kerntag · Herbstferien         [+ Probe] [+ Termin]
Termine: –
Probbar 7 · mit Zweitb. 0 · fehlt 3                    31/33 können
☐ ● 1.2 Handwerker verteilen …   Squenz Zettel Bottom +3   20'  2×
☐ ● 1.3 Oberon/Titania           Oberon Titania Puck       15'  nie
☐ ● 1.1 Am Hof                   fehlt: Theseus (Peter)
▸ 3 Szenen noch nicht besetzt
Fehlt heute (2)
  Ensemble   Peter Krause (Theseus) – Familienfeier
             Ida Schulz (Hermia) – Familienfeier
  Kostüm     …
▸ Diese Woche eingeladen (18)
```

- Szenen **zuerst**, als dichte Tabellenzeilen (eine Zeile, mobil zwei): Rollen-Kürzel,
  Dauer, wie oft geprobt; fehlende Rolle rot mit Person. Haken statt „+“-Kachel, Knopf
  „Probe mit n Szenen“ klebt unten.
- „Fehlt heute“ gruppiert nach Zugehörigkeit (Rolle(n) in Klammern, Gruppen: Besetzung,
  je Gewerk, Sonstige), Grund kurz nach Bindestrich, eine Zeile pro Person.
- „Diese Woche eingeladen“ eingeklappt, nur Warnfarbe für Vielbelastete sichtbar.

### 2. „Probe vorschlagen“ mit Personen

Eine Zeile je Szene, darunter **eine** kompakte Personenzeile:

```
☑ ● Sz. 2.3 Bahnhof Bombay                       20'
    Fogg, Passepartout, Aouda · fehlt: Fix (Urlaub)
```

- Rollenkürzel (`shortName`) statt voller Namen, fehlende/eingeschränkte rot/gelb mit Grund.
- Antippen der Zeile klappt die Besetzung auf (Rolle → Person, Zweitbesetzung).
- Kopfzeile ergänzt: „7 Leute · davon 2 nur in einer Szene“.

### 3. Teilnehmer gruppiert

Teilnehmerliste nach Zugehörigkeit gruppiert, Gruppen einklappbar mit Zähler und Status-Punkten:

```
Besetzung (Szenen dieser Probe)   9 · ●●●●●●●●○
  Fogg – Anna M.            benötigt
  Passepartout – Ben K.     benötigt   ⚠ gesperrt
Gewerk Kostüm                     3
Weitere / von Hand                2
```

- Eine Zeile pro Person (Name + Rolle/Kürzel rechts), Details (Belastung, Konflikt, Absagegrund)
  nur als Symbol, ausgeklappt per Tippen.
- Person in mehreren Gruppen: in der ersten (Besetzung vor Gewerk), Zusatz „+ Gewerk Y“.
- Suche und benötigt/optional-Chip bleiben.

### 4. Ablaufpunkte

Szene im Ablauf zeigt einzeilig die Rollen-Kürzel (statt nichts), fehlende rot – gleiche
Darstellung wie im Vorschlag (eine Komponente `SceneCastLine`).

## Phasen

1. `unbesetzt` in `scene-readiness.ts` + Filter in Vorschlag/Schnellfeld/Zähler (+ Unit-Tests).
2. Tagesblatt (1b).
3. `SceneCastLine` + Vorschlag/Schnellfeld/Ablaufzeile.
4. Teilnehmer gruppiert (`audience-builder.tsx`), eine Zeile pro Person.
5. Screenshots mobil+Desktop (Demo-Daten, lokal :3200), E2E termine/bausteine anpassen, Staging.

Keine Migration nötig.

## Offene Entscheidungen

- „Nicht besetzt“ schon, wenn **eine** Rolle fehlt – oder erst, wenn **keine** Rolle besetzt ist?
- Gruppierung der Teilnehmer: nach **Besetzung / Gewerk / von Hand** (Vorschlag) oder nach
  **Szene** (Person ggf. mehrfach)?
- Gilt das Gruppieren auch für „Alle der Produktion“-Termine (dort heute gar keine Liste)?
