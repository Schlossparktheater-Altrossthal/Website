# Plan: Handy-Darstellung – horizontales Überlaufen und Miniatur-Zoom

Stand: 2026-09-29. Phase 0 und Phase 1 umgesetzt; Umsetzung geht mit Phase 2 weiter. Checkliste am Ende wird gepflegt.

## Ziel

Desktop-Chromium meldete alle Mitgliederseiten als überlauffrei, während auf dem iPhone des
Nutzers Boxen über den Rand laufen und die Seite zeitweise in einer Breite von 804 px bei einem
402 px breiten Gerät gerechnet wird – das ist die Miniatur-Ansicht aus Bild 5. Dieser Plan
schließt die Lücke: Er macht den Fehler in der Engine des Geräts sichtbar und nimmt ihm dann
systemisch die Ursache.

1. Überlauf in WebKit reproduzierbar machen und die schuldige Box benennen können.
2. Die systemische Schwachstelle beheben, nicht nur die gemeldeten Einzelfälle.
3. Prüfnetz so erweitern, dass WebKit und Detailrouten dauerhaft mitgeprüft werden.
4. Doku und Responsiveness-Matrix auf den gemessenen Stand bringen.

## Ist-Stand (Befunde)

| #   | Befund                                                                                                                                                                   | Stelle                                                                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| 1   | Alle Playwright-Projekte liefen mit Chromium, auch das Projekt `mobile` – die Engine des betroffenen Geräts (WebKit/Safari) wurde nie geprüft.                           | `playwright.config.ts`, `scripts/lib/e2e-session.mjs`                              |
| 2   | `grid gap-N <breakpoint>:grid-cols-M` ohne Basis-Spalte erzeugt auf dem Handy eine implizite `auto`-Spalte, deren Basismaß der min-content der Inhalte ist. 117 Stellen. | `src/**` (117 Treffer)                                                             |
| 3   | Belegt: Eine Karte wurde 412 px breit in einem 402 px breiten Viewport, weil ein langer unumbrechbarer Wert (Dateisystem-Pfad) die `auto`-Spur aufriss.                  | `server-analytics-content.tsx` (Zeile 1065)                                        |
| 4   | Telemetriebeleg: Das Gerät des Nutzers meldete 13-mal eine Layout-Breite von 804 px bei 402 px Gerätebreite – doppelt so breit, damit `md:` aktiv und `lg:` inaktiv.     | `AnalyticsDeviceSnapshot`, `src/hooks/useWebVitals.ts`                             |
| 5   | Die Messung gegen einen kalten `next dev` erzeugte fünf Fehlbefunde; `networkidle` feuert auch mit sichtbaren Skeletons.                                                 | `e2e/responsive-overflow.spec.ts`, `scripts/lib/e2e-session.mjs`                   |
| 6   | Der Überlauf-Test kannte nur einen Teil der Routen, keine Detailrouten und nannte keine schuldige Box.                                                                   | `e2e/responsive-overflow.spec.ts`                                                  |
| 7   | `SegmentedControl` kann nie unter die Summe seiner Labels schrumpfen: kein `flex-wrap`, kein `overflow-x-auto`, Segmente `whitespace-nowrap`.                            | `src/components/ui/segmented-control.tsx:43-61`                                    |
| 8   | `SectionNav` hat weder `flex-wrap` noch `overflow-x-auto`; die Einträge haben kein `whitespace-nowrap`.                                                                  | `src/components/ui/section-nav.tsx:34-50`                                          |
| 9   | Werkzeugzeile der Terminplanung: Umschalter „Alle / Proben / Termine“ nicht schrumpfbar, rechte Gruppe rutscht in eine zweite Zeile.                                     | `src/app/(members)/mitglieder/terminplanung/page-client.tsx:248-289`               |
| 10  | Werkzeugzeile der Sperrliste ohne `flex-wrap`; „Mein Kalender / Team“ plus `ml-auto`-Aktionen laufen über.                                                               | `src/app/(members)/mitglieder/sperrliste/page-client.tsx:148-184`                  |
| 11  | Kartenkopf der Zuweisung ohne `flex-wrap`; die rechte Gruppe ist etwa 200 px fix, der Titel wird auf etwa 100 px gestaucht.                                              | `src/app/(members)/mitglieder/produktionen/zuweisung/assignment-board.tsx:855-903` |

Ergebnis von Phase 1: Bei 402 px überläuft in WebKit nur `/mitglieder/server-analytics`; die
Seiten aus den Bildern des Nutzers tun es mit dem lokalen Datenstand nicht. Die vollständige
Auswertung steht in `docs/Analysen/handy-ueberlauf-webkit-befunde.md`.

## Entscheidungen (2026-09-29)

- E1: Kein globales `overflow-x: clip` auf `html`/`body`. Der Nutzer will die Ursachen an den
  Boxen behoben haben, nicht den Überlauf verdeckt.
- E2: WebKit wird gleichwertiges Testziel neben Chromium – es ist die Engine des betroffenen
  Geräts. Ohne diesen Schritt bleibt jede Freigabe ein Blindflug.
- E3: Die Diagnose wird dauerhaft nutzbar gemacht (Elementmessung im Prüfskript statt einmaliger
  Handmessung), damit künftige Überläufe sofort mit Adresse gemeldet werden.
- E4: Detailrouten werden mit echten IDs geprüft; die ID kommt aus dem ersten passenden Link der
  jeweiligen Übersicht. Kein Zugriff auf die Datenbank, dadurch auch auf Staging lauffähig.
- E5: Zusätzliche Prüf-Viewports `mobile-iphone` (402 × 874, das gemeldete Gerät) und
  `tablet-mini` (744 × 1133, iPad mini hochkant) ergänzen die bisherigen Presets.
- E6: Die Werkzeugzeile der Terminplanung bleibt mobil einzeilig; der Umschalter wechselt unterhalb
  von `sm` auf Kurzlabels statt umzubrechen.
- E7: Weil in Phase 1 nur eine Route überlief, während das Gerät des Nutzers nachweislich mit
  doppelter Breite rechnete, wird die systemische Rasterfalle zur eigenen Phase vorgezogen
  (neue Phase 3). Ein einzelner Auslöser lässt sich nicht beheben, ohne die Widerstandsfähigkeit
  der Vorlagen insgesamt zu erhöhen.
- E8: Überlauf wird erst gemessen, wenn die Dokumentbreite steht (`waitForStableWidth`). Ein
  Befund gegen einen halbfertigen Aufbau ist wertlos, und ein grüner Lauf nach einem roten bei
  unverändertem Code ist kein Zufall, sondern ein Messfehler.

## Phasen

1. **Reproduktion und Diagnose. (umgesetzt)** WebKit-Projekt `mobile-webkit` in
   `playwright.config.ts`, `--browser webkit` in `scripts/ui-check.mjs`, Viewports
   `mobile-iphone` und `tablet-mini`. Routenliste auf 31 statische und 9 Detailrouten erweitert,
   `TABLET_OVERFLOW_KNOWN` entfernt. Fehlermeldung nennt äußerste Box und auslösenden Inhalt.
   `waitForStableWidth` gegen Fehlbefunde vom kalten Dev-Server. Ergebnisse in
   `docs/Analysen/handy-ueberlauf-webkit-befunde.md`.
   Abschluss: Der Überlauf reproduziert sich in WebKit, zwei unabhängige Werkzeuge melden
   dieselbe Zahl.
2. **Gemeinsame Bausteine härten.** `SegmentedControl` (umbrechen können, `min-w-0`, Kurzlabel
   unter `sm`) und `SectionNav` (umbrechen oder unter `sm` konsequent der Select) so umbauen,
   dass sie nie breiter als ihr Container werden. Das Werkzeugzeilen-Muster (Suche links,
   primäre Aktion rechts) als verbindliche Regel in `docs/design-system.md` festschreiben.
   Abschluss: Beide Bausteine halten in WebKit bei 402 px und 744 px dicht, die Bestandsseiten
   bleiben optisch unverändert.
3. **Systemische Rasterfalle.** Jedes `grid gap-N <breakpoint>:grid-cols-M` ohne Basis-Spalte
   bekommt `grid-cols-1` (also `minmax(0,1fr)`), damit eine `auto`-Spur die Seite nicht mehr
   aufreißen kann. An den gemeldeten Stellen zusätzlich `min-w-0` und Umbrechmöglichkeit
   (`break-words`, `break-all`) für lange Werte. Die 117 Fundstellen werden nach Bereich
   abgearbeitet, je Bereich ein Commit. Abschluss: Der WebKit-Lauf ist auch auf
   `/mitglieder/server-analytics` grün, und ein eingesetzter Prüfwert aus 60 Zeichen ohne
   Leerzeichen reißt keine Seite mehr auf.
4. **Die drei gemeldeten Werkzeugzeilen.** Kartenkopf der Zuweisung (`assignment-board.tsx`),
   Werkzeugzeile der Sperrliste (`sperrliste/page-client.tsx`) und Werkzeugzeile der
   Terminplanung (`terminplanung/page-client.tsx`) überlauffrei machen. Je Seite ein eigener
   Commit. Abschluss: Die drei Seiten sind in WebKit überlauffrei und in Handy, Tablet und
   Desktop, hell und dunkel abgesegnet.
5. **Prüfnetz ausbauen.** `--browser webkit` in `scripts/e2e-screenshots.mjs`, WebKit-Installation
   in der CI, WebKit-Projekt in den Standardlauf. Abschluss: Beide Skripte und die CI prüfen
   WebKit mit, ohne dass eine Route stillschweigend entfällt.
6. **Doku und Abschluss.** `docs/responsiveness-matrix.md` in WebKit neu messen und die Prüfwege
   korrigieren, betroffene Dateien in `docs/seiten/` nachziehen und in `AGENTS.md` den neuen
   Standard aufnehmen: Der Überlauf-Test läuft zusätzlich in WebKit, gemessen wird erst bei
   stabiler Breite, und Werkzeugzeilen und Umschalter dürfen nie breiter als ihr Container werden.
   Abschluss: Die Doku deckt den gemessenen Stand.

## Checkliste

- [x] Phase 0 – diesen Plan anlegen und im Index eintragen
- [x] Phase 1 – Reproduktion und Diagnose in WebKit
- [ ] Phase 2 – gemeinsame Bausteine (`SegmentedControl`, `SectionNav`, Muster)
- [ ] Phase 3 – systemische Rasterfalle (117 Stellen)
- [ ] Phase 4 – Terminplanung, Sperrliste, Teams & Zuweisung
- [ ] Phase 5 – Prüfnetz (Screenshots-Skript, CI, Matrix)
- [ ] Phase 6 – Doku und Abschluss
