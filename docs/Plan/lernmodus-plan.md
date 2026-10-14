# Plan: Lernmodus für Skripte

Stand: 2026-10-14 – Phase 1–6 umgesetzt (Staging), Runde 2 (Review) Schritt 1–5 umgesetzt, offen Release und Gerätetest.

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

## Runde 2: Review 2026-10-13

### Schritt 1 Algorithmus und Fortschrittsanzeige (umgesetzt)

- R1 Geänderter Text: alte Stabilität höchstens 2 Tage, nächste Abfrage spätestens nach 1 Tag
  (`applyReview`, gleich auf Client und Server). Vorher war eine geänderte Stelle nach einmal
  „Gut“ wochenlang weg.
- R2 Szenenfluss bewertet nur neue, fällige und geänderte Stellen; der Rest ist Übung. Unter
  1,5 s und nichts aufgedeckt/getippt = weitergeklickt, keine Bewertung.
- R3 Hilfe deckelt die Bewertung: Lücken höchstens „Schwer“, Anfangsbuchstaben höchstens „Gut“
  (`capRating`; Stufe wird mitgespeichert, Knöpfe darüber gesperrt).
- R4 Abfrage behält Stellen im Lernschritt (neu, „Nochmal“, Korrektur auf „Nochmal“) in der
  Runde, höchstens 3× je Stelle.
- R5 Doppelte Einträge: Server wertet nur Abfragen neuer als die letzte, eindeutiger Index
  `(cardId, reviewedAt)` (Migration 20261014090000).
- R6 Vor einer Probe (≤ 2 Tage) gelten Stellen der Szene als fällig, wenn sie am Probentag
  wahrscheinlich nicht mehr sitzen (Abrufwahrscheinlichkeit < 90 %).
- R7 Fortschritt je Szene zählt Stellen (gemeinsame Repliken/mehrere Rollen einmal, schwächste
  Karte); „sitzt“ = Stabilität ≥ 7 Tage **und** Abrufwahrscheinlichkeit ≥ 90 % (verfällt).
  Anzeige „8 von 12 sitzen · 3 fällig“; Textsicherheit = mittlere Abrufwahrscheinlichkeit;
  Probenliste zeigt die Prognose für den Probentag.

### Schritt 2 Insights (umgesetzt, Ansicht „Dein Lernstand“)

- Problemstellen (meiste „Nochmal“, höchste Schwierigkeit) mit „Nur die üben“.
- Stichwort-Schwächen (im Fluss schlechter als in der Abfrage).
- Lerntage der letzten 12 Wochen, Abfragen dieser Woche; Vergessens-Prognose (heute, 3, 7, 14 Tage).
- Logik `src/lib/skript/learn/insights.ts`, Verlauf aus ScriptLearnReview (12 Wochen, dieses Stück).
- Verlauf der Textsicherheit, Szene als Textkarte und Wort-Diff siehe Schritt 4.

### Schritt 3 Belohnung und Darstellung (umgesetzt)

- Rundenende mit Zusammenfassung (hochzählend: Stellen, gleich gewusst, Sicherheit +x %, neue).
- Häkchen/Symbol nach jeder Bewertung, Vibration (Android); Szene sitzt → Vorhang-Feier
  (`celebrate.tsx`, framer-motion, `prefers-reduced-motion` nur Einblenden).
- Dashboard: Überblick mit Ring „Textsicherheit“ (→ Statistik) und nächster Probe mit Prognose.
- Meilensteine siehe Schritt 4.

### Schritt 4 Rest der Review-Runde (umgesetzt)

- Endspurt: Abstände enden spätestens 12 h vor der Premiere (`Show.premiereAt`), in den letzten
  14 Tagen Erinnerungsziel 0,95; Hinweis „Endspurt“ im Dashboard.
- Geänderter Text: Karte speichert den Wortlaut (`ScriptLearnCard.text`, Migration
  20261014120000); „Was hat sich geändert?“ zeigt den Wort-Diff (deckt die Stelle auf).
- Meilensteine (Akte gibt es im Skript nicht): erste Stelle, alles angefangen, erste Szene,
  Halbzeit, ganze Rolle, 100/500 Abfragen, Wochenziel 1×/3×; Feier beim ersten Erreichen
  (gemerkt in localStorage, beim allerersten Laden keine Feier für Altes).
- Verlauf der Textsicherheit (Abfragen nachgespielt, letzte 8 Wochen) in der Statistik.
- Szene als Textkarte: eigene Repliken im Szenenfluss nach gespeicherter Sicherheit eingefärbt.

### Schritt 5 Offline (umgesetzt)

- Service Worker hält `/mitglieder/lernen/[showId]` vor (NetworkFirst, Cache `lernen-pages`); die
  Seite legt sich beim Öffnen selbst in den Cache (auch nach Client-Navigation).
- Lernstand zusätzlich im Gerät (`lernen-stand:<showId>`), beim Laden zusammengeführt
  (`mergeSnapshot`: lokal zählt nur, was nach dem Erzeugen der Seite gelernt wurde).
- Bewertungen weiter über `lernen-outbox:<showId>`; Wochenziel wird nachgereicht, Zurücksetzen
  nur online. Status „Offline nutzbar“ in den Lern-Einstellungen.
- Offline-Seite (`public/offline.html`) verlinkt vorgehaltene Lernseiten.
- Nicht offline: Leser, Skript-Übersicht, andere Seiten (Skript-Phase 12).

### Später

- Rückwärts lernen, Stichwort-Training, Audio-Modus, Partner-Abfrage, Push-Erinnerung (Opt-in).
