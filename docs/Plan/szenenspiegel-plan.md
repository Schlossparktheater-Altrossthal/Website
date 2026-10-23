# Szenenspiegel und Doppelbesetzung

Stand 2026-10-23. Übersichten im Skript-Leser (`/mitglieder/skript/[fassung]/uebersicht`).

## Problem

Die alte Auftrittsmatrix (Rolle × Szene mit Punkten) war bei vielen kleinen Rollen
(„In 80 Tagen um die Welt“: 37 Rollen, 27 Szenen) unübersichtlich: kleine Rollen und Gruppen
zwischen den Hauptrollen, verwirrende Spaltenköpfe (20.A → „20“, „1. TEIL“ als Szene),
mobil nur 6 von 27 Szenen sichtbar.

## Umsetzung

Logik in `src/lib/skript/casting.ts`, Oberfläche in `uebersicht/casting-views.tsx`.

**Reiter „Spiegel“**

- Rollen nach Gewicht: Hauptrollen (≥ 8 % der Wörter oder in ≥ 40 % der Szenen), Nebenrollen
  (≥ 3 Szenen), kleine Rollen, Ensemble & Gruppen („Alle“, „Chor“, „Weitere …“). Kleine Rollen und
  Gruppen sind eingeklappt.
- Szenenleiste je Rolle ohne Querscrollen; aufeinanderfolgende Auftritte verschmelzen zu Balken,
  Teil-/Akt-Überschriften als Trennlinie, Breite wahlweise gleich oder nach Dauer.
- Rolle antippen: Rollen in denselben Szenen rot, kombinierbare mit ✓, Liste „kombinierbar mit“.
  Szene antippen: Titel, Dauer, alle Anwesenden.

**Reiter „Besetzung“** (Doppelbesetzung)

- Zwei Rollen sind kombinierbar, wenn sie nie in derselben Szene stehen und mindestens der
  Umziehpuffer (Standard 1 Szene, einstellbar 0–2) dazwischen liegt.
- „Nur in Regieanweisungen genannt“ zählt als anwesend. Gruppen zählen nicht als Person.
- Vorschlag per Graphfärbung (DSatur): Hauptrollen einzeln, Neben-/kleine Rollen gebündelt.
  Untergrenze = Personen in der vollsten Szene.
- Rollen per Auswahl einer anderen Person geben; Konflikte rot. Eigene Aufteilung im Browser
  (localStorage) gespeichert, CSV-Export.

## Offen / später

- Übernahme der Bündel in die echte Besetzung über den geplanten Übernahme-Assistenten
  (Skript ↔ Stück, siehe skript-plan.md).
- Aufteilung serverseitig speichern und teilen, PDF-Abschnitt „Doppelbesetzung“, PDF-Matrix
  an den neuen Spiegel angleichen.
- Sammelrollen optional einer Gruppe von Personen zuordnen.
