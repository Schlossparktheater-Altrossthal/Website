# Plan: Handy-Darstellung – horizontales Überlaufen und Miniatur-Zoom

Stand: 2026-09-29. Entwurf; Phase 0 angelegt, Umsetzung beginnt mit Phase 1. Checkliste am Ende wird gepflegt.

## Ziel

Desktop-Chromium meldet alle Mitgliederseiten als überlauffrei, auf dem iPhone des Nutzers
laufen Boxen über den Rand und die Seite kippt in eine winzige Darstellung: Das Layout entsteht
bei etwa 770–1020 px Breite auf einem 402-px-Gerät, weil dort `md:`-Stile greifen, `lg:` aber
nicht. Dieser Plan schließt die Lücke. Zuerst wird das Verhalten in der echten Browser-Engine
(WebKit) reproduzierbar gemacht, dann werden die Ursachen an den Boxen behoben.

1. Überlauf in WebKit reproduzierbar machen und die schuldige Box benennen können.
2. Jedem Überlauf seine Ursache nehmen – kein globales Abschneiden der Seite.
3. Prüfnetz so erweitern, dass WebKit und dynamische Routen dauerhaft mitgeprüft werden.
4. Doku und Responsiveness-Matrix auf den gemessenen Stand bringen.

## Ist-Stand (Befunde)

| #   | Befund                                                                                                                                                                      | Stelle                                                                                          |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 1   | Alle Playwright-Projekte laufen mit Chromium, auch das Projekt `mobile` – die Engine des betroffenen Geräts (WebKit/Safari) wird nie geprüft.                               | `playwright.config.ts` (Projekte ab Zeile 45), `scripts/lib/e2e-session.mjs`                    |
| 2   | Der Überlauf-Test vergleicht nur die Dokumentbreite gegen den Viewport und nennt keine schuldige Box.                                                                       | `e2e/responsive-overflow.spec.ts` (Zeile 26–30)                                                 |
| 3   | Die Routenliste des Tests deckt nur einen Teil der Seiten ab; es fehlen u. a. Benachrichtigungen, Datenportal, Termine, Proben, Ensemble, Mitglieder-Detail, Gewerk-Detail. | `e2e/responsive-overflow.spec.ts` (ROUTES, Zeile 8–33)                                          |
| 4   | Der Tablet-Skip für die Sperrliste ist laut eigener Doku überholt.                                                                                                          | `e2e/responsive-overflow.spec.ts` (`TABLET_OVERFLOW_KNOWN`) vs. `docs/responsiveness-matrix.md` |
| 5   | `SegmentedControl` kann nie unter die Summe seiner Labels schrumpfen: Container ohne `flex-wrap`/`overflow-x-auto`, Segmente `whitespace-nowrap` ohne `min-w-0`.            | `src/components/ui/segmented-control.tsx:43-61`                                                 |
| 6   | `SectionNav` hat weder `flex-wrap` noch `overflow-x-auto`; die Einträge haben kein `whitespace-nowrap`.                                                                     | `src/components/ui/section-nav.tsx:34-50`                                                       |
| 7   | Werkzeugzeile der Terminplanung: der Umschalter „Alle / Proben / Termine“ ist nicht schrumpfbar, die rechte Gruppe rutscht in eine zweite Zeile.                            | `src/app/(members)/mitglieder/terminplanung/page-client.tsx:248-289`                            |
| 8   | Werkzeugzeile der Sperrliste ist `flex items-center gap-2` ohne `flex-wrap`; „Mein Kalender / Team“ plus `ml-auto`-Aktionen laufen über.                                    | `src/app/(members)/mitglieder/sperrliste/page-client.tsx:148-184`                               |
| 9   | Kartenkopf der Zuweisung ohne `flex-wrap`; die rechte Gruppe ist etwa 200 px fix, der Titel wird auf etwa 100 px gestaucht.                                                 | `src/app/(members)/mitglieder/produktionen/zuweisung/assignment-board.tsx:855-903`              |
| 10  | Die Responsiveness-Matrix weist überall „ok“ aus, gemessen am 2026-09-26 mit Chromium.                                                                                      | `docs/responsiveness-matrix.md`                                                                 |

Gerät und Beobachtungen des Nutzers: iPhone 17 ohne Display-Zoom (etwa 402 px CSS-Breite, also
breiter als die getestete Referenz von 390 px), im Safari-Tab und in der installierten Web-App.
Der Miniatur-Zoom tritt direkt nach dem Laden auf und auf allen Seiten.

## Entscheidungen (2026-09-29)

- E1: Kein globales `overflow-x: clip` auf `html`/`body`. Der Nutzer will die Ursachen an den
  Boxen behoben haben, nicht den Überlauf verdeckt.
- E2: WebKit wird gleichwertiges Testziel neben Chromium – es ist die Engine des betroffenen
  Geräts. Ohne diesen Schritt bleibt jede Freigabe ein Blindflug.
- E3: Die Diagnose wird dauerhaft nutzbar gemacht (Elementmessung im Prüfskript statt einmaliger
  Handmessung), damit künftige Überläufe sofort mit Adresse gemeldet werden.
- E4: Dynamische Routen werden mit echten IDs aus der lokalen Datenbank geprüft, nicht mit
  künstlichen Fixtures.
- E5: Ein zusätzlicher Prüf-Viewport `tablet-mini` (744×1133, iPad mini hochkant) kommt in die
  Liste, weil das Gerät wiederholt genannt wurde und zwischen den bisherigen Tablet-Projekten liegt.
- E6: Die Werkzeugzeile der Terminplanung bleibt mobil einzeilig; der Umschalter wechselt unterhalb
  von `sm` auf Kurzlabels statt umzubrechen.

## Phasen

1. **Reproduktion und Diagnose.** WebKit-Projekt `mobile-webkit` (402×874, `isMobile`,
   `hasTouch`) in `playwright.config.ts`, WebKit-Browser installieren. Routenliste in
   `e2e/responsive-overflow.spec.ts` vervollständigen, dynamische IDs über einen Helper aus der
   Datenbank ziehen, `TABLET_OVERFLOW_KNOWN` entfernen. `scripts/ui-check.mjs` um die
   Elementmessung erweitern (`getBoundingClientRect().right > window.innerWidth + 1`, zusätzlich
   `left < -1`); schuldige Elemente mit Selektor und Text in `report.json`. Diagnoselauf über
   alle Routen und Viewports, Befundtabelle mit Route, Viewport und schuldiger Box in
   `docs/Analysen/` ablegen. Abschluss: Der Überlauf reproduziert sich in WebKit und jede
   betroffene Route hat eine benannte Box. Kein Fix in dieser Phase.
2. **Gemeinsame Bausteine härten.** `SegmentedControl` (umbrechen können, `min-w-0`, Kurzlabel
   unter `sm`) und `SectionNav` (umbrechen oder unter `sm` konsequent der Select) so umbauen,
   dass sie nie breiter als ihr Container werden. Das Werkzeugzeilen-Muster (Suche links,
   primäre Aktion rechts) als verbindliche Regel in `docs/design-system.md` festschreiben.
   Abschluss: Beide Bausteine halten in WebKit bei 402 px und 744 px dicht, die Bestandsseiten
   bleiben optisch unverändert.
3. **Die drei bekannten Werkzeugzeilen.** Zuweisungs-Kartenkopf (`assignment-board.tsx`),
   Sperrlisten-Werkzeugzeile (`sperrliste/page-client.tsx`) und Terminplanungs-Werkzeugzeile
   (`terminplanung/page-client.tsx`) überlauffrei machen. Je Seite ein eigener Commit.
   Abschluss: Die drei Seiten sind in WebKit überlauffrei und in Handy, Tablet und Desktop,
   hell und dunkel abgesegnet.
4. **Weitere Befunde aus Phase 1.** Die restlichen in Phase 1 benannten Boxen abarbeiten, je
   Seite ein Commit. Abschluss: Der WebKit-Lauf über alle Routen meldet keinen Überlauf mehr.
5. **Prüfnetz ausbauen.** `--browser webkit` in `scripts/ui-check.mjs` und
   `scripts/e2e-screenshots.mjs`, WebKit-Installation in der CI, `tablet-mini` in
   `scripts/lib/e2e-session.mjs`. Abschluss: Beide Skripte und die CI prüfen WebKit mit.
6. **Doku und Abschluss.** `docs/responsiveness-matrix.md` in WebKit neu messen und die
   Prüfwege korrigieren, betroffene Dateien in `docs/seiten/` nachziehen und in `AGENTS.md` den
   neuen Standard aufnehmen: Der Überlauf-Test läuft zusätzlich in WebKit, und Werkzeugzeilen
   und Umschalter dürfen nie breiter als ihr Container werden. Abschluss: Die Doku deckt den
   gemessenen Stand.

## Checkliste

- [ ] Phase 0 – diesen Plan anlegen und im Index eintragen
- [ ] Phase 1 – Reproduktion und Diagnose in WebKit
- [ ] Phase 2 – gemeinsame Bausteine (`SegmentedControl`, `SectionNav`, Muster)
- [ ] Phase 3 – Terminplanung, Sperrliste, Teams & Zuweisung
- [ ] Phase 4 – weitere Befunde aus Phase 1
- [ ] Phase 5 – Prüfnetz (Skripte, CI, `tablet-mini`)
- [ ] Phase 6 – Doku und Abschluss
