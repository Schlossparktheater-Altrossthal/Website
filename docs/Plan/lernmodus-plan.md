# Plan: Lernmodus für Skripte

Phase 13 aus `docs/Plan/skript-plan.md`. Vollbild-App wie der Leser (`src/app/(reader)/`), mobil
und am Rechner gut bedienbar, Spielelemente nur sparsam.

## Grundlagen (Forschung)

- **Abrufen statt Wiederlesen** (Testing Effect, Roediger & Karpicke 2006): verdecken und abfragen.
- **Verteiltes Wiederholen** (Spacing, Cepeda u. a. 2006): Planung mit FSRS (`ts-fsrs`, MIT).
- **Selbst erzeugen** (Generation Effect): Lücken und Anfangsbuchstaben statt Volltext.
- **Hilfen ausblenden** („vanishing cues“): Lücken → Anfangsbuchstaben → verdeckt.
- **Verstehen im Zusammenhang** (Noice & Noice, Schauspieler): Szenenfluss ist der Hauptmodus.
- **Stichwort → Antwort**: gelernt wird immer mit dem Stichwort davor.

## Entscheidungen (2026-10-13)

- L1 Lernstand je Person, Rolle und Abschnitt; jede Rolle ist wählbar, die eigene vorbelegt.
- L2 Gemeinsame Repliken („Atreju/Bastian“) zählen für jede ihrer Rollen.
- L3 Keine Spracherkennung (vorerst).
- L4 Keine Freigabe des Lernstands an die Regie (vorerst); Lernstand ist privat.
- L5 Nach den fälligen Karten kann man jederzeit weiterlernen („Mehr lernen“: neue Abschnitte,
  danach vorgezogene Wiederholungen).
- L6 Bewertung wird aus dem Verhalten abgeleitet (nichts aufgedeckt → Gut, wenig → Schwer, ganz
  → Nochmal) und lässt sich kurz korrigieren.
- L7 Gelernt wird immer die neueste freigegebene Fassung eines Stücks; Route `/mitglieder/lernen/[showId]`.

## Lerneinheit

- Abschnitt = Satzgruppe einer Replik (lange Repliken geteilt, ca. ≤ 25 Wörter), Schlüssel
  `lineageId` + Abschnittsnummer. Regieanweisungen und Hinweise werden nicht gelernt.
- Prüfsumme des Wortlauts: geändert → Hinweis „Text geändert“, Stufe höchstens Lücken.
- Stufe automatisch aus der Stabilität (neu → Lücken, < 3 Tage → Anfangsbuchstaben, sonst
  verdeckt) oder fest gewählt (Volltext/Lücken/Anfangsbuchstaben/verdeckt). Bei Volltext wird
  nichts bewertet.

## Oberflächen

- **Dashboard**: heute fällig + Minuten, Start; Weiterlernen; „Mehr lernen“; nächste Proben mit
  Sicherheit je Szene; Szenenbalken (neu/lernend/sitzt); Wochenziel (Tage, kein Streak);
  Meilensteine.
- **Szenenfluss**: Szene läuft, fremde Repliken sichtbar (optional vorgelesen), eigene verdeckt;
  Tippen = Wort, Halten = Abschnitt, Weiter = Wischen/Leertaste/Knopf. Kurze Leiste zum
  Korrigieren der Bewertung.
- **Abfrage**: Stichwort groß, Abschnitt verdeckt, aufdecken, bewerten (vorgeschlagene Bewertung
  hervorgehoben, Enter übernimmt).
- **Tippmodus** (Rechner): Anfangsbuchstaben tippen deckt Wörter auf, Fehler färben rot.

## Probenplan

Szenen des Stücks (`Scene`) werden über Titel/Nummer den Skript-Szenen zugeordnet. Szenen, die in
den nächsten 14 Tagen geprobt werden, ziehen ihre Abschnitte vor.

## Phasen

- [x] Phase 1 Datenmodell (ScriptLearnCard, ScriptLearnReview, ScriptLearnProfile), FSRS, Abschnitte
- [x] Phase 2 Szenenfluss mit Stufen, Aufdecken, automatischer Bewertung
- [x] Phase 3 Dashboard und Abfrage, „Mehr lernen“
- [x] Phase 4 Probenplan, Vorlesen, Tippmodus
- [x] Phase 5 Offline-Warteschlange, Wochenziel, Meilensteine
- [x] Phase 6 E2E + Screenshots (e2e/lernen.spec.ts, Staging 2026-10-13)
- [ ] Release (Prod) und Gerätetest (Halten, Wischen, Vorlesen auf iPhone/Android)
